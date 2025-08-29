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

export class JobService {
    // Create new job
    static async createJob(jobData: any, postedByUserID: string, organizationID: string): Promise<Job> {
        const validatedData = validateRequest<JobCreateRequest>(jobCreateSchema, jobData);
        
        // Generate job ID
        const jobId = AuthService.generateUniqueId();
        
        // Build the INSERT query dynamically based on provided fields
        const fields = [
            'JobID', 'OrganizationID', 'PostedByUserID', 'Title', 'JobTypeID',
            'Level', 'Department', 'Description', 'Responsibilities', 'Requirements',
            'PreferredQualifications', 'BenefitsOffered', 'Location', 'Country',
            'State', 'City', 'PostalCode', 'IsRemote', 'WorkplaceType',
            'RemoteRestrictions', 'SalaryRangeMin', 'SalaryRangeMax', 'CurrencyID',
            'SalaryPeriod', 'CompensationType', 'BonusDetails', 'EquityOffered',
            'ProjectDuration', 'ProjectStartDate', 'ProjectEndDate', 'ProjectBudget',
            'ContractExtensionPossible', 'ContractConversionPossible', 'ExperienceMin',
            'ExperienceMax', 'ExperienceLevel', 'RequiredCertifications', 'RequiredEducation',
            'Status', 'Priority', 'Visibility', 'ApplicationDeadline', 'TargetHiringDate',
            'MaxApplications', 'InterviewStages', 'InterviewProcess', 'AssessmentRequired',
            'AssessmentDetails', 'TimeZone', 'Language', 'Tags', 'InternalNotes',
            'CreatedAt', 'UpdatedAt', 'CurrentApplications'
        ];

        const values = [
            jobId, organizationID, postedByUserID, validatedData.title, validatedData.jobTypeID,
            validatedData.level, validatedData.department, validatedData.description,
            validatedData.responsibilities, validatedData.requirements, validatedData.preferredQualifications,
            validatedData.benefitsOffered, validatedData.location, validatedData.country,
            validatedData.state, validatedData.city, validatedData.postalCode,
            validatedData.isRemote || false, validatedData.workplaceType, validatedData.remoteRestrictions,
            validatedData.salaryRangeMin, validatedData.salaryRangeMax, validatedData.currencyID,
            validatedData.salaryPeriod, validatedData.compensationType, validatedData.bonusDetails,
            validatedData.equityOffered, validatedData.projectDuration, validatedData.projectStartDate,
            validatedData.projectEndDate, validatedData.projectBudget, validatedData.contractExtensionPossible,
            validatedData.contractConversionPossible, validatedData.experienceMin, validatedData.experienceMax,
            validatedData.experienceLevel, validatedData.requiredCertifications, validatedData.requiredEducation,
            'Draft', validatedData.priority || 'Normal', validatedData.visibility || 'Public',
            validatedData.applicationDeadline, validatedData.targetHiringDate, validatedData.maxApplications,
            validatedData.interviewStages, validatedData.interviewProcess, validatedData.assessmentRequired || false,
            validatedData.assessmentDetails, validatedData.timeZone, validatedData.language || 'English',
            validatedData.tags, validatedData.internalNotes, null, null, 0
        ];

        const placeholders = fields.map((_, index) => `@param${index}`).join(', ');

        const query = `
            INSERT INTO Jobs (${fields.join(', ')})
            VALUES (${placeholders});
            
            SELECT j.*, jt.Type as JobTypeName, o.Name as OrganizationName
            FROM Jobs j
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            WHERE j.JobID = @param0;
        `;

        const result = await dbService.executeQuery<Job>(query, values);
        
        if (!result.recordset || result.recordset.length === 0) {
            throw new Error('Failed to create job');
        }

        return result.recordset[0];
    }

    // Get all jobs with filtering and pagination (advanced)
    static async getJobs(params: PaginationParams & QueryParams & any): Promise<{ jobs: Job[]; total: number; totalPages: number }> {
        const { page, pageSize } = params;
        let { sortBy = 'CreatedAt', sortOrder = 'desc', search, filters } = params as any;
        const f = { ...(filters || {}), ...params } as any;

        const allowedSort: Record<string, string> = {
            CreatedAt: 'j.CreatedAt',
            UpdatedAt: 'j.UpdatedAt',
            PublishedAt: 'j.PublishedAt',
            Title: 'j.Title',
            SalaryRangeMin: 'j.SalaryRangeMin',
            SalaryRangeMax: 'j.SalaryRangeMax'
        };
        const normalizedSort = sortBy && allowedSort[sortBy] ? allowedSort[sortBy] : 'j.CreatedAt';
        const normalizedOrder = (sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        let whereClause = "WHERE j.Status IN ('Published', 'Draft') AND o.IsActive = 1";
        const queryParams: any[] = [];
        let paramIndex = 0;

        const searchTerm = (search || f.search || f.q || '').toString().trim();
        if (searchTerm) {
            const tokens = searchTerm.split(/\s+/).filter(Boolean);
            const tokenClauses: string[] = [];
            tokens.forEach(tok => {
                tokenClauses.push(`j.Title LIKE @param${paramIndex}`);
                tokenClauses.push(`ISNULL(j.Description, '') LIKE @param${paramIndex + 1}`);
                tokenClauses.push(`ISNULL(j.Tags, '') LIKE @param${paramIndex + 2}`);
                tokenClauses.push(`o.Name LIKE @param${paramIndex + 3}`);
                tokenClauses.push(`ISNULL(j.Location, '') LIKE @param${paramIndex + 4}`);
                tokenClauses.push(`ISNULL(j.City, '') LIKE @param${paramIndex + 5}`);
                tokenClauses.push(`ISNULL(j.Country, '') LIKE @param${paramIndex + 6}`);
                const like = `%${tok}%`;
                queryParams.push(like, like, like, like, like, like, like);
                paramIndex += 7;
            });
            whereClause += ` AND (${tokenClauses.join(' OR ')})`;
        }

        if (f.location) {
            whereClause += ` AND (ISNULL(j.Location, '') LIKE @param${paramIndex} OR ISNULL(j.City, '') LIKE @param${paramIndex + 1} OR ISNULL(j.Country, '') LIKE @param${paramIndex + 2})`;
            queryParams.push(`%${f.location}%`, `%${f.location}%`, `%${f.location}%`);
            paramIndex += 3;
        }

        const jobTypeIds: number[] = normalizeIdList(f.jobTypeIds, f.jobTypeId, f.jobType);
        if (jobTypeIds.length) {
            const placeholders = jobTypeIds.map((_, i) => `@param${paramIndex + i}`).join(',');
            whereClause += ` AND j.JobTypeID IN (${placeholders})`;
            queryParams.push(...jobTypeIds);
            paramIndex += jobTypeIds.length;
        }

        const workplaceTypeIds: number[] = normalizeIdList(f.workplaceTypeIds, f.workplaceTypeId);
        if (workplaceTypeIds.length) {
            const placeholders = workplaceTypeIds.map((_, i) => `@param${paramIndex + i}`).join(',');
            whereClause += ` AND j.WorkplaceTypeID IN (${placeholders})`;
            queryParams.push(...workplaceTypeIds);
            paramIndex += workplaceTypeIds.length;
        }

        if (f.isRemote !== undefined) {
            whereClause += ` AND j.IsRemote = @param${paramIndex}`;
            queryParams.push(Boolean(f.isRemote) ? 1 : 0);
            paramIndex++;
        }

        if (f.department) {
            whereClause += ` AND ISNULL(j.Department, '') LIKE @param${paramIndex}`;
            queryParams.push(`%${f.department}%`);
            paramIndex++;
        }

        if (f.currencyId) {
            whereClause += ` AND ISNULL(j.CurrencyID, 0) = @param${paramIndex}`;
            queryParams.push(Number(f.currencyId));
            paramIndex++;
        }

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

        if (f.postedWithinDays) {
            whereClause += ` AND DATEDIFF(day, COALESCE(j.PublishedAt, j.CreatedAt), SYSUTCDATETIME()) <= @param${paramIndex}`;
            queryParams.push(Number(f.postedWithinDays));
            paramIndex++;
        }

        // Total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM Jobs j
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            ${whereClause}
        `;

        const countResult = await dbService.executeQuery(countQuery, queryParams);
        const total = countResult.recordset?.[0]?.total || 0;
        const totalPages = Math.ceil(total / pageSize);

        const offset = (page - 1) * pageSize;
        const dataQuery = `
            SELECT 
                j.*,
                jt.Type as JobTypeName,
                o.Name as OrganizationName,
                o.LogoURL as OrganizationLogo,
                c.Symbol as CurrencySymbol
            FROM Jobs j
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
            ${whereClause}
            ORDER BY ${normalizedSort} ${normalizedOrder}
            OFFSET @param${paramIndex} ROWS
            FETCH NEXT @param${paramIndex + 1} ROWS ONLY
        `;

        const dataParams = [...queryParams, offset, pageSize];
        const dataResult = await dbService.executeQuery<Job>(dataQuery, dataParams);

        return { jobs: dataResult.recordset || [], total, totalPages };
    }

    // Get job by ID
    static async getJobById(jobId: string): Promise<Job | null> {
        const query = `
            SELECT 
                j.*,
                jt.Type as JobTypeName,
                o.Name as OrganizationName,
                o.LogoURL as OrganizationLogo,
                o.Description as OrganizationDescription,
                c.Symbol as CurrencySymbol,
                u.FirstName + ' ' + u.LastName as PostedByName
            FROM Jobs j
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            INNER JOIN Users u ON j.PostedByUserID = u.UserID
            LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
            WHERE j.JobID = @param0
        `;

        const result = await dbService.executeQuery<Job>(query, [jobId]);
        return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
    }

    // Update job
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

    // Publish job
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
                UpdatedAt = GETUTCDATETIME(),
                ExpiresAt = CASE 
                    WHEN ApplicationDeadline IS NOT NULL THEN ApplicationDeadline
                    ELSE DATEADD(DAY, 30, GETUTCDATETIME())
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

    // Close job
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

    // Delete job
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

    // Get jobs by organization
    static async getJobsByOrganization(organizationId: string, params: PaginationParams): Promise<{ jobs: Job[]; total: number; totalPages: number }> {
        const { page, pageSize, sortBy = 'CreatedAt', sortOrder = 'desc' } = params;

        const allowedSort: Record<string, string> = {
            CreatedAt: 'j.CreatedAt',
            UpdatedAt: 'j.UpdatedAt',
            PublishedAt: 'j.PublishedAt',
            Title: 'j.Title'
        };
        const normalizedSort = allowedSort[sortBy] || 'j.CreatedAt';
        const normalizedOrder = (sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        // Get total count
        const countQuery = 'SELECT COUNT(*) as total FROM Jobs WHERE OrganizationID = @param0';
        const countResult = await dbService.executeQuery(countQuery, [organizationId]);
        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / pageSize);

        // Get paginated results
        const offset = (page - 1) * pageSize;
        
        const dataQuery = `
            SELECT 
                j.*,
                jt.Type as JobTypeName,
                c.Symbol as CurrencySymbol
            FROM Jobs j
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
            WHERE j.OrganizationID = @param0
            ORDER BY ${normalizedSort} ${normalizedOrder}
            OFFSET @param1 ROWS
            FETCH NEXT @param2 ROWS ONLY
        `;

        const dataResult = await dbService.executeQuery<Job>(dataQuery, [organizationId, offset, pageSize]);

        return {
            jobs: dataResult.recordset || [],
            total,
            totalPages
        };
    }

    // Get job types (reference data)
    static async getJobTypes(): Promise<any[]> {
        const query = 'SELECT * FROM JobTypes WHERE IsActive = 1 ORDER BY Type';
        const result = await dbService.executeQuery(query);
        return result.recordset || [];
    }

    // Get currencies (reference data)
    static async getCurrencies(): Promise<any[]> {
        const query = 'SELECT * FROM Currencies WHERE IsActive = 1 ORDER BY Code';
        const result = await dbService.executeQuery(query);
        return result.recordset || [];
    }

    // Search jobs with advanced filters (tokenized + same filter set)
    static async searchJobs(searchParams: any): Promise<{ jobs: Job[]; total: number }> {
        try {
            const {
                page = 1,
                pageSize = 20,
                ...rest
            } = searchParams || {};

            const f = { ...rest } as any;

            let whereClause = "WHERE o.IsActive = 1 AND j.Status IN ('Published', 'Draft')";
            const queryParams: any[] = [];
            let paramIndex = 0;

            const searchTerm = (f.search || f.q || '').toString().trim();
            if (searchTerm) {
                const tokens = searchTerm.split(/\s+/).filter(Boolean);
                const tokenClauses: string[] = [];
                tokens.forEach(tok => {
                    tokenClauses.push(`j.Title LIKE @param${paramIndex}`);
                    tokenClauses.push(`ISNULL(j.Description, '') LIKE @param${paramIndex + 1}`);
                    tokenClauses.push(`ISNULL(j.Requirements, '') LIKE @param${paramIndex + 2}`);
                    tokenClauses.push(`ISNULL(j.Tags, '') LIKE @param${paramIndex + 3}`);
                    tokenClauses.push(`o.Name LIKE @param${paramIndex + 4}`);
                    tokenClauses.push(`ISNULL(j.Location, '') LIKE @param${paramIndex + 5}`);
                    tokenClauses.push(`ISNULL(j.City, '') LIKE @param${paramIndex + 6}`);
                    tokenClauses.push(`ISNULL(j.Country, '') LIKE @param${paramIndex + 7}`);
                    const like = `%${tok}%`;
                    queryParams.push(like, like, like, like, like, like, like, like);
                    paramIndex += 8;
                });
                whereClause += ` AND (${tokenClauses.join(' OR ')})`;
            }

            if (f.location) {
                whereClause += ` AND (ISNULL(j.Location, '') LIKE @param${paramIndex} OR ISNULL(j.City, '') LIKE @param${paramIndex + 1} OR ISNULL(j.Country, '') LIKE @param${paramIndex + 2})`;
                queryParams.push(`%${f.location}%`, `%${f.location}%`, `%${f.location}%`);
                paramIndex += 3;
            }

            const jobTypeIds: number[] = normalizeIdList(f.jobTypeIds, f.jobTypeId, f.jobType);
            if (jobTypeIds.length) {
                const placeholders = jobTypeIds.map((_, i) => `@param${paramIndex + i}`).join(',');
                whereClause += ` AND j.JobTypeID IN (${placeholders})`;
                queryParams.push(...jobTypeIds);
                paramIndex += jobTypeIds.length;
            }

            const workplaceTypeIds: number[] = normalizeIdList(f.workplaceTypeIds, f.workplaceTypeId);
            if (workplaceTypeIds.length) {
                const placeholders = workplaceTypeIds.map((_, i) => `@param${paramIndex + i}`).join(',');
                whereClause += ` AND j.WorkplaceTypeID IN (${placeholders})`;
                queryParams.push(...workplaceTypeIds);
                paramIndex += workplaceTypeIds.length;
            }

            if (f.isRemote !== undefined) {
                whereClause += ` AND j.IsRemote = @param${paramIndex}`;
                queryParams.push(Boolean(f.isRemote) ? 1 : 0);
                paramIndex++;
            }

            if (f.department) {
                whereClause += ` AND ISNULL(j.Department, '') LIKE @param${paramIndex}`;
                queryParams.push(`%${f.department}%`);
                paramIndex++;
            }

            if (f.currencyId) {
                whereClause += ` AND ISNULL(j.CurrencyID, 0) = @param${paramIndex}`;
                queryParams.push(Number(f.currencyId));
                paramIndex++;
            }

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

            if (f.postedWithinDays) {
                whereClause += ` AND DATEDIFF(day, COALESCE(j.PublishedAt, j.CreatedAt), SYSUTCDATETIME()) <= @param${paramIndex}`;
                queryParams.push(Number(f.postedWithinDays));
                paramIndex++;
            }

            const countQuery = `
                SELECT COUNT(*) as total
                FROM Jobs j
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
                ${whereClause}
            `;

            const countResult = await dbService.executeQuery(countQuery, queryParams);
            const total = countResult.recordset?.[0]?.total || 0;
            if (total === 0) return { jobs: [], total: 0 };

            const offset = (page - 1) * pageSize;
            const dataQuery = `
                SELECT 
                  j.*,
                  jt.Type as JobTypeName,
                  o.Name as OrganizationName,
                  ISNULL(o.LogoURL, '') as OrganizationLogo,
                  ISNULL(c.Symbol, '$') as CurrencySymbol
                FROM Jobs j
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
                LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
                ${whereClause}
                ORDER BY CASE WHEN j.PublishedAt IS NOT NULL THEN j.PublishedAt ELSE j.CreatedAt END DESC
                OFFSET @param${paramIndex} ROWS
                FETCH NEXT @param${paramIndex + 1} ROWS ONLY
            `;

            const dataParams = [...queryParams, offset, pageSize];
            const dataResult = await dbService.executeQuery<Job>(dataQuery, dataParams);
            return { jobs: dataResult.recordset || [], total };
        } catch (error) {
            console.error('Error in JobService.searchJobs (advanced):', error);
            return { jobs: [], total: 0 };
        }
    }
}

// Helpers
function normalizeIdList(...candidates: any[]): number[] {
  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.map(x => Number(x)).filter(n => !isNaN(n));
    }
    if (typeof c === 'string') {
      const parts = c.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length) return parts.map(p => Number(p)).filter(n => !isNaN(n));
    }
    if (typeof c === 'number') {
      return [c];
    }
  }
  return [];
}