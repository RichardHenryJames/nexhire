# RefOpen (NexHire) - Project Overview

## 📋 Table of Contents
- [Project Summary](#project-summary)
- [Core Concept](#core-concept)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Platform Statistics](#platform-statistics)
- [Development Status](#development-status)

---

## Project Summary

**RefOpen** (also referred to as NexHire) is a comprehensive, production-ready job platform built with cutting-edge serverless technology on Microsoft Azure. It's designed to transform how job seekers and employers connect through intelligent profile management, an innovative referral marketplace, and comprehensive analytics.

### 🎯 Mission
Create a universal platform that connects job seekers, employers, and referrers in a transparent, efficient, and rewarding ecosystem.

### 🌟 Vision
- **Universal Platform**: Single React Native codebase supporting Web, iOS, and Android
- **Serverless Excellence**: Azure Functions with automatic scaling and cost optimization
- **Intelligence-First**: AI-driven profile scoring and smart recommendation engine
- **Referral Marketplace**: Monetized referral system with quota management and rewards
- **Advanced Analytics**: Real-time dashboards for all stakeholders

---

## Core Concept

RefOpen operates on a **three-stakeholder model**:

### 1. 👥 Job Seekers
- Create comprehensive profiles with smart completeness tracking
- Manage multiple resumes strategically
- Apply for jobs with advanced tracking
- Set granular privacy controls
- Receive AI-powered job recommendations (paid feature)
- Earn money through referrals

### 2. 🏢 Employers
- Post structured job listings with rich taxonomy
- Manage candidate pipelines with advanced filtering
- Track hiring analytics and conversion rates
- Collaborate with team members
- Access qualified candidates
- Leverage referral system for quality hires

### 3. 🤝 Referrers
- Help job seekers by referring them to opportunities
- Earn points and rewards for successful referrals
- Choose from flexible subscription plans (free to lifetime)
- Track referral performance with detailed analytics
- Support both internal (platform) and external (off-platform) referrals

---

## Technology Stack

### **Backend (API)**
| Technology | Version | Purpose |
|------------|---------|---------|
| **Azure Functions** | v4 | Serverless API hosting |
| **Node.js** | 20+ | Runtime environment |
| **TypeScript** | 5.9.2 | Type-safe development |
| **Azure SQL** | Latest | Primary database |
| **Azure Blob Storage** | Latest | File storage (resumes, images) |
| **JWT** | 9.0.2 | Authentication |
| **Razorpay** | 2.9.6 | Payment gateway |
| **SignalR** | 10.0.0 | Real-time messaging |

### **Frontend (Universal App)**
| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.72.6 | Cross-platform framework |
| **Expo** | ~49.0.0 | Development platform |
| **React Navigation** | 6.x | Routing & navigation |
| **Axios** | 1.6.0 | HTTP client |
| **Socket.io** | 4.8.1 | Real-time communication |
| **Async Storage** | 2.2.0 | Local data persistence |

### **DevOps & Infrastructure**
- **Azure Static Web Apps**: Frontend hosting
- **Azure Application Insights**: Monitoring & logging
- **PowerShell**: Deployment automation scripts
- **Git/GitHub**: Version control
- **Jest**: Testing framework

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐       │
│  │ Web App    │  │ iOS App    │  │ Android App │       │
│  │ (Expo Web) │  │ (Expo iOS) │  │ (Expo Droid)│       │
│  └────────────┘  └────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  API Gateway Layer                       │
│  ┌────────────────────────────────────────────────┐     │
│  │ Azure Functions (Serverless HTTP Triggers)     │     │
│  ├────────────────────────────────────────────────┤     │
│  │ • CORS Middleware                              │     │
│  │ • JWT Authentication                           │     │
│  │ • Rate Limiting                                │     │
│  │ • Request Validation                           │     │
│  │ • Error Handling                               │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Business Logic Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐          │
│  │   User   │  │   Job    │  │ Application │          │
│  │ Service  │  │ Service  │  │  Service    │          │
│  └──────────┘  └──────────┘  └─────────────┘          │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐          │
│  │ Referral │  │  Wallet  │  │  Messaging  │          │
│  │ Service  │  │ Service  │  │  Service    │          │
│  └──────────┘  └──────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                             │
│  ┌───────────────┐  ┌────────────────┐                 │
│  │  Azure SQL    │  │  Azure Blob    │                 │
│  │  Database     │  │  Storage       │                 │
│  │  (35+ tables) │  │  (Files/Docs)  │                 │
│  └───────────────┘  └────────────────┘                 │
│  ┌─────────────────────────────────────┐               │
│  │  Application Insights (Monitoring)  │               │
│  └─────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

### Serverless Benefits

| Aspect | Traditional Server | RefOpen Serverless |
|--------|-------------------|-------------------|
| **Cost** | Fixed monthly ~$100-500 | Pay-per-use ~$10-50 |
| **Scaling** | Manual provisioning | Automatic 0→∞ |
| **Maintenance** | OS patches, updates | Zero infrastructure work |
| **Availability** | Single region | Multi-region auto-failover |
| **Performance** | Always-on overhead | <500ms cold start |
| **Security** | Manual hardening | Enterprise-grade built-in |

---

## Key Features

### 1. 🔐 Authentication & Authorization
- **JWT-based authentication** with access & refresh tokens
- **Google OAuth integration** for social login
- **Role-based access control** (JobSeeker, Employer, Admin)
- **Email verification** system
- **Password reset** functionality
- **Secure token management**

### 2. 👤 User Profile Management
- **Smart Profile Completeness**: 10-component algorithm
  - Education, Work Experience, Skills, Resume
  - Preferences, Profile Picture, Summary, etc.
- **Multi-Resume Management**: Upload and manage multiple resumes
- **Privacy Controls**: Granular visibility settings
- **Profile Scoring**: Real-time completeness percentage

### 3. 💼 Job Management
- **Rich Job Posting**: Title, description, requirements, benefits
- **Job Taxonomy**:
  - JobTypes (Full-time, Part-time, Contract, Freelance, Internship)
  - WorkplaceTypes (Remote, Hybrid, Onsite)
  - Industries & Skills
- **Salary Intelligence**: Range-based with privacy controls
- **Job Status**: Draft, Active, Closed
- **Application Tracking**: 10-stage pipeline

### 4. 🤝 Referral Marketplace
- **6 Subscription Tiers**:
  - Free: 5 referrals/day
  - Weekly Boost: 10/day for ₹49
  - Monthly Pro: 15/day for ₹149
  - Quarterly Growth: 20/day for ₹399
  - Half-Year Power: 20/day for ₹699
  - Lifetime Unlimited: 25/day for ₹1999

- **Dual Referral System**:
  - **Internal**: Refer to jobs on platform
  - **External**: Refer to off-platform opportunities

- **Proof System**: Upload verification screenshots
- **Points & Rewards**: Earn points for successful referrals
- **Analytics Dashboard**: Track performance metrics

### 5. 💰 Wallet System
- **Wallet Management**: User balance tracking
- **Razorpay Integration**: Secure payment processing
- **Transaction History**: Complete audit trail
- **Recharge System**: Add funds to wallet
- **Debit System**: Pay for premium features
- **Currency Support**: Multi-currency ready (INR default)

### 6. 🤖 AI Job Recommendations
- **24-Hour Access**: ₹50 for AI-powered job matching
- **Wallet Integration**: Automatic deduction
- **Smart Filtering**: Personalized job suggestions
- **Preview Mode**: Free filter preview without cost

### 7. 💬 Real-Time Messaging
- **SignalR Integration**: WebSocket-based messaging
- **One-on-One Chat**: Direct conversations
- **Read Receipts**: Message status tracking
- **Block/Unblock**: User safety controls
- **Profile Views**: Track who viewed your profile

### 8. 📊 Analytics & Dashboard
- **Job Seeker Dashboard**:
  - Applications submitted/pending/accepted
  - Profile completeness score
  - Saved jobs
  - Recent activity

- **Employer Dashboard**:
  - Active jobs
  - Total applications
  - Candidate pipeline
  - Hiring metrics

- **Referrer Dashboard**:
  - Total referrals
  - Success rate
  - Points earned
  - Active requests

### 9. 🔍 Job Scraping (Beta)
- **Adzuna API Integration**: Automated job discovery
- **Scheduled Scraping**: Configurable intervals
- **Organization Enrichment**: Auto-populate company data
- **Fortune 500 Support**: Premium company listings

---

## Platform Statistics

| Metric | Count/Value |
|--------|-------------|
| **API Endpoints** | 80+ REST endpoints |
| **Database Tables** | 35+ normalized tables |
| **Controllers** | 15 specialized controllers |
| **Services** | 20+ business logic services |
| **Authentication Methods** | 3 (Email, Google OAuth, JWT) |
| **Referral Plans** | 6 tiers (Free to Lifetime) |
| **Job Status Types** | 10 stages |
| **Payment Gateways** | 2 (Razorpay, Cashfree) |
| **Storage Containers** | 5 (resumes, images, proofs, etc.) |
| **Frontend Screens** | 30+ screens |
| **Real-time Features** | Messaging, notifications |

---

## Development Status

### ✅ Completed Features
- [x] User authentication & authorization
- [x] Profile management with completeness tracking
- [x] Job posting and management
- [x] Job application workflow
- [x] Referral system with subscriptions
- [x] Wallet system with Razorpay integration
- [x] AI job recommendations
- [x] Real-time messaging (SignalR)
- [x] File storage (Azure Blob)
- [x] Payment processing
- [x] Mobile app (React Native/Expo)
- [x] Web deployment (Azure Static Web Apps)

### 🚧 In Progress
- [ ] Job scraping automation improvements
- [ ] Enhanced analytics dashboards
- [ ] Email notification system
- [ ] Push notifications
- [ ] Admin panel

### 📋 Planned Features
- [ ] Video interviews
- [ ] Skills assessment tests
- [ ] Company reviews & ratings
- [ ] Salary insights & benchmarking
- [ ] Career path recommendations
- [ ] LinkedIn integration
- [ ] GitHub integration

---

## Project Structure

```
nexhire/
├── src/                          # Backend source code
│   ├── controllers/              # API endpoint handlers
│   ├── services/                 # Business logic
│   ├── types/                    # TypeScript type definitions
│   ├── config/                   # Configuration files
│   ├── middleware/               # Express middleware
│   └── utils/                    # Utility functions
├── frontend/                     # React Native application
│   └── src/
│       ├── screens/              # App screens
│       ├── components/           # Reusable components
│       ├── services/             # API services
│       ├── navigation/           # Navigation setup
│       └── contexts/             # React contexts
├── database/                     # Database scripts
│   └── migrations/               # SQL migration files
├── docs/                         # Documentation
├── scripts/                      # Utility scripts
├── *.ps1                         # PowerShell deployment scripts
├── package.json                  # Backend dependencies
├── tsconfig.json                 # TypeScript config
└── index.ts                      # Azure Functions entry point
```

---

## Environment Support

### Development
- Local development with Azure Functions Core Tools
- Local SQL database or Azure SQL
- Environment config: `env-config.dev.json`

### Staging
- Azure Functions staging environment
- Staging database
- Environment config: `env-config.staging.json`

### Production
- Production Azure Functions
- Production database with backups
- Environment config: `env-config.prod.json`

---

## Quick Links

- **Live Demo**: https://refopen-frontend-web.azurestaticapps.net
- **API Endpoint**: https://refopen-api-func.azurewebsites.net/api
- **Repository**: https://github.com/RichardHenryJames/nexhire
- **Documentation**: See `docs/` folder

---

## Contact & Support

**Project**: RefOpen (NexHire)  
**Repository Owner**: RichardHenryJames  
**License**: MIT  
**Status**: Active Development  

---

*Last Updated: December 5, 2025*
