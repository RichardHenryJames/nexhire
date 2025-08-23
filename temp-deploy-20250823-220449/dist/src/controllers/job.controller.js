"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrencies = exports.getJobTypes = exports.getJobsByOrganization = exports.searchJobs = exports.deleteJob = exports.closeJob = exports.publishJob = exports.updateJob = exports.getJobById = exports.getJobs = exports.createJob = void 0;
const job_service_1 = require("../services/job.service");
const database_service_1 = require("../services/database.service");
const middleware_1 = require("../middleware");
const validation_1 = require("../utils/validation");
// FIXED: Create job - Require existing organization (no random creation) + Fix database column references
exports.createJob = (0, middleware_1.withAuth)(async (req, context, user) => {
    try {
        const jobData = await (0, validation_1.extractRequestBody)(req);
        // Check if user is an Employer
        if (user.userType !== 'Employer') {
            return {
                status: 403,
                jsonBody: { success: false, error: 'Only employers can post jobs' }
            };
        }
        // FIXED: Updated query to match actual database schema (removed IsActive)
        const employerQuery = `
            SELECT e.EmployerID, e.OrganizationID, o.Name as OrganizationName
            FROM Employers e
            INNER JOIN Organizations o ON e.OrganizationID = o.OrganizationID
            WHERE e.UserID = @param0
        `;
        const employerResult = await database_service_1.dbService.executeQuery(employerQuery, [user.userId]);
        if (!employerResult.recordset || employerResult.recordset.length === 0) {
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    error: 'Employer profile not found. Please complete your employer registration first.',
                    code: 'EMPLOYER_PROFILE_MISSING'
                }
            };
        }
        const employer = employerResult.recordset[0];
        const organizationID = employer.OrganizationID;
        // Validate required job data
        if (!jobData.title || !jobData.description) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Title and description are required' }
            };
        }
        // Create the job using the employer's existing organization
        const job = await job_service_1.JobService.createJob(jobData, user.userId, organizationID);
        return {
            status: 201,
            jsonBody: (0, validation_1.successResponse)(job, 'Job created successfully')
        };
    }
    catch (error) {
        console.error('Error in createJob:', error);
        // FIXED: Better error handling for database schema issues
        if (error instanceof Error) {
            if (error.message.includes('Invalid column name')) {
                return {
                    status: 500,
                    jsonBody: {
                        success: false,
                        error: 'Database schema error',
                        message: 'Please contact support - database schema needs updating'
                    }
                };
            }
        }
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            }
        };
    }
}, ['write:jobs']);
// Get all jobs with pagination and filtering - FIXED: Handle optional pagination
exports.getJobs = (0, middleware_1.withErrorHandling)(async (req, context) => {
    try {
        const params = (0, validation_1.extractQueryParams)(req);
        // Use defaults if validation fails or no params provided
        let validatedParams;
        try {
            validatedParams = (0, validation_1.validateRequest)(validation_1.paginationSchema, params);
        }
        catch (error) {
            // Use defaults if validation fails
            validatedParams = {
                page: 1,
                pageSize: 20,
                sortBy: undefined,
                sortOrder: 'desc'
            };
        }
        const result = await job_service_1.JobService.getJobs({ ...validatedParams, ...params });
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(result.jobs, 'Jobs retrieved successfully', {
                page: validatedParams.page,
                pageSize: validatedParams.pageSize,
                total: result.total,
                totalPages: result.totalPages
            })
        };
    }
    catch (error) {
        console.error('Error in getJobs:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve jobs' }
        };
    }
});
// Get job by ID - FIXED: Add GUID validation
exports.getJobById = (0, middleware_1.withErrorHandling)(async (req, context) => {
    const jobId = req.params.id;
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }
    // FIXED: Validate GUID format before database call
    if (!(0, validation_1.isValidGuid)(jobId)) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Invalid Job ID format' }
        };
    }
    try {
        const job = await job_service_1.JobService.getJobById(jobId);
        if (!job) {
            return {
                status: 404,
                jsonBody: { success: false, error: 'Job not found' }
            };
        }
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(job, 'Job retrieved successfully')
        };
    }
    catch (error) {
        console.error('Error in getJobById:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve job' }
        };
    }
});
// Update job - FIXED: Add GUID validation
exports.updateJob = (0, middleware_1.withAuth)(async (req, context, user) => {
    const jobId = req.params.id;
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }
    // FIXED: Validate GUID format before database call
    if (!(0, validation_1.isValidGuid)(jobId)) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Invalid Job ID format' }
        };
    }
    try {
        const updateData = await (0, validation_1.extractRequestBody)(req);
        const updatedJob = await job_service_1.JobService.updateJob(jobId, updateData, user.userId);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(updatedJob, 'Job updated successfully')
        };
    }
    catch (error) {
        console.error('Error in updateJob:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to update job' }
        };
    }
}, ['write:jobs']);
// Publish job - FIXED: Add GUID validation
exports.publishJob = (0, middleware_1.withAuth)(async (req, context, user) => {
    const jobId = req.params.id;
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }
    // FIXED: Validate GUID format before database call
    if (!(0, validation_1.isValidGuid)(jobId)) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Invalid Job ID format' }
        };
    }
    try {
        const publishedJob = await job_service_1.JobService.publishJob(jobId, user.userId);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(publishedJob, 'Job published successfully')
        };
    }
    catch (error) {
        console.error('Error in publishJob:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to publish job' }
        };
    }
}, ['write:jobs']);
// Close job - FIXED: Add GUID validation
exports.closeJob = (0, middleware_1.withAuth)(async (req, context, user) => {
    const jobId = req.params.id;
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }
    // FIXED: Validate GUID format before database call
    if (!(0, validation_1.isValidGuid)(jobId)) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Invalid Job ID format' }
        };
    }
    try {
        await job_service_1.JobService.closeJob(jobId, user.userId);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(null, 'Job closed successfully')
        };
    }
    catch (error) {
        console.error('Error in closeJob:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to close job' }
        };
    }
}, ['write:jobs']);
// Delete job - FIXED: Add GUID validation
exports.deleteJob = (0, middleware_1.withAuth)(async (req, context, user) => {
    const jobId = req.params.id;
    if (!jobId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Job ID is required' }
        };
    }
    // FIXED: Validate GUID format before database call
    if (!(0, validation_1.isValidGuid)(jobId)) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Invalid Job ID format' }
        };
    }
    try {
        await job_service_1.JobService.deleteJob(jobId, user.userId);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(null, 'Job deleted successfully')
        };
    }
    catch (error) {
        console.error('Error in deleteJob:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to delete job' }
        };
    }
}, ['delete:jobs']);
// Search jobs - FIXED: Better error handling and optional parameters
exports.searchJobs = (0, middleware_1.withErrorHandling)(async (req, context) => {
    try {
        const searchParams = (0, validation_1.extractQueryParams)(req);
        // Ensure we have safe defaults
        const safeParams = {
            page: searchParams.page || 1,
            pageSize: searchParams.pageSize || 20,
            search: searchParams.search || searchParams.q || '',
            sortBy: searchParams.sortBy || 'CreatedAt',
            sortOrder: searchParams.sortOrder || 'desc',
            filters: searchParams.filters || {}
        };
        const result = await job_service_1.JobService.searchJobs(safeParams);
        const totalPages = Math.ceil(result.total / safeParams.pageSize);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(result.jobs, 'Jobs search completed', {
                page: safeParams.page,
                pageSize: safeParams.pageSize,
                total: result.total,
                totalPages,
                searchQuery: safeParams.search
            })
        };
    }
    catch (error) {
        console.error('Error in searchJobs:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to search jobs' }
        };
    }
});
// Get jobs by organization - FIXED: Add GUID validation and fix database query
exports.getJobsByOrganization = (0, middleware_1.withAuth)(async (req, context, user) => {
    const organizationId = req.params.organizationId;
    const params = (0, validation_1.extractQueryParams)(req);
    let validatedParams;
    try {
        validatedParams = (0, validation_1.validateRequest)(validation_1.paginationSchema, params);
    }
    catch (error) {
        validatedParams = { page: 1, pageSize: 20, sortBy: undefined, sortOrder: 'desc' };
    }
    if (!organizationId) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Organization ID is required' }
        };
    }
    // FIXED: Validate GUID format before database call
    if (!(0, validation_1.isValidGuid)(organizationId)) {
        return {
            status: 400,
            jsonBody: { success: false, error: 'Invalid Organization ID format' }
        };
    }
    try {
        // FIXED: Simplified access check without IsActive column
        const accessQuery = `
            SELECT 1 FROM Employers 
            WHERE UserID = @param0 AND OrganizationID = @param1
        `;
        const accessResult = await database_service_1.dbService.executeQuery(accessQuery, [user.userId, organizationId]);
        if (!accessResult.recordset || accessResult.recordset.length === 0) {
            return {
                status: 403,
                jsonBody: { success: false, error: 'Access denied to this organization' }
            };
        }
        const result = await job_service_1.JobService.getJobsByOrganization(organizationId, validatedParams);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(result.jobs, 'Organization jobs retrieved successfully', {
                page: validatedParams.page,
                pageSize: validatedParams.pageSize,
                total: result.total,
                totalPages: result.totalPages
            })
        };
    }
    catch (error) {
        console.error('Error in getJobsByOrganization:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve organization jobs' }
        };
    }
}, ['read:jobs']);
// Get job types (reference data)
exports.getJobTypes = (0, middleware_1.withErrorHandling)(async (req, context) => {
    try {
        const jobTypes = await job_service_1.JobService.getJobTypes();
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(jobTypes, 'Job types retrieved successfully')
        };
    }
    catch (error) {
        console.error('Error in getJobTypes:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve job types' }
        };
    }
});
// Get currencies (reference data)
exports.getCurrencies = (0, middleware_1.withErrorHandling)(async (req, context) => {
    try {
        const currencies = await job_service_1.JobService.getCurrencies();
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(currencies, 'Currencies retrieved successfully')
        };
    }
    catch (error) {
        console.error('Error in getCurrencies:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: 'Internal server error', message: 'Failed to retrieve currencies' }
        };
    }
});
//# sourceMappingURL=job.controller.js.map