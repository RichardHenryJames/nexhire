const sql = require('mssql');

const config = {
  server: 'refopen-sqlserver-ci.database.windows.net',
  database: 'refopen-sql-db',
  user: 'sqladmin',
  password: 'SecureRef2026#Prod!Kv',
  options: { encrypt: true, trustServerCertificate: false }
};

async function runMigration() {
  const pool = await sql.connect(config);
  console.log('Connected to database...');
  
  // Create table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletHolds')
    BEGIN
        CREATE TABLE WalletHolds (
            HoldID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
            WalletID UNIQUEIDENTIFIER NOT NULL,
            UserID UNIQUEIDENTIFIER NOT NULL,
            ReferralRequestID UNIQUEIDENTIFIER NOT NULL,
            Amount DECIMAL(15, 2) NOT NULL,
            Status NVARCHAR(20) NOT NULL DEFAULT ('Active'),
            Description NVARCHAR(500) NULL,
            CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
            ConvertedAt DATETIME2(7) NULL,
            ReleasedAt DATETIME2(7) NULL,
            CONSTRAINT PK_WalletHolds PRIMARY KEY (HoldID)
        );
        PRINT 'Created table WalletHolds';
    END
  `);
  console.log('Table created or already exists');

  // Add foreign keys
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletHolds_WalletID')
        ALTER TABLE WalletHolds ADD CONSTRAINT FK_WalletHolds_WalletID FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID);
  `);
  console.log('FK_WalletHolds_WalletID added');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletHolds_UserID')
        ALTER TABLE WalletHolds ADD CONSTRAINT FK_WalletHolds_UserID FOREIGN KEY (UserID) REFERENCES Users(UserID);
  `);
  console.log('FK_WalletHolds_UserID added');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletHolds_ReferralRequestID')
        ALTER TABLE WalletHolds ADD CONSTRAINT FK_WalletHolds_ReferralRequestID FOREIGN KEY (ReferralRequestID) REFERENCES ReferralRequests(RequestID);
  `);
  console.log('FK_WalletHolds_ReferralRequestID added');

  // Add indexes
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_WalletStatus')
        CREATE NONCLUSTERED INDEX IX_WalletHolds_WalletStatus ON WalletHolds(WalletID, Status) INCLUDE (Amount);
  `);
  console.log('IX_WalletHolds_WalletStatus created');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_RequestID')
        CREATE UNIQUE NONCLUSTERED INDEX IX_WalletHolds_RequestID ON WalletHolds(ReferralRequestID) INCLUDE (HoldID, Amount, Status);
  `);
  console.log('IX_WalletHolds_RequestID created');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_UserStatus')
        CREATE NONCLUSTERED INDEX IX_WalletHolds_UserStatus ON WalletHolds(UserID, Status, CreatedAt) INCLUDE (Amount, ReferralRequestID);
  `);
  console.log('IX_WalletHolds_UserStatus created');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_ActiveExpired')
        CREATE NONCLUSTERED INDEX IX_WalletHolds_ActiveExpired ON WalletHolds(Status, CreatedAt) WHERE Status = 'Active';
  `);
  console.log('IX_WalletHolds_ActiveExpired created');

  console.log('✅ Migration completed successfully!');
  await pool.close();
  process.exit(0);
}

runMigration().catch(err => { 
  console.error('Migration failed:', err.message); 
  process.exit(1); 
});
