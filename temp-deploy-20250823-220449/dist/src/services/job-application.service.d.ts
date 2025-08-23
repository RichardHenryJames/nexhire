import { JobApplication, PaginationParams } from '../types';
export declare class JobApplicationService {
    static applyForJob(applicationData: any, applicantUserId: string): Promise<JobApplication>;
    static getApplicationsByUser(userId: string, params: PaginationParams): Promise<{
        applications: JobApplication[];
        total: number;
        totalPages: number;
    }>;
    static getApplicationsByJob(jobId: string, employerUserId: string, params: PaginationParams & {
        statusFilter?: number;
    }): Promise<{
        applications: JobApplication[];
        total: number;
        totalPages: number;
    }>;
    static updateApplicationStatus(applicationId: string, statusId: number, employerUserId: string, notes?: string): Promise<JobApplication>;
    static withdrawApplication(applicationId: string, userId: string): Promise<void>;
    static getApplicationDetails(applicationId: string, userId: string): Promise<JobApplication | null>;
    private static createApplicationTracking;
    private static updateApplicationTracking;
    private static updateApplicantLastApplication;
    static getApplicationStats(userId: string, userType: string): Promise<any>;
    private static getJobSeekerApplicationStats;
    private static getEmployerApplicationStats;
}
//# sourceMappingURL=job-application.service.d.ts.map