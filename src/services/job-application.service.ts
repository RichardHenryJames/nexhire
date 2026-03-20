import { JobApplicationRepository } from '../repositories/job-application.repository';
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
        
        // Get applicant ID from user ID - creates profile if not exists via UserRepository
        const { UserRepository } = await import('../repositories/user.repository');
        const applicantId = await UserRepository.ensureApplicantId(applicantUserId);
        
        // Check if job exists and is published
        const job = await JobApplicationRepository.findJobForApplication(validatedData.jobID);
        
        if (!job) {
            throw new NotFoundError('Job not found or not available for applications');
        }
        
        // Check application deadline (only if set)
        if (job.ApplicationDeadline && new Date(job.ApplicationDeadline) < new Date()) {
            throw new ValidationError('Application deadline has passed');
        }
        
        // Check max applications limit (only if set)
        if (job.MaxApplications && job.CurrentApplications >= job.MaxApplications) {
            throw new ValidationError('Maximum number of applications reached for this job');
        }
        
        const existing = await JobApplicationRepository.findExisting(validatedData.jobID, applicantId);
        
        // Track resurrect scenario (previously withdrawn)
        let resurrectApplicationId: string | null = null;
        if (existing) {
            if (existing.StatusID === 6) {
                resurrectApplicationId = existing.ApplicationID;
            } else {
                try { await JobApplicationRepository.removeSavedJob(validatedData.jobID, applicantId); } catch {}
                throw new ConflictError('You have already applied for this job');
            }
        }
        
        // Use existing withdrawn application id if reviving, else create fresh id
        const applicationId = resurrectApplicationId || AuthService.generateUniqueId();
        
        // ? UPDATED: Determine which resume to use
        let resumeId: string | null = null;
        if (validatedData.resumeURL) {
            resumeId = await JobApplicationRepository.findResumeByUrl(applicantId, validatedData.resumeURL);
        } else {
            resumeId = await JobApplicationRepository.findPrimaryResume(applicantId);
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
                const revived = await JobApplicationRepository.reviveApplication(parameters);
                if (!revived) {
                    throw new Error('Failed to revive withdrawn application');
                }
                return revived;
            } else {
                // Insert new application
                await JobApplicationRepository.insertApplication(parameters);
                // Increment job applications only for brand new application
                await JobApplicationRepository.incrementJobApplications(validatedData.jobID);
                // Remove from SavedJobs if present
                try {
                    await JobApplicationRepository.removeSavedJob(validatedData.jobID, applicantId);
                } catch (e) {
                    console.warn('Failed to remove from saved jobs:', e);
                }
                const application = await JobApplicationRepository.findApplicationWithJoins(applicationId);
                if (!application) {
                    throw new Error('Failed to retrieve created job application');
                }
                try { await this.createApplicationTracking(applicationId, 1); } catch (trackingError) { console.warn('Failed to create application tracking:', trackingError); }
                try { await this.updateApplicantLastApplication(applicantId); await this.updateApplicantSearchScore(applicantUserId); } catch (updateError) { console.warn('Failed to update applicant metadata:', updateError); }
                return application;
            }
        } catch (error) {
            console.error('Error creating job application:', error);
            console.error('Parameters:', parameters);
            throw new Error('Failed to submit job application: ' + (error instanceof Error ? error.message : String(error)));
        }
    }
    
    // Get applications for a user (job seeker) - FIXED: Include organization logo and contact info with consistent naming
    // 🔧 UPDATED: Only show applications from last 2 weeks
    static async getApplicationsByUser(userId: string, params: PaginationParams): Promise<{ applications: JobApplication[]; total: number; totalPages: number }> {
        const { page, pageSize, sortBy = 'SubmittedAt', sortOrder = 'desc' } = params;

        try {
            const applications = await JobApplicationRepository.findByUser(userId);
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

        // SECURITY FIX: Allowlist for ORDER BY to prevent SQL injection
        const ALLOWED_SORT_COLUMNS: Record<string, string> = {
            'SubmittedAt': 'ja.SubmittedAt',
            'LastUpdatedAt': 'ja.LastUpdatedAt',
            'StatusID': 'ja.StatusID',
        };
        const safeSortColumn = ALLOWED_SORT_COLUMNS[sortBy] || 'ja.SubmittedAt';
        const safeSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        
        try {
            // Verify employer has access to this job
            const hasAccess = await JobApplicationRepository.verifyEmployerAccess(jobId, employerUserId);
            
            if (!hasAccess) {
                return { applications: [], total: 0, totalPages: 0 };
            }
            
            // Get total count
            const total = await JobApplicationRepository.countByJob(jobId, statusFilter);
            const totalPages = Math.ceil(total / pageSize);
            
            if (total === 0) {
                return { applications: [], total: 0, totalPages: 0 };
            }
            
            // Get paginated applications
            const offset = (page - 1) * pageSize;
            const applications = await JobApplicationRepository.findByJob(
                jobId, offset, pageSize, safeSortColumn, safeSortOrder, statusFilter
            );
            
            return { applications, total, totalPages };
        } catch (error) {
            console.error('Error getting applications by job:', error);
            console.error('JobID:', jobId, 'EmployerID:', employerUserId);
            return { applications: [], total: 0, totalPages: 0 };
        }
    }
    
    // Update application status
    static async updateApplicationStatus(applicationId: string, statusId: number, employerUserId: string, notes?: string): Promise<JobApplication> {
        const hasAccess = await JobApplicationRepository.verifyEmployerApplicationAccess(applicationId, employerUserId);
        
        if (!hasAccess) {
            throw new ValidationError('Access denied to this application');
        }
        
        // Update application status
        const updated = await JobApplicationRepository.updateStatus(applicationId, statusId);
        
        if (!updated) {
            throw new Error('Failed to update application status');
        }
        
        // Update application tracking
        await this.updateApplicationTracking(applicationId, employerUserId, { notes });
        
        return updated;
    }
    
    // Withdraw application (job seeker)
    static async withdrawApplication(applicationId: string, userId: string): Promise<void> {
        const hasAccess = await JobApplicationRepository.verifyUserOwnsApplication(applicationId, userId);
        
        if (!hasAccess) {
            throw new ValidationError('Access denied to this application');
        }
        
        await JobApplicationRepository.withdraw(applicationId);
    }
    
    // Get application details
  static async getApplicationDetails(applicationId: string, userId: string): Promise<JobApplication | null> {
        return await JobApplicationRepository.findDetailedApplication(applicationId, userId) as JobApplication | null;
    }
    
    // Private helper methods
    private static async createApplicationTracking(applicationId: string, statusTypeId: number): Promise<void> {
        const trackingId = AuthService.generateUniqueId();
        await JobApplicationRepository.insertTracking(trackingId, applicationId, statusTypeId);
    }
    
    private static async updateApplicationTracking(applicationId: string, updatedBy: string, updateData: any): Promise<void> {
        await JobApplicationRepository.updateTracking(applicationId, updatedBy, updateData);
    }
    
    private static async updateApplicantLastApplication(applicantId: string): Promise<void> {
        await JobApplicationRepository.touchApplicantLastApplication(applicantId);
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
        return await JobApplicationRepository.getJobSeekerStats(userId);
    }
    
    private static async getEmployerApplicationStats(userId: string): Promise<any> {
        return await JobApplicationRepository.getEmployerStats(userId);
    }
}