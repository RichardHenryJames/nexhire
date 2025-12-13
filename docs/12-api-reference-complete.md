# Complete API Reference

## Base URL

- **Development**: `http://localhost:7071/api`
- **Production**: `https://api.nexhire.com/api`

## Authentication

All authenticated endpoints require a Firebase JWT token in the Authorization header:

```
Authorization: Bearer <firebase-jwt-token>
```

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

---

## User Management

### Get Current User Profile
```
GET /users/profile
```

**Headers**: Authorization required

**Response**:
```json
{
  "id": 123,
  "email": "user@example.com",
  "displayName": "John Doe",
  "photoURL": "https://...",
  "phoneNumber": "+1234567890",
  "bio": "Software engineer...",
  "location": "San Francisco, CA",
  "resumeUrl": "https://...",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-12-01T00:00:00Z"
}
```

### Update User Profile
```
PUT /users/{userId}
```

**Headers**: Authorization required

**Body**:
```json
{
  "displayName": "John Doe",
  "bio": "Experienced software engineer",
  "location": "San Francisco, CA",
  "phoneNumber": "+1234567890",
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "githubUrl": "https://github.com/johndoe"
}
```

**Response**: Updated user object

### Upload Resume
```
POST /users/{userId}/resume
```

**Headers**: 
- Authorization required
- Content-Type: multipart/form-data

**Body**: FormData with `resume` file

**Response**:
```json
{
  "resumeUrl": "https://storage.blob.core.windows.net/resumes/123-resume.pdf",
  "uploadedAt": "2025-12-05T10:30:00Z"
}
```

### Add Work Experience
```
POST /users/{userId}/work-experience
```

**Body**:
```json
{
  "company": "Tech Corp",
  "title": "Senior Software Engineer",
  "startDate": "2020-01-01",
  "endDate": "2023-12-31",
  "current": false,
  "description": "Led development of...",
  "location": "San Francisco, CA"
}
```

### Get Work Experience
```
GET /users/{userId}/work-experience
```

**Response**:
```json
[
  {
    "id": 1,
    "company": "Tech Corp",
    "title": "Senior Software Engineer",
    "startDate": "2020-01-01",
    "endDate": "2023-12-31",
    "current": false,
    "description": "Led development of..."
  }
]
```

---

## Job Management

### Search Jobs
```
GET /jobs/search
```

**Query Parameters**:
- `q` (string): Search query
- `location` (string): Location filter
- `jobType` (string): full-time, part-time, contract, internship
- `experienceLevel` (string): entry, mid, senior, executive
- `remote` (boolean): Remote jobs only
- `salary_min` (number): Minimum salary
- `salary_max` (number): Maximum salary
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 20)
- `sort` (string): Sort by (posted_date, salary, relevance)
- `order` (string): asc, desc

**Response**:
```json
{
  "jobs": [
    {
      "id": 1,
      "title": "Senior Software Engineer",
      "company": {
        "id": 10,
        "name": "Tech Corp",
        "logo": "https://...",
        "fortune500": true
      },
      "location": "San Francisco, CA",
      "remote": false,
      "salary": {
        "min": 150000,
        "max": 200000,
        "currency": "USD",
        "period": "annual"
      },
      "jobType": "full-time",
      "experienceLevel": "senior",
      "description": "We are looking for...",
      "postedDate": "2025-12-01T00:00:00Z",
      "externalUrl": "https://...",
      "referrerCount": 5,
      "qualityScore": 85
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Get Job Details
```
GET /jobs/{jobId}
```

**Response**:
```json
{
  "id": 1,
  "title": "Senior Software Engineer",
  "description": "Full job description...",
  "requirements": [
    "5+ years of experience",
    "Proficiency in TypeScript"
  ],
  "benefits": [
    "Health insurance",
    "401k matching"
  ],
  "company": {
    "id": 10,
    "name": "Tech Corp",
    "logo": "https://...",
    "description": "Company description...",
    "industry": "Technology",
    "size": "1000-5000",
    "fortune500": true,
    "website": "https://techcorp.com"
  },
  "location": {
    "city": "San Francisco",
    "state": "CA",
    "country": "USA",
    "coordinates": {
      "lat": 37.7749,
      "lng": -122.4194
    }
  },
  "salary": {
    "min": 150000,
    "max": 200000,
    "currency": "USD",
    "period": "annual"
  },
  "jobType": "full-time",
  "experienceLevel": "senior",
  "skills": ["TypeScript", "React", "Node.js"],
  "remote": false,
  "postedDate": "2025-12-01T00:00:00Z",
  "externalUrl": "https://...",
  "source": "greenhouse",
  "referrers": [
    {
      "id": 50,
      "displayName": "Jane Smith",
      "photoURL": "https://...",
      "title": "Engineering Manager",
      "yearsAtCompany": 3,
      "successfulReferrals": 8
    }
  ],
  "similarJobs": [
    {
      "id": 2,
      "title": "Software Engineer",
      "company": "Other Corp"
    }
  ]
}
```

### Get Jobs by Company
```
GET /jobs/company/{organizationId}
```

**Query Parameters**: Same pagination as search

**Response**: Similar to search response

### Get Recommended Jobs
```
GET /jobs/recommended
```

**Headers**: Authorization required

**Query Parameters**:
- `limit` (number): Number of recommendations (default: 10)

**Response**: Array of job objects

### Save Job
```
POST /jobs/{jobId}/save
```

**Headers**: Authorization required

**Response**:
```json
{
  "saved": true,
  "savedAt": "2025-12-05T10:30:00Z"
}
```

### Unsave Job
```
DELETE /jobs/{jobId}/save
```

**Headers**: Authorization required

### Get Saved Jobs
```
GET /jobs/saved
```

**Headers**: Authorization required

**Response**: Array of saved job objects

---

## Referral Management

### Request Referral
```
POST /referrals
```

**Headers**: Authorization required

**Body**:
```json
{
  "jobId": 1,
  "referrerId": 50,
  "message": "I would be a great fit because...",
  "resumeUrl": "https://..."
}
```

**Response**:
```json
{
  "id": 100,
  "jobId": 1,
  "seekerId": 123,
  "referrerId": 50,
  "status": "pending",
  "message": "I would be a great fit because...",
  "createdAt": "2025-12-05T10:30:00Z"
}
```

### Get Referral Details
```
GET /referrals/{referralId}
```

**Headers**: Authorization required

**Response**:
```json
{
  "id": 100,
  "job": {
    "id": 1,
    "title": "Senior Software Engineer",
    "company": {
      "name": "Tech Corp"
    }
  },
  "seeker": {
    "id": 123,
    "displayName": "John Doe",
    "photoURL": "https://...",
    "resumeUrl": "https://..."
  },
  "referrer": {
    "id": 50,
    "displayName": "Jane Smith",
    "photoURL": "https://..."
  },
  "status": "pending",
  "message": "I would be a great fit because...",
  "referrerNotes": null,
  "createdAt": "2025-12-05T10:30:00Z",
  "updatedAt": "2025-12-05T10:30:00Z",
  "timeline": [
    {
      "status": "pending",
      "timestamp": "2025-12-05T10:30:00Z",
      "note": "Referral request submitted"
    }
  ]
}
```

### Update Referral Status
```
PUT /referrals/{referralId}/status
```

**Headers**: Authorization required (referrer only)

**Body**:
```json
{
  "status": "accepted",
  "notes": "I'll be happy to refer you"
}
```

**Possible status values**: `pending`, `accepted`, `rejected`, `completed`, `cancelled`

### Get My Referrals (as Seeker)
```
GET /referrals/seeker
```

**Headers**: Authorization required

**Query Parameters**:
- `status` (string): Filter by status
- `page`, `limit`: Pagination

**Response**: Paginated array of referral objects

### Get My Referrals (as Referrer)
```
GET /referrals/referrer
```

**Headers**: Authorization required

**Query Parameters**: Same as above

**Response**: Paginated array of referral objects

### Get Referral Statistics
```
GET /referrals/stats
```

**Headers**: Authorization required

**Response**:
```json
{
  "asSeeker": {
    "total": 15,
    "pending": 5,
    "accepted": 8,
    "rejected": 2,
    "completed": 7
  },
  "asReferrer": {
    "total": 25,
    "pending": 3,
    "accepted": 20,
    "rejected": 2,
    "successful": 15,
    "successRate": 0.75
  }
}
```

---

## Messaging

### Get Conversations
```
GET /messages/conversations
```

**Headers**: Authorization required

**Response**:
```json
[
  {
    "id": 1,
    "otherUser": {
      "id": 50,
      "displayName": "Jane Smith",
      "photoURL": "https://..."
    },
    "lastMessage": {
      "id": 100,
      "text": "Thanks for reaching out!",
      "senderId": 50,
      "createdAt": "2025-12-05T10:30:00Z"
    },
    "unreadCount": 2,
    "updatedAt": "2025-12-05T10:30:00Z"
  }
]
```

### Get Messages
```
GET /messages/conversation/{userId}
```

**Headers**: Authorization required

**Query Parameters**:
- `page` (number)
- `limit` (number): Messages per page (default: 50)

**Response**:
```json
{
  "messages": [
    {
      "id": 100,
      "senderId": 50,
      "receiverId": 123,
      "text": "Thanks for reaching out!",
      "read": true,
      "createdAt": "2025-12-05T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 45
  }
}
```

### Send Message
```
POST /messages
```

**Headers**: Authorization required

**Body**:
```json
{
  "receiverId": 50,
  "text": "Hello, I'm interested in the Software Engineer position",
  "referralId": 100
}
```

**Response**: Message object

### Mark Messages as Read
```
PUT /messages/read
```

**Headers**: Authorization required

**Body**:
```json
{
  "messageIds": [100, 101, 102]
}
```

### Delete Message
```
DELETE /messages/{messageId}
```

**Headers**: Authorization required (sender only)

---

## Company/Organization Management

### Search Companies
```
GET /organizations/search
```

**Query Parameters**:
- `q` (string): Search query
- `industry` (string): Industry filter
- `fortune500` (boolean): Fortune 500 only
- `page`, `limit`: Pagination

**Response**:
```json
{
  "organizations": [
    {
      "id": 10,
      "name": "Tech Corp",
      "logo": "https://...",
      "description": "Leading technology company",
      "industry": "Technology",
      "size": "1000-5000",
      "fortune500": true,
      "website": "https://techcorp.com",
      "linkedinUrl": "https://linkedin.com/company/techcorp",
      "jobCount": 45,
      "referrerCount": 12
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500
  }
}
```

### Get Company Details
```
GET /organizations/{organizationId}
```

**Response**:
```json
{
  "id": 10,
  "name": "Tech Corp",
  "logo": "https://...",
  "coverImage": "https://...",
  "description": "Detailed company description...",
  "industry": "Technology",
  "size": "1000-5000",
  "founded": 2005,
  "headquarters": "San Francisco, CA",
  "fortune500": true,
  "website": "https://techcorp.com",
  "linkedinUrl": "https://linkedin.com/company/techcorp",
  "socialMedia": {
    "twitter": "@techcorp",
    "facebook": "techcorp"
  },
  "stats": {
    "jobCount": 45,
    "referrerCount": 12,
    "avgResponseTime": "2 days"
  },
  "topReferrers": [
    {
      "id": 50,
      "displayName": "Jane Smith",
      "photoURL": "https://...",
      "title": "Engineering Manager",
      "successfulReferrals": 8
    }
  ]
}
```

### Get Company Employees (Referrers)
```
GET /organizations/{organizationId}/referrers
```

**Response**: Array of referrer profiles

---

## Payment Management

### Create Payment Intent
```
POST /payments/intent
```

**Headers**: Authorization required

**Body**:
```json
{
  "referralId": 100,
  "amount": 5000,
  "currency": "USD"
}
```

**Response**:
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

### Confirm Payment
```
POST /payments/confirm
```

**Headers**: Authorization required

**Body**:
```json
{
  "paymentIntentId": "pi_xxx",
  "referralId": 100
}
```

**Response**:
```json
{
  "success": true,
  "paymentId": 1,
  "status": "completed"
}
```

### Get Payment History
```
GET /payments/history
```

**Headers**: Authorization required

**Query Parameters**: `page`, `limit`

**Response**:
```json
{
  "payments": [
    {
      "id": 1,
      "referralId": 100,
      "amount": 5000,
      "currency": "USD",
      "status": "completed",
      "paymentMethod": "card",
      "createdAt": "2025-12-05T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

---

## Application Tracking

### Submit Job Application
```
POST /applications
```

**Headers**: Authorization required

**Body**:
```json
{
  "jobId": 1,
  "referralId": 100,
  "coverLetter": "I am excited to apply...",
  "resumeUrl": "https://...",
  "additionalDocuments": [
    "https://portfolio.com"
  ]
}
```

**Response**:
```json
{
  "id": 200,
  "jobId": 1,
  "userId": 123,
  "referralId": 100,
  "status": "submitted",
  "submittedAt": "2025-12-05T10:30:00Z"
}
```

### Get Application Status
```
GET /applications/{applicationId}
```

**Headers**: Authorization required

**Response**:
```json
{
  "id": 200,
  "job": {
    "id": 1,
    "title": "Senior Software Engineer",
    "company": {
      "name": "Tech Corp"
    }
  },
  "status": "interviewing",
  "timeline": [
    {
      "status": "submitted",
      "timestamp": "2025-12-05T10:30:00Z"
    },
    {
      "status": "screening",
      "timestamp": "2025-12-06T14:00:00Z"
    },
    {
      "status": "interviewing",
      "timestamp": "2025-12-08T09:00:00Z",
      "note": "First round interview scheduled"
    }
  ],
  "interviews": [
    {
      "id": 1,
      "type": "phone",
      "scheduledAt": "2025-12-10T14:00:00Z",
      "interviewer": "Jane Smith",
      "notes": "Technical screening"
    }
  ]
}
```

**Possible status values**: `submitted`, `screening`, `interviewing`, `offer`, `accepted`, `rejected`, `withdrawn`

### Update Application Status
```
PUT /applications/{applicationId}/status
```

**Headers**: Authorization required

**Body**:
```json
{
  "status": "interviewing",
  "note": "First round interview scheduled"
}
```

### Get My Applications
```
GET /applications
```

**Headers**: Authorization required

**Query Parameters**:
- `status` (string): Filter by status
- `page`, `limit`: Pagination

**Response**: Paginated array of application objects

---

## Admin/Debug Endpoints

### Health Check
```
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-05T10:30:00Z",
  "services": {
    "database": "connected",
    "storage": "connected",
    "firebase": "connected"
  }
}
```

### Get System Stats
```
GET /admin/stats
```

**Headers**: Authorization required (admin only)

**Response**:
```json
{
  "users": {
    "total": 10000,
    "active": 5000,
    "newThisMonth": 500
  },
  "jobs": {
    "total": 50000,
    "active": 30000,
    "scrapedToday": 1500
  },
  "referrals": {
    "total": 2000,
    "pending": 300,
    "successRate": 0.65
  },
  "payments": {
    "totalVolume": 150000,
    "thisMonth": 25000
  }
}
```

### Trigger Job Scraper
```
POST /admin/scraper/trigger
```

**Headers**: Authorization required (admin only)

**Body**:
```json
{
  "source": "linkedin",
  "company": "Tech Corp"
}
```

---

## WebSocket Events (Real-time)

### Connection
```javascript
const socket = io('wss://api.nexhire.com', {
  auth: { token: firebaseToken }
})
```

### Events

#### New Message
```javascript
socket.on('message:new', (message) => {
  // Handle new message
})
```

#### Referral Update
```javascript
socket.on('referral:update', (referral) => {
  // Handle referral status change
})
```

#### Job Alert
```javascript
socket.on('job:new', (job) => {
  // Handle new job matching user preferences
})
```

---

**Last Updated**: December 5, 2025
