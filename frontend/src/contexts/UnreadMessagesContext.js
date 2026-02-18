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

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import refopenAPI from '../services/api';

const UnreadMessagesContext = createContext({
  unreadCount: 0,
  refreshUnreadCount: () => {},
});

const STALE_MS = 5_000; // Consider data stale after 5s

export function UnreadMessagesProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastFetchedRef = useRef(0);

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

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}
