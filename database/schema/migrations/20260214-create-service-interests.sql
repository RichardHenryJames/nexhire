-- ============================================================
-- Migration: Create ServiceInterests table
-- Created: 2026-02-14
-- Purpose: Track user interest in upcoming service features
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ServiceInterests')
BEGIN
    CREATE TABLE ServiceInterests (
        InterestID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        ServiceName NVARCHAR(50) NOT NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_ServiceInterests PRIMARY KEY (InterestID),
        CONSTRAINT FK_ServiceInterests_Users FOREIGN KEY (UserID) REFERENCES Users(UserID),
        CONSTRAINT UQ_ServiceInterests_User_Service UNIQUE (UserID, ServiceName)
    );
    PRINT 'Created table ServiceInterests';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ServiceInterests_ServiceName')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ServiceInterests_ServiceName ON ServiceInterests(ServiceName);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ServiceInterests_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ServiceInterests_UserID ON ServiceInterests(UserID);
END
GO
