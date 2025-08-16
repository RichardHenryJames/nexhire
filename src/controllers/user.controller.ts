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