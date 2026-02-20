/**
 * UnreadMessagesContext — Global unread message count provider
 *
 * Eliminates redundant /messages/unread-count API calls.
 * Previously, TabHeader fetched unread count on every tab focus (×4 tabs).
 * Now fetched once centrally; tabs share the same value.
 *
 * Usage:
 *   const { unreadCount, refreshUnreadCount } = useUnreadMessages();
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import refopenAPI from '../services/api';

const UnreadMessagesContext = createContext({
  unreadCount: 0,
  refreshUnreadCount: () => {},
});

const STALE_MS = 5_000; // Consider data stale after 5s
const POLL_MS = 15_000; // Poll every 15s for new messages

export function UnreadMessagesProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastFetchedRef = useRef(0);
  const pollRef = useRef(null);

  const refreshUnreadCount = useCallback(async (force = false) => {
    const now = Date.now();
    // Skip if fetched recently (unless forced)
    if (!force && now - lastFetchedRef.current < STALE_MS) return;
    lastFetchedRef.current = now;

    try {
      const res = await refopenAPI.apiCall('/messages/unread-count');
      if (res.success) {
        setUnreadCount(res.data?.count || 0);
      }
    } catch (e) {
      // Silently fail — badge just won't update
    }
  }, []);

  // ⚡ Poll for new messages every 15s (like LinkedIn)
  // Focus listeners were removed for perf, so polling is the only way to update badge
  useEffect(() => {
    refreshUnreadCount(true);
    pollRef.current = setInterval(() => refreshUnreadCount(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [refreshUnreadCount]);

  // Also refresh when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshUnreadCount(true);
    });
    return () => sub?.remove();
  }, [refreshUnreadCount]);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}
