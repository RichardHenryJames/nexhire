-- ============================================================
-- Migration: Add WalletHolds Table
-- Date: 2026-02-01
-- Purpose: Support hold-based payment system for referral requests
--          User pays only when referrer completes referral, not upfront
-- ============================================================

-- ============================================================
-- Table: WalletHolds
-- Tracks funds held against referral requests (not yet deducted)
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletHolds')
BEGIN
    CREATE TABLE WalletHolds (
        HoldID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        WalletID UNIQUEIDENTIFIER NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        ReferralRequestID UNIQUEIDENTIFIER NOT NULL,
        Amount DECIMAL(15, 2) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT ('Active'),  -- 'Active', 'Converted', 'Released'
        Description NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        ConvertedAt DATETIME2(7) NULL,    -- When hold became actual debit
        ReleasedAt DATETIME2(7) NULL,     -- When hold was released (expired/cancelled)
        CONSTRAINT PK_WalletHolds PRIMARY KEY (HoldID)
    );
    PRINT 'Created table WalletHolds';
END
GO

-- Foreign Keys
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletHolds_WalletID')
BEGIN
    ALTER TABLE WalletHolds ADD CONSTRAINT FK_WalletHolds_WalletID
        FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID);
    PRINT 'Added FK_WalletHolds_WalletID';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletHolds_UserID')
BEGIN
    ALTER TABLE WalletHolds ADD CONSTRAINT FK_WalletHolds_UserID
        FOREIGN KEY (UserID) REFERENCES Users(UserID);
    PRINT 'Added FK_WalletHolds_UserID';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletHolds_ReferralRequestID')
BEGIN
    ALTER TABLE WalletHolds ADD CONSTRAINT FK_WalletHolds_ReferralRequestID
        FOREIGN KEY (ReferralRequestID) REFERENCES ReferralRequests(RequestID);
    PRINT 'Added FK_WalletHolds_ReferralRequestID';
END
GO

-- Indexes for performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_WalletStatus')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletHolds_WalletStatus 
    ON WalletHolds(WalletID, Status)
    INCLUDE (Amount);
    PRINT 'Created index IX_WalletHolds_WalletStatus';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_RequestID')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_WalletHolds_RequestID 
    ON WalletHolds(ReferralRequestID)
    INCLUDE (HoldID, Amount, Status);
    PRINT 'Created index IX_WalletHolds_RequestID';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_UserStatus')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletHolds_UserStatus 
    ON WalletHolds(UserID, Status, CreatedAt)
    INCLUDE (Amount, ReferralRequestID);
    PRINT 'Created index IX_WalletHolds_UserStatus';
END
GO

-- Index for Phase 2 cron job (find expired holds)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_ActiveExpired')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletHolds_ActiveExpired 
    ON WalletHolds(Status, CreatedAt)
    WHERE Status = 'Active';
    PRINT 'Created filtered index IX_WalletHolds_ActiveExpired';
END
GO

PRINT '✅ WalletHolds migration completed successfully';
GO
