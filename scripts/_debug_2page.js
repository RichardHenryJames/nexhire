/**
 * Root cause: check what CSS the DB actually has for the Classic template
 * AND measure if the content can physically fit on 1 A4 page
 */
const sql = require('mssql');
const config = {
  server: 'refopen-sqlserver-dev.database.windows.net',
  database: 'refopen-sql-db-dev',
  user: 'sqladmin',
  password: 'RefOpenDev@2024!Tle@yTK$',
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000 }
};

(async () => {
  const pool = await sql.connect(config);

  // 1. Check the Classic template CSS - look for key sizing values
  const t = await pool.request().query(`
    SELECT Slug, 
           CAST(CssTemplate AS NVARCHAR(MAX)) as CSS
    FROM ResumeBuilderTemplates 
    WHERE Slug = 'classic'
  `);
  
  const css = t.recordset[0].CSS;
  console.log('=== CLASSIC TEMPLATE CSS ANALYSIS ===');
  
  // Extract key values
  const extract = (pattern) => {
    const m = css.match(pattern);
    return m ? m[1] || m[0] : 'NOT FOUND';
  };
  
  console.log('Body font-size:', extract(/body\{[^}]*font-size:([^;]+)/));
  console.log('Body line-height:', extract(/body\{[^}]*line-height:([^;]+)/));
  console.log('Resume padding:', extract(/\.resume\{[^}]*padding:([^;]+)/));
  console.log('Name font-size:', extract(/\.name\{[^}]*font-size:([^;]+)/));
  console.log('Section margin-bottom:', extract(/\.section\{[^}]*margin-bottom:([^;]+)/));
  console.log('Entry margin-bottom:', extract(/\.entry\{[^}]*margin-bottom:([^;]+)/));
  console.log('Bullets li font-size:', extract(/\.bullets li\{[^}]*font-size:([^;]+)/));
  console.log('Bullets li margin-bottom:', extract(/\.bullets li\{[^}]*margin-bottom:([^;]+)/));
  console.log('Bullets li line-height:', extract(/\.bullets li\{[^}]*line-height:([^;]+)/));
  
  // 2. Count content lines for Parimal's resume
  const proj = await pool.request().query(`
    SELECT p.ProjectID, p.Summary, p.PersonalInfo,
           (SELECT COUNT(*) FROM ResumeBuilderSections WHERE ProjectID = p.ProjectID) as SectionCount
    FROM ResumeBuilderProjects p
    JOIN Users u ON p.UserID = u.UserID
    WHERE u.Email = 'parimalkumar261@gmail.com' AND p.IsDeleted = 0
    ORDER BY p.CreatedAt DESC
  `);
  
  if (proj.recordset.length === 0) {
    console.log('\nNo active projects found!');
    pool.close();
    return;
  }
  
  const project = proj.recordset[0];
  console.log('\n=== CONTENT VOLUME ANALYSIS ===');
  console.log('ProjectID:', project.ProjectID);
  console.log('Summary length:', (project.Summary || '').length, 'chars');
  
  const sections = await pool.request()
    .input('pid', sql.UniqueIdentifier, project.ProjectID)
    .query(`SELECT SectionType, SectionTitle, CAST(Content AS NVARCHAR(MAX)) as Content FROM ResumeBuilderSections WHERE ProjectID = @pid ORDER BY SortOrder`);
  
  let totalBullets = 0;
  let totalItems = 0;
  let totalChars = 0;
  
  for (const s of sections.recordset) {
    const items = JSON.parse(s.Content || '[]');
    let bullets = 0;
    let chars = 0;
    for (const item of items) {
      if (item.bullets) {
        bullets += item.bullets.length;
        chars += item.bullets.reduce((sum, b) => sum + b.length, 0);
      }
      if (item.skills) chars += item.skills.length * 15; // avg skill name length
    }
    totalBullets += bullets;
    totalItems += items.length;
    totalChars += chars;
    console.log(`  ${s.SectionType}: ${items.length} items, ${bullets} bullets, ~${chars} chars`);
  }
  
  console.log(`\nTOTAL: ${totalItems} items, ${totalBullets} bullets, ~${totalChars} chars`);
  
  // A4 page = 11in at 96dpi = 1056px
  // Header ~120px, Summary ~60px, Section titles ~25px each × 4 = 100px
  // Available for content: ~776px
  // At 9.5pt (13px) with line-height 1.35 = ~17.5px per line
  // ~44 lines available for content
  // Each bullet = 1-2 lines avg, each entry header = 2 lines
  const estimatedLines = totalBullets * 1.5 + totalItems * 2 + 5; // skills, certs
  console.log(`\nEstimated content lines: ~${Math.round(estimatedLines)}`);
  console.log('Available lines on 1 A4 page: ~44');
  console.log(estimatedLines > 44 ? '❌ WILL OVERFLOW — content is too much for 1 page even at 9pt' : '✅ Should fit on 1 page');
  
  if (estimatedLines > 44) {
    console.log('\n=== RECOMMENDATION ===');
    console.log('Options to fit on 1 page:');
    console.log('  1. Reduce bullet count: keep top 3-4 per job instead of 7');
    console.log('  2. Use 8.5pt font with 1.25 line-height (very tight but readable)');
    console.log('  3. Remove skills tags (show inline comma-separated instead of tag badges)');
    console.log('  4. Shrink padding to .3in top, .5in sides');
    console.log(`  5. Need to cut ~${Math.round(estimatedLines - 44)} lines worth of content`);
  }

  pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
