/**
 * SubscriptionContext — Provides Pro subscription status to all screens
 * Fetches once on login, exposes isPro, referralsRemaining, refresh
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import refopenAPI from '../services/api';
import { useAuth } from './AuthContext';

const defaultStatus = {
  tier: 'free',
  isPro: false,
  expiresAt: null,
  referralsUsed: 0,
  referralsIncluded: 0,
  referralsRemaining: 0,
  daysRemaining: 0,
};

const SubscriptionContext = createContext({
  subscription: defaultStatus,
  loading: false,
  refreshSubscription: () => {},
});

export const SubscriptionProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState(defaultStatus);
  const [loading, setLoading] = useState(false);

  const refreshSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setSubscription(defaultStatus);
      return;
    }
    try {
      setLoading(true);
      const res = await refopenAPI.getSubscriptionStatus();
      if (res?.success && res.data) {
        setSubscription(res.data);
      }
    } catch (e) {
      console.warn('Failed to fetch subscription status:', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch on auth change
  useEffect(() => {
    if (isAuthenticated) {
      refreshSubscription();
    } else {
      setSubscription(defaultStatus);
    }
  }, [isAuthenticated, user?.UserID]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
export default SubscriptionContext;
