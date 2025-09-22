import { HttpRequest } from '@azure/functions';
import Joi from 'joi';
import { ApiResponse, PaginationParams, QueryParams, UserRegistrationRequest, UserLoginRequest, JobCreateRequest, JobApplicationRequest } from '../types';

export class ValidationError extends Error {
    constructor(message: string, public details?: any) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends Error {
    constructor(message: string = 'Authentication required') {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends Error {
    constructor(message: string = 'Insufficient permissions') {
        super(message);
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends Error {
    constructor(message: string = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends Error {
    constructor(message: string = 'Resource already exists') {
        super(message);
        this.name = 'ConflictError';
    }
}

// GUID validation utility - FIXED: Improved GUID validation
export const isValidGuid = (value: string): boolean => {
    if (!value || typeof value !== 'string') return false;
    
    // Remove any whitespace
    value = value.trim();
    
    // Check length first (performance optimization)
    if (value.length !== 36) return false;
    
    // FIXED: More comprehensive GUID regex
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return guidRegex.test(value);
};

// Response helpers
export const successResponse = <T>(data: T, message?: string, meta?: any): ApiResponse<T> => ({
    success: true,
    data,
    message,
    meta
});

export const errorResponse = (error: string, message?: string): ApiResponse => ({
    success: false,
    error,
    message
});

// FIXED: Updated user registration schema to include Admin and organization details for employers
export const userRegistrationSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(100).required(),
    lastName: Joi.string().min(2).max(100).required(),
    userType: Joi.string().valid('JobSeeker', 'Employer', 'Admin').required(), // ? ADDED ADMIN
    phone: Joi.string().pattern(/^\+?[\d\s\-()]+$/).optional(),
    dateOfBirth: Joi.date().max('now').optional(),
    gender: Joi.string().valid('Male', 'Female', 'Other', 'Prefer not to say').optional(),
    
    // FIXED: Organization details for Employers (required when userType is 'Employer')
    organizationName: Joi.when('userType', {
        is: 'Employer',
        then: Joi.string().min(2).max(200).required(),
        otherwise: Joi.optional()
    }),
    organizationIndustry: Joi.when('userType', {
        is: 'Employer',
        then: Joi.string().max(100).optional(),
        otherwise: Joi.optional()
    }),
    organizationSize: Joi.when('userType', {
        is: 'Employer',
        then: Joi.string().valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+').optional(),
        otherwise: Joi.optional()
    }),
    organizationWebsite: Joi.when('userType', {
        is: 'Employer',
        then: Joi.string().uri().optional(),
        otherwise: Joi.optional()
    }),
    organizationDescription: Joi.when('userType', {
        is: 'Employer',
        then: Joi.string().min(20).max(1000).optional(),
        otherwise: Joi.optional()
    }),
    organizationLocation: Joi.when('userType', {
        is: 'Employer',
        then: Joi.string().max(200).optional(),
        otherwise: Joi.optional()
    }),
    organizationType: Joi.when('userType', {
        is: 'Employer',
        then: Joi.string().max(50).optional(),
        otherwise: Joi.optional()
    }),
    establishedDate: Joi.when('userType', {
        is: 'Employer',
        then: Joi.date().max('now').optional(),
        otherwise: Joi.optional()
    }),
    
    // ? NEW: Admin-specific fields (optional)
    adminLevel: Joi.when('userType', {
        is: 'Admin',
        then: Joi.string().valid('Super', 'Admin', 'Moderator').optional().default('Admin'),
        otherwise: Joi.optional()
    }),
    permissions: Joi.when('userType', {
        is: 'Admin',
        then: Joi.array().items(Joi.string()).optional(),
        otherwise: Joi.optional()
    })
});

export const userLoginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// NEW: Schema for initializing employer for existing users
export const employerInitializeSchema = Joi.object({
    organizationName: Joi.string().min(2).max(200).required(),
    organizationIndustry: Joi.string().max(100).optional(),
    organizationSize: Joi.string().valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+').optional(),
    organizationWebsite: Joi.string().uri().allow('').optional(),
    organizationType: Joi.string().max(50).optional(),
    jobTitle: Joi.string().max(200).optional(),
    department: Joi.string().max(100).optional(),
    linkedInProfile: Joi.string().uri().allow('').optional(),
    bio: Joi.string().max(1000).allow('').optional()
});

// FIXED: Updated job creation schema with flexible requirements
export const jobCreateSchema = Joi.object({
    title: Joi.string().min(5).max(200).required(),
    jobTypeID: Joi.number().integer().positive().optional().default(1), // Default to full-time
    level: Joi.string().max(50).optional(),
    department: Joi.string().max(100).optional(),
    description: Joi.string().min(20).required(),
    responsibilities: Joi.string().optional(),
    requirements: Joi.string().min(10).optional(), // Made optional with shorter min length
    preferredQualifications: Joi.string().optional(),
    benefitsOffered: Joi.string().optional(),
    location: Joi.string().max(200).optional(),
    country: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    city: Joi.string().max(100).optional(),
    postalCode: Joi.string().max(20).optional(),
    isRemote: Joi.boolean().default(false),
    workplaceType: Joi.string().valid('On-site', 'Hybrid', 'Remote').optional(),
    remoteRestrictions: Joi.string().max(200).optional(),
    salaryRangeMin: Joi.number().positive().optional(),
    salaryRangeMax: Joi.number().positive().optional(),
    currencyID: Joi.number().integer().positive().optional().default(1), // Default to USD
    salaryPeriod: Joi.string().valid('Annual', 'Monthly', 'Hourly').optional().default('Annual'),
    compensationType: Joi.string().valid('Salary', 'Contract', 'Commission').optional().default('Salary'),
    bonusDetails: Joi.string().max(300).optional(),
    equityOffered: Joi.string().max(100).optional(),
    projectDuration: Joi.string().max(50).optional(),
    projectStartDate: Joi.date().optional(),
    projectEndDate: Joi.date().optional(),
    projectBudget: Joi.number().positive().optional(),
    contractExtensionPossible: Joi.boolean().optional(),
    contractConversionPossible: Joi.boolean().optional(),
    experienceMin: Joi.number().integer().min(0).optional(),
    experienceMax: Joi.number().integer().min(0).optional(),
    experienceLevel: Joi.string().valid('Entry', 'Mid', 'Senior', 'Lead', 'Executive').optional(),
    requiredCertifications: Joi.string().max(100).optional(),
    requiredEducation: Joi.string().max(200).optional(),
    priority: Joi.string().valid('Normal', 'High', 'Urgent').default('Normal'),
    visibility: Joi.string().valid('Public', 'Private', 'Internal').default('Public'),
    applicationDeadline: Joi.date().min('now').optional(),
    targetHiringDate: Joi.date().min('now').optional(),
    maxApplications: Joi.number().integer().positive().optional(),
    interviewStages: Joi.string().max(100).optional(),
    interviewProcess: Joi.string().max(100).optional(),
    assessmentRequired: Joi.boolean().default(false),
    assessmentDetails: Joi.string().optional(),
    timeZone: Joi.string().max(50).optional(),
    language: Joi.string().max(50).default('English'),
    tags: Joi.string().max(100).optional(),
    internalNotes: Joi.string().max(100).optional()
});

export const organizationCreateSchema = Joi.object({
    name: Joi.string().min(2).max(200).required(),
    type: Joi.string().max(50).optional(),
    industry: Joi.string().max(100).optional(),
    size: Joi.string().valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+').optional(),
    website: Joi.string().uri().optional(),
    linkedInProfile: Joi.string().uri().optional(),
    description: Joi.string().min(20).optional(),
    logoURL: Joi.string().uri().optional(),
    establishedDate: Joi.date().max('now').optional()
});

export const applicantProfileSchema = Joi.object({
    nationality: Joi.string().max(100).optional(),
    currentLocation: Joi.string().max(200).optional(),
    preferredLocations: Joi.string().max(100).optional(),
    linkedInProfile: Joi.string().uri().optional(),
    portfolioURL: Joi.string().uri().optional(),
    githubProfile: Joi.string().uri().optional(),
    headline: Joi.string().max(200).optional(),
    summary: Joi.string().min(50).optional(),
    currentJobTitle: Joi.string().max(200).optional(),
    currentCompany: Joi.string().max(200).optional(),
    yearsOfExperience: Joi.number().min(0).max(50).optional(),
    preferredJobTypes: Joi.string().max(100).optional(),
    preferredWorkTypes: Joi.string().max(100).optional(),
    expectedSalaryMin: Joi.number().positive().optional(),
    expectedSalaryMax: Joi.number().positive().optional(),
    preferredCurrency: Joi.number().integer().positive().optional(),
    noticePeriod: Joi.number().integer().min(0).max(365).optional(),
    immediatelyAvailable: Joi.boolean().default(false),
    willingToRelocate: Joi.boolean().default(false),
    preferredRoles: Joi.string().optional(),
    primarySkills: Joi.string().min(10).optional(),
    secondarySkills: Joi.string().optional(),
    languages: Joi.string().optional(),
    certifications: Joi.string().optional(),
    highestEducation: Joi.string().max(100).optional(),
    fieldOfStudy: Joi.string().max(200).optional(),
    education: Joi.string().optional(),
    workExperience: Joi.string().optional(),
    allowRecruitersToContact: Joi.boolean().default(true),
    hideCurrentCompany: Joi.boolean().default(false),
    hideSalaryDetails: Joi.boolean().default(false),
    openToRefer: Joi.boolean().default(true), // ? NEW: Allow referral functionality with default true
    isOpenToWork: Joi.boolean().default(true),
    jobSearchStatus: Joi.string().valid('Actively Looking', 'Open to Opportunities', 'Not Looking').optional(),
    preferredIndustries: Joi.string().optional(),
    minimumSalary: Joi.number().positive().optional(),
    preferredCompanySize: Joi.string().optional(),
    tags: Joi.string().optional()
});

// FIXED: Updated job application schema with more flexible validation
export const jobApplicationSchema = Joi.object({
    jobID: Joi.string().guid().required(),
    coverLetter: Joi.string().min(20).optional(), // Reduced minimum length
    expectedSalary: Joi.number().positive().optional(),
    expectedCurrencyID: Joi.number().integer().positive().optional(),
    availableFromDate: Joi.date().min('now').optional(),
    // FIXED: Add availabilityDate field that was causing validation error
    availabilityDate: Joi.date().min('now').optional(),
    resumeURL: Joi.string().uri().optional()
});

// FIXED: Updated pagination schema to allow more parameters
export const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// FIXED: New extended pagination schema for job applications with all search parameters
export const jobApplicationsPaginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    // FIXED: Add all the parameters that were being rejected
    search: Joi.string().optional(),
    q: Joi.string().optional(),
    filters: Joi.object().optional(),
    location: Joi.string().optional(),
    jobType: Joi.string().optional(),
    experienceLevel: Joi.string().optional(),
    isRemote: Joi.boolean().optional(),
    salaryMin: Joi.number().positive().optional(),
    salaryMax: Joi.number().positive().optional(),
    statusFilter: Joi.number().integer().optional(),
    // Additional parameters for flexibility
    category: Joi.string().optional(),
    company: Joi.string().optional(),
    datePosted: Joi.string().optional(),
    workType: Joi.string().optional()
});

// FIXED: Validation helper function with better error handling
export const validateRequest = <T>(schema: Joi.ObjectSchema, data: any): T => {
    const { error, value } = schema.validate(data, { 
        abortEarly: false,
        allowUnknown: true, // FIXED: Allow unknown properties for flexibility
        stripUnknown: true  // FIXED: Strip unknown properties instead of failing
    });
    
    if (error) {
        const details = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        throw new ValidationError('Validation failed', details);
    }
    
    return value as T;
};

// FIXED: Extract query parameters from request with better handling
export const extractQueryParams = (req: HttpRequest): QueryParams & PaginationParams => {
    const query = req.query;
    
    // Handle both 'search' and 'q' parameters for search functionality
    const searchParam = query.get('search') || query.get('q') || undefined;
    
    // FIXED: Better number parsing with fallbacks
    const parseNumber = (value: string | null, defaultValue: number): number => {
        if (!value) return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    };

    const parseBoolean = (value: string | null): boolean | undefined => {
        if (!value) return undefined;
        return value.toLowerCase() === 'true';
    };
    
    return {
        page: parseNumber(query.get('page'), 1),
        pageSize: Math.min(parseNumber(query.get('pageSize'), 20), 100), // Cap at 100
        sortBy: query.get('sortBy') || undefined,
        sortOrder: (query.get('sortOrder') as 'asc' | 'desc') || 'desc',
        search: searchParam,
        q: searchParam,  // Add 'q' parameter as well for compatibility
        filters: (() => {
            try {
                const filtersParam = query.get('filters');
                return filtersParam ? JSON.parse(filtersParam) : {};
            } catch {
                return {};
            }
        })(),
        // Add other common search parameters with safe parsing
        location: query.get('location') || undefined,
        // FIXED: include all filtering keys used by JobService
        jobTypeIds: (query.get('jobTypeIds') || undefined) as any,
        workplaceTypeIds: (query.get('workplaceTypeIds') || undefined) as any,
        department: query.get('department') || undefined,
        currencyId: (parseNumber(query.get('currencyId'), 0) || undefined) as any,
        experienceMin: (parseNumber(query.get('experienceMin'), 0) || undefined) as any,
        experienceMax: (parseNumber(query.get('experienceMax'), 0) || undefined) as any,
        postedWithinDays: (parseNumber(query.get('postedWithinDays'), 0) || undefined) as any,
        isRemote: parseBoolean(query.get('isRemote')),
        salaryMin: parseNumber(query.get('salaryMin'), 0) || undefined,
        salaryMax: parseNumber(query.get('salaryMax'), 0) || undefined,
        statusFilter: parseNumber(query.get('statusFilter'), 0) || undefined,
        category: query.get('category') || undefined,
        company: query.get('company') || undefined,
        datePosted: query.get('datePosted') || undefined,
        workType: query.get('workType') || undefined
    } as any;
};

// FIXED: Extract request body with better error handling
export const extractRequestBody = async (req: HttpRequest): Promise<any> => {
    try {
        const body = await req.text();
        if (!body || body.trim() === '') {
            return {};
        }
        return JSON.parse(body);
    } catch (error) {
        console.error('Error parsing request body:', error);
        throw new ValidationError('Invalid JSON in request body');
    }
};