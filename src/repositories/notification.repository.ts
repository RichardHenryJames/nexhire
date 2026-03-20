/**
 * Notification Repository — Single source of truth for InAppNotifications table queries.
 *
 * WHY THIS EXISTS:
 *  - Separates data-access (SQL) from business logic in inAppNotification.service.ts
 *  - All 10+ SQL queries for this table live here — nowhere else
 *
 * RULES:
 *  1. Only this repository should write raw InAppNotifications SQL.
 *  2. Services call repository methods — never dbService directly for this table.
 */

import { dbService } from '../services/database.service';

// ── Types ───────────────────────────────────────────────────────

export interface InsertNotificationParams {
    userId: string;
    title: string;
    body: string;
    icon: string | null;
    imageUrl: string | null;
    actionUrl: string | null;
    actionLabel: string | null;
    notificationType: string;
    referenceId: string | null;
    expiresAt: Date | null;
}

// ── Repository ──────────────────────────────────────────────────

export class NotificationRepository {

    /**
     * Insert a new notification and return the generated NotificationID.
     */
    static async insert(p: InsertNotificationParams): Promise<string> {
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
            p.userId, p.title, p.body, p.icon, p.imageUrl,
            p.actionUrl, p.actionLabel, p.notificationType,
            p.referenceId, p.expiresAt
        ]);
        return result.recordset[0]?.NotificationID;
    }

    /**
     * Fetch a page of notifications for a user (optionally unread-only).
     */
    static async findByUser(
        userId: string,
        offset: number,
        pageSize: number,
        unreadOnly: boolean
    ): Promise<any[]> {
        let where = 'WHERE n.UserID = @param0 AND (n.ExpiresAt IS NULL OR n.ExpiresAt > GETUTCDATE())';
        if (unreadOnly) where += ' AND n.IsRead = 0';

        const result = await dbService.executeQuery(`
            SELECT 
                n.NotificationID, n.Title, n.Body, n.Icon, n.ImageURL,
                n.ActionURL, n.ActionLabel, n.IsRead, n.ReadAt,
                n.NotificationType, n.ReferenceID, n.CreatedAt
            FROM InAppNotifications n
            ${where}
            ORDER BY n.CreatedAt DESC
            OFFSET @param1 ROWS FETCH NEXT @param2 ROWS ONLY
        `, [userId, offset, pageSize]);
        return result.recordset;
    }

    /**
     * Count notifications for a user (optionally unread-only).
     */
    static async countByUser(userId: string, unreadOnly: boolean): Promise<number> {
        let where = 'WHERE n.UserID = @param0 AND (n.ExpiresAt IS NULL OR n.ExpiresAt > GETUTCDATE())';
        if (unreadOnly) where += ' AND n.IsRead = 0';

        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as total FROM InAppNotifications n ${where}
        `, [userId]);
        return result.recordset[0]?.total || 0;
    }

    /**
     * Count unread notifications for a user.
     */
    static async countUnread(userId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as count
            FROM InAppNotifications
            WHERE UserID = @param0 AND IsRead = 0
                AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE())
        `, [userId]);
        return result.recordset[0]?.count || 0;
    }

    /**
     * Mark a single notification as read. Returns true if a row was updated.
     */
    static async markRead(notificationId: string, userId: string): Promise<boolean> {
        const result = await dbService.executeQuery(`
            UPDATE InAppNotifications
            SET IsRead = 1, ReadAt = GETUTCDATE()
            WHERE NotificationID = @param0 AND UserID = @param1
        `, [notificationId, userId]);
        return (result.rowsAffected?.[0] ?? 0) > 0;
    }

    /**
     * Mark all notifications as read for a user. Returns count of rows updated.
     */
    static async markAllRead(userId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            UPDATE InAppNotifications
            SET IsRead = 1, ReadAt = GETUTCDATE()
            WHERE UserID = @param0 AND IsRead = 0
        `, [userId]);
        return result.rowsAffected?.[0] ?? 0;
    }

    /**
     * Delete a single notification. Returns true if a row was deleted.
     */
    static async deleteOne(notificationId: string, userId: string): Promise<boolean> {
        const result = await dbService.executeQuery(`
            DELETE FROM InAppNotifications
            WHERE NotificationID = @param0 AND UserID = @param1
        `, [notificationId, userId]);
        return (result.rowsAffected?.[0] ?? 0) > 0;
    }

    /**
     * Delete old read notifications older than N days. Returns count deleted.
     */
    static async deleteOlderThan(daysOld: number): Promise<number> {
        const result = await dbService.executeQuery(`
            DELETE FROM InAppNotifications
            WHERE CreatedAt < DATEADD(DAY, -@param0, GETUTCDATE())
                AND IsRead = 1
        `, [daysOld]);
        return result.rowsAffected?.[0] ?? 0;
    }

    /**
     * Find the latest unread notification for a conversation (message collapsing).
     * Returns { NotificationID, Title } or null.
     */
    static async findUnreadByConversation(
        userId: string,
        conversationId: string
    ): Promise<{ NotificationID: string; Title: string } | null> {
        const result = await dbService.executeQuery(`
            SELECT NotificationID, Title
            FROM InAppNotifications
            WHERE UserID = @param0
                AND NotificationType = 'message_received'
                AND ReferenceID = @param1
                AND IsRead = 0
            ORDER BY CreatedAt DESC
            OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
        `, [userId, conversationId]);
        return result.recordset[0] ?? null;
    }

    /**
     * Update the title + bump CreatedAt on an existing notification (message collapsing).
     */
    static async updateTitleAndBump(
        notificationId: string,
        userId: string,
        newTitle: string
    ): Promise<void> {
        await dbService.executeQuery(`
            UPDATE InAppNotifications
            SET Title = @param2, CreatedAt = GETUTCDATE()
            WHERE NotificationID = @param0 AND UserID = @param1
        `, [notificationId, userId, newTitle]);
    }
}
