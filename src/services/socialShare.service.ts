/**
 * Social Share Rewards Service
 * Handles social media post submissions for wallet rewards
 */
import { v4 as uuidv4 } from 'uuid';
import { dbService } from './database.service';
import { WalletService } from './wallet.service';

// Platform reward amounts (fallback values if not in DB)
const DEFAULT_REWARDS = {
  LinkedIn: 30,
  Twitter: 20,
  Instagram: 20,
  Facebook: 15,
  ViralBonus: 25
};

interface SocialShareClaim {
  ClaimID: string;
  UserID: string;
  Platform: string;
  PostURL?: string;
  ScreenshotURL?: string;
  PostContent?: string;
  RewardAmount: number;
  BonusAmount: number;
  Status: 'Pending' | 'Approved' | 'Rejected' | 'Expired';
  RejectionReason?: string;
  ReviewedBy?: string;
  ReviewedAt?: Date;
  CreatedAt: Date;
}

interface SubmitClaimInput {
  userId: string;
  platform: 'LinkedIn' | 'Twitter' | 'Instagram' | 'Facebook';
  postUrl?: string;
  screenshotUrl?: string;
  postContent?: string;
}

/**
 * Get reward amounts from database settings
 */
export async function getRewardAmounts(): Promise<Record<string, number>> {
  const result = await dbService.executeQuery(`
    SELECT SettingKey, SettingValue 
    FROM PricingSettings 
    WHERE SettingKey LIKE 'SOCIAL_SHARE_%' AND IsActive = 1
  `);
  
  const rewards = { ...DEFAULT_REWARDS };
  
  for (const row of result.recordset) {
    if (row.SettingKey === 'SOCIAL_SHARE_LINKEDIN_REWARD') rewards.LinkedIn = parseFloat(row.SettingValue);
    if (row.SettingKey === 'SOCIAL_SHARE_TWITTER_REWARD') rewards.Twitter = parseFloat(row.SettingValue);
    if (row.SettingKey === 'SOCIAL_SHARE_INSTAGRAM_REWARD') rewards.Instagram = parseFloat(row.SettingValue);
    if (row.SettingKey === 'SOCIAL_SHARE_FACEBOOK_REWARD') rewards.Facebook = parseFloat(row.SettingValue);
    if (row.SettingKey === 'SOCIAL_SHARE_VIRAL_BONUS') rewards.ViralBonus = parseFloat(row.SettingValue);
  }
  
  return rewards;
}

/**
 * Check if user can submit a claim for a platform
 */
export async function canSubmitClaim(userId: string, platform: string): Promise<{ canSubmit: boolean; reason?: string; existingClaim?: any; rejectedClaim?: any }> {
  // Check for pending or approved claims
  const existing = await dbService.executeQuery(`
    SELECT ClaimID, Status, CreatedAt, RewardAmount
    FROM SocialShareClaims
    WHERE UserID = @param0 
      AND Platform = @param1
      AND Status IN ('Pending', 'Approved')
    ORDER BY CreatedAt DESC
  `, [userId, platform]);
  
  if (existing.recordset.length > 0) {
    const claim = existing.recordset[0];
    if (claim.Status === 'Pending') {
      return { 
        canSubmit: false, 
        reason: 'You already have a pending claim for this platform. Please wait for review.',
        existingClaim: claim
      };
    }
    if (claim.Status === 'Approved') {
      return { 
        canSubmit: false, 
        reason: 'You have already received reward for this platform.',
        existingClaim: claim
      };
    }
  }
  
  // Check for rejected claims (user can resubmit, but show rejection reason)
  const rejected = await dbService.executeQuery(`
    SELECT ClaimID, Status, CreatedAt, RewardAmount, RejectionReason, ReviewedAt
    FROM SocialShareClaims
    WHERE UserID = @param0 
      AND Platform = @param1
      AND Status = 'Rejected'
    ORDER BY CreatedAt DESC
  `, [userId, platform]);
  
  if (rejected.recordset.length > 0) {
    return { 
      canSubmit: true, 
      rejectedClaim: rejected.recordset[0]
    };
  }
  
  return { canSubmit: true };
}

/**
 * Submit a new social share claim
 */
export async function submitClaim(input: SubmitClaimInput): Promise<{ success: boolean; claim?: SocialShareClaim; error?: string }> {
  const { userId, platform, postUrl, screenshotUrl, postContent } = input;
  
  // Check if user can submit
  const canSubmitResult = await canSubmitClaim(userId, platform);
  if (!canSubmitResult.canSubmit) {
    return { success: false, error: canSubmitResult.reason };
  }
  
  // Validate required fields
  if (!screenshotUrl) {
    return { success: false, error: 'Screenshot proof is required' };
  }
  
  // Get reward amount for this platform
  const rewards = await getRewardAmounts();
  const rewardAmount = rewards[platform] || DEFAULT_REWARDS[platform as keyof typeof DEFAULT_REWARDS] || 20;
  
  const claimId = uuidv4();
  
  await dbService.executeQuery(`
    INSERT INTO SocialShareClaims (
      ClaimID, UserID, Platform, PostURL, ScreenshotURL, PostContent, 
      RewardAmount, Status, CreatedAt, UpdatedAt
    ) VALUES (
      @param0, @param1, @param2, @param3, @param4, @param5,
      @param6, 'Pending', GETUTCDATE(), GETUTCDATE()
    )
  `, [claimId, userId, platform, postUrl || null, screenshotUrl, postContent || null, rewardAmount]);
  
  return {
    success: true,
    claim: {
      ClaimID: claimId,
      UserID: userId,
      Platform: platform,
      PostURL: postUrl,
      ScreenshotURL: screenshotUrl,
      PostContent: postContent,
      RewardAmount: rewardAmount,
      BonusAmount: 0,
      Status: 'Pending',
      CreatedAt: new Date()
    }
  };
}

/**
 * Get user's social share claims
 */
export async function getUserClaims(userId: string): Promise<SocialShareClaim[]> {
  const result = await dbService.executeQuery(`
    SELECT 
      ClaimID, UserID, Platform, PostURL, ScreenshotURL, PostContent,
      RewardAmount, BonusAmount, Status, RejectionReason,
      ReviewedAt, CreatedAt, UpdatedAt
    FROM SocialShareClaims
    WHERE UserID = @param0
    ORDER BY CreatedAt DESC
  `, [userId]);
  
  return result.recordset;
}

/**
 * Get all pending claims for admin review
 */
export async function getPendingClaims(): Promise<any[]> {
  const result = await dbService.executeQuery(`
    SELECT 
      s.ClaimID, s.UserID, s.Platform, s.PostURL, s.ScreenshotURL, s.PostContent,
      s.RewardAmount, s.BonusAmount, s.Status, s.CreatedAt,
      u.FirstName, u.LastName, u.Email, u.ProfilePictureURL
    FROM SocialShareClaims s
    JOIN Users u ON s.UserID = u.UserID
    WHERE s.Status = 'Pending'
    ORDER BY s.CreatedAt ASC
  `);
  
  return result.recordset;
}

/**
 * Get all claims for admin (with pagination and filters)
 */
export async function getAllClaims(options: { status?: string; platform?: string; page: number; pageSize: number }): Promise<{ claims: any[]; total: number; stats: { pending: number; approved: number; rejected: number } }> {
  const { status, platform, page, pageSize } = options;
  const offset = (page - 1) * pageSize;
  
  let whereConditions: string[] = [];
  let params: any[] = [];
  let paramIndex = 0;
  
  if (status && status !== 'all') {
    whereConditions.push(`s.Status = @param${paramIndex}`);
    params.push(status);
    paramIndex++;
  }
  
  if (platform && platform !== 'all') {
    whereConditions.push(`s.Platform = @param${paramIndex}`);
    params.push(platform);
    paramIndex++;
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // Get counts and stats in parallel
  const [countResult, statsResult] = await Promise.all([
    dbService.executeQuery(`
      SELECT COUNT(*) as total FROM SocialShareClaims s ${whereClause}
    `, params),
    dbService.executeQuery(`
      SELECT 
        SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN Status = 'Approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) as rejected
      FROM SocialShareClaims
    `, [])
  ]);
  
  // Add offset and pageSize to params for main query
  const mainParams = [...params, offset, pageSize];
  
  const result = await dbService.executeQuery(`
    SELECT 
      s.ClaimID, s.UserID, s.Platform, s.PostURL, s.ScreenshotURL, s.PostContent,
      s.RewardAmount, s.BonusAmount, s.Status, s.RejectionReason,
      s.ReviewedBy, s.ReviewedAt, s.CreatedAt, s.UpdatedAt,
      u.FirstName, u.LastName, u.Email, u.ProfilePictureURL,
      r.FirstName as ReviewerFirstName, r.LastName as ReviewerLastName
    FROM SocialShareClaims s
    JOIN Users u ON s.UserID = u.UserID
    LEFT JOIN Users r ON s.ReviewedBy = r.UserID
    ${whereClause}
    ORDER BY s.CreatedAt DESC
    OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY
  `, mainParams);
  
  const stats = statsResult.recordset[0] || { pending: 0, approved: 0, rejected: 0 };
  
  return {
    claims: result.recordset,
    total: countResult.recordset[0].total,
    stats: {
      pending: stats.pending || 0,
      approved: stats.approved || 0,
      rejected: stats.rejected || 0
    }
  };
}

/**
 * Approve a social share claim and credit wallet
 */
export async function approveClaim(claimId: string, adminUserId: string, bonusAmount: number = 0): Promise<{ success: boolean; error?: string }> {
  // Get claim details
  const claimResult = await dbService.executeQuery(`
    SELECT ClaimID, UserID, Platform, RewardAmount, Status
    FROM SocialShareClaims
    WHERE ClaimID = @param0
  `, [claimId]);
  
  if (claimResult.recordset.length === 0) {
    return { success: false, error: 'Claim not found' };
  }
  
  const claim = claimResult.recordset[0];
  
  if (claim.Status !== 'Pending') {
    return { success: false, error: `Claim is already ${claim.Status.toLowerCase()}` };
  }
  
  const totalReward = claim.RewardAmount + bonusAmount;
  
  // Update claim status
  await dbService.executeQuery(`
    UPDATE SocialShareClaims
    SET Status = 'Approved',
        BonusAmount = @param1,
        ReviewedBy = @param2,
        ReviewedAt = GETUTCDATE(),
        UpdatedAt = GETUTCDATE()
    WHERE ClaimID = @param0
  `, [claimId, bonusAmount, adminUserId]);
  
  // Credit wallet using WalletService - use SOCIAL_SHARE_REWARD source (non-withdrawable)
  const description = bonusAmount > 0 
    ? `Social share reward for ${claim.Platform} post + ₹${bonusAmount} viral bonus`
    : `Social share reward for ${claim.Platform} post`;
  
  await WalletService.creditBonus(
    claim.UserID, 
    totalReward, 
    'ADMIN_BONUS', // This will be treated as non-withdrawable
    description
  );
  
  return { success: true };
}

/**
 * Reject a social share claim
 */
export async function rejectClaim(claimId: string, adminUserId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  // Get claim details
  const claimResult = await dbService.executeQuery(`
    SELECT ClaimID, Status FROM SocialShareClaims WHERE ClaimID = @param0
  `, [claimId]);
  
  if (claimResult.recordset.length === 0) {
    return { success: false, error: 'Claim not found' };
  }
  
  const claim = claimResult.recordset[0];
  
  if (claim.Status !== 'Pending') {
    return { success: false, error: `Claim is already ${claim.Status.toLowerCase()}` };
  }
  
  // Update claim status
  await dbService.executeQuery(`
    UPDATE SocialShareClaims
    SET Status = 'Rejected',
        RejectionReason = @param1,
        ReviewedBy = @param2,
        ReviewedAt = GETUTCDATE(),
        UpdatedAt = GETUTCDATE()
    WHERE ClaimID = @param0
  `, [claimId, reason, adminUserId]);
  
  return { success: true };
}

/**
 * Get social share stats for admin dashboard
 */
export async function getSocialShareStats(): Promise<any> {
  const result = await dbService.executeQuery(`
    SELECT 
      COUNT(*) as TotalClaims,
      SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as PendingClaims,
      SUM(CASE WHEN Status = 'Approved' THEN 1 ELSE 0 END) as ApprovedClaims,
      SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) as RejectedClaims,
      SUM(CASE WHEN Status = 'Approved' THEN RewardAmount + BonusAmount ELSE 0 END) as TotalRewarded,
      COUNT(DISTINCT UserID) as UniqueUsers,
      COUNT(DISTINCT CASE WHEN Status = 'Approved' THEN UserID END) as UsersRewarded
    FROM SocialShareClaims
  `);
  
  const platformStats = await dbService.executeQuery(`
    SELECT 
      Platform,
      COUNT(*) as TotalClaims,
      SUM(CASE WHEN Status = 'Approved' THEN 1 ELSE 0 END) as ApprovedClaims,
      SUM(CASE WHEN Status = 'Approved' THEN RewardAmount + BonusAmount ELSE 0 END) as TotalRewarded
    FROM SocialShareClaims
    GROUP BY Platform
    ORDER BY TotalClaims DESC
  `);
  
  return {
    ...result.recordset[0],
    platformStats: platformStats.recordset
  };
}
