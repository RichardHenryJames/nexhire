/**
 * Social Share Repository — Single source of truth for SocialShareClaims table queries.
 *
 * WHY THIS EXISTS:
 *  - Separates data-access from business/wallet logic in socialShare.service.ts
 *  - ~12 SQL queries consolidated
 *
 * RULES:
 *  1. Only this repository should write raw SocialShareClaims SQL.
 *  2. Services call repository methods — never dbService directly for this table.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class SocialShareRepository {

    // ── PricingSettings (reward amounts) ────────────────────────

    /**
     * Fetch social-share reward settings from PricingSettings.
     */
    static async getRewardSettings(): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT SettingKey, SettingValue 
            FROM PricingSettings 
            WHERE SettingKey LIKE 'SOCIAL_SHARE_%' AND IsActive = 1
        `);
        return result.recordset;
    }

    // ── Claims — lookups ────────────────────────────────────────

    /**
     * Find pending or approved claims for a user + platform (for submit-eligibility check).
     */
    static async findActiveClaimsByPlatform(userId: string, platform: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT ClaimID, Status, CreatedAt, RewardAmount
            FROM SocialShareClaims
            WHERE UserID = @param0 
              AND Platform = @param1
              AND Status IN ('Pending', 'Approved')
            ORDER BY CreatedAt DESC
        `, [userId, platform]);
        return result.recordset;
    }

    /**
     * Find rejected claims for a user + platform (user can resubmit).
     */
    static async findRejectedClaimsByPlatform(userId: string, platform: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT ClaimID, Status, CreatedAt, RewardAmount, RejectionReason, ReviewedAt
            FROM SocialShareClaims
            WHERE UserID = @param0 
              AND Platform = @param1
              AND Status = 'Rejected'
            ORDER BY CreatedAt DESC
        `, [userId, platform]);
        return result.recordset;
    }

    /**
     * Find a claim by ID.
     */
    static async findById(claimId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT ClaimID, UserID, Platform, RewardAmount, Status
            FROM SocialShareClaims
            WHERE ClaimID = @param0
        `, [claimId]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Find a claim's status only (lightweight check).
     */
    static async findStatusById(claimId: string): Promise<{ ClaimID: string; Status: string } | null> {
        const result = await dbService.executeQuery(`
            SELECT ClaimID, Status FROM SocialShareClaims WHERE ClaimID = @param0
        `, [claimId]);
        return result.recordset?.[0] ?? null;
    }

    // ── Claims — mutations ──────────────────────────────────────

    /**
     * Insert a new social share claim with Pending status.
     */
    static async insertClaim(
        claimId: string,
        userId: string,
        platform: string,
        postUrl: string | null,
        screenshotUrl: string,
        postContent: string | null,
        rewardAmount: number
    ): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO SocialShareClaims (
                ClaimID, UserID, Platform, PostURL, ScreenshotURL, PostContent, 
                RewardAmount, Status, CreatedAt, UpdatedAt
            ) VALUES (
                @param0, @param1, @param2, @param3, @param4, @param5,
                @param6, 'Pending', GETUTCDATE(), GETUTCDATE()
            )
        `, [claimId, userId, platform, postUrl, screenshotUrl, postContent, rewardAmount]);
    }

    /**
     * Approve a claim — set Status, BonusAmount, ReviewedBy.
     */
    static async approveClaim(claimId: string, bonusAmount: number, adminUserId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE SocialShareClaims
            SET Status = 'Approved',
                BonusAmount = @param1,
                ReviewedBy = @param2,
                ReviewedAt = GETUTCDATE(),
                UpdatedAt = GETUTCDATE()
            WHERE ClaimID = @param0
        `, [claimId, bonusAmount, adminUserId]);
    }

    /**
     * Reject a claim — set Status, RejectionReason, ReviewedBy.
     */
    static async rejectClaim(claimId: string, reason: string, adminUserId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE SocialShareClaims
            SET Status = 'Rejected',
                RejectionReason = @param1,
                ReviewedBy = @param2,
                ReviewedAt = GETUTCDATE(),
                UpdatedAt = GETUTCDATE()
            WHERE ClaimID = @param0
        `, [claimId, reason, adminUserId]);
    }

    // ── Claims — lists ──────────────────────────────────────────

    /**
     * Get all claims for a user (ordered by newest first).
     */
    static async findByUser(userId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT 
                ClaimID, UserID, Platform, PostURL, ScreenshotURL, PostContent,
                RewardAmount, BonusAmount, Status, RejectionReason,
                ReviewedAt, CreatedAt, UpdatedAt
            FROM SocialShareClaims
            WHERE UserID = @param0
            ORDER BY CreatedAt DESC
        `, [userId]);
        return result.recordset;
    }

    /**
     * Get all pending claims (admin review queue).
     */
    static async findPending(): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT 
                s.ClaimID, s.UserID, s.Platform, s.PostURL, s.ScreenshotURL, s.PostContent,
                s.RewardAmount, s.BonusAmount, s.Status, s.CreatedAt,
                u.FirstName, u.LastName, u.Email, u.ProfilePictureURL
            FROM SocialShareClaims s
            JOIN Users u ON s.UserID = u.UserID
            WHERE s.Status = 'Pending'
            ORDER BY s.CreatedAt ASC
        `);
        return result.recordset;
    }

    /**
     * Get all claims for admin with filters + pagination.
     */
    static async findAllFiltered(
        filters: { status?: string; platform?: string },
        offset: number,
        pageSize: number
    ): Promise<{ claims: any[]; total: number }> {
        const conditions: string[] = [];
        const params: any[] = [];
        let idx = 0;

        if (filters.status && filters.status !== 'all') {
            conditions.push(`s.Status = @param${idx}`);
            params.push(filters.status);
            idx++;
        }
        if (filters.platform && filters.platform !== 'all') {
            conditions.push(`s.Platform = @param${idx}`);
            params.push(filters.platform);
            idx++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await dbService.executeQuery(
            `SELECT COUNT(*) as total FROM SocialShareClaims s ${where}`,
            params
        );

        const mainParams = [...params, offset, pageSize];
        const result = await dbService.executeQuery(`
            SELECT 
                s.ClaimID, s.UserID, s.Platform, s.PostURL, s.ScreenshotURL, s.PostContent,
                s.RewardAmount, s.BonusAmount, s.Status, s.RejectionReason,
                s.ReviewedBy, s.ReviewedAt, s.CreatedAt, s.UpdatedAt,
                u.FirstName, u.LastName, u.Email, u.ProfilePictureURL,
                r.FirstName as ReviewerFirstName, r.LastName as ReviewerLastName
            FROM SocialShareClaims s
            JOIN Users u ON s.UserID = u.UserID
            LEFT JOIN Users r ON s.ReviewedBy = r.UserID
            ${where}
            ORDER BY s.CreatedAt DESC
            OFFSET @param${idx} ROWS FETCH NEXT @param${idx + 1} ROWS ONLY
        `, mainParams);

        return {
            claims: result.recordset,
            total: countResult.recordset[0].total
        };
    }

    // ── Stats ───────────────────────────────────────────────────

    /**
     * Get global claim stats (pending/approved/rejected counts).
     */
    static async getGlobalStats(): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT 
                SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN Status = 'Approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) as rejected
            FROM SocialShareClaims
        `, []);
        return result.recordset[0] || { pending: 0, approved: 0, rejected: 0 };
    }

    /**
     * Get detailed social share stats (totals + per-platform).
     */
    static async getDetailedStats(): Promise<{ summary: any; platformStats: any[] }> {
        const [summaryResult, platformResult] = await Promise.all([
            dbService.executeQuery(`
                SELECT 
                    COUNT(*) as TotalClaims,
                    SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as PendingClaims,
                    SUM(CASE WHEN Status = 'Approved' THEN 1 ELSE 0 END) as ApprovedClaims,
                    SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) as RejectedClaims,
                    SUM(CASE WHEN Status = 'Approved' THEN RewardAmount + BonusAmount ELSE 0 END) as TotalRewarded,
                    COUNT(DISTINCT UserID) as UniqueUsers,
                    COUNT(DISTINCT CASE WHEN Status = 'Approved' THEN UserID END) as UsersRewarded
                FROM SocialShareClaims
            `),
            dbService.executeQuery(`
                SELECT 
                    Platform,
                    COUNT(*) as TotalClaims,
                    SUM(CASE WHEN Status = 'Approved' THEN 1 ELSE 0 END) as ApprovedClaims,
                    SUM(CASE WHEN Status = 'Approved' THEN RewardAmount + BonusAmount ELSE 0 END) as TotalRewarded
                FROM SocialShareClaims
                GROUP BY Platform
                ORDER BY TotalClaims DESC
            `)
        ]);

        return {
            summary: summaryResult.recordset[0],
            platformStats: platformResult.recordset
        };
    }
}
