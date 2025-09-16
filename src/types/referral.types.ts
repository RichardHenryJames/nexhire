/**
 * Referral System Types and Interfaces
 * NexHire Referral System Implementation
 */

export interface ReferralPlan {
    PlanID: number;
    Name: string;
    ReferralsPerDay: number;
    DurationDays: number;
    Price: number;
    CreatedAt: Date;
}

export interface ApplicantReferralSubscription {
    SubscriptionID: string;
    ApplicantID: string;
    PlanID: number;
    StartDate: Date;
    EndDate: Date;
    IsActive: boolean;
    // Joined data
    PlanName?: string;
    ReferralsPerDay?: number;
}

export interface ReferralRequest {
    RequestID: string;
    JobID: string;
    ApplicantID: string;
    ResumeID: string;
    Status: 'Pending' | 'Claimed' | 'Completed' | 'Verified';
    RequestedAt: Date;
    AssignedReferrerID?: string;
    ReferredAt?: Date;
    VerifiedByApplicant: boolean;
    
    // Joined data for display
    JobTitle?: string;
    CompanyName?: string;
    ApplicantName?: string;
    ApplicantEmail?: string;
    ReferrerName?: string;
    ResumeLabel?: string;
}

export interface ReferralProof {
    ProofID: string;
    RequestID: string;
    ReferrerID: string;
    FileURL: string;
    FileType: string;
    Description?: string;
    SubmittedAt: Date;
}

export interface ReferralReward {
    RewardID: string;
    ReferrerID: string;
    RequestID: string;
    PointsEarned: number;
    AwardedAt: Date;
}

export interface ReferrerStats {
    ReferrerID: string;
    PendingCount: number;
    LastUpdated: Date;
}

// Request/Response DTOs
export interface CreateReferralRequestDto {
    jobID: string;
    resumeID: string;
}

export interface ClaimReferralRequestDto {
    requestID: string;
}

export interface ClaimReferralRequestWithProofDto {
    requestID: string;
    proofFileURL: string;
    proofFileType: string;
    proofDescription?: string;
}

export interface SubmitReferralProofDto {
    requestID: string;
    fileURL: string;
    fileType: string;
    description?: string;
}

export interface VerifyReferralDto {
    requestID: string;
    verified: boolean;
}

export interface PurchaseReferralPlanDto {
    planID: number;
    paymentToken?: string; // For payment processing
}

// Dashboard Analytics
export interface ReferralAnalytics {
    totalRequestsMade: number;
    totalRequestsReceived: number;
    completedReferrals: number;
    pendingRequests: number;
    totalPointsEarned: number;
    currentSubscription?: ApplicantReferralSubscription;
    dailyQuotaUsed: number;
    dailyQuotaLimit: number;
}

// Referral Eligibility Check
export interface ReferralEligibility {
    isEligible: boolean;
    reason?: string;
    hasActiveSubscription: boolean;
    dailyQuotaRemaining: number;
    canRefer: boolean;
}

// Pagination and filtering
export interface ReferralRequestsFilter {
    status?: string;
    jobTitle?: string;
    companyName?: string;
    dateFrom?: Date;
    dateTo?: Date;
}

export interface PaginatedReferralRequests {
    requests: ReferralRequest[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// Notification preferences
export interface ReferralNotificationSettings {
    emailOnNewRequests: boolean;
    emailOnClaimed: boolean;
    emailOnCompleted: boolean;
    pushNotifications: boolean;
}