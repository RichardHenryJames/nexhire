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
    paginationSchema
} from '../utils/validation';
import { PaginationParams } from '../types';

// Apply for a job
export const applyForJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const applicationData = await extractRequestBody(req);
    const application = await JobApplicationService.applyForJob(applicationData, user.userId);
    
    return {
        status: 201,
        jsonBody: successResponse(application, 'Job application submitted successfully')
    };
}, ['apply:jobs']);

// Get user's applications (job seeker)
export const getMyApplications = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const params = extractQueryParams(req);
    const validatedParams = validateRequest<PaginationParams>(paginationSchema, params);
    
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
}, ['read:applications']);

// Get applications for a job (employer)
export const getJobApplications = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.jobId;
    const params = extractQueryParams(req);
    const validatedParams = validateRequest<PaginationParams>(paginationSchema, params);
    
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
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
}, ['read:applications']);

// Update application status (employer)
export const updateApplicationStatus = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const applicationId = req.params.applicationId;
    const { statusId, notes } = await extractRequestBody(req);
    
    if (!applicationId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Application ID is required' }
        };
    }
    
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
}, ['write:applications']);

// Withdraw application (job seeker)
export const withdrawApplication = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const applicationId = req.params.applicationId;
    
    if (!applicationId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Application ID is required' }
        };
    }
    
    await JobApplicationService.withdrawApplication(applicationId, user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(null, 'Application withdrawn successfully')
    };
}, ['write:applications']);

// Get application details
export const getApplicationDetails = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const applicationId = req.params.applicationId;
    
    if (!applicationId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Application ID is required' }
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
}, ['read:applications']);

// Get application statistics
export const getApplicationStats = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const stats = await JobApplicationService.getApplicationStats(user.userId, user.userType);
    
    return {
        status: 200,
        jsonBody: successResponse(stats, 'Application statistics retrieved successfully')
    };
}, ['read:applications']);