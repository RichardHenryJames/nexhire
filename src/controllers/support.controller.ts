/**
 * Support Ticket Controllers
 * Handles customer support tickets and grievances
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SupportService } from '../services/support.service';
import { 
    withErrorHandling, 
    authenticate,
    withAuth
} from '../middleware';
import { 
    successResponse, 
    extractRequestBody,
    ValidationError,
    NotFoundError,
    AuthorizationError
} from '../utils/validation';

// Helper to verify admin access
const verifyAdmin = (user: any): HttpResponseInit | null => {
    if (user.userType?.toLowerCase() !== 'admin') {
        return {
            status: 403,
            jsonBody: { success: false, error: 'Access denied. Admin only.' }
        };
    }
    return null;
};

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
        
        const isAdmin = user.userType?.toLowerCase() === 'admin';
        const ticket = await SupportService.getTicketById(ticketId, user.userId, isAdmin);
        
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
                      error instanceof AuthorizationError ? 403 : 500;
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
export const updateTicket = withAuth(async (
    req: HttpRequest,
    context: InvocationContext,
    user
): Promise<HttpResponseInit> => {
    try {
        const adminCheck = verifyAdmin(user);
        if (adminCheck) return adminCheck;
        
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
                      error instanceof AuthorizationError ? 403 : 
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
export const getAllTickets = withAuth(async (
    req: HttpRequest,
    context: InvocationContext,
    user
): Promise<HttpResponseInit> => {
    try {
        const adminCheck = verifyAdmin(user);
        if (adminCheck) return adminCheck;
        
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
        const status = error instanceof AuthorizationError ? 403 : 500;
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
export const getTicketStats = withAuth(async (
    req: HttpRequest,
    context: InvocationContext,
    user
): Promise<HttpResponseInit> => {
    try {
        const adminCheck = verifyAdmin(user);
        if (adminCheck) return adminCheck;
        
        const stats = await SupportService.getTicketStats();
        
        return {
            status: 200,
            jsonBody: successResponse(stats, 'Ticket statistics retrieved successfully')
        };
    } catch (error: any) {
        context.error('Get ticket stats error:', error);
        const status = error instanceof AuthorizationError ? 403 : 500;
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

/**
 * Add message to ticket conversation
 * POST /support/tickets/:ticketId/messages
 */
export const addMessage = withAuth(async (
    req: HttpRequest,
    context: InvocationContext,
    user
): Promise<HttpResponseInit> => {
    try {
        const ticketId = req.params.ticketId;
        const body = await extractRequestBody(req);
        
        if (!ticketId) {
            throw new ValidationError('Ticket ID is required');
        }
        
        const { message } = body;
        
        if (!message || typeof message !== 'string' || message.trim().length < 1) {
            throw new ValidationError('Message is required');
        }
        
        if (message.length > 5000) {
            throw new ValidationError('Message must not exceed 5000 characters');
        }
        
        const isAdmin = user.userType?.toLowerCase() === 'admin';
        const senderType = isAdmin ? 'Admin' : 'User';
        
        const newMessage = await SupportService.addMessage(
            ticketId,
            user.userId,
            senderType,
            message.trim()
        );

        // 🔔 If admin replied, notify the ticket creator (async)
        if (isAdmin) {
            (async () => {
                try {
                    const { InAppNotificationService } = await import('../services/inAppNotification.service');
                    const { dbService } = await import('../services/database.service');
                    const ticketInfo = await dbService.executeQuery(
                        'SELECT UserID, Subject FROM SupportTickets WHERE TicketID = @param0', [ticketId]
                    );
                    const t = ticketInfo.recordset[0];
                    if (t) {
                        await InAppNotificationService.notifySupportReply(t.UserID, t.Subject, ticketId);
                    }
                } catch (e: any) { console.error('Notification error:', e.message); }
            })();
        }
        
        return {
            status: 201,
            jsonBody: successResponse(newMessage, 'Message sent successfully')
        };
    } catch (error: any) {
        context.error('Add message error:', error);
        const status = error instanceof NotFoundError ? 404 : 
                      error instanceof AuthorizationError ? 403 : 
                      error instanceof ValidationError ? 400 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to send message',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get messages for a ticket
 * GET /support/tickets/:ticketId/messages
 */
export const getMessages = withAuth(async (
    req: HttpRequest,
    context: InvocationContext,
    user
): Promise<HttpResponseInit> => {
    try {
        const ticketId = req.params.ticketId;
        
        if (!ticketId) {
            throw new ValidationError('Ticket ID is required');
        }
        
        const isAdmin = user.userType?.toLowerCase() === 'admin';
        const messages = await SupportService.getMessages(ticketId, user.userId, isAdmin);
        
        return {
            status: 200,
            jsonBody: successResponse(messages, 'Messages retrieved successfully')
        };
    } catch (error: any) {
        context.error('Get messages error:', error);
        const status = error instanceof NotFoundError ? 404 : 
                      error instanceof AuthorizationError ? 403 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get messages',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Close ticket (User or Admin)
 * POST /support/tickets/:ticketId/close
 */
export const closeTicket = withAuth(async (
    req: HttpRequest,
    context: InvocationContext,
    user
): Promise<HttpResponseInit> => {
    try {
        const ticketId = req.params.ticketId;
        
        if (!ticketId) {
            throw new ValidationError('Ticket ID is required');
        }
        
        const isAdmin = user.userType?.toLowerCase() === 'admin';
        const ticket = await SupportService.closeTicket(ticketId, user.userId, isAdmin);
        
        return {
            status: 200,
            jsonBody: successResponse(ticket, 'Ticket closed successfully')
        };
    } catch (error: any) {
        context.error('Close ticket error:', error);
        const status = error instanceof NotFoundError ? 404 : 
                      error instanceof AuthorizationError ? 403 : 
                      error instanceof ValidationError ? 400 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to close ticket',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});
