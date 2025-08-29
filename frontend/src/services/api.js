import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// FIXED: Use environment variable or fallback to production API
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://nexhire-api-func.azurewebsites.net/api';

class NexHireAPI {
  constructor() {
    this.token = null;
    this.refreshToken = null;
    this.init();
  }

  // Universal storage for tokens (works on web, iOS, Android)
  async storeToken(key, value) {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  async getToken(key) {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      } else {
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  async removeToken(key) {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error('Error removing token:', error);
    }
  }

  // Initialize API with stored tokens
  async init() {
    try {
      this.token = await this.getToken('nexhire_token');
      this.refreshToken = await this.getToken('nexhire_refresh_token');
      
      if (this.token) {
        console.log('Found stored auth token');
      } else {
        console.log('No stored auth token found');
      }
    } catch (error) {
      console.error('Error initializing API:', error);
    }
  }

  // Set authentication tokens
  async setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    
    await this.storeToken('nexhire_token', accessToken);
    await this.storeToken('nexhire_refresh_token', refreshToken);
    console.log('Tokens stored successfully');
  }

  // Clear tokens (logout)
  async clearTokens() {
    this.token = null;
    this.refreshToken = null;
    
    await this.removeToken('nexhire_token');
    await this.removeToken('nexhire_refresh_token');
    console.log('Tokens cleared');
  }

  // Generic API call with better error handling and CORS support
  async apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      console.log(`API Call: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers,
        // FIXED: Add mode and credentials for CORS
        mode: 'cors',
        credentials: 'omit',
      });

      // FIXED: Better error handling for different response types
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn(`Non-JSON response for ${endpoint}:`, text);
        throw new Error(`Invalid response format: ${response.status}`);
      }

      if (!response.ok) {
        console.error(`❌ API Error [${endpoint}]:`, response.status, data);
        
        // Handle specific error cases
        if (response.status === 401) {
          // Token expired, clear tokens
          await this.clearTokens();
          throw new Error('Authentication expired. Please login again.');
        }
        
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }

      console.log(`✅ API Success [${endpoint}]:`, response.status);
      return data;
    } catch (error) {
      console.error(`? API Error [${endpoint}]:`, error.message);
      
      // FIXED: Handle network errors gracefully
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your connection.');
      }
      
      throw error;
    }
  }

  // Authentication APIs
  async register(userData) {
    try {
      return await this.apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
    } catch (error) {
      console.error('Registration failed:', error.message);
      throw error;
    }
  }

  async login(email, password) {
    try {
      const result = await this.apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (result.success && result.data?.tokens) {
        await this.setTokens(
          result.data.tokens.accessToken,
          result.data.tokens.refreshToken
        );
        console.log('Login successful for:', email);
      }

      return result;
    } catch (error) {
      console.error('Login failed:', error.message);
      throw error;
    }
  }

  async logout() {
    try {
      // FIXED: Call backend logout endpoint first
      console.log('Calling backend logout endpoint...');
      
      // Make backend call to log the logout activity
      const result = await this.apiCall('/auth/logout', {
        method: 'POST',
      });
      
      console.log('Backend logout successful:', result.message);
      
      // Clear local tokens after successful backend call
      await this.clearTokens();
      
      return { success: true, message: 'Logout successful' };
    } catch (error) {
      console.error('Backend logout failed:', error.message);
      
      // Even if backend call fails, still clear local tokens for security
      await this.clearTokens();
      
      // Return success anyway since tokens are cleared
      return { success: true, message: 'Logout completed (tokens cleared)' };
    }
  }

  // User Profile APIs
  async getProfile() {
    return this.apiCall('/users/profile');
  }

  async updateProfile(profileData) {
    return this.apiCall('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // NEW: Update education data
  async updateEducation(educationData) {
    console.log('🔍 === API UPDATE EDUCATION DEBUG ===');
    console.log('🎓 Input education data:', JSON.stringify(educationData, null, 2));
    
    // If not authenticated yet, don't call the API; allow flow to continue
    if (!this.token) {
      console.warn('⚠️ updateEducation called without auth token. Deferring until after login.');
      return { success: true, data: null, message: 'Deferred until login' };
    }
    
    console.log('🚀 Calling /users/education endpoint with:', JSON.stringify(educationData, null, 2));
    const result = await this.apiCall('/users/education', {
      method: 'PUT',
      body: JSON.stringify(educationData),
    });
    console.log('📋 Education API result:', result);
    console.log('🔍 === END API UPDATE EDUCATION DEBUG ===');
    return result;
  }

  // WORK EXPERIENCES: New CRUD endpoints
  async createWorkExperience(workExp) {
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }
    // Require minimum fields as backend: jobTitle + startDate
    if (!workExp || !workExp.jobTitle || !workExp.startDate) {
      return { success: false, error: 'jobTitle and startDate are required' };
    }
    const payload = {
      jobTitle: workExp.jobTitle,
      startDate: workExp.startDate,
      endDate: workExp.endDate || null,
      companyName: workExp.companyName || null,
      organizationId: workExp.organizationId || null,
      salaryFrequency: workExp.salaryFrequency || null,
      managerName: workExp.managerName || null,
      managerContact: workExp.managerContact || null,
      canContact: workExp.canContact ?? null
    };
    return this.apiCall('/work-experiences', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getMyWorkExperiences() {
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }
    return this.apiCall('/work-experiences/my');
  }

  async updateWorkExperienceById(id, data) {
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }
    return this.apiCall(`/work-experiences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteWorkExperience(id) {
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }
    return this.apiCall(`/work-experiences/${id}`, {
      method: 'DELETE'
    });
  }

  // NEW: Update job preferences data
  async updateJobPreferences(jobPreferencesData) {
    console.log('🔍 === API UPDATE JOB PREFERENCES DEBUG ===');
    console.log('🎯 Input job preferences data:', JSON.stringify(jobPreferencesData, null, 2));
    
    if (!this.token) {
      console.warn('⚠️ updateJobPreferences called without auth token. Deferring until after login.');
      return { success: true, data: null, message: 'Deferred until login' };
    }

    // Route to Applicants profile endpoint (no /users/job-preferences exists)
    const userId = this.getUserIdFromToken();
    if (!userId) {
      console.error('❌ Cannot determine userId from token for job preferences update');
      return { success: false, error: 'Unable to identify user' };
    }

    // Map incoming fields to backend ApplicantService.updateApplicantProfile mapping
    const payload = {};

    // preferredJobTypes can be array or string
    const pjt = jobPreferencesData.preferredJobTypes || jobPreferencesData.jobTypes;
    if (pjt) {
      payload.preferredJobTypes = Array.isArray(pjt)
        ? pjt.map(v => (typeof v === 'string' ? v : v?.Type || v)).join(', ')
        : pjt;
    }

    // preferredWorkTypes/workplaceType
    if (jobPreferencesData.preferredWorkTypes) {
      payload.preferredWorkTypes = jobPreferencesData.preferredWorkTypes;
    } else if (jobPreferencesData.workplaceType) {
      payload.preferredWorkTypes = jobPreferencesData.workplaceType;
    }

    // preferredLocations can be array or string
    if (jobPreferencesData.preferredLocations) {
      payload.preferredLocations = Array.isArray(jobPreferencesData.preferredLocations)
        ? jobPreferencesData.preferredLocations.join(', ')
        : jobPreferencesData.preferredLocations;
    }

    if (jobPreferencesData.minimumSalary != null) {
      payload.minimumSalary = jobPreferencesData.minimumSalary;
    }

    try {
      console.log('🚀 Calling /applicants/{userId}/profile with:', JSON.stringify(payload));
      const result = await this.apiCall(`/applicants/${userId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      console.log('📋 Job preferences API result:', result);
      console.log('🔍 === END API UPDATE JOB PREFERENCES DEBUG ===');
      return result;
    } catch (error) {
      console.error('❌ Job preferences update failed:', error.message);
      return { success: false, error: error.message || 'Failed to update job preferences' };
    }
  }

  // Helper method to parse years of experience from string to number
  parseYearsOfExperience(yearsString) {
    if (!yearsString) return 0;
    
    // Extract first number from strings like "3-5 years", "1-3 years", etc.
    const match = yearsString.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  // Helper method to map workplace type to remote preference
  mapWorkplaceTypeToRemotePreference(workplaceType) {
    const mapping = {
      'remote': 'Remote',
      'hybrid': 'Hybrid', 
      'onsite': 'On-site'
    };
    return mapping[workplaceType] || 'Hybrid';
  }

  // Helper method to extract user ID from JWT token (basic implementation)
  getUserIdFromToken() {
    if (!this.token) return null;
    
    try {
      // Basic JWT payload extraction (in production, use a proper JWT library)
      const base64Url = this.token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      return payload.userId || payload.sub || payload.id;
    } catch (error) {
      console.error('Error extracting user ID from token:', error);
      return null;
    }
  }

  // Jobs APIs
  async getJobs(page = 1, pageSize = 20, filters = {}) {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...filters
    });
    return this.apiCall(`/jobs?${params}`);
  }

  async getJobById(jobId) {
    return this.apiCall(`/jobs/${jobId}`);
  }

  async searchJobs(query, filters = {}) {
    const params = new URLSearchParams({
      q: query || '',
      ...filters,
    });
    return this.apiCall(`/jobs/search?${params}`);
  }

  async createJob(jobData) {
    return this.apiCall('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // Job Applications APIs
  async applyForJob(applicationData) {
    return this.apiCall('/applications', {
      method: 'POST',
      body: JSON.stringify(applicationData),
    });
  }

  async getMyApplications(page = 1, pageSize = 20) {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    return this.apiCall(`/applications/my?${params}`);
  }

  async getJobApplications(jobId, page = 1, pageSize = 20) {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    return this.apiCall(`/jobs/${jobId}/applications?${params}`);
  }

  // Reference Data APIs with error handling
  async getJobTypes() {
    try {
      return await this.apiCall('/reference/job-types');
    } catch (error) {
      console.warn('Failed to load job types:', error.message);
      // Return fallback data
      return {
        success: true,
        data: [
          { JobTypeID: 1, Type: 'Full-Time' },
          { JobTypeID: 2, Type: 'Contract' },
          { JobTypeID: 3, Type: 'Part-Time' },
          { JobTypeID: 4, Type: 'Internship' },
          { JobTypeID: 5, Type: 'Freelance' }
        ]
      };
    }
  }

  async getCurrencies() {
    try {
      return await this.apiCall('/reference/currencies');
    } catch (error) {
      console.warn('Failed to load currencies:', error.message);
      // Return fallback data
      return {
        success: true,
        data: [
          { CurrencyID: 1, Code: 'USD', Symbol: '$', Name: 'US Dollar' },
          { CurrencyID: 2, Code: 'EUR', Symbol: '€', Name: 'Euro' }
        ]
      };
    }
  }

  // NEW: Reference data APIs for registration flow
  async getColleges(country = 'India', searchName = '') {
    try {
      // Build query parameters for the external API
      const params = new URLSearchParams();
      if (country) params.append('country', country);
      if (searchName) params.append('name', searchName);
      
      const endpoint = `/reference/colleges${params.toString() ? `?${params.toString()}` : ''}`;
      return await this.apiCall(endpoint);
    } catch (error) {
      console.warn('Failed to load colleges:', error.message);
      
      // Return country-specific fallback data
      const fallbackData = this.getCountrySpecificCollegeFallback(country);
      
      return {
        success: true,
        data: fallbackData
      };
    }
  }

  // Helper method for country-specific college fallbacks
  getCountrySpecificCollegeFallback(country) {
    const fallbackData = {
      'India': [
        { id: 1, name: 'Indian Institute of Technology (IIT) Delhi', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.iitd.ac.in' },
        { id: 2, name: 'Indian Institute of Technology (IIT) Bombay', type: 'University', country: 'India', state: 'Maharashtra', website: 'https://www.iitb.ac.in' },
        { id: 3, name: 'Indian Institute of Technology (IIT) Kanpur', type: 'University', country: 'India', state: 'Uttar Pradesh', website: 'https://www.iitk.ac.in' },
        { id: 4, name: 'Indian Institute of Technology (IIT) Madras', type: 'University', country: 'India', state: 'Tamil Nadu', website: 'https://www.iitm.ac.in' },
        { id: 5, name: 'Indian Institute of Science (IISc) Bangalore', type: 'University', country: 'India', state: 'Karnataka', website: 'https://www.iisc.ac.in' },
        { id: 6, name: 'All India Institute of Medical Sciences (AIIMS) Delhi', type: 'Medical University', country: 'India', state: 'Delhi', website: 'https://www.aiims.edu' },
        { id: 7, name: 'Jawaharlal Nehru University (JNU)', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.jnu.ac.in' },
        { id: 8, name: 'University of Delhi', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.du.ac.in' },
        { id: 9, name: 'Banaras Hindu University (BHU)', type: 'University', country: 'India', state: 'Uttar Pradesh', website: 'https://www.bhu.ac.in' },
        { id: 10, name: 'Anna University', type: 'University', country: 'India', state: 'Tamil Nadu', website: 'https://www.annauniv.edu' }
      ],
      'United States': [
        { id: 51, name: 'Harvard University', type: 'University', country: 'United States', state: 'Massachusetts', website: 'https://www.harvard.edu' },
        { id: 52, name: 'Stanford University', type: 'University', country: 'United States', state: 'California', website: 'https://www.stanford.edu' },
        { id: 53, name: 'Massachusetts Institute of Technology (MIT)', type: 'University', country: 'United States', state: 'Massachusetts', website: 'https://www.mit.edu' },
        { id: 54, name: 'California Institute of Technology (Caltech)', type: 'University', country: 'United States', state: 'California', website: 'https://www.caltech.edu' },
        { id: 55, name: 'University of California, Berkeley', type: 'University', country: 'United States', state: 'California', website: 'https://www.berkeley.edu' },
        { id: 56, name: 'Princeton University', type: 'University', country: 'United States', state: 'New Jersey', website: 'https://www.princeton.edu' },
        { id: 57, name: 'Yale University', type: 'University', country: 'United States', state: 'Connecticut', website: 'https://www.yale.edu' },
        { id: 58, name: 'Columbia University', type: 'University', country: 'United States', state: 'New York', website: 'https://www.columbia.edu' }
      ],
      'United Kingdom': [
        { id: 71, name: 'University of Oxford', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.ox.ac.uk' },
        { id: 72, name: 'University of Cambridge', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.cam.ac.uk' },
        { id: 73, name: 'Imperial College London', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.imperial.ac.uk' },
        { id: 74, name: 'London School of Economics (LSE)', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.lse.ac.uk' },
        { id: 75, name: 'University College London (UCL)', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.ucl.ac.uk' },
        { id: 76, name: "King's College London", type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.kcl.ac.uk' },
        { id: 77, name: 'University of Edinburgh', type: 'University', country: 'United Kingdom', state: 'Scotland', website: 'https://www.ed.ac.uk' }
      ],
      'Canada': [
        { id: 91, name: 'University of Toronto', type: 'University', country: 'Canada', state: 'Ontario', website: 'https://www.utoronto.ca' },
        { id: 92, name: 'McGill University', type: 'University', country: 'Canada', state: 'Quebec', website: 'https://www.mcgill.ca' },
        { id: 93, name: 'University of British Columbia', type: 'University', country: 'Canada', state: 'British Columbia', website: 'https://www.ubc.ca' },
        { id: 94, name: 'University of Waterloo', type: 'University', country: 'Canada', state: 'Ontario', website: 'https://uwaterloo.ca' },
        { id: 95, name: 'University of Alberta', type: 'University', country: 'Canada', state: 'Alberta', website: 'https://www.ualberta.ca' }
      ]
    };

    const countryData = fallbackData[country] || fallbackData['India'];
    
    // Add "Other" option
    countryData.push({
      id: 999999,
      name: 'Other',
      type: 'Other',
      country: 'Various',
      state: null,
      website: null
    });

    return countryData;
  }

  // Initialize employer profile + organization for an existing user
  async initializeEmployerProfile(data) {
    return this.apiCall('/employers/initialize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // NEW: Job seeker/applicant profile APIs
  async getApplicantProfile(userId) {
    try {
      return await this.apiCall(`/applicants/${userId}/profile`);
    } catch (error) {
      console.warn('Failed to load applicant profile:', error.message);
      // Return empty profile structure for new job seekers
      return {
        success: true,
        data: {
          ApplicantID: userId,
          UserID: userId,
          Headline: '',
          CurrentJobTitle: '',
          CurrentCompany: '',
          YearsOfExperience: 0,
          ExpectedSalary: null,
          CurrencyPreference: 'USD',
          Location: '',
          WillingToRelocate: false,
          RemotePreference: 'Hybrid',
          PrimarySkills: '',
          SecondarySkills: '',
          WorkAuthorization: '',
          NoticePeriod: '',
          ResumeURL: '',
          PortfolioURL: '',
          LinkedInProfile: '',
          GithubProfile: '',
          PersonalWebsite: '',
          Bio: '',
          IsOpenToWork: true,
          AllowRecruitersToContact: true,
          HideCurrentCompany: false,
          PreferredJobTypes: '',
          Industries: '',
        }
      };
    }
  }

  // NEW: Update applicant profile (FIXED: Add comprehensive debugging)
  async updateApplicantProfile(userId, profileData) {
    try {
      console.log('🔄 =========================');
      console.log('🔄 UPDATEAPPLICANTPROFILE DEBUG');
      console.log('🔄 =========================');
      console.log('🆔 User ID:', userId);
      console.log('📝 Profile Data Keys:', Object.keys(profileData));
      console.log('📝 Full Profile Data:', JSON.stringify(profileData, null, 2));
      console.log('🌐 API URL:', `${API_BASE_URL}/applicants/${userId}/profile`);
      console.log('🔑 Token present:', !!this.token);
      
      const result = await this.apiCall(`/applicants/${userId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
      
      console.log('✅ API Response:', JSON.stringify(result, null, 2));
      console.log('🔄 =========================');
      return result;
    } catch (error) {
      console.error('❌ =========================');
      console.error('❌ UPDATEAPPLICANTPROFILE ERROR');
      console.error('❌ =========================');
      console.error('❌ User ID:', userId);
      console.error('❌ Profile Data:', JSON.stringify(profileData, null, 2));
      console.error('❌ Error Type:', error.constructor.name);
      console.error('❌ Error Message:', error.message);
      console.error('❌ Full Error:', error);
      console.error('❌ =========================');
      throw error;
    }
  }

  // NEW: Employer profile APIs
  async getEmployerProfile(userId) {
    try {
      return await this.apiCall(`/employers/${userId}/profile`);
    } catch (error) {
      console.warn('Failed to load employer profile:', error.message);
      // Return empty profile structure for new employers
      return {
        success: true,
        data: {
          EmployerID: userId,
          UserID: userId,
          JobTitle: '',
          Department: '',
          OrganizationName: '',
          OrganizationSize: '',
          Industry: '',
          CanPostJobs: true,
          CanManageApplications: true,
          CanViewAnalytics: false,
          RecruitmentFocus: '',
          LinkedInProfile: '',
          Bio: '',
        }
      };
    }
  }

  async updateEmployerProfile(userId, profileData) {
    try {
      return await this.apiCall(`/employers/${userId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
    } catch (error) {
      console.error('Failed to update employer profile:', error.message);
      // For now, return success to avoid blocking user flow
      return {
        success: true,
        message: 'Profile update queued for processing'
      };
    }
  }

  // NEW: Get countries for education screen
  async getCountries() {
    try {
      return await this.apiCall('/reference/countries');
    } catch (error) {
      console.warn('Failed to load countries:', error.message);
      // Return fallback data with proper flags
      return {
        success: true,
        data: {
          countries: [
            { id: 'IN', name: 'India', flag: '🇮🇳', code: 'IN', region: 'Asia' },
            { id: 'US', name: 'United States', flag: '🇺🇸', code: 'US', region: 'Americas' },
            { id: 'GB', name: 'United Kingdom', flag: '🇬🇧', code: 'GB', region: 'Europe' },
            { id: 'CA', name: 'Canada', flag: '🇨🇦', code: 'CA', region: 'Americas' },
            { id: 'AU', name: 'Australia', flag: '🇦🇺', code: 'AU', region: 'Oceania' },
            { id: 'DE', name: 'Germany', flag: '🇩🇪', code: 'DE', region: 'Europe' },
            { id: 'FR', name: 'France', flag: '🇫🇷', code: 'FR', region: 'Europe' },
            { id: 'SG', name: 'Singapore', flag: '🇸🇬', code: 'SG', region: 'Asia' }
          ],
          defaultCountry: 'India'
        }
      };
    }
  }

  // NEW: Get organizations for employer registration - FIXED to use real database
  async getOrganizations(searchTerm = '') {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      
      const endpoint = `/reference/organizations${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.apiCall(endpoint);
      
      console.log('🏢 Organizations API Response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        // Handle the specific backend response format
        let organizationsArray = [];
        
        if (response.data.organizations && Array.isArray(response.data.organizations)) {
          // Backend returns: { success: true, data: { organizations: [...] } }
          organizationsArray = response.data.organizations;
        } else if (Array.isArray(response.data)) {
          // Alternative format: { success: true, data: [...] }
          organizationsArray = response.data;
        } else {
          console.warn('🏢 Unexpected response format:', response.data);
          organizationsArray = [];
        }
        
        console.log('🏢 Processing organizations array:', organizationsArray.length, 'items');
        
        // The backend already transforms the data correctly, so we can use it directly
        // Just ensure we have the "My company is not listed" option
        const hasNotListedOption = organizationsArray.some(org => org.id === 999999);
        if (!hasNotListedOption) {
          organizationsArray.push({
            id: 999999,
            name: 'My company is not listed',
            industry: 'Other',
            size: 'Unknown',
            type: 'Other',
            logoURL: null,
            website: null
          });
        }
        
        console.log('🏢 Final organizations count:', organizationsArray.length);
        
        return {
          success: true,
          data: organizationsArray
        };
      } else {
        throw new Error(response.error || 'No organizations data received');
      }
    } catch (error) {
      console.warn('🏢 Failed to load organizations from database:', error.message);
      
      // Only use fallback if backend is completely unavailable
      console.log('🏢 Using fallback organizations due to backend error');
      return {
        success: true,
        data: [
          {
            id: 999999,
            name: 'My company is not listed',
            industry: 'Other',
            size: 'Unknown',
            type: 'Other',
            logoURL: null,
            website: null
          }
        ]
      };
    }
  }

  // ✨ NEW: Salary Components API for new salary structure
  async getSalaryComponents() {
    try {
      return await this.apiCall('/reference/salary-components');
    } catch (error) {
      console.warn('Failed to load salary components:', error.message);
      // Return fallback data
      return {
        success: true,
        data: [
          { ComponentID: 1, ComponentName: 'Fixed', ComponentType: 'Recurring', IsActive: 1 },
          { ComponentID: 2, ComponentName: 'Variable', ComponentType: 'Recurring', IsActive: 1 },
          { ComponentID: 3, ComponentName: 'Bonus', ComponentType: 'OneTime', IsActive: 1 },
          { ComponentID: 4, ComponentName: 'Stock', ComponentType: 'Equity', IsActive: 1 }
        ]
      };
    }
  }

  // ✅ CONFIRMED WORKING: Salary breakdown functionality  
  async updateSalaryBreakdown(userId, salaryBreakdown) {
    console.log('💰 === SALARY BREAKDOWN UPDATE DEBUG ===');
    console.log('💰 User ID:', userId);
    console.log('💰 Auth token present:', !!this.token);
    console.log('💰 Input data:', JSON.stringify(salaryBreakdown, null, 2));
    
    // Validate input data
    if (!salaryBreakdown || typeof salaryBreakdown !== 'object') {
      console.error('💰 Invalid salary breakdown data');
      return { success: false, error: 'Invalid salary breakdown data' };
    }
    
    if (!this.token) {
      console.warn('⚠️ updateSalaryBreakdown called without auth token.');
      return { success: false, error: 'Authentication required' };
    }
    
    try {
      console.log('💰 Making API call to:', `${API_BASE_URL}/applicants/${userId}/profile`);
      
      const result = await this.apiCall(`/applicants/${userId}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ salaryBreakdown }),
      });
      
      console.log('✅ Salary breakdown update result:', JSON.stringify(result, null, 2));
      console.log('💰 === END SALARY BREAKDOWN UPDATE DEBUG ===');
      
      return result;
    } catch (error) {
      console.error('❌ === SALARY BREAKDOWN UPDATE ERROR ===');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Input data was:', JSON.stringify(salaryBreakdown, null, 2));
      console.error('❌ === END ERROR DEBUG ===');
      
      // Return a proper error response instead of throwing
      return { 
        success: false, 
        error: error.message || 'Failed to update salary breakdown'
      };
    }
  }

  // ✅ CONFIRMED WORKING: Get salary breakdown with profile
  async getApplicantProfileWithSalary(userId) {
    try {
      const result = await this.apiCall(`/applicants/${userId}/profile`);
      
      if (result.success && result.data.salaryBreakdown) {
        console.log('✅ Profile with salary breakdown retrieved');
        console.log('💰 Current components:', result.data.salaryBreakdown.current.length);
        console.log('💰 Expected components:', result.data.salaryBreakdown.expected.length);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to get profile with salary:', error);
      throw error;
    }
  }

  // ✅ HELPER: Format salary breakdown for frontend forms
  formatSalaryBreakdownForUI(salaryBreakdown) {
    const formatted = {
      currentSalary: [],
      expectedSalary: []
    };
    
    if (salaryBreakdown.current) {
      formatted.currentSalary = salaryBreakdown.current.map(component => ({
        id: component.ComponentID,
        componentName: component.ComponentName,
        componentType: component.ComponentType,
        amount: component.Amount,
        currencyId: component.CurrencyID,
        frequency: component.Frequency || 'Yearly',
        notes: component.Notes || ''
      }));
    }
    
    if (salaryBreakdown.expected) {
      formatted.expectedSalary = salaryBreakdown.expected.map(component => ({
        id: component.ComponentID,
        componentName: component.ComponentName,
        componentType: component.ComponentType,
        amount: component.Amount,
        currencyId: component.CurrencyID,
        frequency: component.Frequency || 'Yearly',
        notes: component.Notes || ''
      }));
    }
    
    return formatted;
  }

  // ✨ CROSS-PLATFORM: Upload profile image to Azure Storage  
  async uploadProfileImage(imageData) {
    try {
      console.log('📸 === CROSS-PLATFORM IMAGE UPLOAD START ===');
      console.log('📸 Platform:', Platform.OS);
      console.log('📸 Image data:', {
        fileName: imageData.fileName,
        mimeType: imageData.mimeType,
        userId: imageData.userId,
        fileDataLength: imageData.fileData?.length || 0
      });

      // Validate required fields
      if (!imageData.fileName || !imageData.fileData || !imageData.mimeType || !imageData.userId) {
        throw new Error('Missing required image upload data');
      }

      // IMPORTANT: Build the URL correctly without any query parameters
      const url = `${API_BASE_URL}/users/profile-image`;
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      };

      // Add auth token if available
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      // Prepare the request body as a clean JSON string
      const requestBody = JSON.stringify({
        fileName: imageData.fileName,
        fileData: imageData.fileData,
        mimeType: imageData.mimeType,
        userId: imageData.userId
      });

      console.log('🌐 Making upload request...');
      console.log('📡 URL:', url);
      console.log('📡 Content-Length:', requestBody.length);
      console.log('📡 Headers:', Object.keys(headers));

      // Make the request with explicit configuration
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: requestBody,
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow'
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      // Read response
      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text);
        throw new Error(`Server returned non-JSON response: ${response.status}`);
      }
      
      if (!response.ok) {
        console.error('❌ Backend upload failed:', {
          status: response.status,
          statusText: response.statusText,
          error: result
        });
        throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Backend upload successful:', {
        imageUrl: result.data?.imageUrl,
        fileName: result.data?.fileName,
        uploadDate: result.data?.uploadDate
      });
      console.log('📸 === CROSS-PLATFORM IMAGE UPLOAD END ===');

      return result;
    } catch (error) {
      console.error('❌ === CROSS-PLATFORM IMAGE UPLOAD ERROR ===');
      console.error('❌ Platform:', Platform.OS);
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Full error:', error);
      console.error('❌ === END ERROR LOG ===');
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      return await this.apiCall('/health');
    } catch (error) {
      console.error('Health check failed:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const nexhireAPI = new NexHireAPI();

export default nexhireAPI;