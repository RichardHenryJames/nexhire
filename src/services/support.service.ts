/**
 * Support Service
 * Handles support ticket operations
 */

import { SupportRepository } from '../repositories/support.repository';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/validation';
import { EmailService } from './emailService';
import { TemplateService } from './templateService';
import { maskEmail } from '../utils/encryption';

// Admin notification emails - supports comma-separated list from env
const getAdminEmails = (): string[] => {
  const emails = process.env.ADMIN_NOTIFICATION_EMAILS || '';
  return emails.split(',').map(e => e.trim()).filter(e => e.length > 0);
};

export interface SupportTicket {
    TicketID: string;
    UserID: string;
    Category: string;
    Subject: string;
    Message: string;
    Status: string;
    Priority: string;
    AdminResponse: string | null;
    AdminUserID: string | null;
    ContactEmail: string | null;
    CreatedAt: Date;
    UpdatedAt: Date;
    ResolvedAt: Date | null;
    // Joined fields
    UserName?: string;
    UserEmail?: string;
    AdminName?: string;
}

export interface CreateTicketInput {
    userId: string;
    category: string;
    subject: string;
    message: string;
    contactEmail?: string;
}

export interface UpdateTicketInput {
    status?: string;
    priority?: string;
    adminResponse?: string;
    adminUserId: string;
}

export interface TicketFilters {
    page: number;
    limit: number;
    status?: string | null;
    category?: string | null;
    priority?: string | null;
}

export class SupportService {
    /**
     * Create a new support ticket
     */
    static async createTicket(input: CreateTicketInput): Promise<SupportTicket> {
        const { userId, category, subject, message, contactEmail } = input;
        
        const ticket = await SupportRepository.insertTicket(
            userId, category, subject, message, contactEmail || null
        );
        
        // Send email notification to admin
        this.sendNewTicketNotification(ticket, contactEmail).catch(err => {
            console.error('Failed to send new ticket notification email:', err);
        });
        
        return ticket;
    }
    
    /**
     * Send email notification for new support ticket
     */
    private static async sendNewTicketNotification(ticket: SupportTicket, contactEmail?: string): Promise<void> {
        try {
            // Get user details
            const user = await SupportRepository.getUserBasic(ticket.UserID);
            
            const userName = user ? `${user.FirstName} ${user.LastName}` : 'Unknown User';
            const userEmail = contactEmail || user?.Email || 'Not provided';
            
            // Use the template service for consistent email styling
            const { subject, html, text } = TemplateService.render('new_support_ticket', {
                ticketId: ticket.TicketID,
                subject: ticket.Subject,
                category: ticket.Category,
                priority: ticket.Priority,
                status: ticket.Status,
                userName: userName,
                userEmail: userEmail,
                userId: ticket.UserID,
                message: ticket.Message,
                createdAt: new Date(ticket.CreatedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Kolkata'
                })
            });
            
            const adminEmails = getAdminEmails();
            if (adminEmails.length === 0) {
                console.warn('⚠️ No admin emails configured, skipping ticket notification');
                return;
            }
            
            await EmailService.send({
                to: adminEmails,
                subject: subject,
                html: html,
                text: text,
                emailType: 'support_ticket_notification',
                referenceType: 'SupportTicket',
                referenceId: ticket.TicketID
            });
            
            console.log(`✅ New ticket notification sent to ${adminEmails.map(maskEmail).join(', ')} for ticket ${ticket.TicketID}`);
        } catch (error) {
            console.error('Error sending new ticket notification:', error);
        }
    }
    
    /**
     * Get tickets for a specific user
     */
    static async getUserTickets(userId: string, filters: TicketFilters): Promise<{ tickets: SupportTicket[], total: number, page: number, limit: number }> {
        const offset = (filters.page - 1) * filters.limit;
        
        const [total, tickets] = await Promise.all([
            SupportRepository.countUserTickets(userId, filters.status),
            SupportRepository.findUserTickets(userId, offset, filters.limit, filters.status)
        ]);
        
        return {
            tickets,
            total,
            page: filters.page,
            limit: filters.limit
        };
    }
    
    /**
     * Get a specific ticket by ID
     */
    static async getTicketById(ticketId: string, userId: string, isAdmin: boolean): Promise<SupportTicket | null> {
        const ticket = await SupportRepository.findTicketById(ticketId);
        
        if (!ticket) {
            return null;
        }
        
        // Non-admins can only view their own tickets
        if (!isAdmin && ticket.UserID !== userId) {
            throw new AuthorizationError('You do not have permission to view this ticket');
        }
        
        return ticket;
    }
    
    /**
     * Update a ticket (Admin only)
     */
    static async updateTicket(ticketId: string, input: UpdateTicketInput): Promise<SupportTicket> {
        // Build dynamic update query
        const updates: string[] = ['UpdatedAt = GETUTCDATE()'];
        const params: any[] = [];
        let paramIndex = 0;
        
        if (input.status) {
            updates.push(`Status = @param${paramIndex}`);
            params.push(input.status);
            paramIndex++;
            if (input.status === 'Resolved' || input.status === 'Closed') {
                updates.push('ResolvedAt = GETUTCDATE()');
            }
        }
        
        if (input.priority) {
            updates.push(`Priority = @param${paramIndex}`);
            params.push(input.priority);
            paramIndex++;
        }
        
        if (input.adminResponse) {
            updates.push(`AdminResponse = @param${paramIndex}`);
            params.push(input.adminResponse);
            paramIndex++;
            updates.push(`AdminUserID = @param${paramIndex}`);
            params.push(input.adminUserId);
            paramIndex++;
        }
        
        const ticket = await SupportRepository.updateTicket(ticketId, updates, params);
        
        if (!ticket) {
            throw new NotFoundError('Ticket not found');
        }
        
        return ticket;
    }
    
    /**
     * Get all tickets (Admin only)
     */
    static async getAllTickets(filters: TicketFilters): Promise<{ tickets: SupportTicket[], total: number, page: number, limit: number }> {
        const offset = (filters.page - 1) * filters.limit;
        const filterParams = { status: filters.status, category: filters.category, priority: filters.priority };
        
        const [total, tickets] = await Promise.all([
            SupportRepository.countAllTickets(filterParams),
            SupportRepository.findAllTickets(offset, filters.limit, filterParams)
        ]);
        
        return {
            tickets,
            total,
            page: filters.page,
            limit: filters.limit
        };
    }
    
    /**
     * Get ticket statistics (Admin only)
     */
    static async getTicketStats(): Promise<any> {
        const [stats, categoryBreakdown] = await Promise.all([
            SupportRepository.getStats(),
            SupportRepository.getCategoryBreakdown()
        ]);
        
        return {
            ...stats,
            categoryBreakdown
        };
    }

    /**
     * Add a message to a ticket conversation
     */
    static async addMessage(ticketId: string, senderId: string, senderType: 'User' | 'Admin', message: string): Promise<any> {
        // Verify ticket exists and user has access
        const ticket = await SupportRepository.findTicketBasic(ticketId);
        
        if (!ticket) {
            throw new NotFoundError('Ticket not found');
        }
        
        // Users can only message their own tickets
        if (senderType === 'User' && ticket.UserID !== senderId) {
            throw new AuthorizationError('You do not have permission to message this ticket');
        }
        
        // Can't message closed tickets
        if (ticket.Status === 'Closed') {
            throw new ValidationError('Cannot add messages to closed tickets');
        }
        
        // Insert the message
        const insertedMessage = await SupportRepository.insertMessage(ticketId, senderId, senderType, message);
        
        // Update ticket status and timestamps
        await SupportRepository.updateTicketAfterMessage(ticketId, senderType, senderId, message);
        
        // Send email notification to user when admin replies
        if (senderType === 'Admin') {
            this.sendAdminReplyNotification(ticketId, message).catch(err => {
                console.error('Failed to send admin reply notification email:', err);
            });
        }
        
        return insertedMessage;
    }

    /**
     * Send email notification to user when admin replies to their ticket
     */
    private static async sendAdminReplyNotification(ticketId: string, adminMessage: string): Promise<void> {
        try {
            // Get ticket and user details
            const ticket = await SupportRepository.getTicketWithUser(ticketId);
            
            if (!ticket) {
                console.warn('Ticket not found for notification:', ticketId);
                return;
            }
            
            const userName = `${ticket.FirstName} ${ticket.LastName}`;
            const userEmail = ticket.ContactEmail || ticket.Email;
            
            if (!userEmail) {
                console.warn('No email found for user, skipping notification for ticket:', ticketId);
                return;
            }
            
            // Use the template service for consistent email styling
            const { subject, html, text } = TemplateService.render('support_ticket_reply', {
                ticketId: ticket.TicketID,
                subject: ticket.Subject,
                status: ticket.Status,
                userName: userName,
                adminMessage: adminMessage
            });
            
            await EmailService.send({
                to: userEmail,
                subject: subject,
                html: html,
                text: text,
                emailType: 'support_ticket_reply',
                referenceType: 'SupportTicket',
                referenceId: ticketId
            });
            
            console.log(`✅ Admin reply notification sent to ${maskEmail(userEmail)} for ticket ${ticketId}`);
        } catch (error) {
            console.error('Error sending admin reply notification:', error);
        }
    }

    /**
     * Get messages for a ticket
     */
    static async getMessages(ticketId: string, userId: string, isAdmin: boolean): Promise<any[]> {
        // Verify access
        const ticket = await SupportRepository.findTicketBasic(ticketId);
        
        if (!ticket) {
            throw new NotFoundError('Ticket not found');
        }
        
        // Users can only view their own ticket messages
        if (!isAdmin && ticket.UserID !== userId) {
            throw new AuthorizationError('You do not have permission to view this ticket');
        }
        
        return SupportRepository.findMessagesByTicket(ticketId);
    }

    /**
     * Close a ticket (User can close their own, Admin can close any)
     */
    static async closeTicket(ticketId: string, userId: string, isAdmin: boolean): Promise<SupportTicket> {
        // Verify ticket exists
        const ticket = await SupportRepository.findTicketBasic(ticketId);
        
        if (!ticket) {
            throw new NotFoundError('Ticket not found');
        }
        
        // Users can only close their own tickets
        if (!isAdmin && ticket.UserID !== userId) {
            throw new AuthorizationError('You do not have permission to close this ticket');
        }
        
        if (ticket.Status === 'Closed') {
            throw new ValidationError('Ticket is already closed');
        }
        
        return SupportRepository.closeTicket(ticketId);
    }
}