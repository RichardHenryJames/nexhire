/**
 * Job Application Repository — Single source of truth for JobApplications,
 * ApplicationTracking, and ApplicationStatuses table queries.
 *
 * WHY THIS EXISTS:
 *  - Separates data-access from validation/resume-resolution logic
 *    in job-application.service.ts
 *  - ~20 SQL queries consolidated
 *
 * RULES:
 *  1. Only this repository should write raw SQL for these tables.
 *  2. Services call repository methods — never dbService directly.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class JobApplicationRepository {

    // ── Job lookups ─────────────────────────────────────────────

    /** Check if a job exists and is available for applications. */
    static async findJobForApplication(jobId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT JobID, Status, ApplicationDeadline, MaxApplications, CurrentApplications
            FROM Jobs WHERE JobID = @param0 AND Status IN ('Published', 'Draft')
        `, [jobId]);
        return result.recordset?.[0] ?? null;
    }

    // ── Application lookups ─────────────────────────────────────

    /** Check for existing application by job + applicant. */
    static async findExisting(jobId: string, applicantId: string): Promise<{ ApplicationID: string; StatusID: number } | null> {
        const result = await dbService.executeQuery(`
            SELECT ApplicationID, StatusID FROM JobApplications
            WHERE JobID = @param0 AND ApplicantID = @param1
        `, [jobId, applicantId]);
        return result.recordset?.[0] ?? null;
    }

    /** Find resume by applicant + URL. */
    static async findResumeByUrl(applicantId: string, resumeUrl: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT ResumeID FROM ApplicantResumes WHERE ApplicantID = @param0 AND ResumeURL = @param1`,
            [applicantId, resumeUrl]
        );
        return result.recordset?.[0]?.ResumeID ?? null;
    }

    /** Find primary resume for an applicant. */
    static async findPrimaryResume(applicantId: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            `SELECT ResumeID FROM ApplicantResumes WHERE ApplicantID = @param0 AND IsPrimary = 1`,
            [applicantId]
        );
        return result.recordset?.[0]?.ResumeID ?? null;
    }

    // ── Application mutations ───────────────────────────────────

    /** Revive a withdrawn application (StatusID 6 → 1). Returns the updated row with joins. */
    static async reviveApplication(params: any[]): Promise<any | null> {
        const result = await dbService.executeQuery(`
            UPDATE JobApplications
            SET ResumeID = @param3, CoverLetter = @param4, ExpectedSalary = @param5,
                ExpectedCurrencyID = @param6, AvailableFromDate = @param7,
                StatusID = 1, SubmittedAt = GETUTCDATE(), LastUpdatedAt = GETUTCDATE()
            WHERE ApplicationID = @param0 AND JobID = @param1 AND ApplicantID = @param2;
            SELECT ja.*, j.Title as JobTitle, o.Name as CompanyName, aps.Status as StatusName
            FROM JobApplications ja
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
            WHERE ja.ApplicationID = @param0;
        `, params);
        return result.recordset?.[0] ?? null;
    }

    /** Insert a new application. */
    static async insertApplication(params: any[]): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO JobApplications (
                ApplicationID, JobID, ApplicantID, ResumeID, CoverLetter,
                ExpectedSalary, ExpectedCurrencyID, AvailableFromDate, StatusID,
                SubmittedAt, LastUpdatedAt
            ) VALUES (
                @param0, @param1, @param2, @param3, @param4,
                @param5, @param6, @param7, 1,
                GETUTCDATE(), GETUTCDATE()
            )
        `, params);
    }

    /** Increment CurrentApplications on a job. */
    static async incrementJobApplications(jobId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE Jobs SET CurrentApplications = ISNULL(CurrentApplications, 0) + 1, UpdatedAt = GETUTCDATE()
            WHERE JobID = @param0
        `, [jobId]);
    }

    /** Remove from SavedJobs after applying. */
    static async removeSavedJob(jobId: string, applicantId: string): Promise<void> {
        await dbService.executeQuery(
            `DELETE FROM SavedJobs WHERE JobID = @param0 AND ApplicantID = @param1`,
            [jobId, applicantId]
        );
    }

    /** Fetch a newly-created application with joins. */
    static async findApplicationWithJoins(applicationId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT ja.*, j.Title as JobTitle, o.Name as CompanyName, aps.Status as StatusName
            FROM JobApplications ja
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
            WHERE ja.ApplicationID = @param0
        `, [applicationId]);
        return result.recordset?.[0] ?? null;
    }

    // ── Application lists ───────────────────────────────────────

    /** Get applications for a user (last 14 days, non-withdrawn). */
    static async findByUser(userId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT ja.ApplicationID, ja.JobID, ja.ApplicantID, ja.StatusID,
                ja.SubmittedAt, ja.LastUpdatedAt, ja.ExpectedSalary, ja.CoverLetter, ja.AvailableFromDate,
                j.Title as JobTitle, j.JobTypeID,
                jt.Value as JobTypeName, o.Name as CompanyName,
                o.LogoURL as OrganizationLogo, o.Website as OrganizationWebsite,
                o.LinkedInProfile as OrganizationLinkedIn,
                c.Code as CurrencyCode, aps.Status as StatusName
            FROM JobApplications ja
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
            LEFT JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
            LEFT JOIN Currencies c ON ja.ExpectedCurrencyID = c.CurrencyID
            WHERE a.UserID = @param0 AND ja.StatusID != 6
                AND ja.SubmittedAt >= DATEADD(day, -14, GETUTCDATE())
            ORDER BY ja.SubmittedAt DESC
        `, [userId]);
        return result.recordset || [];
    }

    /** Verify employer has access to a job. */
    static async verifyEmployerAccess(jobId: string, employerUserId: string): Promise<boolean> {
        const result = await dbService.executeQuery(`
            SELECT j.JobID FROM Jobs j
            LEFT JOIN Employers e ON j.OrganizationID = e.OrganizationID
            WHERE j.JobID = @param0 AND (j.PostedByUserID = @param1 OR (e.UserID = @param1 AND e.CanManageApplications = 1))
        `, [jobId, employerUserId]);
        return (result.recordset?.length ?? 0) > 0;
    }

    /** Count applications for a job with optional status filter. */
    static async countByJob(jobId: string, statusFilter?: number): Promise<number> {
        let query = 'SELECT COUNT(*) as total FROM JobApplications ja WHERE ja.JobID = @param0';
        const params: any[] = [jobId];
        if (statusFilter && statusFilter > 0) {
            query += ' AND ja.StatusID = @param1';
            params.push(statusFilter);
        }
        const result = await dbService.executeQuery(query, params);
        return result.recordset?.[0]?.total || 0;
    }

    /** Get paginated applications for a job (employer view). */
    static async findByJob(jobId: string, offset: number, pageSize: number, sortColumn: string, sortOrder: string, statusFilter?: number): Promise<any[]> {
        let where = 'WHERE ja.JobID = @param0';
        const params: any[] = [jobId];
        let idx = 1;
        if (statusFilter && statusFilter > 0) {
            where += ` AND ja.StatusID = @param${idx}`;
            params.push(statusFilter);
            idx++;
        }
        const result = await dbService.executeQuery(`
            SELECT ja.*,
                ISNULL(u.FirstName + ' ' + u.LastName, 'Unknown Applicant') as ApplicantName,
                ISNULL(u.Email, '') as ApplicantEmail,
                ISNULL(a.Headline, '') as Headline,
                ISNULL(a.CurrentJobTitle, '') as CurrentJobTitle,
                ISNULL(a.CurrentCompany, '') as CurrentCompany,
                ISNULL(a.YearsOfExperience, 0) as YearsOfExperience,
                ISNULL(a.PrimarySkills, '') as PrimarySkills,
                ISNULL(a.LinkedInProfile, '') as LinkedInProfile,
                aps.Status as StatusName,
                ISNULL(at.ScreeningScore, 0) as ScreeningScore,
                ISNULL(at.ScreeningNotes, '') as ScreeningNotes,
                ISNULL(at.InterviewStage, 0) as InterviewStage,
                at.NextInterviewDate,
                ISNULL(at.InterviewFeedback, '') as InterviewFeedback
            FROM JobApplications ja
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            INNER JOIN Users u ON a.UserID = u.UserID
            INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
            LEFT JOIN ApplicationTracking at ON ja.ApplicationID = at.ApplicationID
            ${where}
            ORDER BY ${sortColumn} ${sortOrder}
            OFFSET @param${idx} ROWS FETCH NEXT @param${idx + 1} ROWS ONLY
        `, [...params, offset, pageSize]);
        return result.recordset || [];
    }

    // ── Status updates ──────────────────────────────────────────

    /** Verify employer can manage this application. */
    static async verifyEmployerApplicationAccess(applicationId: string, employerUserId: string): Promise<boolean> {
        const result = await dbService.executeQuery(`
            SELECT ja.ApplicationID FROM JobApplications ja
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Employers e ON j.OrganizationID = e.OrganizationID
            WHERE ja.ApplicationID = @param0 AND e.UserID = @param1 AND e.CanManageApplications = 1
        `, [applicationId, employerUserId]);
        return (result.recordset?.length ?? 0) > 0;
    }

    /** Update application status. Returns updated row with status name. */
    static async updateStatus(applicationId: string, statusId: number): Promise<any | null> {
        const result = await dbService.executeQuery(`
            UPDATE JobApplications SET StatusID = @param1, LastUpdatedAt = GETUTCDATE()
            WHERE ApplicationID = @param0;
            SELECT ja.*, aps.Status as StatusName
            FROM JobApplications ja
            INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
            WHERE ja.ApplicationID = @param0;
        `, [applicationId, statusId]);
        return result.recordset?.[0] ?? null;
    }

    /** Verify user owns an application. */
    static async verifyUserOwnsApplication(applicationId: string, userId: string): Promise<boolean> {
        const result = await dbService.executeQuery(`
            SELECT ja.ApplicationID FROM JobApplications ja
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            WHERE ja.ApplicationID = @param0 AND a.UserID = @param1
        `, [applicationId, userId]);
        return (result.recordset?.length ?? 0) > 0;
    }

    /** Set application to withdrawn (StatusID = 6). */
    static async withdraw(applicationId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE JobApplications SET StatusID = 6, LastUpdatedAt = GETUTCDATE() WHERE ApplicationID = @param0`,
            [applicationId]
        );
    }

    /** Get full application details with job/company/tracking joins. */
    static async findDetailedApplication(applicationId: string, userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT ja.*, j.Title as JobTitle, j.Description as JobDescription, j.Location as JobLocation,
                o.Name as CompanyName, o.Description as CompanyDescription,
                aps.Status as StatusName,
                at.ScreeningScore, at.ScreeningNotes, at.InterviewStage,
                at.NextInterviewDate, at.InterviewFeedback, at.OfferStatus,
                at.OfferedSalary, at.OfferExpiryDate
            FROM JobApplications ja
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            LEFT JOIN ApplicationTracking at ON ja.ApplicationID = at.ApplicationID
            WHERE ja.ApplicationID = @param0 AND a.UserID = @param1
        `, [applicationId, userId]);
        return result.recordset?.[0] ?? null;
    }

    // ── Tracking ────────────────────────────────────────────────

    /** Insert application tracking record. */
    static async insertTracking(trackingId: string, applicationId: string, statusTypeId: number): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO ApplicationTracking (TrackingID, ApplicationID, StatusTypeID, LastUpdatedAt)
            VALUES (@param0, @param1, @param2, GETUTCDATE())
        `, [trackingId, applicationId, statusTypeId]);
    }

    /** Update application tracking. */
    static async updateTracking(applicationId: string, updatedBy: string, data: any): Promise<void> {
        await dbService.executeQuery(`
            UPDATE ApplicationTracking SET
                Notes = COALESCE(@param1, Notes),
                ScreeningScore = COALESCE(@param2, ScreeningScore),
                InterviewStage = COALESCE(@param3, InterviewStage),
                NextInterviewDate = COALESCE(@param4, NextInterviewDate),
                InterviewFeedback = COALESCE(@param5, InterviewFeedback),
                LastUpdatedBy = @param6, LastUpdatedAt = GETUTCDATE()
            WHERE ApplicationID = @param0
        `, [applicationId, data.notes, data.screeningScore, data.interviewStage, data.nextInterviewDate, data.interviewFeedback, updatedBy]);
    }

    /** Update Applicants.LastJobAppliedAt. */
    static async touchApplicantLastApplication(applicantId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Applicants SET LastJobAppliedAt = GETUTCDATE(), UpdatedAt = GETUTCDATE() WHERE ApplicantID = @param0`,
            [applicantId]
        );
    }

    // ── Stats ───────────────────────────────────────────────────

    /** Job seeker application stats. */
    static async getJobSeekerStats(userId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as TotalApplications,
                SUM(CASE WHEN ja.StatusID = 1 THEN 1 ELSE 0 END) as PendingApplications,
                SUM(CASE WHEN ja.StatusID = 3 THEN 1 ELSE 0 END) as ShortlistedApplications,
                SUM(CASE WHEN ja.StatusID IN (4, 5) THEN 1 ELSE 0 END) as InterviewApplications,
                SUM(CASE WHEN ja.StatusID = 6 THEN 1 ELSE 0 END) as RejectedApplications
            FROM JobApplications ja
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            WHERE a.UserID = @param0 AND ja.StatusID != 6
        `, [userId]);
        return result.recordset?.[0] || {};
    }

    /** Employer application stats. */
    static async getEmployerStats(userId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT COUNT(*) as TotalApplicationsReceived,
                SUM(CASE WHEN ja.StatusID = 1 THEN 1 ELSE 0 END) as PendingReview,
                SUM(CASE WHEN ja.StatusID = 2 THEN 1 ELSE 0 END) as UnderReview,
                SUM(CASE WHEN ja.StatusID = 3 THEN 1 ELSE 0 END) as Shortlisted,
                SUM(CASE WHEN ja.StatusID IN (4, 5) THEN 1 ELSE 0 END) as InInterviewProcess
            FROM JobApplications ja
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Employers e ON j.OrganizationID = e.OrganizationID
            WHERE e.UserID = @param0 AND e.CanManageApplications = 1
        `, [userId]);
        return result.recordset?.[0] || {};
    }
}
