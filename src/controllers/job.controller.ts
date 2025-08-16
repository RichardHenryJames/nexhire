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

// Create job - FIXED: Check UserType instead of Employers table
export const createJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobData = await extractRequestBody(req);
    
    // FIXED: Check if user is an Employer by UserType instead of Employers table
    if (user.userType !== 'Employer') {
        return {
            status: 403,
            jsonBody: { success: false, error: 'Only employers can post jobs' }
        };
    }

    // Create a default organization for the employer if they don't have one
    let organizationID;
    
    // First check if user already has an organization
    const existingOrgQuery = `
        SELECT OrganizationID FROM Employers 
        WHERE UserID = @param0
    `;
    const existingOrgResult = await dbService.executeQuery(existingOrgQuery, [user.userId]);
    
    if (existingOrgResult.recordset && existingOrgResult.recordset.length > 0) {
        organizationID = existingOrgResult.recordset[0].OrganizationID;
    } else {
        // Create a default organization and employer profile
        const { AuthService } = await import('../services/auth.service');
        organizationID = AuthService.generateUniqueId();
        const employerID = AuthService.generateUniqueId();
        
        // Get user details for organization creation
        const userQuery = `SELECT FirstName, LastName, Email FROM Users WHERE UserID = @param0`;
        const userResult = await dbService.executeQuery(userQuery, [user.userId]);
        const userData = userResult.recordset[0];
        
        // Create organization
        const createOrgQuery = `
            INSERT INTO Organizations (
                OrganizationID, Name, Description,
                Website, IsVerified, CreatedAt, UpdatedAt
            ) VALUES (
                @param0, @param1, @param2,
                '', 0, GETUTCDATE(), GETUTCDATE()
            )
        `;
        const orgName = `${userData.FirstName} ${userData.LastName}'s Company`;
        const orgDescription = `Organization for ${userData.FirstName} ${userData.LastName}`;
        
        await dbService.executeQuery(createOrgQuery, [organizationID, orgName, orgDescription]);
        
        // Create employer profile
        const createEmployerQuery = `
            INSERT INTO Employers (
                EmployerID, UserID, OrganizationID, CanPostJobs, CanViewApplications,
                CanScheduleInterviews, CanSendMessages, IsActive, JoinedAt
            ) VALUES (
                @param0, @param1, @param2, 1, 1, 1, 1, 1, GETUTCDATE()
            )
        `;
        
        await dbService.executeQuery(createEmployerQuery, [employerID, user.userId, organizationID]);
    }

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

// Get job by ID - FIXED: Add GUID validation
export const getJobById = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    
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

// Update job - FIXED: Add GUID validation
export const updateJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    const updateData = await extractRequestBody(req);
    
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

    const updatedJob = await JobService.updateJob(jobId, updateData, user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(updatedJob, 'Job updated successfully')
    };
}, ['write:jobs']);

// Publish job - FIXED: Add GUID validation
export const publishJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    
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

    const publishedJob = await JobService.publishJob(jobId, user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(publishedJob, 'Job published successfully')
    };
}, ['write:jobs']);

// Close job - FIXED: Add GUID validation
export const closeJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    
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

    await JobService.closeJob(jobId, user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(null, 'Job closed successfully')
    };
}, ['write:jobs']);

// Delete job - FIXED: Add GUID validation
export const deleteJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const jobId = req.params.id;
    
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
            search: searchParams.search || searchParams.q || '',
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

// Get jobs by organization - FIXED: Add GUID validation
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

    // FIXED: Validate GUID format before database call
    if (!isValidGuid(organizationId)) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Invalid Organization ID format' }
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