# RefOpen - Complete Technical Documentation

**Version:** 3.0  
**Last Updated:** January 2026  
**Platform:** Web (React Native/Expo) + Azure Functions Backend

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Backend API Reference](#4-backend-api-reference)
5. [Database Schema](#5-database-schema)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Authentication System](#7-authentication-system)
8. [Payment & Wallet System](#8-payment--wallet-system)
9. [Referral System](#9-referral-system)
10. [Job Scraping System](#10-job-scraping-system)
11. [Messaging System](#11-messaging-system)
12. [Notification System](#12-notification-system)
13. [File Storage](#13-file-storage)
14. [Company Verification System](#14-company-verification-system)
15. [Support Ticket System](#15-support-ticket-system)
16. [Business Rules & Constraints](#16-business-rules--constraints)
17. [Third-Party Integrations](#17-third-party-integrations)
18. [Deployment Guide](#18-deployment-guide)
19. [Environment Configuration](#19-environment-configuration)
20. [User Flows](#20-user-flows)
21. [Feature Flags & Error Handling](#21-feature-flags--error-handling)
22. [AI Job Recommendations](#22-ai-job-recommendations)

---

## 1. Executive Summary

### What is RefOpen?

RefOpen is a **comprehensive job platform** with three core offerings:

1. **Job Board** - Browse, search, and apply to jobs (free for job seekers)
2. **Job Posting** - Employers post jobs and manage applications
3. **Referral Marketplace** - Paid service connecting job seekers with company employees for internal referrals

### Platform Features

| Feature | Description | Cost |
|---------|-------------|------|
| **Browse Jobs** | Search 1000s of jobs from manual postings + automated scraping | Free |
| **Apply to Jobs** | Direct job applications with resume | Free |
| **Post Jobs** | Employers create and manage job listings | ₹50 (optional) |
| **Save Jobs** | Bookmark jobs for later | Free |
| **Request Referral** | Get internal referral from company employee | ₹39 per request |
| **External Referral** | Request referral for jobs not in our system | ₹39 per request |
| **AI Job Recommendations** | Personalized job matches based on profile | ₹99 (15 days access) |
| **Profile Views** | See who viewed your profile | ₹29 (7 days access) |
| **Messaging** | Real-time chat with referrers and employers | Free |
| **Support Tickets** | Customer support system | Free |

### Core Value Proposition

| User Type | Value |
|-----------|-------|
| **Job Seekers** | Browse jobs, apply directly, OR get internal referrals to 10x interview chances |
| **Employers** | Post jobs for free, receive applications, manage hiring pipeline |
| **Verified Referrers** | Earn passive income by referring candidates to their company |

### Complete Pricing (DB-Driven, Configurable)

| Feature | Price | Duration |
|---------|-------|----------|
| Referral Request | ₹39 | Per request |
| AI Job Recommendations | ₹99 | 15 days access |
| Profile Views Access | ₹29 | 7 days access |
| Job Publish (Employer) | ₹50 | Per job |
| Welcome Bonus | +₹100 | On signup |
| Referral Signup Bonus | +₹50 | Both parties |
| Points Conversion | 1 point = ₹0.50 | — |

### Key Metrics (Platform Capabilities)

- **22 Controllers** with 80+ API endpoints
- **30 Services** for business logic
- **42 Frontend Screens**
- **30+ Reusable Components**
- **5 Context Providers** for state management
- Multi-platform (iOS, Android, Web)
- Automated job scraping from 4 sources
- Real-time messaging via Azure SignalR
- Dual payment system (Razorpay + Manual)

---

## 2. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│   React Native (Expo) - iOS / Android / Web                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │   Screens   │  │  Components │  │  Services   │  │  Contexts   │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTPS/REST API
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
│   Azure Functions (Node.js/TypeScript)                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │ Controllers │  │  Services   │  │ Middleware  │  │   Timers    │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────────┐
        ▼                            ▼                                ▼
┌───────────────┐          ┌─────────────────┐              ┌────────────────┐
│  Azure SQL    │          │  Blob Storage   │              │  Key Vault     │
│  Database     │          │  (Files)        │              │  (Secrets)     │
└───────────────┘          └─────────────────┘              └────────────────┘

External Services:
┌───────────────┐  ┌─────────────────┐  ┌────────────────┐  ┌───────────────┐
│   Razorpay    │  │  Google OAuth   │  │    SignalR     │  │  Azure ACS    │
│  (Payments)   │  │  (Auth)         │  │  (Real-time)   │  │  (Email)      │
└───────────────┘  └─────────────────┘  └────────────────┘  └───────────────┘
```

### Request Flow

```
1. User Action (Frontend)
       │
       ▼
2. API Service (axios + JWT)
       │
       ▼
3. Azure Functions (HTTP Trigger)
       │
       ▼
4. Auth Middleware (JWT Validation)
       │
       ▼
5. Controller (Route Handler)
       │
       ▼
6. Service Layer (Business Logic)
       │
       ▼
7. Database (Azure SQL)
       │
       ▼
8. Response (JSON)
```

---

## 3. Technology Stack

### Backend

| Component | Technology |
|-----------|------------|
| Runtime | Azure Functions v4 |
| Language | TypeScript / Node.js 20 |
| Database | Azure SQL Server (MS SQL) |
| Storage | Azure Blob Storage |
| Secrets | Azure Key Vault |
| Real-time | Azure SignalR |
| Email | Azure Communication Services |
| Payments | Razorpay |

### Frontend

| Component | Technology |
|-----------|------------|
| Framework | React Native (Expo SDK) |
| Platforms | iOS, Android, Web |
| Navigation | React Navigation v6 |
| State | React Context API |
| Auth | Firebase + Google OAuth |
| Payments | Razorpay SDK |
| Ads | Google AdSense (Web) |

### Infrastructure

| Component | Service |
|-----------|---------|
| Compute | Azure Functions (Consumption) |
| Database | Azure SQL Database |
| Static Hosting | Azure Static Web Apps |
| CDN | Azure CDN (via Static Web Apps) |
| Monitoring | Application Insights |
| CI/CD | GitHub Actions |

---

## 4. Backend API Reference

### API Overview

**Base URL:** `https://refopen-api-func.azurewebsites.net/api`  
**Total Endpoints:** 71 functions

### Authentication Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | ❌ |
| POST | `/auth/login` | Email/password login | ❌ |
| POST | `/auth/google` | Google OAuth login | ❌ |
| POST | `/auth/google/register` | Register via Google | ❌ |
| POST | `/auth/logout` | Logout / Invalidate tokens | ✅ |
| POST | `/auth/refresh` | Refresh JWT tokens | ✅ |
| GET | `/health` | Health check | ❌ |

### User/Profile Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/profile` | Get user profile | ✅ |
| PUT | `/users/profile` | Update user profile | ✅ |
| PUT | `/users/profile/education` | Update education | ✅ |
| POST | `/users/change-password` | Change password | ✅ |
| POST | `/users/verify-email` | Verify email | ✅ |
| GET | `/users/dashboard` | Dashboard stats | ✅ |
| POST | `/users/deactivate` | Deactivate account | ✅ |
| POST | `/users/profile/picture` | Upload profile pic | ✅ |
| POST | `/users/resumes` | Upload resume | ✅ |
| GET | `/users/resumes` | List resumes | ✅ |
| PUT | `/users/resumes/{id}/primary` | Set primary resume | ✅ |
| DELETE | `/users/resumes/{id}` | Delete resume | ✅ |
| GET | `/users/referral-code` | Get referral code | ✅ |
| POST | `/employers/initialize` | Initialize employer | ✅ |

### Job Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/jobs` | List active jobs | ❌ |
| POST | `/jobs` | Create job | ✅ Employer |
| GET | `/jobs/{id}` | Get job details | ❌ |
| PUT | `/jobs/{id}` | Update job | ✅ Employer |
| DELETE | `/jobs/{id}` | Delete job | ✅ Employer |
| POST | `/jobs/{id}/publish` | Publish job | ✅ Employer |
| POST | `/jobs/{id}/close` | Close job | ✅ Employer |
| GET | `/jobs/search` | Search jobs | ❌ |
| GET | `/jobs/organization/{id}` | Organization jobs | ❌ |
| GET | `/jobs/ai-recommended` | AI recommendations | ✅ (₹99) |
| GET | `/jobs/ai-filters` | AI filters preview | ✅ |

### Application Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/applications` | Apply for job | ✅ |
| GET | `/applications/my` | My applications | ✅ |
| GET | `/applications/job/{id}` | Job applications | ✅ Employer |
| PUT | `/applications/{id}/status` | Update status | ✅ Employer |
| GET | `/applications/{id}` | Application details | ✅ |
| DELETE | `/applications/{id}` | Withdraw application | ✅ |

### Referral Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/referral/plans` | List referral plans | ❌ |
| POST | `/referral/plans/purchase` | Purchase plan | ✅ |
| GET | `/referral/subscription` | Current subscription | ✅ |
| POST | `/referral/requests` | Create referral request | ✅ (₹39) |
| GET | `/referral/requests/my` | My requests (seeker) | ✅ |
| GET | `/referral/available` | Available requests | ✅ Referrer |
| POST | `/referral/requests/{id}/claim` | Claim request | ✅ Referrer |
| POST | `/referral/requests/{id}/complete` | Submit proof | ✅ Referrer |
| POST | `/referral/requests/{id}/verify` | Verify completion | ✅ Seeker |
| POST | `/referral/requests/{id}/cancel` | Cancel request | ✅ |
| GET | `/referral/claimed` | My claimed requests | ✅ Referrer |
| GET | `/referral/completed` | Completed referrals | ✅ |
| GET | `/referral/dashboard` | Referral stats | ✅ |
| GET | `/referral/eligibility` | Check eligibility | ✅ |
| GET | `/referral/badge` | Badge stats | ✅ |
| GET | `/referral/points/history` | Points history | ✅ |
| POST | `/referral/points/convert` | Convert to wallet | ✅ |
| POST | `/referral/requests/{id}/log` | Log status change | ✅ |
| GET | `/referral/requests/{id}/history` | Status history | ✅ |

### Wallet Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/wallet` | Get wallet details | ✅ |
| GET | `/wallet/balance` | Get balance | ✅ |
| POST | `/wallet/recharge/order` | Create Razorpay order | ✅ |
| POST | `/wallet/recharge/verify` | Verify & credit | ✅ |
| GET | `/wallet/transactions` | Transaction history | ✅ |
| GET | `/wallet/recharge/history` | Recharge history | ✅ |
| GET | `/wallet/stats` | Wallet statistics | ✅ |
| POST | `/wallet/debit` | Debit wallet | ✅ |
| GET | `/wallet/withdrawable` | Withdrawable balance | ✅ |
| POST | `/wallet/withdraw` | Request withdrawal | ✅ |
| GET | `/wallet/withdrawals` | Withdrawal history | ✅ |

### Manual Payment Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/manual-payment/settings` | Get bank/UPI details | ✅ |
| POST | `/manual-payment/submit` | Submit payment proof | ✅ |
| GET | `/manual-payment/my-submissions` | My submissions | ✅ |
| GET | `/manual-payment/admin/pending` | Pending (admin) | ✅ Admin |
| GET | `/manual-payment/admin/all` | All payments (admin) | ✅ Admin |
| POST | `/manual-payment/admin/{id}/approve` | Approve | ✅ Admin |
| POST | `/manual-payment/admin/{id}/reject` | Reject | ✅ Admin |

### Messaging & Profile View Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/conversations` | Create/get conversation | ✅ |
| GET | `/conversations` | My conversations | ✅ |
| GET | `/conversations/{id}/messages` | Get messages | ✅ |
| PUT | `/conversations/{id}/archive` | Archive | ✅ |
| PUT | `/conversations/{id}/mute` | Mute | ✅ |
| PUT | `/conversations/{id}/read` | Mark read | ✅ |
| POST | `/messages` | Send message | ✅ |
| PUT | `/messages/{id}/read` | Mark message read | ✅ |
| DELETE | `/messages/{id}` | Delete message | ✅ |
| GET | `/messages/unread` | Unread count | ✅ |
| POST | `/users/block` | Block user | ✅ |
| DELETE | `/users/block/{id}` | Unblock user | ✅ |
| GET | `/users/block/{id}` | Check if blocked | ✅ |
| GET | `/users/blocked` | Blocked users list | ✅ |
| GET | `/users/search` | Search users | ✅ |
| POST | `/profile/view` | Track profile view | ✅ |
| GET | `/profile/views` | Who viewed my profile | ✅ (₹29) |
| GET | `/profile/{userId}` | View other user profile | ✅ |

### Paid Access Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/access/status` | Check feature access (ai_jobs, profile_views) | ✅ |
| GET | `/pricing` | Get all pricing settings | ❌ (cached 5min) |

### Verification Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/verification/company-email/send-otp` | Send OTP to company email | ✅ |
| POST | `/verification/company-email/verify-otp` | Verify OTP | ✅ |
| GET | `/verification/status` | Check verification status | ✅ |

### Reference Data Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/reference/{type}` | Get reference data (JobRole, Skill, etc.) | ❌ |
| GET | `/reference/{type}/categories` | Get categories | ❌ |
| POST | `/reference/bulk` | Bulk fetch (max 10 types) | ❌ |
| GET | `/reference/item/{id}` | Get by ID | ❌ |
| GET | `/organizations` | Organization dropdown | ❌ |
| GET | `/organizations/{id}` | Organization details | ❌ |
| GET | `/currencies` | Currency list | ❌ |
| GET | `/industries` | Industry list | ❌ |
| GET | `/colleges` | College search (external API) | ❌ |

### Support Ticket Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/support/tickets` | Create ticket | ✅ |
| GET | `/support/tickets/my` | User's tickets | ✅ |
| GET | `/support/tickets/{id}` | Single ticket | ✅ |
| PUT | `/support/admin/tickets/{id}` | Admin update | ✅ Admin |
| GET | `/support/admin/tickets` | Admin list all | ✅ Admin |
| GET | `/support/admin/stats` | Admin statistics | ✅ Admin |

### Saved Jobs Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/saved-jobs/{jobId}` | Save job | ✅ |
| DELETE | `/saved-jobs/{jobId}` | Unsave job | ✅ |
| GET | `/saved-jobs` | List saved jobs | ✅ |

### Work Experience Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/work-experience` | User's experiences | ✅ |
| GET | `/work-experience/applicant/{id}` | By applicant ID | ✅ |
| GET | `/work-experience/{id}` | Single experience | ✅ |
| POST | `/work-experience` | Create new | ✅ |
| PUT | `/work-experience/{id}` | Update | ✅ |
| DELETE | `/work-experience/{id}` | Delete | ✅ |
| GET | `/work-experience/current` | Current employment | ✅ |

### File Upload Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/storage/upload` | Generic file upload | ✅ |
| DELETE | `/storage/delete` | Delete file | ✅ |

### SignalR Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/signalr/negotiate` | SignalR connection | ✅ |

### Admin Dashboard Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/management/dashboard/overview` | Overview stats | ✅ Admin |
| GET | `/management/dashboard/users` | Users data | ✅ Admin |
| GET | `/management/dashboard/referrals` | Referrals data | ✅ Admin |
| GET | `/management/dashboard/transactions` | Transactions | ✅ Admin |

### Job Scraping Endpoints (Admin)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/scraper/manual` | Trigger manual scrape | ✅ Admin |
| GET | `/scraper/config` | Get scraper config | ✅ Admin |
| PUT | `/scraper/config` | Update config | ✅ Admin |
| GET | `/scraper/stats` | Scraping stats | ✅ Admin |
| DELETE | `/scraper/cleanup` | Cleanup old jobs | ✅ Admin |
| GET | `/scraper/health` | Scraper health | ❌ |

### Timer Triggers (Scheduled)

| Function | Schedule | Purpose |
|----------|----------|---------|
| `jobScraperTimer` | Every 2 hours | Scrape external jobs |
| `jobArchivalTimer` | Daily midnight | Archive old jobs |
| `notificationProcessorTimer` | Every 1 minute | Process notifications |

---

## 5. Database Schema

### Entity Relationship Overview

```
Users
  │
  ├── Applicants (1:1) ──── JobApplications (1:N) ──── Jobs
  │       │                                              │
  │       └── ReferralRequests ◄────────────────────────┘
  │               │
  ├── Employers (1:1) ──── Organizations (N:1)
  │
  ├── Wallets (1:1) ──── WalletTransactions (1:N)
  │       │
  │       └── WalletRechargeOrders (1:N)
  │       └── ManualPaymentSubmissions (1:N)
  │
  ├── Conversations (N:N via User1/User2)
  │       │
  │       └── Messages (1:N)
  │
  └── NotificationQueue (1:N)
```

### Core Tables

#### Users
```sql
CREATE TABLE Users (
    UserID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Email NVARCHAR(255) UNIQUE NOT NULL,
    Password NVARCHAR(255),           -- bcrypt hash
    UserType NVARCHAR(20) NOT NULL,   -- 'JobSeeker', 'Employer', 'Admin'
    FirstName NVARCHAR(100),
    LastName NVARCHAR(100),
    Phone NVARCHAR(20),
    ProfilePictureURL NVARCHAR(500),
    EmailVerified BIT DEFAULT 0,
    PhoneVerified BIT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    TwoFactorEnabled BIT DEFAULT 0,
    GoogleId NVARCHAR(255),           -- For Google OAuth
    LoginMethod NVARCHAR(20),         -- 'email', 'google'
    ReferredBy UNIQUEIDENTIFIER,      -- FK → Users
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
);
```

#### Applicants (Job Seekers)
```sql
CREATE TABLE Applicants (
    ApplicantID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserID UNIQUEIDENTIFIER UNIQUE NOT NULL REFERENCES Users(UserID),
    Nationality NVARCHAR(100),
    CurrentLocation NVARCHAR(255),
    LinkedInProfile NVARCHAR(500),
    PortfolioURL NVARCHAR(500),
    GithubProfile NVARCHAR(500),
    Headline NVARCHAR(255),
    Summary NVARCHAR(MAX),
    CurrentJobTitle NVARCHAR(255),
    CurrentCompany NVARCHAR(255),
    YearsOfExperience INT,
    TotalExperienceMonths INT,
    PreferredJobTypes NVARCHAR(500),      -- JSON array
    PreferredWorkTypes NVARCHAR(500),     -- JSON array
    ExpectedSalaryMin DECIMAL(15,2),
    ExpectedSalaryMax DECIMAL(15,2),
    PreferredCurrency NVARCHAR(10),
    NoticePeriod INT,                      -- days
    ImmediatelyAvailable BIT DEFAULT 0,
    WillingToRelocate BIT DEFAULT 0,
    IsOpenToWork BIT DEFAULT 1,
    ProfileCompleteness INT DEFAULT 0,     -- percentage
    ReferralPoints INT DEFAULT 0,
    OpenToRefer BIT DEFAULT 0,             -- Verified referrer status
    HideCurrentCompany BIT DEFAULT 0,
    HideSalaryDetails BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
);
```

#### Organizations
```sql
CREATE TABLE Organizations (
    OrganizationID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Type NVARCHAR(50),                     -- 'Corporation', 'Startup', etc.
    Industry NVARCHAR(100),
    Size NVARCHAR(50),                     -- '1-50', '51-200', etc.
    Website NVARCHAR(500),
    LogoURL NVARCHAR(500),
    Description NVARCHAR(MAX),
    Headquarters NVARCHAR(255),
    VerificationStatus NVARCHAR(50) DEFAULT 'Pending',
    EstablishedDate DATE,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE()
);
```

#### Jobs
```sql
CREATE TABLE Jobs (
    JobID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizationID INT REFERENCES Organizations(OrganizationID),
    PostedByUserID UNIQUEIDENTIFIER REFERENCES Users(UserID),
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    Requirements NVARCHAR(MAX),
    Location NVARCHAR(255),
    Country NVARCHAR(100),
    IsRemote BIT DEFAULT 0,
    WorkplaceType NVARCHAR(50),            -- 'Remote', 'Hybrid', 'On-site'
    SalaryRangeMin DECIMAL(15,2),
    SalaryRangeMax DECIMAL(15,2),
    CurrencyID INT,
    ExperienceMin INT,
    ExperienceMax INT,
    RequiredEducation NVARCHAR(100),
    Status NVARCHAR(50) DEFAULT 'Draft',   -- 'Draft', 'Published', 'Closed'
    ApplicationDeadline DATETIME2,
    PublishedAt DATETIME2,
    ExpiresAt DATETIME2,
    ExternalJobID NVARCHAR(255),           -- For scraped jobs
    ApplicationURL NVARCHAR(500),          -- External apply link
    Source NVARCHAR(100),                  -- 'manual', 'adzuna', 'remoteok'
    CreatedAt DATETIME2 DEFAULT GETUTCDATE()
);
```

#### Wallets
```sql
CREATE TABLE Wallets (
    WalletID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserID UNIQUEIDENTIFIER UNIQUE NOT NULL REFERENCES Users(UserID),
    Balance DECIMAL(10,2) DEFAULT 0,
    CurrencyID INT DEFAULT 1,              -- INR
    Status NVARCHAR(50) DEFAULT 'Active',
    LastTransactionAt DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE()
);
```

#### WalletTransactions
```sql
CREATE TABLE WalletTransactions (
    TransactionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    WalletID UNIQUEIDENTIFIER NOT NULL REFERENCES Wallets(WalletID),
    TransactionType NVARCHAR(50) NOT NULL, -- 'Credit', 'Debit'
    Amount DECIMAL(10,2) NOT NULL,
    BalanceBefore DECIMAL(10,2),
    BalanceAfter DECIMAL(10,2),
    Source NVARCHAR(100),                  -- 'Razorpay', 'Referral', 'Admin'
    PaymentReference NVARCHAR(255),
    Description NVARCHAR(500),
    Status NVARCHAR(50) DEFAULT 'Completed',
    CreatedAt DATETIME2 DEFAULT GETUTCDATE()
);
```

#### ReferralRequests
```sql
CREATE TABLE ReferralRequests (
    RequestID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    JobID UNIQUEIDENTIFIER,                 -- Nullable for external jobs
    ExtJobID NVARCHAR(255),                 -- For external jobs
    ApplicantID UNIQUEIDENTIFIER NOT NULL,  -- Job seeker
    ResumeID UNIQUEIDENTIFIER,
    Status NVARCHAR(50) DEFAULT 'Pending',  -- 'Pending', 'Claimed', 'Completed', 'Verified', 'Cancelled'
    AssignedReferrerID UNIQUEIDENTIFIER,    -- Referrer user
    OrganizationID INT,
    JobTitle NVARCHAR(255),
    ReferralMessage NVARCHAR(MAX),
    ReferralType NVARCHAR(50),              -- 'internal', 'external'
    ProofFileURL NVARCHAR(500),
    ProofDescription NVARCHAR(MAX),
    RequestedAt DATETIME2 DEFAULT GETUTCDATE(),
    ClaimedAt DATETIME2,
    CompletedAt DATETIME2,
    VerifiedAt DATETIME2
);
```

#### Conversations
```sql
CREATE TABLE Conversations (
    ConversationID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    User1ID UNIQUEIDENTIFIER NOT NULL REFERENCES Users(UserID),
    User2ID UNIQUEIDENTIFIER NOT NULL REFERENCES Users(UserID),
    LastMessageAt DATETIME2,
    LastMessagePreview NVARCHAR(255),
    User1Unread INT DEFAULT 0,
    User2Unread INT DEFAULT 0,
    User1Archived BIT DEFAULT 0,
    User2Archived BIT DEFAULT 0,
    User1Muted BIT DEFAULT 0,
    User2Muted BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE()
);
```

#### Messages
```sql
CREATE TABLE Messages (
    MessageID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ConversationID UNIQUEIDENTIFIER NOT NULL REFERENCES Conversations(ConversationID),
    SenderUserID UNIQUEIDENTIFIER NOT NULL REFERENCES Users(UserID),
    Content NVARCHAR(MAX),
    MessageType NVARCHAR(50) DEFAULT 'Text', -- 'Text', 'Image', 'File'
    AttachmentURL NVARCHAR(500),
    IsRead BIT DEFAULT 0,
    DeletedForSender BIT DEFAULT 0,
    DeletedForBoth BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE()
);
```

### Pricing Configuration (Dynamic)
```sql
CREATE TABLE PricingSettings (
    SettingKey NVARCHAR(100) PRIMARY KEY,
    SettingValue DECIMAL(10,2) NOT NULL,
    Description NVARCHAR(500),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
);

-- Default values:
-- AI_JOBS_COST: 99 (15 days access)
-- REFERRAL_REQUEST_COST: 39
-- JOB_PUBLISH_COST: 50
-- WELCOME_BONUS: 100
-- REFERRAL_SIGNUP_BONUS: 50
-- PROFILE_VIEW_COST: 29 (7 days access)
```

---

## 6. Frontend Architecture

### App Structure

```
frontend/
├── App.js                      # Entry point with providers
├── app.config.js               # Expo config
├── src/
│   ├── screens/                # All app screens (35+)
│   │   ├── auth/               # Login, registration flows
│   │   ├── home/               # Dashboard
│   │   ├── jobs/               # Job listing, details, create
│   │   ├── profile/            # Profile management
│   │   ├── referral/           # Referral system
│   │   ├── wallet/             # Wallet, payments
│   │   ├── messages/           # Chat system
│   │   ├── admin/              # Admin dashboard
│   │   └── legal/              # Terms, privacy, etc.
│   │
│   ├── components/             # Reusable components
│   │   ├── common/             # Buttons, inputs, modals
│   │   ├── jobs/               # JobCard, JobFilters
│   │   ├── profile/            # Profile sections
│   │   ├── modals/             # Various modals
│   │   └── ads/                # AdSense component
│   │
│   ├── contexts/               # State management
│   │   ├── AuthContext.js      # Auth state
│   │   ├── JobContext.js       # Jobs state
│   │   ├── ThemeContext.js     # Theme state
│   │   └── PricingContext.js   # Dynamic pricing
│   │
│   ├── services/               # API layer
│   │   ├── api.js              # Main API service
│   │   ├── googleAuth.js       # Google OAuth
│   │   └── messagingApi.js     # Chat API
│   │
│   ├── hooks/                  # Custom hooks
│   │   └── useResponsive.js    # Responsive design
│   │
│   ├── navigation/             # Navigation config
│   │   └── AppNavigator.js     # Stack + Tab nav
│   │
│   ├── styles/                 # Styling
│   │   └── theme.js            # Design tokens
│   │
│   └── config/                 # App config
│       └── appConfig.js        # Environment config
```

### Navigation Flow

```
Root Navigator
├── Auth Stack (logged out)
│   ├── LoginScreen
│   ├── Job Seeker Registration (4 screens)
│   └── Employer Registration (4 screens)
│
└── Main Stack (logged in)
    ├── MainTabs (Bottom Navigation)
    │   ├── Home
    │   ├── Jobs
    │   ├── AskReferral / Referrals
    │   └── Profile
    │
    └── Stack Screens (pushed over tabs)
        ├── JobDetails
        ├── Applications
        ├── Messages / Chat
        ├── Wallet / WalletRecharge
        ├── Settings
        └── ... (20+ more)
```

### State Management

| Context | Purpose | Key State |
|---------|---------|-----------|
| `AuthContext` | Authentication | user, tokens, loading |
| `JobContext` | Jobs data | jobs, filters, pagination |
| `ThemeContext` | Theme | theme (light/dark), mode |
| `PricingContext` | Pricing | pricing settings object |

### Key Screens

| Screen | Lines | Purpose |
|--------|-------|---------|
| `ProfileScreen.js` | 2700+ | Full profile management |
| `JobsScreen.js` | 1500+ | Job listing with filters |
| `AskReferralScreen.js` | 1200+ | Request referrals |
| `WalletScreen.js` | 800+ | Wallet management |
| `ChatScreen.js` | 700+ | Messaging |

### Responsive Design

```javascript
// useResponsive.js breakpoints
{
  mobile: 0-767px,
  tablet: 768-1023px,
  desktop: 1024-1279px,
  largeDesktop: 1280px+
}

// Usage
const { isMobile, isDesktop, responsiveValue } = useResponsive();
const padding = responsiveValue({ mobile: 16, tablet: 24, desktop: 32 });
```

---

## 7. Authentication System

### JWT Token Structure

```typescript
// Access Token (7 days)
{
  userId: string,
  email: string,
  userType: 'JobSeeker' | 'Employer' | 'Admin',
  type: 'access',
  iat: number,
  exp: number,
  iss: 'refopen-api',
  aud: 'refopen-app'
}

// Refresh Token (30 days)
{
  userId: string,
  type: 'refresh',
  iat: number,
  exp: number
}
```

### Auth Flows

#### Email/Password Login
```
1. User enters credentials
2. Backend validates password (bcrypt)
3. Backend generates access + refresh tokens
4. Frontend stores tokens in AsyncStorage
5. API service attaches token to requests
```

#### Google OAuth Login
```
1. User taps "Sign in with Google"
2. Expo AuthSession opens Google consent screen
3. Google returns access_token
4. Frontend sends token to backend
5. Backend validates with Google API
6. If user exists → Return JWT tokens
7. If new user → Redirect to registration flow
```

#### Token Refresh
```
1. API call returns 401 (expired)
2. API service catches error
3. Calls /auth/refresh with refresh token
4. Gets new access token
5. Retries original request
```

### Role-Based Access

| Role | Permissions |
|------|-------------|
| `JobSeeker` | Profile, apply, referral requests |
| `Employer` | + Post jobs, view applications |
| `Admin` | + All admin endpoints, manual payments |

---

## 8. Payment & Wallet System

### Razorpay Integration

```javascript
// Create Order
POST /wallet/recharge/order
{
  amount: 500  // INR
}
→ {
  orderId: "order_xxx",
  razorpayOrderId: "order_xxx",
  amount: 500,
  receipt: "WALLET_xxx_timestamp"
}

// After Razorpay payment
POST /wallet/recharge/verify
{
  razorpay_order_id: "order_xxx",
  razorpay_payment_id: "pay_xxx",
  razorpay_signature: "xxx"
}
→ {
  success: true,
  newBalance: 500
}
```

### Wallet Operations

| Operation | Amount | Trigger |
|-----------|--------|---------|
| Recharge | +X | User adds money |
| Referral Request | -₹39 | Create request |
| AI Recommendations | -₹99 | Use AI feature (15 days) |
| Referral Reward | +Variable | Complete referral |
| Welcome Bonus | +₹100 | New registration |
| Referral Signup | +₹50 | Referred user joins |

### Manual Payments (Backup)

For users who can't use Razorpay:

```
1. User views bank/UPI details
2. Makes offline payment
3. Uploads screenshot + reference number
4. Admin reviews submission
5. Admin approves → Wallet credited
```

---

## 9. Referral System

### User Roles

| Role | Description | Verification |
|------|-------------|--------------|
| **Job Seeker** | Requests referrals | None required |
| **Verified Referrer** | Provides referrals | Company email verified |

### Referral Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   JOB SEEKER    │     │    PLATFORM     │     │    REFERRER     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. Select job        │                       │
         │─────────────────────► │                       │
         │                       │                       │
         │  2. Pay ₹39           │                       │
         │─────────────────────► │                       │
         │                       │                       │
         │  3. Create request    │                       │
         │─────────────────────► │                       │
         │                       │                       │
         │                       │  4. Notify matching   │
         │                       │     referrers         │
         │                       │──────────────────────►│
         │                       │                       │
         │                       │  5. Claim request     │
         │                       │◄──────────────────────│
         │                       │                       │
         │                       │  6. Submit proof      │
         │                       │◄──────────────────────│
         │                       │                       │
         │  7. Verify completion │                       │
         │◄──────────────────────│                       │
         │                       │                       │
         │  8. Confirm           │                       │
         │─────────────────────► │                       │
         │                       │                       │
         │                       │  9. Credit reward     │
         │                       │──────────────────────►│
         │                       │                       │
```

### Request Status Flow

```
Pending → Claimed → Completed → Verified
                 ↘ Cancelled (any stage)
```

### Referrer Verification

To become a verified referrer:
1. User registers as Job Seeker
2. Verifies company email (e.g., user@company.com)
3. System matches email domain to organization
4. User becomes eligible to accept referrals for that company

---

## 10. Job Scraping System

### Sources

| Source | Type | Jobs/Run |
|--------|------|----------|
| RemoteOK | Remote jobs | 200 |
| Adzuna | Multi-country | 50/config |
| WeWorkRemotely | Categories | 25/category |
| HackerNews | Who's Hiring | 30 |

### Scraper Configuration

```javascript
{
  enabled: true,
  maxJobsPerRun: 1000,
  sources: {
    remoteok: { enabled: true, maxJobs: 200 },
    adzuna: { 
      enabled: true, 
      countries: ['in', 'us', 'gb'],
      categories: ['it-jobs', 'engineering-jobs']
    },
    weworkremotely: { enabled: true },
    hackernews: { enabled: true }
  },
  excludeKeywords: ['gambling', 'mlm', 'crypto'],
  excludeCompanies: ['Turing', 'Toptal']
}
```

### Features

- **Deduplication**: External job ID tracking prevents duplicates
- **Organization Matching**: Links scraped jobs to existing companies
- **Fortune 500 Enrichment**: Auto-adds logos and company data
- **Anti-Blocking**: Rotating user agents, random delays

### Schedule

| Timer | Schedule | Action |
|-------|----------|--------|
| Scraper | Every 2 hours | Fetch new jobs |
| Archival | Daily midnight | Archive jobs > 60 days |
| Cleanup | Manual | Remove expired jobs |

---

## 11. Messaging System

### Features

- Real-time conversations (polling-based currently)
- User blocking
- Archive/mute conversations
- Read receipts
- Desktop split-view layout

### Conversation Model

```javascript
{
  conversationId: "uuid",
  otherUser: { id, name, profilePic },
  lastMessage: "Hello...",
  lastMessageAt: "2026-01-05T10:00:00Z",
  unreadCount: 3,
  isArchived: false,
  isMuted: false
}
```

### Message Types

| Type | Description |
|------|-------------|
| `Text` | Plain text message |
| `Image` | Image attachment |
| `File` | Document attachment |

---

## 12. Notification System

### Channels

| Channel | Implementation |
|---------|----------------|
| Email | Azure Communication Services |
| Push | Planned (Firebase FCM) |
| In-App | Bell icon notification center |

### Notification Types

| Type | Trigger |
|------|---------|
| `new_referral_request` | Referrer has new request available |
| `referral_claimed` | Seeker's request was claimed |
| `referral_verified` | Referrer earned reward |
| `job_application` | Application status update |
| `message_received` | New chat message |
| `weekly_digest` | Weekly summary email |

### Queue Processing

- Timer runs every 1 minute
- Processes 50 notifications per batch
- 3 retry attempts on failure

---

## 13. File Storage

### Azure Blob Storage Containers

| Container | Purpose |
|-----------|---------|
| `profile-images` | User avatars |
| `resumes` | Resume PDFs |
| `referral-proofs` | Referral completion proofs |
| `company-logos` | Organization logos |
| `documents` | General documents |

### Upload Process

```javascript
// 1. Frontend sends base64
POST /users/profile/picture
{
  imageData: "data:image/jpeg;base64,..."
}

// 2. Backend validates
- Check file type (jpeg, png, gif, webp)
- Check size (< 10MB)
- Generate unique filename

// 3. Upload to Blob Storage
- Container: profile-images
- Path: {userId}_{timestamp}.{ext}

// 4. Return URL
{
  url: "https://refopenstorage.blob.core.windows.net/profile-images/..."
}
```

---

## 14. Company Verification System

### Purpose
Allows employees to verify their company email to become **Verified Referrers** who can accept referral requests.

### Blocked Email Domains
Personal email domains are blocked from verification:
- gmail.com, yahoo.com, hotmail.com, outlook.com
- live.com, icloud.com, mail.com, protonmail.com

### Verification Flow

```
1. User adds work experience with company
2. User enters company email (e.g., user@google.com)
3. System sends 4-digit OTP to company email
4. User enters OTP to verify
5. System matches email domain to organization
6. User becomes Verified Referrer for that company
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/verification/company-email/send-otp` | Send OTP to company email |
| POST | `/verification/company-email/verify-otp` | Verify OTP |
| GET | `/verification/status` | Check verification status |

---

## 15. Support Ticket System

### Categories
- Technical, Payment, Account, Referrals
- Jobs, Employer, General, Other

### Statuses
- Open → InProgress → Resolved → Closed

### Priorities
- Low, Medium, High, Urgent

### Validation Rules
- Subject: 5-200 characters
- Message: Minimum 10 characters

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/support/tickets` | Create ticket |
| GET | `/support/tickets/my` | User's tickets |
| GET | `/support/tickets/{id}` | Single ticket |
| PUT | `/support/admin/tickets/{id}` | Admin update |
| GET | `/support/admin/tickets` | Admin list all |
| GET | `/support/admin/stats` | Admin statistics |

---

## 16. Business Rules & Constraints

### Rate Limits
| Limit | Value |
|-------|-------|
| API Rate Limit | 100 requests / 15 minutes |
| Pagination Max | 100 items per page |
| Bulk Reference Fetch | Max 10 types |
| Message Search | Min 2 characters |

### File Upload Rules
| Rule | Value |
|------|-------|
| Max File Size | 10MB |
| Allowed Images | JPEG, PNG, GIF, WEBP |
| Allowed Documents | PDF, DOC, DOCX |
| Containers | resumes, profile-images, documents |

### Validation Rules
| Field | Rule |
|-------|------|
| Password | Minimum 8 characters |
| Email | RFC-compliant format |
| Job Title | 5-200 characters |
| Job Description | Minimum 20 characters |
| Organization Size | Max 50 characters |

### Wallet Constraints
| Constraint | Value |
|------------|-------|
| Minimum Recharge | No limit |
| Maximum Recharge | ₹1,00,000 |
| Withdrawal Methods | UPI, Bank Transfer |

### Referral Rules
| Rule | Value |
|------|-------|
| Proof Screenshot | Mandatory for claiming |
| Points Conversion | 1 point = ₹0.50 |
| Status Flow | Pending → Claimed → Completed → Verified |

### Job Scraper Rules
| Rule | Value |
|------|-------|
| Max Jobs Per Run | 500 (configurable 1-500) |
| Cleanup Days | 1-365 days |
| Excluded Keywords | gambling, mlm, crypto |

---

## 17. Third-Party Integrations

### 1. Razorpay (Payments)
- **Purpose**: Online payments for wallet recharge
- **Features**: Order creation, signature verification, webhook support
- **Modes**: Live + Test mode detection

### 2. Azure Communication Services (Email)
- **Purpose**: Transactional emails
- **Features**: Single + batch sending, email logging
- **Concurrency**: 10 parallel emails

### 3. Azure SignalR (Real-time)
- **Purpose**: Real-time chat messaging
- **Features**: WebSocket connections, fallback polling

### 4. Azure Blob Storage (Files)
- **Purpose**: File storage (resumes, images, documents)
- **Containers**: profile-images, resumes, documents, referral-proofs

### 5. Google OAuth
- **Purpose**: Social login
- **Platforms**: Web, Android, iOS (separate client IDs)
- **Flow**: Implicit OAuth 2.0 via Expo AuthSession

### 6. Firebase
- **Purpose**: Mobile authentication support
- **Features**: Token verification

### 7. Hipolabs Universities API
- **Purpose**: College/university autocomplete
- **Endpoint**: universities.hipolabs.com

### 8. Google AdSense (Web Only)
- **Purpose**: Display advertising
- **Publisher ID**: ca-pub-7167287641762329
- **Ad Slots**: Home, Jobs, Referral, About, Applications

---

## 18. Deployment Guide

### Prerequisites

- Azure CLI installed
- Node.js 20+
- Azure subscription

### Infrastructure Deployment

```powershell
# Create new environment (dev, staging, prod)
.\scripts\deployment\deploy-infrastructure.ps1 -Environment dev

# Dry run (preview only)
.\scripts\deployment\deploy-infrastructure.ps1 -Environment prod -DryRun
```

### Backend Deployment

```powershell
# Deploy to dev
.\deploy-backend.ps1 -Environment dev

# Deploy to prod
.\deploy-backend.ps1 -Environment prod
```

### Frontend Deployment

```powershell
# Deploy to dev
.\deployfe.ps1 -Environment dev

# Deploy to prod
.\deployfe.ps1 -Environment prod
```

### Environment Sync

```powershell
# Sync .env to Azure Function App settings
.\scripts\deployment\sync-env-variables.ps1 -Environment dev
```

---

## 19. Environment Configuration

### Backend (.env.{environment})

```env
# Server
NODE_ENV=development|production
PORT=7071

# Database (Key Vault references)
DB_SERVER=refopen-sqlserver-{env}.database.windows.net
DB_NAME=refopen-sql-db-{env}
DB_USER=sqladmin
DB_PASSWORD=@Microsoft.KeyVault(SecretUri=https://{keyvault}.vault.azure.net/secrets/SqlPassword/)

# Azure Storage
AZURE_STORAGE_ACCOUNT=refopenstorage{env}
AZURE_STORAGE_KEY=@Microsoft.KeyVault(...)

# Auth
JWT_SECRET=@Microsoft.KeyVault(...)

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=@Microsoft.KeyVault(...)

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

### Frontend (.env.{environment})

```env
EXPO_PUBLIC_API_URL=https://refopen-api-func-{env}.azurewebsites.net/api
EXPO_PUBLIC_ENVIRONMENT=development|production
EXPO_PUBLIC_RAZORPAY_KEY=rzp_test_xxx
EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

### Azure Resources per Environment

| Resource | Dev | Prod |
|----------|-----|------|
| Resource Group | refopen-dev-rg | refopen-prod-rg |
| SQL Server | refopen-sqlserver-dev | refopen-sqlserver-ci |
| Function App | refopen-api-func-dev | refopen-api-func |
| Static Web App | refopen-frontend-dev | refopen-frontend-web |
| Key Vault | refopen-kv-dev | refopen-keyvault-prod |

### Estimated Monthly Costs

| Environment | Cost |
|-------------|------|
| Dev | ~$20-30/month |
| Staging | ~$25-35/month |
| Production | ~$100-150/month |

---

## 20. User Flows

### Job Seeker Registration Flow
```
Login → Google/Email → ExperienceType (Fresher/Experienced) → WorkExperience → Education → PersonalDetails → Home
```

### Employer Registration Flow
```
Login → EmployerType (HR/Recruiter) → CreateOrganization → PersonalDetails → Account → Home
```

### Job Application Flow
```
Jobs → JobDetails → Apply → ResumeSelect → Submit → MyApplications
```

### Referral Request Flow (Internal Job)
```
Jobs → JobDetails → Ask Referral → ConfirmCost (₹39) → ResumeSelect → Submit → MyReferralRequests
```

### Referral Request Flow (External Job)
```
AskReferral → Enter Company/Job URL → ConfirmCost (₹39) → ResumeUpload → Submit → MyReferralRequests
```

### Referrer Flow (Verified Employees)
```
Referrals → ViewRequest → Claim → UploadProof → Submit → EarnPoints → ConvertToWallet
```

### Wallet Recharge Flow
```
Profile → Wallet → AddMoney → Razorpay/ManualPay → PaymentSuccess → UpdatedBalance
```

### Company Verification Flow
```
Profile → WorkExperience → AddCompanyEmail → ReceiveOTP → VerifyOTP → BecomeVerifiedReferrer
```

---

---

## 21. Feature Flags & Error Handling

| Flag | Purpose | Default |
|------|---------|---------|
| `referralSystem` | Enable/disable referral features | true |
| `googleSignIn` | Enable/disable Google OAuth | true |
| `paymentSystem` | Enable/disable payments | true |
| `jobScraping` | Enable/disable auto scraping | true |

### Custom Error Types
| Error | HTTP Code | Usage |
|-------|-----------|-------|
| `ValidationError` | 400 | Invalid input |
| `AuthenticationError` | 401 | Invalid/expired token |
| `AuthorizationError` | 403 | Permission denied |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Duplicate resource |
| `InsufficientBalanceError` | 402 | Wallet balance too low |

### CORS Configuration
All responses include CORS headers for cross-origin requests.

---

## 22. AI Job Recommendations

### How It Works
1. Analyzes user's work history, education, and skills
2. Infers preferred job type, workplace, and salary
3. Maps education to relevant job domains
4. Estimates salary based on experience
5. Returns personalized job matches

### Access Model
- **Cost**: ₹99
- **Duration**: 15 days access
- **Endpoint**: `GET /jobs/ai-recommended`
- **Free Preview**: `GET /jobs/ai-filters` (shows filters, no jobs)

---

*This documentation is auto-generated and maintained. Last update: January 2026*
