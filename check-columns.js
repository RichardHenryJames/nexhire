const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'refopen-sqlserver-ci.database.windows.net',
  database: process.env.DB_NAME || 'refopen-sql-db',
  user: process.env.DB_USER || 'sqladmin',
  password: process.env.DB_PASSWORD,  // REQUIRED: Set DB_PASSWORD env var
  options: { encrypt: true, requestTimeout: 60000 }
};

if (!config.password) {
  console.error('ERROR: DB_PASSWORD environment variable is required');
  process.exit(1);
}

async function checkTables() {
  const pool = await sql.connect(config);
  
  // Get all tables with FK to Users
  const r = await pool.request().query(`
    SELECT 
      OBJECT_NAME(fk.parent_object_id) AS child_table,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS child_col
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    WHERE OBJECT_NAME(fk.referenced_object_id) = 'Users'
    ORDER BY child_table
  `);
  
  console.log('All tables referencing Users:');
  r.recordset.forEach(x => console.log(`  ${x.child_table}.${x.child_col}`));
  
  process.exit(0);
}
checkTables().catch(e => { console.error(e.message); process.exit(1); });
