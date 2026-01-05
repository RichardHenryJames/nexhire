-- Add indexes to support personalized job ordering lookups
-- (Applicant prefs + latest work experience)

-- Applicants: look up by UserID and read preference fields
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Applicants_UserID_Preferences'
      AND object_id = OBJECT_ID('Applicants')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Applicants_UserID_Preferences
    ON Applicants(UserID)
    INCLUDE (ApplicantID, PreferredJobTypes, PreferredWorkTypes, PreferredLocations, PreferredCompanySize);
END
GO

-- WorkExperiences: get latest experience for an applicant quickly
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_WorkExperiences_ApplicantID_Active_Recent'
      AND object_id = OBJECT_ID('WorkExperiences')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_WorkExperiences_ApplicantID_Active_Recent
    ON WorkExperiences(ApplicantID, IsActive, EndDate DESC, StartDate DESC)
    INCLUDE (JobTitle);
END
GO
