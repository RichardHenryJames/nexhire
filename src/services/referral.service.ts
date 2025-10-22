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
    ClaimReferralRequestWithProofDto,
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
     * Create a new referral request (supports both internal and external)
     */
    static async createReferralRequest(applicantId: string, dto: CreateReferralRequestDto): Promise<ReferralRequest> {
        try {
            // Check if user has quota available
            const eligibility = await this.checkReferralEligibility(applicantId);
            if (!eligibility.isEligible) {
                throw new ValidationError(eligibility.reason || 'Not eligible for referrals');
            }

            // ✅ NEW SCHEMA: Determine referral type from presence of ExtJobID vs JobID
            const isExternal = !!dto.extJobID && !dto.jobID; // External if ExtJobID provided and JobID is null
            const isInternal = !!dto.jobID && !dto.extJobID; // Internal if JobID provided and ExtJobID is null
            
            if (!isExternal && !isInternal) {
                throw new ValidationError('Either jobID (internal) or extJobID (external) must be provided, but not both');
            }

            if (isExternal) {
                // EXTERNAL REFERRAL VALIDATION
                if (!dto.jobTitle || !dto.companyName) {
                    throw new ValidationError('Job title and company name are required for external referrals');
                }
                
                // Check if already requested for this external job (by extJobID)
                const existingQuery = `SELECT RequestID FROM ReferralRequests WHERE ApplicantID = @param0 AND ExtJobID = @param1`;
                const existingResult = await dbService.executeQuery(existingQuery, [applicantId, dto.extJobID]);
                if (existingResult.recordset?.length) {
                    throw new ConflictError('You have already requested a referral for this external job');
                }
            } else {
                // INTERNAL REFERRAL VALIDATION
                const existingQuery = `SELECT RequestID FROM ReferralRequests WHERE JobID = @param0 AND ApplicantID = @param1`;
                const existingResult = await dbService.executeQuery(existingQuery, [dto.jobID, applicantId]);
                if (existingResult.recordset?.length) {
                    throw new ConflictError('You have already requested a referral for this job');
                }
                // Verify job exists first (any status)
                const jobExistsQuery = `SELECT JobID, Status FROM Jobs WHERE JobID = @param0`;
                const jobExistsResult = await dbService.executeQuery(jobExistsQuery, [dto.jobID]);
                if (!jobExistsResult.recordset?.length) {
                    throw new NotFoundError('Job not found');
                }
                // If not published block with ValidationError as requested
                if (jobExistsResult.recordset[0].Status !== 'Published') {
                    throw new ValidationError('Job not open for referrals');
                }
            }

            // Verify resume ownership
            const resumeQuery = `
                SELECT ar.ResumeID FROM ApplicantResumes ar 
                INNER JOIN Applicants a ON ar.ApplicantID = a.ApplicantID 
                WHERE ar.ResumeID = @param0 AND a.ApplicantID = @param1`;
            const resumeResult = await dbService.executeQuery(resumeQuery, [dto.resumeID, applicantId]);
            if (!resumeResult.recordset?.length) {
                throw new ValidationError('Invalid resume selection');
            }

            const requestId = AuthService.generateUniqueId();

            if (isExternal) {
                // ✅ CREATE EXTERNAL REFERRAL REQUEST
                const insertQuery = `
                    INSERT INTO ReferralRequests (
                        RequestID, ExtJobID, ApplicantID, ResumeID, Status, RequestedAt,
                        OrganizationID, ReferralMessage
                    ) VALUES (
                        @param0, @param1, @param2, @param3, 'Pending', GETUTCDATE(),
                        @param4, @param5
                    )`;
                
                const organizationId = dto.organizationId && dto.organizationId !== '999999' 
                    ? parseInt(dto.organizationId, 10) : null;
                
                await dbService.executeQuery(insertQuery, [
                    requestId, dto.extJobID, applicantId, dto.resumeID, organizationId, dto.referralMessage || null
                ]);
                
                // Update referrer stats for external referrals
                if (organizationId) {
                    await this.updateReferrerStatsForExternalRequestByOrgId(organizationId);
                } else if (dto.companyName) {
                    await this.updateReferrerStatsForExternalRequest(dto.companyName);
                }
            } else {
                // ✅ CREATE INTERNAL REFERRAL REQUEST
                const insertQuery = `
                    INSERT INTO ReferralRequests (
                        RequestID, JobID, ApplicantID, ResumeID, Status, RequestedAt, ReferralMessage
                    ) VALUES (
                        @param0, @param1, @param2, @param3, 'Pending', GETUTCDATE(), @param4
                    )`;
                
                await dbService.executeQuery(insertQuery, [
                    requestId, dto.jobID, applicantId, dto.resumeID, dto.referralMessage || null
                ]);
                
                // Update referrer stats for internal referrals
                if (dto.jobID) await this.updateReferrerStatsForNewRequest(dto.jobID);
            }

            return await this.getReferralRequestById(requestId);
        } catch (error) {
            console.error('Error creating referral request:', error);
            throw error;
        }
    }

    /**
     * Get referral request by ID with joined data (supports external referrals)
     */
    static async getReferralRequestById(requestId: string): Promise<ReferralRequest> {
        try {
            const query = `
                SELECT 
                    rr.RequestID, rr.JobID, rr.ExtJobID, rr.ApplicantID, rr.ResumeID, rr.Status,
                    rr.RequestedAt, rr.AssignedReferrerID, rr.ReferredAt, rr.VerifiedByApplicant,
                    rr.OrganizationID, rr.ReferralMessage,
                    -- ✅ DERIVE referral type from data presence (no ReferralType column)
                    CASE WHEN rr.ExtJobID IS NOT NULL THEN 'external' ELSE 'internal' END as ReferralType,
                    -- Internal job data (will be null for external)
                    j.Title as InternalJobTitle,
                    jo.Name as InternalCompanyName,
                    -- External organization data (will be null for internal)
                    eo.Name as ExternalCompanyName,
                    -- Applicant data
                    u.FirstName + ' ' + u.LastName as ApplicantName,
                    u.Email as ApplicantEmail,
                    -- Referrer data
                    ur.FirstName + ' ' + ur.LastName as ReferrerName,
                    ar.ResumeLabel,
                    rp.FileURL as ProofFileURL,
                    rp.FileType as ProofFileType,
                    rp.Description as ProofDescription
                FROM ReferralRequests rr
                -- ✅ LEFT JOIN for internal jobs (only when JobID is not null)
                LEFT JOIN Jobs j ON rr.JobID = j.JobID AND rr.JobID IS NOT NULL
                LEFT JOIN Organizations jo ON j.OrganizationID = jo.OrganizationID
                -- ✅ LEFT JOIN for external organizations (only when ExtJobID is not null)
                LEFT JOIN Organizations eo ON rr.OrganizationID = eo.OrganizationID AND rr.ExtJobID IS NOT NULL
                -- Applicant data (always present)
                INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
                -- Referrer data (optional)
                LEFT JOIN Applicants ar_ref ON rr.AssignedReferrerID = ar_ref.ApplicantID
                LEFT JOIN Users ur ON ar_ref.UserID = ur.UserID
                -- Proof data (optional)
                LEFT JOIN ReferralProofs rp ON rr.RequestID = rp.RequestID
                WHERE rr.RequestID = @param0
            `;
            
            const result = await dbService.executeQuery<any>(query, [requestId]);
            
            if (!result.recordset || result.recordset.length === 0) {
                throw new NotFoundError('Referral request not found');
            }
            
            const rawData = result.recordset[0];
            
            // ✅ Determine job title, company name, and actual job ID based on referral type
            let jobTitle: string;
            let companyName: string;
            let actualJobId: string;
            
            if (rawData.ReferralType === 'external') {
                // For external referrals, use external data
                companyName = rawData.ExternalCompanyName || 'External Company';
                jobTitle = 'External Job'; // Could be enhanced with stored job details
                actualJobId = rawData.ExtJobID; // Use ExtJobID for external
            } else {
                // For internal referrals, use job data
                jobTitle = rawData.InternalJobTitle || 'Internal Job';
                companyName = rawData.InternalCompanyName || 'Company';
                actualJobId = rawData.JobID; // Use JobID for internal
            }
            
            return {
                RequestID: rawData.RequestID,
                JobID: actualJobId, // ✅ Return the appropriate ID (JobID for internal, ExtJobID for external)
                ApplicantID: rawData.ApplicantID,
                ResumeID: rawData.ResumeID,
                Status: rawData.Status,
                RequestedAt: rawData.RequestedAt,
                AssignedReferrerID: rawData.AssignedReferrerID,
                ReferredAt: rawData.ReferredAt,
                VerifiedByApplicant: rawData.VerifiedByApplicant,
                ReferralType: rawData.ReferralType, // Computed from data presence
                OrganizationID: rawData.OrganizationID,
                ReferralMessage: rawData.ReferralMessage,
                JobTitle: jobTitle,
                CompanyName: companyName,
                ApplicantName: rawData.ApplicantName,
                ApplicantEmail: rawData.ApplicantEmail,
                ReferrerName: rawData.ReferrerName,
                ResumeLabel: rawData.ResumeLabel,
                ProofFileURL: rawData.ProofFileURL,
                ProofFileType: rawData.ProofFileType,
                ProofDescription: rawData.ProofDescription
            };
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
                    ar.ResumeLabel,
                    rp.FileURL as ProofFileURL,
                    rp.FileType as ProofFileType,
                    rp.Description as ProofDescription
                FROM ReferralRequests rr
                INNER JOIN Jobs j ON rr.JobID = j.JobID
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
                LEFT JOIN ReferralProofs rp ON rr.RequestID = rp.RequestID
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
                SELECT RequestID, Status, AssignedReferrerID, RequestedAt, ReferredAt
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

            // ?? FIX: Award points for proof submission with separate quick response bonus tracking
            const request = requestResult.recordset[0];
            let baseProofPoints = 15; // Base points for submitting proof
            
            // Award base proof submission points first
            console.log(`Awarding ${baseProofPoints} base proof submission points to referrer ${referrerId}`);
            await this.awardReferralPoints(referrerId, dto.requestID, baseProofPoints, 'proof_submission');
            
            // Calculate and award quick response bonus separately for better tracking  
            const requestedAt = new Date(request.RequestedAt);
            const referredAt = new Date(request.ReferredAt);
            const now = new Date();
            const hoursFromClaim = (now.getTime() - referredAt.getTime()) / (1000 * 60 * 60);
            
            if (hoursFromClaim <= 24) {
                const quickBonusPoints = 10; // Quick response bonus
                console.log(`Quick response bonus awarded! Completed in ${hoursFromClaim.toFixed(1)} hours - awarding ${quickBonusPoints} bonus points`);
                await this.awardReferralPoints(referrerId, dto.requestID, quickBonusPoints, 'quick_response_bonus');
            }

            // Get the created proof
            const proofQuery = `
                SELECT ProofID, RequestID, ReferrerID, FileURL, FileType, SubmittedAt
                FROM ReferralProofs
                WHERE ProofID = @param0
            `;
            const proofResult = await dbService.executeQuery<ReferralProof>(proofQuery, [proofId]);
            
            console.log(`Proof submitted for request ${dto.requestID} by referrer ${referrerId} - base points and any bonus points awarded`);
            
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

            // If verified, award ADDITIONAL verification points to referrer
            if (dto.verified && referrerId) {
                const verificationPoints = 25; // Higher points for verified referrals
                await this.awardReferralPoints(referrerId, dto.requestID, verificationPoints, 'verification');
                console.log(`🔍 Referral verified! ${verificationPoints} additional points awarded to referrer ${referrerId}`);
                
                // TODO: Notify referrer about points earned
                // await ReferralNotificationService.notifyReferralVerified(dto.requestID, referrerId, verificationPoints);
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
                    rp.FileType as ProofFileType,
                    rp.Description as ProofDescription
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

            // Get paginated data - ✅ FIXED: Support both internal and external referrals
            const offset = (safePageNumber - 1) * safePageSize;
            const dataQuery = `
                SELECT 
                    rr.RequestID, rr.JobID, rr.ExtJobID, rr.ApplicantID, rr.ResumeID, rr.Status,
                    rr.RequestedAt, rr.AssignedReferrerID, rr.ReferredAt, rr.VerifiedByApplicant,
                    rr.OrganizationID,
                    -- For INTERNAL referrals (JobID not null)
                    j.Title as InternalJobTitle,
                    jo.Name as InternalCompanyName,
                    jo.LogoURL as InternalLogoURL,
                    -- For EXTERNAL referrals (ExtJobID not null)
                    eo.Name as ExternalCompanyName,
                    eo.LogoURL as ExternalLogoURL,
                    -- Use COALESCE to get the appropriate values
                    COALESCE(j.Title, 'External Job') as JobTitle,
                    COALESCE(jo.LogoURL, eo.LogoURL) as OrganizationLogo,
                    COALESCE(jo.Name, eo.Name, 'Unknown Company') as CompanyName,
                    ur.FirstName + ' ' + ur.LastName as ReferrerName,
                    ur.Email as ReferrerEmail,
                    ar.ResumeLabel,
                    rp.FileURL as ProofFileURL,
                    rp.FileType as ProofFileType,
                    rp.Description as ProofDescription
                FROM ReferralRequests rr
                -- ✅ CHANGED: LEFT JOIN instead of INNER JOIN to include external referrals
                LEFT JOIN Jobs j ON rr.JobID = j.JobID
                LEFT JOIN Organizations jo ON j.OrganizationID = jo.OrganizationID
                -- ✅ NEW: JOIN for external organization data
                LEFT JOIN Organizations eo ON rr.OrganizationID = eo.OrganizationID AND rr.ExtJobID IS NOT NULL
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
     * Award points to referrer with enhanced tracking
     */
    private static async awardReferralPoints(referrerId: string, requestId: string, points: number, pointType: string = 'general'): Promise<void> {
        try {
            // Check if reward already exists for this type
            const existingRewardQuery = `
                SELECT RewardID FROM ReferralRewards 
                WHERE ReferrerID = @param0 AND RequestID = @param1 AND PointsType = @param2
            `;
            
            const existingRewardResult = await dbService.executeQuery(existingRewardQuery, [referrerId, requestId, pointType]);
            
            if (existingRewardResult.recordset && existingRewardResult.recordset.length > 0) {
                console.log(`Points already awarded for request ${requestId} (${pointType})`);
                return;
            }

            // Create reward record with point type tracking
            const rewardId = AuthService.generateUniqueId();
            const insertRewardQuery = `
                INSERT INTO ReferralRewards (
                    RewardID, ReferrerID, RequestID, PointsEarned, PointsType, AwardedAt
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4, GETUTCDATE()
                )
            `;
            
            await dbService.executeQuery(insertRewardQuery, [rewardId, referrerId, requestId, points, pointType]);

            // Update referrer's total points in Applicants table
            const updatePointsQuery = `
                UPDATE Applicants 
                SET ReferralPoints = ISNULL(ReferralPoints, 0) + @param1
                WHERE ApplicantID = @param0
            `;
            
            await dbService.executeQuery(updatePointsQuery, [referrerId, points]);
            
            console.log(`Awarded ${points} ${pointType} points to referrer ${referrerId} for request ${requestId}`);
        } catch (error) {
            console.error('Error awarding referral points:', error);
            // Don't rethrow - we don't want to break the main referral flow if points can't be awarded
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
                    a.ApplicantID, 1, GETUTCDATE()
                FROM Applicants a
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
                WHERE j.JobID = @param0 AND we.IsCurrent = 1 AND a.OpenToRefer = 1
                AND NOT EXISTS (SELECT 1 FROM ReferrerStats rs WHERE rs.ReferrerID = a.ApplicantID)
                
                -- Update existing stats
                UPDATE rs SET PendingCount = PendingCount + 1, LastUpdated = GETUTCDATE()
                FROM ReferrerStats rs
                INNER JOIN Applicants a ON rs.ReferrerID = a.ApplicantID
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
                WHERE j.JobID = @param0 AND we.IsCurrent = 1 AND a.OpenToRefer = 1`;
            
            await dbService.executeQuery(query, [jobId]);
        } catch (error) {
            console.error('Error updating referrer stats:', error);
        }
    }

    /**
     * Update referrer stats for external request (by company name matching)
     */
    private static async updateReferrerStatsForExternalRequest(companyName: string): Promise<void> {
        try {
            const query = `
                INSERT INTO ReferrerStats (ReferrerID, PendingCount, LastUpdated)
                SELECT DISTINCT a.ApplicantID, 1, GETUTCDATE()
                FROM Applicants a
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
                WHERE ((o.Name = @param0 AND we.IsCurrent = 1) OR (we.CompanyName = @param0 AND we.IsCurrent = 1))
                AND a.OpenToRefer = 1
                AND NOT EXISTS (SELECT 1 FROM ReferrerStats rs WHERE rs.ReferrerID = a.ApplicantID)
                
                UPDATE rs SET PendingCount = PendingCount + 1, LastUpdated = GETUTCDATE()
                FROM ReferrerStats rs
                INNER JOIN Applicants a ON rs.ReferrerID = a.ApplicantID
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
                WHERE ((o.Name = @param0 AND we.IsCurrent = 1) OR (we.CompanyName = @param0 AND we.IsCurrent = 1))
                AND a.OpenToRefer = 1`;
            
            await dbService.executeQuery(query, [companyName]);
        } catch (error) {
            console.error('Error updating referrer stats for external request:', error);
        }
    }

    /**
     * Update referrer stats for external request (by organization ID - more precise)
     */
    private static async updateReferrerStatsForExternalRequestByOrgId(organizationId: number): Promise<void> {
        try {
            const query = `
                INSERT INTO ReferrerStats (ReferrerID, PendingCount, LastUpdated)
                SELECT DISTINCT a.ApplicantID, 1, GETUTCDATE()
                FROM Applicants a
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                WHERE we.OrganizationID = @param0 AND we.IsCurrent = 1 AND a.OpenToRefer = 1
                AND NOT EXISTS (SELECT 1 FROM ReferrerStats rs WHERE rs.ReferrerID = a.ApplicantID)
                
                UPDATE rs SET PendingCount = PendingCount + 1, LastUpdated = GETUTCDATE()
                FROM ReferrerStats rs
                INNER JOIN Applicants a ON rs.ReferrerID = a.ApplicantID
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                WHERE we.OrganizationID = @param0 AND we.IsCurrent = 1 AND a.OpenToRefer = 1`;
            
            await dbService.executeQuery(query, [organizationId]);
        } catch (error) {
            console.error('Error updating referrer stats for external request by org ID:', error);
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

    /**
     * 🆕 NEW: Get detailed referral points history for breakdown
     */
    static async getReferralPointsHistory(applicantId: string) {
        try {
            const historyQuery = `
                SELECT 
                    rw.RewardID,
                    rw.ReferrerID,
                    rw.RequestID,
                    rw.PointsEarned,
                    rw.PointsType,
                    rw.AwardedAt,
                    rr.JobID,
                    j.Title as JobTitle,
                    o.LogoURL as OrganizationLogo,
                    o.Name as CompanyName,
                    CASE 
                        WHEN rw.PointsType = 'proof_submission' THEN 'Base referral proof submitted'
                        WHEN rw.PointsType = 'verification' THEN 'Referral verified by job seeker'
                        WHEN rw.PointsType = 'quick_response_bonus' THEN 'Quick response bonus (< 24 hours)'
                        ELSE 'Referral activity'
                    END as Description
                FROM ReferralRewards rw
                INNER JOIN ReferralRequests rr ON rw.RequestID = rr.RequestID
                INNER JOIN Jobs j ON rr.JobID = j.JobID
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                WHERE rw.ReferrerID = @param0
                ORDER BY rw.AwardedAt DESC
            `;

            const result = await dbService.executeQuery(historyQuery, [applicantId]);
            
            // Calculate total points
            const totalPoints = result.recordset?.reduce((sum, row) => sum + (row.PointsEarned || 0), 0) || 0;

            return {
                totalPoints,
                history: result.recordset || [],
                // 🆕 ADD: Dynamic point type metadata
                pointTypeMetadata: this.getPointTypeMetadata()
            };
        } catch (error) {
            console.error('Error getting referral points history:', error);
            throw error;
        }
    }

    /**
     * 🆕 NEW: Get point type metadata for dynamic frontend rendering
     */
    private static getPointTypeMetadata() {
        return {
            proof_submission: {
                icon: '\uD83D\uDCF8', // 📸 Camera emoji
                title: 'Proof Submissions',
                description: 'Base points for submitting referral screenshots',
                color: '#3B82F6', // Primary blue
                category: 'action'
            },
            verification: {
                icon: '\u2705', // ✅ Check mark emoji  
                title: 'Verifications',
                description: 'Bonus points when job seekers confirm referrals',
                color: '#10B981', // Success green
                category: 'completion'
            },
            quick_response_bonus: {
                icon: '\u26A1', // ⚡ Lightning emoji
                title: 'Quick Response Bonus',
                description: 'Extra points for responding within 24 hours',
                color: '#F59E0B', // Warning amber
                category: 'bonus'
            },
            // 🚀 FUTURE: Any new point types can be added here without frontend changes
            monthly_bonus: {
                icon: '\uD83C\uDF81', // 🎁 Gift emoji
                title: 'Monthly Bonus',
                description: 'Special monthly activity bonus',
                color: '#8B5CF6', // Purple
                category: 'bonus'
            },
            streak_bonus: {
                icon: '\uD83D\uDD25', // 🔥 Fire emoji
                title: 'Streak Bonus', 
                description: 'Consecutive referral streak bonus',
                color: '#EF4444', // Red
                category: 'achievement'
            },
            general: {
                icon: '\uD83C\uDFAF', // 🎯 Target emoji
                title: 'General Points',
                description: 'Other referral activities',
                color: '#6B7280', // Gray
                category: 'general'
            }
        };
    }

    /**
     * Claim a referral request with mandatory proof upload
     */
    static async claimReferralRequestWithProof(referrerId: string, dto: ClaimReferralRequestWithProofDto): Promise<ReferralRequest> {
        try {
            // Check if request is still available
            const requestQuery = `
                SELECT RequestID, Status, JobID, ApplicantID, RequestedAt
                FROM ReferralRequests
                WHERE RequestID = @param0 AND Status = 'Pending'
            `;
            const requestResult = await dbService.executeQuery(requestQuery, [dto.requestID]);
            
            if (!requestResult.recordset || requestResult.recordset.length === 0) {
                throw new ValidationError('Request not available for claiming');
            }
            
            const { JobID: jobId, ApplicantID: seekerId, RequestedAt: requestedAt } = requestResult.recordset[0];
            
            // Verify referrer is eligible (same organization, not the original requester)
            if (referrerId === seekerId) {
                throw new ValidationError('You cannot claim your own referral request');
            }
            
            const eligibilityQuery = `
                SELECT we.OrganizationID
                FROM WorkExperiences we
                INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
                INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
                WHERE a.ApplicantID = @param0 AND we.IsCurrent = 1 AND j.JobID = @param1
            `;
            const eligibilityResult = await dbService.executeQuery(eligibilityQuery, [referrerId, jobId]);
            
            if (!eligibilityResult.recordset || eligibilityResult.recordset.length === 0) {
                throw new ValidationError('You are not eligible to refer for this job - must work at the same company');
            }
            
            // Get current time for quick response bonus calculation
            const referredAt = new Date();
            
            // Claim the request and mark as completed with proof
            const updateQuery = `
                UPDATE ReferralRequests
                SET Status = 'Completed', AssignedReferrerID = @param1, ReferredAt = @param2
                WHERE RequestID = @param0
            `;
            
            await dbService.executeQuery(updateQuery, [dto.requestID, referrerId, referredAt]);
            
            // Create proof record immediately
            const proofId = AuthService.generateUniqueId();
            const insertProofQuery = `
                INSERT INTO ReferralProofs (
                    ProofID, RequestID, ReferrerID, FileURL, FileType, Description, SubmittedAt
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4, @param5, @param6
                )
            `;
            
            await dbService.executeQuery(insertProofQuery, [
                proofId, dto.requestID, referrerId, dto.proofFileURL, dto.proofFileType, dto.proofDescription || null, referredAt
            ]);
            
            // ?? FIX: Award points for proof submission with quick response bonus
            let baseProofPoints = 15; // Base points for submitting proof
            
            // Award base proof submission points first
            console.log(`🎯 Awarding ${baseProofPoints} base proof submission points to referrer ${referrerId}`);
            await this.awardReferralPoints(referrerId, dto.requestID, baseProofPoints, 'proof_submission');

            // Calculate and award quick response bonus separately for better tracking
            const requestedTime = new Date(requestedAt);
            const completedTime = new Date(referredAt);
            const hoursFromRequest = (completedTime.getTime() - requestedTime.getTime()) / (1000 * 60 * 60);
            
            if (hoursFromRequest <= 24) {
                const quickBonusPoints = 10; // Quick response bonus
                console.log(`⚡ Quick response bonus awarded! Completed in ${hoursFromRequest.toFixed(1)} hours - awarding ${quickBonusPoints} bonus points`);
                await this.awardReferralPoints(referrerId, dto.requestID, quickBonusPoints, 'quick_response_bonus');
            }
            
            // Update referrer stats
            await this.updateReferrerStats(referrerId);
            
            let totalPointsAwarded = baseProofPoints;
            if (hoursFromRequest <= 24) {
                totalPointsAwarded += 10; // Add quick bonus to display total
            }
            
            console.log(`🎯 Referral request ${dto.requestID} claimed with proof by ${referrerId} - ${totalPointsAwarded} total points awarded`);
            
            // TODO: Notify seeker that referral was completed
            // await ReferralNotificationService.notifyReferralCompleted(dto.requestID, referrerId, seekerId);
            
            return await this.getReferralRequestById(dto.requestID);
        } catch (error) {
            console.error('Error claiming referral request with proof:', error);
            throw error;
        }
    }

    /**
     * Cancel a referral request (by seeker) if still pending
     */
    static async cancelReferralRequest(applicantId: string, requestId: string): Promise<ReferralRequest> {
        try {
            // Verify pending request belongs to applicant
            const selectQuery = `
                SELECT RequestID, JobID, Status FROM ReferralRequests 
                WHERE RequestID = @param0 AND ApplicantID = @param1`;
            const result = await dbService.executeQuery(selectQuery, [requestId, applicantId]);
            if (!result.recordset || result.recordset.length === 0) {
                throw new ValidationError('Referral request not found');
            }
            const request = result.recordset[0];
            if (request.Status !== 'Pending') throw new ValidationError('Only pending requests can be cancelled');
            // Mark as cancelled
            await dbService.executeQuery(
                `UPDATE ReferralRequests SET Status = 'Cancelled' WHERE RequestID = @param0`,
                [requestId]
            );
            // Decrement pending counts for eligible referrers
            await this.updateReferrerStatsAfterCancellation(request.JobID);
            return await this.getReferralRequestById(requestId);
        } catch (error) {
            console.error('Error cancelling referral request:', error);
            throw error;
        }
    }

    /**
     * Adjust referrer stats when a pending request is cancelled
     */
    private static async updateReferrerStatsAfterCancellation(jobId: string): Promise<void> {
        try {
            const query = `
                UPDATE rs
                SET PendingCount = CASE WHEN PendingCount > 0 THEN PendingCount - 1 ELSE 0 END,
                    LastUpdated = GETUTCDATE()
                FROM ReferrerStats rs
                INNER JOIN Applicants a ON rs.ReferrerID = a.ApplicantID
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
                WHERE j.JobID = @param0
                AND we.IsCurrent = 1
                AND a.OpenToRefer = 1;
            `;
            await dbService.executeQuery(query, [jobId]);
        } catch (e) {
            console.warn('Failed to update referrer stats after cancellation:', e);
        }
    }
}