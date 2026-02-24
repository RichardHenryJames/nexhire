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

  console.log('\n=== 1. TEMPLATES (seed data) ===');
  const t = await pool.request().query(
    'SELECT TemplateID, Name, Slug, Category, IsPremium FROM ResumeBuilderTemplates ORDER BY SortOrder'
  );
  t.recordset.forEach(x => console.log(`  #${x.TemplateID} ${x.Name} (${x.Slug}) — ${x.Category} — ${x.IsPremium ? 'PREMIUM' : 'free'}`));

  console.log('\n=== 2. PROJECTS (user-created resumes) ===');
  const p = await pool.request().query(
    `SELECT p.ProjectID, p.Title, p.Status, p.TemplateID, t.Name as TemplateName,
            LEFT(p.PersonalInfo, 100) as PersonalInfoPreview,
            LEFT(p.Summary, 100) as SummaryPreview,
            p.MatchScore, p.CreatedAt, p.UpdatedAt
     FROM ResumeBuilderProjects p
     JOIN ResumeBuilderTemplates t ON p.TemplateID = t.TemplateID
     WHERE p.IsDeleted = 0
     ORDER BY p.CreatedAt DESC`
  );
  if (p.recordset.length === 0) {
    console.log('  (no projects yet)');
  } else {
    p.recordset.forEach(x => {
      console.log(`  📄 "${x.Title}" — ${x.TemplateName} template — Status: ${x.Status}`);
      console.log(`     ID: ${x.ProjectID}`);
      console.log(`     PersonalInfo: ${x.PersonalInfoPreview || '(empty)'}`);
      console.log(`     Summary: ${x.SummaryPreview || '(empty)'}`);
      console.log(`     ATS Score: ${x.MatchScore || 'not checked'}`);
      console.log(`     Created: ${x.CreatedAt}  Updated: ${x.UpdatedAt}`);
    });
  }

  console.log('\n=== 3. SECTIONS (per project) ===');
  const s = await pool.request().query(
    `SELECT s.SectionID, s.ProjectID, s.SectionType, s.SectionTitle, s.SortOrder, s.IsVisible,
            LEN(s.Content) as ContentLen, LEFT(s.Content, 120) as ContentPreview
     FROM ResumeBuilderSections s
     JOIN ResumeBuilderProjects p ON s.ProjectID = p.ProjectID
     WHERE p.IsDeleted = 0
     ORDER BY s.ProjectID, s.SortOrder`
  );
  if (s.recordset.length === 0) {
    console.log('  (no sections yet)');
  } else {
    let lastProject = '';
    s.recordset.forEach(x => {
      if (x.ProjectID !== lastProject) {
        console.log(`\n  Project: ${x.ProjectID.substring(0, 8)}...`);
        lastProject = x.ProjectID;
      }
      console.log(`    ${x.SortOrder}. [${x.SectionType}] "${x.SectionTitle}" — ${x.IsVisible ? '👁 visible' : '🚫 hidden'} — ${x.ContentLen} chars`);
      console.log(`       Preview: ${x.ContentPreview}`);
    });
  }

  console.log('\n=== 4. EXPORTS (download history) ===');
  const e = await pool.request().query('SELECT COUNT(*) as cnt FROM ResumeBuilderExports');
  console.log(`  ${e.recordset[0].cnt} exports total`);

  console.log('\n✅ Done');
  pool.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
