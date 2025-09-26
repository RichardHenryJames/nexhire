import { dbService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { JobApplication, ApplicationTracking, PaginationParams, JobApplicationRequest } from '../types';
import { 
    ValidationError, 
    NotFoundError, 
    ConflictError,
    validateRequest,
    jobApplicationSchema
} from '../utils/validation';
import { appConstants } from '../config';

export class JobApplicationService {
    // Apply for a job - FIXED: Better error handling and validation
    static async applyForJob(applicationData: any, applicantUserId: string): Promise<JobApplication> {
        const validatedData = validateRequest<JobApplicationRequest>(jobApplicationSchema, applicationData);
        
        // Get applicant ID from user ID - FIXED: Create applicant profile if not exists
        let applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        let applicantResult = await dbService.executeQuery(applicantQuery, [applicantUserId]);
        
        let applicantId: string;
        
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            // Create applicant profile if it doesn't exist
            console.log('Creating applicant profile for user:', applicantUserId);
            applicantId = AuthService.generateUniqueId();
            
            const createApplicantQuery = `
                INSERT INTO Applicants (
                    ApplicantID, UserID, ProfileCompleteness, IsOpenToWork,
                    AllowRecruitersToContact, HideCurrentCompany, HideSalaryDetails,
                    ImmediatelyAvailable, WillingToRelocate, IsFeatured,
                    CreatedAt, UpdatedAt
                ) VALUES (
                    @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0,
                    GETUTCDATE(), GETUTCDATE()
                )
            `;
            
            await dbService.executeQuery(createApplicantQuery, [applicantId, applicantUserId]);
        } else {
            applicantId = applicantResult.recordset[0].ApplicantID;
        }
        
        // Check if job exists and is published - FIXED: More flexible status check
        const jobQuery = `
            SELECT JobID, Status, ApplicationDeadline, MaxApplications, CurrentApplications 
            FROM Jobs 
            WHERE JobID = @param0 AND Status IN ('Published', 'Draft')
        `;
        const jobResult = await dbService.executeQuery(jobQuery, [validatedData.jobID]);
        
        if (!jobResult.recordset || jobResult.recordset.length === 0) {
            throw new NotFoundError('Job not found or not available for applications');
        }
        
        const job = jobResult.recordset[0];
        
        // Check application deadline (only if set)
        if (job.ApplicationDeadline && new Date(job.ApplicationDeadline) < new Date()) {
            throw new ValidationError('Application deadline has passed');
        }
        
        // Check max applications limit (only if set)
        if (job.MaxApplications && job.CurrentApplications >= job.MaxApplications) {
            throw new ValidationError('Maximum number of applications reached for this job');
        }
        
        // Check if user already applied for this job (include status to allow re-applying after withdrawal)
        const existingApplicationQuery = `
            SELECT ApplicationID, StatusID FROM JobApplications 
            WHERE JobID = @param0 AND ApplicantID = @param1
        `;
        const existingResult = await dbService.executeQuery(existingApplicationQuery, [validatedData.jobID, applicantId]);
        
        // Track resurrect scenario (previously withdrawn)
        let resurrectApplicationId: string | null = null;
        if (existingResult.recordset && existingResult.recordset.length > 0) {
            const existing = existingResult.recordset[0];
            if (existing.StatusID === 6) {
                // Previously withdrawn – allow reapply by reviving this row
                resurrectApplicationId = existing.ApplicationID;
            } else {
                // Active (or any non-withdrawn) application already exists – block
                try { await dbService.executeQuery('DELETE FROM SavedJobs WHERE JobID = @param0 AND ApplicantID = @param1', [validatedData.jobID, applicantId]); } catch {}
                throw new ConflictError('You have already applied for this job');
            }
        }
        
        // Use existing withdrawn application id if reviving, else create fresh id
        const applicationId = resurrectApplicationId || AuthService.generateUniqueId();
        
        // ? UPDATED: Determine which resume to use
        let resumeId = null;
        if (validatedData.resumeURL) {
            // If resumeURL is provided, find the matching resume
            const resumeQuery = `
                SELECT ResumeID FROM ApplicantResumes 
                WHERE ApplicantID = @param0 AND ResumeURL = @param1
            `;
            const resumeResult = await dbService.executeQuery(resumeQuery, [applicantId, validatedData.resumeURL]);
            
            if (resumeResult.recordset && resumeResult.recordset.length > 0) {
                resumeId = resumeResult.recordset[0].ResumeID;
            }
        } else {
            // Use primary resume if no specific resume URL provided
            const primaryResumeQuery = `
                SELECT ResumeID FROM ApplicantResumes 
                WHERE ApplicantID = @param0 AND IsPrimary = 1
            `;
            const primaryResult = await dbService.executeQuery(primaryResumeQuery, [applicantId]);
            
            if (primaryResult.recordset && primaryResult.recordset.length > 0) {
                resumeId = primaryResult.recordset[0].ResumeID;
            }
        }

        if (!resumeId) {
            throw new ValidationError('No resume found. Please upload a resume before applying.');
        }
        
        const parameters = [
            applicationId,
            validatedData.jobID,
            applicantId,
            resumeId, // ? UPDATED: Use ResumeID instead of ResumeURL
            validatedData.coverLetter || null,
            validatedData.expectedSalary || null,
            validatedData.expectedCurrencyID || null,
            validatedData.availableFromDate || null
        ];
        
        try {
            if (resurrectApplicationId) {
                // Revive withdrawn application instead of inserting a new one
                const reviveQuery = `
                    UPDATE JobApplications
                    SET 
                        ResumeID = @param3,
                        CoverLetter = @param4,
                        ExpectedSalary = @param5,
                        ExpectedCurrencyID = @param6,
                        AvailableFromDate = @param7,
                        StatusID = 1,
                        SubmittedAt = GETUTCDATE(),
                        LastUpdatedAt = GETUTCDATE()
                    WHERE ApplicationID = @param0 AND JobID = @param1 AND ApplicantID = @param2;
                    
                    SELECT 
                        ja.*, j.Title as JobTitle, o.Name as CompanyName, aps.Status as StatusName
                    FROM JobApplications ja
                    INNER JOIN Jobs j ON ja.JobID = j.JobID
                    INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                    INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
                    WHERE ja.ApplicationID = @param0;
                `;
                const revived = await dbService.executeQuery<JobApplication>(reviveQuery, parameters);
                if (!revived.recordset || revived.recordset.length === 0) {
                    throw new Error('Failed to revive withdrawn application');
                }
                // (Do NOT increment job CurrentApplications again to avoid double counting)
                return revived.recordset[0];
            } else {
                // Insert new application
                const insertQuery = `
                    INSERT INTO JobApplications (
                        ApplicationID, JobID, ApplicantID, ResumeID, CoverLetter,
                        ExpectedSalary, ExpectedCurrencyID, AvailableFromDate, StatusID,
                        SubmittedAt, LastUpdatedAt
                    ) VALUES (
                        @param0, @param1, @param2, @param3, @param4,
                        @param5, @param6, @param7, 1,
                        GETUTCDATE(), GETUTCDATE()
                    )
                `;
                await dbService.executeQuery(insertQuery, parameters);
                // Increment job applications only for brand new application
                const updateJobQuery = `
                    UPDATE Jobs 
                    SET CurrentApplications = ISNULL(CurrentApplications, 0) + 1, UpdatedAt = GETUTCDATE()
                    WHERE JobID = @param0
                `;
                await dbService.executeQuery(updateJobQuery, [validatedData.jobID]);
                // Remove from SavedJobs if present
                try {
                    const removeSavedQuery = `DELETE FROM SavedJobs WHERE JobID = @param0 AND ApplicantID = @param1`;
                    await dbService.executeQuery(removeSavedQuery, [validatedData.jobID, applicantId]);
                } catch (e) {
                    console.warn('Failed to remove from saved jobs:', e);
                }
                const selectQuery = `
                    SELECT 
                        ja.*, j.Title as JobTitle, o.Name as CompanyName, aps.Status as StatusName
                    FROM JobApplications ja
                    INNER JOIN Jobs j ON ja.JobID = j.JobID
                    INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                    INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
                    WHERE ja.ApplicationID = @param0
                `;
                const result = await dbService.executeQuery<JobApplication>(selectQuery, [applicationId]);
                if (!result.recordset || result.recordset.length === 0) {
                    throw new Error('Failed to retrieve created job application');
                }
                try { await this.createApplicationTracking(applicationId, 1); } catch (trackingError) { console.warn('Failed to create application tracking:', trackingError); }
                try { await this.updateApplicantLastApplication(applicantId); await this.updateApplicantSearchScore(applicantUserId); } catch (updateError) { console.warn('Failed to update applicant metadata:', updateError); }
                return result.recordset[0];
            }
        } catch (error) {
            console.error('Error creating job application:', error);
            console.error('Parameters:', parameters);
            throw new Error('Failed to submit job application: ' + (error instanceof Error ? error.message : String(error)));
        }
    }
    
    // Get applications for a user (job seeker) - FIXED: Include organization logo and contact info with consistent naming
    static async getApplicationsByUser(userId: string, params: PaginationParams): Promise<{ applications: JobApplication[]; total: number; totalPages: number }> {
        const { page, pageSize, sortBy = 'SubmittedAt', sortOrder = 'desc' } = params;

        try {
            // ENHANCED: Include organization info with consistent field names (no duplicates)
            const directQuery = `
                SELECT 
                    ja.ApplicationID,
                    ja.JobID,
                    ja.ApplicantID,
                    ja.StatusID,
                    ja.SubmittedAt,
                    ja.LastUpdatedAt,
                    ja.ExpectedSalary,
                    ja.CoverLetter,
                    ja.AvailableFromDate,
                    j.Title as JobTitle,
                    j.JobTypeID,
                    jt.Type as JobTypeName,
                    o.Name as CompanyName,
                    o.LogoURL as OrganizationLogo,
                    o.Website as OrganizationWebsite,
                    o.LinkedInProfile as OrganizationLinkedIn,
                    c.Code as CurrencyCode,
                    aps.Status as StatusName
                FROM JobApplications ja
                INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
                INNER JOIN Jobs j ON ja.JobID = j.JobID
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
                LEFT JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
                LEFT JOIN Currencies c ON ja.ExpectedCurrencyID = c.CurrencyID
                WHERE a.UserID = '${userId}' AND ja.StatusID != 6
                ORDER BY ja.SubmittedAt DESC
            `;

            const result = await dbService.executeQuery<JobApplication>(directQuery, []);
            const applications = result.recordset || [];
            const total = applications.length;
            
            if (total === 0) {
                return { applications: [], total: 0, totalPages: 0 };
            }

            // Manual pagination
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedApplications = applications.slice(startIndex, endIndex);
            const totalPages = Math.ceil(total / pageSize);

            return {
                applications: paginatedApplications,
                total,
                totalPages
            };
        } catch (error) {
            console.error('Error in getApplicationsByUser (enhanced):', error);
            return { applications: [], total: 0, totalPages: 0 };
        }
    }
    
    // Get applications for a job (employer view) - FIXED: Better error handling
    static async getApplicationsByJob(jobId: string, employerUserId: string, params: PaginationParams & { statusFilter?: number }): Promise<{ applications: JobApplication[]; total: number; totalPages: number }> {
        const { page, pageSize, sortBy = 'SubmittedAt', sortOrder = 'desc', statusFilter } = params;
        
        try {
            // Verify employer has access to this job - FIXED: More flexible access check
            const accessQuery = `
                SELECT j.JobID FROM Jobs j
                LEFT JOIN Employers e ON j.OrganizationID = e.OrganizationID
                WHERE j.JobID = @param0 AND (
                    j.PostedByUserID = @param1 OR 
                    (e.UserID = @param1 AND e.CanManageApplications = 1)
                )
            `;
            const accessResult = await dbService.executeQuery(accessQuery, [jobId, employerUserId]);
            
            if (!accessResult.recordset || accessResult.recordset.length === 0) {
                // Return empty instead of throwing error for better UX
                return { applications: [], total: 0, totalPages: 0 };
            }
            
            let whereClause = 'WHERE ja.JobID = @param0';
            const queryParams = [jobId];
            let paramIndex = 1;
            
            if (statusFilter && statusFilter > 0) {
                whereClause += ` AND ja.StatusID = @param${paramIndex}`;
                queryParams.push(statusFilter.toString());
                paramIndex++;
            }
            
            // Get total count
            const countQuery = `SELECT COUNT(*) as total FROM JobApplications ja ${whereClause}`;
            const countResult = await dbService.executeQuery(countQuery, queryParams);
            const total = countResult.recordset[0]?.total || 0;
            const totalPages = Math.ceil(total / pageSize);
            
            if (total === 0) {
                return { applications: [], total: 0, totalPages: 0 };
            }
            
            // Get paginated applications - FIXED: Handle NULL values properly
            const offset = (page - 1) * pageSize;
            const dataQuery = `
                SELECT 
                    ja.*,
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
                ${whereClause}
                ORDER BY ja.${sortBy} ${sortOrder.toUpperCase()}
                OFFSET @param${paramIndex} ROWS
                FETCH NEXT @param${paramIndex + 1} ROWS ONLY
            `;
            
            queryParams.push(offset.toString(), pageSize.toString());
            const dataResult = await dbService.executeQuery<JobApplication>(dataQuery, queryParams);
            
            return {
                applications: dataResult.recordset || [],
                total,
                totalPages
            };
        } catch (error) {
            console.error('Error getting applications by job:', error);
            console.error('JobID:', jobId, 'EmployerID:', employerUserId);
            return { applications: [], total: 0, totalPages: 0 };
        }
    }
    
    // Update application status
    static async updateApplicationStatus(applicationId: string, statusId: number, employerUserId: string, notes?: string): Promise<JobApplication> {
        // Verify employer has access to this application
        const accessQuery = `
            SELECT ja.ApplicationID FROM JobApplications ja
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Employers e ON j.OrganizationID = e.OrganizationID
            WHERE ja.ApplicationID = @param0 AND e.UserID = @param1 AND e.CanManageApplications = 1
        `;
        const accessResult = await dbService.executeQuery(accessQuery, [applicationId, employerUserId]);
        
        if (!accessResult.recordset || accessResult.recordset.length === 0) {
            throw new ValidationError('Access denied to this application');
        }
        
        // Update application status
        const updateQuery = `
            UPDATE JobApplications 
            SET StatusID = @param1, LastUpdatedAt = GETUTCDATE()
            WHERE ApplicationID = @param0;
            
            -- Get updated application
            SELECT 
                ja.*,
                aps.Status as StatusName
            FROM JobApplications ja
            INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
            WHERE ja.ApplicationID = @param0;
        `;
        
        const result = await dbService.executeQuery<JobApplication>(updateQuery, [applicationId, statusId]);
        
        if (!result.recordset || result.recordset.length === 0) {
            throw new Error('Failed to update application status');
        }
        
        // Update application tracking
        await this.updateApplicationTracking(applicationId, employerUserId, { notes });
        
        return result.recordset[0];
    }
    
    // Withdraw application (job seeker)
    static async withdrawApplication(applicationId: string, userId: string): Promise<void> {
        // Verify user owns this application
        const accessQuery = `
            SELECT ja.ApplicationID FROM JobApplications ja
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            WHERE ja.ApplicationID = @param0 AND a.UserID = @param1
        `;
        
        const accessResult = await dbService.executeQuery(accessQuery, [applicationId, userId]);
        
        if (!accessResult.recordset || accessResult.recordset.length === 0) {
            throw new ValidationError('Access denied to this application');
        }
        
        // Update status to withdrawn (assuming status 6 is rejected/withdrawn)
        const updateQuery = `
            UPDATE JobApplications 
            SET StatusID = 6, LastUpdatedAt = GETUTCDATE()
            WHERE ApplicationID = @param0
        `;
        
        await dbService.executeQuery(updateQuery, [applicationId]);
        
        // Verify the update worked
        const verifyQuery = `
            SELECT ApplicationID, StatusID, LastUpdatedAt 
            FROM JobApplications 
            WHERE ApplicationID = @param0
        `;
        const verifyResult = await dbService.executeQuery(verifyQuery, [applicationId]);
    }
    
    // Get application details
    static async getApplicationDetails(applicationId: string, userId: string): Promise<JobApplication | null> {
        const query = `
            SELECT 
                ja.*,
                j.Title as JobTitle,
                j.Description as JobDescription,
                j.Location as JobLocation,
                o.Name as CompanyName,
                o.Description as CompanyDescription,
                aps.Status as StatusName,
                at.ScreeningScore,
                at.ScreeningNotes,
                at.InterviewStage,
                at.NextInterviewDate,
                at.InterviewFeedback,
                at.OfferStatus,
                at.OfferedSalary,
                at.OfferExpiryDate
            FROM JobApplications ja
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            LEFT JOIN ApplicationTracking at ON ja.ApplicationID = at.ApplicationID
            WHERE ja.ApplicationID = @param0 AND a.UserID = @param1
        `;
        
        const result = await dbService.executeQuery<JobApplication>(query, [applicationId, userId]);
        return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
    }
    
    // Private helper methods
    private static async createApplicationTracking(applicationId: string, statusTypeId: number): Promise<void> {
        const trackingId = AuthService.generateUniqueId();
        
        const query = `
            INSERT INTO ApplicationTracking (
                TrackingID, ApplicationID, StatusTypeID, LastUpdatedAt
            ) VALUES (
                @param0, @param1, @param2, GETUTCDATE()
            )
        `;
        
        await dbService.executeQuery(query, [trackingId, applicationId, statusTypeId]);
    }
    
    private static async updateApplicationTracking(applicationId: string, updatedBy: string, updateData: any): Promise<void> {
        const { notes, screeningScore, interviewStage, nextInterviewDate, interviewFeedback } = updateData;
        
        const query = `
            UPDATE ApplicationTracking 
            SET 
                Notes = COALESCE(@param1, Notes),
                ScreeningScore = COALESCE(@param2, ScreeningScore),
                InterviewStage = COALESCE(@param3, InterviewStage),
                NextInterviewDate = COALESCE(@param4, NextInterviewDate),
                InterviewFeedback = COALESCE(@param5, InterviewFeedback),
                LastUpdatedBy = @param6,
                LastUpdatedAt = GETUTCDATE()
            WHERE ApplicationID = @param0
        `;
        
        await dbService.executeQuery(query, [
            applicationId, 
            notes, 
            screeningScore, 
            interviewStage, 
            nextInterviewDate, 
            interviewFeedback, 
            updatedBy
        ]);
    }
    
    private static async updateApplicantLastApplication(applicantId: string): Promise<void> {
        const query = `
            UPDATE Applicants 
            SET LastJobAppliedAt = GETUTCDATE(), UpdatedAt = GETUTCDATE()
            WHERE ApplicantID = @param0
        `;
        
        await dbService.executeQuery(query, [applicantId]);
    }
    
    private static async updateApplicantSearchScore(userId: string): Promise<void> {
        try {
            // Import ApplicantService to use the search score calculation
            const { ApplicantService } = await import('./profile.service');
            await ApplicantService.calculateAndUpdateSearchScore(userId);
        } catch (error) {
            console.warn('Failed to update search score:', error);
            // Non-critical, don't throw
        }
    }
    
    // Get application statistics for dashboard
    static async getApplicationStats(userId: string, userType: string): Promise<any> {
        if (userType === appConstants.userTypes.JOB_SEEKER) {
            return await this.getJobSeekerApplicationStats(userId);
        } else if (userType === appConstants.userTypes.EMPLOYER) {
            return await this.getEmployerApplicationStats(userId);
        }
        
        return {};
    }
    
    private static async getJobSeekerApplicationStats(userId: string): Promise<any> {
        // FIXED: Exclude withdrawn applications (StatusID = 6) from stats
        const query = `
            SELECT 
                COUNT(*) as TotalApplications,
                SUM(CASE WHEN ja.StatusID = 1 THEN 1 ELSE 0 END) as PendingApplications,
                SUM(CASE WHEN ja.StatusID = 3 THEN 1 ELSE 0 END) as ShortlistedApplications,
                SUM(CASE WHEN ja.StatusID IN (4, 5) THEN 1 ELSE 0 END) as InterviewApplications,
                SUM(CASE WHEN ja.StatusID = 6 THEN 1 ELSE 0 END) as RejectedApplications
            FROM JobApplications ja
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            WHERE a.UserID = @param0 AND ja.StatusID != 6
        `;
        
        const result = await dbService.executeQuery(query, [userId]);
        return result.recordset[0] || {};
    }
    
    private static async getEmployerApplicationStats(userId: string): Promise<any> {
        const query = `
            SELECT 
                COUNT(*) as TotalApplicationsReceived,
                SUM(CASE WHEN ja.StatusID = 1 THEN 1 ELSE 0 END) as PendingReview,
                SUM(CASE WHEN ja.StatusID = 2 THEN 1 ELSE 0 END) as UnderReview,
                SUM(CASE WHEN ja.StatusID = 3 THEN 1 ELSE 0 END) as Shortlisted,
                SUM(CASE WHEN ja.StatusID IN (4, 5) THEN 1 ELSE 0 END) as InInterviewProcess
            FROM JobApplications ja
            INNER JOIN Jobs j ON ja.JobID = j.JobID
            INNER JOIN Employers e ON j.OrganizationID = e.OrganizationID
            WHERE e.UserID = @param0 AND e.CanManageApplications = 1
        `;
        
        const result = await dbService.executeQuery(query, [userId]);
        return result.recordset[0] || {};
    }
}