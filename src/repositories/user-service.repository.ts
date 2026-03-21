/**
 * User Service Repository — SQL queries used by user.service.ts.
 *
 * WHY THIS EXISTS:
 *  - user.service.ts has ~48 SQL queries across registration, auth, profile,
 *    dashboard, and Google OAuth flows
 *  - This extracts ALL queries — both standalone and transaction-based —
 *    providing a single source of truth for user-related data access
 *
 * RULES:
 *  1. All SQL queries go here.
 *  2. Business logic (validation, hashing, token generation) stays in service.
 *  3. Transaction orchestration (begin/commit/rollback) stays in service.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class UserServiceRepository {

    // ═══════════════════════════════════════════════════════════
    //  TRANSACTION HELPERS
    // ═══════════════════════════════════════════════════════════

    /** Begin a database transaction. */
    static async beginTransaction(): Promise<any> {
        return dbService.beginTransaction();
    }

    /** Execute a query within a transaction. */
    static async executeTransactionQuery<T = any>(tx: any, query: string, params: any[]): Promise<any> {
        return dbService.executeTransactionQuery<T>(tx, query, params);
    }

    // ═══════════════════════════════════════════════════════════
    //  REGISTRATION (transaction-based)
    // ═══════════════════════════════════════════════════════════

    /** Insert user during registration (within transaction). */
    static async insertUserTx(tx: any, query: string, params: any[]): Promise<any> {
        return dbService.executeTransactionQuery(tx, query, params);
    }

    /** Create employer profile with organization lookup/insert (within transaction). */
    static async findOrgByNameTx(tx: any, organizationName: string): Promise<any> {
        return dbService.executeTransactionQuery(tx,
            `SELECT OrganizationID FROM Organizations WHERE Name = @param0`,
            [organizationName]
        );
    }

    /** Insert a new organization (within transaction). */
    static async insertOrganizationTx(tx: any, params: any[]): Promise<any> {
        return dbService.executeTransactionQuery(tx, `
            INSERT INTO Organizations (
                Name, Description, Industry, Size, Headquarters,
                Website, Type, EstablishedDate, CreatedAt, UpdatedAt
            )
            OUTPUT INSERTED.OrganizationID
            VALUES (
                @param0, @param1, @param2, @param3, @param4,
                @param5, @param6, @param7, GETUTCDATE(), GETUTCDATE()
            )
        `, params);
    }

    /** Insert employer profile (within transaction). */
    static async insertEmployerTx(tx: any, employerId: string, userId: string, organizationId: number): Promise<void> {
        await dbService.executeTransactionQuery(tx, `
            INSERT INTO Employers (
                EmployerID, UserID, OrganizationID, Role, IsVerified, JoinedAt
            ) VALUES (
                @param0, @param1, @param2, 'Recruiter', 0, GETUTCDATE()
            )
        `, [employerId, userId, organizationId]);
    }

    /** Create applicant profile (within transaction). */
    static async insertApplicantTx(tx: any, applicantId: string, userId: string): Promise<void> {
        await dbService.executeTransactionQuery(tx, `
            INSERT INTO Applicants (
                ApplicantID, UserID, ProfileCompleteness, IsOpenToWork,
                AllowRecruitersToContact, HideCurrentCompany, HideSalaryDetails,
                ImmediatelyAvailable, WillingToRelocate, IsFeatured, OpenToRefer,
                CreatedAt, UpdatedAt
            ) VALUES (
                @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0, 1,
                GETUTCDATE(), GETUTCDATE()
            )
        `, [applicantId, userId]);
    }

    /** Upgrade user type to Employer (within transaction). */
    static async upgradeToEmployerTx(tx: any, userId: string): Promise<void> {
        await dbService.executeTransactionQuery(tx,
            `UPDATE Users SET UserType = 'Employer', UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId]
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  REFERRAL CODE LOOKUPS
    // ═══════════════════════════════════════════════════════════

    /** Find a user by referral code (UserID prefix via LIKE). */
    static async findByReferralCode(codePrefix: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT UserID, Email, FirstName, LastName
            FROM Users
            WHERE CAST(UserID AS NVARCHAR(50)) LIKE @param0 AND IsActive = 1
        `, [codePrefix]);
        return result.recordset?.[0] ?? null;
    }

    // ═══════════════════════════════════════════════════════════
    //  CONSENT + NOTIFICATIONS (post-registration)
    // ═══════════════════════════════════════════════════════════

    /** Log user consent (terms + privacy policy). */
    static async logConsent(userId: string, termsVersion: string, privacyVersion: string, ipAddress: string | null, userAgent: string | null): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO UserConsentLog (UserID, ConsentType, Version, AcceptedAt, IPAddress, UserAgent)
            VALUES (@param0, 'TERMS', @param1, GETUTCDATE(), @param3, @param4);
            INSERT INTO UserConsentLog (UserID, ConsentType, Version, AcceptedAt, IPAddress, UserAgent)
            VALUES (@param0, 'PRIVACY_POLICY', @param2, GETUTCDATE(), @param3, @param4);
        `, [userId, termsVersion, privacyVersion, ipAddress, userAgent]);
    }

    /** Create default notification preferences for a new user. */
    static async createDefaultNotificationPrefs(userId: string): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO NotificationPreferences (
                UserID, EmailEnabled, PushEnabled, InAppEnabled,
                ReferralRequestEmail, ReferralRequestPush,
                ReferralClaimedEmail, ReferralClaimedPush,
                ReferralVerifiedEmail, ReferralVerifiedPush,
                JobApplicationEmail, MessageReceivedEmail, MessageReceivedPush,
                WeeklyDigestEnabled, DailyJobRecommendationEmail, ReferrerNotificationEmail, MarketingEmail
            ) VALUES (@param0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
        `, [userId]);
    }

    // ═══════════════════════════════════════════════════════════
    //  AUTH OPERATIONS
    // ═══════════════════════════════════════════════════════════

    /** Update password. */
    static async updatePassword(userId: string, hashedPassword: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET Password = @param1, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId, hashedPassword]
        );
    }

    /** Set password reset token + expiry. */
    static async setPasswordResetToken(userId: string, tokenHash: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Users
            SET PasswordResetToken = @param1,
                PasswordResetExpires = DATEADD(HOUR, 1, GETUTCDATE()),
                UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `, [userId, tokenHash]);
    }

    /** Clear password reset token after successful reset. */
    static async clearPasswordResetToken(userId: string, hashedPassword: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Users SET Password = @param1, PasswordResetToken = NULL, PasswordResetExpires = NULL, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `, [userId, hashedPassword]);
    }

    /** Set password for Google-only user (enabling email+password login). */
    static async setPasswordForGoogleUser(userId: string, hashedPassword: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Users SET Password = @param1, LoginMethod = 'Both', UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `, [userId, hashedPassword]);
    }

    /** Mark email as verified. */
    static async markEmailVerified(userId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET EmailVerified = 1, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId]
        );
    }

    /** Deactivate a user account. */
    static async deactivateUser(userId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET IsActive = 0, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId]
        );
    }

    /** Lock user account after too many failed attempts. */
    static async lockAccount(userId: string, attempts: number, lockoutMinutes: number): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET LoginAttempts = @param1, AccountLockoutEnd = DATEADD(MINUTE, @param2, GETUTCDATE()) WHERE UserID = @param0`,
            [userId, attempts, lockoutMinutes]
        );
    }

    /** Increment login attempts. */
    static async incrementLoginAttempts(userId: string, attempts: number): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET LoginAttempts = @param1 WHERE UserID = @param0`,
            [userId, attempts]
        );
    }

    /** Record successful login (reset attempts + update last login). */
    static async recordSuccessfulLogin(userId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET LastLoginAt = GETUTCDATE(), LoginAttempts = 0, AccountLockoutEnd = NULL WHERE UserID = @param0`,
            [userId]
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  PROFILE UPDATES
    // ═══════════════════════════════════════════════════════════

    /** Update user profile (dynamic fields). Returns updated user. */
    static async updateUserProfile(userId: string, updateFields: string, values: any[], safeColumns: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            UPDATE Users
            SET ${updateFields}, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0;

            SELECT ${safeColumns} FROM Users WHERE UserID = @param0;
        `, [userId, ...values]);
        return result.recordset?.[0] ?? null;
    }

    /** Update Google user fields on login. */
    static async updateGoogleLoginFields(userId: string, updateFields: string, values: any[]): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET ${updateFields}, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId, ...values]
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  REGISTRATION HELPERS
    // ═══════════════════════════════════════════════════════════

    /** Check if employer profile already exists for a user. */
    static async employerExists(userId: string): Promise<boolean> {
        const result = await dbService.executeQuery(
            `SELECT EmployerID FROM Employers WHERE UserID = @param0`,
            [userId]
        );
        return (result.recordset?.length ?? 0) > 0;
    }

    /** Update education fields on Applicants. */
    static async updateApplicantEducation(applicantId: string, institution: string | null, degree: string | null, fieldOfStudy: string | null, gradYear: string | null, gpa: string | null): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET Institution=@param1, HighestEducation=@param2, FieldOfStudy=@param3, GraduationYear=@param4, GPA=@param5, UpdatedAt=GETUTCDATE() WHERE ApplicantID=@param0`,
            [applicantId, institution, degree, fieldOfStudy, gradYear, gpa]
        );
    }

    /** Dynamic update on Applicants (caller provides SET clause + params). */
    static async updateApplicantDynamic(updateFields: string, params: any[]): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET ${updateFields} WHERE ApplicantID=@param0`,
            params
        );
    }

    /** Dynamic update on Users (caller provides SET clause + params). */
    static async updateUserDynamic(query: string, params: any[]): Promise<void> {
        await dbService.executeQuery(query, params);
    }

    // ═══════════════════════════════════════════════════════════
    //  DASHBOARD / STATS
    // ═══════════════════════════════════════════════════════════

    /** Execute a stats query and return first row. */
    static async getStats(query: string, params: any[]): Promise<any> {
        const result = await dbService.executeQuery(query, params);
        return result.recordset?.[0] || {};
    }

    /** Execute a query returning recordset. */
    static async query(query: string, params: any[]): Promise<any[]> {
        const result = await dbService.executeQuery(query, params);
        return result.recordset || [];
    }

    /** Get user flags (IsVerifiedReferrer). */
    static async getUserFlags(userId: string): Promise<any> {
        const result = await dbService.executeQuery(
            `SELECT IsVerifiedReferrer FROM Users WHERE UserID = @param0`,
            [userId]
        );
        return result.recordset?.[0] || {};
    }

    /** Get current work experience verification status. */
    static async getCurrentWorkExpVerification(applicantId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT TOP 1 CompanyEmailVerified
            FROM WorkExperiences
            WHERE ApplicantID = @param0
              AND IsActive = 1
              AND (IsCurrent = 1 OR EndDate IS NULL)
            ORDER BY StartDate DESC
        `, [applicantId]);
        return result.recordset?.[0] ?? null;
    }

    /** Get job seeker dashboard stats (large aggregate query). */
    static async getJobSeekerStats(query: string, params: any[]): Promise<any> {
        const result = await dbService.executeQuery(query, params);
        return result.recordset?.[0] || {};
    }

    /** Get draft jobs count for verified referrers. */
    static async getDraftJobsCount(userId: string): Promise<number> {
        const result = await dbService.executeQuery(
            `SELECT COUNT(*) as DraftCount FROM Jobs WHERE PostedByUserID = @param0 AND Status = 'Draft'`,
            [userId]
        );
        return result.recordset?.[0]?.DraftCount || 0;
    }

    /** Get employer dashboard stats (large aggregate query). */
    static async getEmployerStats(query: string, params: any[]): Promise<any> {
        const result = await dbService.executeQuery(query, params);
        return result.recordset?.[0] || {};
    }

    /** Get referral stats for a job seeker. */
    static async getReferralStats(query: string, params: any[]): Promise<any> {
        const result = await dbService.executeQuery(query, params);
        return result.recordset?.[0] || {};
    }

    /** Get resume stats for an applicant. */
    static async getResumeStats(applicantId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT
                COUNT(*) as TotalResumes,
                CASE WHEN EXISTS(SELECT 1 FROM ApplicantResumes WHERE ApplicantID = @param0 AND IsPrimary = 1)
                     THEN 1 ELSE 0 END as PrimaryResumeSet
            FROM ApplicantResumes
            WHERE ApplicantID = @param0
        `, [applicantId]);
        return result.recordset?.[0] || { TotalResumes: 0, PrimaryResumeSet: 0 };
    }

    /** Get recent activity stats for a user. */
    static async getRecentActivity(userId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT TOP 10
                'application' as ActivityType,
                j.Title as JobTitle,
                o.Name as CompanyName,
                ja.SubmittedAt as ActivityDate,
                aps.Status as CurrentStatus
            FROM JobApplications ja
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
            WHERE a.UserID = @param0 AND ja.StatusID != 6
            ORDER BY ja.SubmittedAt DESC
        `, [userId]);
        return result.recordset || [];
    }

    /** Get profile insights for an applicant. */
    static async getProfileInsights(applicantId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT
                PrimarySkills, SecondarySkills,
                PreferredJobTypes, PreferredWorkTypes, PreferredLocations,
                CurrentJobTitle,
                ISNULL(TotalExperienceMonths, 0) as TotalExperienceMonths,
                LinkedInProfile, IsOpenToWork, AllowRecruitersToContact
            FROM Applicants
            WHERE ApplicantID = @param0
        `, [applicantId]);
        return result.recordset?.[0] || {};
    }

    /** Get employer referral stats. */
    static async getEmployerReferralStats(userId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT
                (SELECT COUNT(DISTINCT rr.RequestID)
                 FROM ReferralRequests rr
                 INNER JOIN Jobs j ON rr.JobID = j.JobID
                 WHERE j.PostedByUserID = @param0) as ReferralsForMyJobs,

                (SELECT COUNT(DISTINCT rr.RequestID)
                 FROM ReferralRequests rr
                 INNER JOIN Jobs j ON rr.JobID = j.JobID
                 WHERE j.PostedByUserID = @param0 AND rr.Status IN ('Completed', 'Verified')) as CompletedReferralsForMyJobs
        `, [userId]);
        return result.recordset?.[0] || {};
    }

    /** Get top performing jobs for an employer. */
    static async getTopPerformingJobs(userId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT TOP 5
                j.JobID, j.Title, j.Status, j.CreatedAt,
                ISNULL(j.CurrentApplications, 0) as ApplicationCount,
                (SELECT COUNT(*) FROM JobApplications ja WHERE ja.JobID = j.JobID AND ja.StatusID = 3) as ShortlistedCount,
                (SELECT COUNT(*) FROM JobApplications ja WHERE ja.JobID = j.JobID AND ja.StatusID = 5) as HiredCount
            FROM Jobs j
            WHERE j.PostedByUserID = @param0
            ORDER BY ISNULL(j.CurrentApplications, 0) DESC, j.CreatedAt DESC
        `, [userId]);
        return result.recordset || [];
    }

    /** Get hiring pipeline insights for an employer. */
    static async getHiringPipelineInsights(userId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT
                COUNT(CASE WHEN ja.StatusID = 1 THEN 1 END) as Applied,
                COUNT(CASE WHEN ja.StatusID = 2 THEN 1 END) as Reviewing,
                COUNT(CASE WHEN ja.StatusID = 3 THEN 1 END) as Shortlisted,
                COUNT(CASE WHEN ja.StatusID = 4 THEN 1 END) as Interview,
                COUNT(CASE WHEN ja.StatusID = 5 THEN 1 END) as Hired,
                COUNT(CASE WHEN ja.StatusID = 6 THEN 1 END) as Rejected
            FROM JobApplications ja
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            WHERE j.PostedByUserID = @param0
        `, [userId]);
        return result.recordset?.[0] || {};
    }

    /** Get employer's organization details. */
    static async getEmployerOrganization(userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT o.OrganizationID, o.Name, o.Size, o.Industry
            FROM Employers e
            INNER JOIN Organizations o ON e.OrganizationID = o.OrganizationID
            WHERE e.UserID = @param0
        `, [userId]);
        return result.recordset?.[0] ?? null;
    }

    /** Get organization-wide metrics. */
    static async getOrganizationMetrics(organizationId: number): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT
                COUNT(DISTINCT e.EmployerID) as TotalEmployers,
                COUNT(DISTINCT j.JobID) as TotalJobs,
                COUNT(DISTINCT ja.ApplicationID) as TotalApplications
            FROM Organizations o
            LEFT JOIN Employers e ON o.OrganizationID = e.OrganizationID
            LEFT JOIN Jobs j ON o.OrganizationID = j.OrganizationID
            LEFT JOIN JobApplications ja ON j.JobID = ja.JobID
            WHERE o.OrganizationID = @param0
        `, [organizationId]);
        return result.recordset?.[0] || {};
    }

    /** Get employer profile completeness data. */
    static async getEmployerCompletenessData(userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT
                u.FirstName, u.LastName, u.Email, u.Phone, u.ProfilePictureURL,
                e.Role, e.OrganizationID,
                o.Name as OrganizationName, o.Industry, o.Size, o.Website, o.Description
            FROM Users u
            LEFT JOIN Employers e ON u.UserID = e.UserID
            LEFT JOIN Organizations o ON e.OrganizationID = o.OrganizationID
            WHERE u.UserID = @param0
        `, [userId]);
        return result.recordset?.[0] ?? null;
    }

    // ═══════════════════════════════════════════════════════════
    //  PROFILE COMPLETENESS
    // ═══════════════════════════════════════════════════════════

    /** Get applicant + user data for completeness calculation. */
    static async getCompletenessData(applicantId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT
                u.FirstName, u.LastName, u.Email, u.Phone, u.ProfilePictureURL,
                a.Headline, a.CurrentJobTitle, a.CurrentCompanyName, a.TotalExperienceMonths,
                a.CurrentLocation, a.Summary,
                a.Institution, a.HighestEducation, a.FieldOfStudy,
                a.PrimarySkills, a.SecondarySkills,
                a.PreferredJobTypes, a.PreferredWorkTypes, a.PreferredLocations,
                a.LinkedInProfile,
                (SELECT COUNT(*) FROM ApplicantResumes r WHERE r.ApplicantID = a.ApplicantID) AS ResumeCount,
                (SELECT COUNT(*) FROM WorkExperiences w WHERE w.ApplicantID = a.ApplicantID AND w.IsActive = 1) AS WorkExpCount
            FROM Applicants a
            INNER JOIN Users u ON a.UserID = u.UserID
            WHERE a.ApplicantID = @param0
        `, [applicantId]);
        return result.recordset?.[0] ?? null;
    }

    /** Update ProfileCompleteness on Applicants. */
    static async updateProfileCompleteness(applicantId: string, completeness: number): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET ProfileCompleteness = @param1, UpdatedAt = GETUTCDATE() WHERE ApplicantID = @param0`,
            [applicantId, completeness]
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  TERMS & CONSENT
    // ═══════════════════════════════════════════════════════════

    /** Update terms/privacy acceptance timestamps. */
    static async updateTermsAcceptance(userId: string, termsVersion: string, privacyVersion: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Users SET
                TermsAcceptedAt = GETUTCDATE(), TermsVersion = @param1,
                PrivacyPolicyAcceptedAt = GETUTCDATE(), PrivacyPolicyVersion = @param2,
                UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `, [userId, termsVersion, privacyVersion]);
    }
}
