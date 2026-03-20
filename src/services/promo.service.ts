/**
 * Promo Code Service
 * Handles validation and application of promotional codes for wallet recharges
 */

import { PromoRepository } from '../repositories/promo.repository';
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
      const promo = await PromoRepository.findByCode(normalizedCode);

      if (!promo) {
        return { valid: false, message: 'Invalid promo code' };
      }

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
      const userUsages = await PromoRepository.countUserUsage(promo.CodeID, userId);
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

      // ── Eligibility check: profile-based restrictions ──
      const eligibility = await PromoService.checkCodeEligibility(normalizedCode, userId);
      if (!eligibility.eligible) {
        return { valid: false, message: eligibility.reason || 'You are not eligible for this promo code' };
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
      const codeId = await PromoRepository.getCodeId(normalizedCode);
      if (!codeId) return false;

      // Record usage
      await PromoRepository.insertUsage(uuidv4(), codeId, userId, rechargeAmount, bonusGiven);

      // Increment global counter
      await PromoRepository.incrementUsage(codeId);

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
      const codes = await PromoRepository.findAllActiveWithUsage(userId);

      // 2. Determine eligibility for each code using shared helper
      const results: any[] = [];
      for (const code of codes) {
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

        // Use shared eligibility helper
        const eligibility = await PromoService.checkCodeEligibility(code.Code, userId);
        const eligible = eligibility.eligible;
        const recommended = eligible && !exhausted;
        const recommendReason = eligibility.recommendReason || '';

        results.push({
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
          eligible,
          recommended: recommended && !exhausted,
          recommendReason: exhausted ? '' : recommendReason,
          ineligibleReason: !eligible ? eligibility.reason : undefined,
        });
      }
      return results;
    } catch (error) {
      console.error('Error fetching promo codes for user:', error);
      return [];
    }
  }

  /**
   * Check if a user is eligible for a specific promo code based on their profile.
   * Shared logic used by both validatePromoCode() and getPromoCodesForUser().
   * Codes without specific eligibility rules (like EXTRA25) are open to everyone.
   */
  static async checkCodeEligibility(code: string, userId: string): Promise<{ eligible: boolean; reason?: string; recommendReason?: string }> {
    try {
      const normalizedCode = code.trim().toUpperCase();

      // Codes open to everyone — no profile check needed
      if (['EXTRA25', 'FIRST50'].includes(normalizedCode)) {
        // FIRST50 eligibility is already handled by per-user limit (1 use)
        return { eligible: true, recommendReason: normalizedCode === 'EXTRA25' ? 'Extra 25% on every recharge!' : 'Your first-time welcome bonus!' };
      }

      // Fetch user profile
      const profile = await PromoRepository.getUserProfile(userId);

      const currentYear = new Date().getFullYear();
      const gradYear = profile.GraduationYear ? parseInt(profile.GraduationYear, 10) : null;

      // Check work experience
      const workCounts = await PromoRepository.getUserWorkCounts(userId);

      const hasAnyWork = (workCounts.TotalWork || 0) > 0;
      const hasCurrentWork = (workCounts.CurrentWork || 0) > 0;

      switch (normalizedCode) {
        case 'FRESHER':
          // Eligible: recent graduates (within 2 years) with no work experience, or no grad year + no work
          if (gradYear && gradYear >= currentYear - 2 && !hasAnyWork) {
            return { eligible: true, recommendReason: 'Perfect for fresh graduates like you!' };
          } else if (!hasAnyWork && !gradYear) {
            return { eligible: true, recommendReason: 'Great for those starting their career!' };
          }
          return { eligible: false, reason: 'This code is for freshers with no work experience' };

        case 'SWITCH':
          // Eligible: has past work experience but not currently employed
          if (hasAnyWork && !hasCurrentWork) {
            return { eligible: true, recommendReason: 'Made for career switchers like you!' };
          }
          return { eligible: false, reason: 'This code is for professionals switching careers' };

        case 'CAMPUS100':
          // Eligible: current students or graduating this year, no work experience
          if (gradYear && gradYear >= currentYear && !hasAnyWork) {
            return { eligible: true, recommendReason: 'Exclusive campus offer for students!' };
          }
          return { eligible: false, reason: 'This code is exclusively for current students' };

        default:
          // Unknown code — allow by default
          return { eligible: true };
      }
    } catch (error) {
      console.error('Error checking code eligibility:', error);
      // Fail open — don't block users if eligibility check fails
      return { eligible: true };
    }
  }

  /**
   * Get all active bonus packs
   */
  static async getBonusPacks(): Promise<any[]> {
    try {
      return await PromoRepository.getActiveBonusPacks();
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
      return await PromoRepository.findPackByAmount(amount);
    } catch (error) {
      console.error('Error finding matching pack:', error);
      return null;
    }
  }
}
