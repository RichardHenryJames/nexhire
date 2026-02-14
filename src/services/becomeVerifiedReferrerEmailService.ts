/**
* Become Verified Referrer Email Service
* Sends emails to users who have work experience but haven't verified their company email
* 
* Key Features:
* - Targets active users with work experience
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
            WHERE u.IsActive = 1
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
        const subject = `🏆 ${user.FirstName}, become a verified member at RefOpen`;
        
        const html = `
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
                                Hi ${user.FirstName},
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Intro Text -->
                    <tr>
                        <td style="padding: 0 0 20px 0;">
                            <p style="color: #4a4a4a; font-size: 14px; line-height: 1.7; margin: 0;">
                                As a <strong style="color: #1a1a1a;">${user.JobTitle}</strong> at <strong style="color: #4f46e5;">${user.CompanyName}</strong>, 
                                becoming a <strong style="color: #4f46e5;">Verified Member</strong> on RefOpen gives you the best of both worlds — <strong>get referrals faster</strong> AND <strong>help others while earning rewards</strong>!
                            </p>
                        </td>
                    </tr>

                    <!-- Benefits Section -->
                    <tr>
                        <td style="padding: 0 0 20px 0;">
                            <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">🚀 Why Verified Members get more:</p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr><td style="padding: 6px 0; color: #4a4a4a; font-size: 13px;">• <strong>Get referrals faster</strong> — Verified members are prioritized when requesting referrals from others</td></tr>
                                <tr><td style="padding: 6px 0; color: #4a4a4a; font-size: 13px;">• <strong>Refer anyone, anytime</strong> — Earn cash rewards for every refer you submit through RefOpen</td></tr>
                                <tr><td style="padding: 6px 0; color: #4a4a4a; font-size: 13px;">• <strong>Use rewards to get referrals</strong> — The reward cash you earn as a referrer can be used to request referrals for yourself too, or you can withdraw to your bank/UPI</td></tr>
                                <tr><td style="padding: 6px 0; color: #4a4a4a; font-size: 13px;">• <strong>Verified badge</strong> — Build trust with a verified profile that stands out</td></tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Win-Win Section -->
                    <tr>
                        <td style="padding: 0 0 20px 0;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 15px;">
                                        <p style="margin: 0; font-size: 13px; color: #92400E; font-weight: 600;">💰 It's a win-win:</p>
                                        <p style="margin: 8px 0 0 0; font-size: 13px; color: #B45309; line-height: 1.6;">
                                            Earn rewards when you refer others → Use those rewards to get referrals for yourself → Repeat!
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- How It Works - Tip Banner Style -->
                    <tr>
                        <td style="padding: 0 0 20px 0;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 15px;">
                                        <p style="margin: 0 0 10px 0; font-size: 13px; color: #166534; font-weight: 600;">🚀 Get verified in 2 minutes:</p>
                                        <p style="margin: 0; font-size: 13px; color: #15803D; line-height: 1.6;">
                                            Profile → Add Current Work Exp → Enter Company Email → Verify OTP → Done!
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Privacy Note -->
                    <tr>
                        <td style="padding: 0 0 25px 0;">
                            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.6;">
                                🔒 <strong>Privacy:</strong> Your company email is only used for verification — we don't store or share it.
                            </p>
                        </td>
                    </tr>

                    <!-- CTA Button -->
                    <tr>
                        <td align="center" style="padding: 0 0 15px 0;">
                            <a href="https://refopen.com/profile/work-experience" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                                Become a Verified Member
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 0 30px 0;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                No fees • Takes 2 minutes • Start earning & getting referrals today
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 0; border-top: 1px solid #e5e7eb;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="text-align: center;">
                                        <img src="https://refopen.com/refopen-logo.png" alt="RefOpen" width="80" style="margin-bottom: 12px;">
                                        <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                            You received this because you have a RefOpen account.
                                        </p>
                                        <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                            <a href="https://refopen.com/settings/notifications" style="color: #6b7280; text-decoration: none;">Email Preferences</a>
                                            <span style="color: #d1d5db; margin: 0 8px;">|</span>
                                            <a href="https://refopen.com/support" style="color: #6b7280; text-decoration: none;">Help</a>
                                            <span style="color: #d1d5db; margin: 0 8px;">|</span>
                                            <a href="https://refopen.com" style="color: #6b7280; text-decoration: none;">RefOpen</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
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
                        html,
                        userId: user.UserID,
                        emailType: 'become_verified_referrer'
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
