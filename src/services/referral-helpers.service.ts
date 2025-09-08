/**
 * Referral Notification Service
 * Handles notifications for referral system events
 */

import { dbService } from './database.service';
import { ValidationError } from '../utils/validation';

export class ReferralNotificationService {
    
    /**
     * Send notification when new referral request is created
     */
    static async notifyNewReferralRequest(requestId: string, organizationId: number): Promise<void> {
        try {
            // This would integrate with your notification system
            // For now, we'll just log and potentially send emails
            
            console.log(`?? New referral request ${requestId} for organization ${organizationId}`);
            
            // TODO: Integrate with email service or push notification service
            // Example:
            // await this.sendEmailToEligibleReferrers(requestId, organizationId);
            // await this.sendPushNotificationToEligibleReferrers(requestId, organizationId);
            
        } catch (error) {
            console.error('Error sending new referral request notification:', error);
            // Don't throw - notifications are non-critical
        }
    }

    /**
     * Send notification when referral request is claimed
     */
    static async notifyReferralClaimed(requestId: string, referrerId: string, seekerId: string): Promise<void> {
        try {
            console.log(`?? Referral request ${requestId} claimed by ${referrerId} for seeker ${seekerId}`);
            
            // Notify the seeker that their request was claimed
            // TODO: Send email/push notification to seeker
            
        } catch (error) {
            console.error('Error sending referral claimed notification:', error);
        }
    }

    /**
     * Send notification when referral is completed
     */
    static async notifyReferralCompleted(requestId: string, referrerId: string, seekerId: string): Promise<void> {
        try {
            console.log(`?? Referral request ${requestId} completed by ${referrerId} for seeker ${seekerId}`);
            
            // Notify the seeker that their referral was submitted
            // TODO: Send email/push notification to seeker
            
        } catch (error) {
            console.error('Error sending referral completed notification:', error);
        }
    }

    /**
     * Send notification when referral is verified
     */
    static async notifyReferralVerified(requestId: string, referrerId: string, pointsEarned: number): Promise<void> {
        try {
            console.log(`?? Referral request ${requestId} verified, ${pointsEarned} points awarded to ${referrerId}`);
            
            // Notify the referrer about points earned
            // TODO: Send email/push notification to referrer
            
        } catch (error) {
            console.error('Error sending referral verified notification:', error);
        }
    }

    /**
     * Send daily digest of pending referral requests
     */
    static async sendDailyReferralDigest(): Promise<void> {
        try {
            console.log('?? Sending daily referral digest...');
            
            // Get all referrers who opted in for daily digest
            const query = `
                SELECT DISTINCT a.ApplicantID, u.Email, u.FirstName
                FROM Applicants a
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ReferrerStats rs ON a.ApplicantID = rs.ReferrerID
                WHERE a.OpenToRefer = 1 
                AND rs.PendingCount > 0
                -- TODO: Add notification preferences check
            `;
            
            const result = await dbService.executeQuery(query, []);
            
            for (const referrer of result.recordset || []) {
                // TODO: Send personalized daily digest email
                console.log(`?? Would send daily digest to ${referrer.Email} (${referrer.PendingCount} pending)`);
            }
            
        } catch (error) {
            console.error('Error sending daily referral digest:', error);
        }
    }

    /**
     * Update referrer badge counts efficiently
     */
    static async updateReferrerBadgeCounts(): Promise<void> {
        try {
            console.log('?? Updating referrer badge counts...');
            
            // This is typically run as a background job every few minutes
            const updateQuery = `
                MERGE ReferrerStats rs
                USING (
                    SELECT 
                        a.ApplicantID as ReferrerID,
                        COUNT(rr.RequestID) as PendingCount
                    FROM Applicants a
                    LEFT JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID AND we.IsCurrent = 1
                    LEFT JOIN Jobs j ON j.OrganizationID = we.OrganizationID
                    LEFT JOIN ReferralRequests rr ON rr.JobID = j.JobID AND rr.Status = 'Pending'
                    WHERE a.OpenToRefer = 1
                    GROUP BY a.ApplicantID
                ) src ON rs.ReferrerID = src.ReferrerID
                WHEN MATCHED THEN
                    UPDATE SET PendingCount = src.PendingCount, LastUpdated = GETUTCDATE()
                WHEN NOT MATCHED AND src.PendingCount > 0 THEN
                    INSERT (ReferrerID, PendingCount, LastUpdated)
                    VALUES (src.ReferrerID, src.PendingCount, GETUTCDATE());

                -- Clean up zero counts
                DELETE FROM ReferrerStats WHERE PendingCount = 0;
            `;
            
            await dbService.executeQuery(updateQuery, []);
            console.log('? Referrer badge counts updated');
            
        } catch (error) {
            console.error('Error updating referrer badge counts:', error);
        }
    }
}

/**
 * Referral Analytics Service
 * Advanced analytics and reporting for referrals
 */
export class ReferralAnalyticsService {
    
    /**
     * Get comprehensive referral metrics
     */
    static async getReferralMetrics(): Promise<any> {
        try {
            const query = `
                SELECT 
                    -- Request Metrics
                    COUNT(DISTINCT rr.RequestID) as TotalRequests,
                    COUNT(DISTINCT CASE WHEN rr.Status = 'Pending' THEN rr.RequestID END) as PendingRequests,
                    COUNT(DISTINCT CASE WHEN rr.Status = 'Claimed' THEN rr.RequestID END) as ClaimedRequests,
                    COUNT(DISTINCT CASE WHEN rr.Status = 'Completed' THEN rr.RequestID END) as CompletedRequests,
                    COUNT(DISTINCT CASE WHEN rr.Status = 'Verified' THEN rr.RequestID END) as VerifiedRequests,
                    
                    -- User Metrics
                    COUNT(DISTINCT rr.ApplicantID) as UniqueSeekers,
                    COUNT(DISTINCT rr.AssignedReferrerID) as UniqueReferrers,
                    COUNT(DISTINCT CASE WHEN a.OpenToRefer = 1 THEN a.ApplicantID END) as TotalEligibleReferrers,
                    
                    -- Performance Metrics
                    AVG(CASE WHEN rr.ReferredAt IS NOT NULL 
                        THEN DATEDIFF(hour, rr.RequestedAt, rr.ReferredAt) END) as AvgClaimTimeHours,
                    
                    -- Financial Metrics
                    COUNT(DISTINCT ars.SubscriptionID) as ActiveSubscriptions,
                    SUM(rp.Price) as TotalRevenue,
                    
                    -- Points & Rewards
                    SUM(ISNULL(a.ReferralPoints, 0)) as TotalPointsDistributed
                    
                FROM ReferralRequests rr
                LEFT JOIN Applicants a ON rr.AssignedReferrerID = a.ApplicantID
                LEFT JOIN ApplicantReferralSubscriptions ars ON a.ApplicantID = ars.ApplicantID AND ars.IsActive = 1
                LEFT JOIN ReferralPlans rp ON ars.PlanID = rp.PlanID
                WHERE rr.RequestedAt >= DATEADD(day, -30, GETUTCDATE()) -- Last 30 days
            `;
            
            const result = await dbService.executeQuery(query, []);
            return result.recordset[0] || {};
            
        } catch (error) {
            console.error('Error getting referral metrics:', error);
            throw error;
        }
    }

    /**
     * Get referral conversion funnel
     */
    static async getReferralFunnel(): Promise<any[]> {
        try {
            const query = `
                SELECT 
                    'Requests Created' as Stage,
                    COUNT(*) as Count,
                    100.0 as Percentage
                FROM ReferralRequests
                WHERE RequestedAt >= DATEADD(day, -30, GETUTCDATE())
                
                UNION ALL
                
                SELECT 
                    'Requests Claimed' as Stage,
                    COUNT(*) as Count,
                    CASE WHEN (SELECT COUNT(*) FROM ReferralRequests WHERE RequestedAt >= DATEADD(day, -30, GETUTCDATE())) > 0
                        THEN (COUNT(*) * 100.0) / (SELECT COUNT(*) FROM ReferralRequests WHERE RequestedAt >= DATEADD(day, -30, GETUTCDATE()))
                        ELSE 0 END as Percentage
                FROM ReferralRequests
                WHERE Status IN ('Claimed', 'Completed', 'Verified')
                AND RequestedAt >= DATEADD(day, -30, GETUTCDATE())
                
                UNION ALL
                
                SELECT 
                    'Referrals Completed' as Stage,
                    COUNT(*) as Count,
                    CASE WHEN (SELECT COUNT(*) FROM ReferralRequests WHERE RequestedAt >= DATEADD(day, -30, GETUTCDATE())) > 0
                        THEN (COUNT(*) * 100.0) / (SELECT COUNT(*) FROM ReferralRequests WHERE RequestedAt >= DATEADD(day, -30, GETUTCDATE()))
                        ELSE 0 END as Percentage
                FROM ReferralRequests
                WHERE Status IN ('Completed', 'Verified')
                AND RequestedAt >= DATEADD(day, -30, GETUTCDATE())
                
                UNION ALL
                
                SELECT 
                    'Referrals Verified' as Stage,
                    COUNT(*) as Count,
                    CASE WHEN (SELECT COUNT(*) FROM ReferralRequests WHERE RequestedAt >= DATEADD(day, -30, GETUTCDATE())) > 0
                        THEN (COUNT(*) * 100.0) / (SELECT COUNT(*) FROM ReferralRequests WHERE RequestedAt >= DATEADD(day, -30, GETUTCDATE()))
                        ELSE 0 END as Percentage
                FROM ReferralRequests
                WHERE Status = 'Verified'
                AND RequestedAt >= DATEADD(day, -30, GETUTCDATE())
                
                ORDER BY Count DESC
            `;
            
            const result = await dbService.executeQuery(query, []);
            return result.recordset || [];
            
        } catch (error) {
            console.error('Error getting referral funnel:', error);
            throw error;
        }
    }

    /**
     * Get top performing referrers
     */
    static async getTopReferrers(limit: number = 10): Promise<any[]> {
        try {
            const query = `
                SELECT TOP (@param0)
                    u.FirstName + ' ' + u.LastName as ReferrerName,
                    u.Email,
                    COUNT(rr.RequestID) as TotalReferrals,
                    COUNT(CASE WHEN rr.Status = 'Verified' THEN 1 END) as VerifiedReferrals,
                    SUM(ISNULL(rewards.PointsEarned, 0)) as TotalPointsEarned,
                    AVG(CASE WHEN rr.ReferredAt IS NOT NULL 
                        THEN DATEDIFF(hour, rr.RequestedAt, rr.ReferredAt) END) as AvgResponseTimeHours
                FROM Applicants a
                INNER JOIN Users u ON a.UserID = u.UserID
                INNER JOIN ReferralRequests rr ON a.ApplicantID = rr.AssignedReferrerID
                LEFT JOIN ReferralRewards rewards ON a.ApplicantID = rewards.ReferrerID
                WHERE rr.RequestedAt >= DATEADD(day, -30, GETUTCDATE())
                GROUP BY a.ApplicantID, u.FirstName, u.LastName, u.Email
                ORDER BY TotalReferrals DESC, VerifiedReferrals DESC
            `;
            
            const result = await dbService.executeQuery(query, [limit]);
            return result.recordset || [];
            
        } catch (error) {
            console.error('Error getting top referrers:', error);
            throw error;
        }
    }

    /**
     * Get organization referral activity
     */
    static async getOrganizationActivity(): Promise<any[]> {
        try {
            const query = `
                SELECT 
                    o.Name as OrganizationName,
                    COUNT(DISTINCT rr.RequestID) as TotalRequests,
                    COUNT(DISTINCT rr.AssignedReferrerID) as ActiveReferrers,
                    COUNT(DISTINCT rr.ApplicantID) as UniqueSeekers,
                    AVG(CASE WHEN rr.ReferredAt IS NOT NULL 
                        THEN DATEDIFF(hour, rr.RequestedAt, rr.ReferredAt) END) as AvgClaimTimeHours
                FROM Organizations o
                INNER JOIN Jobs j ON o.OrganizationID = j.OrganizationID
                INNER JOIN ReferralRequests rr ON j.JobID = rr.JobID
                WHERE rr.RequestedAt >= DATEADD(day, -30, GETUTCDATE())
                GROUP BY o.OrganizationID, o.Name
                HAVING COUNT(DISTINCT rr.RequestID) > 0
                ORDER BY TotalRequests DESC
            `;
            
            const result = await dbService.executeQuery(query, []);
            return result.recordset || [];
            
        } catch (error) {
            console.error('Error getting organization activity:', error);
            throw error;
        }
    }
}