import React, { createContext, useContext, useState, useEffect } from 'react';
import refopenAPI from '../services/api';
import googleAuth from '../services/googleAuth';
import { createSmartAuthMethods } from '../services/smartProfileUpdate';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// NEW: Helper functions for sessionStorage persistence
const GOOGLE_AUTH_STORAGE_KEY = 'refopen_pending_google_auth';

const savePendingGoogleAuthToStorage = (data) => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (data) {
        sessionStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(data));
      } else {
        sessionStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
      }
    }
  } catch (error) {
    console.warn('Failed to save to sessionStorage:', error);
  }
};

const loadPendingGoogleAuthFromStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = sessionStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return data;
      }
    }
  } catch (error) {
    console.warn('Failed to load from sessionStorage:', error);
  }
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // IMPROVED: Initialize from sessionStorage on mount
  const [pendingGoogleAuth, setPendingGoogleAuthState] = useState(() => {
    return loadPendingGoogleAuthFromStorage();
  });

  // NEW: Wrapper to sync with sessionStorage
  const setPendingGoogleAuth = (data) => {
    setPendingGoogleAuthState(data);
    savePendingGoogleAuthToStorage(data);
  };

  // Initialize smart auth methods
  const smartMethods = createSmartAuthMethods(refopenAPI, setUser, setError);

  // Initialize auth state on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  // Global session-expired hook: any API call that detects expired/invalid token forces user back to Login
  useEffect(() => {
    refopenAPI.setOnSessionExpired(() => {
      setUser(null);
      setError(null);
      setPendingGoogleAuth(null);
    });

    return () => {
      refopenAPI.setOnSessionExpired(null);
    };
  }, []);

  // DEBUG: Track pendingGoogleAuth state changes
  useEffect(() => {
  }, [pendingGoogleAuth]);

  const checkAuthState = async () => {
    try {
      setLoading(true);
      // Check if user has valid token
      const token = await refopenAPI.getToken('refopen_token');
      
      if (token) {
        // Verify token is still valid by fetching profile
        const result = await refopenAPI.getProfile();
        if (result.success) {
          setUser(result.data);
        } else {
          await refopenAPI.clearTokens();
          // FIXED: Don't set error for normal token expiration
          setError(null);
        }
      } else {
        
        // FIXED: This is a normal state, not an error
        setError(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await refopenAPI.clearTokens();
      // FIXED: Don't show error to user for normal auth check failures
      // The user will see the login screen anyway
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Google Sign-In Flow
  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      
      
      // Step 1: Get Google authentication
      const googleResult = await googleAuth.signIn();
      
      if (!googleResult.success) {
        if (googleResult.cancelled) {
          
          return { success: false, cancelled: true, message: 'Google Sign-In was cancelled' };
        }
        if (googleResult.dismissed) {
          
          return { success: false, dismissed: true, message: 'Authentication popup was closed' };
        }
        if (googleResult.needsConfig) {
          
          return { 
            success: false, 
            error: googleResult.error,
            needsConfig: true
          };
        }
        throw new Error(googleResult.error || 'Google authentication failed');
      }

      

      // Step 2: Try to login with existing account
      try {
        const loginResult = await refopenAPI.loginWithGoogle(googleResult.data);
        
        if (loginResult.success) {
          
          setUser(loginResult.data.user);
          return { success: true, user: loginResult.data.user };
        }
        
        // Check if it's a user not found error
        if (loginResult.needsRegistration) {
          
          setPendingGoogleAuth(googleResult.data);
          
          
          
          return { 
            success: false, 
            needsRegistration: true,
            googleUser: googleResult.data.user,
            message: 'New user needs to complete registration'
          };
        }
        
        throw new Error(loginResult.error || 'Login failed');
        
      } catch (loginError) {
        
        
        // If it's a user not found error, prepare for registration
        if (loginError.message.includes('not found') || loginError.message.includes('USER_NOT_FOUND')) {
          
          setPendingGoogleAuth(googleResult.data);
          
          
          
          return { 
            success: false, 
            needsRegistration: true,
            googleUser: googleResult.data.user,
            message: 'New user needs to complete registration'
          };
        }
        
        throw loginError;
      }

    } catch (error) {
      const errorMessage = error.message || 'Google Sign-In failed';
      console.error('Google Sign-In error:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // IMPROVED: Clear pending Google auth
  const clearPendingGoogleAuth = () => {
    setPendingGoogleAuth(null);
  };

  // Existing login method (unchanged)
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      
      const result = await refopenAPI.login(email, password);
      
      if (result.success) {
        
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

  // Existing register method (FIXED - no timing hacks needed)
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      
      
      
      
      // Check if this is a Google OAuth registration
      const isGoogleRegistration = !!userData.googleAuth;
      
      // Separate education and work experience data from registration data
      const { educationData, workExperienceData, jobPreferences, ...registrationData } = userData;
      
      // Add placeholder password for Google OAuth users if not provided
      if (isGoogleRegistration && !registrationData.password) {
        registrationData.password = `google-oauth-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        
      }
      
      
      
      
      
      
      
      const result = await refopenAPI.register(registrationData);
      
      
      if (result.success) {
        
        
        // Handle different login flows for Google vs regular users
        let loginResult;
        
        if (isGoogleRegistration) {
          
          // For Google users, try to login with Google OAuth data
          try {
            const googleLoginData = {
              accessToken: userData.googleAuth.accessToken,
              idToken: userData.googleAuth.idToken,
              user: {
                id: userData.googleAuth.googleId,
                email: userData.email,
                name: `${userData.firstName} ${userData.lastName}`,
                verified_email: userData.googleAuth.verified,
                picture: userData.googleAuth.picture,
              }
            };
            
            loginResult = await refopenAPI.loginWithGoogle(googleLoginData);
            
          } catch (googleLoginError) {
            console.warn('Google login failed, falling back to regular login:', googleLoginError);
            // Fallback to regular login with placeholder password
            loginResult = await login(userData.email, registrationData.password);
          }
        } else {
          // Regular user login
          loginResult = await login(userData.email, userData.password);
        }
        
        if (loginResult.success) {
          
          
          // CRITICAL FIX: Set user state so isAuthenticated becomes true
          setUser(loginResult.user || loginResult.data?.user);
          
          
          // FIXED: Ensure API token is properly set before profile updates
          await refopenAPI.init(); // Re-initialize API to sync token
          
          // Save education data if provided
          if (educationData) {
            
            try {
              const educationResult = await refopenAPI.updateEducation(educationData);
              
              if (educationResult.success) {
                
              } else {
                console.warn('? Education data save failed:', educationResult.error);
              }
            } catch (educationError) {
              console.warn('? Error saving education data:', educationError);
            }
          }
          
          // Save work experience data (new API) if provided and has required fields
          if (workExperienceData) {
            
            
            // Normalize to array
            const workExperiences = Array.isArray(workExperienceData) ? workExperienceData : [workExperienceData];
            
            
            // Save each work experience
            for (const [index, workExp] of workExperiences.entries()) {
              const jobTitle = workExp.currentJobTitle || workExp.jobTitle;
              const companyName = workExp.currentCompany || workExp.companyName;
              const organizationId = workExp.organizationId || null;
              const startDate = workExp.startDate || workExp.start_date;
              const endDate = workExp.endDate || workExp.end_date;
              const isCurrentPosition = workExp.isCurrentPosition !== undefined ? workExp.isCurrentPosition : !endDate;
              
              if (jobTitle && startDate) {
                
                
                
                
                try {
                  const createResult = await refopenAPI.createWorkExperience({
                    jobTitle,
                    companyName,
                    organizationId,
                    startDate,
                    endDate: isCurrentPosition ? null : endDate,
                    isCurrent: isCurrentPosition,
                    // Additional optional fields
                    workArrangement: workExp.workArrangement || null,
                    jobType: workExp.jobType || null,
                    primarySkills: workExp.primarySkills || null,
                    secondarySkills: workExp.secondarySkills || null,
                    description: workExp.summary || null, // ??? FIXED: Map summary to description for backend
                  });
                  
                  if (createResult.success) {
                    
                  } else {
                    console.warn(`Work experience ${index + 1} save failed:`, createResult.error);
                  }
                } catch (workError) {
                  console.warn(`Error creating work experience ${index + 1}:`, workError);
                }
              } else {
                
              }
            }
            
            
          }
          
          // Save job preferences if provided
          if (jobPreferences) {
            
            try {
              const jobPreferencesResult = await refopenAPI.updateJobPreferences(jobPreferences);
              
              if (jobPreferencesResult.success) {
                
              } else {
                console.warn('? Job preferences save failed:', jobPreferencesResult.error);
              }
            } catch (jobPreferencesError) {
              console.warn('? Error saving job preferences:', jobPreferencesError);
            }
          }
          
          
        }
        
        
        return loginResult;
      } else {
        const errorMessage = result.message || 'Registration failed';
        console.error('Registration failed:', errorMessage);
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error.message || 'Registration failed';
      console.error('Registration error:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Enhanced logout to handle Google tokens
  const logout = async () => {
    try {
      
      setLoading(true);
      
      // Revoke Google tokens if user signed in with Google
      if (user?.LoginMethod === 'Google' || user?.GoogleId) {
        try {
          
          await googleAuth.signOut(user.GoogleAccessToken);
          
        } catch (googleError) {
          console.warn('Could not revoke Google tokens:', googleError);
        }
      }

      // Call API logout
      
      const result = await refopenAPI.logout();
      
      if (result.success) {
        
        setUser(null);
        setError(null);
        setPendingGoogleAuth(null); // Clear any pending Google auth
        
      } else {
        console.warn('Logout had issues but continuing:', result.message);
        setUser(null);
        setError(null);
        setPendingGoogleAuth(null);
      }
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setError(null);
      setPendingGoogleAuth(null);
    } finally {
      setLoading(false);
      
    }
  };

  // Legacy profile update (kept for compatibility)
  const updateProfile = async (profileData) => {
    try {
      setError(null);
      
      const result = await refopenAPI.updateProfile(profileData);
      
      if (result.success) {
        
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

  // Smart profile updates
  const updateProfileSmart = async (profileData) => {
    return await smartMethods.updateProfileSmart(profileData);
  };

  const togglePrivacySetting = async (setting, value) => {
    return await smartMethods.togglePrivacySetting(setting, value);
  };

  const updateCompleteProfile = async (profileData) => {
    return await smartMethods.updateCompleteProfile(profileData);
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    pendingGoogleAuth, // NEW: Expose pending Google auth data
    
    // Authentication methods
    login,
    loginWithGoogle, // NEW: Google Sign-In method
    clearPendingGoogleAuth, // NEW: Clear pending Google auth
    register,
    logout,
    
    // Profile methods
    updateProfile,           
    updateProfileSmart,
    togglePrivacySetting,
    updateCompleteProfile,
    
    // Utility methods
    clearError,
    checkAuthState,
    
    // User state helpers
    isAuthenticated: !!user,
    isEmployer: user?.UserType === 'Employer',
    isJobSeeker: user?.UserType === 'JobSeeker',
    isAdmin: user?.UserType === 'Admin',
    userType: user?.UserType || null,
    userName: user ? `${user.FirstName} ${user.LastName}` : null,
    userEmail: user?.Email || null,
    userId: user?.UserID || null,
    
    // NEW: Google auth state helpers
    hasGoogleAuth: !!user?.GoogleId,
    isGoogleUser: user?.LoginMethod === 'Google',
    hasPendingGoogleAuth: !!pendingGoogleAuth,
    googleAuthAvailable: googleAuth.isConfigured(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};