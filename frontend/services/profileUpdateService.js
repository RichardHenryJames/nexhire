/**
 * ========================================================================
 * Smart Profile Update Utility
 * ========================================================================
 * 
 * This utility automatically routes profile fields to the correct backend
 * endpoints based on which database table they belong to.
 * 
 * Usage:
 * import { updateUserProfile } from './profileUpdateService';
 * await updateUserProfile(userId, { profileVisibility: 'Private', hideCurrentCompany: true });
 * 
 * ========================================================================
 */

// Field routing configuration based on database schema
const FIELD_ROUTING = {
  // Users table fields - handled by /users/profile endpoint
  USERS_TABLE: [
    'firstName',
    'lastName', 
    'phone',
    'dateOfBirth',
    'gender',
    'profilePictureURL',
    'profileVisibility'
  ],
  
  // Applicants table fields - handled by /applicants/{userId}/profile endpoint
  APPLICANTS_TABLE: [
    // Privacy settings
    'hideCurrentCompany',
    'hideSalaryDetails', 
    'allowRecruitersToContact',
    'isOpenToWork',
    
    // Professional information
    'headline',
    'summary',
    'currentJobTitle',
    'currentCompany',
    'yearsOfExperience',
    'noticePeriod',
    'currentSalary',
    'currentSalaryUnit',
    'currentCurrencyID',
    
    // Skills and experience
    'primarySkills',
    'secondarySkills',
    'languages',
    'certifications',
    'workExperience',
    
    // Education (can also be updated via applicants endpoint)
    'institution',
    'highestEducation',
    'fieldOfStudy',
    
    // Job preferences
    'preferredJobTypes',
    'preferredWorkTypes',
    'preferredLocations',
    'expectedSalaryMin',
    'expectedSalaryMax',
    'preferredRoles',
    'preferredIndustries',
    
    // Location and availability
    'nationality',
    'currentLocation',
    'immediatelyAvailable',
    'willingToRelocate',
    'jobSearchStatus',
    
    // Social profiles
    'linkedInProfile',
    'githubProfile',
    
    // Documents
    'primaryResumeURL',
    'additionalDocuments',
    
    // Status fields
    'isFeatured',
    'featuredUntil',
    'tags'
  ]
};

interface ProfileUpdateResponse {
  usersUpdated: boolean;
  applicantsUpdated: boolean;
  usersData?: any;
  applicantsData?: any;
  errors?: string[];
}

interface APIClient {
  put: (url: string, data: any) => Promise<any>;
  get: (url: string) => Promise<any>;
}

/**
 * Smart profile update service that automatically routes fields to correct endpoints
 */
export class ProfileUpdateService {
  private apiClient: APIClient;
  
  constructor(apiClient: APIClient) {
    this.apiClient = apiClient;
  }

  /**
   * Main profile update method - automatically routes fields to correct endpoints
   */
  async updateProfile(userId: string, profileData: Record<string, any>): Promise<ProfileUpdateResponse> {
    try {
      
      // Split data by database table
      const { usersData, applicantsData, unknownFields } = this.routeFields(profileData);
      
      // Log routing results
      if (unknownFields.length > 0) {
        console.warn('Unknown fields ignored:', unknownFields);
      }
      
      // Execute updates in parallel
      const updatePromises: Promise<any>[] = [];
      const results: ProfileUpdateResponse = {
        usersUpdated: false,
        applicantsUpdated: false,
        errors: []
      };
      
      // Update Users table if needed
      if (Object.keys(usersData).length > 0) {
        updatePromises.push(
          this.updateUsersTable(usersData)
            .then(result => {
              results.usersUpdated = true;
              results.usersData = result;
            })
            .catch(error => {
              console.error('Users table update failed:', error);
              results.errors!.push(`Users update failed: ${error.message}`);
            })
        );
      }
      
      // Update Applicants table if needed
      if (Object.keys(applicantsData).length > 0) {
        updatePromises.push(
          this.updateApplicantsTable(userId, applicantsData)
            .then(result => {
              results.applicantsUpdated = true;
              results.applicantsData = result;
            })
            .catch(error => {
              console.error('Applicants table update failed:', error);
              results.errors!.push(`Applicants update failed: ${error.message}`);
            })
        );
      }
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      
      return results;
      
    } catch (error) {
      console.error('Profile update failed:', error);
      throw new Error(`Profile update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Route fields to correct database tables
   */
  private routeFields(profileData: Record<string, any>) {
    const usersData: Record<string, any> = {};
    const applicantsData: Record<string, any> = {};
    const unknownFields: string[] = [];
    
    Object.keys(profileData).forEach(field => {
      if (FIELD_ROUTING.USERS_TABLE.includes(field)) {
        usersData[field] = profileData[field];
      } else if (FIELD_ROUTING.APPLICANTS_TABLE.includes(field)) {
        applicantsData[field] = profileData[field];
      } else {
        unknownFields.push(field);
      }
    });
    
    return { usersData, applicantsData, unknownFields };
  }

  /**
   * Update Users table via /users/profile endpoint
   */
  private async updateUsersTable(usersData: Record<string, any>) {
    const response = await this.apiClient.put('/users/profile', usersData);
    return response.data || response;
  }

  /**
   * Update Applicants table via /applicants/{userId}/profile endpoint
   */
  private async updateApplicantsTable(userId: string, applicantsData: Record<string, any>) {
    const response = await this.apiClient.put(`/applicants/${userId}/profile`, applicantsData);
    return response.data || response;
  }

  /**
   * Get complete user profile from both tables
   */
  async getCompleteProfile(userId: string) {
    try {
      
      const promises = [
        this.apiClient.get('/users/profile'),
        this.apiClient.get(`/applicants/${userId}/profile`)
      ];
      
      const [usersProfile, applicantsProfile] = await Promise.all(promises);
      
      return {
        ...usersProfile.data || usersProfile,
        ...applicantsProfile.data || applicantsProfile
      };
      
    } catch (error) {
      console.error('Failed to fetch complete profile:', error);
      throw error;
    }
  }

  /**
   * Validate field names against known schema
   */
  static validateFields(fields: string[]): { valid: string[]; invalid: string[] } {
    const allValidFields = [...FIELD_ROUTING.USERS_TABLE, ...FIELD_ROUTING.APPLICANTS_TABLE];
    
    const valid = fields.filter(field => allValidFields.includes(field));
    const invalid = fields.filter(field => !allValidFields.includes(field));
    
    return { valid, invalid };
  }

  /**
   * Get field routing information
   */
  static getFieldRouting() {
    return {
      usersFields: FIELD_ROUTING.USERS_TABLE,
      applicantsFields: FIELD_ROUTING.APPLICANTS_TABLE,
      totalFields: FIELD_ROUTING.USERS_TABLE.length + FIELD_ROUTING.APPLICANTS_TABLE.length
    };
  }
}

/**
 * Convenience function for direct use
 */
export async function updateUserProfile(
  apiClient: APIClient, 
  userId: string, 
  profileData: Record<string, any>
): Promise<ProfileUpdateResponse> {
  const service = new ProfileUpdateService(apiClient);
  return service.updateProfile(userId, profileData);
}

/**
 * React hook for profile updates (if using React)
 */
export function useProfileUpdate(apiClient: APIClient) {
  const updateProfile = async (userId: string, profileData: Record<string, any>) => {
    return updateUserProfile(apiClient, userId, profileData);
  };

  const validateFields = (fields: string[]) => {
    return ProfileUpdateService.validateFields(fields);
  };

  const getFieldRouting = () => {
    return ProfileUpdateService.getFieldRouting();
  };

  return {
    updateProfile,
    validateFields,
    getFieldRouting
  };
}

export default ProfileUpdateService;