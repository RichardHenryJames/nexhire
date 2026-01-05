-- ================================================================
-- PRICING SETTINGS TABLE
-- Stores configurable pricing for various features
-- Change prices from DB without code deployment
-- ================================================================

-- Create PricingSettings table if not exists
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PricingSettings')
BEGIN
    CREATE TABLE PricingSettings (
        SettingID INT IDENTITY(1,1) PRIMARY KEY,
        SettingKey NVARCHAR(50) NOT NULL UNIQUE,
        SettingValue DECIMAL(10,2) NOT NULL,
        Description NVARCHAR(255),
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    -- Insert default pricing values
    INSERT INTO PricingSettings (SettingKey, SettingValue, Description) VALUES
    ('AI_JOBS_COST', 99.00, 'Cost in INR for AI-recommended jobs access'),
    ('AI_ACCESS_DURATION_HOURS', 360, 'Duration in hours for AI jobs access (15 days = 360 hours)'),
    ('REFERRAL_REQUEST_COST', 39.00, 'Cost in INR per referral request'),
    ('JOB_PUBLISH_COST', 50.00, 'Cost in INR to publish a job'),
    ('WELCOME_BONUS', 100.00, 'Welcome bonus in INR for new users'),
    ('REFERRAL_SIGNUP_BONUS', 50.00, 'Bonus in INR when referred user signs up');
    
    PRINT '✓ PricingSettings table created with default values';
END
ELSE
BEGIN
    -- Update existing values if table exists
    UPDATE PricingSettings SET SettingValue = 99.00, UpdatedAt = GETDATE() WHERE SettingKey = 'AI_JOBS_COST';
    UPDATE PricingSettings SET SettingValue = 360, UpdatedAt = GETDATE() WHERE SettingKey = 'AI_ACCESS_DURATION_HOURS';
    UPDATE PricingSettings SET SettingValue = 39.00, UpdatedAt = GETDATE() WHERE SettingKey = 'REFERRAL_REQUEST_COST';
    
    -- Insert if not exists
    IF NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'AI_JOBS_COST')
        INSERT INTO PricingSettings (SettingKey, SettingValue, Description) VALUES ('AI_JOBS_COST', 99.00, 'Cost in INR for AI-recommended jobs access');
    IF NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'AI_ACCESS_DURATION_HOURS')
        INSERT INTO PricingSettings (SettingKey, SettingValue, Description) VALUES ('AI_ACCESS_DURATION_HOURS', 360, 'Duration in hours for AI jobs access (15 days = 360 hours)');
    IF NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'REFERRAL_REQUEST_COST')
        INSERT INTO PricingSettings (SettingKey, SettingValue, Description) VALUES ('REFERRAL_REQUEST_COST', 39.00, 'Cost in INR per referral request');
    IF NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'JOB_PUBLISH_COST')
        INSERT INTO PricingSettings (SettingKey, SettingValue, Description) VALUES ('JOB_PUBLISH_COST', 50.00, 'Cost in INR to publish a job');
    IF NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'WELCOME_BONUS')
        INSERT INTO PricingSettings (SettingKey, SettingValue, Description) VALUES ('WELCOME_BONUS', 100.00, 'Welcome bonus in INR for new users');
    IF NOT EXISTS (SELECT 1 FROM PricingSettings WHERE SettingKey = 'REFERRAL_SIGNUP_BONUS')
        INSERT INTO PricingSettings (SettingKey, SettingValue, Description) VALUES ('REFERRAL_SIGNUP_BONUS', 50.00, 'Bonus in INR when referred user signs up');
    
    PRINT '✓ PricingSettings table updated';
END

-- View current settings
SELECT * FROM PricingSettings ORDER BY SettingKey;
