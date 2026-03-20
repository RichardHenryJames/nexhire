import { UserRepository } from '../repositories/user.repository';
import { SavedJobsRepository } from '../repositories/saved-jobs.repository';
import { PaginationParams } from '../types';

export class SavedJobsService {
  private static async ensureApplicant(userId: string): Promise<string> {
    return UserRepository.ensureApplicantId(userId);
  }

  static async saveJob(userId: string, jobId: string) {
    const applicantId = await this.ensureApplicant(userId);
    return SavedJobsRepository.insertAndReturn(jobId, applicantId);
  }

  static async unsaveJob(userId: string, jobId: string) {
    const applicantId = await this.ensureApplicant(userId);
    await SavedJobsRepository.delete(jobId, applicantId);
  }

  static async getMySavedJobs(userId: string, { page, pageSize }: PaginationParams) {
    const applicantId = await this.ensureApplicant(userId);
    const total = await SavedJobsRepository.countByApplicant(applicantId);
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    if (total === 0) return { jobs: [], total: 0, totalPages: 1 };

    const offset = (page - 1) * pageSize;
    const jobs = await SavedJobsRepository.findByApplicant(applicantId, offset, pageSize);
    return { jobs, total, totalPages };
  }
}
