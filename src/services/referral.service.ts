/**
 * Referral Service - Core Business Logic
 * Handles all referral-related operations
 */

import { dbService } from './database.service';
import { AuthService } from './auth.service';
import { WalletService } from './wallet.service';
import { PricingService } from './pricing.service';
import { NotificationService } from './notificationService';
import { SupportService } from './support.service';
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
    SubmitReferralWithProofDto,
    VerifyReferralDto,
    PurchaseReferralPlanDto,
    ReferralAnalytics,
    ReferralEligibility,
    ReferralRequestsFilter,
    PaginatedReferralRequests
} from '../types/referral.types';

// Note: Pricing now fetched from DB via PricingService

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
            
            // Calculate end date (UTC)
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
                subscriptionId, applicantId, dto.planID, startDate.toISOString(), endDate.toISOString()
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
     * NOW USES HOLD-BASED PAYMENT: Funds are held, not deducted upfront
     * Actual deduction happens when referrer completes the referral
     */
    static async createReferralRequest(applicantId: string, dto: CreateReferralRequestDto): Promise<ReferralRequest> {
        try {
            // Get referral cost from database (open-to-any costs more)
            const REFERRAL_REQUEST_COST = dto.openToAnyCompany
                ? await PricingService.getOpenToAnyCost()
                : await PricingService.getReferralCost();
            
            // Get user ID for wallet operations
            const userQuery = `SELECT UserID FROM Applicants WHERE ApplicantID = @param0`;
            const userResult = await dbService.executeQuery(userQuery, [applicantId]);
            
            if (!userResult.recordset || userResult.recordset.length === 0) {
                throw new NotFoundError('Applicant profile not found');
            }
            
            const userId = userResult.recordset[0].UserID;

            // Check AVAILABLE wallet balance (balance minus active holds)
            const walletInfo = await WalletService.getAvailableBalance(userId);
            
            if (walletInfo.availableBalance < REFERRAL_REQUEST_COST) {
                throw new ValidationError('INSUFFICIENT_WALLET_BALANCE', {
                    currentBalance: walletInfo.balance,
                    availableBalance: walletInfo.availableBalance,
                    holdAmount: walletInfo.holdAmount,
                    requiredAmount: REFERRAL_REQUEST_COST,
                    shortfall: REFERRAL_REQUEST_COST - walletInfo.availableBalance,
                    message: `Insufficient available balance. You have ₹${walletInfo.holdAmount} on hold for pending referrals.`
                });
            }

            // Determine referral type from presence of ExtJobID vs JobID
            const isExternal = !!dto.extJobID && !dto.jobID; // External if ExtJobID provided and JobID is null
            const isInternal = !!dto.jobID && !dto.extJobID; // Internal if JobID provided and ExtJobID is null
            
            // Variables to store job details for internal referrals
            let jobOrganizationId: number | null = null;
            let internalJobTitle: string | null = null;
            
            if (!isExternal && !isInternal) {
                throw new ValidationError('Either jobID (internal) or extJobID (external) must be provided, but not both');
            }

            if (isExternal) {
                // External referral validation - only require jobTitle
                if (!dto.jobTitle) {
                    throw new ValidationError('Job title is required for external referrals');
                }
                
                // Check if already requested for this external job (by extJobID)
                const existingQuery = `SELECT RequestID FROM ReferralRequests WHERE ApplicantID = @param0 AND ExtJobID = @param1 AND Status NOT IN ('Cancelled', 'Expired')`;
                const existingResult = await dbService.executeQuery(existingQuery, [applicantId, dto.extJobID]);
                if (existingResult.recordset?.length) {
                    throw new ConflictError('You have already requested a referral for this external job');
                }
            } else {
                // INTERNAL REFERRAL VALIDATION
                const existingQuery = `SELECT RequestID FROM ReferralRequests WHERE JobID = @param0 AND ApplicantID = @param1 AND Status NOT IN ('Cancelled', 'Expired')`;
                const existingResult = await dbService.executeQuery(existingQuery, [dto.jobID, applicantId]);
                if (existingResult.recordset?.length) {
                    throw new ConflictError('You have already requested a referral for this job');
                }
                // Verify job exists first (any status) and get OrganizationID
                const jobExistsQuery = `SELECT JobID, Status, OrganizationID, Title FROM Jobs WHERE JobID = @param0`;
                const jobExistsResult = await dbService.executeQuery(jobExistsQuery, [dto.jobID]);
                if (!jobExistsResult.recordset?.length) {
                    throw new NotFoundError('Job not found');
                }
                // If not published block with ValidationError as requested
                if (jobExistsResult.recordset[0].Status !== 'Published') {
                    throw new ValidationError('Job not open for referrals');
                }
                // Store job details for internal referral
                jobOrganizationId = jobExistsResult.recordset[0].OrganizationID;
                internalJobTitle = jobExistsResult.recordset[0].Title;
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

            // Generate request ID first
            const requestId = AuthService.generateUniqueId();

            // CREATE THE REFERRAL REQUEST FIRST (needed for hold foreign key)
            if (isExternal) {
                // Create external referral request with JobTitle and JobURL
                const insertQuery = `
                    INSERT INTO ReferralRequests (
                        RequestID, ExtJobID, ApplicantID, ResumeID, Status, RequestedAt,
                        OrganizationID, ReferralMessage, JobTitle, JobURL,
                        OpenToAnyCompany, MinSalary, SalaryCurrency, SalaryPeriod
                    ) VALUES (
                        @param0, @param1, @param2, @param3, 'Pending', GETUTCDATE(),
                        @param4, @param5, @param6, @param7,
                        @param8, @param9, @param10, @param11
                    )`;
                
                const organizationId = dto.organizationId && dto.organizationId !== '999999' 
                    ? parseInt(dto.organizationId, 10) : null;
                
                await dbService.executeQuery(insertQuery, [
                    requestId, dto.extJobID, applicantId, dto.resumeID, organizationId, 
                    dto.referralMessage || null, dto.jobTitle, dto.jobUrl || null,
                    dto.openToAnyCompany ? 1 : 0, dto.minSalary || null, dto.salaryCurrency || null, dto.salaryPeriod || null
                ]);
                
                // Update referrer stats for external referrals
                if (organizationId) {
                    await this.updateReferrerStatsForExternalRequestByOrgId(organizationId);
                } else if (dto.companyName) {
                    await this.updateReferrerStatsForExternalRequest(dto.companyName);
                }
            } else {
                // ✅ CREATE INTERNAL REFERRAL REQUEST (includes OrganizationID and JobTitle from Job)
                const insertQuery = `
                    INSERT INTO ReferralRequests (
                        RequestID, JobID, ApplicantID, ResumeID, Status, RequestedAt, ReferralMessage, OrganizationID, JobTitle
                    ) VALUES (
                        @param0, @param1, @param2, @param3, 'Pending', GETUTCDATE(), @param4, @param5, @param6
                    )`;
                
                await dbService.executeQuery(insertQuery, [
                    requestId, dto.jobID, applicantId, dto.resumeID, dto.referralMessage || null, jobOrganizationId, internalJobTitle
                ]);
                
                // Update referrer stats for internal referrals
                if (dto.jobID) await this.updateReferrerStatsForNewRequest(dto.jobID);
            }

            // NOW CREATE HOLD (after referral request exists for foreign key)
            // Funds are reserved but not deducted - will be deducted when referrer completes
            const holdResult = await WalletService.createHold(
                userId,
                REFERRAL_REQUEST_COST,
                requestId,
                `Referral request for ${dto.jobTitle || internalJobTitle || 'job'} at ${dto.companyName || 'company'}`
            );

            const createdRequest = await this.getReferralRequestById(requestId);
            
            // ✅ NEW: Log initial status history for tracking screen
            try {
                await this.logInitialStatus(requestId, createdRequest.ApplicantName || 'Job Seeker', !!dto.openToAnyCompany);
            } catch (err) {
                console.warn('Non-critical: Failed to log initial status history:', err);
            }
            
            // ✅ NEW: Send email notifications to eligible referrers
            try {
                // Cast to any to access query-derived fields not in the interface
                const requestData = createdRequest as any;
                // Use CompanyName (processed field) or fallback to raw fields
                const companyName = requestData.CompanyName || requestData.ExternalCompanyName || requestData.InternalCompanyName || dto.companyName || 'Unknown Company';
                const jobTitle = requestData.JobTitle || requestData.InternalJobTitle || dto.jobTitle || 'Unknown Position';
                const organizationIdRaw = isExternal 
                    ? (dto.organizationId ? parseInt(dto.organizationId, 10) : null)
                    : (requestData.OrganizationID ? parseInt(requestData.OrganizationID, 10) : null);

                if (organizationIdRaw) {
                    const notifyResult = await NotificationService.notifyNewReferralRequest({
                        requestId: requestId,
                        organizationId: organizationIdRaw,
                        jobId: dto.jobID || undefined,
                        jobTitle: jobTitle,
                        companyName: companyName,
                        seekerName: createdRequest.ApplicantName || 'Job Seeker',
                        seekerId: applicantId
                    });
                }
            } catch (notifyErr) {
                // Non-critical: notification failure shouldn't block referral creation
            }
            
            // Get updated available balance after hold
            const updatedWalletInfo = await WalletService.getAvailableBalance(userId);
            
            // Add wallet hold info to response (NOT deducted yet, just held)
            return {
                ...createdRequest,
                // New hold-based response fields
                amountHeld: REFERRAL_REQUEST_COST,
                holdId: holdResult.HoldID,
                walletBalance: updatedWalletInfo.balance,
                availableBalanceAfter: holdResult.AvailableBalanceAfter,
                holdAmount: updatedWalletInfo.holdAmount,
                // Legacy fields for backward compatibility (frontend may still use these)
                walletBalanceBefore: updatedWalletInfo.balance, // Balance unchanged (hold, not debit)
                walletBalanceAfter: updatedWalletInfo.balance,  // Balance unchanged
                amountDeducted: 0 // Not deducted yet!
            } as any;
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
                    rr.OrganizationID, rr.ReferralMessage, rr.JobTitle, rr.JobURL,
                    rr.OpenToAnyCompany, rr.MinSalary, rr.SalaryCurrency, rr.SalaryPeriod,
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
                -- ✅ LEFT JOIN for organization directly from ReferralRequests.OrganizationID
                LEFT JOIN Organizations eo ON rr.OrganizationID = eo.OrganizationID
                -- Applicant data (always present)
                INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
                LEFT JOIN ReferralProofs rp ON rr.RequestID = rp.RequestID
                LEFT JOIN Users ur ON rr.AssignedReferrerID = ur.UserID
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
                // For external referrals, use stored JobTitle (new column) or fallback
                companyName = rawData.OpenToAnyCompany ? 'Any Company' : (rawData.ExternalCompanyName || 'External Company');
                jobTitle = rawData.JobTitle || 'External Job'; // ✅ Use stored JobTitle column
                actualJobId = rawData.ExtJobID; // Use ExtJobID for external
            } else {
                // For internal referrals, use job data - prefer direct org lookup via rr.OrganizationID
                jobTitle = rawData.InternalJobTitle || rawData.JobTitle || 'Internal Job';
                companyName = rawData.ExternalCompanyName || rawData.InternalCompanyName || 'Company';
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
                ProofDescription: rawData.ProofDescription,
                OpenToAnyCompany: !!rawData.OpenToAnyCompany,
                MinSalary: rawData.MinSalary,
                SalaryCurrency: rawData.SalaryCurrency,
                SalaryPeriod: rawData.SalaryPeriod
            };
        } catch (error) {
            console.error('Error getting referral request:', error);
            throw error;
        }
    }

    /**
     * Get available referral requests for a referrer (same organization)
     * ✅ FIXED: Added IsActive = 1 to exclude soft-deleted work experiences
     */
    static async getAvailableRequests(referrerId: string, page: number = 1, pageSize: number = 20, filters?: ReferralRequestsFilter): Promise<PaginatedReferralRequests> {
        try {
            // ✅ FIX: Ensure parameters are integers
            const safePageNumber = Math.max(1, Math.floor(page) || 1);
            const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));

            // ✅ FIXED: Get referrer's current ACTIVE organization (IsActive = 1 excludes soft-deleted)
            const referrerOrgQuery = `
                SELECT we.OrganizationID
                FROM WorkExperiences we
                INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
                WHERE a.ApplicantID = @param0 AND we.IsCurrent = 1 AND we.IsActive = 1
            `;
            const referrerOrgResult = await dbService.executeQuery(referrerOrgQuery, [referrerId]);
            
            if (!referrerOrgResult.recordset || referrerOrgResult.recordset.length === 0) {
                return { requests: [], total: 0, page: safePageNumber, pageSize: safePageSize, totalPages: 0 };
            }
            
            const organizationId = referrerOrgResult.recordset[0].OrganizationID;
            
            // Return ALL requests for this organization (frontend will filter by tab)
            // Exclude only Cancelled requests - everything else should be visible
            // Expired requests will show in Closed tab on frontend
            const statusFilter = `rr.Status NOT IN ('Cancelled')`;
            
            // Build where clause - show requests for this referrer's organization
            let whereClause = `
                WHERE ${statusFilter}
                AND (
                    -- Internal referrals: Match by job's organization
                    (rr.JobID IS NOT NULL AND j.OrganizationID = @param0)
                    OR
                    -- External referrals: Match by stored organization ID
                    (rr.ExtJobID IS NOT NULL AND rr.OrganizationID = @param0)
                )
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
            
            // Count total - ✅ FIXED: Include both internal and external referrals
            const countQuery = `
                SELECT COUNT(*) as Total
                FROM ReferralRequests rr
                LEFT JOIN Jobs j ON rr.JobID = j.JobID
                ${whereClause}
            `;
            
            const countResult = await dbService.executeQuery(countQuery, queryParams);
            const total = countResult.recordset[0]?.Total || 0;
            const totalPages = Math.ceil(total / safePageSize);
            
            // Get paginated data - ✅ FIXED: Support both internal and external referrals with stored JobTitle
            const offset = (safePageNumber - 1) * safePageSize;
            const dataQuery = `
                SELECT 
                    rr.RequestID, rr.JobID, rr.ExtJobID, rr.ApplicantID, rr.Status,
                    rr.RequestedAt, rr.AssignedReferrerID, rr.ReferredAt, rr.VerifiedByApplicant,
                    rr.OrganizationID, rr.JobURL,
                    -- For INTERNAL referrals (JobID not null)
                    j.Title as InternalJobTitle,
                    jo.Name as InternalCompanyName,
                    jo.LogoURL as InternalLogoURL,
                    -- For EXTERNAL referrals (ExtJobID not null)
                    eo.Name as ExternalCompanyName,
                    eo.LogoURL as ExternalLogoURL,
                    -- ✅ Use stored JobTitle column with proper COALESCE
                    COALESCE(j.Title, rr.JobTitle, 'External Job') as JobTitle,
                    COALESCE(jo.LogoURL, eo.LogoURL) as OrganizationLogo,
                    COALESCE(jo.Name, eo.Name, 'Unknown Company') as CompanyName,
                    u.FirstName + ' ' + u.LastName as ApplicantName,
                    u.Email as ApplicantEmail,
                    u.UserID as ApplicantUserID,
                    u.ProfilePictureURL as ApplicantProfilePictureURL,
                    rr.ResumeID as ResumeID,
                    ar.ResumeLabel as ResumeLabel,
                    ar.ResumeURL as ResumeURL,
                    rp.FileURL as ProofFileURL,
                    rp.FileType as ProofFileType,
                    rp.Description as ProofDescription,
                    rr.ReferralMessage as ReferralMessage,
                    -- Job details for internal referrals
                    j.Location as JobLocation,
                    j.ExperienceMin as JobExperienceMin,
                    j.ExperienceMax as JobExperienceMax,
                    -- ✅ AssignedReferrerID now stores UserID directly
                    rr.AssignedReferrerID as AssignedReferrerUserID
                FROM ReferralRequests rr
                -- ✅ CHANGED: LEFT JOIN instead of INNER JOIN to include external referrals
                LEFT JOIN Jobs j ON rr.JobID = j.JobID
                LEFT JOIN Organizations jo ON j.OrganizationID = jo.OrganizationID
                -- ✅ NEW: JOIN for external organization data
                LEFT JOIN Organizations eo ON rr.OrganizationID = eo.OrganizationID AND rr.ExtJobID IS NOT NULL
                INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
                LEFT JOIN ReferralProofs rp ON rr.RequestID = rp.RequestID
                ${whereClause}
                ORDER BY rr.RequestedAt DESC
                OFFSET ${offset} ROWS
                FETCH NEXT ${safePageSize} ROWS ONLY
            `;
            
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

    // ===== VERIFICATION =====

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
            
            const newStatus = dto.verified ? 'Verified' : 'Unverified';
            await dbService.executeQuery(updateQuery, [dto.requestID, newStatus, dto.verified ? 1 : 0]);

            // Log status change to history table
            const historyId = AuthService.generateUniqueId();
            const statusMessage = dto.verified 
                ? 'Referral verified by job seeker' 
                : 'Referral marked as unverified by job seeker';
            const historyQuery = `
                INSERT INTO ReferralRequestStatusHistory (
                    HistoryID, RequestID, Status, StatusMessage, ActorID, ActorType, ActorName, CreatedAt
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4, @param5, @param6, GETUTCDATE()
                )
            `;
            
            // Get applicant name for history (applicantId is ApplicantID, need to join to Users)
            const applicantQuery = `
                SELECT u.FirstName, u.LastName 
                FROM Users u 
                JOIN Applicants a ON a.UserID = u.UserID 
                WHERE a.ApplicantID = @param0
            `;
            const applicantResult = await dbService.executeQuery(applicantQuery, [applicantId]);
            const applicantName = applicantResult.recordset?.[0] 
                ? `${applicantResult.recordset[0].FirstName} ${applicantResult.recordset[0].LastName}`
                : 'Job Seeker';
            
            await dbService.executeQuery(historyQuery, [
                historyId,
                dto.requestID,
                newStatus,
                statusMessage,
                applicantId,
                'seeker',
                applicantName
            ]);

            // If verified, award ADDITIONAL verification money to referrer's wallet
            // Amount varies based on whether referrer got quick response bonus
            if (dto.verified && referrerId) {
                // Check if referrer received quick response bonus for this request
                const quickBonusCheckQuery = `
                    SELECT COUNT(*) as HasQuickBonus 
                    FROM ReferralRewards 
                    WHERE ReferrerID = @param0 AND RequestID = @param1 AND PointsType = 'quick_response_bonus'
                `;
                const quickBonusResult = await dbService.executeQuery(quickBonusCheckQuery, [referrerId, dto.requestID]);
                const hasQuickBonus = quickBonusResult.recordset?.[0]?.HasQuickBonus > 0;

                // Random verification reward amounts (in rupees):
                // - Fast referrers (responded < 24hrs): ₹25-35 — rewarding speed
                // - Normal referrers (responded > 24hrs): ₹12-24 — still worthwhile
                let verificationAmount: number;
                if (hasQuickBonus) {
                    verificationAmount = Math.floor(Math.random() * 11) + 25; // ₹25-35
                } else {
                    verificationAmount = Math.floor(Math.random() * 13) + 12; // ₹12-24
                }

                // Add money to referrer's wallet (actual earnings - WITHDRAWABLE)
                await WalletService.creditBonus(
                    referrerId,
                    verificationAmount,
                    'REFERRAL_EARNINGS',  // NOT 'REFERRAL_BONUS' - these are actual earnings
                    `Referral verification reward for request ${dto.requestID}`
                );

                // ✅ Send email notification to referrer about earnings
                try {
                    // Get referrer details
                    const referrerQuery = `
                        SELECT u.UserID, u.Email, u.FirstName, u.LastName
                        FROM Users u
                        WHERE u.UserID = @param0
                    `;
                    const referrerResult = await dbService.executeQuery(referrerQuery, [referrerId]);
                    const referrer = referrerResult.recordset?.[0];

                    // Get job/company details
                    const jobQuery = `
                        SELECT 
                            COALESCE(j.Title, rr.JobTitle, 'Job Position') as JobTitle,
                            COALESCE(jo.Name, eo.Name, 'Company') as CompanyName
                        FROM ReferralRequests rr
                        LEFT JOIN Jobs j ON rr.JobID = j.JobID
                        LEFT JOIN Organizations jo ON j.OrganizationID = jo.OrganizationID
                        LEFT JOIN Organizations eo ON rr.OrganizationID = eo.OrganizationID AND rr.ExtJobID IS NOT NULL
                        WHERE rr.RequestID = @param0
                    `;
                    const jobResult = await dbService.executeQuery(jobQuery, [dto.requestID]);
                    const jobInfo = jobResult.recordset?.[0];

                    // Get new wallet balance
                    const balanceResult = await WalletService.getBalance(referrerId);
                    const newBalance = balanceResult?.balance || verificationAmount;

                    if (referrer) {
                        await NotificationService.notifyReferralVerified({
                            requestId: dto.requestID,
                            referrerId: referrerId,
                            referrerName: referrer.FirstName,
                            referrerEmail: referrer.Email,
                            seekerName: applicantName,
                            jobTitle: jobInfo?.JobTitle || 'Job Position',
                            companyName: jobInfo?.CompanyName || 'Company',
                            amount: verificationAmount,
                            newBalance: newBalance
                        });
                    }
                } catch (err) {
                    console.warn('Non-critical: Failed to send referral verified email:', err);
                }
            }

            // If UNVERIFIED, auto-create a support ticket for admin review
            if (!dto.verified && referrerId) {
                try {
                    // Get job/company details for the ticket
                    const jobQuery = `
                        SELECT 
                            COALESCE(j.Title, rr.JobTitle, 'Job Position') as JobTitle,
                            COALESCE(jo.Name, eo.Name, 'Company') as CompanyName
                        FROM ReferralRequests rr
                        LEFT JOIN Jobs j ON rr.JobID = j.JobID
                        LEFT JOIN Organizations jo ON j.OrganizationID = jo.OrganizationID
                        LEFT JOIN Organizations eo ON rr.OrganizationID = eo.OrganizationID AND rr.ExtJobID IS NOT NULL
                        WHERE rr.RequestID = @param0
                    `;
                    const jobResult = await dbService.executeQuery(jobQuery, [dto.requestID]);
                    const jobInfo = jobResult.recordset?.[0];

                    // Get referrer name
                    const referrerQuery = `SELECT FirstName, LastName FROM Users WHERE UserID = @param0`;
                    const referrerResult = await dbService.executeQuery(referrerQuery, [referrerId]);
                    const referrerName = referrerResult.recordset?.[0]
                        ? `${referrerResult.recordset[0].FirstName} ${referrerResult.recordset[0].LastName}`
                        : 'Referrer';

                    const ticketSubject = `Referral Dispute: ${jobInfo?.JobTitle || 'Job'} at ${jobInfo?.CompanyName || 'Company'}`;
                    const ticketMessage = `A referral has been marked as unverified.\n\n` +
                        `📋 Details:\n` +
                        `• Referral Request ID: ${dto.requestID}\n` +
                        `• Job: ${jobInfo?.JobTitle || 'N/A'} at ${jobInfo?.CompanyName || 'N/A'}\n\n` +
                        `Our team will review the referral proof and respond within 2 working days. ` +
                        `If the dispute is valid, you will receive a full refund to your wallet.`;

                    // Use seeker's UserID to create the ticket
                    const seekerUserQuery = `SELECT UserID FROM Applicants WHERE ApplicantID = @param0`;
                    const seekerUserResult = await dbService.executeQuery(seekerUserQuery, [applicantId]);
                    const seekerUserId = seekerUserResult.recordset?.[0]?.UserID;

                    // Fallback: if we can't find UserID from Applicants, use applicantId directly
                    const ticketUserId = seekerUserId || applicantId;

                    await SupportService.createTicket({
                        userId: ticketUserId,
                        category: 'Referrals',
                        subject: ticketSubject,
                        message: ticketMessage,
                    });

                    console.log(`📩 Auto-created support ticket for unverified referral ${dto.requestID}`);
                } catch (err) {
                    console.warn('Non-critical: Failed to auto-create support ticket for unverified referral:', err);
                }
            }

            return await this.getReferralRequestById(dto.requestID);
        } catch (error) {
            console.error('Error verifying referral:', error);
            throw error;
        }
    }

    /**
     * Get my requests as referrer (completed requests)
     */
    static async getMyReferrerRequests(referrerId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedReferralRequests> {
        try {
            // Ensure parameters are integers
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
     * Get completed referrals by UserID (for closed tab - shows ALL completed referrals regardless of company)
     * AssignedReferrerID stores UserID, so we match directly against that
     */
    static async getCompletedReferralsByUser(userId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedReferralRequests> {
        try {
            const safePageNumber = Math.max(1, Math.floor(page) || 1);
            const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));

            // Filter by completed statuses AND this user as the assigned referrer
            const closedStatuses = "('ProofUploaded', 'Completed', 'Verified', 'Unverified')";
            const whereClause = `WHERE rr.Status IN ${closedStatuses} AND rr.AssignedReferrerID = @param0`;
            const queryParams = [userId];

            // Count total
            const countQuery = `
                SELECT COUNT(*) as Total
                FROM ReferralRequests rr
                ${whereClause}
            `;
            
            const countResult = await dbService.executeQuery(countQuery, queryParams);
            const total = countResult.recordset[0]?.Total || 0;
            const totalPages = Math.ceil(total / safePageSize);

            // Get paginated data - support both internal and external referrals
            const offset = (safePageNumber - 1) * safePageSize;
            const dataQuery = `
                SELECT 
                    rr.RequestID, rr.JobID, rr.ExtJobID, rr.ApplicantID, rr.ResumeID, rr.Status,
                    rr.RequestedAt, rr.AssignedReferrerID, rr.ReferredAt, rr.VerifiedByApplicant,
                    rr.OrganizationID, rr.JobURL,
                    -- For INTERNAL referrals (JobID not null)
                    j.Title as InternalJobTitle,
                    jo.Name as InternalCompanyName,
                    jo.LogoURL as InternalLogoURL,
                    -- For EXTERNAL referrals (ExtJobID not null)
                    eo.Name as ExternalCompanyName,
                    eo.LogoURL as ExternalLogoURL,
                    -- Use stored JobTitle column with proper COALESCE
                    COALESCE(j.Title, rr.JobTitle, 'External Job') as JobTitle,
                    COALESCE(jo.LogoURL, eo.LogoURL) as OrganizationLogo,
                    COALESCE(jo.Name, eo.Name, 'Unknown Company') as CompanyName,
                    u.FirstName + ' ' + u.LastName as ApplicantName,
                    u.Email as ApplicantEmail,
                    u.UserID as ApplicantUserID,
                    u.ProfilePictureURL as ApplicantProfilePictureURL,
                    ar.ResumeLabel as ResumeLabel,
                    ar.ResumeURL as ResumeURL,
                    rp.FileURL as ProofFileURL,
                    rp.FileType as ProofFileType,
                    rp.Description as ProofDescription,
                    rr.AssignedReferrerID as AssignedReferrerUserID
                FROM ReferralRequests rr
                LEFT JOIN Jobs j ON rr.JobID = j.JobID
                LEFT JOIN Organizations jo ON j.OrganizationID = jo.OrganizationID
                LEFT JOIN Organizations eo ON rr.OrganizationID = eo.OrganizationID AND rr.ExtJobID IS NOT NULL
                INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
                LEFT JOIN ReferralProofs rp ON rr.RequestID = rp.RequestID
                ${whereClause}
                ORDER BY rr.ReferredAt DESC
                OFFSET ${offset} ROWS
                FETCH NEXT ${safePageSize} ROWS ONLY
            `;
            
            const dataResult = await dbService.executeQuery<ReferralRequest>(dataQuery, queryParams);
            
            return {
                requests: dataResult.recordset || [],
                total,
                page: safePageNumber,
                pageSize: safePageSize,
                totalPages
            };
        } catch (error) {
            console.error('Error getting completed referrals by user:', error);
            throw error;
        }
    }

    /**
     * Get my referral requests as a seeker (requests I made)
     */
    static async getMyReferralRequests(applicantId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedReferralRequests> {
        try {
            // Ensure parameters are integers
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

            // Get paginated data - ✅ FIXED: Support both internal and external referrals with stored JobTitle
            const offset = (safePageNumber - 1) * safePageSize;
            const dataQuery = `
                SELECT 
                    rr.RequestID, rr.JobID, rr.ExtJobID, rr.ApplicantID, rr.ResumeID, rr.Status,
                    rr.RequestedAt, rr.AssignedReferrerID, rr.ReferredAt, rr.VerifiedByApplicant,
                    rr.JobURL, rr.ReferralMessage,
                    rr.OpenToAnyCompany, rr.MinSalary, rr.SalaryCurrency, rr.SalaryPeriod,
                    -- For INTERNAL referrals (JobID not null)
                    j.Title as InternalJobTitle,
                    jo.Name as InternalCompanyName,
                    jo.LogoURL as InternalLogoURL,
                    -- For EXTERNAL referrals (ExtJobID not null)
                    eo.Name as ExternalCompanyName,
                    eo.LogoURL as ExternalLogoURL,
                    -- ✅ Use stored JobTitle column with proper COALESCE
                    COALESCE(j.Title, rr.JobTitle, 'External Job') as JobTitle,
                    COALESCE(jo.LogoURL, eo.LogoURL) as OrganizationLogo,
                    CASE WHEN rr.OpenToAnyCompany = 1 THEN 'Any Company' ELSE COALESCE(jo.Name, eo.Name, 'Company') END as CompanyName,
                    -- ✅ FIX: Return OrganizationID from either internal job or external request
                    COALESCE(jo.OrganizationID, rr.OrganizationID) as OrganizationID,
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
                LEFT JOIN ReferralProofs rp ON rr.RequestID = rp.RequestID
                LEFT JOIN Users ur ON rr.AssignedReferrerID = ur.UserID
                ${whereClause}
                ORDER BY rr.RequestedAt DESC
                OFFSET ${offset} ROWS
                FETCH NEXT ${safePageSize} ROWS ONLY
            `;
            
            // Pass integers as strings for SQL Server
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
                // Points already awarded for this type
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
        } catch (error) {
            console.error('Error awarding referral points:', error);
            // Don't rethrow - we don't want to break the main referral flow if points can't be awarded
        }
    }

    /**
     * Check if applicant is eligible for referrals
     * ✅ UPDATED: Wallet-based model - no daily quota checks
     */
    static async checkReferralEligibility(applicantId: string): Promise<ReferralEligibility> {
        try {
            // ✅ NEW: Wallet-based model - always eligible (wallet check done separately in createReferralRequest)
            // No subscription or daily quota checks needed
            
            return {
                isEligible: true, // Eligibility is based on wallet balance, checked during request creation
                reason: undefined,
                hasActiveSubscription: false, // Subscriptions no longer used
                dailyQuotaRemaining: 999, // Unlimited - wallet-based
                canRefer: false // canRefer refers to being a referrer, not a requester
            };
        } catch (error) {
            console.error('Error checking referral eligibility:', error);
            return {
                isEligible: true, // Default to true - wallet check will handle it
                reason: undefined,
                hasActiveSubscription: false,
                dailyQuotaRemaining: 999,
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
     * @param applicantId - Used for ApplicantID queries (seeker's requests)
     * @param userId - Used for AssignedReferrerID queries (referrer's completed)
     */
    static async getReferralAnalytics(applicantId: string, userId: string): Promise<ReferralAnalytics> {
        try {
            const analyticsQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM ReferralRequests WHERE ApplicantID = @param0) as TotalRequestsMade,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE AssignedReferrerID = @param1) as TotalRequestsReceived,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE AssignedReferrerID = @param1 AND Status IN ('Completed', 'Verified')) as CompletedReferrals,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE ApplicantID = @param0 AND Status = 'Pending') as PendingRequests,
                    (SELECT ISNULL(SUM(PointsEarned), 0) FROM ReferralRewards WHERE ReferrerID = @param0) as TotalPointsEarned,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE ApplicantID = @param0 AND CAST(RequestedAt AS DATE) = CAST(GETUTCDATE() AS DATE)) as DailyQuotaUsed
            `;

            const result = await dbService.executeQuery(analyticsQuery, [applicantId, userId]);
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
            // ✅ FIX: Get current points from Applicants table (the actual available balance)
            const currentPointsQuery = `
                SELECT ISNULL(ReferralPoints, 0) as CurrentPoints
                FROM Applicants
                WHERE ApplicantID = @param0
            `;
            const currentPointsResult = await dbService.executeQuery(currentPointsQuery, [applicantId]);
            const totalPoints = currentPointsResult.recordset?.[0]?.CurrentPoints || 0;

            // 🆕 ENHANCED: Get BOTH earned points AND conversion transactions
            const historyQuery = `
                -- Points earned from referrals
                SELECT 
                    rw.RewardID as ID,
                    'earned' as TransactionType,
                    rw.PointsEarned as PointsAmount,
                    rw.PointsType,
                    rw.AwardedAt as TransactionDate,
                    rr.JobID,
                    j.Title as JobTitle,
                    o.LogoURL as OrganizationLogo,
                    o.Name as CompanyName,
                    NULL as WalletAmount,
                    CASE 
                        WHEN rw.PointsType = 'proof_submission' THEN 'Referral proof submitted'
                        WHEN rw.PointsType = 'verification' THEN 'Referral verified by job seeker'
                        WHEN rw.PointsType = 'quick_response_bonus' THEN 'Quick response bonus (< 24 hours)'
                        ELSE 'Referral activity'
                    END as Description
                FROM ReferralRewards rw
                INNER JOIN ReferralRequests rr ON rw.RequestID = rr.RequestID
                LEFT JOIN Jobs j ON rr.JobID = j.JobID
                LEFT JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                WHERE rw.ReferrerID = @param0

                UNION ALL

                -- Points converted to wallet (only POINTS_CONVERSION, not REFERRAL_BONUS which is direct earnings)
                SELECT 
                    wt.TransactionID as ID,
                    'converted' as TransactionType,
                    ABS(wt.Amount / 0.5) as PointsAmount, -- Reverse calculation: ₹25 / 0.5 = 50 points
                    'conversion' as PointsType,
                    wt.CreatedAt as TransactionDate,
                    NULL as JobID,
                    NULL as JobTitle,
                    NULL as OrganizationLogo,
                    NULL as CompanyName,
                    wt.Amount as WalletAmount,
                    'Converted ' + CAST(CAST(ABS(wt.Amount / 0.5) AS INT) AS VARCHAR) + ' points to ₹' + CAST(wt.Amount AS VARCHAR) as Description
                FROM WalletTransactions wt
                INNER JOIN Wallets w ON wt.WalletID = w.WalletID
                INNER JOIN Applicants a ON w.UserID = a.UserID
                WHERE a.ApplicantID = @param0
                AND wt.Source = 'POINTS_CONVERSION'  -- Only actual point conversions, not direct referral earnings
                AND wt.Amount > 0  -- Credits only (conversions)

                ORDER BY TransactionDate DESC
            `;

            const result = await dbService.executeQuery(historyQuery, [applicantId]);
            
            // ✅ Return CURRENT available points (from Applicants table), not sum of history
            return {
                totalPoints, // This is the actual available balance after conversions
                history: result.recordset || [],
                // 🆕 ADD: Dynamic point type metadata (including conversion type)
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
     * NOW CONVERTS HOLD TO ACTUAL DEBIT when referral is completed
     */
    static async submitReferralWithProof(referrerId: string, userId: string, dto: SubmitReferralWithProofDto): Promise<ReferralRequest> {
        try {
            // Check if request is available - allow Pending OR Claimed (by same user for continue flow)
            const requestQuery = `
                SELECT RequestID, Status, JobID, ExtJobID, OrganizationID, ApplicantID, RequestedAt, AssignedReferrerID
                FROM ReferralRequests
                WHERE RequestID = @param0 AND Status IN ('Pending', 'Claimed', 'Viewed', 'NotifiedToReferrers')
            `;
            const requestResult = await dbService.executeQuery(requestQuery, [dto.requestID]);
            
            if (!requestResult.recordset || requestResult.recordset.length === 0) {
                throw new ValidationError('Request not available for claiming');
            }
            
            const request = requestResult.recordset[0];
            const { JobID: jobId, ExtJobID: extJobId, OrganizationID: organizationId, ApplicantID: seekerId, RequestedAt: requestedAt, Status: currentStatus, AssignedReferrerID: assignedReferrerId } = request;
            
            // If already claimed, only the same user can continue
            if (currentStatus === 'Claimed' && assignedReferrerId && assignedReferrerId !== userId) {
                throw new ValidationError('This request has already been claimed by another referrer');
            }
            
            // Determine referral type
            const isExternal = !!extJobId && !jobId;
            
            // Verify referrer is eligible (same organization, not the original requester)
            if (referrerId === seekerId) {
                throw new ValidationError('You cannot claim your own referral request');
            }
            
            // ✅ FIXED: Use type-specific eligibility check
            let eligibilityQuery: string;
            let eligibilityParams: any[];
            
            if (isExternal) {
                // External referral: Match by stored OrganizationID directly
                eligibilityQuery = `
                    SELECT we.OrganizationID
                    FROM WorkExperiences we
                    INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
                    WHERE a.ApplicantID = @param0 
                    AND we.OrganizationID = @param1
                    AND we.IsCurrent = 1
                `;
                eligibilityParams = [referrerId, organizationId];
            } else {
                // Internal referral: Match via Jobs table (existing logic)
                eligibilityQuery = `
                    SELECT we.OrganizationID
                    FROM WorkExperiences we
                    INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
                    INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
                    WHERE a.ApplicantID = @param0 AND we.IsCurrent = 1 AND j.JobID = @param1
                `;
                eligibilityParams = [referrerId, jobId];
            }
            
            const eligibilityResult = await dbService.executeQuery(eligibilityQuery, eligibilityParams);
            
            if (!eligibilityResult.recordset || eligibilityResult.recordset.length === 0) {
                throw new ValidationError('You are not eligible to refer for this job - must work at the same company');
            }
            
            // Get current time for quick response bonus calculation
            const referredAt = new Date().toISOString();
            
            // Claim the request and mark as completed with proof
            // AssignedReferrerID now stores UserID for easy frontend comparison
            const updateQuery = `
                UPDATE ReferralRequests
                SET Status = 'Completed', AssignedReferrerID = @param1, ReferredAt = @param2
                WHERE RequestID = @param0
            `;
            
            await dbService.executeQuery(updateQuery, [dto.requestID, userId, referredAt]);
            
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

            // ✅ NEW: Get referrer name for status history
            const referrerQuery = `SELECT u.FirstName + ' ' + u.LastName as ReferrerName FROM Applicants a INNER JOIN Users u ON a.UserID = u.UserID WHERE a.ApplicantID = @param0`;
            const referrerResult = await dbService.executeQuery(referrerQuery, [referrerId]);
            const referrerName = referrerResult.recordset?.[0]?.ReferrerName || 'Referrer';

            // ✅ NEW: Log ProofUploaded status
            try {
                await this.logStatusChange(
                    dto.requestID,
                    'ProofUploaded',
                    userId,
                    'referrer',
                    referrerName,
                    'Referral proof screenshot uploaded'
                );
            } catch (err) {
                console.warn('Non-critical: Failed to log ProofUploaded status:', err);
            }

            // ✅ NEW: Log Completed status
            try {
                await this.logStatusChange(
                    dto.requestID,
                    'Completed',
                    userId,
                    'referrer',
                    referrerName,
                    'Referral successfully submitted to company'
                );
            } catch (err) {
                console.warn('Non-critical: Failed to log Completed status:', err);
            }

            // ✅ HOLD-BASED PAYMENT: Convert hold to actual debit now that referral is completed
            // This is when the seeker actually gets charged
            try {
                const debitResult = await WalletService.convertHoldToDebit(dto.requestID);
                console.log(`Referral ${dto.requestID} completed - hold converted to debit: ₹${debitResult.Amount}`);
            } catch (holdErr: any) {
                // Log but don't fail the referral - hold might not exist for old requests
                console.warn(`Non-critical: Failed to convert hold for request ${dto.requestID}:`, holdErr?.message);
            }

            // ✅ Send email notification to seeker that referral was claimed/completed
            try {
                // Get seeker details
                const seekerQuery = `
                    SELECT u.UserID, u.Email, u.FirstName, u.LastName
                    FROM Applicants a
                    INNER JOIN Users u ON a.UserID = u.UserID
                    WHERE a.ApplicantID = @param0
                `;
                const seekerResult = await dbService.executeQuery(seekerQuery, [seekerId]);
                const seeker = seekerResult.recordset?.[0];

                // Get job/company details
                let jobTitle = 'Job Position';
                let companyName = 'Company';
                
                if (isExternal) {
                    const extQuery = `SELECT o.Name as CompanyName, rr.JobTitle FROM ReferralRequests rr LEFT JOIN Organizations o ON rr.OrganizationID = o.OrganizationID WHERE rr.RequestID = @param0`;
                    const extResult = await dbService.executeQuery(extQuery, [dto.requestID]);
                    jobTitle = extResult.recordset?.[0]?.JobTitle || 'External Job';
                    companyName = extResult.recordset?.[0]?.CompanyName || 'Company';
                } else {
                    const intQuery = `SELECT j.Title, o.Name as CompanyName FROM Jobs j INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID WHERE j.JobID = @param0`;
                    const intResult = await dbService.executeQuery(intQuery, [jobId]);
                    jobTitle = intResult.recordset?.[0]?.Title || 'Job Position';
                    companyName = intResult.recordset?.[0]?.CompanyName || 'Company';
                }

                if (seeker) {
                    await NotificationService.notifyReferralCompleted({
                        requestId: dto.requestID,
                        seekerId: seeker.UserID,
                        seekerName: seeker.FirstName,
                        seekerEmail: seeker.Email,
                        referrerName: `${companyName} Employee`,  // Keep referrer anonymous
                        jobTitle: jobTitle,
                        companyName: companyName
                    });
                }
            } catch (err) {
                console.warn('Non-critical: Failed to send referral claimed email:', err);
            }
            
            // Award points for proof submission with quick response bonus
            let baseProofPoints = 15; // Base points for submitting proof
            
            // Award base proof submission points first
            await this.awardReferralPoints(referrerId, dto.requestID, baseProofPoints, 'proof_submission');

            // Calculate and award quick response bonus separately for better tracking
            const requestedTime = new Date(requestedAt);
            const completedTime = new Date(referredAt);
            const hoursFromRequest = (completedTime.getTime() - requestedTime.getTime()) / (1000 * 60 * 60);
            
            if (hoursFromRequest <= 24) {
                const quickBonusPoints = 10; // Quick response bonus
                await this.awardReferralPoints(referrerId, dto.requestID, quickBonusPoints, 'quick_response_bonus');
            }
            
            // Update referrer stats
            await this.updateReferrerStats(referrerId);
            
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
            // Verify request belongs to applicant
            const selectQuery = `
                SELECT RequestID, JobID, Status, RequestedAt FROM ReferralRequests 
                WHERE RequestID = @param0 AND ApplicantID = @param1`;
            const result = await dbService.executeQuery(selectQuery, [requestId, applicantId]);
            if (!result.recordset || result.recordset.length === 0) {
                throw new ValidationError('Referral request not found');
            }
            const request = result.recordset[0];
            
            // Allow cancellation for any open status (not just Pending)
            const cancellableStatuses = ['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'];
            if (!cancellableStatuses.includes(request.Status)) {
                throw new ValidationError(`Cannot cancel request with status '${request.Status}'. Only open requests can be cancelled.`);
            }
            
            // Mark as cancelled
            await dbService.executeQuery(
                `UPDATE ReferralRequests SET Status = 'Cancelled' WHERE RequestID = @param0`,
                [requestId]
            );
            
            // ✅ HOLD-BASED PAYMENT: Tiered cancellation fees based on time since request
            // < 1 hour: ₹0 (grace period — builds trust, reduces support tickets)
            // 1-24 hours: ₹10 (request was visible to referrers, may have been viewed)
            // > 24 hours: ₹20 (referrer likely claimed & started working)
            const hoursElapsed = request.RequestedAt 
                ? (Date.now() - new Date(request.RequestedAt).getTime()) / (1000 * 60 * 60)
                : 999; // Fallback: treat missing timestamp as old request
            
            let cancellationFee: number;
            if (hoursElapsed < 1) {
                cancellationFee = 0;   // Grace period — free cancellation
            } else if (hoursElapsed <= 24) {
                cancellationFee = 10;  // Moderate fee
            } else {
                cancellationFee = 20;  // Higher fee — referrer may have started working
            }

            try {
                if (cancellationFee > 0) {
                    const releaseResult = await WalletService.releaseHoldWithDeduction(requestId, cancellationFee);
                    if (releaseResult.released) {
                        console.log(`Referral ${requestId} cancelled after ${hoursElapsed.toFixed(1)}hrs - hold released: ₹${releaseResult.amountReleased} (₹${cancellationFee} fee)`);
                    }
                } else {
                    // Grace period: release full hold, no fee
                    const releaseResult = await WalletService.releaseHold(requestId);
                    if (releaseResult.released) {
                        console.log(`Referral ${requestId} cancelled within grace period (${(hoursElapsed * 60).toFixed(0)}min) - full ₹${releaseResult.amount} released, no fee`);
                    }
                }
            } catch (holdErr: any) {
                // Log but don't fail - hold might not exist for old requests
                console.warn(`Non-critical: Failed to release hold for cancelled request ${requestId}:`, holdErr?.message);
            }
            
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

    /**
     * 🆕 NEW: Convert referral points to wallet balance
     * Conversion rate: 1 point = ₹0.50
     * Uses existing WalletService.creditBonus() to add money to wallet
     */
    static async convertPointsToWallet(applicantId: string, userId: string): Promise<{
        success: boolean;
        pointsConverted: number;
        walletAmount: number;
        newWalletBalance: number;
        transactionId: string;
    }> {
        try {
            // Get current referral points
            const pointsQuery = `
                SELECT ISNULL(ReferralPoints, 0) as CurrentPoints
                FROM Applicants
                WHERE ApplicantID = @param0
            `;
            const pointsResult = await dbService.executeQuery(pointsQuery, [applicantId]);
            
            if (!pointsResult.recordset || pointsResult.recordset.length === 0) {
                throw new NotFoundError('Applicant profile not found');
            }

            const currentPoints = pointsResult.recordset[0].CurrentPoints || 0;

            if (currentPoints <= 0) {
                throw new ValidationError('No referral points available to convert');
            }

            // Calculate wallet amount (1 point = ₹0.50)
            const CONVERSION_RATE = 0.5;
            const walletAmount = currentPoints * CONVERSION_RATE;

            // Credit wallet using existing WalletService.creditBonus method
            const creditResult = await WalletService.creditBonus(
                userId,
                walletAmount,
                'POINTS_CONVERSION',  // Points conversion - also withdrawable
                `Converted ${currentPoints} referral points to wallet balance`
            );

            if (!creditResult.success) {
                throw new Error('Failed to credit wallet');
            }

            // Reset referral points to 0
            const resetQuery = `
                UPDATE Applicants
                SET ReferralPoints = 0
                WHERE ApplicantID = @param0
            `;
            await dbService.executeQuery(resetQuery, [applicantId]);

            return {
                success: true,
                pointsConverted: currentPoints,
                walletAmount: walletAmount,
                newWalletBalance: creditResult.newBalance,
                transactionId: creditResult.transactionId
            };
        } catch (error) {
            console.error('Error converting points to wallet:', error);
            throw error;
        }
    }

    // ===== STATUS HISTORY TRACKING =====

    /**
     * Log a status change to the history table for tracking
     * Also updates the main ReferralRequests table status (with protection for Claimed status)
     */
    static async logStatusChange(
        requestId: string,
        status: string,
        actorId?: string,
        actorType?: 'system' | 'seeker' | 'referrer',
        actorName?: string,
        statusMessage?: string
    ): Promise<{ success: boolean; historyId: string }> {
        try {
            const historyId = AuthService.generateUniqueId();
            
            // Get current status first to check if we should update
            const currentStatusQuery = `SELECT Status FROM ReferralRequests WHERE RequestID = @param0`;
            const currentResult = await dbService.executeQuery(currentStatusQuery, [requestId]);
            const currentStatus = currentResult.recordset?.[0]?.Status;
            
            // Status protection rules:
            // 1. "Viewed" only updates once (from Pending/NotifiedToReferrers)
            // 2. "Claimed" should not downgrade to "Viewed"
            // 3. Any status at "Claimed" or beyond should not go back to "Viewed"
            const protectedStatuses = ['Viewed', 'Claimed', 'ProofUploaded', 'Completed', 'Verified'];
            const shouldUpdateStatus = !(status === 'Viewed' && protectedStatuses.includes(currentStatus));
            
            if (shouldUpdateStatus) {
                // Update the main ReferralRequests table status
                // If status is 'Claimed' and actorType is 'referrer', set AssignedReferrerID (stores UserID)
                let updateMainQuery: string;
                let updateParams: any[];
                
                if (status === 'Claimed' && actorType === 'referrer' && actorId) {
                    updateMainQuery = `
                        UPDATE ReferralRequests 
                        SET Status = @param0, AssignedReferrerID = @param1, ReferredAt = GETUTCDATE()
                        WHERE RequestID = @param2
                    `;
                    updateParams = [status, actorId, requestId];
                } else {
                    updateMainQuery = `
                        UPDATE ReferralRequests 
                        SET Status = @param0
                        WHERE RequestID = @param1
                    `;
                    updateParams = [status, requestId];
                }
                await dbService.executeQuery(updateMainQuery, updateParams);
            }
            
            // Always insert into history table (logs the view even if status not updated)
            const insertQuery = `
                INSERT INTO ReferralRequestStatusHistory (
                    HistoryID, RequestID, Status, StatusMessage, ActorID, ActorType, ActorName, CreatedAt
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4, @param5, @param6, GETUTCDATE()
                )
            `;
            
            await dbService.executeQuery(insertQuery, [
                historyId,
                requestId,
                status,
                statusMessage || null,
                actorId || null,
                actorType || 'system',
                actorName || null
            ]);
            
            return { success: true, historyId };
        } catch (error) {
            console.error('Error logging status change:', error);
            throw error;
        }
    }

    /**
     * Get complete status history for a referral request
     * Also returns full request details for the tracking screen
     */
    static async getStatusHistory(requestId: string): Promise<{
        requestId: string;
        currentStatus: string;
        request: any;
        history: Array<{
            historyId: string;
            status: string;
            statusMessage?: string;
            actorId?: string;
            actorName?: string;
            actorType?: string;
            createdAt: Date;
        }>;
        referrerUserIds: string[];
    }> {
        try {
            // Get full request details
            const requestQuery = `
                SELECT 
                    rr.RequestID,
                    rr.ApplicantID,
                    rr.Status,
                    rr.RequestedAt,
                    rr.AssignedReferrerID as AssignedReferrerUserID,
                    rr.OrganizationID,
                    rr.JobID,
                    rr.ExtJobID,
                    rr.JobTitle as StoredJobTitle,
                    rr.JobURL as StoredJobURL,
                    rr.ReferralMessage,
                    j.Title as InternalJobTitle,
                    COALESCE(jo.Name, eo.Name) as CompanyName,
                    COALESCE(jo.LogoURL, eo.LogoURL) as OrganizationLogo,
                    u.FirstName + ' ' + u.LastName as AssignedReferrerName
                FROM ReferralRequests rr
                LEFT JOIN Jobs j ON j.JobID = rr.JobID
                LEFT JOIN Organizations jo ON jo.OrganizationID = j.OrganizationID
                LEFT JOIN Organizations eo ON eo.OrganizationID = rr.OrganizationID AND rr.ExtJobID IS NOT NULL
                LEFT JOIN Users u ON u.UserID = rr.AssignedReferrerID
                WHERE rr.RequestID = @param0
            `;
            const requestResult = await dbService.executeQuery(requestQuery, [requestId]);
            
            if (!requestResult.recordset || requestResult.recordset.length === 0) {
                throw new NotFoundError('Referral request not found');
            }

            const row = requestResult.recordset[0];
            const currentStatus = row.Status;
            
            // Build request object with proper fallbacks for external jobs
            const requestData = {
                RequestID: row.RequestID,
                ApplicantID: row.ApplicantID,
                Status: row.Status,
                RequestedAt: row.RequestedAt,
                AssignedReferrerUserID: row.AssignedReferrerUserID,
                AssignedReferrerName: row.AssignedReferrerName,
                OrganizationID: row.OrganizationID,
                JobID: row.JobID,
                ExtJobID: row.ExtJobID,
                JobTitle: row.InternalJobTitle || row.StoredJobTitle || 'Job Title',
                JobURL: row.StoredJobURL, // JobURL is only in ReferralRequests table
                CompanyName: row.CompanyName || 'Company',
                OrganizationLogo: row.OrganizationLogo,
                ReferralMessage: row.ReferralMessage || null,
            };

            // Get history with ActorID for referrers
            const historyQuery = `
                SELECT HistoryID, Status, StatusMessage, ActorID, ActorName, ActorType, CreatedAt
                FROM ReferralRequestStatusHistory
                WHERE RequestID = @param0
                ORDER BY CreatedAt ASC
            `;
            
            const historyResult = await dbService.executeQuery(historyQuery, [requestId]);
            
            const history = (historyResult.recordset || []).map((row: any) => ({
                historyId: row.HistoryID,
                status: row.Status,
                statusMessage: row.StatusMessage,
                actorId: row.ActorID,
                actorName: row.ActorName,
                actorType: row.ActorType,
                createdAt: row.CreatedAt
            }));

            // Get unique referrer UserIDs from history (actors with type 'referrer')
            const referrerUserIds = [...new Set(
                history
                    .filter((h: any) => h.actorType === 'referrer' && h.actorId)
                    .map((h: any) => h.actorId)
            )];

            return {
                requestId,
                currentStatus,
                request: requestData,
                history,
                referrerUserIds // List of all referrers who interacted with this request
            };
        } catch (error) {
            console.error('Error getting status history:', error);
            throw error;
        }
    }

    /**
     * Auto-log initial status when request is created
     */
    static async logInitialStatus(requestId: string, seekerName: string, isOpenToAny: boolean = false): Promise<void> {
        try {
            // Log Pending status
            await this.logStatusChange(
                requestId,
                'Pending',
                undefined,
                'system',
                undefined,
                'Referral request created'
            );

            // Immediately log NotifiedToReferrers
            await this.logStatusChange(
                requestId,
                'NotifiedToReferrers',
                undefined,
                'system',
                undefined,
                isOpenToAny
                    ? 'Your request is live and visible to all referrers'
                    : 'Request is now visible to employees at this company'
            );
        } catch (error) {
            console.warn('Failed to log initial status:', error);
            // Don't throw - this is non-critical
        }
    }
}