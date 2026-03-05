/**
 * Expiring Request Nudge Email Service
 * 
 * Sends daily emails to seekers whose specific-company referral requests
 * are expiring within 3 days and have NOT been completed yet.
 * Nudges them to upgrade to "Open to Any Company" for better chances.
 * 
 * Runs daily at 10 AM IST (4:30 AM UTC)
 */

import { dbService } from './database.service';
import { EmailService } from './emailService';

interface ExpiringRequest {
    RequestID: string;
    JobTitle: string;
    CompanyName: string;
    Status: string;
    ExpiryTime: Date;
    RequestedAt: Date;
    CurrentHoldAmount: number;
    SeekerEmail: string;
    SeekerFirstName: string;
    SeekerUserID: string;
}

interface NudgeEmailResult {
    totalEligible: number;
    emailsSent: number;
    emailsFailed: number;
    errors: string[];
}

export class ExpiringRequestNudgeService {

    /**
     * Get specific-company requests expiring within 3 days that haven't been completed or nudged
     * Eligible: Pending, NotifiedToReferrers, Viewed, Claimed — but NOT completed/submitted
     */
    static async getExpiringRequests(): Promise<ExpiringRequest[]> {
        const query = `
            SELECT 
                rr.RequestID,
                COALESCE(j.Title, rr.JobTitle, 'Your Role') as JobTitle,
                COALESCE(jo.Name, eo.Name, 'the company') as CompanyName,
                rr.Status,
                rr.ExpiryTime,
                rr.RequestedAt,
                ISNULL(h.Amount, 0) as CurrentHoldAmount,
                u.Email as SeekerEmail,
                u.FirstName as SeekerFirstName,
                u.UserID as SeekerUserID
            FROM ReferralRequests rr
            INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
            INNER JOIN Users u ON a.UserID = u.UserID
            LEFT JOIN Jobs j ON rr.JobID = j.JobID
            LEFT JOIN Organizations jo ON j.OrganizationID = jo.OrganizationID
            LEFT JOIN Organizations eo ON rr.OrganizationID = eo.OrganizationID AND rr.ExtJobID IS NOT NULL
            LEFT JOIN WalletHolds h ON h.ReferralRequestID = rr.RequestID AND h.Status = 'Active'
            WHERE rr.OpenToAnyCompany = 0
              AND rr.Status IN ('Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed')
              AND rr.ParentRequestID IS NULL
              AND rr.ExpiryNudgeSent = 0
              AND rr.ExpiryTime IS NOT NULL
              AND rr.ExpiryTime > GETUTCDATE()
              AND rr.ExpiryTime <= DATEADD(DAY, 3, GETUTCDATE())
              AND u.Email IS NOT NULL
              AND u.Email != ''
              AND u.IsActive = 1
            ORDER BY rr.ExpiryTime ASC
        `;

        const result = await dbService.executeQuery(query, []);
        return result.recordset || [];
    }

    /**
     * Generate the nudge email HTML
     */
    static async generateNudgeEmailHtml(request: ExpiringRequest): Promise<{ subject: string; html: string }> {
        const appUrl = process.env.APP_URL || 'https://www.refopen.com';

        // Calculate days left
        const now = new Date();
        const expiry = new Date(request.ExpiryTime);
        const hoursLeft = Math.max(0, (expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
        const daysLeft = Math.ceil(hoursLeft / 24);
        const timeLeftText = daysLeft <= 1 ? 'less than 24 hours' : `${daysLeft} days`;

        const statusNote = request.Status === 'Claimed'
            ? `A referrer claimed your request but hasn't submitted the referral yet.`
            : `No referrer has picked up your request yet.`;

        const subject = `⏰ Your referral request expires in ${timeLeftText} — here's how to save it`;

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
                        <td style="background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%); padding: 32px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">⏰ Your Request Expires in ${timeLeftText}</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">${statusNote}</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 36px 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi ${request.SeekerFirstName || 'there'},
                            </p>
                            
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                                Your referral request for <strong style="color: #1a1a1a;">"${request.JobTitle}"</strong> at <strong style="color: #1a1a1a;">${request.CompanyName}</strong> is expiring soon, and the referral hasn't been submitted yet.
                            </p>

                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                Don't let it expire — <strong style="color: #3B82F6;">Go Open to Any Company</strong> and dramatically improve your chances.
                            </p>

                            <!-- What is Open to Any -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 12px 0; color: #1E40AF; font-size: 15px; font-weight: 700;">🚀 What is "Open to Any Company"?</p>
                                        <p style="margin: 0; color: #1E40AF; font-size: 14px; line-height: 1.7;">
                                            Instead of waiting for a referrer at one company, your request goes out to <strong>500+ verified referrers across all companies</strong>. Multiple referrers from different companies can refer you simultaneously.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Benefits -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px 0;">
                                <tr>
                                    <td style="padding: 12px 16px; background: #F0FDF4; border-left: 3px solid #10B981; border-radius: 0 6px 6px 0;">
                                        <p style="margin: 0; color: #065F46; font-size: 14px;">🏢 <strong>All companies</strong> — Your request reaches referrers everywhere</p>
                                    </td>
                                </tr>
                                <tr><td style="height: 8px;"></td></tr>
                                <tr>
                                    <td style="padding: 12px 16px; background: #F0FDF4; border-left: 3px solid #10B981; border-radius: 0 6px 6px 0;">
                                        <p style="margin: 0; color: #065F46; font-size: 14px;">👥 <strong>Multiple referrals</strong> — More than one referrer can help you land a role</p>
                                    </td>
                                </tr>
                                <tr><td style="height: 8px;"></td></tr>
                                <tr>
                                    <td style="padding: 12px 16px; background: #F0FDF4; border-left: 3px solid #10B981; border-radius: 0 6px 6px 0;">
                                        <p style="margin: 0; color: #065F46; font-size: 14px;">⏰ <strong>Fresh 14 days</strong> — Your expiry clock resets when you upgrade</p>
                                    </td>
                                </tr>
                                <tr><td style="height: 8px;"></td></tr>
                                <tr>
                                    <td style="padding: 12px 16px; background: #F0FDF4; border-left: 3px solid #10B981; border-radius: 0 6px 6px 0;">
                                        <p style="margin: 0; color: #065F46; font-size: 14px;">🛡️ <strong>Full refund guaranteed</strong> — If no one refers you, you get everything back</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${appUrl}/referrals/tracking/${request.RequestID}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 700; letter-spacing: 0.3px;">
                                            Go Open →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 0; border-top: 1px solid #e5e7eb;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="text-align: center;">
                                        <img src="${appUrl}/refopen-logo.png" alt="RefOpen" width="80" style="margin-bottom: 12px;">
                                        <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                            You received this because you have a RefOpen account.
                                        </p>
                                        <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                            <a href="${appUrl}/settings" style="color: #6b7280; text-decoration: none;">Email Preferences</a>
                                            <span style="color: #d1d5db; margin: 0 8px;">|</span>
                                            <a href="${appUrl}/support" style="color: #6b7280; text-decoration: none;">Help</a>
                                            <span style="color: #d1d5db; margin: 0 8px;">|</span>
                                            <a href="${appUrl}" style="color: #6b7280; text-decoration: none;">RefOpen</a>
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
</html>`;

        return { subject, html };
    }

    /**
     * Send nudge email for a single request
     */
    static async sendNudgeEmail(request: ExpiringRequest): Promise<boolean> {
        try {
            const { subject, html } = await this.generateNudgeEmailHtml(request);

            await EmailService.send({
                to: request.SeekerEmail,
                subject,
                html,
                userId: request.SeekerUserID,
                emailType: 'expiring_request_nudge',
                referenceType: 'ReferralRequest',
                referenceId: request.RequestID,
            });

            // Also send in-app notification
            const diffMs = new Date(request.ExpiryTime).getTime() - Date.now();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const timeLeft = diffDays >= 1 ? `${diffDays}d ${diffHours}h` : `${diffHours}h`;
            const { default: InAppNotificationService } = await import('./inAppNotification.service');
            await InAppNotificationService.notifyReferralExpiring(
                request.SeekerUserID, request.SeekerFirstName, request.JobTitle, request.CompanyName, request.RequestID, timeLeft
            );

            // Mark as nudged so we don't send again
            await dbService.executeQuery(
                `UPDATE ReferralRequests SET ExpiryNudgeSent = 1 WHERE RequestID = @param0`,
                [request.RequestID]
            );

            return true;
        } catch (error: any) {
            console.error(`Failed to send nudge email for request ${request.RequestID} to ${request.SeekerEmail}:`, error.message);
            return false;
        }
    }

    /**
     * Process all expiring requests and send nudge emails
     */
    static async processExpiringRequests(): Promise<NudgeEmailResult> {
        const result: NudgeEmailResult = {
            totalEligible: 0,
            emailsSent: 0,
            emailsFailed: 0,
            errors: [],
        };

        try {
            const requests = await this.getExpiringRequests();
            result.totalEligible = requests.length;

            console.log(`Found ${requests.length} expiring specific-company requests to nudge`);

            for (const request of requests) {
                try {
                    const success = await this.sendNudgeEmail(request);
                    if (success) {
                        result.emailsSent++;
                        console.log(`✅ Nudge sent to ${request.SeekerEmail} for "${request.JobTitle}" at ${request.CompanyName} (expires ${new Date(request.ExpiryTime).toISOString()})`);
                    } else {
                        result.emailsFailed++;
                    }
                } catch (error: any) {
                    result.emailsFailed++;
                    result.errors.push(`${request.SeekerEmail}: ${error.message}`);
                }
            }

            return result;
        } catch (error: any) {
            console.error('Error in processExpiringRequests:', error);
            result.errors.push(error.message);
            return result;
        }
    }

    /**
     * Log email run results
     */
    static async logEmailRun(
        executionId: string,
        startTime: Date,
        endTime: Date,
        result: NudgeEmailResult,
        triggerType: 'Timer' | 'Manual'
    ): Promise<void> {
        try {
            const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
            const errors = result.errors.length > 0 ? result.errors.join('; ') : '';

            const query = `
                INSERT INTO DailyJobEmailLogs (
                    ExecutionID, StartTime, EndTime, DurationSeconds, TotalUsers,
                    EmailsSent, EmailsFailed, Errors, TriggerType
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4,
                    @param5, @param6, @param7, @param8
                )
            `;

            await dbService.executeQuery(query, [
                executionId,
                startTime,
                endTime,
                durationSeconds,
                result.totalEligible,
                result.emailsSent,
                result.emailsFailed,
                errors,
                triggerType
            ]);
        } catch (error) {
            console.error('Failed to log expiring request nudge run:', error);
        }
    }
}
