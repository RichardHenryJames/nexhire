import { Job, PaginationParams, QueryParams } from '../types';
export declare class JobService {
    static createJob(jobData: any, postedByUserID: string, organizationID: string): Promise<Job>;
    static getJobs(params: PaginationParams & QueryParams): Promise<{
        jobs: Job[];
        total: number;
        totalPages: number;
    }>;
    static getJobById(jobId: string): Promise<Job | null>;
    static updateJob(jobId: string, updateData: any, userId: string): Promise<Job>;
    static publishJob(jobId: string, userId: string): Promise<Job>;
    static closeJob(jobId: string, userId: string): Promise<void>;
    static deleteJob(jobId: string, userId: string): Promise<void>;
    static getJobsByOrganization(organizationId: string, params: PaginationParams): Promise<{
        jobs: Job[];
        total: number;
        totalPages: number;
    }>;
    static getJobTypes(): Promise<any[]>;
    static getCurrencies(): Promise<any[]>;
    static searchJobs(searchParams: any): Promise<{
        jobs: Job[];
        total: number;
    }>;
}
//# sourceMappingURL=job.service.d.ts.map