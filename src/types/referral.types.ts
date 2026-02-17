/**
 * Referral System Types and Interfaces
 * RefOpen Referral System Implementation
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
    Status: 'Pending' | 'Completed' | 'Verified' | 'Unverified' | 'Refunded';
    RequestedAt: Date;
    AssignedReferrerID?: string;
    ReferredAt?: Date;
    VerifiedByApplicant: boolean;

    // Joined user identity (for UI profile link)
    ApplicantUserID?: string;
    ApplicantProfilePictureURL?: string;
    
    /** External referral support fields */
    ReferralType: 'internal' | 'external';
    /** For external referrals, stores matched organization ID */
    OrganizationID?: string;
    /** Optional message from candidate to referrer */
    ReferralMessage?: string;
    
    /** Proof submission fields */
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
    
    /** Open to any company fields */
    OpenToAnyCompany?: boolean;
    MinSalary?: number;
    SalaryCurrency?: string;
    SalaryPeriod?: string;
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
    /** Internal job UNIQUEIDENTIFIER - null for external referrals */
    jobID?: string;
    /** External job identifier STRING - null for internal referrals */
    extJobID?: string;
    resumeID: string;
    /** Optional message from candidate to referrer */
    referralMessage?: string;
    
    // External job details (for external referrals from AskReferral screen)
    jobTitle?: string; // Required for external referrals
    companyName?: string; // Required for external referrals
    organizationId?: string; // Matched organization ID from dropdown
    jobUrl?: string; // For external referrals
    openToAnyCompany?: boolean; // User doesn't care about specific company, just needs referral for a role
    minSalary?: number; // Minimum expected salary (only for openToAnyCompany)
    salaryCurrency?: string; // Currency code: INR, USD, etc.
    salaryPeriod?: string; // 'Annual' or 'Monthly'
}

export interface ClaimReferralRequestDto {
    requestID: string;
}

export interface SubmitReferralWithProofDto {
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
    
    /** Breakdown by referral type */
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
    /** Filter by referral type */
    referralType?: 'internal' | 'external';
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
    emailOnCompleted: boolean;
    pushNotifications: boolean;
}

/** External job matching interface for referrals to jobs not in system */
export interface ExternalJobMatch {
    companyName: string;
    matchingReferrers: Array<{
        referrerId: string;
        referrerName: string;
        currentJobTitle: string;
        experienceYears: number;
    }>;

    /** External job details */
    jobUrl?: string;
    jobDescription?: string;
    location?: string;
    salaryRange?: string;
}