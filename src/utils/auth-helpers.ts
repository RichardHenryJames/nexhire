import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/auth.service';
import { errorResponse } from '../utils/validation';

// Refresh token helper
export const refreshToken = async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const body = await req.text();
        const { refreshToken } = JSON.parse(body || '{}');
        
        if (!refreshToken) {
            return {
                status: 400,
                jsonBody: errorResponse('Missing refresh token', 'Refresh token is required')
            };
        }
        
        // Verify refresh token
        const payload = AuthService.verifyToken(refreshToken);
        
        if (payload.type !== 'refresh') {
            return {
                status: 400,
                jsonBody: errorResponse('Invalid token type', 'Refresh token required')
            };
        }

        // Get user and generate new tokens
        const UserService = await import('../services/user.service');
        const user = await UserService.UserService.findById(payload.userId);
        if (!user) {
            return {
                status: 404,
                jsonBody: errorResponse('User not found', 'Invalid refresh token')
            };
        }

        const tokens = AuthService.generateAuthTokens(user);
        
        return {
            status: 200,
            jsonBody: { success: true, data: tokens, message: 'Token refreshed successfully' }
        };
    } catch (error: any) {
        return {
            status: 401,
            jsonBody: errorResponse('Token refresh failed', error?.message || 'Unknown error')
        };
    }
};