/**
 * Wallet Controllers
 * Handles wallet operations, recharge, and transaction management
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WalletService } from '../services/wallet.service';
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
 */
export const getWalletBalance = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const balance = await WalletService.getBalance(user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(balance, 'Balance retrieved successfully')
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
        const { amount } = await extractRequestBody(req);
        
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

        const order = await WalletService.createRechargeOrder(amount, user.userId);
        
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
