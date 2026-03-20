/**
 * User Service Repository — SQL queries used by user.service.ts.
 *
 * WHY THIS EXISTS:
 *  - user.service.ts has ~42 SQL queries across registration, auth, profile,
 *    dashboard, and Google OAuth flows
 *  - This extracts standalone queries while keeping transaction-based
 *    and dynamic queries in the service
 *
 * NOTE: Registration uses dbService.beginTransaction() + executeTransactionQuery()
 *       which must stay in the service. This repo handles non-transactional queries.
 *
 * RULES:
 *  1. Standalone queries go here.
 *  2. Transaction queries stay in service.
 *  3. Dynamic SET clause builders stay in service.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class UserServiceRepository {

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
    static async setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Users SET PasswordResetToken = @param1, PasswordResetExpires = @param2, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `, [userId, token, expires]);
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

    /** Lock user account (set lockout end time). */
    static async lockAccount(userId: string, lockoutEnd: Date, attempts: number): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Users SET LoginAttempts = @param1, AccountLockoutEnd = @param2, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `, [userId, attempts, lockoutEnd]);
    }

    /** Increment login attempts. */
    static async incrementLoginAttempts(userId: string, attempts: number): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET LoginAttempts = @param1, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId, attempts]
        );
    }

    /** Record successful login. */
    static async recordSuccessfulLogin(userId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Users SET LastLoginAt = GETUTCDATE(), LoginAttempts = 0, AccountLockoutEnd = NULL, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `, [userId]);
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

    /** Dynamic update on Applicants (caller provides full query). */
    static async updateApplicantDynamic(query: string, params: any[]): Promise<void> {
        await dbService.executeQuery(query, params);
    }

    /** Dynamic update on Users (caller provides full query). */
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

    // ═══════════════════════════════════════════════════════════
    //  PROFILE COMPLETENESS
    // ═══════════════════════════════════════════════════════════

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
