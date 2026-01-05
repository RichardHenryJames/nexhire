-- Migration: 016_payment_settings.sql
-- Description: Table for storing bank/UPI payment details for manual payments
-- Date: 2026-01-03

-- Create PaymentSettings table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PaymentSettings]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[PaymentSettings] (
        SettingID INT IDENTITY(1,1) PRIMARY KEY,
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(500) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETUTCDATE()
    );

    PRINT 'Created PaymentSettings table';
END
GO

-- Insert default payment settings (UPDATE THESE WITH YOUR ACTUAL DETAILS)
-- UPI Details
IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'UPI_ID')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('UPI_ID', 'parimalkumar@ybl', 'UPI ID for receiving payments');

IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'UPI_NAME')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('UPI_NAME', 'Parimal Kumar', 'Name displayed on UPI');

-- Bank Details
IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'BANK_NAME')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('BANK_NAME', 'HDFC Bank', 'Bank name for transfers');

IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'BANK_ACCOUNT_NAME')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('BANK_ACCOUNT_NAME', 'Parimal Kumar', 'Bank account holder name');

IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'BANK_ACCOUNT_NUMBER')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('BANK_ACCOUNT_NUMBER', '50200012345678', 'Bank account number');

IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'BANK_IFSC')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('BANK_IFSC', 'HDFC0001234', 'Bank IFSC code');

IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'BANK_BRANCH')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('BANK_BRANCH', 'Mumbai Main Branch', 'Bank branch name');

-- Limits and Configuration
IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'MIN_AMOUNT')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('MIN_AMOUNT', '100', 'Minimum recharge amount in INR');

IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'MAX_AMOUNT')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('MAX_AMOUNT', '50000', 'Maximum recharge amount in INR');

IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'PROCESSING_TIME')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('PROCESSING_TIME', '1 business day', 'Expected processing time for manual payments');

-- Support Contact
IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'SUPPORT_EMAIL')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('SUPPORT_EMAIL', 'support@refopen.com', 'Support email for payment queries');

IF NOT EXISTS (SELECT 1 FROM PaymentSettings WHERE SettingKey = 'SUPPORT_PHONE')
    INSERT INTO PaymentSettings (SettingKey, SettingValue, Description) 
    VALUES ('SUPPORT_PHONE', '+91-9876543210', 'Support phone for payment queries');

PRINT 'Inserted default payment settings';
GO
