-- ============================================================================
-- Migration: Seed YearInCollege reference metadata
-- Description:
--   Stores the registration "Current Year" options in the existing
--   ReferenceMetadata table (no new tables).
--
-- Conventions used:
--   - RefType = 'YearInCollege'
--       Category     = NULL
--       Value        = display label (e.g. 'First Year (Freshman)')
--       Description  = NULL
--
-- Date: 2025-12-17
-- ============================================================================

IF OBJECT_ID('dbo.ReferenceMetadata') IS NULL
BEGIN
    PRINT '❌ ReferenceMetadata table not found. Skipping YearInCollege seed.';
    RETURN;
END
GO

DECLARE @now DATETIME2 = SYSDATETIME();

DECLARE @data TABLE (
    RefType NVARCHAR(50) NOT NULL,
    Value NVARCHAR(200) NOT NULL,
    Category NVARCHAR(100) NULL,
    Description NVARCHAR(400) NULL
);

INSERT INTO @data (RefType, Value, Category, Description) VALUES
('YearInCollege', 'First Year (Freshman)', NULL, NULL),
('YearInCollege', 'Second Year (Sophomore)', NULL, NULL),
('YearInCollege', 'Third Year (Junior)', NULL, NULL),
('YearInCollege', 'Fourth Year (Senior)', NULL, NULL),
('YearInCollege', 'Graduate Student', NULL, NULL),
('YearInCollege', 'Recently Graduated (0-1 year)', NULL, NULL),
('YearInCollege', 'Other', NULL, NULL);

MERGE dbo.ReferenceMetadata AS target
USING @data AS source
ON target.RefType = source.RefType
   AND ISNULL(target.Category, '') = ISNULL(source.Category, '')
   AND target.Value = source.Value
WHEN MATCHED THEN
    UPDATE SET
        target.Description = source.Description,
        target.IsActive = 1,
        target.UpdatedAt = @now
WHEN NOT MATCHED THEN
    INSERT (RefType, Value, Category, Description, IsActive, CreatedAt, UpdatedAt)
    VALUES (source.RefType, source.Value, source.Category, source.Description, 1, @now, @now);

PRINT '✅ Seeded YearInCollege into ReferenceMetadata.';
GO
