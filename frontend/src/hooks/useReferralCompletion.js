import { useRef, useCallback } from 'react';

/**
 * Hook to manage referral completion animation
 * Shows full-screen image for 1 second when referral is submitted
 */
export const useReferralCompletion = () => {
  const modalRef = useRef(null);

  const showCompletion = useCallback(() => {
    if (modalRef.current) {
      modalRef.current.show();
      // Auto-hide after 1 second
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.hide();
        }
      }, 1000);
    }
  }, []);

  return { modalRef, showCompletion };
};
