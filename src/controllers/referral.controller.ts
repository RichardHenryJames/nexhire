/**
 * Referral Controllers - HTTP Request Handlers
 * RefOpen Referral System API Endpoints
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { 
    withErrorHandling, 
    authenticate
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

        // Validate based on presence of jobID vs extJobID
        const hasJobID = !!requestData.jobID;
        const hasExtJobID = !!requestData.extJobID;
        const isOpenToAny = !!requestData.openToAnyCompany;
        
        if (!hasJobID && !hasExtJobID && !isOpenToAny) {
            throw new ValidationError('Either jobID (internal) or extJobID (external) must be provided');
        }
        
        if (hasJobID && hasExtJobID) {
            throw new ValidationError('Cannot provide both jobID and extJobID - use only one');
        }

        // For openToAnyCompany mode, auto-generate extJobID if not provided
        if (isOpenToAny && !hasExtJobID) {
            requestData.extJobID = `OPEN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        }

        // Validate based on referral type (derived from data presence)
        if (hasJobID) {
            // INTERNAL REFERRAL VALIDATION
            if (!isValidGuid(requestData.jobID!) || !isValidGuid(requestData.resumeID)) {
                throw new ValidationError('Invalid Job ID or Resume ID format for internal referrals');
            }
        } else {
            // EXTERNAL REFERRAL VALIDATION (includes openToAnyCompany)
            if (!isValidGuid(requestData.resumeID)) {
                throw new ValidationError('Invalid Resume ID format');
            }
            if (!requestData.jobTitle) {
                throw new ValidationError('Job title is required for external referrals');
            }
            // organizationId and companyName are optional when openToAnyCompany is true
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
        // Handle insufficient wallet balance error
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
        
        // Ensure pagination parameters are integers
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
        
        // Use the service method
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
        
        // Ensure pagination parameters are integers
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
        
        // Check if user is Admin - admins see ALL referral requests
        const userTypeResult = await dbService.executeQuery(
            'SELECT UserType FROM Users WHERE UserID = @param0', [user.userId]
        );
        const isAdmin = userTypeResult.recordset?.[0]?.UserType === 'Admin';
        
        if (isAdmin) {
            const result = await ReferralService.getAvailableRequests(null as any, page, pageSize, filters, true);
            return {
                status: 200,
                jsonBody: successResponse(result, 'All referral requests retrieved (admin)')
            };
        }

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

        // 🔔 Notify seeker that their referral was submitted with proof (async, non-blocking)
        (async () => {
            try {
                const { InAppNotificationService } = await import('../services/inAppNotification.service');
                const { dbService } = await import('../services/database.service');
                const info = await dbService.executeQuery(
                    `SELECT a.UserID as SeekerUserID, u.FirstName + ' ' + u.LastName as ReferrerName, 
                     rr.JobTitle, o.Name as CompanyName
                     FROM ReferralRequests rr
                     LEFT JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                     LEFT JOIN Organizations o ON rr.OrganizationID = o.OrganizationID
                     LEFT JOIN Users u ON u.UserID = @param1
                     WHERE rr.RequestID = @param0`, [requestId, user.userId]
                );
                const row = info.recordset[0];
                if (row) {
                    await InAppNotificationService.notifyReferralSubmitted(
                        row.SeekerUserID, row.ReferrerName, row.JobTitle, row.CompanyName, requestId
                    );
                }
            } catch (e: any) { console.error('Notification error (non-critical):', e.message); }
        })();
        
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

        // 🔔 Notify referrer about verification + notify seeker of completion (async)
        (async () => {
            try {
                const { InAppNotificationService } = await import('../services/inAppNotification.service');
                const { dbService: db } = await import('../services/database.service');
                const info = await db.executeQuery(
                    `SELECT rr.AssignedReferrerID, a.UserID as SeekerUserID, rr.JobTitle,
                     o.Name as CompanyName, u.FirstName + ' ' + u.LastName as SeekerName,
                     ru.FirstName + ' ' + ru.LastName as ReferrerName,
                     (SELECT TOP 1 wt.Amount FROM WalletTransactions wt 
                      INNER JOIN Wallets w ON wt.WalletID = w.WalletID 
                      WHERE w.UserID = rr.AssignedReferrerID 
                      AND wt.Source = 'REFERRAL_EARNINGS' 
                      AND wt.Description LIKE '%' + CAST(rr.RequestID AS NVARCHAR(50)) + '%'
                      ORDER BY wt.CreatedAt DESC) as RewardAmount
                     FROM ReferralRequests rr
                     LEFT JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                     LEFT JOIN Organizations o ON rr.OrganizationID = o.OrganizationID
                     LEFT JOIN Users u ON u.UserID = a.UserID
                     LEFT JOIN Users ru ON ru.UserID = rr.AssignedReferrerID
                     WHERE rr.RequestID = @param0`, [requestId]
                );
                const row = info.recordset[0];
                if (row && verificationData.verified) {
                    // Notify referrer: earned money
                    await InAppNotificationService.notifyReferralVerified(
                        row.AssignedReferrerID, row.SeekerName, row.JobTitle, row.RewardAmount || 0, requestId
                    );
                    // Notify seeker: referral complete
                    await InAppNotificationService.notifyReferralComplete(
                        row.SeekerUserID, row.JobTitle, row.CompanyName, requestId
                    );
                }
            } catch (e: any) { console.error('Notification error (non-critical):', e.message); }
        })();

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
        
        // Ensure pagination parameters are integers
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
        // Get referral info BEFORE cancelling (for notification)
        const refInfo = await dbService.executeQuery(
            `SELECT rr.AssignedReferrerID, rr.JobTitle, u.FirstName + ' ' + u.LastName as SeekerName
             FROM ReferralRequests rr
             LEFT JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
             LEFT JOIN Users u ON u.UserID = a.UserID
             WHERE rr.RequestID = @param0`, [requestId]
        );

        const updated = await ReferralService.cancelReferralRequest(applicantId, requestId);

        // 🔔 Notify referrer about cancellation (async)
        (async () => {
            try {
                const row = refInfo.recordset[0];
                if (row?.AssignedReferrerID) {
                    const { InAppNotificationService } = await import('../services/inAppNotification.service');
                    await InAppNotificationService.notifyReferralCancelled(
                        row.AssignedReferrerID, row.SeekerName, row.JobTitle, requestId
                    );
                }
            } catch (e: any) { console.error('Notification error (non-critical):', e.message); }
        })();

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

        // 🔔 Notify seeker when referrer clicks "I'll Refer" (Claimed status)
        if (body.status === 'Claimed') {
            (async () => {
                try {
                    const { InAppNotificationService } = await import('../services/inAppNotification.service');
                    const { NotificationService } = await import('../services/notificationService');
                    const info = await dbService.executeQuery(
                        `SELECT a.UserID as SeekerUserID, u.Email as SeekerEmail, u.FirstName as SeekerName,
                                rr.JobTitle, o.Name as CompanyName
                         FROM ReferralRequests rr
                         LEFT JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                         LEFT JOIN Users u ON a.UserID = u.UserID
                         LEFT JOIN Organizations o ON rr.OrganizationID = o.OrganizationID
                         WHERE rr.RequestID = @param0`, [requestId]
                    );
                    const row = info.recordset[0];
                    if (row) {
                        // In-app notification
                        await InAppNotificationService.notifyReferralClaimed(
                            row.SeekerUserID, actorName, row.JobTitle, row.CompanyName, requestId
                        );
                        // Email notification to seeker + admin
                        await NotificationService.notifyReferralClaimed({
                            requestId,
                            seekerId: row.SeekerUserID,
                            seekerName: row.SeekerName || 'Job Seeker',
                            seekerEmail: row.SeekerEmail,
                            referrerName: `${row.CompanyName || 'Company'} Employee`,
                            jobTitle: row.JobTitle || 'Job Position',
                            companyName: row.CompanyName || 'Company'
                        });
                    }
                } catch (e: any) { console.error('Notification error (non-critical):', e.message); }
            })();
        }
        
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