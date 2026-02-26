/**
 * Pricing Settings Service
 * Fetches pricing configuration from database
 * Allows dynamic pricing updates without code deployment
 */

import { dbService } from './database.service';

// Organization tier type
export type OrganizationTier = 'Standard' | 'Premium' | 'Elite';

// Default values (fallback if DB fetch fails)
const DEFAULT_PRICING = {
  AI_JOBS_COST: 99,
  AI_ACCESS_DURATION_HOURS: 360, // 15 days
  REFERRAL_REQUEST_COST: 49,
  JOB_PUBLISH_COST: 0, // Free job publishing — jobs are content that drives referral revenue
  WELCOME_BONUS: 0,
  REFERRAL_SIGNUP_BONUS: 25,
  PROFILE_VIEW_COST: 29,
  PROFILE_VIEW_ACCESS_DURATION_HOURS: 168, // 7 days
  OPEN_TO_ANY_REFERRAL_COST: 99,
  // Tier-based referral costs
  PREMIUM_REFERRAL_COST: 99,
  ELITE_REFERRAL_COST: 199,
  // Tier-based referrer payouts (fixed, transparent — replaces old random ₹20-40)
  STANDARD_REFERRER_PAYOUT: 25,
  PREMIUM_REFERRER_PAYOUT: 50,
  ELITE_REFERRER_PAYOUT: 100,
  // Milestone bonuses (monthly) — flat for all tiers
  MILESTONE_5_BONUS: 50,
  MILESTONE_10_BONUS: 100,
  MILESTONE_20_BONUS: 200,
  // Withdrawal
  MINIMUM_WITHDRAWAL: 200,
  // AI Resume Analysis
  AI_RESUME_ANALYSIS_COST: 29,
  AI_RESUME_FREE_USES: 2,
  // Resume Templates
  RESUME_TEMPLATE_COST: 49,
};

// Cache for pricing settings (refresh every 5 minutes)
let pricingCache: Record<string, number> | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class PricingService {
  /**
   * Get all pricing settings from database (with caching)
   */
  static async getAllSettings(): Promise<Record<string, number>> {
    const now = Date.now();
    
    // Return cache if valid
    if (pricingCache && (now - lastCacheTime) < CACHE_TTL) {
      return pricingCache;
    }

    try {
      const query = `
        SELECT SettingKey, SettingValue 
        FROM PricingSettings 
        WHERE IsActive = 1
      `;
      const result = await dbService.executeQuery(query, []);
      
      if (result.recordset && result.recordset.length > 0) {
        const settings: Record<string, number> = {};
        for (const row of result.recordset) {
          settings[row.SettingKey] = Number(row.SettingValue);
        }
        
        // Update cache
        pricingCache = { ...DEFAULT_PRICING, ...settings };
        lastCacheTime = now;
        
        return pricingCache;
      }
    } catch (error) {
      console.error('Error fetching pricing settings:', error);
    }

    // Return defaults if DB fetch fails
    return DEFAULT_PRICING;
  }

  /**
   * Get a specific pricing setting
   */
  static async getSetting(key: string): Promise<number> {
    const settings = await this.getAllSettings();
    return settings[key] ?? DEFAULT_PRICING[key as keyof typeof DEFAULT_PRICING] ?? 0;
  }

  /**
   * Get AI Jobs pricing
   */
  static async getAIJobsCost(): Promise<number> {
    return this.getSetting('AI_JOBS_COST');
  }

  /**
   * Get AI Jobs access duration in hours
   */
  static async getAIAccessDurationHours(): Promise<number> {
    return this.getSetting('AI_ACCESS_DURATION_HOURS');
  }

  /**
   * Get referral request cost
   */
  static async getReferralCost(): Promise<number> {
    return this.getSetting('REFERRAL_REQUEST_COST');
  }

  /**
   * Get open-to-any-company referral request cost
   */
  static async getOpenToAnyCost(): Promise<number> {
    return this.getSetting('OPEN_TO_ANY_REFERRAL_COST');
  }

  /**
   * Get job publish cost
   */
  static async getJobPublishCost(): Promise<number> {
    return this.getSetting('JOB_PUBLISH_COST');
  }

  /**
   * Get profile view cost
   */
  static async getProfileViewCost(): Promise<number> {
    return this.getSetting('PROFILE_VIEW_COST');
  }

  /**
   * Get profile view access duration in hours
   */
  static async getProfileViewAccessDurationHours(): Promise<number> {
    return this.getSetting('PROFILE_VIEW_ACCESS_DURATION_HOURS');
  }

  // ===== TIER-BASED PRICING =====

  /**
   * Get referral cost based on organization tier
   */
  static async getReferralCostByTier(tier: OrganizationTier): Promise<number> {
    switch (tier) {
      case 'Elite': return this.getSetting('ELITE_REFERRAL_COST');
      case 'Premium': return this.getSetting('PREMIUM_REFERRAL_COST');
      default: return this.getSetting('REFERRAL_REQUEST_COST'); // Standard
    }
  }

  /**
   * Get referrer payout based on organization tier
   */
  static async getReferrerPayoutByTier(tier: OrganizationTier): Promise<number> {
    switch (tier) {
      case 'Elite': return this.getSetting('ELITE_REFERRER_PAYOUT');
      case 'Premium': return this.getSetting('PREMIUM_REFERRER_PAYOUT');
      default: return this.getSetting('STANDARD_REFERRER_PAYOUT');
    }
  }

  /**
   * Get milestone bonus amounts (flat for all tiers)
   */
  static async getMilestoneBonuses(): Promise<{ m5: number; m10: number; m20: number }> {
    const [m5, m10, m20] = await Promise.all([
      this.getSetting('MILESTONE_5_BONUS'),
      this.getSetting('MILESTONE_10_BONUS'),
      this.getSetting('MILESTONE_20_BONUS'),
    ]);
    return { m5, m10, m20 };
  }

  /**
   * Get minimum withdrawal amount
   */
  static async getMinimumWithdrawal(): Promise<number> {
    return this.getSetting('MINIMUM_WITHDRAWAL');
  }

  /**
   * Get AI resume analysis cost
   */
  static async getAIResumeAnalysisCost(): Promise<number> {
    return this.getSetting('AI_RESUME_ANALYSIS_COST');
  }

  /**
   * Get number of free AI resume analysis uses
   */
  static async getAIResumeFreeUses(): Promise<number> {
    return this.getSetting('AI_RESUME_FREE_USES');
  }

  /**
   * Get resume template cost
   */
  static async getResumeTemplateCost(): Promise<number> {
    return this.getSetting('RESUME_TEMPLATE_COST');
  }

  /**
   * Clear cache (useful after admin updates pricing)
   */
  static clearCache(): void {
    pricingCache = null;
    lastCacheTime = 0;
  }
}

// Export default pricing for backward compatibility
export const PRICING = DEFAULT_PRICING;
