"use strict";
/*
nn
 * ========================================================================
 * NexHire Backend API - Azure Functions v4 Single Entry Point
 * ========================================================================
 *
 *   IMPORTANT: CLEANUP LEGACY FOLDERS
 *
 * This project uses Azure Functions v4 Programming Model where ALL functions
 * are registered in this single file. The individual function folders are
 * legacy from v3 and should be DELETED:
 *
 * TO DELETE LEGACY FOLDERS, run this PowerShell command:
 *
 * Remove-Item -Path @(
 *   "applications-my", "applications", "auth-login", "job-applications",
 *   "jobs-by-id", "jobs-close", "jobs-publish", "jobs-search",
 *   "reference-currencies", "users-profile"
 * ) -Recurse -Force -ErrorAction SilentlyContinue
 *
 * Or manually delete these folders:
 * ? applications-my/        (DELETE - not needed)
 * ? applications/           (DELETE - not needed)
 * ? auth-login/             (DELETE - not needed)
 * ? job-applications/       (DELETE - not needed)
 * ? jobs-by-id/             (DELETE - not needed)
 * ? jobs-close/             (DELETE - not needed)
 * ? jobs-publish/           (DELETE - not needed)
 * ? jobs-search/            (DELETE - not needed)
 * ? reference-currencies/   (DELETE - not needed)
 * ? users-profile/          (DELETE - not needed)
 *
 * After cleanup, only these files should remain:
 * ? index.ts               (THIS FILE - main entry point)
 * ? src/                   (controllers, services, etc.)
 * ? package.json
 * ? tsconfig.json
 * ? host.json
 *
 * ========================================================================
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Azure Functions v4 Main Entry Point
// This file registers all functions with the Azure Functions runtime
const functions_1 = require("@azure/functions");
// FIXED: Import CORS middleware
const middleware_1 = require("./src/middleware");
// Import controllers
const user_controller_1 = require("./src/controllers/user.controller");
const job_controller_1 = require("./src/controllers/job.controller");
const job_application_controller_1 = require("./src/controllers/job-application.controller");
const reference_controller_1 = require("./src/controllers/reference.controller");
const employer_controller_1 = require("./src/controllers/employer.controller");
// Import profile services
const profile_service_1 = require("./src/services/profile.service");
// ========================================================================
// AUTHENTICATION & USER MANAGEMENT ENDPOINTS
// ========================================================================
functions_1.app.http('auth-register', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/register',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.register)
});
functions_1.app.http('auth-login', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/login',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.login)
});
// FIXED: Add logout endpoint
functions_1.app.http('auth-logout', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/logout',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.logout)
});
functions_1.app.http('auth-refresh', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/refresh',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.refreshToken)
});
functions_1.app.http('users-profile', {
    methods: ['GET', 'PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/profile',
    handler: (0, middleware_1.withErrorHandling)(async (req, context) => {
        if (req.method === 'GET') {
            return await (0, user_controller_1.getProfile)(req, context);
        }
        else {
            return await (0, user_controller_1.updateProfile)(req, context);
        }
    })
});
functions_1.app.http('users-change-password', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/change-password',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.changePassword)
});
functions_1.app.http('users-verify-email', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/verify-email',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.verifyEmail)
});
functions_1.app.http('users-dashboard-stats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/dashboard-stats',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.getDashboardStats)
});
functions_1.app.http('users-update-education', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/education',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.updateEducation)
});
// NEW: Work experience endpoint
functions_1.app.http('users-update-work-experience', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/work-experience',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.updateWorkExperience)
});
// NEW: Job preferences endpoint
functions_1.app.http('users-update-job-preferences', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/job-preferences',
    handler: (0, middleware_1.withErrorHandling)(async (req, context) => {
        try {
            const { UserService } = await Promise.resolve().then(() => __importStar(require('./src/services/user.service')));
            const { authenticate } = await Promise.resolve().then(() => __importStar(require('./src/middleware')));
            // Skip auth for OPTIONS requests
            if (req.method === 'OPTIONS') {
                return { status: 200 };
            }
            // Authenticate user and get payload
            const userPayload = authenticate(req);
            const jobPreferencesData = await req.json();
            const result = await UserService.updateJobPreferences(userPayload.userId, jobPreferencesData);
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: result,
                    message: 'Job preferences updated successfully'
                }
            };
        }
        catch (error) {
            console.error('Error updating job preferences:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update job preferences'
                }
            };
        }
    })
});
functions_1.app.http('users-deactivate', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/deactivate',
    handler: (0, middleware_1.withErrorHandling)(user_controller_1.deactivateAccount)
});
// NEW: Employers initialize endpoint
functions_1.app.http('employers-initialize', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'employers/initialize',
    handler: (0, middleware_1.withErrorHandling)(employer_controller_1.initializeEmployer)
});
// ========================================================================
// APPLICANT/EMPLOYER PROFILE ENDPOINTS (UPDATED WITH REAL IMPLEMENTATION)
// ========================================================================
// Applicant Profile Management - FIXED: Simplified function names for Azure deployment
functions_1.app.http('applicants-get', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applicants/{userId}/profile',
    handler: (0, middleware_1.withErrorHandling)(async (req, context) => {
        const userId = req.params.userId;
        try {
            const profile = await profile_service_1.ApplicantService.getApplicantProfile(userId);
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: profile
                }
            };
        }
        catch (error) {
            console.error('Error getting applicant profile:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get applicant profile'
                }
            };
        }
    })
});
functions_1.app.http('applicants-update', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applicants/{userId}/profile',
    handler: (0, middleware_1.withErrorHandling)(async (req, context) => {
        try {
            // Skip auth for OPTIONS requests
            if (req.method === 'OPTIONS') {
                return { status: 200 };
            }
            const userId = req.params.userId;
            console.log('Updating applicant profile for user:', userId);
            const profileData = await req.json();
            console.log('Profile data received fields:', Object.keys(profileData));
            console.log('hideCurrentCompany:', profileData.hideCurrentCompany);
            console.log('hideSalaryDetails:', profileData.hideSalaryDetails);
            const updatedProfile = await profile_service_1.ApplicantService.updateApplicantProfile(userId, profileData);
            console.log('Profile updated successfully');
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: updatedProfile,
                    message: 'Applicant profile updated successfully'
                }
            };
        }
        catch (error) {
            console.error('Error updating applicant profile:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update applicant profile'
                }
            };
        }
    })
});
// Employer Profile Management - FIXED: Simplified function names
functions_1.app.http('employers-get', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'employers/{userId}/profile',
    handler: (0, middleware_1.withErrorHandling)(async (req, context) => {
        const userId = req.params.userId;
        try {
            const profile = await profile_service_1.EmployerService.getEmployerProfile(userId);
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: profile
                }
            };
        }
        catch (error) {
            console.error('Error getting employer profile:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get employer profile'
                }
            };
        }
    })
});
functions_1.app.http('employers-update', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'employers/{userId}/profile',
    handler: (0, middleware_1.withErrorHandling)(async (req, context) => {
        const userId = req.params.userId;
        try {
            const profileData = await req.json();
            const updatedProfile = await profile_service_1.EmployerService.updateEmployerProfile(userId, profileData);
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: updatedProfile,
                    message: 'Employer profile updated successfully'
                }
            };
        }
        catch (error) {
            console.error('Error updating employer profile:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update employer profile'
                }
            };
        }
    })
});
// ========================================================================
// JOB MANAGEMENT ENDPOINTS
// ========================================================================
functions_1.app.http('jobs', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs',
    handler: (0, middleware_1.withErrorHandling)(async (req, context) => {
        if (req.method === 'GET') {
            return await (0, job_controller_1.getJobs)(req, context);
        }
        else {
            return await (0, job_controller_1.createJob)(req, context);
        }
    })
});
functions_1.app.http('jobs-by-id', {
    methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/{id}',
    handler: (0, middleware_1.withErrorHandling)(async (req, context) => {
        if (req.method === 'GET') {
            return await (0, job_controller_1.getJobById)(req, context);
        }
        else if (req.method === 'PUT') {
            return await (0, job_controller_1.updateJob)(req, context);
        }
        else {
            return await (0, job_controller_1.deleteJob)(req, context);
        }
    })
});
functions_1.app.http('jobs-publish', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/{id}/publish',
    handler: (0, middleware_1.withErrorHandling)(job_controller_1.publishJob)
});
functions_1.app.http('jobs-close', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/{id}/close',
    handler: (0, middleware_1.withErrorHandling)(job_controller_1.closeJob)
});
functions_1.app.http('jobs-search', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/search',
    handler: (0, middleware_1.withErrorHandling)(job_controller_1.searchJobs)
});
// ========================================================================
// JOB APPLICATION ENDPOINTS
// ========================================================================
functions_1.app.http('applications', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications',
    handler: (0, middleware_1.withErrorHandling)(job_application_controller_1.applyForJob)
});
functions_1.app.http('applications-my', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/my',
    handler: (0, middleware_1.withErrorHandling)(job_application_controller_1.getMyApplications)
});
functions_1.app.http('job-applications', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/{jobId}/applications',
    handler: (0, middleware_1.withErrorHandling)(job_application_controller_1.getJobApplications)
});
functions_1.app.http('applications-update-status', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}/status',
    handler: (0, middleware_1.withErrorHandling)(job_application_controller_1.updateApplicationStatus)
});
functions_1.app.http('applications-withdraw', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}',
    handler: (0, middleware_1.withErrorHandling)(job_application_controller_1.withdrawApplication)
});
functions_1.app.http('applications-details', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}',
    handler: (0, middleware_1.withErrorHandling)(job_application_controller_1.getApplicationDetails)
});
functions_1.app.http('applications-stats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/stats',
    handler: (0, middleware_1.withErrorHandling)(job_application_controller_1.getApplicationStats)
});
// ========================================================================
// REFERENCE DATA ENDPOINTS
// ========================================================================
functions_1.app.http('reference-job-types', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/job-types',
    handler: (0, middleware_1.withErrorHandling)(job_controller_1.getJobTypes)
});
functions_1.app.http('reference-currencies', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/currencies',
    handler: (0, middleware_1.withErrorHandling)(job_controller_1.getCurrencies)
});
functions_1.app.http('reference-organizations', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/organizations',
    handler: (0, middleware_1.withErrorHandling)(reference_controller_1.getOrganizations)
});
functions_1.app.http('reference-colleges', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/colleges',
    handler: (0, middleware_1.withErrorHandling)(reference_controller_1.getColleges)
});
functions_1.app.http('reference-universities-by-country', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/universities-by-country',
    handler: (0, middleware_1.withErrorHandling)(reference_controller_1.getUniversitiesByCountry)
});
functions_1.app.http('reference-industries', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/industries',
    handler: (0, middleware_1.withErrorHandling)(reference_controller_1.getIndustries)
});
// ========================================================================
// HEALTH CHECK ENDPOINT
// ========================================================================
functions_1.app.http('health', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'health',
    handler: (0, middleware_1.withErrorHandling)(async (req, context) => {
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: 'NexHire Backend API is running',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        };
    })
});
// ========================================================================
// STARTUP LOG
// ========================================================================
console.log('NexHire Backend API - All functions registered');
console.log('Total endpoints: 30'); // Updated count (28 + 1 work experience + 1 job preferences endpoint)
console.log('API Base URL: https://nexhire-api-func.azurewebsites.net/api');
console.log('Ready for deployment to Azure Functions v4');
console.log('CORS middleware enabled for all endpoints');
/*
 * ========================================================================
 * COMPLETE API ENDPOINT LIST (30 total):
 * ========================================================================
 *
 * AUTHENTICATION (5 endpoints):
 * POST   /auth/register               - User registration
 * POST   /auth/login                  - User login
 * POST   /auth/logout                 - User logout
 * POST   /auth/refresh                - Refresh JWT token
 * GET    /health                      - Health check
 *
 * USER MANAGEMENT (6 endpoints):
 * GET    /users/profile               - Get user profile
 * PUT    /users/profile               - Update user profile
 * POST   /users/change-password       - Change password
 * POST   /users/verify-email          - Verify email
 * GET    /users/dashboard-stats       - Get dashboard stats
 * POST   /users/deactivate            - Deactivate account
 * POST   /employers/initialize        - Initialize employer profile (NEW)
 *
 * APPLICANT/EMPLOYER PROFILE (4 endpoints):
 * GET    /applicants/{userId}/profile          - Get applicant profile (NEW)
 * PUT    /applicants/{userId}/profile          - Update applicant profile (NEW)
 * GET    /employers/{userId}/profile           - Get employer profile (NEW)
 * PUT    /employers/{userId}/profile           - Update employer profile (NEW)
 *
 * JOB MANAGEMENT (6 endpoints):
 * GET    /jobs                        - List all jobs
 * POST   /jobs                        - Create new job
 * GET    /jobs/{id}                   - Get job details
 * PUT    /jobs/{id}                   - Update job
 * DELETE /jobs/{id}                   - Delete job
 * POST   /jobs/{id}/publish           - Publish job
 * POST   /jobs/{id}/close             - Close job
 * GET    /jobs/search                 - Search jobs
 *
 * JOB APPLICATIONS (6 endpoints):
 * POST   /applications                - Apply for job
 * GET    /applications/my             - Get my applications
 * GET    /applications/stats          - Get application stats
 * GET    /jobs/{jobId}/applications   - Get job applications
 * PUT    /applications/{id}/status    - Update application status
 * DELETE /applications/{id}           - Withdraw application
 * GET    /applications/{id}           - Get application details
 *
 * REFERENCE DATA (5 endpoints):
 * GET    /reference/job-types         - Get job types
 * GET    /reference/currencies        - Get currencies
 * GET    /reference/organizations     - Get organizations
 * GET    /reference/colleges          - Get colleges/universities
 * GET    /reference/industries        - Get industries
 * GET    /reference/universities-by-country - Get universities by country and state
 * ========================================================================
 */ 
//# sourceMappingURL=index.js.map