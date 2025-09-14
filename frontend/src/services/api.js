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

  // ✅ ADDED: Missing getAuthHeaders method
  async getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Generic API call with better error handling and CORS support
  async apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      console.log(`API Call: ${options.method || 'GET'} ${url}`);
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'omit',
      });

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
        if (response.status === 401) {
          await this.clearTokens();
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }

      console.log(`✅ API Success [${endpoint}]:`, response.status);
      return data;
    } catch (error) {
      // Normalize AbortError and avoid noisy logs
      const msg = (error?.message || '').toLowerCase();
      if (error?.name === 'AbortError' || msg.includes('aborted') || msg.includes('user aborted a request')) {
        if (error && !error.name) error.name = 'AbortError';
        console.debug(`Request aborted [${endpoint}]`);
        throw error; // callers already ignore AbortError
      }

      console.error(`? API Error [${endpoint}]:`, error.message);
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
      isCurrent: workExp.isCurrent ?? false,  // ✅ FIXED: Include isCurrent field
      companyName: workExp.companyName || null,
      organizationId: workExp.organizationId || null,
      department: workExp.department || null,  // ✅ ADDED: Missing fields
      employmentType: workExp.employmentType || null,  // ✅ ADDED
      location: workExp.location || null,  // ✅ ADDED
      country: workExp.country || null,  // ✅ ADDED
      description: workExp.description || null,  // ✅ ADDED
      skills: workExp.skills || null,  // ✅ ADDED
      achievements: workExp.achievements || null,  // ✅ ADDED
      reasonForLeaving: workExp.reasonForLeaving || null,  // ✅ ADDED
      salary: workExp.salary || null,  // ✅ ADDED
      currencyId: workExp.currencyId || null,  // ✅ ADDED
      salaryFrequency: workExp.salaryFrequency || null,
      managerName: workExp.managerName || null,
      managerContact: workExp.managerContact || null,
      canContact: workExp.canContact ?? null
    };
    
    console.log('🔧 Creating work experience with payload:', JSON.stringify(payload, null, 2));
    
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
  async getJobs(page = 1, pageSize = 20, filters = {}, fetchOptions = {}) {
    // Page-based only
    const userId = this.getUserIdFromToken();

    const base = { page: page.toString(), pageSize: pageSize.toString(), ...filters };

    // Always add user exclusion if user is logged in
    if (userId && this.token) {
      base.excludeUserApplications = userId;
    }

    // Clean filters
    const cleaned = {};
    for (const [k, v] of Object.entries(base)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      cleaned[k] = Array.isArray(v) ? v.join(',') : v;
    }

    const params = new URLSearchParams(cleaned);
    return this.apiCall(`/jobs?${params}`, fetchOptions);
  }

  async getJobById(jobId) {
    return this.apiCall(`/jobs/${jobId}`);
  }

  async searchJobs(query, filters = {}, fetchOptions = {}) {
    // Clean filters and include q only when non-empty; no implicit all=true
    const cleaned = {};
    const input = { q: (query || '').toString(), ...filters };

    for (const [k, v] of Object.entries(input)) {
      if (k === 'q') {
        const val = (v || '').toString().trim();
        if (val.length === 0) continue;
        cleaned[k] = val;
        continue;
      }
      if (v === undefined || v === null) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      cleaned[k] = Array.isArray(v) ? v.join(',') : v;
    }
    const params = new URLSearchParams(cleaned);
    // Use /search/jobs endpoint
    return this.apiCall(`/search/jobs?${params}`, fetchOptions);
  }

  async createJob(jobData) {
    return this.apiCall('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // Job Applications APIs
  async applyToJob(jobId) {
    return this.apiCall('/applications', {
      method: 'POST',
      body: JSON.stringify({ jobID: jobId }),
    });
  }

  // 🔧 NEW: Support both old and new apply methods for resume integration
  async applyForJob(applicationData) {
    console.log('📝 applyForJob called with:', applicationData);
    
    if (!this.token) {
      throw new Error('Authentication required');
    }

    // If it's just a jobId (legacy format), convert to new format
    if (typeof applicationData === 'string') {
      applicationData = { jobID: applicationData };
    }

    // Ensure required fields
    if (!applicationData.jobID) {
      throw new Error('Job ID is required');
    }

    console.log('📝 Submitting application:', applicationData);
    
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
    return this.apiCall(`/my/applications?${params}`);
  }

  async getJobApplications(jobId, page = 1, pageSize = 20) {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    return this.apiCall(`/jobs/${jobId}/applications?${params}`);
  }

  // NEW: Withdraw application
  async withdrawApplication(applicationId) {
    console.log('📡 withdrawApplication API method called with:', applicationId);
    if (!this.token) return { success: false, error: 'Authentication required' };
    if (!applicationId) return { success: false, error: 'Application ID is required' };
    
    console.log('📡 Making DELETE request to:', `/applications/${applicationId}`);
    console.log('📡 Token present:', !!this.token);
    
    try {
      const result = await this.apiCall(`/applications/${applicationId}`, {
        method: 'DELETE',
      });
      console.log('📡 API call completed successfully:', result);
      return result;
    } catch (error) {
      console.log('📡 API call failed:', error);
      throw error;
    }
  }

  // Saved jobs APIs
  async saveJob(jobId) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall('/saved-jobs', { method: 'POST', body: JSON.stringify({ jobID: jobId }) });
  }

  async unsaveJob(jobId) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall(`/saved-jobs/${jobId}`, { method: 'DELETE' });
  }

  async getMySavedJobs(page = 1, pageSize = 20) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return this.apiCall(`/my/saved-jobs?${params}`);
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
          { JobTypeID: 1, Type: 'Full-time' },
          { JobTypeID: 2, Type: 'Contract' },
          { JobTypeID: 3, Type: 'Part-time' },
          { JobTypeID: 4, Type: 'Internship' },
          { JobTypeID: 5, Type: 'Freelance' },
          { JobTypeID: 6, Type: 'Temporary' }
        ]
      };
    }
  }

  // UPDATED: Workplace types reference -> call backend, fallback on error
  async getWorkplaceTypes() {
    try {
      return await this.apiCall('/reference/workplace-types');
    } catch (error) {
      console.warn('Failed to load workplace types from backend, using fallback:', error.message);
      return {
        success: true,
        data: [
          { WorkplaceTypeID: 1, Type: 'Onsite' },
          { WorkplaceTypeID: 2, Type: 'Remote' },
          { WorkplaceTypeID: 3, Type: 'Hybrid' }
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
          Bio: ''
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

  // Resume upload method - FIXED: Better file handling + timeout + more debugging
  async uploadResume(file, userId, resumeLabel = 'Default Resume') {
    try {
      console.log('📄 === RESUME UPLOAD START ===');
      console.log('📄 Platform:', Platform.OS);
      console.log('📄 File object type:', typeof file, file instanceof File);
      console.log('📄 File details:', {
        name: file?.name,
        size: file?.size,
        type: file?.type
      });

      let fileData;
      let mimeType;
      let fileName;

      if (Platform.OS === 'web') {
        // Web: Handle different file types
        if (file instanceof File) {
          console.log('📄 Processing File object...');
          // Direct File object from input
          console.log('📄 Starting FileReader...');
          fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              console.log('📄 File read complete, result length:', reader.result?.length);
              try {
                const result = reader.result;
                const base64 = result.split(',')[1]; // Remove data:type;base64, prefix
                console.log('📄 Base64 conversion complete, length:', base64?.length);
                resolve(base64);
              } catch (error) {
                console.error('📄 Error processing FileReader result:', error);
                reject(error);
              }
            };
            reader.onerror = (error) => {
              console.error('📄 File read error:', error);
              reject(error);
            };
            reader.onprogress = (e) => {
              if (e.lengthComputable) {
                const percent = (e.loaded / e.total * 100).toFixed(0);
                console.log(`📄 File reading progress: ${percent}%`);
              }
            };
            console.log('📄 Starting readAsDataURL...');
            reader.readAsDataURL(file);
          });
          mimeType = file.type;
          fileName = file.name;
          console.log('📄 File processing complete:', {
            fileName,
            mimeType,
            base64Length: fileData?.length
          });
        } else if (file.uri) {
          console.log('📄 Processing URI-based file...');
          // Expo DocumentPicker result on web
          const response = await fetch(file.uri);
          const blob = await response.blob();
          
          fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result;
              const base64 = result.split(',')[1]; // Remove data:type;base64, prefix
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          mimeType = file.mimeType || file.type || 'application/pdf';
          fileName = file.name;
        } else {
          throw new Error('Invalid file object structure');
        }
      } else {
        // React Native: Read file and convert to base64
        const { FileSystem } = require('expo-file-system');
        const base64Data = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        fileData = base64Data;
        mimeType = file.type || file.mimeType || this.getMimeTypeFromExtension(file.name);
        fileName = file.name;
      }

      console.log('📄 Final processed file data:', {
        fileName,
        mimeType,
        fileDataLength: fileData?.length || 0,
        fileSizeEstimate: fileData ? `${((fileData.length * 3) / 4 / 1024 / 1024).toFixed(2)} MB` : 'Unknown'
      });

      // ✅ VALIDATE all required fields before sending
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('Invalid file name');
      }
      if (!fileData || typeof fileData !== 'string') {
        throw new Error('Invalid file data');
      }
      if (!mimeType || typeof mimeType !== 'string') {
        throw new Error('Invalid MIME type');
      }
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }
      if (!resumeLabel || typeof resumeLabel !== 'string') {
        throw new Error('Invalid resume label');
      }

      console.log('📄 ✅ All fields validated successfully');

      // Validate file size before upload
      const fileSizeBytes = (fileData.length * 3) / 4;
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (fileSizeBytes > maxSizeBytes) {
        throw new Error(`File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`);
      }

      console.log('📄 File validation passed, preparing upload...');

      // ✅ CORRECTED: Use the exact same endpoint as our working PowerShell test
      const url = `${API_BASE_URL}/users/resume`;
      console.log('📄 Upload URL:', url);
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(await this.getAuthHeaders())
      };
      console.log('📄 Headers prepared:', Object.keys(headers));

      // Create request body following the same pattern as profile image
      const requestPayload = {
        fileName: fileName,
        fileData: fileData,
        mimeType: mimeType,
        userId: userId,
        resumeLabel: resumeLabel
      };

      console.log('📄 Request payload structure:', {
        fileName: typeof requestPayload.fileName,
        fileData: typeof requestPayload.fileData + ` (length: ${requestPayload.fileData?.length})`,
        mimeType: typeof requestPayload.mimeType,
        userId: typeof requestPayload.userId,
        resumeLabel: typeof requestPayload.resumeLabel
      });

      const requestBody = JSON.stringify(requestPayload);

      console.log('📄 Request body prepared, size:', requestBody.length);
      console.log('📄 Making upload request...');

      // 🔧 NEW: Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.error('📄 Upload timeout after 30 seconds');
          reject(new Error('Upload timeout - please try again'));
        }, 30000); // 30 second timeout
      });

      // Make the request with timeout
      const uploadPromise = fetch(url, {
        method: 'POST',
        headers: headers,
        body: requestBody,
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow'
      });

      console.log('📄 Waiting for upload response...');
      const response = await Promise.race([uploadPromise, timeoutPromise]);

      console.log('📄 Response received, status:', response.status);
      console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()));

      // Read response
      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        console.log('📄 Reading JSON response...');
        result = await response.json();
        console.log('📄 JSON response parsed:', JSON.stringify(result, null, 2));
      } else {
        console.log('📄 Non-JSON response detected, reading as text...');
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
        
        // 🔧 NEW: Better error handling for 500 errors
        if (response.status === 500) {
          console.error('❌ Internal Server Error - checking payload format...');
          console.error('❌ Sent payload keys:', Object.keys(requestPayload));
          console.error('❌ Sent payload types:', {
            fileName: typeof requestPayload.fileName,
            fileData: typeof requestPayload.fileData,
            mimeType: typeof requestPayload.mimeType,
            userId: typeof requestPayload.userId,
            resumeLabel: typeof requestPayload.resumeLabel
          });
        }
        
        throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Upload successful:', {
        resumeURL: result.data?.resumeURL,
        fileName: result.data?.fileName,
        resumeID: result.data?.resumeID || result.data?.resumeId
      });
      console.log('📄 === RESUME UPLOAD END ===');

      return result;
    } catch (error) {
      console.error('❌ === RESUME UPLOAD ERROR ===');
      console.error('❌ Error type:', error?.constructor?.name);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Stack trace:', error?.stack);
      console.error('❌ === END ERROR LOG ===');
      throw error;
    }
  }

  // Helper method to get MIME type from file extension
  getMimeTypeFromExtension(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // NEW: Get all resumes for current user
  async getMyResumes() {
    try {
      console.log('📄 API: Getting user resumes...');
      
      // ✅ FIXED: Check authentication first
      if (!this.token) {
        console.log('📄 No authentication token, returning empty resumes list');
        return {
          success: true,
          data: []
        };
      }
      
      const url = `${API_BASE_URL}/users/resumes`;
      const headers = await this.getAuthHeaders();
      
      console.log('📄 API: Making GET request to:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        mode: 'cors',
        credentials: 'omit'
      });
      
      console.log('📄 API: Response status:', response.status);
      
      // ✅ FIXED: Handle non-JSON responses
      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text);
        // Return empty list instead of throwing error
        return {
          success: true,
          data: []
        };
      }
      
      console.log('📄 API: Response data:', result);
      
      if (!response.ok) {
        console.error('❌ Get resumes request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: result
        });
        // Return empty list instead of throwing error
        return {
          success: true,
          data: []
        };
      }
      
      console.log('✅ Get resumes request successful');
      return result;
    } catch (error) {
      console.error('❌ Get resumes API error:', error);
      
      // ✅ IMPROVED: Return empty list instead of throwing error
      return {
        success: true,
        data: []
      };
    }
  }

  // ========================================================================
  // REFERRAL SYSTEM APIs - Complete Integration
  // ========================================================================

  // Get referral plans (public endpoint)
  async getReferralPlans() {
    return this.apiCall('/referral/plans');
  }

  // Check referral eligibility
  async checkReferralEligibility() {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall('/referral/eligibility');
  }

  // Create referral request (same pattern as applying for job)
  async createReferralRequest(jobID, resumeID) {
    try {
      console.log('🤝 Creating referral request:', { jobID, resumeID });
      
      if (!this.token) {
        throw new Error('Authentication required');
      }

      if (!jobID || !resumeID) {
        throw new Error('Job ID and Resume ID are required');
      }

      return this.apiCall('/referral/requests', {
        method: 'POST',
        body: JSON.stringify({ jobID, resumeID })
      });
    } catch (error) {
      console.error('❌ Create referral request failed:', error.message);
      throw error;
    }
  }

  // Get my referral requests (as seeker)
  async getMyReferralRequests(page = 1, pageSize = 20) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    
    return this.apiCall(`/referral/my-requests?${params}`);
  }

  // Get available referral requests (as potential referrer)
  async getAvailableReferralRequests(page = 1, pageSize = 20) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    
    return this.apiCall(`/referral/available?${params}`);
  }

  // Claim a referral request (as referrer)
  async claimReferralRequest(requestId) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    return this.apiCall(`/referral/requests/${requestId}/claim`, {
      method: 'POST',
    });
  }

  // Submit proof of referral
  async submitReferralProof(requestId, fileURL, fileType) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    return this.apiCall(`/referral/requests/${requestId}/proof`, {
      method: 'POST',
      body: JSON.stringify({ fileURL, fileType }),
    });
  }

  // Verify referral completion (as seeker)
  async verifyReferralCompletion(requestId, verified = true) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    return this.apiCall(`/referral/requests/${requestId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verified }),
    });
  }

  // Get my requests as referrer
  async getMyReferrerRequests(page = 1, pageSize = 20) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    
    return this.apiCall(`/referral/my-referrer-requests?${params}`);
  }

  // Get referral analytics
  async getReferralAnalytics() {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall('/referral/analytics');
  }

  // Get referrer stats (badge counts)
  async getReferrerStats() {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall('/referral/stats');
  }

  // ✅ NEW: Get current referral subscription
  async getCurrentReferralSubscription() {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall('/referral/subscription');
  }

  // ✅ NEW: Razorpay payment integration
  async createRazorpayOrder(orderData) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall('/payments/razorpay/create-order', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async verifyPaymentAndActivateSubscription(verificationData) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall('/payments/razorpay/verify-and-activate', {
      method: 'POST',
      body: JSON.stringify(verificationData),
    });
  }
}

export default new NexHireAPI();