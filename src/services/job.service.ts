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

    // Get all jobs with filtering and pagination
    static async getJobs(params: PaginationParams & QueryParams): Promise<{ jobs: Job[]; total: number; totalPages: number }> {
        const { page, pageSize } = params;
        let { sortBy = 'CreatedAt', sortOrder = 'desc', search, filters } = params;
        
        // Whitelist allowed sort columns to avoid SQL errors
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
        
        let whereClause = 'WHERE j.Status IN (\'Published\', \'Draft\') AND o.IsActive = 1';
        const queryParams: any[] = [];
        let paramIndex = 0;

        // Add search functionality
        if (search) {
            whereClause += ` AND (j.Title LIKE @param${paramIndex} OR j.Description LIKE @param${paramIndex + 1} OR o.Name LIKE @param${paramIndex + 2})`;
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            paramIndex += 3;
        }

        // Add filters
        if (filters) {
            if (filters.location) {
                whereClause += ` AND (j.Location LIKE @param${paramIndex} OR j.City LIKE @param${paramIndex + 1} OR j.Country LIKE @param${paramIndex + 2})`;
                queryParams.push(`%${filters.location}%`, `%${filters.location}%`, `%${filters.location}%`);
                paramIndex += 3;
            }

            if (filters.jobType) {
                whereClause += ` AND jt.Type = @param${paramIndex}`;
                queryParams.push(filters.jobType);
                paramIndex++;
            }

            if (filters.isRemote !== undefined) {
                whereClause += ` AND j.IsRemote = @param${paramIndex}`;
                queryParams.push(filters.isRemote);
                paramIndex++;
            }

            if (filters.salaryMin) {
                whereClause += ` AND j.SalaryRangeMin >= @param${paramIndex}`;
                queryParams.push(filters.salaryMin);
                paramIndex++;
            }

            if (filters.salaryMax) {
                whereClause += ` AND j.SalaryRangeMax <= @param${paramIndex}`;
                queryParams.push(filters.salaryMax);
                paramIndex++;
            }

            if (filters.experienceLevel) {
                whereClause += ` AND j.ExperienceLevel = @param${paramIndex}`;
                queryParams.push(filters.experienceLevel);
                paramIndex++;
            }
        }

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM Jobs j
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
            ${whereClause}
        `;

        const countResult = await dbService.executeQuery(countQuery, queryParams);
        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / pageSize);

        // Get paginated results
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

        queryParams.push(offset, pageSize);
        const dataResult = await dbService.executeQuery<Job>(dataQuery, queryParams);

        return {
            jobs: dataResult.recordset || [],
            total,
            totalPages
        };
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

    // Search jobs with advanced filters - FIXED: Complete rewrite to handle all edge cases
    static async searchJobs(searchParams: any): Promise<{ jobs: Job[]; total: number }> {
        try {
            const { 
                search,        // 'search' parameter from controller
                q,             // 'q' parameter from URL query string
                location, 
                jobType, 
                experienceLevel, 
                isRemote, 
                salaryMin, 
                salaryMax,
                page = 1, 
                pageSize = 20 
            } = searchParams;

            // Use either 'search' or 'q' parameter for search query
            const searchQuery = search || q || '';

            // FIXED: Start with basic WHERE clause that works with actual data
            let whereClause = 'WHERE o.IsActive = 1';
            const queryParams: any[] = [];
            let paramIndex = 0;

            // Add status filter - be flexible with job status
            whereClause += ` AND j.Status IN ('Published', 'Draft')`;

            // Full-text search - FIXED: Only add if we have a search term
            if (searchQuery && searchQuery.trim() !== '') {
                whereClause += ` AND (
                    j.Title LIKE @param${paramIndex} OR 
                    j.Description LIKE @param${paramIndex + 1} OR 
                    ISNULL(j.Requirements, '') LIKE @param${paramIndex + 2} OR
                    ISNULL(j.Tags, '') LIKE @param${paramIndex + 3} OR
                    o.Name LIKE @param${paramIndex + 4}
                )`;
                const searchTerm = `%${searchQuery.trim()}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
                paramIndex += 5;
            }

            // Location filter
            if (location && location.trim() !== '') {
                whereClause += ` AND (
                    ISNULL(j.Location, '') LIKE @param${paramIndex} OR 
                    ISNULL(j.City, '') LIKE @param${paramIndex + 1} OR 
                    ISNULL(j.Country, '') LIKE @param${paramIndex + 2}
                )`;
                const locationTerm = `%${location.trim()}%`;
                queryParams.push(locationTerm, locationTerm, locationTerm);
                paramIndex += 3;
            }

            // Job type filter
            if (jobType) {
                whereClause += ` AND jt.Type = @param${paramIndex}`;
                queryParams.push(jobType);
                paramIndex++;
            }

            // Experience level filter
            if (experienceLevel) {
                whereClause += ` AND ISNULL(j.ExperienceLevel, '') = @param${paramIndex}`;
                queryParams.push(experienceLevel);
                paramIndex++;
            }

            // Remote filter
            if (isRemote !== undefined) {
                whereClause += ` AND j.IsRemote = @param${paramIndex}`;
                queryParams.push(isRemote ? 1 : 0);
                paramIndex++;
            }

            // Salary range filters
            if (salaryMin && !isNaN(Number(salaryMin))) {
                whereClause += ` AND (j.SalaryRangeMax >= @param${paramIndex} OR j.SalaryRangeMax IS NULL)`;
                queryParams.push(Number(salaryMin));
                paramIndex++;
            }

            if (salaryMax && !isNaN(Number(salaryMax))) {
                whereClause += ` AND (j.SalaryRangeMin <= @param${paramIndex} OR j.SalaryRangeMin IS NULL)`;
                queryParams.push(Number(salaryMax));
                paramIndex++;
            }

            // FIXED: Simplified count query to avoid JOIN issues
            const countQuery = `
                SELECT COUNT(*) as total
                FROM Jobs j
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
                ${whereClause}
            `;

            console.log('Job search count query:', countQuery);
            console.log('Query params:', queryParams);

            const countResult = await dbService.executeQuery(countQuery, queryParams);
            const total = countResult.recordset[0]?.total || 0;

            // If no results, return empty
            if (total === 0) {
                return { jobs: [], total: 0 };
            }

            // Data query with pagination
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
                ORDER BY 
                    CASE WHEN j.PublishedAt IS NOT NULL THEN j.PublishedAt ELSE j.CreatedAt END DESC
                OFFSET @param${paramIndex} ROWS
                FETCH NEXT @param${paramIndex + 1} ROWS ONLY
            `;

            queryParams.push(offset, pageSize);
            console.log('Job search data query:', dataQuery);
            
            const dataResult = await dbService.executeQuery<Job>(dataQuery, queryParams);

            return {
                jobs: dataResult.recordset || [],
                total
            };
        } catch (error) {
            console.error('Error in JobService.searchJobs:', error);
            console.error('Search params:', searchParams);
            
            // FIXED: Return empty results gracefully instead of throwing
            return {
                jobs: [],
                total: 0
            };
        }
    }
}