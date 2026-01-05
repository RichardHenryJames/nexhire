import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { jwtConfig, appConstants } from '../config';
import { User } from '../types';

export interface TokenPayload {
    userId: string;
    email: string;
    userType: string;
    type: string;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export class AuthService {
    // Hash password
    static async hashPassword(password: string): Promise<string> {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    // Verify password
    static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
        return await bcrypt.compare(password, hashedPassword);
    }

    // Generate JWT token
    static generateToken(payload: Omit<TokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>, type: string = appConstants.tokenTypes.ACCESS): string {
        const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss' | 'aud'> = { ...payload, type };
        
        // Convert time strings to proper format for JWT
        const expiresIn = type === appConstants.tokenTypes.REFRESH 
            ? jwtConfig.refreshExpiresIn 
            : jwtConfig.expiresIn;

        const options: SignOptions = {
            expiresIn: expiresIn as any, // Type assertion to handle StringValue type issue
            issuer: 'refopen-api',
            audience: 'refopen-app'
        };

        return jwt.sign(tokenPayload, jwtConfig.secret, options);
    }

    // Generate auth tokens
    static generateAuthTokens(user: User): AuthTokens {
        const payload = {
            userId: user.UserID,
            email: user.Email,
            userType: user.UserType
        };

        const accessToken = this.generateToken(payload, appConstants.tokenTypes.ACCESS);
        const refreshToken = this.generateToken(payload, appConstants.tokenTypes.REFRESH);

        return { accessToken, refreshToken };
    }

    // Verify JWT token
    static verifyToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, jwtConfig.secret, {
                issuer: 'refopen-api',
                audience: 'refopen-app'
            }) as TokenPayload;
        } catch (error: any) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new Error('Token expired');
            } else if (error instanceof jwt.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            throw new Error('Token verification failed');
        }
    }

    // Generate email verification token
    static generateEmailVerificationToken(userId: string, email: string): string {
        return this.generateToken(
            { userId, email, userType: '' }, 
            appConstants.tokenTypes.EMAIL_VERIFICATION
        );
    }

    // Generate password reset token
    static generatePasswordResetToken(userId: string, email: string): string {
        return this.generateToken(
            { userId, email, userType: '' }, 
            appConstants.tokenTypes.PASSWORD_RESET
        );
    }

    // Extract token from Authorization header
    static extractTokenFromHeader(authHeader: string): string | null {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }

    // Generate unique ID
    static generateUniqueId(): string {
        return uuidv4();
    }

    // Validate user permissions
    static validateUserPermissions(userType: string, requiredPermissions: string[]): boolean {
        const userPermissions = this.getUserPermissions(userType);
        return requiredPermissions.every(permission => userPermissions.includes(permission));
    }

    // Get user permissions based on user type
    private static getUserPermissions(userType: string): string[] {
        switch (userType) {
            case appConstants.userTypes.ADMIN:
                return [
                    'read:profile', 'write:profile',
                    'read:users', 'write:users', 'delete:users',
                    'read:jobs', 'write:jobs', 'delete:jobs',
                    'read:applications', 'write:applications', 'delete:applications',
                    'read:organizations', 'write:organizations', 'delete:organizations',
                    'admin:system'
                ];
            case appConstants.userTypes.EMPLOYER:
                return [
                    'read:profile', 'write:profile',
                    'read:jobs', 'write:jobs',
                    'read:applications', 'write:applications',
                    'read:organization', 'write:organization'
                ];
            case appConstants.userTypes.JOB_SEEKER:
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
    static canAccessResource(userType: string, resourceType: string, action: string): boolean {
        const permission = `${action}:${resourceType}`;
        return this.validateUserPermissions(userType, [permission]);
    }

    // Rate limiting helper
    static createRateLimitKey(ip: string, endpoint: string): string {
        return `rate_limit:${ip}:${endpoint}`;
    }
}