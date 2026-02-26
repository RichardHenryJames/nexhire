/**
 * Wallet Service
 * Handles wallet operations, recharge, transactions, and balance management
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { dbService } from './database.service';
import { AuthService } from './auth.service';
import { PricingService } from './pricing.service';
import { EmailService } from './emailService';
import { ValidationError, NotFoundError, InsufficientBalanceError } from '../utils/validation';
import { config } from '../config/appConfig';
import { PromoService } from './promo.service';

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
      // Try to get existing wallet first
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
      
      // Create new wallet — use try/catch for race condition (duplicate key)
      const walletId = AuthService.generateUniqueId();
      try {
        const createQuery = `
          INSERT INTO Wallets (WalletID, UserID, Balance, CurrencyID, Status)
          VALUES (@param0, @param1, 0.00, 4, 'Active');
        `;
        await dbService.executeQuery(createQuery, [walletId, userId]);
      } catch (insertError: any) {
        // If duplicate key error, wallet was created by another concurrent request — just fetch it
        if (insertError.number === 2601 || insertError.number === 2627) {
          console.log('Wallet already created by concurrent request, fetching existing wallet');
        } else {
          throw insertError;
        }
      }

      // Fetch and return the wallet (whether we just created it or it already existed)
      const fetchResult = await dbService.executeQuery(walletQuery, [userId]);
      if (!fetchResult.recordset || fetchResult.recordset.length === 0) {
        throw new Error('Failed to create or fetch wallet');
      }
      return fetchResult.recordset[0];
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
  static async createRechargeOrder(amount: number, userId: string, packId?: number | null, promoCode?: string | null) {
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
          Status, PaymentGateway, RazorpayOrderID, Receipt, ExpiresAt,
          PackID, PromoCode
        ) VALUES (
          @param0, @param1, @param2, @param3, @param4, 
          'Pending', 'Razorpay', @param5, @param6, @param7,
          @param8, @param9
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
        expiresAt,
        packId || null,
        promoCode?.trim().toUpperCase() || null
      ]);

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
        SELECT OrderID, WalletID, UserID, Amount, Status, RazorpayOrderID, PackID, PromoCode
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
      let balanceAfter = balanceBefore + order.Amount;

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

      // === AUTO-CREDIT BONUS (Pack + Promo) ===
      let totalBonus = 0;

      // 1. Bonus Pack — if user selected a pack, credit the bonus amount
      if (order.PackID) {
        const pack = await PromoService.findMatchingPack(order.Amount);
        if (pack && pack.BonusAmount > 0) {
          await WalletService.creditBonus(
            userId,
            pack.BonusAmount,
            'RECHARGE_BONUS',
            `Bonus Pack: ${pack.Name} — ₹${pack.BonusAmount} extra credit`
          );
          totalBonus += pack.BonusAmount;
        }
      }

      // 2. Promo Code — if user applied a promo code, validate and credit
      if (order.PromoCode) {
        const promoResult = await PromoService.validatePromoCode(order.PromoCode, userId, order.Amount);
        if (promoResult.valid && promoResult.bonusAmount && promoResult.bonusAmount > 0) {
          await WalletService.creditBonus(
            userId,
            promoResult.bonusAmount,
            'RECHARGE_BONUS',
            `Promo ${order.PromoCode}: ₹${promoResult.bonusAmount} extra credit`
          );
          await PromoService.applyPromoCode(order.PromoCode, userId, order.Amount, promoResult.bonusAmount);
          totalBonus += promoResult.bonusAmount;
        }
      }

      // Update bonus credited on the order record
      if (totalBonus > 0) {
        await dbService.executeQuery(
          `UPDATE WalletRechargeOrders SET BonusCredited = @param1 WHERE OrderID = @param0`,
          [order.OrderID, totalBonus]
        );
        // Re-fetch balance after bonus
        const updatedWallet = await this.getOrCreateWallet(userId);
        balanceAfter = updatedWallet.Balance;
      }

      return {
        success: true,
        transactionId,
        amount: order.Amount,
        bonusCredited: totalBonus,
        balanceBefore,
        balanceAfter,
        paymentId: verificationData.razorpayPaymentId,
        message: totalBonus > 0
          ? `₹${order.Amount} + ₹${totalBonus} bonus added to wallet!`
          : `₹${order.Amount} added to wallet successfully`
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
    source: 'NEW_USER_BONUS' | 'REFERRAL_BONUS' | 'ADMIN_BONUS' | 'REFERRAL_EARNINGS' | 'POINTS_CONVERSION' | 'RECHARGE_BONUS',
    description: string
  ): Promise<{ success: boolean; transactionId: string; newBalance: number }> {
    try {
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
   * Give welcome bonus to new user
   * Called automatically during user registration
   * Amount is fetched from PricingSettings table in database
   */
  static async giveWelcomeBonus(userId: string): Promise<{ success: boolean; amount: number }> {
    try {
      const WELCOME_BONUS_AMOUNT = await PricingService.getSetting('WELCOME_BONUS');

      // Skip if welcome bonus is disabled (set to 0)
      if (!WELCOME_BONUS_AMOUNT || WELCOME_BONUS_AMOUNT <= 0) {
        return { success: false, amount: 0 };
      }

      // Check if bonus already given
      const checkQuery = `
        SELECT WalletBonusGiven 
        FROM Users 
        WHERE UserID = @param0
      `;
      const checkResult = await dbService.executeQuery(checkQuery, [userId]);

      if (checkResult.recordset[0]?.WalletBonusGiven) {
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

      return { success: true, amount: WELCOME_BONUS_AMOUNT };
    } catch (error) {
      console.error('Error giving welcome bonus:', error);
      throw error;
    }
  }

  /**
   * Give referral bonuses to both referrer and referee
   * Called when a new user registers with a referral code
   */
  static async giveReferralBonuses(
    newUserId: string,
    referrerId: string
  ): Promise<{ success: boolean; amount: number }> {
    try {
      const REFERRAL_BONUS_AMOUNT = await PricingService.getSetting('REFERRAL_SIGNUP_BONUS');

      // Skip if referral bonus is disabled (set to 0)
      if (!REFERRAL_BONUS_AMOUNT || REFERRAL_BONUS_AMOUNT <= 0) {
        return { success: false, amount: 0 };
      }

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

      return { success: true, amount: REFERRAL_BONUS_AMOUNT };
    } catch (error) {
      console.error('Error giving referral bonuses:', error);
      throw error;
    }
  }

  /**
   * Get withdrawable balance (earnings minus bonuses and pending holds)
   * Bonuses (welcome, invite, referral bonus) are NOT withdrawable - only actual referral earnings
   */
  static async getWithdrawableBalance(userId: string): Promise<{
    withdrawableAmount: number;
    totalEarned: number;
    totalWithdrawn: number;
    canWithdraw: boolean;
    minimumWithdrawal: number;
    withdrawalFee: number;
  }> {
    try {
      const wallet = await this.getOrCreateWallet(userId);
      const withdrawalFee = 0; // No withdrawal fee
      
      // Only REFERRAL_EARNINGS are withdrawable — everything else is prepaid/bonus credit
      const earningsQuery = `
        SELECT COALESCE(SUM(Amount), 0) as TotalEarnings
        FROM WalletTransactions
        WHERE WalletID = @param0 
          AND TransactionType = 'Credit'
          AND Status = 'Completed'
          AND Source = 'REFERRAL_EARNINGS'
      `;
      const earningsResult = await dbService.executeQuery(earningsQuery, [wallet.WalletID]);
      const totalEarnings = earningsResult.recordset?.[0]?.TotalEarnings || 0;

      // Get total already withdrawn
      const withdrawnQuery = `
        SELECT COALESCE(SUM(Amount), 0) as TotalWithdrawn
        FROM WalletWithdrawals
        WHERE UserID = @param0 
          AND Status IN ('Completed', 'Pending', 'Processing')
      `;
      const withdrawnResult = await dbService.executeQuery(withdrawnQuery, [userId]);
      const totalWithdrawn = withdrawnResult.recordset?.[0]?.TotalWithdrawn || 0;
      
      // Withdrawable = referral earnings minus already withdrawn, capped at current balance
      const netEarnings = Math.max(0, totalEarnings - totalWithdrawn);
      const withdrawableAmount = Math.max(0, Math.min(netEarnings, wallet.Balance || 0));
      
      // Get total earned (all credits) for display
      const earnedQuery = `
        SELECT COALESCE(SUM(Amount), 0) as TotalEarned
        FROM WalletTransactions
        WHERE WalletID = @param0 
          AND TransactionType = 'Credit'
          AND Status = 'Completed'
      `;
      const earnedResult = await dbService.executeQuery(earnedQuery, [wallet.WalletID]);
      const totalEarned = earnedResult.recordset?.[0]?.TotalEarned || 0;

      const minimumWithdrawal = await PricingService.getMinimumWithdrawal(); // Dynamic from PricingSettings (₹200)
      const canWithdraw = withdrawableAmount >= minimumWithdrawal;

      return {
        withdrawableAmount,
        totalEarned,
        totalWithdrawn,
        canWithdraw,
        minimumWithdrawal,
        withdrawalFee
      };
    } catch (error) {
      console.error('Error getting withdrawable balance:', error);
      throw error;
    }
  }

  /**
   * Request withdrawal from wallet balance
   */
  static async requestWithdrawal(userId: string, amount: number, paymentDetails: {
    upiId?: string;
    bankAccount?: string;
    ifscCode?: string;
    accountHolderName?: string;
  }): Promise<{ success: boolean; withdrawalId: string; amount: number; processingFee: number; netAmount: number; message: string }> {
    try {
      const wallet = await this.getOrCreateWallet(userId);
      const withdrawable = await this.getWithdrawableBalance(userId);
      
      if (amount > wallet.Balance) {
        throw new ValidationError(`Insufficient wallet balance. Available: ₹${wallet.Balance}`);
      }

      if (amount > withdrawable.withdrawableAmount) {
        throw new ValidationError(`Maximum withdrawable amount is ₹${withdrawable.withdrawableAmount}. Only referral earnings can be withdrawn.`);
      }
      
      if (amount < withdrawable.minimumWithdrawal) {
        throw new ValidationError(`Minimum withdrawal amount is ₹${withdrawable.minimumWithdrawal}`);
      }

      // Calculate fee and net amount
      const processingFee = withdrawable.withdrawalFee;
      const netAmount = amount - processingFee;

      // Create withdrawal request
      const withdrawalId = AuthService.generateUniqueId();
      const insertQuery = `
        INSERT INTO WalletWithdrawals (
          WithdrawalID, WalletID, UserID, Amount, ProcessingFee, NetAmount, CurrencyID, 
          UPI_ID, BankAccountNumber, BankIFSC, BankAccountName,
          Status, RequestedAt
        ) VALUES (
          @param0, @param1, @param2, @param3, @param4, @param5, 4,
          @param6, @param7, @param8, @param9,
          'Pending', GETUTCDATE()
        )
      `;
      
      await dbService.executeQuery(insertQuery, [
        withdrawalId,
        wallet.WalletID,
        userId,
        amount,
        processingFee,
        netAmount,
        paymentDetails.upiId || null,
        paymentDetails.bankAccount || null,
        paymentDetails.ifscCode || null,
        paymentDetails.accountHolderName || null
      ]);

      // 🔧 IMMEDIATE WALLET DEDUCTION: Deduct the withdrawal amount from wallet balance
      const deductQuery = `
        UPDATE Wallets 
        SET Balance = Balance - @param0, 
            UpdatedAt = GETUTCDATE() 
        WHERE UserID = @param1 AND Balance >= @param0
      `;
      const deductResult = await dbService.executeQuery(deductQuery, [amount, userId]);
      
      if (deductResult.rowsAffected?.[0] !== 1) {
        // Rollback: Delete the withdrawal request if deduction failed
        await dbService.executeQuery(`DELETE FROM WalletWithdrawals WHERE WithdrawalID = @param0`, [withdrawalId]);
        throw new ValidationError('Failed to deduct from wallet. Please try again.');
      }

      // Get updated balance for transaction record
      const updatedWallet = await this.getOrCreateWallet(userId);
      const balanceAfter = updatedWallet.Balance;
      const balanceBefore = balanceAfter + amount; // Before deduction

      // Record the withdrawal transaction
      const transactionId = AuthService.generateUniqueId();
      await dbService.executeQuery(
        `INSERT INTO WalletTransactions (
          TransactionID, WalletID, TransactionType, Amount, 
          BalanceBefore, BalanceAfter, CurrencyID,
          Source, PaymentReference, Description, Status, CreatedAt
        ) VALUES (
          @param0, @param1, 'Debit', @param2, 
          @param3, @param4, @param5,
          'WITHDRAWAL', @param6, @param7, 'Completed', GETUTCDATE()
        )`,
        [
          transactionId,
          wallet.WalletID,
          amount,
          balanceBefore,
          balanceAfter,
          wallet.CurrencyID,
          withdrawalId,
          `Withdrawal request #${withdrawalId.slice(0, 8)}`
        ]
      );

      // Get user info for admin notification
      const userQuery = `SELECT FirstName, LastName, Email FROM Users WHERE UserID = @param0`;
      const userResult = await dbService.executeQuery(userQuery, [userId]);
      const user = userResult.recordset?.[0];

      // Send admin notification email (async, don't wait)
      if (user) {
        // Mask sensitive data for email (show first 3 and last 2 chars)
        const maskData = (data: string | undefined) => {
          if (!data || data.length < 6) return data || 'N/A';
          return `${data.slice(0, 3)}${'*'.repeat(Math.max(4, data.length - 5))}${data.slice(-2)}`;
        };
        
        const paymentMethod = paymentDetails.upiId 
          ? `UPI: ${maskData(paymentDetails.upiId)}` 
          : `Bank: ${maskData(paymentDetails.bankAccount)} (${paymentDetails.ifscCode || 'N/A'})`;
        
        EmailService.sendAdminNotification(
          '💸 New Withdrawal Request',
          `A withdrawal request has been submitted and needs your approval.

<strong>User:</strong> ${user.FirstName} ${user.LastName}
<strong>Email:</strong> ${user.Email}
<strong>Amount:</strong> ₹${amount}
<strong>Payment Method:</strong> ${paymentMethod}
<strong>Account Holder:</strong> ${paymentDetails.accountHolderName || 'N/A'}

<a href="https://refopen.com/admin/payments" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">Review in Admin Panel</a>`
        ).catch(err => console.error('Failed to send admin withdrawal notification:', err));
      }

      return {
        success: true,
        withdrawalId,
        amount,
        processingFee,
        netAmount,
        message: processingFee > 0 
          ? `Withdrawal request for ₹${amount} has been submitted. You will receive ₹${netAmount} after ₹${processingFee} processing fee.`
          : `Withdrawal request for ₹${amount} has been submitted successfully.`
      };
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      throw error;
    }
  }

  /**
   * Get user's withdrawal history
   */
  static async getWithdrawalHistory(userId: string, page: number = 1, pageSize: number = 20): Promise<{
    withdrawals: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const safePage = Math.max(1, Math.floor(page) || 1);
      const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize) || 20));
      const offset = (safePage - 1) * safePageSize;

      // Count total
      const countQuery = `
        SELECT COUNT(*) as Total
        FROM WalletWithdrawals
        WHERE UserID = @param0
      `;
      const countResult = await dbService.executeQuery(countQuery, [userId]);
      const total = countResult.recordset?.[0]?.Total || 0;
      const totalPages = Math.ceil(total / safePageSize);

      // Get withdrawals
      const dataQuery = `
        SELECT 
          WithdrawalID,
          Amount,
          ProcessingFee,
          NetAmount,
          UPI_ID as UpiId,
          BankAccountNumber,
          Status,
          RequestedAt,
          ProcessedAt,
          PaymentReference,
          RejectionReason
        FROM WalletWithdrawals
        WHERE UserID = @param0
        ORDER BY RequestedAt DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${safePageSize} ROWS ONLY
      `;
      const dataResult = await dbService.executeQuery(dataQuery, [userId]);

      return {
        withdrawals: dataResult.recordset || [],
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages
      };
    } catch (error) {
      console.error('Error getting withdrawal history:', error);
      throw error;
    }
  }

  // ===== ADMIN WITHDRAWAL METHODS =====

  /**
   * Get all withdrawal requests for admin (pending or all)
   */
  static async getAdminWithdrawals(status?: string, page: number = 1, pageSize: number = 50): Promise<{
    withdrawals: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const safePage = Math.max(1, Math.floor(page) || 1);
      const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 50));
      const offset = (safePage - 1) * safePageSize;

      let whereClause = '';
      const params: any[] = [];
      
      if (status) {
        whereClause = 'WHERE w.Status = @param0';
        params.push(status);
      }

      // Count total
      const countQuery = `
        SELECT COUNT(*) as Total
        FROM WalletWithdrawals w
        ${whereClause}
      `;
      const countResult = await dbService.executeQuery(countQuery, params);
      const total = countResult.recordset?.[0]?.Total || 0;
      const totalPages = Math.ceil(total / safePageSize);

      // Get withdrawals with user info
      const dataQuery = `
        SELECT 
          w.WithdrawalID,
          w.UserID,
          u.FirstName,
          u.LastName,
          u.Email,
          w.Amount,
          w.ProcessingFee,
          w.NetAmount,
          w.UPI_ID as UpiId,
          w.BankAccountNumber,
          w.BankIFSC,
          w.BankAccountName,
          w.Status,
          w.RequestedAt,
          w.ProcessedAt,
          w.PaymentReference,
          w.RejectionReason
        FROM WalletWithdrawals w
        INNER JOIN Users u ON w.UserID = u.UserID
        ${whereClause}
        ORDER BY w.RequestedAt DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${safePageSize} ROWS ONLY
      `;
      const dataResult = await dbService.executeQuery(dataQuery, params);

      return {
        withdrawals: dataResult.recordset || [],
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages
      };
    } catch (error) {
      console.error('Error getting admin withdrawals:', error);
      throw error;
    }
  }

  /**
   * Process a withdrawal (approve or reject)
   */
  static async processWithdrawal(withdrawalId: string, action: 'approve' | 'reject', adminId: string, paymentReference?: string, rejectionReason?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get withdrawal
      const getQuery = `
        SELECT w.*, u.Email, u.FirstName
        FROM WalletWithdrawals w
        INNER JOIN Users u ON w.UserID = u.UserID
        WHERE w.WithdrawalID = @param0
      `;
      const result = await dbService.executeQuery(getQuery, [withdrawalId]);
      
      if (!result.recordset?.length) {
        throw new ValidationError('Withdrawal request not found');
      }

      const withdrawal = result.recordset[0];

      if (withdrawal.Status !== 'Pending') {
        throw new ValidationError(`Cannot ${action} withdrawal with status '${withdrawal.Status}'`);
      }

      if (action === 'approve') {
        // Approve withdrawal - balance already deducted when request was placed
        const updateQuery = `
          UPDATE WalletWithdrawals 
          SET Status = 'Completed', 
              ProcessedAt = GETUTCDATE(), 
              PaymentReference = @param1,
              ProcessedBy = @param2
          WHERE WithdrawalID = @param0
        `;
        await dbService.executeQuery(updateQuery, [withdrawalId, paymentReference || 'Manual transfer', adminId]);

        // Note: Balance was already deducted when withdrawal was requested
        // No need to deduct again

        // Send success email to user
        EmailService.send({
          to: withdrawal.Email,
          subject: '✅ Withdrawal Approved - RefOpen',
          html: `Hi ${withdrawal.FirstName},<br><br>

Your withdrawal request has been approved and processed!<br><br>

<strong>Amount:</strong> ₹${withdrawal.Amount}<br>
<strong>Net Amount:</strong> ₹${withdrawal.NetAmount}<br>
<strong>Payment Reference:</strong> ${paymentReference || 'Manual transfer'}<br><br>

The funds should arrive in your account within 2-3 business days.<br><br>

Thank you for using RefOpen!`
        }).catch(err => console.error('Failed to send withdrawal approval email:', err));

        return { success: true, message: `Withdrawal of ₹${withdrawal.Amount} approved successfully` };

      } else {
        // Reject withdrawal - refund the amount back to wallet
        const updateQuery = `
          UPDATE WalletWithdrawals 
          SET Status = 'Rejected', 
              ProcessedAt = GETUTCDATE(), 
              RejectionReason = @param1,
              ProcessedBy = @param2
          WHERE WithdrawalID = @param0
        `;
        await dbService.executeQuery(updateQuery, [withdrawalId, rejectionReason || 'Request rejected by admin', adminId]);

        // Refund amount back to wallet since it was deducted when request was placed
        const refundQuery = `
          UPDATE Wallets 
          SET Balance = Balance + @param1, UpdatedAt = GETUTCDATE()
          WHERE WalletID = @param0
        `;
        await dbService.executeQuery(refundQuery, [withdrawal.WalletID, withdrawal.Amount]);

        // Get updated balance for transaction record
        const walletResult = await dbService.executeQuery(
          `SELECT Balance, CurrencyID FROM Wallets WHERE WalletID = @param0`,
          [withdrawal.WalletID]
        );
        const refundedWallet = walletResult.recordset?.[0];
        const balanceAfterRefund = refundedWallet?.Balance || 0;
        const balanceBeforeRefund = balanceAfterRefund - withdrawal.Amount;

        // Record refund transaction
        const refundTransactionId = AuthService.generateUniqueId();
        await dbService.executeQuery(
          `INSERT INTO WalletTransactions (
            TransactionID, WalletID, TransactionType, Amount, 
            BalanceBefore, BalanceAfter, CurrencyID,
            Source, PaymentReference, Description, Status, CreatedAt
          ) VALUES (
            @param0, @param1, 'Credit', @param2, 
            @param3, @param4, @param5,
            'REFUND', @param6, @param7, 'Completed', GETUTCDATE()
          )`,
          [
            refundTransactionId,
            withdrawal.WalletID,
            withdrawal.Amount,
            balanceBeforeRefund,
            balanceAfterRefund,
            refundedWallet?.CurrencyID || 4,
            withdrawalId,
            `Withdrawal rejected - refund #${withdrawalId.slice(0, 8)}`
          ]
        );

        // Send rejection email to user
        EmailService.send({
          to: withdrawal.Email,
          subject: '❌ Withdrawal Request Rejected - RefOpen',
          html: `Hi ${withdrawal.FirstName},<br><br>

Your withdrawal request has been rejected.<br><br>

<strong>Amount:</strong> ₹${withdrawal.Amount}<br>
<strong>Reason:</strong> ${rejectionReason || 'Request rejected by admin'}<br><br>

The amount has been refunded to your RefOpen wallet.<br><br>

If you have questions, please contact support.`
        }).catch(err => console.error('Failed to send withdrawal rejection email:', err));

        return { success: true, message: `Withdrawal rejected and ₹${withdrawal.Amount} refunded to wallet` };
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      throw error;
    }
  }

  // ===== WALLET HOLDS (Phase 1: Hold-based payment for referrals) =====

  /**
   * Hold Interface
   */
  

  /**
   * Get total active holds for a wallet
   */
  static async getActiveHoldsTotal(userId: string): Promise<number> {
    try {
      const wallet = await this.getOrCreateWallet(userId);
      
      const query = `
        SELECT COALESCE(SUM(Amount), 0) as TotalHolds
        FROM WalletHolds
        WHERE WalletID = @param0 AND Status = 'Active'
      `;
      
      const result = await dbService.executeQuery(query, [wallet.WalletID]);
      return result.recordset?.[0]?.TotalHolds || 0;
    } catch (error) {
      console.error('Error getting active holds total:', error);
      return 0;
    }
  }

  /**
   * Get available balance (balance minus active holds)
   * This is the actual amount user can spend
   */
  static async getAvailableBalance(userId: string): Promise<{
    balance: number;
    availableBalance: number;
    holdAmount: number;
    currencyCode: string;
  }> {
    try {
      const wallet = await this.getOrCreateWallet(userId);
      const holdAmount = await this.getActiveHoldsTotal(userId);
      const availableBalance = Math.max(0, wallet.Balance - holdAmount);
      
      return {
        balance: wallet.Balance,
        availableBalance,
        holdAmount,
        currencyCode: wallet.CurrencyCode
      };
    } catch (error) {
      console.error('Error getting available balance:', error);
      throw error;
    }
  }

  /**
   * Create a hold on wallet funds for a referral request
   * Funds are reserved but not deducted yet
   */
  static async createHold(
    userId: string,
    amount: number,
    referralRequestId: string,
    description: string
  ): Promise<{
    HoldID: string;
    Amount: number;
    AvailableBalanceAfter: number;
  }> {
    try {
      if (amount <= 0) {
        throw new ValidationError('Hold amount must be greater than 0');
      }

      const wallet = await this.getOrCreateWallet(userId);
      const { availableBalance } = await this.getAvailableBalance(userId);

      // Check if sufficient available balance (after existing holds)
      if (availableBalance < amount) {
        throw new InsufficientBalanceError('Insufficient available balance for hold');
      }

      // Check if hold already exists for this referral request
      const existingHoldQuery = `
        SELECT HoldID FROM WalletHolds 
        WHERE ReferralRequestID = @param0 AND Status = 'Active'
      `;
      const existingResult = await dbService.executeQuery(existingHoldQuery, [referralRequestId]);
      
      if (existingResult.recordset?.length) {
        throw new ValidationError('A hold already exists for this referral request');
      }

      // Create the hold
      const holdId = AuthService.generateUniqueId();
      const insertQuery = `
        INSERT INTO WalletHolds (
          HoldID, WalletID, UserID, ReferralRequestID, 
          Amount, Status, Description, CreatedAt
        ) VALUES (
          @param0, @param1, @param2, @param3, 
          @param4, 'Active', @param5, GETUTCDATE()
        )
      `;

      await dbService.executeQuery(insertQuery, [
        holdId,
        wallet.WalletID,
        userId,
        referralRequestId,
        amount,
        description
      ]);

      const newAvailableBalance = availableBalance - amount;

      console.log(`Wallet hold created: ₹${amount} held for user ${userId}. Available balance: ₹${newAvailableBalance}`);

      return {
        HoldID: holdId,
        Amount: amount,
        AvailableBalanceAfter: newAvailableBalance
      };
    } catch (error) {
      console.error('Error creating wallet hold:', error);
      throw error;
    }
  }

  /**
   * Convert a hold to an actual debit (when referrer completes referral)
   * This is called when referral is successfully submitted by referrer
   */
  static async convertHoldToDebit(referralRequestId: string): Promise<WalletTransaction> {
    try {
      // Find the active hold for this referral request
      const holdQuery = `
        SELECT h.HoldID, h.WalletID, h.UserID, h.Amount, h.Description, w.Balance, w.CurrencyID
        FROM WalletHolds h
        INNER JOIN Wallets w ON h.WalletID = w.WalletID
        WHERE h.ReferralRequestID = @param0 AND h.Status = 'Active'
      `;
      
      const holdResult = await dbService.executeQuery(holdQuery, [referralRequestId]);
      
      if (!holdResult.recordset?.length) {
        throw new NotFoundError('No active hold found for this referral request');
      }

      const hold = holdResult.recordset[0];
      const balanceBefore = hold.Balance;
      const balanceAfter = balanceBefore - hold.Amount;

      // Ensure balance doesn't go negative (shouldn't happen if holds are managed correctly)
      if (balanceAfter < 0) {
        throw new ValidationError('Insufficient wallet balance to convert hold');
      }

      // Update wallet balance (actual deduction)
      await dbService.executeQuery(
        `UPDATE Wallets 
         SET Balance = @param1, 
             UpdatedAt = GETUTCDATE(), 
             LastTransactionAt = GETUTCDATE() 
         WHERE WalletID = @param0`,
        [hold.WalletID, balanceAfter]
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
          @param4, @param5, 'Referral_Request', @param6, 'Completed'
        )`,
        [
          transactionId,
          hold.WalletID,
          hold.Amount,
          balanceBefore,
          balanceAfter,
          hold.CurrencyID,
          hold.Description || 'Referral request completed'
        ]
      );

      // Mark hold as converted
      await dbService.executeQuery(
        `UPDATE WalletHolds 
         SET Status = 'Converted', ConvertedAt = GETUTCDATE() 
         WHERE HoldID = @param0`,
        [hold.HoldID]
      );

      console.log(`Hold converted to debit: ₹${hold.Amount} for user ${hold.UserID}. New balance: ₹${balanceAfter}`);

      return {
        TransactionID: transactionId,
        WalletID: hold.WalletID,
        TransactionType: 'Debit',
        Amount: hold.Amount,
        BalanceBefore: balanceBefore,
        BalanceAfter: balanceAfter,
        CurrencyID: hold.CurrencyID,
        Source: 'Referral_Request',
        PaymentReference: null,
        Description: hold.Description,
        Status: 'Completed',
        CreatedAt: new Date()
      };
    } catch (error) {
      console.error('Error converting hold to debit:', error);
      throw error;
    }
  }

  /**
   * Release a hold (when referral expires or is cancelled)
   * Funds become available again without any deduction
   */
  static async releaseHold(referralRequestId: string): Promise<{ released: boolean; amount: number }> {
    try {
      // Find the active hold for this referral request
      const holdQuery = `
        SELECT h.HoldID, h.Amount, h.UserID, h.WalletID
        FROM WalletHolds h
        WHERE h.ReferralRequestID = @param0 AND h.Status = 'Active'
      `;
      
      const holdResult = await dbService.executeQuery(holdQuery, [referralRequestId]);
      
      if (!holdResult.recordset?.length) {
        console.log(`No active hold found to release for referral ${referralRequestId}`);
        return { released: false, amount: 0 };
      }

      const hold = holdResult.recordset[0];

      // Mark hold as released
      await dbService.executeQuery(
        `UPDATE WalletHolds 
         SET Status = 'Released', ReleasedAt = GETUTCDATE() 
         WHERE HoldID = @param0`,
        [hold.HoldID]
      );

      // Record a hold-released transaction for user visibility
      try {
        const walletResult = await dbService.executeQuery(
          `SELECT Balance FROM Wallets WHERE WalletID = @param0`,
          [hold.WalletID]
        );
        const currentBalance = walletResult.recordset?.[0]?.Balance || 0;
        const transactionId = AuthService.generateUniqueId();
        await dbService.executeQuery(
          `INSERT INTO WalletTransactions (
            TransactionID, WalletID, TransactionType, Amount, BalanceBefore, BalanceAfter,
            CurrencyID, Source, Description, Status, CreatedAt
          ) VALUES (
            @param0, @param1, 'Credit', @param2, @param3, @param3,
            1, 'HOLD_RELEASED', @param4, 'Completed', GETUTCDATE()
          )`,
          [transactionId, hold.WalletID, hold.Amount, currentBalance,
           `Hold of \u20b9${hold.Amount} released — free cancellation (within grace period)`]
        );
      } catch (txErr: any) {
        console.warn('Non-critical: Failed to record hold-released transaction:', txErr?.message);
      }

      console.log(`Hold released: ₹${hold.Amount} for user ${hold.UserID}`);

      return { released: true, amount: hold.Amount };
    } catch (error) {
      console.error('Error releasing hold:', error);
      throw error;
    }
  }

  /**
   * Release a hold with a deduction (for user-initiated cancellation)
   * Deducts a platform fee and releases the remaining amount
   */
  static async releaseHoldWithDeduction(referralRequestId: string, deductionAmount: number): Promise<{ 
    released: boolean; 
    amountReleased: number; 
    feeDeducted: number;
  }> {
    try {
      // Find the active hold for this referral request
      const holdQuery = `
        SELECT h.HoldID, h.Amount, h.UserID, h.WalletID
        FROM WalletHolds h
        WHERE h.ReferralRequestID = @param0 AND h.Status = 'Active'
      `;
      
      const holdResult = await dbService.executeQuery(holdQuery, [referralRequestId]);
      
      if (!holdResult.recordset?.length) {
        console.log(`No active hold found to release for referral ${referralRequestId}`);
        return { released: false, amountReleased: 0, feeDeducted: 0 };
      }

      const hold = holdResult.recordset[0];
      const holdAmount = hold.Amount;
      const actualDeduction = Math.min(deductionAmount, holdAmount); // Can't deduct more than held
      const amountToRelease = holdAmount - actualDeduction;

      // Mark hold as released
      await dbService.executeQuery(
        `UPDATE WalletHolds 
         SET Status = 'Released', ReleasedAt = GETUTCDATE() 
         WHERE HoldID = @param0`,
        [hold.HoldID]
      );

      // Get current balance
      const walletQuery = `SELECT Balance FROM Wallets WHERE WalletID = @param0`;
      const walletResult = await dbService.executeQuery(walletQuery, [hold.WalletID]);
      const currentBalance = walletResult.recordset?.[0]?.Balance || 0;

      // Deduct the cancellation fee from wallet balance
      if (actualDeduction > 0) {
        const newBalance = currentBalance - actualDeduction;
        
        // Update wallet balance
        await dbService.executeQuery(
          `UPDATE Wallets SET Balance = @param1, UpdatedAt = GETUTCDATE() WHERE WalletID = @param0`,
          [hold.WalletID, newBalance]
        );
        
        // Record the debit transaction for the fee
        const feeTransactionId = AuthService.generateUniqueId();
        await dbService.executeQuery(
          `INSERT INTO WalletTransactions (
            TransactionID, WalletID, TransactionType, Amount, BalanceBefore, BalanceAfter, 
            CurrencyID, Source, Description, Status, CreatedAt
          ) VALUES (
            @param0, @param1, 'Debit', @param2, @param3, @param4,
            1, 'CANCELLATION_FEE', @param5, 'Completed', GETUTCDATE()
          )`,
          [feeTransactionId, hold.WalletID, actualDeduction, currentBalance, newBalance,
           `Cancellation fee (\u20b9${actualDeduction}) for withdrawing referral request`]
        );

        // Record a hold-released credit entry for the refunded portion
        if (amountToRelease > 0) {
          const releaseTransactionId = AuthService.generateUniqueId();
          await dbService.executeQuery(
            `INSERT INTO WalletTransactions (
              TransactionID, WalletID, TransactionType, Amount, BalanceBefore, BalanceAfter,
              CurrencyID, Source, Description, Status, CreatedAt
            ) VALUES (
              @param0, @param1, 'Credit', @param2, @param3, @param3,
              1, 'HOLD_RELEASED', @param4, 'Completed', GETUTCDATE()
            )`,
            [releaseTransactionId, hold.WalletID, amountToRelease, newBalance,
             `Hold of \u20b9${holdAmount} released — \u20b9${amountToRelease} refunded after \u20b9${actualDeduction} cancellation fee`]
          );
        }
        
        console.log(`Hold released with deduction: ₹${amountToRelease} released, ₹${actualDeduction} fee deducted for user ${hold.UserID}`);
      } else {
        // No fee — just record hold release
        const transactionId = AuthService.generateUniqueId();
        await dbService.executeQuery(
          `INSERT INTO WalletTransactions (
            TransactionID, WalletID, TransactionType, Amount, BalanceBefore, BalanceAfter,
            CurrencyID, Source, Description, Status, CreatedAt
          ) VALUES (
            @param0, @param1, 'Credit', @param2, @param3, @param3,
            1, 'HOLD_RELEASED', @param4, 'Completed', GETUTCDATE()
          )`,
          [transactionId, hold.WalletID, holdAmount, currentBalance,
           `Hold of \u20b9${holdAmount} released — free cancellation (within grace period)`]
        );
        console.log(`Hold released (no fee): ₹${holdAmount} for user ${hold.UserID}`);
      }

      return { 
        released: true, 
        amountReleased: amountToRelease, 
        feeDeducted: actualDeduction 
      };
    } catch (error) {
      console.error('Error releasing hold with deduction:', error);
      throw error;
    }
  }

  /**
   * Get all holds for a user (for display purposes)
   */
  static async getUserHolds(userId: string, status?: 'Active' | 'Converted' | 'Released'): Promise<any[]> {
    try {
      const wallet = await this.getOrCreateWallet(userId);
      
      let whereClause = 'WHERE h.WalletID = @param0';
      const params: any[] = [wallet.WalletID];
      
      if (status) {
        whereClause += ' AND h.Status = @param1';
        params.push(status);
      }

      const query = `
        SELECT 
          h.HoldID,
          h.ReferralRequestID,
          h.Amount,
          h.Status,
          h.Description,
          h.CreatedAt,
          h.ConvertedAt,
          h.ReleasedAt,
          rr.JobTitle,
          rr.OpenToAnyCompany,
          CASE WHEN rr.OpenToAnyCompany = 1 THEN 'Any Company' ELSE COALESCE(o.Name, 'Unknown Company') END as CompanyName
        FROM WalletHolds h
        LEFT JOIN ReferralRequests rr ON h.ReferralRequestID = rr.RequestID
        LEFT JOIN Organizations o ON rr.OrganizationID = o.OrganizationID
        ${whereClause}
        ORDER BY h.CreatedAt DESC
      `;

      const result = await dbService.executeQuery(query, params);
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting user holds:', error);
      return [];
    }
  }

  /**
   * Get hold by referral request ID
   */
  static async getHoldByRequestId(referralRequestId: string): Promise<any | null> {
    try {
      const query = `
        SELECT 
          HoldID, WalletID, UserID, ReferralRequestID,
          Amount, Status, Description, CreatedAt, ConvertedAt, ReleasedAt
        FROM WalletHolds
        WHERE ReferralRequestID = @param0
      `;
      
      const result = await dbService.executeQuery(query, [referralRequestId]);
      return result.recordset?.[0] || null;
    } catch (error) {
      console.error('Error getting hold by request ID:', error);
      return null;
    }
  }
}

