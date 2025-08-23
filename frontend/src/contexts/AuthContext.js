import React, { createContext, useContext, useState, useEffect } from 'react';
import nexhireAPI from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setLoading(true);
      // Check if user has valid token
      const token = await nexhireAPI.getToken('nexhire_token');
      
      if (token) {
        console.log('Found stored token, verifying with server...');
        // Verify token is still valid by fetching profile
        const result = await nexhireAPI.getProfile();
        if (result.success) {
          console.log('Token valid, user authenticated:', result.data.Email);
          setUser(result.data);
        } else {
          console.log('Token invalid, clearing stored tokens');
          await nexhireAPI.clearTokens();
        }
      } else {
        console.log('No stored token found');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await nexhireAPI.clearTokens();
      setError('Authentication check failed');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Attempting login for:', email);
      const result = await nexhireAPI.login(email, password);
      
      if (result.success) {
        console.log('Login successful for:', result.data.user.Email);
        setUser(result.data.user);
        return { success: true, user: result.data.user };
      } else {
        const errorMessage = result.message || 'Login failed';
        console.error('Login failed:', errorMessage);
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      console.error('Login error:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('?? === AUTH CONTEXT REGISTRATION DEBUG ===');
      console.log('?? Attempting registration for:', userData.email);
      console.log('?? Full userData received:', JSON.stringify(userData, null, 2));
      
      // Separate education and work experience data from registration data
      const { educationData, workExperienceData, jobPreferences, ...registrationData } = userData;
      
      console.log('?? Separated registration data:', JSON.stringify(registrationData, null, 2));
      console.log('?? Separated education data:', educationData ? JSON.stringify(educationData, null, 2) : 'None');
      console.log('?? Separated work experience data:', workExperienceData ? JSON.stringify(workExperienceData, null, 2) : 'None');
      console.log('?? Separated job preferences:', jobPreferences ? JSON.stringify(jobPreferences, null, 2) : 'None');
      
      console.log('?? Calling API register with:', JSON.stringify(registrationData, null, 2));
      const result = await nexhireAPI.register(registrationData);
      console.log('?? API register result:', result);
      
      if (result.success) {
        console.log('? Registration successful, attempting auto-login...');
        // Auto-login after successful registration
        const loginResult = await login(userData.email, userData.password);
        
        if (loginResult.success) {
          console.log('? Auto-login successful, now saving additional profile data...');
          
          // Save education data if provided
          if (educationData) {
            console.log('?? Saving education data:', JSON.stringify(educationData, null, 2));
            try {
              const educationResult = await nexhireAPI.updateEducation(educationData);
              console.log('?? Education save result:', educationResult);
              if (educationResult.success) {
                console.log('? Education data saved successfully');
              } else {
                console.warn('?? Education data save failed:', educationResult.error);
                // Don't fail the entire registration for this
              }
            } catch (educationError) {
              console.warn('? Error saving education data:', educationError);
            }
          }
          
          // Save work experience data if provided (for experienced professionals)
          if (workExperienceData) {
            console.log('?? Saving work experience data:', JSON.stringify(workExperienceData, null, 2));
            try {
              const workExperienceResult = await nexhireAPI.updateWorkExperience(workExperienceData);
              console.log('?? Work experience save result:', workExperienceResult);
              if (workExperienceResult.success) {
                console.log('? Work experience data saved successfully');
              } else {
                console.warn('?? Work experience data save failed:', workExperienceResult.error);
              }
            } catch (workExperienceError) {
              console.warn('? Error saving work experience data:', workExperienceError);
            }
          }
          
          // Save job preferences if provided
          if (jobPreferences) {
            console.log('?? Saving job preferences:', JSON.stringify(jobPreferences, null, 2));
            try {
              const jobPreferencesResult = await nexhireAPI.updateJobPreferences(jobPreferences);
              console.log('?? Job preferences save result:', jobPreferencesResult);
              if (jobPreferencesResult.success) {
                console.log('? Job preferences saved successfully');
              } else {
                console.warn('?? Job preferences save failed:', jobPreferencesResult.error);
              }
            } catch (jobPreferencesError) {
              console.warn('? Error saving job preferences:', jobPreferencesError);
            }
          }
          
          console.log('?? Registration flow completed successfully');
        }
        
        console.log('?? === END AUTH CONTEXT REGISTRATION DEBUG ===');
        return loginResult;
      } else {
        const errorMessage = result.message || 'Registration failed';
        console.error('? Registration failed:', errorMessage);
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error.message || 'Registration failed';
      console.error('? Registration error:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('Starting logout process for user:', user?.Email);
      setLoading(true);
      
      // FIXED: Call API logout which now makes backend call
      console.log('Calling API logout...');
      const result = await nexhireAPI.logout();
      
      if (result.success) {
        console.log('Logout successful:', result.message);
        setUser(null);
        setError(null);
        console.log('User state cleared, should redirect to auth screens');
      } else {
        console.warn('Logout had issues but continuing:', result.message);
        // Still clear user state for security
        setUser(null);
        setError(null);
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Always clear user state even if logout call fails
      setUser(null);
      setError(null);
    } finally {
      setLoading(false);
      console.log('Logout process completed');
    }
  };

  const updateProfile = async (profileData) => {
    try {
      setError(null);
      console.log('Updating profile for:', user?.Email);
      const result = await nexhireAPI.updateProfile(profileData);
      
      if (result.success) {
        console.log('Profile updated successfully');
        setUser(result.data);
        return { success: true };
      } else {
        const errorMessage = result.message || 'Profile update failed';
        console.error('Profile update failed:', errorMessage);
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error.message || 'Profile update failed';
      console.error('Profile update error:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    // State
    user,
    loading,
    error,
    
    // Actions
    login,
    register,
    logout,
    updateProfile,
    clearError,
    checkAuthState,
    
    // Computed values
    isAuthenticated: !!user,
    isEmployer: user?.UserType === 'Employer',
    isJobSeeker: user?.UserType === 'JobSeeker',
    isAdmin: user?.UserType === 'Admin',
    userType: user?.UserType || null,
    userName: user ? `${user.FirstName} ${user.LastName}` : null,
    userEmail: user?.Email || null,
    userId: user?.UserID || null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};