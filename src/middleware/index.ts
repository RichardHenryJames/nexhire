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

// Authentication middleware
export const authenticate = (req: HttpRequest) => {
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
    
    // CORS headers for all error responses - UPDATED
    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-app-version, x-app-environment'
    };
    
    if (error instanceof ValidationError) {
        return {
            status: 400,
            jsonBody: errorResponse('Validation failed', error.message),
            headers: corsHeaders
        };
    }
    
    if (error instanceof AuthenticationError) {
        return {
            status: 401,
            jsonBody: errorResponse('Authentication failed', error.message),
            headers: corsHeaders
        };
    }
    
    if (error instanceof AuthorizationError) {
        return {
            status: 403,
            jsonBody: errorResponse('Authorization failed', error.message),
            headers: corsHeaders
        };
    }
    
    if (error instanceof NotFoundError) {
        return {
            status: 404,
            jsonBody: errorResponse('Resource not found', error.message),
            headers: corsHeaders
        };
    }
    
    if (error instanceof ConflictError) {
        return {
            status: 409,
            jsonBody: errorResponse('Conflict', error.message),
            headers: corsHeaders
        };
    }
    
    // FIXED: Handle database and other errors more gracefully
    if (error.message && error.message.includes('Invalid column name')) {
        return {
            status: 500,
            jsonBody: errorResponse('Database schema error', 'A database field is missing or incorrect'),
            headers: corsHeaders
        };
    }
    
    if (error.message && error.message.includes('Conversion failed when converting from a character string to uniqueidentifier')) {
        return {
            status: 400,
            jsonBody: errorResponse('Invalid ID format', 'The provided ID is not in the correct format'),
            headers: corsHeaders
        };
    }
    
    if (error.message && error.message.includes('Cannot insert the value NULL into column')) {
        return {
            status: 400,
            jsonBody: errorResponse('Missing required field', 'A required field is missing'),
            headers: corsHeaders
        };
    }
    
    // Generic server error
    return {
        status: 500,
        jsonBody: errorResponse(
            'Internal server error', 
            process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
        ),
        headers: corsHeaders
    };
};

// CORS headers helper - UPDATED to allow custom headers
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-app-version, x-app-environment',
    'Access-Control-Max-Age': '86400'
};

// FIXED: Enhanced error handling wrapper with better CORS support
export const withErrorHandling = (handler: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>) => {
    return async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        try {
            // Handle preflight CORS requests
            if (req.method === 'OPTIONS') {
                return {
                    status: 200,
                    headers: corsHeaders
                };
            }
            
            const result = await handler(req, context);
            
            // Add CORS headers to successful responses
            return {
                ...result,
                headers: {
                    ...corsHeaders,
                    ...result.headers
                }
            };
        } catch (error) {
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
            // Skip auth for OPTIONS requests
            if (req.method === 'OPTIONS') {
                return {
                    status: 200,
                    headers: corsHeaders
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

// Rate limiting middleware (placeholder for future implementation)
export const rateLimit = (requestsPerMinute: number = 60) => {
    return (req: HttpRequest, context: InvocationContext, next: () => Promise<HttpResponseInit>) => {
        // TODO: Implement rate limiting logic
        return next();
    };
};

// Request logging middleware
export const logRequest = (req: HttpRequest, context: InvocationContext) => {
    const startTime = Date.now();
    
    context.log('Request received:', {
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries()),
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