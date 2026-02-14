/**
 * In-App Notification Service
 * 
 * Handles creating, fetching, and managing in-app notifications
 * stored in the InAppNotifications table.
 */

import { dbService } from './database.service';

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
  | 'welcome';

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
      const result = await dbService.executeQuery(`
        INSERT INTO InAppNotifications (
          UserID, Title, Body, Icon, ImageURL, ActionURL, ActionLabel,
          NotificationType, ReferenceID, ExpiresAt
        )
        OUTPUT INSERTED.NotificationID
        VALUES (
          @param0, @param1, @param2, @param3, @param4, @param5, @param6,
          @param7, @param8, @param9
        )
      `, [
        params.userId,
        params.title,
        params.body,
        params.icon || null,
        params.imageUrl || null,
        params.actionUrl || null,
        params.actionLabel || null,
        params.notificationType,
        params.referenceId || null,
        params.expiresAt || null
      ]);

      return result.recordset[0]?.NotificationID;
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

    let whereClause = 'WHERE n.UserID = @param0 AND (n.ExpiresAt IS NULL OR n.ExpiresAt > GETUTCDATE())';
    if (filters.unreadOnly) {
      whereClause += ' AND n.IsRead = 0';
    }

    const result = await dbService.executeQuery(`
      SELECT 
        n.NotificationID,
        n.Title,
        n.Body,
        n.Icon,
        n.ImageURL,
        n.ActionURL,
        n.ActionLabel,
        n.IsRead,
        n.ReadAt,
        n.NotificationType,
        n.ReferenceID,
        n.CreatedAt
      FROM InAppNotifications n
      ${whereClause}
      ORDER BY n.CreatedAt DESC
      OFFSET @param1 ROWS FETCH NEXT @param2 ROWS ONLY
    `, [userId, offset, pageSize]);

    // Get total count
    const countResult = await dbService.executeQuery(`
      SELECT COUNT(*) as total
      FROM InAppNotifications n
      ${whereClause}
    `, [userId]);

    const total = countResult.recordset[0]?.total || 0;

    return {
      notifications: result.recordset,
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
    const result = await dbService.executeQuery(`
      SELECT COUNT(*) as count
      FROM InAppNotifications
      WHERE UserID = @param0 
        AND IsRead = 0
        AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE())
    `, [userId]);

    return result.recordset[0]?.count || 0;
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await dbService.executeQuery(`
      UPDATE InAppNotifications
      SET IsRead = 1, ReadAt = GETUTCDATE()
      WHERE NotificationID = @param0 AND UserID = @param1
    `, [notificationId, userId]);

    return (result.rowsAffected?.[0] ?? 0) > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const result = await dbService.executeQuery(`
      UPDATE InAppNotifications
      SET IsRead = 1, ReadAt = GETUTCDATE()
      WHERE UserID = @param0 AND IsRead = 0
    `, [userId]);

    return result.rowsAffected?.[0] ?? 0;
  }

  /**
   * Delete a single notification for a user
   */
  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await dbService.executeQuery(`
      DELETE FROM InAppNotifications
      WHERE NotificationID = @param0 AND UserID = @param1
    `, [notificationId, userId]);

    return (result.rowsAffected?.[0] ?? 0) > 0;
  }

  /**
   * Delete old notifications (cleanup, called by timer)
   */
  static async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const result = await dbService.executeQuery(`
      DELETE FROM InAppNotifications
      WHERE CreatedAt < DATEADD(DAY, -@param0, GETUTCDATE())
        AND IsRead = 1
    `, [daysOld]);

    return result.rowsAffected?.[0] ?? 0;
  }

  // ========================================
  // CONVENIENCE METHODS FOR CREATING NOTIFICATIONS
  // ========================================

  /** New message received — batches multiple messages from the same conversation into one notification */
  static async notifyNewMessage(receiverUserId: string, senderName: string, messagePreview: string, conversationId: string) {

    try {
      // Check for an existing unread notification for the same conversation
      const existing = await dbService.executeQuery(`
        SELECT NotificationID, Title
        FROM InAppNotifications
        WHERE UserID = @param0
          AND NotificationType = 'message_received'
          AND ReferenceID = @param1
          AND IsRead = 0
        ORDER BY CreatedAt DESC
        OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
      `, [receiverUserId, conversationId]);

      if (existing.recordset.length > 0) {
        // Collapse: update the existing notification with incremented count
        const existingTitle = existing.recordset[0].Title as string;
        const countMatch = existingTitle.match(/^💬 (\d+) new messages from/);
        const currentCount = countMatch ? parseInt(countMatch[1], 10) : 1;
        const newCount = currentCount + 1;

        await dbService.executeQuery(`
          UPDATE InAppNotifications
          SET Title = @param2,
              CreatedAt = GETUTCDATE()
          WHERE NotificationID = @param0 AND UserID = @param1
        `, [
          existing.recordset[0].NotificationID,
          receiverUserId,
          `💬 ${newCount} new messages from ${senderName}`
        ]);
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
      actionUrl: `/referrals?tab=available`,
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
      actionUrl: `/referrals?tab=available`,
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
      actionUrl: `/profile-views`,
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
}

export default InAppNotificationService;
