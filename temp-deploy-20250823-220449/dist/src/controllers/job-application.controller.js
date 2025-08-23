"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApplicationStats = exports.getApplicationDetails = exports.withdrawApplication = exports.updateApplicationStatus = exports.getJobApplications = exports.getMyApplications = exports.applyForJob = void 0;
const job_application_service_1 = require("../services/job-application.service");
const middleware_1 = require("../middleware");
const validation_1 = require("../utils/validation");
// Apply for a job - FIXED: Better error handling and validation
exports.applyForJob = (0, middleware_1.withAuth)(async (req, context, user) => {
    try {
        const applicationData = await (0, validation_1.extractRequestBody)(req);
        // FIXED: Validate jobID format before processing
        if (!applicationData.jobID) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Job ID is required' }
            };
        }
        if (!(0, validation_1.isValidGuid)(applicationData.jobID)) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Invalid Job ID format' }
            };
        }
        const application = await job_application_service_1.JobApplicationService.applyForJob(applicationData, user.userId);
        return {
            status: 201,
            jsonBody: (0, validation_1.successResponse)(application, 'Job application submitted successfully')
        };
    }
    catch (error) {
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
exports.getMyApplications = (0, middleware_1.withAuth)(async (req, context, user) => {
    try {
        const params = (0, validation_1.extractQueryParams)(req);
        // Use safe defaults if validation fails
        let validatedParams;
        try {
            validatedParams = (0, validation_1.validateRequest)(validation_1.paginationSchema, params);
        }
        catch (error) {
            validatedParams = { page: 1, pageSize: 20, sortBy: 'SubmittedAt', sortOrder: 'desc' };
        }
        const result = await job_application_service_1.JobApplicationService.getApplicationsByUser(user.userId, validatedParams);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(result.applications, 'Applications retrieved successfully', {
                page: validatedParams.page,
                pageSize: validatedParams.pageSize,
                total: result.total,
                totalPages: result.totalPages
            })
        };
    }
    catch (error) {
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
exports.getJobApplications = (0, middleware_1.withAuth)(async (req, context, user) => {
    try {
        const jobId = req.params.jobId;
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
        const params = (0, validation_1.extractQueryParams)(req);
        // FIXED: Use extended pagination schema that allows search parameters
        let validatedParams;
        try {
            validatedParams = (0, validation_1.validateRequest)(validation_1.jobApplicationsPaginationSchema, params);
        }
        catch (error) {
            // Use safe defaults if validation fails
            validatedParams = {
                page: 1,
                pageSize: 20,
                sortBy: 'SubmittedAt',
                sortOrder: 'desc'
            };
        }
        const statusFilter = params.statusFilter ? parseInt(params.statusFilter) : undefined;
        const result = await job_application_service_1.JobApplicationService.getApplicationsByJob(jobId, user.userId, { ...validatedParams, statusFilter });
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(result.applications, 'Job applications retrieved successfully', {
                page: validatedParams.page,
                pageSize: validatedParams.pageSize,
                total: result.total,
                totalPages: result.totalPages
            })
        };
    }
    catch (error) {
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
exports.updateApplicationStatus = (0, middleware_1.withAuth)(async (req, context, user) => {
    try {
        const applicationId = req.params.applicationId;
        if (!applicationId) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Application ID is required' }
            };
        }
        // FIXED: Validate GUID format before database call
        if (!(0, validation_1.isValidGuid)(applicationId)) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Invalid Application ID format' }
            };
        }
        const { statusId, notes } = await (0, validation_1.extractRequestBody)(req);
        if (!statusId) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Status ID is required' }
            };
        }
        const updatedApplication = await job_application_service_1.JobApplicationService.updateApplicationStatus(applicationId, statusId, user.userId, notes);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(updatedApplication, 'Application status updated successfully')
        };
    }
    catch (error) {
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
// Withdraw application (job seeker) - FIXED: Add comprehensive GUID validation
exports.withdrawApplication = (0, middleware_1.withAuth)(async (req, context, user) => {
    try {
        const applicationId = req.params.applicationId;
        if (!applicationId) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Application ID is required' }
            };
        }
        // FIXED: Validate GUID format before database call
        if (!(0, validation_1.isValidGuid)(applicationId)) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Invalid Application ID format' }
            };
        }
        await job_application_service_1.JobApplicationService.withdrawApplication(applicationId, user.userId);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(null, 'Application withdrawn successfully')
        };
    }
    catch (error) {
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
}, ['write:applications']);
// Get application details - FIXED: Add comprehensive GUID validation
exports.getApplicationDetails = (0, middleware_1.withAuth)(async (req, context, user) => {
    try {
        const applicationId = req.params.applicationId;
        if (!applicationId) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Application ID is required' }
            };
        }
        // FIXED: Validate GUID format before database call
        if (!(0, validation_1.isValidGuid)(applicationId)) {
            return {
                status: 400,
                jsonBody: { success: false, error: 'Invalid Application ID format' }
            };
        }
        const application = await job_application_service_1.JobApplicationService.getApplicationDetails(applicationId, user.userId);
        if (!application) {
            return {
                status: 404,
                jsonBody: { success: false, error: 'Application not found' }
            };
        }
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(application, 'Application details retrieved successfully')
        };
    }
    catch (error) {
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
exports.getApplicationStats = (0, middleware_1.withAuth)(async (req, context, user) => {
    try {
        const stats = await job_application_service_1.JobApplicationService.getApplicationStats(user.userId, user.userType);
        return {
            status: 200,
            jsonBody: (0, validation_1.successResponse)(stats, 'Application statistics retrieved successfully')
        };
    }
    catch (error) {
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
//# sourceMappingURL=job-application.controller.js.map