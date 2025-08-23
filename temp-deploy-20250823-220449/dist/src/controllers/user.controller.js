"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWorkExperience = exports.updateEducation = exports.refreshToken = exports.deactivateAccount = exports.getDashboardStats = exports.verifyEmail = exports.changePassword = exports.updateProfile = exports.getProfile = exports.logout = exports.login = exports.register = void 0;
const user_service_1 = require("../services/user.service");
const auth_service_1 = require("../services/auth.service");
const middleware_1 = require("../middleware");
const validation_1 = require("../utils/validation");
// Register user
exports.register = (0, middleware_1.withErrorHandling)(async (req, context) => {
    const userData = await (0, validation_1.extractRequestBody)(req);
    const user = await user_service_1.UserService.register(userData);
    return {
        status: 201,
        jsonBody: (0, validation_1.successResponse)(user, 'User registered successfully')
    };
});
// Login user
exports.login = (0, middleware_1.withErrorHandling)(async (req, context) => {
    const loginData = await (0, validation_1.extractRequestBody)(req);
    const result = await user_service_1.UserService.login(loginData);
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(result, 'Login successful')
    };
});
// Logout user
exports.logout = (0, middleware_1.withAuth)(async (req, context, user) => {
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
            jsonBody: (0, validation_1.successResponse)(null, 'Logout successful')
        };
    }
    catch (error) {
        console.error('Logout error:', error);
        return {
            status: 500,
            jsonBody: (0, validation_1.errorResponse)('Logout failed', 'An error occurred during logout')
        };
    }
}, []);
// Get user profile
exports.getProfile = (0, middleware_1.withAuth)(async (req, context, user) => {
    const userProfile = await user_service_1.UserService.findById(user.userId);
    if (!userProfile) {
        return {
            status: 404,
            jsonBody: (0, validation_1.successResponse)(null, 'User not found')
        };
    }
    // Remove password from response
    const { Password, ...profileWithoutPassword } = userProfile;
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(profileWithoutPassword, 'Profile retrieved successfully')
    };
}, ['read:profile']);
// Update user profile
exports.updateProfile = (0, middleware_1.withAuth)(async (req, context, user) => {
    const updateData = await (0, validation_1.extractRequestBody)(req);
    const updatedUser = await user_service_1.UserService.updateProfile(user.userId, updateData);
    // Remove password from response
    const { Password, ...userWithoutPassword } = updatedUser;
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(userWithoutPassword, 'Profile updated successfully')
    };
}, ['write:profile']);
// Change password
exports.changePassword = (0, middleware_1.withAuth)(async (req, context, user) => {
    const { currentPassword, newPassword } = await (0, validation_1.extractRequestBody)(req);
    await user_service_1.UserService.changePassword(user.userId, currentPassword, newPassword);
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(null, 'Password changed successfully')
    };
}, ['write:profile']);
// Verify email
exports.verifyEmail = (0, middleware_1.withAuth)(async (req, context, user) => {
    await user_service_1.UserService.verifyEmail(user.userId);
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(null, 'Email verified successfully')
    };
}, ['write:profile']);
// Get dashboard stats
exports.getDashboardStats = (0, middleware_1.withAuth)(async (req, context, user) => {
    const stats = await user_service_1.UserService.getDashboardStats(user.userId);
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(stats, 'Dashboard stats retrieved successfully')
    };
}, ['read:profile']);
// Deactivate account
exports.deactivateAccount = (0, middleware_1.withAuth)(async (req, context, user) => {
    await user_service_1.UserService.deactivateAccount(user.userId);
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(null, 'Account deactivated successfully')
    };
}, ['write:profile']);
// Refresh token
exports.refreshToken = (0, middleware_1.withErrorHandling)(async (req, context) => {
    const { refreshToken } = await (0, validation_1.extractRequestBody)(req);
    // Verify refresh token
    const payload = auth_service_1.AuthService.verifyToken(refreshToken);
    if (payload.type !== 'refresh') {
        return {
            status: 400,
            jsonBody: (0, validation_1.errorResponse)('Invalid token type', 'Refresh token required')
        };
    }
    // Get user and generate new tokens
    const user = await user_service_1.UserService.findById(payload.userId);
    if (!user) {
        return {
            status: 404,
            jsonBody: (0, validation_1.errorResponse)('User not found', 'Invalid refresh token')
        };
    }
    const tokens = auth_service_1.AuthService.generateAuthTokens(user);
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(tokens, 'Token refreshed successfully')
    };
});
// Update applicant education data
exports.updateEducation = (0, middleware_1.withAuth)(async (req, context, user) => {
    const educationData = await (0, validation_1.extractRequestBody)(req);
    // Ensure user is a job seeker
    if (user.userType !== 'JobSeeker') {
        return {
            status: 403,
            jsonBody: (0, validation_1.errorResponse)('Access denied', 'Only job seekers can update education data')
        };
    }
    const updatedProfile = await user_service_1.UserService.updateEducation(user.userId, educationData);
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(updatedProfile, 'Education data updated successfully')
    };
}, ['write:profile']);
// Update applicant work experience data
exports.updateWorkExperience = (0, middleware_1.withAuth)(async (req, context, user) => {
    const workExperienceData = await (0, validation_1.extractRequestBody)(req);
    // Ensure user is a job seeker
    if (user.userType !== 'JobSeeker') {
        return {
            status: 403,
            jsonBody: (0, validation_1.errorResponse)('Access denied', 'Only job seekers can update work experience data')
        };
    }
    const updatedProfile = await user_service_1.UserService.updateWorkExperience(user.userId, workExperienceData);
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(updatedProfile, 'Work experience data updated successfully')
    };
}, ['write:profile']);
//# sourceMappingURL=user.controller.js.map