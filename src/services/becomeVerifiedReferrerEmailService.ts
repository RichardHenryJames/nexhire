/**
 * Become Verified Referrer Email Service
 * Sends emails to users who have work experience but haven't verified their company email
 * 
 * Key Features:
 * - Targets users who have logged in (LastLoginAt IS NOT NULL)
 * - Have work experience with current job
 * - Current job is NOT verified (CompanyEmailVerified = 0 or NULL)
 * - Explains benefits of becoming verified referrer
 * - Explains the verification process
 * - Assures email privacy (encrypted, not shared, not stored)
 * - Runs at 6 PM IST (12:30 UTC) on alternate days
 */

import { dbService } from './database.service';
import { EmailService } from './emailService';

interface UnverifiedUser {
    UserID: string;
    Email: string;
    FirstName: string;
    LastName: string;
    CompanyName: string;
    JobTitle: string;
    WorkExperienceID: string;
}

interface BecomeVerifiedEmailResult {
    totalEligible: number;
    emailsSent: number;
    emailsFailed: number;
    errors: string[];
}

export class BecomeVerifiedReferrerEmailService {
    
    /**
     * Get users eligible for "Become Verified Referrer" email
     * Criteria:
     * - LastLoginAt IS NOT NULL (has logged in at least once)
     * - Has work experience with IsCurrent = 1
     * - Current work experience has CompanyEmailVerified = 0 or NULL
     * - User is NOT already a verified referrer
     * - Has valid email
     * - User is active
     */
    static async getEligibleUsers(): Promise<UnverifiedUser[]> {
        const query = `
            SELECT 
                u.UserID,
                u.Email,
                u.FirstName,
                u.LastName,
                COALESCE(o.Name, we.CompanyName) as CompanyName,
                we.JobTitle,
                we.WorkExperienceID
            FROM Users u
            INNER JOIN Applicants a ON u.UserID = a.UserID
            INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
            LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
            LEFT JOIN NotificationPreferences np ON u.UserID = np.UserID
            WHERE u.LastLoginAt IS NOT NULL
              AND u.IsActive = 1
              AND u.Email IS NOT NULL
              AND u.Email != ''
              AND u.UserType = 'JobSeeker'
              AND (u.IsVerifiedReferrer = 0 OR u.IsVerifiedReferrer IS NULL)
              AND we.IsCurrent = 1
              AND (we.IsActive = 1 OR we.IsActive IS NULL)
              AND (we.CompanyEmailVerified = 0 OR we.CompanyEmailVerified IS NULL)
              AND COALESCE(np.MarketingEmail, 1) = 1
              AND we.CompanyName IS NOT NULL
            ORDER BY u.LastLoginAt DESC
        `;
        
        const result = await dbService.executeQuery(query, []);
        return result.recordset || [];
    }

    /**
     * Generate the email HTML content
     */
    static generateEmailContent(user: UnverifiedUser): { subject: string; html: string } {
        const subject = `🚀 ${user.FirstName}, become a verified referrer at ${user.CompanyName} today!`;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Become a Verified Referrer</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                                🎯 Become a Verified Referrer
                            </h1>
                            <p style="color: #E0E7FF; margin: 15px 0 0 0; font-size: 16px;">
                                Help others land jobs at <strong>${user.CompanyName}</strong> & earn rewards!
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 30px 30px 20px 30px;">
                            <p style="color: #374151; font-size: 16px; margin: 0;">
                                Hi <strong>${user.FirstName}</strong>,
                            </p>
                            <p style="color: #6B7280; font-size: 15px; margin: 15px 0 0 0; line-height: 1.6;">
                                We noticed you're working as <strong>${user.JobTitle}</strong> at <strong>${user.CompanyName}</strong>. 
                                Did you know you can become a <strong>Verified Referrer</strong> and help talented professionals 
                                join your company while earning rewards?
                            </p>
                        </td>
                    </tr>

                    <!-- Benefits Section -->
                    <tr>
                        <td style="padding: 0 30px 20px 30px;">
                            <div style="background: linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%); border-radius: 12px; padding: 25px; border-left: 4px solid #0EA5E9;">
                                <h2 style="color: #0369A1; margin: 0 0 15px 0; font-size: 18px;">
                                    ✨ Benefits of Being a Verified Referrer
                                </h2>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 8px 0; color: #0C4A6E; font-size: 14px;">
                                            📝 <strong>Post Referral Jobs for FREE</strong> - Share job openings at your company and refer interested candidates
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #0C4A6E; font-size: 14px;">
                                            💰 <strong>Earn Rewards</strong> - Get upto ₹100 per successful referral
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #0C4A6E; font-size: 14px;">
                                            🏆 <strong>Build Reputation</strong> - Verified badge shows on your profile
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #0C4A6E; font-size: 14px;">
                                            🤝 <strong>Help Others</strong> - Connect talented people with great opportunities
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #0C4A6E; font-size: 14px;">
                                            📊 <strong>Priority Access</strong> - Get notified first about referral requests
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #0C4A6E; font-size: 14px;">
                                            💳 <strong>Easy Withdrawal</strong> - Cash out via UPI or bank account
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #0C4A6E; font-size: 14px;">
                                            📩 <strong>No Inbox Flood</strong> - Refer candidates through RefOpen & earn rewards
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>

                    <!-- How It Works Section -->
                    <tr>
                        <td style="padding: 0 30px 20px 30px;">
                            <div style="background-color: #F0FDF4; border-radius: 12px; padding: 25px; border-left: 4px solid #22C55E;">
                                <h2 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">
                                    📋 How to Become Verified (Takes 2 minutes!)
                                </h2>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="padding: 10px 0; color: #15803D; font-size: 14px;">
                                            <div style="display: inline-block; background: #22C55E; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 10px; font-weight: bold;">1</div>
                                            <strong>Open refopen.com</strong> → Go to <strong>Profile</strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; color: #15803D; font-size: 14px;">
                                            <div style="display: inline-block; background: #22C55E; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 10px; font-weight: bold;">2</div>
                                            <strong>Click "Become a Verified Referrer"</strong> button
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; color: #15803D; font-size: 14px;">
                                            <div style="display: inline-block; background: #22C55E; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 10px; font-weight: bold;">3</div>
                                            <strong>Add your current work experience</strong> (if not already added)
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; color: #15803D; font-size: 14px;">
                                            <div style="display: inline-block; background: #22C55E; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 10px; font-weight: bold;">4</div>
                                            <strong>Enter your company email</strong> & verify with OTP
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; color: #15803D; font-size: 14px;">
                                            <div style="display: inline-block; background: #22C55E; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 10px; font-weight: bold;">✓</div>
                                            <strong>Done!</strong> You're now a Verified Referrer 🎉
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>

                    <!-- Privacy Assurance Section -->
                    <tr>
                        <td style="padding: 0 30px 25px 30px;">
                            <div style="background-color: #EFF6FF; border-radius: 12px; padding: 20px; border-left: 4px solid #3B82F6;">
                                <h3 style="color: #1E40AF; margin: 0 0 10px 0; font-size: 16px;">
                                    🔒 Your Privacy is Our Priority
                                </h3>
                                <p style="color: #1E3A8A; font-size: 13px; margin: 0; line-height: 1.6;">
                                    <strong>We take your privacy seriously:</strong>
                                </p>
                                <ul style="color: #1E3A8A; font-size: 13px; margin: 10px 0 0 0; padding-left: 20px; line-height: 1.8;">
                                    <li><strong>Encrypted Storage</strong> - Your company email is AES-256 encrypted</li>
                                    <li><strong>Never Shared</strong> - We never share your email with anyone</li>
                                    <li><strong>Verification Only</strong> - Used only to verify you work at ${user.CompanyName}</li>
                                </ul>
                            </div>
                        </td>
                    </tr>

                    <!-- CTA Button -->
                    <tr>
                        <td style="padding: 0 30px 30px 30px; text-align: center;">
                            <a href="https://refopen.com/profile/work-experience" 
                               style="display: inline-block; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); 
                                      color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 30px; 
                                      font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);">
                                🚀 Become Verified Referrer Now
                            </a>
                            <p style="color: #9CA3AF; font-size: 12px; margin: 15px 0 0 0;">
                                Takes less than 2 minutes • No fees • Start earning today
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #F9FAFB; padding: 25px 30px; text-align: center; border-top: 1px solid #E5E7EB;">
                            <p style="color: #9CA3AF; font-size: 12px; margin: 0 0 10px 0;">
                                You received this email because you have an account on RefOpen.
                            </p>
                            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                                <a href="https://refopen.com/settings/notifications" style="color: #6366F1; text-decoration: none;">Manage preferences</a>
                                &nbsp;|&nbsp;
                                <a href="https://refopen.com/support" style="color: #6366F1; text-decoration: none;">Help & Support</a>
                                &nbsp;|&nbsp;
                                <a href="https://refopen.com" style="color: #6366F1; text-decoration: none;">Open RefOpen</a>
                            </p>
                            <p style="color: #D1D5DB; font-size: 11px; margin: 15px 0 0 0;">
                                © 2026 RefOpen. All rights reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        return { subject, html };
    }

    /**
     * Send "Become Verified Referrer" emails to eligible users
     * @param testMode - If true, only sends to test email (parimalkumar261@gmail.com)
     * @param testEmail - Override test email recipient
     */
    static async sendBecomeVerifiedEmails(testMode: boolean = false, testEmail?: string): Promise<BecomeVerifiedEmailResult> {
        const result: BecomeVerifiedEmailResult = {
            totalEligible: 0,
            emailsSent: 0,
            emailsFailed: 0,
            errors: []
        };

        try {
            // Get eligible users
            let eligibleUsers = await this.getEligibleUsers();
            result.totalEligible = eligibleUsers.length;

            console.log(`Found ${eligibleUsers.length} eligible users for "Become Verified Referrer" email`);

            // TEST MODE: Only send to test email
            if (testMode) {
                const testRecipient = testEmail || 'parimalkumar261@gmail.com';
                console.log(`🧪 TEST MODE: Sending only to ${testRecipient}`);
                
                // Find if test user is in eligible list, otherwise use first user as template
                const testUser = eligibleUsers.find(u => u.Email === testRecipient) || eligibleUsers[0];
                
                if (!testUser) {
                    console.log('No eligible users found for test');
                    return result;
                }

                // Override email to test recipient
                eligibleUsers = [{
                    ...testUser,
                    Email: testRecipient
                }];
            }

            if (eligibleUsers.length === 0) {
                console.log('No eligible users found');
                return result;
            }

            // Send emails
            for (const user of eligibleUsers) {
                try {
                    const { subject, html } = this.generateEmailContent(user);
                    
                    await EmailService.send({
                        to: user.Email,
                        subject,
                        html
                    });

                    result.emailsSent++;
                    console.log(`✅ Email sent to ${user.Email} (${user.FirstName} @ ${user.CompanyName})`);
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (emailError: any) {
                    result.emailsFailed++;
                    result.errors.push(`${user.Email}: ${emailError.message}`);
                    console.error(`❌ Failed to send email to ${user.Email}: ${emailError.message}`);
                }
            }

        } catch (error: any) {
            console.error('Error in sendBecomeVerifiedEmails:', error);
            result.errors.push(`Main error: ${error.message}`);
        }

        return result;
    }

    /**
     * Log email run for tracking
     */
    static async logEmailRun(
        executionId: string,
        startTime: Date,
        endTime: Date,
        result: BecomeVerifiedEmailResult,
        triggerType: 'Timer' | 'Manual'
    ): Promise<void> {
        try {
            await dbService.executeQuery(`
                INSERT INTO EmailLogs (
                    ExecutionID, EmailType, TriggerType, StartTime, EndTime,
                    TotalRecipients, EmailsSent, EmailsFailed, Errors, CreatedAt
                ) VALUES (
                    @param0, 'BecomeVerifiedReferrer', @param1, @param2, @param3,
                    @param4, @param5, @param6, @param7, GETUTCDATE()
                )
            `, [
                executionId,
                triggerType,
                startTime,
                endTime,
                result.totalEligible,
                result.emailsSent,
                result.emailsFailed,
                JSON.stringify(result.errors.slice(0, 20)) // Store first 20 errors
            ]);
        } catch (error: any) {
            console.error('Failed to log email run:', error.message);
        }
    }
}
