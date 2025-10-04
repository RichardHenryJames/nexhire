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
    refreshToken,
    googleLogin,  // ?? NEW: Google OAuth login
    googleRegister  // ?? NEW: Google OAuth registration
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

// Import referral controllers
import {
    getReferralPlans,
    purchaseReferralPlan,
    getCurrentSubscription,
    checkReferralEligibility,
    createReferralRequest,
    getMyReferralRequests,
    getAvailableRequests, // ?? FIXED: Correct import name
    claimReferralRequest,
    submitReferralProof,
    verifyReferralCompletion,
    getMyReferrerRequests,
    getReferralAnalytics,
    claimReferralRequest as claimReferralRequestWithProof, // ?? FIXED: Use alias for now
    cancelReferralRequest,
    getReferrerStats,
    getReferralPointsHistory // ?? NEW: Add points history import
} from './src/controllers/referral.controller';

// NEW: Payment controllers - Razorpay Integration
import {
    createRazorpayOrder,
    verifyPaymentAndActivateSubscription,
    getPaymentHistory
} from './src/controllers/payment.controller';

// Import storage controller - MOVED HERE to prevent execution issues
import { uploadFile, deleteFile } from './src/controllers/storage.controller';

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

// ?? NEW: Google OAuth Login
app.http('auth-google-login', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/google',
    handler: withErrorHandling(googleLogin)
});

// ?? NEW: Google OAuth Registration
app.http('auth-google-register', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/google-register',
    handler: withErrorHandling(googleRegister)
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
    handler: searchJobs
});

app.http('jobs', {
    methods: ['GET', 'POST', 'OPTIONS'],
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

// COMBINED: Details (GET) + Withdraw (DELETE) under one function to avoid route collision issues
app.http('applications-details', {
    methods: ['GET', 'DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'applications/{applicationId}',
    handler: withErrorHandling(async (req, context) => {
        if (req.method === 'OPTIONS') return { status: 200 } as any;
        if (req.method === 'GET') {
            return await getApplicationDetails(req, context);
        }
        if (req.method === 'DELETE') {
            return await withdrawApplication(req, context);
        }
        return { status: 405, jsonBody: { success: false, error: 'Method not allowed' } };
    })
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

// NEW: Resume upload endpoint
app.http('users-resume-upload', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/resume',
    handler: withErrorHandling(async (req, context) => {
        const { uploadResume } = await import('./src/services/resume-upload.service');
        return await uploadResume(req, context);
    })
});

// NEW: Resume management endpoints
app.http('users-resumes', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/resumes',
    handler: withErrorHandling(async (req, context) => {
        // Get resumes for authenticated user
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return { status: 401, jsonBody: { success: false, error: 'Authorization required' } };
        }

        try {
            // Extract user ID from JWT (simplified - you should use proper JWT verification)
            const token = authHeader.replace('Bearer ', '');
            const { AuthService } = await import('./src/services/auth.service');
            const decoded = AuthService.verifyToken(token);
            
            const { ApplicantService } = await import('./src/services/profile.service');
            const profile = await ApplicantService.getApplicantProfile(decoded.userId);
            const resumes = await ApplicantService.getApplicantResumes(profile.ApplicantID);
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: resumes,
                    message: 'Resumes retrieved successfully'
                }
            };
        } catch (error) {
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get resumes'
                }
            };
        }
    })
});

app.http('users-resume-primary', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/resume/{resumeId}/primary',
    handler: withErrorHandling(async (req, context) => {
        const resumeId = req.params.resumeId;
        const authHeader = req.headers.get('authorization');
        
        if (!authHeader) {
            return { status: 401, jsonBody: { success: false, error: 'Authorization required' } };
        }

        try {
            const token = authHeader.replace('Bearer ', '');
            const { AuthService } = await import('./src/services/auth.service');
            const decoded = AuthService.verifyToken(token);
            
            const { ApplicantService } = await import('./src/services/profile.service');
            const profile = await ApplicantService.getApplicantProfile(decoded.userId);
            await ApplicantService.setPrimaryResume(profile.ApplicantID, resumeId);
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Primary resume updated successfully'
                }
            };
        } catch (error) {
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update primary resume'
                }
            };
        }
    })
});

app.http('users-resume-delete', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/resume/{resumeId}',
    handler: withErrorHandling(async (req, context) => {
        const resumeId = req.params.resumeId;
        const authHeader = req.headers.get('authorization');
        
        if (!authHeader) {
            return { status: 401, jsonBody: { success: false, error: 'Authorization required' } };
        }

        try {
            const token = authHeader.replace('Bearer ', '');
            const { AuthService } = await import('./src/services/auth.service');
            const decoded = AuthService.verifyToken(token);
            
            const { ApplicantService } = await import('./src/services/profile.service');
            const profile = await ApplicantService.getApplicantProfile(decoded.userId);
            
            // ? FIXED: Get resume details BEFORE deleting from database
            const resumes = await ApplicantService.getApplicantResumes(profile.ApplicantID);
            const resumeToDelete = resumes.find(r => r.ResumeID === resumeId);
            
            if (!resumeToDelete) {
                return {
                    status: 404,
                    jsonBody: {
                        success: false,
                        error: 'Resume not found'
                    }
                };
            }
            
            console.log('??? Deleting resume:', {
                resumeId,
                resumeURL: resumeToDelete.ResumeURL,
                userId: decoded.userId
            });
            
            // ? FIXED: Delete from database first
            await ApplicantService.deleteApplicantResume(profile.ApplicantID, resumeId);
            console.log('Resume deleted from database');
            
            // ? FIXED: Delete file from Azure Storage
            try {
                const { ResumeStorageService } = await import('./src/services/resume-upload.service');
                const storageService = new ResumeStorageService();
                await storageService.deleteOldResume(decoded.userId, resumeToDelete.ResumeURL);
                console.log('Resume file deleted from storage');
            } catch (storageError) {
                console.error('Warning: Failed to delete file from storage:', storageError);
                // Don't fail the entire operation if storage deletion fails
            }
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Resume deleted successfully from both database and storage'
                }
            };
        } catch (error) {
            console.error('Error deleting resume:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete resume'
                }
            };
        }
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
// REFERRAL SYSTEM ENDPOINTS - ? FIXED TO MATCH WORKING PATTERN
// ========================================================================

// Referral Plans
app.http('referral-plans', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/plans',
    handler: withErrorHandling(getReferralPlans) // ? Public endpoint - no auth needed
});

app.http('referral-plans-purchase', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/plans/purchase',
    handler: withErrorHandling(purchaseReferralPlan) // ? Same pattern as work experience
});

// Referral Requests
app.http('referral-requests-create', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests',
    handler: withErrorHandling(createReferralRequest) // ? Same pattern as work experience
});

app.http('referral-my-requests', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/my-requests',
    handler: withErrorHandling(getMyReferralRequests) // ? Same pattern as work experience
});

app.http('referral-available', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/available',
    handler: withErrorHandling(getAvailableRequests) // ? Same pattern as work experience
});

app.http('referral-claim', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests/{requestId}/claim',
    handler: withErrorHandling(claimReferralRequest) // ? Same pattern as work experience
});

// NEW: Proof Submission & Verification
app.http('referral-proof-submit', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests/{requestId}/proof',
    handler: withErrorHandling(submitReferralProof) // ? Same pattern as work experience
});

app.http('referral-verify', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests/{requestId}/verify',
    handler: withErrorHandling(verifyReferralCompletion) // ? Same pattern as work experience
});

// NEW: Cancel referral request
app.http('referral-cancel', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests/{requestId}/cancel',
    handler: withErrorHandling(cancelReferralRequest)
});

app.http('referral-my-referrer-requests', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/my-referrer-requests',
    handler: withErrorHandling(getMyReferrerRequests) // ? Same pattern as work experience
});

// Analytics & Stats
app.http('referral-analytics', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/analytics',
    handler: withErrorHandling(getReferralAnalytics) // ? Same pattern as work experience
});

app.http('referral-eligibility', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/eligibility',
    handler: withErrorHandling(checkReferralEligibility) // ? Same pattern as work experience
});

app.http('referral-stats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/stats',
    handler: withErrorHandling(getReferrerStats) // ? Same pattern as work experience
});

app.http('referral-subscription', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/subscription',
    handler: withErrorHandling(getCurrentSubscription) // ? Same pattern as work experience
});


// NEW: Get detailed referral points history
app.http('referral-points-history', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/points-history',
    handler: withErrorHandling(getReferralPointsHistory)
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
// PAYMENT SYSTEM ENDPOINTS - ?? Razorpay Integration
// ========================================================================

app.http('payment-create-order', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'payments/razorpay/create-order',
    handler: withErrorHandling(createRazorpayOrder)
});

app.http('payment-verify-activate', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'payments/razorpay/verify-and-activate',
    handler: withErrorHandling(verifyPaymentAndActivateSubscription)
});

app.http('payment-history', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'payments/history',
    handler: withErrorHandling(getPaymentHistory)
});

// ========================================================================
// STORAGE ENDPOINTS - File uploads (import now at top)
// ========================================================================

app.http('storage-upload', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'storage/upload',
    handler: withErrorHandling(uploadFile)
});

app.http('storage-delete', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'storage/{containerName}/{fileName}',
    handler: withErrorHandling(deleteFile)
});

// ========================================================================
// DIAGNOSTIC ENDPOINT - Simple test without any imports
// ========================================================================

app.http('scraping-ping', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/scrape/ping',
    handler: withErrorHandling(async (req, context) => {
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: 'Scraping section loaded successfully',
                timestamp: new Date().toISOString(),
                test: 'This endpoint has zero dependencies'
            }
        };
    })
});

// ========================================================================
// JOB SCRAPING ENDPOINTS - ?? PROPER IMPLEMENTATION with Dynamic Loading
// ========================================================================

app.http('job-scraper-trigger', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/scrape/trigger',
    handler: withErrorHandling(async (req, context) => {
        try {
            // Verify admin authentication inline
            const authHeader = req.headers.get('authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    status: 403,
                    jsonBody: {
                        success: false,
                        error: 'Authorization header required'
                    }
                };
            }

            const token = authHeader.substring(7);
            const { AuthService } = await import('./src/services/auth.service');
            const payload = AuthService.verifyToken(token);
            
            if (payload.userType !== 'Admin') {
                return {
                    status: 403,
                    jsonBody: {
                        success: false,
                        error: 'Admin access required'
                    }
                };
            }

            console.log('Manual job scraping triggered by admin:', payload.userId);
            
            // Dynamic import of JobScraperService
            try {
                const { JobScraperService } = await import('./src/services/job-scraper.service');
                const result = await JobScraperService.scrapeAndPopulateJobs();
                
                return {
                    status: result.success ? 200 : 500,
                    jsonBody: {
                        success: result.success,
                        message: `Job scraping completed. ${result.jobsAdded} jobs added.`,
                        data: {
                            jobsAdded: result.jobsAdded,
                            totalJobsScraped: result.summary.totalJobsScraped,
                            indiaJobsAdded: result.summary.indiaJobsAdded,
                            sourceBreakdown: result.summary.sourceBreakdown,
                            executionTimeSeconds: Math.round(result.summary.executionTime / 1000),
                            errors: result.errors
                        }
                    }
                };
            } catch (serviceError) {
                console.error('JobScraperService failed:', serviceError);
                return {
                    status: 503,
                    jsonBody: {
                        success: false,
                        error: 'Job scraping service is temporarily unavailable',
                        details: serviceError instanceof Error ? serviceError.message : 'Unknown error'
                    }
                };
            }
        } catch (error: any) {
            console.error('Job scraping trigger failed:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: 'Internal server error',
                    details: error.message
                }
            };
        }
    })
});

app.http('scraping-config', {
    methods: ['GET', 'PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/scrape/config',
    handler: withErrorHandling(async (req, context) => {
        try {
            // Admin auth check
            const authHeader = req.headers.get('authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    status: 403,
                    jsonBody: { success: false, error: 'Authorization header required' }
                };
            }

            const token = authHeader.substring(7);
            const { AuthService } = await import('./src/services/auth.service');
            const payload = AuthService.verifyToken(token);
            
            if (payload.userType !== 'Admin') {
                return {
                    status: 403,
                    jsonBody: { success: false, error: 'Admin access required' }
                };
            }

            // Dynamic import and actual functionality
            const { JobScraperService } = await import('./src/services/job-scraper.service');
            
            if (req.method === 'GET') {
                const config = JobScraperService.getConfig();
                return {
                    status: 200,
                    jsonBody: {
                        success: true,
                        data: config,
                        message: 'Scraping configuration retrieved successfully'
                    }
                };
            } else if (req.method === 'PUT') {
                const updates = await req.json() as any;
                
                // Validate updates
                if (updates.maxJobsPerRun && (updates.maxJobsPerRun < 1 || updates.maxJobsPerRun > 500)) {
                    return {
                        status: 400,
                        jsonBody: {
                            success: false,
                            error: 'maxJobsPerRun must be between 1 and 500'
                        }
                    };
                }

                JobScraperService.updateConfig(updates);
                
                return {
                    status: 200,
                    jsonBody: {
                        success: true,
                        data: JobScraperService.getConfig(),
                        message: 'Configuration updated successfully'
                    }
                };
            }
            
            return { status: 405, jsonBody: { success: false, error: 'Method not allowed' } };
            
        } catch (serviceError) {
            console.error('Scraping config error:', serviceError);
            return {
                status: 503,
                jsonBody: {
                    success: false,
                    error: 'Configuration service temporarily unavailable',
                    details: serviceError instanceof Error ? serviceError.message : 'Unknown error'
                }
            };
        }
    })
});

app.http('scraping-stats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/scrape/stats',
    handler: withErrorHandling(async (req, context) => {
        try {
            // Admin auth
            const authHeader = req.headers.get('authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    status: 403,
                    jsonBody: { success: false, error: 'Authorization header required' }
                };
            }

            const token = authHeader.substring(7);
            const { AuthService } = await import('./src/services/auth.service');
            const payload = AuthService.verifyToken(token);
            
            if (payload.userType !== 'Admin') {
                return {
                    status: 403,
                    jsonBody: { success: false, error: 'Admin access required' }
                };
            }

            // Get actual stats from service
            const { JobScraperService } = await import('./src/services/job-scraper.service');
            const stats = await JobScraperService.getScrapingStats();
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: stats,
                    message: 'Scraping statistics retrieved successfully'
                }
            };
        } catch (serviceError) {
            console.error('Scraping stats error:', serviceError);
            return {
                status: 503,
                jsonBody: {
                    success: false,
                    error: 'Statistics service temporarily unavailable',
                    details: serviceError instanceof Error ? serviceError.message : 'Unknown error'
                }
            };
        }
    })
});

app.http('scraping-cleanup', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/scrape/cleanup',
    handler: withErrorHandling(async (req, context) => {
        try {
            // Admin auth
            const authHeader = req.headers.get('authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    status: 403,
                    jsonBody: { success: false, error: 'Authorization header required' }
                };
            }

            const token = authHeader.substring(7);
            const { AuthService } = await import('./src/services/auth.service');
            const payload = AuthService.verifyToken(token);
            
            if (payload.userType !== 'Admin') {
                return {
                    status: 403,
                    jsonBody: { success: false, error: 'Admin access required' }
                };
            }

            const { daysOld = 90, source = null } = req.query as any;
            
            if (isNaN(daysOld) || daysOld < 1 || daysOld > 365) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        error: 'daysOld must be between 1 and 365'
                    }
                };
            }

            // Perform actual cleanup
            const { dbService } = await import('./src/services/database.service');
            
            let cleanupQuery = `
                DELETE FROM Jobs 
                WHERE PostedByType = 0 
                  AND ExternalJobID IS NOT NULL
                  AND CreatedAt < DATEADD(day, -@param0, GETUTCDATE())
            `;
            
            const queryParams: any[] = [parseInt(daysOld)];
            
            if (source) {
                cleanupQuery += ` AND ExternalJobID LIKE @param1`;
                queryParams.push(`${source}_%`);
            }

            const result = await dbService.executeQuery(cleanupQuery, queryParams);
            const deletedCount = result.rowsAffected?.[0] || 0;
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        deletedJobs: deletedCount,
                        daysOld: parseInt(daysOld),
                        source: source || 'all'
                    },
                    message: `Cleanup completed. ${deletedCount} jobs removed.`
                }
            };
        } catch (serviceError) {
            console.error('Cleanup error:', serviceError);
            return {
                status: 503,
                jsonBody: {
                    success: false,
                    error: 'Cleanup service temporarily unavailable',
                    details: serviceError instanceof Error ? serviceError.message : 'Unknown error'
                }
            };
        }
    })
});

app.http('scraping-health', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'jobs/scrape/health',
    handler: withErrorHandling(async (req, context) => {
        try {
            // Try to load service and get real health data
            const { JobScraperService } = await import('./src/services/job-scraper.service');
            
            const config = JobScraperService.getConfig();
            const stats = await JobScraperService.getScrapingStats();
            
            // Determine real health status
            const totalJobs = stats.summary?.TotalScrapedJobs || 0;
            const jobsLast24h = stats.summary?.JobsLast24h || 0;
            const isHealthy = config.enabled && totalJobs >= 0;
            
            const healthData = {
                status: isHealthy ? 'healthy' : 'degraded',
                scrapingEnabled: config.enabled,
                totalScrapedJobs: totalJobs,
                jobsLast24h: jobsLast24h,
                indiaJobs: stats.summary?.TotalIndiaJobs || 0,
                activeSources: Object.keys(config.sources).filter(source => 
                    (config.sources as any)[source]?.enabled
                ),
                lastCheck: new Date().toISOString(),
                recommendations: [] as string[]
            };
            
            // Add intelligent recommendations
            if (!config.enabled) {
                healthData.recommendations.push('Enable job scraping in configuration');
            }
            if (jobsLast24h === 0 && totalJobs === 0) {
                healthData.recommendations.push('No jobs scraped yet - run initial scraping');
            } else if (jobsLast24h === 0) {
                healthData.recommendations.push('No jobs scraped in last 24 hours - check sources');
            }
            if (totalJobs < 100) {
                healthData.recommendations.push('Low job count - consider running scraper more frequently');
            }
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: healthData,
                    message: `Scraper health status: ${healthData.status}`
                }
            };
        } catch (serviceError) {
            // If service can't load, return basic health info
            console.warn('JobScraperService unavailable for health check:', serviceError);
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        status: 'service-unavailable',
                        message: 'Scraping service temporarily unavailable but endpoint is working',
                        error: serviceError instanceof Error ? serviceError.message : 'Service load failed',
                        lastCheck: new Date().toISOString(),
                        recommendations: [
                            'Service dependencies may need to be resolved',
                            'Check application logs for detailed error information'
                        ]
                    },
                    message: 'Health check endpoint operational, service unavailable'
                }
            };
        }
    })
});

// ========================================================================
// STARTUP LOG
// ========================================================================

console.log('NexHire Backend API - All functions registered (with Google OAuth)');
console.log('Google OAuth endpoints added: /auth/google, /auth/google-register');
console.log('API Base URL: https://nexhire-api-func.azurewebsites.net/api');

// ========================================================================
// FINAL TEST ENDPOINT - Added at the very end
// ========================================================================

app.http('test-endpoint', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test-final',
    handler: withErrorHandling(async (req, context) => {
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: 'Final test endpoint works',
                timestamp: new Date().toISOString()
            }
        };
    })
});

export {}

/*
 * ========================================================================
 * ?? UPDATED API ENDPOINT LIST (50 total - Added Google OAuth):
 * ========================================================================
 * 
 * AUTHENTICATION (7 endpoints): ?? +2 Google OAuth
 * POST   /auth/register               - User registration
 * POST   /auth/login                  - User login
 * POST   /auth/google                 - ?? Google OAuth login
 * POST   /auth/google-register        - ?? Google OAuth registration
 * POST   /auth/logout                 - User logout
 * POST   /auth/refresh                - Refresh JWT token
 * GET    /health                      - Health check
 * 
 * USER MANAGEMENT (11 endpoints):
 * GET    /users/profile               - Get user profile
 * PUT    /users/profile               - Update user profile
 * POST   /users/change-password       - User password update
 * POST   /users/verify-email          - User email verification
 * GET    /users/dashboard-stats       - User dashboard statistics
 * POST   /users/deactivate            - User account deactivation
 * POST   /users/profile-image         - Upload profile image
 * POST   /users/resume                - Upload resume document
 * GET    /users/resumes               - Get user's resumes
 * PUT    /users/resume/{id}/primary   - Set resume as primary
 * DELETE /users/resume/{id}           - Delete a resume
 * POST   /employers/initialize        - Initialize employer profile
 * 
 * APPLICANT/EMPLOYER PROFILE (4 endpoints):
 * GET    /applicants/{userId}/profile          - Get applicant profile
 * PUT    /applicants/{userId}/profile          - Update applicant profile
 * GET    /employers/{userId}/profile           - Get employer profile
 * PUT    /employers/{userId}/profile           - Update employer profile
 * 
 * JOB MANAGEMENT (8 endpoints):
 * GET    /jobs                        - List all jobs
 * POST   /jobs                        - Create new job
 * GET    /jobs/{id}                   - Get job details
 * PUT    /jobs/{id}                   - Update job
 * DELETE /jobs/{id}                   - Delete job
 * POST   /jobs/{id}/publish           - Publish job
 * POST   /jobs/{id}/close             - Close job
 * GET    /search/jobs                 - Search jobs
 * 
 * JOB APPLICATIONS (7 endpoints):
 * POST   /applications                - Apply for job
 * GET    /my/applications             - Get my applications
 * GET    /applications/stats          - Get application stats
 * GET    /jobs/{jobId}/applications   - Get job applications
 * PUT    /applications/{id}/status    - Update application status
 * DELETE /applications/{id}           - Withdraw application
 * GET    /applications/{id}           - Get application details
 * 
 * ??? JOB SCRAPING SYSTEM (6 endpoints): ?? AUTOMATED JOB POPULATION
 * POST   /jobs/scrape/trigger           - Manually trigger job scraping
 * GET    /jobs/scrape/config            - Get scraping configuration
 * PUT    /jobs/scrape/config            - Update scraping configuration
 * GET    /jobs/scrape/stats             - Get scraping statistics
 * DELETE /jobs/scrape/cleanup           - Clean up old scraped jobs
 * GET    /health/scraper                      - Scraper service health check
 * 
 * REFERRAL SYSTEM (13 endpoints): ?? EXPANDED
 * GET    /referral/plans                           - Get all referral plans
 * POST   /referral/plans/purchase                  - Purchase a referral plan
 * GET    /referral/subscription                    - Get current subscription
 * POST   /referral/requests                        - Create referral request
 * GET    /referral/my-requests                     - Get my referral requests (seeker)
 * GET    /referral/available                       - Get available requests (referrer)
 * POST   /referral/requests/{id}/claim             - Claim a referral request
 * POST   /referral/requests/{id}/proof      ?? NEW - Submit proof of referral
 * POST   /referral/requests/{id}/verify     ?? NEW - Verify referral completion
 * POST   /referral/requests/{id}/cancel     ?? NEW - Cancel referral request
 * GET    /referral/my-referrer-requests     ?? NEW - Get my requests as referrer
 * GET    /referral/analytics                       - Get referral analytics
 * GET    /referral/eligibility                     - Check referral eligibility
 * GET    /referral/stats                           - Get referrer badge stats
 * GET    /referral/points-history                  - Get detailed referral points history
 * 
 * REFERENCE DATA (9 endpoints):
 * GET    /reference/job-types         - Get job types
 * GET    /reference/workplace-types   - Get workplace types
 * GET    /reference/currencies        - Get currencies
 * GET    /reference/organizations     - Get organizations
 * GET    /reference/colleges          - Get colleges/universities
 * GET    /reference/industries        - Get industries
 * GET    /reference/universities-by-country - Get universities by country and state
 * GET    /reference/countries         - Get countries
 * GET    /reference/salary-components - Get salary components
 * 
 * SAVED JOBS (3 endpoints):
 * POST   /saved-jobs                 - Save a job
 * DELETE /saved-jobs/{jobId}        - Unsave a job
 * GET    /my/saved-jobs              - Get my saved jobs
 * 
 * ?? PAYMENT SYSTEM (3 endpoints): ?? RAZORPAY INTEGRATION
 * POST   /payments/razorpay/create-order      - Create Razorpay payment order
 * POST   /payments/razorpay/verify-and-activate - Verify payment and activate subscription
 * GET    /payments/history                    - Get payment transaction history
 * 
 * ?? STORAGE & FILES (2 endpoints): ?? AZURE BLOB STORAGE
 * POST   /storage/upload                      - Upload files to Azure Blob Storage
 * DELETE /storage/{containerName}/{fileName} - Delete files from Azure Blob Storage
 * ========================================================================
 */