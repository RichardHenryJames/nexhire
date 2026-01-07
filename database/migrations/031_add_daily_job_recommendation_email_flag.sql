-- Migration: Add DailyJobRecommendationEmail flag to NotificationPreferences
-- Date: 2026-01-07
-- Description: Adds user preference flag for daily job recommendation emails

-- Add DailyJobRecommendationEmail column to NotificationPreferences
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NotificationPreferences') AND name = 'DailyJobRecommendationEmail')
BEGIN
    ALTER TABLE NotificationPreferences ADD DailyJobRecommendationEmail BIT NOT NULL DEFAULT 1;
    PRINT 'Added DailyJobRecommendationEmail column to NotificationPreferences';
END
ELSE
BEGIN
    PRINT 'DailyJobRecommendationEmail column already exists';
END
GO
