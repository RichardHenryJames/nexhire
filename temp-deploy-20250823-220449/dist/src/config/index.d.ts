export declare const dbConfig: {
    server: string;
    database: string;
    user: string;
    password: string;
    options: {
        encrypt: boolean;
        trustServerCertificate: boolean;
        connectTimeout: number;
        requestTimeout: number;
        pool: {
            max: number;
            min: number;
            idleTimeoutMillis: number;
        };
    };
};
export declare const jwtConfig: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
};
export declare const blobConfig: {
    connectionString: string;
    containerName: string;
};
export declare const apiConfig: {
    port: string | number;
    corsOrigins: string[];
    rateLimit: {
        windowMs: number;
        max: number;
    };
};
export declare const emailConfig: {
    service: string;
    user: string;
    password: string;
    from: string;
};
export declare const appConstants: {
    defaultPageSize: number;
    maxPageSize: number;
    supportedFileTypes: string[];
    maxFileSize: number;
    passwordMinLength: number;
    tokenTypes: {
        ACCESS: string;
        REFRESH: string;
        EMAIL_VERIFICATION: string;
        PASSWORD_RESET: string;
    };
    userTypes: {
        JOB_SEEKER: string;
        EMPLOYER: string;
        ADMIN: string;
    };
    jobStatuses: {
        DRAFT: string;
        PUBLISHED: string;
        CLOSED: string;
    };
    applicationStatuses: {
        SUBMITTED: number;
        UNDER_REVIEW: number;
        SHORTLISTED: number;
        INTERVIEW_SCHEDULED: number;
        INTERVIEW_COMPLETED: number;
        REJECTED: number;
    };
};
//# sourceMappingURL=index.d.ts.map