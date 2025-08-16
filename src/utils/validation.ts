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

// Validation schemas
export const userRegistrationSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(100).required(),
    lastName: Joi.string().min(2).max(100).required(),
    userType: Joi.string().valid('JobSeeker', 'Employer').required(),
    phone: Joi.string().pattern(/^\+?[\d\s\-()]+$/).optional(),
    dateOfBirth: Joi.date().max('now').optional(),
    gender: Joi.string().valid('Male', 'Female', 'Other', 'Prefer not to say').optional()
});

export const userLoginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

export const jobCreateSchema = Joi.object({
    title: Joi.string().min(5).max(200).required(),
    jobTypeID: Joi.number().integer().positive().required(),
    level: Joi.string().max(50).optional(),
    department: Joi.string().max(100).optional(),
    description: Joi.string().min(50).required(),
    responsibilities: Joi.string().optional(),
    requirements: Joi.string().min(20).required(),
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
    currencyID: Joi.number().integer().positive().optional(),
    salaryPeriod: Joi.string().valid('Annual', 'Monthly', 'Hourly').optional(),
    compensationType: Joi.string().valid('Salary', 'Contract', 'Commission').optional(),
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
    isOpenToWork: Joi.boolean().default(true),
    jobSearchStatus: Joi.string().valid('Actively Looking', 'Open to Opportunities', 'Not Looking').optional(),
    preferredIndustries: Joi.string().optional(),
    minimumSalary: Joi.number().positive().optional(),
    preferredCompanySize: Joi.string().optional(),
    tags: Joi.string().optional()
});

export const jobApplicationSchema = Joi.object({
    jobID: Joi.string().guid().required(),
    coverLetter: Joi.string().min(50).optional(),
    expectedSalary: Joi.number().positive().optional(),
    expectedCurrencyID: Joi.number().integer().positive().optional(),
    availableFromDate: Joi.date().min('now').optional()
});

export const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Validation helper function with proper typing
export const validateRequest = <T>(schema: Joi.ObjectSchema, data: any): T => {
    const { error, value } = schema.validate(data, { abortEarly: false });
    
    if (error) {
        const details = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        throw new ValidationError('Validation failed', details);
    }
    
    return value as T;
};

// Extract query parameters from request - FIXED: Handle both 'search' and 'q' parameters
export const extractQueryParams = (req: HttpRequest): QueryParams & PaginationParams => {
    const query = req.query;
    
    // Handle both 'search' and 'q' parameters for search functionality
    const searchParam = query.get('search') || query.get('q') || undefined;
    
    return {
        page: parseInt(query.get('page') || '1'),
        pageSize: parseInt(query.get('pageSize') || '20'),
        sortBy: query.get('sortBy') || undefined,
        sortOrder: (query.get('sortOrder') as 'asc' | 'desc') || 'desc',
        search: searchParam,
        q: searchParam,  // Add 'q' parameter as well for compatibility
        filters: (() => {
            try {
                return JSON.parse(query.get('filters') || '{}');
            } catch {
                return {};
            }
        })(),
        // Add other common search parameters
        location: query.get('location') || undefined,
        jobType: query.get('jobType') || undefined,
        experienceLevel: query.get('experienceLevel') || undefined,
        isRemote: query.get('isRemote') ? query.get('isRemote') === 'true' : undefined,
        salaryMin: query.get('salaryMin') ? parseInt(query.get('salaryMin')!) : undefined,
        salaryMax: query.get('salaryMax') ? parseInt(query.get('salaryMax')!) : undefined
    };
};

// Extract request body
export const extractRequestBody = async (req: HttpRequest): Promise<any> => {
    try {
        const body = await req.text();
        return body ? JSON.parse(body) : {};
    } catch (error) {
        throw new ValidationError('Invalid JSON in request body');
    }
};