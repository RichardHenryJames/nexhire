# NexHire Database Schema Documentation

## Overview
This document provides comprehensive documentation for the NexHire job platform database schema. The database is designed to support a modern job platform with features for job seekers, employers, and administrators.

## Database Connection
```powershell
$connectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
```

## Schema Deployment
To deploy the complete schema, execute:
```powershell
Invoke-Sqlcmd -ConnectionString $connectionString -InputFile "deploy_database.sql"
```

## Database Architecture

### Core Entities Overview
```
Users (Authentication & Profiles)
Applicants (Job Seekers)
Employers (Hiring Managers)
Organizations (Companies)
Jobs (Job Postings)
JobApplications
ApplicationTracking
```

## Table Definitions

### 1. Users Table
**Purpose**: Central user authentication and basic profile information

| Column | Type | Description |
|--------|------|-------------|
| UserID | UNIQUEIDENTIFIER | Primary key, auto-generated |
| Email | NVARCHAR(255) | Unique email address for login |
| Password | NVARCHAR(255) | Hashed password |
| UserType | NVARCHAR(50) | JobSeeker, Employer, or Admin |
| FirstName | NVARCHAR(100) | User's first name |
| LastName | NVARCHAR(100) | User's last name |
| Phone | NVARCHAR(20) | Contact phone number |
| ProfilePictureURL | NVARCHAR(500) | Profile image URL |
| DateOfBirth | DATE | User's date of birth |
| Gender | NVARCHAR(20) | Gender information |
| EmailVerified | BIT | Email verification status |
| PhoneVerified | BIT | Phone verification status |
| LastLoginAt | DATETIME2 | Last login timestamp |
| LastActive | DATETIME2 | Last activity timestamp |
| ProfileVisibility | NVARCHAR(20) | Public/Private profile setting |
| CreatedAt | DATETIME2 | Account creation timestamp |
| UpdatedAt | DATETIME2 | Last profile update |
| IsActive | BIT | Account active status |
| TwoFactorEnabled | BIT | 2FA enablement status |
| LoginAttempts | INT | Failed login attempt counter |
| AccountLockoutEnd | DATETIME2 | Account lockout expiry |

**Constraints**:
- UserType CHECK constraint: IN ('JobSeeker', 'Employer', 'Admin')
- Email UNIQUE constraint
- Default ProfileVisibility: 'Public'

### 2. Organizations Table
**Purpose**: Company/employer organization profiles

| Column | Type | Description |
|--------|------|-------------|
| OrganizationID | UNIQUEIDENTIFIER | Primary key, auto-generated |
| Name | NVARCHAR(200) | Company name |
| Type | NVARCHAR(50) | Organization type |
| Industry | NVARCHAR(100) | Business industry |
| Size | NVARCHAR(50) | Company size category |
| Website | NVARCHAR(255) | Company website URL |
| LinkedInProfile | NVARCHAR(255) | LinkedIn company page |
| Description | NVARCHAR(MAX) | Company description |
| LogoURL | NVARCHAR(500) | Company logo URL |
| VerificationStatus | NVARCHAR(20) | Verification status |
| EstablishedDate | DATE | Company establishment date |
| CreatedAt | DATETIME2 | Profile creation timestamp |
| UpdatedAt | DATETIME2 | Last update timestamp |
| IsActive | BIT | Organization active status |

**Default Values**:
- VerificationStatus: 'Pending'
- IsActive: 1

### 3. Employers Table
**Purpose**: Links users to organizations with role permissions

| Column | Type | Description |
|--------|------|-------------|
| EmployerID | UNIQUEIDENTIFIER | Primary key, auto-generated |
| UserID | UNIQUEIDENTIFIER | Foreign key to Users table |
| OrganizationID | UNIQUEIDENTIFIER | Foreign key to Organizations table |
| CanPostJobs | BIT | Permission to create job postings |
| CanManageApplications | BIT | Permission to manage applications |
| CreatedAt | DATETIME2 | Employer record creation |
| UpdatedAt | DATETIME2 | Last update timestamp |

**Constraints**:
- Foreign key: UserID ? Users(UserID)
- Foreign key: OrganizationID ? Organizations(OrganizationID)
- Unique constraint: (UserID, OrganizationID)

### 4. JobTypes Table
**Purpose**: Reference table for employment types

| Column | Type | Description |
|--------|------|-------------|
| JobTypeID | INT IDENTITY | Primary key |
| Type | NVARCHAR(50) | Job type name (unique) |
| Description | NVARCHAR(200) | Type description |
| IsActive | BIT | Active status |
| CreatedAt | DATETIME2 | Creation timestamp |
| UpdatedAt | DATETIME2 | Last update timestamp |

**Default Data**:
- FTE (Full-Time Employment)
- Contract (Contract-based Employment)
- Freelance (Freelance Work)
- Project-based (Project-based Work)
- Part-Time (Part-Time Employment)
- Internship (Internship Position)

### 5. Currencies Table
**Purpose**: Multi-currency support for salary information

| Column | Type | Description |
|--------|------|-------------|
| CurrencyID | INT IDENTITY | Primary key |
| Code | NVARCHAR(3) | ISO currency code (unique) |
| Name | NVARCHAR(50) | Currency name |
| Symbol | NVARCHAR(5) | Currency symbol |
| IsActive | BIT | Active status |
| ExchangeRate | DECIMAL(10,4) | Exchange rate to USD |
| LastRateUpdate | DATETIME2 | Last rate update timestamp |
| CreatedAt | DATETIME2 | Creation timestamp |
| UpdatedAt | DATETIME2 | Last update timestamp |

**Default Data**:
- USD (US Dollar) - Base currency (1.0000)
- EUR (Euro)
- GBP (British Pound)
- INR (Indian Rupee)
- AUD (Australian Dollar)
- CAD (Canadian Dollar)

### 6. Jobs Table
**Purpose**: Job postings with comprehensive details

| Column | Type | Description |
|--------|------|-------------|
| JobID | UNIQUEIDENTIFIER | Primary key, auto-generated |
| OrganizationID | UNIQUEIDENTIFIER | FK to Organizations |
| PostedByUserID | UNIQUEIDENTIFIER | FK to Users (poster) |
| Title | NVARCHAR(200) | Job title |
| JobTypeID | INT | FK to JobTypes |
| Level | NVARCHAR(50) | Seniority level |
| Department | NVARCHAR(100) | Department/team |
| Description | NVARCHAR(MAX) | Job description |
| Responsibilities | NVARCHAR(MAX) | Key responsibilities |
| Requirements | NVARCHAR(MAX) | Required qualifications |
| PreferredQualifications | NVARCHAR(MAX) | Preferred qualifications |
| BenefitsOffered | NVARCHAR(MAX) | Benefits package |

**Location Fields**:
| Column | Type | Description |
|--------|------|-------------|
| Location | NVARCHAR(200) | Full location string |
| Country | NVARCHAR(100) | Country name |
| State | NVARCHAR(100) | State/province |
| City | NVARCHAR(100) | City name |
| PostalCode | NVARCHAR(20) | Postal/ZIP code |
| IsRemote | BIT | Remote work allowed |
| WorkplaceType | NVARCHAR(50) | On-site/Hybrid/Remote |
| RemoteRestrictions | NVARCHAR(200) | Remote work limitations |

**Compensation Fields**:
| Column | Type | Description |
|--------|------|-------------|
| SalaryRangeMin | DECIMAL(15,2) | Minimum salary |
| SalaryRangeMax | DECIMAL(15,2) | Maximum salary |
| CurrencyID | INT | FK to Currencies |
| SalaryPeriod | NVARCHAR(20) | Annual/Monthly/Hourly |
| CompensationType | NVARCHAR(50) | Salary/Contract/Commission |
| BonusDetails | NVARCHAR(300) | Bonus structure |
| EquityOffered | NVARCHAR(100) | Equity/stock options |

**Project-Specific Fields** (for contract/freelance):
| Column | Type | Description |
|--------|------|-------------|
| ProjectDuration | NVARCHAR(50) | Project timeline |
| ProjectStartDate | DATE | Expected start date |
| ProjectEndDate | DATE | Expected end date |
| ProjectBudget | DECIMAL(15,2) | Total project budget |
| ContractExtensionPossible | BIT | Extension possibility |
| ContractConversionPossible | BIT | FTE conversion option |

**Requirements Fields**:
| Column | Type | Description |
|--------|------|-------------|
| ExperienceMin | INT | Minimum years experience |
| ExperienceMax | INT | Maximum years experience |
| ExperienceLevel | NVARCHAR(50) | Entry/Mid/Senior level |
| RequiredCertifications | NVARCHAR(100) | Required certifications |
| RequiredEducation | NVARCHAR(200) | Education requirements |

**Status & Management Fields**:
| Column | Type | Description |
|--------|------|-------------|
| Status | NVARCHAR(20) | Draft/Published/Closed |
| Priority | NVARCHAR(20) | Normal/High/Urgent |
| Visibility | NVARCHAR(20) | Public/Private/Internal |
| ApplicationDeadline | DATETIME2 | Application cutoff date |
| TargetHiringDate | DATE | Desired hire date |
| MaxApplications | INT | Application limit |
| CurrentApplications | INT | Current application count |

**Interview & Assessment Fields**:
| Column | Type | Description |
|--------|------|-------------|
| InterviewStages | NVARCHAR(100) | Number of interview rounds |
| InterviewProcess | NVARCHAR(100) | Interview process description |
| AssessmentRequired | BIT | Technical assessment required |
| AssessmentDetails | NVARCHAR(MAX) | Assessment instructions |

**Timestamps & Meta Fields**:
| Column | Type | Description |
|--------|------|-------------|
| PublishedAt | DATETIME2 | Publication timestamp |
| ExpiresAt | DATETIME2 | Job expiry date |
| CreatedAt | DATETIME2 | Creation timestamp |
| UpdatedAt | DATETIME2 | Last update timestamp |
| LastBumpedAt | DATETIME2 | Last promotion timestamp |
| TimeZone | NVARCHAR(50) | Job timezone |
| Language | NVARCHAR(50) | Job posting language |
| Tags | NVARCHAR(100) | Searchable tags |
| InternalNotes | NVARCHAR(100) | Internal hiring notes |
| ExternalJobID | NVARCHAR(100) | External system reference |
| SearchScore | DECIMAL(5,2) | Search ranking score |
| FeaturedUntil | DATETIME2 | Featured listing expiry |

### 7. Applicants Table
**Purpose**: Job seeker profiles and preferences

| Column | Type | Description |
|--------|------|-------------|
| ApplicantID | UNIQUEIDENTIFIER | Primary key, auto-generated |
| UserID | UNIQUEIDENTIFIER | FK to Users |
| Nationality | NVARCHAR(100) | Nationality |
| CurrentLocation | NVARCHAR(200) | Current location |
| PreferredLocations | NVARCHAR(100) | Preferred work locations |

**Professional Profiles**:
| Column | Type | Description |
|--------|------|-------------|
| LinkedInProfile | NVARCHAR(255) | LinkedIn profile URL |
| PortfolioURL | NVARCHAR(255) | Portfolio website |
| GithubProfile | NVARCHAR(255) | GitHub profile |
| Headline | NVARCHAR(200) | Professional headline |
| Summary | NVARCHAR(MAX) | Professional summary |

**Current Employment**:
| Column | Type | Description |
|--------|------|-------------|
| CurrentJobTitle | NVARCHAR(200) | Current position |
| CurrentCompany | NVARCHAR(200) | Current employer |
| YearsOfExperience | DECIMAL(4,1) | Total experience years |

**Job Preferences**:
| Column | Type | Description |
|--------|------|-------------|
| PreferredJobTypes | NVARCHAR(100) | Preferred employment types |
| PreferredWorkTypes | NVARCHAR(100) | Remote/On-site preferences |
| ExpectedSalaryMin | DECIMAL(15,2) | Minimum salary expectation |
| ExpectedSalaryMax | DECIMAL(15,2) | Maximum salary expectation |
| PreferredCurrency | INT | FK to Currencies |
| NoticePeriod | INT | Notice period in days |
| ImmediatelyAvailable | BIT | Immediate availability |
| WillingToRelocate | BIT | Relocation willingness |

**Skills & Experience**:
| Column | Type | Description |
|--------|------|-------------|
| PreferredRoles | NVARCHAR(MAX) | Target job roles |
| PrimarySkills | NVARCHAR(MAX) | Core technical skills |
| SecondarySkills | NVARCHAR(MAX) | Additional skills |
| Languages | NVARCHAR(MAX) | Language proficiencies |
| Certifications | NVARCHAR(MAX) | Professional certifications |

**Education & Documents**:
| Column | Type | Description |
|--------|------|-------------|
| HighestEducation | NVARCHAR(100) | Highest degree |
| FieldOfStudy | NVARCHAR(200) | Academic field |
| Education | NVARCHAR(MAX) | Education history JSON |
| WorkExperience | NVARCHAR(MAX) | Work history JSON |
| PrimaryResumeURL | NVARCHAR(500) | Main resume file |
| AdditionalDocuments | NVARCHAR(MAX) | Other documents JSON |

**Privacy & Settings**:
| Column | Type | Description |
|--------|------|-------------|
| AllowRecruitersToContact | BIT | Recruiter contact permission |
| HideCurrentCompany | BIT | Hide current employer |
| HideSalaryDetails | BIT | Hide salary expectations |
| ProfileCompleteness | INT | Profile completion percentage |

**Status & Features**:
| Column | Type | Description |
|--------|------|-------------|
| IsOpenToWork | BIT | Actively job searching |
| IsFeatured | BIT | Featured profile status |
| FeaturedUntil | DATETIME2 | Featured listing expiry |
| JobSearchStatus | NVARCHAR(50) | Search status |
| PreferredIndustries | NVARCHAR(MAX) | Target industries |
| MinimumSalary | DECIMAL(15,2) | Absolute minimum salary |
| PreferredCompanySize | NVARCHAR(MAX) | Company size preferences |
| LastJobAppliedAt | DATETIME2 | Last application timestamp |
| SearchScore | DECIMAL(5,2) | Search ranking score |
| Tags | NVARCHAR(MAX) | Profile tags |

### 8. JobApplications Table
**Purpose**: Application submissions from candidates

| Column | Type | Description |
|--------|------|-------------|
| ApplicationID | UNIQUEIDENTIFIER | Primary key, auto-generated |
| JobID | UNIQUEIDENTIFIER | FK to Jobs |
| ApplicantID | UNIQUEIDENTIFIER | FK to Applicants |
| ResumeURL | NVARCHAR(500) | Submitted resume URL |
| CoverLetter | NVARCHAR(MAX) | Cover letter text |
| ExpectedSalary | DECIMAL(15,2) | Salary expectation |
| ExpectedCurrencyID | INT | FK to Currencies |
| AvailableFromDate | DATE | Availability start date |
| StatusID | INT | FK to ApplicationStatuses |
| SubmittedAt | DATETIME2 | Submission timestamp |
| LastUpdatedAt | DATETIME2 | Last status update |

**Constraints**:
- Unique constraint: (JobID, ApplicantID) - One application per job per candidate
- Default StatusID: 1 (Submitted)

### 9. ApplicationStatuses Table
**Purpose**: Reference table for application status workflow

| Column | Type | Description |
|--------|------|-------------|
| StatusID | INT IDENTITY | Primary key |
| Status | NVARCHAR(50) | Status name (unique) |
| Description | NVARCHAR(200) | Status description |
| IsActive | BIT | Active status |
| DisplayOrder | INT | Sort order |
| CreatedAt | DATETIME2 | Creation timestamp |
| UpdatedAt | DATETIME2 | Last update timestamp |

**Default Data**:
1. Submitted - Application submitted by candidate
2. UnderReview - Application is being reviewed
3. Shortlisted - Candidate shortlisted for interview
4. InterviewScheduled - Interview scheduled with candidate
5. InterviewCompleted - Interview process completed
6. Rejected - Application rejected

### 10. InternalStatusTypes Table
**Purpose**: Internal hiring pipeline status tracking

| Column | Type | Description |
|--------|------|-------------|
| StatusTypeID | INT IDENTITY | Primary key |
| Status | NVARCHAR(50) | Internal status name |
| Description | NVARCHAR(200) | Status description |
| IsActive | BIT | Active status |
| DisplayOrder | INT | Sort order |
| CreatedAt | DATETIME2 | Creation timestamp |
| UpdatedAt | DATETIME2 | Last update timestamp |

**Default Data**:
1. InitialScreening - Initial application screening
2. HRScreening - HR round screening
3. TechnicalScreening - Technical screening round
4. FinalInterview - Final round interview
5. OfferPreparation - Offer letter preparation

### 11. ApplicationTracking Table
**Purpose**: Detailed tracking of hiring pipeline progress

| Column | Type | Description |
|--------|------|-------------|
| TrackingID | UNIQUEIDENTIFIER | Primary key, auto-generated |
| ApplicationID | UNIQUEIDENTIFIER | FK to JobApplications |
| StatusTypeID | INT | FK to InternalStatusTypes |
| ScreeningScore | DECIMAL(5,2) | Initial screening score |
| ScreeningNotes | NVARCHAR(MAX) | Screening feedback |
| InterviewStage | INT | Current interview round |
| NextInterviewDate | DATETIME2 | Next interview scheduling |
| InterviewFeedback | NVARCHAR(MAX) | Interview notes |
| OfferStatus | NVARCHAR(50) | Offer preparation status |
| OfferedSalary | DECIMAL(15,2) | Salary offer amount |
| OfferedCurrencyID | INT | FK to Currencies |
| OfferLetterURL | NVARCHAR(500) | Offer letter document |
| OfferExpiryDate | DATETIME2 | Offer expiration date |
| Notes | NVARCHAR(MAX) | General tracking notes |
| LastUpdatedBy | UNIQUEIDENTIFIER | FK to Users (updater) |
| LastUpdatedAt | DATETIME2 | Last update timestamp |

## Database Indexes

### Performance Optimization Indexes

1. **JobTypes Performance**:
   ```sql
   IX_JobTypes_Active ON JobTypes(Type) WHERE IsActive = 1
   ```

2. **Currencies Performance**:
   ```sql
   IX_Currencies_Active ON Currencies(Code) INCLUDE (Symbol, ExchangeRate) WHERE IsActive = 1
   ```

3. **ApplicationStatuses Performance**:
   ```sql
   IX_ApplicationStatuses_Active ON ApplicationStatuses(Status, DisplayOrder) WHERE IsActive = 1
   ```

4. **InternalStatusTypes Performance**:
   ```sql
   IX_InternalStatusTypes_Active ON InternalStatusTypes(Status, DisplayOrder) WHERE IsActive = 1
   ```

## Common Queries

### 1. Get All Active Jobs with Organization Details
```sql
SELECT 
    j.JobID,
    j.Title,
    j.Level,
    j.Location,
    j.SalaryRangeMin,
    j.SalaryRangeMax,
    c.Symbol as CurrencySymbol,
    o.Name as CompanyName,
    jt.Type as JobType,
    j.PublishedAt
FROM Jobs j
INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
WHERE j.Status = 'Published' 
    AND j.ExpiresAt > GETUTCDATE()
    AND o.IsActive = 1
ORDER BY j.PublishedAt DESC;
```

### 2. Get Applicant Profile with User Details
```sql
SELECT 
    u.FirstName + ' ' + u.LastName as FullName,
    u.Email,
    a.Headline,
    a.CurrentJobTitle,
    a.CurrentCompany,
    a.YearsOfExperience,
    a.PrimarySkills,
    a.ExpectedSalaryMin,
    a.ExpectedSalaryMax,
    c.Symbol as PreferredCurrency
FROM Applicants a
INNER JOIN Users u ON a.UserID = u.UserID
LEFT JOIN Currencies c ON a.PreferredCurrency = c.CurrencyID
WHERE u.IsActive = 1 AND a.IsOpenToWork = 1;
```

### 3. Get Job Applications with Status Tracking
```sql
SELECT 
    ja.ApplicationID,
    j.Title as JobTitle,
    o.Name as CompanyName,
    u.FirstName + ' ' + u.LastName as ApplicantName,
    aps.Status as ApplicationStatus,
    ist.Status as InternalStatus,
    ja.SubmittedAt,
    at.LastUpdatedAt
FROM JobApplications ja
INNER JOIN Jobs j ON ja.JobID = j.JobID
INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
INNER JOIN Users u ON a.UserID = u.UserID
INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
LEFT JOIN ApplicationTracking at ON ja.ApplicationID = at.ApplicationID
LEFT JOIN InternalStatusTypes ist ON at.StatusTypeID = ist.StatusTypeID
ORDER BY ja.SubmittedAt DESC;
```

## Data Migration & Backup

### Backup Script
```powershell
# Create database backup
$backupQuery = "BACKUP DATABASE [nexhire-sql-db] TO URL = 'https://nexhireblobdev.blob.core.windows.net/backups/nexhire-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').bak'"
Invoke-Sqlcmd -ConnectionString $connectionString -Query $backupQuery
```

### Data Export Script
```powershell
# Export all tables to CSV
$tables = @('Users', 'Organizations', 'Jobs', 'Applicants', 'JobApplications')
foreach ($table in $tables) {
    $query = "SELECT * FROM $table"
    Invoke-Sqlcmd -ConnectionString $connectionString -Query $query | Export-Csv -Path ".\exports\$table.csv" -NoTypeInformation
}
```

## Security Considerations

### 1. Data Protection
- All password fields should store hashed values only
- PII data should be encrypted at rest
- Implement row-level security for multi-tenant scenarios

### 2. Access Control
- Use Azure AD authentication where possible
- Implement least-privilege access principles
- Regular access reviews and cleanup

### 3. Audit Trail
- Consider adding audit tables for critical data changes
- Implement logging for all database operations
- Regular security assessments

## Performance Monitoring

### Key Metrics to Monitor
1. Query execution times
2. Index usage statistics
3. Database size growth
4. Connection pool utilization
5. Deadlock occurrences

### Optimization Recommendations
1. Regular index maintenance
2. Query plan analysis
3. Statistics updates
4. Partitioning for large tables
5. Connection pooling optimization

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-19 | Initial schema design |
| 1.1 | 2024-12-19 | Added performance indexes |
| 1.2 | 2024-12-19 | Documentation completed |