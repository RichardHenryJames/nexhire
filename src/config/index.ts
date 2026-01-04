// Database Configuration
export const dbConfig = {
    server: process.env.DB_SERVER || 'refopen-sql-srv.database.windows.net',
    database: process.env.DB_NAME || 'refopen-sql-db',
    user: process.env.DB_USER || 'sqladmin',
    password: process.env.DB_PASSWORD || '',  // REQUIRED: Set via environment variable
    options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 60000,
        requestTimeout: 60000,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    }
};

// JWT Configuration
export const jwtConfig = {
    secret: process.env.JWT_SECRET || 'refopen-super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
};

// Azure Blob Storage Configuration
export const blobConfig = {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    containerName: process.env.BLOB_CONTAINER_NAME || 'refopen-files'
};

// API Configuration
export const apiConfig = {
    port: process.env.PORT || 7071,
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'https://refopen-frontend-web.azurestaticapps.net'],
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    }
};

// Email Configuration
export const emailConfig = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@refopen.com'
};

// Application Constants
export const appConstants = {
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