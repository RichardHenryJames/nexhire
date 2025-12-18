/**
 * Pricing Settings Service
 * Fetches pricing configuration from database
 * Allows dynamic pricing updates without code deployment
 */

import { dbService } from './database.service';

// Default values (fallback if DB fetch fails)
const DEFAULT_PRICING = {
  AI_JOBS_COST: 99,
  AI_ACCESS_DURATION_HOURS: 360, // 15 days
  REFERRAL_REQUEST_COST: 39,
  JOB_PUBLISH_COST: 50,
  WELCOME_BONUS: 100,
  REFERRAL_SIGNUP_BONUS: 50,
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
   * Get job publish cost
   */
  static async getJobPublishCost(): Promise<number> {
    return this.getSetting('JOB_PUBLISH_COST');
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
