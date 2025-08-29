import { dbService } from './database.service';
import { AuthService } from './auth.service';
import { ValidationError, NotFoundError } from '../utils/validation';

export interface WorkExperienceInput {
  jobTitle: string;
  organizationId?: number | null;
  companyName?: string | null | string[];
  department?: string | null;
  employmentType?: string | null;
  startDate: string | Date;
  endDate?: string | Date | null;
  isCurrent?: boolean | 0 | 1 | null;
  location?: string | null;
  country?: string | null;
  description?: string | null;
  skills?: string | string[] | null;
  achievements?: string | null;
  reasonForLeaving?: string | null;
  salary?: number | string | null;
  currencyId?: number | string | null;
  salaryFrequency?: string | null;
  managerName?: string | null;
  managerContact?: string | null;
  canContact?: boolean | 0 | 1 | null;
}

export class WorkExperienceService {
  static async getWorkExperiencesByApplicant(applicantId: string): Promise<any[]> {
    const query = `
            SELECT 
                we.*, 
                o.Name AS OrganizationName
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
                o.Name AS OrganizationName
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
    const organizationId = await this.resolveOrganizationId(data.organizationId ?? null, data.companyName ?? null);

    const id = AuthService.generateUniqueId();
    const startDate = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
    const endDate = data.endDate ? (typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate) : null;
    const canContact = data.canContact ? (data.canContact === true || data.canContact === 1 ? 1 : 0) : 0;

    // Minimal insert first
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

    // Optional extended fields update (idempotent)
    const extendedUpdates: string[] = [];
    const params: any[] = [id];
    let idx = 1;

    const push = (col: string, val: any, transform?: (v: any) => any) => {
      if (val !== undefined) {
        extendedUpdates.push(`${col} = @param${idx}`);
        params.push(transform ? transform(val) : val);
        idx++;
      }
    };

    push('CompanyName', data.companyName ?? null, (v) => (v ? String(v) : null));
    push('Department', data.department ?? null);
    push('EmploymentType', data.employmentType ?? null);
    push('IsCurrent', data.isCurrent ?? null, (v) => (v === true || v === 1 ? 1 : 0));
    push('Location', data.location ?? null);
    push('Country', data.country ?? null);
    push('Description', data.description ?? null);
    push('Skills', data.skills ?? null, (v) => (Array.isArray(v) ? v.join(', ') : v));
    push('Achievements', data.achievements ?? null);
    push('ReasonForLeaving', data.reasonForLeaving ?? null);
    push('Salary', data.salary ?? null, (v) => (v === '' ? null : v));
    push('CurrencyID', (data as any).currencyId ?? (data as any).currencyID ?? null, (v) => (v ? parseInt(v, 10) : null));

    if (extendedUpdates.length > 0) {
      extendedUpdates.push('UpdatedAt = GETUTCDATE()');
      const updateQuery = `UPDATE WorkExperiences SET ${extendedUpdates.join(', ')} WHERE WorkExperienceID = @param0`;
      await dbService.executeQuery(updateQuery, params);
    }

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
      const orgId = await this.resolveOrganizationId(data.organizationId ?? null, data.companyName ?? null);
      updates.push(`OrganizationID = @param${idx}`);
      params.push(orgId);
      idx++;
    }

    if (data.companyName !== undefined) { updates.push(`CompanyName = @param${idx}`); params.push(data.companyName || null); idx++; }
    if (data.department !== undefined) { updates.push(`Department = @param${idx}`); params.push(data.department || null); idx++; }
    if (data.employmentType !== undefined) { updates.push(`EmploymentType = @param${idx}`); params.push(data.employmentType || null); idx++; }
    if (data.isCurrent !== undefined) { updates.push(`IsCurrent = @param${idx}`); params.push((data.isCurrent === true || data.isCurrent === 1) ? 1 : 0); idx++; }
    if (data.location !== undefined) { updates.push(`Location = @param${idx}`); params.push(data.location || null); idx++; }
    if (data.country !== undefined) { updates.push(`Country = @param${idx}`); params.push(data.country || null); idx++; }

    if (data.jobTitle !== undefined) { updates.push(`JobTitle = @param${idx}`); params.push(data.jobTitle || null); idx++; }
    if (data.startDate !== undefined) {
      const startDate = data.startDate ? (typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate) : null;
      updates.push(`StartDate = @param${idx}`); params.push(startDate); idx++;
    }
    if (data.endDate !== undefined) {
      const endDate = data.endDate ? (typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate) : null;
      updates.push(`EndDate = @param${idx}`); params.push(endDate); idx++;
    }

    if (data.description !== undefined) { updates.push(`Description = @param${idx}`); params.push(data.description || null); idx++; }
    if (data.skills !== undefined) { updates.push(`Skills = @param${idx}`); params.push(Array.isArray(data.skills) ? data.skills.join(', ') : data.skills || null); idx++; }
    if (data.achievements !== undefined) { updates.push(`Achievements = @param${idx}`); params.push(data.achievements || null); idx++; }
    if (data.reasonForLeaving !== undefined) { updates.push(`ReasonForLeaving = @param${idx}`); params.push(data.reasonForLeaving || null); idx++; }
    if (data.salary !== undefined) { updates.push(`Salary = @param${idx}`); params.push((data.salary as any) === '' ? null : data.salary); idx++; }
    if ((data as any).currencyId !== undefined || (data as any).currencyID !== undefined) { updates.push(`CurrencyID = @param${idx}`); params.push((data as any).currencyId ? parseInt((data as any).currencyId as any, 10) : ((data as any).currencyID ? parseInt((data as any).currencyID as any, 10) : null)); idx++; }

    if (data.salaryFrequency !== undefined) { updates.push(`SalaryFrequency = @param${idx}`); params.push(data.salaryFrequency || null); idx++; }
    if (data.managerName !== undefined) { updates.push(`ManagerName = @param${idx}`); params.push(data.managerName || null); idx++; }
    if (data.managerContact !== undefined) { updates.push(`ManagerContact = @param${idx}`); params.push(data.managerContact || null); idx++; }
    if (data.canContact !== undefined) {
      const canContact = data.canContact === true || data.canContact === 1 ? 1 : 0;
      updates.push(`CanContact = @param${idx}`); params.push(canContact); idx++;
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields provided to update');
    }
    updates.push('UpdatedAt = GETUTCDATE()');
    const query = `
            UPDATE WorkExperiences SET ${updates.join(', ')} WHERE WorkExperienceID = @param0
        `;
    await dbService.executeQuery(query, params);

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

  static async resolveOrganizationId(explicitId: number | null, companyName?: string | null | string[]): Promise<number | null> {
    if (explicitId && Number.isInteger(explicitId)) return explicitId;

    // Normalize companyName to a plain string (handle arrays or non-strings)
    let name: string | null = null;
    if (Array.isArray(companyName)) {
      const found = [...companyName].reverse().find(v => typeof v === 'string' && v.trim().length > 0);
      name = found ? found.trim() : null;
    } else if (typeof companyName === 'string') {
      name = companyName.trim();
    } else {
      name = null;
    }

    if (!name) return null;

    // Try to find by name
    let result = await dbService.executeQuery('SELECT OrganizationID FROM Organizations WHERE Name = @param0', [name]);
    if (result.recordset && result.recordset.length > 0) {
      return result.recordset[0].OrganizationID;
    }
    // Create minimal organization row (uses IDENTITY int key)
    const insertQuery = `
            INSERT INTO Organizations (Name, CreatedAt, UpdatedAt, IsActive)
            VALUES (@param0, GETUTCDATE(), GETUTCDATE(), 1);
            SELECT SCOPE_IDENTITY() AS OrganizationID;
        `;
    result = await dbService.executeQuery(insertQuery, [name]);
    const orgId = result.recordset && result.recordset.length > 0 ? parseInt(result.recordset[0].OrganizationID) : null;
    return orgId;
  }

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
        currentCompanyName = orgRes.recordset && orgRes.recordset[0]
          ? orgRes.recordset[0].Name
          : null;
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
