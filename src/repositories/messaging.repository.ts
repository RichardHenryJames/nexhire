/**
 * Messaging Repository — Single source of truth for Conversations, Messages,
 * BlockedUsers, and UserProfileViews table queries.
 *
 * WHY THIS EXISTS:
 *  - messaging.service.ts mixed SignalR, email, business logic and ~25 SQL queries
 *  - This centralises every SQL statement for testability and single ownership
 *
 * RULES:
 *  1. Only this repository should write raw SQL for messaging tables.
 *  2. Services call repository methods — never dbService directly.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class MessagingRepository {

    // ═══════════════════════════════════════════════════════════
    //  USER LOOKUPS (lightweight helpers)
    // ═══════════════════════════════════════════════════════════

    /** Find admin UserID by email. */
    static async findUserIdByEmail(email: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT UserID FROM Users WHERE Email = @param0 AND IsActive = 1`,
            [email]
        );
        return result.recordset?.[0]?.UserID ?? null;
    }

    /** Get sender name (FirstName, LastName). */
    static async getUserName(userId: string): Promise<{ FirstName: string; LastName: string } | null> {
        const result = await dbService.executeQuery(
            `SELECT FirstName, LastName FROM Users WHERE UserID = @param0`,
            [userId]
        );
        return result.recordset?.[0] ?? null;
    }

    /** Get sender + receiver user details. */
    static async getUsersByIds(id1: string, id2: string): Promise<any[]> {
        const result = await dbService.executeQuery(
            `SELECT UserID, Email, FirstName, LastName FROM Users WHERE UserID IN (@param0, @param1)`,
            [id1, id2]
        );
        return result.recordset || [];
    }

    /** Get user type (for admin check). */
    static async getUserType(userId: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT UserType FROM Users WHERE UserID = @param0`,
            [userId]
        );
        return result.recordset?.[0]?.UserType ?? null;
    }

    // ═══════════════════════════════════════════════════════════
    //  CONVERSATIONS
    // ═══════════════════════════════════════════════════════════

    /** SQL Server GUID ordering to get deterministic User1/User2. */
    static async orderUserIds(id1: string, id2: string): Promise<{ minUserId: string; maxUserId: string }> {
        const result = await dbService.executeQuery(`
            SELECT 
                CASE WHEN CAST(@param0 AS UNIQUEIDENTIFIER) < CAST(@param1 AS UNIQUEIDENTIFIER) THEN @param0 ELSE @param1 END as MinUserId,
                CASE WHEN CAST(@param0 AS UNIQUEIDENTIFIER) < CAST(@param1 AS UNIQUEIDENTIFIER) THEN @param1 ELSE @param0 END as MaxUserId
        `, [id1, id2]);
        return { minUserId: result.recordset[0].MinUserId, maxUserId: result.recordset[0].MaxUserId };
    }

    /** Find existing conversation by ordered user IDs. */
    static async findConversation(requesterId: string, minUserId: string, maxUserId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT c.ConversationID, c.User1ID, c.User2ID, c.LastMessageAt, c.LastMessagePreview,
                c.CreatedAt, c.UpdatedAt,
                CASE WHEN c.User1ID = @param0 THEN c.IsArchived1 ELSE c.IsArchived2 END as IsArchived,
                CASE WHEN c.User1ID = @param0 THEN c.IsMuted1 ELSE c.IsMuted2 END as IsMuted,
                u.UserID as OtherUserID,
                u.FirstName + ' ' + u.LastName as OtherUserName,
                u.ProfilePictureURL as OtherUserProfilePic,
                u.UserType as OtherUserType
            FROM Conversations c
            LEFT JOIN Users u ON u.UserID = CASE WHEN c.User1ID = @param0 THEN c.User2ID ELSE c.User1ID END
            WHERE c.User1ID = @param1 AND c.User2ID = @param2
        `, [requesterId, minUserId, maxUserId]);
        return result.recordset?.[0] ?? null;
    }

    /** Create a new conversation. Returns inserted row. */
    static async createConversation(minUserId: string, maxUserId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            INSERT INTO Conversations (User1ID, User2ID, CreatedAt, UpdatedAt)
            OUTPUT INSERTED.ConversationID, INSERTED.User1ID, INSERTED.User2ID, INSERTED.CreatedAt, INSERTED.UpdatedAt
            VALUES (@param0, @param1, GETUTCDATE(), GETUTCDATE())
        `, [minUserId, maxUserId]);
        return result.recordset[0];
    }

    /** Get other user info for a conversation. */
    static async getOtherUserInfo(otherUserId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT UserID, FirstName + ' ' + LastName as Name, ProfilePictureURL, UserType
            FROM Users WHERE UserID = @param0
        `, [otherUserId]);
        return result.recordset?.[0] ?? null;
    }

    /** Get paginated conversations (inbox). */
    static async findConversations(userId: string, archived: boolean, offset: number, pageSize: number): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT c.ConversationID, c.LastMessageAt, c.LastMessagePreview, c.LastMessageSenderID, c.UpdatedAt,
                CASE WHEN c.User1ID = @param0 THEN c.IsArchived1 ELSE c.IsArchived2 END as IsArchived,
                CASE WHEN c.User1ID = @param0 THEN c.IsMuted1 ELSE c.IsMuted2 END as IsMuted,
                u.UserID as OtherUserID, u.FirstName + ' ' + u.LastName as OtherUserName,
                u.ProfilePictureURL as OtherUserProfilePic, u.UserType as OtherUserType,
                ISNULL(unread.UnreadCount, 0) as UnreadCount
            FROM Conversations c
            LEFT JOIN Users u ON u.UserID = CASE WHEN c.User1ID = @param0 THEN c.User2ID ELSE c.User1ID END
            LEFT JOIN (
                SELECT ConversationID, COUNT(*) as UnreadCount FROM Messages
                WHERE SenderUserID != @param0 AND IsRead = 0 AND IsDeleted = 0 GROUP BY ConversationID
            ) unread ON unread.ConversationID = c.ConversationID
            WHERE (c.User1ID = @param0 OR c.User2ID = @param0)
                AND ((c.User1ID = @param0 AND c.IsArchived1 = @param1) OR (c.User2ID = @param0 AND c.IsArchived2 = @param1))
            ORDER BY c.UpdatedAt DESC
            OFFSET @param2 ROWS FETCH NEXT @param3 ROWS ONLY
        `, [userId, archived ? 1 : 0, offset, pageSize]);
        return result.recordset || [];
    }

    /** Count conversations for a user. */
    static async countConversations(userId: string, archived: boolean): Promise<number> {
        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as Total FROM Conversations c
            WHERE (c.User1ID = @param0 OR c.User2ID = @param0)
                AND ((c.User1ID = @param0 AND c.IsArchived1 = @param1) OR (c.User2ID = @param0 AND c.IsArchived2 = @param1))
        `, [userId, archived ? 1 : 0]);
        return result.recordset[0]?.Total ?? 0;
    }

    /** Archive/unarchive a conversation for a user. */
    static async setArchived(conversationId: string, userId: string, archive: boolean): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Conversations SET
                IsArchived1 = CASE WHEN User1ID = @param0 THEN @param2 ELSE IsArchived1 END,
                IsArchived2 = CASE WHEN User2ID = @param0 THEN @param2 ELSE IsArchived2 END
            WHERE ConversationID = @param1
        `, [userId, conversationId, archive ? 1 : 0]);
    }

    /** Mute/unmute a conversation for a user. */
    static async setMuted(conversationId: string, userId: string, mute: boolean): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Conversations SET
                IsMuted1 = CASE WHEN User1ID = @param0 THEN @param2 ELSE IsMuted1 END,
                IsMuted2 = CASE WHEN User2ID = @param0 THEN @param2 ELSE IsMuted2 END
            WHERE ConversationID = @param1
        `, [userId, conversationId, mute ? 1 : 0]);
    }

    // ═══════════════════════════════════════════════════════════
    //  MESSAGES
    // ═══════════════════════════════════════════════════════════

    /** Send a message — combined INSERT + UPDATE conversation + return in one batch. */
    static async sendMessage(params: {
        conversationId: string;
        senderUserId: string;
        content: string;
        messageType: string;
        attachmentUrl: string | null;
        attachmentType: string | null;
        attachmentSize: number | null;
        attachmentName: string | null;
        replyToMessageId: string | null;
        preview: string;
    }): Promise<any> {
        const result = await dbService.executeQuery(`
            DECLARE @MessageID NVARCHAR(50);
            DECLARE @User1ID NVARCHAR(50);
            DECLARE @User2ID NVARCHAR(50);
            INSERT INTO Messages (ConversationID, SenderUserID, Content, MessageType,
                AttachmentURL, AttachmentType, AttachmentSize, AttachmentName, ReplyToMessageID, CreatedAt)
            VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6, @param7, @param8, GETUTCDATE());
            SET @MessageID = (SELECT TOP 1 MessageID FROM Messages WHERE ConversationID = @param0 AND SenderUserID = @param1 ORDER BY CreatedAt DESC);
            SELECT @User1ID = User1ID, @User2ID = User2ID FROM Conversations WHERE ConversationID = @param0;
            UPDATE Conversations SET LastMessageAt = GETUTCDATE(), LastMessagePreview = @param9,
                LastMessageSenderID = @param1, UpdatedAt = GETUTCDATE(),
                IsArchived1 = CASE WHEN User1ID != @param1 THEN 0 ELSE IsArchived1 END,
                IsArchived2 = CASE WHEN User2ID != @param1 THEN 0 ELSE IsArchived2 END
            WHERE ConversationID = @param0;
            SELECT @MessageID as MessageID, @param0 as ConversationID, @param1 as SenderUserID,
                @param2 as Content, @param3 as MessageType, @param4 as AttachmentURL,
                0 as IsRead, 0 as IsDeleted, GETUTCDATE() as CreatedAt,
                CASE WHEN @User1ID = @param1 THEN @User2ID ELSE @User1ID END as ReceiverUserID
        `, [
            params.conversationId, params.senderUserId, params.content, params.messageType,
            params.attachmentUrl, params.attachmentType, params.attachmentSize,
            params.attachmentName, params.replyToMessageId, params.preview
        ]);
        return result.recordset[0];
    }

    /** Insert a welcome/system message + update conversation. */
    static async insertSystemMessage(conversationId: string, senderUserId: string, content: string, preview: string): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO Messages (ConversationID, SenderUserID, Content, MessageType, CreatedAt)
            VALUES (@param0, @param1, @param2, 'Text', GETUTCDATE());
            UPDATE Conversations SET LastMessageAt = GETUTCDATE(), LastMessagePreview = @param3,
                LastMessageSenderID = @param1, UpdatedAt = GETUTCDATE()
            WHERE ConversationID = @param0;
        `, [conversationId, senderUserId, content, preview]);
    }

    /** Get paginated messages in a conversation. */
    static async findMessages(conversationId: string, offset: number, pageSize: number, beforeMessageId?: string): Promise<any[]> {
        let query = `
            SELECT m.MessageID, m.ConversationID, m.SenderUserID, m.Content, m.MessageType,
                m.AttachmentURL, m.AttachmentType, m.AttachmentSize, m.AttachmentName,
                m.IsRead, m.ReadAt, m.IsEdited, m.EditedAt, m.IsDeleted, m.DeletedFor,
                m.ReplyToMessageID, m.CreatedAt,
                u.FirstName + ' ' + u.LastName as SenderName, u.ProfilePictureURL as SenderProfilePic
            FROM Messages m
            INNER JOIN Users u ON u.UserID = m.SenderUserID
            WHERE m.ConversationID = @param0 AND m.IsDeleted = 0
        `;
        const params: any[] = [conversationId];
        let idx = 1;
        if (beforeMessageId) {
            query += ` AND m.CreatedAt < (SELECT CreatedAt FROM Messages WHERE MessageID = @param${idx})`;
            params.push(beforeMessageId);
            idx++;
        }
        query += ` ORDER BY m.CreatedAt DESC OFFSET @param${idx} ROWS FETCH NEXT @param${idx + 1} ROWS ONLY`;
        params.push(offset, pageSize);

        const result = await dbService.executeQuery(query, params);
        return result.recordset || [];
    }

    /** Count messages in a conversation. */
    static async countMessages(conversationId: string): Promise<number> {
        const result = await dbService.executeQuery(
            `SELECT COUNT(*) as Total FROM Messages WHERE ConversationID = @param0 AND IsDeleted = 0`,
            [conversationId]
        );
        return result.recordset[0]?.Total ?? 0;
    }

    /** Mark a single message as read. */
    static async markMessageRead(messageId: string, userId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Messages SET IsRead = 1, ReadAt = GETUTCDATE()
            WHERE MessageID = @param0 AND SenderUserID != @param1 AND IsRead = 0
        `, [messageId, userId]);
    }

    /** Get unread sender IDs in a conversation (for SignalR). */
    static async getUnreadSenders(conversationId: string, userId: string): Promise<string | null> {
        const result = await dbService.executeQuery(`
            SELECT DISTINCT SenderUserID FROM Messages
            WHERE ConversationID = @param0 AND SenderUserID != @param1 AND IsRead = 0
        `, [conversationId, userId]);
        return result.recordset?.[0]?.SenderUserID ?? null;
    }

    /** Mark all unread messages in a conversation as read. Returns count. */
    static async markConversationRead(conversationId: string, userId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            UPDATE Messages SET IsRead = 1, ReadAt = GETUTCDATE()
            WHERE ConversationID = @param0 AND SenderUserID != @param1 AND IsRead = 0
        `, [conversationId, userId]);
        return result.rowsAffected?.[0] ?? 0;
    }

    /** Get total unread count across all non-archived conversations. */
    static async getUnreadCount(userId: string): Promise<{ TotalUnread: number; UnreadConversations: number }> {
        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as TotalUnread, COUNT(DISTINCT m.ConversationID) as UnreadConversations
            FROM Messages m
            INNER JOIN Conversations c ON c.ConversationID = m.ConversationID
            WHERE (c.User1ID = @param0 OR c.User2ID = @param0)
                AND m.SenderUserID != @param0 AND m.IsRead = 0 AND m.IsDeleted = 0
                AND ((c.User1ID = @param0 AND c.IsArchived1 = 0) OR (c.User2ID = @param0 AND c.IsArchived2 = 0))
        `, [userId]);
        return result.recordset[0];
    }

    /** Soft-delete a message. */
    static async deleteMessage(messageId: string, userId: string, deleteFor: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Messages SET IsDeleted = 1, DeletedAt = GETUTCDATE(), DeletedFor = @param2
            WHERE MessageID = @param0 AND SenderUserID = @param1
        `, [messageId, userId, deleteFor]);
    }

    // ═══════════════════════════════════════════════════════════
    //  BLOCKED USERS
    // ═══════════════════════════════════════════════════════════

    static async blockUser(blockerId: string, blockedId: string, reason: string | null): Promise<void> {
        await dbService.executeQuery(`
            IF NOT EXISTS (SELECT 1 FROM BlockedUsers WHERE BlockerUserID = @param0 AND BlockedUserID = @param1)
            BEGIN
                INSERT INTO BlockedUsers (BlockerUserID, BlockedUserID, Reason, BlockedAt)
                VALUES (@param0, @param1, @param2, GETUTCDATE())
            END
        `, [blockerId, blockedId, reason]);
    }

    static async unblockUser(blockerId: string, blockedId: string): Promise<void> {
        await dbService.executeQuery(
            `DELETE FROM BlockedUsers WHERE BlockerUserID = @param0 AND BlockedUserID = @param1`,
            [blockerId, blockedId]
        );
    }

    static async isBlocked(user1Id: string, user2Id: string): Promise<boolean> {
        const result = await dbService.executeQuery(`
            SELECT CASE WHEN EXISTS (
                SELECT 1 FROM BlockedUsers
                WHERE (BlockerUserID = @param0 AND BlockedUserID = @param1)
                   OR (BlockerUserID = @param1 AND BlockedUserID = @param0)
            ) THEN 1 ELSE 0 END as IsBlocked
        `, [user1Id, user2Id]);
        return result.recordset[0]?.IsBlocked === 1;
    }

    static async getBlockedUsers(userId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT bu.BlockID, bu.BlockedUserID, bu.Reason, bu.BlockedAt,
                u.FirstName + ' ' + u.LastName as BlockedUserName,
                u.ProfilePictureURL as BlockedUserProfilePic
            FROM BlockedUsers bu
            INNER JOIN Users u ON u.UserID = bu.BlockedUserID
            WHERE bu.BlockerUserID = @param0 ORDER BY bu.BlockedAt DESC
        `, [userId]);
        return result.recordset || [];
    }

    // ═══════════════════════════════════════════════════════════
    //  PROFILE VIEWS
    // ═══════════════════════════════════════════════════════════

    static async insertProfileView(viewerId: string, viewedId: string, deviceType: string): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO UserProfileViews (ViewerUserID, ViewedUserID, ViewedAt, DeviceType)
            VALUES (@param0, @param1, GETUTCDATE(), @param2)
        `, [viewerId, viewedId, deviceType]);
    }

    static async findProfileViews(userId: string, offset: number, pageSize: number): Promise<{ views: any[]; total: number }> {
        const result = await dbService.executeQuery(`
            SELECT pv.ViewID, pv.ViewerUserID, pv.ViewedAt, pv.DeviceType,
                u.FirstName + ' ' + u.LastName as ViewerName,
                u.ProfilePictureURL as ViewerProfilePic, u.UserType as ViewerUserType,
                COUNT(*) OVER() as TotalCount
            FROM UserProfileViews pv WITH (NOLOCK)
            INNER JOIN Users u WITH (NOLOCK) ON u.UserID = pv.ViewerUserID
            WHERE pv.ViewedUserID = @param0
            ORDER BY pv.ViewedAt DESC
            OFFSET @param1 ROWS FETCH NEXT @param2 ROWS ONLY
        `, [userId, offset, pageSize]);
        const views = result.recordset || [];
        return { views, total: views[0]?.TotalCount || 0 };
    }

    static async hasActiveProfileViewAccess(userId: string, cost: number, durationHours: number): Promise<boolean> {
        const result = await dbService.executeQuery(`
            SELECT TOP 1 wt.CreatedAt FROM WalletTransactions wt
            INNER JOIN Wallets w ON wt.WalletID = w.WalletID
            WHERE w.UserID = @param0 AND wt.Source = 'Profile_View_Access'
                AND wt.TransactionType = 'Debit' AND wt.Amount = @param1
                AND wt.CreatedAt >= DATEADD(HOUR, -@param2, GETUTCDATE())
            ORDER BY wt.CreatedAt DESC
        `, [userId, cost, durationHours]);
        return (result.recordset?.length ?? 0) > 0;
    }
}
