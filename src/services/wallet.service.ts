/**
 * Wallet Service
 * Handles wallet operations, recharge, transactions, and balance management
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { dbService } from './database.service';
import { AuthService } from './auth.service';
import { ValidationError, NotFoundError, InsufficientBalanceError } from '../utils/validation';
import { config } from '../config/appConfig';

// Lazy init Razorpay client
function getRazorpayClient() {
  const razorpayConfig = config.getRazorpayConfig();
  return new Razorpay(razorpayConfig);
}

export interface Wallet {
  WalletID: string;
  UserID: string;
  Balance: number;
  CurrencyID: number;
  CurrencyCode: string;
  Status: string;
  CreatedAt: Date;
  UpdatedAt: Date;
  LastTransactionAt: Date | null;
}

export interface WalletTransaction {
  TransactionID: string;
  WalletID: string;
  TransactionType: 'Credit' | 'Debit';
  Amount: number;
  BalanceBefore: number;
  BalanceAfter: number;
  CurrencyID: number;
  Source: string;
  PaymentReference: string | null;
  Description: string | null;
  Status: string;
  CreatedAt: Date;
}

export class WalletService {
  /**
   * Get or create wallet for user
   */
  static async getOrCreateWallet(userId: string): Promise<Wallet> {
    try {
      // Check if wallet exists
      const walletQuery = `
        SELECT 
          w.WalletID, w.UserID, w.Balance, w.CurrencyID, 
          c.Code as CurrencyCode, w.Status, w.CreatedAt, 
          w.UpdatedAt, w.LastTransactionAt
        FROM Wallets w
        INNER JOIN Currencies c ON w.CurrencyID = c.CurrencyID
        WHERE w.UserID = @param0
      `;
      
      const result = await dbService.executeQuery(walletQuery, [userId]);
      
      if (result.recordset && result.recordset.length > 0) {
        return result.recordset[0];
      }
      
      // Create new wallet if doesn't exist
      const walletId = AuthService.generateUniqueId();
      const createQuery = `
        INSERT INTO Wallets (WalletID, UserID, Balance, CurrencyID, Status)
        VALUES (@param0, @param1, 0.00, 4, 'Active');
        
        SELECT 
          w.WalletID, w.UserID, w.Balance, w.CurrencyID, 
          c.Code as CurrencyCode, w.Status, w.CreatedAt, 
          w.UpdatedAt, w.LastTransactionAt
        FROM Wallets w
        INNER JOIN Currencies c ON w.CurrencyID = c.CurrencyID
        WHERE w.WalletID = @param0
      `;
      
      const createResult = await dbService.executeQuery(createQuery, [walletId, userId]);
      
      if (!createResult.recordset || createResult.recordset.length === 0) {
        throw new Error('Failed to create wallet');
      }
      
      return createResult.recordset[0];
    } catch (error) {
      console.error('Error getting/creating wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  static async getBalance(userId: string): Promise<{ balance: number; currencyCode: string }> {
    try {
      const wallet = await this.getOrCreateWallet(userId);
      return {
        balance: wallet.Balance,
        currencyCode: wallet.CurrencyCode
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }

  /**
   * Create Razorpay order for wallet recharge
   * ? UPDATED: No minimum recharge limit
   */
  static async createRechargeOrder(amount: number, userId: string) {
    try {
      // ? UPDATED: Validate amount (must be greater than 0, maximum ₹100,000)
      if (!amount || amount <= 0) {
        throw new ValidationError('Amount must be greater than zero');
      }

      // Check maximum limit (₹100,000)
      if (amount > 100000) {
        throw new ValidationError('Maximum recharge amount is ₹1,00,000');
      }

      // Get or create wallet
      const wallet = await this.getOrCreateWallet(userId);

      // Get user details
      const userQuery = 'SELECT Email, FirstName, LastName FROM Users WHERE UserID = @param0';
      const userResult = await dbService.executeQuery(userQuery, [userId]);
      
      if (!userResult.recordset || userResult.recordset.length === 0) {
        throw new NotFoundError('User not found');
      }
      
      const user = userResult.recordset[0];

      // Generate receipt
      const sanitizedUser = (userId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
      const timePart = Date.now().toString(36);
      let receipt = `wallet_${sanitizedUser}_${timePart}`;
      if (receipt.length > 40) {
        receipt = receipt.slice(0, 40);
      }

      // Create Razorpay order
      const razorpay = getRazorpayClient();
      const amountInPaise = Math.round(amount * 100);

      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          userId,
          walletId: wallet.WalletID,
          purpose: 'wallet_recharge',
          customerEmail: user.Email,
          customerName: `${user.FirstName} ${user.LastName}`,
          environment: config.app.env
        }
      });

      // Store order in database
      const orderId = AuthService.generateUniqueId();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      const insertQuery = `
        INSERT INTO WalletRechargeOrders (
          OrderID, WalletID, UserID, Amount, CurrencyID, 
          Status, PaymentGateway, RazorpayOrderID, Receipt, ExpiresAt
        ) VALUES (
          @param0, @param1, @param2, @param3, @param4, 
          'Pending', 'Razorpay', @param5, @param6, @param7
        )
      `;

      await dbService.executeQuery(insertQuery, [
        orderId,
        wallet.WalletID,
        userId,
        amount,
        wallet.CurrencyID,
        order.id,
        receipt,
        expiresAt
      ]);

      console.log(`Wallet recharge order created: ${order.id} for user ${userId}`);

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        internalOrderId: orderId,
        razorpayKeyId: config.razorpay.keyId,
        isProduction: config.razorpay.isProduction
      };
    } catch (error: any) {
      console.error('Error creating recharge order:', error);
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      const detail = error?.description || error?.error?.description || error?.message || 'Unknown error';
      throw new Error(`Razorpay order failed: ${detail}`);
    }
  }

  /**
   * Verify payment and credit wallet
   */
  static async verifyAndCreditWallet(verificationData: {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    razorpaySignature: string;
  }, userId: string) {
    try {
      // Verify payment signature
      const isValid = this.verifyPaymentSignature(
        verificationData.razorpayOrderId,
        verificationData.razorpayPaymentId,
        verificationData.razorpaySignature
      );

      if (!isValid) {
        throw new ValidationError('Invalid payment signature');
      }

      // Get order details
      const orderQuery = `
        SELECT OrderID, WalletID, Amount, Status, RazorpayOrderID
        FROM WalletRechargeOrders
        WHERE RazorpayOrderID = @param0 AND UserID = @param1
      `;
      
      const orderResult = await dbService.executeQuery(orderQuery, [
        verificationData.razorpayOrderId,
        userId
      ]);

      if (!orderResult.recordset || orderResult.recordset.length === 0) {
        throw new NotFoundError('Recharge order not found');
      }

      const order = orderResult.recordset[0];

      if (order.Status === 'Paid') {
        throw new ValidationError('Order already processed');
      }

      // Get wallet
      const wallet = await this.getOrCreateWallet(userId);

      // Begin transaction - credit wallet
      const balanceBefore = wallet.Balance;
      const balanceAfter = balanceBefore + order.Amount;

      // Update wallet balance
      await dbService.executeQuery(
        `UPDATE Wallets 
         SET Balance = @param1, 
             UpdatedAt = GETUTCDATE(), 
             LastTransactionAt = GETUTCDATE() 
         WHERE WalletID = @param0`,
        [wallet.WalletID, balanceAfter]
      );

      // Create transaction record
      const transactionId = AuthService.generateUniqueId();
      await dbService.executeQuery(
        `INSERT INTO WalletTransactions (
          TransactionID, WalletID, TransactionType, Amount, 
          BalanceBefore, BalanceAfter, CurrencyID, Source, 
          PaymentReference, Description, Status
        ) VALUES (
          @param0, @param1, 'Credit', @param2, @param3, 
          @param4, @param5, 'Razorpay', @param6, @param7, 'Completed'
        )`,
        [
          transactionId,
          wallet.WalletID,
          order.Amount,
          balanceBefore,
          balanceAfter,
          wallet.CurrencyID,
          verificationData.razorpayPaymentId,
          `Wallet recharge - ₹${order.Amount}`
        ]
      );

      // Update order status
      await dbService.executeQuery(
        `UPDATE WalletRechargeOrders 
         SET Status = 'Paid', 
             RazorpayPaymentID = @param1, 
             RazorpaySignature = @param2, 
             PaidAt = GETUTCDATE() 
         WHERE OrderID = @param0`,
        [order.OrderID, verificationData.razorpayPaymentId, verificationData.razorpaySignature]
      );

      console.log(`Wallet credited: ?${order.Amount} for user ${userId}. New balance: ?${balanceAfter}`);

      return {
        success: true,
        transactionId,
        amount: order.Amount,
        balanceBefore,
        balanceAfter,
        paymentId: verificationData.razorpayPaymentId,
        message: `?${order.Amount} added to wallet successfully`
      };
    } catch (error: any) {
      console.error('Error verifying and crediting wallet:', error);
      
      // Log failed transaction attempt
      try {
        const errorTransId = AuthService.generateUniqueId();
        const wallet = await this.getOrCreateWallet(userId);
        
        await dbService.executeQuery(
          `INSERT INTO WalletTransactions (
            TransactionID, WalletID, TransactionType, Amount, 
            BalanceBefore, BalanceAfter, CurrencyID, Source, 
            PaymentReference, Description, Status
          ) VALUES (
            @param0, @param1, 'Credit', 0, @param2, @param2, 
            @param3, 'Razorpay', @param4, @param5, 'Failed'
          )`,
          [
            errorTransId,
            wallet.WalletID,
            wallet.Balance,
            wallet.CurrencyID,
            verificationData.razorpayPaymentId || null,
            error instanceof Error ? error.message : 'Payment verification failed'
          ]
        );
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
      const keySecret = config.razorpay.keySecret;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Error verifying payment signature:', error);
      return false;
    }
  }

  /**
   * Get wallet transaction history
   */
  static async getTransactionHistory(
    userId: string, 
    page: number = 1, 
    pageSize: number = 20,
    transactionType?: 'Credit' | 'Debit'
  ) {
    try {
      const wallet = await this.getOrCreateWallet(userId);
      const offset = (page - 1) * pageSize;

      let whereClause = 'WHERE wt.WalletID = @param0';
      const params: any[] = [wallet.WalletID];

      if (transactionType) {
        whereClause += ' AND wt.TransactionType = @param1';
        params.push(transactionType);
      }

      const query = `
        SELECT 
          wt.TransactionID,
          wt.TransactionType,
          wt.Amount,
          wt.BalanceBefore,
          wt.BalanceAfter,
          c.Code as CurrencyCode,
          c.Symbol as CurrencySymbol,
          wt.Source,
          wt.PaymentReference,
          wt.Description,
          wt.Status,
          wt.CreatedAt
        FROM WalletTransactions wt
        INNER JOIN Currencies c ON wt.CurrencyID = c.CurrencyID
        ${whereClause}
        ORDER BY wt.CreatedAt DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `;

      const countQuery = `
        SELECT COUNT(*) as Total 
        FROM WalletTransactions wt 
        ${whereClause}
      `;

      const result = await dbService.executeQuery(query, params);
      const countResult = await dbService.executeQuery(countQuery, params);
      
      const total = countResult.recordset[0]?.Total || 0;

      return {
        transactions: result.recordset || [],
        currentBalance: wallet.Balance,
        currencyCode: wallet.CurrencyCode,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }

  /**
   * Get recharge order history
   */
  static async getRechargeHistory(userId: string, page: number = 1, pageSize: number = 20) {
    try {
      const offset = (page - 1) * pageSize;

      const query = `
        SELECT 
          wro.OrderID,
          wro.Amount,
          c.Code as CurrencyCode,
          c.Symbol as CurrencySymbol,
          wro.Status,
          wro.PaymentGateway,
          wro.RazorpayOrderID,
          wro.RazorpayPaymentID,
          wro.Receipt,
          wro.CreatedAt,
          wro.PaidAt,
          wro.ExpiresAt,
          wro.ErrorMessage
        FROM WalletRechargeOrders wro
        INNER JOIN Currencies c ON wro.CurrencyID = c.CurrencyID
        WHERE wro.UserID = @param0
        ORDER BY wro.CreatedAt DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `;

      const countQuery = `
        SELECT COUNT(*) as Total 
        FROM WalletRechargeOrders 
        WHERE UserID = @param0
      `;

      const result = await dbService.executeQuery(query, [userId]);
      const countResult = await dbService.executeQuery(countQuery, [userId]);
      
      const total = countResult.recordset[0]?.Total || 0;

      return {
        orders: result.recordset || [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('Error getting recharge history:', error);
      throw error;
    }
  }

  /**
   * Debit wallet (for internal use - e.g., purchasing services)
   */
  static async debitWallet(
    userId: string, 
    amount: number, 
    source: string, 
    description: string
  ): Promise<WalletTransaction> {
    try {
      if (amount <= 0) {
        throw new ValidationError('Amount must be greater than 0');
      }

      const wallet = await this.getOrCreateWallet(userId);

      // Check sufficient balance
      if (wallet.Balance < amount) {
        throw new InsufficientBalanceError('Insufficient wallet balance');
      }

      const balanceBefore = wallet.Balance;
      const balanceAfter = balanceBefore - amount;

      // Update wallet balance
      await dbService.executeQuery(
        `UPDATE Wallets 
         SET Balance = @param1, 
             UpdatedAt = GETUTCDATE(), 
             LastTransactionAt = GETUTCDATE() 
         WHERE WalletID = @param0`,
        [wallet.WalletID, balanceAfter]
      );

      // Create transaction record
      const transactionId = AuthService.generateUniqueId();
      await dbService.executeQuery(
        `INSERT INTO WalletTransactions (
          TransactionID, WalletID, TransactionType, Amount, 
          BalanceBefore, BalanceAfter, CurrencyID, Source, 
          Description, Status
        ) VALUES (
          @param0, @param1, 'Debit', @param2, @param3, 
          @param4, @param5, @param6, @param7, 'Completed'
        )`,
        [
          transactionId,
          wallet.WalletID,
          amount,
          balanceBefore,
          balanceAfter,
          wallet.CurrencyID,
          source,
          description
        ]
      );

      console.log(`Wallet debited: ?${amount} for user ${userId}. New balance: ?${balanceAfter}`);

      return {
        TransactionID: transactionId,
        WalletID: wallet.WalletID,
        TransactionType: 'Debit',
        Amount: amount,
        BalanceBefore: balanceBefore,
        BalanceAfter: balanceAfter,
        CurrencyID: wallet.CurrencyID,
        Source: source,
        PaymentReference: null,
        Description: description,
        Status: 'Completed',
        CreatedAt: new Date()
      };
    } catch (error) {
      console.error('Error debiting wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet statistics
   */
  static async getWalletStats(userId: string) {
    try {
      const wallet = await this.getOrCreateWallet(userId);

      const statsQuery = `
        SELECT 
          COUNT(*) as TotalTransactions,
          SUM(CASE WHEN TransactionType = 'Credit' THEN Amount ELSE 0 END) as TotalCredits,
          SUM(CASE WHEN TransactionType = 'Debit' THEN Amount ELSE 0 END) as TotalDebits,
          MAX(CASE WHEN TransactionType = 'Credit' THEN CreatedAt END) as LastCreditAt,
          MAX(CASE WHEN TransactionType = 'Debit' THEN CreatedAt END) as LastDebitAt
        FROM WalletTransactions
        WHERE WalletID = @param0 AND Status = 'Completed'
      `;

      const result = await dbService.executeQuery(statsQuery, [wallet.WalletID]);
      const stats = result.recordset[0];

      return {
        walletId: wallet.WalletID,
        currentBalance: wallet.Balance,
        currencyCode: wallet.CurrencyCode,
        status: wallet.Status,
        totalTransactions: stats.TotalTransactions || 0,
        totalCredits: stats.TotalCredits || 0,
        totalDebits: stats.TotalDebits || 0,
        lastCreditAt: stats.LastCreditAt,
        lastDebitAt: stats.LastDebitAt,
        createdAt: wallet.CreatedAt
      };
    } catch (error) {
      console.error('Error getting wallet stats:', error);
      throw error;
    }
  }

  /**
   * ? NEW: Credit bonus to wallet (welcome bonus, referral bonus, etc.)
   * Used for automated bonuses during registration and referrals
   */
  static async creditBonus(
    userId: string,
    amount: number,
    source: 'NEW_USER_BONUS' | 'REFERRAL_BONUS' | 'ADMIN_BONUS',
    description: string
  ): Promise<{ success: boolean; transactionId: string; newBalance: number }> {
    try {
      console.log(`?? Crediting ${source} of ?${amount} to user ${userId}`);

      if (amount <= 0) {
        throw new ValidationError('Bonus amount must be greater than 0');
      }

      const wallet = await this.getOrCreateWallet(userId);
      const balanceBefore = wallet.Balance;
      const balanceAfter = balanceBefore + amount;

      // Update wallet balance
      await dbService.executeQuery(
        `UPDATE Wallets 
         SET Balance = @param1, 
             UpdatedAt = GETUTCDATE(), 
             LastTransactionAt = GETUTCDATE() 
         WHERE WalletID = @param0`,
        [wallet.WalletID, balanceAfter]
      );

      // Create transaction record
      const transactionId = AuthService.generateUniqueId();
      await dbService.executeQuery(
        `INSERT INTO WalletTransactions (
          TransactionID, WalletID, TransactionType, Amount, 
          BalanceBefore, BalanceAfter, CurrencyID, Source, 
          Description, Status, CreatedAt
        ) VALUES (
          @param0, @param1, 'Credit', @param2, @param3, 
          @param4, @param5, @param6, @param7, 'Completed', GETUTCDATE()
        )`,
        [
          transactionId,
          wallet.WalletID,
          amount,
          balanceBefore,
          balanceAfter,
          wallet.CurrencyID,
          source,
          description
        ]
      );

      console.log(`? Bonus credited: ?${amount} to user ${userId}. New balance: ?${balanceAfter}`);

      return {
        success: true,
        transactionId,
        newBalance: balanceAfter
      };
    } catch (error) {
      console.error('Error crediting bonus:', error);
      throw error;
    }
  }

  /**
   * ? NEW: Give welcome bonus to new user (₹100)
   * Called automatically during user registration
   */
  static async giveWelcomeBonus(userId: string): Promise<{ success: boolean; amount: number }> {
    try {
      const WELCOME_BONUS_AMOUNT = 100;

      // Check if bonus already given
      const checkQuery = `
        SELECT WalletBonusGiven 
        FROM Users 
        WHERE UserID = @param0
      `;
      const checkResult = await dbService.executeQuery(checkQuery, [userId]);

      if (checkResult.recordset[0]?.WalletBonusGiven) {
        console.log(`?? Welcome bonus already given to user ${userId}`);
        return { success: false, amount: 0 };
      }

      // Credit welcome bonus
      await this.creditBonus(
        userId,
        WELCOME_BONUS_AMOUNT,
        'NEW_USER_BONUS',
        `Welcome bonus credited to your wallet`
      );

      // Mark bonus as given
      await dbService.executeQuery(
        `UPDATE Users 
         SET WalletBonusGiven = 1, UpdatedAt = GETUTCDATE() 
         WHERE UserID = @param0`,
        [userId]
      );

      console.log(`?? Welcome bonus of ?${WELCOME_BONUS_AMOUNT} credited to user ${userId}`);

      return { success: true, amount: WELCOME_BONUS_AMOUNT };
    } catch (error) {
      console.error('Error giving welcome bonus:', error);
      throw error;
    }
  }

  /**
   * ? NEW: Give referral bonuses (₹50 to both referrer and referee)
   * Called when a new user registers with a referral code
   */
  static async giveReferralBonuses(
    newUserId: string,
    referrerId: string
  ): Promise<{ success: boolean; amount: number }> {
    try {
      const REFERRAL_BONUS_AMOUNT = 50;

      // Credit bonus to new user
      await this.creditBonus(
        newUserId,
        REFERRAL_BONUS_AMOUNT,
        'REFERRAL_BONUS',
        `Referral bonus for joining via referral`
      );

      // Credit bonus to referrer
      await this.creditBonus(
        referrerId,
        REFERRAL_BONUS_AMOUNT,
        'REFERRAL_BONUS',
        `Referral bonus for referring a new user`
      );

      console.log(`?? Referral bonuses credited: ?${REFERRAL_BONUS_AMOUNT} each to ${newUserId} and ${referrerId}`);

      return { success: true, amount: REFERRAL_BONUS_AMOUNT };
    } catch (error) {
      console.error('Error giving referral bonuses:', error);
      throw error;
    }
  }
}
