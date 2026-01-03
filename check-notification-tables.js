const sql = require('mssql');

const config = {
  server: 'refopen-sqlserver-ci.database.windows.net',
  database: 'refopen-sql-db',
  user: 'sqladmin',
  password: 'RefOpen@2024!Secure',
  options: { encrypt: true, trustServerCertificate: false }
};

async function checkTables() {
  try {
    await sql.connect(config);
    
    // Check for notification-related tables
    const tables = await sql.query`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%Notification%'
      ORDER BY TABLE_NAME
    `;
    
    console.log('\n=== Notification Tables ===');
    if (tables.recordset.length === 0) {
      console.log('❌ No notification tables found! Migration needed.');
    } else {
      tables.recordset.forEach(t => console.log('✅', t.TABLE_NAME));
    }
    
    // Check NotificationPreferences columns if table exists
    const columns = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'NotificationPreferences'
      ORDER BY ORDINAL_POSITION
    `;
    
    if (columns.recordset.length > 0) {
      console.log('\n=== NotificationPreferences Columns ===');
      columns.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`));
    }
    
    await sql.close();
  } catch (err) {
    console.error('Error:', err.message);
    await sql.close();
  }
}

checkTables();
