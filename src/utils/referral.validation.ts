/**
 * Referral System Validation Schemas
 * Joi validation schemas for referral API requests
 */

import Joi from 'joi';

// ===== REFERRAL REQUEST SCHEMAS =====

export const createReferralRequestSchema = Joi.object({
    jobID: Joi.string().uuid().required().messages({
        'string.uuid': 'Job ID must be a valid UUID',
        'any.required': 'Job ID is required'
    }),
    resumeID: Joi.string().uuid().required().messages({
        'string.uuid': 'Resume ID must be a valid UUID',
        'any.required': 'Resume ID is required'
    })
});

export const claimReferralRequestSchema = Joi.object({
    requestID: Joi.string().uuid().required().messages({
        'string.uuid': 'Request ID must be a valid UUID',
        'any.required': 'Request ID is required'
    })
});

export const submitReferralProofSchema = Joi.object({
    requestID: Joi.string().uuid().required().messages({
        'string.uuid': 'Request ID must be a valid UUID',
        'any.required': 'Request ID is required'
    }),
    fileURL: Joi.string().uri().required().messages({
        'string.uri': 'File URL must be a valid URL',
        'any.required': 'File URL is required'
    }),
    fileType: Joi.string().valid('image/jpeg', 'image/png', 'image/gif', 'application/pdf').required().messages({
        'any.only': 'File type must be JPEG, PNG, GIF, or PDF',
        'any.required': 'File type is required'
    })
});

export const verifyReferralSchema = Joi.object({
    requestID: Joi.string().uuid().required().messages({
        'string.uuid': 'Request ID must be a valid UUID',
        'any.required': 'Request ID is required'
    }),
    verified: Joi.boolean().required().messages({
        'any.required': 'Verification status is required'
    })
});

// ===== PLAN PURCHASE SCHEMA =====

export const purchaseReferralPlanSchema = Joi.object({
    planID: Joi.number().integer().positive().required().messages({
        'number.base': 'Plan ID must be a number',
        'number.integer': 'Plan ID must be an integer',
        'number.positive': 'Plan ID must be positive',
        'any.required': 'Plan ID is required'
    }),
    paymentToken: Joi.string().optional().messages({
        'string.base': 'Payment token must be a string'
    })
});

// ===== FILTER SCHEMAS =====

export const referralRequestsFilterSchema = Joi.object({
    status: Joi.string().valid('Pending', 'Claimed', 'Completed', 'Verified').optional(),
    jobTitle: Joi.string().max(200).optional(),
    companyName: Joi.string().max(200).optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional()
});

// ===== PAGINATION SCHEMA (Extends existing) =====

export const referralPaginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('RequestedAt', 'Status', 'JobTitle', 'CompanyName').default('RequestedAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// ===== APPLICANT PROFILE UPDATE SCHEMA =====

export const updateReferralPreferencesSchema = Joi.object({
    openToRefer: Joi.boolean().optional().messages({
        'boolean.base': 'Open to refer must be true or false'
    }),
    emailOnNewRequests: Joi.boolean().optional(),
    emailOnClaimed: Joi.boolean().optional(),
    emailOnCompleted: Joi.boolean().optional(),
    pushNotifications: Joi.boolean().optional()
});

// ===== BULK OPERATIONS SCHEMAS =====

export const bulkClaimSchema = Joi.object({
    requestIDs: Joi.array().items(
        Joi.string().uuid().required()
    ).min(1).max(10).required().messages({
        'array.min': 'At least one request ID is required',
        'array.max': 'Maximum 10 requests can be claimed at once',
        'any.required': 'Request IDs array is required'
    })
});

// ===== SEARCH SCHEMA =====

export const searchReferralRequestsSchema = Joi.object({
    query: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'Search query must be at least 2 characters',
        'string.max': 'Search query must not exceed 100 characters'
    }),
    filters: referralRequestsFilterSchema.optional(),
    pagination: referralPaginationSchema.optional()
});

// ===== NOTIFICATION PREFERENCES SCHEMA =====

export const referralNotificationSettingsSchema = Joi.object({
    emailOnNewRequests: Joi.boolean().default(true),
    emailOnClaimed: Joi.boolean().default(true),
    emailOnCompleted: Joi.boolean().default(true),
    pushNotifications: Joi.boolean().default(true),
    dailyDigest: Joi.boolean().default(false),
    weeklyReport: Joi.boolean().default(false)
});

// ===== EXPORT ALL SCHEMAS =====

export const referralValidationSchemas = {
    createReferralRequest: createReferralRequestSchema,
    claimReferralRequest: claimReferralRequestSchema,
    submitReferralProof: submitReferralProofSchema,
    verifyReferral: verifyReferralSchema,
    purchaseReferralPlan: purchaseReferralPlanSchema,
    referralRequestsFilter: referralRequestsFilterSchema,
    referralPagination: referralPaginationSchema,
    updateReferralPreferences: updateReferralPreferencesSchema,
    bulkClaim: bulkClaimSchema,
    searchReferralRequests: searchReferralRequestsSchema,
    referralNotificationSettings: referralNotificationSettingsSchema
};

// ===== VALIDATION HELPER FUNCTIONS =====

/**
 * Validate referral request creation data
 */
export function validateCreateReferralRequest(data: any) {
    const { error, value } = createReferralRequestSchema.validate(data);
    if (error) {
        throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
}

/**
 * Validate plan purchase data
 */
export function validatePurchaseReferralPlan(data: any) {
    const { error, value } = purchaseReferralPlanSchema.validate(data);
    if (error) {
        throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
}

/**
 * Validate referral filters
 */
export function validateReferralFilters(data: any) {
    const { error, value } = referralRequestsFilterSchema.validate(data);
    if (error) {
        throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
}

/**
 * Validate pagination parameters
 */
export function validateReferralPagination(data: any) {
    const { error, value } = referralPaginationSchema.validate(data);
    if (error) {
        throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
}

/**
 * Check if status is valid referral status
 */
export function isValidReferralStatus(status: string): boolean {
    return ['Pending', 'Claimed', 'Completed', 'Verified'].includes(status);
}

/**
 * Check if referral plan type is valid
 */
export function isValidPlanType(planType: string): boolean {
    return ['Free', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Biannual', 'Lifetime'].includes(planType);
}