-- =====================================================
-- Organization Deduplication Script (SQL Version)
-- =====================================================
-- This script helps identify and manually merge duplicate organizations
-- Use this if you prefer SQL over PowerShell automation

-- =====================================================
-- STEP 1: View All Potential Duplicates
-- =====================================================
-- This query shows organizations that might be duplicates
-- based on similar names (after basic normalization)

WITH NormalizedOrgs AS (
    SELECT 
        OrganizationID,
        Name AS OriginalName,
        -- Basic normalization (simplified version)
        LOWER(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(RTRIM(LTRIM(Name)), ' Private Limited', ''),
                                            ' Pvt Ltd', ''),
                                        ' Pvt. Ltd.', ''),
                                    ' Limited', ''),
                                ' Ltd', ''),
                            ' Corporation', ''),
                        ' Corp', ''),
                    ' Inc', ''),
                ' Technologies', ''),
            ' Technology', '')
        ) AS NormalizedName,
        Industry,
        Website,
        LogoURL,
        CreatedAt,
        (SELECT COUNT(*) FROM Jobs WHERE OrganizationID = Organizations.OrganizationID) AS JobCount
    FROM Organizations
    WHERE IsActive = 1
)
SELECT 
    NormalizedName,
    COUNT(*) AS DuplicateCount,
    STRING_AGG(
        CAST(OrganizationID AS NVARCHAR(10)) + ': ' + OriginalName + ' (' + CAST(JobCount AS NVARCHAR(10)) + ' jobs)',
        ' | '
    ) AS Organizations
FROM NormalizedOrgs
GROUP BY NormalizedName
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, NormalizedName;

-- =====================================================
-- STEP 2: Detailed View of a Specific Duplicate Group
-- =====================================================
-- Replace 'microsoft' with the normalized name you want to investigate

DECLARE @SearchName NVARCHAR(100) = 'microsoft';  -- Change this

WITH NormalizedOrgs AS (
    SELECT 
        OrganizationID,
        Name,
        LOWER(
            REPLACE(
                REPLACE(
                    REPLACE(RTRIM(LTRIM(Name)), ' Private Limited', ''),
                ' Pvt Ltd', ''),
            ' Corporation', '')
        ) AS NormalizedName,
        Type,
        Industry,
        Size,
        Description,
        Location,
        LogoURL,
        Website,
        LinkedInProfile,
        CreatedAt,
        UpdatedAt,
        (SELECT COUNT(*) FROM Jobs WHERE OrganizationID = Organizations.OrganizationID) AS JobCount,
        -- Completeness score
        (
            CASE WHEN LogoURL IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN Website IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN Industry IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN Description IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN LinkedInProfile IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN Size IS NOT NULL THEN 3 ELSE 0 END +
            CASE WHEN Location IS NOT NULL THEN 3 ELSE 0 END
        ) AS CompletenessScore
    FROM Organizations
    WHERE IsActive = 1
)
SELECT 
    OrganizationID,
    Name AS OriginalName,
    JobCount,
    CompletenessScore,
    LogoURL,
    Website,
    Industry,
    CreatedAt,
    '-- Keep this one?' AS Recommendation
FROM NormalizedOrgs
WHERE NormalizedName LIKE '%' + @SearchName + '%'
ORDER BY CompletenessScore DESC, JobCount DESC, CreatedAt ASC;

-- =====================================================
-- STEP 3: Merge Specific Organizations (MANUAL)
-- =====================================================
-- Use this template to manually merge duplicates
-- Replace the IDs with actual values from STEP 2

DECLARE @CanonicalOrgID INT = 123;  -- The organization to KEEP
DECLARE @DuplicateOrgID INT = 456;  -- The organization to MERGE

BEGIN TRANSACTION;

-- Show what will be affected
SELECT 
    'Jobs' AS TableName,
    COUNT(*) AS RecordsToUpdate
FROM Jobs 
WHERE OrganizationID = @DuplicateOrgID

UNION ALL

SELECT 
    'Applications' AS TableName,
    COUNT(*) AS RecordsToUpdate
FROM Applications 
WHERE OrganizationID = @DuplicateOrgID

UNION ALL

SELECT 
    'Referrals' AS TableName,
    COUNT(*) AS RecordsToUpdate
FROM Referrals 
WHERE OrganizationID = @DuplicateOrgID;

-- UNCOMMENT THE LINES BELOW TO EXECUTE THE MERGE:
/*
-- Update Jobs
UPDATE Jobs 
SET OrganizationID = @CanonicalOrgID, UpdatedAt = GETUTCDATE()
WHERE OrganizationID = @DuplicateOrgID;

-- Update Applications
UPDATE Applications 
SET OrganizationID = @CanonicalOrgID, UpdatedAt = GETUTCDATE()
WHERE OrganizationID = @DuplicateOrgID;

-- Update Referrals
UPDATE Referrals 
SET OrganizationID = @CanonicalOrgID, UpdatedAt = GETUTCDATE()
WHERE OrganizationID = @DuplicateOrgID;

-- Update CompanyFollows if exists
IF OBJECT_ID('CompanyFollows', 'U') IS NOT NULL
BEGIN
    UPDATE CompanyFollows 
    SET OrganizationID = @CanonicalOrgID, UpdatedAt = GETUTCDATE()
    WHERE OrganizationID = @DuplicateOrgID;
END

-- Mark duplicate as inactive (or DELETE if you prefer)
UPDATE Organizations 
SET IsActive = 0, UpdatedAt = GETUTCDATE()
WHERE OrganizationID = @DuplicateOrgID;

-- Log the merge
INSERT INTO SchedulerLogs (TaskId, Status, Message, CreatedAt)
VALUES ('manual-org-merge', 'Success', 
        'Manually merged OrgID ' + CAST(@DuplicateOrgID AS NVARCHAR(10)) + ' into ' + CAST(@CanonicalOrgID AS NVARCHAR(10)),
        GETUTCDATE());

COMMIT TRANSACTION;
*/

-- If you're happy with the preview, uncomment the UPDATE statements above and run again
ROLLBACK TRANSACTION;

-- =====================================================
-- STEP 4: Verify Merge Results
-- =====================================================
-- Run this after merging to verify the result

DECLARE @CanonicalOrgIDCheck INT = 123;  -- The organization you kept

SELECT 
    o.OrganizationID,
    o.Name,
    o.IsActive,
    COUNT(j.JobID) AS TotalJobs,
    MAX(j.UpdatedAt) AS LastJobUpdate
FROM Organizations o
LEFT JOIN Jobs j ON o.OrganizationID = j.OrganizationID
WHERE o.OrganizationID = @CanonicalOrgIDCheck
   OR o.OrganizationID IN (
       SELECT OrganizationID 
       FROM Organizations 
       WHERE IsActive = 0 
         AND LOWER(Name) LIKE '%' + LOWER((SELECT Name FROM Organizations WHERE OrganizationID = @CanonicalOrgIDCheck)) + '%'
   )
GROUP BY o.OrganizationID, o.Name, o.IsActive
ORDER BY o.IsActive DESC, o.OrganizationID;

-- =====================================================
-- STEP 5: Final Statistics
-- =====================================================
-- View overall database health after cleanup

SELECT 
    'Total Active Organizations' AS Metric,
    COUNT(*) AS Value
FROM Organizations
WHERE IsActive = 1

UNION ALL

SELECT 
    'Organizations with Jobs' AS Metric,
    COUNT(DISTINCT OrganizationID) AS Value
FROM Jobs

UNION ALL

SELECT 
    'Inactive Organizations' AS Metric,
    COUNT(*) AS Value
FROM Organizations
WHERE IsActive = 0

UNION ALL

SELECT 
    'Total Jobs' AS Metric,
    COUNT(*) AS Value
FROM Jobs;

-- =====================================================
-- BONUS: Find Organizations that Need Data Enrichment
-- =====================================================
-- These organizations lack key information

SELECT 
    OrganizationID,
    Name,
    CASE WHEN LogoURL IS NULL THEN '?' ELSE '?' END AS HasLogo,
    CASE WHEN Website IS NULL THEN '?' ELSE '?' END AS HasWebsite,
    CASE WHEN Industry IS NULL THEN '?' ELSE '?' END AS HasIndustry,
    (SELECT COUNT(*) FROM Jobs WHERE OrganizationID = Organizations.OrganizationID) AS JobCount
FROM Organizations
WHERE IsActive = 1
  AND (LogoURL IS NULL OR Website IS NULL OR Industry IS NULL)
  AND (SELECT COUNT(*) FROM Jobs WHERE OrganizationID = Organizations.OrganizationID) > 0
ORDER BY (SELECT COUNT(*) FROM Jobs WHERE OrganizationID = Organizations.OrganizationID) DESC;
