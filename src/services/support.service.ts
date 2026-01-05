/**
 * Support Service
 * Handles support ticket operations
 */

import { dbService } from './database.service';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/validation';

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
        
        const query = `
            INSERT INTO SupportTickets (UserID, Category, Subject, Message, ContactEmail, Status, Priority)
            OUTPUT 
                INSERTED.TicketID,
                INSERTED.UserID,
                INSERTED.Category,
                INSERTED.Subject,
                INSERTED.Message,
                INSERTED.Status,
                INSERTED.Priority,
                INSERTED.AdminResponse,
                INSERTED.AdminUserID,
                INSERTED.ContactEmail,
                INSERTED.CreatedAt,
                INSERTED.UpdatedAt,
                INSERTED.ResolvedAt
            VALUES (@param0, @param1, @param2, @param3, @param4, 'Open', 'Medium')
        `;
        
        const result = await dbService.executeQuery(query, [
            userId,
            category,
            subject,
            message,
            contactEmail || null
        ]);
        
        return result.recordset[0];
    }
    
    /**
     * Get tickets for a specific user
     */
    static async getUserTickets(userId: string, filters: TicketFilters): Promise<{ tickets: SupportTicket[], total: number, page: number, limit: number }> {
        const offset = (filters.page - 1) * filters.limit;
        
        // Get total count
        let countQuery = `
            SELECT COUNT(*) AS Total 
            FROM SupportTickets st 
            WHERE st.UserID = @param0 AND st.IsDeleted = 0
        `;
        const countParams: any[] = [userId];
        
        if (filters.status) {
            countQuery += ' AND st.Status = @param1';
            countParams.push(filters.status);
        }
        
        const countResult = await dbService.executeQuery(countQuery, countParams);
        
        // Get tickets
        let ticketsQuery = `
            SELECT 
                st.TicketID,
                st.UserID,
                st.Category,
                st.Subject,
                st.Message,
                st.Status,
                st.Priority,
                st.AdminResponse,
                st.AdminUserID,
                st.ContactEmail,
                st.CreatedAt,
                st.UpdatedAt,
                st.ResolvedAt,
                adminUser.FirstName + ' ' + adminUser.LastName AS AdminName
            FROM SupportTickets st
            LEFT JOIN Users adminUser ON st.AdminUserID = adminUser.UserID
            WHERE st.UserID = @param0 AND st.IsDeleted = 0
        `;
        const ticketParams: any[] = [userId];
        
        if (filters.status) {
            ticketsQuery += ' AND st.Status = @param1';
            ticketParams.push(filters.status);
        }
        
        ticketsQuery += ` ORDER BY st.CreatedAt DESC OFFSET @param${ticketParams.length} ROWS FETCH NEXT @param${ticketParams.length + 1} ROWS ONLY`;
        ticketParams.push(offset, filters.limit);
        
        const result = await dbService.executeQuery(ticketsQuery, ticketParams);
        
        return {
            tickets: result.recordset,
            total: countResult.recordset[0].Total,
            page: filters.page,
            limit: filters.limit
        };
    }
    
    /**
     * Get a specific ticket by ID
     */
    static async getTicketById(ticketId: string, userId: string, isAdmin: boolean): Promise<SupportTicket | null> {
        const query = `
            SELECT 
                st.TicketID,
                st.UserID,
                st.Category,
                st.Subject,
                st.Message,
                st.Status,
                st.Priority,
                st.AdminResponse,
                st.AdminUserID,
                st.ContactEmail,
                st.CreatedAt,
                st.UpdatedAt,
                st.ResolvedAt,
                u.FirstName + ' ' + u.LastName AS UserName,
                u.Email AS UserEmail,
                adminUser.FirstName + ' ' + adminUser.LastName AS AdminName
            FROM SupportTickets st
            JOIN Users u ON st.UserID = u.UserID
            LEFT JOIN Users adminUser ON st.AdminUserID = adminUser.UserID
            WHERE st.TicketID = @param0 AND st.IsDeleted = 0
        `;
        
        const result = await dbService.executeQuery(query, [ticketId]);
        
        const ticket = result.recordset[0];
        
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
        
        // Add ticketId as the last parameter
        params.push(ticketId);
        
        const query = `
            UPDATE SupportTickets
            SET ${updates.join(', ')}
            OUTPUT 
                INSERTED.TicketID,
                INSERTED.UserID,
                INSERTED.Category,
                INSERTED.Subject,
                INSERTED.Message,
                INSERTED.Status,
                INSERTED.Priority,
                INSERTED.AdminResponse,
                INSERTED.AdminUserID,
                INSERTED.ContactEmail,
                INSERTED.CreatedAt,
                INSERTED.UpdatedAt,
                INSERTED.ResolvedAt
            WHERE TicketID = @param${paramIndex} AND IsDeleted = 0
        `;
        
        const result = await dbService.executeQuery(query, params);
        
        if (result.recordset.length === 0) {
            throw new NotFoundError('Ticket not found');
        }
        
        return result.recordset[0];
    }
    
    /**
     * Get all tickets (Admin only)
     */
    static async getAllTickets(filters: TicketFilters): Promise<{ tickets: SupportTicket[], total: number, page: number, limit: number }> {
        const offset = (filters.page - 1) * filters.limit;
        
        // Build count query with dynamic conditions
        let countQuery = `
            SELECT COUNT(*) AS Total 
            FROM SupportTickets st 
            WHERE st.IsDeleted = 0
        `;
        const countParams: any[] = [];
        let countParamIndex = 0;
        
        if (filters.status) {
            countQuery += ` AND st.Status = @param${countParamIndex}`;
            countParams.push(filters.status);
            countParamIndex++;
        }
        if (filters.category) {
            countQuery += ` AND st.Category = @param${countParamIndex}`;
            countParams.push(filters.category);
            countParamIndex++;
        }
        if (filters.priority) {
            countQuery += ` AND st.Priority = @param${countParamIndex}`;
            countParams.push(filters.priority);
            countParamIndex++;
        }
        
        const countResult = await dbService.executeQuery(countQuery, countParams);
        
        // Build tickets query with dynamic conditions
        let ticketsQuery = `
            SELECT 
                st.TicketID,
                st.UserID,
                st.Category,
                st.Subject,
                st.Message,
                st.Status,
                st.Priority,
                st.AdminResponse,
                st.AdminUserID,
                st.ContactEmail,
                st.CreatedAt,
                st.UpdatedAt,
                st.ResolvedAt,
                u.FirstName + ' ' + u.LastName AS UserName,
                u.Email AS UserEmail,
                adminUser.FirstName + ' ' + adminUser.LastName AS AdminName
            FROM SupportTickets st
            JOIN Users u ON st.UserID = u.UserID
            LEFT JOIN Users adminUser ON st.AdminUserID = adminUser.UserID
            WHERE st.IsDeleted = 0
        `;
        const ticketParams: any[] = [];
        let ticketParamIndex = 0;
        
        if (filters.status) {
            ticketsQuery += ` AND st.Status = @param${ticketParamIndex}`;
            ticketParams.push(filters.status);
            ticketParamIndex++;
        }
        if (filters.category) {
            ticketsQuery += ` AND st.Category = @param${ticketParamIndex}`;
            ticketParams.push(filters.category);
            ticketParamIndex++;
        }
        if (filters.priority) {
            ticketsQuery += ` AND st.Priority = @param${ticketParamIndex}`;
            ticketParams.push(filters.priority);
            ticketParamIndex++;
        }
        
        ticketsQuery += `
            ORDER BY 
                CASE st.Priority 
                    WHEN 'Urgent' THEN 1 
                    WHEN 'High' THEN 2 
                    WHEN 'Medium' THEN 3 
                    WHEN 'Low' THEN 4 
                END,
                CASE st.Status 
                    WHEN 'Open' THEN 1 
                    WHEN 'InProgress' THEN 2 
                    WHEN 'Resolved' THEN 3 
                    WHEN 'Closed' THEN 4 
                END,
                st.CreatedAt DESC
            OFFSET @param${ticketParamIndex} ROWS FETCH NEXT @param${ticketParamIndex + 1} ROWS ONLY
        `;
        ticketParams.push(offset, filters.limit);
        
        const result = await dbService.executeQuery(ticketsQuery, ticketParams);
        
        return {
            tickets: result.recordset,
            total: countResult.recordset[0].Total,
            page: filters.page,
            limit: filters.limit
        };
    }
    
    /**
     * Get ticket statistics (Admin only)
     */
    static async getTicketStats(): Promise<any> {
        const statsQuery = `
            SELECT 
                COUNT(*) AS TotalTickets,
                SUM(CASE WHEN Status = 'Open' THEN 1 ELSE 0 END) AS OpenTickets,
                SUM(CASE WHEN Status = 'InProgress' THEN 1 ELSE 0 END) AS InProgressTickets,
                SUM(CASE WHEN Status = 'Resolved' THEN 1 ELSE 0 END) AS ResolvedTickets,
                SUM(CASE WHEN Status = 'Closed' THEN 1 ELSE 0 END) AS ClosedTickets,
                SUM(CASE WHEN Priority = 'Urgent' AND Status IN ('Open', 'InProgress') THEN 1 ELSE 0 END) AS UrgentPending,
                SUM(CASE WHEN Priority = 'High' AND Status IN ('Open', 'InProgress') THEN 1 ELSE 0 END) AS HighPriorityPending,
                SUM(CASE WHEN CreatedAt >= DATEADD(day, -1, GETUTCDATE()) THEN 1 ELSE 0 END) AS Last24Hours,
                SUM(CASE WHEN CreatedAt >= DATEADD(day, -7, GETUTCDATE()) THEN 1 ELSE 0 END) AS Last7Days
            FROM SupportTickets
            WHERE IsDeleted = 0
        `;
        
        const result = await dbService.executeQuery(statsQuery, []);
        
        // Get category breakdown
        const categoryQuery = `
            SELECT 
                Category,
                COUNT(*) AS Count
            FROM SupportTickets
            WHERE IsDeleted = 0 AND Status IN ('Open', 'InProgress')
            GROUP BY Category
            ORDER BY Count DESC
        `;
        
        const categoryResult = await dbService.executeQuery(categoryQuery, []);
        
        return {
            ...result.recordset[0],
            categoryBreakdown: categoryResult.recordset
        };
    }
}
