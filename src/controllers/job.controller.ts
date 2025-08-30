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
    paginationSchema,
    isValidGuid
} from '../utils/validation';
import { PaginationParams } from '../types';

// Create job
export const createJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const jobData = await extractRequestBody(req);
        if (user.userType !== 'Employer') {
            return { status: 403, jsonBody: { success: false, error: 'Only employers can post jobs' } };
        }
        const employerQuery = `
            SELECT e.EmployerID, e.OrganizationID, o.Name as OrganizationName
            FROM Employers e
            INNER JOIN Organizations o ON e.OrganizationID = o.OrganizationID
            WHERE e.UserID = @param0
        `;
        const employerResult = await dbService.executeQuery(employerQuery, [user.userId]);
        if (!employerResult.recordset || employerResult.recordset.length === 0) {
            return { status: 400, jsonBody: { success: false, error: 'Employer profile not found. Please complete your employer registration first.', code: 'EMPLOYER_PROFILE_MISSING' } };
        }
        const employer = employerResult.recordset[0];
        if (!jobData.title || !jobData.description) {
            return { status: 400, jsonBody: { success: false, error: 'Title and description are required' } };
        }
        const job = await JobService.createJob(jobData, user.userId, employer.OrganizationID);
        return { status: 201, jsonBody: successResponse(job, 'Job created successfully') };
    } catch (error) {
        console.error('Error in createJob:', error);
        if (error instanceof Error && error.message.includes('Invalid column name')) {
            return { status: 500, jsonBody: { success: false, error: 'Database schema error', message: 'Please contact support - database schema needs updating' } };
        }
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error occurred' } };
    }
}, ['write:jobs']);

// Get all jobs (paged, supports cursor)
export const getJobs = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const params = extractQueryParams(req);
        let validated: PaginationParams;
        try {
            validated = validateRequest<PaginationParams>(paginationSchema, params);
        } catch {
            validated = { page: 1, pageSize: 20, sortBy: undefined, sortOrder: 'desc' };
        }
        const combined = { ...params, page: validated.page, pageSize: validated.pageSize, sortBy: validated.sortBy, sortOrder: validated.sortOrder } as any;
        const result = await JobService.getJobs(combined);
        return {
            status: 200,
            jsonBody: successResponse(result.jobs, 'Jobs retrieved successfully', {
                page: combined.page,
                pageSize: combined.pageSize,
                total: result.total,
                totalPages: result.totalPages,
                hasMore: result.hasMore,
                nextCursor: result.nextCursor
            })
        };
    } catch (error) {
        console.error('Error in getJobs:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve jobs' } };
    }
});

// Get job by ID
export const getJobById = withErrorHandling(async (req: HttpRequest): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    if (!jobId) return { status: 400, jsonBody: { success: false, error: 'Job ID is required' } };
    if (!isValidGuid(jobId)) return { status: 400, jsonBody: { success: false, error: 'Invalid Job ID format' } };
    try {
        const job = await JobService.getJobById(jobId);
        if (!job) return { status: 404, jsonBody: { success: false, error: 'Job not found' } };
        return { status: 200, jsonBody: successResponse(job, 'Job retrieved successfully') };
    } catch (error) {
        console.error('Error in getJobById:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve job' } };
    }
});

// Update job
export const updateJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    if (!jobId) return { status: 400, jsonBody: { success: false, error: 'Job ID is required' } };
    if (!isValidGuid(jobId)) return { status: 400, jsonBody: { success: false, error: 'Invalid Job ID format' } };
    try {
        const updateData = await extractRequestBody(req);
        const updated = await JobService.updateJob(jobId, updateData, user.userId);
        return { status: 200, jsonBody: successResponse(updated, 'Job updated successfully') };
    } catch (error) {
        console.error('Error in updateJob:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to update job' } };
    }
}, ['write:jobs']);

// Publish job
export const publishJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    if (!jobId) return { status: 400, jsonBody: { success: false, error: 'Job ID is required' } };
    if (!isValidGuid(jobId)) return { status: 400, jsonBody: { success: false, error: 'Invalid Job ID format' } };
    try {
        const published = await JobService.publishJob(jobId, user.userId);
        return { status: 200, jsonBody: successResponse(published, 'Job published successfully') };
    } catch (error) {
        console.error('Error in publishJob:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to publish job' } };
    }
}, ['write:jobs']);

// Close job
export const closeJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    if (!jobId) return { status: 400, jsonBody: { success: false, error: 'Job ID is required' } };
    if (!isValidGuid(jobId)) return { status: 400, jsonBody: { success: false, error: 'Invalid Job ID format' } };
    try {
        await JobService.closeJob(jobId, user.userId);
        return { status: 200, jsonBody: successResponse(null, 'Job closed successfully') };
    } catch (error) {
        console.error('Error in closeJob:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to close job' } };
    }
}, ['write:jobs']);

// Delete job
export const deleteJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    if (!jobId) return { status: 400, jsonBody: { success: false, error: 'Job ID is required' } };
    if (!isValidGuid(jobId)) return { status: 400, jsonBody: { success: false, error: 'Invalid Job ID format' } };
    try {
        await JobService.deleteJob(jobId, user.userId);
        return { status: 200, jsonBody: successResponse(null, 'Job deleted successfully') };
    } catch (error) {
        console.error('Error in deleteJob:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to delete job' } };
    }
}, ['delete:jobs']);

// Search jobs (paged, supports cursor)
export const searchJobs = withErrorHandling(async (req: HttpRequest): Promise<HttpResponseInit> => {
    try {
        const searchParams = extractQueryParams(req);
        const safeParams = { ...searchParams, page: searchParams.page || 1, pageSize: searchParams.pageSize || 20 } as any;
        const result = await JobService.searchJobs(safeParams);
        const totalPages = Math.max(Math.ceil((result.total || 0) / (Number(safeParams.pageSize) || 20)), 1);
        const searchQuery = (safeParams as any).search || (safeParams as any).q || '';
        return {
            status: 200,
            jsonBody: successResponse(result.jobs, 'Jobs search completed', {
                page: safeParams.page,
                pageSize: safeParams.pageSize,
                total: result.total,
                totalPages,
                hasMore: result.hasMore,
                nextCursor: result.nextCursor,
                searchQuery
            })
        };
    } catch (error) {
        console.error('Error in searchJobs:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to search jobs' } };
    }
});

// Get jobs by organization
export const getJobsByOrganization = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const organizationId = req.params.organizationId;
    const params = extractQueryParams(req);
    let validated: PaginationParams;
    try {
        validated = validateRequest<PaginationParams>(paginationSchema, params);
    } catch {
        validated = { page: 1, pageSize: 20, sortBy: undefined, sortOrder: 'desc' };
    }
    if (!organizationId) return { status: 400, jsonBody: { success: false, error: 'Organization ID is required' } };
    if (!isValidGuid(organizationId)) return { status: 400, jsonBody: { success: false, error: 'Invalid Organization ID format' } };

    try {
        const accessQuery = `SELECT 1 FROM Employers WHERE UserID = @param0 AND OrganizationID = @param1`;
        const accessResult = await dbService.executeQuery(accessQuery, [user.userId, organizationId]);
        if (!accessResult.recordset || accessResult.recordset.length === 0) {
            return { status: 403, jsonBody: { success: false, error: 'Access denied to this organization' } };
        }
        const result = await JobService.getJobsByOrganization(organizationId, validated);
        return {
            status: 200,
            jsonBody: successResponse(result.jobs, 'Organization jobs retrieved successfully', {
                page: validated.page,
                pageSize: validated.pageSize,
                total: result.total,
                totalPages: result.totalPages
            })
        };
    } catch (error) {
        console.error('Error in getJobsByOrganization:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve organization jobs' } };
    }
}, ['read:jobs']);

// References
export const getJobTypes = withErrorHandling(async (): Promise<HttpResponseInit> => {
    try {
        const jobTypes = await JobService.getJobTypes();
        return { status: 200, jsonBody: successResponse(jobTypes, 'Job types retrieved successfully') };
    } catch (error) {
        console.error('Error in getJobTypes:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve job types' } };
    }
});

export const getCurrencies = withErrorHandling(async (): Promise<HttpResponseInit> => {
    try {
        const currencies = await JobService.getCurrencies();
        return { status: 200, jsonBody: successResponse(currencies, 'Currencies retrieved successfully') };
    } catch (error) {
        console.error('Error in getCurrencies:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve currencies' } };
    }
});