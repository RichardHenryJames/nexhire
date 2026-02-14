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
    appUrl: process.env.APP_URL || 'https://www.refopen.com',
    logoUrl: 'https://www.refopen.com/logo.png'
};

// Shared email footer with logo
const EMAIL_FOOTER = `
                    <!-- Footer -->
                    <tr>
                        <td style="background: #F8FAFC; padding: 32px 40px; border-top: 1px solid #E2E8F0; text-align: center;">
                            <img src="{{appUrl}}/refopen-logo.png" alt="RefOpen" width="100" style="margin-bottom: 16px;">
                            <p style="margin: 0 0 8px 0; color: #64748B; font-size: 12px;">
                                {{footerText}}
                            </p>
                            <p style="margin: 0; color: #64748B; font-size: 12px;">
                                <a href="{{unsubscribeUrl}}" style="color: #4F46E5; text-decoration: none;">Email Preferences</a>
                                <span style="color: #CBD5E1; margin: 0 8px;">|</span>
                                <a href="{{appUrl}}/support" style="color: #4F46E5; text-decoration: none;">Help Center</a>
                                <span style="color: #CBD5E1; margin: 0 8px;">|</span>
                                <a href="{{appUrl}}" style="color: #4F46E5; text-decoration: none;">RefOpen</a>
                            </p>
                        </td>
                    </tr>`;

// Email templates
const templates: Record<string, { subject: string; html: string }> = {

    // ========================================
    // REFERRAL NOTIFICATIONS
    // ========================================

    'new_referral_request': {
        subject: 'New Referral Request - {{seekerName}} for {{jobTitle}}',
        html: `
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
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">New Referral Request</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">Someone needs your help getting referred</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi {{referrerName}},
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                <strong style="color: #1a1a1a;">{{seekerName}}</strong> is looking for a referral at 
                                <strong style="color: #1a1a1a;">{{companyName}}</strong> and has requested your help.
                            </p>
                            
                            <!-- Job Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 4px 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Position</p>
                                        <h3 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">{{jobTitle}}</h3>
                                        <p style="margin: 0; color: #64748B; font-size: 14px;">{{companyName}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Rewards Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 8px 0; color: #065F46; font-size: 15px; font-weight: 600;">
                                            Earn up to ₹100 for this referral
                                        </p>
                                        <p style="margin: 0; color: #047857; font-size: 14px;">
                                            Quick response bonus available if you refer within 24 hours.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 8px 0 32px 0;">
                                        <a href="{{actionUrl}}" style="display: inline-block; background: #4F46E5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            View Request
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0;">
                                Your referral could help someone start their dream career. It only takes a few minutes.
                            </p>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', "You're receiving this because you're registered as an employee at {{companyName}} on RefOpen.")}
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    'referral_claimed': {
        subject: 'Someone Is Working on Your Referral - {{jobTitle}} at {{companyName}}',
        html: `
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
                        <td style="background: #3B82F6; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Referral In Progress</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">A referrer has picked up your request</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi {{seekerName}},
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">
                                <strong style="color: #1a1a1a;">{{referrerName}}</strong> has accepted your referral request 
                                for <strong style="color: #1a1a1a;">{{jobTitle}}</strong> at <strong style="color: #1a1a1a;">{{companyName}}</strong> 
                                and is working on submitting it.
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                You'll receive another email once the referral has been officially submitted. In the meantime, 
                                make sure your resume and profile are up to date.
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 8px 0 32px 0;">
                                        <a href="{{actionUrl}}" style="display: inline-block; background: #3B82F6; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            Track Your Referral
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #64748B; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
                                Hang tight — your referral is on its way!
                            </p>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', 'A referrer accepted your request on RefOpen.')}
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    'referral_completed': {
        subject: 'Your Referral Has Been Submitted - {{jobTitle}} at {{companyName}}',
        html: `
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
                        <td style="background: #10B981; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Referral Submitted</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">Great news about your application</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi {{seekerName}},
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">
                                <strong style="color: #1a1a1a;">{{referrerName}}</strong> has submitted your referral 
                                for <strong style="color: #1a1a1a;">{{jobTitle}}</strong> at <strong style="color: #1a1a1a;">{{companyName}}</strong>.
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                You should receive a confirmation email from {{companyName}} soon. Once you see 
                                the referral in your application portal, come back to RefOpen to confirm it.
                            </p>
                            
                            <!-- Why Verify Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 12px 0; color: #1E40AF; font-size: 14px; font-weight: 600;">
                                            Why confirm your referral?
                                        </p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 4px 0; color: #1E40AF; font-size: 14px;">• Track all your referrals in one place</td></tr>
                                            <tr><td style="padding: 4px 0; color: #1E40AF; font-size: 14px;">• Build your RefOpen profile with verified referrals</td></tr>
                                            <tr><td style="padding: 4px 0; color: #1E40AF; font-size: 14px;">• Help the community by rating your experience</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 8px 0 32px 0;">
                                        <a href="{{actionUrl}}" style="display: inline-block; background: #10B981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            View Details
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #64748B; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
                                Good luck with your application!
                            </p>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', 'Your referral request was accepted on RefOpen.')}
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    'referral_verified': {
        subject: 'Referral Verified - ₹{{amount}} Credited to Your Wallet',
        html: `
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
                        <td style="background: #F59E0B; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Payment Received</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 15px;">Your referral has been verified</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi {{referrerName}},
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                <strong style="color: #1a1a1a;">{{seekerName}}</strong> has verified your referral. 
                            </p>
                            
                            <!-- Amount Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 28px; text-align: center;">
                                        <p style="margin: 0 0 4px 0; color: #92400E; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Credited to your wallet</p>
                                        <p style="margin: 0; color: #78350F; font-size: 36px; font-weight: 700;">₹{{amount}}</p>
                                        <p style="margin: 12px 0 0 0; color: #A16207; font-size: 14px;">
                                            New balance: ₹{{newBalance}}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Job Info -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 4px 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Referral for</p>
                                        <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">{{jobTitle}}</p>
                                        <p style="margin: 4px 0 0 0; color: #64748B; font-size: 14px;">{{companyName}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                Thank you for helping {{seekerName}} with their job search. Your referral makes a real difference.
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 8px 0 24px 0;">
                                        <a href="{{walletUrl}}" style="display: inline-block; background: #F59E0B; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            View Wallet
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', 'This is a notification from RefOpen.')}
                    
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
        subject: 'New Support Ticket: {{subject}}',
        html: `
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
                        <td style="background: #EF4444; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">New Support Ticket</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">A user needs assistance</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <!-- Ticket Info Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">{{subject}}</h3>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Ticket ID:</strong> {{ticketId}}</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Category:</strong> {{category}}</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Priority:</strong> {{priority}}</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Status:</strong> {{status}}</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- User Info -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 4px 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">User Details</p>
                                        <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">{{userName}}</p>
                                        <p style="margin: 4px 0 0 0; color: #64748B; font-size: 14px;">{{userEmail}}</p>
                                        <p style="margin: 4px 0 0 0; color: #94A3B8; font-size: 12px;">User ID: {{userId}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Message -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 8px 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message</p>
                                        <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">{{message}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #64748B; font-size: 13px; margin: 0;">
                                Created: {{createdAt}}
                            </p>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', 'This is an automated notification from RefOpen Support System.')}
                    
                </table>
            </td>
        </tr>
    </table>
    </body>
    </html>
            `
        },

        'support_ticket_reply': {
            subject: 'Support Update: {{subject}}',
            html: `
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
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Support Update</h1>
                                <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">Our team has responded to your ticket</p>
                            </td>
                        </tr>
                    
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <p style="margin: 0 0 24px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                    Hi {{userName}},
                                </p>
                            
                                <p style="margin: 0 0 24px 0; color: #64748B; font-size: 15px; line-height: 1.6;">
                                    Our support team has responded to your ticket. Here are the details:
                                </p>
                            
                                <!-- Ticket Info Card -->
                                <table width="100%" cellpadding="0" cellspacing="0" style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; margin: 0 0 24px 0;">
                                    <tr>
                                        <td style="padding: 20px;">
                                            <h3 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">{{subject}}</h3>
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Ticket ID:</strong> {{ticketId}}</td></tr>
                                                <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Status:</strong> {{status}}</td></tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            
                                <!-- Admin Reply -->
                                <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                    <tr>
                                        <td style="padding: 20px;">
                                            <p style="margin: 0 0 8px 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Support Team Response</p>
                                            <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">{{adminMessage}}</p>
                                        </td>
                                    </tr>
                                </table>
                            
                                <!-- CTA Button -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding: 8px 0 32px 0;">
                                            <a href="{{appUrl}}/support/{{ticketId}}" style="display: inline-block; background: #4F46E5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                                View Ticket & Reply
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            
                                <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0;">
                                    If you have any further questions, simply reply to this ticket in the app.
                                </p>
                            </td>
                        </tr>
                    
    ${EMAIL_FOOTER.replace('{{footerText}}', 'This is a notification from RefOpen Support.')}
                    
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
            `
        },

        'new_manual_payment': {
        subject: 'New Payment Deposit Request: ₹{{amount}}',
        html: `
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
                        <td style="background: #10B981; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Payment Deposit Request</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">A user has submitted payment proof</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <!-- Amount Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 28px; text-align: center;">
                                        <p style="margin: 0 0 4px 0; color: #065F46; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Submitted</p>
                                        <p style="margin: 0; color: #047857; font-size: 36px; font-weight: 700;">₹{{amount}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Payment Details Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 15px; font-weight: 600;">Payment Details</p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Submission ID:</strong> {{submissionId}}</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Payment Method:</strong> {{paymentMethod}}</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Reference Number:</strong> {{referenceNumber}}</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 14px;"><strong>Payment Date:</strong> {{paymentDate}}</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- User Info -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 4px 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">User Details</p>
                                        <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">{{userName}}</p>
                                        <p style="margin: 4px 0 0 0; color: #64748B; font-size: 14px;">{{userEmail}}</p>
                                        <p style="margin: 4px 0 0 0; color: #94A3B8; font-size: 12px;">User ID: {{userId}}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- User Remarks (conditionally rendered) -->
                            {{userRemarksSection}}
                            
                            <p style="color: #64748B; font-size: 13px; margin: 0;">
                                Submitted: {{submittedAt}}
                            </p>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', 'This is an admin notification from RefOpen.')}
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    // ========================================
    // PAYMENT APPROVED (User notification)
    // ========================================

    'payment_approved': {
        subject: 'Payment Approved: ₹{{totalCredited}} Added to Your Wallet',
        html: `
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
                        <td style="background: #10B981; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Payment Approved</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">Your wallet has been credited</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi {{firstName}},
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                Great news! Your payment has been verified and your RefOpen wallet has been credited.
                            </p>
                            
                            <!-- Amount Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 24px; text-align: center;">
                                        <p style="margin: 0 0 4px 0; color: #047857; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total Credited</p>
                                        <p style="margin: 0; color: #059669; font-size: 36px; font-weight: 700;">₹{{totalCredited}}</p>
                                        {{bonusLine}}
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Details -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 6px 0; color: #64748B; font-size: 14px;"><strong style="color: #1a1a1a;">New Balance:</strong> ₹{{newBalance}}</td></tr>
                                            <tr><td style="padding: 6px 0; color: #64748B; font-size: 14px;"><strong style="color: #1a1a1a;">Payment Method:</strong> {{paymentMethod}}</td></tr>
                                            <tr><td style="padding: 6px 0; color: #64748B; font-size: 14px;"><strong style="color: #1a1a1a;">Reference:</strong> {{referenceNumber}}</td></tr>
                                            <tr><td style="padding: 6px 0; color: #64748B; font-size: 14px;"><strong style="color: #1a1a1a;">Approved:</strong> {{approvedAt}}</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 8px 0;">
                                        <a href="{{walletUrl}}" style="display: inline-block; background: #10B981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            View My Wallet
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', 'This is a transaction notification from RefOpen.')}
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    // ========================================
    // ADMIN MESSAGE NOTIFICATIONS
    // ========================================

    'admin_new_message': {
        subject: 'New Message from {{senderName}} on RefOpen',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <tr>
                        <td style="background: #4F46E5; padding: 32px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px;">New Message</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px;">
                            <p style="color: #1a1a1a; font-size: 16px; margin: 0 0 16px 0;">
                                You have a new message from <strong>{{senderName}}</strong>
                            </p>
                            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
                                <p style="color: #4a4a4a; font-size: 15px; margin: 0; white-space: pre-wrap;">{{messagePreview}}</p>
                            </div>
                            <a href="{{appUrl}}/messages" style="display: inline-block; background: #4F46E5; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">View Message</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #F8FAFC; padding: 24px; text-align: center; border-top: 1px solid #E2E8F0;">
                            <p style="margin: 0; color: #64748B; font-size: 12px;">RefOpen - Get Referred, Get Hired</p>
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
    // UNREAD MESSAGE REMINDER (sent after 1 hour if message not read)
    // ========================================

    'unread_message_reminder': {
        subject: '💬 {{subjectText}}',
        html: `
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
                        <td style="background: #3B82F6; padding: 32px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">{{headerTitle}}</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 14px;">{{headerSubtitle}}</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                                Hi {{recipientName}},
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                {{bodyText}}
                            </p>
                            
                            <!-- Message Cards -->
                            {{messageCardsHtml}}
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 8px 0 24px 0;">
                                        <a href="{{appUrl}}/messages" style="display: inline-block; background: #3B82F6; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            {{ctaText}}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #64748B; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;">
                                Quick responses lead to better connections!
                            </p>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', 'You received this because you have unread messages on RefOpen.')}
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    // ========================================
    // USER REGISTRATION
    // ========================================

    'welcome_new_user': {
        subject: 'Welcome to RefOpen, {{firstName}}!',
        html: `
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
                        <td style="background: #4F46E5; padding: 48px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Welcome to RefOpen</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px; font-weight: 400;">Your account has been created successfully</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi {{firstName}},
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                Thank you for joining RefOpen. You now have access to <strong>125,000+ job opportunities</strong> from leading companies, along with the ability to request referrals directly from verified employees, without needing personal connections.
                            </p>
                            
                            <!-- Stats Banner -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 32px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td width="33%" style="text-align: center; border-right: 1px solid #E2E8F0;">
                                                    <p style="margin: 0; color: #4F46E5; font-size: 24px; font-weight: 700;">125K+</p>
                                                    <p style="margin: 4px 0 0 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Active Jobs</p>
                                                </td>
                                                <td width="33%" style="text-align: center; border-right: 1px solid #E2E8F0;">
                                                    <p style="margin: 0; color: #4F46E5; font-size: 24px; font-weight: 700;">500+</p>
                                                    <p style="margin: 4px 0 0 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Companies</p>
                                                </td>
                                                <td width="33%" style="text-align: center;">
                                                    <p style="margin: 0; color: #4F46E5; font-size: 24px; font-weight: 700;">15x</p>
                                                    <p style="margin: 4px 0 0 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Higher Success</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- What You Can Do Section -->
                            <h3 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">What You Can Do on RefOpen</h3>
                            
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                                <tr>
                                    <td style="padding: 10px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6; border-bottom: 1px solid #F1F5F9;">
                                        <strong style="color: #1a1a1a;">Browse Jobs</strong> — Search 125,000+ roles from top tech companies, Fortune 500 firms, and fast-growing startups using AI-powered filters.
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6; border-bottom: 1px solid #F1F5F9;">
                                        <strong style="color: #1a1a1a;">Request Referrals</strong> — Send referral requests to multiple verified employees at any company. Your request is broadcast to all available referrers.
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6; border-bottom: 1px solid #F1F5F9;">
                                        <strong style="color: #1a1a1a;">Track Applications</strong> — Monitor your referral requests, see who accepted, and track your application status in real-time.
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                                        <strong style="color: #1a1a1a;">Connect with Referrers</strong> — Message referrers directly, share your resume, and get guidance on the application process.
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Getting Started Section -->
                            <h3 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">Getting Started</h3>
                            
                            <!-- Step 1 -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                                <tr>
                                    <td width="32" valign="top">
                                        <div style="width: 24px; height: 24px; background: #4F46E5; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px; font-weight: 600;">1</div>
                                    </td>
                                    <td style="padding-left: 12px;">
                                        <p style="margin: 0; color: #1a1a1a; font-size: 14px; font-weight: 500;">Complete your profile</p>
                                        <p style="margin: 4px 0 0 0; color: #64748B; font-size: 13px; line-height: 1.5;">Add your work experience, education, skills, and upload your resume. A complete profile increases your chances of getting accepted by referrers.</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Step 2 -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                                <tr>
                                    <td width="32" valign="top">
                                        <div style="width: 24px; height: 24px; background: #0EA5E9; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px; font-weight: 600;">2</div>
                                    </td>
                                    <td style="padding-left: 12px;">
                                        <p style="margin: 0; color: #1a1a1a; font-size: 14px; font-weight: 500;">Find jobs that match your skills</p>
                                        <p style="margin: 4px 0 0 0; color: #64748B; font-size: 13px; line-height: 1.5;">Use our AI-powered search to discover relevant opportunities. Filter by company, location, experience level, salary range, and more.</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Step 3 -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                                <tr>
                                    <td width="32" valign="top">
                                        <div style="width: 24px; height: 24px; background: #10B981; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px; font-weight: 600;">3</div>
                                    </td>
                                    <td style="padding-left: 12px;">
                                        <p style="margin: 0; color: #1a1a1a; font-size: 14px; font-weight: 500;">Request a referral</p>
                                        <p style="margin: 4px 0 0 0; color: #64748B; font-size: 13px; line-height: 1.5;">Click "Request Referral" on any job listing. Your request will be sent to all verified employees at that company who can refer you.</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Step 4 -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                                <tr>
                                    <td width="32" valign="top">
                                        <div style="width: 24px; height: 24px; background: #F59E0B; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px; font-weight: 600;">4</div>
                                    </td>
                                    <td style="padding-left: 12px;">
                                        <p style="margin: 0; color: #1a1a1a; font-size: 14px; font-weight: 500;">Get referred and track progress</p>
                                        <p style="margin: 4px 0 0 0; color: #64748B; font-size: 13px; line-height: 1.5;">When a referrer accepts your request, you'll be notified. Track the status of all your applications from your dashboard.</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 0 0 32px 0;">
                                        <a href="{{appUrl}}" style="display: inline-block; background: #4F46E5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            Go to Dashboard
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Referrer Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="margin: 0 0 12px 0; color: #92400E; font-size: 15px; font-weight: 600;">Are you currently employed?</p>
                                        <p style="margin: 0 0 12px 0; color: #A16207; font-size: 14px; line-height: 1.6;">
                                            You can also become a referrer on RefOpen. Help job seekers get hired at your company and earn rewards for every successful referral.
                                        </p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 4px 0; color: #92400E; font-size: 13px;">• Earn cash rewards for successful referrals</td></tr>
                                            <tr><td style="padding: 4px 0; color: #92400E; font-size: 13px;">• Post jobs from your company</td></tr>
                                            <tr><td style="padding: 4px 0; color: #92400E; font-size: 13px;">• Get a verified employee badge</td></tr>
                                            <tr><td style="padding: 4px 0; color: #92400E; font-size: 13px;">• Withdraw earnings to UPI or bank account</td></tr>
                                        </table>
                                        <p style="margin: 16px 0 0 0; color: #A16207; font-size: 13px;">
                                            <a href="{{appUrl}}/settings" style="color: #92400E; font-weight: 500; text-decoration: underline;">Verify your work email</a> to get started as a referrer.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Help Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 20px 24px;">
                                        <p style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">Need help?</p>
                                        <p style="margin: 0; color: #64748B; font-size: 13px; line-height: 1.6;">
                                            If you have any questions or need assistance, visit our <a href="{{appUrl}}/support" style="color: #4F46E5; text-decoration: none;">Help Center</a> or reply to this email. We're here to help you succeed.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Social Media Links -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 16px 0;">
                                        <p style="margin: 0 0 12px 0; color: #64748B; font-size: 13px;">Follow us on social media</p>
                                        <table cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding: 0 8px;">
                                                    <a href="https://www.linkedin.com/company/refopen" style="color: #0A66C2; text-decoration: none; font-size: 13px;">LinkedIn</a>
                                                </td>
                                                <td style="padding: 0 8px; color: #E2E8F0;">|</td>
                                                <td style="padding: 0 8px;">
                                                    <a href="https://www.instagram.com/refopensolutions" style="color: #E4405F; text-decoration: none; font-size: 13px;">Instagram</a>
                                                </td>
                                                <td style="padding: 0 8px; color: #E2E8F0;">|</td>
                                                <td style="padding: 0 8px;">
                                                    <a href="https://x.com/refopensolution" style="color: #1DA1F2; text-decoration: none; font-size: 13px;">X (Twitter)</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', 'This email was sent because you created an account on RefOpen.')}
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    // ========================================
    // REFERRER OPEN REQUESTS NOTIFICATION EMAIL
    // ========================================

    'referrer_open_requests': {
        subject: '{{openCount}} {{candidateWord}} {{needWord}} Your Referral at {{companyName}}',
        html: `
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
                        <td style="background: #10B981; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Open Referral {{requestWord}}</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">Help {{candidateWordLower}} at {{companyName}}</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi {{firstName}},
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                <strong style="color: #10B981;">{{openCount}} {{candidateWordLower}}</strong> {{isAre}} looking for a referral at <strong style="color: #1a1a1a;">{{companyName}}</strong>. 
                                Your help can make a difference in someone's career.
                            </p>
                            
                            <p style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 15px; font-weight: 600;">Referral Requests</p>
                            
                            <!-- Request Cards -->
                            {{requestCardsHtml}}
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 24px 0;">
                                        <a href="{{appUrl}}/referrals" style="display: inline-block; background: #10B981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            View All Requests
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Benefits Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 12px 0; color: #92400E; font-size: 14px; font-weight: 600;">Referrer Benefits</p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 4px 0; color: #A16207; font-size: 13px;">• Earn up to ₹100 per successful referral</td></tr>
                                            <tr><td style="padding: 4px 0; color: #A16207; font-size: 13px;">• Quick response bonus rewards</td></tr>
                                            <tr><td style="padding: 4px 0; color: #A16207; font-size: 13px;">• Unlock badges as you help more candidates</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', "You're receiving this because you're a verified referrer at {{companyName}}.")}
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    },

    // ========================================
    // DAILY JOB RECOMMENDATIONS EMAIL
    // ========================================

    'daily_job_recommendations': {
        subject: '💼 {{totalJobs}} jobs waiting for you, {{firstName}}!',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
                    
                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 20px 0;">
                            <p style="color: #1a1a1a; font-size: 15px; line-height: 1.6; margin: 0;">
                                Hi {{firstName}},
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Intro Text -->
                    <tr>
                        <td style="padding: 0 0 15px 0;">
                            <p style="color: #4a4a4a; font-size: 14px; line-height: 1.7; margin: 0;">
                                Here are some active job openings we have that match your profile. Just click on any company to read about the job and apply.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Tip Banner -->
                    <tr>
                        <td style="padding: 0 0 20px 0;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 12px 15px;">
                                        <p style="margin: 0; font-size: 13px; color: #92400E;">
                                            💡 <strong>Tip:</strong> Complete your profile for better job matches. 
                                            <a href="{{appUrl}}/profile" style="color: #2563eb; text-decoration: none; font-weight: 500;">Update profile →</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Job List -->
                    <tr>
                        <td>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                {{jobCardsHtml}}
                            </table>
                        </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                        <td align="center" style="padding: 30px 0;">
                            <a href="{{appUrl}}/jobs" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                                View all {{totalJobs}} jobs for you »
                            </a>
                        </td>
                    </tr>
                    
${EMAIL_FOOTER.replace('{{footerText}}', 'Jobs matched based on your profile preferences.')}
                    
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
