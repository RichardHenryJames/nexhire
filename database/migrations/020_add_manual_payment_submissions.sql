-- Migration: Add ManualPaymentSubmissions table for manual bank/UPI payments
-- Created: 2026-01-03
-- Description: Stores manual payment proof submissions while Razorpay verification is pending

-- Create ManualPaymentSubmissions table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ManualPaymentSubmissions')
BEGIN
    CREATE TABLE ManualPaymentSubmissions (
        SubmissionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserID UNIQUEIDENTIFIER NOT NULL,
        WalletID UNIQUEIDENTIFIER NULL,
        Amount DECIMAL(10, 2) NOT NULL,
        PaymentMethod NVARCHAR(50) NOT NULL, -- 'UPI', 'Bank Transfer', 'NEFT', 'IMPS', 'RTGS'
        ReferenceNumber NVARCHAR(100) NOT NULL, -- UTR/Transaction ID
        PaymentDate DATE NOT NULL, -- Date when user made the payment
        ProofImageURL NVARCHAR(500) NULL, -- Screenshot of payment (optional)
        UserRemarks NVARCHAR(500) NULL, -- Any notes from user
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
        AdminRemarks NVARCHAR(500) NULL, -- Remarks from admin when approving/rejecting
        ReviewedBy UNIQUEIDENTIFIER NULL, -- Admin who reviewed
        ReviewedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        -- Foreign Keys
        CONSTRAINT FK_ManualPayment_User FOREIGN KEY (UserID) REFERENCES Users(UserID),
        CONSTRAINT FK_ManualPayment_Wallet FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID),
        CONSTRAINT FK_ManualPayment_Reviewer FOREIGN KEY (ReviewedBy) REFERENCES Users(UserID),
        
        -- Constraints
        CONSTRAINT CHK_ManualPayment_Amount CHECK (Amount > 0),
        CONSTRAINT CHK_ManualPayment_Status CHECK (Status IN ('Pending', 'Approved', 'Rejected'))
    );

    -- Index for faster queries
    CREATE INDEX IX_ManualPayment_UserID ON ManualPaymentSubmissions(UserID);
    CREATE INDEX IX_ManualPayment_Status ON ManualPaymentSubmissions(Status);
    CREATE INDEX IX_ManualPayment_CreatedAt ON ManualPaymentSubmissions(CreatedAt DESC);
    
    -- Unique constraint to prevent duplicate reference numbers
    CREATE UNIQUE INDEX IX_ManualPayment_ReferenceNumber ON ManualPaymentSubmissions(ReferenceNumber);

    PRINT 'Created ManualPaymentSubmissions table';
END
GO

-- Add PaymentSettings table to store bank/UPI details (admin configurable)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentSettings')
BEGIN
    CREATE TABLE PaymentSettings (
        SettingID INT PRIMARY KEY IDENTITY(1,1),
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(MAX) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    -- Insert default payment settings
    INSERT INTO PaymentSettings (SettingKey, SettingValue, IsActive) VALUES
    ('UPI_ID', 'refopen@upi', 1),
    ('UPI_NAME', 'RefOpen Technologies', 1),
    ('BANK_NAME', 'HDFC Bank', 1),
    ('BANK_ACCOUNT_NAME', 'RefOpen Technologies Pvt Ltd', 1),
    ('BANK_ACCOUNT_NUMBER', 'XXXXXXXXXX1234', 1),
    ('BANK_IFSC', 'HDFC0001234', 1),
    ('BANK_BRANCH', 'Bangalore Main Branch', 1),
    ('MIN_AMOUNT', '100', 1),
    ('MAX_AMOUNT', '50000', 1),
    ('PROCESSING_TIME', '1 business day', 1),
    ('SUPPORT_EMAIL', 'support@refopen.com', 1),
    ('SUPPORT_PHONE', '+91-XXXXXXXXXX', 1);

    PRINT 'Created PaymentSettings table with default values';
END
GO
