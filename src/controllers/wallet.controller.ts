/**
 * Wallet Controllers
 * Handles wallet operations, recharge, and transaction management
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WalletService } from '../services/wallet.service';
import { dbService } from '../services/database.service';
import { 
    withErrorHandling, 
    authenticate
} from '../middleware';
import { 
    successResponse, 
    extractRequestBody,
    ValidationError,
    NotFoundError
} from '../utils/validation';

/**
 * Helper to check if user is admin
 */
const isAdminUser = async (userId: string): Promise<boolean> => {
  try {
    const result = await dbService.executeQuery(`
      SELECT UserType FROM Users WHERE UserID = @param0
    `, [userId]);
    return result.recordset?.[0]?.UserType === 'Admin';
  } catch {
    return false;
  }
};

/**
 * Get wallet details and balance
 * GET /wallet
 */
export const getWallet = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const wallet = await WalletService.getOrCreateWallet(user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(wallet, 'Wallet details retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get wallet error:', error);
        const status = error instanceof NotFoundError ? 404 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get wallet details',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get wallet balance
 * GET /wallet/balance
 * Returns balance, availableBalance (after holds), and holdAmount
 */
export const getWalletBalance = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        // Use getAvailableBalance which includes hold information
        const balanceInfo = await WalletService.getAvailableBalance(user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(balanceInfo, 'Balance retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get balance error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get balance',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Create Razorpay order for wallet recharge
 * POST /wallet/recharge/create-order
 * ? UPDATED: No minimum recharge limit
 */
export const createWalletRechargeOrder = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const { amount, packId, promoCode } = await extractRequestBody(req);
        
        // Validate amount
        if (!amount || typeof amount !== 'number') {
            throw new ValidationError('Valid amount is required');
        }

        if (amount <= 0) {
            throw new ValidationError('Amount must be greater than zero');
        }

        if (amount > 100000) {
            throw new ValidationError('Maximum recharge amount is ₹1,00,000');
        }

        const order = await WalletService.createRechargeOrder(amount, user.userId, packId || null, promoCode || null);
        
        return {
            status: 200,
            jsonBody: successResponse(order, 'Recharge order created successfully')
        };
    } catch (error: any) {
        console.error('Create recharge order error:', error);
        const status = error instanceof ValidationError ? 400 : error instanceof NotFoundError ? 404 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to create recharge order',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Verify Razorpay payment and credit wallet
 * POST /wallet/recharge/verify
 */
export const verifyWalletRecharge = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const verificationData = await extractRequestBody(req);
        
        // Validate required fields
        const requiredFields = ['razorpayPaymentId', 'razorpayOrderId', 'razorpaySignature'];
        for (const field of requiredFields) {
            if (!verificationData[field]) {
                throw new ValidationError(`${field} is required`);
            }
        }

        const result = await WalletService.verifyAndCreditWallet(verificationData, user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'Payment verified and wallet credited successfully')
        };
    } catch (error: any) {
        console.error('Verify wallet recharge error:', error);
        const status = error instanceof ValidationError ? 400 : error instanceof NotFoundError ? 404 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Payment verification failed',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get wallet transaction history
 * GET /wallet/transactions
 */
export const getWalletTransactions = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Extract query parameters
        const url = new URL(req.url);
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
        const type = url.searchParams.get('type') as 'Credit' | 'Debit' | undefined;
        
        const history = await WalletService.getTransactionHistory(user.userId, page, pageSize, type);
        
        return {
            status: 200,
            jsonBody: successResponse(history, 'Transaction history retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get wallet transactions error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get transaction history',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get recharge order history
 * GET /wallet/recharge/history
 */
export const getRechargeHistory = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Extract query parameters
        const url = new URL(req.url);
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
        
        const history = await WalletService.getRechargeHistory(user.userId, page, pageSize);
        
        return {
            status: 200,
            jsonBody: successResponse(history, 'Recharge history retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get recharge history error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get recharge history',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get wallet statistics
 * GET /wallet/stats
 */
export const getWalletStats = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const stats = await WalletService.getWalletStats(user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(stats, 'Wallet statistics retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get wallet stats error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get wallet statistics',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Debit wallet (internal use - for purchasing services)
 * POST /wallet/debit
 */
export const debitWallet = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const { amount, source, description } = await extractRequestBody(req);
        
        // Validate input
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            throw new ValidationError('Valid amount is required');
        }

        if (!source || !description) {
            throw new ValidationError('Source and description are required');
        }

        const transaction = await WalletService.debitWallet(user.userId, amount, source, description);
        
        return {
            status: 200,
            jsonBody: successResponse(transaction, 'Wallet debited successfully')
        };
    } catch (error: any) {
        console.error('Debit wallet error:', error);
        const status = error instanceof ValidationError ? 400 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to debit wallet',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get withdrawable balance (referral earnings)
 * GET /wallet/withdrawable
 */
export const getWithdrawableBalance = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const withdrawable = await WalletService.getWithdrawableBalance(user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(withdrawable, 'Withdrawable balance retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get withdrawable balance error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get withdrawable balance',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Request withdrawal of referral earnings
 * POST /wallet/withdraw
 */
export const requestWithdrawal = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const { amount, upiId, bankAccount, ifscCode, accountHolderName } = await extractRequestBody(req);
        
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            throw new ValidationError('Valid amount is required');
        }

        if (!upiId && !bankAccount) {
            throw new ValidationError('Either UPI ID or bank account details are required');
        }

        const result = await WalletService.requestWithdrawal(user.userId, amount, {
            upiId,
            bankAccount,
            ifscCode,
            accountHolderName
        });
        
        return {
            status: 200,
            jsonBody: successResponse(result, result.message)
        };
    } catch (error: any) {
        console.error('Request withdrawal error:', error);
        const status = error instanceof ValidationError ? 400 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to request withdrawal',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get withdrawal history
 * GET /wallet/withdrawals
 */
export const getWithdrawalHistory = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        const url = new URL(req.url);
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
        
        const history = await WalletService.getWithdrawalHistory(user.userId, page, pageSize);
        
        return {
            status: 200,
            jsonBody: successResponse(history, 'Withdrawal history retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get withdrawal history error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get withdrawal history',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Get wallet holds (pending charges for referral requests)
 * GET /wallet/holds
 */
export const getWalletHolds = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        const url = new URL(req.url);
        const status = url.searchParams.get('status') as 'Active' | 'Converted' | 'Released' | undefined;
        
        const holds = await WalletService.getUserHolds(user.userId, status);
        const { availableBalance, balance, holdAmount } = await WalletService.getAvailableBalance(user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse({
                holds,
                summary: {
                    totalBalance: balance,
                    availableBalance,
                    totalHoldAmount: holdAmount,
                    activeHoldsCount: holds.filter((h: any) => h.Status === 'Active').length
                }
            }, 'Wallet holds retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get wallet holds error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get wallet holds',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

// ===== ADMIN WITHDRAWAL ENDPOINTS =====

/**
 * Get all withdrawal requests for admin
 * GET /admin/withdrawals
 */
export const getAdminWithdrawals = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Check admin role
        if (!await isAdminUser(user.userId)) {
            return {
                status: 403,
                jsonBody: { success: false, error: 'Admin access required' }
            };
        }
        
        const url = new URL(req.url);
        const status = url.searchParams.get('status') || undefined; // 'Pending', 'Completed', 'Rejected', or undefined for all
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50')));
        
        const result = await WalletService.getAdminWithdrawals(status, page, pageSize);
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'Withdrawal requests retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get admin withdrawals error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get withdrawals',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});

/**
 * Process a withdrawal (approve or reject)
 * POST /admin/withdrawals/:id/process
 */
export const processAdminWithdrawal = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Check admin role
        if (!await isAdminUser(user.userId)) {
            return {
                status: 403,
                jsonBody: { success: false, error: 'Admin access required' }
            };
        }
        
        const withdrawalId = req.params?.id;
        if (!withdrawalId) {
            throw new ValidationError('Withdrawal ID is required');
        }
        
        const body = await extractRequestBody(req);
        const { action, paymentReference, rejectionReason } = body;
        
        if (!action || !['approve', 'reject'].includes(action)) {
            throw new ValidationError('Valid action (approve/reject) is required');
        }
        
        if (action === 'approve' && !paymentReference) {
            throw new ValidationError('Payment reference is required for approval');
        }
        
        const result = await WalletService.processWithdrawal(
            withdrawalId, 
            action as 'approve' | 'reject', 
            user.userId,
            paymentReference,
            rejectionReason
        );

        // 🔔 Notify user about withdrawal result (async)
        (async () => {
            try {
                const { InAppNotificationService } = await import('../services/inAppNotification.service');
                const wdInfo = await dbService.executeQuery(
                    'SELECT UserID, Amount FROM WalletWithdrawals WHERE WithdrawalID = @param0', [withdrawalId]
                );
                const w = wdInfo.recordset[0];
                if (w) {
                    if (action === 'approve') {
                        await InAppNotificationService.notifyWithdrawalApproved(w.UserID, w.Amount, paymentReference || '');
                    } else {
                        await InAppNotificationService.notifyWithdrawalRejected(w.UserID, w.Amount, rejectionReason || 'No reason provided');
                    }
                }
            } catch (e: any) { console.error('Notification error:', e.message); }
        })();
        
        return {
            status: 200,
            jsonBody: successResponse(result, result.message)
        };
    } catch (error: any) {
        console.error('Process withdrawal error:', error);
        const status = error instanceof ValidationError ? 400 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to process withdrawal',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});
