# RefOpen Messaging System Database Migration
# This script adds chat/messaging functionality to the existing database

param(
    [string]$ConnectionString = $env:DB_CONNECTION_STRING,
    [string]$KeyVaultName = "refopen-keyvault-prod"
)

# Auto-load credentials from Key Vault if not provided
if (-not $ConnectionString) {
    Write-Host "🔐 Loading credentials from Azure Key Vault..." -ForegroundColor Cyan
    $ConnectionString = az keyvault secret show --vault-name $KeyVaultName --name "DbConnectionString" --query "value" -o tsv 2>$null
    if (-not $ConnectionString) {
        Write-Error "Failed to load credentials. Ensure you're logged in: az login"
        exit 1
    }
    Write-Host "✅ Credentials loaded from Key Vault" -ForegroundColor Green
}

Write-Host "💬 Adding Messaging System to RefOpen Database..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "?? Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Messaging Schema SQL
$messagingSchemaSQL = @"
PRINT '?? Creating Messaging System Tables...';

-- 1. Conversations Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Conversations')
BEGIN
    PRINT '  ? Creating Conversations table...';
    CREATE TABLE Conversations (
        ConversationID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        User1ID UNIQUEIDENTIFIER NOT NULL,   -- First participant (always smaller GUID)
        User2ID UNIQUEIDENTIFIER NOT NULL,           -- Second participant
        LastMessageAt DATETIME2 NULL,
        LastMessagePreview NVARCHAR(200) NULL,
        LastMessageSenderID UNIQUEIDENTIFIER NULL,   -- Who sent last message
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        
        -- Per-user settings
        IsArchived1 BIT DEFAULT 0,     -- User1 archived this conversation
  IsArchived2 BIT DEFAULT 0,     -- User2 archived this conversation
    IsMuted1 BIT DEFAULT 0,         -- User1 muted notifications
        IsMuted2 BIT DEFAULT 0,          -- User2 muted notifications
        
 FOREIGN KEY (User1ID) REFERENCES Users(UserID),
    FOREIGN KEY (User2ID) REFERENCES Users(UserID),
        FOREIGN KEY (LastMessageSenderID) REFERENCES Users(UserID),
        
        -- Ensure User1ID < User2ID to prevent duplicates
        CONSTRAINT CHK_UniqueConversation CHECK (User1ID < User2ID),
        CONSTRAINT UQ_Conversation UNIQUE (User1ID, User2ID)
    );
    PRINT '  ? Conversations table created';
END
ELSE
BEGIN
    PRINT '  ??  Conversations table already exists';
END

-- 2. Messages Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Messages')
BEGIN
    PRINT '  ? Creating Messages table...';
  CREATE TABLE Messages (
        MessageID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ConversationID UNIQUEIDENTIFIER NOT NULL,
        SenderUserID UNIQUEIDENTIFIER NOT NULL,
     Content NVARCHAR(MAX) NOT NULL,   -- Message text
        MessageType NVARCHAR(50) DEFAULT 'Text', -- Text, Image, File, System
  
   -- File attachments
        AttachmentURL NVARCHAR(1000) NULL,           -- Azure Blob URL
        AttachmentType NVARCHAR(50) NULL,        -- MIME type (image/jpeg, application/pdf)
        AttachmentSize INT NULL,       -- Size in bytes
        AttachmentName NVARCHAR(255) NULL,    -- Original filename
        
 -- Message status
      IsRead BIT DEFAULT 0,    -- Read status
        ReadAt DATETIME2 NULL,               -- When marked as read
        IsDelivered BIT DEFAULT 1,      -- Delivery status
        DeliveredAt DATETIME2 DEFAULT GETUTCDATE(),
 
 -- Edit/Delete functionality
        IsEdited BIT DEFAULT 0,
        EditedAt DATETIME2 NULL,
      OriginalContent NVARCHAR(MAX) NULL, -- Store original for audit
        IsDeleted BIT DEFAULT 0,
        DeletedAt DATETIME2 NULL,
        DeletedFor NVARCHAR(20) NULL,           -- 'Sender', 'Receiver', 'Both'
    
      -- Threading support
        ReplyToMessageID UNIQUEIDENTIFIER NULL,      -- For message replies
        
      CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    
        FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID) ON DELETE CASCADE,
      FOREIGN KEY (SenderUserID) REFERENCES Users(UserID),
        FOREIGN KEY (ReplyToMessageID) REFERENCES Messages(MessageID)
    );
    PRINT '  ? Messages table created';
END
ELSE
BEGIN
    PRINT '  ??  Messages table already exists';
END

-- 3. Blocked Users Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BlockedUsers')
BEGIN
    PRINT '  ? Creating BlockedUsers table...';
    CREATE TABLE BlockedUsers (
        BlockID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        BlockerUserID UNIQUEIDENTIFIER NOT NULL, -- Who initiated the block
    BlockedUserID UNIQUEIDENTIFIER NOT NULL,     -- Who got blocked
        Reason NVARCHAR(500) NULL,        -- Optional reason
      BlockedAt DATETIME2 DEFAULT GETUTCDATE(),
        
 FOREIGN KEY (BlockerUserID) REFERENCES Users(UserID),
        FOREIGN KEY (BlockedUserID) REFERENCES Users(UserID),
        CONSTRAINT UQ_BlockedUser UNIQUE (BlockerUserID, BlockedUserID)
    );
    PRINT '  ? BlockedUsers table created';
END
ELSE
BEGIN
    PRINT '  ??  BlockedUsers table already exists';
END

-- 4. User Profile Views Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserProfileViews')
BEGIN
    PRINT '  ? Creating UserProfileViews table...';
    CREATE TABLE UserProfileViews (
        ViewID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
ViewerUserID UNIQUEIDENTIFIER NOT NULL,      -- Who viewed the profile
        ViewedUserID UNIQUEIDENTIFIER NOT NULL,      -- Whose profile was viewed
        ViewedAt DATETIME2 DEFAULT GETUTCDATE(),
        DeviceType NVARCHAR(50),    -- Web, iOS, Android
        UserAgent NVARCHAR(500),  -- Browser/app info
        
        FOREIGN KEY (ViewerUserID) REFERENCES Users(UserID),
    FOREIGN KEY (ViewedUserID) REFERENCES Users(UserID)
    );
    PRINT '  ? UserProfileViews table created';
END
ELSE
BEGIN
    PRINT '  ??  UserProfileViews table already exists';
END

PRINT '?? Tables created successfully!';
"@

# Create Performance Indexes
$indexesSQL = @"
PRINT '? Creating Performance Indexes...';

-- Conversations Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Conversations_User1_Updated')
BEGIN
    CREATE INDEX IX_Conversations_User1_Updated 
    ON Conversations(User1ID, UpdatedAt DESC) 
  WHERE IsArchived1 = 0;
    PRINT '  ? Index IX_Conversations_User1_Updated created';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Conversations_User2_Updated')
BEGIN
    CREATE INDEX IX_Conversations_User2_Updated 
    ON Conversations(User2ID, UpdatedAt DESC) 
    WHERE IsArchived2 = 0;
    PRINT '  ? Index IX_Conversations_User2_Updated created';
END

-- Messages Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Messages_Conversation_Created')
BEGIN
    CREATE INDEX IX_Messages_Conversation_Created 
    ON Messages(ConversationID, CreatedAt DESC) 
    INCLUDE (MessageID, SenderUserID, Content, MessageType, IsRead, IsDeleted);
  PRINT '  ? Index IX_Messages_Conversation_Created created';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Messages_Unread')
BEGIN
    CREATE INDEX IX_Messages_Unread 
    ON Messages(ConversationID, IsRead, CreatedAt) 
    WHERE IsRead = 0 AND IsDeleted = 0;
    PRINT '  ? Index IX_Messages_Unread created';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Messages_Sender')
BEGIN
    CREATE INDEX IX_Messages_Sender 
    ON Messages(SenderUserID, CreatedAt DESC);
    PRINT '  ? Index IX_Messages_Sender created';
END

-- Profile Views Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ProfileViews_ViewedUser_Date')
BEGIN
    CREATE INDEX IX_ProfileViews_ViewedUser_Date 
    ON UserProfileViews(ViewedUserID, ViewedAt DESC) 
    INCLUDE (ViewerUserID, DeviceType);
    PRINT '  ? Index IX_ProfileViews_ViewedUser_Date created';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ProfileViews_Viewer')
BEGIN
    CREATE INDEX IX_ProfileViews_Viewer 
    ON UserProfileViews(ViewerUserID, ViewedAt DESC);
    PRINT '  ? Index IX_ProfileViews_Viewer created';
END

-- Blocked Users Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_BlockedUsers_Blocker')
BEGIN
    CREATE INDEX IX_BlockedUsers_Blocker 
    ON BlockedUsers(BlockerUserID) 
    INCLUDE (BlockedUserID);
    PRINT '  ? Index IX_BlockedUsers_Blocker created';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_BlockedUsers_Blocked')
BEGIN
    CREATE INDEX IX_BlockedUsers_Blocked 
    ON BlockedUsers(BlockedUserID) 
    INCLUDE (BlockerUserID);
  PRINT '  ? Index IX_BlockedUsers_Blocked created';
END

PRINT '? Indexes created successfully!';
"@

# Create Helper Views and Functions
$helpersSQL = @"
PRINT '?? Creating Helper Views and Functions...';

-- View: Get unread message count per conversation
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_UnreadMessageCounts')
    DROP VIEW vw_UnreadMessageCounts;
GO

CREATE VIEW vw_UnreadMessageCounts AS
SELECT 
    m.ConversationID,
    COUNT(*) as UnreadCount,
    MAX(m.CreatedAt) as LatestUnreadAt
FROM Messages m
WHERE m.IsRead = 0 
  AND m.IsDeleted = 0
GROUP BY m.ConversationID;
GO

PRINT '  ? View vw_UnreadMessageCounts created';

-- Function: Get conversation for two users (handles ordering)
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'FN' AND name = 'fn_GetConversationID')
    DROP FUNCTION fn_GetConversationID;
GO

CREATE FUNCTION fn_GetConversationID (
    @User1ID UNIQUEIDENTIFIER,
    @User2ID UNIQUEIDENTIFIER
)
RETURNS UNIQUEIDENTIFIER
AS
BEGIN
    DECLARE @ConversationID UNIQUEIDENTIFIER;
    DECLARE @MinUserID UNIQUEIDENTIFIER = CASE WHEN @User1ID < @User2ID THEN @User1ID ELSE @User2ID END;
    DECLARE @MaxUserID UNIQUEIDENTIFIER = CASE WHEN @User1ID < @User2ID THEN @User2ID ELSE @User1ID END;
    
SELECT @ConversationID = ConversationID
    FROM Conversations
    WHERE User1ID = @MinUserID AND User2ID = @MaxUserID;
    
    RETURN @ConversationID;
END;
GO

PRINT '  ? Function fn_GetConversationID created';

-- Function: Check if user is blocked
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'FN' AND name = 'fn_IsUserBlocked')
    DROP FUNCTION fn_IsUserBlocked;
GO

CREATE FUNCTION fn_IsUserBlocked (
    @BlockerUserID UNIQUEIDENTIFIER,
    @BlockedUserID UNIQUEIDENTIFIER
)
RETURNS BIT
AS
BEGIN
    DECLARE @IsBlocked BIT = 0;
    
    IF EXISTS (
      SELECT 1 FROM BlockedUsers 
        WHERE BlockerUserID = @BlockerUserID 
      AND BlockedUserID = @BlockedUserID
    )
        SET @IsBlocked = 1;
    
    RETURN @IsBlocked;
END;
GO

PRINT '  ? Function fn_IsUserBlocked created';

PRINT '?? Helper views and functions created successfully!';
"@

# Test Queries
$testSQL = @"
PRINT '?? Running Test Queries...';

-- Test 1: Check tables exist
SELECT 
    'Conversations' as TableName, 
    COUNT(*) as RecordCount 
FROM Conversations
UNION ALL
SELECT 'Messages', COUNT(*) FROM Messages
UNION ALL
SELECT 'BlockedUsers', COUNT(*) FROM BlockedUsers
UNION ALL
SELECT 'UserProfileViews', COUNT(*) FROM UserProfileViews;

-- Test 2: Check indexes
SELECT 
    t.name as TableName,
    i.name as IndexName,
    i.type_desc as IndexType
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('Conversations', 'Messages', 'BlockedUsers', 'UserProfileViews')
  AND i.name IS NOT NULL
ORDER BY t.name, i.name;

PRINT '? Test queries completed!';
"@

try {
    Write-Host "?? Creating messaging tables..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $messagingSchemaSQL -QueryTimeout 120
    Write-Host "? Messaging tables created successfully" -ForegroundColor Green
    
    Write-Host "`n? Creating performance indexes..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $indexesSQL -QueryTimeout 180
    Write-Host "? Performance indexes created successfully" -ForegroundColor Green
    
    Write-Host "`n?? Creating helper views and functions..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $helpersSQL -QueryTimeout 60
    Write-Host "? Helper views and functions created successfully" -ForegroundColor Green
    
    Write-Host "`n?? Running test queries..." -ForegroundColor Yellow
    $testResults = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $testSQL -QueryTimeout 30
  
    Write-Host "`n?? Test Results:" -ForegroundColor Cyan
    $testResults | Format-Table -AutoSize
    
    Write-Host "`n? ? ? Messaging System Database Migration Completed Successfully! ? ? ?" -ForegroundColor Green
    Write-Host "`nNext Steps:" -ForegroundColor Yellow
    Write-Host "  1. Create backend API endpoints (messaging.controller.ts)" -ForegroundColor Cyan
    Write-Host "  2. Create messaging service (messaging.service.ts)" -ForegroundColor Cyan
    Write-Host "  3. Create frontend screens (ConversationsScreen, ChatScreen)" -ForegroundColor Cyan
    Write-Host "  4. Add Messages tab to navigation" -ForegroundColor Cyan
    
} catch {
    Write-Error "? Database migration failed: $($_.Exception.Message)"
    Write-Host "`nError Details:" -ForegroundColor Red
    Write-Host $_.Exception.ToString()
    exit 1
}

Write-Host "`n?? Ready to implement messaging backend and frontend!" -ForegroundColor Green
