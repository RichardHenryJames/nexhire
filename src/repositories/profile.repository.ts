/**
 * Profile Repository — Single source of truth for Applicants, ApplicantResumes,
 * ApplicantSalaries, Employers, and Organizations profile queries.
 *
 * WHY THIS EXISTS:
 *  - profile.service.ts mixed resume SAS signing, completeness calculation,
 *    and ~34 raw SQL queries across 5 tables
 *  - This centralises every SQL statement for testability
 *
 * RULES:
 *  1. Only this repository should write raw SQL for profile-related tables.
 *  2. Services call repository methods — never dbService directly.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class ProfileRepository {

    // ═══════════════════════════════════════════════════════════
    //  USER / APPLICANT LOOKUPS
    // ═══════════════════════════════════════════════════════════

    /** Check user exists and is active. */
    static async findActiveUser(userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(
            `SELECT UserID, UserType FROM Users WHERE UserID = @param0 AND IsActive = 1`,
            [userId]
        );
        return result.recordset?.[0] ?? null;
    }

    /** Get full applicant profile with user info. */
    static async findApplicantProfile(userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT a.*, u.FirstName, u.LastName, u.Email, u.Phone,
                u.ProfilePictureURL, u.IsVerifiedReferrer, u.IsVerifiedUser,
                ISNULL(a.ReferralPoints, 0) as ReferralPoints
            FROM Applicants a
            INNER JOIN Users u ON a.UserID = u.UserID
            WHERE a.UserID = @param0
        `, [userId]);
        return result.recordset?.[0] ?? null;
    }

    /** Insert a new applicant profile. */
    static async insertApplicant(applicantId: string, userId: string): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO Applicants (
                ApplicantID, UserID, ProfileCompleteness, IsOpenToWork,
                AllowRecruitersToContact, HideCurrentCompany, HideSalaryDetails,
                ImmediatelyAvailable, WillingToRelocate, IsFeatured, OpenToRefer,
                CreatedAt, UpdatedAt
            ) VALUES (@param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0, 1, GETUTCDATE(), GETUTCDATE())
        `, [applicantId, userId]);
    }

    /** Dynamic UPDATE on Applicants (caller builds SET clause). */
    static async updateApplicant(query: string, params: any[]): Promise<void> {
        await dbService.executeQuery(query, params);
    }

    /** Update LastJobAppliedAt. */
    static async touchLastJobApplied(userId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET LastJobAppliedAt = GETUTCDATE(), UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId]
        );
    }

    /** Update SearchScore. */
    static async updateSearchScore(userId: string, score: number): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET SearchScore = @param1, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId, score]
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  WORK EXPERIENCE (profile enrichment queries)
    // ═══════════════════════════════════════════════════════════

    /** Get work experiences for profile enrichment. */
    static async findWorkExperiences(applicantId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT we.WorkExperienceID, we.CompanyName, we.JobTitle, we.Department,
                we.EmploymentType, we.StartDate, we.EndDate, we.IsCurrent,
                we.Location, we.Country, we.Description, we.Skills,
                we.CompanyEmailVerified, we.OrganizationID,
                o.Name as OrganizationName, o.LogoURL as OrganizationLogo,
                ISNULL(o.Tier, 'Standard') as OrganizationTier
            FROM WorkExperiences we
            LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
            WHERE we.ApplicantID = @param0 AND (we.IsActive = 1 OR we.IsActive IS NULL)
            ORDER BY we.IsCurrent DESC,
                CASE WHEN we.EndDate IS NULL THEN 1 ELSE 0 END DESC,
                we.EndDate DESC, we.StartDate DESC
        `, [applicantId]);
        return result.recordset || [];
    }

    /** Get referral stats for profile. */
    static async getReferralStats(userId: string, applicantId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT 
                COUNT(DISTINCT CASE WHEN rr.AssignedReferrerID = @param0 THEN rr.RequestID END) as TotalReferralsMade,
                COUNT(DISTINCT CASE WHEN rr.AssignedReferrerID = @param0 AND rr.Status = 'Verified' THEN rr.RequestID END) as VerifiedReferrals,
                COUNT(DISTINCT CASE WHEN rr.ApplicantID = @param1 THEN rr.RequestID END) as ReferralRequestsMade,
                ISNULL(SUM(CASE WHEN rw.ReferrerID = @param1 THEN rw.PointsEarned ELSE 0 END), 0) as TotalPointsFromRewards
            FROM ReferralRequests rr
            LEFT JOIN ReferralRewards rw ON rr.RequestID = rw.RequestID
            WHERE (rr.AssignedReferrerID = @param0 OR rr.ApplicantID = @param1)
        `, [userId, applicantId]);
        return result.recordset?.[0] || {};
    }

    // ═══════════════════════════════════════════════════════════
    //  SALARY BREAKDOWN
    // ═══════════════════════════════════════════════════════════

    /** Get salary components for an applicant. */
    static async findSalaryBreakdown(applicantId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT aps.*, sc.ComponentName, sc.ComponentType,
                c.Code as CurrencyCode, c.Symbol as CurrencySymbol
            FROM ApplicantSalaries aps
            INNER JOIN SalaryComponents sc ON aps.ComponentID = sc.ComponentID
            INNER JOIN Currencies c ON aps.CurrencyID = c.CurrencyID
            WHERE aps.ApplicantID = @param0
            ORDER BY aps.SalaryContext, sc.ComponentID
        `, [applicantId]);
        return result.recordset || [];
    }

    /** Delete all salary records for an applicant. */
    static async deleteSalaries(applicantId: string): Promise<void> {
        await dbService.executeQuery(
            `DELETE FROM ApplicantSalaries WHERE ApplicantID = @param0`,
            [applicantId]
        );
    }

    /** Insert a single salary component. */
    static async insertSalary(params: {
        salaryId: string;
        applicantId: string;
        componentId: number;
        amount: number;
        currencyId: number;
        frequency: string;
        context: 'Current' | 'Expected';
        notes: string;
    }): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ApplicantSalaries (
                ApplicantSalaryID, ApplicantID, ComponentID, Amount,
                CurrencyID, Frequency, SalaryContext, Notes, CreatedAt, UpdatedAt
            ) VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6, @param7, GETUTCDATE(), GETUTCDATE())
        `, [params.salaryId, params.applicantId, params.componentId, params.amount,
            params.currencyId, params.frequency, params.context, params.notes]);
    }

    // ═══════════════════════════════════════════════════════════
    //  RESUMES
    // ═══════════════════════════════════════════════════════════

    /** Get all non-deleted resumes for an applicant. */
    static async findResumes(applicantId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT ResumeID, ResumeLabel, ResumeURL, IsPrimary, IsDeleted, DeletedAt, CreatedAt, UpdatedAt
            FROM ApplicantResumes
            WHERE ApplicantID = @param0 AND (IsDeleted = 0 OR IsDeleted IS NULL)
            ORDER BY IsPrimary DESC, CreatedAt DESC
        `, [applicantId]);
        return result.recordset || [];
    }

    /** Get a single resume by ID (includes soft-deleted for history). */
    static async findResumeById(resumeId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT ResumeID, ResumeLabel, ResumeURL, IsPrimary, IsDeleted, DeletedAt, CreatedAt, UpdatedAt
            FROM ApplicantResumes WHERE ResumeID = @param0
        `, [resumeId]);
        return result.recordset?.[0] ?? null;
    }

    /** Get primary resume. */
    static async findPrimaryResume(applicantId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT TOP 1 ResumeID, ResumeLabel, ResumeURL, IsPrimary, CreatedAt, UpdatedAt
            FROM ApplicantResumes
            WHERE ApplicantID = @param0 AND IsPrimary = 1 AND (IsDeleted = 0 OR IsDeleted IS NULL)
            ORDER BY CreatedAt DESC
        `, [applicantId]);
        return result.recordset?.[0] ?? null;
    }

    /** Unset all primary flags for an applicant. */
    static async clearPrimaryResumes(applicantId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE ApplicantResumes SET IsPrimary = 0 WHERE ApplicantID = @param0`,
            [applicantId]
        );
    }

    /** Count non-deleted resumes. */
    static async countResumes(applicantId: string): Promise<number> {
        const result = await dbService.executeQuery(
            `SELECT COUNT(*) as ResumeCount FROM ApplicantResumes WHERE ApplicantID = @param0`,
            [applicantId]
        );
        return result.recordset?.[0]?.ResumeCount || 0;
    }

    /** Get oldest non-primary resume (for auto-rotation). */
    static async findOldestNonPrimary(applicantId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT TOP 1 ResumeID, ResumeURL FROM ApplicantResumes
            WHERE ApplicantID = @param0 AND IsPrimary = 0 ORDER BY CreatedAt ASC
        `, [applicantId]);
        return result.recordset?.[0] ?? null;
    }

    /** Hard delete a resume by ID. */
    static async deleteResume(resumeId: string): Promise<void> {
        await dbService.executeQuery(
            `DELETE FROM ApplicantResumes WHERE ResumeID = @param0`,
            [resumeId]
        );
    }

    /** Get UserID from ApplicantID. */
    static async getUserIdFromApplicant(applicantId: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT UserID FROM Applicants WHERE ApplicantID = @param0`,
            [applicantId]
        );
        return result.recordset?.[0]?.UserID ?? null;
    }

    /** Insert a new resume. */
    static async insertResume(params: {
        resumeId: string;
        applicantId: string;
        label: string;
        url: string;
        isPrimary: number;
        parsedText: string | null;
    }): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ApplicantResumes (
                ResumeID, ApplicantID, ResumeLabel, ResumeURL,
                IsPrimary, ParsedResumeText, CreatedAt, UpdatedAt
            ) VALUES (@param0, @param1, @param2, @param3, @param4, @param5, GETUTCDATE(), GETUTCDATE())
        `, [params.resumeId, params.applicantId, params.label, params.url, params.isPrimary, params.parsedText]);
    }

    /** Find resume for delete validation. */
    static async findResumeForDelete(resumeId: string, applicantId: string): Promise<any | null> {
        const result = await dbService.executeQuery(
            `SELECT IsPrimary, IsDeleted, ResumeURL FROM ApplicantResumes WHERE ResumeID = @param0 AND ApplicantID = @param1`,
            [resumeId, applicantId]
        );
        return result.recordset?.[0] ?? null;
    }

    /** Get active resume counts + primary count. */
    static async getActiveResumeCounts(applicantId: string): Promise<{ Total: number; PrimaryCount: number }> {
        const result = await dbService.executeQuery(
            `SELECT COUNT(*) as Total, SUM(CAST(IsPrimary as INT)) as PrimaryCount FROM ApplicantResumes WHERE ApplicantID = @param0 AND (IsDeleted = 0 OR IsDeleted IS NULL)`,
            [applicantId]
        );
        return result.recordset?.[0] || { Total: 0, PrimaryCount: 0 };
    }

    /** Check if a resume is used by applications or referrals. */
    static async getResumeUsage(resumeId: string): Promise<{ ApplicationCount: number; ReferralCount: number }> {
        const result = await dbService.executeQuery(`
            SELECT
                (SELECT COUNT(*) FROM JobApplications WHERE ResumeID = @param0) as ApplicationCount,
                (SELECT COUNT(*) FROM ReferralRequests WHERE ResumeID = @param0) as ReferralCount
        `, [resumeId]);
        return result.recordset?.[0] || { ApplicationCount: 0, ReferralCount: 0 };
    }

    /** Soft-delete a resume. */
    static async softDeleteResume(resumeId: string, applicantId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE ApplicantResumes SET IsDeleted = 1, DeletedAt = GETUTCDATE(), UpdatedAt = GETUTCDATE() WHERE ResumeID = @param0 AND ApplicantID = @param1`,
            [resumeId, applicantId]
        );
    }

    /** Hard-delete a resume by ID + applicantID. */
    static async hardDeleteResume(resumeId: string, applicantId: string): Promise<void> {
        await dbService.executeQuery(
            `DELETE FROM ApplicantResumes WHERE ResumeID = @param0 AND ApplicantID = @param1`,
            [resumeId, applicantId]
        );
    }

    /** Set a resume as primary. */
    static async setPrimary(resumeId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE ApplicantResumes SET IsPrimary = 1, UpdatedAt = GETUTCDATE() WHERE ResumeID = @param0`,
            [resumeId]
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  EMPLOYER + ORGANIZATION
    // ═══════════════════════════════════════════════════════════

    /** Get employer profile with org + user info. */
    static async findEmployerProfile(userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT e.EmployerID, e.UserID, e.OrganizationID, e.Role, e.IsVerified, e.JoinedAt,
                o.Name as OrganizationName, o.Industry as OrganizationIndustry,
                o.Size as OrganizationSize, o.Headquarters as OrganizationHeadquarters,
                o.Website as OrganizationWebsite, o.Description as OrganizationDescription,
                o.LogoURL as OrganizationLogoURL,
                u.FirstName, u.LastName, u.Email, u.Phone, u.ProfilePictureURL
            FROM Employers e
            INNER JOIN Organizations o ON e.OrganizationID = o.OrganizationID
            INNER JOIN Users u ON e.UserID = u.UserID
            WHERE e.UserID = @param0
        `, [userId]);
        return result.recordset?.[0] ?? null;
    }

    /** Get employer + org IDs for update. */
    static async findEmployerIds(userId: string): Promise<{ EmployerID: string; OrganizationID: number } | null> {
        const result = await dbService.executeQuery(
            `SELECT e.EmployerID, e.OrganizationID FROM Employers e WHERE e.UserID = @param0`,
            [userId]
        );
        return result.recordset?.[0] ?? null;
    }

    /** Dynamic UPDATE on Employers. */
    static async updateEmployer(query: string, params: any[]): Promise<void> {
        await dbService.executeQuery(query, params);
    }

    /** Dynamic UPDATE on Organizations. */
    static async updateOrganization(query: string, params: any[]): Promise<void> {
        await dbService.executeQuery(query, params);
    }
}
