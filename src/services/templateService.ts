/**
 * Template Service - Email Template Rendering
 * 
 * Manages email templates with Handlebars-style variable replacement
 */

interface TemplateData {
    [key: string]: any;
}

interface RenderedTemplate {
    subject: string;
    html: string;
    text?: string;
}

// App configuration
const APP_CONFIG = {
    appName: 'RefOpen',
    appUrl: process.env.APP_URL || 'https://refopen.com',
    supportEmail: 'support@refopen.com',
    logoUrl: 'https://refopen.com/logo.png'
};

// Email templates
const templates: Record<string, { subject: string; html: string }> = {

    // ========================================
    // REFERRAL NOTIFICATIONS
    // ========================================

    'new_referral_request': {
        subject: '🎯 New referral request at {{companyName}} - Help {{seekerName}} get hired!',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">RefOpen</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Help someone land their dream job</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hi {{referrerName}},</h2>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Great news! <strong style="color: #667eea;">{{seekerName}}</strong> is looking for a referral at 
                                <strong style="color: #333;">{{companyName}}</strong> and you can help!
                            </p>
                            
                            <!-- Job Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px;">{{jobTitle}}</h3>
                                        <p style="margin: 0; color: #666; font-size: 14px;">{{companyName}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Rewards Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #166534; font-size: 14px;">
                                            💰 <strong>Earn ₹25-35</strong> when you refer and the seeker verifies!
                                        </p>
                                        <p style="margin: 8px 0 0 0; color: #166534; font-size: 13px;">
                                            ⚡ Quick response bonus: Extra ₹10 if you refer within 24 hours!
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 30px 0;">
                                        <a href="{{actionUrl}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
                                            View Request & Refer →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #888; font-size: 14px; line-height: 1.6;">
                                Your referral could be the key to helping someone start their dream career. 
                                It only takes 2 minutes!
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eee;">
                            <p style="margin: 0 0 10px 0; color: #888; font-size: 12px; text-align: center;">
                                You're receiving this because you're registered as an employee at {{companyName}} on RefOpen.
                            </p>
                            <p style="margin: 0; color: #888; font-size: 12px; text-align: center;">
                                <a href="{{unsubscribeUrl}}" style="color: #667eea; text-decoration: none;">Manage notification preferences</a>
                                &nbsp;|&nbsp;
                                <a href="{{appUrl}}" style="color: #667eea; text-decoration: none;">Open RefOpen</a>
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    'referral_claimed': {
        subject: '✅ Great news! Your referral request was claimed',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">RefOpen</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Your referral is on the way!</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hi {{seekerName}},</h2>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                🎉 <strong style="color: #10b981;">{{referrerName}}</strong> has claimed your referral request 
                                for <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>!
                            </p>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                They're now working on submitting your referral. You'll receive another notification 
                                once they've completed the referral with proof.
                            </p>
                            
                            <!-- Status Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border-radius: 8px; margin: 25px 0; border-left: 4px solid #10b981;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">
                                            📋 Next Steps:
                                        </p>
                                        <ol style="margin: 10px 0 0 0; padding-left: 20px; color: #166534; font-size: 14px;">
                                            <li>Referrer submits your application internally</li>
                                            <li>They upload proof of referral</li>
                                            <li>You verify and confirm the referral</li>
                                        </ol>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 30px 0;">
                                        <a href="{{actionUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                            Track Your Referral →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eee;">
                            <p style="margin: 0; color: #888; font-size: 12px; text-align: center;">
                                <a href="{{unsubscribeUrl}}" style="color: #10b981; text-decoration: none;">Manage notifications</a>
                                &nbsp;|&nbsp;
                                <a href="{{appUrl}}" style="color: #10b981; text-decoration: none;">Open RefOpen</a>
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    'referral_verified': {
        subject: '💰 You earned ₹{{amount}} for your referral!',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 48px;">💰</h1>
                            <p style="color: rgba(255,255,255,0.95); margin: 8px 0 0 0; font-size: 18px; font-weight: 600;">You got paid!</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hi {{referrerName}},</h2>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                <strong style="color: #333;">{{seekerName}}</strong> has verified your referral! 
                            </p>
                            
                            <!-- Amount Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 30px; text-align: center;">
                                        <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px;">Credited to your wallet</p>
                                        <p style="margin: 0; color: #78350f; font-size: 42px; font-weight: 700;">₹{{amount}}</p>
                                        <p style="margin: 10px 0 0 0; color: #92400e; font-size: 13px;">
                                            New wallet balance: ₹{{newBalance}}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Job Info -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 8px; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 5px 0; color: #888; font-size: 12px;">Referral for</p>
                                        <p style="margin: 0; color: #333; font-size: 16px; font-weight: 600;">{{jobTitle}}</p>
                                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">{{companyName}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 20px 0;">
                                Thank you for helping {{seekerName}} with their job search. 
                                Your referral makes a real difference!
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 30px 0;">
                                        <a href="{{walletUrl}}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                            View Wallet →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eee;">
                            <p style="margin: 0; color: #888; font-size: 12px; text-align: center;">
                                <a href="{{unsubscribeUrl}}" style="color: #f59e0b; text-decoration: none;">Manage notifications</a>
                                &nbsp;|&nbsp;
                                <a href="{{appUrl}}" style="color: #f59e0b; text-decoration: none;">Open RefOpen</a>
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    // ========================================
    // ADMIN NOTIFICATIONS
    // ========================================

    'new_support_ticket': {
        subject: '🎫 New Support Ticket: {{subject}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">🎫 New Support Ticket</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">A user needs assistance</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <!-- Ticket Info Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #fef2f2; border-radius: 8px; margin: 0 0 25px 0; border-left: 4px solid #ef4444;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px;">{{subject}}</h3>
                                        <p style="margin: 0; color: #666; font-size: 14px;">
                                            <strong>Ticket ID:</strong> {{ticketId}}<br>
                                            <strong>Category:</strong> {{category}}<br>
                                            <strong>Priority:</strong> {{priority}}<br>
                                            <strong>Status:</strong> {{status}}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- User Info -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 8px; margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 5px 0; color: #888; font-size: 12px; text-transform: uppercase;">User Details</p>
                                        <p style="margin: 0; color: #333; font-size: 16px; font-weight: 600;">{{userName}}</p>
                                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">{{userEmail}}</p>
                                        <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">User ID: {{userId}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Message -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #888; font-size: 12px; text-transform: uppercase;">Message</p>
                                        <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">{{message}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6b7280; font-size: 13px; margin: 0;">
                                Created: {{createdAt}}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eee;">
                            <p style="margin: 0; color: #888; font-size: 12px; text-align: center;">
                                This is an automated notification from RefOpen Support System.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    'new_manual_payment': {
        subject: '💰 New Payment Deposit Request: ₹{{amount}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">💰 Payment Deposit Request</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">A user has submitted payment proof for verification</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <!-- Amount Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 30px; text-align: center;">
                                        <p style="margin: 0 0 5px 0; color: #065f46; font-size: 14px;">Amount Submitted</p>
                                        <p style="margin: 0; color: #047857; font-size: 42px; font-weight: 700;">₹{{amount}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Payment Details Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 8px; margin: 0 0 25px 0; border-left: 4px solid #10b981;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Payment Details</h3>
                                        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
                                            <strong>Submission ID:</strong> {{submissionId}}
                                        </p>
                                        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
                                            <strong>Payment Method:</strong> {{paymentMethod}}
                                        </p>
                                        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
                                            <strong>Reference Number:</strong> {{referenceNumber}}
                                        </p>
                                        <p style="margin: 0; color: #666; font-size: 14px;">
                                            <strong>Payment Date:</strong> {{paymentDate}}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- User Info -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 5px 0; color: #888; font-size: 12px; text-transform: uppercase;">User Details</p>
                                        <p style="margin: 0; color: #333; font-size: 16px; font-weight: 600;">{{userName}}</p>
                                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">{{userEmail}}</p>
                                        <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">User ID: {{userId}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- User Remarks (conditionally rendered) -->
                            {{userRemarksSection}}
                            
                            <p style="color: #6b7280; font-size: 13px; margin: 0;">
                                Submitted: {{submittedAt}}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eee;">
                            <p style="margin: 0; color: #888; font-size: 12px; text-align: center;">
                                Please verify and process this payment in the Admin Panel.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    }
};

export class TemplateService {

    /**
     * Render a template with data
     */
    static render(templateName: string, data: TemplateData): RenderedTemplate {
        const template = templates[templateName];
        
        if (!template) {
            throw new Error(`Email template '${templateName}' not found`);
        }

        // Merge with default app config
        const mergedData = {
            ...data,
            appName: APP_CONFIG.appName,
            appUrl: APP_CONFIG.appUrl,
            supportEmail: APP_CONFIG.supportEmail,
            logoUrl: APP_CONFIG.logoUrl,
            unsubscribeUrl: `${APP_CONFIG.appUrl}/settings/notifications`,
            currentYear: new Date().getFullYear()
        };

        // Replace all {{variable}} placeholders
        const subject = this.replacePlaceholders(template.subject, mergedData);
        const html = this.replacePlaceholders(template.html, mergedData);
        const text = this.htmlToText(html);

        return { subject, html, text };
    }

    /**
     * Replace {{variable}} placeholders in template
     */
    private static replacePlaceholders(template: string, data: TemplateData): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? String(data[key]) : match;
        });
    }

    /**
     * Convert HTML to plain text
     */
    private static htmlToText(html: string): string {
        return html
            // Remove style and script tags
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            // Convert links
            .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
            // Convert line breaks
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/tr>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            // Remove remaining tags
            .replace(/<[^>]+>/g, '')
            // Clean up whitespace
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /**
     * Get list of available templates
     */
    static getAvailableTemplates(): string[] {
        return Object.keys(templates);
    }

    /**
     * Check if template exists
     */
    static hasTemplate(name: string): boolean {
        return name in templates;
    }
}

export default TemplateService;
