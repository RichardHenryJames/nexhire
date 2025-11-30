/**
 * AI Job Recommendation Service
 * Generates intelligent job filters based on user profile
 * and returns personalized job recommendations with wallet deduction
 */

import { dbService } from './database.service';
import { WalletService } from './wallet.service';
import { JobService } from './job.service';
import { InsufficientBalanceError, NotFoundError } from '../utils/validation';

const AI_JOBS_COST = 100; // ₹100 per AI recommendation access
const AI_ACCESS_DURATION_HOURS = 24; // 24 hours access after payment

export class AIJobRecommendationService {
  /**
   * Check if user has active AI access (paid within last 24 hours)
   */
  static async hasActiveAIAccess(userId: string): Promise<boolean> {
    try {
      const query = `
        SELECT TOP 1 wt.CreatedAt
        FROM WalletTransactions wt
        INNER JOIN Wallets w ON wt.WalletID = w.WalletID
        WHERE w.UserID = @param0
          AND wt.Source = 'AI_Job_Recommendations'
          AND wt.TransactionType = 'Debit'
          AND wt.Amount = @param1
          AND wt.CreatedAt >= DATEADD(HOUR, -@param2, GETDATE())
        ORDER BY wt.CreatedAt DESC
      `;
      
      const result = await dbService.executeQuery(query, [userId, AI_JOBS_COST, AI_ACCESS_DURATION_HOURS]);
      
      return result.recordset && result.recordset.length > 0;
    } catch (error) {
      console.error('Error checking AI access:', error);
      return false;
    }
  }

  /**
   * Get AI-recommended jobs with conditional wallet deduction
   * Only deducts if user hasn't paid in last 24 hours
   */
  static async getAIRecommendedJobs(userId: string, limit: number = 50) {
    // 1. Check if user has active AI access (paid within 24 hours)
    const hasAccess = await this.hasActiveAIAccess(userId);
    
    // 2. Only check/deduct wallet if no active access
    if (!hasAccess) {
      const wallet = await WalletService.getOrCreateWallet(userId);
      if (wallet.Balance < AI_JOBS_COST) {
        throw new InsufficientBalanceError('Insufficient wallet balance for AI recommendations');
      }
    }

    try {
      // 2. Generate AI filters from user profile
      const filters = await this.generateJobFilters(userId);
      
      // 4. Fetch jobs with filters
      const params = {
        page: 1,
        pageSize: limit,
        excludeUserApplications: userId,
        ...filters
      };
      
      const result = await JobService.getJobs(params);
      
      // 5. ONLY deduct from wallet if no active access AND we successfully got jobs
      if (!hasAccess) {
        await WalletService.debitWallet(
          userId, 
          AI_JOBS_COST, 
          'AI_Job_Recommendations', 
          `AI-powered job recommendations (${result.jobs.length} jobs) - 24hr access`
        );
      }
      
      return {
        jobs: result.jobs,
        filters,
        total: result.total,
        alreadyPaid: hasAccess // Let frontend know if this was free access
      };
    } catch (error) {
      // If anything fails, wallet won't be deducted
      console.error('Error generating AI recommendations:', error);
      throw error;
    }
  }

  /**
   * Get user's complete profile
   */
  private static async getUserProfile(userId: string) {
    const query = `
      SELECT 
        a.ApplicantID,
        u.FirstName + ' ' + u.LastName AS FullName,
        u.Email,
        u.Phone AS PhoneNumber,
        a.CurrentLocation AS City,
        a.Nationality AS Country,
        a.PrimarySkills AS Skills,
        a.Summary AS Bio,
        a.LinkedInProfile AS LinkedInURL,
        a.GithubProfile AS GitHubURL,
        a.PortfolioURL,
        a.CurrentJobTitle,
        a.PreferredRoles,
        a.PreferredLocations,
        a.PreferredIndustries,
        a.MinimumSalary,
        a.PreferredJobTypes,
        a.PreferredWorkTypes,
        a.WillingToRelocate,
        a.TotalExperienceMonths
      FROM Applicants a
      INNER JOIN Users u ON a.UserID = u.UserID
      WHERE a.UserID = @param0
    `;
    
    const result = await dbService.executeQuery(query, [userId]);
    
    if (!result.recordset || result.recordset.length === 0) {
      throw new NotFoundError('User profile not found');
    }
    
    const profile = result.recordset[0];
    
    // Get work experience
    const workExpQuery = `
      SELECT * FROM WorkExperience 
      WHERE ApplicantID = @param0
      ORDER BY StartDate DESC
    `;
    const workExpResult = await dbService.executeQuery(workExpQuery, [profile.ApplicantID]);
    profile.WorkExperience = workExpResult.recordset || [];
    
    // Get education
    const eduQuery = `
      SELECT * FROM Education 
      WHERE ApplicantID = @param0
      ORDER BY StartDate DESC
    `;
    const eduResult = await dbService.executeQuery(eduQuery, [profile.ApplicantID]);
    profile.Education = eduResult.recordset || [];
    
    return profile;
  }

  /**
   * Calculate years of experience
   */
  private static calculateExperience(workExperience: any[]): number {
    if (!workExperience || workExperience.length === 0) {
      return 0;
    }

    let totalMonths = 0;
    
    workExperience.forEach(exp => {
      const startDate = exp.StartDate ? new Date(exp.StartDate) : null;
      const endDate = exp.EndDate ? new Date(exp.EndDate) : new Date();
      
      if (startDate) {
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                      (endDate.getMonth() - startDate.getMonth());
        totalMonths += Math.max(0, months);
      }
    });

    return Math.floor(totalMonths / 12);
  }

  /**
   * Check if user is a current student
   */
  private static isCurrentStudent(education: any[]): boolean {
    if (!education || education.length === 0) return false;
    
    return education.some(edu => {
      const endDate = edu.EndDate ? new Date(edu.EndDate) : null;
      const now = new Date();
      return !endDate || endDate > now;
    });
  }

  /**
   * Check if user is a recent graduate (within 2 years)
   */
  private static isRecentGraduate(education: any[]): boolean {
    if (!education || education.length === 0) return false;
    
    return education.some(edu => {
      const endDate = edu.EndDate ? new Date(edu.EndDate) : null;
      if (!endDate) return false;
      const monthsSinceGrad = (new Date().getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsSinceGrad >= 0 && monthsSinceGrad <= 24;
    });
  }

  /**
   * Infer job type preferences
   */
  private static inferJobTypePreferences(profile: any, workExperience: any[], education: any[], yearsOfExperience: number): number[] {
    const jobTypeIds: number[] = [];
    const isStudent = this.isCurrentStudent(education);
    const isRecentGrad = this.isRecentGraduate(education);

    // For students or fresh graduates with no experience
    if ((isStudent || yearsOfExperience === 0 || isRecentGrad) && workExperience.length === 0) {
      jobTypeIds.push(5); // Internship
      jobTypeIds.push(1); // Full-time
      return jobTypeIds;
    }

    // Parse preferred job types from profile
    if (profile.PreferredJobTypes) {
      const types = profile.PreferredJobTypes.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
      if (types.length > 0) {
        return types;
      }
    }

    // Default to Full-time for experienced professionals
    jobTypeIds.push(1); // Full-time
    
    return jobTypeIds;
  }

  /**
   * Infer workplace type preferences
   */
  private static inferWorkplacePreferences(profile: any): number[] {
    // Parse from profile preferences (PreferredWorkTypes)
    if (profile.PreferredWorkTypes) {
      const types = profile.PreferredWorkTypes.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
      if (types.length > 0) {
        return types;
      }
    }

    // Default: All types
    return [1, 2, 3]; // On-site, Hybrid, Remote
  }

  /**
   * Infer salary range based on experience and education
   */
  private static inferSalaryRange(profile: any, education: any[], yearsOfExperience: number): { salaryMin?: number; salaryMax?: number } {
    // Use profile preferences if available (MinimumSalary)
    if (profile.MinimumSalary) {
      return {
        salaryMin: profile.MinimumSalary,
        salaryMax: profile.MinimumSalary * 2 // Estimate max as 2x min
      };
    }

    const baseEstimates: Record<number, { min: number; max: number }> = {
      0: { min: 300000, max: 600000 },      // Fresher: 3-6 LPA
      1: { min: 400000, max: 800000 },      // 1 year: 4-8 LPA
      2: { min: 600000, max: 1200000 },     // 2 years: 6-12 LPA
      3: { min: 800000, max: 1500000 },     // 3 years: 8-15 LPA
      5: { min: 1200000, max: 2500000 },    // 5 years: 12-25 LPA
      7: { min: 1800000, max: 3500000 },    // 7 years: 18-35 LPA
      10: { min: 2500000, max: 5000000 }    // 10+ years: 25-50 LPA
    };

    const isStudent = this.isCurrentStudent(education);
    
    // Adjust for students/freshers based on education
    if ((isStudent || yearsOfExperience === 0) && education.length > 0) {
      const latestEducation = education[0];
      const degree = (latestEducation.Degree || latestEducation.EducationLevel || '').toLowerCase();
      
      if (degree.includes('phd') || degree.includes('doctorate')) {
        return { salaryMin: 600000, salaryMax: 1200000 };
      }
      if (degree.includes('master') || degree.includes('m.tech') || degree.includes('mba')) {
        return { salaryMin: 500000, salaryMax: 1000000 };
      }
      if (degree.includes('bachelor') || degree.includes('b.tech') || degree.includes('b.e') || degree.includes('bca')) {
        return { salaryMin: 300000, salaryMax: 600000 };
      }
      if (degree.includes('diploma') || degree.includes('12th') || degree.includes('intermediate')) {
        return { salaryMin: 200000, salaryMax: 400000 };
      }
    }

    // Find closest experience bracket
    const brackets = Object.keys(baseEstimates).map(Number).sort((a, b) => a - b);
    let bracket = brackets[0];
    
    for (const b of brackets) {
      if (yearsOfExperience >= b) {
        bracket = b;
      } else {
        break;
      }
    }

    return {
      salaryMin: baseEstimates[bracket].min,
      salaryMax: baseEstimates[bracket].max
    };
  }

  /**
   * Extract skills and keywords for search
   */
  private static extractSkillsAndKeywords(profile: any, workExperience: any[]): string[] {
    const keywords: string[] = [];
    
    // Add skills from profile (PrimarySkills field)
    if (profile.Skills) {
      const skills = profile.Skills.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      keywords.push(...skills.slice(0, 5)); // Top 5 skills
    }
    
    // Add current job title from profile
    if (profile.CurrentJobTitle) {
      keywords.push(profile.CurrentJobTitle);
    }
    
    // Add current/latest job title from work experience
    if (workExperience.length > 0) {
      const latest = workExperience[0];
      if (latest.JobTitle) {
        keywords.push(latest.JobTitle);
      }
    }
    
    // Add preferred roles
    if (profile.PreferredRoles) {
      const roles = profile.PreferredRoles.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
      keywords.push(...roles.slice(0, 2)); // Top 2 preferred roles
    }
    
    return keywords;
  }

  /**
   * Generate job filters based on user profile (PUBLIC API)
   * Used by both frontend preview and backend full access
   */
  static async generateJobFilters(userId: string) {
    try {
      // Get user profile
      const profile = await this.getUserProfile(userId);
      
      const workExperience = profile.WorkExperience || [];
      const education = profile.Education || [];
      const yearsOfExperience = this.calculateExperience(workExperience);

    const filters: any = {
      // Experience range - flexible for students and freshers
      experienceMin: Math.max(0, yearsOfExperience - 2),
      experienceMax: yearsOfExperience === 0 ? 2 : yearsOfExperience + 2,
      
      // Job type preferences
      jobTypeIds: this.inferJobTypePreferences(profile, workExperience, education, yearsOfExperience).join(','),
      
      // Workplace preferences
      workplaceTypeIds: this.inferWorkplacePreferences(profile).join(','),
      
      // Salary expectations
      ...this.inferSalaryRange(profile, education, yearsOfExperience),
      
      // Location preference
      location: profile.PreferredLocations?.split(',')[0]?.trim() || profile.City,
      
      // Skills and role-based search
      search: this.extractSkillsAndKeywords(profile, workExperience).join(' '),
      
      // Recent jobs (last 30 days)
      postedWithinDays: 30
    };

    // Remove null/undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === null || filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });

    return filters;
    } catch (error) {
      // If profile not found or error occurs, return smart default filters
      console.warn('Could not load user profile for AI filters, using defaults:', error instanceof Error ? error.message : 'Unknown error');
      return this.getSmartDefaultFilters();
    }
  }

  /**
   * Fallback smart default filters
   */
  private static getSmartDefaultFilters() {
    return {
      jobTypeIds: '1,5', // Full-time and Internship
      workplaceTypeIds: '1,2,3', // All workplace types
      experienceMin: 0,
      experienceMax: 2, // Entry level
      postedWithinDays: 30
    };
  }
}
