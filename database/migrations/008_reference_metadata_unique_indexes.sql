-- ============================================================================
-- Migration: Fix ReferenceMetadata uniqueness to support categorized values
--
-- Problem:
--   Existing unique index enforces uniqueness on (RefType, Value).
--   This prevents storing the same Value across different Categories (needed
--   for FieldOfStudy mappings by degree key).
--
-- Solution:
--   Replace the single unique index with two filtered unique indexes:
--     1) (RefType, Value) WHERE Category IS NULL
--        - preserves old behavior for uncategorized reference data
--     2) (RefType, Category, Value) WHERE Category IS NOT NULL
--        - allows same Value across different Categories
--
-- Date: 2025-12-17
-- ============================================================================

IF OBJECT_ID('dbo.ReferenceMetadata') IS NULL
BEGIN
    PRINT '❌ ReferenceMetadata table not found. Skipping index migration.';
    RETURN;
END
GO

-- Drop old unique index if present
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.ReferenceMetadata')
      AND name = 'IX_ReferenceMetadata_RefType_Value'
)
BEGIN
    DROP INDEX IX_ReferenceMetadata_RefType_Value ON dbo.ReferenceMetadata;
    PRINT '✅ Dropped IX_ReferenceMetadata_RefType_Value';
END
GO

-- Unique for uncategorized rows (Category IS NULL)
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.ReferenceMetadata')
      AND name = 'IX_ReferenceMetadata_RefType_Value_NullCategory'
)
BEGIN
    CREATE UNIQUE INDEX IX_ReferenceMetadata_RefType_Value_NullCategory
    ON dbo.ReferenceMetadata (RefType, Value)
    WHERE Category IS NULL;

    PRINT '✅ Created IX_ReferenceMetadata_RefType_Value_NullCategory';
END
GO

-- Unique for categorized rows (Category IS NOT NULL)
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.ReferenceMetadata')
      AND name = 'IX_ReferenceMetadata_RefType_Category_Value_NotNull'
)
BEGIN
    CREATE UNIQUE INDEX IX_ReferenceMetadata_RefType_Category_Value_NotNull
    ON dbo.ReferenceMetadata (RefType, Category, Value)
    WHERE Category IS NOT NULL;

    PRINT '✅ Created IX_ReferenceMetadata_RefType_Category_Value_NotNull';
END
GO
