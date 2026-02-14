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
    appName: 'RefOpen',
    appUrl: process.env.APP_URL || 'https://www.refopen.com'
};

// Shared email footer for security emails (no unsubscribe link)
const EMAIL_FOOTER_SECURITY = `
                    <!-- Footer -->
                    <tr>
                        <td style="background: #F8FAFC; padding: 32px 40px; border-top: 1px solid #E2E8F0; text-align: center;">
                            <img src="{{appUrl}}/refopen-logo.png" alt="RefOpen" width="100" style="margin-bottom: 16px;">
                            <p style="margin: 0 0 8px 0; color: #64748B; font-size: 12px;">
                                {{footerText}}
                            </p>
                            <p style="margin: 0; color: #64748B; font-size: 12px;">
                                <a href="{{appUrl}}/support" style="color: #4F46E5; text-decoration: none;">Help Center</a>
                                <span style="color: #CBD5E1; margin: 0 8px;">|</span>
                                <a href="{{appUrl}}" style="color: #4F46E5; text-decoration: none;">RefOpen</a>
                            </p>
                        </td>
                    </tr>`;

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
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
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: #4F46E5; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Password Reset Request</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi ${firstName || 'there'},
                            </p>
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                We received a request to reset your password for your RefOpen account. Click the button below to create a new password:
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 8px 0 24px 0;">
                                        <a href="${resetUrl}" style="display: inline-block; background: #4F46E5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            Reset My Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                                This link will expire in <strong style="color: #1a1a1a;">1 hour</strong> for security reasons.
                            </p>
                            
                            <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                            </p>
                            
                            <!-- Alternative Link -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <p style="margin: 0 0 8px 0; color: #64748B; font-size: 13px;">
                                            If the button doesn't work, copy and paste this link:
                                        </p>
                                        <p style="margin: 0; word-break: break-all;">
                                            <a href="${resetUrl}" style="color: #4F46E5; font-size: 12px; text-decoration: none;">${resetUrl}</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER_SECURITY.replace(/\{\{appUrl\}\}/g, EMAIL_CONFIG.appUrl).replace('{{footerText}}', 'This is a security email from RefOpen.')}
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
                subject: 'Reset Your RefOpen Password',
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
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: #4F46E5; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Your RefOpen Account</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi ${firstName || 'there'},
                            </p>
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                We received a password reset request for your RefOpen account. However, your account was created using <strong style="color: #1a1a1a;">Google Sign-In</strong>, so there's no password to reset.
                            </p>
                            
                            <!-- Info Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 8px 0; color: #1E40AF; font-size: 14px; font-weight: 600;">How to sign in</p>
                                        <p style="margin: 0; color: #1E40AF; font-size: 14px; line-height: 1.6;">
                                            Simply click "Continue with Google" on the login page using the same Google account you signed up with.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 8px 0 24px 0;">
                                        <a href="${loginUrl}" style="display: inline-block; background: #4F46E5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            Go to Login Page
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Secondary Info -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">Want to set a password anyway?</p>
                                        <p style="margin: 0 0 12px 0; color: #64748B; font-size: 14px; line-height: 1.6;">
                                            If you'd like to log in with both Google and email/password:
                                        </p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 13px;">1. Sign in with Google</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 13px;">2. Go to <a href="${settingsUrl}" style="color: #4F46E5; text-decoration: none;">Settings</a></td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 13px;">3. Click "Set Password" in the Security section</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 24px 0 0 0; color: #64748B; font-size: 14px; line-height: 1.6;">
                                If you didn't request this, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER_SECURITY.replace(/\{\{appUrl\}\}/g, EMAIL_CONFIG.appUrl).replace('{{footerText}}', 'This is a security email from RefOpen.')}
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
                subject: 'Your RefOpen Account Uses Google Sign-In',
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

    /**
     * Send admin notification email
     */
    static async sendAdminNotification(subject: string, htmlContent: string): Promise<EmailResult> {
        try {
            // Admin email address - check multiple possible env vars
            const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFICATION_EMAILS || 'parimalkumar261@gmail.com';
            
            console.log(`📧 Sending admin notification to: ${adminEmail}`);
            
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <tr>
            <td style="padding: 30px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); border-radius: 12px 12px 0 0;">
                <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">${subject}</h1>
            </td>
        </tr>
        <tr>
            <td style="padding: 30px;">
                ${htmlContent}
            </td>
        </tr>
        <tr>
            <td style="padding: 20px 30px; background: #F8FAFC; border-radius: 0 0 12px 12px; text-align: center; color: #64748B; font-size: 12px;">
                This is an automated admin notification from RefOpen.
            </td>
        </tr>
    </table>
</body>
</html>`;

            return await this.send({
                to: adminEmail,
                subject: `[RefOpen Admin] ${subject}`,
                html,
                emailType: 'admin_notification'
            });
        } catch (error: any) {
            console.error('❌ Error sending admin notification:', error.message);
            return { success: false, error: error.message };
        }
    }
}

export default EmailService;
