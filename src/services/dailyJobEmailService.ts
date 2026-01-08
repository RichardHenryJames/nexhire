/**
 * Daily Job Email Service
 * 
 * Sends personalized job recommendations to users daily at 9 PM IST
 * Uses AI job recommendation logic WITHOUT wallet deduction
 */

import { dbService } from './database.service';
import { EmailService } from './emailService';
import { TemplateService } from './templateService';
import { AIJobRecommendationService } from './ai-job-recommendation.service';
import { JobService } from './job.service';

const APP_URL = process.env.APP_URL || 'https://www.refopen.com';

interface DailyEmailResult {
    totalUsers: number;
    emailsSent: number;
    emailsFailed: number;
    errors: string[];
}

interface UserForEmail {
    UserID: string;
    Email: string;
    FirstName: string;
}

interface JobForEmail {
    JobID: string;
    Title: string;
    OrganizationName: string;
    OrganizationLogo: string;
    Location: string;
    City: string;
    Country: string;
    SalaryRangeMin: number | null;
    SalaryRangeMax: number | null;
    JobTypeName: string;
    WorkplaceTypeName: string;
    PublishedAt: Date;
}

export class DailyJobEmailService {

    /**
     * Get users eligible for daily job emails
     * Users created after 2025-12-15 AND logged in within last 1 month
     * AND have DailyJobRecommendationEmail enabled (to avoid spamming inactive users)
     */
    static async getEligibleUsers(): Promise<UserForEmail[]> {
        const query = `
            SELECT 
                u.UserID,
                u.Email,
                u.FirstName
            FROM Users u
            INNER JOIN Applicants a ON u.UserID = a.UserID
            LEFT JOIN NotificationPreferences np ON u.UserID = np.UserID
            WHERE u.CreatedAt >= '2025-12-15 19:47:35.3700000'
              AND u.LastLoginAt >= DATEADD(MONTH, -1, GETUTCDATE())
              AND u.IsActive = 1
              AND u.Email IS NOT NULL
              AND u.Email != ''
              AND u.UserType = 'JobSeeker'
              AND COALESCE(np.DailyJobRecommendationEmail, 1) = 1
            ORDER BY u.CreatedAt DESC
        `;
        
        const result = await dbService.executeQuery(query, []);
        return result.recordset || [];
    }

    /**
     * Get top 10 recommended jobs for a user (FREE - no wallet deduction)
     * Uses the SAME logic as Jobs screen - JobService.getJobs with personalization
     */
    static async getTopJobsForUser(userId: string): Promise<JobForEmail[]> {
        try {
            // Use the SAME logic as Jobs screen - JobService.getJobs with personalization
            // The backend automatically ranks jobs by user's job title, preferences, etc.
            const params = {
                page: 1,
                pageSize: 10,
                excludeUserApplications: userId, // This triggers personalization ranking
                postedWithinDays: 30
            };
            
            const result = await JobService.getJobs(params);
            if (result.jobs && result.jobs.length > 0) {
                return result.jobs as unknown as JobForEmail[];
            }
            
            // Fallback: Get latest 5 published jobs if no personalized results
            const fallbackQuery = `
                SELECT TOP 5
                    j.JobID, j.Title,
                    o.Name as OrganizationName,
                    ISNULL(o.LogoURL, '') as OrganizationLogo,
                    j.Location, j.City, j.Country,
                    j.SalaryRangeMin, j.SalaryRangeMax,
                    jt.Value as JobTypeName,
                    wt.Value as WorkplaceTypeName,
                    j.PublishedAt
                FROM Jobs j
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
                LEFT JOIN ReferenceMetadata wt ON j.WorkplaceTypeID = wt.ReferenceID AND wt.RefType = 'WorkplaceType'
                WHERE j.Status = 'Published'
                  AND j.PublishedAt >= DATEADD(DAY, -7, GETDATE())
                ORDER BY j.PublishedAt DESC
            `;
            const fallbackResult = await dbService.executeQuery(fallbackQuery, []);
            return fallbackResult.recordset || [];
        } catch (error: any) {
            console.warn(`Failed to get jobs for user ${userId}:`, error.message);
            return [];
        }
    }

    /**
     * Generate HTML for job cards in email
     */
    static generateJobCardsHtml(jobs: JobForEmail[]): string {
        if (!jobs || jobs.length === 0) {
            return `
                <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                    <tr>
                        <td style="padding: 20px; text-align: center;">
                            <p style="margin: 0; color: #666; font-size: 14px;">No new jobs found matching your profile today. Check back tomorrow!</p>
                        </td>
                    </tr>
                </table>
            `;
        }

        return jobs.map((job, index) => {
            const location = job.City || job.Location || job.Country || 'Location not specified';
            const salary = this.formatSalary(job.SalaryRangeMin, job.SalaryRangeMax);
            const jobUrl = `${APP_URL}/jobs/${job.JobID}`;
            
            return `
                <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin: 15px 0;">
                    <tr>
                        <td style="padding: 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td width="50" valign="top">
                                        ${job.OrganizationLogo 
                                            ? `<img src="${job.OrganizationLogo}" alt="${job.OrganizationName}" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover;" />`
                                            : `<div style="width: 45px; height: 45px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;">${job.OrganizationName?.charAt(0) || 'J'}</div>`
                                        }
                                    </td>
                                    <td style="padding-left: 15px;">
                                        <a href="${jobUrl}" style="color: #333; text-decoration: none; font-size: 16px; font-weight: 600; display: block; margin-bottom: 4px;">${job.Title}</a>
                                        <p style="margin: 0 0 8px 0; color: #667eea; font-size: 14px; font-weight: 500;">${job.OrganizationName}</p>
                                        <p style="margin: 0; color: #888; font-size: 13px;">
                                            📍 ${location} 
                                            ${job.WorkplaceTypeName ? `• ${job.WorkplaceTypeName}` : ''}
                                            ${salary ? `• ${salary}` : ''}
                                        </p>
                                    </td>
                                    <td width="100" valign="middle" align="right">
                                        <a href="${jobUrl}" style="display: inline-block; background: #667eea; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500;">View</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            `;
        }).join('');
    }

    /**
     * Format salary for display
     */
    private static formatSalary(min: number | null, max: number | null): string {
        if (!min && !max) return '';
        
        const formatNum = (n: number) => {
            if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
            if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
            if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
            return `₹${n}`;
        };
        
        if (min && max) {
            return `${formatNum(min)} - ${formatNum(max)}`;
        }
        return min ? `${formatNum(min)}+` : `Up to ${formatNum(max!)}`;
    }

    /**
     * Send daily job recommendation email to a single user
     */
    static async sendEmailToUser(user: UserForEmail): Promise<boolean> {
        try {
            // Get top 5 jobs for this user
            const jobs = await this.getTopJobsForUser(user.UserID);
            
            // Skip if no jobs found
            if (!jobs || jobs.length === 0) {
                console.log(`⏭️ Skipping email for ${user.Email} - no jobs found`);
                return false;
            }
            
            // Generate job cards HTML
            const jobCardsHtml = this.generateJobCardsHtml(jobs);
            
            // Render email template
            const template = TemplateService.render('daily_job_recommendations', {
                firstName: user.FirstName || 'there',
                jobCardsHtml,
                jobCount: jobs.length
            });
            
            // Send email
            const result = await EmailService.send({
                to: user.Email,
                subject: template.subject,
                html: template.html,
                text: template.text,
                userId: user.UserID,
                emailType: 'daily_job_recommendations'
            });
            
            return result.success;
            
        } catch (error: any) {
            console.error(`❌ Failed to send email to ${user.Email}:`, error.message);
            return false;
        }
    }

    /**
     * Main method: Send daily job emails to all eligible users
     */
    static async sendDailyJobEmails(): Promise<DailyEmailResult> {
        const result: DailyEmailResult = {
            totalUsers: 0,
            emailsSent: 0,
            emailsFailed: 0,
            errors: []
        };

        try {
            // Get eligible users
            const users = await this.getEligibleUsers();
            result.totalUsers = users.length;

            if (users.length === 0) {
                console.log('📭 No eligible users for daily job emails');
                return result;
            }

            console.log(`📧 Sending daily job emails to ${users.length} users...`);

            // Process users in batches of 10 to avoid overwhelming the email service
            const BATCH_SIZE = 10;
            for (let i = 0; i < users.length; i += BATCH_SIZE) {
                const batch = users.slice(i, i + BATCH_SIZE);
                
                const batchResults = await Promise.allSettled(
                    batch.map(user => this.sendEmailToUser(user))
                );
                
                for (let j = 0; j < batchResults.length; j++) {
                    const batchResult = batchResults[j];
                    const user = batch[j];
                    
                    if (batchResult.status === 'fulfilled' && batchResult.value) {
                        result.emailsSent++;
                    } else {
                        result.emailsFailed++;
                        if (batchResult.status === 'rejected') {
                            result.errors.push(`${user.Email}: ${batchResult.reason?.message || 'Unknown error'}`);
                        }
                    }
                }
                
                // Small delay between batches to avoid rate limiting
                if (i + BATCH_SIZE < users.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`✅ Daily job emails complete: ${result.emailsSent} sent, ${result.emailsFailed} failed`);
            return result;

        } catch (error: any) {
            console.error('❌ Daily job email service error:', error.message);
            result.errors.push(error.message);
            return result;
        }
    }

    /**
     * Send daily job email to a specific user (for testing)
     */
    static async sendDailyJobEmailsForUser(userId: string): Promise<DailyEmailResult> {
        const result: DailyEmailResult = {
            totalUsers: 0,
            emailsSent: 0,
            emailsFailed: 0,
            errors: []
        };

        try {
            // Get specific user details with notification preference check
            const userQuery = `
                SELECT 
                    u.UserID,
                    u.Email,
                    u.FirstName,
                    COALESCE(np.DailyJobRecommendationEmail, 1) as DailyJobRecommendationEmail
                FROM Users u
                LEFT JOIN NotificationPreferences np ON u.UserID = np.UserID
                WHERE u.UserID = @param0
                  AND u.IsActive = 1
                  AND u.Email IS NOT NULL
            `;
            
            const userResult = await dbService.executeQuery(userQuery, [userId]);
            
            if (!userResult.recordset || userResult.recordset.length === 0) {
                result.errors.push(`User ${userId} not found or inactive`);
                return result;
            }

            const user = userResult.recordset[0];
            result.totalUsers = 1;

            // Check if user has daily job recommendation emails enabled
            if (!user.DailyJobRecommendationEmail) {
                console.log(`⏭️ Skipping ${user.Email} - DailyJobRecommendationEmail is disabled`);
                result.errors.push(`User ${user.Email} has DailyJobRecommendationEmail disabled`);
                return result;
            }

            console.log(`📧 Sending test daily job email to ${user.Email}...`);

            const success = await this.sendEmailToUser(user);
            
            if (success) {
                result.emailsSent = 1;
                console.log(`✅ Test email sent successfully to ${user.Email}`);
            } else {
                result.emailsFailed = 1;
                result.errors.push(`Failed to send email to ${user.Email}`);
            }

            return result;

        } catch (error: any) {
            console.error('❌ Test email error:', error.message);
            result.errors.push(error.message);
            return result;
        }
    }

    /**
     * Log daily email run to database
     */
    static async logEmailRun(
        executionId: string,
        startTime: Date,
        endTime: Date,
        result: DailyEmailResult,
        triggerType: 'TimerTrigger' | 'Manual' = 'TimerTrigger'
    ): Promise<void> {
        try {
            // First ensure table exists
            await dbService.executeQuery(`
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DailyJobEmailLogs')
                BEGIN
                    CREATE TABLE DailyJobEmailLogs (
                        LogID INT IDENTITY(1,1) PRIMARY KEY,
                        ExecutionID NVARCHAR(100) NOT NULL,
                        StartTime DATETIME2 NOT NULL,
                        EndTime DATETIME2 NOT NULL,
                        DurationSeconds INT,
                        TotalUsers INT NOT NULL DEFAULT 0,
                        EmailsSent INT NOT NULL DEFAULT 0,
                        EmailsFailed INT NOT NULL DEFAULT 0,
                        Errors NVARCHAR(MAX),
                        TriggerType NVARCHAR(50) NOT NULL DEFAULT 'Manual',
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                    CREATE INDEX IX_DailyJobEmailLogs_StartTime ON DailyJobEmailLogs(StartTime DESC);
                END
            `, []);

            const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
            
            await dbService.executeQuery(`
                INSERT INTO DailyJobEmailLogs (
                    ExecutionID, StartTime, EndTime, DurationSeconds,
                    TotalUsers, EmailsSent, EmailsFailed, Errors, TriggerType
                ) VALUES (
                    @param0, @param1, @param2, @param3,
                    @param4, @param5, @param6, @param7, @param8
                )
            `, [
                executionId,
                startTime,
                endTime,
                durationSeconds,
                result.totalUsers,
                result.emailsSent,
                result.emailsFailed,
                result.errors.slice(0, 10).join('; '), // Limit errors stored
                triggerType
            ]);
        } catch (error: any) {
            console.warn('⚠️ Failed to log daily email run:', error.message);
        }
    }
}

export default DailyJobEmailService;
