/**
 * Career Service — Lightweight service for RefOpen's own career page
 * Separate from the main job marketplace (Jobs table).
 * Uses CareerJobs + CareerApplications tables.
 */

import { dbService } from './database.service';

export class CareerService {

  /**
   * Get published career jobs with pagination
   * Public — no auth required
   */
  static async getCareerJobs(page: number = 1, pageSize: number = 20): Promise<{ jobs: any[]; total: number; hasMore: boolean }> {
    const offset = (Math.max(page, 1) - 1) * pageSize;

    const countResult = await dbService.executeQuery(
      `SELECT COUNT(*) as total FROM CareerJobs WHERE Status = 'Published' AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE())`,
      []
    );
    const total = countResult.recordset[0]?.total || 0;

    const result = await dbService.executeQuery(
      `SELECT CareerJobID, Title, Department, Location, WorkplaceType, JobType,
              Description, Requirements, Responsibilities,
              ExperienceMin, ExperienceMax, SalaryMin, SalaryMax, Currency,
              Skills, PublishedAt
       FROM CareerJobs
       WHERE Status = 'Published' AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE())
       ORDER BY PublishedAt DESC
       OFFSET @param0 ROWS FETCH NEXT @param1 ROWS ONLY`,
      [offset, pageSize]
    );

    return {
      jobs: result.recordset || [],
      total,
      hasMore: offset + pageSize < total,
    };
  }

  /**
   * Get a single career job by ID
   * Public — no auth required
   */
  static async getCareerJobById(jobId: string): Promise<any> {
    const result = await dbService.executeQuery(
      `SELECT CareerJobID, Title, Department, Location, WorkplaceType, JobType,
              Description, Requirements, Responsibilities,
              ExperienceMin, ExperienceMax, SalaryMin, SalaryMax, Currency,
              Skills, PublishedAt
       FROM CareerJobs
       WHERE CareerJobID = @param0 AND Status = 'Published' AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE())`,
      [jobId]
    );
    return result.recordset[0] || null;
  }

  /**
   * Apply to a career job
   * Auth required — userId from JWT
   */
  static async applyToCareerJob(data: {
    careerJobId: string;
    userId: string;
    fullName: string;
    email: string;
    phone?: string;
    resumeURL: string;
    coverLetter?: string;
    linkedInURL?: string;
  }): Promise<any> {
    // Check job exists and is published
    const job = await this.getCareerJobById(data.careerJobId);
    if (!job) {
      throw Object.assign(new Error('Career job not found or no longer accepting applications'), { name: 'NotFoundError' });
    }

    // Check duplicate
    const existing = await dbService.executeQuery(
      `SELECT ApplicationID FROM CareerApplications WHERE CareerJobID = @param0 AND UserID = @param1`,
      [data.careerJobId, data.userId]
    );
    if (existing.recordset?.length > 0) {
      throw Object.assign(new Error('You have already applied to this position'), { name: 'ConflictError' });
    }

    // Insert application
    const result = await dbService.executeQuery(
      `INSERT INTO CareerApplications (CareerJobID, UserID, FullName, Email, Phone, ResumeURL, CoverLetter, LinkedInURL, Status)
       OUTPUT INSERTED.ApplicationID, INSERTED.AppliedAt, INSERTED.Status
       VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6, @param7, 'Submitted')`,
      [data.careerJobId, data.userId, data.fullName, data.email, data.phone || null, data.resumeURL, data.coverLetter || null, data.linkedInURL || null]
    );

    return result.recordset[0];
  }

  /**
   * Check if a user has already applied to a career job
   */
  static async hasApplied(careerJobId: string, userId: string): Promise<boolean> {
    const result = await dbService.executeQuery(
      `SELECT 1 FROM CareerApplications WHERE CareerJobID = @param0 AND UserID = @param1`,
      [careerJobId, userId]
    );
    return (result.recordset?.length || 0) > 0;
  }

  /**
   * Get user's career applications
   */
  static async getUserApplications(userId: string): Promise<any[]> {
    const result = await dbService.executeQuery(
      `SELECT ca.ApplicationID, ca.CareerJobID, ca.Status, ca.AppliedAt,
              cj.Title, cj.Department, cj.Location, cj.JobType
       FROM CareerApplications ca
       INNER JOIN CareerJobs cj ON ca.CareerJobID = cj.CareerJobID
       WHERE ca.UserID = @param0
       ORDER BY ca.AppliedAt DESC`,
      [userId]
    );
    return result.recordset || [];
  }

  /**
   * [ADMIN] Get all career applications with user and job info
   */
  static async getAllCareerApplications(page: number = 1, pageSize: number = 50, status?: string): Promise<{ applications: any[]; total: number; hasMore: boolean }> {
    const offset = (Math.max(page, 1) - 1) * pageSize;
    const hasStatusFilter = status && status !== 'All';
    const countStatusFilter = hasStatusFilter ? `WHERE ca.Status = @param0` : '';
    const mainStatusFilter = hasStatusFilter ? `WHERE ca.Status = @param2` : '';

    const countResult = await dbService.executeQuery(
      `SELECT COUNT(*) as total FROM CareerApplications ca ${countStatusFilter}`,
      hasStatusFilter ? [status] : []
    );
    const total = countResult.recordset[0]?.total || 0;

    const mainParams: any[] = [offset, pageSize];
    if (hasStatusFilter) mainParams.push(status);

    const result = await dbService.executeQuery(
      `SELECT ca.ApplicationID, ca.CareerJobID, ca.UserID, ca.FullName, ca.Email, ca.Phone,
              ca.ResumeURL, ca.CoverLetter, ca.LinkedInURL, ca.Status, ca.AppliedAt,
              ca.ReviewedAt, ca.ReviewNotes,
              cj.Title AS JobTitle, cj.Department, cj.Location, cj.JobType,
              u.FirstName, u.LastName, u.ProfilePictureURL
       FROM CareerApplications ca
       INNER JOIN CareerJobs cj ON ca.CareerJobID = cj.CareerJobID
       LEFT JOIN Users u ON ca.UserID = u.UserID
       ${mainStatusFilter}
       ORDER BY ca.AppliedAt DESC
       OFFSET @param0 ROWS FETCH NEXT @param1 ROWS ONLY`,
      mainParams
    );

    return {
      applications: result.recordset || [],
      total,
      hasMore: offset + pageSize < total,
    };
  }

  /**
   * [ADMIN] Update application status + review notes
   */
  static async updateApplicationStatus(applicationId: string, status: string, reviewNotes?: string): Promise<any> {
    const ALLOWED_STATUSES = ['Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'On Hold', 'Rejected'];
    if (!ALLOWED_STATUSES.includes(status)) {
      throw Object.assign(new Error(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`), { name: 'ValidationError' });
    }
    const result = await dbService.executeQuery(
      `UPDATE CareerApplications
       SET Status = @param1, ReviewedAt = SYSDATETIMEOFFSET(), ReviewNotes = @param2
       OUTPUT INSERTED.ApplicationID, INSERTED.Status, INSERTED.ReviewedAt
       WHERE ApplicationID = @param0`,
      [applicationId, status, reviewNotes || null]
    );
    if (!result.recordset?.length) {
      throw Object.assign(new Error('Application not found'), { name: 'NotFoundError' });
    }
    return result.recordset[0];
  }
}
