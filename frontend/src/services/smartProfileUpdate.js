/**
 * ========================================================================
 * Smart Profile Update Service - React Native Integration
 * ========================================================================
 * 
 * This service automatically routes profile fields to the correct backend
 * endpoints based on which database table they belong to.
 * 
 * Integrates seamlessly with your existing NexHire React Native app.
 * ========================================================================
 */

// Field routing configuration based on your exact database schema
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
    // Privacy settings (THE FIX FOR YOUR ISSUE!)
    'hideCurrentCompany',      // ?? This will now work!
    'hideSalaryDetails',       // ?? This will now work!
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
    // REMOVED: lastJobAppliedAt, searchScore (system-managed fields)
  ]
};

/**
 * Smart profile update service that automatically routes fields to correct endpoints
 */
class SmartProfileUpdateService {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * ?? MAIN FIX: Smart update that routes fields to correct tables
   */
  async updateProfile(userId, profileData) {
    try {
      console.log('Smart Profile Update - Starting...');
      console.log('Input data:', Object.keys(profileData));
      
      // Split data by database table
      const { usersData, applicantsData, unknownFields } = this.routeFields(profileData);
      
      // Log routing results
      if (Object.keys(usersData).length > 0) {
        console.log('Users table fields:', Object.keys(usersData));
      }
      if (Object.keys(applicantsData).length > 0) {
        console.log('Applicants table fields:', Object.keys(applicantsData));
      }
      if (unknownFields.length > 0) {
        console.warn('Unknown fields ignored:', unknownFields);
      }
      
      // Execute updates in parallel
      const updatePromises = [];
      const results = {
        usersUpdated: false,
        applicantsUpdated: false,
        usersData: null,
        applicantsData: null,
        errors: []
      };
      
      // Update Users table if needed
      if (Object.keys(usersData).length > 0) {
        console.log('Updating Users table...');
        updatePromises.push(
          this.updateUsersTable(usersData)
            .then(result => {
              results.usersUpdated = true;
              results.usersData = result;
              console.log('Users table updated successfully');
            })
            .catch(error => {
              console.error('Users table update failed:', error);
              results.errors.push(`Users update failed: ${error.message}`);
            })
        );
      }
      
      // Update Applicants table if needed
      if (Object.keys(applicantsData).length > 0) {
        console.log('Updating Applicants table...');
        updatePromises.push(
          this.updateApplicantsTable(userId, applicantsData)
            .then(result => {
              results.applicantsUpdated = true;
              results.applicantsData = result;
              console.log('Applicants table updated successfully');
            })
            .catch(error => {
              console.error('Applicants table update failed:', error);
              results.errors.push(`Applicants update failed: ${error.message}`);
            })
        );
      }
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      // Summary
      console.log('Smart Profile Update completed:', {
        usersUpdated: results.usersUpdated,
        applicantsUpdated: results.applicantsUpdated,
        errorsCount: results.errors.length
      });
      
      return results;
      
    } catch (error) {
      console.error('Smart Profile Update failed:', error);
      throw new Error(`Profile update failed: ${error.message}`);
    }
  }

  /**
   * Route fields to correct database tables
   */
  routeFields(profileData) {
    const usersData = {};
    const applicantsData = {};
    const unknownFields = [];
    
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
  async updateUsersTable(usersData) {
    const response = await this.apiClient.updateProfile(usersData);
    return response.data || response;
  }

  /**
   * Update Applicants table via /applicants/{userId}/profile endpoint
   */
  async updateApplicantsTable(userId, applicantsData) {
    const response = await this.apiClient.updateApplicantProfile(userId, applicantsData);
    return response.data || response;
  }

  /**
   * Validate field names against known schema
   */
  static validateFields(fields) {
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
 * Enhanced AuthContext methods that use smart routing
 */
export const createSmartAuthMethods = (nexhireAPI, setUser, setError) => {
  const smartProfileService = new SmartProfileUpdateService(nexhireAPI);

  // Create bound methods to avoid context issues
  const updateProfileSmart = async (profileData) => {
    try {
      setError(null);
      console.log('Starting smart profile update...');
      
      const userId = nexhireAPI.getUserIdFromToken();
      if (!userId) {
        throw new Error('User ID not found. Please login again.');
      }
      
      const result = await smartProfileService.updateProfile(userId, profileData);
      
      if (result.errors && result.errors.length > 0) {
        console.warn('Smart update completed with some issues:', result.errors);
        setError(`Profile updated with some issues: ${result.errors.join(', ')}`);
      } else {
        console.log('Smart profile update completed successfully');
      }
      
      // Refresh user data if Users table was updated
      if (result.usersUpdated && result.usersData) {
        setUser(prevUser => ({ ...prevUser, ...result.usersData }));
      }
      
      return {
        success: true,
        message: result.errors.length > 0 
          ? `Profile updated with ${result.errors.length} issues` 
          : 'Profile updated successfully',
        usersUpdated: result.usersUpdated,
        applicantsUpdated: result.applicantsUpdated,
        errors: result.errors
      };
      
    } catch (error) {
      const errorMessage = error.message || 'Smart profile update failed';
      console.error('Smart profile update error:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return {
    /**
     * ?? Smart profile update that fixes the hide current company issue
     */
    updateProfileSmart,

    /**
     * Quick toggle for privacy settings (the main fix!)
     */
    async togglePrivacySetting(setting, value) {
      try {
        console.log(`?? Toggling ${setting} to ${value}...`);
        
        const profileData = { [setting]: value };
        const result = await updateProfileSmart(profileData);
        
        if (result.success) {
          console.log(`? ${setting} toggled successfully to ${value}`);
        }
        
        return result;
      } catch (error) {
        console.error(`? Failed to toggle ${setting}:`, error);
        throw error;
      }
    },

    /**
     * Bulk profile update with smart routing
     */
    async updateCompleteProfile(profileData) {
      console.log('Updating complete profile with smart routing...');
      return await updateProfileSmart(profileData);
    }
  };
};

/**
 * React Native hook for smart profile updates
 */
export const useSmartProfile = (nexhireAPI, user, setUser, setError) => {
  // Get the bound smart methods
  const smartMethods = createSmartAuthMethods(nexhireAPI, setUser, setError);

  // Return properly bound methods
  return {
    updateProfile: smartMethods.updateProfileSmart,
    togglePrivacySetting: smartMethods.togglePrivacySetting,
    updateCompleteProfile: smartMethods.updateCompleteProfile,
    validateFields: (fields) => SmartProfileUpdateService.validateFields(fields),
    getFieldRouting: () => SmartProfileUpdateService.getFieldRouting(),
    user,
    isAuthenticated: !!user
  };
};

/**
 * Convenience function for direct use
 */
export const updateUserProfileSmart = async (nexhireAPI, userId, profileData) => {
  const service = new SmartProfileUpdateService(nexhireAPI);
  return service.updateProfile(userId, profileData);
};

export { SmartProfileUpdateService, FIELD_ROUTING };
export default SmartProfileUpdateService;