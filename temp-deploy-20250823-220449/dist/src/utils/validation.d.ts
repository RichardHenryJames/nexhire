import { HttpRequest } from '@azure/functions';
import Joi from 'joi';
import { ApiResponse, PaginationParams, QueryParams } from '../types';
export declare class ValidationError extends Error {
    details?: any | undefined;
    constructor(message: string, details?: any | undefined);
}
export declare class AuthenticationError extends Error {
    constructor(message?: string);
}
export declare class AuthorizationError extends Error {
    constructor(message?: string);
}
export declare class NotFoundError extends Error {
    constructor(message?: string);
}
export declare class ConflictError extends Error {
    constructor(message?: string);
}
export declare const isValidGuid: (value: string) => boolean;
export declare const successResponse: <T>(data: T, message?: string, meta?: any) => ApiResponse<T>;
export declare const errorResponse: (error: string, message?: string) => ApiResponse;
export declare const userRegistrationSchema: Joi.ObjectSchema<any>;
export declare const userLoginSchema: Joi.ObjectSchema<any>;
export declare const employerInitializeSchema: Joi.ObjectSchema<any>;
export declare const jobCreateSchema: Joi.ObjectSchema<any>;
export declare const organizationCreateSchema: Joi.ObjectSchema<any>;
export declare const applicantProfileSchema: Joi.ObjectSchema<any>;
export declare const jobApplicationSchema: Joi.ObjectSchema<any>;
export declare const paginationSchema: Joi.ObjectSchema<any>;
export declare const jobApplicationsPaginationSchema: Joi.ObjectSchema<any>;
export declare const validateRequest: <T>(schema: Joi.ObjectSchema, data: any) => T;
export declare const extractQueryParams: (req: HttpRequest) => QueryParams & PaginationParams;
export declare const extractRequestBody: (req: HttpRequest) => Promise<any>;
//# sourceMappingURL=validation.d.ts.map