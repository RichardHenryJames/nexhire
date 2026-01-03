-- =====================================================
-- Migration: 015_notification_system.sql
-- Description: Create notification system tables
-- Author: RefOpen
-- Date: 2026-01-02
-- =====================================================

-- =====================================================
-- 1. NotificationQueue - Async notification processing
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationQueue')
BEGIN
    CREATE TABLE NotificationQueue (
        NotificationID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        
        -- Target user (NULL for broadcast to multiple users)
        UserID UNIQUEIDENTIFIER NULL,
        
        -- What type of notification
        NotificationType NVARCHAR(50) NOT NULL,
        -- Types: 'new_referral_request', 'referral_claimed', 'referral_verified',
        --        'job_application', 'message_received', 'weekly_digest'
        
        -- Which channel to send through
        Channel NVARCHAR(20) NOT NULL,
        -- Channels: 'email', 'push', 'in_app', 'sms'
        
        -- All data needed for the notification (JSON)
        Payload NVARCHAR(MAX) NOT NULL,
        
        -- Processing status
        Status NVARCHAR(20) DEFAULT 'pending',
        -- Statuses: 'pending', 'processing', 'sent', 'failed', 'cancelled'
        
        -- Retry handling
        RetryCount INT DEFAULT 0,
        MaxRetries INT DEFAULT 3,
        
        -- Scheduling
        ScheduledAt DATETIME2 DEFAULT GETUTCDATE(),
        ProcessedAt DATETIME2 NULL,
        CompletedAt DATETIME2 NULL,
        
        -- Error tracking
        ErrorMessage NVARCHAR(1000) NULL,
        
        -- Metadata
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        
        -- Foreign key (optional - user may not exist for some notifications)
        CONSTRAINT FK_NotificationQueue_Users FOREIGN KEY (UserID) 
            REFERENCES Users(UserID) ON DELETE SET NULL
    );
    
    -- Indexes for queue processing
    CREATE INDEX IX_NotificationQueue_Status_Scheduled 
        ON NotificationQueue(Status, ScheduledAt) 
        WHERE Status = 'pending';
    
    CREATE INDEX IX_NotificationQueue_UserID 
        ON NotificationQueue(UserID);
    
    CREATE INDEX IX_NotificationQueue_Type 
        ON NotificationQueue(NotificationType);
    
    PRINT 'Created NotificationQueue table';
END
ELSE
    PRINT 'NotificationQueue table already exists';
GO

-- =====================================================
-- 2. NotificationPreferences - User settings
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationPreferences')
BEGIN
    CREATE TABLE NotificationPreferences (
        UserID UNIQUEIDENTIFIER PRIMARY KEY,
        
        -- Global toggles
        EmailEnabled BIT DEFAULT 1,
        PushEnabled BIT DEFAULT 1,
        InAppEnabled BIT DEFAULT 1,
        
        -- Referral notifications
        ReferralRequestEmail BIT DEFAULT 1,      -- New referral available for you
        ReferralRequestPush BIT DEFAULT 1,
        ReferralClaimedEmail BIT DEFAULT 1,      -- Your referral request was claimed
        ReferralClaimedPush BIT DEFAULT 1,
        ReferralVerifiedEmail BIT DEFAULT 1,     -- You earned points!
        ReferralVerifiedPush BIT DEFAULT 1,
        
        -- Job notifications (future)
        JobApplicationEmail BIT DEFAULT 1,       -- Someone applied to your job
        JobMatchEmail BIT DEFAULT 0,             -- New job matches your profile
        
        -- Social notifications (future)
        MessageReceivedEmail BIT DEFAULT 1,      -- New message (email)
        MessageReceivedPush BIT DEFAULT 1,       -- New message (push)
        ProfileViewedEmail BIT DEFAULT 0,        -- Someone viewed your profile
        
        -- Digest emails
        DailyDigestEmail BIT DEFAULT 0,
        WeeklyDigestEmail BIT DEFAULT 1,
        WeeklyDigestEnabled BIT DEFAULT 1,       -- Alias for code compatibility
        
        -- Quiet hours (don't send push during these hours)
        QuietHoursEnabled BIT DEFAULT 0,
        QuietHoursStart TIME NULL,               -- e.g., 22:00
        QuietHoursEnd TIME NULL,                 -- e.g., 08:00
        Timezone NVARCHAR(50) DEFAULT 'Asia/Kolkata',
        
        -- Timestamps
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        
        CONSTRAINT FK_NotificationPreferences_Users FOREIGN KEY (UserID) 
            REFERENCES Users(UserID) ON DELETE CASCADE
    );
    
    PRINT 'Created NotificationPreferences table';
END
ELSE
    PRINT 'NotificationPreferences table already exists';
GO

-- =====================================================
-- 3. EmailLogs - Track all sent emails
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmailLogs')
BEGIN
    CREATE TABLE EmailLogs (
        LogID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        
        -- Who received
        UserID UNIQUEIDENTIFIER NULL,
        ToEmail NVARCHAR(255) NOT NULL,
        
        -- What was sent
        EmailType NVARCHAR(50) NOT NULL,
        Subject NVARCHAR(500) NOT NULL,
        
        -- Provider info
        ProviderMessageID NVARCHAR(200) NULL,    -- Azure ACS / SendGrid message ID
        Provider NVARCHAR(50) DEFAULT 'azure_acs',
        
        -- Status tracking
        Status NVARCHAR(20) DEFAULT 'sent',
        -- Statuses: 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
        
        -- Engagement tracking (from webhooks)
        DeliveredAt DATETIME2 NULL,
        OpenedAt DATETIME2 NULL,
        ClickedAt DATETIME2 NULL,
        BouncedAt DATETIME2 NULL,
        
        -- Error info
        ErrorMessage NVARCHAR(500) NULL,
        
        -- Metadata
        SentAt DATETIME2 DEFAULT GETUTCDATE(),
        
        -- Reference to what triggered this email
        ReferenceType NVARCHAR(50) NULL,         -- 'referral_request', 'job', etc.
        ReferenceID NVARCHAR(100) NULL,          -- The ID of the related entity
        
        CONSTRAINT FK_EmailLogs_Users FOREIGN KEY (UserID) 
            REFERENCES Users(UserID) ON DELETE SET NULL
    );
    
    -- Indexes for analytics
    CREATE INDEX IX_EmailLogs_UserID ON EmailLogs(UserID);
    CREATE INDEX IX_EmailLogs_Type_SentAt ON EmailLogs(EmailType, SentAt DESC);
    CREATE INDEX IX_EmailLogs_Status ON EmailLogs(Status);
    
    PRINT 'Created EmailLogs table';
END
ELSE
    PRINT 'EmailLogs table already exists';
GO

-- =====================================================
-- 4. InAppNotifications - For bell icon / notification center
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InAppNotifications')
BEGIN
    CREATE TABLE InAppNotifications (
        NotificationID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserID UNIQUEIDENTIFIER NOT NULL,
        
        -- Display content
        Title NVARCHAR(200) NOT NULL,
        Body NVARCHAR(500) NOT NULL,
        Icon NVARCHAR(50) NULL,                  -- 'referral', 'job', 'message', 'money'
        ImageURL NVARCHAR(500) NULL,             -- Optional image
        
        -- Action
        ActionURL NVARCHAR(500) NULL,            -- Deep link: '/referrals?id=abc'
        ActionLabel NVARCHAR(50) NULL,           -- 'View Request', 'See Details'
        
        -- Status
        IsRead BIT DEFAULT 0,
        ReadAt DATETIME2 NULL,
        
        -- Metadata
        NotificationType NVARCHAR(50) NOT NULL,
        ReferenceID NVARCHAR(100) NULL,          -- requestId, jobId, etc.
        
        -- Timestamps
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        ExpiresAt DATETIME2 NULL,                -- Auto-hide after this date
        
        CONSTRAINT FK_InAppNotifications_Users FOREIGN KEY (UserID) 
            REFERENCES Users(UserID) ON DELETE CASCADE
    );
    
    -- Index for fetching user's notifications
    CREATE INDEX IX_InAppNotifications_User_Unread 
        ON InAppNotifications(UserID, IsRead, CreatedAt DESC);
    
    PRINT 'Created InAppNotifications table';
END
ELSE
    PRINT 'InAppNotifications table already exists';
GO

-- =====================================================
-- 5. PushTokens - Store user device tokens for push notifications
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PushTokens')
BEGIN
    CREATE TABLE PushTokens (
        TokenID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserID UNIQUEIDENTIFIER NOT NULL,
        
        -- Token info
        Token NVARCHAR(500) NOT NULL,
        Platform NVARCHAR(20) NOT NULL,          -- 'ios', 'android', 'web'
        Provider NVARCHAR(50) DEFAULT 'expo',    -- 'expo', 'firebase', 'apns'
        
        -- Device info
        DeviceID NVARCHAR(200) NULL,
        DeviceName NVARCHAR(100) NULL,
        
        -- Status
        IsActive BIT DEFAULT 1,
        LastUsedAt DATETIME2 DEFAULT GETUTCDATE(),
        
        -- Timestamps
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        
        CONSTRAINT FK_PushTokens_Users FOREIGN KEY (UserID) 
            REFERENCES Users(UserID) ON DELETE CASCADE
    );
    
    -- Index for finding user's tokens
    CREATE INDEX IX_PushTokens_UserID_Active 
        ON PushTokens(UserID, IsActive) 
        WHERE IsActive = 1;
    
    -- Unique token per device
    CREATE UNIQUE INDEX IX_PushTokens_Token 
        ON PushTokens(Token);
    
    PRINT 'Created PushTokens table';
END
ELSE
    PRINT 'PushTokens table already exists';
GO

-- =====================================================
-- 6. Create default preferences for existing users
-- =====================================================
INSERT INTO NotificationPreferences (UserID)
SELECT UserID FROM Users u
WHERE NOT EXISTS (
    SELECT 1 FROM NotificationPreferences np WHERE np.UserID = u.UserID
);

PRINT 'Created default notification preferences for existing users';
GO

-- =====================================================
-- 7. Helper function to check if user wants notification
-- =====================================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fn_ShouldSendNotification]') AND type = N'FN')
    DROP FUNCTION [dbo].[fn_ShouldSendNotification];
GO

CREATE FUNCTION [dbo].[fn_ShouldSendNotification]
(
    @UserID UNIQUEIDENTIFIER,
    @NotificationType NVARCHAR(50),
    @Channel NVARCHAR(20)
)
RETURNS BIT
AS
BEGIN
    DECLARE @ShouldSend BIT = 0;
    
    SELECT @ShouldSend = CASE 
        -- Email channel
        WHEN @Channel = 'email' AND EmailEnabled = 0 THEN 0
        WHEN @Channel = 'email' AND @NotificationType = 'new_referral_request' THEN ReferralRequestEmail
        WHEN @Channel = 'email' AND @NotificationType = 'referral_claimed' THEN ReferralClaimedEmail
        WHEN @Channel = 'email' AND @NotificationType = 'referral_verified' THEN ReferralVerifiedEmail
        WHEN @Channel = 'email' AND @NotificationType = 'job_application' THEN JobApplicationEmail
        WHEN @Channel = 'email' AND @NotificationType = 'weekly_digest' THEN WeeklyDigestEmail
        
        -- Push channel
        WHEN @Channel = 'push' AND PushEnabled = 0 THEN 0
        WHEN @Channel = 'push' AND @NotificationType = 'new_referral_request' THEN ReferralRequestPush
        WHEN @Channel = 'push' AND @NotificationType = 'referral_claimed' THEN ReferralClaimedPush
        WHEN @Channel = 'push' AND @NotificationType = 'referral_verified' THEN ReferralVerifiedPush
        WHEN @Channel = 'push' AND @NotificationType = 'message_received' THEN MessageReceivedPush
        
        -- In-app always enabled (unless globally disabled)
        WHEN @Channel = 'in_app' THEN InAppEnabled
        
        -- Default to enabled
        ELSE 1
    END
    FROM NotificationPreferences
    WHERE UserID = @UserID;
    
    -- If no preferences exist, default to enabled
    IF @ShouldSend IS NULL SET @ShouldSend = 1;
    
    RETURN @ShouldSend;
END;
GO

PRINT 'Created fn_ShouldSendNotification function';
GO

-- =====================================================
-- ADD MISSING COLUMNS (for existing installations)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NotificationPreferences') AND name = 'MessageReceivedEmail')
BEGIN
    ALTER TABLE NotificationPreferences ADD MessageReceivedEmail BIT NOT NULL DEFAULT 1;
    PRINT 'Added MessageReceivedEmail column';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NotificationPreferences') AND name = 'WeeklyDigestEnabled')
BEGIN
    ALTER TABLE NotificationPreferences ADD WeeklyDigestEnabled BIT NOT NULL DEFAULT 1;
    PRINT 'Added WeeklyDigestEnabled column';
END
GO

PRINT '====================================================';
PRINT 'Migration 015_notification_system.sql completed!';
PRINT '====================================================';
