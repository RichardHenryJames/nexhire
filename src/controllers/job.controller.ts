import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { JobService } from '../services/job.service';
import { AIJobRecommendationService } from '../services/ai-job-recommendation.service';
import { PricingService } from '../services/pricing.service';
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
    isValidGuid,
    InsufficientBalanceError,
    ValidationError
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
        if (error instanceof ValidationError) {
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    error: 'Validation failed',
                    details: error.details
                }
            };
        }
        if (error instanceof Error && error.message.includes('Invalid column name')) {
            return { status: 500, jsonBody: { success: false, error: 'Database schema error', message: 'Please contact support - database schema needs updating' } };
        }
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error occurred' } };
    }
}, ['write:jobs']);

/**
 * Get all active jobs with pagination
 * Excludes jobs the user has already applied to
 */
export const getJobs = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const params = extractQueryParams(req);
        let validated: PaginationParams;
        try {
            validated = validateRequest<PaginationParams>(paginationSchema, params);
        } catch {
            validated = { page: 1, pageSize: 20, sortBy: undefined, sortOrder: 'desc' };
        }
        const combined = { 
            ...params, 
            page: validated.page, 
            pageSize: validated.pageSize, 
            sortBy: validated.sortBy, 
            sortOrder: validated.sortOrder,
            // Add user filtering for applied/saved exclusion
            excludeUserApplications: user.userId
        } as any;
        
        const result = await JobService.getJobs(combined);
        return {
            status: 200,
            jsonBody: successResponse(result.jobs, 'Jobs retrieved successfully', {
                page: combined.page,
                pageSize: combined.pageSize,
                hasMore: result.hasMore,
                nextCursor: result.nextCursor
            })
        };
    } catch (error) {
        console.error('Error in getJobs:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve jobs' } };
    }
}, ['read:jobs']);

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
        // Mirror createJob behavior: validation/insufficient funds -> 400
        if (error instanceof ValidationError || error instanceof InsufficientBalanceError) {
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    error: (error as any).name || 'ValidationError',
                    message: (error as any).message || 'Validation failed'
                }
            };
        }
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

/**
 * Search jobs with filters and pagination
 * Excludes jobs the user has already applied to or saved
 */
export const searchJobs = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        const searchParams = extractQueryParams(req);

        const safeParams = { 
            ...searchParams, 
            page: searchParams.page || 1, 
            pageSize: searchParams.pageSize || 20,
            excludeUserApplications: user.userId
        } as any;
   
        const result = await JobService.searchJobs(safeParams);
        const searchQuery = (safeParams as any).search || (safeParams as any).q || '';

        return {
            status: 200,
            jsonBody: successResponse(result.jobs, 'Jobs search completed', {
                page: safeParams.page,
                pageSize: safeParams.pageSize,
                hasMore: result.hasMore,
                nextCursor: result.nextCursor,
                searchQuery
            })
        };
    } catch (error) {
        console.error('Error in searchJobs:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to search jobs' } };
    }
}, ['read:jobs']);

/**
 * Get jobs for a specific organization
 * Requires employer access to the organization
 */
export const getJobsByOrganization = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const organizationId = req.params.organizationId;
    const params = extractQueryParams(req);
    const postedByUserId = user.userId;
    
    let validated: PaginationParams;
    try {
        validated = validateRequest<PaginationParams>(paginationSchema, params);
    } catch {
        validated = { page: 1, pageSize: 20, sortBy: undefined, sortOrder: 'desc' };
    }

    if (!organizationId) return { status: 400, jsonBody: { success: false, error: 'Organization ID is required' } };
    
    const orgIdNum = parseInt(organizationId);
    if (isNaN(orgIdNum) || orgIdNum <= 0) {
        return { status: 400, jsonBody: { success: false, error: 'Invalid Organization ID - must be a positive integer' } };
    }

    try {
        // Verify user has access to this organization
        const accessQuery = `SELECT 1 FROM Employers WHERE UserID = @param0 AND OrganizationID = @param1`;
        const accessResult = await dbService.executeQuery(accessQuery, [user.userId, organizationId]); // Pass as string
        if (!accessResult.recordset || accessResult.recordset.length === 0) {
            return { status: 403, jsonBody: { success: false, error: 'Access denied to this organization' } };
        }

        const normalizedStatus = params.status ? String(params.status).trim() : undefined;
        
        const extendedParams = {
            ...validated,
            status: normalizedStatus,
            search: params.search,
            postedByUserId
        };
        
        // ?? DEBUG: Log params being sent to service
        console.log('?? Backend calling JobService with params:', extendedParams);

        // Pass organizationId as string - SQL Server handles conversion to INT
        const result = await JobService.getJobsByOrganization(organizationId, extendedParams);
        
        // ?? DEBUG: Log service result
        console.log('?? Backend JobService result:', {
            jobsCount: result.jobs.length,
            firstJobStatus: result.jobs[0]?.Status,
            allStatuses: result.jobs.map(j => j.Status)
        });
        
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

export const getCurrencies = withErrorHandling(async (): Promise<HttpResponseInit> => {
    try {
        const currencies = await JobService.getCurrencies();
        return { status: 200, jsonBody: successResponse(currencies, 'Currencies retrieved successfully') };
    } catch (error) {
        console.error('Error in getCurrencies:', error);
        return { status: 500, jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve currencies' } };
    }
});

/**
 * Get AI-recommended jobs with wallet deduction
 * GET /jobs/ai-recommendations
 * Deducts cost from wallet (DB-driven) and returns personalized job recommendations
 */
export const getAIRecommendedJobs = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        // Get pricing from DB
        const aiJobsCost = await PricingService.getAIJobsCost();
        
        // Extract limit from query params (default 50)
        const url = new URL(req.url);
        const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
        
        // Get AI recommendations with wallet deduction
        const result = await AIJobRecommendationService.getAIRecommendedJobs(user.userId, limit);
        
        return {
            status: 200,
            jsonBody: successResponse(result.jobs, 'AI-recommended jobs retrieved successfully', {
                filters: result.filters,
                total: result.total,
                cost: aiJobsCost, // DB-driven cost
                limit: limit
            })
        };
    } catch (error: any) {
        console.error('Error in getAIRecommendedJobs:', error);
        
        // Get pricing from DB for error response
        const aiJobsCost = await PricingService.getAIJobsCost();
        
        // Handle insufficient balance error
        if (error instanceof InsufficientBalanceError || error?.name === 'INSUFFICIENT_WALLET_BALANCE') {
            return {
                status: 402, // Payment Required
                jsonBody: {
                    success: false,
                    error: 'Insufficient wallet balance',
                    errorCode: 'INSUFFICIENT_WALLET_BALANCE',
                    message: 'Please recharge your wallet to access AI-recommended jobs',
                    requiredAmount: aiJobsCost
                }
            };
        }
        
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: 'Failed to retrieve AI recommendations',
                message: error?.message || 'Internal server error'
            }
        };
    }
}, ['read:jobs']);

/**
 * Get AI job filters for user (FREE - no wallet deduction)
 * GET /jobs/ai-filters
 * Returns personalized job filters based on user profile
 * Used by frontend for preview jobs (5 free jobs)
 */
export const getAIJobFilters = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        // Generate AI filters from user profile
        const filters = await AIJobRecommendationService.generateJobFilters(user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(filters, 'AI job filters generated successfully')
        };
    } catch (error: any) {
        console.error('Error in getAIJobFilters:', error);
        
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: 'Failed to generate AI filters',
                message: error?.message || 'Internal server error'
            }
        };
    }
}, ['read:jobs']);

