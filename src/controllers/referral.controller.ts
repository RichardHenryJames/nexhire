/**
 * Referral Controllers - HTTP Request Handlers
 * NexHire Referral System API Endpoints
 * ? ALL USING WORKING AUTHENTICATION PATTERN
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ReferralService } from '../services/referral.service';
import { 
    withErrorHandling, 
    authenticate  // ? Use authenticate like work experience controllers
} from '../middleware';
import { 
    successResponse, 
    extractRequestBody, 
    extractQueryParams,
    validateRequest,
    paginationSchema,
    isValidGuid,
    ValidationError,
    NotFoundError
} from '../utils/validation';
import {
    CreateReferralRequestDto,
    ClaimReferralRequestDto,
    SubmitReferralProofDto,
    VerifyReferralDto,
    PurchaseReferralPlanDto,
    ReferralRequestsFilter
} from '../types/referral.types';

// ===== REFERRAL PLANS =====

/**
 * Get all available referral plans (public endpoint)
 * GET /referral/plans
 */
export const getReferralPlans = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const plans = await ReferralService.getReferralPlans();
        
        return {
            status: 200,
            jsonBody: successResponse(plans, 'Referral plans retrieved successfully')
        };
    } catch (error: any) {
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get referral plans'
            }
        };
    }
});

/**
 * Purchase a referral plan
 * POST /referral/plans/purchase
 */
export const purchaseReferralPlan = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const purchaseData = await extractRequestBody(req) as PurchaseReferralPlanDto;
        
        if (!purchaseData.planID) {
            throw new ValidationError('Plan ID is required');
        }

        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const subscription = await ReferralService.purchaseReferralPlan(applicantId, purchaseData);
        
        return {
            status: 201,
            jsonBody: successResponse(subscription, 'Referral plan purchased successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to purchase referral plan'
            }
        };
    }
});

/**
 * Get current referral subscription
 * GET /referral/subscription
 */
export const getCurrentSubscription = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const subscription = await ReferralService.getCurrentSubscription(applicantId);
        
        return {
            status: 200,
            jsonBody: successResponse(subscription, 'Current subscription retrieved successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get current subscription'
            }
        };
    }
});

/**
 * Create a new referral request
 * POST /referral/requests
 */
export const createReferralRequest = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const requestData = await extractRequestBody(req) as CreateReferralRequestDto;
        
        if (!requestData.jobID || !requestData.resumeID) {
            throw new ValidationError('Job ID and Resume ID are required');
        }

        if (!isValidGuid(requestData.jobID) || !isValidGuid(requestData.resumeID)) {
            throw new ValidationError('Invalid Job ID or Resume ID format');
        }

        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const request = await ReferralService.createReferralRequest(applicantId, requestData);
        
        return {
            status: 201,
            jsonBody: successResponse(request, 'Referral request created successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to create referral request'
            }
        };
    }
});

/**
 * Get my referral requests (as seeker)
 * GET /referral/my-requests
 */
export const getMyReferralRequests = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const params = extractQueryParams(req);
        
        // ? FIX: Ensure pagination parameters are integers
        const page = Math.max(1, parseInt(String(params.page || '1'), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || '20'), 10) || 20));

        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        
        // ? FIX: Use the service method instead of direct SQL
        const result = await ReferralService.getMyReferralRequests(applicantId, page, pageSize);
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'My referral requests retrieved successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get referral requests'
            }
        };
    }
});

/**
 * Get available referral requests (as referrer)
 * GET /referral/available
 */
export const getAvailableRequests = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const params = extractQueryParams(req);
        
        // ? FIX: Ensure pagination parameters are integers
        const page = Math.max(1, parseInt(String(params.page || '1'), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || '20'), 10) || 20));
        
        const filters: ReferralRequestsFilter = {
            jobTitle: params.jobTitle as string,
            companyName: params.companyName as string,
            dateFrom: params.dateFrom ? new Date(params.dateFrom as string) : undefined,
            dateTo: params.dateTo ? new Date(params.dateTo as string) : undefined
        };

        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const result = await ReferralService.getAvailableRequests(applicantId, page, pageSize, filters);
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'Available referral requests retrieved successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get available requests'
            }
        };
    }
});

/**
 * Claim a referral request
 * POST /referral/requests/{requestId}/claim
 */
export const claimReferralRequest = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const requestId = (req as any).params?.requestId;
        
        if (!requestId || !isValidGuid(requestId)) {
            throw new ValidationError('Valid Request ID is required');
        }

        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const request = await ReferralService.claimReferralRequest(applicantId, { requestID: requestId });
        
        return {
            status: 200,
            jsonBody: successResponse(request, 'Referral request claimed successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to claim referral request'
            }
        };
    }
});

/**
 * Submit proof of referral
 * POST /referral/requests/{requestId}/proof
 */
export const submitReferralProof = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const requestId = (req as any).params?.requestId;
        const proofData = await extractRequestBody(req) as SubmitReferralProofDto;

        if (!requestId || !isValidGuid(requestId)) {
            throw new ValidationError('Valid Request ID is required');
        }

        if (!proofData.fileURL || !proofData.fileType) {
            throw new ValidationError('File URL and file type are required');
        }

        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const proof = await ReferralService.submitReferralProof(applicantId, {
            requestID: requestId,
            fileURL: proofData.fileURL,
            fileType: proofData.fileType
        });

        return {
            status: 201,
            jsonBody: successResponse(proof, 'Referral proof submitted successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to submit referral proof'
            }
        };
    }
});

/**
 * Verify referral completion
 * POST /referral/requests/{requestId}/verify
 */
export const verifyReferralCompletion = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const requestId = (req as any).params?.requestId;
        const verificationData = await extractRequestBody(req) as VerifyReferralDto;

        if (!requestId || !isValidGuid(requestId)) {
            throw new ValidationError('Valid Request ID is required');
        }

        if (typeof verificationData.verified !== 'boolean') {
            throw new ValidationError('Verification status (verified: true/false) is required');
        }

        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const request = await ReferralService.verifyReferral(applicantId, {
            requestID: requestId,
            verified: verificationData.verified
        });

        return {
            status: 200,
            jsonBody: successResponse(request, verificationData.verified ? 
                'Referral verified successfully' : 
                'Referral verification updated successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to verify referral'
            }
        };
    }
});

/**
 * Get my requests as referrer (claimed/completed requests)
 * GET /referral/my-referrer-requests
 */
export const getMyReferrerRequests = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const params = extractQueryParams(req);
        
        // ? FIX: Ensure pagination parameters are integers
        const page = Math.max(1, parseInt(String(params.page || '1'), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || '20'), 10) || 20));

        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const result = await ReferralService.getMyReferrerRequests(applicantId, page, pageSize);
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'My referrer requests retrieved successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get my referrer requests'
            }
        };
    }
});

/**
 * Get referral analytics/dashboard
 * GET /referral/analytics
 */
export const getReferralAnalytics = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const analytics = await ReferralService.getReferralAnalytics(applicantId);
        
        return {
            status: 200,
            jsonBody: successResponse(analytics, 'Referral analytics retrieved successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get referral analytics'
            }
        };
    }
});

/**
 * Check referral eligibility
 * GET /referral/eligibility
 */
export const checkReferralEligibility = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const eligibility = await ReferralService.checkReferralEligibility(applicantId);
        
        return {
            status: 200,
            jsonBody: successResponse(eligibility, 'Referral eligibility checked successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to check referral eligibility'
            }
        };
    }
});

/**
 * Get referrer stats (badge counts)
 * GET /referral/stats
 */
export const getReferrerStats = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        
        // Get referrer stats
        const statsQuery = `
            SELECT ReferrerID, PendingCount, LastUpdated
            FROM ReferrerStats
            WHERE ReferrerID = @param0
        `;
        
        const statsResult = await dbService.executeQuery(statsQuery, [applicantId]);
        const stats = statsResult.recordset && statsResult.recordset.length > 0 
            ? statsResult.recordset[0] 
            : { ReferrerID: applicantId, PendingCount: 0, LastUpdated: new Date() };
        
        return {
            status: 200,
            jsonBody: successResponse(stats, 'Referrer stats retrieved successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get referrer stats'
            }
        };
    }
});