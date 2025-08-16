import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { JobService } from '../services/job.service';
import { dbService } from '../services/database.service';
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

// Create job
export const createJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobData = await extractRequestBody(req);
    
    // Get user's organization (assuming employer has one organization for now)
    // In a real app, you might need to pass organizationId in the request
    const orgQuery = `
        SELECT OrganizationID FROM Employers 
        WHERE UserID = @param0 AND CanPostJobs = 1
    `;
    const orgResult = await dbService.executeQuery(orgQuery, [user.userId]);
    
    if (!orgResult.recordset || orgResult.recordset.length === 0) {
        return {
            status: 403,
            jsonBody: { success: false, error: 'User not authorized to post jobs' }
        };
    }

    const organizationID = orgResult.recordset[0].OrganizationID;
    const job = await JobService.createJob(jobData, user.userId, organizationID);
    
    return {
        status: 201,
        jsonBody: successResponse(job, 'Job created successfully')
    };
}, ['write:jobs']);

// Get all jobs with pagination and filtering - FIXED: Handle optional pagination
export const getJobs = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const params = extractQueryParams(req);
        
        // Use defaults if validation fails or no params provided
        let validatedParams: PaginationParams;
        try {
            validatedParams = validateRequest<PaginationParams>(paginationSchema, params);
        } catch (error) {
            // Use defaults if validation fails
            validatedParams = {
                page: 1,
                pageSize: 20,
                sortBy: undefined,
                sortOrder: 'desc'
            };
        }
        
        const result = await JobService.getJobs({ ...validatedParams, ...params });
        
        return {
            status: 200,
            jsonBody: successResponse(result.jobs, 'Jobs retrieved successfully', {
                page: validatedParams.page,
                pageSize: validatedParams.pageSize,
                total: result.total,
                totalPages: result.totalPages
            })
        };
    } catch (error) {
        console.error('Error in getJobs:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve jobs' }
        };
    }
});

// Get job by ID
export const getJobById = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }

    const job = await JobService.getJobById(jobId);
    
    if (!job) {
        return {
            status: 404,
            jsonBody: { success: false, error: 'Job not found' }
        };
    }

    return {
        status: 200,
        jsonBody: successResponse(job, 'Job retrieved successfully')
    };
});

// Update job
export const updateJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    const updateData = await extractRequestBody(req);
    
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }

    const updatedJob = await JobService.updateJob(jobId, updateData, user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(updatedJob, 'Job updated successfully')
    };
}, ['write:jobs']);

// Publish job
export const publishJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }

    const publishedJob = await JobService.publishJob(jobId, user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(publishedJob, 'Job published successfully')
    };
}, ['write:jobs']);

// Close job
export const closeJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }

    await JobService.closeJob(jobId, user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(null, 'Job closed successfully')
    };
}, ['write:jobs']);

// Delete job
export const deleteJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }

    await JobService.deleteJob(jobId, user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(null, 'Job deleted successfully')
    };
}, ['delete:jobs']);

// Search jobs - FIXED: Better error handling and optional parameters
export const searchJobs = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const searchParams = extractQueryParams(req);
        
        // Ensure we have safe defaults
        const safeParams = {
            page: searchParams.page || 1,
            pageSize: searchParams.pageSize || 20,
            search: searchParams.search || '',
            sortBy: searchParams.sortBy || 'CreatedAt',
            sortOrder: searchParams.sortOrder || 'desc',
            filters: searchParams.filters || {}
        };
        
        const result = await JobService.searchJobs(safeParams);
        
        const totalPages = Math.ceil(result.total / safeParams.pageSize);
        
        return {
            status: 200,
            jsonBody: successResponse(result.jobs, 'Jobs search completed', {
                page: safeParams.page,
                pageSize: safeParams.pageSize,
                total: result.total,
                totalPages,
                searchQuery: safeParams.search
            })
        };
    } catch (error) {
        console.error('Error in searchJobs:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to search jobs' }
        };
    }
});

// Get jobs by organization
export const getJobsByOrganization = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const organizationId = req.params.organizationId;
    const params = extractQueryParams(req);
    
    let validatedParams: PaginationParams;
    try {
        validatedParams = validateRequest<PaginationParams>(paginationSchema, params);
    } catch (error) {
        validatedParams = { page: 1, pageSize: 20, sortBy: undefined, sortOrder: 'desc' };
    }
    
    if (!organizationId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Organization ID is required' }
        };
    }

    // Check if user has access to this organization
    const accessQuery = `
        SELECT 1 FROM Employers 
        WHERE UserID = @param0 AND OrganizationID = @param1
    `;
    const accessResult = await dbService.executeQuery(accessQuery, [user.userId, organizationId]);
    
    if (!accessResult.recordset || accessResult.recordset.length === 0) {
        return {
            status: 403,
            jsonBody: { success: false, error: 'Access denied to this organization' }
        };
    }

    const result = await JobService.getJobsByOrganization(organizationId, validatedParams);
    
    return {
        status: 200,
        jsonBody: successResponse(result.jobs, 'Organization jobs retrieved successfully', {
            page: validatedParams.page,
            pageSize: validatedParams.pageSize,
            total: result.total,
            totalPages: result.totalPages
        })
    };
}, ['read:jobs']);

// Get job types (reference data)
export const getJobTypes = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const jobTypes = await JobService.getJobTypes();
    
    return {
        status: 200,
        jsonBody: successResponse(jobTypes, 'Job types retrieved successfully')
    };
});

// Get currencies (reference data)
export const getCurrencies = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const currencies = await JobService.getCurrencies();
    
    return {
        status: 200,
        jsonBody: successResponse(currencies, 'Currencies retrieved successfully')
    };
});