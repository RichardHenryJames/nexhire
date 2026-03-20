/**
 * Wallet Repository — Single source of truth for Wallets, WalletTransactions,
 * WalletRechargeOrders, WalletWithdrawals, and WalletHolds table queries.
 *
 * WHY THIS EXISTS:
 *  - wallet.service.ts was 1,772 lines mixing Razorpay integration, business
 *    logic, and 40+ raw SQL queries across 5 tables
 *  - This centralises every SQL statement, making the service testable and
 *    keeping query changes in one place
 *
 * RULES:
 *  1. Only this repository should write raw SQL for wallet-related tables.
 *  2. Services call repository methods — never dbService directly.
 */

import { dbService } from '../services/database.service';

// ── Column sets ─────────────────────────────────────────────────

const WALLET_SELECT = `
    w.WalletID, w.UserID, w.Balance, w.CurrencyID,
    c.Code as CurrencyCode, w.Status, w.CreatedAt,
    w.UpdatedAt, w.LastTransactionAt
`.replace(/\n/g, ' ');

// ── Repository ──────────────────────────────────────────────────

export class WalletRepository {

    // ═══════════════════════════════════════════════════════════
    //  WALLETS
    // ═══════════════════════════════════════════════════════════

    /**
     * Find a wallet by UserID (with currency code).
     */
    static async findByUserId(userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(
            `SELECT ${WALLET_SELECT} FROM Wallets w INNER JOIN Currencies c ON w.CurrencyID = c.CurrencyID WHERE w.UserID = @param0`,
            [userId]
        );
        return result.recordset?.[0] ?? null;
    }

    /**
     * Insert a new wallet row. May throw duplicate-key if a concurrent insert wins.
     */
    static async insert(walletId: string, userId: string): Promise<void> {
        await dbService.executeQuery(
            `INSERT INTO Wallets (WalletID, UserID, Balance, CurrencyID, Status) VALUES (@param0, @param1, 0.00, 4, 'Active')`,
            [walletId, userId]
        );
    }

    /**
     * Atomic credit — adds amount to balance.
     */
    static async atomicCredit(walletId: string, amount: number): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Wallets SET Balance = Balance + @param1, UpdatedAt = GETUTCDATE(), LastTransactionAt = GETUTCDATE() WHERE WalletID = @param0`,
            [walletId, amount]
        );
    }

    /**
     * Atomic debit — subtracts amount from balance.
     * Returns number of rows affected (0 means insufficient balance).
     */
    static async atomicDebit(walletId: string, amount: number): Promise<number> {
        const result = await dbService.executeQuery(
            `UPDATE Wallets SET Balance = Balance - @param1, UpdatedAt = GETUTCDATE(), LastTransactionAt = GETUTCDATE() WHERE WalletID = @param0 AND Balance >= @param1`,
            [walletId, amount]
        );
        return result.rowsAffected?.[0] ?? 0;
    }

    /**
     * Atomic debit by UserID (for withdrawal flow).
     * Returns number of rows affected.
     */
    static async atomicDebitByUser(userId: string, amount: number): Promise<number> {
        const result = await dbService.executeQuery(
            `UPDATE Wallets SET Balance = Balance - @param0, UpdatedAt = GETUTCDATE() WHERE UserID = @param1 AND Balance >= @param0`,
            [amount, userId]
        );
        return result.rowsAffected?.[0] ?? 0;
    }

    /**
     * Refund amount back to a wallet.
     */
    static async refund(walletId: string, amount: number): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Wallets SET Balance = Balance + @param1, UpdatedAt = GETUTCDATE() WHERE WalletID = @param0`,
            [walletId, amount]
        );
    }

    /**
     * Get current balance for a wallet.
     */
    static async getBalance(walletId: string): Promise<number> {
        const result = await dbService.executeQuery(
            `SELECT Balance FROM Wallets WHERE WalletID = @param0`,
            [walletId]
        );
        return result.recordset?.[0]?.Balance ?? 0;
    }

    /**
     * Get balance + currencyID for a wallet.
     */
    static async getBalanceAndCurrency(walletId: string): Promise<{ Balance: number; CurrencyID: number } | null> {
        const result = await dbService.executeQuery(
            `SELECT Balance, CurrencyID FROM Wallets WHERE WalletID = @param0`,
            [walletId]
        );
        return result.recordset?.[0] ?? null;
    }

    // ═══════════════════════════════════════════════════════════
    //  WALLET TRANSACTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * Insert a wallet transaction.
     */
    static async insertTransaction(params: {
        transactionId: string;
        walletId: string;
        type: 'Credit' | 'Debit';
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        currencyId: number;
        source: string;
        paymentReference?: string | null;
        description: string;
        status: string;
    }): Promise<void> {
        await dbService.executeQuery(
            `INSERT INTO WalletTransactions (
                TransactionID, WalletID, TransactionType, Amount,
                BalanceBefore, BalanceAfter, CurrencyID, Source,
                PaymentReference, Description, Status, CreatedAt
            ) VALUES (
                @param0, @param1, @param2, @param3,
                @param4, @param5, @param6, @param7,
                @param8, @param9, @param10, GETUTCDATE()
            )`,
            [
                params.transactionId, params.walletId, params.type, params.amount,
                params.balanceBefore, params.balanceAfter, params.currencyId, params.source,
                params.paymentReference ?? null, params.description, params.status
            ]
        );
    }

    /**
     * Get paginated transaction history for a wallet.
     * Uses COUNT(*) OVER() window function for total in one query.
     */
    static async findTransactions(
        walletId: string,
        offset: number,
        pageSize: number,
        transactionType?: 'Credit' | 'Debit'
    ): Promise<{ rows: any[]; total: number }> {
        let where = 'WHERE wt.WalletID = @param0';
        const params: any[] = [walletId];

        if (transactionType) {
            where += ' AND wt.TransactionType = @param1';
            params.push(transactionType);
        }

        const result = await dbService.executeQuery(`
            SELECT 
                wt.TransactionID, wt.TransactionType, wt.Amount,
                wt.BalanceBefore, wt.BalanceAfter,
                c.Code as CurrencyCode, c.Symbol as CurrencySymbol,
                wt.Source, wt.PaymentReference, wt.Description,
                wt.Status, wt.CreatedAt,
                COUNT(*) OVER() as _TotalCount
            FROM WalletTransactions wt
            INNER JOIN Currencies c ON wt.CurrencyID = c.CurrencyID
            ${where}
            ORDER BY wt.CreatedAt DESC
            OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
        `, params);

        const rows = result.recordset || [];
        const total = rows[0]?._TotalCount || 0;
        return { rows, total };
    }

    /**
     * Get wallet stats aggregates.
     */
    static async getTransactionStats(walletId: string): Promise<any> {
        const result = await dbService.executeQuery(`
            SELECT 
                COUNT(*) as TotalTransactions,
                SUM(CASE WHEN TransactionType = 'Credit' THEN Amount ELSE 0 END) as TotalCredits,
                SUM(CASE WHEN TransactionType = 'Debit' THEN Amount ELSE 0 END) as TotalDebits,
                MAX(CASE WHEN TransactionType = 'Credit' THEN CreatedAt END) as LastCreditAt,
                MAX(CASE WHEN TransactionType = 'Debit' THEN CreatedAt END) as LastDebitAt
            FROM WalletTransactions
            WHERE WalletID = @param0 AND Status = 'Completed'
        `, [walletId]);
        return result.recordset[0];
    }

    /**
     * Sum of referral earnings for withdrawable balance calc.
     */
    static async sumReferralEarnings(walletId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            SELECT COALESCE(SUM(Amount), 0) as TotalEarnings
            FROM WalletTransactions
            WHERE WalletID = @param0 AND TransactionType = 'Credit'
                AND Status = 'Completed' AND Source = 'REFERRAL_EARNINGS'
        `, [walletId]);
        return result.recordset?.[0]?.TotalEarnings || 0;
    }

    /**
     * Sum of all credits for display.
     */
    static async sumAllCredits(walletId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            SELECT COALESCE(SUM(Amount), 0) as TotalEarned
            FROM WalletTransactions
            WHERE WalletID = @param0 AND TransactionType = 'Credit' AND Status = 'Completed'
        `, [walletId]);
        return result.recordset?.[0]?.TotalEarned || 0;
    }

    // ═══════════════════════════════════════════════════════════
    //  WALLET RECHARGE ORDERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Insert a recharge order.
     */
    static async insertRechargeOrder(params: {
        orderId: string;
        walletId: string;
        userId: string;
        amount: number;
        currencyId: number;
        razorpayOrderId: string;
        receipt: string;
        expiresAt: Date;
        packId: number | null;
        promoCode: string | null;
    }): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO WalletRechargeOrders (
                OrderID, WalletID, UserID, Amount, CurrencyID,
                Status, PaymentGateway, RazorpayOrderID, Receipt, ExpiresAt,
                PackID, PromoCode
            ) VALUES (
                @param0, @param1, @param2, @param3, @param4,
                'Pending', 'Razorpay', @param5, @param6, @param7,
                @param8, @param9
            )
        `, [
            params.orderId, params.walletId, params.userId, params.amount, params.currencyId,
            params.razorpayOrderId, params.receipt, params.expiresAt,
            params.packId, params.promoCode
        ]);
    }

    /**
     * Find a recharge order by Razorpay order ID + user ID.
     */
    static async findRechargeOrder(razorpayOrderId: string, userId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT OrderID, WalletID, UserID, Amount, Status, RazorpayOrderID, PackID, PromoCode
            FROM WalletRechargeOrders
            WHERE RazorpayOrderID = @param0 AND UserID = @param1
        `, [razorpayOrderId, userId]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Mark a recharge order as paid.
     */
    static async markOrderPaid(orderId: string, razorpayPaymentId: string, razorpaySignature: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE WalletRechargeOrders SET Status = 'Paid', RazorpayPaymentID = @param1, RazorpaySignature = @param2, PaidAt = GETUTCDATE() WHERE OrderID = @param0`,
            [orderId, razorpayPaymentId, razorpaySignature]
        );
    }

    /**
     * Update bonus credited on an order.
     */
    static async updateOrderBonus(orderId: string, bonusAmount: number): Promise<void> {
        await dbService.executeQuery(
            `UPDATE WalletRechargeOrders SET BonusCredited = @param1 WHERE OrderID = @param0`,
            [orderId, bonusAmount]
        );
    }

    /**
     * Get paginated recharge order history for a user.
     */
    static async findRechargeOrders(userId: string, offset: number, pageSize: number): Promise<{ rows: any[]; total: number }> {
        const result = await dbService.executeQuery(`
            SELECT 
                wro.OrderID, wro.Amount,
                c.Code as CurrencyCode, c.Symbol as CurrencySymbol,
                wro.Status, wro.PaymentGateway, wro.RazorpayOrderID,
                wro.RazorpayPaymentID, wro.Receipt, wro.CreatedAt,
                wro.PaidAt, wro.ExpiresAt, wro.ErrorMessage,
                COUNT(*) OVER() as _TotalCount
            FROM WalletRechargeOrders wro
            INNER JOIN Currencies c ON wro.CurrencyID = c.CurrencyID
            WHERE wro.UserID = @param0
            ORDER BY wro.CreatedAt DESC
            OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
        `, [userId]);
        const rows = result.recordset || [];
        return { rows, total: rows[0]?._TotalCount || 0 };
    }

    // ═══════════════════════════════════════════════════════════
    //  WALLET WITHDRAWALS
    // ═══════════════════════════════════════════════════════════

    /**
     * Sum of withdrawals in non-rejected statuses (for withdrawable calc).
     */
    static async sumWithdrawn(userId: string): Promise<number> {
        const result = await dbService.executeQuery(`
            SELECT COALESCE(SUM(Amount), 0) as TotalWithdrawn
            FROM WalletWithdrawals
            WHERE UserID = @param0 AND Status IN ('Completed', 'Pending', 'Processing')
        `, [userId]);
        return result.recordset?.[0]?.TotalWithdrawn || 0;
    }

    /**
     * Insert a withdrawal request.
     */
    static async insertWithdrawal(params: {
        withdrawalId: string;
        walletId: string;
        userId: string;
        amount: number;
        processingFee: number;
        netAmount: number;
        upiId: string | null;
        bankAccount: string | null;
        ifscCode: string | null;
        accountHolderName: string | null;
    }): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO WalletWithdrawals (
                WithdrawalID, WalletID, UserID, Amount, ProcessingFee, NetAmount, CurrencyID,
                UPI_ID, BankAccountNumber, BankIFSC, BankAccountName,
                Status, RequestedAt
            ) VALUES (
                @param0, @param1, @param2, @param3, @param4, @param5, 4,
                @param6, @param7, @param8, @param9,
                'Pending', GETUTCDATE()
            )
        `, [
            params.withdrawalId, params.walletId, params.userId,
            params.amount, params.processingFee, params.netAmount,
            params.upiId, params.bankAccount, params.ifscCode, params.accountHolderName
        ]);
    }

    /**
     * Delete a withdrawal request (rollback on failed deduction).
     */
    static async deleteWithdrawal(withdrawalId: string): Promise<void> {
        await dbService.executeQuery(
            `DELETE FROM WalletWithdrawals WHERE WithdrawalID = @param0`,
            [withdrawalId]
        );
    }

    /**
     * Get paginated withdrawal history for a user.
     */
    static async findUserWithdrawals(userId: string, offset: number, pageSize: number): Promise<{ rows: any[]; total: number }> {
        const countResult = await dbService.executeQuery(
            `SELECT COUNT(*) as Total FROM WalletWithdrawals WHERE UserID = @param0`,
            [userId]
        );
        const total = countResult.recordset?.[0]?.Total || 0;

        const result = await dbService.executeQuery(`
            SELECT 
                WithdrawalID, Amount, ProcessingFee, NetAmount,
                UPI_ID as UpiId, BankAccountNumber, Status,
                RequestedAt, ProcessedAt, PaymentReference, RejectionReason
            FROM WalletWithdrawals
            WHERE UserID = @param0
            ORDER BY RequestedAt DESC
            OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
        `, [userId]);

        return { rows: result.recordset || [], total };
    }

    /**
     * Get admin withdrawals (with user info, optional status filter).
     */
    static async findAdminWithdrawals(offset: number, pageSize: number, status?: string): Promise<{ rows: any[]; total: number }> {
        let where = '';
        const params: any[] = [];
        if (status) {
            where = 'WHERE w.Status = @param0';
            params.push(status);
        }

        const countResult = await dbService.executeQuery(
            `SELECT COUNT(*) as Total FROM WalletWithdrawals w ${where}`,
            params
        );
        const total = countResult.recordset?.[0]?.Total || 0;

        const result = await dbService.executeQuery(`
            SELECT 
                w.WithdrawalID, w.UserID,
                u.FirstName, u.LastName, u.Email,
                w.Amount, w.ProcessingFee, w.NetAmount,
                w.UPI_ID as UpiId, w.BankAccountNumber, w.BankIFSC, w.BankAccountName,
                w.Status, w.RequestedAt, w.ProcessedAt,
                w.PaymentReference, w.RejectionReason
            FROM WalletWithdrawals w
            INNER JOIN Users u ON w.UserID = u.UserID
            ${where}
            ORDER BY w.RequestedAt DESC
            OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
        `, params);

        return { rows: result.recordset || [], total };
    }

    /**
     * Find a withdrawal with user info (for admin processing).
     */
    static async findWithdrawalWithUser(withdrawalId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT w.*, u.Email, u.FirstName
            FROM WalletWithdrawals w
            INNER JOIN Users u ON w.UserID = u.UserID
            WHERE w.WithdrawalID = @param0
        `, [withdrawalId]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Mark a withdrawal as completed (approved).
     */
    static async approveWithdrawal(withdrawalId: string, paymentReference: string, adminId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE WalletWithdrawals
            SET Status = 'Completed', ProcessedAt = GETUTCDATE(),
                PaymentReference = @param1, ProcessedBy = @param2
            WHERE WithdrawalID = @param0
        `, [withdrawalId, paymentReference, adminId]);
    }

    /**
     * Mark a withdrawal as rejected.
     */
    static async rejectWithdrawal(withdrawalId: string, reason: string, adminId: string): Promise<void> {
        await dbService.executeQuery(`
            UPDATE WalletWithdrawals
            SET Status = 'Rejected', ProcessedAt = GETUTCDATE(),
                RejectionReason = @param1, ProcessedBy = @param2
            WHERE WithdrawalID = @param0
        `, [withdrawalId, reason, adminId]);
    }

    // ═══════════════════════════════════════════════════════════
    //  WALLET HOLDS
    // ═══════════════════════════════════════════════════════════

    /**
     * Sum of active holds for a wallet.
     */
    static async sumActiveHolds(walletId: string): Promise<number> {
        const result = await dbService.executeQuery(
            `SELECT COALESCE(SUM(Amount), 0) as TotalHolds FROM WalletHolds WHERE WalletID = @param0 AND Status = 'Active'`,
            [walletId]
        );
        return result.recordset?.[0]?.TotalHolds || 0;
    }

    /**
     * Check if an active hold already exists for a referral request.
     */
    static async hasActiveHold(referralRequestId: string): Promise<boolean> {
        const result = await dbService.executeQuery(
            `SELECT HoldID FROM WalletHolds WHERE ReferralRequestID = @param0 AND Status = 'Active'`,
            [referralRequestId]
        );
        return (result.recordset?.length ?? 0) > 0;
    }

    /**
     * Insert a new hold.
     */
    static async insertHold(params: {
        holdId: string;
        walletId: string;
        userId: string;
        referralRequestId: string;
        amount: number;
        description: string;
    }): Promise<void> {
        await dbService.executeQuery(`
            INSERT INTO WalletHolds (
                HoldID, WalletID, UserID, ReferralRequestID,
                Amount, Status, Description, CreatedAt
            ) VALUES (
                @param0, @param1, @param2, @param3,
                @param4, 'Active', @param5, GETUTCDATE()
            )
        `, [params.holdId, params.walletId, params.userId, params.referralRequestId, params.amount, params.description]);
    }

    /**
     * Find an active hold for a referral request (with wallet balance + currencyID).
     */
    static async findActiveHoldWithBalance(referralRequestId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT h.HoldID, h.WalletID, h.UserID, h.Amount, h.Description, w.Balance, w.CurrencyID
            FROM WalletHolds h
            INNER JOIN Wallets w ON h.WalletID = w.WalletID
            WHERE h.ReferralRequestID = @param0 AND h.Status = 'Active'
        `, [referralRequestId]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Find an active hold for a referral request (lightweight — no wallet join).
     */
    static async findActiveHold(referralRequestId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT HoldID, Amount, UserID, WalletID
            FROM WalletHolds
            WHERE ReferralRequestID = @param0 AND Status = 'Active'
        `, [referralRequestId]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Mark a hold as converted.
     */
    static async markHoldConverted(holdId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE WalletHolds SET Status = 'Converted', ConvertedAt = GETUTCDATE() WHERE HoldID = @param0`,
            [holdId]
        );
    }

    /**
     * Mark a hold as released.
     */
    static async markHoldReleased(holdId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE WalletHolds SET Status = 'Released', ReleasedAt = GETUTCDATE() WHERE HoldID = @param0`,
            [holdId]
        );
    }

    /**
     * Get user holds (with referral request + org info).
     */
    static async findUserHolds(walletId: string, status?: string): Promise<any[]> {
        let where = 'WHERE h.WalletID = @param0';
        const params: any[] = [walletId];
        if (status) {
            where += ' AND h.Status = @param1';
            params.push(status);
        }

        const result = await dbService.executeQuery(`
            SELECT 
                h.HoldID, h.ReferralRequestID, h.Amount, h.Status,
                h.Description, h.CreatedAt, h.ConvertedAt, h.ReleasedAt,
                rr.JobTitle, rr.ExpiryTime, rr.OpenToAnyCompany,
                CASE WHEN rr.OpenToAnyCompany = 1 THEN 'Any Company' ELSE COALESCE(o.Name, 'Unknown Company') END as CompanyName
            FROM WalletHolds h
            LEFT JOIN ReferralRequests rr ON h.ReferralRequestID = rr.RequestID
            LEFT JOIN Organizations o ON rr.OrganizationID = o.OrganizationID
            ${where}
            ORDER BY h.CreatedAt DESC
        `, params);
        return result.recordset || [];
    }

    /**
     * Find a hold by referral request ID (any status).
     */
    static async findHoldByRequestId(referralRequestId: string): Promise<any | null> {
        const result = await dbService.executeQuery(`
            SELECT HoldID, WalletID, UserID, ReferralRequestID,
                   Amount, Status, Description, CreatedAt, ConvertedAt, ReleasedAt
            FROM WalletHolds
            WHERE ReferralRequestID = @param0
        `, [referralRequestId]);
        return result.recordset?.[0] ?? null;
    }

    // ═══════════════════════════════════════════════════════════
    //  USER HELPERS (used by wallet for user lookups)
    // ═══════════════════════════════════════════════════════════

    /**
     * Get user basic info (Email, FirstName, LastName).
     */
    static async getUserBasic(userId: string): Promise<{ Email: string; FirstName: string; LastName: string } | null> {
        const result = await dbService.executeQuery(
            `SELECT Email, FirstName, LastName FROM Users WHERE UserID = @param0`,
            [userId]
        );
        return result.recordset?.[0] ?? null;
    }

    /**
     * Check if welcome bonus has already been given.
     */
    static async isWelcomeBonusGiven(userId: string): Promise<boolean> {
        const result = await dbService.executeQuery(
            `SELECT WalletBonusGiven FROM Users WHERE UserID = @param0`,
            [userId]
        );
        return !!result.recordset?.[0]?.WalletBonusGiven;
    }

    /**
     * Mark welcome bonus as given.
     */
    static async markWelcomeBonusGiven(userId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET WalletBonusGiven = 1, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId]
        );
    }
}
