import { dbService } from "./database.service";
import { SignalRService } from "./signalr.service";
import { WalletService } from "./wallet.service";
import { PricingService } from "./pricing.service";

// Azure SignalR connection string
const SIGNALR_CONNECTION_STRING = process.env.SIGNALR_CONNECTION_STRING || "";

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

    // Use SQL Server to determine correct GUID ordering (SQL GUIDs are compared differently than strings)
    const orderQuery = `
    SELECT 
    CASE WHEN CAST(@param0 AS UNIQUEIDENTIFIER) < CAST(@param1 AS UNIQUEIDENTIFIER) 
       THEN @param0 ELSE @param1 END as MinUserId,
   CASE WHEN CAST(@param0 AS UNIQUEIDENTIFIER) < CAST(@param1 AS UNIQUEIDENTIFIER) 
    THEN @param1 ELSE @param0 END as MaxUserId
    `;

    const orderResult = await dbService.executeQuery(orderQuery, [
      user1Id,
      user2Id,
    ]);
    const minUserId = orderResult.recordset[0].MinUserId;
    const maxUserId = orderResult.recordset[0].MaxUserId;

    // Check if conversation already exists
    const existingQuery = `
 SELECT 
     c.ConversationID,
    c.User1ID,
  c.User2ID,
             c.LastMessageAt,
          c.LastMessagePreview,
      c.CreatedAt,
       c.UpdatedAt,
       CASE WHEN c.User1ID = @param0 THEN c.IsArchived1 ELSE c.IsArchived2 END as IsArchived,
 CASE WHEN c.User1ID = @param0 THEN c.IsMuted1 ELSE c.IsMuted2 END as IsMuted,
          -- Get other user info
      u.UserID as OtherUserID,
      u.FirstName + ' ' + u.LastName as OtherUserName,
  u.ProfilePictureURL as OtherUserProfilePic,
            u.UserType as OtherUserType
  FROM Conversations c
 LEFT JOIN Users u ON u.UserID = CASE 
          WHEN c.User1ID = @param0 THEN c.User2ID 
      ELSE c.User1ID 
    END
     WHERE c.User1ID = @param1 AND c.User2ID = @param2
 `;

    const existing = await dbService.executeQuery(existingQuery, [
      user1Id,
      minUserId,
      maxUserId,
    ]);

    if (existing.recordset && existing.recordset.length > 0) {
      return existing.recordset[0];
    }

    // Create new conversation
    const createQuery = `
  INSERT INTO Conversations (User1ID, User2ID, CreatedAt, UpdatedAt)
  OUTPUT 
           INSERTED.ConversationID,
      INSERTED.User1ID,
       INSERTED.User2ID,
     INSERTED.CreatedAt,
    INSERTED.UpdatedAt
     VALUES (@param0, @param1, GETUTCDATE(), GETUTCDATE())
        `;

    const result = await dbService.executeQuery(createQuery, [
      minUserId,
      maxUserId,
    ]);
    const newConversation = result.recordset[0];

    // Get other user info
    const otherUserId =
      newConversation.User1ID === user1Id
        ? newConversation.User2ID
        : newConversation.User1ID;
    const userInfoQuery = `
          SELECT 
     UserID,
      FirstName + ' ' + LastName as Name,
  ProfilePictureURL,
  UserType
            FROM Users
  WHERE UserID = @param0
   `;

    const userInfo = await dbService.executeQuery(userInfoQuery, [otherUserId]);

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
      OtherUserID: userInfo.recordset[0].UserID,
      OtherUserName: userInfo.recordset[0].Name,
      OtherUserProfilePic: userInfo.recordset[0].ProfilePictureURL,
      OtherUserType: userInfo.recordset[0].UserType,
    };
  }

  /**
   * Get user's conversations (inbox)
   */
  static async getConversations(params: GetConversationsParams) {
    const { userId, page = 1, pageSize = 50, archived = false } = params;
    const offset = (page - 1) * pageSize;

    const query = `
   SELECT 
            c.ConversationID,
        c.LastMessageAt,
                c.LastMessagePreview,
       c.LastMessageSenderID,
            c.UpdatedAt,
                CASE WHEN c.User1ID = @param0 THEN c.IsArchived1 ELSE c.IsArchived2 END as IsArchived,
            CASE WHEN c.User1ID = @param0 THEN c.IsMuted1 ELSE c.IsMuted2 END as IsMuted,
          -- Other user info
     u.UserID as OtherUserID,
        u.FirstName + ' ' + u.LastName as OtherUserName,
     u.ProfilePictureURL as OtherUserProfilePic,
            u.UserType as OtherUserType,
       -- Unread count
            ISNULL(unread.UnreadCount, 0) as UnreadCount
            FROM Conversations c
    LEFT JOIN Users u ON u.UserID = CASE 
    WHEN c.User1ID = @param0 THEN c.User2ID 
        ELSE c.User1ID 
   END
     LEFT JOIN (
             SELECT 
        ConversationID,
        COUNT(*) as UnreadCount
    FROM Messages
        WHERE SenderUserID != @param0 
                AND IsRead = 0 
       AND IsDeleted = 0
         GROUP BY ConversationID
            ) unread ON unread.ConversationID = c.ConversationID
          WHERE (c.User1ID = @param0 OR c.User2ID = @param0)
        AND (
     (c.User1ID = @param0 AND c.IsArchived1 = @param1) OR
       (c.User2ID = @param0 AND c.IsArchived2 = @param1)
     )
    ORDER BY c.UpdatedAt DESC
        OFFSET @param2 ROWS FETCH NEXT @param3 ROWS ONLY
        `;

    const result = await dbService.executeQuery(query, [
      userId,
      archived ? 1 : 0,
      offset,
      pageSize,
    ]);

    // Get total count
    const countQuery = `
            SELECT COUNT(*) as Total
            FROM Conversations c
            WHERE (c.User1ID = @param0 OR c.User2ID = @param0)
              AND (
     (c.User1ID = @param0 AND c.IsArchived1 = @param1) OR
 (c.User2ID = @param0 AND c.IsArchived2 = @param1)
         )
        `;

    const countResult = await dbService.executeQuery(countQuery, [
      userId,
      archived ? 1 : 0,
    ]);
    const total = countResult.recordset[0].Total;

    return {
      conversations: result.recordset || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: offset + result.recordset.length < total,
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

    const combinedQuery = `
    DECLARE @MessageID NVARCHAR(50);
    DECLARE @User1ID NVARCHAR(50);
    DECLARE @User2ID NVARCHAR(50);
    
    -- Insert message
    INSERT INTO Messages (
      ConversationID, 
      SenderUserID, 
      Content, 
      MessageType,
      AttachmentURL,
      AttachmentType,
      AttachmentSize,
      AttachmentName,
      ReplyToMessageID,
      CreatedAt
    )
    VALUES (
      @param0, @param1, @param2, @param3, @param4, @param5, @param6, @param7, @param8, GETUTCDATE()
    );
    
    SET @MessageID = (SELECT TOP 1 MessageID FROM Messages WHERE ConversationID = @param0 AND SenderUserID = @param1 ORDER BY CreatedAt DESC);
    
    -- Get conversation users
    SELECT 
      @User1ID = User1ID,
      @User2ID = User2ID
    FROM Conversations 
    WHERE ConversationID = @param0;
    
    -- 🆕 FIX: Un-archive conversation for receiver when new message arrives
    -- This ensures the conversation reappears in their inbox
    UPDATE Conversations
    SET 
      LastMessageAt = GETUTCDATE(),
      LastMessagePreview = @param9,
      LastMessageSenderID = @param1,
    UpdatedAt = GETUTCDATE(),
      -- Un-archive for the receiver (not the sender)
      IsArchived1 = CASE WHEN User1ID != @param1 THEN 0 ELSE IsArchived1 END,
      IsArchived2 = CASE WHEN User2ID != @param1 THEN 0 ELSE IsArchived2 END
    WHERE ConversationID = @param0;
    
    -- Return everything in one result
    SELECT 
      @MessageID as MessageID,
      @param0 as ConversationID,
      @param1 as SenderUserID,
      @param2 as Content,
      @param3 as MessageType,
      @param4 as AttachmentURL,
      0 as IsRead,
      0 as IsDeleted,
      GETUTCDATE() as CreatedAt,
      CASE WHEN @User1ID = @param1 THEN @User2ID ELSE @User1ID END as ReceiverUserID
    `;

    // Execute as single batch query for performance
    const result = await dbService.executeQuery(combinedQuery, [
      conversationId,
      senderUserId,
      content,
      messageType,
      attachmentUrl || null,
      attachmentType || null,
      attachmentSize || null,
      attachmentName || null,
      replyToMessageId || null,
      preview, // @param9
    ]);

    const newMessage = result.recordset[0];
    const receiverUserId = newMessage.ReceiverUserID;

    // Fire SignalR async (don't await - makes API response instant)
    SignalRService.emitNewMessage(conversationId, newMessage, receiverUserId)
      .catch((err) => {
        console.error("SignalR emit error (non-critical):", err.message);
      });

    // Remove internal field from response
    delete newMessage.ReceiverUserID;

    return newMessage;
  }

  /**
   * Get messages in a conversation
   */
  static async getMessages(params: GetMessagesParams) {
    const { conversationId, page = 1, pageSize = 50, beforeMessageId } = params;
    const offset = (page - 1) * pageSize;

    let query = `
            SELECT 
             m.MessageID,
   m.ConversationID,
    m.SenderUserID,
                m.Content,
    m.MessageType,
          m.AttachmentURL,
       m.AttachmentType,
      m.AttachmentSize,
     m.AttachmentName,
     m.IsRead,
       m.ReadAt,
          m.IsEdited,
   m.EditedAt,
         m.IsDeleted,
      m.DeletedFor,
      m.ReplyToMessageID,
   m.CreatedAt,
    -- Sender info
         u.FirstName + ' ' + u.LastName as SenderName,
           u.ProfilePictureURL as SenderProfilePic
         FROM Messages m
          INNER JOIN Users u ON u.UserID = m.SenderUserID
            WHERE m.ConversationID = @param0
      AND m.IsDeleted = 0
        `;

    const queryParams: any[] = [conversationId];
    let paramIndex = 1;

    if (beforeMessageId) {
      query += ` AND m.CreatedAt < (SELECT CreatedAt FROM Messages WHERE MessageID = @param${paramIndex})`;
      queryParams.push(beforeMessageId);
      paramIndex++;
    }

    query += `
ORDER BY m.CreatedAt DESC
            OFFSET @param${paramIndex} ROWS FETCH NEXT @param${
      paramIndex + 1
    } ROWS ONLY
        `;

    queryParams.push(offset, pageSize);

    const result = await dbService.executeQuery(query, queryParams);

    // Get total count
    const countQuery = `
SELECT COUNT(*) as Total
         FROM Messages
  WHERE ConversationID = @param0 AND IsDeleted = 0
   `;

    const countResult = await dbService.executeQuery(countQuery, [
      conversationId,
    ]);
    const total = countResult.recordset[0].Total;

    return {
      messages: result.recordset || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: offset + result.recordset.length < total,
    };
  }

  /**
   * Mark message as read
   */
  static async markMessageAsRead(messageId: string, userId: string) {
    // Only mark as read if user is the receiver (not sender)
    const query = `
            UPDATE Messages
 SET IsRead = 1, ReadAt = GETUTCDATE()
            WHERE MessageID = @param0 
              AND SenderUserID != @param1
            AND IsRead = 0
`;

    await dbService.executeQuery(query, [messageId, userId]);

    return { success: true };
  }

  /**
   * Mark all messages in conversation as read
   */
  static async markConversationAsRead(conversationId: string, userId: string) {
    // Get sender user ID before marking as read
    const messagesQuery = `
  SELECT DISTINCT SenderUserID 
      FROM Messages 
    WHERE ConversationID = @param0 
        AND SenderUserID != @param1
        AND IsRead = 0
  `;

    const senderResult = await dbService.executeQuery(messagesQuery, [
      conversationId,
      userId,
    ]);
    const senderUserId =
      senderResult.recordset && senderResult.recordset.length > 0
        ? senderResult.recordset[0].SenderUserID
        : null;

    // Mark messages as read
    const query = `
 UPDATE Messages
 SET IsRead = 1, ReadAt = GETUTCDATE()
 WHERE ConversationID = @param0 
  AND SenderUserID != @param1
         AND IsRead = 0
        `;

    const result = await dbService.executeQuery(query, [
      conversationId,
      userId,
    ]);

    const markedCount = result.rowsAffected ? result.rowsAffected[0] : 0;

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
    const query = `
            SELECT 
      COUNT(*) as TotalUnread,
          COUNT(DISTINCT m.ConversationID) as UnreadConversations
    FROM Messages m
    INNER JOIN Conversations c ON c.ConversationID = m.ConversationID
    WHERE (c.User1ID = @param0 OR c.User2ID = @param0)
       AND m.SenderUserID != @param0
   AND m.IsRead = 0
  AND m.IsDeleted = 0
      -- 🆕 FIX: Only count unread messages from non-archived conversations
      AND (
        (c.User1ID = @param0 AND c.IsArchived1 = 0) OR
        (c.User2ID = @param0 AND c.IsArchived2 = 0)
      )
 `;

    const result = await dbService.executeQuery(query, [userId]);

    return result.recordset[0];
  }

  /**
   * Archive/Unarchive conversation
   */
  static async archiveConversation(
    conversationId: string,
    userId: string,
    archive: boolean
  ) {
    const query = `
            UPDATE Conversations
            SET 
         IsArchived1 = CASE WHEN User1ID = @param0 THEN @param2 ELSE IsArchived1 END,
      IsArchived2 = CASE WHEN User2ID = @param0 THEN @param2 ELSE IsArchived2 END
         WHERE ConversationID = @param1
        `;

    await dbService.executeQuery(query, [
      userId,
      conversationId,
      archive ? 1 : 0,
    ]);

    return { success: true, archived: archive };
  }

  /**
   * Mute/Unmute conversation
   */
  static async muteConversation(
    conversationId: string,
    userId: string,
    mute: boolean
  ) {
    const query = `
         UPDATE Conversations
   SET 
  IsMuted1 = CASE WHEN User1ID = @param0 THEN @param2 ELSE IsMuted1 END,
     IsMuted2 = CASE WHEN User2ID = @param0 THEN @param2 ELSE IsMuted2 END
            WHERE ConversationID = @param1
     `;

    await dbService.executeQuery(query, [userId, conversationId, mute ? 1 : 0]);

    return { success: true, muted: mute };
  }

  /**
   * Delete message
   */
  static async deleteMessage(
    messageId: string,
    userId: string,
    deleteFor: "Sender" | "Both" = "Sender"
  ) {
    const query = `
            UPDATE Messages
     SET 
     IsDeleted = 1,
      DeletedAt = GETUTCDATE(),
    DeletedFor = @param2
            WHERE MessageID = @param0 
         AND SenderUserID = @param1
        `;

    await dbService.executeQuery(query, [messageId, userId, deleteFor]);

    return { success: true, deletedFor: deleteFor };
  }

  /**
   * Block user
   */
  static async blockUser(
    blockerUserId: string,
    blockedUserId: string,
    reason?: string
  ) {
    const query = `
 IF NOT EXISTS (SELECT 1 FROM BlockedUsers WHERE BlockerUserID = @param0 AND BlockedUserID = @param1)
            BEGIN
  INSERT INTO BlockedUsers (BlockerUserID, BlockedUserID, Reason, BlockedAt)
             VALUES (@param0, @param1, @param2, GETUTCDATE())
 END
        `;

    await dbService.executeQuery(query, [
      blockerUserId,
      blockedUserId,
      reason || null,
    ]);

    return { success: true, blocked: true };
  }

  /**
   * Unblock user
   */
  static async unblockUser(blockerUserId: string, blockedUserId: string) {
    const query = `
            DELETE FROM BlockedUsers
         WHERE BlockerUserID = @param0 AND BlockedUserID = @param1
        `;

    await dbService.executeQuery(query, [blockerUserId, blockedUserId]);

    return { success: true, blocked: false };
  }

  /**
   * Check if user is blocked
   */
  static async isUserBlocked(user1Id: string, user2Id: string) {
    const query = `
     SELECT 
   CASE 
 WHEN EXISTS (
     SELECT 1 FROM BlockedUsers 
            WHERE (BlockerUserID = @param0 AND BlockedUserID = @param1)
           OR (BlockerUserID = @param1 AND BlockedUserID = @param0)
             ) THEN 1
           ELSE 0
            END as IsBlocked
        `;

    const result = await dbService.executeQuery(query, [user1Id, user2Id]);

    return { isBlocked: result.recordset[0].IsBlocked === 1 };
  }

  /**
   * Get blocked users
   */
  static async getBlockedUsers(userId: string) {
    const query = `
       SELECT 
      bu.BlockID,
           bu.BlockedUserID,
         bu.Reason,
     bu.BlockedAt,
  u.FirstName + ' ' + u.LastName as BlockedUserName,
       u.ProfilePictureURL as BlockedUserProfilePic
            FROM BlockedUsers bu
      INNER JOIN Users u ON u.UserID = bu.BlockedUserID
            WHERE bu.BlockerUserID = @param0
  ORDER BY bu.BlockedAt DESC
        `;

    const result = await dbService.executeQuery(query, [userId]);

    return result.recordset || [];
  }

  /**
   * Record profile view
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

    const query = `
       INSERT INTO UserProfileViews (ViewerUserID, ViewedUserID, ViewedAt, DeviceType)
          VALUES (@param0, @param1, GETUTCDATE(), @param2)
        `;

    await dbService.executeQuery(query, [
      viewerUserId,
      viewedUserId,
      deviceType || "Web",
    ]);

    return { success: true, recorded: true };
  }

  /**
   * Get profile views
   */
  static async getProfileViews(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;

    const query = `
            SELECT 
    pv.ViewID,
      pv.ViewerUserID,
                pv.ViewedAt,
  pv.DeviceType,
                u.FirstName + ' ' + u.LastName as ViewerName,
   u.ProfilePictureURL as ViewerProfilePic,
  u.UserType as ViewerUserType
       FROM UserProfileViews pv
            INNER JOIN Users u ON u.UserID = pv.ViewerUserID
WHERE pv.ViewedUserID = @param0
    ORDER BY pv.ViewedAt DESC
            OFFSET @param1 ROWS FETCH NEXT @param2 ROWS ONLY
        `;

    const result = await dbService.executeQuery(query, [
      userId,
      offset,
      pageSize,
    ]);

    // Get total count
    const countQuery = `
            SELECT COUNT(*) as Total
            FROM UserProfileViews
      WHERE ViewedUserID = @param0
        `;

    const countResult = await dbService.executeQuery(countQuery, [userId]);
    const total = countResult.recordset[0].Total;

    return {
      views: result.recordset || [],
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

      const query = `
        SELECT TOP 1 wt.CreatedAt
        FROM WalletTransactions wt
        INNER JOIN Wallets w ON wt.WalletID = w.WalletID
        WHERE w.UserID = @param0
          AND wt.Source = 'Profile_View_Access'
          AND wt.TransactionType = 'Debit'
          AND wt.Amount = @param1
          AND wt.CreatedAt >= DATEADD(HOUR, -@param2, GETDATE())
        ORDER BY wt.CreatedAt DESC
      `;

      const result = await dbService.executeQuery(query, [userId, profileViewCost, accessDurationHours]);
      return result.recordset && result.recordset.length > 0;
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
}
