import React, { createContext, useContext, useState, useEffect } from 'react';
import nexhireAPI from '../services/api';
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // ?? NEW: Store Google auth data for new users who need to complete registration
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState(null);

  // Initialize smart auth methods
  const smartMethods = createSmartAuthMethods(nexhireAPI, setUser, setError);

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

  // ?? NEW: Google Sign-In Flow
  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('?? Starting Google Sign-In flow...');
      
      // Step 1: Get Google authentication
      const googleResult = await googleAuth.signIn();
      
      if (!googleResult.success) {
        if (googleResult.cancelled) {
          console.log('?? User cancelled Google Sign-In');
          return { success: false, cancelled: true, message: 'Google Sign-In was cancelled' };
        }
        if (googleResult.dismissed) {
          console.log('?? User dismissed Google Sign-In popup');
          return { success: false, dismissed: true, message: 'Authentication popup was closed' };
        }
        if (googleResult.needsConfig) {
          console.log('?? Google OAuth not configured');
          return { 
            success: false, 
            error: googleResult.error,
            needsConfig: true
          };
        }
        throw new Error(googleResult.error || 'Google authentication failed');
      }

      console.log('? Google auth successful, checking with backend...');

      // Step 2: Try to login with existing account
      try {
        const loginResult = await nexhireAPI.loginWithGoogle(googleResult.data);
        
        if (loginResult.success) {
          console.log('? Existing user login successful');
          setUser(loginResult.data.user);
          return { success: true, user: loginResult.data.user };
        }
        
        // Check if it's a user not found error
        if (loginResult.needsRegistration) {
          console.log('?? New user detected, storing Google data for registration');
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
        console.log('?? Login attempt failed:', loginError.message);
        
        // If it's a user not found error, prepare for registration
        if (loginError.message.includes('not found') || loginError.message.includes('USER_NOT_FOUND')) {
          console.log('?? New user detected, storing Google data for registration');
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
      console.error('?? Google Sign-In error:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // ?? NEW: Complete Google registration after user selects type
  const completeGoogleRegistration = async (userTypeData) => {
    try {
      if (!pendingGoogleAuth) {
        throw new Error('No pending Google authentication data found');
      }

      setLoading(true);
      setError(null);

      console.log('?? Completing Google registration...');
      console.log('??? User type:', userTypeData.userType);
      console.log('?? Email:', pendingGoogleAuth.user.email);

      // Register with Google data + user type selection
      const result = await nexhireAPI.registerWithGoogle(pendingGoogleAuth, userTypeData);

      if (result.success) {
        console.log('? Google registration completed successfully');
        setUser(result.data.user);
        setPendingGoogleAuth(null); // Clear pending data
        
        // Return success with indication that profile may need completion
        return { 
          success: true, 
          user: result.data.user,
          needsProfileCompletion: true,
          userType: userTypeData.userType
        };
      } else {
        throw new Error(result.error || result.message || 'Registration failed');
      }

    } catch (error) {
      const errorMessage = error.message || 'Google registration failed';
      console.error('? Google registration error:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // ?? NEW: Clear pending Google auth (if user cancels registration)
  const clearPendingGoogleAuth = () => {
    setPendingGoogleAuth(null);
  };

  // Existing login method (unchanged)
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

  // Existing register method (FIXED - no timing hacks needed)
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== AUTH CONTEXT REGISTRATION DEBUG ===');
      console.log('Attempting registration for:', userData.email);
      console.log('Full userData received:', JSON.stringify(userData, null, 2));
      
      // ?? Check if this is a Google OAuth registration
      const isGoogleRegistration = !!userData.googleAuth;
      
      // Separate education and work experience data from registration data
      const { educationData, workExperienceData, jobPreferences, ...registrationData } = userData;
      
      // ?? Add placeholder password for Google OAuth users if not provided
      if (isGoogleRegistration && !registrationData.password) {
        registrationData.password = `google-oauth-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        console.log('?? Added placeholder password for Google OAuth user');
      }
      
      console.log('Separated registration data:', JSON.stringify(registrationData, null, 2));
      console.log('Separated education data:', educationData ? JSON.stringify(educationData, null, 2) : 'None');
      console.log('Separated work experience data:', workExperienceData ? JSON.stringify(workExperienceData, null, 2) : 'None');
      console.log('Separated job preferences:', jobPreferences ? JSON.stringify(jobPreferences, null, 2) : 'None');
      
      console.log('Calling API register with:', JSON.stringify(registrationData, null, 2));
      const result = await nexhireAPI.register(registrationData);
      console.log('API register result:', result);
      
      if (result.success) {
        console.log('Registration successful, attempting auto-login...');
        
        // ?? Handle different login flows for Google vs regular users
        let loginResult;
        
        if (isGoogleRegistration) {
          console.log('?? Attempting Google OAuth login after registration...');
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
            
            loginResult = await nexhireAPI.loginWithGoogle(googleLoginData);
            console.log('?? Google login result:', loginResult);
          } catch (googleLoginError) {
            console.warn('?? Google login failed, falling back to regular login:', googleLoginError);
            // Fallback to regular login with placeholder password
            loginResult = await login(userData.email, registrationData.password);
          }
        } else {
          // Regular user login
          loginResult = await login(userData.email, userData.password);
        }
        
        if (loginResult.success) {
          console.log('Auto-login successful, now saving additional profile data...');
          
          // ?? FIXED: Ensure API token is properly set before profile updates
          await nexhireAPI.init(); // Re-initialize API to sync token
          
          // Save education data if provided
          if (educationData) {
            console.log('Saving education data:', JSON.stringify(educationData, null, 2));
            try {
              const educationResult = await nexhireAPI.updateEducation(educationData);
              console.log('Education save result:', educationResult);
              if (educationResult.success) {
                console.log('? Education data saved successfully');
              } else {
                console.warn('? Education data save failed:', educationResult.error);
              }
            } catch (educationError) {
              console.warn('? Error saving education data:', educationError);
            }
          }
          
          // Save work experience data (new API) if provided and has required fields
          if (workExperienceData) {
            const jobTitle = workExperienceData.currentJobTitle || workExperienceData.jobTitle;
            const companyName = workExperienceData.currentCompany || workExperienceData.companyName;
            const organizationId = workExperienceData.organizationId || null;
            const startDate = workExperienceData.startDate || workExperienceData.start_date;
            const endDate = workExperienceData.endDate || workExperienceData.end_date;
            
            if (jobTitle && startDate) {
              console.log('Creating initial work experience with new API');
              try {
                const createResult = await nexhireAPI.createWorkExperience({
                  jobTitle,
                  companyName,
                  organizationId,
                  startDate,
                  endDate: endDate || null,
                });
                console.log('Create work experience result:', createResult);
              } catch (workError) {
                console.warn('Error creating initial work experience:', workError);
              }
            } else {
              console.log('Skipping work experience creation (missing jobTitle or startDate)');
            }
          }
          
          // Save job preferences if provided
          if (jobPreferences) {
            console.log('Saving job preferences:', JSON.stringify(jobPreferences, null, 2));
            try {
              const jobPreferencesResult = await nexhireAPI.updateJobPreferences(jobPreferences);
              console.log('Job preferences save result:', jobPreferencesResult);
              if (jobPreferencesResult.success) {
                console.log('? Job preferences saved successfully');
              } else {
                console.warn('? Job preferences save failed:', jobPreferencesResult.error);
              }
            } catch (jobPreferencesError) {
              console.warn('? Error saving job preferences:', jobPreferencesError);
            }
          }
          
          console.log('? Registration flow completed successfully');
        }
        
        console.log('=== END AUTH CONTEXT REGISTRATION DEBUG ===');
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
      console.log('Starting logout process for user:', user?.Email);
      setLoading(true);
      
      // Revoke Google tokens if user signed in with Google
      if (user?.LoginMethod === 'Google' || user?.GoogleId) {
        try {
          console.log('?? Revoking Google tokens...');
          await googleAuth.signOut(user.GoogleAccessToken);
          console.log('? Google tokens revoked');
        } catch (googleError) {
          console.warn('?? Could not revoke Google tokens:', googleError);
        }
      }

      // Call API logout
      console.log('Calling API logout...');
      const result = await nexhireAPI.logout();
      
      if (result.success) {
        console.log('Logout successful:', result.message);
        setUser(null);
        setError(null);
        setPendingGoogleAuth(null); // Clear any pending Google auth
        console.log('User state cleared, should redirect to auth screens');
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
      console.log('Logout process completed');
    }
  };

  // Legacy profile update (kept for compatibility)
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
    pendingGoogleAuth, // ?? NEW: Expose pending Google auth data
    
    // Authentication methods
    login,
    loginWithGoogle, // ?? NEW: Google Sign-In method
    completeGoogleRegistration, // ?? NEW: Complete Google registration
    clearPendingGoogleAuth, // ?? NEW: Clear pending Google auth
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
    
    // ?? NEW: Google auth state helpers
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