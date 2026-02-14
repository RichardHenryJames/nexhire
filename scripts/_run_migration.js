const sql = require('mssql');
const fs = require('fs');

const config = {
  server: 'refopen-sqlserver-ci.database.windows.net',
  database: 'refopen-sql-db',
  user: 'sqladmin',
  password: 'SecureRef2026#Prod!Kv',
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000 }
};

(async () => {
  const pool = await sql.connect(config);
  const script = fs.readFileSync('./database/schema/migrations/20260214-create-service-interests.sql', 'utf8');
  const batches = script.split('GO');
  for (const batch of batches) {
    const trimmed = batch.trim();
    if (trimmed) {
      await pool.request().query(trimmed);
      console.log('Executed batch OK');
    }
  }
  console.log('Migration complete!');
  pool.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
