import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService, TokenPayload } from '../services/auth.service';
import { 
    AuthenticationError, 
    AuthorizationError, 
    ValidationError, 
    NotFoundError, 
    ConflictError,
    errorResponse 
} from '../utils/validation';

// Authentication middleware
export const authenticate = (req: HttpRequest): TokenPayload => {
    const authHeader = req.headers.get('authorization');
    const token = AuthService.extractTokenFromHeader(authHeader || '');
    
    if (!token) {
        throw new AuthenticationError('Access token required');
    }

    try {
        const payload = AuthService.verifyToken(token);
        
        if (payload.type !== 'access') {
            throw new AuthenticationError('Invalid token type');
        }

        return payload;
    } catch (error: any) {
        throw new AuthenticationError(error.message);
    }
};

// Authorization middleware
export const authorize = (user: TokenPayload, requiredPermissions: string[]): void => {
    if (!AuthService.validateUserPermissions(user.userType, requiredPermissions)) {
        throw new AuthorizationError('Insufficient permissions');
    }
};

// Error handling middleware
export const handleError = (error: Error, context: InvocationContext): HttpResponseInit => {
    context.log('Error occurred:', error);

    if (error instanceof ValidationError) {
        return {
            status: 400,
            jsonBody: errorResponse('Validation failed', error.message),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    if (error instanceof AuthenticationError) {
        return {
            status: 401,
            jsonBody: errorResponse('Authentication failed', error.message),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    if (error instanceof AuthorizationError) {
        return {
            status: 403,
            jsonBody: errorResponse('Authorization failed', error.message),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    if (error instanceof NotFoundError) {
        return {
            status: 404,
            jsonBody: errorResponse('Resource not found', error.message),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    if (error instanceof ConflictError) {
        return {
            status: 409,
            jsonBody: errorResponse('Conflict', error.message),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    // Database connection errors
    if (error.message.includes('database') || error.message.includes('connection')) {
        return {
            status: 503,
            jsonBody: errorResponse('Service temporarily unavailable', 'Database connection error'),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    // Generic server error
    return {
        status: 500,
        jsonBody: errorResponse('Internal server error', 'An unexpected error occurred'),
        headers: { 'Content-Type': 'application/json' }
    };
};

// CORS middleware
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400'
};

// Request wrapper with error handling
export const withErrorHandling = (
    handler: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>
) => {
    return async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        try {
            // Handle CORS preflight
            if (req.method === 'OPTIONS') {
                return {
                    status: 200,
                    headers: corsHeaders
                };
            }

            const response = await handler(req, context);
            
            // Add CORS headers to response
            return {
                ...response,
                headers: {
                    ...corsHeaders,
                    ...response.headers,
                    'Content-Type': 'application/json'
                }
            };
        } catch (error) {
            return handleError(error as Error, context);
        }
    };
};

// Authentication wrapper
export const withAuth = (
    handler: (req: HttpRequest, context: InvocationContext, user: TokenPayload) => Promise<HttpResponseInit>,
    requiredPermissions: string[] = []
) => {
    return withErrorHandling(async (req: HttpRequest, context: InvocationContext) => {
        const user = authenticate(req);
        
        if (requiredPermissions.length > 0) {
            authorize(user, requiredPermissions);
        }

        return await handler(req, context, user);
    });
};

// Rate limiting (simple in-memory implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
    return (req: HttpRequest, context: InvocationContext): void => {
        const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const key = `${clientIp}:${req.url}`;
        const now = Date.now();
        
        const existing = rateLimitStore.get(key);
        
        if (!existing || now > existing.resetTime) {
            rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
            return;
        }
        
        if (existing.count >= maxRequests) {
            throw new Error('Rate limit exceeded');
        }
        
        existing.count++;
        rateLimitStore.set(key, existing);
    };
};

// Request logging middleware - Fixed return type
export const logRequest = (req: HttpRequest, context: InvocationContext): (() => void) => {
    const startTime = Date.now();
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    context.log(`[${req.method}] ${req.url} - IP: ${clientIp} - Start: ${new Date(startTime).toISOString()}`);
    
    // Return completion logger function
    return () => {
        const duration = Date.now() - startTime;
        context.log(`[${req.method}] ${req.url} - Duration: ${duration}ms`);
    };
};