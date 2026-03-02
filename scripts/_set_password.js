const bcrypt = require('bcryptjs');
const sql = require('mssql');

(async () => {
  const h = await bcrypt.hash('12345678', 12);
  console.log('Hash:', h);
  const p = await sql.connect({
    server: 'refopen-sqlserver-dev.database.windows.net',
    database: 'refopen-sql-db-dev',
    user: 'sqladmin',
    password: 'RefOpenDev@2024!Tle@yTK$',
    options: { encrypt: true, trustServerCertificate: false }
  });
  const c = await p.request().input('e', sql.NVarChar, 'parimalkumar261@gmail.com')
    .query('SELECT UserID, Email, FirstName FROM Users WHERE Email = @e');
  if (!c.recordset.length) { console.log('User not found'); process.exit(1); }
  console.log('User:', c.recordset[0]);
  const r = await p.request().input('p', sql.NVarChar, h).input('e', sql.NVarChar, 'parimalkumar261@gmail.com')
    .query('UPDATE Users SET Password = @p, UpdatedAt = GETUTCDATE() WHERE Email = @e');
  console.log('Updated:', r.rowsAffected[0]);
  await p.close();
})();
