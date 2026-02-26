/**
 * PricingContext - DB-driven pricing for the entire app
 * Fetches pricing from backend API and provides it to all components
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import refopenAPI from '../services/api';

// Default pricing values (fallback if API fails)
const DEFAULT_PRICING = {
  aiJobsCost: 99,
  aiAccessDurationHours: 360,
  aiAccessDurationDays: 15,
  referralRequestCost: 49,
  openToAnyReferralCost: 99,
  jobPublishCost: 0,
  welcomeBonus: 0,
  referralSignupBonus: 25,
  profileViewCost: 29,
  profileViewAccessDurationHours: 168,
  profileViewAccessDurationDays: 7,
  // Tier-based referral pricing
  premiumReferralCost: 99,
  eliteReferralCost: 199,
  // Tier-based referrer payouts
  standardReferrerPayout: 25,
  premiumReferrerPayout: 50,
  eliteReferrerPayout: 100,
  // Milestone bonuses — flat for all tiers
  milestone5Bonus: 50,
  milestone10Bonus: 100,
  milestone20Bonus: 200,
  // Withdrawal
  minimumWithdrawal: 200,
  // AI Resume
  aiResumeAnalysisCost: 29,
  aiResumeFreeUses: 2,
  // Resume Templates
  resumeTemplateCost: 49,
};

const PricingContext = createContext({
  pricing: DEFAULT_PRICING,
  loading: true,
  error: null,
  refreshPricing: () => {},
});

export const PricingProvider = ({ children }) => {
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPricing = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await refopenAPI.getPricing();
      
      if (response.success && response.data) {
        setPricing(prev => ({ ...prev, ...response.data }));
      } else {
        // Keep default pricing if API fails
        console.warn('Using default pricing values');
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
      setError(err.message);
      // Keep default pricing on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch pricing on mount
  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  // Refresh pricing every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchPricing, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPricing]);

  return (
    <PricingContext.Provider value={{ pricing, loading, error, refreshPricing: fetchPricing }}>
      {children}
    </PricingContext.Provider>
  );
};

// Hook to use pricing in components
export const usePricing = () => {
  const context = useContext(PricingContext);
  if (!context) {
    throw new Error('usePricing must be used within a PricingProvider');
  }
  return context;
};

// Export default pricing for static use (when context is not available)
export { DEFAULT_PRICING };

export default PricingContext;
