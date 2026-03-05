/**
 * Shared DB config loader for scripts
 * 
 * Reads credentials from local.settings.json (gitignored) or environment variables.
 * Never hardcode passwords in scripts!
 * 
 * Usage:
 *   const { getDbConfig } = require('./utils/db-config');
 *   const config = getDbConfig();
 *   const pool = await sql.connect(config);
 */
const fs = require('fs');
const path = require('path');

function getDbConfig() {
  // 1. Try local.settings.json (primary — gitignored, safe)
  const localSettingsPath = path.join(__dirname, '..', '..', 'local.settings.json');
  
  if (fs.existsSync(localSettingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
      const values = settings.Values || {};
      
      if (values.DB_SERVER && values.DB_PASSWORD) {
        return {
          server: values.DB_SERVER,
          database: values.DB_NAME || 'refopen-sql-db-dev',
          user: values.DB_USER || 'sqladmin',
          password: values.DB_PASSWORD,
          options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000 }
        };
      }
    } catch (e) {
      // Fall through
    }
  }

  // 2. Try environment variables
  if (process.env.DB_SERVER && process.env.DB_PASSWORD) {
    return {
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME || 'refopen-sql-db-dev',
      user: process.env.DB_USER || 'sqladmin',
      password: process.env.DB_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000 }
    };
  }

  // 3. Fail with helpful message
  console.error('❌ No DB credentials found!');
  console.error('   Option 1: Ensure local.settings.json exists with DB_SERVER + DB_PASSWORD');
  console.error('   Option 2: Set DB_SERVER and DB_PASSWORD environment variables');
  process.exit(1);
}

module.exports = { getDbConfig };
