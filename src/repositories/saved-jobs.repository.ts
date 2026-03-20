/**
 * Saved Jobs Repository — Single source of truth for SavedJobs table queries.
 *
 * WHY THIS EXISTS:
 *  - Separates data-access (SQL) from business logic in saved-jobs.service.ts
 *  - Makes queries testable, reusable, and easy to optimise in one place
 *
 * RULES:
 *  1. Only this repository should write raw SavedJobs SQL.
 *  2. Services call repository methods — never dbService directly for this table.
 */

import { dbService } from '../services/database.service';

// ── Column sets ─────────────────────────────────────────────────

/** Standard job columns returned when fetching saved jobs */
const SAVED_JOB_SELECT = `
    j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
    j.OrganizationID, j.PostedByType, j.PostedByUserID,
    j.Location, j.City, j.State, j.Country, j.IsRemote,
    j.ExperienceMin, j.ExperienceMax,
    j.PublishedAt, j.CreatedAt, j.Status,
    o.Name as OrganizationName,
    ISNULL(o.LogoURL, '') as OrganizationLogo,
    (SELECT TOP 1 Value FROM ReferenceMetadata WITH (NOLOCK) WHERE ReferenceID = j.JobTypeID AND RefType = 'JobType') as JobTypeName,
    (SELECT TOP 1 Value FROM ReferenceMetadata WITH (NOLOCK) WHERE ReferenceID = j.WorkplaceTypeID AND RefType = 'WorkplaceType') as WorkplaceTypeName
`.replace(/\n/g, ' ');

// ── Repository ──────────────────────────────────────────────────

export class SavedJobsRepository {

    /**
     * Insert a saved-job row (idempotent) and return the job details.
     */
    static async insertAndReturn(jobId: string, applicantId: string): Promise<any | null> {
        const query = `
            IF NOT EXISTS (SELECT 1 FROM SavedJobs WITH (NOLOCK) WHERE JobID = @param0 AND ApplicantID = @param1)
            BEGIN
                INSERT INTO SavedJobs (JobID, ApplicantID) VALUES (@param0, @param1);
            END;

            SELECT ${SAVED_JOB_SELECT}
            FROM SavedJobs sj WITH (NOLOCK)
            INNER JOIN Jobs j WITH (NOLOCK) ON sj.JobID = j.JobID
            INNER JOIN Organizations o WITH (NOLOCK) ON j.OrganizationID = o.OrganizationID
            WHERE sj.JobID = @param0 AND sj.ApplicantID = @param1;
        `;
        const result = await dbService.executeQuery(query, [jobId, applicantId]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Delete a saved-job row.
     */
    static async delete(jobId: string, applicantId: string): Promise<void> {
        await dbService.executeQuery(
            'DELETE FROM SavedJobs WHERE JobID = @param0 AND ApplicantID = @param1',
            [jobId, applicantId]
        );
    }

    /**
     * Count total saved jobs for an applicant.
     */
    static async countByApplicant(applicantId: string): Promise<number> {
        const result = await dbService.executeQuery(
            'SELECT COUNT(*) as total FROM SavedJobs WITH (NOLOCK) WHERE ApplicantID = @param0',
            [applicantId]
        );
        return result.recordset?.[0]?.total || 0;
    }

    /**
     * Fetch a page of saved jobs for an applicant.
     */
    static async findByApplicant(
        applicantId: string,
        offset: number,
        pageSize: number
    ): Promise<any[]> {
        const query = `
            SELECT ${SAVED_JOB_SELECT}
            FROM SavedJobs sj WITH (NOLOCK)
            INNER JOIN Jobs j WITH (NOLOCK) ON sj.JobID = j.JobID
            INNER JOIN Organizations o WITH (NOLOCK) ON j.OrganizationID = o.OrganizationID
            WHERE sj.ApplicantID = @param0
            ORDER BY sj.SavedAt DESC
            OFFSET @param1 ROWS FETCH NEXT @param2 ROWS ONLY
        `;
        const result = await dbService.executeQuery(query, [applicantId, offset, pageSize]);
        return result.recordset || [];
    }
}
