"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConstants = exports.emailConfig = exports.apiConfig = exports.blobConfig = exports.jwtConfig = exports.dbConfig = void 0;
// Database Configuration
exports.dbConfig = {
    server: process.env.DB_SERVER || 'nexhire-sql-srv.database.windows.net',
    database: process.env.DB_NAME || 'nexhire-sql-db',
    user: process.env.DB_USER || 'sqladmin',
    password: process.env.DB_PASSWORD || 'P@ssw0rd1234!',
    options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 30000,
        requestTimeout: 30000,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    }
};
// JWT Configuration
exports.jwtConfig = {
    secret: process.env.JWT_SECRET || 'nexhire-super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};
// Azure Blob Storage Configuration
exports.blobConfig = {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    containerName: process.env.BLOB_CONTAINER_NAME || 'nexhire-files'
};
// API Configuration
exports.apiConfig = {
    port: process.env.PORT || 7071,
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'https://nexhire-frontend-web.azurestaticapps.net'],
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    }
};
// Email Configuration
exports.emailConfig = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@nexhire.com'
};
// Application Constants
exports.appConstants = {
    defaultPageSize: 20,
    maxPageSize: 100,
    supportedFileTypes: ['pdf', 'doc', 'docx'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    passwordMinLength: 8,
    tokenTypes: {
        ACCESS: 'access',
        REFRESH: 'refresh',
        EMAIL_VERIFICATION: 'email_verification',
        PASSWORD_RESET: 'password_reset'
    },
    userTypes: {
        JOB_SEEKER: 'JobSeeker',
        EMPLOYER: 'Employer',
        ADMIN: 'Admin'
    },
    jobStatuses: {
        DRAFT: 'Draft',
        PUBLISHED: 'Published',
        CLOSED: 'Closed'
    },
    applicationStatuses: {
        SUBMITTED: 1,
        UNDER_REVIEW: 2,
        SHORTLISTED: 3,
        INTERVIEW_SCHEDULED: 4,
        INTERVIEW_COMPLETED: 5,
        REJECTED: 6
    }
};
//# sourceMappingURL=index.js.map