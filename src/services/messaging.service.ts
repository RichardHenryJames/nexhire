import { MessagingRepository } from '../repositories/messaging.repository';
import { SignalRService } from "./signalr.service";
import { WalletService } from "./wallet.service";
import { PricingService } from "./pricing.service";
import { EmailService } from "./emailService";
import { TemplateService } from "./templateService";
import { maskEmail } from '../utils/encryption';

// Azure SignalR connection string
const SIGNALR_CONNECTION_STRING = process.env.SIGNALR_CONNECTION_STRING || "";

// Admin account email for message notifications
const REFOPEN_ADMIN_EMAIL = "admin@refopen.com";
const ADMIN_NOTIFICATION_EMAIL = "parimalkumar261@gmail.com";

// Cache admin UserID — looked up once by email, works across dev/prod
let _cachedAdminUserId: string | null = null;
async function getPlatformAdminUserId(): Promise<string | null> {
  if (_cachedAdminUserId) return _cachedAdminUserId;
  try {
    const userId = await MessagingRepository.findUserIdByEmail(REFOPEN_ADMIN_EMAIL);
    if (userId) {
      _cachedAdminUserId = userId;
      console.log(`✅ Platform Admin resolved: ${maskEmail(REFOPEN_ADMIN_EMAIL)} → ${_cachedAdminUserId}`);
      return _cachedAdminUserId;
    }
    console.warn(`⚠️ Platform Admin user not found for email: ${maskEmail(REFOPEN_ADMIN_EMAIL)}`);
    return null;
  } catch (err: any) {
    console.error('Error looking up platform admin:', err.message);
    return null;
  }
}

// Welcome message template for new users (Job Seekers only) - single concise message
const getWelcomeMessage = (firstName: string): string => `Hey ${firstName}! 👋
So glad you're here — welcome to **RefOpen!** 🎉

🚀 **125K+ Jobs** — Browse & apply directly. Want an edge? Tap "Ask Referral" → your request reaches **ALL** verified employees at that company.

🤔 **Not sure which company?** Check "Open to any company" — we'll match you with referrers across companies.

🛠️ **Career Tools** — Try our AI Resume Analyzer, Cover Letter AI, Interview Prep & more.

💼 **Already working?** Verify your work email → earn cash for referrals + get priority.

**Follow us:**
![LinkedIn](https://www.google.com/s2/favicons?domain=linkedin.com&sz=32) [LinkedIn](https://www.linkedin.com/company/refopen)
![Instagram](https://www.google.com/s2/favicons?domain=instagram.com&sz=32) [Instagram](https://www.instagram.com/refopensolutions)
![X](https://www.google.com/s2/favicons?domain=x.com&sz=32) [X (Twitter)](https://x.com/refopensolution)

— Team RefOpen 💜`;

interface CreateConversationParams {
  user1Id: string;
  user2Id: string;
}

interface SendMessageParams {
  conversationId: string;
  senderUserId: string;
  content: string;
  messageType?: "Text" | "Image" | "File" | "System";
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentSize?: number;
  attachmentName?: string;
  replyToMessageId?: string;
}

interface GetConversationsParams {
  userId: string;
  page?: number;
  pageSize?: number;
  archived?: boolean;
}

interface GetMessagesParams {
  conversationId: string;
  page?: number;
  pageSize?: number;
  beforeMessageId?: string;
}

export class MessagingService {
  /**
   * Get or create a conversation between two users
   */
  static async getOrCreateConversation(params: CreateConversationParams) {
    const { user1Id, user2Id } = params;

    const { minUserId, maxUserId } = await MessagingRepository.orderUserIds(user1Id, user2Id);

    // Check if conversation already exists
    const existing = await MessagingRepository.findConversation(user1Id, minUserId, maxUserId);

    if (existing) {
      return existing;
    }

    // Create new conversation
    const newConversation = await MessagingRepository.createConversation(minUserId, maxUserId);

    // Get other user info
    const otherUserId = newConversation.User1ID === user1Id ? newConversation.User2ID : newConversation.User1ID;
    const otherUser = await MessagingRepository.getOtherUserInfo(otherUserId);

    return {
      ConversationID: newConversation.ConversationID,
      User1ID: newConversation.User1ID,
      User2ID: newConversation.User2ID,
      LastMessageAt: null,
      LastMessagePreview: null,
      CreatedAt: newConversation.CreatedAt,
      UpdatedAt: newConversation.UpdatedAt,
      IsArchived: false,
      IsMuted: false,
      OtherUserID: otherUser?.UserID || otherUserId,
      OtherUserName: otherUser?.Name || 'Unknown User',
      OtherUserProfilePic: otherUser?.ProfilePictureURL || null,
      OtherUserType: otherUser?.UserType || 'JobSeeker',
    };
  }

  /**
   * Get user's conversations (inbox)
   */
  static async getConversations(params: GetConversationsParams) {
    const { userId, page = 1, pageSize = 50, archived = false } = params;
    const offset = (page - 1) * pageSize;

    const [conversations, total] = await Promise.all([
      MessagingRepository.findConversations(userId, archived, offset, pageSize),
      MessagingRepository.countConversations(userId, archived)
    ]);

    return {
      conversations,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: offset + conversations.length < total,
    };
  }

  /**
   * Send a message - OPTIMIZED FOR SPEED
   */
  static async sendMessage(params: SendMessageParams) {
    const {
      conversationId,
      senderUserId,
      content,
      messageType = "Text",
      attachmentUrl,
      attachmentType,
      attachmentSize,
      attachmentName,
      replyToMessageId,
    } = params;

    // ✅ OPTIMIZATION 1: Single query with OUTPUT to get inserted message + conversation data
    const preview =
      content.length > 200 ? content.substring(0, 197) + "..." : content;

    const newMessage = await MessagingRepository.sendMessage({
      conversationId, senderUserId, content, messageType,
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
      attachmentSize: attachmentSize || null,
      attachmentName: attachmentName || null,
      replyToMessageId: replyToMessageId || null,
      preview
    });

    const receiverUserId = newMessage.ReceiverUserID;

    // Fire SignalR async (don't await - makes API response instant)
    SignalRService.emitNewMessage(conversationId, newMessage, receiverUserId)
      .catch((err) => {
        console.error("SignalR emit error (non-critical):", err.message);
      });

    // 📧 Admin message email notifications (async, non-blocking)
    this.sendAdminMessageNotification(senderUserId, receiverUserId, content)
      .catch((err) => {
        console.error("Admin message email error (non-critical):", err.message);
      });

    // 🔔 In-app notification for new message (async, non-blocking)
    (async () => {
      try {
        const { InAppNotificationService } = await import('./inAppNotification.service');
        // Get sender name
        const sender = await MessagingRepository.getUserName(senderUserId);
        if (sender) {
          const senderName = `${sender.FirstName} ${sender.LastName}`.trim();
          await InAppNotificationService.notifyNewMessage(receiverUserId, senderName, content, conversationId);
        }
      } catch (err: any) {
        console.error("In-app notification error (non-critical):", err.message);
      }
    })();

    // Remove internal field from response
    delete newMessage.ReceiverUserID;

    return newMessage;
  }

  /**
   * Send email notification for admin messages
   * - If admin sends a message → email the recipient
   * - If admin receives a message → email the admin notification address
   */
  private static async sendAdminMessageNotification(
    senderUserId: string,
    receiverUserId: string,
    messageContent: string
  ): Promise<void> {
    try {
      const users = await MessagingRepository.getUsersByIds(senderUserId, receiverUserId);
      const sender = users.find((u: any) => u.UserID === senderUserId);
      const receiver = users.find((u: any) => u.UserID === receiverUserId);
      
      if (!sender || !receiver) return;
      
      const senderEmail = sender.Email?.toLowerCase();
      const receiverEmail = receiver.Email?.toLowerCase();
      const senderName = `${sender.FirstName || ''} ${sender.LastName || ''}`.trim() || 'RefOpen User';
      const receiverName = `${receiver.FirstName || ''} ${receiver.LastName || ''}`.trim() || 'RefOpen User';
      
      const messagePreview = messageContent.length > 300 
        ? messageContent.substring(0, 297) + '...' 
        : messageContent;
      
      // Case 1: Admin (refopen@admin.com) sends a message → email the recipient
      if (senderEmail === REFOPEN_ADMIN_EMAIL.toLowerCase()) {
        console.log(`📧 Admin sent message to ${maskEmail(receiverEmail)}, sending email notification...`);
        
        const template = TemplateService.render('admin_new_message', {
          senderName: 'RefOpen Support',
          messagePreview,
          appUrl: process.env.APP_URL || 'https://www.refopen.com'
        });
        
        await EmailService.send({
          to: receiverEmail,
          subject: template.subject,
          html: template.html,
          emailType: 'admin_message_to_user'
        });
        
        console.log(`✅ Admin message notification sent to ${maskEmail(receiverEmail)}`);
      }
      
      // Case 2: Someone sends a message to admin → email admin notification address
      if (receiverEmail === REFOPEN_ADMIN_EMAIL.toLowerCase()) {
        console.log(`📧 User ${maskEmail(senderEmail)} sent message to admin, notifying ${maskEmail(ADMIN_NOTIFICATION_EMAIL)}...`);
        
        const template = TemplateService.render('admin_new_message', {
          senderName: `${senderName} (${senderEmail})`,
          messagePreview,
          appUrl: process.env.APP_URL || 'https://www.refopen.com'
        });
        
        await EmailService.send({
          to: ADMIN_NOTIFICATION_EMAIL,
          subject: `New message from ${senderName} on RefOpen`,
          html: template.html,
          emailType: 'user_message_to_admin'
        });
        
        console.log(`✅ User message notification sent to admin at ${maskEmail(ADMIN_NOTIFICATION_EMAIL)}`);
      }
    } catch (error: any) {
      console.error('Error sending admin message notification:', error.message);
    }
  }

  /**
   * Get messages in a conversation
   */
  static async getMessages(params: GetMessagesParams) {
    const { conversationId, page = 1, pageSize = 50, beforeMessageId } = params;
    const offset = (page - 1) * pageSize;

    const [messages, total] = await Promise.all([
      MessagingRepository.findMessages(conversationId, offset, pageSize, beforeMessageId),
      MessagingRepository.countMessages(conversationId)
    ]);

    return {
      messages,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: offset + messages.length < total,
    };
  }

  /**
   * Mark message as read
   */
  static async markMessageAsRead(messageId: string, userId: string) {
    await MessagingRepository.markMessageRead(messageId, userId);
    return { success: true };
  }

  /**
   * Mark all messages in conversation as read
   */
  static async markConversationAsRead(conversationId: string, userId: string) {
    // Get sender user ID before marking as read
    const senderUserId = await MessagingRepository.getUnreadSenders(conversationId, userId);

    // Mark messages as read
    const markedCount = await MessagingRepository.markConversationRead(conversationId, userId);

    // ?? NEW: Emit SignalR event to sender
    if (senderUserId && markedCount > 0) {
      try {
        await SignalRService.emitConversationRead(
          conversationId,
          userId,
          senderUserId
        );
      } catch (signalrError) {
        console.error("SignalR emit error (non-critical):", signalrError);
      }
    }

    return {
      success: true,
      markedCount,
    };
  }

  /**
   * Get unread message count
   */
  static async getUnreadCount(userId: string) {
    return await MessagingRepository.getUnreadCount(userId);
  }

  /**
   * Archive/Unarchive conversation
   */
  static async archiveConversation(conversationId: string, userId: string, archive: boolean) {
    await MessagingRepository.setArchived(conversationId, userId, archive);
    return { success: true, archived: archive };
  }

  /**
   * Mute/Unmute conversation
   */
  static async muteConversation(conversationId: string, userId: string, mute: boolean) {
    await MessagingRepository.setMuted(conversationId, userId, mute);
    return { success: true, muted: mute };
  }

  /**
   * Delete message
   */
  static async deleteMessage(messageId: string, userId: string, deleteFor: "Sender" | "Both" = "Sender") {
    await MessagingRepository.deleteMessage(messageId, userId, deleteFor);
    return { success: true, deletedFor: deleteFor };
  }

  /**
   * Block user
   */
  static async blockUser(blockerUserId: string, blockedUserId: string, reason?: string) {
    await MessagingRepository.blockUser(blockerUserId, blockedUserId, reason || null);
    return { success: true, blocked: true };
  }

  /**
   * Unblock user
   */
  static async unblockUser(blockerUserId: string, blockedUserId: string) {
    await MessagingRepository.unblockUser(blockerUserId, blockedUserId);
    return { success: true, blocked: false };
  }

  /**
   * Check if user is blocked
   */
  static async isUserBlocked(user1Id: string, user2Id: string) {
    const isBlocked = await MessagingRepository.isBlocked(user1Id, user2Id);
    return { isBlocked };
  }

  /**
   * Get blocked users
   */
  static async getBlockedUsers(userId: string) {
    return await MessagingRepository.getBlockedUsers(userId);
  }

  /**
   * Record profile view
   * Skip recording if viewer is admin (users shouldn't see admin views)
   */
  static async recordProfileView(
    viewerUserId: string,
    viewedUserId: string,
    deviceType?: string
  ) {
    // Don't record if viewing own profile
    if (viewerUserId === viewedUserId) {
      return { success: true, recorded: false };
    }

    // Check if viewer is an admin - don't record admin views
    const viewerType = await MessagingRepository.getUserType(viewerUserId);
    if (viewerType === 'Admin') {
      return { success: true, recorded: false, reason: 'admin_viewer' };
    }

    await MessagingRepository.insertProfileView(viewerUserId, viewedUserId, deviceType || 'Web');

    return { success: true, recorded: true };
  }

  /**
   * Get profile views - optimized with single query
   */
  static async getProfileViews(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;

    const { views: rawViews, total } = await MessagingRepository.findProfileViews(userId, offset, pageSize);

    // Remove TotalCount from each row to keep response clean
    const views = rawViews.map(({ TotalCount, ...view }: any) => view);

    return {
      views,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Check if user has active profile view access (paid within configured duration)
   */
  static async hasActiveProfileViewAccess(userId: string): Promise<boolean> {
    try {
      const profileViewCost = await PricingService.getProfileViewCost();
      const accessDurationHours = await PricingService.getProfileViewAccessDurationHours();
      return await MessagingRepository.hasActiveProfileViewAccess(userId, profileViewCost, accessDurationHours);
    } catch (error) {
      console.error('Error checking profile view access:', error);
      return false;
    }
  }

  /**
   * Purchase profile view access
   */
  static async purchaseProfileViewAccess(userId: string) {
    const profileViewCost = await PricingService.getProfileViewCost();
    const accessDurationHours = await PricingService.getProfileViewAccessDurationHours();
    const durationDays = Math.floor(accessDurationHours / 24);

    // Check if already has access
    const hasAccess = await this.hasActiveProfileViewAccess(userId);
    if (hasAccess) {
      return { 
        success: true, 
        alreadyHadAccess: true, 
        message: 'You already have active profile view access' 
      };
    }

    // Check wallet balance
    const wallet = await WalletService.getOrCreateWallet(userId);
    if (wallet.Balance < profileViewCost) {
      return {
        success: false,
        error: 'Insufficient balance',
        currentBalance: wallet.Balance,
        requiredAmount: profileViewCost
      };
    }

    // Deduct from wallet
    await WalletService.debitWallet(
      userId,
      profileViewCost,
      'Profile_View_Access',
      `Unlock profile views - ${durationDays}-day access`
    );

    return {
      success: true,
      alreadyHadAccess: false,
      message: `Profile view access unlocked for ${durationDays} days`,
      newBalance: wallet.Balance - profileViewCost
    };
  }

  /**
   * Send welcome message from Platform Admin to new user
   * Called during user registration - skips email notification
   * Sends a single concise welcome message
   */
  static async sendWelcomeMessageToNewUser(newUserId: string, firstName: string): Promise<void> {
    try {
      console.log(`📨 Sending welcome message to new user: ${newUserId}`);

      // Look up admin by email — works in any environment
      const adminUserId = await getPlatformAdminUserId();
      if (!adminUserId) {
        console.error('Cannot send welcome message: Platform Admin user not found in DB');
        return;
      }
      
      // Get or create conversation between admin and new user
      const conversation = await this.getOrCreateConversation({
        user1Id: adminUserId,
        user2Id: newUserId
      });
      
      if (!conversation?.ConversationID) {
        console.error('Failed to create conversation for welcome message');
        return;
      }
      
      // Generate personalized welcome message
      const welcomeMessage = getWelcomeMessage(firstName || 'there');
      
      const preview = welcomeMessage.length > 200 
        ? welcomeMessage.substring(0, 197) + "..." 
        : welcomeMessage;
      
      await MessagingRepository.insertSystemMessage(
        conversation.ConversationID, adminUserId, welcomeMessage, preview
      );

      // 🔔 In-app notification for welcome message
      try {
        const { InAppNotificationService } = await import('./inAppNotification.service');
        await InAppNotificationService.notifyNewMessage(
          newUserId,
          'RefOpen Support',
          preview,
          conversation.ConversationID
        );
      } catch (notifErr: any) {
        console.error('Welcome notification error (non-critical):', notifErr.message);
      }
      
      console.log(`✅ Welcome message sent to user ${newUserId}`);
    } catch (error: any) {
      // Don't fail registration if welcome message fails
      console.error('Error sending welcome message (non-critical):', error.message);
    }
  }
}
