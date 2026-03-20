/**
 * Social Share Rewards Service
 * Handles social media post submissions for wallet rewards
 */
import { v4 as uuidv4 } from 'uuid';
import { SocialShareRepository } from '../repositories/social-share.repository';
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
  const rows = await SocialShareRepository.getRewardSettings();
  
  const rewards = { ...DEFAULT_REWARDS };
  
  for (const row of rows) {
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
  const activeClaims = await SocialShareRepository.findActiveClaimsByPlatform(userId, platform);
  
  if (activeClaims.length > 0) {
    const claim = activeClaims[0];
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
  const rejectedClaims = await SocialShareRepository.findRejectedClaimsByPlatform(userId, platform);
  
  if (rejectedClaims.length > 0) {
    return { 
      canSubmit: true, 
      rejectedClaim: rejectedClaims[0]
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
  
  await SocialShareRepository.insertClaim(
    claimId, userId, platform, postUrl || null, screenshotUrl, postContent || null, rewardAmount
  );
  
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
  return SocialShareRepository.findByUser(userId);
}

/**
 * Get all pending claims for admin review
 */
export async function getPendingClaims(): Promise<any[]> {
  return SocialShareRepository.findPending();
}

/**
 * Get all claims for admin (with pagination and filters)
 */
export async function getAllClaims(options: { status?: string; platform?: string; page: number; pageSize: number }): Promise<{ claims: any[]; total: number; stats: { pending: number; approved: number; rejected: number } }> {
  const { status, platform, page, pageSize } = options;
  const offset = (page - 1) * pageSize;
  
  const [{ claims, total }, stats] = await Promise.all([
    SocialShareRepository.findAllFiltered({ status, platform }, offset, pageSize),
    SocialShareRepository.getGlobalStats()
  ]);
  
  return {
    claims,
    total,
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
  const claim = await SocialShareRepository.findById(claimId);
  
  if (!claim) {
    return { success: false, error: 'Claim not found' };
  }
  
  if (claim.Status !== 'Pending') {
    return { success: false, error: `Claim is already ${claim.Status.toLowerCase()}` };
  }
  
  const totalReward = claim.RewardAmount + bonusAmount;
  
  // Update claim status
  await SocialShareRepository.approveClaim(claimId, bonusAmount, adminUserId);
  
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
  const claim = await SocialShareRepository.findStatusById(claimId);
  
  if (!claim) {
    return { success: false, error: 'Claim not found' };
  }
  
  if (claim.Status !== 'Pending') {
    return { success: false, error: `Claim is already ${claim.Status.toLowerCase()}` };
  }
  
  // Update claim status
  await SocialShareRepository.rejectClaim(claimId, reason, adminUserId);
  
  return { success: true };
}

/**
 * Get social share stats for admin dashboard
 */
export async function getSocialShareStats(): Promise<any> {
  const { summary, platformStats } = await SocialShareRepository.getDetailedStats();
  
  return {
    ...summary,
    platformStats
  };
}
