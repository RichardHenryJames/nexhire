import { dbService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { Job, PaginationParams, QueryParams, JobCreateRequest } from '../types';
import {
    ValidationError,
    NotFoundError,
    validateRequest,
    jobCreateSchema,
    paginationSchema
} from '../utils/validation';
import { appConstants } from '../config';

// Pagination caps
const MAX_PAGE_SIZE = 100;
const MAX_UNPAGED_TOTAL = 500; // only allow all=true when total <= this

export class JobService {
    // Create new job (schema-aligned with database) - unchanged
    static async createJob(jobData: any, postedByUserID: string, organizationID: string): Promise<Job> {
        // 1. Validate and normalize input
        const validated = validateRequest<JobCreateRequest>(jobCreateSchema, jobData);

        // 2. Resolve / derive required DB columns that are NOT part of request
        // Department NOT NULL in DB – fallback if not provided
        const department = validated.department?.trim() || 'General';
        // Location NOT NULL – fallback if missing (prefer explicit location else remote marker)
        const location = validated.location?.trim() || (validated.isRemote ? 'Remote' : 'Unspecified');
        // WorkplaceTypeID (FK) from textual workplaceType (optional). Default to 1 (Onsite) if not found
        let workplaceTypeId: number = 1;
        if (validated.workplaceType) {
            const wtQuery = 'SELECT WorkplaceTypeID FROM WorkplaceTypes WHERE Type = @param0';
            const wtResult = await dbService.executeQuery(wtQuery, [validated.workplaceType]);
            if (wtResult.recordset && wtResult.recordset.length > 0) {
                workplaceTypeId = wtResult.recordset[0].WorkplaceTypeID;
            }
        }
        // ExternalJobID (NOT NULL): prefix to distinguish manually posted jobs
        const jobId = AuthService.generateUniqueId();
        const externalJobId = `USR_${jobId.substring(0, 8)}`;

        // 3. Build the insert dynamically ONLY with columns that exist in Jobs table
        //    Avoid old / non-existent columns like Level, PreferredQualifications, ExperienceLevel, Language, WorkplaceType (text)
        const fields: string[] = [];
        const values: any[] = [];
        const add = (column: string, value: any) => { fields.push(column); values.push(value); };

        // Required/base columns
        add('JobID', jobId);
        add('OrganizationID', organizationID);
        add('PostedByUserID', postedByUserID);
        add('PostedByType', 1); // 1 = User posted
        add('Title', validated.title);
        add('JobTypeID', validated.jobTypeID || 1);
        add('WorkplaceTypeID', workplaceTypeId);
        add('Department', department);
        add('Description', validated.description);
        add('Location', location);
        add('ExternalJobID', externalJobId);

        // Optional (present in DB schema)
        const opt = (col: string, val: any) => { if (val !== undefined && val !== null && val !== '') add(col, val); };
        opt('Responsibilities', validated.responsibilities);
        opt('BenefitsOffered', validated.benefitsOffered);
        opt('Country', validated.country);
        opt('State', validated.state);
        opt('City', validated.city);
        opt('PostalCode', validated.postalCode);
        opt('IsRemote', validated.isRemote ? 1 : 0);
        opt('RemoteRestrictions', validated.remoteRestrictions);
        opt('SalaryRangeMin', validated.salaryRangeMin);
        opt('SalaryRangeMax', validated.salaryRangeMax);
        opt('CurrencyID', validated.currencyID);
        opt('SalaryPeriod', validated.salaryPeriod);
        opt('CompensationType', validated.compensationType);
        opt('BonusDetails', validated.bonusDetails);
        opt('EquityOffered', validated.equityOffered);
        opt('ProjectDuration', validated.projectDuration);
        opt('ProjectStartDate', validated.projectStartDate);
        opt('ProjectEndDate', validated.projectEndDate);
        opt('ProjectBudget', validated.projectBudget);
        opt('ContractExtensionPossible', validated.contractExtensionPossible);
        opt('ContractConversionPossible', validated.contractConversionPossible);
        opt('ExperienceMin', validated.experienceMin);
        opt('ExperienceMax', validated.experienceMax);
        opt('RequiredCertifications', validated.requiredCertifications);
        opt('RequiredEducation', validated.requiredEducation);
        opt('Priority', validated.priority);
        opt('Visibility', validated.visibility);
        opt('ApplicationDeadline', validated.applicationDeadline);
        opt('TargetHiringDate', validated.targetHiringDate);
        opt('MaxApplications', validated.maxApplications);
        opt('InterviewStages', validated.interviewStages);
        opt('InterviewProcess', validated.interviewProcess);
        opt('AssessmentRequired', validated.assessmentRequired);
        opt('AssessmentDetails', validated.assessmentDetails);
        opt('TimeZone', validated.timeZone);
        opt('Tags', validated.tags);
        opt('InternalNotes', validated.internalNotes);
        // Status: start as Draft (explicit for clarity)
        add('Status', 'Draft');
        // CurrentApplications default 0
        add('CurrentApplications', 0);

        // 4. Build parameter placeholders
        const placeholders = fields.map((_, i) => `@param${i}`);
        const insertQuery = `
            INSERT INTO Jobs (${fields.join(', ')})
            VALUES (${placeholders.join(', ')});
            SELECT j.*, jt.Type as JobTypeName, o.Name as OrganizationName
            FROM Jobs j
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            WHERE j.JobID = @param0;
        `;

        try {
            const result = await dbService.executeQuery<Job>(insertQuery, values);
            if (!result.recordset || result.recordset.length === 0) {
                throw new Error('Failed to create job');
            }
            return result.recordset[0];
        } catch (err: any) {
            // Provide clearer diagnostics for schema mismatch
            if (err?.message?.includes('Invalid column name')) {
                console.error('? Job creation failed due to schema mismatch. Columns attempted:', fields);
            }
            throw err;
        }
    }

    // Get all jobs with filtering and pagination (page-based only) - OPTIMIZED for performance
    static async getJobs(params: PaginationParams & QueryParams & any): Promise<{ jobs: Job[]; total: number; totalPages: number; hasMore: boolean; nextCursor: any | null }> {
        const { page, pageSize, excludeUserApplications } = params;
        let { sortBy = 'PublishedAt', sortOrder = 'desc', search, filters } = params as any;
        const f = { ...(filters || {}), ...params } as any;

        // 🚀 OPTIMIZATION: Default to PublishedAt for better index usage
        const allowedSort: Record<string, string> = {
            CreatedAt: 'j.CreatedAt',
            UpdatedAt: 'j.UpdatedAt',
            PublishedAt: 'j.PublishedAt',
            Title: 'j.Title',
            SalaryRangeMin: 'j.SalaryRangeMin',
            SalaryRangeMax: 'j.SalaryRangeMax'
        };
        const normalizedSort = sortBy && allowedSort[sortBy] ? allowedSort[sortBy] : 'j.PublishedAt';
        const normalizedOrder = (sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // 🚀 OPTIMIZATION: Status filter first for better index usage
        let whereClause = "WHERE j.Status = 'Published'";
        const queryParams: any[] = [];
        let paramIndex = 0;

        // 🚀 OPTIMIZATION: Default to last 30 days unless user specifies otherwise
        if (!f.postedWithinDays) {
            const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            whereClause += ` AND j.PublishedAt >= @param${paramIndex}`;
            queryParams.push(cutoffDate);
            paramIndex++;
        }

        // 🚀 OPTIMIZATION: Add most selective filters first for better query plan
        // Workplace Type filter (very selective)
        if (f.workplaceTypeIds) {
            const workplaceTypeStr = String(f.workplaceTypeIds).trim();
            if (workplaceTypeStr) {
                const ids = workplaceTypeStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                if (ids.length > 0) {
                    const placeholders = ids.map((_, i) => `@param${paramIndex + i}`).join(',');
                    whereClause += ` AND j.WorkplaceTypeID IN (${placeholders})`;
                    queryParams.push(...ids);
                    paramIndex += ids.length;
                }
            }
        }

        // Job Type filter (very selective)
        if (f.jobTypeIds) {
            const jobTypeStr = String(f.jobTypeIds).trim();
            if (jobTypeStr) {
                const ids = jobTypeStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                if (ids.length > 0) {
                    const placeholders = ids.map((_, i) => `@param${paramIndex + i}`).join(',');
                    whereClause += ` AND j.JobTypeID IN (${placeholders})`;
                    queryParams.push(...ids);
                    paramIndex += ids.length;
                }
            }
        }

        // IsRemote filter (selective)
        if (f.isRemote !== undefined) {
            whereClause += ` AND j.IsRemote = @param${paramIndex}`;
            queryParams.push(Boolean(f.isRemote) ? 1 : 0);
            paramIndex++;
        }

        // User-specific filtering to exclude applied jobs ONLY (not saved jobs)
        if (excludeUserApplications) {
            whereClause += ` AND NOT EXISTS (
                SELECT 1 FROM JobApplications ja
                INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
                WHERE a.UserID = @param${paramIndex} 
                    AND ja.StatusID != 6
                    AND ja.JobID = j.JobID
            )`;
            queryParams.push(excludeUserApplications);
            paramIndex += 1;
        }

        // 🚀 OPTIMIZATION: Search term handling - Title, Location, Organization only
        const searchTerm = (search || f.search || f.q || '').toString().trim();
        if (searchTerm && searchTerm.length > 0) {
            if (searchTerm.length <= 4) {
                // For 1-4 character searches, use LIKE only on Title and Org Name (most relevant)
                whereClause += ` AND (j.Title LIKE @param${paramIndex} OR o.Name LIKE @param${paramIndex + 1})`;
                queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
                paramIndex += 2;
            } else {
                // For longer searches (5+ chars), use CONTAINS fulltext for all fields
                const tokens = searchTerm.split(/\s+/).filter(Boolean).slice(0, 10);
                const tokenClauses: string[] = [];

                // Search in Title, Location, City, Country, Organization using fulltext
                tokens.forEach(tok => {
                    tokenClauses.push(`CONTAINS((j.Title, j.Location, j.City, j.Country), @param${paramIndex})`);
                    queryParams.push(`${tok}*`);
                    paramIndex += 1;
                    
                    tokenClauses.push(`CONTAINS(o.Name, @param${paramIndex})`);
                    queryParams.push(`${tok}*`);
                    paramIndex += 1;
                });

                whereClause += ` AND (${tokenClauses.join(' OR ')})`;
            }
        }

        // Location filter
        if (f.location) {
            whereClause += ` AND (j.Location LIKE @param${paramIndex} OR j.City LIKE @param${paramIndex + 1} OR j.Country LIKE @param${paramIndex + 2})`;
            queryParams.push(`%${f.location}%`, `%${f.location}%`, `%${f.location}%`);
            paramIndex += 3;
        }

        // Department filter
        if (f.department) {
            whereClause += ` AND j.Department LIKE @param${paramIndex}`;
            queryParams.push(`%${f.department}%`);
            paramIndex++;
        }

        // Currency filter
        if (f.currencyId) {
            whereClause += ` AND j.CurrencyID = @param${paramIndex}`;
            queryParams.push(Number(f.currencyId));
            paramIndex++;
        }

        // 🚀 OPTIMIZATION: Experience filters - use range comparison
        if (f.experienceMin) {
            whereClause += ` AND (j.ExperienceMax IS NULL OR j.ExperienceMax >= @param${paramIndex})`;
            queryParams.push(Number(f.experienceMin));
            paramIndex++;
        }
        if (f.experienceMax) {
            whereClause += ` AND (j.ExperienceMin IS NULL OR j.ExperienceMin <= @param${paramIndex})`;
            queryParams.push(Number(f.experienceMax));
            paramIndex++;
        }

        // 🚀 OPTIMIZATION: Salary filters - use range comparison
        if (f.salaryMin) {
            whereClause += ` AND (j.SalaryRangeMax IS NULL OR j.SalaryRangeMax >= @param${paramIndex})`;
            queryParams.push(Number(f.salaryMin));
            paramIndex++;
        }
        if (f.salaryMax) {
            whereClause += ` AND (j.SalaryRangeMin IS NULL OR j.SalaryRangeMin <= @param${paramIndex})`;
            queryParams.push(Number(f.salaryMax));
            paramIndex++;
        }

        // Date filter
        if (f.postedWithinDays) {
            const cutoffDate = new Date(Date.now() - Number(f.postedWithinDays) * 24 * 60 * 60 * 1000);
            whereClause += ` AND j.PublishedAt >= @param${paramIndex}`;
            queryParams.push(cutoffDate);
            paramIndex++;
        }

        // 🚀 OPTIMIZATION: Count query with Organizations join for search
        const countQuery = `
            SELECT COUNT(*) as total
            FROM Jobs j
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            ${whereClause}
        `;

        const countResult = await dbService.executeQuery(countQuery, queryParams);
        const total = countResult.recordset?.[0]?.total || 0;
        if (total === 0) return { jobs: [], total: 0, totalPages: 1, hasMore: false, nextCursor: null };

        const requestedAll = (f.all === true || f.all === 'true' || f.all === 1 || f.all === '1' || Number(pageSize) <= 0);
        const allowUnpaged = requestedAll && total <= MAX_UNPAGED_TOTAL;
        const noPaging = !!allowUnpaged;
        const pageNum = Math.max(Number(page) || 1, 1);
        const pageSizeNum = Math.min(Math.max(Number(pageSize) || 20, 1), MAX_PAGE_SIZE);

        // 🚀 OPTIMIZATION: Select only needed columns (not j.* with large text fields)
        let dataQuery = `
            SELECT
                j.JobID, j.OrganizationID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
                j.Location, j.City, j.Country, j.IsRemote, j.SalaryRangeMin, j.SalaryRangeMax,
                j.CurrencyID, j.SalaryPeriod, j.ExperienceMin, j.ExperienceMax, j.PublishedAt, 
                j.CreatedAt, j.ApplicationDeadline, j.Status, j.Tags,
                jt.Type as JobTypeName,
                wt.Type as WorkplaceTypeName,
                o.Name as OrganizationName,
                ISNULL(o.LogoURL, '') as OrganizationLogo,
                ISNULL(c.Symbol, '$') as CurrencySymbol
            FROM Jobs j
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            LEFT JOIN WorkplaceTypes wt ON j.WorkplaceTypeID = wt.WorkplaceTypeID
            LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
            ${whereClause}
        `;

        const totalPages = noPaging ? 1 : Math.max(Math.ceil(total / pageSizeNum), 1);
        const dataParams: any[] = [...queryParams];

        if (!noPaging) {
            const offset = (pageNum - 1) * pageSizeNum;
            // 🚀 OPTIMIZATION: Use indexed PublishedAt column for sorting
            dataQuery += ` ORDER BY ${normalizedSort} ${normalizedOrder}, j.JobID ${normalizedOrder} 
                          OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY
                          OPTION (OPTIMIZE FOR (@param${paramIndex} = 0))`;
            dataParams.push(offset, pageSizeNum);
            paramIndex += 2;
        } else {
            dataQuery += ` ORDER BY ${normalizedSort} ${normalizedOrder}, j.JobID ${normalizedOrder}`;
        }

        const dataResult = await dbService.executeQuery<Job>(dataQuery, dataParams);
        const rows = dataResult.recordset || [];

        // Page-based hasMore logic
        const hasMore = !noPaging && rows.length === pageSizeNum && pageNum < totalPages;

        return { jobs: rows, total, totalPages, hasMore, nextCursor: null };
    }

    // Get job by ID - unchanged
    static async getJobById(jobId: string): Promise<Job | null> {
        const query = `
            SELECT
                j.*,
                jt.Type as JobTypeName,
                o.Name as OrganizationName,
                o.LogoURL as OrganizationLogo,
                o.LinkedInProfile as OrganizationLinkedIn,
                o.Website as OrganizationWebsite,
                o.Description as OrganizationDescription,
                c.Symbol as CurrencySymbol,
                CASE
                    WHEN j.PostedByUserID IS NOT NULL THEN u.FirstName + ' ' + u.LastName
                    WHEN j.PostedByType = 0 THEN 'RefOpen Job Board'
                    ELSE 'External Recruiter'
                END as PostedByName
            FROM Jobs j
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            LEFT JOIN Users u ON j.PostedByUserID = u.UserID
            LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
            WHERE j.JobID = @param0
        `;

        const result = await dbService.executeQuery<Job>(query, [jobId]);
        return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
    }

    // Update job - unchanged
    static async updateJob(jobId: string, updateData: any, userId: string): Promise<Job> {
        // Verify job exists and user has permission to update
        const existingJob = await this.getJobById(jobId);
        if (!existingJob) {
            throw new NotFoundError('Job not found');
        }

        // Check if user has permission (job owner or employer in same organization)
        if (existingJob.PostedByUserID !== userId) {
            // Check if user is an employer in the same organization
            const permissionQuery = `
                SELECT 1 FROM Employers e
                WHERE e.UserID = @param0 AND e.OrganizationID = @param1 AND 1 = 1
            `;
            const permissionResult = await dbService.executeQuery(permissionQuery, [userId, existingJob.OrganizationID]);

            if (!permissionResult.recordset || permissionResult.recordset.length === 0) {
                throw new ValidationError('Insufficient permissions to update this job');
            }
        }

        const allowedFields = [
            'Title', 'Level', 'Department', 'Description', 'Responsibilities', 'Requirements',
            'PreferredQualifications', 'BenefitsOffered', 'Location', 'Country', 'State', 'City',
            'PostalCode', 'IsRemote', 'WorkplaceType', 'RemoteRestrictions', 'SalaryRangeMin',
            'SalaryRangeMax', 'CurrencyID', 'SalaryPeriod', 'CompensationType', 'BonusDetails',
            'EquityOffered', 'ExperienceMin', 'ExperienceMax', 'ExperienceLevel',
            'RequiredCertifications', 'RequiredEducation', 'Priority', 'Visibility',
            'ApplicationDeadline', 'TargetHiringDate', 'MaxApplications', 'Tags'
        ];

        const updateFields = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .map((key, index) => `${key} = @param${index + 1}`)
            .join(', ');

        if (!updateFields) {
            throw new ValidationError('No valid fields to update');
        }

        const values = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .map(key => updateData[key]);

        const query = `
            UPDATE Jobs
            SET ${updateFields}, UpdatedAt = GETUTCDATE()
            WHERE JobID = @param0;
        `;

        const parameters = [jobId, ...values];
        await dbService.executeQuery(query, parameters);

        // Return updated job
        const updatedJob = await this.getJobById(jobId);
        if (!updatedJob) {
            throw new Error('Failed to retrieve updated job');
        }

        return updatedJob;
    }

    // Publish job - unchanged
    static async publishJob(jobId: string, userId: string): Promise<Job> {
        const job = await this.getJobById(jobId);
        if (!job) {
            throw new NotFoundError('Job not found');
        }

        // Check permissions
        if (job.PostedByUserID !== userId) {
            const permissionQuery = `
                SELECT 1 FROM Employers e
                WHERE e.UserID = @param0 AND e.OrganizationID = @param1 AND 1 = 1
            `;
            const permissionResult = await dbService.executeQuery(permissionQuery, [userId, job.OrganizationID]);

            if (!permissionResult.recordset || permissionResult.recordset.length === 0) {
                throw new ValidationError('Insufficient permissions to publish this job');
            }
        }

        // Update job status to Published
        const query = `
            UPDATE Jobs
            SET Status = 'Published',
                PublishedAt = GETUTCDATE(),
                UpdatedAt = GETUTCDATE(),
                ExpiresAt = CASE
                    WHEN ApplicationDeadline IS NOT NULL THEN ApplicationDeadline
                    ELSE DATEADD(DAY, 30, GETUTCDATE())
                END
            WHERE JobID = @param0
        `;

        await dbService.executeQuery(query, [jobId]);

        const publishedJob = await this.getJobById(jobId);
        if (!publishedJob) {
            throw new Error('Failed to retrieve published job');
        }

        return publishedJob;
    }

    // Close job - unchanged
    static async closeJob(jobId: string, userId: string): Promise<void> {
        const job = await this.getJobById(jobId);
        if (!job) {
            throw new NotFoundError('Job not found');
        }

        // Check permissions
        if (job.PostedByUserID !== userId) {
            const permissionQuery = `
                SELECT 1 FROM Employers e
                WHERE e.UserID = @param0 AND e.OrganizationID = @param1 AND 1 = 1
            `;
            const permissionResult = await dbService.executeQuery(permissionQuery, [userId, job.OrganizationID]);

            if (!permissionResult.recordset || permissionResult.recordset.length === 0) {
                throw new ValidationError('Insufficient permissions to close this job');
            }
        }

        const query = `
            UPDATE Jobs
            SET Status = 'Closed', UpdatedAt = GETUTCDATE()
            WHERE JobID = @param0
        `;

        await dbService.executeQuery(query, [jobId]);
    }

    // Delete job - unchanged
    static async deleteJob(jobId: string, userId: string): Promise<void> {
        const job = await this.getJobById(jobId);
        if (!job) {
            throw new NotFoundError('Job not found');
        }

        // Check permissions - only job owner or admin can delete
        if (job.PostedByUserID !== userId) {
            throw new ValidationError('Only job owner can delete the job');
        }

        // Check if job has applications
        const applicationQuery = 'SELECT COUNT(*) as count FROM JobApplications WHERE JobID = @param0';
        const applicationResult = await dbService.executeQuery(applicationQuery, [jobId]);

        if (applicationResult.recordset[0].count > 0) {
            throw new ValidationError('Cannot delete job with existing applications');
        }

        const query = 'DELETE FROM Jobs WHERE JobID = @param0';
        await dbService.executeQuery(query, [jobId]);
    }

    // Get jobs by organization - minor search optimization
    static async getJobsByOrganization(organizationId: string, params: PaginationParams & { status?: string; search?: string; postedByUserId?: string }): Promise<{ jobs: Job[]; total: number; totalPages: number }> {
        const { page, pageSize, sortBy = 'CreatedAt', sortOrder = 'desc', status, search, postedByUserId } = params as any;

        const allowedSort: Record<string, string> = {
            CreatedAt: 'j.CreatedAt',
            UpdatedAt: 'j.UpdatedAt',
            PublishedAt: 'j.PublishedAt',
            Title: 'j.Title'
        };
        const normalizedSort = allowedSort[sortBy] || 'j.CreatedAt';
        const normalizedOrder = (sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        let whereClause = 'WHERE j.OrganizationID = @param0';
        const queryParams: any[] = [organizationId];
        let paramIndex = 1;

        if (status) {
            const normalizedStatus = String(status).trim();
            if (['Draft', 'Published', 'Closed'].includes(normalizedStatus)) {
                // Case / whitespace insensitive comparison
                whereClause += ` AND UPPER(RTRIM(LTRIM(j.Status))) = UPPER(@param${paramIndex})`;
                queryParams.push(normalizedStatus);
                paramIndex++;
            }
        }

        if (postedByUserId) {
            whereClause += ` AND j.PostedByUserID = @param${paramIndex}`;
            queryParams.push(postedByUserId);
            paramIndex++;
        }

        if (search) {
            const tokens = String(search).trim().split(/\s+/).filter(Boolean);
            if (tokens.length) {
                const tokenClauses: string[] = [];
                tokens.forEach(tok => {
                    tokenClauses.push(`CONTAINS((j.Title, j.Description, j.Tags), @param${paramIndex})`);
                    queryParams.push(`"${tok}"`);
                    paramIndex += 1;
                });
                whereClause += ` AND (${tokenClauses.join(' OR ')})`;
            }
        }

        const countQuery = `SELECT COUNT(*) as total FROM Jobs j ${whereClause}`;
        const countResult = await dbService.executeQuery(countQuery, queryParams);
        const total = countResult.recordset[0]?.total || 0;
        const totalPages = Math.max(Math.ceil(total / pageSize), 1);

        const offset = (page - 1) * pageSize;
        const dataQuery = `
            SELECT
                j.*, jt.Type as JobTypeName, o.Name as OrganizationName
            FROM Jobs j
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            ${whereClause}
            ORDER BY ${normalizedSort} ${normalizedOrder}
            OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY`;
        queryParams.push(offset, pageSize);

        const dataResult = await dbService.executeQuery<Job>(dataQuery, queryParams);
        return { jobs: dataResult.recordset || [], total, totalPages };
    }

    // Get job types (reference data) - unchanged
    static async getJobTypes(): Promise<any[]> {
        const query = 'SELECT * FROM JobTypes WHERE IsActive = 1 ORDER BY Type';
        const result = await dbService.executeQuery(query);
        return result.recordset || [];
    }

    // Get currencies (reference data) - unchanged
    static async getCurrencies(): Promise<any[]> {
        const query = 'SELECT * FROM Currencies WHERE IsActive = 1 ORDER BY Code';
        const result = await dbService.executeQuery(query);
        return result.recordset || [];
    }

    // Search jobs with advanced filters (page-based only) - OPTIMIZED for performance
    static async searchJobs(searchParams: any): Promise<{ jobs: Job[]; total: number; totalPages?: number; hasMore?: boolean; nextCursor?: any | null }> {
        const searchStartTime = Date.now();
        console.log('🔍 searchJobs started:', { searchParams, timestamp: new Date().toISOString() });

        try {
            const { page = 1, pageSize = 20, excludeUserApplications, ...rest } = searchParams || {};
            const f = { ...rest } as any;
            
            // 🚀 OPTIMIZATION: Status filter first for index usage
            let whereClause = "WHERE j.Status = 'Published'";
            const queryParams: any[] = [];
            let paramIndex = 0;

            // 🚀 OPTIMIZATION: Default to last 30 days unless user specifies otherwise
            if (!f.postedWithinDays) {
                const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                whereClause += ` AND j.PublishedAt >= @param${paramIndex}`;
                queryParams.push(cutoffDate);
                paramIndex++;
            }

            // 🚀 OPTIMIZATION: Add most selective filters first
            // Workplace Type filter (very selective)
            if (f.workplaceTypeIds) {
                const workplaceTypeStr = String(f.workplaceTypeIds).trim();
                if (workplaceTypeStr) {
                    const ids = workplaceTypeStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                    if (ids.length > 0) {
                        const placeholders = ids.map((_, i) => `@param${paramIndex + i}`).join(',');
                        whereClause += ` AND j.WorkplaceTypeID IN (${placeholders})`;
                        queryParams.push(...ids);
                        paramIndex += ids.length;
                    }
                }
            }

            // Job Type filter (very selective)
            if (f.jobTypeIds) {
                const jobTypeStr = String(f.jobTypeIds).trim();
                if (jobTypeStr) {
                    const ids = jobTypeStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                    if (ids.length > 0) {
                        const placeholders = ids.map((_, i) => `@param${paramIndex + i}`).join(',');
                        whereClause += ` AND j.JobTypeID IN (${placeholders})`;
                        queryParams.push(...ids);
                        paramIndex += ids.length;
                    }
                }
            }

            // IsRemote filter (selective)
            if (f.isRemote !== undefined) {
                whereClause += ` AND j.IsRemote = @param${paramIndex}`;
                queryParams.push(Boolean(f.isRemote) ? 1 : 0);
                paramIndex++;
            }

            // Exclude applied jobs ONLY (not saved jobs) for the current user
            if (excludeUserApplications) {
                whereClause += ` AND NOT EXISTS (
                    SELECT 1 FROM JobApplications ja
                    INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
                    WHERE a.UserID = @param${paramIndex} 
                        AND ja.StatusID != 6
                        AND ja.JobID = j.JobID
                )`;
                queryParams.push(excludeUserApplications);
                paramIndex += 1;
            }

            // 🚀 OPTIMIZATION: Search term handling - Title, Location, Organization only
            const searchTerm = (f.search || f.q || '').toString().trim();
            if (searchTerm && searchTerm.length > 0) {
                if (searchTerm.length <= 4) {
                    // For 1-4 character searches, use LIKE only on Title and Org Name (most relevant)
                    console.log('🔍 Using LIKE for short search term:', searchTerm);
                    whereClause += ` AND (j.Title LIKE @param${paramIndex} OR o.Name LIKE @param${paramIndex + 1})`;
                    queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
                    paramIndex += 2;
                } else {
                    // For longer searches (5+ chars), use CONTAINS fulltext
                    console.log('🔍 Using CONTAINS for search term:', searchTerm);
                    const tokens = searchTerm.split(/\s+/).filter(Boolean).slice(0, 10);
                    const tokenClauses: string[] = [];

                    // Search in Title, Location, City, Country using fulltext
                    tokens.forEach(tok => {
                        tokenClauses.push(`CONTAINS((j.Title, j.Location, j.City, j.Country), @param${paramIndex})`);
                        queryParams.push(`${tok}*`);
                        paramIndex += 1;
                        
                        tokenClauses.push(`CONTAINS(o.Name, @param${paramIndex})`);
                        queryParams.push(`${tok}*`);
                        paramIndex += 1;
                    });

                    whereClause += ` AND (${tokenClauses.join(' OR ')})`;
                }
            }

            // Location filter
            if (f.location) {
                whereClause += ` AND (j.Location LIKE @param${paramIndex} OR j.City LIKE @param${paramIndex + 1} OR j.Country LIKE @param${paramIndex + 2})`;
                queryParams.push(`%${f.location}%`, `%${f.location}%`, `%${f.location}%`);
                paramIndex += 3;
            }

            // Department filter
            if (f.department) {
                whereClause += ` AND j.Department LIKE @param${paramIndex}`;
                queryParams.push(`%${f.department}%`);
                paramIndex++;
            }

            // Currency filter
            if (f.currencyId) {
                whereClause += ` AND j.CurrencyID = @param${paramIndex}`;
                queryParams.push(Number(f.currencyId));
                paramIndex++;
            }

            // Experience filters
            if (f.experienceMin) {
                whereClause += ` AND (j.ExperienceMax IS NULL OR j.ExperienceMax >= @param${paramIndex})`;
                queryParams.push(Number(f.experienceMin));
                paramIndex++;
            }
            if (f.experienceMax) {
                whereClause += ` AND (j.ExperienceMin IS NULL OR j.ExperienceMin <= @param${paramIndex})`;
                queryParams.push(Number(f.experienceMax));
                paramIndex++;
            }

            // Salary filters
            if (f.salaryMin) {
                whereClause += ` AND (j.SalaryRangeMax IS NULL OR j.SalaryRangeMax >= @param${paramIndex})`;
                queryParams.push(Number(f.salaryMin));
                paramIndex++;
            }
            if (f.salaryMax) {
                whereClause += ` AND (j.SalaryRangeMin IS NULL OR j.SalaryRangeMin <= @param${paramIndex})`;
                queryParams.push(Number(f.salaryMax));
                paramIndex++;
            }

            // Date filter
            if (f.postedWithinDays) {
                const cutoffDate = new Date(Date.now() - Number(f.postedWithinDays) * 24 * 60 * 60 * 1000);
                whereClause += ` AND j.PublishedAt >= @param${paramIndex}`;
                queryParams.push(cutoffDate);
                paramIndex++;
            }

            // 🚀 OPTIMIZATION: Count query with Organizations join for search
            const countStartTime = Date.now();
            const countQuery = `
                SELECT COUNT(*) as total
                FROM Jobs j
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                ${whereClause}
            `;

            console.log('🔍 Executing count query:', { 
                query: countQuery.substring(0, 500), 
                paramCount: queryParams.length,
                params: queryParams.slice(0, 5) 
            });
            const countResult = await dbService.executeQuery(countQuery, queryParams);
            const countTime = Date.now() - countStartTime;
            const total = countResult.recordset?.[0]?.total || 0;

            console.log('✅ Count query completed:', { total, countTime: `${countTime}ms` });

            if (total === 0) {
                const totalTime = Date.now() - searchStartTime;
                console.log('🔍 searchJobs completed (no results):', { totalTime: `${totalTime}ms` });
                return { jobs: [], total: 0, totalPages: 1, hasMore: false, nextCursor: null };
            }

            const requestedAll = (f.all === true || f.all === 'true' || f.all === 1 || f.all === '1' || Number(pageSize) <= 0);
            const allowUnpaged = requestedAll && total <= MAX_UNPAGED_TOTAL;
            const noPaging = !!allowUnpaged;
            const pageNum = Math.max(Number(page) || 1, 1);
            const pageSizeNum = Math.min(Math.max(Number(pageSize) || 20, 1), MAX_PAGE_SIZE);

            // 🚀 OPTIMIZATION: Select only needed columns (not j.* with large text fields)
            const dataStartTime = Date.now();
            let dataQuery = `
                SELECT
                    j.JobID, j.OrganizationID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
                    j.Location, j.City, j.Country, j.IsRemote, j.SalaryRangeMin, j.SalaryRangeMax,
                    j.CurrencyID, j.SalaryPeriod, j.ExperienceMin, j.ExperienceMax, j.PublishedAt, 
                    j.CreatedAt, j.ApplicationDeadline, j.Status, j.Tags,
                    jt.Type as JobTypeName,
                    wt.Type as WorkplaceTypeName,
                    o.Name as OrganizationName,
                    ISNULL(o.LogoURL, '') as OrganizationLogo,
                    ISNULL(c.Symbol, '$') as CurrencySymbol
                FROM Jobs j
                INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                LEFT JOIN WorkplaceTypes wt ON j.WorkplaceTypeID = wt.WorkplaceTypeID
                LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
                ${whereClause}
            `;

            const totalPages = noPaging ? 1 : Math.max(Math.ceil(total / pageSizeNum), 1);
            const dataParams: any[] = [...queryParams];

            if (!noPaging) {
                const offset = (pageNum - 1) * pageSizeNum;
                // 🚀 OPTIMIZATION: Use indexed PublishedAt instead of PublishedDate
                dataQuery += ` ORDER BY j.PublishedAt DESC, j.JobID DESC 
                              OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY
                              OPTION (OPTIMIZE FOR (@param${paramIndex} = 0))`;
                dataParams.push(offset, pageSizeNum);
                paramIndex += 2;
            } else {
                dataQuery += ` ORDER BY j.PublishedAt DESC, j.JobID DESC`;
            }

            console.log('🔍 Executing data query');
            const dataResult = await dbService.executeQuery<Job>(dataQuery, dataParams);
            const dataTime = Date.now() - dataStartTime;
            const rows = dataResult.recordset || [];

            console.log('✅ Data query completed:', { rowCount: rows.length, dataTime: `${dataTime}ms` });

            const hasMore = !noPaging && rows.length === pageSizeNum && pageNum < totalPages;

            const totalTime = Date.now() - searchStartTime;
            console.log('✅ searchJobs completed:', {
                totalTime: `${totalTime}ms`,
                countTime: `${countTime}ms`,
                dataTime: `${dataTime}ms`,
                total,
                returned: rows.length
            });

            return { jobs: rows, total, totalPages, hasMore, nextCursor: null };
        } catch (error) {
            const totalTime = Date.now() - searchStartTime;
            console.error('❌ Error in JobService.searchJobs:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                totalTime: `${totalTime}ms`
            });
            return { jobs: [], total: 0, totalPages: 1, hasMore: false, nextCursor: null };
        }
    }
}