import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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
        console.log('? Found stored auth token');
      } else {
        console.log('?? No stored auth token found');
      }
    } catch (error) {
      console.error('? Error initializing API:', error);
    }
  }

  // Set authentication tokens
  async setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    
    await this.storeToken('nexhire_token', accessToken);
    await this.storeToken('nexhire_refresh_token', refreshToken);
    console.log('? Tokens stored successfully');
  }

  // Clear tokens (logout)
  async clearTokens() {
    this.token = null;
    this.refreshToken = null;
    
    await this.removeToken('nexhire_token');
    await this.removeToken('nexhire_refresh_token');
    console.log('? Tokens cleared');
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
      console.log(`?? API Call: ${options.method || 'GET'} ${url}`);
      
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
        console.warn(`?? Non-JSON response for ${endpoint}:`, text);
        throw new Error(`Invalid response format: ${response.status}`);
      }

      if (!response.ok) {
        console.error(`? API Error [${endpoint}]:`, response.status, data);
        
        // Handle specific error cases
        if (response.status === 401) {
          // Token expired, clear tokens
          await this.clearTokens();
          throw new Error('Authentication expired. Please login again.');
        }
        
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }

      console.log(`? API Success [${endpoint}]:`, response.status);
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
      console.error('? Registration failed:', error.message);
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
        console.log('? Login successful for:', email);
      }

      return result;
    } catch (error) {
      console.error('? Login failed:', error.message);
      throw error;
    }
  }

  async logout() {
    await this.clearTokens();
    return { success: true };
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
      console.warn('?? Failed to load job types:', error.message);
      // Return fallback data
      return {
        success: true,
        data: [
          { JobTypeID: 1, Type: 'Full-Time' },
          { JobTypeID: 2, Type: 'Contract' },
          { JobTypeID: 3, Type: 'Part-Time' }
        ]
      };
    }
  }

  async getCurrencies() {
    try {
      return await this.apiCall('/reference/currencies');
    } catch (error) {
      console.warn('?? Failed to load currencies:', error.message);
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

  // Health check
  async healthCheck() {
    try {
      return await this.apiCall('/health');
    } catch (error) {
      console.error('? Health check failed:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const nexhireAPI = new NexHireAPI();

export default nexhireAPI;