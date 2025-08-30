import { app } from '@azure/functions';

// FIXED: Import CORS middleware
import { withErrorHandling, corsHeaders } from './src/middleware';

// Import controllers
import { 
    register, 
    login, 
    logout,  // FIXED: Add logout import
    getProfile, 
    updateProfile,
    updateEducation,  // NEW: Add education update import
    changePassword, 
    verifyEmail, 
    getDashboardStats, 
    deactivateAccount, 
    refreshToken 
} from './src/controllers/user.controller';
import { 
    createJob, 
    getJobs, 
    getJobById, 
    updateJob, 
    deleteJob, 
    publishJob, 
    closeJob, 
    searchJobs, 
    getJobsByOrganization, 
    getJobTypes, 
    getCurrencies 
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
import {
    getOrganizations,
    getColleges,
    getUniversitiesByCountry,
    getIndustries,
    getCountries,  // NEW: Add countries import
    getWorkplaceTypes // NEW: Workplace types
} from './src/controllers/reference.controller';
import { initializeEmployer } from './src/controllers/employer.controller';

// NEW: Work experience controllers
import {
    getMyWorkExperiences,
    getWorkExperiences,
    getWorkExperienceById,
    createWorkExperience,
    updateWorkExperience,
    deleteWorkExperience
} from './src/controllers/work-experience.controller';
import { saveJob as saveJobCtrl, unsaveJob as unsaveJobCtrl, getMySavedJobs as getMySavedJobsCtrl } from './src/controllers/saved-jobs.controller';

// Import profile services
import { ApplicantService, EmployerService } from './src/services/profile.service';

// ========================================================================
// AUTHENTICATION & USER MANAGEMENT ENDPOINTS
// ========================================================================

app.http('auth-register', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/register',
    handler: withErrorHandling(register)
});

app.http('auth-login', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/login',
    handler: withErrorHandling(login)
});

// FIXED: Add logout endpoint
app.http('auth-logout', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/logout',
    handler: withErrorHandling(logout)
});

app.http('auth-refresh', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/refresh',
    handler: withErrorHandling(refreshToken)
});

app.http('users-profile', {
    methods: ['GET', 'PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/profile',
    handler: withErrorHandling(async (req, context) => {
        if (req.method === 'GET') {
            return await getProfile(req, context);
        } else {
            return await updateProfile(req, context);
        }
    })
});

app.http('users-change-password', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/change-password',
    handler: withErrorHandling(changePassword)
});

app.http('users-verify-email', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/verify-email',
    handler: withErrorHandling(verifyEmail)
});

app.http('users-dashboard-stats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/dashboard-stats',
    handler: withErrorHandling(getDashboardStats)
});

app.http('users-update-education', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/education',
    handler: withErrorHandling(updateEducation)
});

// ========================================================================
// WORK EXPERIENCES CRUD endpoints
// ========================================================================
app.http('my-work-experiences', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'work-experiences/my',
    handler: withErrorHandling(getMyWorkExperiences)
});

app.http('applicant-work-experiences', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'work-experiences/applicant/{applicantId}',
    handler: withErrorHandling(getWorkExperiences)
});

app.http('work-experience-by-id', {
    methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'work-experiences/{workExperienceId}',
    handler: withErrorHandling(async (req, context) => {
        if (req.method === 'GET') return await getWorkExperienceById(req, context);
        if (req.method === 'PUT') return await updateWorkExperience(req, context);
        if (req.method === 'DELETE') return await deleteWorkExperience(req, context);
        return { status: 405, jsonBody: { success: false, error: 'Method not allowed' } };
    })
});

app.http('create-work-experience', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'work-experiences',
    handler: withErrorHandling(createWorkExperience)
});

app.http('users-deactivate', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/deactivate',
    handler: withErrorHandling(deactivateAccount)
});

// NEW: Employers initialize endpoint
app.http('employers-initialize', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'employers/initialize',
    handler: withErrorHandling(initializeEmployer)
});

// ========================================================================
// APPLICANT/EMPLOYER PROFILE ENDPOINTS (FIXED: Single function per route)
// ========================================================================

// FIXED: Combined Applicant Profile Management (GET + PUT in single function)
app.http('applicants-profile', {
    methods: ['GET', 'PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applicants/{userId}/profile',
    handler: withErrorHandling(async (req, context) => {
        const userId = req.params.userId;
        
        try {
            // Handle OPTIONS for CORS
            if (req.method === 'OPTIONS') {
                return { status: 200 };
            }
            
            // Handle GET - Get applicant profile
            if (req.method === 'GET') {
                console.log('Getting applicant profile for user:', userId);
                const profile = await ApplicantService.getApplicantProfile(userId);
                return {
                    status: 200,
                    jsonBody: {
                        success: true,
                        data: profile
                    }
                };
            }
            
            // Handle PUT - Update applicant profile
            if (req.method === 'PUT') {
                console.log('Updating applicant profile for user:', userId);
                
                const profileData = await req.json() as any;
                console.log('Profile data received fields:', Object.keys(profileData));
                console.log('hideCurrentCompany:', profileData.hideCurrentCompany);
                console.log('hideSalaryDetails:', profileData.hideSalaryDetails);
                
                const updatedProfile = await ApplicantService.updateApplicantProfile(userId, profileData);
                
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
            
            // Unsupported method
            return {
                status: 405,
                jsonBody: {
                    success: false,
                    error: 'Method not allowed'
                }
            };
            
        } catch (error) {
            console.error(`Error handling applicant profile ${req.method}:`, error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : `Failed to ${req.method === 'GET' ? 'get' : 'update'} applicant profile`
                }
            };
        }
    })
});

// FIXED: Combined Employer Profile Management (GET + PUT in single function)  
app.http('employers-profile', {
    methods: ['GET', 'PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'employers/{userId}/profile',
    handler: withErrorHandling(async (req, context) => {
        const userId = req.params.userId;
        
        try {
            // Handle OPTIONS for CORS
            if (req.method === 'OPTIONS') {
                return { status: 200 };
            }
            
            // Handle GET - Get employer profile
            if (req.method === 'GET') {
                console.log('Getting employer profile for user:', userId);
                const profile = await EmployerService.getEmployerProfile(userId);
                return {
                    status: 200,
                    jsonBody: {
                        success: true,
                        data: profile
                    }
                };
            }
            
            // Handle PUT - Update employer profile
            if (req.method === 'PUT') {
                console.log('Updating employer profile for user:', userId);
                
                const profileData = await req.json() as any;
                const updatedProfile = await EmployerService.updateEmployerProfile(userId, profileData);
                
                return {
                    status: 200,
                    jsonBody: {
                        success: true,
                        data: updatedProfile,
                        message: 'Employer profile updated successfully'
                    }
                };
            }
            
            // Unsupported method
            return {
                status: 405,
                jsonBody: {
                    success: false,
                    error: 'Method not allowed'
                }
            };
            
        } catch (error) {
            console.error(`Error handling employer profile ${req.method}:`, error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : `Failed to ${req.method === 'GET' ? 'get' : 'update'} employer profile`
                }
            };
        }
    })
});

// ========================================================================
// JOB MANAGEMENT ENDPOINTS
// ========================================================================

// Specific search route moved to /search/jobs to avoid any collision with /jobs/{id}
app.http('jobs-search', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'search/jobs',
    handler: withErrorHandling(searchJobs)
});

app.http('jobs', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs',
    handler: withErrorHandling(async (req, context) => {
        if (req.method === 'GET') {
            return await getJobs(req, context);
        } else {
            return await createJob(req, context);
        }
    })
});

app.http('jobs-by-id', {
    methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/{id}',
    handler: withErrorHandling(async (req, context) => {
        if (req.method === 'GET') {
            return await getJobById(req, context);
        } else if (req.method === 'PUT') {
            return await updateJob(req, context);
        } else {
            return await deleteJob(req, context);
        }
    })
});

app.http('jobs-publish', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/{id}/publish',
    handler: withErrorHandling(publishJob)
});

app.http('jobs-close', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/{id}/close',
    handler: withErrorHandling(closeJob)
});

// ========================================================================
// JOB APPLICATION ENDPOINTS
// ========================================================================

app.http('applications', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications',
    handler: withErrorHandling(applyForJob)
});

// REPLACED: use a distinct base path to avoid collisions with applications/{applicationId}
app.http('my-applications', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'my/applications',
    handler: withErrorHandling(getMyApplications)
});

app.http('job-applications', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/{jobId}/applications',
    handler: withErrorHandling(getJobApplications)
});

app.http('applications-update-status', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}/status',
    handler: withErrorHandling(updateApplicationStatus)
});

app.http('applications-withdraw', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}',
    handler: withErrorHandling(withdrawApplication)
});

app.http('applications-details', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}',
    handler: withErrorHandling(getApplicationDetails)
});

app.http('applications-stats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/stats',
    handler: withErrorHandling(getApplicationStats)
});

// ========================================================================
// REFERENCE DATA ENDPOINTS
// ========================================================================

app.http('reference-job-types', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/job-types',
    handler: withErrorHandling(getJobTypes)
});

app.http('reference-workplace-types', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/workplace-types',
    handler: withErrorHandling(getWorkplaceTypes)
});

app.http('reference-currencies', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/currencies',
    handler: withErrorHandling(getCurrencies)
});

app.http('reference-organizations', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/organizations',
    handler: withErrorHandling(getOrganizations)
});

app.http('reference-colleges', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/colleges',
    handler: withErrorHandling(getColleges)
});

app.http('reference-universities-by-country', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/universities-by-country',
    handler: withErrorHandling(getUniversitiesByCountry)
});

app.http('reference-industries', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/industries',
    handler: withErrorHandling(getIndustries)
});

app.http('reference-countries', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/countries',
    handler: withErrorHandling(getCountries)
});

app.http('reference-salary-components', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'reference/salary-components',
    handler: withErrorHandling(async (req, context) => {
        try {
            if (req.method === 'OPTIONS') {
                return { status: 200 };
            }
            const { ApplicantService } = await import('./src/services/profile.service');
            const components = await ApplicantService.getSalaryComponents();
            return { status: 200, jsonBody: { success: true, data: components } };
        } catch (error) {
            console.error('Error getting salary components:', error);
            return { status: 500, jsonBody: { success: false, error: error instanceof Error ? error.message : 'Failed to get salary components' } };
        }
    })
});

app.http('users-profile-image', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/profile-image',
    handler: withErrorHandling(async (req, context) => {
        const { uploadProfileImage } = await import('./src/services/profile-image.service');
        return await uploadProfileImage(req, context);
    })
});

app.http('health', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'health',
    handler: withErrorHandling(async (req, context) => {
        return { status: 200, jsonBody: { success: true, message: 'NexHire Backend API is running', timestamp: new Date().toISOString(), version: '1.0.0' } };
    })
});

// ========================================================================
// SAVED JOBS ENDPOINTS
// ========================================================================

app.http('saved-jobs-save', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'saved-jobs',
    handler: withErrorHandling(saveJobCtrl)
});

app.http('saved-jobs-unsave', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'saved-jobs/{jobId}',
    handler: withErrorHandling(unsaveJobCtrl)
});

app.http('saved-jobs-my', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'my/saved-jobs',
    handler: withErrorHandling(getMySavedJobsCtrl)
});

// ========================================================================
// STARTUP LOG
// ========================================================================

console.log('NexHire Backend API - All functions registered');
console.log('API Base URL: https://nexhire-api-func.azurewebsites.net/api');
export {};

/*
 * ========================================================================
 * COMPLETE API ENDPOINT LIST (29 total):
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
 * POST   /users/change-password       - User password update
 * POST   /users/verify-email          - User email verification
 * GET    /users/dashboard-stats       - User dashboard statistics
 * POST   /users/deactivate            - User account deactivation
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
 * GET    /search/jobs                 - Search jobs
 * 
 * JOB APPLICATIONS (6 endpoints):
 * POST   /applications                - Apply for job
 * GET    /my/applications             - Get my applications
 * GET    /applications/stats          - Get application stats
 * GET    /jobs/{jobId}/applications   - Get job applications
 * PUT    /applications/{id}/status    - Update application status
 * DELETE /applications/{id}           - Withdraw application
 * GET    /applications/{id}           - Get application details
 * 
 * REFERENCE DATA (6 endpoints):
 * GET    /reference/job-types         - Get job types
 * GET    /reference/currencies        - Get currencies
 * GET    /reference/organizations     - Get organizations
 * GET    /reference/colleges          - Get colleges/universities
 * GET    /reference/industries        - Get industries
 * GET    /reference/universities-by-country - Get universities by country and state
 * GET    /reference/countries         - Get countries (NEW)
 * 
 * SAVED JOBS (3 endpoints):
 * POST   /saved-jobs                 - Save a job
 * DELETE /saved-jobs/{jobId}        - Unsave a job
 * GET    /my/saved-jobs              - Get my saved jobs
 * ========================================================================
 */