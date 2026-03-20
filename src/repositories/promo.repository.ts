/**
 * Promo Repository — Single source of truth for PromoCodes, PromoCodeUsages, WalletBonusPacks queries.
 *
 * WHY THIS EXISTS:
 *  - Separates data-access from validation/business logic in promo.service.ts
 *  - 8 SQL queries consolidated
 *
 * RULES:
 *  1. Only this repository should write raw SQL for these tables.
 *  2. Services call repository methods — never dbService directly.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class PromoRepository {

    // ── PromoCodes ──────────────────────────────────────────────

    /**
     * Find a promo code by its code string (case-insensitive normalisation is caller's job).
     */
    static async findByCode(code: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT CodeID, Code, Type, Value, MinRechargeAmount, MaxBonusAmount,
                   MaxUses, CurrentUses, PerUserLimit, ExpiresAt, IsActive, Description
            FROM PromoCodes
            WHERE Code = @param0
        `, [code]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Get CodeID by code string. Returns null if not found.
     */
    static async getCodeId(code: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT CodeID FROM PromoCodes WHERE Code = @param0`,
            [code]
        );
        return result.recordset?.[0]?.CodeID ?? null;
    }

    /**
     * Increment the global usage counter on a promo code.
     */
    static async incrementUsage(codeId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE PromoCodes SET CurrentUses = CurrentUses + 1, UpdatedAt = GETUTCDATE()
            WHERE CodeID = @param0
        `, [codeId]);
    }

    /**
     * Fetch all active, non-expired promo codes with per-user usage counts.
     */
    static async findAllActiveWithUsage(userId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT pc.CodeID, pc.Code, pc.Type, pc.Value, pc.MinRechargeAmount, pc.MaxBonusAmount,
                   pc.MaxUses, pc.CurrentUses, pc.PerUserLimit, pc.ExpiresAt, pc.Description,
                   ISNULL(pu.UserUsages, 0) AS UserUsages
            FROM PromoCodes pc
            LEFT JOIN (
                SELECT CodeID, COUNT(*) AS UserUsages
                FROM PromoCodeUsages
                WHERE UserID = @param0
                GROUP BY CodeID
            ) pu ON pc.CodeID = pu.CodeID
            WHERE pc.IsActive = 1
              AND (pc.ExpiresAt IS NULL OR pc.ExpiresAt > GETUTCDATE())
              AND (pc.MaxUses IS NULL OR pc.CurrentUses < pc.MaxUses)
            ORDER BY pc.Code
        `, [userId]);
        return result.recordset || [];
    }

    // ── PromoCodeUsages ─────────────────────────────────────────

    /**
     * Count how many times a user has used a specific promo code.
     */
    static async countUserUsage(codeId: string, userId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as UsageCount
            FROM PromoCodeUsages
            WHERE CodeID = @param0 AND UserID = @param1
        `, [codeId, userId]);
        return result.recordset?.[0]?.UsageCount || 0;
    }

    /**
     * Record a promo code usage.
     */
    static async insertUsage(
        usageId: string,
        codeId: string,
        userId: string,
        rechargeAmount: number,
        bonusGiven: number
    ): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO PromoCodeUsages (UsageID, CodeID, UserID, RechargeAmount, BonusGiven, UsedAt)
            VALUES (@param0, @param1, @param2, @param3, @param4, GETUTCDATE())
        `, [usageId, codeId, userId, rechargeAmount, bonusGiven]);
    }

    // ── Profile queries (for eligibility checks) ────────────────

    /**
     * Get user graduation info for promo eligibility checks.
     */
    static async getUserProfile(userId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT a.GraduationYear, a.Institution, a.TotalExperienceMonths
            FROM Users u
            LEFT JOIN Applicants a ON u.UserID = a.UserID
            WHERE u.UserID = @param0
        `, [userId]);
        return result.recordset?.[0] || {};
    }

    /**
     * Get work experience counts for promo eligibility checks.
     */
    static async getUserWorkCounts(userId: string): Promise<{ TotalWork: number; CurrentWork: number }> {
        const result = await dbService.executeQuery(`
            SELECT 
                COUNT(*) AS TotalWork,
                SUM(CASE WHEN w.IsCurrent = 1 OR w.EndDate IS NULL THEN 1 ELSE 0 END) AS CurrentWork
            FROM WorkExperiences w
            INNER JOIN Applicants a ON w.ApplicantID = a.ApplicantID
            WHERE a.UserID = @param0
        `, [userId]);
        return result.recordset?.[0] || { TotalWork: 0, CurrentWork: 0 };
    }

    // ── WalletBonusPacks ────────────────────────────────────────

    /**
     * Get all active bonus packs ordered by sort order.
     */
    static async getActiveBonusPacks(): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT PackID, Name, PayAmount, GetAmount, BonusAmount, BonusPercent,
                   ReferralsWorth, Badge, SortOrder
            FROM WalletBonusPacks
            WHERE IsActive = 1
            ORDER BY SortOrder ASC
        `, []);
        return result.recordset || [];
    }

    /**
     * Find a bonus pack that matches a specific pay amount.
     */
    static async findPackByAmount(amount: number): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT PackID, Name, PayAmount, GetAmount, BonusAmount, BonusPercent, ReferralsWorth, Badge
            FROM WalletBonusPacks
            WHERE IsActive = 1 AND PayAmount = @param0
        `, [amount]);
        return result.recordset?.[0] ?? null;
    }
}
