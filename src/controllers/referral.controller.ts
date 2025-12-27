/**
 * Referral Controllers - HTTP Request Handlers
 * RefOpen Referral System API Endpoints
 * ? ALL USING WORKING AUTHENTICATION PATTERN
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
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
    ReferralService
} from '../services/referral.service';
import { PricingService } from '../services/pricing.service';
import { 
    PurchaseReferralPlanDto, 
    ReferralRequestsFilter,
    CreateReferralRequestDto,
    ClaimReferralRequestDto,
    SubmitReferralWithProofDto,
    VerifyReferralDto
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
 * Create a new referral request (supports both internal and external)
 * POST /referral/requests
 * ? UPDATED: Checks wallet balance and deducts ₹50
 */
export const createReferralRequest = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const requestData = await extractRequestBody(req) as CreateReferralRequestDto;
        
        if (!requestData.resumeID) {
            throw new ValidationError('Resume ID is required');
        }

        // ? NEW SCHEMA: Validate based on presence of jobID vs extJobID
        const hasJobID = !!requestData.jobID;
        const hasExtJobID = !!requestData.extJobID;
        
        if (!hasJobID && !hasExtJobID) {
            throw new ValidationError('Either jobID (internal) or extJobID (external) must be provided');
        }
        
        if (hasJobID && hasExtJobID) {
            throw new ValidationError('Cannot provide both jobID and extJobID - use only one');
        }

        // Validate based on referral type (derived from data presence)
        if (hasJobID) {
            // INTERNAL REFERRAL VALIDATION
            if (!isValidGuid(requestData.jobID!) || !isValidGuid(requestData.resumeID)) {
                throw new ValidationError('Invalid Job ID or Resume ID format for internal referrals');
            }
        } else if (hasExtJobID) {
            // EXTERNAL REFERRAL VALIDATION
            if (!isValidGuid(requestData.resumeID)) {
                throw new ValidationError('Invalid Resume ID format');
            }
            if (!requestData.jobTitle || !requestData.organizationId) {
                throw new ValidationError('Job title and organization ID are required for external referrals');
            }
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
        
        // Get referral cost from DB for response message
        const referralCost = await PricingService.getReferralCost();
        
        return {
            status: 201,
            jsonBody: successResponse(request, `Referral request created successfully. ₹${referralCost} deducted from wallet.`)
        };
    } catch (error: any) {
        // ? NEW: Handle insufficient wallet balance error
        if (error instanceof ValidationError && error.message === 'INSUFFICIENT_WALLET_BALANCE') {
            return {
                status: 402, // Payment Required
                jsonBody: {
                    success: false,
                    error: 'Insufficient wallet balance',
                    errorCode: 'INSUFFICIENT_WALLET_BALANCE',
                    data: error.details,
                    message: error.details?.message || 'Please recharge your wallet to request referrals.'
                }
            };
        }
        
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
        
        const filters: ReferralRequestsFilter & { tab?: string } = {
            jobTitle: params.jobTitle as string,
            companyName: params.companyName as string,
            dateFrom: params.dateFrom ? new Date(params.dateFrom as string) : undefined,
            dateTo: params.dateTo ? new Date(params.dateTo as string) : undefined,
            tab: (params.tab as string) || 'open' // 'open' or 'closed'
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
        const claimData = await extractRequestBody(req) as SubmitReferralWithProofDto;
        
        if (!requestId || !isValidGuid(requestId)) {
            throw new ValidationError('Valid Request ID is required');
        }

        // Proof upload is now mandatory for claiming
        if (!claimData.proofFileURL || !claimData.proofFileType) {
            throw new ValidationError('Proof screenshot is required to claim referral');
        }

        // Get applicant ID
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }

        const applicantId = applicantResult.recordset[0].ApplicantID;
        const request = await ReferralService.submitReferralWithProof(applicantId, user.userId, {
            requestID: requestId,
            proofFileURL: claimData.proofFileURL,
            proofFileType: claimData.proofFileType,
            proofDescription: claimData.proofDescription
        });
        
        return {
            status: 200,
            jsonBody: successResponse(request, 'Referral request claimed successfully with proof')
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
 * Get my requests as referrer (completed requests)
 * GET /referral/my-referrer-requests
 */
export const getMyReferrerRequests = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const params = extractQueryParams(req);
        
        // ? FIX: Ensure pagination parameters are integers
        const page = Math.max(1, parseInt(String(params.page || '1'), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || '20'), 10) || 20));

        // AssignedReferrerID now stores UserID, so pass userId directly
        const result = await ReferralService.getMyReferrerRequests(user.userId, page, pageSize);
        
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
 * Get completed referrals by current user (for closed tab - all completed referrals regardless of company)
 * GET /referral/completed
 */
export const getCompletedReferrals = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const params = extractQueryParams(req);
        
        const page = Math.max(1, parseInt(String(params.page || '1'), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || '20'), 10) || 20));

        // Pass userId directly - AssignedReferrerID stores UserID
        const result = await ReferralService.getCompletedReferralsByUser(user.userId, page, pageSize);
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'Completed referrals retrieved successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get completed referrals'
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
        const analytics = await ReferralService.getReferralAnalytics(applicantId, user.userId);
        
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
        
        // Get current pending counts from ReferrerStats table
        const statsQuery = `
            SELECT PendingCount
            FROM ReferrerStats 
            WHERE ReferrerID = @param0
        `;
        
        const statsResult = await dbService.executeQuery(statsQuery, [applicantId]);
        const pendingCount = statsResult.recordset[0]?.PendingCount || 0;

        return {
            status: 200,
            jsonBody: successResponse({
                pendingCount
            }, 'Referrer stats retrieved successfully')
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

/**
 * Get detailed referral points history
 * GET /referral/points-history
 */
export const getReferralPointsHistory = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
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
        const pointsData = await ReferralService.getReferralPointsHistory(applicantId);
        
        return {
            status: 200,
            jsonBody: successResponse(pointsData, 'Referral points history retrieved successfully')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get referral points history'
            }
        };
    }
});

/**
 * Cancel a referral request
 * POST /referral/requests/{requestId}/cancel
 */
export const cancelReferralRequest = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const requestId = (req as any).params?.requestId;
        if (!requestId || !isValidGuid(requestId)) {
            throw new ValidationError('Valid Request ID is required');
        }
        const { dbService } = await import('../services/database.service');
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [user.userId]);
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }
        const applicantId = applicantResult.recordset[0].ApplicantID;
        const updated = await ReferralService.cancelReferralRequest(applicantId, requestId);
        return {
            status: 200,
            jsonBody: successResponse(updated, 'Referral request cancelled')
        };
    } catch (error: any) {
        return {
            status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
            jsonBody: { success: false, error: error?.message || 'Failed to cancel referral request' }
        };
    }
});

/**
 * Convert referral points to wallet balance
 * POST /referral/points/convert-to-wallet
 * Conversion rate: 1 point = ₹0.50
 */
export const convertPointsToWallet = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
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
        
        // Convert points to wallet using the referral service
        const result = await ReferralService.convertPointsToWallet(applicantId, user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(result, `Successfully converted ${result.pointsConverted} points to ₹${result.walletAmount.toFixed(2)}`)
        };
    } catch (error: any) {
        console.error('Error converting points to wallet:', error);
        return {
            status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to convert points to wallet'
            }
        };
    }
});

// ===== REFERRAL STATUS TRACKING =====

/**
 * Log a status change for tracking (Viewed, Claimed states)
 * POST /referral/requests/{requestId}/status
 */
export const logReferralStatus = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const requestId = req.params.id;
        
        if (!requestId || !isValidGuid(requestId)) {
            throw new ValidationError('Valid Request ID is required');
        }

        const body = await extractRequestBody(req) as { status: string; message?: string };
        
        if (!body.status) {
            throw new ValidationError('Status is required');
        }

        // Allowed intermediate statuses that can be logged
        const allowedStatuses = ['Viewed', 'Claimed'];
        if (!allowedStatuses.includes(body.status)) {
            throw new ValidationError(`Status must be one of: ${allowedStatuses.join(', ')}`);
        }

        // Get user name from database
        const { dbService } = await import('../services/database.service');
        const nameQuery = 'SELECT FirstName, LastName FROM Users WHERE UserID = @param0';
        const nameResult = await dbService.executeQuery(nameQuery, [user.userId]);
        const actorName = nameResult.recordset?.[0] 
            ? `${nameResult.recordset[0].FirstName || ''} ${nameResult.recordset[0].LastName || ''}`.trim() 
            : 'Unknown';

        // Log the status change with userId
        const result = await ReferralService.logStatusChange(
            requestId,
            body.status,
            user.userId,  // Pass userId directly
            'referrer',
            actorName,
            body.message
        );
        
        return {
            status: 200,
            jsonBody: successResponse(result, `Status '${body.status}' logged successfully`)
        };
    } catch (error: any) {
        console.error('Error logging referral status:', error);
        return {
            status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to log referral status'
            }
        };
    }
});

/**
 * Get status history for a referral request (for tracking screen)
 * GET /referral/requests/{requestId}/history
 */
export const getReferralStatusHistory = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const requestId = req.params.id;
        
        if (!requestId || !isValidGuid(requestId)) {
            throw new ValidationError('Valid Request ID is required');
        }

        const history = await ReferralService.getStatusHistory(requestId);
        
        return {
            status: 200,
            jsonBody: successResponse(history, 'Status history retrieved successfully')
        };
    } catch (error: any) {
        console.error('Error getting referral status history:', error);
        return {
            status: error instanceof NotFoundError ? 404 : 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get status history'
            }
        };
    }
});