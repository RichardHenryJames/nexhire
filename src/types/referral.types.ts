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
    JobID: string; // Required - can be internal GUID or external job identifier
    ApplicantID: string;
    ResumeID: string;
    Status: 'Pending' | 'Claimed' | 'Completed' | 'Verified';
    RequestedAt: Date;
    AssignedReferrerID?: string;
    ReferredAt?: Date;
    VerifiedByApplicant: boolean;
    
    // ?? NEW: Minimal external referral support
    ReferralType: 'internal' | 'external';
    OrganizationID?: string; // ?? NEW: For external referrals, store matched organization ID
    ReferralMessage?: string; // ?? NEW: Optional message from candidate to referrer
    
    // ?? NEW: Proof-related fields (fix TypeScript error)
    ProofFileURL?: string;
    ProofFileType?: string;
    ProofDescription?: string;
    
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
    jobID: string; // Required - can be internal GUID or external job identifier
    resumeID: string;
    referralType: 'internal' | 'external';
    referralMessage?: string; // ?? NEW: Optional message from candidate to referrer
    
    // ?? NEW: External job details (stored as metadata in frontend/cache)
    jobTitle?: string; // For external referrals
    companyName?: string; // For external referrals
    organizationId?: string; // ?? NEW: Matched organization ID from dropdown
    jobUrl?: string; // For external referrals
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
    
    // ?? NEW: Breakdown by referral type
    internalRequests?: number;
    externalRequests?: number;
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
    referralType?: 'internal' | 'external'; // ?? NEW: Filter by type
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

// ?? NEW: External job matching interface
export interface ExternalJobMatch {
    companyName: string;
    matchingReferrers: Array<{
        referrerId: string;
        referrerName: string;
        currentJobTitle: string;
        experienceYears: number;
    }>;

    // ?? NEW: External job details
    jobUrl?: string;
    jobDescription?: string;
    location?: string;
    salaryRange?: string;
}