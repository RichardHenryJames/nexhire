const sql = require('mssql');
(async () => {
  const pool = await sql.connect({
    server: 'refopen-sqlserver-dev.database.windows.net',
    database: 'refopen-sql-db-dev',
    user: 'sqladmin',
    password: 'RefOpenDev@2024!Tle@yTK$',
    options: { encrypt: true }
  });
  const r = await pool.request().query(
    'SELECT TemplateID, Name, LEN(HtmlTemplate) as HtmlLen, LEN(CssTemplate) as CssLen, LEFT(HtmlTemplate, 60) as HtmlStart FROM ResumeBuilderTemplates ORDER BY SortOrder'
  );
  r.recordset.forEach(x => {
    console.log(`#${x.TemplateID} ${x.Name}: HTML=${x.HtmlLen} chars, CSS=${x.CssLen} chars`);
    console.log(`   Start: ${x.HtmlStart}`);
  });
  pool.close();
})().catch(e => console.error(e.message));
