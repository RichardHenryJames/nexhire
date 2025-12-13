# Database Schema Documentation

## RefOpen (NexHire) - Complete Database Design

This document provides comprehensive documentation of the database schema, including all tables, relationships, indexes, and design decisions.

---

## Database Platform

- **Platform**: Microsoft Azure SQL Database
- **Engine**: SQL Server (Cloud-optimized)
- **Pricing Tier**: Basic/Standard (production: S0-S2)
- **Location**: Central India
- **Collation**: SQL_Latin1_General_CP1_CI_AS

---

## Table of Contents

1. [Core Tables](#core-tables)
2. [Reference Tables](#reference-tables)
3. [Job Management](#job-management)
4. [Referral System](#referral-system)
5. [Messaging System](#messaging-system)
6. [Payment & Wallet](#payment--wallet)
7. [Relationships & Foreign Keys](#relationships--foreign-keys)
8. [Indexes & Performance](#indexes--performance)
9. [Data Types & Constraints](#data-types--constraints)

---

## Core Tables

### Users
Primary table for all user accounts.

```sql
UserID (UNIQUEIDENTIFIER, PK)
Email (NVARCHAR(255), UNIQUE, NOT NULL)
PasswordHash (NVARCHAR(255), NOT NULL)
FirstName (NVARCHAR(100), NOT NULL)
LastName (NVARCHAR(100), NOT NULL)
UserType (NVARCHAR(50), NOT NULL) -- 'JobSeeker', 'Employer', 'Admin'
IsActive (BIT, DEFAULT 1)
IsEmailVerified (BIT, DEFAULT 0)
EmailVerificationToken (NVARCHAR(255))
PasswordResetToken (NVARCHAR(255))
PasswordResetExpiry (DATETIME2)
LastLogin (DATETIME2)
GoogleID (NVARCHAR(255), UNIQUE)
ProfileImageUrl (NVARCHAR(500))
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
ReferralCode (NVARCHAR(50), UNIQUE) -- User's unique referral code
ReferredBy (NVARCHAR(50)) -- Referral code of referrer
```

**Indexes:**
- Clustered Index on `UserID`
- Unique Index on `Email`
- Index on `GoogleID`
- Index on `ReferralCode`
- Index on `UserType`

---

### Applicants
Profile data for job seekers.

```sql
ApplicantID (UNIQUEIDENTIFIER, PK)
UserID (UNIQUEIDENTIFIER, FK -> Users.UserID, UNIQUE)
PhoneNumber (NVARCHAR(20))
DateOfBirth (DATE)
Gender (NVARCHAR(20))
CurrentLocation (NVARCHAR(255))
Headline (NVARCHAR(500))
Summary (NVARCHAR(MAX))
PrimarySkills (NVARCHAR(MAX)) -- JSON array
SecondarySkills (NVARCHAR(MAX)) -- JSON array
YearsOfExperience (INT)
CurrentCompany (NVARCHAR(255))
CurrentDesignation (NVARCHAR(255))
HighestQualification (NVARCHAR(255))
InstitutionName (NVARCHAR(255))
GraduationYear (INT)
FieldOfStudy (NVARCHAR(255))
CGPAOrPercentage (DECIMAL(5,2))
LinkedInUrl (NVARCHAR(500))
GitHubUrl (NVARCHAR(500))
PortfolioUrl (NVARCHAR(500))
PreferredJobTypes (NVARCHAR(MAX)) -- JSON array of JobTypeIDs
PreferredWorkTypes (NVARCHAR(MAX)) -- JSON array of WorkplaceTypeIDs
PreferredLocations (NVARCHAR(MAX)) -- JSON array
MinExpectedSalary (DECIMAL(18,2))
MaxExpectedSalary (DECIMAL(18,2))
PreferredCurrencyID (UNIQUEIDENTIFIER, FK)
NoticePeriodDays (INT)
IsOpenToRelocation (BIT, DEFAULT 1)
IsOpenToRemote (BIT, DEFAULT 1)
VisibilityLevel (NVARCHAR(50), DEFAULT 'Public') -- Public, Private, Limited
ProfileCompleteness (INT, DEFAULT 0) -- 0-100%
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

**Profile Completeness Components (10 total):**
1. Basic Info (Name, Email)
2. Contact & Location
3. Education
4. Primary Skills
5. Work Experience
6. Resume
7. Profile Picture
8. Summary/Headline
9. Job Preferences
10. Social Links

---

### Employers
Profile data for employer/recruiter accounts.

```sql
EmployerID (UNIQUEIDENTIFIER, PK)
UserID (UNIQUEIDENTIFIER, FK -> Users.UserID, UNIQUE)
OrganizationID (UNIQUEIDENTIFIER, FK -> Organizations.OrganizationID)
Designation (NVARCHAR(255))
Department (NVARCHAR(255))
PhoneNumber (NVARCHAR(20))
LinkedInUrl (NVARCHAR(500))
Bio (NVARCHAR(MAX))
IsVerified (BIT, DEFAULT 0)
VerificationDate (DATETIME2)
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### WorkExperiences
Detailed work history for applicants.

```sql
ExperienceID (UNIQUEIDENTIFIER, PK)
ApplicantID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID)
CompanyName (NVARCHAR(255), NOT NULL)
CompanyID (UNIQUEIDENTIFIER, FK -> Organizations.OrganizationID) -- Optional link
Designation (NVARCHAR(255), NOT NULL)
EmploymentType (NVARCHAR(50)) -- Full-time, Part-time, Contract, Internship
StartDate (DATE, NOT NULL)
EndDate (DATE)
IsCurrent (BIT, DEFAULT 0)
Location (NVARCHAR(255))
Description (NVARCHAR(MAX))
KeyAchievements (NVARCHAR(MAX))
SkillsUsed (NVARCHAR(MAX)) -- JSON array
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### Resumes
Stores uploaded resume files for applicants.

```sql
ResumeID (UNIQUEIDENTIFIER, PK)
ApplicantID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID)
FileName (NVARCHAR(255), NOT NULL)
FileUrl (NVARCHAR(500), NOT NULL) -- Azure Blob Storage URL
FileSize (BIGINT) -- In bytes
MimeType (NVARCHAR(100))
IsPrimary (BIT, DEFAULT 0) -- Primary resume flag
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

---

## Reference Tables

### Organizations
Companies and organizations in the platform.

```sql
OrganizationID (UNIQUEIDENTIFIER, PK)
Name (NVARCHAR(255), NOT NULL, UNIQUE)
Description (NVARCHAR(MAX))
IndustryID (UNIQUEIDENTIFIER, FK -> Industries.IndustryID)
Website (NVARCHAR(500))
LogoUrl (NVARCHAR(500))
HeadquartersLocation (NVARCHAR(255))
Country (NVARCHAR(100))
EmployeeCount (NVARCHAR(50)) -- '1-10', '11-50', '51-200', etc.
FoundedYear (INT)
LinkedInUrl (NVARCHAR(500))
IsFortune500 (BIT, DEFAULT 0)
IsVerified (BIT, DEFAULT 0)
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

**Indexes:**
- Clustered Index on `OrganizationID`
- Unique Index on `Name`
- Index on `IsFortune500`
- Index on `Country`

---

### Industries
Industry categories for organizations.

```sql
IndustryID (UNIQUEIDENTIFIER, PK)
Name (NVARCHAR(255), NOT NULL, UNIQUE)
Description (NVARCHAR(MAX))
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

**Examples:** Technology, Healthcare, Finance, Education, Manufacturing, etc.

---

### JobTypes
Categories of employment types.

```sql
JobTypeID (UNIQUEIDENTIFIER, PK)
Name (NVARCHAR(100), NOT NULL, UNIQUE)
Description (NVARCHAR(500))
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

**Examples:** Full-time, Part-time, Contract, Internship, Freelance

---

### WorkplaceTypes
Work arrangement categories.

```sql
WorkplaceTypeID (UNIQUEIDENTIFIER, PK)
Name (NVARCHAR(100), NOT NULL, UNIQUE)
Description (NVARCHAR(500))
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

**Examples:** On-site, Remote, Hybrid

---

### Currencies
Currency types for salary information.

```sql
CurrencyID (UNIQUEIDENTIFIER, PK)
Code (NVARCHAR(10), NOT NULL, UNIQUE) -- 'INR', 'USD', 'EUR', etc.
Name (NVARCHAR(100), NOT NULL)
Symbol (NVARCHAR(10)) -- '₹', '$', '€', etc.
Country (NVARCHAR(100))
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### Countries
List of countries for location data.

```sql
CountryID (UNIQUEIDENTIFIER, PK)
Name (NVARCHAR(255), NOT NULL, UNIQUE)
Code (NVARCHAR(10), UNIQUE) -- ISO country code
CurrencyID (UNIQUEIDENTIFIER, FK -> Currencies.CurrencyID)
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### Colleges
Educational institutions.

```sql
CollegeID (UNIQUEIDENTIFIER, PK)
Name (NVARCHAR(255), NOT NULL)
Country (NVARCHAR(100))
City (NVARCHAR(100))
Website (NVARCHAR(500))
IsVerified (BIT, DEFAULT 0)
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

---

## Job Management

### Jobs
Job postings created by employers.

```sql
JobID (UNIQUEIDENTIFIER, PK)
EmployerID (UNIQUEIDENTIFIER, FK -> Employers.EmployerID)
OrganizationID (UNIQUEIDENTIFIER, FK -> Organizations.OrganizationID)
Title (NVARCHAR(255), NOT NULL)
Description (NVARCHAR(MAX), NOT NULL)
Responsibilities (NVARCHAR(MAX))
Requirements (NVARCHAR(MAX))
JobTypeID (UNIQUEIDENTIFIER, FK -> JobTypes.JobTypeID)
WorkplaceTypeID (UNIQUEIDENTIFIER, FK -> WorkplaceTypes.WorkplaceTypeID)
LocationCity (NVARCHAR(255))
LocationState (NVARCHAR(255))
LocationCountry (NVARCHAR(100))
MinSalary (DECIMAL(18,2))
MaxSalary (DECIMAL(18,2))
CurrencyID (UNIQUEIDENTIFIER, FK -> Currencies.CurrencyID)
ExperienceYears (INT)
RequiredSkills (NVARCHAR(MAX)) -- JSON array or comma-separated
PreferredSkills (NVARCHAR(MAX))
EducationLevel (NVARCHAR(100))
Benefits (NVARCHAR(MAX))
ApplicationDeadline (DATE)
Status (NVARCHAR(50), DEFAULT 'Draft') -- Draft, Published, Closed, Archived
IsActive (BIT, DEFAULT 1)
ViewCount (INT, DEFAULT 0)
ApplicationCount (INT, DEFAULT 0)
PublishedAt (DATETIME2)
ClosedAt (DATETIME2)
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
Source (NVARCHAR(100)) -- 'internal', 'scraped'
ExternalJobUrl (NVARCHAR(500)) -- For scraped jobs
ExternalJobID (NVARCHAR(255)) -- Original ID from source
ScrapedFrom (NVARCHAR(100)) -- 'remoteok', 'adzuna', 'linkedin', etc.
ScrapedAt (DATETIME2)
```

**Indexes:**
- Clustered Index on `JobID`
- Index on `EmployerID`
- Index on `OrganizationID`
- Index on `Status`
- Index on `CreatedAt DESC` (for recent jobs)
- Index on `LocationCountry, LocationCity`
- Composite Index on `Status, IsActive, PublishedAt`

---

### JobApplications
Applications submitted by job seekers.

```sql
ApplicationID (UNIQUEIDENTIFIER, PK)
JobID (UNIQUEIDENTIFIER, FK -> Jobs.JobID)
ApplicantID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID)
ResumeID (UNIQUEIDENTIFIER, FK -> Resumes.ResumeID)
CoverLetter (NVARCHAR(MAX))
Status (NVARCHAR(50), DEFAULT 'Applied')
    -- Applied, Viewed, Shortlisted, Interviewing, Offered, Hired, Rejected, Withdrawn
Notes (NVARCHAR(MAX)) -- Employer notes
AppliedAt (DATETIME2, DEFAULT GETDATE())
ViewedAt (DATETIME2)
StatusUpdatedAt (DATETIME2)
UpdatedBy (UNIQUEIDENTIFIER, FK -> Users.UserID) -- Who updated the status
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

**Unique Constraint:** Applicant can only apply once per job
**Indexes:**
- Clustered Index on `ApplicationID`
- Index on `JobID`
- Index on `ApplicantID`
- Index on `Status`
- Unique Index on `JobID, ApplicantID`

---

### SavedJobs
Jobs bookmarked by applicants.

```sql
SavedJobID (UNIQUEIDENTIFIER, PK)
ApplicantID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID)
JobID (UNIQUEIDENTIFIER, FK -> Jobs.JobID)
SavedAt (DATETIME2, DEFAULT GETDATE())
```

**Unique Constraint:** One save per job per applicant
**Indexes:**
- Clustered Index on `SavedJobID`
- Unique Index on `ApplicantID, JobID`

---

## Referral System

### ReferralPlans
Subscription plans for the referral system.

```sql
PlanID (UNIQUEIDENTIFIER, PK)
Name (NVARCHAR(100), NOT NULL) -- 'Free', 'Basic', 'Premium', 'Lifetime'
Description (NVARCHAR(MAX))
Price (DECIMAL(10,2), NOT NULL)
DailyReferralLimit (INT, NOT NULL) -- How many referrals per day
DurationDays (INT) -- NULL for lifetime
Features (NVARCHAR(MAX)) -- JSON array of features
IsActive (BIT, DEFAULT 1)
SortOrder (INT, DEFAULT 0)
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

**Example Plans:**
- Free: ₹0, 1 referral/day, 30 days
- Basic: ₹199, 5 referrals/day, 30 days
- Premium: ₹499, 15 referrals/day, 90 days
- Lifetime: ₹1999, unlimited, lifetime

---

### ApplicantReferralSubscriptions
Active subscriptions for applicants.

```sql
SubscriptionID (UNIQUEIDENTIFIER, PK)
ApplicantID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID)
PlanID (UNIQUEIDENTIFIER, FK -> ReferralPlans.PlanID)
StartDate (DATETIME2, NOT NULL)
EndDate (DATETIME2) -- NULL for lifetime plans
IsActive (BIT, DEFAULT 1)
DailyReferralLimit (INT, NOT NULL)
PaymentID (UNIQUEIDENTIFIER, FK -> Payments.PaymentID)
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### ReferralRequests
Referral requests created by job seekers.

```sql
RequestID (UNIQUEIDENTIFIER, PK)
RequesterID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID)
JobID (UNIQUEIDENTIFIER, FK -> Jobs.JobID) -- NULL for external jobs
ReferralType (NVARCHAR(50), NOT NULL) -- 'internal' or 'external'
JobTitle (NVARCHAR(255), NOT NULL)
CompanyName (NVARCHAR(255), NOT NULL)
JobUrl (NVARCHAR(500))
Description (NVARCHAR(MAX))
Status (NVARCHAR(50), DEFAULT 'Open')
    -- Open, Claimed, ProofSubmitted, Verified, Cancelled
ReferrerID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID) -- Who claimed it
ClaimedAt (DATETIME2)
VerifiedAt (DATETIME2)
CancelledAt (DATETIME2)
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

**Indexes:**
- Clustered Index on `RequestID`
- Index on `RequesterID`
- Index on `ReferrerID`
- Index on `Status`
- Index on `ReferralType`

---

### ReferralProofs
Proof submissions for referral completion.

```sql
ProofID (UNIQUEIDENTIFIER, PK)
RequestID (UNIQUEIDENTIFIER, FK -> ReferralRequests.RequestID)
ReferrerID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID)
ProofImageUrl (NVARCHAR(500)) -- Screenshot of referral
Notes (NVARCHAR(MAX))
SubmittedAt (DATETIME2, DEFAULT GETDATE())
VerifiedAt (DATETIME2)
IsVerified (BIT, DEFAULT 0)
VerificationNotes (NVARCHAR(MAX))
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### ReferralRewards
Points and rewards earned from referrals.

```sql
RewardID (UNIQUEIDENTIFIER, PK)
ReferrerID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID)
RequestID (UNIQUEIDENTIFIER, FK -> ReferralRequests.RequestID)
PointsEarned (INT, NOT NULL)
PointType (NVARCHAR(50)) -- 'referral_completed', 'bonus', 'penalty'
Description (NVARCHAR(MAX))
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### ReferralPointsBalance
Current points balance for users.

```sql
BalanceID (UNIQUEIDENTIFIER, PK)
ApplicantID (UNIQUEIDENTIFIER, FK -> Applicants.ApplicantID, UNIQUE)
TotalPoints (INT, DEFAULT 0)
AvailablePoints (INT, DEFAULT 0) -- After conversions
ConvertedPoints (INT, DEFAULT 0) -- Converted to wallet
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

---

## Messaging System

### Conversations
Direct message conversations between users.

```sql
ConversationID (UNIQUEIDENTIFIER, PK)
Participant1ID (UNIQUEIDENTIFIER, FK -> Users.UserID)
Participant2ID (UNIQUEIDENTIFIER, FK -> Users.UserID)
LastMessageAt (DATETIME2)
LastMessagePreview (NVARCHAR(500))
IsArchived (BIT, DEFAULT 0)
IsMuted (BIT, DEFAULT 0)
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

**Unique Constraint:** One conversation per pair of users
**Indexes:**
- Unique Index on `Participant1ID, Participant2ID` (ordered)

---

### Messages
Individual messages in conversations.

```sql
MessageID (UNIQUEIDENTIFIER, PK)
ConversationID (UNIQUEIDENTIFIER, FK -> Conversations.ConversationID)
SenderID (UNIQUEIDENTIFIER, FK -> Users.UserID)
Content (NVARCHAR(MAX), NOT NULL)
Attachments (NVARCHAR(MAX)) -- JSON array of URLs
IsRead (BIT, DEFAULT 0)
ReadAt (DATETIME2)
IsDeleted (BIT, DEFAULT 0)
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

**Indexes:**
- Clustered Index on `MessageID`
- Index on `ConversationID, CreatedAt DESC`
- Index on `SenderID`

---

### BlockedUsers
Users blocked from messaging.

```sql
BlockID (UNIQUEIDENTIFIER, PK)
BlockerID (UNIQUEIDENTIFIER, FK -> Users.UserID)
BlockedID (UNIQUEIDENTIFIER, FK -> Users.UserID)
Reason (NVARCHAR(MAX))
BlockedAt (DATETIME2, DEFAULT GETDATE())
```

**Unique Constraint:** One block record per pair

---

### ProfileViews
Track who viewed whose profile.

```sql
ViewID (UNIQUEIDENTIFIER, PK)
ViewerID (UNIQUEIDENTIFIER, FK -> Users.UserID)
ViewedUserID (UNIQUEIDENTIFIER, FK -> Users.UserID)
ViewedAt (DATETIME2, DEFAULT GETDATE())
```

---

## Payment & Wallet

### Wallets
Digital wallet for each user.

```sql
WalletID (UNIQUEIDENTIFIER, PK)
UserID (UNIQUEIDENTIFIER, FK -> Users.UserID, UNIQUE)
Balance (DECIMAL(18,2), DEFAULT 0.00)
Currency (NVARCHAR(10), DEFAULT 'INR')
IsActive (BIT, DEFAULT 1)
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### WalletTransactions
All wallet activity (credits and debits).

```sql
TransactionID (UNIQUEIDENTIFIER, PK)
WalletID (UNIQUEIDENTIFIER, FK -> Wallets.WalletID)
Type (NVARCHAR(50), NOT NULL) -- 'credit', 'debit'
Amount (DECIMAL(18,2), NOT NULL)
BalanceAfter (DECIMAL(18,2), NOT NULL)
Category (NVARCHAR(100)) -- 'recharge', 'ai_recommendation', 'points_conversion', etc.
Description (NVARCHAR(MAX))
ReferenceID (UNIQUEIDENTIFIER) -- Link to related record (payment, job, etc.)
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### Payments
All payment transactions (Razorpay).

```sql
PaymentID (UNIQUEIDENTIFIER, PK)
UserID (UNIQUEIDENTIFIER, FK -> Users.UserID)
RazorpayOrderID (NVARCHAR(255))
RazorpayPaymentID (NVARCHAR(255))
RazorpaySignature (NVARCHAR(500))
Amount (DECIMAL(18,2), NOT NULL)
Currency (NVARCHAR(10), DEFAULT 'INR')
Status (NVARCHAR(50), DEFAULT 'pending')
    -- pending, completed, failed, refunded
PaymentMethod (NVARCHAR(100))
Purpose (NVARCHAR(100)) -- 'wallet_recharge', 'referral_plan', etc.
Metadata (NVARCHAR(MAX)) -- JSON
CreatedAt (DATETIME2, DEFAULT GETDATE())
UpdatedAt (DATETIME2, DEFAULT GETDATE())
```

---

## Job Scraping Tables

### ScrapingLogs
Logs for job scraper executions.

```sql
LogID (UNIQUEIDENTIFIER, PK)
Source (NVARCHAR(100), NOT NULL) -- 'remoteok', 'adzuna', etc.
Status (NVARCHAR(50)) -- 'success', 'partial', 'failed'
JobsScraped (INT, DEFAULT 0)
JobsAdded (INT, DEFAULT 0)
JobsUpdated (INT, DEFAULT 0)
ErrorMessage (NVARCHAR(MAX))
ExecutionTimeMs (INT)
StartedAt (DATETIME2, NOT NULL)
CompletedAt (DATETIME2)
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

---

### JobArchivalLogs
Logs for automatic job archival.

```sql
LogID (UNIQUEIDENTIFIER, PK)
JobsArchived (INT, DEFAULT 0)
JobsProcessed (INT, DEFAULT 0)
ArchivalReason (NVARCHAR(255)) -- 'old', 'expired', etc.
ExecutionTimeMs (INT)
StartedAt (DATETIME2, NOT NULL)
CompletedAt (DATETIME2)
CreatedAt (DATETIME2, DEFAULT GETDATE())
```

---

## Relationships & Foreign Keys

### User Relationships
- `Applicants.UserID` → `Users.UserID`
- `Employers.UserID` → `Users.UserID`
- `Wallets.UserID` → `Users.UserID`
- `Payments.UserID` → `Users.UserID`

### Job Relationships
- `Jobs.EmployerID` → `Employers.EmployerID`
- `Jobs.OrganizationID` → `Organizations.OrganizationID`
- `Jobs.JobTypeID` → `JobTypes.JobTypeID`
- `Jobs.WorkplaceTypeID` → `WorkplaceTypes.WorkplaceTypeID`
- `Jobs.CurrencyID` → `Currencies.CurrencyID`

### Application Relationships
- `JobApplications.JobID` → `Jobs.JobID`
- `JobApplications.ApplicantID` → `Applicants.ApplicantID`
- `JobApplications.ResumeID` → `Resumes.ResumeID`

### Referral Relationships
- `ReferralRequests.RequesterID` → `Applicants.ApplicantID`
- `ReferralRequests.ReferrerID` → `Applicants.ApplicantID`
- `ReferralRequests.JobID` → `Jobs.JobID` (nullable)
- `ApplicantReferralSubscriptions.PlanID` → `ReferralPlans.PlanID`

---

## Indexes & Performance

### High-Traffic Query Optimization

1. **Job Search Queries**
   - Composite index: `(Status, IsActive, PublishedAt DESC, LocationCountry)`
   - Full-text index on `Title, Description` (planned)

2. **Application Lookup**
   - Composite index: `(ApplicantID, Status, AppliedAt DESC)`
   - Composite index: `(JobID, Status, AppliedAt DESC)`

3. **Messaging Queries**
   - Composite index: `(ConversationID, CreatedAt DESC)`
   - Index on `IsRead` for unread counts

4. **Wallet Transactions**
   - Composite index: `(WalletID, CreatedAt DESC)`
   - Index on `Type` for filtering

---

## Data Types & Constraints

### Standard Conventions

- **Primary Keys**: Always `UNIQUEIDENTIFIER` (GUID)
- **Timestamps**: `DATETIME2` for precision
- **Money**: `DECIMAL(18,2)` for currency values
- **Boolean**: `BIT` (0 or 1)
- **Text**: 
  - Short text: `NVARCHAR(255)`
  - Long text: `NVARCHAR(MAX)`
- **JSON Data**: Stored as `NVARCHAR(MAX)`

### Constraints

- **NOT NULL**: Applied to critical fields
- **UNIQUE**: Email, referral codes, organization names
- **DEFAULT**: Timestamps default to `GETDATE()`
- **CHECK**: Status fields restricted to valid values (via application logic)

---

## Design Decisions

### 1. GUID Primary Keys
- **Reason**: Better for distributed systems, Azure Functions
- **Trade-off**: Larger index size vs. INT

### 2. Soft Deletes
- **Implementation**: `IsActive` or `IsDeleted` flags
- **Reason**: Data preservation for auditing

### 3. Denormalization
- **Examples**: `ApplicationCount` on Jobs table
- **Reason**: Performance optimization for common queries

### 4. JSON Storage
- **Fields**: Skills, preferences, metadata
- **Reason**: Flexible schema for evolving requirements
- **Trade-off**: Queryability vs. flexibility

### 5. Separate Wallet System
- **Reason**: Clear financial tracking and audit trail
- **Benefit**: Easy to add new payment features

---

## Database Migrations

### Migration Strategy
- Migrations stored in: `/database/migrations/`
- Naming: `00X_description.sql`
- Applied manually via PowerShell scripts

### Latest Migration
- `005_add_external_job_fields.sql`: Added support for scraped external jobs

---

## Backup & Recovery

### Backup Strategy
- **Automated**: Azure SQL automatic backups (7-35 days retention)
- **Point-in-time restore**: Up to retention period
- **Manual**: Pre-deployment backups via PowerShell scripts

### Recovery Procedures
1. Identify backup restore point
2. Create new database from backup
3. Update connection strings
4. Verify data integrity
5. Switch traffic to restored database

---

## Performance Monitoring

### Key Metrics
- Query execution time
- Index usage statistics
- Deadlock monitoring
- Storage usage

### Tools
- Azure SQL Database Query Performance Insights
- Dynamic Management Views (DMVs)
- Application Insights integration

---

## Security

### Authentication
- No direct database credentials in code
- Connection strings stored in Azure Key Vault (production)
- Least privilege access for application user

### Data Protection
- Passwords: BCrypt hashed (10 rounds)
- Sensitive data: Encrypted at rest (Azure SQL)
- PII: Handled according to privacy settings

### SQL Injection Prevention
- Parameterized queries only
- No dynamic SQL concatenation
- Input validation at application layer

---

## Scalability Considerations

### Horizontal Scaling
- Read replicas for reporting queries (future)
- Sharding strategy for multi-tenant (if needed)

### Vertical Scaling
- Current: Basic tier (suitable for development)
- Production: Standard S2-S3 or Premium tier
- Automatic scaling during peak loads

### Connection Pooling
- Implemented via `mssql` library
- Singleton pattern for connection pool
- Maximum 100 concurrent connections

---

## Future Enhancements

1. **Full-Text Search**: On job titles and descriptions
2. **Partitioning**: Jobs table by date for performance
3. **Read Replicas**: Separate reporting database
4. **Elasticsearch**: Advanced search capabilities
5. **CDC**: Change Data Capture for real-time analytics
6. **Temporal Tables**: Complete audit history
