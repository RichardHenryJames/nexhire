"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRequestBody = exports.extractQueryParams = exports.validateRequest = exports.jobApplicationsPaginationSchema = exports.paginationSchema = exports.jobApplicationSchema = exports.applicantProfileSchema = exports.organizationCreateSchema = exports.jobCreateSchema = exports.employerInitializeSchema = exports.userLoginSchema = exports.userRegistrationSchema = exports.errorResponse = exports.successResponse = exports.isValidGuid = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = void 0;
const joi_1 = __importDefault(require("joi"));
class ValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends Error {
    constructor(message = 'Authentication required') {
        super(message);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends Error {
    constructor(message = 'Insufficient permissions') {
        super(message);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends Error {
    constructor(message = 'Resource already exists') {
        super(message);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
// GUID validation utility - FIXED: Improved GUID validation
const isValidGuid = (value) => {
    if (!value || typeof value !== 'string')
        return false;
    // Remove any whitespace
    value = value.trim();
    // Check length first (performance optimization)
    if (value.length !== 36)
        return false;
    // FIXED: More comprehensive GUID regex
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return guidRegex.test(value);
};
exports.isValidGuid = isValidGuid;
// Response helpers
const successResponse = (data, message, meta) => ({
    success: true,
    data,
    message,
    meta
});
exports.successResponse = successResponse;
const errorResponse = (error, message) => ({
    success: false,
    error,
    message
});
exports.errorResponse = errorResponse;
// FIXED: Updated user registration schema to include organization details for employers
exports.userRegistrationSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
    firstName: joi_1.default.string().min(2).max(100).required(),
    lastName: joi_1.default.string().min(2).max(100).required(),
    userType: joi_1.default.string().valid('JobSeeker', 'Employer').required(),
    phone: joi_1.default.string().pattern(/^\+?[\d\s\-()]+$/).optional(),
    dateOfBirth: joi_1.default.date().max('now').optional(),
    gender: joi_1.default.string().valid('Male', 'Female', 'Other', 'Prefer not to say').optional(),
    // FIXED: Organization details for Employers (required when userType is 'Employer')
    organizationName: joi_1.default.when('userType', {
        is: 'Employer',
        then: joi_1.default.string().min(2).max(200).required(),
        otherwise: joi_1.default.optional()
    }),
    organizationIndustry: joi_1.default.when('userType', {
        is: 'Employer',
        then: joi_1.default.string().max(100).optional(),
        otherwise: joi_1.default.optional()
    }),
    organizationSize: joi_1.default.when('userType', {
        is: 'Employer',
        then: joi_1.default.string().valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+').optional(),
        otherwise: joi_1.default.optional()
    }),
    organizationWebsite: joi_1.default.when('userType', {
        is: 'Employer',
        then: joi_1.default.string().uri().optional(),
        otherwise: joi_1.default.optional()
    }),
    organizationDescription: joi_1.default.when('userType', {
        is: 'Employer',
        then: joi_1.default.string().min(20).max(1000).optional(),
        otherwise: joi_1.default.optional()
    }),
    organizationLocation: joi_1.default.when('userType', {
        is: 'Employer',
        then: joi_1.default.string().max(200).optional(),
        otherwise: joi_1.default.optional()
    }),
    organizationType: joi_1.default.when('userType', {
        is: 'Employer',
        then: joi_1.default.string().max(50).optional(),
        otherwise: joi_1.default.optional()
    }),
    establishedDate: joi_1.default.when('userType', {
        is: 'Employer',
        then: joi_1.default.date().max('now').optional(),
        otherwise: joi_1.default.optional()
    })
});
exports.userLoginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required()
});
// NEW: Schema for initializing employer for existing users
exports.employerInitializeSchema = joi_1.default.object({
    organizationName: joi_1.default.string().min(2).max(200).required(),
    organizationIndustry: joi_1.default.string().max(100).optional(),
    organizationSize: joi_1.default.string().valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+').optional(),
    organizationWebsite: joi_1.default.string().uri().allow('').optional(),
    organizationType: joi_1.default.string().max(50).optional(),
    jobTitle: joi_1.default.string().max(200).optional(),
    department: joi_1.default.string().max(100).optional(),
    linkedInProfile: joi_1.default.string().uri().allow('').optional(),
    bio: joi_1.default.string().max(1000).allow('').optional()
});
// FIXED: Updated job creation schema with flexible requirements
exports.jobCreateSchema = joi_1.default.object({
    title: joi_1.default.string().min(5).max(200).required(),
    jobTypeID: joi_1.default.number().integer().positive().optional().default(1), // Default to full-time
    level: joi_1.default.string().max(50).optional(),
    department: joi_1.default.string().max(100).optional(),
    description: joi_1.default.string().min(20).required(),
    responsibilities: joi_1.default.string().optional(),
    requirements: joi_1.default.string().min(10).optional(), // Made optional with shorter min length
    preferredQualifications: joi_1.default.string().optional(),
    benefitsOffered: joi_1.default.string().optional(),
    location: joi_1.default.string().max(200).optional(),
    country: joi_1.default.string().max(100).optional(),
    state: joi_1.default.string().max(100).optional(),
    city: joi_1.default.string().max(100).optional(),
    postalCode: joi_1.default.string().max(20).optional(),
    isRemote: joi_1.default.boolean().default(false),
    workplaceType: joi_1.default.string().valid('On-site', 'Hybrid', 'Remote').optional(),
    remoteRestrictions: joi_1.default.string().max(200).optional(),
    salaryRangeMin: joi_1.default.number().positive().optional(),
    salaryRangeMax: joi_1.default.number().positive().optional(),
    currencyID: joi_1.default.number().integer().positive().optional().default(1), // Default to USD
    salaryPeriod: joi_1.default.string().valid('Annual', 'Monthly', 'Hourly').optional().default('Annual'),
    compensationType: joi_1.default.string().valid('Salary', 'Contract', 'Commission').optional().default('Salary'),
    bonusDetails: joi_1.default.string().max(300).optional(),
    equityOffered: joi_1.default.string().max(100).optional(),
    projectDuration: joi_1.default.string().max(50).optional(),
    projectStartDate: joi_1.default.date().optional(),
    projectEndDate: joi_1.default.date().optional(),
    projectBudget: joi_1.default.number().positive().optional(),
    contractExtensionPossible: joi_1.default.boolean().optional(),
    contractConversionPossible: joi_1.default.boolean().optional(),
    experienceMin: joi_1.default.number().integer().min(0).optional(),
    experienceMax: joi_1.default.number().integer().min(0).optional(),
    experienceLevel: joi_1.default.string().valid('Entry', 'Mid', 'Senior', 'Lead', 'Executive').optional(),
    requiredCertifications: joi_1.default.string().max(100).optional(),
    requiredEducation: joi_1.default.string().max(200).optional(),
    priority: joi_1.default.string().valid('Normal', 'High', 'Urgent').default('Normal'),
    visibility: joi_1.default.string().valid('Public', 'Private', 'Internal').default('Public'),
    applicationDeadline: joi_1.default.date().min('now').optional(),
    targetHiringDate: joi_1.default.date().min('now').optional(),
    maxApplications: joi_1.default.number().integer().positive().optional(),
    interviewStages: joi_1.default.string().max(100).optional(),
    interviewProcess: joi_1.default.string().max(100).optional(),
    assessmentRequired: joi_1.default.boolean().default(false),
    assessmentDetails: joi_1.default.string().optional(),
    timeZone: joi_1.default.string().max(50).optional(),
    language: joi_1.default.string().max(50).default('English'),
    tags: joi_1.default.string().max(100).optional(),
    internalNotes: joi_1.default.string().max(100).optional()
});
exports.organizationCreateSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(200).required(),
    type: joi_1.default.string().max(50).optional(),
    industry: joi_1.default.string().max(100).optional(),
    size: joi_1.default.string().valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+').optional(),
    website: joi_1.default.string().uri().optional(),
    linkedInProfile: joi_1.default.string().uri().optional(),
    description: joi_1.default.string().min(20).optional(),
    logoURL: joi_1.default.string().uri().optional(),
    establishedDate: joi_1.default.date().max('now').optional()
});
exports.applicantProfileSchema = joi_1.default.object({
    nationality: joi_1.default.string().max(100).optional(),
    currentLocation: joi_1.default.string().max(200).optional(),
    preferredLocations: joi_1.default.string().max(100).optional(),
    linkedInProfile: joi_1.default.string().uri().optional(),
    portfolioURL: joi_1.default.string().uri().optional(),
    githubProfile: joi_1.default.string().uri().optional(),
    headline: joi_1.default.string().max(200).optional(),
    summary: joi_1.default.string().min(50).optional(),
    currentJobTitle: joi_1.default.string().max(200).optional(),
    currentCompany: joi_1.default.string().max(200).optional(),
    yearsOfExperience: joi_1.default.number().min(0).max(50).optional(),
    preferredJobTypes: joi_1.default.string().max(100).optional(),
    preferredWorkTypes: joi_1.default.string().max(100).optional(),
    expectedSalaryMin: joi_1.default.number().positive().optional(),
    expectedSalaryMax: joi_1.default.number().positive().optional(),
    preferredCurrency: joi_1.default.number().integer().positive().optional(),
    noticePeriod: joi_1.default.number().integer().min(0).max(365).optional(),
    immediatelyAvailable: joi_1.default.boolean().default(false),
    willingToRelocate: joi_1.default.boolean().default(false),
    preferredRoles: joi_1.default.string().optional(),
    primarySkills: joi_1.default.string().min(10).optional(),
    secondarySkills: joi_1.default.string().optional(),
    languages: joi_1.default.string().optional(),
    certifications: joi_1.default.string().optional(),
    highestEducation: joi_1.default.string().max(100).optional(),
    fieldOfStudy: joi_1.default.string().max(200).optional(),
    education: joi_1.default.string().optional(),
    workExperience: joi_1.default.string().optional(),
    allowRecruitersToContact: joi_1.default.boolean().default(true),
    hideCurrentCompany: joi_1.default.boolean().default(false),
    hideSalaryDetails: joi_1.default.boolean().default(false),
    isOpenToWork: joi_1.default.boolean().default(true),
    jobSearchStatus: joi_1.default.string().valid('Actively Looking', 'Open to Opportunities', 'Not Looking').optional(),
    preferredIndustries: joi_1.default.string().optional(),
    minimumSalary: joi_1.default.number().positive().optional(),
    preferredCompanySize: joi_1.default.string().optional(),
    tags: joi_1.default.string().optional()
});
// FIXED: Updated job application schema with more flexible validation
exports.jobApplicationSchema = joi_1.default.object({
    jobID: joi_1.default.string().guid().required(),
    coverLetter: joi_1.default.string().min(20).optional(), // Reduced minimum length
    expectedSalary: joi_1.default.number().positive().optional(),
    expectedCurrencyID: joi_1.default.number().integer().positive().optional(),
    availableFromDate: joi_1.default.date().min('now').optional(),
    // FIXED: Add availabilityDate field that was causing validation error
    availabilityDate: joi_1.default.date().min('now').optional(),
    resumeURL: joi_1.default.string().uri().optional()
});
// FIXED: Updated pagination schema to allow more parameters
exports.paginationSchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    pageSize: joi_1.default.number().integer().min(1).max(100).default(20),
    sortBy: joi_1.default.string().optional(),
    sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc')
});
// FIXED: New extended pagination schema for job applications with all search parameters
exports.jobApplicationsPaginationSchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    pageSize: joi_1.default.number().integer().min(1).max(100).default(20),
    sortBy: joi_1.default.string().optional(),
    sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc'),
    // FIXED: Add all the parameters that were being rejected
    search: joi_1.default.string().optional(),
    q: joi_1.default.string().optional(),
    filters: joi_1.default.object().optional(),
    location: joi_1.default.string().optional(),
    jobType: joi_1.default.string().optional(),
    experienceLevel: joi_1.default.string().optional(),
    isRemote: joi_1.default.boolean().optional(),
    salaryMin: joi_1.default.number().positive().optional(),
    salaryMax: joi_1.default.number().positive().optional(),
    statusFilter: joi_1.default.number().integer().optional(),
    // Additional parameters for flexibility
    category: joi_1.default.string().optional(),
    company: joi_1.default.string().optional(),
    datePosted: joi_1.default.string().optional(),
    workType: joi_1.default.string().optional()
});
// FIXED: Validation helper function with better error handling
const validateRequest = (schema, data) => {
    const { error, value } = schema.validate(data, {
        abortEarly: false,
        allowUnknown: true, // FIXED: Allow unknown properties for flexibility
        stripUnknown: true // FIXED: Strip unknown properties instead of failing
    });
    if (error) {
        const details = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        throw new ValidationError('Validation failed', details);
    }
    return value;
};
exports.validateRequest = validateRequest;
// FIXED: Extract query parameters from request with better handling
const extractQueryParams = (req) => {
    const query = req.query;
    // Handle both 'search' and 'q' parameters for search functionality
    const searchParam = query.get('search') || query.get('q') || undefined;
    // FIXED: Better number parsing with fallbacks
    const parseNumber = (value, defaultValue) => {
        if (!value)
            return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    };
    const parseBoolean = (value) => {
        if (!value)
            return undefined;
        return value.toLowerCase() === 'true';
    };
    return {
        page: parseNumber(query.get('page'), 1),
        pageSize: Math.min(parseNumber(query.get('pageSize'), 20), 100), // Cap at 100
        sortBy: query.get('sortBy') || undefined,
        sortOrder: query.get('sortOrder') || 'desc',
        search: searchParam,
        q: searchParam, // Add 'q' parameter as well for compatibility
        filters: (() => {
            try {
                const filtersParam = query.get('filters');
                return filtersParam ? JSON.parse(filtersParam) : {};
            }
            catch {
                return {};
            }
        })(),
        // Add other common search parameters with safe parsing
        location: query.get('location') || undefined,
        jobType: query.get('jobType') || undefined,
        experienceLevel: query.get('experienceLevel') || undefined,
        isRemote: parseBoolean(query.get('isRemote')),
        salaryMin: parseNumber(query.get('salaryMin'), 0) || undefined,
        salaryMax: parseNumber(query.get('salaryMax'), 0) || undefined,
        statusFilter: parseNumber(query.get('statusFilter'), 0) || undefined,
        category: query.get('category') || undefined,
        company: query.get('company') || undefined,
        datePosted: query.get('datePosted') || undefined,
        workType: query.get('workType') || undefined
    };
};
exports.extractQueryParams = extractQueryParams;
// FIXED: Extract request body with better error handling
const extractRequestBody = async (req) => {
    try {
        const body = await req.text();
        if (!body || body.trim() === '') {
            return {};
        }
        return JSON.parse(body);
    }
    catch (error) {
        console.error('Error parsing request body:', error);
        throw new ValidationError('Invalid JSON in request body');
    }
};
exports.extractRequestBody = extractRequestBody;
//# sourceMappingURL=validation.js.map