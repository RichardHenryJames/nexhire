"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logRequest = exports.rateLimit = exports.withAuth = exports.withErrorHandling = exports.corsHeaders = exports.handleError = exports.authorize = exports.authenticate = void 0;
const auth_service_1 = require("../services/auth.service");
const validation_1 = require("../utils/validation");
// Authentication middleware
const authenticate = (req) => {
    const authHeader = req.headers.get('authorization');
    const token = auth_service_1.AuthService.extractTokenFromHeader(authHeader || '');
    if (!token) {
        throw new validation_1.AuthenticationError('Access token required');
    }
    try {
        const payload = auth_service_1.AuthService.verifyToken(token);
        if (payload.type !== 'access') {
            throw new validation_1.AuthenticationError('Invalid token type');
        }
        return payload;
    }
    catch (error) {
        throw new validation_1.AuthenticationError(error instanceof Error ? error.message : 'Invalid token');
    }
};
exports.authenticate = authenticate;
// Authorization middleware
const authorize = (user, requiredPermissions) => {
    if (!auth_service_1.AuthService.validateUserPermissions(user.userType, requiredPermissions)) {
        throw new validation_1.AuthorizationError('Insufficient permissions');
    }
};
exports.authorize = authorize;
// FIXED: Enhanced error handling middleware with better error responses
const handleError = (error, context) => {
    // Log the error for debugging
    context.log('Error occurred:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        details: error.details
    });
    // CORS headers for all error responses
    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    };
    if (error instanceof validation_1.ValidationError) {
        return {
            status: 400,
            jsonBody: (0, validation_1.errorResponse)('Validation failed', error.message),
            headers: corsHeaders
        };
    }
    if (error instanceof validation_1.AuthenticationError) {
        return {
            status: 401,
            jsonBody: (0, validation_1.errorResponse)('Authentication failed', error.message),
            headers: corsHeaders
        };
    }
    if (error instanceof validation_1.AuthorizationError) {
        return {
            status: 403,
            jsonBody: (0, validation_1.errorResponse)('Authorization failed', error.message),
            headers: corsHeaders
        };
    }
    if (error instanceof validation_1.NotFoundError) {
        return {
            status: 404,
            jsonBody: (0, validation_1.errorResponse)('Resource not found', error.message),
            headers: corsHeaders
        };
    }
    if (error instanceof validation_1.ConflictError) {
        return {
            status: 409,
            jsonBody: (0, validation_1.errorResponse)('Conflict', error.message),
            headers: corsHeaders
        };
    }
    // FIXED: Handle database and other errors more gracefully
    if (error.message && error.message.includes('Invalid column name')) {
        return {
            status: 500,
            jsonBody: (0, validation_1.errorResponse)('Database schema error', 'A database field is missing or incorrect'),
            headers: corsHeaders
        };
    }
    if (error.message && error.message.includes('Conversion failed when converting from a character string to uniqueidentifier')) {
        return {
            status: 400,
            jsonBody: (0, validation_1.errorResponse)('Invalid ID format', 'The provided ID is not in the correct format'),
            headers: corsHeaders
        };
    }
    if (error.message && error.message.includes('Cannot insert the value NULL into column')) {
        return {
            status: 400,
            jsonBody: (0, validation_1.errorResponse)('Missing required field', 'A required field is missing'),
            headers: corsHeaders
        };
    }
    // Generic server error
    return {
        status: 500,
        jsonBody: (0, validation_1.errorResponse)('Internal server error', process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'),
        headers: corsHeaders
    };
};
exports.handleError = handleError;
// CORS headers helper
exports.corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400'
};
// FIXED: Enhanced error handling wrapper with better CORS support
const withErrorHandling = (handler) => {
    return async (req, context) => {
        try {
            // Handle preflight CORS requests
            if (req.method === 'OPTIONS') {
                return {
                    status: 200,
                    headers: exports.corsHeaders
                };
            }
            const result = await handler(req, context);
            // Add CORS headers to successful responses
            return {
                ...result,
                headers: {
                    ...exports.corsHeaders,
                    ...result.headers
                }
            };
        }
        catch (error) {
            return (0, exports.handleError)(error, context);
        }
    };
};
exports.withErrorHandling = withErrorHandling;
// FIXED: Enhanced auth wrapper with better error handling
const withAuth = (handler, requiredPermissions = []) => {
    return (0, exports.withErrorHandling)(async (req, context) => {
        try {
            // Skip auth for OPTIONS requests
            if (req.method === 'OPTIONS') {
                return {
                    status: 200,
                    headers: exports.corsHeaders
                };
            }
            const user = (0, exports.authenticate)(req);
            if (requiredPermissions.length > 0) {
                (0, exports.authorize)(user, requiredPermissions);
            }
            return await handler(req, context, user);
        }
        catch (error) {
            throw error; // Let withErrorHandling handle it
        }
    });
};
exports.withAuth = withAuth;
// Rate limiting middleware (placeholder for future implementation)
const rateLimit = (requestsPerMinute = 60) => {
    return (req, context, next) => {
        // TODO: Implement rate limiting logic
        return next();
    };
};
exports.rateLimit = rateLimit;
// Request logging middleware
const logRequest = (req, context) => {
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
exports.logRequest = logRequest;
//# sourceMappingURL=index.js.map