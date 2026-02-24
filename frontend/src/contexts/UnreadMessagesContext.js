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
import refopenAPI from '../services/api';
import { useAuth } from './AuthContext';

const UnreadMessagesContext = createContext({
  unreadCount: 0,
  refreshUnreadCount: () => {},
});

const POLL_MS = 10_000; // Poll every 10s for new messages

export function UnreadMessagesProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef(null);
  const { user } = useAuth();

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await refopenAPI.apiCall('/messages/unread-count');
      if (res.success) {
        // Backend returns { TotalUnread, UnreadConversations } or { count }
        const count = res.data?.TotalUnread ?? res.data?.UnreadConversations ?? res.data?.count ?? 0;
        setUnreadCount(count);
      }
    } catch (e) {
      // Silently fail
    }
  }, []);

  // ⚡ Poll only when user is logged in
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    // Fetch immediately, then poll
    refreshUnreadCount();
    pollRef.current = setInterval(refreshUnreadCount, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [user, refreshUnreadCount]);

  // Also refresh when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) refreshUnreadCount();
    });
    return () => sub?.remove();
  }, [user, refreshUnreadCount]);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}
