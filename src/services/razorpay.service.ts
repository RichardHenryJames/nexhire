/**
 * Razorpay Payment Service
 * Handles payment processing and subscription management
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { dbService } from './database.service';
import { AuthService } from './auth.service';
import { ValidationError, NotFoundError } from '../utils/validation';

// Lazy init to allow env variables in cloud runtime
function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_RHBUKjg4k9qx4J';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'IGx3G02rEoPHqS32Jk70DfGW';
  return new Razorpay({ key_id, key_secret });
}

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
        throw new ValidationError('Invalid payment amount (minimum ?1)');
      }

      // Validate plan and expected amount to prevent tampering
      const planQuery = `SELECT PlanID, Name, Price FROM ReferralPlans WHERE PlanID = @param0`;
      const planResult = await dbService.executeQuery(planQuery, [orderData.planId]);
      if (!planResult.recordset || planResult.recordset.length === 0) {
        throw new NotFoundError('Referral plan not found');
      }
      const plan = planResult.recordset[0];
      const expectedAmount = plan.Price * 100; // paise
      if (expectedAmount !== orderData.amount) {
        throw new ValidationError(`Payment amount mismatch. Expected ${expectedAmount} paise, received ${orderData.amount} paise`);
      }

      // Fetch applicantId (PaymentOrders table expects ApplicantID not UserID)
      const applicantRes = await dbService.executeQuery('SELECT ApplicantID FROM Applicants WHERE UserID = @param0', [userId]);
      if (!applicantRes.recordset || applicantRes.recordset.length === 0) {
        throw new NotFoundError('Applicant profile not found');
      }
      const applicantId = applicantRes.recordset[0].ApplicantID;

      const razorpay = getRazorpayClient();

      // Razorpay receipt must be <= 40 characters. Previous format could exceed this.
      // Build a compact, unique, deterministic receipt id.
      const sanitizedUser = (userId || '')
        .replace(/[^a-zA-Z0-9]/g, '') // alphanumeric only
        .slice(0, 10); // cap to 10 chars
      const timePart = Date.now().toString(36); // compact timestamp
      let receipt = `rcpt_${sanitizedUser}_${timePart}`; // eg: rcpt_ab12cd34ef_lmno12
      if (receipt.length > 40) {
        receipt = receipt.slice(0, 40);
      }

      // Create order in Razorpay
      const order = await razorpay.orders.create({
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        receipt,
        notes: {
          planId: orderData.planId,
          planName: plan.Name,
          userId: userId,
          customerEmail: orderData.customerEmail,
        }
      });

      // Store order details in PaymentOrders (schema: OrderID, ApplicantID, PlanID, Amount DECIMAL(10,2), Currency, Status, PaymentGateway, PaymentReference, CreatedAt, PaidAt)
      const internalOrderId = AuthService.generateUniqueId();
      const insertQuery = `
        INSERT INTO PaymentOrders (
          OrderID, ApplicantID, PlanID, Amount, Currency, Status, PaymentGateway, PaymentReference, CreatedAt
        ) VALUES (
          @param0, @param1, @param2, @param3, @param4, 'Pending', 'Razorpay', @param5, GETUTCDATE()
        )
      `;

      await dbService.executeQuery(insertQuery, [
        internalOrderId,
        applicantId,
        plan.PlanID,
        plan.Price, // store in currency units as per schema (DECIMAL 10,2)
        orderData.currency || 'INR',
        order.id // PaymentReference
      ]);

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        internalOrderId
      };
    } catch (error: any) {
      console.error('Error creating Razorpay order (debug):', {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        description: error?.description,
      });
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      // Razorpay error surface
      const detail = error?.description || error?.error?.description || error?.message || 'Unknown error';
      throw new Error(`Razorpay order failed: ${detail}`);
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
      // Map user to applicant
      const applicantRes = await dbService.executeQuery('SELECT ApplicantID FROM Applicants WHERE UserID = @param0', [userId]);
      if (!applicantRes.recordset || applicantRes.recordset.length === 0) {
        throw new NotFoundError('Applicant profile not found');
      }
      const applicantId = applicantRes.recordset[0].ApplicantID;

      const orderQuery = `
        SELECT OrderID, PlanID, Amount, Status, PaymentReference 
        FROM PaymentOrders 
        WHERE PaymentReference = @param0 AND ApplicantID = @param1
      `;
      const orderResult = await dbService.executeQuery(orderQuery, [
        verificationData.razorpayOrderId,
        applicantId
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

      // order.Amount stored in units; verificationData.amount & expectedAmount in paise
      if (order.Amount * 100 !== expectedAmount || verificationData.amount !== expectedAmount) {
        throw new ValidationError('Payment amount mismatch');
      }

      // Step 4: Deactivate existing subscriptions
      await dbService.executeQuery(
        'UPDATE ApplicantReferralSubscriptions SET IsActive = 0 WHERE ApplicantID = @param0',
        [applicantId]
      );

      // Step 5: Create new subscription
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

      // Step 6: Update payment order status
      await dbService.executeQuery(
        'UPDATE PaymentOrders SET Status = @param1, PaymentReference = @param2, PaidAt = GETUTCDATE() WHERE OrderID = @param0',
        [order.OrderID, 'Paid', verificationData.razorpayPaymentId]
      );

      // Step 7: Log payment transaction
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

    } catch (error: any) {
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
      const key_secret = process.env.RAZORPAY_KEY_SECRET || 'IGx3G02rEoPHqS32Jk70DfGW';
      const expectedSignature = crypto
        .createHmac('sha256', key_secret)
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
        /* Payment history: pt.OrderID stores Razorpay order id; PaymentOrders.PaymentReference stores same */
        SELECT 
          pt.TransactionID,
          pt.PaymentID,               -- Razorpay payment id
          pt.OrderID as RazorpayOrderID,
          pt.Amount,                  -- amount in paise
          pt.Currency,
          pt.Status,
          pt.PaymentMethod,
          pt.CreatedAt,
          rp.Name as PlanName,
          po.PlanID,
          po.Amount as PlanAmount,    -- stored in currency units
          po.Currency as PlanCurrency,
          po.Status as OrderStatus,
          po.PaidAt,
          ars.StartDate,
          ars.EndDate,
          ars.IsActive
        FROM PaymentTransactions pt
        LEFT JOIN PaymentOrders po ON pt.OrderID = po.PaymentReference
        LEFT JOIN ReferralPlans rp ON po.PlanID = rp.PlanID
        LEFT JOIN ApplicantReferralSubscriptions ars ON ars.PaymentID = pt.PaymentID
        WHERE pt.UserID = @param0
        ORDER BY pt.CreatedAt DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `;

      const result = await dbService.executeQuery(query, [userId]);
      const countQuery = `SELECT COUNT(*) as Total FROM PaymentTransactions WHERE UserID = @param0`;
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