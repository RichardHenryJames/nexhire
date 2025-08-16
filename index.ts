/*
 * ========================================================================
 * NexHire Backend API - Azure Functions v4 Single Entry Point
 * ========================================================================
 * 
 * ??  IMPORTANT: CLEANUP LEGACY FOLDERS ??
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

// Azure Functions v4 Main Entry Point
// This file registers all functions with the Azure Functions runtime

import { app } from '@azure/functions';

// Import controllers
import { 
    register, 
    login, 
    getProfile, 
    updateProfile, 
    changePassword, 
    verifyEmail, 
    getDashboardStats, 
    deactivateAccount,
    refreshToken 
} from './src/controllers/user.controller';

import { 
    getJobs, 
    createJob, 
    getJobById, 
    updateJob, 
    deleteJob, 
    publishJob, 
    closeJob, 
    searchJobs, 
    getJobTypes 
} from './src/controllers/job.controller';

import { 
    applyForJob, 
    getMyApplications, 
    getJobApplications, 
    updateApplicationStatus, 
    withdrawApplication, 
    getApplicationDetails, 
    getApplicationStats 
} from './src/controllers/job-application.controller';

// ========================================================================
// AUTHENTICATION & USER MANAGEMENT ENDPOINTS
// ========================================================================

app.http('auth-register', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'auth/register',
    handler: register
});

app.http('auth-login', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'auth/login',
    handler: login
});

app.http('auth-refresh', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'auth/refresh',
    handler: refreshToken
});

app.http('users-profile', {
    methods: ['GET', 'PUT'],
    authLevel: 'anonymous',
    route: 'users/profile',
    handler: async (req, context) => {
        if (req.method === 'GET') {
            return await getProfile(req, context);
        } else {
            return await updateProfile(req, context);
        }
    }
});

app.http('users-change-password', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'users/change-password',
    handler: changePassword
});

app.http('users-verify-email', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'users/verify-email',
    handler: verifyEmail
});

app.http('users-dashboard-stats', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'users/dashboard-stats',
    handler: getDashboardStats
});

app.http('users-deactivate', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'users/deactivate',
    handler: deactivateAccount
});

// ========================================================================
// JOB MANAGEMENT ENDPOINTS
// ========================================================================

app.http('jobs', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'jobs',
    handler: async (req, context) => {
        if (req.method === 'GET') {
            return await getJobs(req, context);
        } else {
            return await createJob(req, context);
        }
    }
});

app.http('jobs-by-id', {
    methods: ['GET', 'PUT', 'DELETE'],
    authLevel: 'anonymous',
    route: 'jobs/{id}',
    handler: async (req, context) => {
        if (req.method === 'GET') {
            return await getJobById(req, context);
        } else if (req.method === 'PUT') {
            return await updateJob(req, context);
        } else {
            return await deleteJob(req, context);
        }
    }
});

app.http('jobs-publish', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'jobs/{id}/publish',
    handler: publishJob
});

app.http('jobs-close', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'jobs/{id}/close',
    handler: closeJob
});

app.http('jobs-search', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'jobs/search',
    handler: searchJobs
});

// ========================================================================
// JOB APPLICATION ENDPOINTS
// ========================================================================

app.http('applications', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'applications',
    handler: applyForJob
});

app.http('applications-my', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'applications/my',
    handler: getMyApplications
});

app.http('job-applications', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'jobs/{jobId}/applications',
    handler: getJobApplications
});

app.http('applications-update-status', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}/status',
    handler: updateApplicationStatus
});

app.http('applications-withdraw', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}',
    handler: withdrawApplication
});

app.http('applications-details', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}',
    handler: getApplicationDetails
});

app.http('applications-stats', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'applications/stats',
    handler: getApplicationStats
});

// ========================================================================
// REFERENCE DATA ENDPOINTS
// ========================================================================

app.http('reference-job-types', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'reference/job-types',
    handler: getJobTypes
});

app.http('reference-currencies', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'reference/currencies',
    handler: async (req, context) => {
        // Get currencies reference data
        const { dbService } = await import('./src/services/database.service');
        
        try {
            const query = 'SELECT CurrencyID, Code, Symbol, Name FROM Currencies ORDER BY Code';
            const result = await dbService.executeQuery(query);
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: result.recordset || [],
                    message: 'Currencies retrieved successfully'
                }
            };
        } catch (error) {
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: 'Internal server error',
                    message: 'Failed to retrieve currencies'
                }
            };
        }
    }
});

// ========================================================================
// HEALTH CHECK ENDPOINT
// ========================================================================

app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'health',
    handler: async (req, context) => {
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: 'NexHire Backend API is running',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        };
    }
});

// ========================================================================
// STARTUP LOG
// ========================================================================

console.log('?? NexHire Backend API - All functions registered');
console.log('?? Total endpoints: 18');
console.log('?? API Base URL: https://nexhire-api-func.azurewebsites.net/api');
console.log('? Ready for deployment to Azure Functions v4');

export {};

/*
 * ========================================================================
 * COMPLETE API ENDPOINT LIST (18 total):
 * ========================================================================
 * 
 * ?? AUTHENTICATION (4 endpoints):
 * POST   /auth/register               - User registration
 * POST   /auth/login                  - User login
 * POST   /auth/refresh                - Refresh JWT token
 * GET    /health                      - Health check
 * 
 * ?? USER MANAGEMENT (5 endpoints):
 * GET    /users/profile               - Get user profile
 * PUT    /users/profile               - Update user profile
 * POST   /users/change-password       - Change password
 * POST   /users/verify-email          - Verify email
 * GET    /users/dashboard-stats       - Get dashboard stats
 * POST   /users/deactivate            - Deactivate account
 * 
 * ?? JOB MANAGEMENT (6 endpoints):
 * GET    /jobs                        - List all jobs
 * POST   /jobs                        - Create new job
 * GET    /jobs/{id}                   - Get job details
 * PUT    /jobs/{id}                   - Update job
 * DELETE /jobs/{id}                   - Delete job
 * POST   /jobs/{id}/publish           - Publish job
 * POST   /jobs/{id}/close             - Close job
 * GET    /jobs/search                 - Search jobs
 * 
 * ?? JOB APPLICATIONS (6 endpoints):
 * POST   /applications                - Apply for job
 * GET    /applications/my             - Get my applications
 * GET    /applications/stats          - Get application stats
 * GET    /jobs/{jobId}/applications   - Get job applications
 * PUT    /applications/{id}/status    - Update application status
 * DELETE /applications/{id}           - Withdraw application
 * GET    /applications/{id}           - Get application details
 * 
 * ?? REFERENCE DATA (2 endpoints):
 * GET    /reference/job-types         - Get job types
 * GET    /reference/currencies        - Get currencies
 * 
 * ========================================================================
 */