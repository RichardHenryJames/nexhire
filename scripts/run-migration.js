/**
 * Run a SQL migration file against the dev DB
 * Usage: node scripts/run-migration.js <migration-file>
 */
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load DB config from local.settings.json
const localSettingsPath = path.join(__dirname, '..', 'local.settings.json');
const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
const values = settings.Values || {};

const config = {
  server: values.DB_SERVER,
  database: values.DB_NAME || 'refopen-sql-db-dev',
  user: values.DB_USER || 'sqladmin',
  password: values.DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000 }
};

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <path-to-migration.sql>');
  process.exit(1);
}

(async () => {
  const pool = await sql.connect(config);
  const script = fs.readFileSync(migrationFile, 'utf8');
  const batches = script.split('GO');
  for (const batch of batches) {
    const trimmed = batch.trim();
    if (trimmed && !trimmed.startsWith('--')) {
      await pool.request().query(trimmed);
      console.log('✅ Executed batch OK');
    }
  }
  console.log('\n🎉 Migration complete!');
  pool.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
