/**
 * Manual Payment Service
 * Handles manual bank/UPI payment submissions while Razorpay verification is pending
 */

import { dbService } from './database.service';
import { v4 as uuidv4 } from 'uuid';

export interface ManualPaymentSubmission {
  submissionId?: string;
  userId: string;
  walletId?: string;
  amount: number;
  paymentMethod: 'UPI' | 'Bank Transfer' | 'NEFT' | 'IMPS' | 'RTGS';
  referenceNumber: string;
  paymentDate: string;
  proofImageURL?: string;
  userRemarks?: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
  adminRemarks?: string;
}

export interface PaymentSettings {
  upiId: string;
  upiName: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranch: string | null;
  minAmount: number;
  maxAmount: number;
  processingTime: string;
  supportEmail: string;
  supportPhone: string;
}

/**
 * Get payment settings (bank/UPI details)
 */
export const getPaymentSettings = async (): Promise<PaymentSettings> => {
  try {
    const result = await dbService.executeQuery(`
      SELECT SettingKey, SettingValue 
      FROM PaymentSettings 
      WHERE IsActive = 1
    `);

    const settings: any = {};
    for (const row of result.recordset) {
      settings[row.SettingKey] = row.SettingValue;
    }

    return {
      upiId: settings['UPI_ID'] || '',
      upiName: settings['UPI_NAME'] || '',
      bankName: settings['BANK_NAME'] || '',
      bankAccountName: settings['BANK_ACCOUNT_NAME'] || '',
      bankAccountNumber: settings['BANK_ACCOUNT_NUMBER'] || '',
      bankIfsc: settings['BANK_IFSC'] || '',
      bankBranch: settings['BANK_BRANCH'] || null,
      minAmount: parseFloat(settings['MIN_AMOUNT']) || 100,
      maxAmount: parseFloat(settings['MAX_AMOUNT']) || 50000,
      processingTime: settings['PROCESSING_TIME'] || '1 business day',
      supportEmail: settings['SUPPORT_EMAIL'] || '',
      supportPhone: settings['SUPPORT_PHONE'] || ''
    };
  } catch (error: any) {
    console.error('Error fetching payment settings:', error);
    // Return defaults with actual bank details
    return {
      upiId: '',
      upiName: '',
      bankName: 'IDBI Bank',
      bankAccountName: 'Media Urbana',
      bankAccountNumber: '0065102000045359',
      bankIfsc: 'IBKL0000065',
      bankBranch: null,
      minAmount: 100,
      maxAmount: 50000,
      processingTime: '1 business day',
      supportEmail: 'support@refopen.com',
      supportPhone: ''
    };
  }
};

/**
 * Submit a manual payment proof
 */
export const submitManualPayment = async (
  userId: string,
  data: ManualPaymentSubmission
): Promise<{ success: boolean; message: string; submissionId?: string }> => {
  try {
    // Validate amount
    const settings = await getPaymentSettings();
    if (data.amount < settings.minAmount) {
      return { success: false, message: `Minimum amount is ₹${settings.minAmount}` };
    }
    if (data.amount > settings.maxAmount) {
      return { success: false, message: `Maximum amount is ₹${settings.maxAmount}` };
    }

    // Check for duplicate reference number
    const existingCheck = await dbService.executeQuery(`
      SELECT SubmissionID FROM ManualPaymentSubmissions 
      WHERE ReferenceNumber = @param0
    `, [data.referenceNumber]);

    if (existingCheck.recordset && existingCheck.recordset.length > 0) {
      return { success: false, message: 'This reference number has already been submitted. Please check your submissions.' };
    }

    // Get user's wallet ID
    let walletId = data.walletId;
    if (!walletId) {
      const walletResult = await dbService.executeQuery(`
        SELECT WalletID FROM Wallets WHERE UserID = @param0
      `, [userId]);
      walletId = walletResult.recordset?.[0]?.WalletID || null;
    }

    const submissionId = uuidv4();

    await dbService.executeQuery(`
      INSERT INTO ManualPaymentSubmissions (
        SubmissionID, UserID, WalletID, Amount, PaymentMethod, 
        ReferenceNumber, PaymentDate, ProofImageURL, UserRemarks, Status
      ) VALUES (
        @param0, @param1, @param2, @param3, @param4,
        @param5, @param6, @param7, @param8, 'Pending'
      )
    `, [
      submissionId,
      userId,
      walletId,
      data.amount,
      data.paymentMethod,
      data.referenceNumber,
      data.paymentDate,
      data.proofImageURL || null,
      data.userRemarks || null
    ]);

    return {
      success: true,
      message: `Payment proof submitted successfully. Your wallet will be credited within ${settings.processingTime}.`,
      submissionId
    };

  } catch (error: any) {
    console.error('Error submitting manual payment:', error);
    if (error.message?.includes('duplicate') || error.message?.includes('UNIQUE')) {
      return { success: false, message: 'This reference number has already been submitted.' };
    }
    return { success: false, message: error.message || 'Failed to submit payment proof' };
  }
};

/**
 * Get user's manual payment submissions
 */
export const getUserManualPayments = async (userId: string): Promise<any[]> => {
  try {
    const result = await dbService.executeQuery(`
      SELECT 
        SubmissionID as submissionId,
        Amount as amount,
        PaymentMethod as paymentMethod,
        ReferenceNumber as referenceNumber,
        PaymentDate as paymentDate,
        ProofImageURL as proofImageUrl,
        UserRemarks as userRemarks,
        Status as status,
        AdminRemarks as adminRemarks,
        CreatedAt as createdAt,
        ReviewedAt as reviewedAt
      FROM ManualPaymentSubmissions
      WHERE UserID = @param0
      ORDER BY CreatedAt DESC
    `, [userId]);

    return result.recordset || [];
  } catch (error: any) {
    console.error('Error fetching user manual payments:', error);
    return [];
  }
};

/**
 * Admin: Get all pending manual payments
 */
export const getPendingManualPayments = async (): Promise<any[]> => {
  try {
    const result = await dbService.executeQuery(`
      SELECT 
        m.SubmissionID as submissionId,
        m.UserID as userId,
        u.Email as userEmail,
        u.FirstName + ' ' + u.LastName as userName,
        m.Amount as amount,
        m.PaymentMethod as paymentMethod,
        m.ReferenceNumber as referenceNumber,
        m.PaymentDate as paymentDate,
        m.ProofImageURL as proofImageUrl,
        m.UserRemarks as userRemarks,
        m.Status as status,
        m.CreatedAt as createdAt
      FROM ManualPaymentSubmissions m
      JOIN Users u ON m.UserID = u.UserID
      WHERE m.Status = 'Pending'
      ORDER BY m.CreatedAt ASC
    `);

    return result.recordset || [];
  } catch (error: any) {
    console.error('Error fetching pending manual payments:', error);
    return [];
  }
};

/**
 * Admin: Get all manual payments with optional status filter
 */
export const getAllManualPayments = async (status: string | null = null): Promise<any[]> => {
  try {
    let query = `
      SELECT 
        m.SubmissionID as submissionId,
        m.UserID as userId,
        u.Email as userEmail,
        u.FirstName + ' ' + u.LastName as userName,
        m.Amount as amount,
        m.PaymentMethod as paymentMethod,
        m.ReferenceNumber as referenceNumber,
        m.PaymentDate as paymentDate,
        m.ProofImageURL as proofImageUrl,
        m.UserRemarks as userRemarks,
        m.Status as status,
        m.AdminRemarks as adminRemarks,
        m.ReviewedBy as reviewedBy,
        m.ReviewedAt as reviewedAt,
        m.CreatedAt as createdAt
      FROM ManualPaymentSubmissions m
      JOIN Users u ON m.UserID = u.UserID
    `;
    
    const params: any[] = [];
    if (status) {
      query += ` WHERE m.Status = @param0`;
      params.push(status);
    }
    
    query += ` ORDER BY m.CreatedAt DESC`;

    const result = await dbService.executeQuery(query, params);

    return result.recordset || [];
  } catch (error: any) {
    console.error('Error fetching all manual payments:', error);
    return [];
  }
};

/**
 * Admin: Approve a manual payment
 */
export const approveManualPayment = async (
  submissionId: string,
  adminUserId: string,
  adminRemarks?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Get submission details
    const submission = await dbService.executeQuery(`
      SELECT UserID, WalletID, Amount, Status 
      FROM ManualPaymentSubmissions 
      WHERE SubmissionID = @param0
    `, [submissionId]);

    if (!submission.recordset || submission.recordset.length === 0) {
      return { success: false, message: 'Submission not found' };
    }

    const sub = submission.recordset[0];
    if (sub.Status !== 'Pending') {
      return { success: false, message: `This submission is already ${sub.Status}` };
    }

    // Credit wallet FIRST before updating status
    let walletId = sub.WalletID;
    if (!walletId) {
      // Get or create wallet
      const walletResult = await dbService.executeQuery(`
        SELECT WalletID FROM Wallets WHERE UserID = @param0
      `, [sub.UserID]);
      
      if (walletResult.recordset && walletResult.recordset.length > 0) {
        walletId = walletResult.recordset[0].WalletID;
      } else {
        // Create wallet
        walletId = uuidv4();
        await dbService.executeQuery(`
          INSERT INTO Wallets (WalletID, UserID, Balance, CurrencyID, Status, CreatedAt, UpdatedAt)
          VALUES (@param0, @param1, 0, 4, 'Active', GETUTCDATE(), GETUTCDATE())
        `, [walletId, sub.UserID]);
      }
    }

    // Add balance to wallet
    await dbService.executeQuery(`
      UPDATE Wallets
      SET Balance = Balance + @param1,
          UpdatedAt = GETUTCDATE(),
          LastTransactionAt = GETUTCDATE()
      WHERE WalletID = @param0
    `, [walletId, sub.Amount]);

    // Get current balance for transaction record
    const balanceResult = await dbService.executeQuery(`
      SELECT Balance FROM Wallets WHERE WalletID = @param0
    `, [walletId]);
    const balanceAfter = balanceResult.recordset[0]?.Balance || sub.Amount;
    const balanceBefore = balanceAfter - sub.Amount;

    // Add transaction record
    await dbService.executeQuery(`
      INSERT INTO WalletTransactions (
        TransactionID, WalletID, TransactionType, Amount, 
        BalanceBefore, BalanceAfter, CurrencyID, Source,
        PaymentReference, Description, Status, CreatedAt
      ) VALUES (
        @param0, @param1, 'Credit', @param2,
        @param3, @param4, 4, 'Manual_Payment',
        @param5, 'Bank/UPI Transfer', 'Completed', GETUTCDATE()
      )
    `, [uuidv4(), walletId, sub.Amount, balanceBefore, balanceAfter, submissionId]);

    // Update submission status to Approved ONLY AFTER wallet is credited
    await dbService.executeQuery(`
      UPDATE ManualPaymentSubmissions
      SET Status = 'Approved',
          AdminRemarks = @param1,
          ReviewedBy = @param2,
          ReviewedAt = GETUTCDATE(),
          UpdatedAt = GETUTCDATE()
      WHERE SubmissionID = @param0
    `, [submissionId, adminRemarks || 'Payment verified', adminUserId]);

    return { success: true, message: 'Payment approved and wallet credited' };

  } catch (error: any) {
    console.error('Error approving manual payment:', error);
    return { success: false, message: error.message || 'Failed to approve payment' };
  }
};

/**
 * Admin: Reject a manual payment
 */
export const rejectManualPayment = async (
  submissionId: string,
  adminUserId: string,
  adminRemarks: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const result = await dbService.executeQuery(`
      UPDATE ManualPaymentSubmissions
      SET Status = 'Rejected',
          AdminRemarks = @param1,
          ReviewedBy = @param2,
          ReviewedAt = GETUTCDATE(),
          UpdatedAt = GETUTCDATE()
      WHERE SubmissionID = @param0 AND Status = 'Pending'
    `, [submissionId, adminRemarks, adminUserId]);

    if (!result.rowsAffected || result.rowsAffected[0] === 0) {
      return { success: false, message: 'Submission not found or already processed' };
    }

    return { success: true, message: 'Payment rejected' };

  } catch (error: any) {
    console.error('Error rejecting manual payment:', error);
    return { success: false, message: error.message || 'Failed to reject payment' };
  }
};

export const manualPaymentService = {
  getSettings: getPaymentSettings,
  submit: submitManualPayment,
  getUserPayments: getUserManualPayments,
  getPending: getPendingManualPayments,
  getAll: getAllManualPayments,
  approve: approveManualPayment,
  reject: rejectManualPayment
};

export default manualPaymentService;
