import { HttpRequest, HttpResponseInit } from '@azure/functions';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    meta?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
    };
}

export interface PaginationParams {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface QueryParams extends Record<string, any> {
    search?: string;
    filters?: Record<string, any>;
}

export interface User {
    UserID: string;
    Email: string;
    Password: string;
    UserType: 'JobSeeker' | 'Employer' | 'Admin';
    FirstName: string;
    LastName: string;
    Phone?: string;
    ProfilePictureURL?: string;
    DateOfBirth?: Date;
    Gender?: string;
    EmailVerified: boolean;
    PhoneVerified: boolean;
    LastLoginAt?: Date;
    LastActive?: Date;
    ProfileVisibility: string;
    CreatedAt: Date;
    UpdatedAt: Date;
    IsActive: boolean;
    TwoFactorEnabled: boolean;
    LoginAttempts: number;
    AccountLockoutEnd?: Date;

    /** Google OAuth fields */
    GoogleId?: string;
    LoginMethod?: string;
    GoogleAccessToken?: string;
}

export interface Organization {
    OrganizationID: string;
    Name: string;
    Type?: string;
    Industry?: string;
    Size?: string;
    Website?: string;
    LinkedInProfile?: string;
    Description?: string;
    LogoURL?: string;
    VerificationStatus: string;
    EstablishedDate?: Date;
    CreatedAt: Date;
    UpdatedAt: Date;
    IsActive: boolean;
}

export interface Job {
    JobID: string;
    OrganizationID: string;
    PostedByUserID: string;
    Title: string;
    JobTypeID: number;
    Level?: string;
    Department?: string;
    Description?: string;
    Responsibilities?: string;
    Requirements?: string;
    PreferredQualifications?: string;
    BenefitsOffered?: string;
    Location?: string;
    Country?: string;
    State?: string;
    City?: string;
    PostalCode?: string;
    IsRemote: boolean;
    WorkplaceType?: string;
    RemoteRestrictions?: string;
    SalaryRangeMin?: number;
    SalaryRangeMax?: number;
    CurrencyID?: number;
    SalaryPeriod?: string;
    CompensationType?: string;
    BonusDetails?: string;
    EquityOffered?: string;
    ProjectDuration?: string;
    ProjectStartDate?: Date;
    ProjectEndDate?: Date;
    ProjectBudget?: number;
    ContractExtensionPossible?: boolean;
    ContractConversionPossible?: boolean;
    ExperienceMin?: number;
    ExperienceMax?: number;
    ExperienceLevel?: string;
    RequiredCertifications?: string;
    RequiredEducation?: string;
    Status: string;
    Priority?: string;
    Visibility?: string;
    ApplicationDeadline?: Date;
    TargetHiringDate?: Date;
    MaxApplications?: number;
    CurrentApplications?: number;
    InterviewStages?: string;
    InterviewProcess?: string;
    AssessmentRequired?: boolean;
    AssessmentDetails?: string;
    PublishedAt?: Date;
    ExpiresAt?: Date;
    CreatedAt: Date;
    UpdatedAt: Date;
    LastBumpedAt?: Date;
    TimeZone?: string;
    Language?: string;
    Tags?: string;
    InternalNotes?: string;
    ExternalJobID?: string;
    /** Application URL from scraped job sources */
    ApplicationURL?: string;
    SearchScore?: number;
    FeaturedUntil?: Date;
}

export interface Applicant {
    ApplicantID: string;
    UserID: string;
    Nationality?: string;
    CurrentLocation?: string;
    PreferredLocations?: string;
    LinkedInProfile?: string;
    PortfolioURL?: string;
    GithubProfile?: string;
    Headline?: string;
    Summary?: string;
    CurrentJobTitle?: string;
    CurrentCompany?: string;
    YearsOfExperience?: number;
    PreferredJobTypes?: string;
    PreferredWorkTypes?: string;
    ExpectedSalaryMin?: number;
    ExpectedSalaryMax?: number;
    PreferredCurrency?: number;
    NoticePeriod?: number;
    ImmediatelyAvailable?: boolean;
    WillingToRelocate?: boolean;
    PreferredRoles?: string;
    PrimarySkills?: string;
    SecondarySkills?: string;
    Languages?: string;
    Certifications?: string;
    HighestEducation?: string;
    FieldOfStudy?: string;
    Education?: string;
    WorkExperience?: string;
    PrimaryResumeURL?: string;
    AdditionalDocuments?: string;
    AllowRecruitersToContact?: boolean;
    HideCurrentCompany?: boolean;
    HideSalaryDetails?: boolean;
    ProfileCompleteness?: number;
    IsOpenToWork?: boolean;
    IsFeatured?: boolean;
    FeaturedUntil?: Date;
    JobSearchStatus?: string;
    PreferredIndustries?: string;
    MinimumSalary?: number;
    PreferredCompanySize?: string;
    LastJobAppliedAt?: Date;
    SearchScore?: number;
    Tags?: string;
}

export interface JobApplication {
    ApplicationID: string;
    JobID: string;
    ApplicantID: string;
    ResumeURL?: string;
    CoverLetter?: string;
    ExpectedSalary?: number;
    ExpectedCurrencyID?: number;
    AvailableFromDate?: Date;
    StatusID: number;
    SubmittedAt: Date;
    LastUpdatedAt: Date;
}

export interface ApplicationTracking {
    TrackingID: string;
    ApplicationID: string;
    StatusTypeID?: number;
    ScreeningScore?: number;
    ScreeningNotes?: string;
    InterviewStage?: number;
    NextInterviewDate?: Date;
    InterviewFeedback?: string;
    OfferStatus?: string;
    OfferedSalary?: number;
    OfferedCurrencyID?: number;
    OfferLetterURL?: string;
    OfferExpiryDate?: Date;
    Notes?: string;
    LastUpdatedBy?: string;
    LastUpdatedAt: Date;
}

/** User registration request with support for all user types */
export interface UserRegistrationRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userType: 'JobSeeker' | 'Employer' | 'Admin';
    phone?: string;
    dateOfBirth?: Date;
    gender?: string;
    
    /** Organization fields for employers */
    organizationName?: string;
    organizationIndustry?: string;
    organizationSize?: string;
    organizationWebsite?: string;
    organizationDescription?: string;
    organizationLocation?: string;
    organizationType?: string;
    establishedDate?: Date;
    
    /** Admin-specific fields */
    adminLevel?: string;
    permissions?: string[];
}

export interface UserLoginRequest {
    email: string;
    password: string;
}

export interface JobCreateRequest {
    title: string;
    jobTypeID: number;
    level?: string;
    department?: string;
    description: string;
    responsibilities?: string;
    requirements: string;
    preferredQualifications?: string;
    benefitsOffered?: string;
    location?: string;
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    isRemote?: boolean;
    workplaceType?: string;
    remoteRestrictions?: string;
    salaryRangeMin?: number;
    salaryRangeMax?: number;
    currencyID?: number;
    salaryPeriod?: string;
    compensationType?: string;
    bonusDetails?: string;
    equityOffered?: string;
    projectDuration?: string;
    projectStartDate?: Date;
    projectEndDate?: Date;
    projectBudget?: number;
    contractExtensionPossible?: boolean;
    contractConversionPossible?: boolean;
    experienceMin?: number;
    experienceMax?: number;
    experienceLevel?: string;
    requiredCertifications?: string;
    requiredEducation?: string;
    priority?: string;
    visibility?: string;
    applicationDeadline?: Date;
    targetHiringDate?: Date;
    maxApplications?: number;
    interviewStages?: string;
    interviewProcess?: string;
    assessmentRequired?: boolean;
    assessmentDetails?: string;
    timeZone?: string;
    language?: string;
    tags?: string;
    internalNotes?: string;
}

export interface JobApplicationRequest {
    jobID: string;
    resumeURL?: string;
    coverLetter?: string;
    expectedSalary?: number;
    expectedCurrencyID?: number;
    availableFromDate?: Date;
}