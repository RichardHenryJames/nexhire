import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { JobApplicationService } from '../services/job-application.service';
import { 
    withErrorHandling, 
    withAuth
} from '../middleware';
import { 
    successResponse, 
    extractRequestBody, 
    extractQueryParams,
    validateRequest,
    paginationSchema,
    jobApplicationsPaginationSchema,
    isValidGuid
} from '../utils/validation';
import { PaginationParams } from '../types';

// Apply for a job - FIXED: Better error handling and validation
export const applyForJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const applicationData = await extractRequestBody(req);
        
        // FIXED: Validate jobID format before processing
        if (!applicationData.jobID) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Job ID is required' }
            };
        }

        if (!isValidGuid(applicationData.jobID)) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Invalid Job ID format' }
            };
        }

        const application = await JobApplicationService.applyForJob(applicationData, user.userId);
        
        return {
            status: 201,
            jsonBody: successResponse(application, 'Job application submitted successfully')
        };
    } catch (error) {
        console.error('Error in applyForJob:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Internal server error', 
                message: error instanceof Error ? error.message : 'Failed to submit application'
            }
        };
    }
}, ['apply:jobs']);

// Get user's applications (job seeker) - FIXED: Better error handling
export const getMyApplications = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const params = extractQueryParams(req);
        
        // Use safe defaults if validation fails
        let validatedParams: PaginationParams;
        try {
            validatedParams = validateRequest<PaginationParams>(paginationSchema, params);
        } catch (error) {
            validatedParams = { page: 1, pageSize: 20, sortBy: 'SubmittedAt', sortOrder: 'desc' };
        }
        
        const result = await JobApplicationService.getApplicationsByUser(user.userId, validatedParams);
        
        return {
            status: 200,
            jsonBody: successResponse(result.applications, 'Applications retrieved successfully', {
                page: validatedParams.page,
                pageSize: validatedParams.pageSize,
                total: result.total,
                totalPages: result.totalPages
            })
        };
    } catch (error) {
        console.error('Error in getMyApplications:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Internal server error', 
                message: 'Failed to retrieve applications'
            }
        };
    }
}, ['read:applications']);

// Get applications for a job (employer) - FIXED: Better validation and error handling
export const getJobApplications = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const jobId = req.params.jobId;
        
        if (!jobId) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Job ID is required' }
            };
        }

        // FIXED: Validate GUID format before database call
        if (!isValidGuid(jobId)) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Invalid Job ID format' }
            };
        }

        const params = extractQueryParams(req);
        
        // FIXED: Use extended pagination schema that allows search parameters
        let validatedParams: PaginationParams;
        try {
            validatedParams = validateRequest<PaginationParams>(jobApplicationsPaginationSchema, params);
        } catch (error) {
            // Use safe defaults if validation fails
            validatedParams = { 
                page: 1, 
                pageSize: 20, 
                sortBy: 'SubmittedAt', 
                sortOrder: 'desc' 
            };
        }
        
        const statusFilter = params.statusFilter ? parseInt(params.statusFilter as string) : undefined;
        const result = await JobApplicationService.getApplicationsByJob(
            jobId, 
            user.userId, 
            { ...validatedParams, statusFilter }
        );
        
        return {
            status: 200,
            jsonBody: successResponse(result.applications, 'Job applications retrieved successfully', {
                page: validatedParams.page,
                pageSize: validatedParams.pageSize,
                total: result.total,
                totalPages: result.totalPages
            })
        };
    } catch (error) {
        console.error('Error in getJobApplications:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Internal server error', 
                message: 'Failed to retrieve job applications'
            }
        };
    }
}, ['read:applications']);

// Update application status (employer) - FIXED: Add comprehensive GUID validation
export const updateApplicationStatus = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const applicationId = req.params.applicationId;
        
        if (!applicationId) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Application ID is required' }
            };
        }

        // FIXED: Validate GUID format before database call
        if (!isValidGuid(applicationId)) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Invalid Application ID format' }
            };
        }

        const { statusId, notes } = await extractRequestBody(req);
        
        if (!statusId) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Status ID is required' }
            };
        }
        
        const updatedApplication = await JobApplicationService.updateApplicationStatus(
            applicationId, 
            statusId, 
            user.userId, 
            notes
        );
        
        return {
            status: 200,
            jsonBody: successResponse(updatedApplication, 'Application status updated successfully')
        };
    } catch (error) {
        console.error('Error in updateApplicationStatus:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Internal server error', 
                message: 'Failed to update application status'
            }
        };
    }
}, ['write:applications']);

// Withdraw application (job seeker) - scope adjusted from write:applications -> apply:jobs (job seeker tokens only have apply:jobs)
export const withdrawApplication = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const applicationId = req.params.applicationId;
        
        if (!applicationId) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Application ID is required' }
            };
        }

        // FIXED: Validate GUID format before database call
        if (!isValidGuid(applicationId)) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Invalid Application ID format' }
            };
        }
        
        await JobApplicationService.withdrawApplication(applicationId, user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(null, 'Application withdrawn successfully')
        };
    } catch (error) {
        console.error('Error in withdrawApplication:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Internal server error', 
                message: 'Failed to withdraw application'
            }
        };
    }
}, ['apply:jobs']);

// Get application details - FIXED: Add comprehensive GUID validation
export const getApplicationDetails = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const applicationId = req.params.applicationId;
        
        if (!applicationId) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Application ID is required' }
            };
        }

        // FIXED: Validate GUID format before database call
        if (!isValidGuid(applicationId)) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Invalid Application ID format' }
            };
        }
        
        const application = await JobApplicationService.getApplicationDetails(applicationId, user.userId);
        
        if (!application) {
            return {
                status: 404,
                jsonBody: { success: false, error: 'Application not found' }
            };
        }
        
        return {
            status: 200,
            jsonBody: successResponse(application, 'Application details retrieved successfully')
        };
    } catch (error) {
        console.error('Error in getApplicationDetails:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Internal server error', 
                message: 'Failed to retrieve application details'
            }
        };
    }
}, ['read:applications']);

// Get application statistics - FIXED: Better error handling
export const getApplicationStats = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const stats = await JobApplicationService.getApplicationStats(user.userId, user.userType);
        
        return {
            status: 200,
            jsonBody: successResponse(stats, 'Application statistics retrieved successfully')
        };
    } catch (error) {
        console.error('Error in getApplicationStats:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: 'Internal server error', 
                message: 'Failed to retrieve application statistics'
            }
        };
    }
}, ['read:applications']);