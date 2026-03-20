/**
 * Work Experience Repository — Single source of truth for WorkExperiences table queries.
 *
 * WHY THIS EXISTS:
 *  - Separates data-access from validation/org-resolution/verification logic
 *    in work-experience.service.ts
 *  - ~20 SQL queries consolidated
 *
 * RULES:
 *  1. Only this repository should write raw WorkExperiences SQL.
 *  2. Services call repository methods — never dbService directly for this table.
 */

import { dbService } from '../services/database.service';

// ── Column sets ─────────────────────────────────────────────────

const WE_SELECT_WITH_ORG = `
    we.*, o.Name AS OrganizationName, o.LogoURL AS LogoURL
`.replace(/\n/g, ' ');

// ── Repository ──────────────────────────────────────────────────

export class WorkExperienceRepository {

    // ── Lookups ─────────────────────────────────────────────────

    /**
     * Get all work experiences for an applicant (with org name + logo).
     */
    static async findByApplicant(applicantId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT ${WE_SELECT_WITH_ORG}
            FROM WorkExperiences we
            LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
            WHERE we.ApplicantID = @param0 AND (we.IsActive = 1 OR we.IsActive IS NULL)
            ORDER BY 
                CASE WHEN we.EndDate IS NULL THEN 1 ELSE 0 END DESC,
                we.EndDate DESC, we.StartDate DESC
        `, [applicantId]);
        return result.recordset || [];
    }

    /**
     * Get a single work experience by ID (with org name + logo).
     */
    static async findById(workExperienceId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT ${WE_SELECT_WITH_ORG}
            FROM WorkExperiences we
            LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
            WHERE we.WorkExperienceID = @param0
        `, [workExperienceId]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Get current work experiences for an applicant (for debug/status endpoint).
     */
    static async findCurrentByApplicant(applicantId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT WorkExperienceID, JobTitle, CompanyName, StartDate, EndDate, IsCurrent,
                CASE WHEN OrganizationID IS NOT NULL THEN 
                    (SELECT Name FROM Organizations WHERE OrganizationID = we.OrganizationID)
                ELSE CompanyName END as ResolvedCompanyName
            FROM WorkExperiences we
            WHERE ApplicantID = @param0 AND IsCurrent = 1 AND (IsActive = 1 OR IsActive IS NULL)
            ORDER BY StartDate DESC
        `, [applicantId]);
        return result.recordset || [];
    }

    // ── Mutations ───────────────────────────────────────────────

    /**
     * Insert a new work experience (minimal core fields).
     */
    static async insert(params: {
        id: string;
        applicantId: string;
        organizationId: number | null;
        jobTitle: string;
        startDate: Date;
        endDate: Date | null;
        salaryFrequency: string | null;
        managerName: string | null;
        managerContact: string | null;
        canContact: number;
    }): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO WorkExperiences (
                WorkExperienceID, ApplicantID, OrganizationID, JobTitle,
                StartDate, EndDate, SalaryFrequency, ManagerName, ManagerContact,
                CanContact, VerificationStatus, CreatedAt, UpdatedAt, IsActive
            ) VALUES (
                @param0, @param1, @param2, @param3,
                @param4, @param5, @param6, @param7, @param8,
                @param9, 0, GETUTCDATE(), GETUTCDATE(), 1
            )
        `, [
            params.id, params.applicantId, params.organizationId, params.jobTitle,
            params.startDate, params.endDate, params.salaryFrequency,
            params.managerName, params.managerContact, params.canContact
        ]);
    }

    /**
     * Dynamic UPDATE on a work experience.
     */
    static async update(workExperienceId: string, updates: string[], params: any[]): Promise<void> {
        const query = `UPDATE WorkExperiences SET ${updates.join(', ')} WHERE WorkExperienceID = @param0`;
        await dbService.executeQuery(query, [workExperienceId, ...params.slice(1)]);
    }

    /**
     * Generic dynamic UPDATE (caller builds SET clause + full param array with @param0 = id).
     */
    static async dynamicUpdate(query: string, params: any[]): Promise<void> {
        await dbService.executeQuery(query, params);
    }

    /**
     * Hard delete a work experience.
     */
    static async deleteById(workExperienceId: string): Promise<void> {
        await dbService.executeQuery(
            `DELETE FROM WorkExperiences WHERE WorkExperienceID = @param0`,
            [workExperienceId]
        );
    }

    /**
     * Set a current work experience to not-current (for auto-transition).
     */
    static async markNotCurrent(workExperienceId: string, endDate: Date): Promise<void> {
        await dbService.executeQuery(`
            UPDATE WorkExperiences
            SET EndDate = @param1, IsCurrent = 0, UpdatedAt = GETUTCDATE()
            WHERE WorkExperienceID = @param0
        `, [workExperienceId, endDate]);
    }

    /**
     * Find current work experiences for an applicant (for auto-management).
     * Optionally exclude a specific ID.
     */
    static async findCurrentForManagement(applicantId: string, excludeId?: string): Promise<any[]> {
        let query = `
            SELECT WorkExperienceID, StartDate, JobTitle, OrganizationID, CompanyName
            FROM WorkExperiences 
            WHERE ApplicantID = @param0 AND IsCurrent = 1 AND (IsActive = 1 OR IsActive IS NULL)
        `;
        const params: any[] = [applicantId];
        if (excludeId) {
            query += ` AND WorkExperienceID != @param1`;
            params.push(excludeId);
        }
        const result = await dbService.executeQuery(query, params);
        return result.recordset || [];
    }

    // ── Applicant derived fields ────────────────────────────────

    /**
     * Update Applicants.Summary from work experience description.
     */
    static async updateApplicantSummary(applicantId: string, summary: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET Summary = @param1, UpdatedAt = GETUTCDATE() WHERE ApplicantID = @param0`,
            [applicantId, summary]
        );
    }

    /**
     * Get UserID from ApplicantID.
     */
    static async getUserIdByApplicant(applicantId: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT UserID FROM Applicants WHERE ApplicantID = @param0`,
            [applicantId]
        );
        return result.recordset?.[0]?.UserID ?? null;
    }

    /**
     * Check if a column exists on the Applicants table.
     */
    static async columnExistsOnApplicants(columnName: string): Promise<boolean> {
        const result = await dbService.executeQuery(
            `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Applicants' AND COLUMN_NAME = @param0`,
            [columnName]
        );
        return (result.recordset?.length ?? 0) > 0;
    }

    /**
     * Dynamic UPDATE on Applicants (for derived fields).
     */
    static async updateApplicantFields(applicantId: string, updates: string[], params: any[]): Promise<void> {
        const query = `UPDATE Applicants SET ${updates.join(', ')} WHERE ApplicantID = @param0`;
        await dbService.executeQuery(query, params);
    }

    /**
     * Fallback: just touch Applicants.UpdatedAt.
     */
    static async touchApplicant(applicantId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET UpdatedAt = GETUTCDATE() WHERE ApplicantID = @param0`,
            [applicantId]
        );
    }

    // ── Organization resolution ─────────────────────────────────

    /**
     * Find an organization by name.
     */
    static async findOrgByName(name: string): Promise<number | null> {
        const result = await dbService.executeQuery(
            `SELECT OrganizationID FROM Organizations WHERE Name = @param0`,
            [name]
        );
        return result.recordset?.[0]?.OrganizationID ?? null;
    }

    /**
     * Create a user-created organization. Returns the new OrganizationID.
     */
    static async createOrg(name: string): Promise<number | null> {
        const result = await dbService.executeQuery(`
            INSERT INTO Organizations (Name, IsUserCreated, CreatedAt, UpdatedAt, IsActive)
            VALUES (@param0, 1, GETUTCDATE(), GETUTCDATE(), 1);
            SELECT SCOPE_IDENTITY() AS OrganizationID;
        `, [name]);
        return result.recordset?.[0]?.OrganizationID
            ? parseInt(result.recordset[0].OrganizationID)
            : null;
    }

    /**
     * Get organization name by ID.
     */
    static async getOrgName(organizationId: number): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT Name FROM Organizations WHERE OrganizationID = @param0`,
            [organizationId]
        );
        return result.recordset?.[0]?.Name ?? null;
    }

    // ── Verification helpers ────────────────────────────────────

    /**
     * Count other verified work experiences for the same user + org (excluding one ID).
     */
    static async countOtherVerified(userId: string, orgId: number, excludeId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as OtherVerifiedCount
            FROM WorkExperiences we
            INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
            WHERE a.UserID = @param0 AND we.OrganizationID = @param1
                AND we.CompanyEmailVerified = 1 AND we.IsActive = 1
                AND we.WorkExperienceID != @param2
        `, [userId, orgId, excludeId]);
        return result.recordset?.[0]?.OtherVerifiedCount ?? 0;
    }

    /**
     * Decrement VerifiedReferrersCount on an organization.
     */
    static async decrementOrgVerifiedCount(orgId: number): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Organizations
            SET VerifiedReferrersCount = CASE 
                WHEN ISNULL(VerifiedReferrersCount, 0) > 0 THEN VerifiedReferrersCount - 1 ELSE 0 END,
                UpdatedAt = GETUTCDATE()
            WHERE OrganizationID = @param0
        `, [orgId]);
    }
}
