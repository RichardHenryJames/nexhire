/**
 * Referral Service - Core Business Logic
 * Handles all referral-related operations
 */

import { dbService } from './database.service';
import { AuthService } from './auth.service';
import { ValidationError, NotFoundError, ConflictError } from '../utils/validation';
import {
    ReferralPlan,
    ApplicantReferralSubscription,
    ReferralRequest,
    ReferralProof,
    ReferralReward,
    ReferrerStats,
    CreateReferralRequestDto,
    ClaimReferralRequestDto,
    SubmitReferralProofDto,
    VerifyReferralDto,
    PurchaseReferralPlanDto,
    ReferralAnalytics,
    ReferralEligibility,
    ReferralRequestsFilter,
    PaginatedReferralRequests
} from '../types/referral.types';

export class ReferralService {
    
    // ===== REFERRAL PLANS =====
    
    /**
     * Get all available referral plans
     */
    static async getReferralPlans(): Promise<ReferralPlan[]> {
        try {
            const query = `
                SELECT PlanID, Name, ReferralsPerDay, DurationDays, Price, CreatedAt
                FROM ReferralPlans
                ORDER BY Price ASC
            `;
            
            const result = await dbService.executeQuery<ReferralPlan>(query, []);
            return result.recordset || [];
        } catch (error) {
            console.error('Error getting referral plans:', error);
            throw error;
        }
    }

    /**
     * Purchase a referral plan for an applicant
     */
    static async purchaseReferralPlan(applicantId: string, dto: PurchaseReferralPlanDto): Promise<ApplicantReferralSubscription> {
        try {
            // Get plan details
            const planQuery = `
                SELECT PlanID, Name, ReferralsPerDay, DurationDays, Price
                FROM ReferralPlans
                WHERE PlanID = @param0
            `;
            const planResult = await dbService.executeQuery<ReferralPlan>(planQuery, [dto.planID]);
            
            if (!planResult.recordset || planResult.recordset.length === 0) {
                throw new NotFoundError('Referral plan not found');
            }
            
            const plan = planResult.recordset[0];
            
            // TODO: Process payment here using dto.paymentToken
            // For now, we'll skip payment processing
            
            // Calculate end date
            const startDate = new Date();
            const endDate = new Date();
            if (plan.DurationDays === 9999) {
                // Lifetime plan - set far future date
                endDate.setFullYear(endDate.getFullYear() + 100);
            } else if (plan.DurationDays === 0) {
                // Free plan - never expires
                endDate.setFullYear(endDate.getFullYear() + 100);
            } else {
                endDate.setDate(endDate.getDate() + plan.DurationDays);
            }
            
            // Deactivate existing subscriptions
            await dbService.executeQuery(
                'UPDATE ApplicantReferralSubscriptions SET IsActive = 0 WHERE ApplicantID = @param0',
                [applicantId]
            );
            
            // Create new subscription
            const subscriptionId = AuthService.generateUniqueId();
            const insertQuery = `
                INSERT INTO ApplicantReferralSubscriptions (
                    SubscriptionID, ApplicantID, PlanID, StartDate, EndDate, IsActive
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4, 1
                )
            `;
            
            await dbService.executeQuery(insertQuery, [
                subscriptionId, applicantId, dto.planID, startDate, endDate
            ]);
            
            // Return the created subscription
            const createdSubscription = await this.getCurrentSubscription(applicantId);
            if (!createdSubscription) {
                throw new Error('Failed to retrieve created subscription');
            }
            return createdSubscription;
        } catch (error) {
            console.error('Error purchasing referral plan:', error);
            throw error;
        }
    }

    /**
     * Get current active subscription for an applicant
     */
    static async getCurrentSubscription(applicantId: string): Promise<ApplicantReferralSubscription | null> {
        try {
            const query = `
                SELECT 
                    s.SubscriptionID, s.ApplicantID, s.PlanID, s.StartDate, s.EndDate, s.IsActive,
                    p.Name as PlanName, p.ReferralsPerDay
                FROM ApplicantReferralSubscriptions s
                INNER JOIN ReferralPlans p ON s.PlanID = p.PlanID
                WHERE s.ApplicantID = @param0 AND s.IsActive = 1 AND s.EndDate > GETUTCDATE()
                ORDER BY s.StartDate DESC
            `;
            
            const result = await dbService.executeQuery<ApplicantReferralSubscription>(query, [applicantId]);
            return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
        } catch (error) {
            console.error('Error getting current subscription:', error);
            return null;
        }
    }

    // ===== REFERRAL REQUESTS =====
    
    /**
     * Create a new referral request
     */
    static async createReferralRequest(applicantId: string, dto: CreateReferralRequestDto): Promise<ReferralRequest> {
        try {
            // Check if user has quota available
            const eligibility = await this.checkReferralEligibility(applicantId);
            if (!eligibility.isEligible) {
                throw new ValidationError(eligibility.reason || 'Not eligible for referrals');
            }
            
            // Check if already requested for this job
            const existingQuery = `
                SELECT RequestID FROM ReferralRequests 
                WHERE JobID = @param0 AND ApplicantID = @param1
            `;
            const existingResult = await dbService.executeQuery(existingQuery, [dto.jobID, applicantId]);
            
            if (existingResult.recordset && existingResult.recordset.length > 0) {
                throw new ConflictError('You have already requested a referral for this job');
            }
            
            // Verify job exists and is active
            const jobQuery = `
                SELECT JobID, Title, OrganizationID 
                FROM Jobs 
                WHERE JobID = @param0 AND Status = 'Published'
            `;
            const jobResult = await dbService.executeQuery(jobQuery, [dto.jobID]);
            
            if (!jobResult.recordset || jobResult.recordset.length === 0) {
                throw new NotFoundError('Job not found or not available');
            }
            
            // Verify resume belongs to applicant
            const resumeQuery = `
                SELECT ar.ResumeID FROM ApplicantResumes ar
                INNER JOIN Applicants a ON ar.ApplicantID = a.ApplicantID
                WHERE ar.ResumeID = @param0 AND a.ApplicantID = @param1
            `;
            const resumeResult = await dbService.executeQuery(resumeQuery, [dto.resumeID, applicantId]);
            
            if (!resumeResult.recordset || resumeResult.recordset.length === 0) {
                throw new ValidationError('Invalid resume selection');
            }
            
            // Create the referral request
            const requestId = AuthService.generateUniqueId();
            const insertQuery = `
                INSERT INTO ReferralRequests (
                    RequestID, JobID, ApplicantID, ResumeID, Status, RequestedAt
                ) VALUES (
                    @param0, @param1, @param2, @param3, 'Pending', GETUTCDATE()
                )
            `;
            
            await dbService.executeQuery(insertQuery, [requestId, dto.jobID, applicantId, dto.resumeID]);
            
            // Update referrer stats (increment pending counts for eligible referrers)
            await this.updateReferrerStatsForNewRequest(dto.jobID);
            
            // Return the created request with joined data
            return await this.getReferralRequestById(requestId);
        } catch (error) {
            console.error('Error creating referral request:', error);
            throw error;
        }
    }

    /**
     * Get referral request by ID with joined data
     */
    static async getReferralRequestById(requestId: string): Promise<ReferralRequest> {
        try {
            const query = `
                SELECT 
                    rr.RequestID, rr.JobID, rr.ApplicantID, rr.ResumeID, rr.Status,
                    rr.RequestedAt, rr.AssignedReferrerID, rr.ReferredAt, rr.VerifiedByApplicant,
                    j.Title as JobTitle,
                    o.Name as CompanyName,
                    u.FirstName + ' ' + u.LastName as ApplicantName,
                    u.Email as ApplicantEmail,
                    ur.FirstName + ' ' + ur.LastName as ReferrerName,
                    ar.ResumeLabel
                FROM ReferralRequests rr
                INNER JOIN Jobs j ON rr.JobID = j.JobID
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
                LEFT JOIN Applicants ar_ref ON rr.AssignedReferrerID = ar_ref.ApplicantID
                LEFT JOIN Users ur ON ar_ref.UserID = ur.UserID
                WHERE rr.RequestID = @param0
            `;
            
            const result = await dbService.executeQuery<ReferralRequest>(query, [requestId]);
            
            if (!result.recordset || result.recordset.length === 0) {
                throw new NotFoundError('Referral request not found');
            }
            
            return result.recordset[0];
        } catch (error) {
            console.error('Error getting referral request:', error);
            throw error;
        }
    }

    /**
     * Get available referral requests for a referrer (same organization)
     */
    static async getAvailableRequests(referrerId: string, page: number = 1, pageSize: number = 20, filters?: ReferralRequestsFilter): Promise<PaginatedReferralRequests> {
        try {
            // ? FIX: Ensure parameters are integers
            const safePageNumber = Math.max(1, Math.floor(page) || 1);
            const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));

            // Get referrer's current organization
            const referrerOrgQuery = `
                SELECT we.OrganizationID
                FROM WorkExperiences we
                INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
                WHERE a.ApplicantID = @param0 AND we.IsCurrent = 1
            `;
            const referrerOrgResult = await dbService.executeQuery(referrerOrgQuery, [referrerId]);
            
            if (!referrerOrgResult.recordset || referrerOrgResult.recordset.length === 0) {
                return { requests: [], total: 0, page: safePageNumber, pageSize: safePageSize, totalPages: 0 };
            }
            
            const organizationId = referrerOrgResult.recordset[0].OrganizationID;
            
            // Build where clause with filters
            let whereClause = `
                WHERE rr.Status = 'Pending' 
                AND j.OrganizationID = @param0
                AND rr.ApplicantID != @param1  -- Don't show own requests
            `;
            const queryParams = [organizationId, referrerId];
            let paramIndex = 2;
            
            if (filters?.jobTitle) {
                whereClause += ` AND j.Title LIKE @param${paramIndex}`;
                queryParams.push(`%${filters.jobTitle}%`);
                paramIndex++;
            }
            
            if (filters?.dateFrom) {
                whereClause += ` AND rr.RequestedAt >= @param${paramIndex}`;
                queryParams.push(filters.dateFrom);
                paramIndex++;
            }
            
            if (filters?.dateTo) {
                whereClause += ` AND rr.RequestedAt <= @param${paramIndex}`;
                queryParams.push(filters.dateTo);
                paramIndex++;
            }
            
            // Count total
            const countQuery = `
                SELECT COUNT(*) as Total
                FROM ReferralRequests rr
                INNER JOIN Jobs j ON rr.JobID = j.JobID
                ${whereClause}
            `;
            
            const countResult = await dbService.executeQuery(countQuery, queryParams);
            const total = countResult.recordset[0]?.Total || 0;
            const totalPages = Math.ceil(total / safePageSize);
            
            // Get paginated data - ? FIX: Convert to integers before using in SQL
            const offset = (safePageNumber - 1) * safePageSize;
            const dataQuery = `
                SELECT 
                    rr.RequestID, rr.JobID, rr.ApplicantID, rr.ResumeID, rr.Status,
                    rr.RequestedAt, rr.AssignedReferrerID, rr.ReferredAt, rr.VerifiedByApplicant,
                    j.Title as JobTitle,
                    o.Name as CompanyName,
                    u.FirstName + ' ' + u.LastName as ApplicantName,
                    u.Email as ApplicantEmail,
                    ar.ResumeLabel
                FROM ReferralRequests rr
                INNER JOIN Jobs j ON rr.JobID = j.JobID
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
                ${whereClause}
                ORDER BY rr.RequestedAt DESC
                OFFSET ${offset} ROWS
                FETCH NEXT ${safePageSize} ROWS ONLY
            `;
            
            // ? FIX: Don't add OFFSET/FETCH params to queryParams - embed directly in SQL
            const dataResult = await dbService.executeQuery<ReferralRequest>(dataQuery, queryParams);
            
            return {
                requests: dataResult.recordset || [],
                total,
                page: safePageNumber,
                pageSize: safePageSize,
                totalPages
            };
        } catch (error) {
            console.error('Error getting available requests:', error);
            throw error;
        }
    }

    /**
     * Claim a referral request
     */
    static async claimReferralRequest(referrerId: string, dto: ClaimReferralRequestDto): Promise<ReferralRequest> {
        try {
            // Check if request is still available
            const requestQuery = `
                SELECT RequestID, Status, JobID
                FROM ReferralRequests
                WHERE RequestID = @param0 AND Status = 'Pending'
            `;
            const requestResult = await dbService.executeQuery(requestQuery, [dto.requestID]);
            
            if (!requestResult.recordset || requestResult.recordset.length === 0) {
                throw new ValidationError('Request not available for claiming');
            }
            
            const jobId = requestResult.recordset[0].JobID;
            
            // Verify referrer is eligible (same organization)
            const eligibilityQuery = `
                SELECT we.OrganizationID
                FROM WorkExperiences we
                INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
                INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
                WHERE a.ApplicantID = @param0 AND we.IsCurrent = 1 AND j.JobID = @param1
            `;
            const eligibilityResult = await dbService.executeQuery(eligibilityQuery, [referrerId, jobId]);
            
            if (!eligibilityResult.recordset || eligibilityResult.recordset.length === 0) {
                throw new ValidationError('You are not eligible to refer for this job');
            }
            
            // Claim the request
            const updateQuery = `
                UPDATE ReferralRequests
                SET Status = 'Claimed', AssignedReferrerID = @param1, ReferredAt = GETUTCDATE()
                WHERE RequestID = @param0
            `;
            
            await dbService.executeQuery(updateQuery, [dto.requestID, referrerId]);
            
            // Update referrer stats
            await this.updateReferrerStats(referrerId);
            
            return await this.getReferralRequestById(dto.requestID);
        } catch (error) {
            console.error('Error claiming referral request:', error);
            throw error;
        }
    }

    // ===== NEW: PROOF SUBMISSION & VERIFICATION =====

    /**
     * Submit proof of referral (screenshot, URL, etc.)
     */
    static async submitReferralProof(referrerId: string, dto: SubmitReferralProofDto): Promise<ReferralProof> {
        try {
            // Verify request exists and is claimed by this referrer
            const requestQuery = `
                SELECT RequestID, Status, AssignedReferrerID
                FROM ReferralRequests
                WHERE RequestID = @param0 AND AssignedReferrerID = @param1 AND Status = 'Claimed'
            `;
            const requestResult = await dbService.executeQuery(requestQuery, [dto.requestID, referrerId]);
            
            if (!requestResult.recordset || requestResult.recordset.length === 0) {
                throw new ValidationError('Request not found or not claimed by you');
            }

            // Check if proof already exists
            const existingProofQuery = `
                SELECT ProofID FROM ReferralProofs 
                WHERE RequestID = @param0 AND ReferrerID = @param1
            `;
            const existingProofResult = await dbService.executeQuery(existingProofQuery, [dto.requestID, referrerId]);
            
            if (existingProofResult.recordset && existingProofResult.recordset.length > 0) {
                throw new ConflictError('Proof already submitted for this request');
            }

            // Create proof record
            const proofId = AuthService.generateUniqueId();
            const insertQuery = `
                INSERT INTO ReferralProofs (
                    ProofID, RequestID, ReferrerID, FileURL, FileType, SubmittedAt
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4, GETUTCDATE()
                )
            `;
            
            await dbService.executeQuery(insertQuery, [
                proofId, dto.requestID, referrerId, dto.fileURL, dto.fileType
            ]);

            // Update request status to 'Completed'
            await dbService.executeQuery(
                'UPDATE ReferralRequests SET Status = \'Completed\' WHERE RequestID = @param0',
                [dto.requestID]
            );

            // Get the created proof
            const proofQuery = `
                SELECT ProofID, RequestID, ReferrerID, FileURL, FileType, SubmittedAt
                FROM ReferralProofs
                WHERE ProofID = @param0
            `;
            const proofResult = await dbService.executeQuery<ReferralProof>(proofQuery, [proofId]);
            
            console.log(`? Proof submitted for request ${dto.requestID} by referrer ${referrerId}`);
            
            // TODO: Notify seeker that proof was submitted
            // await ReferralNotificationService.notifyReferralCompleted(dto.requestID, referrerId, seekerId);

            return proofResult.recordset[0];
        } catch (error) {
            console.error('Error submitting referral proof:', error);
            throw error;
        }
    }

    /**
     * Verify referral completion by seeker
     */
    static async verifyReferral(applicantId: string, dto: VerifyReferralDto): Promise<ReferralRequest> {
        try {
            // Verify request belongs to this applicant and is completed
            const requestQuery = `
                SELECT rr.RequestID, rr.Status, rr.AssignedReferrerID, rr.VerifiedByApplicant
                FROM ReferralRequests rr
                WHERE rr.RequestID = @param0 AND rr.ApplicantID = @param1 AND rr.Status = 'Completed'
            `;
            const requestResult = await dbService.executeQuery(requestQuery, [dto.requestID, applicantId]);
            
            if (!requestResult.recordset || requestResult.recordset.length === 0) {
                throw new ValidationError('Request not found or not completed');
            }

            const request = requestResult.recordset[0];
            const referrerId = request.AssignedReferrerID;

            // Update verification status
            const updateQuery = `
                UPDATE ReferralRequests
                SET Status = @param1, VerifiedByApplicant = @param2
                WHERE RequestID = @param0
            `;
            
            const newStatus = dto.verified ? 'Verified' : 'Completed';
            await dbService.executeQuery(updateQuery, [dto.requestID, newStatus, dto.verified ? 1 : 0]);

            // If verified, award points to referrer
            if (dto.verified && referrerId) {
                await this.awardReferralPoints(referrerId, dto.requestID, 10); // Default 10 points
                console.log(`?? Referral verified! 10 points awarded to referrer ${referrerId}`);
                
                // TODO: Notify referrer about points earned
                // await ReferralNotificationService.notifyReferralVerified(dto.requestID, referrerId, 10);
            }

            return await this.getReferralRequestById(dto.requestID);
        } catch (error) {
            console.error('Error verifying referral:', error);
            throw error;
        }
    }

    /**
     * Get my requests as referrer (claimed/completed requests)
     */
    static async getMyReferrerRequests(referrerId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedReferralRequests> {
        try {
            // ? FIX: Ensure parameters are integers
            const safePageNumber = Math.max(1, Math.floor(page) || 1);
            const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));

            const whereClause = 'WHERE rr.AssignedReferrerID = @param0';
            const queryParams = [referrerId];

            // Count total
            const countQuery = `
                SELECT COUNT(*) as Total
                FROM ReferralRequests rr
                ${whereClause}
            `;
            
            const countResult = await dbService.executeQuery(countQuery, queryParams);
            const total = countResult.recordset[0]?.Total || 0;
            const totalPages = Math.ceil(total / safePageSize);

            // Get paginated data - ? FIX: Convert to integers before using in SQL
            const offset = (safePageNumber - 1) * safePageSize;
            const dataQuery = `
                SELECT 
                    rr.RequestID, rr.JobID, rr.ApplicantID, rr.ResumeID, rr.Status,
                    rr.RequestedAt, rr.AssignedReferrerID, rr.ReferredAt, rr.VerifiedByApplicant,
                    j.Title as JobTitle,
                    o.Name as CompanyName,
                    u.FirstName + ' ' + u.LastName as ApplicantName,
                    u.Email as ApplicantEmail,
                    ar.ResumeLabel,
                    rp.FileURL as ProofFileURL,
                    rp.FileType as ProofFileType
                FROM ReferralRequests rr
                INNER JOIN Jobs j ON rr.JobID = j.JobID
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
                LEFT JOIN ReferralProofs rp ON rr.RequestID = rp.RequestID
                ${whereClause}
                ORDER BY rr.ReferredAt DESC
                OFFSET ${offset} ROWS
                FETCH NEXT ${safePageSize} ROWS ONLY
            `;
            
            // ? FIX: Don't add OFFSET/FETCH params to queryParams - embed directly in SQL
            const dataResult = await dbService.executeQuery<ReferralRequest>(dataQuery, queryParams);
            
            return {
                requests: dataResult.recordset || [],
                total,
                page: safePageNumber,
                pageSize: safePageSize,
                totalPages
            };
        } catch (error) {
            console.error('Error getting my referrer requests:', error);
            throw error;
        }
    }

    /**
     * Get my referral requests as a seeker (requests I made)
     */
    static async getMyReferralRequests(applicantId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedReferralRequests> {
        try {
            // ? FIX: Ensure parameters are integers
            const safePageNumber = Math.max(1, Math.floor(page) || 1);
            const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));

            const whereClause = 'WHERE rr.ApplicantID = @param0';
            const queryParams = [applicantId];

            // Count total
            const countQuery = `
                SELECT COUNT(*) as Total
                FROM ReferralRequests rr
                ${whereClause}
            `;
            
            const countResult = await dbService.executeQuery(countQuery, queryParams);
            const total = countResult.recordset[0]?.Total || 0;
            const totalPages = Math.ceil(total / safePageSize);

            // Get paginated data - ? FIX: Convert to integers before using in SQL
            const offset = (safePageNumber - 1) * safePageSize;
            const dataQuery = `
                SELECT 
                    rr.RequestID, rr.JobID, rr.ApplicantID, rr.ResumeID, rr.Status,
                    rr.RequestedAt, rr.AssignedReferrerID, rr.ReferredAt, rr.VerifiedByApplicant,
                    j.Title as JobTitle,
                    o.Name as CompanyName,
                    ur.FirstName + ' ' + ur.LastName as ReferrerName,
                    ur.Email as ReferrerEmail,
                    ar.ResumeLabel,
                    rp.FileURL as ProofFileURL,
                    rp.FileType as ProofFileType
                FROM ReferralRequests rr
                INNER JOIN Jobs j ON rr.JobID = j.JobID
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
                LEFT JOIN Applicants a_ref ON rr.AssignedReferrerID = a_ref.ApplicantID
                LEFT JOIN Users ur ON a_ref.UserID = ur.UserID
                LEFT JOIN ReferralProofs rp ON rr.RequestID = rp.RequestID
                ${whereClause}
                ORDER BY rr.RequestedAt DESC
                OFFSET ${offset} ROWS
                FETCH NEXT ${safePageSize} ROWS ONLY
            `;
            
            // ? FIX: Pass integers as strings for SQL Server
            queryParams.push(offset.toString(), safePageSize.toString());
            const dataResult = await dbService.executeQuery<ReferralRequest>(dataQuery, queryParams);
            
            return {
                requests: dataResult.recordset || [],
                total,
                page: safePageNumber,
                pageSize: safePageSize,
                totalPages
            };
        } catch (error) {
            console.error('Error getting my referral requests:', error);
            throw error;
        }
    }

    // ===== HELPER METHODS =====
    
    /**
     * Award points to referrer
     */
    private static async awardReferralPoints(referrerId: string, requestId: string, points: number): Promise<void> {
        try {
            // Check if reward already exists
            const existingRewardQuery = `
                SELECT RewardID FROM ReferralRewards 
                WHERE ReferrerID = @param0 AND RequestID = @param1
            `;
            const existingRewardResult = await dbService.executeQuery(existingRewardQuery, [referrerId, requestId]);
            
            if (existingRewardResult.recordset && existingRewardResult.recordset.length > 0) {
                console.log(`Points already awarded for request ${requestId}`);
                return;
            }

            // Create reward record
            const rewardId = AuthService.generateUniqueId();
            const insertRewardQuery = `
                INSERT INTO ReferralRewards (
                    RewardID, ReferrerID, RequestID, PointsEarned, AwardedAt
                ) VALUES (
                    @param0, @param1, @param2, @param3, GETUTCDATE()
                )
            `;
            
            await dbService.executeQuery(insertRewardQuery, [rewardId, referrerId, requestId, points]);

            // Update referrer's total points in Applicants table
            const updatePointsQuery = `
                UPDATE Applicants 
                SET ReferralPoints = ISNULL(ReferralPoints, 0) + @param1
                WHERE ApplicantID = @param0
            `;
            
            await dbService.executeQuery(updatePointsQuery, [referrerId, points]);
            
            console.log(`?? Awarded ${points} points to referrer ${referrerId} for request ${requestId}`);
        } catch (error) {
            console.error('Error awarding referral points:', error);
        }
    }

    /**
     * Check if applicant is eligible for referrals
     */
    static async checkReferralEligibility(applicantId: string): Promise<ReferralEligibility> {
        try {
            // Get current subscription
            const subscription = await this.getCurrentSubscription(applicantId);
            
            if (!subscription) {
                // Check if they have any free quota left (default 5 per day)
                const todayUsage = await this.getTodayReferralUsage(applicantId);
                return {
                    isEligible: todayUsage < 5,
                    reason: todayUsage >= 5 ? 'Daily free quota (5) exceeded. Please upgrade your plan.' : undefined,
                    hasActiveSubscription: false,
                    dailyQuotaRemaining: Math.max(0, 5 - todayUsage),
                    canRefer: false // No subscription means they can't refer others
                };
            }
            
            // Check subscription quota
            const todayUsage = await this.getTodayReferralUsage(applicantId);
            const quotaRemaining = (subscription.ReferralsPerDay || 0) - todayUsage;
            
            return {
                isEligible: quotaRemaining > 0,
                reason: quotaRemaining <= 0 ? `Daily quota (${subscription.ReferralsPerDay}) exceeded` : undefined,
                hasActiveSubscription: true,
                dailyQuotaRemaining: quotaRemaining,
                canRefer: true // Active subscription allows referring
            };
        } catch (error) {
            console.error('Error checking referral eligibility:', error);
            return {
                isEligible: false,
                reason: 'Error checking eligibility',
                hasActiveSubscription: false,
                dailyQuotaRemaining: 0,
                canRefer: false
            };
        }
    }

    /**
     * Get today's referral usage for an applicant
     */
    private static async getTodayReferralUsage(applicantId: string): Promise<number> {
        try {
            const query = `
                SELECT COUNT(*) as Usage
                FROM ReferralRequests
                WHERE ApplicantID = @param0 
                AND CAST(RequestedAt AS DATE) = CAST(GETUTCDATE() AS DATE)
            `;
            
            const result = await dbService.executeQuery(query, [applicantId]);
            return result.recordset[0]?.Usage || 0;
        } catch (error) {
            console.error('Error getting today referral usage:', error);
            return 0;
        }
    }

    /**
     * Update referrer stats for new request
     */
    private static async updateReferrerStatsForNewRequest(jobId: string): Promise<void> {
        try {
            // Find all eligible referrers for this job (same organization, open to refer)
            const query = `
                INSERT INTO ReferrerStats (ReferrerID, PendingCount, LastUpdated)
                SELECT DISTINCT 
                    a.ApplicantID,
                    1,
                    GETUTCDATE()
                FROM Applicants a
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
                WHERE j.JobID = @param0 
                AND we.IsCurrent = 1 
                AND a.OpenToRefer = 1
                AND NOT EXISTS (
                    SELECT 1 FROM ReferrerStats rs WHERE rs.ReferrerID = a.ApplicantID
                )
                
                -- Update existing stats
                UPDATE rs
                SET PendingCount = PendingCount + 1, LastUpdated = GETUTCDATE()
                FROM ReferrerStats rs
                INNER JOIN Applicants a ON rs.ReferrerID = a.ApplicantID
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
                WHERE j.JobID = @param0 
                AND we.IsCurrent = 1 
                AND a.OpenToRefer = 1
            `;
            
            await dbService.executeQuery(query, [jobId]);
        } catch (error) {
            console.error('Error updating referrer stats:', error);
            // Don't throw - this is non-critical
        }
    }

    /**
     * Update individual referrer stats
     */
    private static async updateReferrerStats(referrerId: string): Promise<void> {
        try {
            const query = `
                MERGE ReferrerStats rs
                USING (
                    SELECT 
                        @param0 as ReferrerID,
                        COUNT(*) as PendingCount
                    FROM ReferralRequests rr
                    INNER JOIN Jobs j ON rr.JobID = j.JobID
                    INNER JOIN WorkExperiences we ON j.OrganizationID = we.OrganizationID
                    INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
                    WHERE a.ApplicantID = @param0 
                    AND rr.Status = 'Pending'
                    AND we.IsCurrent = 1
                ) src ON rs.ReferrerID = src.ReferrerID
                WHEN MATCHED THEN
                    UPDATE SET PendingCount = src.PendingCount, LastUpdated = GETUTCDATE()
                WHEN NOT MATCHED THEN
                    INSERT (ReferrerID, PendingCount, LastUpdated)
                    VALUES (src.ReferrerID, src.PendingCount, GETUTCDATE());
            `;
            
            await dbService.executeQuery(query, [referrerId]);
        } catch (error) {
            console.error('Error updating referrer stats:', error);
        }
    }

    /**
     * Get referral analytics for an applicant
     */
    static async getReferralAnalytics(applicantId: string): Promise<ReferralAnalytics> {
        try {
            const analyticsQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM ReferralRequests WHERE ApplicantID = @param0) as TotalRequestsMade,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE AssignedReferrerID = @param0) as TotalRequestsReceived,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE AssignedReferrerID = @param0 AND Status IN ('Completed', 'Verified')) as CompletedReferrals,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE ApplicantID = @param0 AND Status = 'Pending') as PendingRequests,
                    (SELECT ISNULL(SUM(PointsEarned), 0) FROM ReferralRewards WHERE ReferrerID = @param0) as TotalPointsEarned,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE ApplicantID = @param0 AND CAST(RequestedAt AS DATE) = CAST(GETUTCDATE() AS DATE)) as DailyQuotaUsed
            `;
            
            const result = await dbService.executeQuery(analyticsQuery, [applicantId]);
            const data = result.recordset[0];
            
            const subscription = await this.getCurrentSubscription(applicantId);
            const eligibility = await this.checkReferralEligibility(applicantId);
            
            return {
                totalRequestsMade: data.TotalRequestsMade || 0,
                totalRequestsReceived: data.TotalRequestsReceived || 0,
                completedReferrals: data.CompletedReferrals || 0,
                pendingRequests: data.PendingRequests || 0,
                totalPointsEarned: data.TotalPointsEarned || 0,
                currentSubscription: subscription || undefined,
                dailyQuotaUsed: data.DailyQuotaUsed || 0,
                dailyQuotaLimit: subscription?.ReferralsPerDay || 5
            };
        } catch (error) {
            console.error('Error getting referral analytics:', error);
            throw error;
        }
    }
}