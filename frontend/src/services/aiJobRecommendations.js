/**
 * AI-Powered Job Recommendations Service
 * Intelligently analyzes user profile and generates personalized job filters
 */

import refopenAPI from './api';

class AIJobRecommendationsService {
  /**
   * Fetch user's complete profile data
   */
  async getUserProfile(userId) {
    try {
      const profileRes = await refopenAPI.getApplicantProfile(userId);
      if (profileRes.success && profileRes.data) {
        return profileRes.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Extract years of experience from work history
   */
  calculateExperience(workExperience) {
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
   * Extract current/latest job title and skills
   */
  extractCurrentJobInfo(workExperience) {
    if (!workExperience || workExperience.length === 0) {
      return { currentRole: null, skills: [] };
    }

    // Sort by start date, most recent first
    const sorted = [...workExperience].sort((a, b) => {
      const dateA = new Date(a.StartDate || 0);
      const dateB = new Date(b.StartDate || 0);
      return dateB - dateA;
    });

    const latest = sorted[0];
    return {
      currentRole: latest.JobTitle || latest.Position,
      company: latest.CompanyName,
      isCurrentlyWorking: !latest.EndDate || latest.IsCurrent
    };
  }

  /**
   * Infer job type preferences based on profile
   */
  inferJobTypePreferences(profile) {
    const jobTypeIds = [];
    const preferences = profile.JobPreferences || {};
    const workExperience = profile.WorkExperience || [];
    const education = profile.Education || [];
    const yearsOfExperience = this.calculateExperience(workExperience);

    // 🎓 SMART: Check if user is a student
    const isCurrentStudent = education.some(edu => {
      // Check if education end date is in future or missing (indicating current student)
      const endDate = edu.EndDate ? new Date(edu.EndDate) : null;
      const now = new Date();
      return !endDate || endDate > now;
    });

    // 🎓 Check if recent graduate (graduated within last 2 years)
    const isRecentGraduate = education.some(edu => {
      const endDate = edu.EndDate ? new Date(edu.EndDate) : null;
      if (!endDate) return false;
      const monthsSinceGrad = (new Date() - endDate) / (1000 * 60 * 60 * 24 * 30);
      return monthsSinceGrad >= 0 && monthsSinceGrad <= 24;
    });

    // 🎓 For students or fresh graduates with no experience
    if ((isCurrentStudent || yearsOfExperience === 0 || isRecentGraduate) && workExperience.length === 0) {
      jobTypeIds.push(5); // Internship - highest priority
      jobTypeIds.push(1); // Full-time entry level
      jobTypeIds.push(3); // Part-time
      return jobTypeIds;
    }

    // Full-time (ID: 1) - default if working experience exists
    if (workExperience.length > 0 || yearsOfExperience > 0) {
      jobTypeIds.push(1);
    }

    // Contract (ID: 2) - if user has contract experience or preferences
    if (preferences.PreferredJobType?.includes('Contract') || 
        workExperience.some(exp => exp.JobTitle?.toLowerCase().includes('contract'))) {
      jobTypeIds.push(2);
    }

    // Part-time (ID: 3) - if student or preference
    if (isCurrentStudent || preferences.PreferredJobType?.includes('Part-time')) {
      jobTypeIds.push(3);
    }

    // Freelance (ID: 4) - if preference or freelance experience
    if (preferences.PreferredJobType?.includes('Freelance') || 
        workExperience.some(exp => exp.JobTitle?.toLowerCase().includes('freelance'))) {
      jobTypeIds.push(4);
    }

    // Internship (ID: 5) - if student or recent grad with < 1 year exp
    if (isCurrentStudent || isRecentGraduate || yearsOfExperience < 1) {
      jobTypeIds.push(5);
    }

    // Default to Full-time and Internship if none matched
    return jobTypeIds.length > 0 ? jobTypeIds : [1, 5];
  }

  /**
   * Infer workplace type preferences
   */
  inferWorkplacePreferences(profile) {
    const workplaceTypeIds = [];
    const preferences = profile.JobPreferences || {};

    // Remote (ID: 3) - if preference exists
    if (preferences.PreferredWorkTypes?.includes('Remote') || 
        preferences.PreferredWorkTypes?.includes('remote')) {
      workplaceTypeIds.push(3);
    }

    // Hybrid (ID: 2) - if preference exists
    if (preferences.PreferredWorkTypes?.includes('Hybrid') || 
        preferences.PreferredWorkTypes?.includes('hybrid')) {
      workplaceTypeIds.push(2);
    }

    // Onsite (ID: 1) - if preference exists or no preference
    if (preferences.PreferredWorkTypes?.includes('Onsite') || 
        preferences.PreferredWorkTypes?.includes('onsite') ||
        workplaceTypeIds.length === 0) {
      workplaceTypeIds.push(1);
    }

    return workplaceTypeIds;
  }

  /**
   * Extract salary expectations
   */
  inferSalaryRange(profile, yearsOfExperience) {
    const preferences = profile.JobPreferences || {};
    const education = profile.Education || [];
    
    // Check if user is a student or fresh graduate
    const isCurrentStudent = education.some(edu => {
      const endDate = edu.EndDate ? new Date(edu.EndDate) : null;
      return !endDate || endDate > new Date();
    });

    // If user has explicitly mentioned expected salary
    if (preferences.ExpectedSalary || preferences.DesiredSalary) {
      const expected = preferences.ExpectedSalary || preferences.DesiredSalary;
      return {
        salaryMin: Math.floor(expected * 0.8), // 20% below expected
        salaryMax: Math.ceil(expected * 1.2)   // 20% above expected
      };
    }

    // If user has current salary in latest work experience
    const workExperience = profile.WorkExperience || [];
    if (workExperience.length > 0) {
      const latest = workExperience.sort((a, b) => 
        new Date(b.StartDate || 0) - new Date(a.StartDate || 0)
      )[0];
      
      if (latest.Salary || latest.CurrentSalary) {
        const current = latest.Salary || latest.CurrentSalary;
        return {
          salaryMin: Math.floor(current * 1.1), // 10% hike minimum
          salaryMax: Math.ceil(current * 1.5)   // 50% hike maximum
        };
      }
    }

    // 🎓 SMART: Adjust salary based on education level and student status
    let baseEstimates = {
      0: { min: 300000, max: 600000 },      // Fresher: 3-6 LPA
      1: { min: 400000, max: 800000 },      // 1 year: 4-8 LPA
      2: { min: 600000, max: 1200000 },     // 2 years: 6-12 LPA
      3: { min: 800000, max: 1500000 },     // 3 years: 8-15 LPA
      5: { min: 1200000, max: 2500000 },    // 5 years: 12-25 LPA
      7: { min: 1800000, max: 3500000 },    // 7 years: 18-35 LPA
      10: { min: 2500000, max: 5000000 }    // 10+ years: 25-50 LPA
    };

    // 🎓 If student or no experience, check education level
    if ((isCurrentStudent || yearsOfExperience === 0) && education.length > 0) {
      const latestEducation = education.sort((a, b) => 
        new Date(b.StartDate || 0) - new Date(a.StartDate || 0)
      )[0];

      const degree = (latestEducation.Degree || latestEducation.EducationLevel || '').toLowerCase();
      
      // PhD/Masters - higher starting salary
      if (degree.includes('phd') || degree.includes('doctorate')) {
        return { min: 600000, max: 1200000 }; // 6-12 LPA for PhD
      }
      if (degree.includes('master') || degree.includes('m.tech') || degree.includes('mba')) {
        return { min: 500000, max: 1000000 }; // 5-10 LPA for Masters
      }
      // Bachelor's - standard fresher salary
      if (degree.includes('bachelor') || degree.includes('b.tech') || degree.includes('b.e') || degree.includes('bca')) {
        return { min: 300000, max: 600000 }; // 3-6 LPA for Bachelor's
      }
      // Diploma or below
      if (degree.includes('diploma') || degree.includes('12th') || degree.includes('intermediate')) {
        return { min: 200000, max: 400000 }; // 2-4 LPA for Diploma
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

    return baseEstimates[bracket];
  }

  /**
   * Extract location preferences
   */
  inferLocationPreferences(profile) {
    const preferences = profile.JobPreferences || {};
    
    // Preferred locations from job preferences
    if (preferences.PreferredLocations && preferences.PreferredLocations.length > 0) {
      return preferences.PreferredLocations[0]; // Return first preferred location
    }

    // Current location from profile
    if (profile.City || profile.Location) {
      return profile.City || profile.Location;
    }

    // Last work location
    const workExperience = profile.WorkExperience || [];
    if (workExperience.length > 0) {
      const latest = workExperience.sort((a, b) => 
        new Date(b.StartDate || 0) - new Date(a.StartDate || 0)
      )[0];
      
      if (latest.Location || latest.City) {
        return latest.Location || latest.City;
      }
    }

    return null;
  }

  /**
   * Extract current role keywords for role-aligned search
   */
  extractRoleKeywords(currentJobInfo) {
    if (!currentJobInfo?.currentRole) return [];
    
    const role = currentJobInfo.currentRole.toLowerCase();
    const keywords = [];
    
    // Extract the core role from job title (remove seniority levels)
    let coreRole = role
      .replace(/\b(senior|sr|junior|jr|lead|principal|staff|associate|intern|trainee|entry[ -]level)\b/gi, '')
      .trim();
    
    // Add the core role
    if (coreRole) {
      keywords.push(coreRole);
    }
    
    // Add the full title
    keywords.push(currentJobInfo.currentRole);
    
    return keywords;
  }

  /**
   * Extract skills and keywords for search - SMART role-aligned matching
   */
  extractSkillsAndKeywords(profile, currentJobInfo) {
    const keywords = [];
    const priorityWeight = new Map(); // Track importance of each keyword
    const education = profile.Education || [];
    const workExperience = profile.WorkExperience || [];
    
    // 1. HIGHEST PRIORITY: Current/Latest Job Title (most relevant for role alignment)
    if (currentJobInfo?.currentRole) {
      const roleKeywords = this.extractRoleKeywords(currentJobInfo);
      roleKeywords.forEach(keyword => {
        if (!keywords.includes(keyword)) {
          keywords.push(keyword);
          priorityWeight.set(keyword.toLowerCase(), 10); // Highest weight
        }
      });
    }

    // 2. HIGH PRIORITY: Primary technical skills from profile
    if (profile.Skills && Array.isArray(profile.Skills)) {
      profile.Skills.slice(0, 8).forEach(skill => { // Take top 8 skills
        const skillName = skill.SkillName || skill.Name;
        if (skillName && !keywords.includes(skillName)) {
          keywords.push(skillName);
          priorityWeight.set(skillName.toLowerCase(), 8);
        }
      });
    }

    // 3. MEDIUM PRIORITY: Skills from recent work experience
    if (workExperience.length > 0) {
      // Sort by most recent
      const sorted = [...workExperience].sort((a, b) => 
        new Date(b.StartDate || 0) - new Date(a.StartDate || 0)
      );
      
      // Take skills from 2 most recent jobs
      sorted.slice(0, 2).forEach(exp => {
        if (exp.Skills) {
          const expSkills = typeof exp.Skills === 'string' 
            ? exp.Skills.split(',').map(s => s.trim()) 
            : exp.Skills;
          
          expSkills.slice(0, 5).forEach(skill => {
            if (skill && !keywords.includes(skill)) {
              keywords.push(skill);
              priorityWeight.set(skill.toLowerCase(), 6);
            }
          });
        }
      });
    }

    // 4. LOW PRIORITY: Education field (only for students/freshers)
    const yearsOfExperience = this.calculateExperience(workExperience);
    if (yearsOfExperience < 2 && education.length > 0) {
      // Sort by most recent
      const sorted = [...education].sort((a, b) => 
        new Date(b.StartDate || 0) - new Date(a.StartDate || 0)
      );
      
      sorted.forEach((edu, index) => {
        // Field of study for most recent education
        if (index === 0) {
          if (edu.FieldOfStudy && !keywords.includes(edu.FieldOfStudy)) {
            keywords.push(edu.FieldOfStudy);
            priorityWeight.set(edu.FieldOfStudy.toLowerCase(), 4);
          }
          if (edu.Major && !keywords.includes(edu.Major)) {
            keywords.push(edu.Major);
            priorityWeight.set(edu.Major.toLowerCase(), 4);
          }
        }
        
        // Add specialization
        if (edu.Specialization && !keywords.includes(edu.Specialization)) {
          keywords.push(edu.Specialization);
          priorityWeight.set(edu.Specialization.toLowerCase(), 3);
        }
      });
    }

    // 5. FALLBACK: If no meaningful keywords, add generic based on education
    if (keywords.length === 0 && workExperience.length === 0 && education.length > 0) {
      const isStudent = education.some(edu => {
        const endDate = edu.EndDate ? new Date(edu.EndDate) : null;
        return !endDate || endDate > new Date();
      });

      if (isStudent) {
        keywords.push('Entry Level', 'Fresher', 'Graduate');
        
        // Add field of study from latest education
        const latest = education.sort((a, b) => 
          new Date(b.StartDate || 0) - new Date(a.StartDate || 0)
        )[0];
        
        if (latest.FieldOfStudy) keywords.push(latest.FieldOfStudy);
        if (latest.Major) keywords.push(latest.Major);
      }
    }

    // Return sorted by priority (role-aligned keywords first)
    const uniqueKeywords = [...new Set(keywords)]; // Remove duplicates
    return uniqueKeywords
      .sort((a, b) => {
        const weightA = priorityWeight.get(a.toLowerCase()) || 0;
        const weightB = priorityWeight.get(b.toLowerCase()) || 0;
        return weightB - weightA;
      })
      .slice(0, 10); // Top 10 most relevant keywords
  }

  /**
   * Main method: Generate AI-powered job filters
   */
  async generateJobFilters(userId) {
    console.log('🤖 AI: Starting personalized job recommendation analysis...');
    
    try {
      // Step 1: Fetch user profile
      const profile = await this.getUserProfile(userId);
      
      if (!profile) {
        console.warn('🤖 AI: No profile data available, using smart defaults for new users');
        return this.getSmartDefaultFilters();
      }

      console.log('🤖 AI: Profile fetched successfully');

      // Step 2: Analyze experience
      const workExperience = profile.WorkExperience || [];
      const education = profile.Education || [];
      const yearsOfExperience = this.calculateExperience(workExperience);
      const currentJobInfo = this.extractCurrentJobInfo(workExperience);

      // 🎓 SMART: Detect if user is a student
      const isCurrentStudent = education.some(edu => {
        const endDate = edu.EndDate ? new Date(edu.EndDate) : null;
        return !endDate || endDate > new Date();
      });

      console.log(`🤖 AI: Detected ${yearsOfExperience} years of experience`);
      if (isCurrentStudent) {
        console.log('🤖 AI: User identified as current student - prioritizing internships and entry-level');
      }
      if (currentJobInfo.currentRole) {
        console.log(`🤖 AI: Current role - ${currentJobInfo.currentRole}`);
      }

      // Step 3: Build intelligent filters
      const filters = {
        // Experience range - be flexible for students and freshers
        experienceMin: Math.max(0, yearsOfExperience - 2),
        experienceMax: yearsOfExperience === 0 ? 2 : yearsOfExperience + 2,
        
        // Job type preferences - smart detection for students
        jobTypeIds: this.inferJobTypePreferences(profile).join(','),
        
        // Workplace preferences
        workplaceTypeIds: this.inferWorkplacePreferences(profile).join(','),
        
        // Salary expectations - education-aware
        ...this.inferSalaryRange(profile, yearsOfExperience),
        
        // Location preference
        location: this.inferLocationPreferences(profile),
        
        // 🚀 SMART: Role-aligned search keywords (current role gets highest priority)
        search: this.extractSkillsAndKeywords(profile, currentJobInfo).join(' '),
        
        // Always fetch recent jobs (last 30 days for personalized)
        postedWithinDays: 30
      };

      // Remove null/undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === null || filters[key] === undefined || filters[key] === '') {
          delete filters[key];
        }
      });

      console.log('🤖 AI: Generated personalized filters:', filters);

      return filters;

    } catch (error) {
      console.error('🤖 AI: Error generating job filters:', error);
      return this.getSmartDefaultFilters();
    }
  }

  /**
   * Fallback smart default filters (for new users or errors)
   */
  getSmartDefaultFilters() {
    return {
      jobTypeIds: '1,5', // Full-time and Internship (covers most users)
      workplaceTypeIds: '1,2,3', // All workplace types
      experienceMin: 0,
      experienceMax: 2, // Entry level to junior
      postedWithinDays: 30
    };
  }

  /**
   * Fetch AI-recommended jobs
   */
  async getPersonalizedJobs(userId, pageSize = 5) {
    console.log('🤖 AI: Fetching personalized job recommendations...');
    
    try {
      // Generate smart filters
      const filters = await this.generateJobFilters(userId);
      
      // Fetch jobs with AI-generated filters
      const result = await refopenAPI.getJobs(1, pageSize, filters);
      
      if (result.success && result.data) {
        console.log(`🤖 AI: Found ${result.data.length} personalized jobs`);
        return {
          success: true,
          jobs: result.data,
          filters: filters // Return filters for debugging
        };
      }
      
      return { success: false, jobs: [], filters: filters };
      
    } catch (error) {
      console.error('🤖 AI: Error fetching personalized jobs:', error);
      return { success: false, jobs: [], error: error.message };
    }
  }

  /**
   * Get explanation of why jobs were recommended
   */
  getRecommendationReason(profile, filters) {
    const reasons = [];
    
    if (filters.experienceMin !== undefined) {
      reasons.push(`${filters.experienceMin}-${filters.experienceMax} years experience match`);
    }
    
    if (filters.location) {
      reasons.push(`Located in ${filters.location}`);
    }
    
    if (filters.search) {
      const skills = filters.search.split(' ').slice(0, 3).join(', ');
      reasons.push(`Skills: ${skills}`);
    }
    
    return reasons.length > 0 
      ? `AI matched based on: ${reasons.join(' • ')}` 
      : 'AI-powered personalized recommendation';
  }
}

// Export singleton instance
const aiJobRecommendations = new AIJobRecommendationsService();
export default aiJobRecommendations;
