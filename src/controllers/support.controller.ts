/**
 * Support Ticket Controllers
 * Handles customer support tickets and grievances
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SupportService } from '../services/support.service';
import { 
    withErrorHandling, 
    authenticate,
    authenticateAdmin
} from '../middleware';
import { 
    successResponse, 
    extractRequestBody,
    ValidationError,
    NotFoundError,
    ForbiddenError
} from '../utils/validation';

// Valid categories for support tickets
const VALID_CATEGORIES = ['Technical', 'Payment', 'Account', 'Referrals', 'Jobs', 'Employer', 'Other', 'General'];
const VALID_STATUSES = ['Open', 'InProgress', 'Resolved', 'Closed'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

/**
 * Create a new support ticket
 * POST /support/tickets
 */
export const createTicket = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const body = await extractRequestBody(req);
        
        const { category, subject, message, contactEmail } = body;
        
        // Validate required fields
        if (!subject || typeof subject !== 'string' || subject.trim().length < 5) {
            throw new ValidationError('Subject is required and must be at least 5 characters');
        }
        
        if (!message || typeof message !== 'string' || message.trim().length < 10) {
            throw new ValidationError('Message is required and must be at least 10 characters');
        }
        
        if (subject.length > 200) {
            throw new ValidationError('Subject must not exceed 200 characters');
        }
        
        // Validate category if provided
        const ticketCategory = category && VALID_CATEGORIES.includes(category) ? category : 'General';
        
        // Create ticket
        const ticket = await SupportService.createTicket({
            userId: user.userId,
            category: ticketCategory,
            subject: subject.trim(),
            message: message.trim(),
            contactEmail: contactEmail || user.email
        });
        
        return {
            status: 201,
            jsonBody: successResponse(ticket, 'Support ticket created successfully. We will respond within 24-48 hours.')
        };
    } catch (error: any) {
        context.error('Create ticket error:', error);
        const status = error instanceof ValidationError ? 400 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to create support ticket',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get user's support tickets
 * GET /support/tickets
 */
export const getMyTickets = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Get pagination params
        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
        const status = url.searchParams.get('status') || null;
        
        const result = await SupportService.getUserTickets(user.userId, { page, limit, status });
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'Tickets retrieved successfully')
        };
    } catch (error: any) {
        context.error('Get tickets error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get tickets',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get a specific ticket by ID
 * GET /support/tickets/:ticketId
 */
export const getTicketById = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const ticketId = req.params.ticketId;
        
        if (!ticketId) {
            throw new ValidationError('Ticket ID is required');
        }
        
        const ticket = await SupportService.getTicketById(ticketId, user.userId, user.isAdmin);
        
        if (!ticket) {
            throw new NotFoundError('Ticket not found');
        }
        
        return {
            status: 200,
            jsonBody: successResponse(ticket, 'Ticket retrieved successfully')
        };
    } catch (error: any) {
        context.error('Get ticket error:', error);
        const status = error instanceof NotFoundError ? 404 : 
                      error instanceof ForbiddenError ? 403 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get ticket',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Update ticket (Admin only - respond to ticket)
 * PATCH /support/tickets/:ticketId
 */
export const updateTicket = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticateAdmin(req);
        const ticketId = req.params.ticketId;
        const body = await extractRequestBody(req);
        
        if (!ticketId) {
            throw new ValidationError('Ticket ID is required');
        }
        
        const { status, priority, adminResponse } = body;
        
        // Validate status if provided
        if (status && !VALID_STATUSES.includes(status)) {
            throw new ValidationError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
        }
        
        // Validate priority if provided
        if (priority && !VALID_PRIORITIES.includes(priority)) {
            throw new ValidationError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
        }
        
        const updatedTicket = await SupportService.updateTicket(ticketId, {
            status,
            priority,
            adminResponse,
            adminUserId: user.userId
        });
        
        return {
            status: 200,
            jsonBody: successResponse(updatedTicket, 'Ticket updated successfully')
        };
    } catch (error: any) {
        context.error('Update ticket error:', error);
        const status = error instanceof NotFoundError ? 404 : 
                      error instanceof ForbiddenError ? 403 : 
                      error instanceof ValidationError ? 400 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to update ticket',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get all tickets (Admin only)
 * GET /support/admin/tickets
 */
export const getAllTickets = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticateAdmin(req);
        
        // Get filter params
        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
        const status = url.searchParams.get('status') || null;
        const category = url.searchParams.get('category') || null;
        const priority = url.searchParams.get('priority') || null;
        
        const result = await SupportService.getAllTickets({ page, limit, status, category, priority });
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'Tickets retrieved successfully')
        };
    } catch (error: any) {
        context.error('Get all tickets error:', error);
        const status = error instanceof ForbiddenError ? 403 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get tickets',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get ticket statistics (Admin only)
 * GET /support/admin/stats
 */
export const getTicketStats = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticateAdmin(req);
        
        const stats = await SupportService.getTicketStats();
        
        return {
            status: 200,
            jsonBody: successResponse(stats, 'Ticket statistics retrieved successfully')
        };
    } catch (error: any) {
        context.error('Get ticket stats error:', error);
        const status = error instanceof ForbiddenError ? 403 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get ticket statistics',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});
