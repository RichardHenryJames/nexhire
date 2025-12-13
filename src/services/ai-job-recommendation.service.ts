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
   * 🧠 ENHANCED: Intelligently extract skills, job domains, and keywords from:
   * - ALL job titles in work history (not just current)
   * - Job descriptions/responsibilities from work experience
   * - Education branch/major to infer domain expertise
   * - PrimarySkills field
   * - Preferred roles
   */
  private static extractSkillsAndKeywords(profile: any, workExperience: any[], education: any[]): string[] {
    const keywordsSet = new Set<string>();
    
    // 1️⃣ Extract from ALL job titles in work history (weighted by recency)
    if (workExperience && workExperience.length > 0) {
      workExperience.forEach((exp, index) => {
        if (exp.JobTitle) {
          // Add full job title
          keywordsSet.add(exp.JobTitle.trim());
          
          // Extract role keywords from job title (e.g., "Senior Software Engineer" → "Software Engineer", "Senior")
          const titleTokens = this.extractRoleTokens(exp.JobTitle);
          titleTokens.forEach(token => keywordsSet.add(token));
        }
        
        // Extract skills from job description/responsibilities
        if (exp.Responsibilities) {
          const techSkills = this.extractTechSkillsFromText(exp.Responsibilities);
          techSkills.forEach(skill => keywordsSet.add(skill));
        }
        
        // Add company domain if recognizable (e.g., Google → Software, Goldman Sachs → Finance)
        if (exp.CompanyName) {
          const domain = this.inferCompanyDomain(exp.CompanyName);
          if (domain) keywordsSet.add(domain);
        }
      });
    }
    
    // 2️⃣ Analyze education branch/major to infer job domains
    if (education && education.length > 0) {
      education.forEach(edu => {
        // Extract from Field of Study (e.g., "Computer Science", "Electrical Engineering")
        if (edu.FieldOfStudy) {
          const domains = this.mapEducationToDomains(edu.FieldOfStudy);
          domains.forEach(domain => keywordsSet.add(domain));
        }
        
        // Extract from Specialization (e.g., "Machine Learning", "Data Science")
        if (edu.Specialization) {
          keywordsSet.add(edu.Specialization.trim());
          
          // Also extract tech keywords from specialization
          const techSkills = this.extractTechSkillsFromText(edu.Specialization);
          techSkills.forEach(skill => keywordsSet.add(skill));
        }
        
        // Extract from University/College name for domain hints
        if (edu.InstitutionName) {
          const domain = this.inferInstitutionDomain(edu.InstitutionName);
          if (domain) keywordsSet.add(domain);
        }
      });
    }
    
    // 3️⃣ Add explicit skills from profile (PrimarySkills field)
    if (profile.Skills) {
      const skills = profile.Skills.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      skills.forEach(skill => keywordsSet.add(skill));
    }
    
    // 4️⃣ Add current job title from profile (highest weight)
    if (profile.CurrentJobTitle) {
      keywordsSet.add(profile.CurrentJobTitle.trim());
      const titleTokens = this.extractRoleTokens(profile.CurrentJobTitle);
      titleTokens.forEach(token => keywordsSet.add(token));
    }
    
    // 5️⃣ Add preferred roles (explicit user intent)
    if (profile.PreferredRoles) {
      const roles = profile.PreferredRoles.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
      roles.forEach(role => {
        keywordsSet.add(role);
        const roleTokens = this.extractRoleTokens(role);
        roleTokens.forEach(token => keywordsSet.add(token));
      });
    }
    
    // Convert Set to Array and filter out noise
    return Array.from(keywordsSet)
      .filter(kw => kw.length >= 2) // Remove single-char noise
      .filter(kw => !this.isNoiseWord(kw)) // Remove common noise words
      .slice(0, 20); // Limit to top 20 most relevant keywords
  }
  
  /**
   * Extract role tokens from job title
   * E.g., "Senior Software Engineer" → ["Senior", "Software Engineer", "Software", "Engineer"]
   */
  private static extractRoleTokens(title: string): string[] {
    const tokens: string[] = [];
    const normalized = title.trim();
    
    // Common role modifiers
    const modifiers = ['Senior', 'Junior', 'Lead', 'Principal', 'Staff', 'Associate', 'Chief', 'Head of', 'VP of', 'Director of'];
    modifiers.forEach(mod => {
      if (normalized.includes(mod)) {
        tokens.push(mod);
      }
    });
    
    // Core role (remove modifiers)
    let coreRole = normalized;
    modifiers.forEach(mod => {
      coreRole = coreRole.replace(new RegExp(mod, 'gi'), '').trim();
    });
    
    if (coreRole && coreRole.length > 3) {
      tokens.push(coreRole);
      
      // Also split core role into components (e.g., "Software Engineer" → "Software", "Engineer")
      const components = coreRole.split(/\s+/).filter(c => c.length > 3);
      tokens.push(...components);
    }
    
    return tokens;
  }
  
  /**
   * Extract technical skills from text (job description, responsibilities, education)
   * Matches common tech keywords
   */
  private static extractTechSkillsFromText(text: string): string[] {
    const skills: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Tech skill patterns (comprehensive list)
    const techKeywords = [
      // Programming Languages
      'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'ruby', 'go', 'rust', 'kotlin', 'swift', 'php', 'scala', 'r',
      // Frontend
      'react', 'angular', 'vue', 'nextjs', 'svelte', 'html', 'css', 'sass', 'tailwind', 'bootstrap', 'webpack',
      // Backend
      'nodejs', 'node.js', 'express', 'django', 'flask', 'spring', 'asp.net', 'laravel', 'fastapi', 'graphql', 'rest', 'api',
      // Databases
      'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'oracle',
      // Cloud & DevOps
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible', 'ci/cd', 'devops',
      // Data Science & AI
      'machine learning', 'deep learning', 'ai', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'nlp', 'computer vision',
      // Mobile
      'ios', 'android', 'react native', 'flutter', 'xamarin', 'mobile development',
      // Other
      'git', 'agile', 'scrum', 'microservices', 'blockchain', 'security', 'testing', 'automation'
    ];
    
    techKeywords.forEach(keyword => {
      const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
      if (pattern.test(lowerText)) {
        // Capitalize first letter for consistency
        skills.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    });
    
    return skills;
  }
  
  /**
   * Map education field of study to relevant job domains
   * E.g., "Computer Science" → ["Software Development", "IT", "Programming", "Tech"]
   */
  private static mapEducationToDomains(fieldOfStudy: string): string[] {
    const domains: string[] = [];
    const field = fieldOfStudy.toLowerCase();
    
    // CS/IT related
    if (field.includes('computer') || field.includes('software') || field.includes('information technology')) {
      domains.push('Software Development', 'IT', 'Tech', 'Programming');
    }
    
    // Data Science/Analytics
    if (field.includes('data science') || field.includes('analytics') || field.includes('statistics')) {
      domains.push('Data Science', 'Analytics', 'Machine Learning', 'AI');
    }
    
    // Electronics/Electrical
    if (field.includes('electronic') || field.includes('electrical')) {
      domains.push('Electronics', 'Hardware', 'Embedded Systems', 'IoT');
    }
    
    // Mechanical
    if (field.includes('mechanical')) {
      domains.push('Mechanical Engineering', 'Manufacturing', 'CAD', 'Design');
    }
    
    // Business/Management
    if (field.includes('business') || field.includes('management') || field.includes('mba')) {
      domains.push('Management', 'Business Analysis', 'Strategy', 'Operations');
    }
    
    // Finance/Economics
    if (field.includes('finance') || field.includes('economics') || field.includes('accounting')) {
      domains.push('Finance', 'Accounting', 'Banking', 'Investment');
    }
    
    // Marketing/Sales
    if (field.includes('marketing') || field.includes('sales')) {
      domains.push('Marketing', 'Sales', 'Digital Marketing', 'Growth');
    }
    
    // Design
    if (field.includes('design') || field.includes('arts') || field.includes('ui') || field.includes('ux')) {
      domains.push('Design', 'UX', 'UI', 'Graphics', 'Creative');
    }
    
    return domains;
  }
  
  /**
   * Infer company domain from company name
   * E.g., "Google" → "Tech", "Goldman Sachs" → "Finance"
   */
  private static inferCompanyDomain(companyName: string): string | null {
    const name = companyName.toLowerCase();
    
    // Tech giants
    if (name.includes('google') || name.includes('microsoft') || name.includes('amazon') || 
        name.includes('facebook') || name.includes('meta') || name.includes('apple') ||
        name.includes('netflix') || name.includes('uber') || name.includes('airbnb')) {
      return 'Tech';
    }
    
    // Finance
    if (name.includes('goldman') || name.includes('jpmorgan') || name.includes('morgan stanley') ||
        name.includes('bank') || name.includes('capital') || name.includes('finance')) {
      return 'Finance';
    }
    
    // Consulting
    if (name.includes('mckinsey') || name.includes('bain') || name.includes('bcg') ||
        name.includes('deloitte') || name.includes('accenture') || name.includes('consulting')) {
      return 'Consulting';
    }
    
    return null;
  }
  
  /**
   * Infer domain from institution name
   * E.g., "MIT" → "Tech", "IIT" → "Tech", "IIM" → "Management"
   */
  private static inferInstitutionDomain(institutionName: string): string | null {
    const name = institutionName.toLowerCase();
    
    // Top tech schools
    if (name.includes('iit') || name.includes('mit') || name.includes('stanford') ||
        name.includes('carnegie') || name.includes('berkeley') || name.includes('caltech')) {
      return 'Tech';
    }
    
    // Top business schools
    if (name.includes('iim') || name.includes('harvard business') || name.includes('wharton') ||
        name.includes('insead') || name.includes('kellogg')) {
      return 'Management';
    }
    
    return null;
  }
  
  /**
   * Check if word is noise (common filler words to exclude)
   */
  private static isNoiseWord(word: string): boolean {
    const noiseWords = ['and', 'or', 'the', 'of', 'in', 'at', 'to', 'for', 'with', 'on', 'as', 'by', 'from', 'up', 'about', 'into', 'through', 'during'];
    return noiseWords.includes(word.toLowerCase());
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
      
      // Skills and role-based search (ENHANCED: includes education analysis)
      search: this.extractSkillsAndKeywords(profile, workExperience, education).join(' '),
      
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
      jobTypeIds: '438,437', // Full-time (438) and Internship (437) - NEW ReferenceMetadata IDs
      workplaceTypeIds: '443,444,442', // Onsite (443), Remote (444), Hybrid (442) - NEW ReferenceMetadata IDs
      experienceMin: 0,
      experienceMax: 2, // Entry level
      postedWithinDays: 30
    };
  }
}
