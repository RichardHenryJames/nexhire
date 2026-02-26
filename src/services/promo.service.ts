/**
 * Promo Code Service
 * Handles validation and application of promotional codes for wallet recharges
 */

import { dbService } from './database.service';
import { v4 as uuidv4 } from 'uuid';

export interface PromoValidationResult {
  valid: boolean;
  message: string;
  bonusAmount?: number;
  code?: string;
  type?: string;
}

export class PromoService {

  /**
   * Validate a promo code for a given user and recharge amount
   * Does NOT apply it — just checks eligibility and returns bonus amount
   */
  static async validatePromoCode(
    code: string,
    userId: string,
    rechargeAmount: number
  ): Promise<PromoValidationResult> {
    try {
      if (!code || !code.trim()) {
        return { valid: false, message: 'Please enter a promo code' };
      }

      const normalizedCode = code.trim().toUpperCase();

      // Fetch promo code details
      const result = await dbService.executeQuery(`
        SELECT CodeID, Code, Type, Value, MinRechargeAmount, MaxBonusAmount,
               MaxUses, CurrentUses, PerUserLimit, ExpiresAt, IsActive, Description
        FROM PromoCodes
        WHERE Code = @param0
      `, [normalizedCode]);

      if (!result.recordset || result.recordset.length === 0) {
        return { valid: false, message: 'Invalid promo code' };
      }

      const promo = result.recordset[0];

      // Check if active
      if (!promo.IsActive) {
        return { valid: false, message: 'This promo code is no longer active' };
      }

      // Check expiry
      if (promo.ExpiresAt && new Date(promo.ExpiresAt) < new Date()) {
        return { valid: false, message: 'This promo code has expired' };
      }

      // Check global usage limit
      if (promo.MaxUses !== null && promo.CurrentUses >= promo.MaxUses) {
        return { valid: false, message: 'This promo code has reached its usage limit' };
      }

      // Check per-user usage limit
      const userUsageResult = await dbService.executeQuery(`
        SELECT COUNT(*) as UsageCount
        FROM PromoCodeUsages
        WHERE CodeID = @param0 AND UserID = @param1
      `, [promo.CodeID, userId]);

      const userUsages = userUsageResult.recordset[0]?.UsageCount || 0;
      if (userUsages >= promo.PerUserLimit) {
        return { valid: false, message: 'You have already used this promo code' };
      }

      // Check minimum recharge amount
      if (rechargeAmount < promo.MinRechargeAmount) {
        return {
          valid: false,
          message: `Minimum recharge of ₹${promo.MinRechargeAmount} required for this code`
        };
      }

      // Calculate bonus
      let bonusAmount = 0;
      if (promo.Type === 'FLAT_BONUS') {
        bonusAmount = promo.Value;
      } else if (promo.Type === 'PERCENT_BONUS') {
        bonusAmount = Math.round((rechargeAmount * promo.Value) / 100);
      }

      // Cap bonus at max
      if (promo.MaxBonusAmount !== null && bonusAmount > promo.MaxBonusAmount) {
        bonusAmount = promo.MaxBonusAmount;
      }

      if (bonusAmount <= 0) {
        return { valid: false, message: 'This promo code does not apply to this amount' };
      }

      return {
        valid: true,
        message: `You'll get ₹${bonusAmount} extra credit!`,
        bonusAmount,
        code: promo.Code,
        type: promo.Type
      };
    } catch (error) {
      console.error('Error validating promo code:', error);
      return { valid: false, message: 'Unable to validate promo code. Please try again.' };
    }
  }

  /**
   * Apply a promo code — records usage and increments counters
   * Call this AFTER wallet has been credited
   */
  static async applyPromoCode(
    code: string,
    userId: string,
    rechargeAmount: number,
    bonusGiven: number
  ): Promise<boolean> {
    try {
      const normalizedCode = code.trim().toUpperCase();

      // Get CodeID
      const result = await dbService.executeQuery(`
        SELECT CodeID FROM PromoCodes WHERE Code = @param0
      `, [normalizedCode]);

      if (!result.recordset || result.recordset.length === 0) return false;

      const codeId = result.recordset[0].CodeID;

      // Record usage
      await dbService.executeQuery(`
        INSERT INTO PromoCodeUsages (UsageID, CodeID, UserID, RechargeAmount, BonusGiven, UsedAt)
        VALUES (@param0, @param1, @param2, @param3, @param4, GETUTCDATE())
      `, [uuidv4(), codeId, userId, rechargeAmount, bonusGiven]);

      // Increment global counter
      await dbService.executeQuery(`
        UPDATE PromoCodes SET CurrentUses = CurrentUses + 1, UpdatedAt = GETUTCDATE()
        WHERE CodeID = @param0
      `, [codeId]);

      return true;
    } catch (error) {
      console.error('Error applying promo code:', error);
      return false;
    }
  }

  /**
   * Get all active promo codes with smart eligibility/recommendations for a user
   */
  static async getPromoCodesForUser(userId: string): Promise<any[]> {
    try {
      // 1. Fetch all active, non-expired promo codes
      const codesResult = await dbService.executeQuery(`
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

      const codes = codesResult.recordset || [];

      // 2. Fetch user profile for eligibility checks
      const profileResult = await dbService.executeQuery(`
        SELECT a.GraduationYear, a.Institution, a.TotalExperienceMonths
        FROM Users u
        LEFT JOIN Applicants a ON u.UserID = a.UserID
        WHERE u.UserID = @param0
      `, [userId]);

      const profile = profileResult.recordset?.[0] || {};

      // 3. Check if user has current work experience
      const workResult = await dbService.executeQuery(`
        SELECT TOP 1 1 AS HasWork
        FROM WorkExperiences w
        INNER JOIN Applicants a ON w.ApplicantID = a.ApplicantID
        WHERE a.UserID = @param0
      `, [userId]);

      const hasAnyWork = (workResult.recordset?.length || 0) > 0;

      const currentWorkResult = await dbService.executeQuery(`
        SELECT TOP 1 1 AS HasCurrentWork
        FROM WorkExperiences w
        INNER JOIN Applicants a ON w.ApplicantID = a.ApplicantID
        WHERE a.UserID = @param0 AND (w.IsCurrent = 1 OR w.EndDate IS NULL)
      `, [userId]);

      const hasCurrentWork = (currentWorkResult.recordset?.length || 0) > 0;

      // 4. Determine eligibility for each code
      const currentYear = new Date().getFullYear();
      const gradYear = profile.GraduationYear ? parseInt(profile.GraduationYear, 10) : null;

      return codes.map((code: any) => {
        const exhausted = code.UserUsages >= code.PerUserLimit;
        const remainingUses = code.PerUserLimit - code.UserUsages;

        // Calculate sample bonus (on min recharge amount)
        let sampleBonus = 0;
        if (code.Type === 'FLAT_BONUS') {
          sampleBonus = code.Value;
        } else if (code.Type === 'PERCENT_BONUS') {
          sampleBonus = Math.round((code.MinRechargeAmount * code.Value) / 100);
        }
        if (code.MaxBonusAmount !== null && sampleBonus > code.MaxBonusAmount) {
          sampleBonus = code.MaxBonusAmount;
        }

        // Smart recommendation logic
        let recommended = false;
        let recommendReason = '';

        switch (code.Code) {
          case 'FRESHER':
            // Recommended for recent graduates with no work experience
            if (gradYear && gradYear >= currentYear - 2 && !hasAnyWork) {
              recommended = true;
              recommendReason = 'Perfect for fresh graduates like you!';
            } else if (!hasAnyWork && !gradYear) {
              recommended = true;
              recommendReason = 'Great for those starting their career!';
            }
            break;

          case 'SWITCH':
            // Recommended for experienced professionals not currently employed
            if (hasAnyWork && !hasCurrentWork) {
              recommended = true;
              recommendReason = 'Made for career switchers like you!';
            }
            break;

          case 'CAMPUS100':
            // Recommended for current students or very recent graduates
            if (gradYear && gradYear >= currentYear && !hasAnyWork) {
              recommended = true;
              recommendReason = 'Exclusive campus offer for students!';
            }
            break;

          case 'FIRST50':
            // Recommended if user has never used any promo code
            if (code.UserUsages === 0) {
              recommended = true;
              recommendReason = 'Your first-time welcome bonus!';
            }
            break;

          case 'EXTRA25':
            // Recommended for bigger recharges
            recommended = true;
            recommendReason = 'Extra 25% on every recharge!';
            break;
        }

        return {
          code: code.Code,
          type: code.Type,
          value: code.Value,
          minRecharge: code.MinRechargeAmount,
          maxBonus: code.MaxBonusAmount,
          description: code.Description,
          sampleBonus,
          perUserLimit: code.PerUserLimit,
          remainingUses: Math.max(0, remainingUses),
          exhausted,
          recommended: recommended && !exhausted,
          recommendReason: exhausted ? '' : recommendReason,
        };
      });
    } catch (error) {
      console.error('Error fetching promo codes for user:', error);
      return [];
    }
  }

  /**
   * Get all active bonus packs
   */
  static async getBonusPacks(): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(`
        SELECT PackID, Name, PayAmount, GetAmount, BonusAmount, BonusPercent,
               ReferralsWorth, Badge, SortOrder
        FROM WalletBonusPacks
        WHERE IsActive = 1
        ORDER BY SortOrder ASC
      `, []);

      return result.recordset || [];
    } catch (error) {
      console.error('Error fetching bonus packs:', error);
      return [];
    }
  }

  /**
   * Find a matching bonus pack for a given amount
   * Returns the pack if the pay amount matches exactly
   */
  static async findMatchingPack(amount: number): Promise<any | null> {
    try {
      const result = await dbService.executeQuery(`
        SELECT PackID, Name, PayAmount, GetAmount, BonusAmount, BonusPercent, ReferralsWorth, Badge
        FROM WalletBonusPacks
        WHERE IsActive = 1 AND PayAmount = @param0
      `, [amount]);

      return result.recordset?.[0] || null;
    } catch (error) {
      console.error('Error finding matching pack:', error);
      return null;
    }
  }
}
