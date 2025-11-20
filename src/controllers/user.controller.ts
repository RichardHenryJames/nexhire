import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { 
    withErrorHandling, 
    withAuth
} from '../middleware';
import { 
    successResponse, 
    extractRequestBody,
    errorResponse
} from '../utils/validation';

// Register user
export const register = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const userData = await extractRequestBody(req);
    const user = await UserService.register(userData);
    
    return {
        status: 201,
        jsonBody: successResponse(user, 'User registered successfully')
    };
});

// Login user
export const login = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const loginData = await extractRequestBody(req);
    const result = await UserService.login(loginData);
    
    return {
        status: 200,
        jsonBody: successResponse(result, 'Login successful')
    };
});

// ?? NEW: Google OAuth Login
export const googleLogin = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const { accessToken, idToken, user: googleUser } = await extractRequestBody(req);
    
    console.log('Google login attempt for:', googleUser?.email);
    
    try {
        // Verify Google token and find/create user
        const result = await UserService.loginWithGoogle({
            accessToken,
            idToken,
            googleUser
        });
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'Google login successful')
        };
    } catch (error: any) {
        console.error('Google login failed:', error.message);
        
        // If user not found, return specific error for frontend to handle
        if (error.message.includes('User not found') || error.message.includes('not found')) {
            return {
                status: 404,
                jsonBody: errorResponse('USER_NOT_FOUND', 'Account not found. Please complete registration.')
            };
        }
        
        throw error;
    }
});

// ? NEW: Google OAuth Registration
export const googleRegister = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const { accessToken, idToken, user: googleUser, userType, ...additionalData } = await extractRequestBody(req);
    
    console.log('Google registration attempt for:', googleUser?.email, 'as', userType);
    
    try {
        // Register new user with Google data
        const result = await UserService.registerWithGoogle({
            accessToken,
            idToken,
            googleUser,
            userType,
            ...additionalData
        });
        
        return {
            status: 201,
            jsonBody: successResponse(result, 'Google registration successful')
        };
    } catch (error: any) {
        console.error('Google registration failed:', error.message);
        
        // If user already exists, return specific error
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            return {
                status: 409,
                jsonBody: errorResponse('USER_EXISTS', 'Account already exists. Please sign in instead.')
            };
        }
        
        throw error;
    }
});

// Logout user
export const logout = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        console.log('User logout:', user.userId, user.email);
        
        // Here you could add additional logout logic like:
        // - Invalidate refresh tokens in database
        // - Log logout activity
        // - Clear any user sessions
        
        // For now, we'll just acknowledge the logout
        // The client will clear the tokens locally
        
        return {
            status: 200,
            jsonBody: successResponse(null, 'Logout successful')
        };
    } catch (error) {
        console.error('Logout error:', error);
        return {
            status: 500,
            jsonBody: errorResponse('Logout failed', 'An error occurred during logout')
        };
    }
}, []);

// Get user profile
export const getProfile = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const userProfile = await UserService.findById(user.userId);
    
    if (!userProfile) {
        return {
            status: 404,
            jsonBody: successResponse(null, 'User not found')
        };
    }

    // Remove password from response
    const { Password, ...profileWithoutPassword } = userProfile;
    
    return {
        status: 200,
        jsonBody: successResponse(profileWithoutPassword, 'Profile retrieved successfully')
    };
}, ['read:profile']);

// Update user profile
export const updateProfile = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const updateData = await extractRequestBody(req);
    const updatedUser = await UserService.updateProfile(user.userId, updateData);
    
    // Remove password from response
    const { Password, ...userWithoutPassword } = updatedUser;
    
    return {
        status: 200,
        jsonBody: successResponse(userWithoutPassword, 'Profile updated successfully')
    };
}, ['write:profile']);

// Change password
export const changePassword = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const { currentPassword, newPassword } = await extractRequestBody(req);
    
    await UserService.changePassword(user.userId, currentPassword, newPassword);
    
    return {
        status: 200,
        jsonBody: successResponse(null, 'Password changed successfully')
    };
}, ['write:profile']);

// Verify email
export const verifyEmail = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    await UserService.verifyEmail(user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(null, 'Email verified successfully')
    };
}, ['write:profile']);

// Get dashboard stats
export const getDashboardStats = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const stats = await UserService.getDashboardStats(user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(stats, 'Dashboard stats retrieved successfully')
    };
}, ['read:profile']);

// Deactivate account
export const deactivateAccount = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    await UserService.deactivateAccount(user.userId);
    
    return {
        status: 200,
        jsonBody: successResponse(null, 'Account deactivated successfully')
    };
}, ['write:profile']);

// Refresh token
export const refreshToken = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const { refreshToken } = await extractRequestBody(req);
    
    // Verify refresh token
    const payload = AuthService.verifyToken(refreshToken);
    
    if (payload.type !== 'refresh') {
        return {
            status: 400,
            jsonBody: errorResponse('Invalid token type', 'Refresh token required')
        };
    }

    // Get user and generate new tokens
    const user = await UserService.findById(payload.userId);
    if (!user) {
        return {
            status: 404,
            jsonBody: errorResponse('User not found', 'Invalid refresh token')
        };
    }

    const tokens = AuthService.generateAuthTokens(user);
    
    return {
        status: 200,
        jsonBody: successResponse(tokens, 'Token refreshed successfully')
    };
});

// Update applicant education data
export const updateEducation = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const educationData = await extractRequestBody(req);
    
    // Ensure user is a job seeker
    if (user.userType !== 'JobSeeker') {
        return {
            status: 403,
            jsonBody: errorResponse('Access denied', 'Only job seekers can update education data')
        };
    }

    const updatedProfile = await UserService.updateEducation(user.userId, educationData);
    
    return {
        status: 200,
        jsonBody: successResponse(updatedProfile, 'Education data updated successfully')
    };
}, ['write:profile']);

// Update applicant work experience data
export const updateWorkExperience = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const workExperienceData = await extractRequestBody(req);
    
    // Ensure user is a job seeker
    if (user.userType !== 'JobSeeker') {
        return {
            status: 403,
            jsonBody: errorResponse('Access denied', 'Only job seekers can update work experience data')
        };
    }

    const updatedProfile = await UserService.updateWorkExperience(user.userId, workExperienceData);
    
    return {
        status: 200,
        jsonBody: successResponse(updatedProfile, 'Work experience data updated successfully')
    };
}, ['write:profile']);

// ? NEW: Get user's referral code and stats
export const getMyReferralCode = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        // Get user from auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return {
                status: 401,
                jsonBody: {
                    success: false,
                    error: 'Authorization required'
                }
            };
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = AuthService.verifyToken(token);
        const userId = decoded.userId;

        // Get user details
        const user = await UserService.findById(userId);
        if (!user) {
            return {
                status: 404,
                jsonBody: {
                    success: false,
                    error: 'User not found'
                }
            };
        }

        // Generate referral code from UserID (first part before hyphen)
        const referralCode = userId.split('-')[0];

        // Get referral stats
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT r.UserID) as TotalReferrals,
                SUM(CASE WHEN r.CreatedAt >= DATEADD(MONTH, -1, GETUTCDATE()) THEN 1 ELSE 0 END) as ReferralsLast30Days,
                SUM(CASE WHEN r.IsActive = 1 THEN 1 ELSE 0 END) as ActiveReferrals,
                MAX(r.CreatedAt) as LastReferralDate
            FROM Users r
            WHERE r.ReferredBy = @param0
        `;

        const { dbService } = await import('../services/database.service');
        const statsResult = await dbService.executeQuery(statsQuery, [userId]);
        const stats = statsResult.recordset[0] || {};

        // Calculate total bonus earned (₹50 per referral)
        const totalBonusEarned = (stats.TotalReferrals || 0) * 50;

        return {
            status: 200,
            jsonBody: {
                success: true,
                data: {
                    referralCode,
                    shareUrl: `https://refopen.com/register?ref=${referralCode}`,
                    stats: {
                        totalReferrals: stats.TotalReferrals || 0,
                        referralsLast30Days: stats.ReferralsLast30Days || 0,
                        activeReferrals: stats.ActiveReferrals || 0,
                        lastReferralDate: stats.LastReferralDate,
                        totalBonusEarned
                    },
                    bonusInfo: {
                        newUserBonus: 100,
                        referralBonus: 50,
                        description: "Invite friends and both get ₹50 when they sign up!"
                    }
                },
                message: 'Referral code retrieved successfully'
            }
        };
    } catch (error) {
        console.error('Error getting referral code:', error);
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get referral code'
            }
        };
    }
};