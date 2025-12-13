# Backend API Architecture

## 📋 Table of Contents
- [Overview](#overview)
- [API Structure](#api-structure)
- [Controllers](#controllers)
- [Services](#services)
- [Middleware](#middleware)
- [Authentication Flow](#authentication-flow)
- [API Endpoints Reference](#api-endpoints-reference)

---

## Overview

The RefOpen backend is built as a serverless Azure Functions application using TypeScript. It follows a **layered architecture** pattern with clear separation of concerns:

- **Controllers**: Handle HTTP requests/responses and request validation
- **Services**: Contain business logic and data operations
- **Middleware**: Handle cross-cutting concerns (auth, CORS, error handling)
- **Types**: Define TypeScript interfaces and types
- **Utils**: Provide utility functions

### Technology Stack
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.9.2
- **Framework**: Azure Functions v4
- **Database**: Azure SQL (mssql 10.0.2)
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **File Storage**: Azure Blob Storage
- **Payment**: Razorpay 2.9.6
- **Real-time**: SignalR, Socket.io 4.8.1

---

## API Structure

### Entry Point: `index.ts`

All API endpoints are registered in the main `index.ts` file using the Azure Functions HTTP trigger pattern:

```typescript
app.http("endpoint-name", {
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/path",
  handler: withErrorHandling(controllerFunction)
});
```

### Base URL Structure

```
Development:  http://localhost:7071/api
Production:   https://refopen-api-func.azurewebsites.net/api
```

---

## Controllers

All controllers are located in `src/controllers/` and handle specific business domains.

### 1. **user.controller.ts** - User Management
Handles user authentication, registration, profile management, and account operations.

**Key Functions:**
- `register()` - User registration (JobSeeker/Employer)
- `login()` - Email/password authentication
- `logout()` - Logout and token invalidation
- `googleLogin()` - Google OAuth authentication
- `googleRegister()` - Google OAuth registration
- `getProfile()` - Fetch user profile
- `updateProfile()` - Update user information
- `updateEducation()` - Update education details
- `changePassword()` - Password change
- `verifyEmail()` - Email verification
- `getDashboardStats()` - User dashboard statistics
- `deactivateAccount()` - Account deactivation
- `refreshToken()` - Refresh JWT token
- `getMyReferralCode()` - Get user's referral code and stats

### 2. **job.controller.ts** - Job Management
Manages job postings, searching, and job-related operations.

**Key Functions:**
- `createJob()` - Create new job posting
- `getJobs()` - List all jobs with filters
- `getJobById()` - Get specific job details
- `updateJob()` - Update job posting
- `deleteJob()` - Delete job posting
- `publishJob()` - Publish draft job
- `closeJob()` - Close active job
- `searchJobs()` - Advanced job search
- `getJobsByOrganization()` - Organization's jobs
- `getJobTypes()` - Available job types
- `getCurrencies()` - Supported currencies
- `getAIRecommendedJobs()` - AI-powered job recommendations (paid)
- `getAIJobFilters()` - Get AI filter preview (free)
- `checkAIAccessStatus()` - Check 24hr AI access status

### 3. **job-application.controller.ts** - Application Management
Handles job application workflow from submission to hiring.

**Key Functions:**
- `applyForJob()` - Submit job application
- `getMyApplications()` - User's application history
- `getJobApplications()` - Applications for a job (employer)
- `updateApplicationStatus()` - Update application status
- `withdrawApplication()` - Withdraw application
- `getApplicationDetails()` - Detailed application view
- `getApplicationStats()` - Application statistics

### 4. **referral.controller.ts** - Referral System
Manages the referral marketplace, subscriptions, and rewards.

**Key Functions:**
- `getReferralPlans()` - Available subscription plans
- `purchaseReferralPlan()` - Buy referral subscription
- `getCurrentSubscription()` - Active subscription details
- `checkReferralEligibility()` - Check if user can refer
- `createReferralRequest()` - Create new referral request
- `getMyReferralRequests()` - User's referral requests
- `getAvailableRequests()` - Browse available referrals
- `claimReferralRequest()` - Claim a referral
- `submitReferralProof()` - Upload referral proof
- `verifyReferralCompletion()` - Verify referral success
- `getMyReferrerRequests()` - Referrer's active requests
- `getReferralAnalytics()` - Referral performance analytics
- `cancelReferralRequest()` - Cancel referral request
- `getReferrerStats()` - Referrer statistics
- `getReferralPointsHistory()` - Points transaction history
- `convertPointsToWallet()` - Convert points to wallet balance

### 5. **wallet.controller.ts** - Wallet System
Manages user wallet, recharges, and transactions.

**Key Functions:**
- `getWallet()` - Get wallet details
- `getWalletBalance()` - Current balance
- `createWalletRechargeOrder()` - Initiate recharge (Razorpay)
- `verifyWalletRecharge()` - Verify payment and credit
- `getWalletTransactions()` - Transaction history
- `getRechargeHistory()` - Recharge history
- `getWalletStats()` - Wallet statistics
- `debitWallet()` - Deduct from wallet (internal)

### 6. **payment.controller.ts** - Payment Processing
Handles Razorpay payment integration.

**Key Functions:**
- `createRazorpayOrder()` - Create payment order
- `verifyPaymentAndActivateSubscription()` - Verify and activate
- `getPaymentHistory()` - Payment transaction history

### 7. **messaging.controller.ts** - Real-time Messaging
Manages direct messaging between users.

**Key Functions:**
- `getOrCreateConversation()` - Start/get conversation
- `getMyConversations()` - User's conversations
- `getConversationMessages()` - Message history
- `sendMessage()` - Send new message
- `markMessageAsRead()` - Mark message read
- `markConversationAsRead()` - Mark all messages read
- `getUnreadCount()` - Unread message count
- `archiveConversation()` - Archive conversation
- `muteConversation()` - Mute notifications
- `deleteMessage()` - Delete message
- `blockUser()` - Block user
- `unblockUser()` - Unblock user
- `checkIfBlocked()` - Check block status
- `getBlockedUsers()` - List blocked users
- `recordProfileView()` - Track profile view
- `getMyProfileViews()` - Who viewed profile
- `getPublicProfile()` - Get public user profile
- `searchUsers()` - Search users

### 8. **work-experience.controller.ts** - Work Experience
Manages user work experience records.

**Key Functions:**
- `getMyWorkExperiences()` - User's work history
- `getWorkExperiences()` - Get applicant's experience
- `getWorkExperienceById()` - Single record
- `createWorkExperience()` - Add experience
- `updateWorkExperience()` - Update record
- `deleteWorkExperience()` - Remove record

### 9. **saved-jobs.controller.ts** - Saved Jobs
Manages user's saved/bookmarked jobs.

**Key Functions:**
- `saveJob()` - Save job for later
- `unsaveJob()` - Remove saved job
- `getMySavedJobs()` - List saved jobs

### 10. **employer.controller.ts** - Employer Operations
Employer-specific operations.

**Key Functions:**
- `initializeEmployer()` - Initialize employer profile

### 11. **reference.controller.ts** - Reference Data
Provides lookup/reference data.

**Key Functions:**
- `getOrganizations()` - List organizations/companies
- `getOrganizationById()` - Organization details
- `getColleges()` - Educational institutions
- `getUniversitiesByCountry()` - Universities by country
- `getIndustries()` - Industry list
- `getCountries()` - Country list
- `getWorkplaceTypes()` - Workplace types (Remote, Hybrid, Onsite)

### 12. **storage.controller.ts** - File Storage
Handles file uploads to Azure Blob Storage.

**Key Functions:**
- `uploadFile()` - Upload file (resumes, images, proofs)
- `deleteFile()` - Delete file from storage

### 13. **job-scraper.controller.ts** - Job Scraping
External job scraping functionality (Beta).

**Key Functions:**
- Job scraping from Adzuna API
- Organization enrichment
- Scheduled scraping management

### 14. **signalr.controller.ts** - SignalR Hub
Real-time communication hub for messaging.

### 15. **debug.controller.ts** - Debug/Testing
Debug endpoints for development and testing.

---

## Services

Services contain the core business logic and data access layer. Located in `src/services/`.

### Key Services

#### **auth.service.ts** - Authentication
- Password hashing (bcrypt)
- JWT token generation/verification
- Token payload management
- Permission validation

#### **user.service.ts** - User Operations
- User CRUD operations
- Profile management
- Email verification
- Password reset

#### **job.service.ts** - Job Operations
- Job CRUD operations
- Job search and filtering
- Status management
- Organization linking

#### **job-application.service.ts** - Application Logic
- Application submission
- Status tracking
- Application retrieval
- Statistics calculation

#### **referral.service.ts** - Referral Logic
- Subscription management
- Referral request handling
- Proof verification
- Points and rewards system
- External job matching

#### **wallet.service.ts** - Wallet Operations
- Wallet creation
- Balance management
- Transaction recording
- Razorpay integration
- Credit/debit operations

#### **razorpay.service.ts** - Payment Gateway
- Order creation
- Payment verification
- Webhook handling
- Signature validation

#### **messaging.service.ts** - Messaging Logic
- Conversation management
- Message sending/receiving
- Read receipt tracking
- Block/mute functionality

#### **ai-job-recommendation.service.ts** - AI Recommendations
- Job matching algorithm
- Preference analysis
- 24-hour access management
- Wallet deduction for paid features

#### **database.service.ts** - Database Access
- SQL query execution
- Connection pooling
- Transaction management
- Error handling

#### **profile.service.ts** - Profile Management
- Applicant profile operations
- Employer profile operations
- Profile completeness calculation

#### **work-experience.service.ts** - Experience Management
- Work experience CRUD
- Validation logic

#### **saved-jobs.service.ts** - Saved Jobs
- Save/unsave operations
- Saved jobs retrieval

#### **job-scraper.service.ts** - Job Scraping
- Adzuna API integration
- Job data parsing
- Organization enrichment

#### **resume-upload.service.ts** - Resume Management
- Resume upload to Blob Storage
- Resume metadata tracking

#### **profile-image.service.ts** - Profile Images
- Image upload
- Image processing
- Storage management

#### **websocket.service.ts** - WebSocket
- Socket.io integration
- Real-time event handling

#### **signalr.service.ts** - SignalR
- SignalR hub management
- Message broadcasting

---

## Middleware

Located in `src/middleware/`.

### **Error Handling Middleware**
```typescript
export const withErrorHandling = (handler: Function) => {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      // Centralized error handling
      return {
        status: error.statusCode || 500,
        jsonBody: {
          success: false,
          error: error.message
        }
      };
    }
  };
};
```

### **CORS Middleware**
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
```

### **Authentication Middleware**
```typescript
export const authenticate = (req) => {
  const token = extractToken(req.headers.authorization);
  const payload = AuthService.verifyToken(token);
  return payload;
};
```

---

## Authentication Flow

### 1. Registration Flow
```
User → POST /auth/register
  → Validate input
  → Hash password
  → Create user record
  → Generate JWT tokens
  → Return access + refresh tokens
```

### 2. Login Flow
```
User → POST /auth/login
  → Validate credentials
  → Verify password (bcrypt)
  → Generate JWT tokens
  → Return access + refresh tokens
```

### 3. Protected Endpoint Access
```
User → GET /jobs (with Authorization: Bearer <token>)
  → Extract token from header
  → Verify JWT signature
  → Check token expiration
  → Extract user info from payload
  → Process request
  → Return response
```

### 4. Token Refresh
```
User → POST /auth/refresh (with refresh token)
  → Verify refresh token
  → Generate new access token
  → Return new access token
```

### 5. Google OAuth Flow
```
User → POST /auth/google (with Google ID token)
  → Verify Google token
  → Check if user exists
  → Create user if new
  → Generate JWT tokens
  → Return access + refresh tokens
```

---

## API Endpoints Reference

### Authentication Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Email/password login | No |
| POST | `/auth/google` | Google OAuth login | No |
| POST | `/auth/google-register` | Google OAuth register | No |
| POST | `/auth/logout` | Logout | Yes |
| POST | `/auth/refresh` | Refresh access token | No (refresh token) |

### User Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/profile` | Get user profile | Yes |
| PUT | `/users/profile` | Update profile | Yes |
| PUT | `/users/education` | Update education | Yes |
| POST | `/users/change-password` | Change password | Yes |
| POST | `/users/verify-email` | Verify email | No |
| GET | `/users/dashboard-stats` | Dashboard stats | Yes |
| POST | `/users/deactivate` | Deactivate account | Yes |
| GET | `/users/referral-code` | Get referral code | Yes |

### Job Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/jobs` | List jobs | No |
| POST | `/jobs` | Create job | Yes (Employer) |
| GET | `/jobs/{id}` | Get job details | No |
| PUT | `/jobs/{id}` | Update job | Yes (Employer) |
| DELETE | `/jobs/{id}` | Delete job | Yes (Employer) |
| POST | `/jobs/{id}/publish` | Publish job | Yes (Employer) |
| POST | `/jobs/{id}/close` | Close job | Yes (Employer) |
| GET | `/search/jobs` | Search jobs | No |
| GET | `/jobs/organization/{orgId}` | Organization jobs | No |
| GET | `/jobs/types` | Job types list | No |
| GET | `/jobs/currencies` | Currencies list | No |

### AI Job Recommendation Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/jobs/ai/recommended` | Get AI recommendations (₹50) | Yes |
| GET | `/jobs/ai/filters` | Get AI filter preview (Free) | Yes |
| GET | `/jobs/ai/access-status` | Check AI access status | Yes |

### Job Application Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/applications` | Apply for job | Yes (JobSeeker) |
| GET | `/applications/my` | My applications | Yes (JobSeeker) |
| GET | `/applications/job/{jobId}` | Job applications | Yes (Employer) |
| PUT | `/applications/{id}/status` | Update status | Yes (Employer) |
| POST | `/applications/{id}/withdraw` | Withdraw | Yes (JobSeeker) |
| GET | `/applications/{id}` | Application details | Yes |
| GET | `/applications/stats` | Statistics | Yes |

### Referral Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/referral/plans` | List plans | No |
| POST | `/referral/subscribe` | Purchase plan | Yes |
| GET | `/referral/subscription` | Current subscription | Yes |
| GET | `/referral/eligibility` | Check eligibility | Yes |
| POST | `/referral/requests` | Create request (₹50) | Yes |
| GET | `/referral/requests/my` | My requests | Yes |
| GET | `/referral/requests/available` | Browse requests | Yes |
| POST | `/referral/requests/{id}/claim` | Claim request | Yes |
| POST | `/referral/requests/{id}/proof` | Submit proof | Yes |
| POST | `/referral/requests/{id}/verify` | Verify completion | Yes |
| GET | `/referral/referrer/requests` | Referrer's requests | Yes |
| GET | `/referral/analytics` | Analytics | Yes |
| DELETE | `/referral/requests/{id}` | Cancel request | Yes |
| GET | `/referral/stats` | Referrer stats | Yes |
| GET | `/referral/points/history` | Points history | Yes |
| POST | `/referral/points/convert` | Convert to wallet | Yes |

### Wallet Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/wallet` | Get wallet | Yes |
| GET | `/wallet/balance` | Get balance | Yes |
| POST | `/wallet/recharge` | Create recharge order | Yes |
| POST | `/wallet/recharge/verify` | Verify recharge | Yes |
| GET | `/wallet/transactions` | Transaction history | Yes |
| GET | `/wallet/recharges` | Recharge history | Yes |
| GET | `/wallet/stats` | Wallet statistics | Yes |

### Messaging Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/messages/conversations` | List conversations | Yes |
| POST | `/messages/conversations` | Create conversation | Yes |
| GET | `/messages/conversations/{id}` | Get messages | Yes |
| POST | `/messages` | Send message | Yes |
| PUT | `/messages/{id}/read` | Mark read | Yes |
| PUT | `/messages/conversations/{id}/read` | Mark all read | Yes |
| GET | `/messages/unread-count` | Unread count | Yes |
| PUT | `/messages/conversations/{id}/archive` | Archive | Yes |
| PUT | `/messages/conversations/{id}/mute` | Mute | Yes |
| DELETE | `/messages/{id}` | Delete message | Yes |

### Work Experience Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/work-experiences/my` | My experience | Yes |
| POST | `/work-experiences` | Add experience | Yes |
| GET | `/work-experiences/{id}` | Get experience | Yes |
| PUT | `/work-experiences/{id}` | Update experience | Yes |
| DELETE | `/work-experiences/{id}` | Delete experience | Yes |

### Saved Jobs Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/saved-jobs` | Save job | Yes |
| DELETE | `/saved-jobs/{jobId}` | Unsave job | Yes |
| GET | `/saved-jobs` | List saved jobs | Yes |

### Reference Data Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/organizations` | List organizations | No |
| GET | `/organizations/{id}` | Organization details | No |
| GET | `/colleges` | List colleges | No |
| GET | `/universities/{country}` | Universities by country | No |
| GET | `/industries` | List industries | No |
| GET | `/countries` | List countries | No |
| GET | `/workplace-types` | Workplace types | No |

### Storage Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/storage/upload` | Upload file | Yes |
| DELETE | `/storage/delete` | Delete file | Yes |

### Profile Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/applicants/{userId}/profile` | Get applicant profile | Yes |
| PUT | `/applicants/{userId}/profile` | Update applicant profile | Yes |
| GET | `/employers/{userId}/profile` | Get employer profile | Yes |
| PUT | `/employers/{userId}/profile` | Update employer profile | Yes |

### Employer Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/employers/initialize` | Initialize employer | Yes |

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### HTTP Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request (validation error)
- **401**: Unauthorized (invalid/missing token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate resource)
- **500**: Internal Server Error

---

## Rate Limiting

Rate limiting is configured per environment:
- **Development**: 1000 requests per 15 minutes
- **Production**: Configurable via `RATE_LIMIT_MAX_REQUESTS`

---

*Last Updated: December 5, 2025*
