/**
 * Referrer Notification Email Service
 * Sends daily emails to verified referrers about open referral requests
 * 
 * Key Features:
 * - Sends to all verified referrers (IsVerifiedReferrer = 1)
 * - Shows open referral requests for their current company
 * - Includes count, rewards info, and benefits
 * - Runs daily at 7 PM IST (13:30 UTC)
 */

import { dbService } from './database.service';
import { EmailService } from './emailService';
import { TemplateService } from './templateService';
import { ReferralService } from './referral.service';

interface ReferrerForEmail {
    UserID: string;
    Email: string;
    FirstName: string;
    CompanyName: string;
    OrganizationID: string;
}

interface OpenReferralRequest {
    RequestID: string;
    JobTitle: string;
    ApplicantName: string;
    RequestedAt: Date;
    Status: string;
    CompanyName: string;
    OrganizationLogo: string;
    ApplicantProfilePictureURL?: string;
}

interface ReferrerEmailResult {
    totalReferrers: number;
    emailsSent: number;
    emailsFailed: number;
    errors: string[];
}

export class ReferrerNotificationEmailService {
    
    /**
     * Get verified referrers eligible for notification email
     * - Must be verified referrer (IsVerifiedReferrer = 1)
     * - Must have logged in within last 1 month
     * - Must have active work experience at a company
     * - Must have ReferrerNotificationEmail enabled (default: true)
     */
    static async getEligibleReferrers(): Promise<ReferrerForEmail[]> {
        const query = `
            SELECT DISTINCT
                u.UserID,
                u.Email,
                u.FirstName,
                o.Name as CompanyName,
                we.OrganizationID
            FROM Users u
            INNER JOIN Applicants a ON u.UserID = a.UserID
            INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
            INNER JOIN Organizations o ON we.OrganizationID = o.OrganizationID
            LEFT JOIN NotificationPreferences np ON u.UserID = np.UserID
            WHERE u.IsVerifiedReferrer = 1
              AND u.IsActive = 1
              AND u.Email IS NOT NULL
              AND u.Email != ''
              AND we.IsCurrent = 1
              AND (we.IsActive = 1 OR we.IsActive IS NULL)
              AND COALESCE(np.ReferrerNotificationEmail, 1) = 1
            ORDER BY u.FirstName
        `;
        
        const result = await dbService.executeQuery(query, []);
        return result.recordset || [];
    }

    // Same statuses as frontend ReferralScreen.js OPEN_STATUSES
    private static readonly OPEN_STATUSES = ['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'];

    /**
     * Get open referral requests for a referrer's company
     * Uses ReferralService.getAvailableRequests for consistency with frontend
     */
    static async getOpenRequestsForReferrer(referrer: ReferrerForEmail): Promise<OpenReferralRequest[]> {
        // Get ApplicantID from UserID
        const applicantQuery = `SELECT ApplicantID FROM Applicants WHERE UserID = @param0`;
        const applicantResult = await dbService.executeQuery(applicantQuery, [referrer.UserID]);
        const applicantId = applicantResult.recordset?.[0]?.ApplicantID;
        
        if (!applicantId) {
            console.log(`No applicant found for user ${referrer.UserID}`);
            return [];
        }

        // Use ReferralService for consistency with frontend
        const result = await ReferralService.getAvailableRequests(applicantId, 1, 100);
        
        // Filter for OPEN_STATUSES only - 'Expired' status is excluded automatically
        // Backend timer job handles expiration, no need for client-side date check
        const openRequests = result.requests
            .filter(r => this.OPEN_STATUSES.includes(r.Status))
            .slice(0, 10)
            .map(r => {
                const req = r as any; // SQL query returns more fields than type definition
                return {
                    RequestID: r.RequestID,
                    JobTitle: r.JobTitle || 'External Job',
                    ApplicantName: r.ApplicantName?.split(' ')[0] + ' ' + (r.ApplicantName?.split(' ')[1]?.[0] || '') + '.',
                    RequestedAt: r.RequestedAt,
                    Status: r.Status,
                    CompanyName: r.CompanyName || 'Unknown Company',
                    OrganizationLogo: req.OrganizationLogo || '',
                    ApplicantProfilePictureURL: req.ApplicantProfilePictureURL || ''
                };
            });

        return openRequests;
    }

    /**
     * Get total count of open requests (for "10+ more" text)
     * Uses ReferralService.getAvailableRequests for consistency with frontend
     */
    static async getOpenRequestsCount(referrer: ReferrerForEmail): Promise<number> {
        // Get ApplicantID from UserID
        const applicantQuery = `SELECT ApplicantID FROM Applicants WHERE UserID = @param0`;
        const applicantResult = await dbService.executeQuery(applicantQuery, [referrer.UserID]);
        const applicantId = applicantResult.recordset?.[0]?.ApplicantID;
        
        if (!applicantId) {
            return 0;
        }

        // Use ReferralService for consistency with frontend
        const result = await ReferralService.getAvailableRequests(applicantId, 1, 100);
        
        // Count only OPEN_STATUSES - 'Expired' status is excluded automatically
        // Backend timer job handles expiration, no need for client-side date check
        return result.requests.filter(r => this.OPEN_STATUSES.includes(r.Status)).length;
    }

    /**
     * Get referrer stats (total referred, earnings, etc.)
     */
    static async getReferrerStats(userId: string): Promise<{ totalReferred: number; totalEarnings: number; pendingCount: number }> {
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM ReferralRequests rr 
                 INNER JOIN Applicants a ON rr.AssignedReferrerID = a.ApplicantID 
                 WHERE a.UserID = @param0 AND rr.Status IN ('Completed', 'Verified')) as TotalReferred,
                (SELECT ISNULL(SUM(rw.PointsEarned), 0) FROM ReferralRewards rw 
                 INNER JOIN Applicants a ON rw.ReferrerID = a.ApplicantID 
                 WHERE a.UserID = @param0) as TotalEarnings,
                (SELECT COUNT(*) FROM ReferralRequests rr 
                 LEFT JOIN Jobs j ON rr.JobID = j.JobID
                 INNER JOIN WorkExperiences we ON 
                    (j.OrganizationID = we.OrganizationID OR rr.OrganizationID = we.OrganizationID)
                 INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
                 WHERE a.UserID = @param0 AND we.IsCurrent = 1 
                   AND rr.Status IN ('Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed')) as PendingCount
        `;
        
        const result = await dbService.executeQuery(query, [userId]);
        const row = result.recordset?.[0];
        return {
            totalReferred: row?.TotalReferred || 0,
            totalEarnings: row?.TotalEarnings || 0,
            pendingCount: row?.PendingCount || 0
        };
    }

    /**
     * Generate HTML for referral request cards in email
     */
    static generateRequestCardsHtml(requests: OpenReferralRequest[], totalCount: number): string {
        if (!requests || requests.length === 0) {
            return `
                <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border-radius: 8px; margin: 15px 0; border: 1px solid #86efac;">
                    <tr>
                        <td style="padding: 20px; text-align: center;">
                            <p style="color: #166534; margin: 0; font-size: 14px;">
                                🎉 No pending requests right now. Check back later!
                            </p>
                        </td>
                    </tr>
                </table>
            `;
        }

        const appUrl = process.env.APP_URL || 'https://www.refopen.com';
        let html = '';

        for (const request of requests) {
            const requestDate = new Date(request.RequestedAt);
            const timeAgo = this.getTimeAgo(requestDate);
            const initial = request.ApplicantName.charAt(0).toUpperCase();
            const hasPhoto = request.ApplicantProfilePictureURL && request.ApplicantProfilePictureURL.length > 0;

            // Avatar: show photo if available, otherwise initial
            const avatarHtml = hasPhoto
                ? `<img src="${request.ApplicantProfilePictureURL}" width="44" height="44" style="width: 44px; height: 44px; border-radius: 10px; display: block; object-fit: cover;" alt="${initial}" />`
                : `<table cellpadding="0" cellspacing="0" border="0" width="44" height="44" style="border-radius: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <tr>
                        <td align="center" valign="middle" width="44" height="44" style="width: 44px; height: 44px; color: white; font-size: 18px; font-weight: 600;">
                            ${initial}
                        </td>
                    </tr>
                </table>`;

            html += `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border-radius: 12px; margin: 12px 0; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 16px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td width="44" style="width: 44px; vertical-align: top;">
                                        ${avatarHtml}
                                    </td>
                                    <td style="padding-left: 12px; vertical-align: top;">
                                        <p style="margin: 0 0 2px 0; color: #111827; font-size: 15px; font-weight: 600;">
                                            ${request.ApplicantName}
                                        </p>
                                        <p style="margin: 0 0 6px 0; color: #6b7280; font-size: 13px;">
                                            wants referral for <strong style="color: #374151;">${request.JobTitle}</strong>
                                        </p>
                                        <span style="color: #9ca3af; font-size: 12px;">${timeAgo}</span>
                                    </td>
                                    <td width="70" style="width: 70px; text-align: right; vertical-align: middle;">
                                        <a href="${appUrl}/referrals" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">
                                            View
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            `;
        }

        // Add "more" indicator if there are more than 10
        if (totalCount > 10) {
            html += `
                <table width="100%" cellpadding="0" cellspacing="0" style="margin: 15px 0;">
                    <tr>
                        <td style="text-align: center; padding: 12px; background: #f0fdf4; border-radius: 8px;">
                            <a href="${appUrl}/referrals" style="color: #059669; font-size: 14px; text-decoration: none; font-weight: 600;">
                                👀 View ${totalCount - 10} more requests →
                            </a>
                        </td>
                    </tr>
                </table>
            `;
        }

        return html;
    }

    /**
     * Get human-readable time ago string
     */
    static getTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    /**
     * Send notification email to a single referrer
     */
    static async sendReferrerNotificationEmail(referrer: ReferrerForEmail): Promise<{ success: boolean; jobCount: number }> {
        try {
            const [requests, totalCount, stats] = await Promise.all([
                this.getOpenRequestsForReferrer(referrer),
                this.getOpenRequestsCount(referrer),
                this.getReferrerStats(referrer.UserID)
            ]);

            // Skip if no open requests
            if (totalCount === 0) {
                return { success: true, jobCount: 0 };
            }

            const appUrl = process.env.APP_URL || 'https://www.refopen.com';
            const requestCardsHtml = this.generateRequestCardsHtml(requests, totalCount);

            // Handle singular/plural for proper grammar
            const isSingular = totalCount === 1;
            const candidateWord = isSingular ? 'Candidate' : 'Candidates';
            const candidateWordLower = isSingular ? 'candidate' : 'candidates';
            const needWord = isSingular ? 'Needs' : 'Need';
            const requestWord = isSingular ? 'Request' : 'Requests';
            const isAre = isSingular ? 'is' : 'are';

            const template = TemplateService.render('referrer_open_requests', {
                firstName: referrer.FirstName || 'there',
                companyName: referrer.CompanyName,
                openCount: totalCount,
                displayCount: Math.min(totalCount, 10),
                hasMoreThan10: totalCount > 10,
                moreCount: totalCount - 10,
                totalReferred: stats.totalReferred,
                totalEarnings: stats.totalEarnings,
                requestCardsHtml,
                appUrl,
                candidateWord,
                candidateWordLower,
                needWord,
                requestWord,
                isAre
            });

            await EmailService.send({
                to: referrer.Email,
                subject: template.subject,
                html: template.html,
                emailType: 'referrer_open_requests'
            });

            return { success: true, jobCount: totalCount };
        } catch (error: any) {
            console.error(`Failed to send referrer notification to ${referrer.Email}:`, error.message);
            return { success: false, jobCount: 0 };
        }
    }

    /**
     * Send notification emails to all eligible verified referrers
     */
    static async sendReferrerNotificationEmails(): Promise<ReferrerEmailResult> {
        const result: ReferrerEmailResult = {
            totalReferrers: 0,
            emailsSent: 0,
            emailsFailed: 0,
            errors: []
        };

        try {
            const referrers = await this.getEligibleReferrers();
            result.totalReferrers = referrers.length;

            console.log(`Found ${referrers.length} eligible verified referrers`);

            for (const referrer of referrers) {
                try {
                    const sendResult = await this.sendReferrerNotificationEmail(referrer);
                    if (sendResult.success && sendResult.jobCount > 0) {
                        result.emailsSent++;
                        console.log(`✅ Sent to ${referrer.Email} (${sendResult.jobCount} requests)`);
                    } else if (sendResult.jobCount === 0) {
                        console.log(`⏭️ Skipped ${referrer.Email} (no open requests)`);
                    } else {
                        result.emailsFailed++;
                    }
                } catch (error: any) {
                    result.emailsFailed++;
                    result.errors.push(`${referrer.Email}: ${error.message}`);
                }
            }

            return result;
        } catch (error: any) {
            console.error('Error in sendReferrerNotificationEmails:', error);
            result.errors.push(error.message);
            return result;
        }
    }

    /**
     * Send notification email to a specific user (for testing)
     */
    static async sendReferrerNotificationEmailForUser(userId: string): Promise<ReferrerEmailResult> {
        const result: ReferrerEmailResult = {
            totalReferrers: 1,
            emailsSent: 0,
            emailsFailed: 0,
            errors: []
        };

        try {
            // Get user details
            const query = `
                SELECT 
                    u.UserID,
                    u.Email,
                    u.FirstName,
                    o.Name as CompanyName,
                    we.OrganizationID
                FROM Users u
                INNER JOIN Applicants a ON u.UserID = a.UserID
                INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
                INNER JOIN Organizations o ON we.OrganizationID = o.OrganizationID
                WHERE u.UserID = @param0
                  AND we.IsCurrent = 1
                  AND (we.IsActive = 1 OR we.IsActive IS NULL)
            `;
            
            const userResult = await dbService.executeQuery(query, [userId]);
            
            if (!userResult.recordset || userResult.recordset.length === 0) {
                result.errors.push('User not found or has no current work experience');
                result.emailsFailed = 1;
                return result;
            }

            const referrer = userResult.recordset[0] as ReferrerForEmail;
            const sendResult = await this.sendReferrerNotificationEmail(referrer);
            
            if (sendResult.success && sendResult.jobCount > 0) {
                result.emailsSent = 1;
            } else if (sendResult.jobCount === 0) {
                result.errors.push('No open requests for this referrer');
            } else {
                result.emailsFailed = 1;
            }

            return result;
        } catch (error: any) {
            result.errors.push(error.message);
            result.emailsFailed = 1;
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
        result: ReferrerEmailResult,
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
                result.totalReferrers,
                result.emailsSent,
                result.emailsFailed,
                errors,
                triggerType
            ]);
        } catch (error) {
            console.error('Failed to log referrer email run:', error);
        }
    }
}
