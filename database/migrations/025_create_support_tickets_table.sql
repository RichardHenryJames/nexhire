-- Migration: 025_create_support_tickets_table.sql
-- Description: Create SupportTickets table for customer support/grievance system
-- Date: 2026-01-04

-- =============================================
-- Support Tickets Table
-- =============================================
-- Simple ticket system for customer support:
-- - Users can raise tickets
-- - Admins can respond to tickets
-- - Users can view their ticket history
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SupportTickets]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        -- Primary Key
        [TicketID] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        
        -- User who raised the ticket
        [UserID] UNIQUEIDENTIFIER NOT NULL,
        
        -- Ticket Category
        [Category] NVARCHAR(50) NOT NULL DEFAULT 'General',
        -- Categories: Technical, Payment, Account, Referrals, Jobs, Employer, Other
        
        -- Ticket Subject/Title
        [Subject] NVARCHAR(200) NOT NULL,
        
        -- User's Message/Description
        [Message] NVARCHAR(MAX) NOT NULL,
        
        -- Ticket Status: Open, InProgress, Resolved, Closed
        [Status] NVARCHAR(20) NOT NULL DEFAULT 'Open',
        
        -- Priority: Low, Medium, High, Urgent
        [Priority] NVARCHAR(20) NOT NULL DEFAULT 'Medium',
        
        -- Admin Response (nullable - filled when admin responds)
        [AdminResponse] NVARCHAR(MAX) NULL,
        
        -- Admin who responded (nullable)
        [AdminUserID] UNIQUEIDENTIFIER NULL,
        
        -- User's email at time of ticket (for non-logged in or reference)
        [ContactEmail] NVARCHAR(256) NULL,
        
        -- Timestamps
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [ResolvedAt] DATETIME2 NULL,
        
        -- Soft delete
        [IsDeleted] BIT NOT NULL DEFAULT 0,
        
        -- Constraints
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID]),
        CONSTRAINT [FK_SupportTickets_User] FOREIGN KEY ([UserID]) REFERENCES [dbo].[Users]([UserID]),
        CONSTRAINT [FK_SupportTickets_AdminUser] FOREIGN KEY ([AdminUserID]) REFERENCES [dbo].[Users]([UserID]),
        CONSTRAINT [CK_SupportTickets_Status] CHECK ([Status] IN ('Open', 'InProgress', 'Resolved', 'Closed')),
        CONSTRAINT [CK_SupportTickets_Priority] CHECK ([Priority] IN ('Low', 'Medium', 'High', 'Urgent')),
        CONSTRAINT [CK_SupportTickets_Category] CHECK ([Category] IN ('Technical', 'Payment', 'Account', 'Referrals', 'Jobs', 'Employer', 'Other', 'General'))
    );
    
    PRINT 'Created SupportTickets table';
END
GO

-- Create indexes for common queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SupportTickets_UserID' AND object_id = OBJECT_ID('dbo.SupportTickets'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_UserID] 
    ON [dbo].[SupportTickets] ([UserID]) 
    INCLUDE ([Status], [CreatedAt], [Subject]);
    PRINT 'Created index IX_SupportTickets_UserID';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SupportTickets_Status' AND object_id = OBJECT_ID('dbo.SupportTickets'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_Status] 
    ON [dbo].[SupportTickets] ([Status], [CreatedAt] DESC) 
    INCLUDE ([UserID], [Subject], [Category], [Priority]);
    PRINT 'Created index IX_SupportTickets_Status';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SupportTickets_CreatedAt' AND object_id = OBJECT_ID('dbo.SupportTickets'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedAt] 
    ON [dbo].[SupportTickets] ([CreatedAt] DESC) 
    WHERE [IsDeleted] = 0;
    PRINT 'Created index IX_SupportTickets_CreatedAt';
END
GO

-- =============================================
-- Verify Migration
-- =============================================
SELECT 
    'SupportTickets table created successfully' AS Status,
    COUNT(*) AS ColumnCount
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'SupportTickets';
GO
