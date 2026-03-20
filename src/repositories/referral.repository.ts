/**
 * Referral Repository — Single source of truth for referral-related table queries.
 *
 * Tables covered: ReferralRequests, ReferralProofs, ReferralRewards,
 *   ReferrerStats, ReferralRequestStatusHistory, ApplicantReferralSubscriptions
 *
 * WHY THIS EXISTS:
 *  - referral.service.ts had 83+ SQL queries across 2,392 lines
 *  - This extracts standalone/reusable queries while keeping deeply
 *    intertwined business-flow queries in the service
 *
 * RULES:
 *  1. Standalone CRUD queries go here.
 *  2. Complex multi-step flows with sequential SQL dependencies stay in service.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class ReferralRepository {

    // ═══════════════════════════════════════════════════════════
    //  REFERRAL PLANS & SUBSCRIPTIONS
    // ═══════════════════════════════════════════════════════════

    /** Find a referral plan by ID. */
    static async findPlanById(planId: number): Promise<any | null> {
        const result = await dbService.executeQuery(
            `SELECT PlanID, Name, ReferralsPerDay, DurationDays, Price FROM ReferralPlans WHERE PlanID = @param0`,
            [planId]
        );
        return result.recordset?.[0] ?? null;
    }

    /** Deactivate all subscriptions for an applicant. */
    static async deactivateSubscriptions(applicantId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE ApplicantReferralSubscriptions SET IsActive = 0 WHERE ApplicantID = @param0`,
            [applicantId]
        );
    }

    /** Insert a new subscription. */
    static async insertSubscription(subscriptionId: string, applicantId: string, planId: number, startDate: string, endDate: string): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ApplicantReferralSubscriptions (SubscriptionID, ApplicantID, PlanID, StartDate, EndDate, IsActive)
            VALUES (@param0, @param1, @param2, @param3, @param4, 1)
        `, [subscriptionId, applicantId, planId, startDate, endDate]);
    }

    /** Get current active subscription with plan details. */
    static async findActiveSubscription(applicantId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT s.SubscriptionID, s.ApplicantID, s.PlanID, s.StartDate, s.EndDate, s.IsActive,
                p.Name as PlanName, p.ReferralsPerDay
            FROM ApplicantReferralSubscriptions s
            INNER JOIN ReferralPlans p ON s.PlanID = p.PlanID
            WHERE s.ApplicantID = @param0 AND s.IsActive = 1 AND s.EndDate > GETUTCDATE()
            ORDER BY s.StartDate DESC
        `, [applicantId]);
        return result.recordset?.[0] ?? null;
    }

    // ═══════════════════════════════════════════════════════════
    //  ORGANIZATION TIER LOOKUPS
    // ═══════════════════════════════════════════════════════════

    /** Get org tier by organization ID. */
    static async getOrgTier(orgId: number): Promise<string> {
        const result = await dbService.executeQuery(
            `SELECT ISNULL(Tier, 'Standard') as Tier FROM Organizations WHERE OrganizationID = @param0`,
            [orgId]
        );
        return result.recordset?.[0]?.Tier || 'Standard';
    }

    /** Get org tier via job's organization. */
    static async getOrgTierByJobId(jobId: string): Promise<string> {
        const result = await dbService.executeQuery(
            `SELECT ISNULL(o.Tier, 'Standard') as Tier FROM Jobs j INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID WHERE j.JobID = @param0`,
            [jobId]
        );
        return result.recordset?.[0]?.Tier || 'Standard';
    }

    /** Get org name by ID. */
    static async getOrgName(orgId: number): Promise<string> {
        const result = await dbService.executeQuery(
            `SELECT Name FROM Organizations WHERE OrganizationID = @param0`,
            [orgId]
        );
        return result.recordset?.[0]?.Name || 'a company';
    }

    // ═══════════════════════════════════════════════════════════
    //  REFERRAL REQUESTS — LOOKUPS
    // ═══════════════════════════════════════════════════════════

    /** Get UserID from ApplicantID. */
    static async getUserIdFromApplicant(applicantId: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT UserID FROM Applicants WHERE ApplicantID = @param0`,
            [applicantId]
        );
        return result.recordset?.[0]?.UserID ?? null;
    }

    /** Check for existing external referral request. */
    static async findExistingExternalRequest(applicantId: string, extJobId: string): Promise<boolean> {
        const result = await dbService.executeQuery(
            `SELECT RequestID FROM ReferralRequests WHERE ApplicantID = @param0 AND ExtJobID = @param1 AND Status NOT IN ('Cancelled', 'Expired')`,
            [applicantId, extJobId]
        );
        return (result.recordset?.length ?? 0) > 0;
    }

    /** Check for existing internal referral request. */
    static async findExistingInternalRequest(jobId: string, applicantId: string): Promise<boolean> {
        const result = await dbService.executeQuery(
            `SELECT RequestID FROM ReferralRequests WHERE JobID = @param0 AND ApplicantID = @param1 AND Status NOT IN ('Cancelled', 'Expired')`,
            [jobId, applicantId]
        );
        return (result.recordset?.length ?? 0) > 0;
    }

    /** Check if a job exists and is published. Returns job details. */
    static async findJobForReferral(jobId: string): Promise<any | null> {
        const result = await dbService.executeQuery(
            `SELECT JobID, Status, OrganizationID, Title FROM Jobs WHERE JobID = @param0`,
            [jobId]
        );
        return result.recordset?.[0] ?? null;
    }

    /** Verify resume ownership. */
    static async verifyResumeOwnership(resumeId: string, applicantId: string): Promise<boolean> {
        const result = await dbService.executeQuery(`
            SELECT ar.ResumeID FROM ApplicantResumes ar
            INNER JOIN Applicants a ON ar.ApplicantID = a.ApplicantID
            WHERE ar.ResumeID = @param0 AND a.ApplicantID = @param1
        `, [resumeId, applicantId]);
        return (result.recordset?.length ?? 0) > 0;
    }

    /** Get referrer's current organization ID. */
    static async getReferrerOrgId(referrerId: string): Promise<number | null> {
        const result = await dbService.executeQuery(`
            SELECT we.OrganizationID FROM WorkExperiences we
            INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
            WHERE a.ApplicantID = @param0 AND we.IsCurrent = 1 AND we.IsActive = 1
        `, [referrerId]);
        return result.recordset?.[0]?.OrganizationID ?? null;
    }

    // ═══════════════════════════════════════════════════════════
    //  REFERRAL REQUESTS — MUTATIONS
    // ═══════════════════════════════════════════════════════════

    /** Insert external referral request. */
    static async insertExternalRequest(params: any[]): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ReferralRequests (
                RequestID, ExtJobID, ApplicantID, ResumeID, Status, RequestedAt, ExpiryTime,
                OrganizationID, ReferralMessage, JobTitle, JobURL,
                OpenToAnyCompany, MinSalary, SalaryCurrency, SalaryPeriod, PreferredLocations
            ) VALUES (
                @param0, @param1, @param2, @param3, 'Pending', GETUTCDATE(), DATEADD(DAY, 14, GETUTCDATE()),
                @param4, @param5, @param6, @param7,
                @param8, @param9, @param10, @param11, @param12
            )
        `, params);
    }

    /** Insert internal referral request. */
    static async insertInternalRequest(params: any[]): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ReferralRequests (
                RequestID, JobID, ApplicantID, ResumeID, Status, RequestedAt, ExpiryTime, ReferralMessage, OrganizationID, JobTitle
            ) VALUES (
                @param0, @param1, @param2, @param3, 'Pending', GETUTCDATE(), DATEADD(DAY, 14, GETUTCDATE()), @param4, @param5, @param6
            )
        `, params);
    }

    /** Update referral request status. */
    static async updateRequestStatus(requestId: string, status: string, verified?: number): Promise<void> {
        if (verified !== undefined) {
            await dbService.executeQuery(
                `UPDATE ReferralRequests SET Status = @param1, VerifiedByApplicant = @param2 WHERE RequestID = @param0`,
                [requestId, status, verified]
            );
        } else {
            await dbService.executeQuery(
                `UPDATE ReferralRequests SET Status = @param1 WHERE RequestID = @param0`,
                [requestId, status]
            );
        }
    }

    /** Claim a referral request (assign referrer). */
    static async claimRequest(requestId: string, referrerId: string, referredAt: Date): Promise<void> {
        await dbService.executeQuery(`
            UPDATE ReferralRequests SET AssignedReferrerID = @param1, ReferredAt = @param2, Status = 'Claimed'
            WHERE RequestID = @param0
        `, [requestId, referrerId, referredAt]);
    }

    // ═══════════════════════════════════════════════════════════
    //  REFERRAL PROOFS
    // ═══════════════════════════════════════════════════════════

    /** Insert a referral proof. */
    static async insertProof(params: any[]): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ReferralProofs (
                ProofID, RequestID, ReferrerID, FileURL, FileType, Description, SubmittedAt
            ) VALUES (@param0, @param1, @param2, @param3, @param4, @param5, GETUTCDATE())
        `, params);
    }

    // ═══════════════════════════════════════════════════════════
    //  STATUS HISTORY
    // ═══════════════════════════════════════════════════════════

    /** Insert a status history entry. */
    static async insertStatusHistory(params: {
        historyId: string;
        requestId: string;
        status: string;
        message: string;
        actorId: string;
        actorType: string;
        actorName: string;
    }): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ReferralRequestStatusHistory (
                HistoryID, RequestID, Status, StatusMessage, ActorID, ActorType, ActorName, CreatedAt
            ) VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6, GETUTCDATE())
        `, [params.historyId, params.requestId, params.status, params.message, params.actorId, params.actorType, params.actorName]);
    }

    /** Get status history for a request. */
    static async findStatusHistory(requestId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT HistoryID, RequestID, Status, StatusMessage, ActorID, ActorType, ActorName, CreatedAt
            FROM ReferralRequestStatusHistory
            WHERE RequestID = @param0
            ORDER BY CreatedAt ASC
        `, [requestId]);
        return result.recordset || [];
    }

    // ═══════════════════════════════════════════════════════════
    //  REFERRAL REWARDS & POINTS
    // ═══════════════════════════════════════════════════════════

    /** Resolve a UserID or ApplicantID to an ApplicantID. */
    static async resolveApplicantId(idOrUserId: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT ApplicantID FROM Applicants WHERE ApplicantID = @param0 OR UserID = @param0`,
            [idOrUserId]
        );
        return result.recordset?.[0]?.ApplicantID ?? null;
    }

    /** Check if a reward already exists for a given type. */
    static async rewardExists(applicantId: string, requestId: string, pointType: string): Promise<boolean> {
        const result = await dbService.executeQuery(
            `SELECT RewardID FROM ReferralRewards WHERE ReferrerID = @param0 AND RequestID = @param1 AND PointsType = @param2`,
            [applicantId, requestId, pointType]
        );
        return (result.recordset?.length ?? 0) > 0;
    }

    /** Check if a milestone reward was already given this month. */
    static async milestoneAwardedThisMonth(applicantId: string, milestoneType: string): Promise<boolean> {
        const result = await dbService.executeQuery(`
            SELECT RewardID FROM ReferralRewards
            WHERE ReferrerID = @param0 AND PointsType = @param1
                AND MONTH(AwardedAt) = MONTH(GETUTCDATE()) AND YEAR(AwardedAt) = YEAR(GETUTCDATE())
        `, [applicantId, milestoneType]);
        return (result.recordset?.length ?? 0) > 0;
    }

    /** Insert a reward record. */
    static async insertReward(rewardId: string, applicantId: string, requestId: string, points: number, pointType: string): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ReferralRewards (RewardID, ReferrerID, RequestID, PointsEarned, PointsType, AwardedAt)
            VALUES (@param0, @param1, @param2, @param3, @param4, GETUTCDATE())
        `, [rewardId, applicantId, requestId, points, pointType]);
    }

    /** Increment referral points on Applicants. */
    static async incrementPoints(applicantId: string, points: number): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET ReferralPoints = ISNULL(ReferralPoints, 0) + @param1 WHERE ApplicantID = @param0`,
            [applicantId, points]
        );
    }

    /** Get current referral points. */
    static async getPoints(applicantId: string): Promise<number> {
        const result = await dbService.executeQuery(
            `SELECT ISNULL(ReferralPoints, 0) as CurrentPoints FROM Applicants WHERE ApplicantID = @param0`,
            [applicantId]
        );
        return result.recordset?.[0]?.CurrentPoints || 0;
    }

    /** Reset referral points to zero. */
    static async resetPoints(applicantId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET ReferralPoints = 0, UpdatedAt = GETUTCDATE() WHERE ApplicantID = @param0`,
            [applicantId]
        );
    }

    /** Count verified referrals this month for a referrer. */
    static async countVerifiedThisMonth(referrerId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as VerifiedThisMonth FROM ReferralRequests
            WHERE AssignedReferrerID = @param0 AND Status = 'Verified'
                AND MONTH(ReferredAt) = MONTH(GETUTCDATE()) AND YEAR(ReferredAt) = YEAR(GETUTCDATE())
        `, [referrerId]);
        return result.recordset?.[0]?.VerifiedThisMonth || 0;
    }

    /** Count today's referral usage for an applicant. */
    static async countTodayUsage(applicantId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as Usage FROM ReferralRequests
            WHERE ApplicantID = @param0 AND CAST(RequestedAt AS DATE) = CAST(GETUTCDATE() AS DATE)
        `, [applicantId]);
        return result.recordset?.[0]?.Usage || 0;
    }

    // ═══════════════════════════════════════════════════════════
    //  REFERRER STATS
    // ═══════════════════════════════════════════════════════════

    /** Update referrer stats for a new request (by job ID). */
    static async updateStatsForNewRequest(jobId: string): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ReferrerStats (ReferrerID, PendingCount, LastUpdated)
            SELECT DISTINCT a.ApplicantID, 1, GETUTCDATE()
            FROM Applicants a
            INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
            INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
            WHERE j.JobID = @param0 AND we.IsCurrent = 1 AND a.OpenToRefer = 1
            AND NOT EXISTS (SELECT 1 FROM ReferrerStats rs WHERE rs.ReferrerID = a.ApplicantID)

            UPDATE rs SET PendingCount = PendingCount + 1, LastUpdated = GETUTCDATE()
            FROM ReferrerStats rs
            INNER JOIN Applicants a ON rs.ReferrerID = a.ApplicantID
            INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
            INNER JOIN Jobs j ON j.OrganizationID = we.OrganizationID
            WHERE j.JobID = @param0 AND we.IsCurrent = 1 AND a.OpenToRefer = 1
        `, [jobId]);
    }

    /** Update referrer stats for external request by company name. */
    static async updateStatsForExternalByName(companyName: string): Promise<void> {
        await dbService.executeQuery(`
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
            AND a.OpenToRefer = 1
        `, [companyName]);
    }

    /** Update referrer stats for external request by org ID. */
    static async updateStatsForExternalByOrgId(orgId: number): Promise<void> {
        await dbService.executeQuery(`
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
            WHERE we.OrganizationID = @param0 AND we.IsCurrent = 1 AND a.OpenToRefer = 1
        `, [orgId]);
    }

    /** MERGE referrer stats recalculation. */
    static async mergeReferrerStats(referrerId: string): Promise<void> {
        await dbService.executeQuery(`
            MERGE ReferrerStats rs
            USING (
                SELECT @param0 as ReferrerID,
                    COUNT(*) as PendingCount
                FROM ReferralRequests rr
                INNER JOIN Jobs j ON rr.JobID = j.JobID
                INNER JOIN WorkExperiences we ON j.OrganizationID = we.OrganizationID
                INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
                WHERE a.ApplicantID = @param0 AND rr.Status = 'Pending' AND we.IsCurrent = 1
            ) src ON rs.ReferrerID = src.ReferrerID
            WHEN MATCHED THEN UPDATE SET PendingCount = src.PendingCount, LastUpdated = GETUTCDATE()
            WHEN NOT MATCHED THEN INSERT (ReferrerID, PendingCount, LastUpdated) VALUES (src.ReferrerID, src.PendingCount, GETUTCDATE());
        `, [referrerId]);
    }

    /** Decrement pending count for a referrer. */
    static async decrementPendingCount(referrerId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE ReferrerStats
            SET PendingCount = CASE WHEN PendingCount > 0 THEN PendingCount - 1 ELSE 0 END, LastUpdated = GETUTCDATE()
            WHERE ReferrerID = @param0
        `, [referrerId]);
    }

    // ═══════════════════════════════════════════════════════════
    //  USER/APPLICANT LOOKUPS (used throughout referral flows)
    // ═══════════════════════════════════════════════════════════

    /** Get user name from UserID. */
    static async getUserName(userId: string): Promise<string> {
        const result = await dbService.executeQuery(
            `SELECT FirstName, LastName FROM Users WHERE UserID = @param0`,
            [userId]
        );
        const row = result.recordset?.[0];
        return row ? `${row.FirstName} ${row.LastName}` : 'Unknown';
    }

    /** Get user details (UserID, Email, FirstName, LastName). */
    static async getUserDetails(userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(
            `SELECT UserID, Email, FirstName, LastName FROM Users WHERE UserID = @param0`,
            [userId]
        );
        return result.recordset?.[0] ?? null;
    }

    /** Get applicant name from ApplicantID. */
    static async getApplicantName(applicantId: string): Promise<string> {
        const result = await dbService.executeQuery(`
            SELECT u.FirstName, u.LastName FROM Users u
            JOIN Applicants a ON a.UserID = u.UserID WHERE a.ApplicantID = @param0
        `, [applicantId]);
        const row = result.recordset?.[0];
        return row ? `${row.FirstName} ${row.LastName}` : 'Job Seeker';
    }

    /** Get UserType for a user. */
    static async getUserType(userId: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT UserType FROM Users WHERE UserID = @param0`,
            [userId]
        );
        return result.recordset?.[0]?.UserType ?? null;
    }

    // ═══════════════════════════════════════════════════════════
    //  GENERIC QUERY EXECUTION (for complex dynamic queries)
    // ═══════════════════════════════════════════════════════════

    /** Execute a query and return recordset. */
    static async query(sql: string, params: any[]): Promise<any[]> {
        const result = await dbService.executeQuery(sql, params);
        return result.recordset || [];
    }

    /** Execute a query and return first row. */
    static async queryOne(sql: string, params: any[]): Promise<any | null> {
        const result = await dbService.executeQuery(sql, params);
        return result.recordset?.[0] ?? null;
    }

    /** Execute a mutation (INSERT/UPDATE/DELETE). */
    static async execute(sql: string, params: any[]): Promise<void> {
        await dbService.executeQuery(sql, params);
    }

    /**
     * Raw query — returns the full mssql result object (with .recordset, .rowsAffected).
     * Use this for complex flow queries that need the raw result shape.
     * Prefer query()/queryOne()/execute() for new code.
     */
    static async rawQuery<T = any>(sql: string, params: any[]): Promise<any> {
        return dbService.executeQuery<T>(sql, params);
    }
}
