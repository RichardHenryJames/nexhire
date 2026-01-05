-- Migration: 026_create_support_messages_table.sql
-- Description: Create SupportMessages table for conversation threads
-- Author: System
-- Date: 2026-01-05

-- Create SupportMessages table for ticket conversations
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SupportMessages]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SupportMessages] (
        -- Primary Key
        [MessageID] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        
        -- Reference to ticket
        [TicketID] UNIQUEIDENTIFIER NOT NULL,
        
        -- Who sent the message
        [SenderID] UNIQUEIDENTIFIER NOT NULL,
        
        -- Sender type: 'User' or 'Admin'
        [SenderType] NVARCHAR(10) NOT NULL,
        
        -- Message content
        [Message] NVARCHAR(MAX) NOT NULL,
        
        -- Timestamp
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        -- Soft delete
        [IsDeleted] BIT NOT NULL DEFAULT 0,
        
        -- Constraints
        CONSTRAINT [PK_SupportMessages] PRIMARY KEY CLUSTERED ([MessageID]),
        CONSTRAINT [FK_SupportMessages_Ticket] FOREIGN KEY ([TicketID]) REFERENCES [dbo].[SupportTickets]([TicketID]),
        CONSTRAINT [FK_SupportMessages_Sender] FOREIGN KEY ([SenderID]) REFERENCES [dbo].[Users]([UserID]),
        CONSTRAINT [CK_SupportMessages_SenderType] CHECK ([SenderType] IN ('User', 'Admin'))
    );
    
    PRINT 'Created SupportMessages table';
END
GO

-- Create index for fast lookup by ticket
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SupportMessages_TicketID' AND object_id = OBJECT_ID('dbo.SupportMessages'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SupportMessages_TicketID] 
    ON [dbo].[SupportMessages] ([TicketID], [CreatedAt] ASC);
    
    PRINT 'Created index IX_SupportMessages_TicketID';
END
GO

-- Migrate existing messages to the new table
-- Insert initial user messages
INSERT INTO [dbo].[SupportMessages] ([TicketID], [SenderID], [SenderType], [Message], [CreatedAt])
SELECT 
    [TicketID], 
    [UserID], 
    'User', 
    [Message], 
    [CreatedAt]
FROM [dbo].[SupportTickets]
WHERE [IsDeleted] = 0
AND NOT EXISTS (
    SELECT 1 FROM [dbo].[SupportMessages] sm 
    WHERE sm.TicketID = SupportTickets.TicketID 
    AND sm.SenderType = 'User'
    AND sm.CreatedAt = SupportTickets.CreatedAt
);

PRINT 'Migrated existing user messages';
GO

-- Insert existing admin responses
INSERT INTO [dbo].[SupportMessages] ([TicketID], [SenderID], [SenderType], [Message], [CreatedAt])
SELECT 
    [TicketID], 
    [AdminUserID], 
    'Admin', 
    [AdminResponse], 
    ISNULL([ResolvedAt], [UpdatedAt])
FROM [dbo].[SupportTickets]
WHERE [IsDeleted] = 0
AND [AdminResponse] IS NOT NULL
AND [AdminUserID] IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM [dbo].[SupportMessages] sm 
    WHERE sm.TicketID = SupportTickets.TicketID 
    AND sm.SenderType = 'Admin'
);

PRINT 'Migrated existing admin responses';
GO

PRINT 'Migration 026 completed successfully';
GO
