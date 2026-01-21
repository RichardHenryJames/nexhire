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
        const subject = `${user.FirstName}, Become a Verified Referrer at ${user.CompanyName}`;
        
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
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Become a Verified Referrer</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">Help others land jobs at ${user.CompanyName} & earn rewards</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi ${user.FirstName},
                            </p>
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                We noticed you're working as <strong>${user.JobTitle}</strong> at <strong>${user.CompanyName}</strong>. 
                                Did you know you can become a <strong style="color: #4F46E5;">Verified Referrer</strong> and help talented professionals 
                                join your company while earning rewards?
                            </p>

                            <!-- Benefits Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">Benefits of Being a Verified Referrer</p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 13px;">• <strong style="color: #1a1a1a;">Post Jobs for FREE</strong> — Share openings at your company</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 13px;">• <strong style="color: #1a1a1a;">Earn Rewards</strong> — Get up to ₹100 per successful referral</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 13px;">• <strong style="color: #1a1a1a;">Build Reputation</strong> — Verified badge shows on your profile</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 13px;">• <strong style="color: #1a1a1a;">Help Others</strong> — Connect talented people with opportunities</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 13px;">• <strong style="color: #1a1a1a;">Priority Access</strong> — Get notified first about referral requests</td></tr>
                                            <tr><td style="padding: 4px 0; color: #64748B; font-size: 13px;">• <strong style="color: #1a1a1a;">Easy Withdrawal</strong> — Cash out via UPI or bank account</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- How It Works Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 12px 0; color: #166534; font-size: 14px; font-weight: 600;">How to Get Verified (Takes 2 minutes)</p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 4px 0; color: #15803D; font-size: 13px;"><strong>1.</strong> Go to refopen.com → Profile</td></tr>
                                            <tr><td style="padding: 4px 0; color: #15803D; font-size: 13px;"><strong>2.</strong> Click "Become a Verified Referrer"</td></tr>
                                            <tr><td style="padding: 4px 0; color: #15803D; font-size: 13px;"><strong>3.</strong> Add your current work experience (if not added)</td></tr>
                                            <tr><td style="padding: 4px 0; color: #15803D; font-size: 13px;"><strong>4.</strong> Enter your company email & verify with OTP</td></tr>
                                            <tr><td style="padding: 4px 0; color: #15803D; font-size: 13px;"><strong>Done!</strong> You're now a Verified Referrer</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Privacy Section -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 8px 0; color: #1E40AF; font-size: 14px; font-weight: 600;">Your Privacy is Our Priority</p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr><td style="padding: 4px 0; color: #1E40AF; font-size: 13px;">• <strong>Not Stored</strong> — We don't save your company email</td></tr>
                                            <tr><td style="padding: 4px 0; color: #1E40AF; font-size: 13px;">• <strong>Never Shared</strong> — We never share your email with anyone</td></tr>
                                            <tr><td style="padding: 4px 0; color: #1E40AF; font-size: 13px;">• <strong>Verification Only</strong> — Used only to verify you work at ${user.CompanyName}</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 8px 0;">
                                        <a href="https://refopen.com/profile/work-experience" style="display: inline-block; background: #4F46E5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                            Become Verified Referrer
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #64748B; font-size: 12px; margin: 16px 0 0 0; text-align: center;">
                                Takes less than 2 minutes • No fees • Start earning today
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background: #F8FAFC; padding: 32px 40px; border-top: 1px solid #E2E8F0; text-align: center;">
                            <img src="https://refopen.com/refopen-logo.png" alt="RefOpen" width="100" style="margin-bottom: 16px;">
                            <p style="margin: 0 0 8px 0; color: #64748B; font-size: 12px;">
                                You received this email because you have an account on RefOpen.
                            </p>
                            <p style="margin: 0; color: #64748B; font-size: 12px;">
                                <a href="https://refopen.com/settings/notifications" style="color: #4F46E5; text-decoration: none;">Email Preferences</a>
                                <span style="color: #CBD5E1; margin: 0 8px;">|</span>
                                <a href="https://refopen.com/support" style="color: #4F46E5; text-decoration: none;">Help Center</a>
                                <span style="color: #CBD5E1; margin: 0 8px;">|</span>
                                <a href="https://refopen.com" style="color: #4F46E5; text-decoration: none;">RefOpen</a>
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
