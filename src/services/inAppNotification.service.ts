/**
 * In-App Notification Service
 * 
 * Handles creating, fetching, and managing in-app notifications
 * stored in the InAppNotifications table.
 */

import { NotificationRepository } from '../repositories/notification.repository';

// Notification types
export type InAppNotificationType =
  | 'message_received'
  | 'referral_request_new'
  | 'referral_claimed'
  | 'referral_submitted'
  | 'referral_verified'
  | 'referral_rejected'
  | 'referral_cancelled'
  | 'referral_expired'
  | 'referral_verify_reminder'
  | 'social_share_approved'
  | 'social_share_rejected'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'wallet_credited'
  | 'wallet_debited'
  | 'manual_payment_approved'
  | 'manual_payment_rejected'
  | 'support_reply'
  | 'profile_viewed'
  | 'welcome'
  | 'job_recommendations'
  | 'referrer_digest'
  | 'become_verified'
  | 'referral_expiring';

interface CreateNotificationParams {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  notificationType: InAppNotificationType;
  referenceId?: string;
  expiresAt?: Date;
}

interface NotificationFilters {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export class InAppNotificationService {

  /**
   * Create a new in-app notification
   */
  static async create(params: CreateNotificationParams): Promise<string> {
    try {
      return await NotificationRepository.insert({
        userId: params.userId,
        title: params.title,
        body: params.body,
        icon: params.icon || null,
        imageUrl: params.imageUrl || null,
        actionUrl: params.actionUrl || null,
        actionLabel: params.actionLabel || null,
        notificationType: params.notificationType,
        referenceId: params.referenceId || null,
        expiresAt: params.expiresAt || null
      });
    } catch (error: any) {
      console.error('❌ Failed to create in-app notification:', error);
      throw error;
    }
  }

  /**
   * Create notification (fire and forget - won't throw)
   */
  static async createSafe(params: CreateNotificationParams): Promise<void> {
    try {
      await this.create(params);
    } catch (error: any) {
      console.error('❌ createSafe notification failed (non-critical):', error.message);
    }
  }

  /**
   * Get notifications for a user
   */
  static async getNotifications(userId: string, filters: NotificationFilters = {}) {
    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 20, 50);
    const offset = (page - 1) * pageSize;
    const unreadOnly = !!filters.unreadOnly;

    const [notifications, total] = await Promise.all([
      NotificationRepository.findByUser(userId, offset, pageSize, unreadOnly),
      NotificationRepository.countByUser(userId, unreadOnly)
    ]);

    return {
      notifications,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return NotificationRepository.countUnread(userId);
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    return NotificationRepository.markRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<number> {
    return NotificationRepository.markAllRead(userId);
  }

  /**
   * Delete a single notification for a user
   */
  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    return NotificationRepository.deleteOne(notificationId, userId);
  }

  /**
   * Delete old notifications (cleanup, called by timer)
   */
  static async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    return NotificationRepository.deleteOlderThan(daysOld);
  }

  // ========================================
  // CONVENIENCE METHODS FOR CREATING NOTIFICATIONS
  // ========================================

  /** New message received — batches multiple messages from the same conversation into one notification */
  static async notifyNewMessage(receiverUserId: string, senderName: string, messagePreview: string, conversationId: string) {

    try {
      // Check for an existing unread notification for the same conversation
      const existing = await NotificationRepository.findUnreadByConversation(receiverUserId, conversationId);

      if (existing) {
        // Collapse: update the existing notification with incremented count
        const countMatch = existing.Title.match(/^💬 (\d+) new messages from/);
        const currentCount = countMatch ? parseInt(countMatch[1], 10) : 1;
        const newCount = currentCount + 1;

        await NotificationRepository.updateTitleAndBump(
          existing.NotificationID,
          receiverUserId,
          `💬 ${newCount} new messages from ${senderName}`
        );
        return;
      }
    } catch (err: any) {
      // If collapse check fails, fall through to create a new notification
      console.error('Notification collapse check failed (non-critical):', err.message);
    }

    // No existing unread notification — create a new one
    await this.createSafe({
      userId: receiverUserId,
      title: `💬 New message from ${senderName}`,
      body: 'Tap to view the conversation',
      icon: 'chatbubbles',
      actionUrl: `/Messages?conversationId=${conversationId}`,
      actionLabel: 'View Message',
      notificationType: 'message_received',
      referenceId: conversationId
    });
  }

  /** Referral request created - notify referrers */
  static async notifyNewReferralRequest(referrerUserId: string, seekerName: string, jobTitle: string, companyName: string, requestId: string) {
    await this.createSafe({
      userId: referrerUserId,
      title: `📨 New referral request`,
      body: `${seekerName} wants a referral at ${companyName} for ${jobTitle}`,
      icon: 'person-add',
      actionUrl: `/provide-referral`,
      actionLabel: 'View Request',
      notificationType: 'referral_request_new',
      referenceId: requestId
    });
  }

  /** Referral claimed - notify job seeker when referrer clicks "I'll Refer" */
  static async notifyReferralClaimed(seekerUserId: string, referrerName: string, jobTitle: string, companyName: string, requestId: string) {
    await this.createSafe({
      userId: seekerUserId,
      title: `🙋 Referral claimed!`,
      body: `A ${companyName} employee is working on your referral for ${jobTitle}. Proof will be shared soon.`,
      icon: 'person-add',
      actionUrl: `/referrals/my-requests`,
      actionLabel: 'View Referral',
      notificationType: 'referral_claimed',
      referenceId: requestId
    });
  }

  /** Referral submitted - notify job seeker when referrer uploads proof */
  static async notifyReferralSubmitted(seekerUserId: string, referrerName: string, jobTitle: string, companyName: string, requestId: string) {
    await this.createSafe({
      userId: seekerUserId,
      title: `🎉 Referral submitted!`,
      body: `A ${companyName} employee submitted your referral for ${jobTitle}. Please verify once you receive confirmation.`,
      icon: 'checkmark-circle',
      actionUrl: `/referrals/my-requests`,
      actionLabel: 'Verify Now',
      notificationType: 'referral_submitted',
      referenceId: requestId
    });
  }

  /** Referral verified - notify referrer (earned money) */
  static async notifyReferralVerified(referrerUserId: string, seekerName: string, jobTitle: string, amount: number, requestId: string) {
    await this.createSafe({
      userId: referrerUserId,
      title: `✅ Referral verified! +₹${amount}`,
      body: `${seekerName} verified your referral for ${jobTitle}. ₹${amount} credited to your wallet!`,
      icon: 'wallet',
      actionUrl: `/wallet`,
      actionLabel: 'View Wallet',
      notificationType: 'referral_verified',
      referenceId: requestId
    });
  }

  /** Referral verify reminder - nudge job seeker to verify */
  static async notifyReferralVerifyReminder(seekerUserId: string, referrerName: string, jobTitle: string, companyName: string, requestId: string) {
    await this.createSafe({
      userId: seekerUserId,
      title: `⏰ Verify your referral`,
      body: `A ${companyName} employee referred you for ${jobTitle}. Please verify if you received the referral.`,
      icon: 'time',
      actionUrl: `/referrals/my-requests`,
      actionLabel: 'Verify Now',
      notificationType: 'referral_verify_reminder',
      referenceId: requestId
    });
  }

  /** Referral completion - notify seeker their referral is complete */
  static async notifyReferralComplete(seekerUserId: string, jobTitle: string, companyName: string, requestId: string) {
    await this.createSafe({
      userId: seekerUserId,
      title: `✅ Referral completed!`,
      body: `Your referral for ${jobTitle} at ${companyName} has been completed. Good luck with your application!`,
      icon: 'checkmark-done-circle',
      actionUrl: `/referrals/my-requests`,
      actionLabel: 'View Details',
      notificationType: 'referral_verified',
      referenceId: requestId
    });
  }

  /** Referral cancelled */
  static async notifyReferralCancelled(referrerUserId: string, seekerName: string, jobTitle: string, requestId: string) {
    await this.createSafe({
      userId: referrerUserId,
      title: `❌ Referral cancelled`,
      body: `${seekerName} cancelled their referral request for ${jobTitle}`,
      icon: 'close-circle',
      actionUrl: `/provide-referral`,
      notificationType: 'referral_cancelled',
      referenceId: requestId
    });
  }

  /** Social share approved */
  static async notifySocialShareApproved(userId: string, platform: string, amount: number, claimId: string) {
    await this.createSafe({
      userId,
      title: `✅ Social share approved!`,
      body: `Your ${platform} share was approved! ₹${amount} credited to your wallet.`,
      icon: 'megaphone',
      actionUrl: `/wallet`,
      actionLabel: 'View Wallet',
      notificationType: 'social_share_approved',
      referenceId: claimId
    });
  }

  /** Social share rejected */
  static async notifySocialShareRejected(userId: string, platform: string, reason: string, claimId: string) {
    await this.createSafe({
      userId,
      title: `❌ Social share rejected`,
      body: `Your ${platform} share was rejected. Reason: ${reason}`,
      icon: 'megaphone',
      actionUrl: `/SocialShareSubmit?platform=${platform}`,
      actionLabel: 'Resubmit',
      notificationType: 'social_share_rejected',
      referenceId: claimId
    });
  }

  /** Withdrawal approved */
  static async notifyWithdrawalApproved(userId: string, amount: number, reference: string) {
    await this.createSafe({
      userId,
      title: `💰 Withdrawal approved!`,
      body: `Your withdrawal of ₹${amount} has been approved. Payment ref: ${reference}`,
      icon: 'cash',
      actionUrl: `/wallet`,
      actionLabel: 'View Wallet',
      notificationType: 'withdrawal_approved'
    });
  }

  /** Withdrawal rejected */
  static async notifyWithdrawalRejected(userId: string, amount: number, reason: string) {
    await this.createSafe({
      userId,
      title: `❌ Withdrawal rejected`,
      body: `Your withdrawal of ₹${amount} was rejected. Reason: ${reason}`,
      icon: 'cash',
      actionUrl: `/wallet`,
      notificationType: 'withdrawal_rejected'
    });
  }

  /** Wallet credited (recharge, reward, etc.) */
  static async notifyWalletCredited(userId: string, amount: number, reason: string) {
    await this.createSafe({
      userId,
      title: `💰 ₹${amount} added to wallet`,
      body: reason,
      icon: 'wallet',
      actionUrl: `/wallet`,
      notificationType: 'wallet_credited'
    });
  }

  /** Support ticket reply */
  static async notifySupportReply(userId: string, subject: string, ticketId: string) {
    await this.createSafe({
      userId,
      title: `💬 Support reply`,
      body: `Admin replied to your ticket: ${subject}`,
      icon: 'help-circle',
      actionUrl: `/support`,
      actionLabel: 'View Ticket',
      notificationType: 'support_reply',
      referenceId: ticketId
    });
  }

  /** Profile viewed */
  static async notifyProfileViewed(userId: string, viewerName: string) {
    await this.createSafe({
      userId,
      title: `👀 Profile viewed`,
      body: `${viewerName} viewed your profile`,
      icon: 'eye',
      actionUrl: `/ProfileViews`,
      notificationType: 'profile_viewed'
    });
  }

  /** Manual payment approved */
  static async notifyManualPaymentApproved(userId: string, amount: number) {
    await this.createSafe({
      userId,
      title: `✅ Payment approved`,
      body: `Your manual payment of ₹${amount} has been approved and credited to your wallet.`,
      icon: 'checkmark-circle',
      actionUrl: `/wallet`,
      notificationType: 'manual_payment_approved'
    });
  }

  /** Manual payment rejected */
  static async notifyManualPaymentRejected(userId: string, amount: number, reason: string) {
    await this.createSafe({
      userId,
      title: `❌ Payment rejected`,
      body: `Your manual payment of ₹${amount} was rejected. Reason: ${reason}`,
      icon: 'close-circle',
      actionUrl: `/wallet`,
      notificationType: 'manual_payment_rejected'
    });
  }
  // --- New convenience methods for email+in-app parity ---

  static async notifyJobRecommendations(userId: string, firstName: string, jobCount: number) {
    await this.createSafe({
      userId,
      title: `💼 ${jobCount} new jobs for you`,
      body: `Hey ${firstName}, ${jobCount} new jobs match your profile. Check them out!`,
      icon: 'briefcase',
      actionUrl: '/jobs',
      notificationType: 'job_recommendations',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    });
  }

  static async notifyReferrerDigest(userId: string, firstName: string, companyName: string, openCount: number) {
    await this.createSafe({
      userId,
      title: `⏰ ${openCount} candidate${openCount === 1 ? '' : 's'} waiting`,
      body: `${openCount} candidate${openCount === 1 ? ' is' : 's are'} waiting for your referral at ${companyName}. Earn rewards by helping!`,
      icon: 'people',
      actionUrl: '/provide-referral',
      notificationType: 'referrer_digest',
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
    });
  }

  static async notifyBecomeVerified(userId: string, firstName: string, companyName: string) {
    await this.createSafe({
      userId,
      title: `🏆 Become a verified referrer`,
      body: `${firstName}, get verified at ${companyName} and start earning by referring candidates!`,
      icon: 'shield-checkmark',
      actionUrl: '/get-verified',
      notificationType: 'become_verified',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
  }

  static async notifyReferralExpiring(userId: string, firstName: string, jobTitle: string, companyName: string, requestId: string, timeLeft: string) {
    await this.createSafe({
      userId,
      title: `⏰ Request expiring in ${timeLeft}`,
      body: `Your referral request for ${jobTitle} at ${companyName} expires soon. Consider upgrading to Open to reach more referrers.`,
      icon: 'timer',
      actionUrl: `/referrals/tracking/${requestId}`,
      notificationType: 'referral_expiring',
      referenceId: requestId,
    });
  }
}

export default InAppNotificationService;
