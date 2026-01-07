/**
 * Notification Service - High-level notification API
 * 
 * Provides easy methods to queue notifications for various events
 * Handles user preferences and multi-channel delivery
 */

import sql from 'mssql';
import { dbService } from './database.service';
import { EmailService } from './emailService';
import { TemplateService } from './templateService';

// Configuration
const APP_URL = process.env.APP_URL || 'https://refopen.com';

// Notification types
export type NotificationType = 
    | 'new_referral_request'
    | 'referral_claimed'
    | 'referral_verified'
    | 'job_application'
    | 'message_received'
    | 'weekly_digest';

export type NotificationChannel = 'email' | 'push' | 'in_app';

interface QueueOptions {
    userId?: string;
    type: NotificationType;
    channels?: NotificationChannel[];
    data: Record<string, any>;
    scheduledAt?: Date;
}

interface ReferrerInfo {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}

export class NotificationService {

    // ========================================
    // HIGH-LEVEL NOTIFICATION METHODS
    // ========================================

    /**
     * Notify all eligible referrers about a new referral request
     * This is the main method called when a job seeker requests a referral
     */
    static async notifyNewReferralRequest(data: {
        requestId: string;
        organizationId: number;
        jobId?: string;
        jobTitle: string;
        companyName: string;
        seekerName: string;
        seekerId: string;
    }): Promise<{ notified: number; errors: string[] }> {
        try {
            // 1. Find all eligible referrers at this organization
            const referrers = await this.getEligibleReferrers(data.organizationId, data.seekerId);
            
            if (referrers.length === 0) {
                return { notified: 0, errors: ['No eligible referrers found'] };
            }

            // 2. Queue notification for each referrer
            let notified = 0;
            const errors: string[] = [];

            for (const referrer of referrers) {
                try {
                    // Check user preferences
                    const prefs = await this.getUserPreferences(referrer.userId);
                    
                    if (!prefs.EmailEnabled || !prefs.ReferralRequestEmail) {
                        continue; // Skip - notifications disabled
                    }

                    // Queue the notification
                    await this.queueNotification({
                        userId: referrer.userId,
                        type: 'new_referral_request',
                        channels: ['email'],
                        data: {
                            ...data,
                            referrerName: referrer.firstName,
                            referrerEmail: referrer.email,
                            actionUrl: `${APP_URL}/referrals?tab=available`
                        }
                    });

                    notified++;
                } catch (error: any) {
                    errors.push(`Failed for ${referrer.email}: ${error.message}`);
                }
            }

            return { notified, errors };

        } catch (error: any) {
            console.error('❌ Error notifying referrers:', error);
            return { notified: 0, errors: [error.message] };
        }
    }

    /**
     * Notify seeker that their referral was claimed
     */
    static async notifyReferralClaimed(data: {
        requestId: string;
        seekerId: string;
        seekerName: string;
        seekerEmail: string;
        referrerName: string;
        jobTitle: string;
        companyName: string;
    }): Promise<boolean> {
        try {
            const prefs = await this.getUserPreferences(data.seekerId);
            
            if (!prefs.EmailEnabled || !prefs.ReferralClaimedEmail) {
                return false;
            }

            await this.queueNotification({
                userId: data.seekerId,
                type: 'referral_claimed',
                channels: ['email'],
                data: {
                    ...data,
                    actionUrl: `${APP_URL}/referrals?tab=seeker`
                }
            });

            return true;
        } catch (error: any) {
            console.error('❌ Error notifying referral claimed:', error);
            return false;
        }
    }

    /**
     * Notify referrer that they earned money
     */
    static async notifyReferralVerified(data: {
        requestId: string;
        referrerId: string;
        referrerName: string;
        referrerEmail: string;
        seekerName: string;
        jobTitle: string;
        companyName: string;
        amount: number;
        newBalance: number;
    }): Promise<boolean> {
        try {
            const prefs = await this.getUserPreferences(data.referrerId);
            
            if (!prefs.EmailEnabled || !prefs.ReferralVerifiedEmail) {
                return false;
            }

            await this.queueNotification({
                userId: data.referrerId,
                type: 'referral_verified',
                channels: ['email'],
                data: {
                    ...data,
                    walletUrl: `${APP_URL}/wallet`
                }
            });

            return true;
        } catch (error: any) {
            console.error('❌ Error notifying referral verified:', error);
            return false;
        }
    }

    // ========================================
    // QUEUE METHODS
    // ========================================

    /**
     * Add notification to queue
     */
    static async queueNotification(options: QueueOptions): Promise<string> {
        const channels = options.channels || ['email'];

        // Insert one row per channel
        for (const channel of channels) {
            await dbService.executeQuery(`
                INSERT INTO NotificationQueue (
                    UserID, NotificationType, Channel, Payload, ScheduledAt
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4
                )
            `, [
                options.userId || null,
                options.type,
                channel,
                JSON.stringify(options.data),
                options.scheduledAt || new Date()
            ]);
        }

        return 'queued';
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    /**
     * Find all employees at an organization who can refer
     */
    static async getEligibleReferrers(organizationId: number, excludeUserId?: string): Promise<ReferrerInfo[]> {
        const result = await dbService.executeQuery(`
            SELECT DISTINCT 
                u.UserID as userId,
                u.Email as email,
                u.FirstName as firstName,
                u.LastName as lastName
            FROM WorkExperiences we
            INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
            INNER JOIN Users u ON a.UserID = u.UserID
            WHERE we.OrganizationID = @param0
            AND we.IsCurrent = 1
            AND we.CompanyEmailVerified = 1
            AND u.IsVerifiedReferrer = 1
            AND (a.OpenToRefer = 1 OR a.OpenToRefer IS NULL)
            AND u.Email IS NOT NULL
            AND u.Email != ''
            AND (@param1 IS NULL OR u.UserID != @param1)
        `, [organizationId, excludeUserId || null]);

        return result.recordset;
    }

    /**
     * Get user notification preferences
     */
    static async getUserPreferences(userId: string): Promise<{
        EmailEnabled: boolean;
        PushEnabled: boolean;
        ReferralRequestEmail: boolean;
        ReferralClaimedEmail: boolean;
        ReferralVerifiedEmail: boolean;
    }> {
        const result = await dbService.executeQuery(`
            SELECT 
                COALESCE(EmailEnabled, 0) as EmailEnabled,
                COALESCE(PushEnabled, 0) as PushEnabled,
                COALESCE(ReferralRequestEmail, 0) as ReferralRequestEmail,
                COALESCE(ReferralClaimedEmail, 0) as ReferralClaimedEmail,
                COALESCE(ReferralVerifiedEmail, 0) as ReferralVerifiedEmail
            FROM NotificationPreferences
            WHERE UserID = @param0
        `, [userId]);

        // Return defaults if no preferences set (OFF by default - opt-in model)
        if (result.recordset.length === 0) {
            return {
                EmailEnabled: false,
                PushEnabled: false,
                ReferralRequestEmail: false,
                ReferralClaimedEmail: false,
                ReferralVerifiedEmail: false
            };
        }

        return result.recordset[0];
    }

    /**
     * Get full notification preferences for a user (for UI)
     */
    static async getFullPreferences(userId: string): Promise<{
        EmailEnabled: boolean;
        PushEnabled: boolean;
        InAppEnabled: boolean;
        ReferralRequestEmail: boolean;
        ReferralRequestPush: boolean;
        ReferralClaimedEmail: boolean;
        ReferralClaimedPush: boolean;
        ReferralVerifiedEmail: boolean;
        ReferralVerifiedPush: boolean;
        JobApplicationEmail: boolean;
        MessageReceivedEmail: boolean;
        MessageReceivedPush: boolean;
        WeeklyDigestEmail: boolean;
        DailyJobRecommendationEmail: boolean;
    }> {
        const result = await dbService.executeQuery(`
            SELECT 
                COALESCE(EmailEnabled, 0) as EmailEnabled,
                COALESCE(PushEnabled, 0) as PushEnabled,
                COALESCE(InAppEnabled, 0) as InAppEnabled,
                COALESCE(ReferralRequestEmail, 0) as ReferralRequestEmail,
                COALESCE(ReferralRequestPush, 0) as ReferralRequestPush,
                COALESCE(ReferralClaimedEmail, 0) as ReferralClaimedEmail,
                COALESCE(ReferralClaimedPush, 0) as ReferralClaimedPush,
                COALESCE(ReferralVerifiedEmail, 0) as ReferralVerifiedEmail,
                COALESCE(ReferralVerifiedPush, 0) as ReferralVerifiedPush,
                COALESCE(JobApplicationEmail, 0) as JobApplicationEmail,
                COALESCE(MessageReceivedEmail, 0) as MessageReceivedEmail,
                COALESCE(MessageReceivedPush, 0) as MessageReceivedPush,
                COALESCE(WeeklyDigestEnabled, 0) as WeeklyDigestEmail,
                COALESCE(DailyJobRecommendationEmail, 1) as DailyJobRecommendationEmail
            FROM NotificationPreferences
            WHERE UserID = @param0
        `, [userId])

        // Return defaults if no preferences set (ON by default for new users)
        if (result.recordset.length === 0) {
            return {
                EmailEnabled: true,
                PushEnabled: true,
                InAppEnabled: true,
                ReferralRequestEmail: true,
                ReferralRequestPush: true,
                ReferralClaimedEmail: true,
                ReferralClaimedPush: true,
                ReferralVerifiedEmail: true,
                ReferralVerifiedPush: true,
                JobApplicationEmail: true,
                MessageReceivedEmail: true,
                MessageReceivedPush: true,
                WeeklyDigestEmail: true,
                DailyJobRecommendationEmail: true
            };
        }

        return result.recordset[0];
    }

    /**
     * Update notification preferences for a user
     */
    static async updatePreferences(userId: string, preferences: {
        EmailEnabled?: boolean;
        PushEnabled?: boolean;
        InAppEnabled?: boolean;
        ReferralRequestEmail?: boolean;
        ReferralRequestPush?: boolean;
        ReferralClaimedEmail?: boolean;
        ReferralClaimedPush?: boolean;
        ReferralVerifiedEmail?: boolean;
        ReferralVerifiedPush?: boolean;
        JobApplicationEmail?: boolean;
        MessageReceivedEmail?: boolean;
        MessageReceivedPush?: boolean;
        WeeklyDigestEmail?: boolean;
        DailyJobRecommendationEmail?: boolean;
    }): Promise<boolean> {
        try {
            // Check if user has preferences row
            const existsResult = await dbService.executeQuery(
                `SELECT 1 FROM NotificationPreferences WHERE UserID = @param0`,
                [userId]
            );

            if (existsResult.recordset.length === 0) {
                // Insert new row
                await dbService.executeQuery(`
                    INSERT INTO NotificationPreferences (
                        UserID, EmailEnabled, PushEnabled, InAppEnabled,
                        ReferralRequestEmail, ReferralRequestPush,
                        ReferralClaimedEmail, ReferralClaimedPush,
                        ReferralVerifiedEmail, ReferralVerifiedPush,
                        JobApplicationEmail, MessageReceivedEmail, MessageReceivedPush,
                        WeeklyDigestEnabled, DailyJobRecommendationEmail
                    ) VALUES (
                        @param0, @param1, @param2, @param3,
                        @param4, @param5, @param6, @param7,
                        @param8, @param9, @param10, @param11, @param12, @param13, @param14
                    )
                `, [
                    userId,
                    preferences.EmailEnabled ?? true,
                    preferences.PushEnabled ?? true,
                    preferences.InAppEnabled ?? true,
                    preferences.ReferralRequestEmail ?? true,
                    preferences.ReferralRequestPush ?? true,
                    preferences.ReferralClaimedEmail ?? true,
                    preferences.ReferralClaimedPush ?? true,
                    preferences.ReferralVerifiedEmail ?? true,
                    preferences.ReferralVerifiedPush ?? true,
                    preferences.JobApplicationEmail ?? true,
                    preferences.MessageReceivedEmail ?? true,
                    preferences.MessageReceivedPush ?? true,
                    preferences.WeeklyDigestEmail ?? true,
                    preferences.DailyJobRecommendationEmail ?? true
                ]);
            } else {
                // Update existing row
                await dbService.executeQuery(`
                    UPDATE NotificationPreferences SET
                        EmailEnabled = @param1,
                        PushEnabled = @param2,
                        InAppEnabled = @param3,
                        ReferralRequestEmail = @param4,
                        ReferralRequestPush = @param5,
                        ReferralClaimedEmail = @param6,
                        ReferralClaimedPush = @param7,
                        ReferralVerifiedEmail = @param8,
                        ReferralVerifiedPush = @param9,
                        JobApplicationEmail = @param10,
                        MessageReceivedEmail = @param11,
                        MessageReceivedPush = @param12,
                        WeeklyDigestEnabled = @param13,
                        DailyJobRecommendationEmail = @param14,
                        UpdatedAt = GETUTCDATE()
                    WHERE UserID = @param0
                `, [
                    userId,
                    preferences.EmailEnabled ?? true,
                    preferences.PushEnabled ?? true,
                    preferences.InAppEnabled ?? true,
                    preferences.ReferralRequestEmail ?? true,
                    preferences.ReferralRequestPush ?? true,
                    preferences.ReferralClaimedEmail ?? true,
                    preferences.ReferralClaimedPush ?? true,
                    preferences.ReferralVerifiedEmail ?? true,
                    preferences.ReferralVerifiedPush ?? true,
                    preferences.JobApplicationEmail ?? true,
                    preferences.MessageReceivedEmail ?? true,
                    preferences.MessageReceivedPush ?? true,
                    preferences.WeeklyDigestEmail ?? true,
                    preferences.DailyJobRecommendationEmail ?? true
                ]);
            }

            return true;
        } catch (error: any) {
            console.error('❌ Failed to update notification preferences:', error);
            return false;
        }
    }

    /**
     * Send notification immediately (bypass queue)
     * Use for urgent/critical notifications
     */
    static async sendImmediate(
        templateName: string,
        to: string,
        data: Record<string, any>,
        userId?: string
    ): Promise<boolean> {
        try {
            const { subject, html, text } = TemplateService.render(templateName, data);
            
            const result = await EmailService.send({
                to,
                subject,
                html,
                text,
                userId,
                emailType: templateName
            });

            return result.success;
        } catch (error: any) {
            console.error('❌ Immediate send failed:', error);
            return false;
        }
    }
}

export default NotificationService;
