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
  
  // Check actual CSS in DB for each template — look for key spacing values
  const r = await pool.request().query(`
    SELECT Slug, Name,
           CASE WHEN CssTemplate LIKE '%padding:.4in%' THEN 'TIGHT' 
                WHEN CssTemplate LIKE '%padding:.35in%' THEN 'TIGHT'
                ELSE 'LOOSE' END as Spacing,
           CASE WHEN CssTemplate LIKE '%font-size:22pt%' THEN '22pt' 
                WHEN CssTemplate LIKE '%font-size:24pt%' THEN '24pt'
                WHEN CssTemplate LIKE '%font-size:26pt%' THEN '26pt'
                WHEN CssTemplate LIKE '%font-size:28pt%' THEN '28pt'
                WHEN CssTemplate LIKE '%font-size:30pt%' THEN '30pt'
                WHEN CssTemplate LIKE '%font-size:32pt%' THEN '32pt'
                ELSE '?' END as NameSize,
           CASE WHEN CssTemplate LIKE '%margin-bottom:8pt%' THEN '8pt'
                WHEN CssTemplate LIKE '%margin-bottom:14pt%' THEN '14pt'
                WHEN CssTemplate LIKE '%margin-bottom:18pt%' THEN '18pt'
                WHEN CssTemplate LIKE '%margin-bottom:12pt%' THEN '12pt'
                ELSE '?' END as SectionMargin
    FROM ResumeBuilderTemplates
    ORDER BY SortOrder
  `);

  console.log('\n📏 TEMPLATE SPACING CHECK:\n');
  r.recordset.forEach(t => {
    const icon = t.Spacing === 'TIGHT' ? '✅' : '❌';
    console.log(`${icon} ${t.Name} (${t.Slug}) — Spacing: ${t.Spacing} | Name: ${t.NameSize} | Section margin: ${t.SectionMargin}`);
  });

  pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
