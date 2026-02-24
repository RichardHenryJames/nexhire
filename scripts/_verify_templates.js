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
  
  const r = await pool.request().query(`
    SELECT Slug, Name,
           LEN(HtmlTemplate) as HtmlLen,
           LEN(CssTemplate) as CssLen,
           LEFT(HtmlTemplate, 60) as HtmlStart,
           CASE WHEN HtmlTemplate LIKE '%{{FULL_NAME}}%' THEN 'YES' ELSE 'NO' END as HasNamePlaceholder,
           CASE WHEN HtmlTemplate LIKE '%{{SECTIONS_HTML}}%' THEN 'YES' ELSE 'NO' END as HasSectionsPlaceholder,
           CASE WHEN HtmlTemplate LIKE '%{{STYLES}}%' THEN 'YES' ELSE 'NO' END as HasStylesPlaceholder,
           CASE WHEN CssTemplate LIKE '%font-family%' THEN 'YES' ELSE 'NO' END as HasFontFamily,
           CASE WHEN CssTemplate LIKE '%.section-title%' THEN 'YES' ELSE 'NO' END as HasSectionTitleCSS,
           CASE WHEN CssTemplate LIKE '%.entry%' THEN 'YES' ELSE 'NO' END as HasEntryCSS,
           CASE WHEN CssTemplate LIKE '%.skill-tag%' THEN 'YES' ELSE 'NO' END as HasSkillTagCSS,
           CASE WHEN CssTemplate LIKE '%@media print%' THEN 'YES' ELSE 'NO' END as HasPrintCSS
    FROM ResumeBuilderTemplates
    ORDER BY SortOrder
  `);

  console.log('\n🔍 DEEP TEMPLATE VERIFICATION\n');
  
  let allGood = true;
  for (const t of r.recordset) {
    const isPlaceholder = t.HtmlLen < 100 || t.HtmlStart.includes('injected at render time');
    const checks = [
      ['Has real HTML (not placeholder)', !isPlaceholder],
      ['HTML has {{FULL_NAME}}', t.HasNamePlaceholder === 'YES'],
      ['HTML has {{SECTIONS_HTML}}', t.HasSectionsPlaceholder === 'YES'],
      ['HTML has {{STYLES}}', t.HasStylesPlaceholder === 'YES'],
      ['CSS has font-family', t.HasFontFamily === 'YES'],
      ['CSS has .section-title', t.HasSectionTitleCSS === 'YES'],
      ['CSS has .entry', t.HasEntryCSS === 'YES'],
      ['CSS has .skill-tag', t.HasSkillTagCSS === 'YES'],
      ['CSS has @media print', t.HasPrintCSS === 'YES'],
    ];

    const failed = checks.filter(c => !c[1]);
    const status = failed.length === 0 ? '✅' : '❌';
    
    console.log(`${status} ${t.Name} (${t.Slug}) — HTML: ${t.HtmlLen} chars, CSS: ${t.CssLen} chars`);
    if (failed.length > 0) {
      failed.forEach(f => console.log(`   ❌ FAIL: ${f[0]}`));
      allGood = false;
    }
  }

  console.log(`\n${allGood ? '🎉 ALL TEMPLATES VALID' : '⚠️ SOME TEMPLATES HAVE ISSUES'}\n`);
  
  pool.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
