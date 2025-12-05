# API Endpoints Reference

## Complete API Documentation for RefOpen (NexHire) Backend

This document provides a comprehensive reference of all API endpoints available in the RefOpen platform.

---

## Base URL

- **Production**: `https://refopen-api-func.azurewebsites.net/api`
- **Development**: `http://localhost:7071/api`

---

## Table of Contents

1. [Authentication & User Management](#authentication--user-management)
2. [Profile Management](#profile-management)
3. [Job Management](#job-management)
4. [Job Applications](#job-applications)
5. [Work Experience](#work-experience)
6. [Saved Jobs](#saved-jobs)
7. [Referral System](#referral-system)
8. [Wallet & Payments](#wallet--payments)
9. [Messaging System](#messaging-system)
10. [Storage & File Upload](#storage--file-upload)
11. [Reference Data](#reference-data)
12. [Job Scraper (Admin)](#job-scraper-admin)
13. [Employer Management](#employer-management)

---

## Authentication & User Management

### Register User
- **Endpoint**: `POST /auth/register`
- **Auth Required**: No
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "userType": "JobSeeker",
  "referralCode": "OPTIONAL_CODE"
}
```

### Login
- **Endpoint**: `POST /auth/login`
- **Auth Required**: No
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Google Login
- **Endpoint**: `POST /auth/google`
- **Auth Required**: No
- **Body**:
```json
{
  "accessToken": "google_access_token",
  "idToken": "google_id_token",
  "user": {
    "email": "user@gmail.com",
    "name": "John Doe",
    "photo": "url_to_photo"
  }
}
```

### Google Register
- **Endpoint**: `POST /auth/google-register`
- **Auth Required**: No
- **Body**:
```json
{
  "accessToken": "google_access_token",
  "idToken": "google_id_token",
  "userType": "JobSeeker",
  "user": {
    "email": "user@gmail.com",
    "name": "John Doe",
    "photo": "url_to_photo"
  }
}
```

### Logout
- **Endpoint**: `POST /auth/logout`
- **Auth Required**: Yes
- **Headers**: `Authorization: Bearer {token}`

### Refresh Token
- **Endpoint**: `POST /auth/refresh`
- **Auth Required**: No
- **Body**:
```json
{
  "refreshToken": "refresh_token_string"
}
```

### Get Profile
- **Endpoint**: `GET /users/profile`
- **Auth Required**: Yes
- **Headers**: `Authorization: Bearer {token}`

### Update Profile
- **Endpoint**: `PUT /users/profile`
- **Auth Required**: Yes
- **Headers**: `Authorization: Bearer {token}`
- **Body**: Profile update data (varies by user type)

### Update Education
- **Endpoint**: `PUT /users/education`
- **Auth Required**: Yes
- **Headers**: `Authorization: Bearer {token}`
- **Body**:
```json
{
  "institutionName": "University Name",
  "degree": "Bachelor's",
  "fieldOfStudy": "Computer Science",
  "graduationYear": 2020,
  "cgpaOrPercentage": 8.5
}
```

### Change Password
- **Endpoint**: `PUT /users/change-password`
- **Auth Required**: Yes
- **Body**:
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

### Get Dashboard Stats
- **Endpoint**: `GET /users/dashboard`
- **Auth Required**: Yes

### Deactivate Account
- **Endpoint**: `DELETE /users/account`
- **Auth Required**: Yes

### Get My Referral Code
- **Endpoint**: `GET /users/referral-code`
- **Auth Required**: Yes
- **Returns**: User's unique referral code and stats

---

## Profile Management

### Initialize Employer Profile
- **Endpoint**: `POST /employers/initialize`
- **Auth Required**: Yes (Employer only)
- **Body**:
```json
{
  "organizationID": "guid",
  "designation": "HR Manager",
  "department": "Human Resources"
}
```

---

## Job Management

### Create Job
- **Endpoint**: `POST /jobs`
- **Auth Required**: Yes (Employer only)
- **Body**:
```json
{
  "title": "Software Engineer",
  "description": "Job description here",
  "jobTypeID": "guid",
  "workplaceTypeID": "guid",
  "locationCity": "Bangalore",
  "locationCountry": "India",
  "minSalary": 800000,
  "maxSalary": 1200000,
  "currencyID": "guid",
  "experienceYears": 3,
  "requiredSkills": "Python, Django, PostgreSQL"
}
```

### Get All Jobs
- **Endpoint**: `GET /jobs`
- **Auth Required**: Yes
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `pageSize`: Items per page (default: 20)
  - `sortBy`: Field to sort by
  - `sortOrder`: asc or desc
  - `location`: Filter by location
  - `jobTypeID`: Filter by job type
  - `minSalary`: Minimum salary filter
  - `maxSalary`: Maximum salary filter

### Get Job by ID
- **Endpoint**: `GET /jobs/{jobId}`
- **Auth Required**: No
- **URL Parameters**: `jobId` (GUID)

### Update Job
- **Endpoint**: `PUT /jobs/{jobId}`
- **Auth Required**: Yes (Employer who created it)
- **URL Parameters**: `jobId` (GUID)
- **Body**: Updated job data

### Delete Job
- **Endpoint**: `DELETE /jobs/{jobId}`
- **Auth Required**: Yes (Employer who created it)

### Publish Job
- **Endpoint**: `POST /jobs/{jobId}/publish`
- **Auth Required**: Yes (Employer)

### Close Job
- **Endpoint**: `POST /jobs/{jobId}/close`
- **Auth Required**: Yes (Employer)

### Search Jobs
- **Endpoint**: `GET /jobs/search`
- **Auth Required**: Yes
- **Query Parameters**:
  - `query`: Search term
  - `location`: Location filter
  - `jobTypeID`: Job type filter
  - `workplaceTypeID`: Workplace type filter
  - `minSalary`, `maxSalary`: Salary range
  - `page`, `pageSize`: Pagination

### Get Jobs by Organization
- **Endpoint**: `GET /jobs/organization/{organizationId}`
- **Auth Required**: Yes

### Get Job Types
- **Endpoint**: `GET /jobs/types`
- **Auth Required**: No

### Get Currencies
- **Endpoint**: `GET /jobs/currencies`
- **Auth Required**: No

### Get AI Recommended Jobs (Premium)
- **Endpoint**: `POST /jobs/ai/recommendations`
- **Auth Required**: Yes
- **Cost**: ₹50 from wallet (24hr access)
- **Body**:
```json
{
  "limit": 20
}
```

### Get AI Job Filters (Free Preview)
- **Endpoint**: `GET /jobs/ai/filters`
- **Auth Required**: Yes
- **Returns**: AI-generated filters without deducting wallet

### Check AI Access Status
- **Endpoint**: `GET /jobs/ai/access-status`
- **Auth Required**: Yes
- **Returns**: Whether user has active 24hr AI access

---

## Job Applications

### Apply for Job
- **Endpoint**: `POST /applications`
- **Auth Required**: Yes (Job Seeker only)
- **Body**:
```json
{
  "jobID": "guid",
  "resumeID": "guid",
  "coverLetter": "Optional cover letter text"
}
```

### Get My Applications
- **Endpoint**: `GET /applications/my`
- **Auth Required**: Yes (Job Seeker)
- **Query Parameters**:
  - `status`: Filter by application status
  - `page`, `pageSize`: Pagination

### Get Job Applications (Employer)
- **Endpoint**: `GET /applications/job/{jobId}`
- **Auth Required**: Yes (Employer)
- **URL Parameters**: `jobId` (GUID)
- **Query Parameters**:
  - `status`: Filter by status
  - `page`, `pageSize`: Pagination

### Get Application Details
- **Endpoint**: `GET /applications/{applicationId}`
- **Auth Required**: Yes
- **URL Parameters**: `applicationId` (GUID)

### Update Application Status
- **Endpoint**: `PUT /applications/{applicationId}/status`
- **Auth Required**: Yes (Employer)
- **Body**:
```json
{
  "status": "Shortlisted",
  "notes": "Great candidate"
}
```
- **Status Options**: Applied, Shortlisted, Interviewing, Offered, Hired, Rejected

### Withdraw Application
- **Endpoint**: `DELETE /applications/{applicationId}`
- **Auth Required**: Yes (Job Seeker)

### Get Application Stats
- **Endpoint**: `GET /applications/stats`
- **Auth Required**: Yes

---

## Work Experience

### Get My Work Experiences
- **Endpoint**: `GET /work-experience/my`
- **Auth Required**: Yes

### Get Work Experience by ID
- **Endpoint**: `GET /work-experience/{experienceId}`
- **Auth Required**: Yes

### Create Work Experience
- **Endpoint**: `POST /work-experience`
- **Auth Required**: Yes
- **Body**:
```json
{
  "companyName": "Tech Corp",
  "designation": "Software Engineer",
  "employmentType": "Full-time",
  "startDate": "2020-01-01",
  "endDate": "2023-12-31",
  "isCurrent": false,
  "description": "Worked on backend systems",
  "location": "Bangalore, India"
}
```

### Update Work Experience
- **Endpoint**: `PUT /work-experience/{experienceId}`
- **Auth Required**: Yes
- **Body**: Updated experience data

### Delete Work Experience
- **Endpoint**: `DELETE /work-experience/{experienceId}`
- **Auth Required**: Yes

---

## Saved Jobs

### Save Job
- **Endpoint**: `POST /saved-jobs`
- **Auth Required**: Yes (Job Seeker)
- **Body**:
```json
{
  "jobID": "guid"
}
```

### Unsave Job
- **Endpoint**: `DELETE /saved-jobs/{jobId}`
- **Auth Required**: Yes

### Get My Saved Jobs
- **Endpoint**: `GET /saved-jobs/my`
- **Auth Required**: Yes
- **Query Parameters**: `page`, `pageSize`

---

## Referral System

### Get Referral Plans
- **Endpoint**: `GET /referral/plans`
- **Auth Required**: No
- **Returns**: All available referral subscription plans

### Purchase Referral Plan
- **Endpoint**: `POST /referral/plans/purchase`
- **Auth Required**: Yes
- **Body**:
```json
{
  "planID": "guid",
  "paymentID": "razorpay_payment_id"
}
```

### Get Current Subscription
- **Endpoint**: `GET /referral/subscription`
- **Auth Required**: Yes

### Check Referral Eligibility
- **Endpoint**: `GET /referral/eligibility`
- **Auth Required**: Yes
- **Returns**: Whether user can make more referrals today

### Create Referral Request
- **Endpoint**: `POST /referral/requests`
- **Auth Required**: Yes
- **Body**:
```json
{
  "jobID": "guid",
  "referralType": "internal",
  "jobTitle": "Software Engineer",
  "companyName": "Tech Corp",
  "jobUrl": "https://example.com/job",
  "description": "Need referral for this position"
}
```
- **Referral Types**: `internal` (platform jobs), `external` (off-platform jobs)

### Get My Referral Requests
- **Endpoint**: `GET /referral/my-requests`
- **Auth Required**: Yes

### Get Available Referral Requests
- **Endpoint**: `GET /referral/requests`
- **Auth Required**: Yes
- **Returns**: Referral requests available to claim

### Claim Referral Request
- **Endpoint**: `POST /referral/requests/{requestId}/claim`
- **Auth Required**: Yes
- **URL Parameters**: `requestId` (GUID)

### Submit Referral Proof
- **Endpoint**: `POST /referral/requests/{requestId}/proof`
- **Auth Required**: Yes
- **Body**:
```json
{
  "proofImageUrl": "url_to_screenshot",
  "notes": "Successfully referred"
}
```

### Verify Referral Completion
- **Endpoint**: `POST /referral/requests/{requestId}/verify`
- **Auth Required**: Yes (Request creator)
- **Body**:
```json
{
  "verified": true,
  "feedback": "Thanks for the referral!"
}
```

### Get My Referrer Requests
- **Endpoint**: `GET /referral/my-referrer-requests`
- **Auth Required**: Yes
- **Returns**: Requests user has claimed as referrer

### Cancel Referral Request
- **Endpoint**: `DELETE /referral/requests/{requestId}`
- **Auth Required**: Yes

### Get Referral Analytics
- **Endpoint**: `GET /referral/analytics`
- **Auth Required**: Yes

### Get Referrer Stats
- **Endpoint**: `GET /referral/referrer-stats`
- **Auth Required**: Yes

### Get Referral Points History
- **Endpoint**: `GET /referral/points-history`
- **Auth Required**: Yes

### Convert Points to Wallet
- **Endpoint**: `POST /referral/points/convert`
- **Auth Required**: Yes
- **Body**:
```json
{
  "points": 100
}
```

---

## Wallet & Payments

### Get Wallet
- **Endpoint**: `GET /wallet`
- **Auth Required**: Yes

### Get Wallet Balance
- **Endpoint**: `GET /wallet/balance`
- **Auth Required**: Yes

### Create Wallet Recharge Order
- **Endpoint**: `POST /wallet/recharge`
- **Auth Required**: Yes
- **Body**:
```json
{
  "amount": 500
}
```
- **Returns**: Razorpay order details

### Verify Wallet Recharge
- **Endpoint**: `POST /wallet/recharge/verify`
- **Auth Required**: Yes
- **Body**:
```json
{
  "razorpay_order_id": "order_id",
  "razorpay_payment_id": "payment_id",
  "razorpay_signature": "signature"
}
```

### Get Wallet Transactions
- **Endpoint**: `GET /wallet/transactions`
- **Auth Required**: Yes
- **Query Parameters**: `page`, `pageSize`, `type` (credit/debit)

### Get Recharge History
- **Endpoint**: `GET /wallet/recharges`
- **Auth Required**: Yes

### Get Wallet Stats
- **Endpoint**: `GET /wallet/stats`
- **Auth Required**: Yes

### Create Razorpay Order (General)
- **Endpoint**: `POST /payments/razorpay/order`
- **Auth Required**: Yes
- **Body**:
```json
{
  "amount": 1000,
  "currency": "INR",
  "receipt": "receipt_id",
  "notes": {}
}
```

### Verify Payment
- **Endpoint**: `POST /payments/razorpay/verify`
- **Auth Required**: Yes
- **Body**: Razorpay payment verification data

### Get Payment History
- **Endpoint**: `GET /payments/history`
- **Auth Required**: Yes

---

## Messaging System

### Get or Create Conversation
- **Endpoint**: `POST /messages/conversations`
- **Auth Required**: Yes
- **Body**:
```json
{
  "participantId": "user_guid"
}
```

### Get My Conversations
- **Endpoint**: `GET /messages/conversations`
- **Auth Required**: Yes

### Get Conversation Messages
- **Endpoint**: `GET /messages/conversations/{conversationId}/messages`
- **Auth Required**: Yes

### Send Message
- **Endpoint**: `POST /messages`
- **Auth Required**: Yes
- **Body**:
```json
{
  "conversationId": "guid",
  "content": "Message text",
  "attachments": []
}
```

### Mark Message as Read
- **Endpoint**: `PUT /messages/{messageId}/read`
- **Auth Required**: Yes

### Mark Conversation as Read
- **Endpoint**: `PUT /messages/conversations/{conversationId}/read`
- **Auth Required**: Yes

### Get Unread Count
- **Endpoint**: `GET /messages/unread/count`
- **Auth Required**: Yes

### Archive Conversation
- **Endpoint**: `PUT /messages/conversations/{conversationId}/archive`
- **Auth Required**: Yes

### Mute Conversation
- **Endpoint**: `PUT /messages/conversations/{conversationId}/mute`
- **Auth Required**: Yes

### Delete Message
- **Endpoint**: `DELETE /messages/{messageId}`
- **Auth Required**: Yes

### Block User
- **Endpoint**: `POST /messages/block/{userId}`
- **Auth Required**: Yes

### Unblock User
- **Endpoint**: `DELETE /messages/block/{userId}`
- **Auth Required**: Yes

### Get Blocked Users
- **Endpoint**: `GET /messages/blocked`
- **Auth Required**: Yes

### Record Profile View
- **Endpoint**: `POST /messages/profile-views/{userId}`
- **Auth Required**: Yes

### Get My Profile Views
- **Endpoint**: `GET /messages/profile-views/my`
- **Auth Required**: Yes

### Get Public Profile
- **Endpoint**: `GET /messages/profile/{userId}`
- **Auth Required**: Yes

### Search Users
- **Endpoint**: `GET /messages/users/search`
- **Auth Required**: Yes
- **Query Parameters**: `query` (search term)

---

## Storage & File Upload

### Upload File
- **Endpoint**: `POST /storage/upload`
- **Auth Required**: Yes
- **Body**:
```json
{
  "fileName": "resume.pdf",
  "fileData": "base64_encoded_file",
  "mimeType": "application/pdf",
  "containerName": "resumes"
}
```

### Delete File
- **Endpoint**: `DELETE /storage/{containerName}/{blobName}`
- **Auth Required**: Yes

---

## Reference Data

### Get Organizations
- **Endpoint**: `GET /organizations`
- **Auth Required**: No
- **Query Parameters**: 
  - `search`: Search term
  - `country`: Filter by country
  - `industry`: Filter by industry
  - `isFortune500`: Filter Fortune 500 companies

### Get Organization by ID
- **Endpoint**: `GET /organizations/{organizationId}`
- **Auth Required**: No

### Get Colleges
- **Endpoint**: `GET /colleges`
- **Auth Required**: No
- **Query Parameters**: `country`, `search`

### Get Universities by Country
- **Endpoint**: `GET /universities`
- **Auth Required**: No
- **Query Parameters**: `country` (required)

### Get Industries
- **Endpoint**: `GET /industries`
- **Auth Required**: No

### Get Countries
- **Endpoint**: `GET /countries`
- **Auth Required**: No

### Get Workplace Types
- **Endpoint**: `GET /workplace-types`
- **Auth Required**: No

---

## Job Scraper (Admin Only)

### Health Check
- **Endpoint**: `GET /jobs/scrape/health`
- **Auth Required**: No

### Trigger Job Scraping
- **Endpoint**: `POST /jobs/scrape/trigger`
- **Auth Required**: Yes (Admin only)
- **Body**: `{}`

### Get Scraping Stats
- **Endpoint**: `GET /jobs/scrape/stats`
- **Auth Required**: Yes (Admin)

### Get Scraping Logs
- **Endpoint**: `GET /jobs/scrape/logs`
- **Auth Required**: Yes (Admin)
- **Query Parameters**: `page`, `pageSize`

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "metadata": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer {your_access_token}
```

### Token Expiry
- **Access Token**: 24 hours
- **Refresh Token**: 30 days

Use the `/auth/refresh` endpoint to get a new access token using your refresh token.

---

## Rate Limiting

API requests are rate-limited per user:
- **Default**: 100 requests per minute
- **Authentication endpoints**: 5 requests per minute

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid request data |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `DUPLICATE_ENTRY` | Resource already exists |
| `INSUFFICIENT_BALANCE` | Not enough wallet balance |
| `QUOTA_EXCEEDED` | Referral quota exceeded |
| `INVALID_TOKEN` | JWT token is invalid |
| `EXPIRED_TOKEN` | JWT token has expired |

---

## WebSocket Events (SignalR)

For real-time messaging, connect to SignalR hub:
- **Hub URL**: `/api/signalr`

### Events
- `ReceiveMessage`: New message received
- `UserConnected`: User came online
- `UserDisconnected`: User went offline
- `MessageRead`: Message marked as read
- `ConversationUpdate`: Conversation metadata changed
