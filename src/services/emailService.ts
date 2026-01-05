/**
 * Email Service - Azure Communication Services Integration
 * 
 * Handles all email sending through Azure ACS
 * Supports single emails, batch sending, and templated emails
 */

import { EmailClient, EmailMessage } from '@azure/communication-email';
import sql from 'mssql';
import { dbService } from './database.service';

// Email configuration
const EMAIL_CONFIG = {
    senderAddress: process.env.EMAIL_SENDER_ADDRESS || 'noreply@refopen.com',
    connectionString: process.env.ACS_CONNECTION_STRING || '',
    replyTo: process.env.EMAIL_REPLY_TO || 'support@refopen.com',
    appName: 'RefOpen',
    appUrl: process.env.APP_URL || 'https://refopen.com'
};

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
    userId?: string;
    emailType?: string;
    referenceType?: string;
    referenceId?: string;
}

interface BatchEmail {
    to: string;
    subject: string;
    html: string;
    text?: string;
    userId?: string;
}

interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export class EmailService {
    private static client: EmailClient | null = null;

    /**
     * Get or create the Azure Email Client
     */
    private static getClient(): EmailClient {
        if (!this.client) {
            if (!EMAIL_CONFIG.connectionString) {
                throw new Error('ACS_CONNECTION_STRING environment variable is not set');
            }
            this.client = new EmailClient(EMAIL_CONFIG.connectionString);
        }
        return this.client;
    }

    /**
     * Check if email service is configured
     */
    static isConfigured(): boolean {
        return !!EMAIL_CONFIG.connectionString && EMAIL_CONFIG.connectionString.length > 10;
    }

    /**
     * Send a single email
     */
    static async send(options: SendEmailOptions): Promise<EmailResult> {
        if (!this.isConfigured()) {
            console.warn('⚠️ Email service not configured, skipping email send');
            return { success: false, error: 'Email service not configured' };
        }

        try {
            const client = this.getClient();
            const recipients = Array.isArray(options.to) ? options.to : [options.to];

            const message: EmailMessage = {
                senderAddress: EMAIL_CONFIG.senderAddress,
                content: {
                    subject: options.subject,
                    html: options.html,
                    plainText: options.text || this.stripHtml(options.html)
                },
                recipients: {
                    to: recipients.map(email => ({ address: email }))
                }
            };

            // Add reply-to if specified
            if (options.replyTo || EMAIL_CONFIG.replyTo) {
                message.replyTo = [{ address: options.replyTo || EMAIL_CONFIG.replyTo }];
            }

            // Send email
            const poller = await client.beginSend(message);
            const result = await poller.pollUntilDone();

            const success = result.status === 'Succeeded';
            const messageId = result.id;

            // Log to database
            await this.logEmail({
                userId: options.userId,
                toEmail: recipients[0],
                emailType: options.emailType || 'general',
                subject: options.subject,
                status: success ? 'sent' : 'failed',
                providerMessageId: messageId,
                referenceType: options.referenceType,
                referenceId: options.referenceId,
                errorMessage: success ? null : 'Send failed'
            });

            if (success) {
                console.log(`✅ Email sent successfully to ${recipients.join(', ')}`);
                return { success: true, messageId };
            } else {
                console.error(`❌ Email send failed: ${result.status}`);
                return { success: false, error: result.status };
            }

        } catch (error: any) {
            console.error('❌ Email send error:', error.message);
            
            // Log failed attempt
            const recipients = Array.isArray(options.to) ? options.to : [options.to];
            await this.logEmail({
                userId: options.userId,
                toEmail: recipients[0],
                emailType: options.emailType || 'general',
                subject: options.subject,
                status: 'failed',
                errorMessage: error.message
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Send emails in batch (more efficient for multiple recipients)
     */
    static async sendBatch(emails: BatchEmail[], emailType: string = 'batch'): Promise<{ sent: number; failed: number; errors: string[] }> {
        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        // Process in parallel with concurrency limit
        const BATCH_SIZE = 10;
        for (let i = 0; i < emails.length; i += BATCH_SIZE) {
            const batch = emails.slice(i, i + BATCH_SIZE);
            
            const results = await Promise.allSettled(
                batch.map(email => this.send({
                    to: email.to,
                    subject: email.subject,
                    html: email.html,
                    text: email.text,
                    userId: email.userId,
                    emailType
                }))
            );

            for (const result of results) {
                if (result.status === 'fulfilled' && result.value.success) {
                    sent++;
                } else {
                    failed++;
                    if (result.status === 'rejected') {
                        errors.push(result.reason?.message || 'Unknown error');
                    } else if (!result.value.success) {
                        errors.push(result.value.error || 'Send failed');
                    }
                }
            }
        }

        console.log(`📧 Batch email complete: ${sent} sent, ${failed} failed`);
        return { sent, failed, errors };
    }

    /**
     * Log email to database for tracking
     */
    private static async logEmail(data: {
        userId?: string;
        toEmail: string;
        emailType: string;
        subject: string;
        status: string;
        providerMessageId?: string;
        referenceType?: string;
        referenceId?: string;
        errorMessage?: string | null;
    }): Promise<void> {
        try {
            await dbService.executeQuery(`
                INSERT INTO EmailLogs (
                    UserID, ToEmail, EmailType, Subject, Status,
                    ProviderMessageID, ReferenceType, ReferenceID, ErrorMessage
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4,
                    @param5, @param6, @param7, @param8
                )
            `, [
                data.userId || null,
                data.toEmail,
                data.emailType,
                data.subject,
                data.status,
                data.providerMessageId || null,
                data.referenceType || null,
                data.referenceId || null,
                data.errorMessage || null
            ]);
        } catch (error: any) {
            // Don't fail email send if logging fails
            console.warn('⚠️ Failed to log email:', error.message);
        }
    }

    /**
     * Strip HTML tags for plain text version
     */
    private static stripHtml(html: string): string {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gs, '')
            .replace(/<script[^>]*>.*?<\/script>/gs, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Send welcome email to new users
     */
    static async sendWelcomeEmail(email: string, firstName: string): Promise<EmailResult> {
        try {
            const { TemplateService } = await import('./templateService');
            const template = TemplateService.render('welcome_new_user', {
                firstName: firstName || 'there'
            });

            return await this.send({
                to: email,
                subject: template.subject,
                html: template.html,
                text: template.text,
                emailType: 'welcome'
            });
        } catch (error: any) {
            console.error('❌ Error sending welcome email:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get email configuration for external use
     */
    static getConfig() {
        return {
            senderAddress: EMAIL_CONFIG.senderAddress,
            appName: EMAIL_CONFIG.appName,
            appUrl: EMAIL_CONFIG.appUrl,
            isConfigured: this.isConfigured()
        };
    }
}

export default EmailService;
