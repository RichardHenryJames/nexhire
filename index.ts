// Azure Functions v4 Main Entry Point
// This file registers all functions with the Azure Functions runtime

import { app } from '@azure/functions';

// Import controllers
import { register, login, getProfile, updateProfile } from './src/controllers/user.controller';
import { getJobs, createJob, getJobById, updateJob, deleteJob, publishJob, closeJob, searchJobs, getJobTypes } from './src/controllers/job.controller';
import { applyForJob, getMyApplications, getJobApplications } from './src/controllers/job-application.controller';

// Register all HTTP functions
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

console.log('? NexHire Backend API - All functions registered');

export {};