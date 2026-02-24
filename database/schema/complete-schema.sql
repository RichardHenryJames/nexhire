-- ============================================================
-- RefOpen Database Schema Export
-- Generated: 2026-01-16T18:07:01.782Z
-- This script creates all tables with correct columns and indexes
-- ============================================================

-- ============================================================
-- Table: ApplicantProfileViews
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicantProfileViews')
BEGIN
    CREATE TABLE ApplicantProfileViews (
        ViewID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ViewedByUserID UNIQUEIDENTIFIER NULL,
        ViewedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        Source NVARCHAR(50) NULL,
        ClientIP NVARCHAR(45) NULL,
        UserAgent NVARCHAR(400) NULL,
        SessionID UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK__Applican__1E371C16A4EA1C98 PRIMARY KEY (ViewID)
    );
    PRINT 'Created table ApplicantProfileViews';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicant__Appli__382F5661')
BEGIN
    ALTER TABLE ApplicantProfileViews ADD CONSTRAINT FK__Applicant__Appli__382F5661
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicant__Viewe__39237A9A')
BEGIN
    ALTER TABLE ApplicantProfileViews ADD CONSTRAINT FK__Applicant__Viewe__39237A9A
        FOREIGN KEY (ViewedByUserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ApplicantProfileViews_Applicant_ViewedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ApplicantProfileViews_Applicant_ViewedAt ON ApplicantProfileViews(ViewedByUserID, Source, ApplicantID, ViewedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ApplicantProfileViews_Source')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ApplicantProfileViews_Source ON ApplicantProfileViews(Source);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ApplicantProfileViews_ViewedBy_Recent')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ApplicantProfileViews_ViewedBy_Recent ON ApplicantProfileViews(ApplicantID, Source, ViewedByUserID, ViewedAt);
END
GO

-- ============================================================
-- Table: ApplicantReferralSubscriptions
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicantReferralSubscriptions')
BEGIN
    CREATE TABLE ApplicantReferralSubscriptions (
        SubscriptionID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        PlanID INT NOT NULL,
        StartDate DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        EndDate DATETIME2(7) NOT NULL,
        PaymentID NVARCHAR(100) NULL,
        IsActive BIT NULL DEFAULT ((1)),
        CONSTRAINT PK__Applican__9A2B24BDFE15D9F6 PRIMARY KEY (SubscriptionID)
    );
    PRINT 'Created table ApplicantReferralSubscriptions';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicant__Appli__078C1F06')
BEGIN
    ALTER TABLE ApplicantReferralSubscriptions ADD CONSTRAINT FK__Applicant__Appli__078C1F06
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicant__PlanI__0880433F')
BEGIN
    ALTER TABLE ApplicantReferralSubscriptions ADD CONSTRAINT FK__Applicant__PlanI__0880433F
        FOREIGN KEY (PlanID) REFERENCES ReferralPlans(PlanID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Subscriptions_Applicant_Active')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Subscriptions_Applicant_Active ON ApplicantReferralSubscriptions(PlanID, StartDate, PaymentID, ApplicantID, IsActive, EndDate);
END
GO

-- ============================================================
-- Table: ApplicantResumes
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicantResumes')
BEGIN
    CREATE TABLE ApplicantResumes (
        ResumeID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ResumeLabel NVARCHAR(200) NOT NULL,
        ResumeURL NVARCHAR(1000) NOT NULL,
        IsPrimary BIT NULL DEFAULT ((0)),
        ParsedResumeText NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        IsDeleted BIT NOT NULL DEFAULT ((0)),
        DeletedAt DATETIME NULL,
        CONSTRAINT PK__Applican__D7D7A31773B6E04D PRIMARY KEY (ResumeID)
    );
    PRINT 'Created table ApplicantResumes';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_ApplicantResumes_ApplicantID')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_ApplicantResumes_ApplicantID ON ApplicantResumes(ApplicantID);
END
GO

-- ============================================================
-- Table: ApplicantSalaries
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicantSalaries')
BEGIN
    CREATE TABLE ApplicantSalaries (
        ApplicantSalaryID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ComponentID INT NOT NULL,
        Amount DECIMAL(18, 2) NOT NULL,
        CurrencyID INT NOT NULL,
        Frequency NVARCHAR(50) NULL,
        SalaryContext NVARCHAR(50) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (sysutcdatetime()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (sysutcdatetime()),
        CONSTRAINT PK__Applican__047BE12EEE8118F4 PRIMARY KEY (ApplicantSalaryID)
    );
    PRINT 'Created table ApplicantSalaries';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicant__Appli__7DCDAAA2')
BEGIN
    ALTER TABLE ApplicantSalaries ADD CONSTRAINT FK__Applicant__Appli__7DCDAAA2
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicant__Curre__7EC1CEDB')
BEGIN
    ALTER TABLE ApplicantSalaries ADD CONSTRAINT FK__Applicant__Curre__7EC1CEDB
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ApplicantSalaries_ApplicantID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ApplicantSalaries_ApplicantID ON ApplicantSalaries(ApplicantID);
END
GO

-- ============================================================
-- Table: Applicants
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Applicants')
BEGIN
    CREATE TABLE Applicants (
        ApplicantID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        Nationality NVARCHAR(100) NULL,
        CurrentLocation NVARCHAR(200) NULL,
        PreferredLocations NVARCHAR(500) NULL,
        LinkedInProfile NVARCHAR(500) NULL,
        PortfolioURL NVARCHAR(500) NULL,
        GithubProfile NVARCHAR(500) NULL,
        Headline NVARCHAR(200) NULL,
        Summary NTEXT NULL,
        CurrentJobTitle NVARCHAR(200) NULL,
        PreferredJobTypes NVARCHAR(500) NULL,
        PreferredWorkTypes NVARCHAR(500) NULL,
        NoticePeriod INT NULL,
        ImmediatelyAvailable BIT NULL DEFAULT ((0)),
        WillingToRelocate BIT NULL DEFAULT ((0)),
        PreferredRoles NTEXT NULL,
        PrimarySkills NTEXT NULL,
        SecondarySkills NTEXT NULL,
        Languages NVARCHAR(500) NULL,
        Certifications NTEXT NULL,
        Institution NTEXT NULL,
        HighestEducation NVARCHAR(100) NULL,
        FieldOfStudy NVARCHAR(200) NULL,
        GraduationYear NVARCHAR(4) NULL,
        GPA NVARCHAR(50) NULL,
        AdditionalDocuments NTEXT NULL,
        AllowRecruitersToContact BIT NULL DEFAULT ((1)),
        HideCurrentCompany BIT NULL DEFAULT ((0)),
        HideSalaryDetails BIT NULL DEFAULT ((0)),
        ProfileCompleteness INT NULL DEFAULT ((0)),
        IsOpenToWork BIT NULL DEFAULT ((1)),
        IsFeatured BIT NULL DEFAULT ((0)),
        FeaturedUntil DATETIME2(7) NULL,
        JobSearchStatus NVARCHAR(100) NULL,
        PreferredIndustries NVARCHAR(500) NULL,
        MinimumSalary DECIMAL(15, 2) NULL,
        PreferredCompanySize NVARCHAR(50) NULL,
        LastJobAppliedAt DATETIME2(7) NULL,
        SearchScore DECIMAL(10, 2) NULL,
        TotalExperienceMonths INT NULL,
        CurrentOrganizationID INT NULL,
        CurrentCompanyName NVARCHAR(200) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        OpenToRefer BIT NULL DEFAULT ((0)),
        ReferralPoints INT NULL DEFAULT ((0)),
        CONSTRAINT PK__Applican__39AE914843321CB2 PRIMARY KEY (ApplicantID)
    );
    PRINT 'Created table Applicants';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicant__Curre__14270015')
BEGIN
    ALTER TABLE Applicants ADD CONSTRAINT FK__Applicant__Curre__14270015
        FOREIGN KEY (CurrentOrganizationID) REFERENCES Organizations(OrganizationID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Applicants_OpenToRefer_IsOpenToWork')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Applicants_OpenToRefer_IsOpenToWork ON Applicants(ApplicantID, CurrentOrganizationID, OpenToRefer, IsOpenToWork);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Applicants_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Applicants_UserID ON Applicants(ApplicantID, ProfileCompleteness, IsOpenToWork, OpenToRefer, UserID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Applicants_UserID_Preferences')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Applicants_UserID_Preferences ON Applicants(ApplicantID, PreferredJobTypes, PreferredWorkTypes, PreferredLocations, PreferredCompanySize, UserID);
END
GO

-- ============================================================
-- Table: ApplicationAttachments
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicationAttachments')
BEGIN
    CREATE TABLE ApplicationAttachments (
        AttachmentID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ApplicationID UNIQUEIDENTIFIER NOT NULL,
        FileURL NVARCHAR(1000) NOT NULL,
        FileType NVARCHAR(50) NULL,
        FileDescription NVARCHAR(200) NULL,
        UploadedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        CONSTRAINT PK__Applicat__442C64DEA4126C8C PRIMARY KEY (AttachmentID)
    );
    PRINT 'Created table ApplicationAttachments';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicati__Appli__6AEFE058')
BEGIN
    ALTER TABLE ApplicationAttachments ADD CONSTRAINT FK__Applicati__Appli__6AEFE058
        FOREIGN KEY (ApplicationID) REFERENCES JobApplications(ApplicationID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_ApplicationAttachments_ApplicationID')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_ApplicationAttachments_ApplicationID ON ApplicationAttachments(ApplicationID);
END
GO

-- ============================================================
-- Table: ApplicationStatuses
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicationStatuses')
BEGIN
    CREATE TABLE ApplicationStatuses (
        StatusID INT NOT NULL IDENTITY(1,1),
        Status NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NULL DEFAULT ((1)),
        CreatedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        CONSTRAINT PK__Applicat__C8EE2043E81D0516 PRIMARY KEY (StatusID)
    );
    PRINT 'Created table ApplicationStatuses';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_ApplicationStatuses_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_ApplicationStatuses_Status ON ApplicationStatuses(Status);
END
GO

-- ============================================================
-- Table: ApplicationTracking
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicationTracking')
BEGIN
    CREATE TABLE ApplicationTracking (
        TrackingID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ApplicationID UNIQUEIDENTIFIER NOT NULL,
        StatusID INT NOT NULL,
        ScreeningScore DECIMAL(5, 2) NULL,
        ScreeningNotes NVARCHAR(MAX) NULL,
        InterviewStage INT NULL,
        NextInterviewDate DATETIMEOFFSET NULL,
        InterviewFeedback NVARCHAR(MAX) NULL,
        OfferStatus NVARCHAR(100) NULL,
        OfferedSalary DECIMAL(15, 2) NULL,
        OfferedCurrencyID INT NULL,
        OfferLetterURL NVARCHAR(1000) NULL,
        OfferExpiryDate DATETIMEOFFSET NULL,
        RejectionReason NVARCHAR(500) NULL,
        Notes NVARCHAR(MAX) NULL,
        LastUpdatedBy NVARCHAR(100) NULL,
        LastUpdatedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        CONSTRAINT PK__Applicat__3C19EDD13578A5E6 PRIMARY KEY (TrackingID)
    );
    PRINT 'Created table ApplicationTracking';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicati__Appli__6FB49575')
BEGIN
    ALTER TABLE ApplicationTracking ADD CONSTRAINT FK__Applicati__Appli__6FB49575
        FOREIGN KEY (ApplicationID) REFERENCES JobApplications(ApplicationID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicati__Offer__70A8B9AE')
BEGIN
    ALTER TABLE ApplicationTracking ADD CONSTRAINT FK__Applicati__Offer__70A8B9AE
        FOREIGN KEY (OfferedCurrencyID) REFERENCES Currencies(CurrencyID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Applicati__Statu__719CDDE7')
BEGIN
    ALTER TABLE ApplicationTracking ADD CONSTRAINT FK__Applicati__Statu__719CDDE7
        FOREIGN KEY (StatusID) REFERENCES ApplicationStatuses(StatusID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_ApplicationTracking_ApplicationID')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_ApplicationTracking_ApplicationID ON ApplicationTracking(ApplicationID);
END
GO

-- ============================================================
-- Table: BlockedUsers
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BlockedUsers')
BEGIN
    CREATE TABLE BlockedUsers (
        BlockID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        BlockerUserID UNIQUEIDENTIFIER NOT NULL,
        BlockedUserID UNIQUEIDENTIFIER NOT NULL,
        Reason NVARCHAR(500) NULL,
        BlockedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__BlockedU__14421511F8AEF21A PRIMARY KEY (BlockID)
    );
    PRINT 'Created table BlockedUsers';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__BlockedUs__Block__1CB22475')
BEGIN
    ALTER TABLE BlockedUsers ADD CONSTRAINT FK__BlockedUs__Block__1CB22475
        FOREIGN KEY (BlockerUserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__BlockedUs__Block__1DA648AE')
BEGIN
    ALTER TABLE BlockedUsers ADD CONSTRAINT FK__BlockedUs__Block__1DA648AE
        FOREIGN KEY (BlockedUserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlockedUsers_Blocked')
BEGIN
    CREATE NONCLUSTERED INDEX IX_BlockedUsers_Blocked ON BlockedUsers(BlockerUserID, BlockedUserID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlockedUsers_Blocker')
BEGIN
    CREATE NONCLUSTERED INDEX IX_BlockedUsers_Blocker ON BlockedUsers(BlockedUserID, BlockerUserID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_BlockedUser')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_BlockedUser ON BlockedUsers(BlockerUserID, BlockedUserID);
END
GO

-- ============================================================
-- Table: Conversations
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Conversations')
BEGIN
    CREATE TABLE Conversations (
        ConversationID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        User1ID UNIQUEIDENTIFIER NOT NULL,
        User2ID UNIQUEIDENTIFIER NOT NULL,
        LastMessageAt DATETIME2(7) NULL,
        LastMessagePreview NVARCHAR(200) NULL,
        LastMessageSenderID UNIQUEIDENTIFIER NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        IsArchived1 BIT NULL DEFAULT ((0)),
        IsArchived2 BIT NULL DEFAULT ((0)),
        IsMuted1 BIT NULL DEFAULT ((0)),
        IsMuted2 BIT NULL DEFAULT ((0)),
        CONSTRAINT PK__Conversa__C050D89716863409 PRIMARY KEY (ConversationID)
    );
    PRINT 'Created table Conversations';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Conversat__LastM__099F5001')
BEGIN
    ALTER TABLE Conversations ADD CONSTRAINT FK__Conversat__LastM__099F5001
        FOREIGN KEY (LastMessageSenderID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Conversat__User2__08AB2BC8')
BEGIN
    ALTER TABLE Conversations ADD CONSTRAINT FK__Conversat__User2__08AB2BC8
        FOREIGN KEY (User2ID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Conversations_User1_Updated')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Conversations_User1_Updated ON Conversations(User1ID, UpdatedAt) WHERE ([IsArchived1]=(0));
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Conversations_User2_Updated')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Conversations_User2_Updated ON Conversations(User2ID, UpdatedAt) WHERE ([IsArchived2]=(0));
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_Conversation')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_Conversation ON Conversations(User1ID, User2ID);
END
GO

-- ============================================================
-- Table: Currencies
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Currencies')
BEGIN
    CREATE TABLE Currencies (
        CurrencyID INT NOT NULL IDENTITY(1,1),
        Code NVARCHAR(3) NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Symbol NVARCHAR(10) NULL,
        IsActive BIT NULL DEFAULT ((1)),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Currenci__14470B1005E1DC08 PRIMARY KEY (CurrencyID)
    );
    PRINT 'Created table Currencies';
END
GO


-- ============================================================
-- Table: DailyJobEmailLogs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DailyJobEmailLogs')
BEGIN
    CREATE TABLE DailyJobEmailLogs (
        LogID INT NOT NULL IDENTITY(1,1),
        ExecutionID NVARCHAR(100) NOT NULL,
        StartTime DATETIME2(7) NOT NULL,
        EndTime DATETIME2(7) NOT NULL,
        DurationSeconds INT NULL,
        TotalUsers INT NOT NULL DEFAULT ((0)),
        EmailsSent INT NOT NULL DEFAULT ((0)),
        EmailsFailed INT NOT NULL DEFAULT ((0)),
        Errors NVARCHAR(MAX) NULL,
        TriggerType NVARCHAR(50) NOT NULL DEFAULT ('Manual'),
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__DailyJob__5E5499A85DAEA676 PRIMARY KEY (LogID)
    );
    PRINT 'Created table DailyJobEmailLogs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DailyJobEmailLogs_StartTime')
BEGIN
    CREATE NONCLUSTERED INDEX IX_DailyJobEmailLogs_StartTime ON DailyJobEmailLogs(StartTime);
END
GO

-- ============================================================
-- Table: EmailLogs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmailLogs')
BEGIN
    CREATE TABLE EmailLogs (
        LogID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NULL,
        ToEmail NVARCHAR(255) NOT NULL,
        EmailType NVARCHAR(50) NOT NULL,
        Subject NVARCHAR(500) NOT NULL,
        ProviderMessageID NVARCHAR(200) NULL,
        Provider NVARCHAR(50) NULL DEFAULT ('azure_acs'),
        Status NVARCHAR(20) NULL DEFAULT ('sent'),
        DeliveredAt DATETIME2(7) NULL,
        OpenedAt DATETIME2(7) NULL,
        BouncedAt DATETIME2(7) NULL,
        ErrorMessage NVARCHAR(500) NULL,
        SentAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        ReferenceType NVARCHAR(50) NULL,
        ReferenceID NVARCHAR(100) NULL,
        CONSTRAINT PK__EmailLog__5E5499A8FC248AFB PRIMARY KEY (LogID)
    );
    PRINT 'Created table EmailLogs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_EmailLogs_Users')
BEGIN
    ALTER TABLE EmailLogs ADD CONSTRAINT FK_EmailLogs_Users
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EmailLogs_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_EmailLogs_Status ON EmailLogs(Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EmailLogs_Type_SentAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_EmailLogs_Type_SentAt ON EmailLogs(EmailType, SentAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EmailLogs_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_EmailLogs_UserID ON EmailLogs(UserID);
END
GO

-- ============================================================
-- Table: EmailVerificationOTPs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmailVerificationOTPs')
BEGIN
    CREATE TABLE EmailVerificationOTPs (
        OTPID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NULL,
        WorkExperienceID UNIQUEIDENTIFIER NULL,
        Email NVARCHAR(255) NOT NULL,
        OTPCode CHAR(4) NOT NULL,
        Purpose NVARCHAR(50) NOT NULL DEFAULT ('COMPANY_EMAIL_VERIFICATION'),
        IsUsed BIT NOT NULL DEFAULT ((0)),
        ExpiresAt DATETIME2(7) NOT NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        UsedAt DATETIME2(7) NULL,
        AttemptCount INT NOT NULL DEFAULT ((0)),
        MaxAttempts INT NOT NULL DEFAULT ((3)),
        CONSTRAINT PK__EmailVer__5C2EC5620BEA370B PRIMARY KEY (OTPID)
    );
    PRINT 'Created table EmailVerificationOTPs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_EmailVerificationOTPs_Users')
BEGIN
    ALTER TABLE EmailVerificationOTPs ADD CONSTRAINT FK_EmailVerificationOTPs_Users
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_EmailVerificationOTPs_WorkExperiences')
BEGIN
    ALTER TABLE EmailVerificationOTPs ADD CONSTRAINT FK_EmailVerificationOTPs_WorkExperiences
        FOREIGN KEY (WorkExperienceID) REFERENCES WorkExperiences(WorkExperienceID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EmailVerificationOTPs_Email')
BEGIN
    CREATE NONCLUSTERED INDEX IX_EmailVerificationOTPs_Email ON EmailVerificationOTPs(Email);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EmailVerificationOTPs_ExpiresAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_EmailVerificationOTPs_ExpiresAt ON EmailVerificationOTPs(ExpiresAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EmailVerificationOTPs_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_EmailVerificationOTPs_UserID ON EmailVerificationOTPs(UserID);
END
GO

-- ============================================================
-- Table: Employers
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Employers')
BEGIN
    CREATE TABLE Employers (
        EmployerID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        OrganizationID INT NOT NULL,
        Role NVARCHAR(50) NULL DEFAULT ('Recruiter'),
        IsVerified BIT NULL DEFAULT ((0)),
        JoinedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Employer__CA4452417FFA3858 PRIMARY KEY (EmployerID)
    );
    PRINT 'Created table Employers';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Employers__Organ__2645B050')
BEGIN
    ALTER TABLE Employers ADD CONSTRAINT FK__Employers__Organ__2645B050
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employers_UserID_OrganizationID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Employers_UserID_OrganizationID ON Employers(EmployerID, Role, IsVerified, UserID, OrganizationID);
END
GO

-- ============================================================
-- Table: InAppNotifications
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InAppNotifications')
BEGIN
    CREATE TABLE InAppNotifications (
        NotificationID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Body NVARCHAR(500) NOT NULL,
        Icon NVARCHAR(50) NULL,
        ImageURL NVARCHAR(500) NULL,
        ActionURL NVARCHAR(500) NULL,
        ActionLabel NVARCHAR(50) NULL,
        IsRead BIT NULL DEFAULT ((0)),
        ReadAt DATETIME2(7) NULL,
        NotificationType NVARCHAR(50) NOT NULL,
        ReferenceID NVARCHAR(100) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        ExpiresAt DATETIME2(7) NULL,
        CONSTRAINT PK__InAppNot__20CF2E325D65CF78 PRIMARY KEY (NotificationID)
    );
    PRINT 'Created table InAppNotifications';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_InAppNotifications_Users')
BEGIN
    ALTER TABLE InAppNotifications ADD CONSTRAINT FK_InAppNotifications_Users
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InAppNotifications_User_Unread')
BEGIN
    CREATE NONCLUSTERED INDEX IX_InAppNotifications_User_Unread ON InAppNotifications(UserID, IsRead, CreatedAt);
END
GO

-- ============================================================
-- Table: JobApplications
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobApplications')
BEGIN
    CREATE TABLE JobApplications (
        ApplicationID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        JobID UNIQUEIDENTIFIER NOT NULL,
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ResumeID UNIQUEIDENTIFIER NOT NULL,
        CoverLetter NVARCHAR(MAX) NULL,
        ExpectedSalary DECIMAL(15, 2) NULL,
        ExpectedCurrencyID INT NULL,
        AvailableFromDate DATE NULL,
        StatusID INT NOT NULL DEFAULT ((1)),
        SubmittedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        LastUpdatedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        IsArchived BIT NULL DEFAULT ((0)),
        CONSTRAINT PK__JobAppli__C93A4F792C1FCFA1 PRIMARY KEY (ApplicationID)
    );
    PRINT 'Created table JobApplications';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__JobApplic__Appli__634EBE90')
BEGIN
    ALTER TABLE JobApplications ADD CONSTRAINT FK__JobApplic__Appli__634EBE90
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__JobApplic__Expec__65370702')
BEGIN
    ALTER TABLE JobApplications ADD CONSTRAINT FK__JobApplic__Expec__65370702
        FOREIGN KEY (ExpectedCurrencyID) REFERENCES Currencies(CurrencyID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__JobApplic__JobID__625A9A57')
BEGIN
    ALTER TABLE JobApplications ADD CONSTRAINT FK__JobApplic__JobID__625A9A57
        FOREIGN KEY (JobID) REFERENCES Jobs(JobID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__JobApplic__Resum__6442E2C9')
BEGIN
    ALTER TABLE JobApplications ADD CONSTRAINT FK__JobApplic__Resum__6442E2C9
        FOREIGN KEY (ResumeID) REFERENCES ApplicantResumes(ResumeID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__JobApplic__Statu__662B2B3B')
BEGIN
    ALTER TABLE JobApplications ADD CONSTRAINT FK__JobApplic__Statu__662B2B3B
        FOREIGN KEY (StatusID) REFERENCES ApplicationStatuses(StatusID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_JobApplications_Applicant')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_JobApplications_Applicant ON JobApplications(ApplicantID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_JobApplications_JobStatus')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_JobApplications_JobStatus ON JobApplications(JobID, StatusID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_JobApplications_ApplicantID_StatusID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_JobApplications_ApplicantID_StatusID ON JobApplications(ApplicationID, JobID, SubmittedAt, ApplicantID, StatusID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_JobApplications_JobID_Applicant_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_JobApplications_JobID_Applicant_Status ON JobApplications(JobID, ApplicantID, StatusID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_JobApplications_JobID_StatusID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_JobApplications_JobID_StatusID ON JobApplications(ApplicationID, ApplicantID, SubmittedAt, JobID, StatusID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_JobApplications_JobID_StatusID_ApplicantID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_JobApplications_JobID_StatusID_ApplicantID ON JobApplications(ApplicationID, JobID, StatusID, ApplicantID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ__JobAppli__96FC79F799F81B77')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ__JobAppli__96FC79F799F81B77 ON JobApplications(JobID, ApplicantID);
END
GO

-- ============================================================
-- Table: JobArchiveLogs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobArchiveLogs')
BEGIN
    CREATE TABLE JobArchiveLogs (
        LogID INT NOT NULL IDENTITY(1,1),
        RunID NVARCHAR(50) NOT NULL,
        StartTime DATETIME2(7) NOT NULL,
        EndTime DATETIME2(7) NOT NULL,
        DaysOld INT NOT NULL,
        TotalJobsFound INT NOT NULL DEFAULT ((0)),
        TotalJobsArchived INT NOT NULL DEFAULT ((0)),
        TotalJobsDeleted INT NOT NULL DEFAULT ((0)),
        Success BIT NOT NULL DEFAULT ((0)),
        ErrorCount INT NOT NULL DEFAULT ((0)),
        Errors NVARCHAR(MAX) NULL,
        ArchivedJobIDs NVARCHAR(MAX) NULL,
        DurationSeconds INT NOT NULL DEFAULT ((0)),
        TriggerType NVARCHAR(50) NOT NULL DEFAULT ('Manual'),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__JobArchi__5E5499A8D8B7B2C6 PRIMARY KEY (LogID)
    );
    PRINT 'Created table JobArchiveLogs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_JobArchiveLogs_RunID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_JobArchiveLogs_RunID ON JobArchiveLogs(RunID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_JobArchiveLogs_Success_StartTime')
BEGIN
    CREATE NONCLUSTERED INDEX IX_JobArchiveLogs_Success_StartTime ON JobArchiveLogs(Success, StartTime);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_JobArchiveLogs_TriggerType_StartTime')
BEGIN
    CREATE NONCLUSTERED INDEX IX_JobArchiveLogs_TriggerType_StartTime ON JobArchiveLogs(Success, TotalJobsArchived, TotalJobsDeleted, TriggerType, StartTime);
END
GO

-- ============================================================
-- Table: JobTypes
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobTypes')
BEGIN
    CREATE TABLE JobTypes (
        JobTypeID INT NOT NULL IDENTITY(1,1),
        Type NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NULL DEFAULT ((1)),
        CreatedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        CONSTRAINT PK__JobTypes__E1F4624DE0A6DEB9 PRIMARY KEY (JobTypeID)
    );
    PRINT 'Created table JobTypes';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_JobTypes_Type')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_JobTypes_Type ON JobTypes(Type);
END
GO

-- ============================================================
-- Table: Jobs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Jobs')
BEGIN
    CREATE TABLE Jobs (
        JobID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        OrganizationID INT NOT NULL,
        PostedByUserID UNIQUEIDENTIFIER NULL,
        ApplicationURL NVARCHAR(500) NULL,
        PostedByType TINYINT NOT NULL DEFAULT ((0)),
        Title NVARCHAR(200) NOT NULL,
        JobTypeID INT NOT NULL,
        WorkplaceTypeID INT NOT NULL,
        Department NVARCHAR(100) NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        Responsibilities NVARCHAR(MAX) NULL,
        BenefitsOffered NVARCHAR(MAX) NULL,
        Location NVARCHAR(200) NOT NULL,
        Country NVARCHAR(100) NULL,
        State NVARCHAR(100) NULL,
        City NVARCHAR(100) NULL,
        PostalCode NVARCHAR(20) NULL,
        IsRemote BIT NULL DEFAULT ((0)),
        RemoteRestrictions NVARCHAR(500) NULL,
        SalaryRangeMin DECIMAL(15, 2) NULL,
        SalaryRangeMax DECIMAL(15, 2) NULL,
        CurrencyID INT NULL,
        SalaryPeriod NVARCHAR(50) NULL,
        CompensationType NVARCHAR(50) NULL,
        BonusDetails NVARCHAR(500) NULL,
        EquityOffered NVARCHAR(100) NULL,
        ProjectDuration NVARCHAR(100) NULL,
        ProjectStartDate DATE NULL,
        ProjectEndDate DATE NULL,
        ProjectBudget DECIMAL(15, 2) NULL,
        ContractExtensionPossible BIT NULL,
        ContractConversionPossible BIT NULL,
        ExperienceMin INT NULL,
        ExperienceMax INT NULL,
        RequiredEducation NVARCHAR(200) NULL,
        RequiredLanguages NVARCHAR(500) NULL,
        RequiredCertifications NVARCHAR(500) NULL,
        Status NVARCHAR(50) NULL DEFAULT ('Draft'),
        Priority NVARCHAR(50) NULL DEFAULT ('Normal'),
        Visibility NVARCHAR(50) NULL DEFAULT ('Public'),
        ApplicationDeadline DATETIMEOFFSET NULL,
        TargetHiringDate DATETIMEOFFSET NULL,
        MaxApplications INT NULL,
        CurrentApplications INT NULL DEFAULT ((0)),
        InterviewStages NVARCHAR(500) NULL,
        InterviewProcess NVARCHAR(500) NULL,
        AssessmentRequired BIT NULL DEFAULT ((0)),
        AssessmentDetails NVARCHAR(MAX) NULL,
        PublishedAt DATETIMEOFFSET NULL,
        ExpiresAt DATETIMEOFFSET NULL,
        CreatedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        UpdatedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        LastBumpedAt DATETIMEOFFSET NULL,
        TimeZone NVARCHAR(100) NULL,
        Tags NVARCHAR(1000) NULL,
        InternalNotes NVARCHAR(MAX) NULL,
        ExternalJobID NVARCHAR(100) NOT NULL,
        SearchScore DECIMAL(10, 2) NULL,
        FeaturedUntil DATETIMEOFFSET NULL,
        IsArchived BIT NULL DEFAULT ((0)),
        ViewsCount INT NULL DEFAULT ((0)),
        CONSTRAINT PK__Jobs__056690E255ABE776 PRIMARY KEY (JobID)
    );
    PRINT 'Created table Jobs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Jobs__CurrencyID__4B7734FF')
BEGIN
    ALTER TABLE Jobs ADD CONSTRAINT FK__Jobs__CurrencyID__4B7734FF
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Jobs__Organizati__47A6A41B')
BEGIN
    ALTER TABLE Jobs ADD CONSTRAINT FK__Jobs__Organizati__47A6A41B
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_Experience_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_Experience_Status ON Jobs(PublishedAt, OrganizationID, Title, ExperienceMin, ExperienceMax, Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_IsRemote')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_IsRemote ON Jobs(Status, PublishedAt, IsRemote);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_IsRemote_Status_PublishedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_IsRemote_Status_PublishedAt ON Jobs(IsRemote, Status, PublishedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_JobID_FullTextKey')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Jobs_JobID_FullTextKey ON Jobs(JobID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_JobTypeID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_JobTypeID ON Jobs(Status, PublishedAt, JobTypeID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_JobTypeID_Status_PublishedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_JobTypeID_Status_PublishedAt ON Jobs(OrganizationID, Title, WorkplaceTypeID, JobTypeID, Status, PublishedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_Optimized_GetSearch')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_Optimized_GetSearch ON Jobs(JobID, Title, Location, City, Country, OrganizationID, Description, Tags, SalaryRangeMin, SalaryRangeMax, CurrencyID, ExperienceMin, ExperienceMax, Department, PostedByUserID, PostedByType, CreatedAt, Status, PublishedAt, WorkplaceTypeID, JobTypeID, IsRemote);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_Organization_Active')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_Organization_Active ON Jobs(Status, PublishedAt, CreatedAt, OrganizationID) WHERE ([Status]='Published');
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_OrganizationID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_OrganizationID ON Jobs(Title, OrganizationID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_OrganizationID_Status_PublishedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_OrganizationID_Status_PublishedAt ON Jobs(Title, JobTypeID, WorkplaceTypeID, Location, SalaryRangeMin, SalaryRangeMax, OrganizationID, Status, PublishedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_PostedByUserID_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_PostedByUserID_Status ON Jobs(Title, OrganizationID, CreatedAt, PostedByType, PostedByUserID, Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_PostedByUserID_Status_OrgID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_PostedByUserID_Status_OrgID ON Jobs(Title, CreatedAt, PostedByType, UpdatedAt, PublishedAt, PostedByUserID, Status, OrganizationID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_Scraping_Stats')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_Scraping_Stats ON Jobs(PostedByType, ExternalJobID, CreatedAt, Country) WHERE ([PostedByType]=(0) AND [ExternalJobID] IS NOT NULL);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_Status_PublishedAt_Covering')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_Status_PublishedAt_Covering ON Jobs(JobID, Title, JobTypeID, WorkplaceTypeID, OrganizationID, Location, City, State, Country, IsRemote, SalaryRangeMin, SalaryRangeMax, SalaryPeriod, CreatedAt, Status, PublishedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_WorkplaceTypeID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_WorkplaceTypeID ON Jobs(Status, PublishedAt, WorkplaceTypeID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_WorkplaceTypeID_Status_Published')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_WorkplaceTypeID_Status_Published ON Jobs(JobID, Title, JobTypeID, Location, CreatedAt, PublishedAt, SalaryRangeMin, SalaryRangeMax, CurrencyID, PostedByUserID, PostedByType, WorkplaceTypeID, Status, OrganizationID) WHERE ([Status]='Published');
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_WorkplaceTypeID_Status_PublishedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_WorkplaceTypeID_Status_PublishedAt ON Jobs(OrganizationID, Title, JobTypeID, WorkplaceTypeID, Status, PublishedAt);
END
GO

-- ============================================================
-- Table: ManualPaymentSubmissions
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ManualPaymentSubmissions')
BEGIN
    CREATE TABLE ManualPaymentSubmissions (
        SubmissionID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        WalletID UNIQUEIDENTIFIER NULL,
        Amount DECIMAL(10, 2) NOT NULL,
        ReferenceNumber NVARCHAR(100) NOT NULL,
        PaymentMethod NVARCHAR(50) NOT NULL DEFAULT ('UPI'),
        PaymentDate DATE NOT NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT ('Pending'),
        CreatedAt DATETIME NOT NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME NOT NULL DEFAULT (getutcdate()),
        ProofImageURL NVARCHAR(500) NULL,
        UserRemarks NVARCHAR(500) NULL,
        AdminRemarks NVARCHAR(500) NULL,
        ReviewedBy UNIQUEIDENTIFIER NULL,
        ReviewedAt DATETIME NULL,
        PackID INT NULL,
        PromoCode NVARCHAR(50) NULL,
        BonusCredited DECIMAL(10, 2) NOT NULL DEFAULT (0),
        CONSTRAINT PK__ManualPa__449EE105DCC9543D PRIMARY KEY (SubmissionID)
    );
    PRINT 'Created table ManualPaymentSubmissions';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ManualPayment_User')
BEGIN
    ALTER TABLE ManualPaymentSubmissions ADD CONSTRAINT FK_ManualPayment_User
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ManualPayment_Wallet')
BEGIN
    ALTER TABLE ManualPaymentSubmissions ADD CONSTRAINT FK_ManualPayment_Wallet
        FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ManualPayment_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ManualPayment_CreatedAt ON ManualPaymentSubmissions(CreatedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ManualPayment_Reference')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_ManualPayment_Reference ON ManualPaymentSubmissions(ReferenceNumber) WHERE ([Status]<>'Rejected');
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ManualPayment_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ManualPayment_Status ON ManualPaymentSubmissions(Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ManualPayment_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ManualPayment_UserID ON ManualPaymentSubmissions(UserID);
END
GO

-- ============================================================
-- Table: Messages
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Messages')
BEGIN
    CREATE TABLE Messages (
        MessageID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ConversationID UNIQUEIDENTIFIER NOT NULL,
        SenderUserID UNIQUEIDENTIFIER NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        MessageType NVARCHAR(50) NULL DEFAULT ('Text'),
        AttachmentURL NVARCHAR(1000) NULL,
        AttachmentType NVARCHAR(50) NULL,
        AttachmentSize INT NULL,
        AttachmentName NVARCHAR(255) NULL,
        IsRead BIT NULL DEFAULT ((0)),
        ReadAt DATETIME2(7) NULL,
        IsDelivered BIT NULL DEFAULT ((1)),
        DeliveredAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        IsEdited BIT NULL DEFAULT ((0)),
        EditedAt DATETIME2(7) NULL,
        IsDeleted BIT NULL DEFAULT ((0)),
        DeletedAt DATETIME2(7) NULL,
        DeletedFor NVARCHAR(20) NULL,
        ReplyToMessageID UNIQUEIDENTIFIER NULL,
        EmailReminderSent BIT NOT NULL DEFAULT ((0)),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Messages__C87C037C87EB3547 PRIMARY KEY (MessageID)
    );
    PRINT 'Created table Messages';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Messages__Conver__151102AD')
BEGIN
    ALTER TABLE Messages ADD CONSTRAINT FK__Messages__Conver__151102AD
        FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Messages__ReplyT__16F94B1F')
BEGIN
    ALTER TABLE Messages ADD CONSTRAINT FK__Messages__ReplyT__16F94B1F
        FOREIGN KEY (ReplyToMessageID) REFERENCES Messages(MessageID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Messages__Sender__160526E6')
BEGIN
    ALTER TABLE Messages ADD CONSTRAINT FK__Messages__Sender__160526E6
        FOREIGN KEY (SenderUserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_Conversation_Created')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Messages_Conversation_Created ON Messages(MessageID, SenderUserID, Content, MessageType, IsRead, IsDeleted, ConversationID, CreatedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_Sender')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Messages_Sender ON Messages(SenderUserID, CreatedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_Unread')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Messages_Unread ON Messages(ConversationID, IsRead, CreatedAt) WHERE ([IsRead]=(0) AND [IsDeleted]=(0));
END
GO

-- ============================================================
-- Table: NotificationPreferences
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationPreferences')
BEGIN
    CREATE TABLE NotificationPreferences (
        UserID UNIQUEIDENTIFIER NOT NULL,
        EmailEnabled BIT NULL DEFAULT ((1)),
        PushEnabled BIT NULL DEFAULT ((1)),
        InAppEnabled BIT NULL DEFAULT ((1)),
        ReferralRequestEmail BIT NULL DEFAULT ((1)),
        ReferralRequestPush BIT NULL DEFAULT ((1)),
        ReferralClaimedEmail BIT NULL DEFAULT ((1)),
        ReferralClaimedPush BIT NULL DEFAULT ((1)),
        ReferralVerifiedEmail BIT NULL DEFAULT ((1)),
        ReferralVerifiedPush BIT NULL DEFAULT ((1)),
        JobApplicationEmail BIT NULL DEFAULT ((1)),
        JobMatchEmail BIT NULL DEFAULT ((0)),
        MessageReceivedPush BIT NULL DEFAULT ((1)),
        ProfileViewedEmail BIT NULL DEFAULT ((0)),
        DailyDigestEmail BIT NULL DEFAULT ((0)),
        WeeklyDigestEmail BIT NULL DEFAULT ((1)),
        QuietHoursEnabled BIT NULL DEFAULT ((0)),
        Timezone NVARCHAR(50) NULL DEFAULT ('Asia/Kolkata'),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        MessageReceivedEmail BIT NOT NULL DEFAULT ((1)),
        WeeklyDigestEnabled BIT NOT NULL DEFAULT ((1)),
        DailyJobRecommendationEmail BIT NOT NULL DEFAULT ((1)),
        ReferrerNotificationEmail BIT NOT NULL DEFAULT ((1)),
        MarketingEmail BIT NOT NULL DEFAULT ((1)),
        CONSTRAINT PK__Notifica__1788CCACE92166D2 PRIMARY KEY (UserID)
    );
    PRINT 'Created table NotificationPreferences';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_NotificationPreferences_Users')
BEGIN
    ALTER TABLE NotificationPreferences ADD CONSTRAINT FK_NotificationPreferences_Users
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO

-- ============================================================
-- Table: NotificationQueue
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationQueue')
BEGIN
    CREATE TABLE NotificationQueue (
        NotificationID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NULL,
        NotificationType NVARCHAR(50) NOT NULL,
        Channel NVARCHAR(20) NOT NULL,
        Payload NVARCHAR(MAX) NOT NULL,
        Status NVARCHAR(20) NULL DEFAULT ('pending'),
        RetryCount INT NULL DEFAULT ((0)),
        MaxRetries INT NULL DEFAULT ((3)),
        ScheduledAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        ProcessedAt DATETIME2(7) NULL,
        CompletedAt DATETIME2(7) NULL,
        ErrorMessage NVARCHAR(1000) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Notifica__20CF2E32B8A0294B PRIMARY KEY (NotificationID)
    );
    PRINT 'Created table NotificationQueue';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_NotificationQueue_Users')
BEGIN
    ALTER TABLE NotificationQueue ADD CONSTRAINT FK_NotificationQueue_Users
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NotificationQueue_Status_Scheduled')
BEGIN
    CREATE NONCLUSTERED INDEX IX_NotificationQueue_Status_Scheduled ON NotificationQueue(Status, ScheduledAt) WHERE ([Status]='pending');
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NotificationQueue_Type')
BEGIN
    CREATE NONCLUSTERED INDEX IX_NotificationQueue_Type ON NotificationQueue(NotificationType);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NotificationQueue_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_NotificationQueue_UserID ON NotificationQueue(UserID);
END
GO

-- ============================================================
-- Table: Organizations
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Organizations')
BEGIN
    CREATE TABLE Organizations (
        OrganizationID INT NOT NULL IDENTITY(1,1),
        Name NVARCHAR(200) NOT NULL,
        Type NVARCHAR(50) NULL,
        Industry NVARCHAR(100) NULL,
        Size NVARCHAR(20) NULL,
        Website NVARCHAR(500) NULL,
        LinkedInProfile NVARCHAR(500) NULL,
        Description NVARCHAR(MAX) NULL,
        LogoURL NVARCHAR(1000) NULL,
        VerificationStatus TINYINT NULL DEFAULT ((0)),
        EstablishedDate DATE NULL,
        Headquarters NVARCHAR(255) NULL,
        ContactEmail NVARCHAR(320) NULL,
        ContactPhone NVARCHAR(20) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        IsActive BIT NULL DEFAULT ((1)),
        IsFortune500 BIT NOT NULL DEFAULT ((0)),
        VerifiedReferrersCount INT NOT NULL DEFAULT ((0)),
        IsUserCreated BIT NOT NULL DEFAULT ((0)),
        NormalizedName AS (lower(replace(replace([Name],' ',''),'.',''))) PERSISTED,
        CONSTRAINT PK__Organiza__CADB0B7268D137E7 PRIMARY KEY (OrganizationID)
    );
    PRINT 'Created table Organizations';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_Active_Lookup')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_Active_Lookup ON Organizations(Name, LogoURL, LinkedInProfile, Website, OrganizationID, IsActive) WHERE ([IsActive]=(1));
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_F500_Covering')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_F500_Covering ON Organizations(OrganizationID, Name, LogoURL, Industry, Website, LinkedInProfile, Description, Type, IsFortune500, IsActive) WHERE ([IsFortune500]=(1) AND [IsActive]=(1));
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_GetOrgs_Covering')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_GetOrgs_Covering ON Organizations(OrganizationID, LogoURL, Industry, IsActive, IsFortune500, Name);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_IsActive_Optimized')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_IsActive_Optimized ON Organizations(Name, LogoURL, LinkedInProfile, Website, Description, IsActive, OrganizationID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_IsFortune500')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_IsFortune500 ON Organizations(Name, OrganizationID, IsFortune500);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_Lookup_Complete')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_Lookup_Complete ON Organizations(OrganizationID, LogoURL, Industry, IsActive, IsFortune500, Name);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_Lookup_Optimized')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_Lookup_Optimized ON Organizations(OrganizationID, LogoURL, Type, IsActive, IsFortune500, Name);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_NameSearch')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_NameSearch ON Organizations(OrganizationID, LogoURL, Industry, IsFortune500, IsActive, Name);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_NormalizedName')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_NormalizedName ON Organizations(OrganizationID, Name, LogoURL, Website, Industry, NormalizedName, IsActive);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_Search_Covering')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_Search_Covering ON Organizations(OrganizationID, LogoURL, Industry, IsActive, IsFortune500, Name);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Organizations_VerifiedReferrersCount')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_VerifiedReferrersCount ON Organizations(Name, LogoURL, VerifiedReferrersCount, OrganizationID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ__Organiza__737584F65D101D06')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ__Organiza__737584F65D101D06 ON Organizations(Name);
END
GO

-- ============================================================
-- Table: PaymentOrders
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentOrders')
BEGIN
    CREATE TABLE PaymentOrders (
        OrderID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        PlanID INT NOT NULL,
        Amount DECIMAL(10, 2) NOT NULL,
        Currency NVARCHAR(10) NOT NULL,
        Status NVARCHAR(50) NULL DEFAULT ('Pending'),
        PaymentGateway NVARCHAR(50) NULL,
        PaymentReference NVARCHAR(200) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        PaidAt DATETIME2(7) NULL,
        CONSTRAINT PK__PaymentO__C3905BAFF8E0B491 PRIMARY KEY (OrderID)
    );
    PRINT 'Created table PaymentOrders';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__PaymentOr__Appli__2BC97F7C')
BEGIN
    ALTER TABLE PaymentOrders ADD CONSTRAINT FK__PaymentOr__Appli__2BC97F7C
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__PaymentOr__PlanI__2CBDA3B5')
BEGIN
    ALTER TABLE PaymentOrders ADD CONSTRAINT FK__PaymentOr__PlanI__2CBDA3B5
        FOREIGN KEY (PlanID) REFERENCES ReferralPlans(PlanID)
;
END
GO

-- ============================================================
-- Table: PaymentSettings
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentSettings')
BEGIN
    CREATE TABLE PaymentSettings (
        SettingID INT NOT NULL IDENTITY(1,1),
        SettingKey NVARCHAR(100) NOT NULL,
        SettingValue NVARCHAR(500) NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NULL DEFAULT ((1)),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__PaymentS__54372AFDF636174B PRIMARY KEY (SettingID)
    );
    PRINT 'Created table PaymentSettings';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ__PaymentS__01E719AD1D2CB670')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ__PaymentS__01E719AD1D2CB670 ON PaymentSettings(SettingKey);
END
GO

-- ============================================================
-- Table: PaymentTransactions
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentTransactions')
BEGIN
    CREATE TABLE PaymentTransactions (
        TransactionID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        PaymentID NVARCHAR(100) NULL,
        OrderID NVARCHAR(100) NULL,
        Amount INT NOT NULL,
        Currency NVARCHAR(10) NOT NULL DEFAULT ('INR'),
        Status NVARCHAR(20) NOT NULL,
        PaymentMethod NVARCHAR(50) NOT NULL DEFAULT ('Razorpay'),
        ErrorMessage NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__PaymentT__55433A4B62B54976 PRIMARY KEY (TransactionID)
    );
    PRINT 'Created table PaymentTransactions';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__PaymentTr__UserI__336AA144')
BEGIN
    ALTER TABLE PaymentTransactions ADD CONSTRAINT FK__PaymentTr__UserI__336AA144
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO

-- ============================================================
-- Table: PricingSettings
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PricingSettings')
BEGIN
    CREATE TABLE PricingSettings (
        SettingID INT NOT NULL IDENTITY(1,1),
        SettingKey NVARCHAR(50) NOT NULL,
        SettingValue DECIMAL(10, 2) NOT NULL,
        Description NVARCHAR(255) NULL,
        IsActive BIT NULL DEFAULT ((1)),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__PricingS__54372AFDEAF2E534 PRIMARY KEY (SettingID)
    );
    PRINT 'Created table PricingSettings';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ__PricingS__01E719ADF72114B5')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ__PricingS__01E719ADF72114B5 ON PricingSettings(SettingKey);
END
GO

-- ============================================================
-- Table: PushTokens
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PushTokens')
BEGIN
    CREATE TABLE PushTokens (
        TokenID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        Token NVARCHAR(500) NOT NULL,
        Platform NVARCHAR(20) NOT NULL,
        Provider NVARCHAR(50) NULL DEFAULT ('expo'),
        DeviceID NVARCHAR(200) NULL,
        DeviceName NVARCHAR(100) NULL,
        IsActive BIT NULL DEFAULT ((1)),
        LastUsedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__PushToke__658FEE8A5FD44F24 PRIMARY KEY (TokenID)
    );
    PRINT 'Created table PushTokens';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_PushTokens_Users')
BEGIN
    ALTER TABLE PushTokens ADD CONSTRAINT FK_PushTokens_Users
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PushTokens_Token')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_PushTokens_Token ON PushTokens(Token);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PushTokens_UserID_Active')
BEGIN
    CREATE NONCLUSTERED INDEX IX_PushTokens_UserID_Active ON PushTokens(UserID, IsActive) WHERE ([IsActive]=(1));
END
GO

-- ============================================================
-- Table: ReferenceMetadata
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferenceMetadata')
BEGIN
    CREATE TABLE ReferenceMetadata (
        ReferenceID INT NOT NULL IDENTITY(1,1),
        RefType NVARCHAR(50) NOT NULL,
        Value NVARCHAR(200) NOT NULL,
        Category NVARCHAR(100) NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NULL DEFAULT ((1)),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Referenc__E1A99A7960FC7015 PRIMARY KEY (ReferenceID)
    );
    PRINT 'Created table ReferenceMetadata';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferenceMetadata_Category')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferenceMetadata_Category ON ReferenceMetadata(Category, IsActive);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferenceMetadata_RefType')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferenceMetadata_RefType ON ReferenceMetadata(RefType, IsActive);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferenceMetadata_RefType_Category_Value_NotNull')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_ReferenceMetadata_RefType_Category_Value_NotNull ON ReferenceMetadata(RefType, Category, Value) WHERE ([Category] IS NOT NULL);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferenceMetadata_RefType_Value_NullCategory')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_ReferenceMetadata_RefType_Value_NullCategory ON ReferenceMetadata(RefType, Value) WHERE ([Category] IS NULL);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferenceMetadata_Value')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferenceMetadata_Value ON ReferenceMetadata(Value);
END
GO

-- ============================================================
-- Table: ReferralPlans
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralPlans')
BEGIN
    CREATE TABLE ReferralPlans (
        PlanID INT NOT NULL IDENTITY(1,1),
        Name NVARCHAR(100) NOT NULL,
        ReferralsPerDay INT NOT NULL,
        DurationDays INT NOT NULL,
        Price DECIMAL(10, 2) NOT NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Referral__755C22D70F071622 PRIMARY KEY (PlanID)
    );
    PRINT 'Created table ReferralPlans';
END
GO


-- ============================================================
-- Table: ReferralProofs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralProofs')
BEGIN
    CREATE TABLE ReferralProofs (
        ProofID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        RequestID UNIQUEIDENTIFIER NOT NULL,
        ReferrerID UNIQUEIDENTIFIER NOT NULL,
        FileURL NVARCHAR(1000) NOT NULL,
        FileType NVARCHAR(50) NULL,
        Description NVARCHAR(200) NULL,
        SubmittedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Referral__E33C702C12167C3B PRIMARY KEY (ProofID)
    );
    PRINT 'Created table ReferralProofs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__ReferralP__Refer__19AACF41')
BEGIN
    ALTER TABLE ReferralProofs ADD CONSTRAINT FK__ReferralP__Refer__19AACF41
        FOREIGN KEY (ReferrerID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__ReferralP__Reque__18B6AB08')
BEGIN
    ALTER TABLE ReferralProofs ADD CONSTRAINT FK__ReferralP__Reque__18B6AB08
        FOREIGN KEY (RequestID) REFERENCES ReferralRequests(RequestID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralProofs_Referrer_SubmittedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralProofs_Referrer_SubmittedAt ON ReferralProofs(RequestID, ReferrerID, SubmittedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralProofs_Request')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralProofs_Request ON ReferralProofs(ReferrerID, SubmittedAt, RequestID);
END
GO

-- ============================================================
-- Table: ReferralRequestStatusHistory
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralRequestStatusHistory')
BEGIN
    CREATE TABLE ReferralRequestStatusHistory (
        HistoryID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        RequestID UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(50) NOT NULL,
        StatusMessage NVARCHAR(500) NULL,
        ActorID UNIQUEIDENTIFIER NULL,
        ActorType NVARCHAR(20) NULL,
        ActorName NVARCHAR(200) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Referral__4D7B4ADD07A04591 PRIMARY KEY (HistoryID)
    );
    PRINT 'Created table ReferralRequestStatusHistory';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__ReferralR__Reque__1C3EEBA1')
BEGIN
    ALTER TABLE ReferralRequestStatusHistory ADD CONSTRAINT FK__ReferralR__Reque__1C3EEBA1
        FOREIGN KEY (RequestID) REFERENCES ReferralRequests(RequestID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralStatusHistory_ActorID_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralStatusHistory_ActorID_CreatedAt ON ReferralRequestStatusHistory(RequestID, Status, ActorID, CreatedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralStatusHistory_RequestID_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralStatusHistory_RequestID_CreatedAt ON ReferralRequestStatusHistory(Status, StatusMessage, ActorName, ActorType, RequestID, CreatedAt);
END
GO

-- ============================================================
-- Table: ReferralRequests
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralRequests')
BEGIN
    CREATE TABLE ReferralRequests (
        RequestID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        JobID UNIQUEIDENTIFIER NULL,
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ResumeID UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(50) NULL DEFAULT ('Pending'),
        RequestedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        AssignedReferrerID UNIQUEIDENTIFIER NULL,
        ReferredAt DATETIME2(7) NULL,
        VerifiedByApplicant BIT NULL DEFAULT ((0)),
        ExtJobID NVARCHAR(100) NULL,
        ReferralMessage NVARCHAR(1000) NULL,
        OrganizationID INT NULL,
        JobTitle NVARCHAR(200) NULL,
        JobURL NVARCHAR(500) NULL,
        OpenToAnyCompany BIT NULL DEFAULT ((0)),
        MinSalary DECIMAL(12,2) NULL,
        SalaryCurrency NVARCHAR(10) NULL DEFAULT ('INR'),
        SalaryPeriod NVARCHAR(20) NULL DEFAULT ('Annual'),
        CONSTRAINT PK__Referral__33A8519A5B6D3FB8 PRIMARY KEY (RequestID)
    );
    PRINT 'Created table ReferralRequests';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__ReferralR__JobID__10216507')
BEGIN
    ALTER TABLE ReferralRequests ADD CONSTRAINT FK__ReferralR__JobID__10216507
        FOREIGN KEY (JobID) REFERENCES Jobs(JobID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__ReferralR__Organ__13F1F5EB')
BEGIN
    ALTER TABLE ReferralRequests ADD CONSTRAINT FK__ReferralR__Organ__13F1F5EB
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__ReferralR__Resum__1209AD79')
BEGIN
    ALTER TABLE ReferralRequests ADD CONSTRAINT FK__ReferralR__Resum__1209AD79
        FOREIGN KEY (ResumeID) REFERENCES ApplicantResumes(ResumeID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ReferralRequests_AssignedReferrerUserID')
BEGIN
    ALTER TABLE ReferralRequests ADD CONSTRAINT FK_ReferralRequests_AssignedReferrerUserID
        FOREIGN KEY (AssignedReferrerID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRequests_Applicant_Status_RequestedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRequests_Applicant_Status_RequestedAt ON ReferralRequests(JobID, AssignedReferrerID, ReferredAt, ApplicantID, Status, RequestedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRequests_AssignedReferrer_Status_RequestedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRequests_AssignedReferrer_Status_RequestedAt ON ReferralRequests(JobID, ApplicantID, ReferredAt, AssignedReferrerID, Status, RequestedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRequests_Job_Status_RequestedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRequests_Job_Status_RequestedAt ON ReferralRequests(ApplicantID, AssignedReferrerID, ReferredAt, JobID, Status, RequestedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRequests_JobTitle')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRequests_JobTitle ON ReferralRequests(JobTitle) WHERE ([JobTitle] IS NOT NULL);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRequests_OrganizationID_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRequests_OrganizationID_Status ON ReferralRequests(JobID, ExtJobID, ApplicantID, RequestedAt, OrganizationID, Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRequests_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRequests_Status ON ReferralRequests(Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_Referral_Active')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_Referral_Active ON ReferralRequests(JobID, ExtJobID, ApplicantID) WHERE Status <> 'Cancelled' AND Status <> 'Expired';
END
GO

-- ============================================================
-- Table: ReferralRewards
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralRewards')
BEGIN
    CREATE TABLE ReferralRewards (
        RewardID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ReferrerID UNIQUEIDENTIFIER NOT NULL,
        RequestID UNIQUEIDENTIFIER NOT NULL,
        PointsEarned INT NOT NULL DEFAULT ((10)),
        PointsType NVARCHAR(50) NULL DEFAULT ('Referral'),
        AwardedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Referral__82501599770EE2AD PRIMARY KEY (RewardID)
    );
    PRINT 'Created table ReferralRewards';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__ReferralR__Refer__2057CCD0')
BEGIN
    ALTER TABLE ReferralRewards ADD CONSTRAINT FK__ReferralR__Refer__2057CCD0
        FOREIGN KEY (ReferrerID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__ReferralR__Reque__214BF109')
BEGIN
    ALTER TABLE ReferralRewards ADD CONSTRAINT FK__ReferralR__Reque__214BF109
        FOREIGN KEY (RequestID) REFERENCES ReferralRequests(RequestID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRewards_PointsType')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRewards_PointsType ON ReferralRewards(ReferrerID, PointsEarned, AwardedAt, PointsType);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRewards_Referrer_AwardedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRewards_Referrer_AwardedAt ON ReferralRewards(RequestID, PointsEarned, PointsType, ReferrerID, AwardedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRewards_Request')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRewards_Request ON ReferralRewards(ReferrerID, PointsEarned, AwardedAt, RequestID);
END
GO

-- ============================================================
-- Table: ReferrerStats
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferrerStats')
BEGIN
    CREATE TABLE ReferrerStats (
        ReferrerID UNIQUEIDENTIFIER NOT NULL,
        PendingCount INT NULL DEFAULT ((0)),
        LastUpdated DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Referrer__4E3C4A4099E688DE PRIMARY KEY (ReferrerID)
    );
    PRINT 'Created table ReferrerStats';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__ReferrerS__Refer__2610A626')
BEGIN
    ALTER TABLE ReferrerStats ADD CONSTRAINT FK__ReferrerS__Refer__2610A626
        FOREIGN KEY (ReferrerID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferrerStats_PendingCount')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferrerStats_PendingCount ON ReferrerStats(LastUpdated, PendingCount);
END
GO

-- ============================================================
-- Table: SalaryComponents
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SalaryComponents')
BEGIN
    CREATE TABLE SalaryComponents (
        ComponentID INT NOT NULL IDENTITY(1,1),
        ComponentName NVARCHAR(100) NOT NULL,
        ComponentType NVARCHAR(50) NOT NULL,
        IsActive BIT NULL,
        CONSTRAINT PK__SalaryCo__D79CF02E429C9E87 PRIMARY KEY (ComponentID)
    );
    PRINT 'Created table SalaryComponents';
END
GO


-- ============================================================
-- Table: SavedJobs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SavedJobs')
BEGIN
    CREATE TABLE SavedJobs (
        SavedJobID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        JobID UNIQUEIDENTIFIER NOT NULL,
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        SavedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        CONSTRAINT PK__SavedJob__B7E5F3777E5D4551 PRIMARY KEY (SavedJobID)
    );
    PRINT 'Created table SavedJobs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__SavedJobs__Appli__7849DB76')
BEGIN
    ALTER TABLE SavedJobs ADD CONSTRAINT FK__SavedJobs__Appli__7849DB76
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__SavedJobs__JobID__7755B73D')
BEGIN
    ALTER TABLE SavedJobs ADD CONSTRAINT FK__SavedJobs__JobID__7755B73D
        FOREIGN KEY (JobID) REFERENCES Jobs(JobID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_SavedJobs_Applicant')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_SavedJobs_Applicant ON SavedJobs(ApplicantID, SavedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedJobs_JobID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SavedJobs_JobID ON SavedJobs(ApplicantID, SavedAt, JobID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_SavedJobs')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_SavedJobs ON SavedJobs(JobID, ApplicantID);
END
GO

-- ============================================================
-- Table: ScrapingLogs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ScrapingLogs')
BEGIN
    CREATE TABLE ScrapingLogs (
        LogID INT NOT NULL IDENTITY(1,1),
        RunId NVARCHAR(50) NOT NULL,
        StartTime DATETIME2(7) NOT NULL,
        EndTime DATETIME2(7) NOT NULL,
        Success BIT NOT NULL,
        JobsAdded INT NOT NULL DEFAULT ((0)),
        IndiaJobs INT NOT NULL DEFAULT ((0)),
        TotalScraped INT NOT NULL DEFAULT ((0)),
        Sources NVARCHAR(500) NULL,
        ErrorCount INT NOT NULL DEFAULT ((0)),
        Errors NVARCHAR(2000) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        TriggerType NVARCHAR(50) NOT NULL DEFAULT ('Manual'),
        WasPastDue BIT NOT NULL DEFAULT ((0)),
        OrgsEnriched INT NOT NULL DEFAULT ((0)),
        OrgsEnrichmentErrors INT NOT NULL DEFAULT ((0)),
        CONSTRAINT PK__Scraping__5E5499A8DE08EB3A PRIMARY KEY (LogID)
    );
    PRINT 'Created table ScrapingLogs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ScrapingLogs_TriggerType_StartTime')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ScrapingLogs_TriggerType_StartTime ON ScrapingLogs(Success, JobsAdded, TotalScraped, TriggerType, StartTime);
END
GO

-- ============================================================
-- Table: SupportMessages
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportMessages')
BEGIN
    CREATE TABLE SupportMessages (
        MessageID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        TicketID UNIQUEIDENTIFIER NOT NULL,
        SenderID UNIQUEIDENTIFIER NOT NULL,
        SenderType NVARCHAR(10) NOT NULL,
        Message NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        IsDeleted BIT NOT NULL DEFAULT ((0)),
        CONSTRAINT PK_SupportMessages PRIMARY KEY (MessageID)
    );
    PRINT 'Created table SupportMessages';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SupportMessages_Sender')
BEGIN
    ALTER TABLE SupportMessages ADD CONSTRAINT FK_SupportMessages_Sender
        FOREIGN KEY (SenderID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SupportMessages_Ticket')
BEGIN
    ALTER TABLE SupportMessages ADD CONSTRAINT FK_SupportMessages_Ticket
        FOREIGN KEY (TicketID) REFERENCES SupportTickets(TicketID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SupportMessages_TicketID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SupportMessages_TicketID ON SupportMessages(TicketID, CreatedAt);
END
GO

-- ============================================================
-- Table: SupportTickets
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE SupportTickets (
        TicketID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        Category NVARCHAR(50) NOT NULL DEFAULT ('General'),
        Subject NVARCHAR(200) NOT NULL,
        Message NVARCHAR(MAX) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT ('Open'),
        Priority NVARCHAR(20) NOT NULL DEFAULT ('Medium'),
        AdminResponse NVARCHAR(MAX) NULL,
        AdminUserID UNIQUEIDENTIFIER NULL,
        ContactEmail NVARCHAR(256) NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        ResolvedAt DATETIME2(7) NULL,
        IsDeleted BIT NOT NULL DEFAULT ((0)),
        CONSTRAINT PK_SupportTickets PRIMARY KEY (TicketID)
    );
    PRINT 'Created table SupportTickets';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SupportTickets_AdminUser')
BEGIN
    ALTER TABLE SupportTickets ADD CONSTRAINT FK_SupportTickets_AdminUser
        FOREIGN KEY (AdminUserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SupportTickets_User')
BEGIN
    ALTER TABLE SupportTickets ADD CONSTRAINT FK_SupportTickets_User
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SupportTickets_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SupportTickets_CreatedAt ON SupportTickets(CreatedAt) WHERE ([IsDeleted]=(0));
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SupportTickets_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SupportTickets_Status ON SupportTickets(UserID, Subject, Category, Priority, Status, CreatedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SupportTickets_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SupportTickets_UserID ON SupportTickets(Status, CreatedAt, Subject, UserID);
END
GO

-- ============================================================
-- Table: UserProfileViews
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserProfileViews')
BEGIN
    CREATE TABLE UserProfileViews (
        ViewID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ViewerUserID UNIQUEIDENTIFIER NOT NULL,
        ViewedUserID UNIQUEIDENTIFIER NOT NULL,
        ViewedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        DeviceType NVARCHAR(50) NULL,
        CONSTRAINT PK__UserProf__1E371C16E82D925F PRIMARY KEY (ViewID)
    );
    PRINT 'Created table UserProfileViews';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__UserProfi__Viewe__226AFDCB')
BEGIN
    ALTER TABLE UserProfileViews ADD CONSTRAINT FK__UserProfi__Viewe__226AFDCB
        FOREIGN KEY (ViewerUserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__UserProfi__Viewe__235F2204')
BEGIN
    ALTER TABLE UserProfileViews ADD CONSTRAINT FK__UserProfi__Viewe__235F2204
        FOREIGN KEY (ViewedUserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ProfileViews_ViewedUser_Date')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ProfileViews_ViewedUser_Date ON UserProfileViews(ViewerUserID, DeviceType, ViewedUserID, ViewedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ProfileViews_Viewer')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ProfileViews_Viewer ON UserProfileViews(ViewerUserID, ViewedAt);
END
GO

-- ============================================================
-- Table: Users
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        UserID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        GoogleId NVARCHAR(100) NULL,
        Email NVARCHAR(320) NOT NULL,
        Password NVARCHAR(255) NOT NULL,
        LoginMethod NVARCHAR(50) NULL DEFAULT ('Password'),
        GoogleAccessToken NVARCHAR(MAX) NULL,
        UserType NVARCHAR(50) NOT NULL,
        FirstName NVARCHAR(100) NOT NULL,
        LastName NVARCHAR(100) NOT NULL,
        Phone NVARCHAR(20) NULL,
        ProfilePictureURL NVARCHAR(1000) NULL,
        DateOfBirth DATE NULL,
        Gender NVARCHAR(50) NULL,
        EmailVerified BIT NULL DEFAULT ((0)),
        PhoneVerified BIT NULL DEFAULT ((0)),
        LastLoginAt DATETIME2(7) NULL,
        LastActive DATETIME2(7) NULL,
        ProfileVisibility NVARCHAR(50) NULL DEFAULT ('Public'),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        IsActive BIT NULL DEFAULT ((1)),
        TwoFactorEnabled BIT NULL DEFAULT ((0)),
        LoginAttempts INT NULL DEFAULT ((0)),
        AccountLockoutEnd DATETIME2(7) NULL,
        ReferredBy UNIQUEIDENTIFIER NULL,
        WalletBonusGiven BIT NULL DEFAULT ((0)),
        IsVerifiedReferrer BIT NOT NULL DEFAULT ((0)),
        IsVerifiedUser BIT NOT NULL DEFAULT ((0)),
        PasswordResetToken NVARCHAR(255) NULL,
        PasswordResetExpires DATETIME2(7) NULL,
        TermsAcceptedAt DATETIME2(7) NULL,
        TermsVersion NVARCHAR(20) NULL,
        PrivacyPolicyAcceptedAt DATETIME2(7) NULL,
        PrivacyPolicyVersion NVARCHAR(20) NULL,
        CONSTRAINT PK__Users__1788CCACBE5F9458 PRIMARY KEY (UserID)
    );
    PRINT 'Created table Users';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Users_ReferredBy')
BEGIN
    ALTER TABLE Users ADD CONSTRAINT FK_Users_ReferredBy
        FOREIGN KEY (ReferredBy) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_Email_IsActive')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_Email_IsActive ON Users(UserID, Password, UserType, FirstName, LastName, Email, IsActive);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_GoogleId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_GoogleId ON Users(GoogleId) WHERE ([GoogleId] IS NOT NULL);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_IsVerifiedReferrer')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_IsVerifiedReferrer ON Users(IsVerifiedReferrer);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_LastActive')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_LastActive ON Users(UserID, UserType, EmailVerified, LastActive);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_ReferredBy')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_ReferredBy ON Users(ReferredBy) WHERE ([ReferredBy] IS NOT NULL);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ__Users__A9D105340A8BEECC')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ__Users__A9D105340A8BEECC ON Users(Email);
END
GO

-- ============================================================
-- Table: WalletRechargeOrders
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletRechargeOrders')
BEGIN
    CREATE TABLE WalletRechargeOrders (
        OrderID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        WalletID UNIQUEIDENTIFIER NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        Amount DECIMAL(15, 2) NOT NULL,
        CurrencyID INT NOT NULL,
        Status NVARCHAR(50) NULL DEFAULT ('Pending'),
        PaymentGateway NVARCHAR(50) NOT NULL DEFAULT ('Razorpay'),
        RazorpayOrderID NVARCHAR(200) NULL,
        RazorpayPaymentID NVARCHAR(200) NULL,
        RazorpaySignature NVARCHAR(500) NULL,
        Receipt NVARCHAR(100) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        PaidAt DATETIME2(7) NULL,
        ExpiresAt DATETIME2(7) NULL,
        ErrorMessage NVARCHAR(500) NULL,
        PackID INT NULL,
        PromoCode NVARCHAR(50) NULL,
        BonusCredited DECIMAL(10, 2) NOT NULL DEFAULT (0),
        CONSTRAINT PK__WalletRe__C3905BAFB01DEEF2 PRIMARY KEY (OrderID)
    );
    PRINT 'Created table WalletRechargeOrders';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WalletRec__Curre__66EA454A')
BEGIN
    ALTER TABLE WalletRechargeOrders ADD CONSTRAINT FK__WalletRec__Curre__66EA454A
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WalletRec__UserI__65F62111')
BEGIN
    ALTER TABLE WalletRechargeOrders ADD CONSTRAINT FK__WalletRec__UserI__65F62111
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WalletRec__Walle__6501FCD8')
BEGIN
    ALTER TABLE WalletRechargeOrders ADD CONSTRAINT FK__WalletRec__Walle__6501FCD8
        FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletRechargeOrders_RazorpayOrderID')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_WalletRechargeOrders_RazorpayOrderID ON WalletRechargeOrders(RazorpayOrderID) WHERE ([RazorpayOrderID] IS NOT NULL);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletRechargeOrders_UserID_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletRechargeOrders_UserID_CreatedAt ON WalletRechargeOrders(OrderID, Amount, Status, UserID, CreatedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletRechargeOrders_WalletID_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletRechargeOrders_WalletID_Status ON WalletRechargeOrders(Amount, CreatedAt, PaidAt, WalletID, Status);
END
GO

-- ============================================================
-- Table: WalletTransactions
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletTransactions')
BEGIN
    CREATE TABLE WalletTransactions (
        TransactionID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        WalletID UNIQUEIDENTIFIER NOT NULL,
        TransactionType NVARCHAR(20) NOT NULL,
        Amount DECIMAL(15, 2) NOT NULL,
        BalanceBefore DECIMAL(15, 2) NOT NULL,
        BalanceAfter DECIMAL(15, 2) NOT NULL,
        CurrencyID INT NOT NULL,
        Source NVARCHAR(50) NOT NULL,
        PaymentReference NVARCHAR(200) NULL,
        Description NVARCHAR(500) NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT ('Completed'),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__WalletTr__55433A4BFF37FADF PRIMARY KEY (TransactionID)
    );
    PRINT 'Created table WalletTransactions';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WalletTra__Curre__5D60DB10')
BEGIN
    ALTER TABLE WalletTransactions ADD CONSTRAINT FK__WalletTra__Curre__5D60DB10
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WalletTra__Walle__5C6CB6D7')
BEGIN
    ALTER TABLE WalletTransactions ADD CONSTRAINT FK__WalletTra__Walle__5C6CB6D7
        FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletTransactions_PaymentReference')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletTransactions_PaymentReference ON WalletTransactions(PaymentReference) WHERE ([PaymentReference] IS NOT NULL);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletTransactions_Source_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletTransactions_Source_Status ON WalletTransactions(WalletID, Amount, CreatedAt, Source, Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletTransactions_WalletID_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletTransactions_WalletID_CreatedAt ON WalletTransactions(TransactionType, Amount, Source, Status, Description, WalletID, CreatedAt);
END
GO

-- ============================================================
-- Table: WalletWithdrawals
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletWithdrawals')
BEGIN
    CREATE TABLE WalletWithdrawals (
        WithdrawalID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        WalletID UNIQUEIDENTIFIER NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        Amount DECIMAL(15, 2) NOT NULL,
        CurrencyID INT NOT NULL,
        BankAccountNumber NVARCHAR(50) NULL,
        BankIFSC NVARCHAR(20) NULL,
        BankAccountName NVARCHAR(200) NULL,
        UPI_ID NVARCHAR(100) NULL,
        Status NVARCHAR(50) NULL DEFAULT ('Pending'),
        RequestedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        ProcessedAt DATETIME2(7) NULL,
        ProcessedBy UNIQUEIDENTIFIER NULL,
        PaymentReference NVARCHAR(200) NULL,
        RejectionReason NVARCHAR(500) NULL,
        ProcessingFee DECIMAL(18, 2) NULL DEFAULT ((0)),
        NetAmount DECIMAL(18, 2) NULL DEFAULT ((0)),
        CONSTRAINT PK__WalletWi__7C842C4EC682EA5B PRIMARY KEY (WithdrawalID)
    );
    PRINT 'Created table WalletWithdrawals';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WalletWit__Curre__6F7F8B4B')
BEGIN
    ALTER TABLE WalletWithdrawals ADD CONSTRAINT FK__WalletWit__Curre__6F7F8B4B
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WalletWit__Proce__7073AF84')
BEGIN
    ALTER TABLE WalletWithdrawals ADD CONSTRAINT FK__WalletWit__Proce__7073AF84
        FOREIGN KEY (ProcessedBy) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WalletWit__UserI__6E8B6712')
BEGIN
    ALTER TABLE WalletWithdrawals ADD CONSTRAINT FK__WalletWit__UserI__6E8B6712
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WalletWit__Walle__6D9742D9')
BEGIN
    ALTER TABLE WalletWithdrawals ADD CONSTRAINT FK__WalletWit__Walle__6D9742D9
        FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletWithdrawals_Status_RequestedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletWithdrawals_Status_RequestedAt ON WalletWithdrawals(WithdrawalID, WalletID, UserID, Amount, Status, RequestedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletWithdrawals_WalletID_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletWithdrawals_WalletID_Status ON WalletWithdrawals(Amount, RequestedAt, WalletID, Status);
END
GO

-- ============================================================
-- Table: Wallets
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Wallets')
BEGIN
    CREATE TABLE Wallets (
        WalletID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        Balance DECIMAL(15, 2) NOT NULL DEFAULT ((0.00)),
        CurrencyID INT NOT NULL DEFAULT ((4)),
        Status NVARCHAR(20) NOT NULL DEFAULT ('Active'),
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        LastTransactionAt DATETIME2(7) NULL,
        CONSTRAINT PK__Wallets__84D4F92E9E13D32B PRIMARY KEY (WalletID)
    );
    PRINT 'Created table Wallets';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Wallets__Currenc__55BFB948')
BEGIN
    ALTER TABLE Wallets ADD CONSTRAINT FK__Wallets__Currenc__55BFB948
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__Wallets__UserID__54CB950F')
BEGIN
    ALTER TABLE Wallets ADD CONSTRAINT FK__Wallets__UserID__54CB950F
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Wallets_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Wallets_Status ON Wallets(WalletID, UserID, Balance, Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Wallets_UserID')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Wallets_UserID ON Wallets(WalletID, Balance, Status, UserID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ__Wallets__1788CCAD9A6B89EE')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ__Wallets__1788CCAD9A6B89EE ON Wallets(UserID);
END
GO

-- ============================================================
-- Table: WorkExperiences
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkExperiences')
BEGIN
    CREATE TABLE WorkExperiences (
        WorkExperienceID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        OrganizationID INT NULL,
        CompanyName NVARCHAR(200) NULL,
        JobTitle NVARCHAR(200) NOT NULL,
        Department NVARCHAR(100) NULL,
        EmploymentType NVARCHAR(50) NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NULL,
        IsCurrent BIT NULL,
        Location NVARCHAR(200) NULL,
        Country NVARCHAR(100) NULL,
        Description NTEXT NULL,
        Skills NVARCHAR(MAX) NULL,
        Achievements NTEXT NULL,
        Salary DECIMAL(15, 2) NULL,
        CurrencyID INT NULL,
        SalaryFrequency NVARCHAR(50) NULL,
        ManagerName NVARCHAR(200) NULL,
        ManagerContact NVARCHAR(200) NULL,
        CanContact BIT NULL DEFAULT ((0)),
        VerificationStatus TINYINT NULL DEFAULT ((0)),
        VerifiedAt DATETIME2(7) NULL,
        CreatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        IsActive BIT NULL DEFAULT ((1)),
        CompanyEmail NVARCHAR(255) NULL,
        CompanyEmailVerified BIT NOT NULL DEFAULT ((0)),
        CompanyEmailVerifiedAt DATETIME2(7) NULL,
        CONSTRAINT PK__WorkExpe__55A2B8A9D53ED8DA PRIMARY KEY (WorkExperienceID)
    );
    PRINT 'Created table WorkExperiences';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WorkExper__Appli__1CBC4616')
BEGIN
    ALTER TABLE WorkExperiences ADD CONSTRAINT FK__WorkExper__Appli__1CBC4616
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WorkExper__Curre__1EA48E88')
BEGIN
    ALTER TABLE WorkExperiences ADD CONSTRAINT FK__WorkExper__Curre__1EA48E88
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__WorkExper__Organ__1DB06A4F')
BEGIN
    ALTER TABLE WorkExperiences ADD CONSTRAINT FK__WorkExper__Organ__1DB06A4F
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkExperiences_ApplicantID_Active_Recent')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WorkExperiences_ApplicantID_Active_Recent ON WorkExperiences(JobTitle, ApplicantID, IsActive, EndDate, StartDate);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkExperiences_ApplicantID_IsCurrent')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WorkExperiences_ApplicantID_IsCurrent ON WorkExperiences(OrganizationID, JobTitle, StartDate, ApplicantID, IsCurrent);
END
GO

-- ============================================================
-- Table: WorkplaceTypes
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkplaceTypes')
BEGIN
    CREATE TABLE WorkplaceTypes (
        WorkplaceTypeID INT NOT NULL IDENTITY(1,1),
        Type NVARCHAR(50) NOT NULL,
        Description NVARCHAR(200) NULL,
        IsActive BIT NULL DEFAULT ((1)),
        CreatedAt DATETIMEOFFSET NULL DEFAULT (sysdatetimeoffset()),
        CONSTRAINT PK__Workplac__99CB0CD704B9AF4C PRIMARY KEY (WorkplaceTypeID)
    );
    PRINT 'Created table WorkplaceTypes';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_WorkplaceTypes_Type')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_WorkplaceTypes_Type ON WorkplaceTypes(Type);
END
GO

-- ============================================================
-- Table: ResumeMetadata
-- Stores metadata and analysis history for Resume Analyzer feature
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumeMetadata')
BEGIN
    CREATE TABLE ResumeMetadata (
        ResumeMetadataID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NULL,
        FileName NVARCHAR(500) NULL,
        FileSizeBytes INT NULL,
        FullName NVARCHAR(200) NULL,
        Email NVARCHAR(255) NULL,
        Mobile NVARCHAR(50) NULL,
        Skills NVARCHAR(MAX) NULL,
        ParsedText NVARCHAR(MAX) NULL,
        LastJobUrl NVARCHAR(2000) NULL,
        LastJobId UNIQUEIDENTIFIER NULL,
        LastMatchScore INT NULL,
        AnalysisCount INT NULL DEFAULT ((1)),
        AIModel NVARCHAR(100) NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        LastAnalyzedAt DATETIME2(7) NULL DEFAULT (getutcdate()),
        CONSTRAINT PK_ResumeMetadata PRIMARY KEY (ResumeMetadataID)
    );
    PRINT 'Created table ResumeMetadata';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ResumeMetadata_UserID')
BEGIN
    ALTER TABLE ResumeMetadata ADD CONSTRAINT FK_ResumeMetadata_UserID
        FOREIGN KEY (UserID) REFERENCES Users(UserID);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ResumeMetadata_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ResumeMetadata_UserID ON ResumeMetadata(UserID);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ResumeMetadata_Email')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ResumeMetadata_Email ON ResumeMetadata(Email);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ResumeMetadata_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ResumeMetadata_CreatedAt ON ResumeMetadata(CreatedAt DESC);
END
GO

-- ============================================================
-- Table: ReferralExpirationLogs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralExpirationLogs')
BEGIN
    CREATE TABLE ReferralExpirationLogs (
        LogID INT NOT NULL IDENTITY(1,1),
        ExecutionID NVARCHAR(100) NOT NULL,
        StartTime DATETIME2(7) NOT NULL,
        EndTime DATETIME2(7) NOT NULL,
        TriggerType NVARCHAR(50) NOT NULL,
        TotalPendingFound INT NOT NULL DEFAULT (0),
        TotalExpired INT NOT NULL DEFAULT (0),
        TotalHoldsReleased INT NOT NULL DEFAULT (0),
        TotalAmountReleased DECIMAL(18, 2) NOT NULL DEFAULT (0),
        Success BIT NOT NULL DEFAULT (1),
        ErrorCount INT NOT NULL DEFAULT (0),
        Errors NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__Referral__5E5499A814ED373F PRIMARY KEY (LogID)
    );
    PRINT 'Created table ReferralExpirationLogs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralExpirationLogs_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralExpirationLogs_CreatedAt ON ReferralExpirationLogs(CreatedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralExpirationLogs_ExecutionID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralExpirationLogs_ExecutionID ON ReferralExpirationLogs(ExecutionID);
END
GO

-- ============================================================
-- Table: SocialShareClaims
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SocialShareClaims')
BEGIN
    CREATE TABLE SocialShareClaims (
        ClaimID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        Platform NVARCHAR(30) NOT NULL,
        PostURL NVARCHAR(1000) NULL,
        ScreenshotURL NVARCHAR(1000) NULL,
        PostContent NVARCHAR(MAX) NULL,
        RewardAmount DECIMAL(10, 2) NOT NULL,
        BonusAmount DECIMAL(10, 2) NULL DEFAULT (0),
        Status NVARCHAR(30) NOT NULL DEFAULT ('Pending'),
        RejectionReason NVARCHAR(500) NULL,
        ReviewedBy UNIQUEIDENTIFIER NULL,
        ReviewedAt DATETIME NULL,
        PostStillLive BIT NULL DEFAULT (1),
        CreatedAt DATETIME NOT NULL DEFAULT (getutcdate()),
        UpdatedAt DATETIME NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT PK__SocialSh__EF2E13BBCE418DCB PRIMARY KEY (ClaimID)
    );
    PRINT 'Created table SocialShareClaims';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SocialShareClaims_User')
BEGIN
    ALTER TABLE SocialShareClaims ADD CONSTRAINT FK_SocialShareClaims_User
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SocialShareClaims_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SocialShareClaims_UserID ON SocialShareClaims(UserID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SocialShareClaims_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SocialShareClaims_Status ON SocialShareClaims(Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SocialShareClaims_Platform')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SocialShareClaims_Platform ON SocialShareClaims(Platform);
END
GO

-- ============================================================
-- Table: UserActivityLogs
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserActivityLogs')
BEGIN
    CREATE TABLE UserActivityLogs (
        ActivityID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        SessionID NVARCHAR(100) NULL,
        ScreenName NVARCHAR(100) NOT NULL,
        Action NVARCHAR(50) NOT NULL DEFAULT ('view'),
        ActionDetails NVARCHAR(500) NULL,
        Platform NVARCHAR(20) NULL,
        DeviceType NVARCHAR(50) NULL,
        Browser NVARCHAR(100) NULL,
        EnteredAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        ExitedAt DATETIME2(7) NULL,
        DurationSeconds INT NULL,
        ClientIP NVARCHAR(45) NULL,
        UserAgent NVARCHAR(500) NULL,
        ReferrerScreen NVARCHAR(100) NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT PK_UserActivityLogs PRIMARY KEY (ActivityID)
    );
    PRINT 'Created table UserActivityLogs';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_UserActivityLogs_Users')
BEGIN
    ALTER TABLE UserActivityLogs ADD CONSTRAINT FK_UserActivityLogs_Users
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserActivityLogs_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserActivityLogs_UserID ON UserActivityLogs(UserID, EnteredAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserActivityLogs_ScreenName')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserActivityLogs_ScreenName ON UserActivityLogs(ScreenName, EnteredAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserActivityLogs_SessionID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserActivityLogs_SessionID ON UserActivityLogs(SessionID, EnteredAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserActivityLogs_EnteredAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserActivityLogs_EnteredAt ON UserActivityLogs(EnteredAt);
END
GO

-- ============================================================
-- Table: UserConsentLog
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserConsentLog')
BEGIN
    CREATE TABLE UserConsentLog (
        ConsentLogID INT NOT NULL IDENTITY(1,1),
        UserID UNIQUEIDENTIFIER NOT NULL,
        ConsentType NVARCHAR(50) NOT NULL,
        Version NVARCHAR(20) NOT NULL,
        AcceptedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        IPAddress NVARCHAR(45) NULL,
        UserAgent NVARCHAR(500) NULL,
        CONSTRAINT PK_UserConsentLog PRIMARY KEY (ConsentLogID)
    );
    PRINT 'Created table UserConsentLog';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_UserConsentLog_Users')
BEGIN
    ALTER TABLE UserConsentLog ADD CONSTRAINT FK_UserConsentLog_Users
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserConsentLog_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserConsentLog_UserID ON UserConsentLog(UserID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserConsentLog_ConsentType')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserConsentLog_ConsentType ON UserConsentLog(UserID, ConsentType, Version);
END
GO

-- ============================================================
-- Table: UserSessions
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserSessions')
BEGIN
    CREATE TABLE UserSessions (
        SessionID NVARCHAR(100) NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        StartedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        LastActivityAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        EndedAt DATETIME2(7) NULL,
        Platform NVARCHAR(20) NULL,
        DeviceType NVARCHAR(50) NULL,
        Browser NVARCHAR(100) NULL,
        ClientIP NVARCHAR(45) NULL,
        ScreensVisited INT NULL DEFAULT (0),
        TotalDurationSeconds INT NULL,
        IsActive BIT NOT NULL DEFAULT (1),
        CONSTRAINT PK_UserSessions PRIMARY KEY (SessionID)
    );
    PRINT 'Created table UserSessions';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_UserSessions_Users')
BEGIN
    ALTER TABLE UserSessions ADD CONSTRAINT FK_UserSessions_Users
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserSessions_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserSessions_UserID ON UserSessions(UserID, StartedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserSessions_LastActivityAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserSessions_LastActivityAt ON UserSessions(LastActivityAt);
END
GO

-- ============================================================
-- Table: WalletHolds
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletHolds')
BEGIN
    CREATE TABLE WalletHolds (
        HoldID UNIQUEIDENTIFIER NOT NULL DEFAULT (newid()),
        WalletID UNIQUEIDENTIFIER NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        ReferralRequestID UNIQUEIDENTIFIER NOT NULL,
        Amount DECIMAL(15, 2) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT ('Active'),
        Description NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (getutcdate()),
        ConvertedAt DATETIME2(7) NULL,
        ReleasedAt DATETIME2(7) NULL,
        CONSTRAINT PK_WalletHolds PRIMARY KEY (HoldID)
    );
    PRINT 'Created table WalletHolds';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletHolds_WalletID')
BEGIN
    ALTER TABLE WalletHolds ADD CONSTRAINT FK_WalletHolds_WalletID
        FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletHolds_UserID')
BEGIN
    ALTER TABLE WalletHolds ADD CONSTRAINT FK_WalletHolds_UserID
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletHolds_ReferralRequestID')
BEGIN
    ALTER TABLE WalletHolds ADD CONSTRAINT FK_WalletHolds_ReferralRequestID
        FOREIGN KEY (ReferralRequestID) REFERENCES ReferralRequests(RequestID)
;
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_WalletStatus')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletHolds_WalletStatus ON WalletHolds(Amount, WalletID, Status);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_UserStatus')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletHolds_UserStatus ON WalletHolds(Amount, ReferralRequestID, UserID, Status, CreatedAt);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_RequestID')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_WalletHolds_RequestID ON WalletHolds(HoldID, Amount, Status, ReferralRequestID);
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WalletHolds_ActiveExpired')
BEGIN
    CREATE NONCLUSTERED INDEX IX_WalletHolds_ActiveExpired ON WalletHolds(Status, CreatedAt) WHERE ([Status]='Active');
END
GO

-- ============================================================
-- Table: WalletBonusPacks
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletBonusPacks')
BEGIN
    CREATE TABLE WalletBonusPacks (
        PackID INT IDENTITY(1,1) NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        PayAmount DECIMAL(10, 2) NOT NULL,
        GetAmount DECIMAL(10, 2) NOT NULL,
        BonusAmount AS (GetAmount - PayAmount) PERSISTED,
        BonusPercent AS (CASE WHEN PayAmount > 0 THEN ROUND(((GetAmount - PayAmount) / PayAmount) * 100, 0) ELSE 0 END) PERSISTED,
        ReferralsWorth INT NOT NULL DEFAULT (0),
        Badge NVARCHAR(50) NULL,
        IsActive BIT NOT NULL DEFAULT (1),
        SortOrder INT NOT NULL DEFAULT (0),
        CreatedAt DATETIME NOT NULL DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_WalletBonusPacks PRIMARY KEY (PackID)
    );
    PRINT 'Created table WalletBonusPacks';
END
GO

-- ============================================================
-- Table: PromoCodes
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PromoCodes')
BEGIN
    CREATE TABLE PromoCodes (
        CodeID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        Code NVARCHAR(50) NOT NULL,
        Type NVARCHAR(20) NOT NULL DEFAULT ('FLAT_BONUS'),
        Value DECIMAL(10, 2) NOT NULL DEFAULT (0),
        MinRechargeAmount DECIMAL(10, 2) NOT NULL DEFAULT (0),
        MaxBonusAmount DECIMAL(10, 2) NULL,
        MaxUses INT NULL,
        CurrentUses INT NOT NULL DEFAULT (0),
        PerUserLimit INT NOT NULL DEFAULT (1),
        ExpiresAt DATETIME NULL,
        IsActive BIT NOT NULL DEFAULT (1),
        Description NVARCHAR(200) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_PromoCodes PRIMARY KEY (CodeID),
        CONSTRAINT UQ_PromoCodes_Code UNIQUE (Code)
    );
    PRINT 'Created table PromoCodes';
END
GO

-- ============================================================
-- Table: PromoCodeUsages
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PromoCodeUsages')
BEGIN
    CREATE TABLE PromoCodeUsages (
        UsageID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        CodeID UNIQUEIDENTIFIER NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        RechargeAmount DECIMAL(10, 2) NOT NULL DEFAULT (0),
        BonusGiven DECIMAL(10, 2) NOT NULL DEFAULT (0),
        UsedAt DATETIME NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_PromoCodeUsages PRIMARY KEY (UsageID),
        CONSTRAINT FK_PromoUsage_Code FOREIGN KEY (CodeID) REFERENCES PromoCodes(CodeID),
        CONSTRAINT FK_PromoUsage_User FOREIGN KEY (UserID) REFERENCES Users(UserID)
    );
    PRINT 'Created table PromoCodeUsages';
END
GO

-- ============================================================
-- Table: ServiceInterests
-- Purpose: Track user interest in upcoming service features
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ServiceInterests')
BEGIN
    CREATE TABLE ServiceInterests (
        InterestID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        ServiceName NVARCHAR(50) NOT NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_ServiceInterests PRIMARY KEY (InterestID),
        CONSTRAINT FK_ServiceInterests_Users FOREIGN KEY (UserID) REFERENCES Users(UserID),
        CONSTRAINT UQ_ServiceInterests_User_Service UNIQUE (UserID, ServiceName)
    );
    PRINT 'Created table ServiceInterests';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ServiceInterests_ServiceName')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ServiceInterests_ServiceName ON ServiceInterests(ServiceName);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ServiceInterests_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ServiceInterests_UserID ON ServiceInterests(UserID);
END
GO

-- FK: ManualPaymentSubmissions.PackID -> WalletBonusPacks
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ManualPayment_Pack')
BEGIN
    ALTER TABLE ManualPaymentSubmissions ADD CONSTRAINT FK_ManualPayment_Pack
        FOREIGN KEY (PackID) REFERENCES WalletBonusPacks(PackID);
END
GO

-- FK: WalletRechargeOrders.PackID -> WalletBonusPacks
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WalletRecharge_Pack')
BEGIN
    ALTER TABLE WalletRechargeOrders ADD CONSTRAINT FK_WalletRecharge_Pack
        FOREIGN KEY (PackID) REFERENCES WalletBonusPacks(PackID);
END
GO

-- ============================================================
-- Table: UserVerifications
-- Purpose: Track user verification submissions (college email, Aadhaar)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserVerifications')
BEGIN
    CREATE TABLE UserVerifications (
        VerificationID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        Method NVARCHAR(30) NOT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT ('Pending'),
        CollegeEmail NVARCHAR(255) NULL,
        CollegeName NVARCHAR(255) NULL,
        CollegeEmailVerified BIT NOT NULL DEFAULT (0),
        AadhaarPhotoURL NVARCHAR(1000) NULL,
        SelfiePhotoURL NVARCHAR(1000) NULL,
        ReviewedBy UNIQUEIDENTIFIER NULL,
        ReviewedAt DATETIME2(7) NULL,
        RejectionReason NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_UserVerifications PRIMARY KEY (VerificationID),
        CONSTRAINT FK_UserVerifications_Users FOREIGN KEY (UserID) REFERENCES Users(UserID),
        CONSTRAINT FK_UserVerifications_ReviewedBy FOREIGN KEY (ReviewedBy) REFERENCES Users(UserID)
    );
    PRINT 'Created table UserVerifications';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserVerifications_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserVerifications_UserID ON UserVerifications(UserID);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserVerifications_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserVerifications_Status ON UserVerifications(Status);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserVerifications_Method')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserVerifications_Method ON UserVerifications(Method);
END
GO

-- ============================================================
-- Seed Data: Promo Codes
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM PromoCodes WHERE Code = 'FIRST50')
BEGIN
    INSERT INTO PromoCodes (Code, Type, Value, MinRechargeAmount, MaxBonusAmount, MaxUses, PerUserLimit, ExpiresAt, IsActive, Description)
    VALUES ('FIRST50', 'FLAT_BONUS', 50, 99, 50, 1000, 1, '2026-12-31', 1, 'First recharge bonus — ₹50 extra');
END
GO

IF NOT EXISTS (SELECT 1 FROM PromoCodes WHERE Code = 'EXTRA25')
BEGIN
    INSERT INTO PromoCodes (Code, Type, Value, MinRechargeAmount, MaxBonusAmount, MaxUses, PerUserLimit, ExpiresAt, IsActive, Description)
    VALUES ('EXTRA25', 'PERCENT_BONUS', 25, 199, 100, NULL, 1, '2026-12-31', 1, '25% extra credit (max ₹100)');
END
GO

IF NOT EXISTS (SELECT 1 FROM PromoCodes WHERE Code = 'CAMPUS100')
BEGIN
    INSERT INTO PromoCodes (Code, Type, Value, MinRechargeAmount, MaxBonusAmount, MaxUses, PerUserLimit, ExpiresAt, IsActive, Description)
    VALUES ('CAMPUS100', 'FLAT_BONUS', 100, 399, 100, 500, 1, '2026-06-30', 1, 'Campus recruitment special — ₹100 extra');
END
GO

-- ============================================================
-- Table: ResumeBuilderTemplates
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumeBuilderTemplates')
BEGIN
    CREATE TABLE ResumeBuilderTemplates (
        TemplateID INT NOT NULL IDENTITY(1,1),
        Name NVARCHAR(100) NOT NULL,
        Slug NVARCHAR(100) NOT NULL,
        Category NVARCHAR(50) NOT NULL DEFAULT ('Professional'),
        Description NVARCHAR(500) NULL,
        ThumbnailURL NVARCHAR(1000) NULL,
        HtmlTemplate NVARCHAR(MAX) NOT NULL,
        CssTemplate NVARCHAR(MAX) NOT NULL,
        DefaultConfig NVARCHAR(MAX) NULL,
        SearchTags NVARCHAR(500) NULL,
        IsPremium BIT NOT NULL DEFAULT (0),
        IsActive BIT NOT NULL DEFAULT (1),
        SortOrder INT NOT NULL DEFAULT (0),
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_ResumeBuilderTemplates PRIMARY KEY (TemplateID)
    );
END
GO

-- ============================================================
-- Table: ResumeBuilderProjects
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumeBuilderProjects')
BEGIN
    CREATE TABLE ResumeBuilderProjects (
        ProjectID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        TemplateID INT NOT NULL,
        Title NVARCHAR(200) NOT NULL DEFAULT ('Untitled Resume'),
        Status NVARCHAR(20) NOT NULL DEFAULT ('Draft'),
        TargetJobTitle NVARCHAR(200) NULL,
        TargetJobDescription NVARCHAR(MAX) NULL,
        CustomConfig NVARCHAR(MAX) NULL,
        PersonalInfo NVARCHAR(MAX) NULL,
        Summary NVARCHAR(MAX) NULL,
        MatchScore INT NULL,
        LastExportedAt DATETIME2(7) NULL,
        IsDeleted BIT NOT NULL DEFAULT (0),
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_ResumeBuilderProjects PRIMARY KEY (ProjectID),
        CONSTRAINT FK_ResumeBuilderProjects_Users FOREIGN KEY (UserID) REFERENCES Users(UserID),
        CONSTRAINT FK_ResumeBuilderProjects_Templates FOREIGN KEY (TemplateID) REFERENCES ResumeBuilderTemplates(TemplateID)
    );
END
GO

-- ============================================================
-- Table: ResumeBuilderSections
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumeBuilderSections')
BEGIN
    CREATE TABLE ResumeBuilderSections (
        SectionID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        ProjectID UNIQUEIDENTIFIER NOT NULL,
        SectionType NVARCHAR(50) NOT NULL,
        SectionTitle NVARCHAR(200) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL DEFAULT ('[]'),
        SortOrder INT NOT NULL DEFAULT (0),
        IsVisible BIT NOT NULL DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_ResumeBuilderSections PRIMARY KEY (SectionID),
        CONSTRAINT FK_ResumeBuilderSections_Projects FOREIGN KEY (ProjectID) REFERENCES ResumeBuilderProjects(ProjectID)
    );
END
GO

-- ============================================================
-- Table: ResumeBuilderExports
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumeBuilderExports')
BEGIN
    CREATE TABLE ResumeBuilderExports (
        ExportID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        ProjectID UNIQUEIDENTIFIER NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        Format NVARCHAR(10) NOT NULL DEFAULT ('pdf'),
        FileURL NVARCHAR(1000) NULL,
        FileSizeBytes INT NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_ResumeBuilderExports PRIMARY KEY (ExportID),
        CONSTRAINT FK_ResumeBuilderExports_Projects FOREIGN KEY (ProjectID) REFERENCES ResumeBuilderProjects(ProjectID),
        CONSTRAINT FK_ResumeBuilderExports_Users FOREIGN KEY (UserID) REFERENCES Users(UserID)
    );
END
GO
