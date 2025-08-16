import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = 'https://nexhire-api-func.azurewebsites.net/api';

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
    this.token = await this.getToken('nexhire_token');
    this.refreshToken = await this.getToken('nexhire_refresh_token');
  }

  // Set authentication tokens
  async setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    
    await this.storeToken('nexhire_token', accessToken);
    await this.storeToken('nexhire_refresh_token', refreshToken);
  }

  // Clear tokens (logout)
  async clearTokens() {
    this.token = null;
    this.refreshToken = null;
    
    await this.removeToken('nexhire_token');
    await this.removeToken('nexhire_refresh_token');
  }

  // Generic API call with error handling
  async apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
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
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`API Error [${endpoint}]:`, response.status, data);
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }

      console.log(`API Success [${endpoint}]:`, response.status);
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Authentication APIs
  async register(userData) {
    return this.apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(email, password) {
    const result = await this.apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.success && result.data.tokens) {
      await this.setTokens(
        result.data.tokens.accessToken,
        result.data.tokens.refreshToken
      );
    }

    return result;
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

  // Reference Data APIs
  async getJobTypes() {
    return this.apiCall('/reference/job-types');
  }

  async getCurrencies() {
    return this.apiCall('/reference/currencies');
  }
}

// Create singleton instance
const nexhireAPI = new NexHireAPI();

export default nexhireAPI;