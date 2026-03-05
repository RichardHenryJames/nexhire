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
    
    // Extract request metadata for consent audit logging (DPDPA compliance)
    const requestMeta = {
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || req.headers.get('client-ip') || null,
        userAgent: req.headers.get('user-agent') || null,
    };
    
    const user = await UserService.register(userData, requestMeta);
    
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

/**
 * Google OAuth Login
 * POST /auth/google
 */
export const googleLogin = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const { accessToken, idToken, user: googleUser } = await extractRequestBody(req);
    
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

/**
 * Google OAuth Registration
 * POST /auth/google-register
 */
export const googleRegister = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const { accessToken, idToken, user: googleUser, userType, ...additionalData } = await extractRequestBody(req);
    
    // Extract request metadata for consent audit logging (DPDPA compliance)
    const requestMeta = {
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || req.headers.get('client-ip') || null,
        userAgent: req.headers.get('user-agent') || null,
    };
    
    try {
        // Register new user with Google data
        const result = await UserService.registerWithGoogle({
            accessToken,
            idToken,
            googleUser,
            userType,
            ...additionalData
        }, requestMeta);
        
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

/**
 * Logout user
 * POST /auth/logout
 */
export const logout = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    try {
        // Client will clear the tokens locally
        // Additional logout logic (invalidate refresh tokens, log activity) can be added here
        
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
    
    // Add profileCompleteness for Employers
    let profileCompleteness = 0;
    if (userProfile.UserType === 'Employer') {
        profileCompleteness = await UserService.calculateEmployerProfileCompleteness(user.userId);
    }
    
    return {
        status: 200,
        jsonBody: successResponse({
            ...profileWithoutPassword,
            profileCompleteness
        }, 'Profile retrieved successfully')
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

/**
 * Request Password Reset
 * POST /auth/forgot-password
 */
export const forgotPassword = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const { email } = await extractRequestBody(req);
    
    if (!email) {
        return {
            status: 400,
            jsonBody: errorResponse('VALIDATION_ERROR', 'Email is required')
        };
    }

    const result = await UserService.requestPasswordReset(email);
    
    return {
        status: 200,
        jsonBody: successResponse(result, result.message)
    };
});

/**
 * Reset Password with Token
 * POST /auth/reset-password
 */
export const resetPassword = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const { token, newPassword } = await extractRequestBody(req);
    
    if (!token || !newPassword) {
        return {
            status: 400,
            jsonBody: errorResponse('VALIDATION_ERROR', 'Token and new password are required')
        };
    }

    if (newPassword.length < 8) {
        return {
            status: 400,
            jsonBody: errorResponse('VALIDATION_ERROR', 'Password must be at least 8 characters long')
        };
    }

    const result = await UserService.resetPassword(token, newPassword);
    
    return {
        status: 200,
        jsonBody: successResponse(result, result.message)
    };
});

/**
 * Set Password for Google Users
 * POST /auth/set-password
 * For Google-only users to set a password (so they can login with email/password too)
 */
export const setPassword = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // Extract user ID from auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            status: 401,
            jsonBody: errorResponse('UNAUTHORIZED', 'Authorization required')
        };
    }
    const token = authHeader.replace('Bearer ', '');
    const decoded = AuthService.verifyToken(token);
    const userId = decoded.userId;

    const { newPassword } = await extractRequestBody(req);
    
    if (!newPassword) {
        return {
            status: 400,
            jsonBody: errorResponse('VALIDATION_ERROR', 'New password is required')
        };
    }

    if (newPassword.length < 8) {
        return {
            status: 400,
            jsonBody: errorResponse('VALIDATION_ERROR', 'Password must be at least 8 characters long')
        };
    }

    const result = await UserService.setPasswordForGoogleUser(userId, newPassword);
    
    return {
        status: 200,
        jsonBody: successResponse(result, result.message)
    };
});

/**
 * Check if User Has Password
 * GET /auth/has-password
 * Check if current user has a password set (for Google users)
 */
export const hasPassword = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // Extract user ID from auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            status: 401,
            jsonBody: errorResponse('UNAUTHORIZED', 'Authorization required')
        };
    }
    const token = authHeader.replace('Bearer ', '');
    const decoded = AuthService.verifyToken(token);
    const userId = decoded.userId;

    const hasPasswordSet = await UserService.hasPasswordSet(userId);
    
    return {
        status: 200,
        jsonBody: successResponse({ hasPassword: hasPasswordSet })
    };
});

/**
 * Accept Terms & Conditions / Privacy Policy
 * POST /users/accept-terms
 * Called when existing users need to re-accept after a version update.
 */
export const acceptTerms = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
    const { termsVersion, privacyPolicyVersion } = await extractRequestBody(req);
    
    if (!termsVersion || !privacyPolicyVersion) {
        return {
            status: 400,
            jsonBody: errorResponse('VALIDATION_ERROR', 'termsVersion and privacyPolicyVersion are required')
        };
    }
    
    // Extract request metadata for consent audit logging (DPDPA compliance)
    const requestMeta = {
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || req.headers.get('client-ip') || null,
        userAgent: req.headers.get('user-agent') || null,
    };
    
    await UserService.acceptTerms(user.userId, { termsVersion, privacyPolicyVersion }, requestMeta);
    
    return {
        status: 200,
        jsonBody: successResponse(null, 'Terms accepted successfully')
    };
}, ['write:profile']);