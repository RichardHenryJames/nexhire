/**
 * Unread Message Notification Service
 * 
 * Sends email notifications for messages that haven't been read after 1 hour.
 * Uses a separate tracking column (EmailReminderSent) to avoid duplicate emails.
 */

import { dbService } from "./database.service";
import { EmailService } from "./emailService";
import { TemplateService } from "./templateService";

// Time threshold for sending reminder (in minutes)
const UNREAD_THRESHOLD_MINUTES = 60; // 1 hour

// Maximum messages to process per run
const MAX_BATCH_SIZE = 50;

interface UnreadMessage {
    MessageID: string;
    ConversationID: string;
    SenderUserID: string;
    SenderName: string;
    SenderEmail: string;
    ReceiverUserID: string;
    ReceiverName: string;
    ReceiverEmail: string;
    Content: string;
    CreatedAt: Date;
}

interface ProcessResult {
    success: boolean;
    processed: number;
    emailsSent: number;
    emailsFailed: number;
    errors: string[];
}

export class UnreadMessageNotificationService {

    /**
     * Initialize the EmailReminderSent column if it doesn't exist
     */
    static async initializeColumn(): Promise<void> {
        try {
            // Check if column exists
            const checkQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'Messages' AND COLUMN_NAME = 'EmailReminderSent'
            `;
            const result = await dbService.executeQuery(checkQuery, []);
            
            if (!result.recordset || result.recordset.length === 0) {
                // Add the column
                const alterQuery = `
                    ALTER TABLE Messages 
                    ADD EmailReminderSent BIT NOT NULL DEFAULT 0
                `;
                await dbService.executeQuery(alterQuery, []);
                console.log('✅ Added EmailReminderSent column to Messages table');
            }
        } catch (error: any) {
            // Column might already exist, ignore error
            if (!error.message?.includes('already exists')) {
                console.warn('Warning initializing EmailReminderSent column:', error.message);
            }
        }
    }

    /**
     * Find unread messages older than threshold and send email reminders
     */
    static async processUnreadMessages(): Promise<ProcessResult> {
        const result: ProcessResult = {
            success: true,
            processed: 0,
            emailsSent: 0,
            emailsFailed: 0,
            errors: []
        };

        try {
            // Initialize column if needed
            await this.initializeColumn();

            // Find unread messages older than 1 hour that haven't had email reminder sent
            // Exclude messages from admin (admin@refopen.com) as they have their own notification
            const query = `
                SELECT TOP ${MAX_BATCH_SIZE}
                    m.MessageID,
                    m.ConversationID,
                    m.SenderUserID,
                    sender.FirstName + ' ' + sender.LastName as SenderName,
                    sender.Email as SenderEmail,
                    c.User1ID,
                    c.User2ID,
                    CASE WHEN c.User1ID = m.SenderUserID THEN c.User2ID ELSE c.User1ID END as ReceiverUserID,
                    receiver.FirstName + ' ' + receiver.LastName as ReceiverName,
                    receiver.Email as ReceiverEmail,
                    m.Content,
                    m.CreatedAt
                FROM Messages m
                INNER JOIN Conversations c ON m.ConversationID = c.ConversationID
                INNER JOIN Users sender ON m.SenderUserID = sender.UserID
                INNER JOIN Users receiver ON receiver.UserID = CASE WHEN c.User1ID = m.SenderUserID THEN c.User2ID ELSE c.User1ID END
                WHERE m.IsRead = 0
                  AND m.IsDeleted = 0
                  AND (m.EmailReminderSent = 0 OR m.EmailReminderSent IS NULL)
                  AND DATEDIFF(MINUTE, m.CreatedAt, GETUTCDATE()) >= ${UNREAD_THRESHOLD_MINUTES}
                  AND sender.Email != 'admin@refopen.com'
                  AND receiver.Email != 'admin@refopen.com'
                ORDER BY m.CreatedAt ASC
            `;

            const messagesResult = await dbService.executeQuery<UnreadMessage>(query, []);
            const messages = messagesResult.recordset || [];

            if (messages.length === 0) {
                console.log('📭 No unread messages to notify about');
                return result;
            }

            console.log(`📬 Found ${messages.length} unread messages to send reminders for`);

            // Group messages by receiver to avoid sending multiple emails
            const messagesByReceiver = new Map<string, UnreadMessage[]>();
            for (const msg of messages) {
                const existing = messagesByReceiver.get(msg.ReceiverUserID) || [];
                existing.push(msg);
                messagesByReceiver.set(msg.ReceiverUserID, existing);
            }

            // Process each receiver (send one email per receiver, even if multiple unread messages)
            for (const [receiverUserId, receiverMessages] of messagesByReceiver) {
                try {
                    // Group by sender to show multiple senders
                    const messagesBySender = new Map<string, UnreadMessage[]>();
                    for (const msg of receiverMessages) {
                        const existing = messagesBySender.get(msg.SenderUserID) || [];
                        existing.push(msg);
                        messagesBySender.set(msg.SenderUserID, existing);
                    }

                    const senderCount = messagesBySender.size;
                    const totalMessageCount = receiverMessages.length;
                    const latestMessage = receiverMessages[receiverMessages.length - 1];
                    const recipientFirstName = latestMessage.ReceiverName?.split(' ')[0] || 'there';

                    // Build dynamic content based on single vs multiple senders
                    let subjectText: string;
                    let headerTitle: string;
                    let headerSubtitle: string;
                    let bodyText: string;
                    let ctaText: string;
                    let messageCardsHtml: string;

                    if (senderCount === 1) {
                        // Single sender
                        const senderName = latestMessage.SenderName || 'Someone';
                        const messagePreview = latestMessage.Content.length > 150 
                            ? latestMessage.Content.substring(0, 147) + '...' 
                            : latestMessage.Content;
                        const sentTime = this.formatTimeAgo(new Date(latestMessage.CreatedAt));

                        subjectText = `You have an unread message from ${senderName}`;
                        headerTitle = 'You Have an Unread Message';
                        headerSubtitle = 'Someone is waiting for your reply';
                        bodyText = `<strong style="color: #1a1a1a;">${senderName}</strong> sent you a message on RefOpen that you haven't read yet.`;
                        ctaText = 'Read & Reply';
                        
                        messageCardsHtml = `
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 8px 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message Preview</p>
                                        <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${this.escapeHtml(messagePreview)}</p>
                                        <p style="margin: 12px 0 0 0; color: #94A3B8; font-size: 12px;">Sent ${sentTime}</p>
                                    </td>
                                </tr>
                            </table>
                        `;
                    } else {
                        // Multiple senders
                        subjectText = `You have ${totalMessageCount} unread messages on RefOpen`;
                        headerTitle = `You Have ${totalMessageCount} Unread Messages`;
                        headerSubtitle = `From ${senderCount} people waiting for your reply`;
                        bodyText = `You have unread messages from ${senderCount} people on RefOpen:`;
                        ctaText = 'Read All Messages';

                        // Build message cards for each sender (max 5)
                        let cardsHtml = '';
                        let count = 0;
                        for (const [senderId, senderMsgs] of messagesBySender) {
                            if (count >= 5) break; // Limit to 5 senders in email
                            
                            const senderName = senderMsgs[0].SenderName || 'Someone';
                            const msgCount = senderMsgs.length;
                            const latestFromSender = senderMsgs[senderMsgs.length - 1];
                            const preview = latestFromSender.Content.length > 80 
                                ? latestFromSender.Content.substring(0, 77) + '...' 
                                : latestFromSender.Content;

                            cardsHtml += `
                                <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 12px 0;">
                                    <tr>
                                        <td style="padding: 16px;">
                                            <p style="margin: 0 0 4px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">
                                                ${this.escapeHtml(senderName)} ${msgCount > 1 ? `<span style="color: #64748B; font-weight: 400;">(${msgCount} messages)</span>` : ''}
                                            </p>
                                            <p style="margin: 0; color: #64748B; font-size: 13px; line-height: 1.5;">"${this.escapeHtml(preview)}"</p>
                                        </td>
                                    </tr>
                                </table>
                            `;
                            count++;
                        }

                        if (senderCount > 5) {
                            cardsHtml += `<p style="color: #64748B; font-size: 13px; margin: 0 0 24px 0;">...and ${senderCount - 5} more</p>`;
                        }

                        messageCardsHtml = cardsHtml;
                    }

                    // Render template with dynamic content
                    const template = TemplateService.render('unread_message_reminder', {
                        recipientName: recipientFirstName,
                        subjectText,
                        headerTitle,
                        headerSubtitle,
                        bodyText,
                        ctaText,
                        messageCardsHtml,
                        appUrl: process.env.APP_URL || 'https://www.refopen.com'
                    });

                    // Send email
                    await EmailService.send({
                        to: latestMessage.ReceiverEmail,
                        subject: template.subject,
                        html: template.html,
                        userId: receiverUserId,
                        emailType: 'unread_message_reminder',
                        referenceType: 'message_reminder',
                        referenceId: receiverMessages.map(m => m.MessageID).join(',').substring(0, 100)
                    });

                    result.emailsSent++;
                    console.log(`✅ Sent unread message reminder to ${latestMessage.ReceiverEmail} (${totalMessageCount} msgs from ${senderCount} senders)`);

                    // Mark all messages as reminder sent
                    const messageIds = receiverMessages.map(m => `'${m.MessageID}'`).join(',');
                    await dbService.executeQuery(`
                        UPDATE Messages 
                        SET EmailReminderSent = 1 
                        WHERE MessageID IN (${messageIds})
                    `, []);

                    result.processed += receiverMessages.length;

                } catch (error: any) {
                    result.emailsFailed++;
                    result.errors.push(`Failed for ${receiverUserId}: ${error.message}`);
                    console.error(`❌ Failed to send reminder to ${receiverUserId}:`, error.message);
                }
            }

        } catch (error: any) {
            result.success = false;
            result.errors.push(error.message);
            console.error('❌ Error processing unread messages:', error.message);
        }

        return result;
    }

    /**
     * Format time difference as human-readable string
     */
    private static formatTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    /**
     * Escape HTML special characters to prevent XSS
     */
    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Log the notification run to database (optional tracking)
     */
    static async logNotificationRun(
        executionId: string,
        startTime: Date,
        endTime: Date,
        result: ProcessResult
    ): Promise<void> {
        try {
            // Log to a generic execution log or just console for now
            console.log(`📝 Unread Message Notification Run [${executionId}]`);
            console.log(`   Start: ${startTime.toISOString()}`);
            console.log(`   End: ${endTime.toISOString()}`);
            console.log(`   Processed: ${result.processed}`);
            console.log(`   Emails Sent: ${result.emailsSent}`);
            console.log(`   Emails Failed: ${result.emailsFailed}`);
        } catch (error: any) {
            console.warn('Failed to log notification run:', error.message);
        }
    }
}

export default UnreadMessageNotificationService;
