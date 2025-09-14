/**
 * Payment Controllers - Razorpay Integration
 * Handles payment processing for subscription plans
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { RazorpayService } from '../services/razorpay.service';
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
 * Create Razorpay order for subscription payment
 * POST /payments/razorpay/create-order
 */
export const createRazorpayOrder = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const orderData = await extractRequestBody(req);
        
        // Validate required fields
        if (!orderData.amount || !orderData.planId) {
            throw new ValidationError('Amount and plan ID are required');
        }

        if (orderData.amount < 100) {
            throw new ValidationError('Minimum payment amount is ?1 (100 paise)');
        }

        const order = await RazorpayService.createOrder(orderData, user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(order, 'Payment order created successfully')
        };
    } catch (error: any) {
        console.error('Create Razorpay order error:', error);
        const status = error instanceof ValidationError ? 400 : error instanceof NotFoundError ? 404 : 500;
        return { 
            status, 
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to create payment order', 
                errorCode: error?.name || 'Error' 
            } 
        };
    }
});

/**
 * Verify Razorpay payment and activate subscription
 * POST /payments/razorpay/verify-and-activate
 */
export const verifyPaymentAndActivateSubscription = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const verificationData = await extractRequestBody(req);
        
        // Validate required fields
        const requiredFields = ['razorpayPaymentId', 'razorpayOrderId', 'razorpaySignature', 'planId', 'amount'];
        for (const field of requiredFields) {
            if (!verificationData[field]) {
                throw new ValidationError(`${field} is required`);
            }
        }

        const result = await RazorpayService.verifyPaymentAndActivateSubscription(verificationData, user.userId);
        
        return {
            status: 200,
            jsonBody: successResponse(result, 'Payment verified and subscription activated successfully')
        };
    } catch (error: any) {
        console.error('Verify payment error:', error);
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
 * Get payment history for user
 * GET /payments/history
 */
export const getPaymentHistory = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        
        // Extract query parameters
        const url = new URL(req.url);
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
        
        const history = await RazorpayService.getPaymentHistory(user.userId, page, pageSize);
        
        return {
            status: 200,
            jsonBody: successResponse(history, 'Payment history retrieved successfully')
        };
    } catch (error: any) {
        console.error('Get payment history error:', error);
        return {
            status: 500,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to get payment history',
                errorCode: error?.name || 'Error' 
            }
        };
    }
});