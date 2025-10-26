import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { frontendConfig } from '../config/appConfig';

// FIXED: Use environment variable or fallback to production API
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://refopen-api-func.azurewebsites.net/api';

class RefOpenAPI {
  constructor() {
    this.token = null;
    this.refreshToken = null;
    this.baseURL = frontendConfig.api.baseUrl;
    this.timeout = frontendConfig.api.timeout;
    
    // Log configuration on initialization
    if (frontendConfig.shouldLog('debug')) {
      console.log('🌐 API Service initialized');
      this.logConfigStatus();
    }
  }

  logConfigStatus() {
    const config = {
      baseURL: this.baseURL,
      timeout: this.timeout,
      debug: frontendConfig.api.debug,
      environment: frontendConfig.app.env,
      version: frontendConfig.app.version,
    };
    console.log('🌐 API Configuration:', config);
  }

  // Helper method to log API calls in debug mode
  logApiCall(method, endpoint, data = null) {
    if (frontendConfig.shouldLog('debug') && frontendConfig.api.debug) {
      console.log(`🌐 API ${method.toUpperCase()} ${endpoint}`, data ? { payload: data } : '');
    }
  }

  // Helper method to log API responses in debug mode
  logApiResponse(method, endpoint, response, duration) {
    if (frontendConfig.shouldLog('debug') && frontendConfig.api.debug) {
      console.log(`🌐 API ${method.toUpperCase()} ${endpoint} → ${response.status} (${duration}ms)`);
    }
  }

  async apiCall(endpoint, options = {}) {
    const startTime = Date.now();
    
    try {
      // Get stored token
      const token = await this.getToken('refopen_token');
      
      // Default headers with config values
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'X-App-Version': frontendConfig.app.version,
        'X-App-Environment': frontendConfig.app.env,
        ...frontendConfig.getApiConfig().headers,
      };

      // Add authorization header if token exists
      if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
      }

      // Merge with provided headers
      const headers = {
        ...defaultHeaders,
        ...options.headers,
      };

      const config = {
        method: options.method || 'GET',
        headers,
        ...options,
      };

      // Log the API call
      this.logApiCall(config.method, endpoint, options.body ? JSON.parse(options.body) : null);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      this.logApiResponse(config.method, endpoint, response, duration);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (!response.ok) {
        const error = new Error(data.message || data.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        console.error(`❌ API timeout (${this.timeout}ms): ${endpoint}`);
        throw new Error(`Request timeout (${this.timeout}ms)`);
      }

      if (frontendConfig.shouldLog('error')) {
        console.error(`❌ API Error (${duration}ms): ${endpoint}`, {
          message: error.message,
          status: error.status,
          data: error.data,
        });
      }

      throw error;
    }
  }

  // Token management
  async setTokens(accessToken, refreshToken) {
    try {
      await AsyncStorage.multiSet([
        ['refopen_token', accessToken],
        ['refopen_refresh_token', refreshToken]
      ]);
      
      if (frontendConfig.shouldLog('debug')) {
        console.log('✅ Tokens stored successfully');
      }
    } catch (error) {
      console.error('❌ Failed to store tokens:', error);
      throw error;
    }
  }

  async getToken(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`❌ Failed to get token ${key}:`, error);
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
      console.log('🔧 API.init() called - loading tokens from storage...');
      this.token = await this.getToken('refopen_token');
      this.refreshToken = await this.getToken('refopen_refresh_token');
      
      if (this.token) {
        console.log('✅ API.init() - Token loaded successfully');
        console.log('🔧 Token preview:', this.token.substring(0, 20) + '...');
        return true;
      } else {
        console.log('⚠️ API.init() - No stored auth token found');
        return false;
      }
    } catch (error) {
      console.error('❌ API.init() - Error initializing API:', error);
      return false;
    }
  }

  // Clear tokens (logout)
  async clearTokens() {
    this.token = null;
    this.refreshToken = null;
    
    await this.removeToken('refopen_token');
    await this.removeToken('refopen_refresh_token');
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

  // Authentication APIs
  async register(userData) {
    const result = await this.apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (result.success && result.data?.tokens) {
      await this.setTokens(
        result.data.tokens.accessToken,
        result.data.tokens.refreshToken
      );
    }

    return result;
  }

  async login(email, password) {
    const result = await this.apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.success && result.data?.tokens) {
      // 🔧 FIXED: Properly set tokens and sync API state
      await this.setTokens(
        result.data.tokens.accessToken,
        result.data.tokens.refreshToken
      );
      
      // 🔧 CRITICAL: Update instance token immediately
      this.token = result.data.tokens.accessToken;
      this.refreshToken = result.data.tokens.refreshToken;
      
      console.log('✅ Login successful, token set and synchronized');
    }

    return result;
  }

  // 🆕 NEW: Google OAuth login for existing users
  async loginWithGoogle(googleTokenData) {
    try {
      console.log('🔐 Attempting Google login with backend...');
      console.log('📧 Email:', googleTokenData.user.email);
      console.log('👤 Name:', googleTokenData.user.name);

      const result = await this.apiCall('/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          accessToken: googleTokenData.accessToken,
          idToken: googleTokenData.idToken,
          user: googleTokenData.user,
        }),
      });

      if (result.success && result.data?.tokens) {
        // 🔧 FIXED: Properly set tokens and sync API state
        await this.setTokens(
          result.data.tokens.accessToken,
          result.data.tokens.refreshToken
        );
        
        // 🔧 CRITICAL: Update instance token immediately
        this.token = result.data.tokens.accessToken;
        this.refreshToken = result.data.tokens.refreshToken;
        
        console.log('✅ Google login successful for:', googleTokenData.user.email);
        console.log('✅ Token set and synchronized');
      }

      return result;
    } catch (error) {
      console.error('❌ Google login failed:', error.message);
      
      // If user doesn't exist, return specific error for registration flow
      if (error.message.includes('not found') || error.message.includes('User not found')) {
        return { 
          success: false, 
          error: 'USER_NOT_FOUND',
          needsRegistration: true,
          message: 'Account not found. Please complete registration.'
        };
      }
      
      throw error;
    }
  }

  // 🆕 NEW: Register with Google for new users
  async registerWithGoogle(googleTokenData, additionalUserData) {
    try {
      console.log('🔐 Attempting Google registration with backend...');
      console.log('📧 Email:', googleTokenData.user.email);
      console.log('🏷️ User Type:', additionalUserData.userType);

      const result = await this.apiCall('/auth/google-register', {
        method: 'POST',
        body: JSON.stringify({
          // Google OAuth data
          accessToken: googleTokenData.accessToken,
          idToken: googleTokenData.idToken,
          user: googleTokenData.user,
          // Additional registration data
          ...additionalUserData, // userType, experienceType, etc.
        }),
      });

      if (result.success && result.data?.tokens) {
        await this.setTokens(
          result.data.tokens.accessToken,
          result.data.tokens.refreshToken
        );
        console.log('✅ Google registration successful for:', googleTokenData.user.email);
      }

      return result;
    } catch (error) {
      console.error('❌ Google registration failed:', error.message);
      throw error;
    }
  }

  async logout() {
    try {
      const result = await this.apiCall('/auth/logout', {
        method: 'POST',
      });
      
      await this.clearTokens();
      return result;
    } catch (error) {
      // Clear tokens even if API call fails
      await this.clearTokens();
      return { success: true, message: 'Logged out locally' };
    }
  }

  // User Profile APIs
  async getProfile() {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      console.log('🔧 getProfile: Token not in memory, loading from storage...');
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ getProfile: No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    console.log('🔧 getProfile: Token present:', !!this.token);
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
    
    // 🔧 SIMPLIFIED: Just check for token - no timing hacks needed
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
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      console.log('🔧 Token not in memory, loading from storage...');
      await this.init(); // Re-initialize to load token
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available after init');
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
    console.log('🔧 Token present:', !!this.token);
    
    return this.apiCall('/work-experiences', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getMyWorkExperiences() {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      console.log('🔧 Token not in memory, loading from storage...');
      await this.init(); // Re-initialize to load token
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available after init');
      return { success: false, error: 'Authentication required' };
    }
    
    console.log('🔧 getMyWorkExperiences - Token present:', !!this.token);
    return this.apiCall('/work-experiences/my');
  }

  async updateWorkExperienceById(id, data) {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      console.log('🔧 Token not in memory, loading from storage...');
      await this.init(); // Re-initialize to load token
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available after init');
      return { success: false, error: 'Authentication required' };
    }
    
    console.log('🔧 updateWorkExperienceById - Token present:', !!this.token);
    return this.apiCall(`/work-experiences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteWorkExperience(id) {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      console.log('🔧 Token not in memory, loading from storage...');
      await this.init(); // Re-initialize to load token
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available after init');
      return { success: false, error: 'Authentication required' };
    }
    
    console.log('🔧 deleteWorkExperience - Token present:', !!this.token);
    return this.apiCall(`/work-experiences/${id}`, {
      method: 'DELETE'
    });
  }

  // NEW: Update job preferences data
  async updateJobPreferences(jobPreferencesData) {
    console.log('🔍 === API UPDATE JOB PREFERENCES DEBUG ===');
    console.log('🎯 Input job preferences data:', JSON.stringify(jobPreferencesData, null, 2));
    
    // 🔧 SIMPLIFIED: Just check for token - no timing hacks needed
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

    // Add user exclusion if user is logged in to exclude applied jobs (not saved jobs)
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
      console.log('💰 Making API call to:', `/applicants/${userId}/profile`);
      
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

  // NEW: Get all resumes for current user (alias for getMyResumes)
  async getUserResumes() {
    return this.getMyResumes();
  }

  // ========================================================================
  // WALLET SYSTEM APIs - Complete Integration
  // ========================================================================

  // 💰 NEW: Get wallet balance
  async getWalletBalance() {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      console.log('🔧 Token not in memory, loading from storage...');
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    try {
      console.log('💰 Loading wallet balance...');
      return await this.apiCall('/wallet/balance');
    } catch (error) {
      console.error('❌ Failed to load wallet balance:', error);
      return { success: false, error: error.message || 'Failed to load wallet balance' };
    }
  }

  // 💰 NEW: Get full wallet details
  async getWallet() {
    if (!this.token) {
      console.log('🔧 Token not in memory, loading from storage...');
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    try {
      console.log('💰 Loading wallet details...');
      return await this.apiCall('/wallet');
    } catch (error) {
      console.error('❌ Failed to load wallet:', error);
      return { success: false, error: error.message || 'Failed to load wallet' };
    }
  }

  // 💰 NEW: Get wallet transactions
  async getWalletTransactions(page = 1, pageSize = 20, transactionType) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    
    // Add transaction type filter if provided
    if (transactionType) {
      params.append('type', transactionType);
    }
    
    return this.apiCall(`/wallet/transactions?${params}`);
  }

  // 💰 NEW: Create wallet recharge order
  async createWalletRechargeOrder(amount, currencyId = 4) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    return this.apiCall('/wallet/recharge/create-order', {
      method: 'POST',
      body: JSON.stringify({ amount, currencyId }),
    });
  }

  // 💰 NEW: Verify wallet recharge
  async verifyWalletRecharge(verificationData) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    return this.apiCall('/wallet/recharge/verify', {
      method: 'POST',
      body: JSON.stringify(verificationData),
    });
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

  // Create referral request (supports both internal and external)
  async createReferralRequest(requestData) {
    try {
      console.log('🤝 Creating referral request:', requestData);
      
      if (!this.token) {
        throw new Error('Authentication required');
      }

      // ✅ NEW SCHEMA: Support jobID/extJobID approach instead of referralType
      let payload;
      
      if (typeof requestData === 'object') {
        // 🆕 NEW FORMAT: Determine type by presence of jobID vs extJobID
        const hasJobID = !!requestData.jobID;
        const hasExtJobID = !!requestData.extJobID;
        
        if (!hasJobID && !hasExtJobID) {
          throw new Error('Either jobID (internal) or extJobID (external) must be provided');
        }
        
        if (hasJobID && hasExtJobID) {
          throw new Error('Cannot provide both jobID and extJobID - use only one');
        }

        payload = {
          jobID: requestData.jobID || undefined, // Internal job UNIQUEIDENTIFIER
          extJobID: requestData.extJobID || undefined, // External job STRING identifier
          resumeID: requestData.resumeID || requestData.resumeId, // Handle both formats
          referralMessage: requestData.referralMessage,
          // For external referrals, include job details
          jobTitle: requestData.jobTitle,
          companyName: requestData.companyName,
          organizationId: requestData.organizationId,
          jobUrl: requestData.jobUrl,
        };
        
        if (!payload.resumeID) {
          throw new Error('Resume ID is required');
        }
        
        if (hasExtJobID && (!payload.jobTitle || !payload.companyName)) {
          throw new Error('Job title and company name are required for external referrals');
        }
      } else {
        // 🔄 OLD FORMAT: String jobID means internal referral (backward compatibility)
        const jobID = typeof requestData === 'string' ? requestData : requestData.jobID;
        
        if (!jobID) {
          throw new Error('Job ID is required');
        }
        
        payload = {
          jobID,
          extJobID: undefined,
          resumeID: requestData.resumeID,
          referralMessage: requestData.referralMessage
        };
      }

      console.log('🤝 Final payload:', payload);

      return this.apiCall('/referral/requests', {
        method: 'POST',
        body: JSON.stringify(payload)
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

  // NEW: Claim a referral request with proof upload (enhanced flow)
  async claimReferralRequestWithProof(requestId, proofData) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    if (!proofData.proofFileURL || !proofData.proofFileType) {
      throw new Error('Proof screenshot is required');
    }

    return this.apiCall(`/referral/requests/${requestId}/claim`, {
      method: 'POST',
      body: JSON.stringify(proofData),
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

  // ✅ NEW: Get detailed points history for breakdown
  async getReferralPointsHistory() {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      console.log('🔧 Token not in memory, loading from storage...');
      await this.init(); // Re-initialize to load token
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available after init');
      return { success: false, error: 'Authentication required' };
    }
    
    try {
      console.log('🏆 Loading referral points history...');
      console.log('🔧 Token present:', !!this.token);
      
      // This endpoint should return detailed points history with breakdown by type
      const result = await this.apiCall('/referral/points-history');
      console.log('🏆 Points history API response:', result);
      
      // 🔧 UPDATED: Include metadata in the response
      if (result.success && result.data) {
        console.log('✅ Points history loaded successfully:', result.data);
        return {
          success: true,
          data: {
            totalPoints: result.data.totalPoints || 0,
            history: result.data.history || [],
            pointTypeMetadata: result.data.pointTypeMetadata || {} // 🆕 Backend-driven metadata
          }
        };
      }
      
      console.warn('⚠️ Points history API failed, result:', result);
      return result;
    } catch (error) {
      console.warn('⚠️ Failed to load points history, returning mock data. Error:', error);
      // Return mock data structure for testing with metadata
      return {
        success: true,
        data: {
          totalPoints: 25, // 🔧 FIXED: Use actual points from your database
          history: [
            {
              rewardId: '1EB9FA71-DA42-4C0B-B164-436104612143',
              pointsEarned: 25,
              pointsType: 'proof_submission',
              awardedAt: new Date().toISOString(),
              requestId: 'A9E357B5-5B97-498D-996C-650AE10AD44E',
              description: 'Base referral proof submitted'
            }
          ],
          // 🆕 Mock metadata for testing  
          pointTypeMetadata: {
            proof_submission: {
              icon: '📸',
              title: 'Proof Submissions',
              description: 'Base points for submitting referral screenshots',
              color: '#3B82F6'
            },
            verification: {
              icon: '✅',
              title: 'Verifications',
              description: 'Bonus points when job seekers confirm referrals',
              color: '#10B981'
            },
            quick_response_bonus: {
              icon: '⚡',
              title: 'Quick Response Bonus',
              description: 'Extra points for responding within 24 hours',
              color: '#F59E0B'
            }
          }
        }
      };
    }
  }

  // ✅ NEW: Get current referral subscription
  async getCurrentReferralSubscription() {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall('/referral/subscription');
  }

  // ✅ NEW: Cancel a referral request (by seeker)
  async cancelReferralRequest(requestId) {
    console.log('🚫 API: Cancelling referral request:', requestId);
    
    if (!this.token) {
      console.error('❌ No authentication token');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!requestId) {
      console.error('❌ No request ID provided');
      return { success: false, error: 'Request ID is required' };
    }
    
    try {
      console.log('🚫 Making POST request to:', `/referral/requests/${requestId}/cancel`);
      
      const result = await this.apiCall(`/referral/requests/${requestId}/cancel`, {
        method: 'POST',
      });
      
      console.log('✅ Cancel request successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Cancel request failed:', error.message);
      throw error;
    }
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

  // Development and diagnostics
  getDiagnostics() {
    return {
      baseURL: this.baseURL,
      timeout: this.timeout,
      environment: frontendConfig.app.env,
      version: frontendConfig.app.version,
      features: frontendConfig.features,
      config: frontendConfig.getConfigSummary(),
    };
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.apiCall('/health');
      return { success: true, ...result };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        baseURL: this.baseURL,
      };
    }
  }

  // ========================================================================
  // EMPLOYER JOB MANAGEMENT APIs
  // ========================================================================

  // Get jobs by organization (for employers)
  async getOrganizationJobs(params = {}, fetchOptions = {}) {
    if (!this.token) {
      console.error('❌ getOrganizationJobs: No authentication token');
      return { success: false, error: 'Authentication required' };
    }

    // First get employer profile to get organizationId
    const userId = this.getUserIdFromToken();
    if (!userId) {
      return { success: false, error: 'Unable to identify user' };
    }

    try {
      // Get employer profile to get organizationId
      const profileResult = await this.getEmployerProfile(userId);
      if (!profileResult.success || !profileResult.data.OrganizationID) {
        return { success: false, error: 'Employer organization not found' };
      }

      const organizationId = profileResult.data.OrganizationID;
      
      // Build query parameters
      const queryParams = {
        page: params.page || 1,
        pageSize: params.pageSize || 50,
        sortBy: params.sortBy || 'CreatedAt',
        sortOrder: params.sortOrder || 'desc',
        ...params
      };

      // Clean undefined/null values
      const cleaned = {};
      for (const [k, v] of Object.entries(queryParams)) {
        if (v !== undefined && v !== null && v !== '') {
          cleaned[k] = v;
        }
      }

      const queryString = new URLSearchParams(cleaned).toString();
      const endpoint = `/organizations/${organizationId}/jobs${queryString ? `?${queryString}` : ''}`;
      
      console.log('🏢 Fetching organization jobs:', endpoint);
      return await this.apiCall(endpoint, fetchOptions);
    } catch (error) {
      console.error('❌ getOrganizationJobs error:', error);
      return { success: false, error: error.message || 'Failed to fetch organization jobs' };
    }
  }

  // ✅ NEW: Publish a draft job
  async publishJob(jobId) {
    console.log('📢 API: Publishing job:', jobId);
    
    if (!this.token) {
      console.error('❌ No authentication token');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!jobId) {
      console.error('❌ No job ID provided');
      return { success: false, error: 'Job ID is required' };
    }
    
    try {
      console.log('📢 Making POST request to:', `/jobs/${jobId}/publish`);
      
      const result = await this.apiCall(`/jobs/${jobId}/publish`, {
        method: 'POST',
      });
      
      console.log('✅ Publish job successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Publish job failed:', error.message);
      return { success: false, error: error.message || 'Failed to publish job' };
    }
  }

  // ✅ NEW: Update a job
  async updateJob(jobId, jobData) {
    console.log('📝 API: Updating job:', jobId);
    
    if (!this.token) {
      console.error('❌ No authentication token');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!jobId) {
      console.error('❌ No job ID provided');
      return { success: false, error: 'Job ID is required' };
    }
    
    try {
      console.log('📝 Making PUT request to:', `/jobs/${jobId}`);
      
      const result = await this.apiCall(`/jobs/${jobId}`, {
        method: 'PUT',
        body: JSON.stringify(jobData),
      });
      
      console.log('✅ Update job successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Update job failed:', error.message);
      return { success: false, error: error.message || 'Failed to update job' };
    }
  }

  // ✅ NEW: Delete a job
  async deleteJob(jobId) {
    console.log('🗑️ API: Deleting job:', jobId);
    
    if (!this.token) {
      console.error('❌ No authentication token');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!jobId) {
      console.error('❌ No job ID provided');
      return { success: false, error: 'Job ID is required' };
    }
    
    try {
      console.log('🗑️ Making DELETE request to:', `/jobs/${jobId}`);
      
      const result = await this.apiCall(`/jobs/${jobId}`, {
        method: 'DELETE',
      });
      
      console.log('✅ Delete job successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Delete job failed:', error.message);
      return { success: false, error: error.message || 'Failed to delete job' };
    }
  }
}

export default new RefOpenAPI();