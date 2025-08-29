import { dbService } from './database.service';
import { AuthService } from './auth.service';
import { ValidationError, NotFoundError } from '../utils/validation';

export interface WorkExperienceInput {
    organizationId?: number | null;
    companyName?: string; // used to resolve/create organization
    jobTitle: string;
    startDate: Date | string;
    endDate?: Date | string | null;
    salaryFrequency?: string | null;
    managerName?: string | null;
    managerContact?: string | null;
    canContact?: boolean | number | null;
}

export class WorkExperienceService {
    static async getWorkExperiencesByApplicant(applicantId: string): Promise<any[]> {
        const query = `
            SELECT 
                we.*, 
                o.Name AS CompanyName
            FROM WorkExperiences we
            LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
            WHERE we.ApplicantID = @param0 AND (we.IsActive = 1 OR we.IsActive IS NULL)
            ORDER BY 
                CASE WHEN we.EndDate IS NULL THEN 1 ELSE 0 END DESC,
                we.EndDate DESC,
                we.StartDate DESC`;
        const result = await dbService.executeQuery(query, [applicantId]);
        return result.recordset || [];
    }

    static async getWorkExperienceById(workExperienceId: string): Promise<any | null> {
        const query = `
            SELECT 
                we.*, 
                o.Name AS CompanyName
            FROM WorkExperiences we
            LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
            WHERE we.WorkExperienceID = @param0`;
        const result = await dbService.executeQuery(query, [workExperienceId]);
        return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
    }

    static async createWorkExperience(applicantId: string, data: WorkExperienceInput): Promise<any> {
        if (!data.jobTitle || !data.startDate) {
            throw new ValidationError('Job title and start date are required');
        }

        // Resolve or create organization
        const organizationId = await this.resolveOrganizationId(data.organizationId, data.companyName);

        const id = AuthService.generateUniqueId();
        const startDate = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
        const endDate = data.endDate ? (typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate) : null;
        const canContact = data.canContact ? (data.canContact === true || data.canContact === 1 ? 1 : 0) : 0;

        const insertQuery = `
            INSERT INTO WorkExperiences (
                WorkExperienceID, ApplicantID, OrganizationID, JobTitle, 
                StartDate, EndDate, SalaryFrequency, ManagerName, ManagerContact,
                CanContact, VerificationStatus, CreatedAt, UpdatedAt, IsActive
            ) VALUES (
                @param0, @param1, @param2, @param3,
                @param4, @param5, @param6, @param7, @param8,
                @param9, 0, GETUTCDATE(), GETUTCDATE(), 1
            );
        `;

        await dbService.executeQuery(insertQuery, [
            id,
            applicantId,
            organizationId,
            data.jobTitle,
            startDate,
            endDate,
            data.salaryFrequency || null,
            data.managerName || null,
            data.managerContact || null,
            canContact
        ]);

        // Update derived fields on Applicants
        await this.updateApplicantDerivedFields(applicantId);

        return await this.getWorkExperienceById(id);
    }

    static async updateWorkExperience(workExperienceId: string, data: Partial<WorkExperienceInput>): Promise<any> {
        const existing = await this.getWorkExperienceById(workExperienceId);
        if (!existing) throw new NotFoundError('Work experience not found');

        const updates: string[] = [];
        const params: any[] = [workExperienceId];
        let idx = 1;

        if (data.organizationId !== undefined || data.companyName) {
            const orgId = await this.resolveOrganizationId(data.organizationId ?? null, data.companyName);
            updates.push(`OrganizationID = @param${idx}`);
            params.push(orgId);
            idx++;
        }

        if (data.jobTitle !== undefined) {
            updates.push(`JobTitle = @param${idx}`);
            params.push(data.jobTitle || null);
            idx++;
        }
        if (data.startDate !== undefined) {
            const startDate = data.startDate ? (typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate) : null;
            updates.push(`StartDate = @param${idx}`);
            params.push(startDate);
            idx++;
        }
        if (data.endDate !== undefined) {
            const endDate = data.endDate ? (typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate) : null;
            updates.push(`EndDate = @param${idx}`);
            params.push(endDate);
            idx++;
        }
        if (data.salaryFrequency !== undefined) {
            updates.push(`SalaryFrequency = @param${idx}`);
            params.push(data.salaryFrequency || null);
            idx++;
        }
        if (data.managerName !== undefined) {
            updates.push(`ManagerName = @param${idx}`);
            params.push(data.managerName || null);
            idx++;
        }
        if (data.managerContact !== undefined) {
            updates.push(`ManagerContact = @param${idx}`);
            params.push(data.managerContact || null);
            idx++;
        }
        if (data.canContact !== undefined) {
            const canContact = data.canContact === true || data.canContact === 1 ? 1 : 0;
            updates.push(`CanContact = @param${idx}`);
            params.push(canContact);
            idx++;
        }

        if (updates.length === 0) {
            throw new ValidationError('No fields provided to update');
        }

        updates.push('UpdatedAt = GETUTCDATE()');
        const query = `
            UPDATE WorkExperiences SET ${updates.join(', ')} WHERE WorkExperienceID = @param0
        `;
        await dbService.executeQuery(query, params);

        // Update derived fields for the related applicant
        await this.updateApplicantDerivedFields(existing.ApplicantID);

        return await this.getWorkExperienceById(workExperienceId);
    }

    static async deleteWorkExperience(workExperienceId: string): Promise<void> {
        const existing = await this.getWorkExperienceById(workExperienceId);
        if (!existing) throw new NotFoundError('Work experience not found');

        const query = `
            UPDATE WorkExperiences SET IsActive = 0, UpdatedAt = GETUTCDATE() WHERE WorkExperienceID = @param0
        `;
        await dbService.executeQuery(query, [workExperienceId]);

        await this.updateApplicantDerivedFields(existing.ApplicantID);
    }

    private static async resolveOrganizationId(explicitId?: number | null, companyName?: string): Promise<number | null> {
        if (explicitId && Number.isInteger(explicitId)) return explicitId;
        if (!companyName || !companyName.trim()) return null;

        // Try to find by name
        let result = await dbService.executeQuery(
            'SELECT OrganizationID FROM Organizations WHERE Name = @param0',
            [companyName.trim()]
        );
        if (result.recordset && result.recordset.length > 0) {
            return result.recordset[0].OrganizationID as number;
        }

        // Create minimal organization row (uses IDENTITY int key)
        const insertQuery = `
            INSERT INTO Organizations (Name, CreatedAt, UpdatedAt, IsActive)
            VALUES (@param0, GETUTCDATE(), GETUTCDATE(), 1);
            SELECT SCOPE_IDENTITY() AS OrganizationID;
        `;
        result = await dbService.executeQuery(insertQuery, [companyName.trim()]);
        const orgId = result.recordset && result.recordset.length > 0 ? parseInt(result.recordset[0].OrganizationID) : null;
        return orgId;
    }

    // Update derived fields on Applicants based on WorkExperiences
    static async updateApplicantDerivedFields(applicantId: string): Promise<void> {
        // Compute current/latest job and total experience months
        const experiences = await this.getWorkExperiencesByApplicant(applicantId);

        let currentJobTitle: string | null = null;
        let currentOrganizationId: number | null = null;
        let currentCompanyName: string | null = null;
        let totalMonths = 0;

        if (experiences.length > 0) {
            const latest = experiences[0];
            currentJobTitle = latest.JobTitle || null;
            currentOrganizationId = latest.OrganizationID || null;

            if (currentOrganizationId) {
                const orgRes = await dbService.executeQuery(
                    'SELECT Name FROM Organizations WHERE OrganizationID = @param0',
                    [currentOrganizationId]
                );
                currentCompanyName = orgRes.recordset && orgRes.recordset[0] ? orgRes.recordset[0].Name : null;
            }

            const now = new Date();
            for (const exp of experiences) {
                const start = new Date(exp.StartDate);
                const end = exp.EndDate ? new Date(exp.EndDate) : now;
                const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                totalMonths += Math.max(0, months);
            }
        }

        // Helper to check if a column exists on Applicants table
        const columnExists = async (columnName: string): Promise<boolean> => {
            const result = await dbService.executeQuery(
                `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Applicants' AND COLUMN_NAME = @param0`,
                [columnName]
            );
            return !!(result.recordset && result.recordset.length > 0);
        };

        // Build update dynamically based on schema
        const updateFields: string[] = [];
        const params: any[] = [applicantId];
        let idx = 1;

        try {
            if (await columnExists('TotalExperienceMonths')) {
                updateFields.push(`TotalExperienceMonths = @param${idx}`);
                params.push(totalMonths);
                idx++;
            }
            if (await columnExists('CurrentJobTitle')) {
                updateFields.push(`CurrentJobTitle = @param${idx}`);
                params.push(currentJobTitle);
                idx++;
            }
            if (await columnExists('CurrentOrganizationID')) {
                updateFields.push(`CurrentOrganizationID = @param${idx}`);
                params.push(currentOrganizationId);
                idx++;
            }
            if (await columnExists('CurrentCompanyName')) {
                updateFields.push(`CurrentCompanyName = @param${idx}`);
                params.push(currentCompanyName);
                idx++;
            }

            // Always set UpdatedAt
            updateFields.push(`UpdatedAt = GETUTCDATE()`);

            const query = `
                UPDATE Applicants
                SET ${updateFields.join(', ')}
                WHERE ApplicantID = @param0
            `;

            await dbService.executeQuery(query, params);
        } catch (err) {
            // Fallback: Just touch UpdatedAt to avoid hard failure if schema differs
            await dbService.executeQuery(
                `UPDATE Applicants SET UpdatedAt = GETUTCDATE() WHERE ApplicantID = @param0`,
                [applicantId]
            );
        }
    }
}
