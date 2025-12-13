# Database Schema Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Database Architecture](#database-architecture)
- [Core Tables](#core-tables)
- [Entity Relationships](#entity-relationships)
- [Table Details](#table-details)
- [Indexes and Performance](#indexes-and-performance)
- [Migrations](#migrations)

---

## Overview

RefOpen uses **Azure SQL Database** as its primary data store. The database follows a **normalized relational design** with clear entity relationships and proper indexing for performance.

### Database Details
- **Platform**: Azure SQL Database
- **Server**: refopen-sql-srv.database.windows.net
- **Database**: refopen-sql-db-dev (development)
- **Connection**: TCP/IP with TLS encryption
- **Total Tables**: 35+ tables
- **Naming Convention**: PascalCase for tables and columns

---

## Database Architecture

### Entity Categories

The database is organized into logical groups:

1. **User Management** (5 tables)
   - Users, Applicants, Employers, Admin accounts

2. **Job Management** (8 tables)
   - Jobs, JobTypes, WorkplaceTypes, Industries, Skills

3. **Application System** (4 tables)
   - JobApplications, ApplicationTracking, ApplicationStatuses

4. **Referral System** (7 tables)
   - ReferralPlans, ReferralRequests, ReferralProofs, ReferralRewards, ApplicantReferralSubscriptions

5. **Wallet & Payments** (6 tables)
   - Wallets, WalletTransactions, PaymentOrders, PaymentTransactions

6. **Messaging System** (5 tables)
   - Conversations, Messages, ProfileViews, BlockedUsers

7. **Work Experience** (2 tables)
   - WorkExperiences, Resumes

8. **Reference Data** (8 tables)
   - Organizations, Countries, Currencies, Colleges, Universities

9. **System Tables** (3 tables)
   - SavedJobs, ScrapingLogs, SystemLogs

---

## Core Tables

### 1. **Users** - Central user table
Primary table for all system users (JobSeekers, Employers, Admins).

| Column | Type | Description |
|--------|------|-------------|
| UserID | NVARCHAR(50) PK | Unique user identifier (UUID) |
| Email | NVARCHAR(255) UNIQUE | User email address |
| PasswordHash | NVARCHAR(255) | Bcrypt hashed password |
| UserType | NVARCHAR(50) | 'JobSeeker', 'Employer', 'Admin' |
| FirstName | NVARCHAR(100) | User's first name |
| LastName | NVARCHAR(100) | User's last name |
| PhoneNumber | NVARCHAR(20) | Contact number |
| ProfileImageURL | NVARCHAR(500) | Azure Blob URL for profile pic |
| IsEmailVerified | BIT | Email verification status |
| IsActive | BIT | Account active status |
| GoogleID | NVARCHAR(255) | Google OAuth ID (if used) |
| ReferralCode | NVARCHAR(20) UNIQUE | User's referral code |
| ReferredBy | NVARCHAR(50) FK | Referring user ID |
| CreatedAt | DATETIME2 | Account creation timestamp |
| UpdatedAt | DATETIME2 | Last update timestamp |
| LastLoginAt | DATETIME2 | Last login timestamp |

**Indexes:**
- Primary Key: UserID
- Unique: Email, ReferralCode
- Index: GoogleID, UserType

---

### 2. **Applicants** - Job seeker profiles
Extended profile for job seekers.

| Column | Type | Description |
|--------|------|-------------|
| ApplicantID | NVARCHAR(50) PK | Links to Users.UserID |
| DateOfBirth | DATE | Birth date |
| Gender | NVARCHAR(20) | Gender |
| CountryID | INT FK | Country reference |
| City | NVARCHAR(100) | Current city |
| Address | NVARCHAR(500) | Full address |
| LinkedInProfile | NVARCHAR(255) | LinkedIn URL |
| GitHubProfile | NVARCHAR(255) | GitHub URL |
| Summary | NVARCHAR(MAX) | Career summary |
| PrimarySkills | NVARCHAR(MAX) | JSON array of skills |
| PreferredJobTypes | NVARCHAR(255) | Preferred job types |
| PreferredWorkTypes | NVARCHAR(100) | Remote/Hybrid/Onsite |
| ExpectedSalaryMin | DECIMAL(18,2) | Minimum salary expectation |
| ExpectedSalaryMax | DECIMAL(18,2) | Maximum salary expectation |
| CurrencyID | INT FK | Currency reference |
| TotalExperienceYears | INT | Years of experience |
| NoticePeriodDays | INT | Notice period in days |
| CurrentCompany | NVARCHAR(200) | Current employer |
| CurrentDesignation | NVARCHAR(200) | Current job title |
| CurrentSalary | DECIMAL(18,2) | Current salary |
| HideCurrentCompany | BIT | Privacy flag |
| HideSalaryDetails | BIT | Privacy flag |
| IsAvailableForWork | BIT | Open to opportunities |
| ProfileCompleteness | INT | 0-100 score |
| CreatedAt | DATETIME2 | Profile creation |
| UpdatedAt | DATETIME2 | Last update |

**Profile Completeness Components (10 total):**
1. Education
2. Primary Skills
3. Work Experience
4. Resume
5. Preferences
6. Profile Picture
7. Summary
8. Location
9. Contact Information
10. Social Profiles

---

### 3. **Employers** - Employer profiles
Extended profile for employers/recruiters.

| Column | Type | Description |
|--------|------|-------------|
| EmployerID | NVARCHAR(50) PK | Links to Users.UserID |
| OrganizationID | INT FK | Company reference |
| CompanyName | NVARCHAR(200) | Company name |
| CompanyWebsite | NVARCHAR(255) | Company website |
| CompanySize | NVARCHAR(50) | Employee count range |
| IndustryID | INT FK | Industry reference |
| JobTitle | NVARCHAR(200) | Recruiter's title |
| Department | NVARCHAR(100) | Department name |
| Bio | NVARCHAR(MAX) | Employer bio |
| CreatedAt | DATETIME2 | Profile creation |
| UpdatedAt | DATETIME2 | Last update |

---

### 4. **Jobs** - Job postings
Main job listings table.

| Column | Type | Description |
|--------|------|-------------|
| JobID | INT IDENTITY PK | Auto-increment job ID |
| EmployerID | NVARCHAR(50) FK | Posted by (Employer) |
| OrganizationID | INT FK | Company posting |
| Title | NVARCHAR(200) | Job title |
| Description | NVARCHAR(MAX) | Full job description |
| JobTypeID | INT FK | Job type reference |
| WorkplaceType | NVARCHAR(50) | Remote/Hybrid/Onsite |
| Location | NVARCHAR(200) | Job location |
| CountryID | INT FK | Country reference |
| City | NVARCHAR(100) | City |
| SalaryMin | DECIMAL(18,2) | Minimum salary |
| SalaryMax | DECIMAL(18,2) | Maximum salary |
| CurrencyID | INT FK | Currency reference |
| CompensationType | NVARCHAR(50) | Yearly/Monthly/Hourly |
| HideSalary | BIT | Privacy flag |
| ExperienceRequired | INT | Years required |
| RequiredSkills | NVARCHAR(MAX) | JSON skills array |
| PreferredSkills | NVARCHAR(MAX) | JSON skills array |
| Benefits | NVARCHAR(MAX) | Benefits description |
| ApplicationDeadline | DATE | Last application date |
| Status | NVARCHAR(50) | Draft/Active/Closed |
| ViewCount | INT | Number of views |
| ApplicationCount | INT | Total applications |
| IsRemote | BIT | Remote work flag |
| IsHybrid | BIT | Hybrid work flag |
| CreatedAt | DATETIME2 | Posted date |
| UpdatedAt | DATETIME2 | Last modified |
| PublishedAt | DATETIME2 | Publish date |
| ClosedAt | DATETIME2 | Closed date |

**Indexes:**
- Primary Key: JobID
- Foreign Keys: EmployerID, OrganizationID, JobTypeID, CountryID, CurrencyID
- Composite: (Status, CreatedAt DESC)

---

### 5. **JobApplications** - Application submissions
Tracks all job applications.

| Column | Type | Description |
|--------|------|-------------|
| ApplicationID | INT IDENTITY PK | Auto-increment ID |
| JobID | INT FK | Applied to job |
| ApplicantID | NVARCHAR(50) FK | Applicant user ID |
| ResumeURL | NVARCHAR(500) | Submitted resume URL |
| CoverLetter | NVARCHAR(MAX) | Cover letter text |
| Status | NVARCHAR(50) | Application status |
| ExpectedSalary | DECIMAL(18,2) | Salary expectation |
| AvailableFrom | DATE | Available start date |
| Notes | NVARCHAR(MAX) | Additional notes |
| EmployerNotes | NVARCHAR(MAX) | Recruiter notes |
| AppliedAt | DATETIME2 | Application date |
| UpdatedAt | DATETIME2 | Last status update |
| ReviewedAt | DATETIME2 | First review date |
| ReviewedBy | NVARCHAR(50) FK | Reviewer user ID |

**Application Statuses (10 stages):**
1. Submitted
2. Under Review
3. Shortlisted
4. Interview Scheduled
5. Interview Completed
6. Second Interview
7. Offer Extended
8. Offer Accepted
9. Offer Rejected
10. Application Rejected

---

### 6. **ReferralPlans** - Subscription tiers
Available referral subscription plans.

| Column | Type | Description |
|--------|------|-------------|
| PlanID | INT IDENTITY PK | Plan identifier |
| Name | NVARCHAR(100) | Plan name |
| ReferralsPerDay | INT | Daily referral quota |
| DurationDays | INT | Subscription duration |
| Price | DECIMAL(10,2) | Plan price |
| IsActive | BIT | Plan availability |
| CreatedAt | DATETIME2 | Plan creation |

**Default Plans:**
1. **Free Tier**: 5/day, Forever, ₹0
2. **Weekly Boost**: 10/day, 7 days, ₹49
3. **Monthly Pro**: 15/day, 30 days, ₹149
4. **Quarterly Growth**: 20/day, 90 days, ₹399
5. **Half-Year Power**: 20/day, 180 days, ₹699
6. **Lifetime Unlimited**: 25/day, Lifetime (9999 days), ₹1999

---

### 7. **ApplicantReferralSubscriptions** - Active subscriptions
User's current referral subscription.

| Column | Type | Description |
|--------|------|-------------|
| SubscriptionID | NVARCHAR(50) PK | UUID |
| ApplicantID | NVARCHAR(50) FK | Subscriber user ID |
| PlanID | INT FK | Subscribed plan |
| StartDate | DATETIME2 | Subscription start |
| EndDate | DATETIME2 | Subscription end |
| IsActive | BIT | Active status |
| CreatedAt | DATETIME2 | Creation timestamp |

---

### 8. **ReferralRequests** - Referral marketplace
All referral requests (internal and external jobs).

| Column | Type | Description |
|--------|------|-------------|
| ReferralRequestID | INT IDENTITY PK | Request ID |
| ApplicantID | NVARCHAR(50) FK | Requester user ID |
| JobID | INT FK NULL | Internal job (if applicable) |
| JobTitle | NVARCHAR(200) | External job title (if external) |
| JobURL | NVARCHAR(500) | External job link (if external) |
| OrganizationID | INT FK NULL | Organization ID |
| CompanyName | NVARCHAR(200) | Company name |
| ExpectedSalary | DECIMAL(18,2) | Expected salary |
| CurrencyID | INT FK | Currency |
| Message | NVARCHAR(MAX) | Request message |
| ReferralType | NVARCHAR(50) | 'internal' or 'external' |
| Status | NVARCHAR(50) | Pending/Claimed/Completed/Cancelled |
| ClaimedBy | NVARCHAR(50) FK NULL | Referrer user ID |
| ClaimedAt | DATETIME2 NULL | Claim timestamp |
| CompletedAt | DATETIME2 NULL | Completion timestamp |
| ProofURL | NVARCHAR(500) NULL | Proof file URL |
| ProofFileType | NVARCHAR(50) NULL | Proof file type |
| CreatedAt | DATETIME2 | Request creation |
| UpdatedAt | DATETIME2 | Last update |

**Referral Request Lifecycle:**
1. **Created**: Applicant creates request (₹50 deducted)
2. **Pending**: Waiting for referrer to claim
3. **Claimed**: Referrer claimed and will help
4. **Proof Submitted**: Referrer uploaded proof screenshot
5. **Completed**: Applicant verified and referrer rewarded
6. **Cancelled**: Request cancelled before completion

---

### 9. **ReferralProofs** - Proof uploads
Verification screenshots for referrals.

| Column | Type | Description |
|--------|------|-------------|
| ProofID | INT IDENTITY PK | Proof ID |
| ReferralRequestID | INT FK | Related request |
| ReferrerID | NVARCHAR(50) FK | Referrer user ID |
| ProofURL | NVARCHAR(500) | Azure Blob URL |
| FileType | NVARCHAR(50) | File extension |
| UploadedAt | DATETIME2 | Upload timestamp |

---

### 10. **ReferralRewards** - Points & rewards tracking
Tracks referrer earnings.

| Column | Type | Description |
|--------|------|-------------|
| RewardID | INT IDENTITY PK | Reward ID |
| ReferralRequestID | INT FK | Related request |
| ReferrerID | NVARCHAR(50) FK | Earning user |
| PointsEarned | INT | Points awarded |
| ConvertedToWallet | BIT | Converted status |
| ConvertedAmount | DECIMAL(18,2) | Wallet amount |
| ConvertedAt | DATETIME2 | Conversion time |
| CreatedAt | DATETIME2 | Reward creation |

**Points System:**
- Successfully completed referral: 100 points
- 100 points = ₹50 (conversion rate)

---

### 11. **Wallets** - User wallets
User wallet for paid features.

| Column | Type | Description |
|--------|------|-------------|
| WalletID | NVARCHAR(50) PK | UUID |
| UserID | NVARCHAR(50) FK | Wallet owner |
| Balance | DECIMAL(18,2) | Current balance |
| CurrencyID | INT FK | Currency |
| Status | NVARCHAR(50) | Active/Suspended |
| CreatedAt | DATETIME2 | Wallet creation |
| UpdatedAt | DATETIME2 | Last transaction |
| LastTransactionAt | DATETIME2 | Last activity |

---

### 12. **WalletTransactions** - Transaction log
Complete audit trail of wallet activity.

| Column | Type | Description |
|--------|------|-------------|
| TransactionID | NVARCHAR(50) PK | UUID |
| WalletID | NVARCHAR(50) FK | Related wallet |
| TransactionType | NVARCHAR(50) | Credit/Debit |
| Amount | DECIMAL(18,2) | Transaction amount |
| BalanceBefore | DECIMAL(18,2) | Balance before |
| BalanceAfter | DECIMAL(18,2) | Balance after |
| CurrencyID | INT FK | Currency |
| Source | NVARCHAR(100) | Transaction source |
| PaymentReference | NVARCHAR(255) | Payment gateway ref |
| Description | NVARCHAR(500) | Transaction description |
| Status | NVARCHAR(50) | Success/Failed/Pending |
| CreatedAt | DATETIME2 | Transaction time |

**Transaction Sources:**
- **Recharge**: Payment gateway top-up
- **Referral Request**: Debit for creating request (₹50)
- **AI Recommendations**: Debit for AI access (₹50)
- **Points Conversion**: Credit from referral points
- **Refund**: Credits for cancelled requests

---

### 13. **PaymentOrders** - Payment gateway orders
Razorpay/Cashfree payment orders.

| Column | Type | Description |
|--------|------|-------------|
| OrderID | NVARCHAR(50) PK | Payment gateway order ID |
| UserID | NVARCHAR(50) FK | User making payment |
| Amount | DECIMAL(18,2) | Order amount |
| CurrencyID | INT FK | Currency |
| Purpose | NVARCHAR(100) | Purchase purpose |
| Status | NVARCHAR(50) | Created/Paid/Failed |
| PaymentGateway | NVARCHAR(50) | Razorpay/Cashfree |
| CreatedAt | DATETIME2 | Order creation |
| PaidAt | DATETIME2 | Payment completion |

---

### 14. **WorkExperiences** - User work history
Employment history records.

| Column | Type | Description |
|--------|------|-------------|
| WorkExperienceID | INT IDENTITY PK | Experience ID |
| ApplicantID | NVARCHAR(50) FK | User ID |
| CompanyName | NVARCHAR(200) | Employer name |
| OrganizationID | INT FK NULL | Organization reference |
| JobTitle | NVARCHAR(200) | Position title |
| StartDate | DATE | Employment start |
| EndDate | DATE NULL | Employment end (NULL if current) |
| IsCurrent | BIT | Current job flag |
| Location | NVARCHAR(200) | Work location |
| Description | NVARCHAR(MAX) | Role description |
| Skills | NVARCHAR(MAX) | Skills used (JSON) |
| Achievements | NVARCHAR(MAX) | Key achievements |
| CreatedAt | DATETIME2 | Record creation |
| UpdatedAt | DATETIME2 | Last update |

---

### 15. **Conversations** - Messaging conversations
Direct message conversations between users.

| Column | Type | Description |
|--------|------|-------------|
| ConversationID | NVARCHAR(50) PK | UUID |
| Participant1ID | NVARCHAR(50) FK | First user |
| Participant2ID | NVARCHAR(50) FK | Second user |
| LastMessageAt | DATETIME2 | Last message time |
| LastMessagePreview | NVARCHAR(500) | Message snippet |
| IsArchived1 | BIT | Archived by user 1 |
| IsArchived2 | BIT | Archived by user 2 |
| IsMuted1 | BIT | Muted by user 1 |
| IsMuted2 | BIT | Muted by user 2 |
| CreatedAt | DATETIME2 | Conversation start |
| UpdatedAt | DATETIME2 | Last activity |

---

### 16. **Messages** - Chat messages
Individual messages within conversations.

| Column | Type | Description |
|--------|------|-------------|
| MessageID | NVARCHAR(50) PK | UUID |
| ConversationID | NVARCHAR(50) FK | Parent conversation |
| SenderID | NVARCHAR(50) FK | Message sender |
| ReceiverID | NVARCHAR(50) FK | Message receiver |
| Content | NVARCHAR(MAX) | Message text |
| IsRead | BIT | Read status |
| ReadAt | DATETIME2 | Read timestamp |
| IsDeleted | BIT | Deletion flag |
| DeletedBy | NVARCHAR(50) FK NULL | Who deleted |
| CreatedAt | DATETIME2 | Sent time |

---

### 17. **Organizations** - Companies database
Master list of companies/organizations.

| Column | Type | Description |
|--------|------|-------------|
| OrganizationID | INT IDENTITY PK | Organization ID |
| Name | NVARCHAR(200) | Company name |
| Website | NVARCHAR(255) | Company website |
| Type | NVARCHAR(100) | Company type |
| Industry | NVARCHAR(100) | Industry sector |
| Description | NVARCHAR(MAX) | Company description |
| LogoURL | NVARCHAR(500) | Logo image URL |
| Size | NVARCHAR(50) | Employee count |
| Founded | INT | Founded year |
| Headquarters | NVARCHAR(200) | HQ location |
| CountryID | INT FK | Country |
| IsFortune500 | BIT | Fortune 500 flag |
| LinkedInURL | NVARCHAR(255) | LinkedIn page |
| CreatedAt | DATETIME2 | Record creation |
| UpdatedAt | DATETIME2 | Last update |

---

### 18. **SavedJobs** - Bookmarked jobs
Jobs saved by users for later.

| Column | Type | Description |
|--------|------|-------------|
| SavedJobID | INT IDENTITY PK | Saved job ID |
| ApplicantID | NVARCHAR(50) FK | User ID |
| JobID | INT FK | Saved job |
| SavedAt | DATETIME2 | Bookmark time |

---

### 19. **ScrapingLogs** - Job scraper logs
Tracks automated job scraping runs.

| Column | Type | Description |
|--------|------|-------------|
| LogID | BIGINT IDENTITY PK | Log ID |
| RunID | NVARCHAR(100) | Run identifier |
| StartTime | DATETIMEOFFSET | Start time |
| EndTime | DATETIMEOFFSET | End time |
| Success | BIT | Success flag |
| JobsAdded | INT | New jobs count |
| IndiaJobs | INT | India-based jobs |
| TotalScraped | INT | Total processed |
| Sources | NVARCHAR(MAX) | Data sources (JSON) |
| ErrorCount | INT | Errors encountered |
| Errors | NVARCHAR(MAX) | Error messages (JSON) |
| TriggerType | NVARCHAR(50) | Manual/TimerTrigger |
| WasPastDue | BIT | Delayed execution flag |
| CreatedAt | DATETIMEOFFSET | Log creation |

---

## Entity Relationships

### Primary Relationships

```
Users (1) ──────────> (*) Applicants
Users (1) ──────────> (*) Employers
Users (1) ──────────> (*) Wallets
Users (1) ──────────> (*) ReferralRequests

Employers (1) ──────> (*) Jobs
Organizations (1) ───> (*) Jobs

Jobs (1) ────────────> (*) JobApplications
Applicants (1) ──────> (*) JobApplications
Applicants (1) ──────> (*) WorkExperiences
Applicants (1) ──────> (*) SavedJobs

ReferralPlans (1) ───> (*) ApplicantReferralSubscriptions
Applicants (1) ──────> (*) ReferralRequests
Users (1) ────────────> (*) ReferralRequests (as referrer)

ReferralRequests (1) -> (*) ReferralProofs
ReferralRequests (1) -> (*) ReferralRewards

Wallets (1) ─────────> (*) WalletTransactions
Users (1) ────────────> (*) PaymentOrders

Users (1) ────────────> (*) Conversations (participant1)
Users (1) ────────────> (*) Conversations (participant2)
Conversations (1) ────> (*) Messages
```

---

## Indexes and Performance

### Key Indexes

1. **Users Table**
   - Primary: UserID
   - Unique: Email, ReferralCode
   - Index: GoogleID, UserType, IsActive

2. **Jobs Table**
   - Primary: JobID
   - Composite: (Status, CreatedAt DESC)
   - Foreign Keys: EmployerID, OrganizationID

3. **JobApplications Table**
   - Primary: ApplicationID
   - Composite: (JobID, Status)
   - Composite: (ApplicantID, AppliedAt DESC)

4. **ReferralRequests Table**
   - Primary: ReferralRequestID
   - Composite: (Status, CreatedAt DESC)
   - Index: ApplicantID, ClaimedBy, ReferralType

5. **WalletTransactions Table**
   - Primary: TransactionID
   - Composite: (WalletID, CreatedAt DESC)
   - Index: TransactionType, Status

6. **ScrapingLogs Table**
   - Primary: LogID
   - Composite: (TriggerType, StartTime DESC)
   - Index: RunID

---

## Migrations

Database migrations are located in `database/migrations/` and are applied manually.

### Current Migrations

1. **005_add_external_job_fields.sql**
   - Adds JobTitle and JobURL columns to ReferralRequests
   - Enables external job referrals
   - Adds performance indexes

### Migration Process

```sql
-- Check if migration needed
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('ReferralRequests') 
               AND name = 'JobTitle')
BEGIN
    -- Apply migration
    ALTER TABLE ReferralRequests
    ADD JobTitle NVARCHAR(200) NULL;
END
```

---

## Data Integrity

### Foreign Key Constraints

All foreign key relationships are enforced with proper constraints:

```sql
ALTER TABLE Applicants
ADD CONSTRAINT FK_Applicants_Users
FOREIGN KEY (ApplicantID) REFERENCES Users(UserID);

ALTER TABLE Jobs
ADD CONSTRAINT FK_Jobs_Employers
FOREIGN KEY (EmployerID) REFERENCES Employers(EmployerID);
```

### Cascading Deletes

Some relationships use cascading deletes for data cleanup:
- Delete User → Cascade delete Wallet, Conversations, Messages
- Delete Job → Cascade delete JobApplications, SavedJobs

---

*Last Updated: December 5, 2025*
