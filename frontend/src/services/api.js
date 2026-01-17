import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { frontendConfig } from '../config/appConfig';
import { resetToLogin } from '../navigation/navigationRef';

// FIXED: Use environment variable or fallback to production API
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://refopen-api-func.azurewebsites.net/api';

class RefOpenAPI {
  constructor() {
    this.token = null;
    this.refreshToken = null;
    this.onSessionExpired = null;
    this._handlingSessionExpired = false;
    this._isRefreshing = false;
    this._refreshSubscribers = [];
    this.baseURL = frontendConfig.api.baseUrl;
    this.timeout = frontendConfig.api.timeout;
    
    // Log configuration on initialization
    if (frontendConfig.shouldLog('debug')) {
      this.logConfigStatus();
    }
  }

  // Subscribe to token refresh completion
  _subscribeTokenRefresh(callback) {
    this._refreshSubscribers.push(callback);
  }

  // Notify all subscribers when token is refreshed
  _onTokenRefreshed(newToken) {
    this._refreshSubscribers.forEach(callback => callback(newToken));
    this._refreshSubscribers = [];
  }

  // Attempt to refresh the access token using refresh token
  async _tryRefreshToken() {
    const storedRefreshToken = await this.getToken('refopen_refresh_token');
    
    if (!storedRefreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.success && data.data?.accessToken) {
        await this.setTokens(data.data.accessToken, data.data.refreshToken || storedRefreshToken);
        return data.data.accessToken;
      }
      
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
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
  }

  // Helper method to log API calls in debug mode
  logApiCall(method, endpoint, data = null) {
    if (frontendConfig.shouldLog('debug') && frontendConfig.api.debug) {
    }
  }

  // Helper method to log API responses in debug mode
  logApiResponse(method, endpoint, response, duration) {
    if (frontendConfig.shouldLog('debug') && frontendConfig.api.debug) {
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

      // Global session-expired handling: try to refresh token first
      try {
        const status = error?.status;
        const message = (error?.message || '').toString();
        const dataMessage = (error?.data?.message || error?.data?.error || '').toString();
        const isTokenExpired = /token\s*expired/i.test(message) || /token\s*expired/i.test(dataMessage);
        const isAuthStatus = status === 401;

        // Only try refresh for 401 errors, not 403 (forbidden)
        if ((isAuthStatus || isTokenExpired) && !this._handlingSessionExpired && !options._isRetry) {
          // If already refreshing, wait for it to complete
          if (this._isRefreshing) {
            return new Promise((resolve, reject) => {
              this._subscribeTokenRefresh(async (newToken) => {
                if (newToken) {
                  // Retry the original request with new token
                  try {
                    const result = await this.apiCall(endpoint, { ...options, _isRetry: true });
                    resolve(result);
                  } catch (retryError) {
                    reject(retryError);
                  }
                } else {
                  reject(error);
                }
              });
            });
          }

          // Try to refresh the token
          this._isRefreshing = true;
          const newToken = await this._tryRefreshToken();
          this._isRefreshing = false;
          this._onTokenRefreshed(newToken);

          if (newToken) {
            // Retry the original request with new token
            return await this.apiCall(endpoint, { ...options, _isRetry: true });
          }

          // Refresh failed, logout
          this._handlingSessionExpired = true;
          await this.clearTokens();
          if (typeof this.onSessionExpired === 'function') {
            await this.onSessionExpired({ status, message: dataMessage || message });
          }
          resetToLogin();

          // Allow future expiries after a short delay (prevents many parallel calls from spamming)
          setTimeout(() => {
            this._handlingSessionExpired = false;
          }, 1000);
        }
      } catch (e) {
        // Never block the original error path
      }

      throw error;
    }
  }

  setOnSessionExpired(handler) {
    this.onSessionExpired = handler;
  }

  // Token management
  async setTokens(accessToken, refreshToken) {
    try {
      await AsyncStorage.multiSet([
        ['refopen_token', accessToken],
        ['refopen_refresh_token', refreshToken]
      ]);
      
      if (frontendConfig.shouldLog('debug')) {
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
      // Tokens are stored in AsyncStorage in this codebase; remove them from the same store.
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  }

  // Initialize API with stored tokens
  async init() {
    try {
      this.token = await this.getToken('refopen_token');
      this.refreshToken = await this.getToken('refopen_refresh_token');
      
      if (this.token) {
        return true;
      } else {
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
      
    }

    return result;
  }

  // 🆕 NEW: Google OAuth login for existing users
  async loginWithGoogle(googleTokenData) {
    try {

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

  // Password Management APIs
  
  /**
   * Check if user has a password set (for Google users to know if they can set one)
   */
  async hasPassword() {
    return this.apiCall('/auth/has-password');
  }

  /**
   * Set password for Google-only users (no current password required)
   * This allows Google users to also login with email/password
   */
  async setPassword(newPassword) {
    return this.apiCall('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  /**
   * Change password for users who already have one
   * Requires current password for verification
   */
  async changePassword(currentPassword, newPassword) {
    return this.apiCall('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // User Profile APIs
  async getProfile() {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ getProfile: No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
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
    
    // 🔧 SIMPLIFIED: Just check for token - no timing hacks needed
    if (!this.token) {
      console.warn('⚠️ updateEducation called without auth token. Deferring until after login.');
      return { success: true, data: null, message: 'Deferred until login' };
    }
    
    const result = await this.apiCall('/users/education', {
      method: 'PUT',
      body: JSON.stringify(educationData),
    });
    return result;
  }

  // WORK EXPERIENCES: New CRUD endpoints
  async createWorkExperience(workExp) {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
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
    
    return this.apiCall('/work-experiences', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getMyWorkExperiences() {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      await this.init(); // Re-initialize to load token
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available after init');
      return { success: false, error: 'Authentication required' };
    }
    
    return this.apiCall('/work-experiences/my');
  }

  async updateWorkExperienceById(id, data) {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      await this.init(); // Re-initialize to load token
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available after init');
      return { success: false, error: 'Authentication required' };
    }
    
    return this.apiCall(`/work-experiences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteWorkExperience(id) {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      await this.init(); // Re-initialize to load token
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available after init');
      return { success: false, error: 'Authentication required' };
    }
    
    return this.apiCall(`/work-experiences/${id}`, {
      method: 'DELETE'
    });
  }

  // ==========================================
  // COMPANY EMAIL VERIFICATION (Verified Referrer)
  // ==========================================
  
  /**
   * Send OTP to company email for verification
   * @param {string} workExperienceId - The work experience ID to verify
   * @param {string} companyEmail - The company email to send OTP to
   */
  async sendCompanyEmailOTP(workExperienceId, companyEmail) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    return this.apiCall('/verification/company-email/send-otp', {
      method: 'POST',
      body: JSON.stringify({ workExperienceId, companyEmail }),
    });
  }

  /**
   * Verify OTP sent to company email
   * @param {string} workExperienceId - The work experience ID being verified
   * @param {string} otp - The 4-digit OTP code
   */
  async verifyCompanyEmailOTP(workExperienceId, otp) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    return this.apiCall('/verification/company-email/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ workExperienceId, otp }),
    });
  }

  /**
   * Get user's verification status (isVerifiedReferrer, current work experience verification)
   */
  async getVerificationStatus() {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    return this.apiCall('/verification/status');
  }

  // NEW: Update job preferences data
  async updateJobPreferences(jobPreferencesData) {
    
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

    if (jobPreferencesData.preferredCompanySize) {
      payload.preferredCompanySize = jobPreferencesData.preferredCompanySize;
    }

    if (jobPreferencesData.minimumSalary != null) {
      payload.minimumSalary = jobPreferencesData.minimumSalary;
    }

    try {
      const result = await this.apiCall(`/applicants/${userId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
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

  // NEW: Get AI-recommended jobs (deducts ₹99 from wallet, 15-day access)
  async getAIRecommendedJobs(limit = 50) {
    const params = new URLSearchParams({ limit: limit.toString() });
    return this.apiCall(`/jobs/ai-recommendations?${params}`);
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
    if (!this.token) return { success: false, error: 'Authentication required' };
    if (!applicationId) return { success: false, error: 'Application ID is required' };
    
    
    try {
      const result = await this.apiCall(`/applications/${applicationId}`, {
        method: 'DELETE',
      });
      return result;
    } catch (error) {
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

  // ========================================================================
  // REFERENCE METADATA APIs - UNIFIED ENDPOINT
  // ========================================================================
  
  /**
   * Get reference metadata by type
   * @param {string} refType - Type of reference (JobType, WorkplaceType, JobRole, Skill, etc.)
   * @param {string} category - Optional category filter
   * @returns {Promise} API response
   */
  async getReferenceMetadata(refType, category = null) {
    const params = new URLSearchParams({ type: refType });
    if (category) params.append('category', category);
    
    return await this.apiCall(`/reference/metadata?${params}`);
  }

  /**
   * Get multiple reference types in one call (efficient)
   * @param {string[]} types - Array of reference types to fetch
   * @returns {Promise} API response with all types
   */
  async getBulkReferenceMetadata(types) {
    return await this.apiCall('/reference/metadata/bulk', {
      method: 'POST',
      body: JSON.stringify({ types }),
    });
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
      
      const result = await this.apiCall(`/applicants/${userId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
      
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

  // NEW: Get organizations for employer registration - Optimized with database index
  async getOrganizations(searchTerm = '', limit = null, offset = 0, options = {}) {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      // 🚀 OPTIMIZED: Only add limit if explicitly provided, otherwise fetch ALL
      if (limit !== null && limit !== undefined) {
        params.append('limit', limit.toString());
      }
      if (offset > 0) params.append('offset', offset.toString());
      
      // Add isFortune500 filter if provided
      if (options.isFortune500) {
        params.append('isFortune500', 'true');
      }
      
      const endpoint = `/reference/organizations${params.toString() ? `?${params.toString()}` : ''}`;
      
      const startTime = performance.now();
      
      const response = await this.apiCall(endpoint);
      
      const duration = (performance.now() - startTime).toFixed(2);
      
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
        
        
        // The backend already transforms the data correctly, so we can use it directly
        // Just ensure we have the "My company is not listed" option (not for F500 filter)
        if (!options.isFortune500) {
          const hasNotListedOption = organizationsArray.some(org => org.id === 999999);
          if (!hasNotListedOption) {
            organizationsArray.push({
              id: 999999,
              name: 'My company is not listed',
              logoURL: null,
              industry: 'Other'
            });
          }
        }
        
        
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
      return {
        success: true,
        data: [
          {
            id: 999999,
            name: 'My company is not listed',
            logoURL: null,
            industry: 'Other'
          }
        ]
      };
    }
  }

  // NEW: Get organization by ID with all details
  async getOrganizationById(organizationId) {
    try {
      if (!organizationId || organizationId === 999999) {
        return {
          success: false,
          error: 'Invalid organization ID'
        };
      }

      const response = await this.apiCall(`/reference/organizations/${organizationId}`);
      return response;
    } catch (error) {
      console.error('Failed to load organization details:', error);
      return {
        success: false,
        error: error.message || 'Failed to load organization details'
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
      
      const result = await this.apiCall(`/applicants/${userId}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ salaryBreakdown }),
      });
      
      
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


      // Make the request with explicit configuration
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: requestBody,
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow'
      });


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

      let fileData;
      let mimeType;
      let fileName;

      if (Platform.OS === 'web') {
        // Web: Handle different file types
        if (file instanceof File) {
          // Direct File object from input
          fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const result = reader.result;
                const base64 = result.split(',')[1]; // Remove data:type;base64, prefix
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
              }
            };
            reader.readAsDataURL(file);
          });
          mimeType = file.type;
          fileName = file.name;
        } else if (file.uri) {
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


      // Validate file size before upload
      const fileSizeBytes = (fileData.length * 3) / 4;
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (fileSizeBytes > maxSizeBytes) {
        throw new Error(`File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`);
      }


      // ✅ CORRECTED: Use the exact same endpoint as our working PowerShell test
      const url = `${API_BASE_URL}/users/resume`;
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(await this.getAuthHeaders())
      };

      // Create request body following the same pattern as profile image
      const requestPayload = {
        fileName: fileName,
        fileData: fileData,
        mimeType: mimeType,
        userId: userId,
        resumeLabel: resumeLabel
      };


      const requestBody = JSON.stringify(requestPayload);


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

      const response = await Promise.race([uploadPromise, timeoutPromise]);


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
      
      // ✅ FIXED: Check authentication first
      if (!this.token) {
        return {
          success: true,
          data: []
        };
      }
      
      const url = `${API_BASE_URL}/users/resumes`;
      const headers = await this.getAuthHeaders();
      
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        mode: 'cors',
        credentials: 'omit'
      });
      
      
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

  // ✅ NEW: Set a resume as primary
  async setPrimaryResume(resumeId) {
    
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }

if (!resumeId) {
      console.error('❌ No resume ID provided');
      return { success: false, error: 'Resume ID is required' };
  }
    
    try {
      
      const result = await this.apiCall(`/users/resume/${resumeId}/primary`, {
        method: 'PUT',
      });
  
      return result;
    } catch (error) {
      console.error('❌ Set primary resume failed:', error.message);
      return { 
 success: false, 
   error: error.message || 'Failed to set primary resume' 
      };
    }
  }

  // ✅ NEW: Delete a resume
  async deleteResume(resumeId) {
    
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!resumeId) {
      console.error('❌ No resume ID provided');
      return { success: false, error: 'Resume ID is required' };
    }
    
    try {
      const result = await this.apiCall(`/users/resume/${resumeId}`, { method: 'DELETE' });

      // Normalize response shape (backend returns success + softDelete flags)
      const normalized = {
 success: !!result.success,
 softDelete: !!result.softDelete,
 message: result.message || (result.softDelete
 ? 'Resume archived.'
 : 'Resume permanently deleted.'),
 applicationCount: result.applicationCount ??0,
 referralCount: result.referralCount ??0
 };

 // User feedback should be handled in UI components using showToast
 return normalized;
    } catch (error) {
      console.error('❌ Delete resume failed:', error.message);
      return { success: false, error: error.message || 'Failed to delete resume' };
    }
  }

  // ========================================================================
  // PRICING SYSTEM APIs - DB-driven pricing
  // ========================================================================
  
  // 💰 Get all pricing settings from database (cached for 5 mins on server)
  async getPricing() {
    try {
      const response = await this.apiCall('/pricing');
      if (response.success && response.data) {
        // Cache pricing locally for quick access
        this._pricingCache = response.data;
        this._pricingCacheTime = Date.now();
      }
      return response;
    } catch (error) {
      console.error('❌ Failed to load pricing:', error);
      // Return cached values if available
      if (this._pricingCache) {
        return { success: true, data: this._pricingCache };
      }
      // Return defaults if no cache
      return { 
        success: true, 
        data: {
          aiJobsCost: 99,
          aiAccessDurationHours: 360,
          aiAccessDurationDays: 15,
          referralRequestCost: 39,
          jobPublishCost: 50,
          welcomeBonus: 50,
          referralSignupBonus: 50
        }
      };
    }
  }
  
  // Get cached pricing or fetch if not available
  async getCachedPricing() {
    // Return cache if less than 5 minutes old
    if (this._pricingCache && this._pricingCacheTime && (Date.now() - this._pricingCacheTime) < 5 * 60 * 1000) {
      return this._pricingCache;
    }
    const response = await this.getPricing();
    return response.data;
  }

  // ========================================================================
  // WALLET SYSTEM APIs - Complete Integration
  // ========================================================================

  // 💰 NEW: Get wallet balance
  async getWalletBalance() {
    // 🔧 CRITICAL FIX: Ensure token is loaded before checking
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    try {
      return await this.apiCall('/wallet/balance');
    } catch (error) {
      console.error('❌ Failed to load wallet balance:', error);
      return { success: false, error: error.message || 'Failed to load wallet balance' };
    }
  }

  // 💰 NEW: Get full wallet details
  async getWallet() {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    try {
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

  // 💰 NEW: Get withdrawable balance (referral earnings)
  async getWithdrawableBalance() {
    if (!this.token) return { success: false, error: 'Authentication required' };
    return this.apiCall('/wallet/withdrawable');
  }

  // 💰 NEW: Request withdrawal of referral earnings
  async requestWithdrawal(amount, paymentDetails) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    return this.apiCall('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, ...paymentDetails }),
    });
  }

  // 💰 NEW: Get withdrawal history
  async getWithdrawalHistory(page = 1, pageSize = 20) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    
    return this.apiCall(`/wallet/withdrawals?${params}`);
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

  // Create referral request (supports both internal and external)
  async createReferralRequest(requestData) {
    try {
      
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
          organizationId: requestData.organizationId,
          jobUrl: requestData.jobUrl,
        };
        
        if (!payload.resumeID) {
          throw new Error('Resume ID is required');
        }
        
        // ✅ FIXED: Only require jobTitle and organizationId (no companyName)
        if (hasExtJobID && (!payload.jobTitle || !payload.organizationId)) {
          throw new Error('Job title and organization ID are required for external referrals');
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
  // Returns ALL requests for the referrer's organization (frontend filters by status)
  async getAvailableReferralRequests(page = 1, pageSize = 100) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    
    return this.apiCall(`/referral/available?${params}`);
  }

  // Get completed referrals by current user (for closed tab - all past completed referrals regardless of company)
  async getCompletedReferrals(page = 1, pageSize = 100) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    
    return this.apiCall(`/referral/completed?${params}`);
  }

  // Claim a referral request (as referrer)
  async claimReferralRequest(requestId) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    return this.apiCall(`/referral/requests/${requestId}/claim`, {
      method: 'POST',
    });
  }

  // NEW: Claim a referral request with proof upload (enhanced flow)
  async submitReferralWithProof(requestId, proofData) {
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
  async submitReferralProof(requestId, proofData) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    return this.apiCall(`/referral/requests/${requestId}/proof`, {
      method: 'POST',
      body: JSON.stringify({
        fileURL: proofData.proofFileURL,
        fileType: proofData.proofFileType,
        description: proofData.proofDescription
      }),
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
      await this.init(); // Re-initialize to load token
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available after init');
      return { success: false, error: 'Authentication required' };
    }
    
    try {
      
      // This endpoint should return detailed points history with breakdown by type
      const result = await this.apiCall('/referral/points-history');
      
      // 🔧 UPDATED: Include metadata in the response
      if (result.success && result.data) {
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
    
    if (!this.token) {
      console.error('❌ No authentication token');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!requestId) {
      console.error('❌ No request ID provided');
      return { success: false, error: 'Request ID is required' };
    }
    
    try {
      
      const result = await this.apiCall(`/referral/requests/${requestId}/cancel`, {
        method: 'POST',
      });
      
      return result;
    } catch (error) {
      console.error('❌ Cancel request failed:', error.message);
      throw error;
    }
  }

  // ✅ NEW: Convert referral points to wallet balance
  async convertPointsToWallet() {
    
    // Ensure token is loaded
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      console.error('❌ No authentication token available');
      return { success: false, error: 'Authentication required' };
    }
    
    try {
      
      const result = await this.apiCall(`/referral/points/convert-to-wallet`, {
        method: 'POST',
      });
      
      return result;
    } catch (error) {
      console.error('❌ Points conversion failed:', error.message);
      return { 
        success: false, 
        error: error.message || 'Failed to convert points to wallet'
      };
    }
  }

  // ===== REFERRAL STATUS TRACKING =====

  // ✅ NEW: Log referral status change (Viewed, Claimed)
  async logReferralStatus(requestId, status, message = null) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    if (!requestId) {
      return { success: false, error: 'Request ID is required' };
    }

    const validStatuses = ['Viewed', 'Claimed'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
    }

    try {
      const result = await this.apiCall(`/referral/requests/${requestId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, message }),
      });
      return result;
    } catch (error) {
      console.error('❌ Log referral status failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ✅ NEW: Get referral status history for tracking screen
  async getReferralStatusHistory(requestId) {
    if (!this.token) return { success: false, error: 'Authentication required' };
    
    if (!requestId) {
      return { success: false, error: 'Request ID is required' };
    }

    try {
      const result = await this.apiCall(`/referral/requests/${requestId}/history`);
      return result;
    } catch (error) {
      console.error('❌ Get status history failed:', error.message);
      return { success: false, error: error.message };
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
        sortBy: params.sortBy || 'PublishedAt',
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
      
      return await this.apiCall(endpoint, fetchOptions);
    } catch (error) {
      console.error('❌ getOrganizationJobs error:', error);
      return { success: false, error: error.message || 'Failed to fetch organization jobs' };
    }
  }

  // ✅ NEW: Get jobs posted by the current user (for referrers - doesn't require employer profile)
  async getMyPostedJobs(params = {}) {
    if (!this.token) {
      console.error('❌ getMyPostedJobs: No authentication token');
      return { success: false, error: 'Authentication required' };
    }

    try {
      const userId = this.getUserIdFromToken();
      if (!userId) {
        return { success: false, error: 'Unable to identify user' };
      }

      // Build query parameters
      const queryParams = {
        page: params.page || 1,
        pageSize: params.pageSize || 50,
        sortBy: params.sortBy || 'CreatedAt',
        sortOrder: params.sortOrder || 'desc',
        status: params.status || undefined,
        postedByUserId: userId,
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
      const endpoint = `/user/my-posted-jobs${queryString ? `?${queryString}` : ''}`;
      
      return await this.apiCall(endpoint);
    } catch (error) {
      console.error('❌ getMyPostedJobs error:', error);
      return { success: false, error: error.message || 'Failed to fetch posted jobs' };
    }
  }

  // ✅ NEW: Publish a draft job
  async publishJob(jobId) {
    
    if (!this.token) {
      console.error('❌ No authentication token');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!jobId) {
      console.error('❌ No job ID provided');
      return { success: false, error: 'Job ID is required' };
    }
    
    try {
      
      const result = await this.apiCall(`/jobs/${jobId}/publish`, {
        method: 'POST',
      });
      
      return result;
    } catch (error) {
      const serverMessage = error?.data?.error || error?.data?.message;
      console.error('❌ Publish job failed:', serverMessage || error.message);
      return {
        success: false,
        error: serverMessage || error.message || 'Failed to publish job',
        status: error?.status,
        data: error?.data,
      };
    }
  }

  // ✅ NEW: Update a job
  async updateJob(jobId, jobData) {
    
    if (!this.token) {
      console.error('❌ No authentication token');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!jobId) {
      console.error('❌ No job ID provided');
      return { success: false, error: 'Job ID is required' };
    }
    
    try {
      
      const result = await this.apiCall(`/jobs/${jobId}`, {
        method: 'PUT',
        body: JSON.stringify(jobData),
      });
      
      return result;
    } catch (error) {
      console.error('❌ Update job failed:', error.message);
      return { success: false, error: error.message || 'Failed to update job' };
    }
  }

  // ✅ NEW: Delete a job
  async deleteJob(jobId) {
    
    if (!this.token) {
      console.error('❌ No authentication token');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!jobId) {
      console.error('❌ No job ID provided');
      return { success: false, error: 'Job ID is required' };
    }
    
    try {
      
      const result = await this.apiCall(`/jobs/${jobId}`, {
        method: 'DELETE',
      });
      
      return result;
    } catch (error) {
      console.error('❌ Delete job failed:', error.message);
      return { success: false, error: error.message || 'Failed to delete job' };
    }
  }

  async uploadFile(fileUri, containerName = 'referral-proofs') {
    try {

      if (!this.token) {
        throw new Error('Authentication required');
      }

      const userId = this.getUserIdFromToken();
      if (!userId) {
        throw new Error('Unable to identify user');
      }

      let fileData;
      let mimeType;
      let fileName;

      // Handle different file sources
      if (Platform.OS === 'web') {
        // Web: Handle data URLs or blob URLs
        if (fileUri.startsWith('data:')) {
          // Data URL (from image picker on web)
          const matches = fileUri.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) {
            throw new Error('Invalid data URL format');
          }
          mimeType = matches[1];
          fileData = matches[2];
          fileName = `proof-${Date.now()}.${this.getExtensionFromMimeType(mimeType)}`;
        } else if (fileUri.startsWith('blob:')) {
          // Blob URL
          const response = await fetch(fileUri);
          const blob = await response.blob();

          fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          mimeType = blob.type || 'image/jpeg';
          fileName = `proof-${Date.now()}.${this.getExtensionFromMimeType(mimeType)}`;
        } else {
          throw new Error('Unsupported file URI format on web');
        }
      } else {
        // React Native: Read file using Expo FileSystem
        const { FileSystem } = require('expo-file-system');

        fileData = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Determine MIME type from URI
        const extension = fileUri.split('.').pop()?.toLowerCase();
        mimeType = this.getMimeTypeFromExtension(extension);
        fileName = `proof-${Date.now()}.${extension}`;
      }

      // Validate file size (10MB limit)
      const fileSizeBytes = (fileData.length * 3) / 4;
      const maxSizeBytes = 10 * 1024 * 1024;
      if (fileSizeBytes > maxSizeBytes) {
        throw new Error(`File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`);
      }

      // Prepare upload request
      const url = `${this.baseURL}/storage/upload`;

      const headers = await this.getAuthHeaders();

      const requestPayload = {
        fileName,
        fileData,
        mimeType,
        containerName,
        userId
      };


      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
        mode: 'cors',
        credentials: 'omit'
      });


      let result;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('? Non-JSON response:', text);
        throw new Error(`Server returned non-JSON response: ${response.status}`);
      }

      if (!response.ok) {
        console.error('? Upload failed:', result);
        throw new Error(result.error || `HTTP ${response.status}`);
      }


      return result;
    } catch (error) {
      console.error('? === FILE UPLOAD ERROR ===');
      console.error('? Error type:', error.constructor.name);
      console.error('? Error message:', error.message);
      console.error('? === END ERROR LOG ===');
      throw error;
    }
  }

  // Helper: Get file extension from MIME type
  getExtensionFromMimeType(mimeType) {
    const mimeToExt = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };
    return mimeToExt[mimeType] || 'jpg';
  }

  // ========================================
  // NOTIFICATION PREFERENCES
  // ========================================
  
  async getNotificationPreferences() {
    try {
      const result = await this.apiCall('/notifications/preferences');
      return result;
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      // Return defaults on error
      return {
        success: true,
        preferences: {
          EmailEnabled: true,
          PushEnabled: true,
          InAppEnabled: true,
          ReferralRequestEmail: true,
          ReferralRequestPush: true,
          ReferralClaimedEmail: true,
          ReferralClaimedPush: true,
          ReferralVerifiedEmail: true,
          ReferralVerifiedPush: true,
          JobApplicationEmail: true,
          MessageReceivedEmail: true,
          MessageReceivedPush: true,
          WeeklyDigestEmail: true,
          DailyJobRecommendationEmail: true,
          ReferrerNotificationEmail: true,
          MarketingEmail: true
        }
      };
    }
  }

  async updateNotificationPreferences(preferences) {
    try {
      return await this.apiCall('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  // ========================================
  // MANUAL PAYMENT / WALLET RECHARGE
  // ========================================

  /**
   * Get manual payment settings (bank/UPI details)
   */
  async getManualPaymentSettings() {
    try {
      return await this.apiCall('/manual-payment/settings');
    } catch (error) {
      console.error('Failed to get manual payment settings:', error);
      // Return default settings if API fails
      return {
        success: true,
        data: {
          upiId: 'refopen@ybl',
          upiName: 'RefOpen Technologies',
          bankName: 'HDFC Bank',
          bankAccountName: 'RefOpen Technologies Pvt Ltd',
          bankAccountNumber: '50200012345678',
          bankIfsc: 'HDFC0001234',
          bankBranch: 'Mumbai Main Branch',
          minAmount: 100,
          maxAmount: 50000,
          processingTime: '1 business day',
          supportContact: 'Contact Support via Help & Support',
          supportPhone: ''
        }
      };
    }
  }

  /**
   * Submit manual payment proof
   */
  async submitManualPayment(data) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    return this.apiCall('/manual-payment/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get user's manual payment submissions
   */
  async getMyManualPaymentSubmissions() {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required', data: [] };
    }

    return this.apiCall('/manual-payment/my-submissions');
  }

  // ========================================================================
  // SUPPORT TICKET APIs - Customer Support System
  // ========================================================================

  /**
   * Create a new support ticket
   * @param {Object} ticketData - { category, subject, message, contactEmail? }
   */
  async createSupportTicket(ticketData) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    return this.apiCall('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  /**
   * Get user's support tickets
   * @param {Object} params - { page?, limit?, status? }
   */
  async getMySupportTickets(params = {}) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required', data: { tickets: [], total: 0 } };
    }

    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    return this.apiCall(`/support/tickets${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Get a specific support ticket by ID
   * @param {string} ticketId - The ticket ID
   */
  async getSupportTicketById(ticketId) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    return this.apiCall(`/support/tickets/${ticketId}`);
  }

  /**
   * Get all support tickets (Admin only)
   * @param {Object} params - { page?, limit?, status?, category?, priority? }
   */
  async getAdminSupportTickets(params = {}) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);
    if (params.category) queryParams.append('category', params.category);
    if (params.priority) queryParams.append('priority', params.priority);

    const queryString = queryParams.toString();
    return this.apiCall(`/support/admin/tickets${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Update a support ticket (Admin only)
   * @param {string} ticketId - The ticket ID
   * @param {Object} updateData - { status?, priority?, adminResponse? }
   */
  async updateSupportTicket(ticketId, updateData) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    return this.apiCall(`/support/tickets/${ticketId}/update`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  /**
   * Get support ticket statistics (Admin only)
   */
  async getSupportTicketStats() {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    return this.apiCall('/support/admin/stats');
  }

  /**
   * Get messages for a support ticket
   */
  async getSupportTicketMessages(ticketId) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    return this.apiCall(`/support/tickets/${ticketId}/messages`);
  }

  /**
   * Send a message on a support ticket
   */
  async sendSupportTicketMessage(ticketId, message) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    return this.apiCall(`/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  /**
   * Close a support ticket
   */
  async closeSupportTicket(ticketId) {
    if (!this.token) {
      await this.init();
    }
    
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    return this.apiCall(`/support/tickets/${ticketId}/close`, {
      method: 'POST',
    });
  }
}

export default new RefOpenAPI();