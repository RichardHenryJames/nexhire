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
        console.log('No stored auth token found');
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
    try {
      // FIXED: Call backend logout endpoint first
      console.log('Calling backend logout endpoint...');
      
      // Make backend call to log the logout activity
      const result = await this.apiCall('/auth/logout', {
        method: 'POST',
      });
      
      console.log('? Backend logout successful:', result.message);
      
      // Clear local tokens after successful backend call
      await this.clearTokens();
      
      return { success: true, message: 'Logout successful' };
    } catch (error) {
      console.error('? Backend logout failed:', error.message);
      
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
    return this.apiCall('/users/education', {
      method: 'PUT',
      body: JSON.stringify(educationData),
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
          { CurrencyID: 2, Code: 'EUR', Symbol: '�', Name: 'Euro' }
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
      // Return comprehensive fallback data with Indian focus
      return {
        success: true,
        data: [
          // Top Indian Universities
          { id: 1, name: 'Indian Institute of Technology (IIT) Delhi', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.iitd.ac.in' },
          { id: 2, name: 'Indian Institute of Technology (IIT) Bombay', type: 'University', country: 'India', state: 'Maharashtra', website: 'https://www.iitb.ac.in' },
          { id: 3, name: 'Indian Institute of Technology (IIT) Kanpur', type: 'University', country: 'India', state: 'Uttar Pradesh', website: 'https://www.iitk.ac.in' },
          { id: 4, name: 'Indian Institute of Technology (IIT) Madras', type: 'University', country: 'India', state: 'Tamil Nadu', website: 'https://www.iitm.ac.in' },
          { id: 5, name: 'Indian Institute of Science (IISc) Bangalore', type: 'University', country: 'India', state: 'Karnataka', website: 'https://www.iisc.ac.in' },
          { id: 6, name: 'All India Institute of Medical Sciences (AIIMS) Delhi', type: 'Medical University', country: 'India', state: 'Delhi', website: 'https://www.aiims.edu' },
          { id: 7, name: 'Jawaharlal Nehru University (JNU)', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.jnu.ac.in' },
          { id: 8, name: 'University of Delhi', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.du.ac.in' },
          { id: 9, name: 'Banaras Hindu University (BHU)', type: 'University', country: 'India', state: 'Uttar Pradesh', website: 'https://www.bhu.ac.in' },
          { id: 10, name: 'Jamia Millia Islamia', type: 'University', country: 'India', state: 'Delhi', website: 'https://www.jmi.ac.in' },
          { id: 11, name: 'Aligarh Muslim University', type: 'University', country: 'India', state: 'Uttar Pradesh', website: 'https://www.amu.ac.in' },
          { id: 12, name: 'Jadavpur University', type: 'University', country: 'India', state: 'West Bengal', website: 'https://www.jaduniv.edu.in' },
          { id: 13, name: 'Anna University', type: 'University', country: 'India', state: 'Tamil Nadu', website: 'https://www.annauniv.edu' },
          { id: 14, name: 'Indian Statistical Institute (ISI)', type: 'University', country: 'India', state: 'West Bengal', website: 'https://www.isical.ac.in' },
          { id: 15, name: 'Birla Institute of Technology and Science (BITS) Pilani', type: 'University', country: 'India', state: 'Rajasthan', website: 'https://www.bits-pilani.ac.in' },
          
          // International Universities (if country is India, show some popular international options)
          { id: 51, name: 'Harvard University', type: 'University', country: 'United States', state: 'Massachusetts', website: 'https://www.harvard.edu' },
          { id: 52, name: 'Stanford University', type: 'University', country: 'United States', state: 'California', website: 'https://www.stanford.edu' },
          { id: 53, name: 'Massachusetts Institute of Technology (MIT)', type: 'University', country: 'United States', state: 'Massachusetts', website: 'https://www.mit.edu' },
          { id: 54, name: 'University of Oxford', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.ox.ac.uk' },
          { id: 55, name: 'University of Cambridge', type: 'University', country: 'United Kingdom', state: 'England', website: 'https://www.cam.ac.uk' },
          
          // Other option
          { id: 999999, name: 'Other', type: 'Other', country: 'Various', state: null, website: null },
        ]
      };
    }
  }

  // NEW: Get universities by specific country (for employer job posting)
  async getUniversitiesByCountry(country) {
    try {
      const params = new URLSearchParams({ country });
      return await this.apiCall(`/reference/universities-by-country?${params.toString()}`);
    } catch (error) {
      console.warn('Failed to load universities by country:', error.message);
      return {
        success: true,
        data: {
          country: country,
          totalUniversities: 0,
          universitiesByState: {}
        }
      };
    }
  }

  // NEW: Get organizations (companies) with improved parameters and fallback data
  async getOrganizations(source = 'database', country = 'IN', limit = 1000) {
    try {
      // Build query parameters for external company fetching
      const params = new URLSearchParams({
        source: source,        // database, external, or all
        limit: limit.toString() // Limit number of results
      });
      // Only pass country when calling external sources to avoid confusion
      if (source !== 'database' && country) {
        params.append('country', country);
      }

      const res = await this.apiCall(`/reference/organizations?${params.toString()}`);

      // Normalize response to always return an array at data level
      const organizations = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.organizations)
          ? res.data.organizations
          : [];

      return { success: true, data: organizations };
    } catch (error) {
      console.warn('Failed to load organizations:', error.message);
      // Return comprehensive fallback data as a flat array
      return {
        success: true,
        data: [
          { id: 1, name: 'Google', industry: 'Technology', size: '1000+', type: 'Corporation' },
          { id: 2, name: 'Microsoft', industry: 'Technology', size: '1000+', type: 'Corporation' },
          { id: 3, name: 'Apple', industry: 'Technology', size: '1000+', type: 'Corporation' },
          { id: 4, name: 'Amazon', industry: 'E-commerce', size: '1000+', type: 'Corporation' },
          { id: 5, name: 'Meta (Facebook)', industry: 'Technology', size: '1000+', type: 'Corporation' },
          { id: 6, name: 'Tesla', industry: 'Automotive', size: '201-1000', type: 'Corporation' },
          { id: 7, name: 'Netflix', industry: 'Entertainment', size: '201-1000', type: 'Corporation' },
          { id: 8, name: 'Spotify', industry: 'Entertainment', size: '51-200', type: 'Corporation' },
          // Indian companies
          { id: 20, name: 'Tata Consultancy Services', industry: 'Technology', size: '1000+', type: 'Corporation' },
          { id: 21, name: 'Infosys', industry: 'Technology', size: '1000+', type: 'Corporation' },
          { id: 22, name: 'Wipro', industry: 'Technology', size: '1000+', type: 'Corporation' },
          { id: 23, name: 'Flipkart', industry: 'E-commerce', size: '201-1000', type: 'Corporation' },
          { id: 24, name: 'Zomato', industry: 'Food Delivery', size: '51-200', type: 'Corporation' },
          { id: 25, name: 'Paytm', industry: 'Fintech', size: '51-200', type: 'Corporation' },
          { id: 999999, name: 'My company is not listed', industry: 'Other', size: 'Unknown', type: 'Other' }
        ]
      };
    }
  }

  // Initialize employer profile + organization for an existing user
  async initializeEmployerProfile(data) {
    return this.apiCall('/employers/initialize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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