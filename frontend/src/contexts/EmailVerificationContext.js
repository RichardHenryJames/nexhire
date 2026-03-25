import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import EmailVerificationModal from '../components/modals/EmailVerificationModal';

/**
 * EmailVerificationContext
 * 
 * Provides a `requireEmailVerification()` function that any screen can call
 * before performing a write action (ask referral, apply, message, etc.).
 * 
 * If the user's email is not verified:
 *   - Shows the verification modal
 *   - Returns false (action should be blocked)
 * 
 * If the user's email is verified (or Google user):
 *   - Returns true (action can proceed)
 * 
 * Usage:
 *   const { requireEmailVerification } = useEmailVerification();
 *   
 *   const handleAction = () => {
 *     if (!requireEmailVerification()) return;
 *     // ... proceed with action
 *   };
 */
const EmailVerificationContext = createContext(null);

export const useEmailVerification = () => {
  const context = useContext(EmailVerificationContext);
  if (!context) {
    throw new Error('useEmailVerification must be used within EmailVerificationProvider');
  }
  return context;
};

export const EmailVerificationProvider = ({ children }) => {
  const { user, isEmailVerified, isGoogleUser, userEmail, logout, markEmailVerified } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  // Returns true if verified (action can proceed), false if not (modal shown)
  const requireEmailVerification = useCallback(() => {
    // Not logged in — skip (other auth checks handle this)
    if (!user) return true;

    // Google users are always verified
    if (isGoogleUser) return true;

    // Already verified
    if (isEmailVerified) return true;

    // Not verified — show modal
    setModalVisible(true);
    return false;
  }, [user, isGoogleUser, isEmailVerified]);

  const showVerificationModal = useCallback(() => {
    setModalVisible(true);
  }, []);

  const handleVerified = useCallback(() => {
    markEmailVerified();
    setModalVisible(false);
  }, [markEmailVerified]);

  const handleLogout = useCallback(() => {
    setModalVisible(false);
    logout();
  }, [logout]);

  const needsVerification = !!user && !isGoogleUser && !isEmailVerified;

  const value = {
    requireEmailVerification,
    showVerificationModal,
    needsVerification,
    isEmailVerified: isEmailVerified || isGoogleUser,
  };

  return (
    <EmailVerificationContext.Provider value={value}>
      {children}
      <EmailVerificationModal
        visible={modalVisible}
        email={userEmail}
        onVerified={handleVerified}
        onLogout={handleLogout}
        onClose={() => setModalVisible(false)}
      />
    </EmailVerificationContext.Provider>
  );
};
