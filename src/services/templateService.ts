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
    supportEmail: 'support@refopen.com',
    logoUrl: 'https://www.refopen.com/logo.png'
};

// Email templates
const templates: Record<string, { subject: string; html: string }> = {

    // ========================================
    // REFERRAL NOTIFICATIONS
    // ========================================

    'new_referral_request': {
        subject: '🎯 New referral request received - Help someone get referred & earn rewards!',
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
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f5e9; border-radius: 8px; margin: 25px 0; border: 1px solid #c8e6c9;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #1b5e20; font-size: 16px; font-weight: 600;">
                                            💰 Earn up to <strong>₹100</strong> per referral!
                                        </p>
                                        <p style="margin: 10px 0 0 0; color: #2e7d32; font-size: 14px;">
                                            ⚡ Quick response bonus if you refer within 24 hours!
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
                                <a href="{{unsubscribeUrl}}" style="color: #667eea; text-decoration: none;">Manage notifications</a>
                                &nbsp;|&nbsp;
                                <a href="{{appUrl}}/support" style="color: #667eea; text-decoration: none;">Help & Support</a>
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
        subject: '🎉 Your referral has been submitted!',
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
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Great news about your referral!</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hi {{seekerName}},</h2>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                🎉 <strong style="color: #10b981;">{{referrerName}}</strong> has submitted your referral 
                                for <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>!
                            </p>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                You should receive a confirmation email from {{companyName}} soon. Once you see 
                                the referral in your application, come back to RefOpen to confirm it and 
                                complete your referral journey!
                            </p>
                            
                            <!-- Why Verify Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #eff6ff; border-radius: 8px; margin: 25px 0; border-left: 4px solid #3b82f6;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600;">
                                            💡 Why confirm your referral?
                                        </p>
                                        <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #1e40af; font-size: 14px;">
                                            <li>Track all your referrals in one place</li>
                                            <li>Build your RefOpen profile with verified referrals</li>
                                            <li>Help the community by rating your referral experience</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 30px 0;">
                                        <a href="{{actionUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                            View Details & Confirm →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0; text-align: center;">
                                Good luck with your application! 🍀
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eee;">
                            <p style="margin: 0; color: #888; font-size: 12px; text-align: center;">
                                <a href="{{unsubscribeUrl}}" style="color: #10b981; text-decoration: none;">Manage notifications</a>
                                &nbsp;|&nbsp;
                                <a href="{{appUrl}}/support" style="color: #10b981; text-decoration: none;">Help & Support</a>
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
                                <a href="{{appUrl}}/support" style="color: #f59e0b; text-decoration: none;">Help & Support</a>
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
    },

    // ========================================
    // USER REGISTRATION
    // ========================================

    'welcome_new_user': {
        subject: '🎉 Welcome {{firstName}} to RefOpen - Find Jobs, Get Referred, Hire Talent, Earn Rewards!',
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
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">Welcome to RefOpen! 🚀</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px;">Find Jobs. Get Referred. Hire Talent. Earn Rewards.</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hi {{firstName}},</h2>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                Welcome aboard! You've just joined <strong>125,000+</strong> job seekers who are landing jobs 
                                at top companies using RefOpen.
                            </p>
                            
                            <!-- Stats Banner -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin: 0 0 30px 0;">
                                <tr>
                                    <td style="padding: 25px; text-align: center;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td width="33%" style="text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">
                                                    <p style="margin: 0; color: white; font-size: 28px; font-weight: 700;">125K+</p>
                                                    <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.8); font-size: 12px;">Active Jobs</p>
                                                </td>
                                                <td width="33%" style="text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">
                                                    <p style="margin: 0; color: white; font-size: 28px; font-weight: 700;">500+</p>
                                                    <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.8); font-size: 12px;">Top Companies</p>
                                                </td>
                                                <td width="33%" style="text-align: center;">
                                                    <p style="margin: 0; color: white; font-size: 28px; font-weight: 700;">48hrs</p>
                                                    <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.8); font-size: 12px;">Avg Response</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- How It Works Section -->
                            <h3 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">🎯 How RefOpen Works</h3>
                            
                            <!-- Step 1 -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
                                <tr>
                                    <td width="50" valign="top">
                                        <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; text-align: center; line-height: 36px; color: white; font-weight: 700;">1</div>
                                    </td>
                                    <td style="padding-left: 10px;">
                                        <p style="margin: 0; color: #333; font-size: 15px; font-weight: 600;">Browse & Search Jobs</p>
                                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Explore 125K+ jobs from Fortune 500 companies. AI-powered recommendations find perfect matches.</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Step 2 -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
                                <tr>
                                    <td width="50" valign="top">
                                        <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #06B6D4 0%, #0891B2 100%); border-radius: 50%; text-align: center; line-height: 36px; color: white; font-weight: 700;">2</div>
                                    </td>
                                    <td style="padding-left: 10px;">
                                        <p style="margin: 0; color: #333; font-size: 15px; font-weight: 600;">Apply Directly or Ask Referral</p>
                                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Apply with one click OR ask for a referral - your request goes to verified employees at that company!</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Step 3 -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                                <tr>
                                    <td width="50" valign="top">
                                        <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; text-align: center; line-height: 36px; color: white; font-weight: 700;">3</div>
                                    </td>
                                    <td style="padding-left: 10px;">
                                        <p style="margin: 0; color: #333; font-size: 15px; font-weight: 600;">Get Referred & Land Your Job</p>
                                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Track applications in real-time, chat with referrers, and land your dream job faster!</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Why RefOpen Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 12px; margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">✨ Why Job Seekers Love RefOpen</h3>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 5px 0; color: #555; font-size: 14px;">✅ One referral request reaches verified employees at a company</td></tr>
                                            <tr><td style="padding: 5px 0; color: #555; font-size: 14px;">✅ Skip the resume black hole - get noticed by real people</td></tr>
                                            <tr><td style="padding: 5px 0; color: #555; font-size: 14px;">✅ External referrals: Found a job elsewhere? We'll find referrers!</td></tr>
                                            <tr><td style="padding: 5px 0; color: #555; font-size: 14px;">✅ Track applications & referrals in real-time</td></tr>
                                            <tr><td style="padding: 5px 0; color: #555; font-size: 14px;">✅ Direct messaging with employers & referrers</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 30px 0;">
                                        <a href="{{appUrl}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 50px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
                                            Start Exploring Jobs →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Referrer Benefits Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; margin: 0 0 20px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 16px; text-align: center;">💰 Already Employed? Become a Referrer!</h3>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 5px 0; color: #78350f; font-size: 14px;">💵 Earn up to ₹100 for every successful referral</td></tr>
                                            <tr><td style="padding: 5px 0; color: #78350f; font-size: 14px;">🏆 Get verified badges & build your reputation</td></tr>
                                            <tr><td style="padding: 5px 0; color: #78350f; font-size: 14px;">📩 No more LinkedIn DMs - candidates come to you</td></tr>
                                            <tr><td style="padding: 5px 0; color: #78350f; font-size: 14px;">⚡ One-click referrals - we handle all paperwork</td></tr>
                                            <tr><td style="padding: 5px 0; color: #78350f; font-size: 14px;">💳 Instant withdrawals to UPI or bank account</td></tr>
                                        </table>
                                        <p style="margin: 15px 0 0 0; color: #a16207; font-size: 13px; text-align: center;">
                                            Verify your work email to start earning today!
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eee;">
                            <p style="margin: 0 0 10px 0; color: #888; font-size: 12px; text-align: center;">
                                You're receiving this because you signed up for RefOpen.
                            </p>
                            <p style="margin: 0; color: #888; font-size: 12px; text-align: center;">
                                <a href="{{unsubscribeUrl}}" style="color: #667eea; text-decoration: none;">Manage preferences</a>
                                &nbsp;|&nbsp;
                                <a href="{{appUrl}}/support" style="color: #667eea; text-decoration: none;">Help & Support</a>
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

    // ========================================
    // DAILY JOB RECOMMENDATIONS EMAIL
    // ========================================

    'daily_job_recommendations': {
        subject: '🎯 {{firstName}}, here are 5 jobs picked just for you!',
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
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Your Daily Job Picks 🎯</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hi {{firstName}},</h2>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                                Here are your <strong style="color: #667eea;">personalized job recommendations</strong> for today!
                            </p>
                            <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 0 0 25px 0;">
                                Don't miss out – apply or ask for a referral. You can also search <strong>100,000+ jobs for free</strong> on RefOpen!
                            </p>
                            
                            <!-- Job Cards -->
                            {{jobCardsHtml}}
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 30px 0;">
                                        <a href="{{appUrl}}/jobs" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
                                            Browse All Jobs →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Tips Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #333; font-size: 14px; font-weight: 600;">💡 Pro Tips:</p>
                                        <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 13px; line-height: 1.8;">
                                            <li>Ask for a referral – referred candidates are <strong>15x more likely</strong> to get a call and hired</li>
                                            <li>Complete your profile to get better job matches</li>
                                            <li>Apply early – most jobs get filled within the first week</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eee;">
                            <p style="margin: 0; color: #888; font-size: 12px; text-align: center;">
                                <a href="{{appUrl}}/settings/notifications" style="color: #667eea; text-decoration: none;">Manage notifications</a>
                                &nbsp;|&nbsp;
                                <a href="{{appUrl}}/support" style="color: #667eea; text-decoration: none;">Help & Support</a>
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
