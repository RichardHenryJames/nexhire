"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const config_1 = require("../config");
class AuthService {
    // Hash password
    static async hashPassword(password) {
        const saltRounds = 12;
        return await bcryptjs_1.default.hash(password, saltRounds);
    }
    // Verify password
    static async verifyPassword(password, hashedPassword) {
        return await bcryptjs_1.default.compare(password, hashedPassword);
    }
    // Generate JWT token
    static generateToken(payload, type = config_1.appConstants.tokenTypes.ACCESS) {
        const tokenPayload = { ...payload, type };
        // Convert time strings to proper format for JWT
        const expiresIn = type === config_1.appConstants.tokenTypes.REFRESH
            ? config_1.jwtConfig.refreshExpiresIn
            : config_1.jwtConfig.expiresIn;
        const options = {
            expiresIn: expiresIn, // Type assertion to handle StringValue type issue
            issuer: 'nexhire-api',
            audience: 'nexhire-app'
        };
        return jsonwebtoken_1.default.sign(tokenPayload, config_1.jwtConfig.secret, options);
    }
    // Generate auth tokens
    static generateAuthTokens(user) {
        const payload = {
            userId: user.UserID,
            email: user.Email,
            userType: user.UserType
        };
        const accessToken = this.generateToken(payload, config_1.appConstants.tokenTypes.ACCESS);
        const refreshToken = this.generateToken(payload, config_1.appConstants.tokenTypes.REFRESH);
        return { accessToken, refreshToken };
    }
    // Verify JWT token
    static verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, config_1.jwtConfig.secret, {
                issuer: 'nexhire-api',
                audience: 'nexhire-app'
            });
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new Error('Token expired');
            }
            else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            throw new Error('Token verification failed');
        }
    }
    // Generate email verification token
    static generateEmailVerificationToken(userId, email) {
        return this.generateToken({ userId, email, userType: '' }, config_1.appConstants.tokenTypes.EMAIL_VERIFICATION);
    }
    // Generate password reset token
    static generatePasswordResetToken(userId, email) {
        return this.generateToken({ userId, email, userType: '' }, config_1.appConstants.tokenTypes.PASSWORD_RESET);
    }
    // Extract token from Authorization header
    static extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }
    // Generate unique ID
    static generateUniqueId() {
        return (0, uuid_1.v4)();
    }
    // Validate user permissions
    static validateUserPermissions(userType, requiredPermissions) {
        const userPermissions = this.getUserPermissions(userType);
        return requiredPermissions.every(permission => userPermissions.includes(permission));
    }
    // Get user permissions based on user type
    static getUserPermissions(userType) {
        switch (userType) {
            case config_1.appConstants.userTypes.ADMIN:
                return [
                    'read:users', 'write:users', 'delete:users',
                    'read:jobs', 'write:jobs', 'delete:jobs',
                    'read:applications', 'write:applications', 'delete:applications',
                    'read:organizations', 'write:organizations', 'delete:organizations',
                    'admin:system'
                ];
            case config_1.appConstants.userTypes.EMPLOYER:
                return [
                    'read:profile', 'write:profile',
                    'read:jobs', 'write:jobs',
                    'read:applications', 'write:applications',
                    'read:organization', 'write:organization'
                ];
            case config_1.appConstants.userTypes.JOB_SEEKER:
                return [
                    'read:profile', 'write:profile',
                    'read:jobs', 'apply:jobs',
                    'read:applications'
                ];
            default:
                return ['read:profile'];
        }
    }
    // Check if user can access resource
    static canAccessResource(userType, resourceType, action) {
        const permission = `${action}:${resourceType}`;
        return this.validateUserPermissions(userType, [permission]);
    }
    // Rate limiting helper
    static createRateLimitKey(ip, endpoint) {
        return `rate_limit:${ip}:${endpoint}`;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map