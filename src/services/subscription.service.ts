/**
 * Subscription Service
 * Handles RefOpen Pro subscription management
 * 
 * Plans:
 *  - free: Default, pay-per-use
 *  - pro: ₹149/month or ₹799/6 months
 *    - 3 referrals/month included (any tier)
 *    - All AI tools unlimited (Resume Analyzer, Blind Review, LinkedIn Optimizer)
 *    - AI Job Recommendations (always on)
 *    - Resume Builder all templates
 *    - Open-to-Any at ₹199 (vs ₹449)
 */

import { dbService } from './database.service';

export class SubscriptionService {

  /**
   * Get subscription status for a user
   */
  static async getStatus(userId: string): Promise<{
    tier: string;
    isPro: boolean;
    expiresAt: string | null;
    startedAt: string | null;
    referralsUsed: number;
    referralsIncluded: number;
    referralsRemaining: number;
    daysRemaining: number;
  }> {
    const result = await dbService.executeQuery(
      `SELECT SubscriptionTier, SubscriptionExpiresAt, SubscriptionStartedAt, 
              MonthlyReferralsUsed, MonthlyReferralsResetAt
       FROM Users WHERE UserID = @param0`,
      [userId]
    );
    const user = result.recordset[0];
    if (!user) throw new Error('User not found');

    // Get Pro config
    const config = await this.getProConfig();

    // Check if subscription is active
    const now = new Date();
    const isExpired = user.SubscriptionExpiresAt && new Date(user.SubscriptionExpiresAt) <= now;
    const isPro = user.SubscriptionTier === 'pro' && !isExpired;

    // Auto-reset monthly referrals if needed
    let referralsUsed = user.MonthlyReferralsUsed || 0;
    if (isPro && user.MonthlyReferralsResetAt) {
      const resetAt = new Date(user.MonthlyReferralsResetAt);
      if (now >= resetAt) {
        // Reset monthly counter
        const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await dbService.executeQuery(
          `UPDATE Users SET MonthlyReferralsUsed = 0, MonthlyReferralsResetAt = @param1 WHERE UserID = @param0`,
          [userId, nextReset]
        );
        referralsUsed = 0;
      }
    }

    // If expired, downgrade to free
    if (isExpired && user.SubscriptionTier === 'pro') {
      await dbService.executeQuery(
        `UPDATE Users SET SubscriptionTier = 'free' WHERE UserID = @param0`,
        [userId]
      );
    }

    const daysRemaining = isPro && user.SubscriptionExpiresAt
      ? Math.max(0, Math.ceil((new Date(user.SubscriptionExpiresAt).getTime() - now.getTime()) / 86400000))
      : 0;

    return {
      tier: isPro ? 'pro' : 'free',
      isPro,
      expiresAt: isPro ? user.SubscriptionExpiresAt : null,
      startedAt: user.SubscriptionStartedAt || null,
      referralsUsed: isPro ? referralsUsed : 0,
      referralsIncluded: isPro ? config.monthlyReferrals : 0,
      referralsRemaining: isPro ? Math.max(0, config.monthlyReferrals - referralsUsed) : 0,
      daysRemaining,
    };
  }

  /**
   * Subscribe a user to Pro (deducts from wallet)
   */
  static async subscribe(userId: string, plan: 'monthly' | 'semi_annual'): Promise<{
    success: boolean;
    tier: string;
    expiresAt: string;
    amountCharged: number;
    message: string;
  }> {
    const config = await this.getProConfig();
    const price = plan === 'monthly' ? config.monthlyPrice : config.semiAnnualPrice;
    const durationDays = plan === 'monthly' ? 30 : 180;

    // Check current status
    const status = await this.getStatus(userId);
    
    // Check wallet balance
    const walletResult = await dbService.executeQuery(
      `SELECT WalletID, Balance, CurrencyID FROM Wallets WHERE UserID = @param0`,
      [userId]
    );
    const wallet = walletResult.recordset[0];
    if (!wallet) throw Object.assign(new Error('Wallet not found. Please contact support.'), { name: 'NotFoundError' });
    if (wallet.Balance < price) {
      throw Object.assign(new Error(`Insufficient balance. Need ₹${price}, have ₹${wallet.Balance.toFixed(2)}`), { 
        name: 'InsufficientBalanceError',
        data: { currentBalance: wallet.Balance, requiredAmount: price }
      });
    }

    // Calculate expiry — extend if already Pro
    const now = new Date();
    let expiresAt: Date;
    if (status.isPro && status.expiresAt) {
      // Extend from current expiry
      expiresAt = new Date(new Date(status.expiresAt).getTime() + durationDays * 86400000);
    } else {
      expiresAt = new Date(now.getTime() + durationDays * 86400000);
    }

    // Monthly referrals reset date (1st of next month)
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // All-or-nothing: use a SQL transaction
    const transaction = await dbService.beginTransaction();
    try {
      // Re-check balance inside transaction (prevent race condition)
      const freshWallet = await dbService.executeTransactionQuery(
        transaction,
        `SELECT Balance FROM Wallets WITH (UPDLOCK) WHERE WalletID = @param0`,
        [wallet.WalletID]
      );
      if (!freshWallet.recordset[0] || freshWallet.recordset[0].Balance < price) {
        await transaction.rollback();
        throw Object.assign(new Error(`Insufficient balance. Need ₹${price}, have ₹${freshWallet.recordset[0]?.Balance?.toFixed(2) || 0}`), {
          name: 'InsufficientBalanceError',
          data: { currentBalance: freshWallet.recordset[0]?.Balance || 0, requiredAmount: price }
        });
      }
      const currentBalance = freshWallet.recordset[0].Balance;

      // Deduct from wallet
      await dbService.executeTransactionQuery(
        transaction,
        `UPDATE Wallets SET Balance = Balance - @param1 WHERE WalletID = @param0`,
        [wallet.WalletID, price]
      );

      // Record transaction (include CurrencyID)
      const { AuthService } = await import('./auth.service');
      const txnId = AuthService.generateUniqueId();
      await dbService.executeTransactionQuery(
        transaction,
        `INSERT INTO WalletTransactions (TransactionID, WalletID, TransactionType, Amount, BalanceBefore, BalanceAfter, CurrencyID, Source, Description, Status)
         VALUES (@param0, @param1, 'Debit', @param2, @param3, @param4, @param5, 'PRO_SUBSCRIPTION', @param6, 'Completed')`,
        [txnId, wallet.WalletID, price, currentBalance, currentBalance - price, wallet.CurrencyID || 4,
         `RefOpen Pro ${plan === 'monthly' ? '1 month' : '6 months'} subscription`]
      );

      // Update user subscription
      await dbService.executeTransactionQuery(
        transaction,
        `UPDATE Users SET 
          SubscriptionTier = 'pro',
          SubscriptionStartedAt = CASE WHEN SubscriptionTier != 'pro' THEN GETUTCDATE() ELSE SubscriptionStartedAt END,
          SubscriptionExpiresAt = @param1,
          MonthlyReferralsUsed = CASE WHEN SubscriptionTier != 'pro' THEN 0 ELSE MonthlyReferralsUsed END,
          MonthlyReferralsResetAt = CASE WHEN MonthlyReferralsResetAt IS NULL OR SubscriptionTier != 'pro' THEN @param2 ELSE MonthlyReferralsResetAt END
         WHERE UserID = @param0`,
        [userId, expiresAt, nextReset]
      );

      await transaction.commit();

      return {
        success: true,
        tier: 'pro',
        expiresAt: expiresAt.toISOString(),
        amountCharged: price,
        message: `Welcome to RefOpen Pro! Your subscription is active until ${expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      };
    } catch (err) {
      try { await transaction.rollback(); } catch (_) { /* already rolled back */ }
      throw err;
    }
  }

  /**
   * Use a Pro referral credit (returns true if credit was available and used)
   */
  static async useReferralCredit(userId: string): Promise<boolean> {
    const config = await this.getProConfig();

    // First: reset monthly credits if reset date has passed (lazy reset)
    await dbService.executeQuery(
      `UPDATE Users SET MonthlyReferralsUsed = 0, 
             MonthlyReferralsResetAt = DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1))
       WHERE UserID = @param0 
         AND SubscriptionTier = 'pro'
         AND MonthlyReferralsResetAt IS NOT NULL 
         AND MonthlyReferralsResetAt <= GETUTCDATE()`,
      [userId]
    );

    // Atomic: only increment if under limit and still Pro
    const result = await dbService.executeQuery(
      `UPDATE Users SET MonthlyReferralsUsed = MonthlyReferralsUsed + 1 
       WHERE UserID = @param0 
         AND SubscriptionTier = 'pro' 
         AND SubscriptionExpiresAt > GETUTCDATE()
         AND MonthlyReferralsUsed < @param1`,
      [userId, config.monthlyReferrals]
    );
    return (result.rowsAffected?.[0] || 0) > 0;
  }

  /**
   * Check if user has unlimited access to a tool (Pro users do)
   */
  static async hasUnlimitedToolAccess(userId: string): Promise<boolean> {
    const result = await dbService.executeQuery(
      `SELECT SubscriptionTier, SubscriptionExpiresAt FROM Users WHERE UserID = @param0`,
      [userId]
    );
    const user = result.recordset[0];
    if (!user) return false;
    return user.SubscriptionTier === 'pro' && 
           user.SubscriptionExpiresAt && 
           new Date(user.SubscriptionExpiresAt) > new Date();
  }

  /**
   * Get the referral cost for a Pro user (with OTA discount)
   * Returns null if user should use normal pricing
   */
  static async getProReferralCost(userId: string, isOpenToAny: boolean): Promise<{ useCredit: boolean; cost: number } | null> {
    const status = await this.getStatus(userId);
    if (!status.isPro) return null;

    // If user has remaining credits, use credit (cost = 0)
    if (!isOpenToAny && status.referralsRemaining > 0) {
      return { useCredit: true, cost: 0 };
    }

    // For Open-to-Any, give Pro discount
    if (isOpenToAny) {
      const config = await this.getProConfig();
      return { useCredit: false, cost: config.otaDiscountPrice };
    }

    // No credits remaining, pay normal price
    return null;
  }

  /**
   * Get Pro configuration from DB
   */
  static async getProConfig(): Promise<{
    monthlyPrice: number;
    semiAnnualPrice: number;
    monthlyReferrals: number;
    otaDiscountPrice: number;
  }> {
    const result = await dbService.executeQuery(
      `SELECT SettingKey, SettingValue FROM PricingSettings WHERE SettingKey LIKE 'PRO_%' AND IsActive = 1`,
      []
    );
    const config: any = {};
    for (const row of result.recordset) {
      switch (row.SettingKey) {
        case 'PRO_MONTHLY_PRICE': config.monthlyPrice = row.SettingValue; break;
        case 'PRO_SEMI_ANNUAL_PRICE': config.semiAnnualPrice = row.SettingValue; break;
        case 'PRO_MONTHLY_REFERRALS': config.monthlyReferrals = row.SettingValue; break;
        case 'PRO_OTA_DISCOUNT_PRICE': config.otaDiscountPrice = row.SettingValue; break;
      }
    }
    return {
      monthlyPrice: config.monthlyPrice || 149,
      semiAnnualPrice: config.semiAnnualPrice || 799,
      monthlyReferrals: config.monthlyReferrals || 3,
      otaDiscountPrice: config.otaDiscountPrice || 199,
    };
  }
}
