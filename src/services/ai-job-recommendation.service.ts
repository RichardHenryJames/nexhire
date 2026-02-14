/**
 * AI Job Recommendation Service
 * Generates intelligent job filters based on user profile
 * and returns personalized job recommendations with wallet deduction
 */

import { dbService } from './database.service';
import { WalletService } from './wallet.service';
import { JobService } from './job.service';
import { PricingService } from './pricing.service';
import { InsufficientBalanceError, NotFoundError } from '../utils/validation';

// Note: Pricing now fetched from DB via PricingService

export class AIJobRecommendationService {
  /**
   * Check if user has active AI access (paid within the configured duration)
   */
  static async hasActiveAIAccess(userId: string, aiJobsCost?: number, aiAccessDuration?: number): Promise<boolean> {
    try {
      // Use passed values or fetch from DB
      if (aiJobsCost === undefined) aiJobsCost = await PricingService.getAIJobsCost();
      if (aiAccessDuration === undefined) aiAccessDuration = await PricingService.getAIAccessDurationHours();
      
      const query = `
        SELECT TOP 1 wt.CreatedAt
        FROM WalletTransactions wt
        INNER JOIN Wallets w ON wt.WalletID = w.WalletID
        WHERE w.UserID = @param0
          AND wt.Source = 'AI_Job_Recommendations'
          AND wt.TransactionType = 'Debit'
          AND wt.Amount = @param1
          AND wt.CreatedAt >= DATEADD(HOUR, -@param2, GETUTCDATE())
        ORDER BY wt.CreatedAt DESC
      `;
      
      const result = await dbService.executeQuery(query, [userId, aiJobsCost, aiAccessDuration]);
      
      return result.recordset && result.recordset.length > 0;
    } catch (error) {
      console.error('Error checking AI access:', error);
      return false;
    }
  }

  /**
   * Get AI-recommended jobs with conditional wallet deduction
   * Only deducts if user hasn't paid in the configured duration
   */
  static async getAIRecommendedJobs(userId: string, limit: number = 50) {
    // Fetch pricing from DB (single call, cached for 5 min)
    const [aiJobsCost, aiAccessDuration] = await Promise.all([
      PricingService.getAIJobsCost(),
      PricingService.getAIAccessDurationHours()
    ]);
    
    // 1. Check if user has active AI access
    const hasAccess = await this.hasActiveAIAccess(userId, aiJobsCost, aiAccessDuration);
    
    // 2. Only check/deduct wallet if no active access
    if (!hasAccess) {
      const wallet = await WalletService.getOrCreateWallet(userId);
      if (wallet.Balance < aiJobsCost) {
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
        const durationDays = Math.floor(aiAccessDuration / 24);
        await WalletService.debitWallet(
          userId, 
          aiJobsCost, 
          'AI_Job_Recommendations', 
          `AI-powered job recommendations (${result.jobs.length} jobs) - ${durationDays}-day access`
        );
      }
      
      return {
        jobs: result.jobs,
        filters,
        total: result.jobs.length,
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
        CAST(a.PreferredRoles AS NVARCHAR(MAX)) AS PreferredRoles,
        a.PreferredLocations,
        a.PreferredIndustries,
        a.MinimumSalary,
        a.PreferredJobTypes,
        a.PreferredWorkTypes,
        a.WillingToRelocate,
        a.TotalExperienceMonths,
        a.HighestEducation,
        a.GraduationYear
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
      SELECT * FROM WorkExperiences 
      WHERE ApplicantID = @param0
      ORDER BY StartDate DESC
    `;
    const workExpResult = await dbService.executeQuery(workExpQuery, [profile.ApplicantID]);
    profile.WorkExperience = workExpResult.recordset || [];
    
    // Education lives on the Applicants table (HighestEducation, GraduationYear) — no separate Education table
    profile.Education = [];
    if (profile.HighestEducation || profile.GraduationYear) {
      profile.Education.push({
        Degree: profile.HighestEducation || '',
        EducationLevel: profile.HighestEducation || '',
        GraduationYear: profile.GraduationYear || '',
        EndDate: profile.GraduationYear ? new Date(`${profile.GraduationYear}-06-01`) : null,
      });
    }
    
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
      jobTypeIds.push(437); // Internship - NEW ReferenceMetadata ID (was 5)
      jobTypeIds.push(438); // Full-time - NEW ReferenceMetadata ID (was 1)
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
    jobTypeIds.push(438); // Full-time - NEW ReferenceMetadata ID (was 1)
    
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

    // Default: All types - NEW ReferenceMetadata IDs
    return [443, 444, 442]; // Onsite (443), Remote (444), Hybrid (442) - was [1, 2, 3]
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

      // 🧠 Build a rich set of role titles for multi-title personalization scoring
      // Priority: current work title > profile title > preferred roles > past work titles
      const roleTitlesSet = new Set<string>();
      
      // Current work experience title (highest priority)
      const currentWorkExp = workExperience.find((we: any) => we.IsCurrent);
      if (currentWorkExp?.JobTitle) {
        roleTitlesSet.add(currentWorkExp.JobTitle.trim());
      }
      
      // Profile's current job title
      if (profile.CurrentJobTitle) {
        roleTitlesSet.add(profile.CurrentJobTitle.trim());
      }
      
      // Preferred roles (explicit user intent)
      if (profile.PreferredRoles) {
        profile.PreferredRoles.split(',')
          .map((r: string) => r.trim())
          .filter((r: string) => r.length > 0)
          .forEach((r: string) => roleTitlesSet.add(r));
      }
      
      // Recent past work titles (last 3, most recent first)
      workExperience
        .filter((we: any) => !we.IsCurrent && we.JobTitle)
        .slice(0, 3)
        .forEach((we: any) => roleTitlesSet.add(we.JobTitle.trim()));

      const filters: any = {
        // Experience range - flexible for students and freshers
        // For freshers (0 YOE): show jobs with ExperienceMin <= 2
        experienceMin: Math.max(0, yearsOfExperience - 2),
        experienceMax: yearsOfExperience === 0 ? 2 : yearsOfExperience + 2,
        
        // Job type preferences
        jobTypeIds: this.inferJobTypePreferences(profile, workExperience, education, yearsOfExperience).join(','),
        
        // Workplace preferences
        workplaceTypeIds: this.inferWorkplacePreferences(profile).join(','),
        
        // 🧠 Multi-title personalization: pass all relevant role titles for ORDER BY scoring
        // getJobs will boost jobs matching ANY of these titles (not just the single latestJobTitle)
        preferredRoleTitles: Array.from(roleTitlesSet).slice(0, 5).join('|'),
        
        // Recent jobs (last 30 days)
        postedWithinDays: 30,
        
        // 🎓 Skip fresher filter in AI recommendations - we handle experience filtering explicitly above
        skipFresherFilter: true
      };

      // Remove null/undefined/empty values
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
      jobTypeIds: '438,437', // Full-time (438) and Internship (437) - NEW ReferenceMetadata IDs
      workplaceTypeIds: '443,444,442', // Onsite (443), Remote (444), Hybrid (442) - NEW ReferenceMetadata IDs
      experienceMin: 0,
      experienceMax: 2, // Entry level
      postedWithinDays: 30
    };
  }
}
