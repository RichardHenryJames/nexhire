-- ============================================================
-- Migration: Create Resume Builder tables
-- Created: 2026-02-23
-- Purpose: Resume Builder feature - projects, templates, sections, exports
-- ============================================================

-- ============================================================
-- Table: ResumeBuilderTemplates
-- Master template library (pre-seeded + admin-manageable)
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
        DefaultConfig NVARCHAR(MAX) NULL,  -- JSON: fonts, colors, spacing defaults
        IsPremium BIT NOT NULL DEFAULT (0),
        IsActive BIT NOT NULL DEFAULT (1),
        SortOrder INT NOT NULL DEFAULT (0),
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_ResumeBuilderTemplates PRIMARY KEY (TemplateID)
    );
    PRINT 'Created table ResumeBuilderTemplates';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_ResumeBuilderTemplates_Slug')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_ResumeBuilderTemplates_Slug ON ResumeBuilderTemplates(Slug);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ResumeBuilderTemplates_Active')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ResumeBuilderTemplates_Active ON ResumeBuilderTemplates(IsActive, SortOrder);
END
GO

-- ============================================================
-- Table: ResumeBuilderProjects
-- Each user's resume project (one user can have many)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumeBuilderProjects')
BEGIN
    CREATE TABLE ResumeBuilderProjects (
        ProjectID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        UserID UNIQUEIDENTIFIER NOT NULL,
        TemplateID INT NOT NULL,
        Title NVARCHAR(200) NOT NULL DEFAULT ('Untitled Resume'),
        Status NVARCHAR(50) NOT NULL DEFAULT ('Draft'),          -- Draft, Complete
        TargetJobTitle NVARCHAR(200) NULL,                       -- For AI tailoring
        TargetJobDescription NVARCHAR(MAX) NULL,                 -- Paste JD for tailoring
        CustomConfig NVARCHAR(MAX) NULL,                         -- JSON: user overrides (fonts, colors, spacing, sectionOrder)
        PersonalInfo NVARCHAR(MAX) NULL,                         -- JSON: name, email, phone, linkedin, github, portfolio, location
        Summary NVARCHAR(MAX) NULL,                              -- Professional summary text
        MatchScore INT NULL,                                     -- AI-generated ATS score 0-100
        LastExportedAt DATETIME2(7) NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        IsDeleted BIT NOT NULL DEFAULT (0),
        CONSTRAINT PK_ResumeBuilderProjects PRIMARY KEY (ProjectID),
        CONSTRAINT FK_ResumeBuilderProjects_Users FOREIGN KEY (UserID) REFERENCES Users(UserID),
        CONSTRAINT FK_ResumeBuilderProjects_Templates FOREIGN KEY (TemplateID) REFERENCES ResumeBuilderTemplates(TemplateID)
    );
    PRINT 'Created table ResumeBuilderProjects';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ResumeBuilderProjects_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ResumeBuilderProjects_UserID ON ResumeBuilderProjects(UserID, IsDeleted, UpdatedAt);
END
GO

-- ============================================================
-- Table: ResumeBuilderSections
-- Ordered content sections within a project
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumeBuilderSections')
BEGIN
    CREATE TABLE ResumeBuilderSections (
        SectionID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        ProjectID UNIQUEIDENTIFIER NOT NULL,
        SectionType NVARCHAR(50) NOT NULL,     -- experience, education, skills, projects, certifications, awards, languages, custom
        SectionTitle NVARCHAR(200) NOT NULL,    -- Display label (editable)
        Content NVARCHAR(MAX) NOT NULL,         -- JSON array of items for this section
        SortOrder INT NOT NULL DEFAULT (0),
        IsVisible BIT NOT NULL DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_ResumeBuilderSections PRIMARY KEY (SectionID),
        CONSTRAINT FK_ResumeBuilderSections_Projects FOREIGN KEY (ProjectID) REFERENCES ResumeBuilderProjects(ProjectID) ON DELETE CASCADE
    );
    PRINT 'Created table ResumeBuilderSections';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ResumeBuilderSections_ProjectID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ResumeBuilderSections_ProjectID ON ResumeBuilderSections(ProjectID, SortOrder);
END
GO

-- ============================================================
-- Table: ResumeBuilderExports
-- Track every PDF/DOCX export
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumeBuilderExports')
BEGIN
    CREATE TABLE ResumeBuilderExports (
        ExportID UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
        ProjectID UNIQUEIDENTIFIER NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        Format NVARCHAR(10) NOT NULL DEFAULT ('pdf'),  -- pdf, docx, html
        FileURL NVARCHAR(1000) NULL,
        FileSizeBytes INT NULL,
        CreatedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_ResumeBuilderExports PRIMARY KEY (ExportID),
        CONSTRAINT FK_ResumeBuilderExports_Projects FOREIGN KEY (ProjectID) REFERENCES ResumeBuilderProjects(ProjectID),
        CONSTRAINT FK_ResumeBuilderExports_Users FOREIGN KEY (UserID) REFERENCES Users(UserID)
    );
    PRINT 'Created table ResumeBuilderExports';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ResumeBuilderExports_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ResumeBuilderExports_UserID ON ResumeBuilderExports(UserID, CreatedAt);
END
GO

-- NOTE: Seed data for ResumeBuilderTemplates is in database/schema/seed-data.sql
