/**
 * Support Repository — Single source of truth for SupportTickets & SupportMessages table queries.
 *
 * WHY THIS EXISTS:
 *  - Separates data-access (SQL) from business logic, auth checks, and email
 *    notifications in support.service.ts
 *  - 18 SQL queries consolidated into reusable methods
 *
 * RULES:
 *  1. Only this repository should write raw SupportTickets / SupportMessages SQL.
 *  2. Services call repository methods — never dbService directly for these tables.
 */

import { dbService } from '../services/database.service';

// ── Column sets ─────────────────────────────────────────────────

const TICKET_OUTPUT_COLUMNS = `
    INSERTED.TicketID, INSERTED.UserID, INSERTED.Category,
    INSERTED.Subject, INSERTED.Message, INSERTED.Status,
    INSERTED.Priority, INSERTED.AdminResponse, INSERTED.AdminUserID,
    INSERTED.ContactEmail, INSERTED.CreatedAt, INSERTED.UpdatedAt,
    INSERTED.ResolvedAt
`.replace(/\n/g, ' ');

const TICKET_SELECT_WITH_USERS = `
    st.TicketID, st.UserID, st.Category, st.Subject, st.Message,
    st.Status, st.Priority, st.AdminResponse, st.AdminUserID,
    st.ContactEmail, st.CreatedAt, st.UpdatedAt, st.ResolvedAt,
    u.FirstName + ' ' + u.LastName AS UserName,
    u.Email AS UserEmail,
    adminUser.FirstName + ' ' + adminUser.LastName AS AdminName
`.replace(/\n/g, ' ');

const TICKET_SELECT_ADMIN_ONLY = `
    st.TicketID, st.UserID, st.Category, st.Subject, st.Message,
    st.Status, st.Priority, st.AdminResponse, st.AdminUserID,
    st.ContactEmail, st.CreatedAt, st.UpdatedAt, st.ResolvedAt,
    adminUser.FirstName + ' ' + adminUser.LastName AS AdminName
`.replace(/\n/g, ' ');

// ── Types ───────────────────────────────────────────────────────

export interface TicketFilterParams {
    status?: string | null;
    category?: string | null;
    priority?: string | null;
}

// ── Repository ──────────────────────────────────────────────────

export class SupportRepository {

    // ── Ticket CRUD ─────────────────────────────────────────────

    /**
     * Insert a new support ticket. Returns the full inserted row.
     */
    static async insertTicket(
        userId: string,
        category: string,
        subject: string,
        message: string,
        contactEmail: string | null
    ): Promise<any> {
        const result = await dbService.executeQuery(`
            INSERT INTO SupportTickets (UserID, Category, Subject, Message, ContactEmail, Status, Priority)
            OUTPUT ${TICKET_OUTPUT_COLUMNS}
            VALUES (@param0, @param1, @param2, @param3, @param4, 'Open', 'Medium')
        `, [userId, category, subject, message, contactEmail]);
        return result.recordset[0];
    }

    /**
     * Find a ticket by ID (with user + admin name joins).
     * Returns null if not found or soft-deleted.
     */
    static async findTicketById(ticketId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT ${TICKET_SELECT_WITH_USERS}
            FROM SupportTickets st
            JOIN Users u ON st.UserID = u.UserID
            LEFT JOIN Users adminUser ON st.AdminUserID = adminUser.UserID
            WHERE st.TicketID = @param0 AND st.IsDeleted = 0
        `, [ticketId]);
        return result.recordset[0] ?? null;
    }

    /**
     * Find a ticket's basic fields (TicketID, UserID, Status) — for access/status checks.
     */
    static async findTicketBasic(ticketId: string): Promise<{ TicketID: string; UserID: string; Status: string } | null> {
        const result = await dbService.executeQuery(
            `SELECT TicketID, UserID, Status FROM SupportTickets WHERE TicketID = @param0 AND IsDeleted = 0`,
            [ticketId]
        );
        return result.recordset[0] ?? null;
    }

    /**
     * Dynamic UPDATE on a ticket. Returns the full updated row via OUTPUT.
     */
    static async updateTicket(
        ticketId: string,
        updates: string[],
        params: any[]
    ): Promise<any | null> {
        const paramIndex = params.length;
        params.push(ticketId);

        const query = `
            UPDATE SupportTickets
            SET ${updates.join(', ')}
            OUTPUT ${TICKET_OUTPUT_COLUMNS}
            WHERE TicketID = @param${paramIndex} AND IsDeleted = 0
        `;
        const result = await dbService.executeQuery(query, params);
        return result.recordset[0] ?? null;
    }

    /**
     * Close a ticket (set Status = 'Closed', ResolvedAt). Returns updated row.
     */
    static async closeTicket(ticketId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            UPDATE SupportTickets
            SET Status = 'Closed', UpdatedAt = GETUTCDATE(), ResolvedAt = GETUTCDATE()
            OUTPUT ${TICKET_OUTPUT_COLUMNS}
            WHERE TicketID = @param0
        `, [ticketId]);
        return result.recordset[0];
    }

    // ── Ticket lists ────────────────────────────────────────────

    /**
     * Count user-scoped tickets with optional status filter.
     */
    static async countUserTickets(userId: string, status?: string | null): Promise<number> {
        let query = `SELECT COUNT(*) AS Total FROM SupportTickets st WHERE st.UserID = @param0 AND st.IsDeleted = 0`;
        const params: any[] = [userId];
        if (status) {
            query += ' AND st.Status = @param1';
            params.push(status);
        }
        const result = await dbService.executeQuery(query, params);
        return result.recordset[0]?.Total ?? 0;
    }

    /**
     * Fetch user-scoped tickets (paginated, optional status filter).
     */
    static async findUserTickets(
        userId: string,
        offset: number,
        limit: number,
        status?: string | null
    ): Promise<any[]> {
        let query = `
            SELECT ${TICKET_SELECT_ADMIN_ONLY}
            FROM SupportTickets st
            LEFT JOIN Users adminUser ON st.AdminUserID = adminUser.UserID
            WHERE st.UserID = @param0 AND st.IsDeleted = 0
        `;
        const params: any[] = [userId];
        if (status) {
            query += ' AND st.Status = @param1';
            params.push(status);
        }
        query += ` ORDER BY st.CreatedAt DESC OFFSET @param${params.length} ROWS FETCH NEXT @param${params.length + 1} ROWS ONLY`;
        params.push(offset, limit);

        const result = await dbService.executeQuery(query, params);
        return result.recordset;
    }

    /**
     * Count all tickets (admin) with optional filters.
     */
    static async countAllTickets(filters: TicketFilterParams): Promise<number> {
        let query = `SELECT COUNT(*) AS Total FROM SupportTickets st WHERE st.IsDeleted = 0`;
        const params: any[] = [];
        let idx = 0;

        if (filters.status) {
            query += ` AND st.Status = @param${idx}`;
            params.push(filters.status);
            idx++;
        }
        if (filters.category) {
            query += ` AND st.Category = @param${idx}`;
            params.push(filters.category);
            idx++;
        }
        if (filters.priority) {
            query += ` AND st.Priority = @param${idx}`;
            params.push(filters.priority);
            idx++;
        }

        const result = await dbService.executeQuery(query, params);
        return result.recordset[0]?.Total ?? 0;
    }

    /**
     * Fetch all tickets (admin) with optional filters, sorted by priority/status.
     */
    static async findAllTickets(
        offset: number,
        limit: number,
        filters: TicketFilterParams
    ): Promise<any[]> {
        let query = `
            SELECT ${TICKET_SELECT_WITH_USERS}
            FROM SupportTickets st
            JOIN Users u ON st.UserID = u.UserID
            LEFT JOIN Users adminUser ON st.AdminUserID = adminUser.UserID
            WHERE st.IsDeleted = 0
        `;
        const params: any[] = [];
        let idx = 0;

        if (filters.status) {
            query += ` AND st.Status = @param${idx}`;
            params.push(filters.status);
            idx++;
        }
        if (filters.category) {
            query += ` AND st.Category = @param${idx}`;
            params.push(filters.category);
            idx++;
        }
        if (filters.priority) {
            query += ` AND st.Priority = @param${idx}`;
            params.push(filters.priority);
            idx++;
        }

        query += `
            ORDER BY 
                CASE st.Status WHEN 'Open' THEN 1 WHEN 'InProgress' THEN 2 WHEN 'Resolved' THEN 3 WHEN 'Closed' THEN 4 END,
                CASE st.Priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 END,
                st.CreatedAt DESC
            OFFSET @param${idx} ROWS FETCH NEXT @param${idx + 1} ROWS ONLY
        `;
        params.push(offset, limit);

        const result = await dbService.executeQuery(query, params);
        return result.recordset;
    }

    // ── Stats ───────────────────────────────────────────────────

    /**
     * Aggregate ticket statistics (admin dashboard).
     */
    static async getStats(): Promise<any> {
        const result = await dbService.executeQuery(`
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
        `, []);
        return result.recordset[0];
    }

    /**
     * Get category breakdown for open/in-progress tickets.
     */
    static async getCategoryBreakdown(): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT Category, COUNT(*) AS Count
            FROM SupportTickets
            WHERE IsDeleted = 0 AND Status IN ('Open', 'InProgress')
            GROUP BY Category
            ORDER BY Count DESC
        `, []);
        return result.recordset;
    }

    // ── Messages ────────────────────────────────────────────────

    /**
     * Insert a support message. Returns the inserted row.
     */
    static async insertMessage(
        ticketId: string,
        senderId: string,
        senderType: 'User' | 'Admin',
        message: string
    ): Promise<any> {
        const result = await dbService.executeQuery(`
            INSERT INTO SupportMessages (TicketID, SenderID, SenderType, Message)
            OUTPUT 
                INSERTED.MessageID, INSERTED.TicketID,
                INSERTED.SenderID, INSERTED.SenderType,
                INSERTED.Message, INSERTED.CreatedAt
            VALUES (@param0, @param1, @param2, @param3)
        `, [ticketId, senderId, senderType, message]);
        return result.recordset[0];
    }

    /**
     * Update ticket status/admin fields after a message is added.
     */
    static async updateTicketAfterMessage(
        ticketId: string,
        senderType: 'User' | 'Admin',
        senderId: string,
        message: string
    ): Promise<void> {
        let query = `UPDATE SupportTickets SET UpdatedAt = GETUTCDATE()`;
        const params: any[] = [];
        let idx = 0;

        if (senderType === 'Admin') {
            query += `, AdminResponse = @param${idx}, AdminUserID = @param${idx + 1}`;
            params.push(message, senderId);
            idx += 2;
            query += `, Status = CASE WHEN Status = 'Open' THEN 'InProgress' ELSE Status END`;
        } else {
            query += `, Status = CASE WHEN Status = 'Resolved' THEN 'Open' ELSE Status END`;
        }

        query += ` WHERE TicketID = @param${idx}`;
        params.push(ticketId);

        await dbService.executeQuery(query, params);
    }

    /**
     * Fetch all messages for a ticket (ordered ascending).
     */
    static async findMessagesByTicket(ticketId: string): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT 
                sm.MessageID, sm.TicketID, sm.SenderID, sm.SenderType,
                sm.Message, sm.CreatedAt,
                u.FirstName + ' ' + u.LastName AS SenderName
            FROM SupportMessages sm
            JOIN Users u ON sm.SenderID = u.UserID
            WHERE sm.TicketID = @param0 AND sm.IsDeleted = 0
            ORDER BY sm.CreatedAt ASC
        `, [ticketId]);
        return result.recordset;
    }

    // ── User helpers (used for email notifications) ─────────────

    /**
     * Get user name + email for a given UserID (lightweight).
     */
    static async getUserBasic(userId: string): Promise<{ FirstName: string; LastName: string; Email: string } | null> {
        const result = await dbService.executeQuery(
            `SELECT FirstName, LastName, Email FROM Users WHERE UserID = @param0`,
            [userId]
        );
        return result.recordset[0] ?? null;
    }

    /**
     * Get ticket + user details for admin-reply email.
     */
    static async getTicketWithUser(ticketId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT 
                st.TicketID, st.Subject, st.Status, st.ContactEmail,
                u.FirstName, u.LastName, u.Email
            FROM SupportTickets st
            JOIN Users u ON st.UserID = u.UserID
            WHERE st.TicketID = @param0 AND st.IsDeleted = 0
        `, [ticketId]);
        return result.recordset[0] ?? null;
    }
}
