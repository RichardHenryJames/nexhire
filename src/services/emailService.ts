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
    appUrl: process.env.APP_URL || 'https://www.refopen.com'
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
     * Send password reset email
     */
    static async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<EmailResult> {
        try {
            const resetUrl = `${EMAIL_CONFIG.appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
            
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0F172A 0%, #1E40AF 100%); padding: 30px 40px; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                                🔐 Password Reset Request
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                                Hi ${firstName || 'there'},
                            </p>
                            <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                                We received a request to reset your password for your RefOpen account. Click the button below to create a new password:
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="margin: 30px 0;">
                                <tr>
                                    <td>
                                        <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                            Reset My Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                                This link will expire in <strong>1 hour</strong> for security reasons.
                            </p>
                            
                            <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                            </p>
                            
                            <!-- Alternative Link -->
                            <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                                <p style="margin: 0 0 10px; color: #666666; font-size: 13px;">
                                    If the button doesn't work, copy and paste this link into your browser:
                                </p>
                                <p style="margin: 0; word-break: break-all;">
                                    <a href="${resetUrl}" style="color: #1E40AF; font-size: 12px;">${resetUrl}</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f8fafc; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                                This email was sent by RefOpen - India's Leading Job & Referral Platform
                            </p>
                            <p style="margin: 10px 0 0; color: #64748b; font-size: 12px; text-align: center;">
                                <a href="${EMAIL_CONFIG.appUrl}" style="color: #1E40AF;">Visit RefOpen</a> | 
                                <a href="${EMAIL_CONFIG.appUrl}/support" style="color: #1E40AF;">Contact Support</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

            const text = `
Hi ${firstName || 'there'},

We received a request to reset your password for your RefOpen account.

Click the link below to create a new password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
RefOpen - India's Leading Job & Referral Platform
${EMAIL_CONFIG.appUrl}
`;

            return await this.send({
                to: email,
                subject: '🔐 Reset Your RefOpen Password',
                html,
                text,
                emailType: 'password_reset'
            });
        } catch (error: any) {
            console.error('❌ Error sending password reset email:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send email to Google users who try to reset password
     * Informs them they signed up with Google and how to set a password
     */
    static async sendGoogleUserPasswordInfo(email: string, firstName: string): Promise<EmailResult> {
        try {
            const loginUrl = `${EMAIL_CONFIG.appUrl}/login`;
            const settingsUrl = `${EMAIL_CONFIG.appUrl}/settings`;
            
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign In with Google</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0F172A 0%, #1E40AF 100%); padding: 30px 40px; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                                🔑 Your RefOpen Account
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                                Hi ${firstName || 'there'},
                            </p>
                            <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                                We received a password reset request for your RefOpen account. However, your account was created using <strong>Google Sign-In</strong>, so there's no password to reset.
                            </p>
                            
                            <!-- Info Box -->
                            <div style="margin: 25px 0; padding: 20px; background-color: #EFF6FF; border-left: 4px solid #3B82F6; border-radius: 4px;">
                                <p style="margin: 0; color: #1E40AF; font-size: 15px; font-weight: 600;">
                                    📱 How to sign in:
                                </p>
                                <p style="margin: 10px 0 0; color: #333333; font-size: 14px; line-height: 1.6;">
                                    Simply click "Continue with Google" on the login page using the same Google account you signed up with.
                                </p>
                            </div>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="margin: 30px 0;">
                                <tr>
                                    <td>
                                        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                            Go to Login Page
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Secondary Info -->
                            <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                                <p style="margin: 0 0 10px; color: #333333; font-size: 14px; font-weight: 600;">
                                    🔐 Want to set a password anyway?
                                </p>
                                <p style="margin: 0 0 15px; color: #666666; font-size: 14px; line-height: 1.6;">
                                    If you'd like to log in with both Google and email/password, you can set a password in your account settings:
                                </p>
                                <ol style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px; line-height: 1.8;">
                                    <li>Sign in with Google</li>
                                    <li>Go to <a href="${settingsUrl}" style="color: #1E40AF;">Settings</a></li>
                                    <li>Click "Set Password" in the Security section</li>
                                </ol>
                            </div>
                            
                            <p style="margin: 25px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                                If you didn't request this, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f8fafc; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                                This email was sent by RefOpen - India's Leading Job & Referral Platform
                            </p>
                            <p style="margin: 10px 0 0; color: #64748b; font-size: 12px; text-align: center;">
                                <a href="${EMAIL_CONFIG.appUrl}" style="color: #1E40AF;">Visit RefOpen</a> | 
                                <a href="${EMAIL_CONFIG.appUrl}/support" style="color: #1E40AF;">Contact Support</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

            const text = `
Hi ${firstName || 'there'},

We received a password reset request for your RefOpen account.

However, your account was created using Google Sign-In, so there's no password to reset.

HOW TO SIGN IN:
Simply click "Continue with Google" on the login page using the same Google account you signed up with.

Login here: ${loginUrl}

WANT TO SET A PASSWORD?
If you'd like to log in with both Google and email/password:
1. Sign in with Google
2. Go to Settings
3. Click "Set Password" in the Security section

If you didn't request this, you can safely ignore this email.

---
RefOpen - India's Leading Job & Referral Platform
${EMAIL_CONFIG.appUrl}
`;

            return await this.send({
                to: email,
                subject: '🔑 Your RefOpen Account Uses Google Sign-In',
                html,
                text,
                emailType: 'google_user_password_info'
            });
        } catch (error: any) {
            console.error('❌ Error sending Google user info email:', error.message);
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
