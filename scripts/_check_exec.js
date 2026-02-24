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
    SELECT Slug, CssTemplate FROM ResumeBuilderTemplates WHERE Slug = 'executive'
  `);
  const css = r.recordset[0].CssTemplate;
  
  // Extract key values
  const headerPad = css.match(/\.header\{[^}]*padding:([^;]+)/);
  const mainPad = css.match(/main\{[^}]*padding:([^;]+)/);
  const nameSize = css.match(/\.name\{[^}]*font-size:([^;]+)/);
  const bodySize = css.match(/body\{[^}]*font-size:([^;]+)/);
  const lineHeight = css.match(/body\{[^}]*line-height:([^;]+)/);
  
  console.log('Executive template actual values:');
  console.log('  Header padding:', headerPad?.[1] || '?');
  console.log('  Main padding:', mainPad?.[1] || '?');
  console.log('  Name font-size:', nameSize?.[1] || '?');
  console.log('  Body font-size:', bodySize?.[1] || '?');
  console.log('  Line-height:', lineHeight?.[1] || '?');
  
  const isOld = css.includes('padding:28pt') || css.includes('font-size:30pt');
  console.log('\n  Status:', isOld ? '❌ STILL OLD CSS' : '✅ TIGHTENED CSS');
  
  pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
