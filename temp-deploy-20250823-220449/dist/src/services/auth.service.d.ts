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
export declare class AuthService {
    static hashPassword(password: string): Promise<string>;
    static verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
    static generateToken(payload: Omit<TokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>, type?: string): string;
    static generateAuthTokens(user: User): AuthTokens;
    static verifyToken(token: string): TokenPayload;
    static generateEmailVerificationToken(userId: string, email: string): string;
    static generatePasswordResetToken(userId: string, email: string): string;
    static extractTokenFromHeader(authHeader: string): string | null;
    static generateUniqueId(): string;
    static validateUserPermissions(userType: string, requiredPermissions: string[]): boolean;
    private static getUserPermissions;
    static canAccessResource(userType: string, resourceType: string, action: string): boolean;
    static createRateLimitKey(ip: string, endpoint: string): string;
}
//# sourceMappingURL=auth.service.d.ts.map