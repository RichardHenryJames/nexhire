const sql = require('mssql');

const config = {
  server: 'refopen-sqlserver-ci.database.windows.net',
  database: 'refopen-sql-db',
  user: 'sqladmin',
  password: 'RefOpen@2024!Secure',
  options: { encrypt: true, requestTimeout: 60000 }
};

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
