/**
 * Job Repository — Single source of truth for Jobs table queries.
 *
 * WHY THIS EXISTS:
 *  - job.service.ts has ~22 SQL queries, many with complex dynamic building
 *  - This extracts standalone CRUD queries while leaving dynamic filter/scoring
 *    logic in the service (since that IS the business logic)
 *
 * NOTE: getJobs/searchJobs have deeply intertwined dynamic SQL + CTEs + scoring.
 *       Those queries stay in the service. This repo handles simpler operations.
 *
 * RULES:
 *  1. Simple CRUD and lookup queries go here.
 *  2. Dynamic filter builders stay in the service.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class JobRepository {

    // ═══════════════════════════════════════════════════════════
    //  LOOKUPS
    // ═══════════════════════════════════════════════════════════

    /** Get applicant personalization preferences for job scoring. */
    static async getApplicantPersonalization(userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT TOP 1
                a.PreferredJobTypes AS preferredJobTypes,
                a.PreferredWorkTypes AS preferredWorkTypes,
                a.PreferredLocations AS preferredLocations,
                a.PreferredCompanySize AS preferredCompanySize,
                ISNULL(a.TotalExperienceMonths, 0) AS totalExperienceMonths,
                a.GraduationYear AS graduationYear,
                CAST(a.PreferredRoles AS NVARCHAR(MAX)) AS preferredRoles,
                a.CurrentJobTitle AS currentJobTitle,
                (SELECT TOP 1 we.JobTitle FROM WorkExperiences we
                 WHERE we.ApplicantID = a.ApplicantID AND (we.IsActive = 1 OR we.IsActive IS NULL)
                 ORDER BY CASE WHEN we.EndDate IS NULL THEN 1 ELSE 0 END DESC, we.EndDate DESC, we.StartDate DESC
                ) AS latestJobTitle,
                (SELECT COUNT(*) FROM WorkExperiences we2 WHERE we2.ApplicantID = a.ApplicantID) AS workExperienceCount
            FROM Applicants a
            WHERE a.UserID = @param0
        `, [userId]);
        return result.recordset?.[0] ?? null;
    }

    /** Resolve WorkplaceTypeID from text value. */
    static async resolveWorkplaceTypeId(value: string): Promise<number | null> {
        const result = await dbService.executeQuery(
            `SELECT ReferenceID FROM ReferenceMetadata WHERE RefType = @param0 AND Value = @param1`,
            ['WorkplaceType', value]
        );
        return result.recordset?.[0]?.ReferenceID ?? null;
    }

    /** Get job by ID with full details. */
    static async findJobById(jobId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT j.*, jt.Value as JobTypeName,
                o.Name as OrganizationName, o.LogoURL as OrganizationLogo,
                o.LinkedInProfile as OrganizationLinkedIn, o.Website as OrganizationWebsite,
                o.Description as OrganizationDescription, o.IsFortune500 as OrganizationIsFortune500,
                ISNULL(o.Tier, 'Standard') as OrganizationTier, o.Industry as OrganizationIndustry,
                c.Symbol as CurrencySymbol,
                CASE
                    WHEN j.PostedByUserID IS NOT NULL AND j.PostedByType = 2 THEN 'Verified Referrer'
                    WHEN j.PostedByUserID IS NOT NULL THEN u.FirstName + ' ' + u.LastName
                    WHEN j.PostedByType = 0 THEN 'RefOpen Job Board'
                    ELSE 'External Recruiter'
                END as PostedByName
            FROM Jobs j
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
            LEFT JOIN Users u ON j.PostedByUserID = u.UserID
            LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
            WHERE j.JobID = @param0
        `, [jobId]);
        return result.recordset?.[0] ?? null;
    }

    // ═══════════════════════════════════════════════════════════
    //  MUTATIONS
    // ═══════════════════════════════════════════════════════════

    /** Insert a job with dynamic columns. Returns the inserted row with joins. */
    static async insertJob(fields: string[], values: any[]): Promise<any | null> {
        const placeholders = fields.map((_, i) => `@param${i}`);
        const query = `
            INSERT INTO Jobs (${fields.join(', ')}) VALUES (${placeholders.join(', ')});
            SELECT j.*, jt.Value as JobTypeName, o.Name as OrganizationName, ISNULL(o.Tier, 'Standard') as OrganizationTier
            FROM Jobs j
            INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            WHERE j.JobID = @param0;
        `;
        const result = await dbService.executeQuery(query, values);
        return result.recordset?.[0] ?? null;
    }

    /** Dynamic update on a job. */
    static async updateJob(jobId: string, updateFields: string, values: any[]): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Jobs SET ${updateFields}, UpdatedAt = GETUTCDATE() WHERE JobID = @param0`,
            [jobId, ...values]
        );
    }

    /** Publish a job (Draft → Published). */
    static async publishJob(jobId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Jobs SET Status = 'Published', PublishedAt = GETUTCDATE(), UpdatedAt = GETUTCDATE(),
                ExpiresAt = CASE WHEN ApplicationDeadline IS NOT NULL THEN ApplicationDeadline
                    ELSE DATEADD(DAY, 30, GETUTCDATE()) END
            WHERE JobID = @param0
        `, [jobId]);
    }

    /** Revert a published job back to Draft (on payment failure). */
    static async revertToDraft(jobId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Jobs SET Status = 'Draft', PublishedAt = NULL, ExpiresAt = NULL, UpdatedAt = GETUTCDATE()
            WHERE JobID = @param0
        `, [jobId]);
    }

    /** Close a job. */
    static async closeJob(jobId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Jobs SET Status = 'Closed', UpdatedAt = GETUTCDATE() WHERE JobID = @param0`,
            [jobId]
        );
    }

    /** Delete a job. */
    static async deleteJob(jobId: string): Promise<void> {
        await dbService.executeQuery(`DELETE FROM Jobs WHERE JobID = @param0`, [jobId]);
    }

    /** Count applications for a job (pre-delete check). */
    static async countApplications(jobId: string): Promise<number> {
        const result = await dbService.executeQuery(
            `SELECT COUNT(*) as count FROM JobApplications WHERE JobID = @param0`,
            [jobId]
        );
        return result.recordset?.[0]?.count || 0;
    }

    /** Check employer permission for a job's organization. */
    static async checkEmployerPermission(userId: string, organizationId: number): Promise<boolean> {
        const result = await dbService.executeQuery(
            `SELECT 1 FROM Employers e WHERE e.UserID = @param0 AND e.OrganizationID = @param1 AND 1 = 1`,
            [userId, organizationId]
        );
        return (result.recordset?.length ?? 0) > 0;
    }

    // ═══════════════════════════════════════════════════════════
    //  LISTS (org + user scoped)
    // ═══════════════════════════════════════════════════════════

    /** Count jobs by organization with dynamic filters. */
    static async countByOrganization(whereClause: string, params: any[]): Promise<number> {
        const result = await dbService.executeQuery(
            `SELECT COUNT(*) as total FROM Jobs j ${whereClause}`,
            params
        );
        return result.recordset?.[0]?.total || 0;
    }

    /** Dynamic query execution (for getJobs/searchJobs dynamic SQL). */
    static async executeQuery<T = any>(query: string, params: any[]): Promise<any[]> {
        const result = await dbService.executeQuery<T>(query, params);
        return result.recordset || [];
    }

    // ═══════════════════════════════════════════════════════════
    //  LOCATIONS (cached in service layer)
    // ═══════════════════════════════════════════════════════════

    /** Get distinct published job locations with counts. */
    static async getLocationCounts(): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT Location, COUNT(*) AS JobCount
            FROM Jobs
            WHERE Status = 'Published' AND Location IS NOT NULL AND Location != ''
            GROUP BY Location
            HAVING COUNT(*) >= 5
            ORDER BY COUNT(*) DESC
        `);
        return result.recordset || [];
    }
}
