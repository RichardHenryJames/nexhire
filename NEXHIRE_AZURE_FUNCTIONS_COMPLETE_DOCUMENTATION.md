# ?? NexHire Azure Functions API - Complete Documentation

## ??? **Architecture Overview**

The NexHire backend is built using **Azure Functions v4** with a single-entry point architecture. All 30 function endpoints are registered in `index.ts` and deployed to:

**?? Base URL:** `https://nexhire-api-func.azurewebsites.net/api`

### **Tech Stack:**
- **Runtime:** Azure Functions v4 (Node.js 18)
- **Language:** TypeScript
- **Database:** Azure SQL Database
- **Authentication:** JWT Bearer Tokens
- **CORS:** Enabled for all endpoints
- **Error Handling:** Centralized middleware

---

## ?? **Function Categories (30 Total)**

### ?? **1. AUTHENTICATION & USER MANAGEMENT (11 Functions)**

#### **auth-register**
- **Route:** `POST /auth/register`
- **Purpose:** Register new users (Job Seekers or Employers)
- **Authentication:** None required
- **Features:**
  - Email uniqueness validation
  - Password hashing (bcrypt)
  - User type assignment (JobSeeker/Employer)
  - Automatic profile creation (Applicants/Employers tables)
  - Organization creation for employers
  - Transactional operations for data integrity

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "userType": "JobSeeker", // or "Employer"
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "organizationName": "Tech Corp" // For employers only
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "UserID": "uuid",
    "Email": "user@example.com",
    "UserType": "JobSeeker"
  },
  "message": "User registered successfully"
}
```

---

#### **auth-login**
- **Route:** `POST /auth/login`
- **Purpose:** Authenticate users and issue JWT tokens
- **Authentication:** None required
- **Features:**
  - Email/password validation
  - Account lockout protection (5 failed attempts = 30min lockout)
  - JWT token generation (access + refresh)
  - Last login tracking
  - User activity logging

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "UserID": "uuid",
      "Email": "user@example.com",
      "FirstName": "John",
      "UserType": "JobSeeker"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    }
  }
}
```

---

#### **auth-logout**
- **Route:** `POST /auth/logout`
- **Purpose:** Log out user and invalidate tokens
- **Authentication:** Bearer token required
- **Features:**
  - Token invalidation
  - Logout activity logging
  - Security cleanup

---

#### **auth-refresh**
- **Route:** `POST /auth/refresh`
- **Purpose:** Refresh expired access tokens
- **Authentication:** Refresh token required
- **Features:**
  - Refresh token validation
  - New access token generation
  - Token rotation for security

---

#### **users-profile**
- **Route:** `GET/PUT /users/profile`
- **Purpose:** Get or update user basic profile information
- **Authentication:** Bearer token required
- **Features:**
  - Profile data retrieval
  - Field validation
  - Automatic timestamp updates
  - PascalCase to camelCase mapping

**GET Response:**
```json
{
  "success": true,
  "data": {
    "UserID": "uuid",
    "Email": "user@example.com",
    "FirstName": "John",
    "LastName": "Doe",
    "Phone": "+1234567890",
    "ProfileVisibility": "Public"
  }
}
```

**PUT Request:**
```json
{
  "firstName": "Updated",
  "lastName": "Name",
  "phone": "+9876543210",
  "profileVisibility": "Private"
}
```

---

#### **users-update-education**
- **Route:** `PUT /users/education`
- **Purpose:** Update applicant education information
- **Authentication:** Bearer token required
- **Features:**
  - Education field updates in Applicants table
  - Profile completeness calculation
  - Institution name extraction
  - Automatic timestamp updates

**Request Body:**
```json
{
  "college": {
    "name": "Harvard University"
  },
  "degreeType": "Bachelor's",
  "fieldOfStudy": "Computer Science"
}
```

---

#### **users-update-work-experience**
- **Route:** `PUT /users/work-experience`
- **Purpose:** Update applicant work experience
- **Authentication:** Bearer token required
- **Features:**
  - Work experience field updates
  - Years of experience parsing
  - Skills management
  - Profile completeness recalculation

**Request Body:**
```json
{
  "currentJobTitle": "Software Engineer",
  "currentCompany": "Tech Corp",
  "yearsOfExperience": "3-5 years",
  "primarySkills": "JavaScript, React, Node.js",
  "summary": "Experienced developer..."
}
```

---

#### **users-update-job-preferences**
- **Route:** `PUT /users/job-preferences`
- **Purpose:** Update job seeker preferences
- **Authentication:** Bearer token required
- **Features:**
  - Job type preferences
  - Location preferences
  - Salary expectations
  - Work arrangement preferences

**Request Body:**
```json
{
  "preferredJobTypes": [
    {"Type": "Full-Time"},
    {"Type": "Contract"}
  ],
  "workplaceType": "hybrid",
  "preferredLocations": ["New York", "Remote"]
}
```

---

#### **users-change-password**
- **Route:** `POST /users/change-password`
- **Purpose:** Change user password
- **Authentication:** Bearer token required
- **Features:**
  - Current password verification
  - New password hashing
  - Security validation

---

#### **users-verify-email**
- **Route:** `POST /users/verify-email`
- **Purpose:** Verify user email address
- **Authentication:** Bearer token required
- **Features:**
  - Email verification status update
  - Account activation

---

#### **users-dashboard-stats**
- **Route:** `GET /users/dashboard-stats`
- **Purpose:** Get user dashboard statistics
- **Authentication:** Bearer token required
- **Features:**
  - Role-based stats (Job Seeker vs Employer)
  - Application counts
  - Profile completeness
  - Activity metrics

**Job Seeker Response:**
```json
{
  "success": true,
  "data": {
    "TotalApplications": 15,
    "ShortlistedApplications": 3,
    "InterviewsScheduled": 1,
    "ProfileCompleteness": 85
  }
}
```

**Employer Response:**
```json
{
  "success": true,
  "data": {
    "TotalJobsPosted": 5,
    "ActiveJobs": 3,
    "TotalApplicationsReceived": 45,
    "PendingApplications": 12
  }
}
```

---

#### **users-deactivate**
- **Route:** `POST /users/deactivate`
- **Purpose:** Deactivate user account
- **Authentication:** Bearer token required
- **Features:**
  - Account deactivation (soft delete)
  - Data retention for compliance

---

### ?? **2. EMPLOYER MANAGEMENT (1 Function)**

#### **employers-initialize**
- **Route:** `POST /employers/initialize`
- **Purpose:** Initialize employer profile for existing users
- **Authentication:** Bearer token required
- **Features:**
  - User type upgrade to Employer
  - Organization creation
  - Employer profile setup
  - Transactional operations

**Request Body:**
```json
{
  "organizationName": "Tech Startup Inc",
  "organizationIndustry": "Technology",
  "organizationSize": "11-50",
  "organizationDescription": "Innovative tech company"
}
```

---

### ????? **3. APPLICANT/EMPLOYER PROFILE MANAGEMENT (4 Functions)**

#### **applicants-get**
- **Route:** `GET /applicants/{userId}/profile`
- **Purpose:** Get complete applicant profile
- **Authentication:** Bearer token required
- **Features:**
  - Comprehensive profile data
  - Auto-creation if not exists
  - User information joining

**Response:**
```json
{
  "success": true,
  "data": {
    "ApplicantID": "uuid",
    "UserID": "uuid",
    "Headline": "Software Engineer",
    "CurrentJobTitle": "Senior Developer",
    "YearsOfExperience": 5,
    "PrimarySkills": "React, Node.js, Python",
    "HideCurrentCompany": false,
    "HideSalaryDetails": true,
    "ProfileCompleteness": 90,
    "CreatedAt": "2025-01-01T00:00:00Z",
    "UpdatedAt": "2025-01-15T12:30:00Z"
  }
}
```

---

#### **applicants-update**
- **Route:** `PUT /applicants/{userId}/profile`
- **Purpose:** Update applicant profile fields
- **Authentication:** Bearer token required
- **Features:**
  - **?? SMART FIELD MAPPING:** 43 user-editable fields supported
  - **?? PRIVACY SETTINGS:** Hide company/salary toggles
  - **?? AUTO-CALCULATIONS:** Profile completeness, search score
  - **?? TIMESTAMPS:** CreatedAt preserved, UpdatedAt updated
  - **?? SYSTEM INTELLIGENCE:** Auto-scoring for search ranking

**Supported Fields (43 total):**
```json
{
  // Personal Information
  "nationality": "United States",
  "currentLocation": "New York, NY",
  "preferredLocations": "New York, San Francisco, Remote",
  
  // Social Profiles
  "linkedInProfile": "https://linkedin.com/in/john-doe",
  "githubProfile": "https://github.com/johndoe",
  
  // Documents
  "primaryResumeURL": "https://storage.com/resume.pdf",
  "additionalDocuments": "portfolio, certificates",
  
  // Education
  "highestEducation": "Bachelor's Degree",
  "fieldOfStudy": "Computer Science",
  "institution": "Harvard University",
  
  // Professional Information
  "headline": "Senior Software Engineer",
  "summary": "Experienced developer with 5+ years...",
  "currentJobTitle": "Senior Software Engineer",
  "currentCompany": "Tech Corp",
  "currentSalary": 120000,
  "currentSalaryUnit": "Annual",
  "currentCurrencyID": 1,
  "yearsOfExperience": 5,
  "noticePeriod": 30,
  "totalWorkExperience": "Detailed work history...",
  
  // Job Preferences
  "preferredJobTypes": "Full-Time, Contract",
  "preferredWorkTypes": "Hybrid",
  "expectedSalaryMin": 130000,
  "expectedSalaryMax": 160000,
  "expectedSalaryUnit": 150000,
  "preferredRoles": "Senior Engineer, Tech Lead",
  "preferredIndustries": "Technology, Fintech",
  "preferredMinimumSalary": 130000,
  
  // Skills and Experience
  "primarySkills": "React, Node.js, Python, AWS",
  "secondarySkills": "Docker, Kubernetes, GraphQL",
  "languages": "English (Native), Spanish (Conversational)",
  "certifications": "AWS Certified, Scrum Master",
  "workExperience": "Detailed work history JSON",
  
  // Availability and Preferences
  "immediatelyAvailable": false,
  "willingToRelocate": true,
  "jobSearchStatus": "Actively Looking",
  
  // Privacy Settings (?? THE MAIN FIX!)
  "allowRecruitersToContact": true,
  "hideCurrentCompany": true,    // ? Privacy toggle works!
  "hideSalaryDetails": false,    // ? Privacy toggle works!
  
  // Status Fields
  "isOpenToWork": true,
  "isFeatured": false,
  "featuredUntil": "2025-12-31T23:59:59Z",
  
  // Additional
  "tags": "javascript, react, senior, remote"
}
```

**?? System-Managed Fields (Auto-Updated):**
- `LastJobAppliedAt` - Updated when applying for jobs
- `SearchScore` - Calculated by ML algorithms (profile completeness + activity)
- `ProfileCompleteness` - Auto-calculated based on filled fields
- `CreatedAt` - Preserved from creation
- `UpdatedAt` - Updated on every modification

---

#### **employers-get**
- **Route:** `GET /employers/{userId}/profile`
- **Purpose:** Get employer profile with organization details
- **Authentication:** Bearer token required

---

#### **employers-update**
- **Route:** `PUT /employers/{userId}/profile`
- **Purpose:** Update employer and organization information
- **Authentication:** Bearer token required

---

### ?? **4. JOB MANAGEMENT (8 Functions)**

#### **jobs**
- **Route:** `GET/POST /jobs`
- **Purpose:** List jobs or create new job postings
- **Authentication:** Bearer token required (POST only)
- **Features:**
  - Pagination support
  - Filtering by location, type, salary
  - Employer verification for posting
  - Rich job metadata

**GET Response:**
```json
{
  "success": true,
  "data": [
    {
      "JobID": "uuid",
      "Title": "Senior Software Engineer",
      "CompanyName": "Tech Corp",
      "Location": "New York, NY",
      "JobType": "Full-Time",
      "SalaryRangeMin": 120000,
      "SalaryRangeMax": 160000,
      "PublishedAt": "2025-01-15T10:00:00Z",
      "Status": "Published"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**POST Request:**
```json
{
  "title": "Senior Software Engineer",
  "description": "We are looking for...",
  "jobTypeID": 1,
  "level": "Senior",
  "location": "New York, NY",
  "salaryRangeMin": 120000,
  "salaryRangeMax": 160000,
  "currencyID": 1,
  "requirements": "5+ years experience...",
  "benefits": "Health, dental, 401k..."
}
```

---

#### **jobs-by-id**
- **Route:** `GET/PUT/DELETE /jobs/{id}`
- **Purpose:** Get, update, or delete specific job
- **Authentication:** Bearer token required (PUT/DELETE)
- **Features:**
  - Detailed job information
  - Employer authorization checks
  - Application statistics

---

#### **jobs-publish**
- **Route:** `POST /jobs/{id}/publish`
- **Purpose:** Publish a draft job posting
- **Authentication:** Bearer token required
- **Features:**
  - Status change to Published
  - Validation before publishing
  - Notification triggers

---

#### **jobs-close**
- **Route:** `POST /jobs/{id}/close`
- **Purpose:** Close an active job posting
- **Authentication:** Bearer token required
- **Features:**
  - Status change to Closed
  - Application deadline handling

---

#### **jobs-search**
- **Route:** `GET /jobs/search`
- **Purpose:** Advanced job search with filters
- **Authentication:** None required
- **Features:**
  - Full-text search
  - Location-based filtering
  - Salary range filtering
  - Job type filtering
  - Company filtering
  - Relevance scoring

**Query Parameters:**
```
?q=software engineer
&location=new york
&jobType=Full-Time
&salaryMin=100000
&salaryMax=200000
&page=1
&pageSize=20
```

---

### ?? **5. JOB APPLICATIONS (7 Functions)**

#### **applications**
- **Route:** `POST /applications`
- **Purpose:** Submit job application
- **Authentication:** Bearer token required
- **Features:**
  - Duplicate application prevention
  - Auto-creation of applicant profile if needed
  - Application tracking setup
  - Email notifications
  - **?? AUTOMATIC TIMESTAMPS:** Updates `LastJobAppliedAt` and `UpdatedAt`

**Request Body:**
```json
{
  "jobID": "uuid",
  "coverLetter": "I am very interested in...",
  "expectedSalary": 150000,
  "expectedCurrencyID": 1,
  "availableFromDate": "2025-02-01",
  "resumeURL": "https://storage.com/resume.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ApplicationID": "uuid",
    "JobID": "uuid",
    "JobTitle": "Software Engineer",
    "CompanyName": "Tech Corp",
    "StatusName": "Submitted",
    "SubmittedAt": "2025-01-15T14:30:00Z"
  }
}
```

---

#### **applications-my**
- **Route:** `GET /applications/my`
- **Purpose:** Get current user's job applications
- **Authentication:** Bearer token required
- **Features:**
  - Paginated results
  - Application status tracking
  - Job and company details
  - Interview scheduling info

**Response:**
```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "ApplicationID": "uuid",
        "JobTitle": "Software Engineer",
        "CompanyName": "Tech Corp",
        "StatusName": "Under Review",
        "SubmittedAt": "2025-01-10T09:00:00Z",
        "NextInterviewDate": "2025-01-20T14:00:00Z"
      }
    ],
    "total": 5,
    "totalPages": 1
  }
}
```

---

#### **job-applications**
- **Route:** `GET /jobs/{jobId}/applications`
- **Purpose:** Get applications for a specific job (Employer view)
- **Authentication:** Bearer token required
- **Features:**
  - Employer authorization
  - Candidate information
  - Application tracking details
  - Screening scores

---

#### **applications-update-status**
- **Route:** `PUT /applications/{applicationId}/status`
- **Purpose:** Update application status (Employer action)
- **Authentication:** Bearer token required
- **Features:**
  - Status workflow management
  - Automated notifications
  - Application tracking updates

---

#### **applications-withdraw**
- **Route:** `DELETE /applications/{applicationId}`
- **Purpose:** Withdraw job application (Candidate action)
- **Authentication:** Bearer token required

---

#### **applications-details**
- **Route:** `GET /applications/{applicationId}`
- **Purpose:** Get detailed application information
- **Authentication:** Bearer token required

---

#### **applications-stats**
- **Route:** `GET /applications/stats`
- **Purpose:** Get application statistics for dashboard
- **Authentication:** Bearer token required

---

### ?? **6. REFERENCE DATA (6 Functions)**

#### **reference-job-types**
- **Route:** `GET /reference/job-types`
- **Purpose:** Get available job types
- **Authentication:** None required
- **Features:**
  - Cached reference data
  - Active status filtering

**Response:**
```json
{
  "success": true,
  "data": [
    {"JobTypeID": 1, "Type": "Full-Time"},
    {"JobTypeID": 2, "Type": "Contract"},
    {"JobTypeID": 3, "Type": "Part-Time"},
    {"JobTypeID": 4, "Type": "Internship"},
    {"JobTypeID": 5, "Type": "Freelance"}
  ]
}
```

---

#### **reference-currencies**
- **Route:** `GET /reference/currencies`
- **Purpose:** Get supported currencies
- **Authentication:** None required

**Response:**
```json
{
  "success": true,
  "data": [
    {"CurrencyID": 1, "Code": "USD", "Symbol": "$", "Name": "US Dollar"},
    {"CurrencyID": 2, "Code": "EUR", "Symbol": "€", "Name": "Euro"},
    {"CurrencyID": 3, "Code": "INR", "Symbol": "?", "Name": "Indian Rupee"}
  ]
}
```

---

#### **reference-organizations**
- **Route:** `GET /reference/organizations`
- **Purpose:** Get company/organization directory
- **Authentication:** None required
- **Features:**
  - Database companies
  - External API integration
  - Fallback data for reliability

---

#### **reference-colleges**
- **Route:** `GET /reference/colleges`
- **Purpose:** Get universities and colleges directory
- **Authentication:** None required
- **Features:**
  - Global university database
  - Country-specific filtering
  - Search by name capability

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Harvard University",
      "type": "University",
      "country": "United States",
      "state": "Massachusetts",
      "website": "https://www.harvard.edu"
    }
  ]
}
```

---

#### **reference-universities-by-country**
- **Route:** `GET /reference/universities-by-country`
- **Purpose:** Get universities grouped by country and state
- **Authentication:** None required

---

#### **reference-industries**
- **Route:** `GET /reference/industries`
- **Purpose:** Get industry categories
- **Authentication:** None required

---

### ?? **7. HEALTH & MONITORING (1 Function)**

#### **health**
- **Route:** `GET /health`
- **Purpose:** Health check endpoint for monitoring
- **Authentication:** None required
- **Features:**
  - Service status verification
  - Version information
  - Timestamp for uptime tracking

**Response:**
```json
{
  "success": true,
  "message": "NexHire Backend API is running",
  "timestamp": "2025-01-15T12:00:00Z",
  "version": "1.0.0"
}
```

---

## ?? **Technical Features**

### **??? Security**
- **JWT Authentication:** Bearer token validation
- **Password Security:** bcrypt hashing with salt
- **Account Protection:** Lockout after failed attempts
- **CORS Enabled:** Cross-origin request support
- **SQL Injection Protection:** Parameterized queries

### **?? Database Integration**
- **Azure SQL Database:** Production-grade relational database
- **Connection Pooling:** Optimized connection management
- **Transactions:** ACID compliance for data integrity
- **Automatic Timestamps:** CreatedAt/UpdatedAt tracking
- **Soft Deletes:** Data retention for compliance

### **?? Smart Automation**
- **Profile Completeness:** Auto-calculated percentage
- **Search Scoring:** ML-based candidate ranking
- **Application Tracking:** Automatic status updates
- **Timestamp Management:** System-managed fields

### **? Performance**
- **Caching:** Reference data caching
- **Pagination:** Large dataset handling
- **Indexing:** Optimized database queries
- **Error Handling:** Graceful failure recovery

### **?? Frontend Integration**
- **Universal Support:** Web, iOS, Android
- **Real-time Updates:** Instant profile changes
- **Smart Routing:** Automatic field routing
- **Fallback Data:** Offline capability

---

## ?? **Deployment Information**

**?? Production URL:** `https://nexhire-api-func.azurewebsites.net/api`

**?? Deployment Stack:**
- Azure Functions v4 (Consumption Plan)
- Node.js 18 Runtime
- TypeScript Compilation
- Automatic scaling
- Monitoring & logging enabled

**?? CI/CD Pipeline:**
- Git-based deployment
- Automatic builds on push
- Environment variable management
- Health check validation

---

## ?? **API Usage Examples**

### **Registration Flow:**
```bash
# 1. Register new job seeker
curl -X POST /auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123",
    "userType": "JobSeeker",
    "firstName": "John",
    "lastName": "Doe"
  }'

# 2. Login to get tokens
curl -X POST /auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'

# 3. Update profile with privacy settings
curl -X PUT /applicants/{userId}/profile \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "hideCurrentCompany": true,
    "hideSalaryDetails": false,
    "currentJobTitle": "Software Engineer"
  }'
```

### **Job Application Flow:**
```bash
# 1. Search for jobs
curl -X GET "/jobs/search?q=software engineer&location=new york"

# 2. Apply for job
curl -X POST /applications \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "jobID": "job-uuid",
    "coverLetter": "I am interested in this position...",
    "expectedSalary": 150000
  }'

# 3. Check application status
curl -X GET /applications/my \
  -H "Authorization: Bearer {token}"
```

---

## ?? **Summary**

The NexHire Azure Functions API provides a **comprehensive, production-ready backend** for a modern job platform with:

- ? **30 Function Endpoints** covering all job platform needs
- ? **Complete CRUD Operations** for users, jobs, applications
- ? **Smart Profile Management** with 43 editable fields
- ? **Advanced Security** with JWT authentication
- ? **Real-time Features** with automatic updates
- ? **Scalable Architecture** on Azure Functions v4
- ? **Mobile-First Design** supporting web, iOS, Android

**?? Perfect for powering a world-class job platform! ??**