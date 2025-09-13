/**
 * Razorpay Payment Service
 * Handles payment processing and subscription management
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { dbService } from './database.service';
import { AuthService } from './auth.service';
import { ValidationError, NotFoundError } from '../utils/validation';

// Initialize Razorpay with test credentials
const razorpay = new Razorpay({
  key_id: 'rzp_test_RHBUKjg4k9qx4J',
  key_secret: 'IGx3G02rEoPHqS32Jk70DfGW',
});

export class RazorpayService {
  /**
   * Create a Razorpay order for subscription payment
   */
  static async createOrder(orderData: {
    amount: number;
    currency: string;
    planId: string;
    planName: string;
    customerEmail: string;
    customerName: string;
  }, userId: string) {
    try {
      // Validate amount (should be in paise, minimum 100 paise = ?1)
      if (!orderData.amount || orderData.amount < 100) {
        throw new ValidationError('Invalid payment amount');
      }

      // Create order in Razorpay
      const order = await razorpay.orders.create({
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        receipt: `receipt_${userId}_${Date.now()}`,
        notes: {
          planId: orderData.planId,
          planName: orderData.planName,
          userId: userId,
          customerEmail: orderData.customerEmail,
        }
      });

      // Store order details in database for tracking
      const orderId = AuthService.generateUniqueId();
      const insertQuery = `
        INSERT INTO PaymentOrders (
          OrderID, RazorpayOrderID, UserID, PlanID, Amount, Currency, Status, CreatedAt
        ) VALUES (
          @param0, @param1, @param2, @param3, @param4, @param5, 'Created', GETUTCDATE()
        )
      `;

      await dbService.executeQuery(insertQuery, [
        orderId,
        order.id,
        userId,
        orderData.planId,
        orderData.amount,
        orderData.currency || 'INR'
      ]);

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        internalOrderId: orderId
      };
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Failed to create payment order');
    }
  }

  /**
   * Verify payment signature and activate subscription
   */
  static async verifyPaymentAndActivateSubscription(verificationData: {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    razorpaySignature: string;
    planId: string;
    amount: number;
  }, userId: string) {
    try {
      // Step 1: Verify payment signature
      const isSignatureValid = this.verifyPaymentSignature(
        verificationData.razorpayOrderId,
        verificationData.razorpayPaymentId,
        verificationData.razorpaySignature
      );

      if (!isSignatureValid) {
        throw new ValidationError('Invalid payment signature');
      }

      // Step 2: Verify order exists and belongs to user
      const orderQuery = `
        SELECT OrderID, PlanID, Amount, Status 
        FROM PaymentOrders 
        WHERE RazorpayOrderID = @param0 AND UserID = @param1
      `;
      const orderResult = await dbService.executeQuery(orderQuery, [
        verificationData.razorpayOrderId,
        userId
      ]);

      if (!orderResult.recordset || orderResult.recordset.length === 0) {
        throw new NotFoundError('Payment order not found');
      }

      const order = orderResult.recordset[0];

      // Step 3: Verify plan and amount
      const planQuery = `
        SELECT PlanID, Name, ReferralsPerDay, DurationDays, Price
        FROM ReferralPlans
        WHERE PlanID = @param0
      `;
      const planResult = await dbService.executeQuery(planQuery, [verificationData.planId]);

      if (!planResult.recordset || planResult.recordset.length === 0) {
        throw new NotFoundError('Referral plan not found');
      }

      const plan = planResult.recordset[0];
      const expectedAmount = plan.Price * 100; // Convert to paise

      if (order.Amount !== expectedAmount || verificationData.amount !== expectedAmount) {
        throw new ValidationError('Payment amount mismatch');
      }

      // Step 4: Get applicant ID
      const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
      const applicantResult = await dbService.executeQuery(applicantQuery, [userId]);

      if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
        throw new NotFoundError('Applicant profile not found');
      }

      const applicantId = applicantResult.recordset[0].ApplicantID;

      // Step 5: Deactivate existing subscriptions
      await dbService.executeQuery(
        'UPDATE ApplicantReferralSubscriptions SET IsActive = 0 WHERE ApplicantID = @param0',
        [applicantId]
      );

      // Step 6: Create new subscription
      const subscriptionId = AuthService.generateUniqueId();
      const startDate = new Date();
      const endDate = new Date();

      if (plan.DurationDays === 9999) {
        endDate.setFullYear(endDate.getFullYear() + 100); // Lifetime
      } else if (plan.DurationDays === 0) {
        endDate.setFullYear(endDate.getFullYear() + 100); // Free plan
      } else {
        endDate.setDate(endDate.getDate() + plan.DurationDays);
      }

      const subscriptionQuery = `
        INSERT INTO ApplicantReferralSubscriptions (
          SubscriptionID, ApplicantID, PlanID, StartDate, EndDate, IsActive, PaymentID
        ) VALUES (
          @param0, @param1, @param2, @param3, @param4, 1, @param5
        )
      `;

      await dbService.executeQuery(subscriptionQuery, [
        subscriptionId,
        applicantId,
        plan.PlanID,
        startDate,
        endDate,
        verificationData.razorpayPaymentId
      ]);

      // Step 7: Update payment order status
      await dbService.executeQuery(
        'UPDATE PaymentOrders SET Status = @param1, PaymentID = @param2, UpdatedAt = GETUTCDATE() WHERE OrderID = @param0',
        [order.OrderID, 'Completed', verificationData.razorpayPaymentId]
      );

      // Step 8: Log payment transaction
      const transactionId = AuthService.generateUniqueId();
      const transactionQuery = `
        INSERT INTO PaymentTransactions (
          TransactionID, UserID, PaymentID, OrderID, Amount, Currency, Status, 
          PaymentMethod, CreatedAt
        ) VALUES (
          @param0, @param1, @param2, @param3, @param4, @param5, 'Success', 'Razorpay', GETUTCDATE()
        )
      `;

      await dbService.executeQuery(transactionQuery, [
        transactionId,
        userId,
        verificationData.razorpayPaymentId,
        verificationData.razorpayOrderId,
        verificationData.amount,
        'INR'
      ]);

      console.log(`? Subscription activated for user ${userId}, plan ${plan.Name}`);

      return {
        success: true,
        subscriptionId: subscriptionId,
        planName: plan.Name,
        referralsPerDay: plan.ReferralsPerDay,
        validUntil: endDate,
        paymentId: verificationData.razorpayPaymentId
      };

    } catch (error) {
      console.error('Error verifying payment and activating subscription:', error);
      
      // Log failed transaction
      try {
        const failedTransactionId = AuthService.generateUniqueId();
        const failedTransactionQuery = `
          INSERT INTO PaymentTransactions (
            TransactionID, UserID, PaymentID, OrderID, Amount, Currency, Status, 
            PaymentMethod, ErrorMessage, CreatedAt
          ) VALUES (
            @param0, @param1, @param2, @param3, @param4, @param5, 'Failed', 'Razorpay', @param6, GETUTCDATE()
          )
        `;

        await dbService.executeQuery(failedTransactionQuery, [
          failedTransactionId,
          userId,
          verificationData.razorpayPaymentId || null,
          verificationData.razorpayOrderId || null,
          verificationData.amount || 0,
          'INR',
          error instanceof Error ? error.message : 'Unknown error'
        ]);
      } catch (logError) {
        console.error('Error logging failed transaction:', logError);
      }

      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  /**
   * Verify Razorpay payment signature
   */
  private static verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', 'IGx3G02rEoPHqS32Jk70DfGW') // Test secret key
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Error verifying payment signature:', error);
      return false;
    }
  }

  /**
   * Get payment history for a user
   */
  static async getPaymentHistory(userId: string, page: number = 1, pageSize: number = 20) {
    try {
      const offset = (page - 1) * pageSize;
      
      const query = `
        SELECT 
          pt.TransactionID,
          pt.PaymentID,
          pt.Amount,
          pt.Currency,
          pt.Status,
          pt.PaymentMethod,
          pt.CreatedAt,
          rp.Name as PlanName,
          ars.StartDate,
          ars.EndDate,
          ars.IsActive
        FROM PaymentTransactions pt
        LEFT JOIN PaymentOrders po ON pt.OrderID = po.RazorpayOrderID
        LEFT JOIN ReferralPlans rp ON po.PlanID = rp.PlanID
        LEFT JOIN ApplicantReferralSubscriptions ars ON ars.PaymentID = pt.PaymentID
        WHERE pt.UserID = @param0
        ORDER BY pt.CreatedAt DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `;

      const result = await dbService.executeQuery(query, [userId]);
      
      const countQuery = `
        SELECT COUNT(*) as Total
        FROM PaymentTransactions
        WHERE UserID = @param0
      `;
      
      const countResult = await dbService.executeQuery(countQuery, [userId]);
      const total = countResult.recordset[0]?.Total || 0;

      return {
        transactions: result.recordset || [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw error;
    }
  }
}