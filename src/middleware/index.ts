import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/auth.service';
import { 
    ValidationError, 
    AuthenticationError, 
    AuthorizationError, 
    NotFoundError, 
    ConflictError,
    errorResponse 
} from '../utils/validation';

// ============================================================
// SECURITY FIX: Token blacklist for logout/revocation
// ============================================================
const tokenBlacklist = new Set<string>();

// Cleanup expired tokens from blacklist every hour to prevent memory leak
setInterval(() => {
    // We can't decode tokens without verifying, so just clear old entries periodically
    // Tokens naturally expire anyway, blacklist is just for early revocation
    if (tokenBlacklist.size > 10000) {
        tokenBlacklist.clear(); // Nuclear cleanup if too many entries
    }
}, 60 * 60 * 1000);

export const blacklistToken = (token: string) => {
    tokenBlacklist.add(token);
};

export const isTokenBlacklisted = (token: string): boolean => {
    return tokenBlacklist.has(token);
};

// Authentication middleware
export const authenticate = (req: HttpRequest) => {
    const authHeader = req.headers.get('authorization');
    const token = AuthService.extractTokenFromHeader(authHeader || '');
    
    if (!token) {
        throw new AuthenticationError('Access token required');
    }

    // SECURITY FIX: Check if token has been revoked (logout)
    if (isTokenBlacklisted(token)) {
        throw new AuthenticationError('Token has been revoked');
    }
    
    try {
        const payload = AuthService.verifyToken(token);
        
        if (payload.type !== 'access') {
            throw new AuthenticationError('Invalid token type');
        }
        
        return payload;
    } catch (error) {
        throw new AuthenticationError(error instanceof Error ? error.message : 'Invalid token');
    }
};

// Authorization middleware
export const authorize = (user: any, requiredPermissions: string[]) => {
    if (!AuthService.validateUserPermissions(user.userType, requiredPermissions)) {
        throw new AuthorizationError('Insufficient permissions');
    }
};

// FIXED: Enhanced error handling middleware with better error responses
export const handleError = (error: any, context: InvocationContext): HttpResponseInit => {
    // Log the error for debugging
    context.log('Error occurred:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        details: error.details
    });
    
    // CORS headers for error responses - uses dynamic origin validation
    const requestOrigin = error._requestOrigin || null;
    const errorCorsHeaders = {
        'Content-Type': 'application/json',
        ...getCorsHeaders(requestOrigin)
    };
    
    if (error instanceof ValidationError) {
        return {
            status: 400,
            jsonBody: errorResponse('Validation failed', error.message),
            headers: errorCorsHeaders
        };
    }
    
    if (error instanceof AuthenticationError) {
        return {
            status: 401,
            jsonBody: errorResponse('Authentication failed', error.message),
            headers: errorCorsHeaders
        };
    }
    
    if (error instanceof AuthorizationError) {
        return {
            status: 403,
            jsonBody: errorResponse('Authorization failed', error.message),
            headers: errorCorsHeaders
        };
    }
    
    if (error instanceof NotFoundError) {
        return {
            status: 404,
            jsonBody: errorResponse('Resource not found', error.message),
            headers: errorCorsHeaders
        };
    }
    
    if (error instanceof ConflictError) {
        return {
            status: 409,
            jsonBody: errorResponse('Conflict', error.message),
            headers: errorCorsHeaders
        };
    }
    
    // Handle database and other errors more gracefully
    if (error.message && error.message.includes('Invalid column name')) {
        return {
            status: 500,
            jsonBody: errorResponse('Database schema error', 'A database field is missing or incorrect'),
            headers: errorCorsHeaders
        };
    }
    
    if (error.message && error.message.includes('Conversion failed when converting from a character string to uniqueidentifier')) {
        return {
            status: 400,
            jsonBody: errorResponse('Invalid ID format', 'The provided ID is not in the correct format'),
            headers: errorCorsHeaders
        };
    }
    
    if (error.message && error.message.includes('Cannot insert the value NULL into column')) {
        return {
            status: 400,
            jsonBody: errorResponse('Missing required field', 'A required field is missing'),
            headers: errorCorsHeaders
        };
    }
    
    // Generic server error
    return {
        status: 500,
        jsonBody: errorResponse(
            'Internal server error', 
            process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
        ),
        headers: errorCorsHeaders
    };
};

// CORS configuration - uses allowed origins from environment
const getAllowedOrigins = (): string[] => {
    const origins = process.env.CORS_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || '';
    return origins.split(',').map(o => o.trim()).filter(o => o.length > 0);
};

export const getCorsHeaders = (requestOrigin?: string | null): Record<string, string> => {
    const allowedOrigins = getAllowedOrigins();
    const origin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : '';
    
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-app-version, x-app-environment',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
};

// Legacy export for backward compatibility (uses first allowed origin as default)
export const corsHeaders = getCorsHeaders(getAllowedOrigins()[0]);

// FIXED: Enhanced error handling wrapper with better CORS support
export const withErrorHandling = (handler: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>) => {
    return async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const requestOrigin = req.headers.get('origin');
        const dynamicCorsHeaders = getCorsHeaders(requestOrigin);
        
        try {
            // Handle preflight CORS requests
            if (req.method === 'OPTIONS') {
                return {
                    status: 204,
                    headers: dynamicCorsHeaders
                };
            }
            
            const result = await handler(req, context);
            
            // Add CORS headers to successful responses
            return {
                ...result,
                headers: {
                    ...dynamicCorsHeaders,
                    ...result.headers
                }
            };
        } catch (error: any) {
            error._requestOrigin = requestOrigin;
            return handleError(error, context);
        }
    };
};

// FIXED: Enhanced auth wrapper with better error handling
export const withAuth = (
    handler: (req: HttpRequest, context: InvocationContext, user: any) => Promise<HttpResponseInit>,
    requiredPermissions: string[] = []
) => {
    return withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        try {
            // Skip auth for OPTIONS requests (CORS handled by withErrorHandling)
            if (req.method === 'OPTIONS') {
                return {
                    status: 204,
                    headers: getCorsHeaders(req.headers.get('origin'))
                };
            }
            
            const user = authenticate(req);
            
            if (requiredPermissions.length > 0) {
                authorize(user, requiredPermissions);
            }
            
            return await handler(req, context, user);
        } catch (error) {
            throw error; // Let withErrorHandling handle it
        }
    });
};

// ============================================================
// SECURITY FIX: Rate limiting middleware (in-memory sliding window)
// ============================================================
interface RateLimitEntry {
    count: number;
    windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now - entry.windowStart > 15 * 60 * 1000) { // 15 min max window
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export const rateLimit = (requestsPerWindow: number = 60, windowMs: number = 60000) => {
    return async (req: HttpRequest, context: InvocationContext, next: () => Promise<HttpResponseInit>): Promise<HttpResponseInit> => {
        // Use IP + endpoint as the rate limit key
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || 'unknown';
        const endpoint = new URL(req.url).pathname;
        const key = `${clientIp}:${endpoint}`;

        const now = Date.now();
        const entry = rateLimitStore.get(key);

        if (!entry || (now - entry.windowStart) > windowMs) {
            // New window
            rateLimitStore.set(key, { count: 1, windowStart: now });
        } else {
            entry.count++;
            if (entry.count > requestsPerWindow) {
                const retryAfterSec = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
                context.log(`Rate limit exceeded for ${clientIp} on ${endpoint}: ${entry.count}/${requestsPerWindow}`);
                return {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': String(retryAfterSec),
                        ...getCorsHeaders(req.headers.get('origin'))
                    },
                    jsonBody: {
                        success: false,
                        error: 'Too many requests. Please try again later.',
                        retryAfterSeconds: retryAfterSec
                    }
                };
            }
        }

        return next();
    };
};

// Pre-configured rate limiters for specific endpoints
export const loginRateLimit = rateLimit(5, 15 * 60 * 1000);      // 5 attempts per 15 min
export const registerRateLimit = rateLimit(10, 60 * 60 * 1000);  // 10 per hour (raised from 3 for shared office IPs)
export const passwordResetRateLimit = rateLimit(3, 60 * 60 * 1000); // 3 per hour
export const otpRateLimit = rateLimit(5, 10 * 60 * 1000);        // 5 per 10 min
export const apiRateLimit = rateLimit(100, 60 * 1000);           // 100 per minute

// ============================================================
// SECURITY FIX: withRateLimit wrapper for Azure Functions app.http() model
// Wraps a handler with rate limiting check before execution
// ============================================================
export const withRateLimit = (
    rateLimiter: ReturnType<typeof rateLimit>,
    handler: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>
) => {
    return withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        // Run rate limiter — if it returns a 429, short-circuit
        const rateLimitResult = await rateLimiter(req, context, async () => {
            // Rate limit passed — run the actual handler
            return handler(req, context);
        });
        return rateLimitResult;
    });
};

// ============================================================
// SECURITY FIX: Request logging middleware — filters sensitive headers
// ============================================================
const SENSITIVE_HEADERS = new Set([
    'authorization', 'cookie', 'set-cookie',
    'x-functions-key', 'x-api-key', 'x-auth-token'
]);

export const logRequest = (req: HttpRequest, context: InvocationContext) => {
    const startTime = Date.now();

    // Strip sensitive headers before logging
    const safeHeaders: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
        if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
            safeHeaders[key] = '[REDACTED]';
        } else {
            safeHeaders[key] = value;
        }
    }
    
    context.log('Request received:', {
        method: req.method,
        url: req.url,
        headers: safeHeaders,
        timestamp: new Date().toISOString()
    });
    
    return () => {
        const duration = Date.now() - startTime;
        context.log('Request completed:', {
            method: req.method,
            url: req.url,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        });
    };
};