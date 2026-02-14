import { dbService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { PaginationParams } from '../types';

export class SavedJobsService {
  private static async ensureApplicant(userId: string): Promise<string> {
    const r = await dbService.executeQuery('SELECT ApplicantID FROM Applicants WHERE UserID = @param0', [userId]);
    if (r.recordset && r.recordset.length) return r.recordset[0].ApplicantID;

    const applicantId = AuthService.generateUniqueId();
    await dbService.executeQuery(`
      INSERT INTO Applicants (
        ApplicantID, UserID, ProfileCompleteness, IsOpenToWork,
        AllowRecruitersToContact, HideCurrentCompany, HideSalaryDetails,
        ImmediatelyAvailable, WillingToRelocate, IsFeatured,
        CreatedAt, UpdatedAt
      ) VALUES (
        @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0,
        GETUTCDATE(), GETUTCDATE()
      )
    `, [applicantId, userId]);
    return applicantId;
  }

  static async saveJob(userId: string, jobId: string) {
    const applicantId = await this.ensureApplicant(userId);
    const q = `
      IF NOT EXISTS (SELECT 1 FROM SavedJobs WITH (NOLOCK) WHERE JobID = @param0 AND ApplicantID = @param1)
      BEGIN
        INSERT INTO SavedJobs (JobID, ApplicantID) VALUES (@param0, @param1);
      END;

      SELECT 
        j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
        j.OrganizationID, j.PostedByType, j.PostedByUserID,
        j.Location, j.City, j.State, j.Country, j.IsRemote,
        j.ExperienceMin, j.ExperienceMax,
        j.PublishedAt, j.CreatedAt, j.Status,
        o.Name as OrganizationName, 
        ISNULL(o.LogoURL, '') as OrganizationLogo,
        (SELECT TOP 1 Value FROM ReferenceMetadata WITH (NOLOCK) WHERE ReferenceID = j.JobTypeID AND RefType = 'JobType') as JobTypeName,
        (SELECT TOP 1 Value FROM ReferenceMetadata WITH (NOLOCK) WHERE ReferenceID = j.WorkplaceTypeID AND RefType = 'WorkplaceType') as WorkplaceTypeName
      FROM SavedJobs sj WITH (NOLOCK)
      INNER JOIN Jobs j WITH (NOLOCK) ON sj.JobID = j.JobID
      INNER JOIN Organizations o WITH (NOLOCK) ON j.OrganizationID = o.OrganizationID
      WHERE sj.JobID = @param0 AND sj.ApplicantID = @param1;
    `;
    const res = await dbService.executeQuery(q, [jobId, applicantId]);
    return res.recordset?.[0] || null;
  }

  static async unsaveJob(userId: string, jobId: string) {
    const applicantId = await this.ensureApplicant(userId);
    await dbService.executeQuery('DELETE FROM SavedJobs WHERE JobID = @param0 AND ApplicantID = @param1', [jobId, applicantId]);
  }

  static async getMySavedJobs(userId: string, { page, pageSize }: PaginationParams) {
    const applicantId = await this.ensureApplicant(userId);
    const countRes = await dbService.executeQuery('SELECT COUNT(*) as total FROM SavedJobs WITH (NOLOCK) WHERE ApplicantID = @param0', [applicantId]);
    const total = countRes.recordset?.[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    if (total === 0) return { jobs: [], total: 0, totalPages: 1 };

    const offset = (page - 1) * pageSize;
    // Optimized query: use inline subqueries for ReferenceMetadata to avoid slow JOINs
    const q = `
      SELECT 
        j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
        j.OrganizationID, j.PostedByType, j.PostedByUserID,
        j.Location, j.City, j.State, j.Country, j.IsRemote,
        j.ExperienceMin, j.ExperienceMax,
        j.PublishedAt, j.CreatedAt, j.Status,
        o.Name as OrganizationName, 
        ISNULL(o.LogoURL, '') as OrganizationLogo,
        (SELECT TOP 1 Value FROM ReferenceMetadata WITH (NOLOCK) WHERE ReferenceID = j.JobTypeID AND RefType = 'JobType') as JobTypeName,
        (SELECT TOP 1 Value FROM ReferenceMetadata WITH (NOLOCK) WHERE ReferenceID = j.WorkplaceTypeID AND RefType = 'WorkplaceType') as WorkplaceTypeName
      FROM SavedJobs sj WITH (NOLOCK)
      INNER JOIN Jobs j WITH (NOLOCK) ON sj.JobID = j.JobID
      INNER JOIN Organizations o WITH (NOLOCK) ON j.OrganizationID = o.OrganizationID
      WHERE sj.ApplicantID = @param0
      ORDER BY sj.SavedAt DESC
      OFFSET @param1 ROWS FETCH NEXT @param2 ROWS ONLY
    `;
    const res = await dbService.executeQuery(q, [applicantId, offset, pageSize]);
    return { jobs: res.recordset || [], total, totalPages };
  }
}
