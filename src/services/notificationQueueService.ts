/**
 * Notification Queue Service - Queue Processor
 * 
 * Processes the NotificationQueue table and sends notifications
 * Called by a timer trigger every 1 minute
 */

import { dbService } from './database.service';
import { EmailService } from './emailService';
import { TemplateService } from './templateService';

interface QueueItem {
    NotificationID: string;
    UserID: string | null;
    NotificationType: string;
    Channel: string;
    Payload: string;
    Status: string;
    RetryCount: number;
    MaxRetries: number;
}

interface ProcessResult {
    processed: number;
    sent: number;
    failed: number;
    errors: string[];
}

export class NotificationQueueService {

    /**
     * Process pending notifications in the queue
     * Called by timer trigger every minute
     */
    static async processQueue(batchSize: number = 50): Promise<ProcessResult> {
        const result: ProcessResult = {
            processed: 0,
            sent: 0,
            failed: 0,
            errors: []
        };

        try {
            // 1. Fetch and lock pending notifications
            const pendingResult = await dbService.executeQuery<QueueItem>(`
                UPDATE TOP (@param0) NotificationQueue
                SET Status = 'processing',
                    ProcessedAt = GETUTCDATE()
                OUTPUT 
                    INSERTED.NotificationID,
                    INSERTED.UserID,
                    INSERTED.NotificationType,
                    INSERTED.Channel,
                    INSERTED.Payload,
                    INSERTED.Status,
                    INSERTED.RetryCount,
                    INSERTED.MaxRetries
                WHERE Status = 'pending'
                AND ScheduledAt <= GETUTCDATE()
                AND RetryCount < MaxRetries
            `, [batchSize]);

            const pending: QueueItem[] = pendingResult.recordset;

            if (pending.length === 0) {
                return result;
            }

            console.log(`📬 Processing ${pending.length} notifications from queue`);

            // 2. Process each notification
            for (const item of pending) {
                result.processed++;

                try {
                    await this.processNotification(item);
                    await this.markAsSent(item.NotificationID);
                    result.sent++;
                } catch (error: any) {
                    await this.markAsFailed(item.NotificationID, error.message);
                    result.failed++;
                    result.errors.push(`${item.NotificationType}: ${error.message}`);
                }
            }

            console.log(`✅ Queue processing complete: ${result.sent} sent, ${result.failed} failed`);
            return result;

        } catch (error: any) {
            console.error('❌ Queue processing error:', error);
            result.errors.push(error.message);
            return result;
        }
    }

    /**
     * Process a single notification
     */
    private static async processNotification(item: QueueItem): Promise<void> {
        const payload = JSON.parse(item.Payload);

        switch (item.Channel) {
            case 'email':
                await this.sendEmail(item.NotificationType, payload);
                break;
            case 'push':
                await this.sendPush(item.NotificationType, payload, item.UserID);
                break;
            case 'in_app':
                await this.createInAppNotification(item.NotificationType, payload, item.UserID);
                break;
            default:
                throw new Error(`Unknown channel: ${item.Channel}`);
        }
    }

    /**
     * Send email notification
     */
    private static async sendEmail(type: string, payload: any): Promise<void> {
        // Get recipient email
        const email = payload.referrerEmail || payload.seekerEmail || payload.email;
        
        if (!email) {
            throw new Error('No email address in payload');
        }

        // Render template
        const { subject, html, text } = TemplateService.render(type, payload);

        // Send email
        const result = await EmailService.send({
            to: email,
            subject,
            html,
            text,
            userId: payload.referrerId || payload.seekerId || payload.userId,
            emailType: type,
            referenceType: 'referral_request',
            referenceId: payload.requestId
        });

        if (!result.success) {
            throw new Error(result.error || 'Email send failed');
        }
    }

    /**
     * Send push notification (placeholder for future)
     */
    private static async sendPush(type: string, payload: any, userId: string | null): Promise<void> {
        // TODO: Implement push notifications with Firebase/Expo
        console.log(`🔔 Push notification (not implemented): ${type} to user ${userId}`);
        
        // For now, just log it
        // In future:
        // 1. Get user's push token from database
        // 2. Send via Firebase Cloud Messaging or Expo Push
    }

    /**
     * Create in-app notification
     */
    private static async createInAppNotification(
        type: string, 
        payload: any, 
        userId: string | null
    ): Promise<void> {
        if (!userId) {
            throw new Error('UserID required for in-app notifications');
        }

        // Map notification type to title/body/icon
        const notifContent = this.getInAppContent(type, payload);

        await dbService.executeQuery(`
            INSERT INTO InAppNotifications (
                UserID, Title, Body, Icon, ActionURL, NotificationType, ReferenceID
            ) VALUES (
                @param0, @param1, @param2, @param3, @param4, @param5, @param6
            )
        `, [
            userId,
            notifContent.title,
            notifContent.body,
            notifContent.icon,
            notifContent.actionUrl,
            type,
            payload.requestId || null
        ]);
    }

    /**
     * Get in-app notification content based on type
     */
    private static getInAppContent(type: string, payload: any): {
        title: string;
        body: string;
        icon: string;
        actionUrl: string;
    } {
        const appUrl = process.env.APP_URL || 'https://refopen.com';

        switch (type) {
            case 'new_referral_request':
                return {
                    title: 'New Referral Request',
                    body: `${payload.seekerName} is looking for a referral at ${payload.companyName}`,
                    icon: 'referral',
                    actionUrl: `${appUrl}/referrals?tab=available`
                };
            case 'referral_claimed':
                return {
                    title: 'Referral Claimed!',
                    body: `${payload.referrerName} claimed your referral for ${payload.jobTitle}`,
                    icon: 'referral',
                    actionUrl: `${appUrl}/referrals?tab=seeker`
                };
            case 'referral_verified':
                return {
                    title: `You earned ₹${payload.amount}!`,
                    body: `${payload.seekerName} verified your referral`,
                    icon: 'money',
                    actionUrl: `${appUrl}/wallet`
                };
            default:
                return {
                    title: 'Notification',
                    body: 'You have a new notification',
                    icon: 'bell',
                    actionUrl: appUrl
                };
        }
    }

    /**
     * Mark notification as sent
     */
    private static async markAsSent(notificationId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE NotificationQueue
            SET Status = 'sent',
                CompletedAt = GETUTCDATE()
            WHERE NotificationID = @param0
        `, [notificationId]);
    }

    /**
     * Mark notification as failed (will retry if under max)
     */
    private static async markAsFailed(notificationId: string, errorMessage: string): Promise<void> {
        // Exponential backoff: 2^retryCount minutes
        await dbService.executeQuery(`
            UPDATE NotificationQueue
            SET Status = CASE 
                    WHEN RetryCount + 1 >= MaxRetries THEN 'failed'
                    ELSE 'pending'
                END,
                RetryCount = RetryCount + 1,
                ErrorMessage = @param1,
                ScheduledAt = DATEADD(MINUTE, POWER(2, RetryCount), GETUTCDATE()),
                ProcessedAt = NULL
            WHERE NotificationID = @param0
        `, [notificationId, errorMessage]);
    }

    /**
     * Get queue statistics
     */
    static async getStats(): Promise<{
        pending: number;
        processing: number;
        sent: number;
        failed: number;
    }> {
        const result = await dbService.executeQuery<{ Status: string; Count: number }>(`
            SELECT 
                Status,
                COUNT(*) as Count
            FROM NotificationQueue
            WHERE CreatedAt > DATEADD(DAY, -7, GETUTCDATE())
            GROUP BY Status
        `, []);

        const stats = { pending: 0, processing: 0, sent: 0, failed: 0 };
        
        for (const row of result.recordset) {
            if (row.Status in stats) {
                stats[row.Status as keyof typeof stats] = row.Count;
            }
        }

        return stats;
    }

    /**
     * Clean up old notifications (run weekly)
     */
    static async cleanup(daysToKeep: number = 30): Promise<number> {
        const result = await dbService.executeQuery(`
            DELETE FROM NotificationQueue
            WHERE Status IN ('sent', 'failed', 'cancelled')
            AND CreatedAt < DATEADD(DAY, -@param0, GETUTCDATE())
        `, [daysToKeep]);

        return result.rowsAffected?.[0] || 0;
    }
}

export default NotificationQueueService;
