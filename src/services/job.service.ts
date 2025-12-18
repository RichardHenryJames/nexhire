import { dbService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { Job, PaginationParams, QueryParams, JobCreateRequest } from '../types';
import {
    ValidationError,
    NotFoundError,
    InsufficientBalanceError,
    validateRequest,
    jobCreateSchema,
    paginationSchema
} from '../utils/validation';
import { appConstants } from '../config';
import { WalletService } from './wallet.service';

// Pagination caps
const MAX_PAGE_SIZE = 100;
const MAX_UNPAGED_TOTAL = 500; // when all=true, cap results to this many

export class JobService {
    private static async getApplicantPersonalization(userId?: string): Promise<{
        preferredJobTypes: string | null;
        preferredWorkTypes: string | null;
        preferredLocations: string | null;
        preferredCompanySize: string | null;
        latestJobTitle: string | null;
    }> {
        if (!userId) {
            return {
                preferredJobTypes: null,
                preferredWorkTypes: null,
                preferredLocations: null,
                preferredCompanySize: null,
                latestJobTitle: null
            };
        }

        const query = `
            SELECT TOP 1
                a.PreferredJobTypes AS preferredJobTypes,
                a.PreferredWorkTypes AS preferredWorkTypes,
                a.PreferredLocations AS preferredLocations,
                a.PreferredCompanySize AS preferredCompanySize,
                (
                    SELECT TOP 1 we.JobTitle
                    FROM WorkExperiences we
                    WHERE we.ApplicantID = a.ApplicantID
                      AND (we.IsActive = 1 OR we.IsActive IS NULL)
                    ORDER BY
                      CASE WHEN we.EndDate IS NULL THEN 1 ELSE 0 END DESC,
                      we.EndDate DESC,
                      we.StartDate DESC
                ) AS latestJobTitle
            FROM Applicants a
            WHERE a.UserID = @param0;
        `;

        const result = await dbService.executeQuery(query, [userId]);
        const row = result.recordset?.[0];
        return {
            preferredJobTypes: row?.preferredJobTypes ?? null,
            preferredWorkTypes: row?.preferredWorkTypes ?? null,
            preferredLocations: row?.preferredLocations ?? null,
            preferredCompanySize: row?.preferredCompanySize ?? null,
            latestJobTitle: row?.latestJobTitle ?? null
        };
    }

    private static buildPreferenceScoreSql(
        preferredJobTypesParam: string,
        preferredWorkTypesParam: string,
        preferredLocationsParam: string,
        preferredCompanySizeParam: string
    ): string {
        // Scores are additive; higher means better match.
        // Weights (simple + stable): JobType=3, WorkplaceType=2, Location=2, CompanySize=1
        // PERF: expects CTEs `pjt`, `pwt`, `ploc` to exist so STRING_SPLIT runs once per request.
        return `(
            (CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM pjt
                    WHERE pjt.v = LOWER(REPLACE(LTRIM(RTRIM(jt.Value)), ' ', ''))
                )
                THEN 3 ELSE 0
            END)
            +
            (CASE
                WHEN NULLIF(LTRIM(RTRIM(wt.Value)), '') IS NOT NULL
                 AND EXISTS (
                    SELECT 1
                    FROM pwt
                    WHERE pwt.v = LOWER(REPLACE(LTRIM(RTRIM(wt.Value)), ' ', ''))
                 )
                THEN 2 ELSE 0
            END)
            +
            (CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM ploc
                    WHERE
                        j.Location LIKE '%' + ploc.v + '%'
                        OR j.City LIKE '%' + ploc.v + '%'
                        OR j.Country LIKE '%' + ploc.v + '%'
                )
                THEN 2 ELSE 0
            END)
            +
            (CASE
                WHEN NULLIF(LTRIM(RTRIM(${preferredCompanySizeParam})), '') IS NOT NULL
                 AND NULLIF(LTRIM(RTRIM(o.Size)), '') IS NOT NULL
                 AND LOWER(LTRIM(RTRIM(o.Size))) = LOWER(LTRIM(RTRIM(${preferredCompanySizeParam})))
                THEN 1 ELSE 0
            END)
        )`;
    }

    private static buildRoleTitleScoreSql(latestJobTitleParam: string): string {
        // Boost jobs whose title matches the user's latest/current role title.
        // Uses WorkExperiences (current first, then most recent end/start).
        // PERF: expects CTE `rtok` to exist so STRING_SPLIT runs once per request.
        return `(
            (CASE
                WHEN NULLIF(LTRIM(RTRIM(${latestJobTitleParam})), '') IS NOT NULL
                 AND j.Title LIKE '%' + LTRIM(RTRIM(${latestJobTitleParam})) + '%'
                THEN 6 ELSE 0
            END)
            +
            (CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM rtok
                    WHERE j.Title LIKE '%' + rtok.v + '%'
                )
                THEN 4 ELSE 0
            END)
        )`;
    }

    private static buildPersonalizationCtesSql(
        preferredJobTypesParam: string,
        preferredWorkTypesParam: string,
        preferredLocationsParam: string,
        latestJobTitleParam: string
    ): string {
        // These CTEs are independent of Jobs, so SQL Server can compute them once.
        return `
            ;WITH
            pjt AS (
                SELECT LOWER(REPLACE(LTRIM(RTRIM(value)), ' ', '')) AS v
                FROM STRING_SPLIT(${preferredJobTypesParam}, ',')
                WHERE NULLIF(LTRIM(RTRIM(value)), '') IS NOT NULL
            ),
            pwt AS (
                SELECT LOWER(REPLACE(LTRIM(RTRIM(value)), ' ', '')) AS v
                FROM STRING_SPLIT(${preferredWorkTypesParam}, ',')
                WHERE NULLIF(LTRIM(RTRIM(value)), '') IS NOT NULL
            ),
            ploc AS (
                SELECT LTRIM(RTRIM(value)) AS v
                FROM STRING_SPLIT(${preferredLocationsParam}, ',')
                WHERE NULLIF(LTRIM(RTRIM(value)), '') IS NOT NULL
            ),
            rtok AS (
                SELECT LTRIM(RTRIM(value)) AS v
                FROM STRING_SPLIT(${latestJobTitleParam}, ' ')
                WHERE LEN(LTRIM(RTRIM(value))) >= 3
            )
        `;
    }

    /**
     * \ud83d\ude80 OPTIMIZATION: Shared filter builder to avoid code duplication between getJobs and searchJobs
     * Builds WHERE clause and parameters for job queries with common filters
     */
    private static buildJobFilters(
        filters: any,
        excludeUserApplications?: string
    ): { whereClause: string; queryParams: any[]; paramIndex: number } {
        const f = filters;
        let whereClause = "WHERE j.Status = 'Published'";
        const queryParams: any[] = [];
        let paramIndex = 0;

        // \ud83d\ude80 OPTIMIZATION: Default to last 7 days unless frontend explicitly specifies postedWithinDays filter
        // This reduces query load and returns more relevant recent jobs
        if (!f.postedWithinDays) {
            const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            whereClause += ` AND j.PublishedAt >= @param${paramIndex}`;
            queryParams.push(cutoffDate);
            paramIndex++;
        }

        // \ud83d\ude80 OPTIMIZATION: Add most selective filters first for better query plan
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

        // \ud83d\ude80 OPTIMIZATION: Search term handling - Title, Location, Organization only
        const searchTerm = (f.search || f.q || '').toString().trim();
        if (searchTerm && searchTerm.length > 0) {
            if (searchTerm.length <= 4) {
                // For 1-4 character searches, use LIKE only on Title and Org Name (most relevant)
                whereClause += ` AND (j.Title LIKE @param${paramIndex} OR o.Name LIKE @param${paramIndex + 1})`;
                queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
                paramIndex += 2;
            } else {
                // For longer searches (5+ chars), use fulltext.
                // PERF: avoid N*tokens OR predicates; build a single fulltext query string.
                const rawTokens = searchTerm.split(/\s+/).filter(Boolean).slice(0, 10);
                const tokens = rawTokens
                    .map(t => t.replace(/[^0-9A-Za-z]/g, ''))
                    .filter(Boolean)
                    .slice(0, 10);

                // Example: "software*" OR "engineer*"
                const ftQuery = tokens.length > 0
                    ? tokens.map(t => `"${t}*"`).join(' OR ')
                    : `"${searchTerm.replace(/[^0-9A-Za-z]/g, '')}*"`;

                // Set-based full-text filter (evaluated once) instead of per-row CONTAINS predicates.
                // Preserves behavior: include jobs where either job fields match OR organization name matches.
                whereClause += ` AND (
                    j.JobID IN (
                        SELECT [KEY]
                        FROM CONTAINSTABLE(Jobs, (Title, Location, City, Country), @param${paramIndex})
                    )
                    OR j.OrganizationID IN (
                        SELECT [KEY]
                        FROM CONTAINSTABLE(Organizations, Name, @param${paramIndex})
                    )
                )`;
                queryParams.push(ftQuery);
                paramIndex += 1;
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

        // Organization filter (multiple organizations support) - uses OrganizationID from Jobs table
        if (f.organizationIds) {
            const orgIdsStr = String(f.organizationIds).trim();
            console.log('🔍 [BACKEND] Organization filter received:', { orgIdsStr });
            
            if (orgIdsStr) {
                // Parse comma-separated organization IDs and convert to integers
                const orgIds = orgIdsStr.split(',')
                    .map(s => parseInt(s.trim(), 10))  // ✅ FIXED: Convert to integers
                    .filter(n => !isNaN(n) && n > 0);   // ✅ FIXED: Filter out invalid numbers
                
                console.log('🔍 [BACKEND] Parsed organization IDs:', orgIds);
                
                if (orgIds.length > 0) {
                    // Build IN clause with parameterized values
                    const placeholders = orgIds.map(() => {
                        const placeholder = `@param${paramIndex}`;
                        paramIndex++;
                        return placeholder;
                    }).join(',');
                    
                    whereClause += ` AND j.OrganizationID IN (${placeholders})`;
                    queryParams.push(...orgIds);  // Now pushing integers instead of strings
                    
                    console.log('🔍 [BACKEND] WHERE clause addition:', `j.OrganizationID IN (${placeholders})`);
                    console.log('🔍 [BACKEND] Query params added:', orgIds);
                }
            }
        }

        // Currency filter
        if (f.currencyId) {
            whereClause += ` AND j.CurrencyID = @param${paramIndex}`;
            queryParams.push(Number(f.currencyId));
            paramIndex++;
        }

        // \ud83d\ude80 OPTIMIZATION: Experience filters - use range comparison
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

        // \ud83d\ude80 OPTIMIZATION: Salary filters - use range comparison
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

        // Date filter (overrides the default 7-day filter)
        if (f.postedWithinDays) {
            const cutoffDate = new Date(Date.now() - Number(f.postedWithinDays) * 24 * 60 * 60 * 1000);
            whereClause += ` AND j.PublishedAt >= @param${paramIndex}`;
            queryParams.push(cutoffDate);
            paramIndex++;
        }

        // 🏢 Fortune 500 filter - filter jobs from Fortune 500 companies
        if (f.isFortune500 !== undefined && f.isFortune500 !== null) {
            const isFortune500Value = f.isFortune500 === true || f.isFortune500 === 'true' || f.isFortune500 === 1 || f.isFortune500 === '1';
            whereClause += ` AND o.IsFortune500 = @param${paramIndex}`;
            queryParams.push(isFortune500Value ? 1 : 0);
            paramIndex++;
        }

        return { whereClause, queryParams, paramIndex };
    }

    // Create new job (schema-aligned with database) - unchanged
    static async createJob(jobData: any, postedByUserID: string, organizationID: string): Promise<Job> {
        // 1. Validate and normalize input
        const validated = validateRequest<JobCreateRequest>(jobCreateSchema, jobData);

        // 2. Resolve / derive required DB columns that are NOT part of request
        // Department NOT NULL in DB – fallback if not provided
        const department = validated.department?.trim() || 'General';
        // Location NOT NULL – fallback if missing (prefer explicit location else remote marker)
        const location = validated.location?.trim() || (validated.isRemote ? 'Remote' : 'Unspecified');
        // WorkplaceTypeID (FK) from textual workplaceType (optional). Default to first WorkplaceType if not found
        let workplaceTypeId: number = 443; // Default to Onsite (ReferenceID from ReferenceMetadata)
        if (validated.workplaceType) {
            const rawWorkplaceType = String(validated.workplaceType).trim();
            const workplaceTypeNormalized = (() => {
                const lower = rawWorkplaceType.toLowerCase();
                if (lower === 'onsite' || lower === 'on-site' || lower === 'on site') return 'Onsite';
                if (lower === 'remote') return 'Remote';
                if (lower === 'hybrid') return 'Hybrid';
                return rawWorkplaceType;
            })();
            const wtQuery = 'SELECT ReferenceID FROM ReferenceMetadata WHERE RefType = @param0 AND Value = @param1';
            const wtResult = await dbService.executeQuery(wtQuery, ['WorkplaceType', workplaceTypeNormalized]);
            if (wtResult.recordset && wtResult.recordset.length > 0) {
                workplaceTypeId = wtResult.recordset[0].ReferenceID;
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
            SELECT j.*, jt.Value as JobTypeName, o.Name as OrganizationName
            FROM Jobs j
            INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
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
    static async getJobs(params: PaginationParams & QueryParams & any): Promise<{ jobs: Job[]; hasMore: boolean; nextCursor: any | null }> {
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

        // 🚀 Use shared filter builder to avoid duplication
        const { whereClause, queryParams, paramIndex: currentParamIndex } = this.buildJobFilters(f, excludeUserApplications);
        let paramIndex = currentParamIndex;

        // NOTE: We intentionally do not run COUNT(*) for perf.
        // If all=true is requested, we cap to MAX_UNPAGED_TOTAL and signal more via hasMore.
        const requestedAll = (f.all === true || f.all === 'true' || f.all === 1 || f.all === '1' || Number(pageSize) <= 0);
        const noPaging = !!requestedAll;
        const pageNum = Math.max(Number(page) || 1, 1);
        const pageSizeNum = noPaging
            ? MAX_UNPAGED_TOTAL
            : Math.min(Math.max(Number(pageSize) || 20, 1), MAX_PAGE_SIZE);

        // Fetch personalization once (fast indexed lookup) to avoid per-row correlated subqueries
        const personalization = await this.getApplicantPersonalization(excludeUserApplications);

        // Add personalization parameters once; used in ORDER BY scoring.
        const dataParams: any[] = [...queryParams];

        const pjtParam = `@param${paramIndex}`; dataParams.push(personalization.preferredJobTypes); paramIndex++;
        const pwtParam = `@param${paramIndex}`; dataParams.push(personalization.preferredWorkTypes); paramIndex++;
        const plocParam = `@param${paramIndex}`; dataParams.push(personalization.preferredLocations); paramIndex++;
        const pcsParam = `@param${paramIndex}`; dataParams.push(personalization.preferredCompanySize); paramIndex++;
        const latestTitleParam = `@param${paramIndex}`; dataParams.push(personalization.latestJobTitle); paramIndex++;

        const personalizationCtes = this.buildPersonalizationCtesSql(pjtParam, pwtParam, plocParam, latestTitleParam);

        // 🚀 OPTIMIZATION: Select ONLY columns needed for JobCard display (removed unused columns)
        let dataQuery = `${personalizationCtes}
            SELECT
                j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
                j.OrganizationID,
                j.Location, j.City, j.State, j.Country, j.IsRemote, 
                j.SalaryRangeMin, j.SalaryRangeMax, j.SalaryPeriod,
                j.PublishedAt, j.CreatedAt,
                jt.Value as JobTypeName,
                wt.Value as WorkplaceTypeName,
                o.Name as OrganizationName,
                ISNULL(o.LogoURL, '') as OrganizationLogo
            FROM Jobs j
            INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            LEFT JOIN ReferenceMetadata wt ON j.WorkplaceTypeID = wt.ReferenceID AND wt.RefType = 'WorkplaceType'
            ${whereClause}
        `;

        const preferenceScoreSql = this.buildPreferenceScoreSql(pjtParam, pwtParam, plocParam, pcsParam);
        const roleTitleScoreSql = this.buildRoleTitleScoreSql(latestTitleParam);
        const hasSearchText = ((f.search || f.q || '') as any).toString().trim().length > 0;
        const roleTitlePersonalizationDisabled = ['false', '0', 'no', 'off'].includes(String(f.roleTitlePersonalization ?? '').toLowerCase())
            || f.roleTitlePersonalization === false
            || f.roleTitlePersonalization === 0;
        const hasRoleTitle = (personalization.latestJobTitle || '').toString().trim().length > 0;
        const useRoleTitleScore = !hasSearchText && !roleTitlePersonalizationDisabled && hasRoleTitle;

        const orderPrefix = hasSearchText
            ? `${preferenceScoreSql} DESC, `
            : (useRoleTitleScore ? `${roleTitleScoreSql} DESC, ${preferenceScoreSql} DESC, ` : `${preferenceScoreSql} DESC, `);

        // Page-based pagination without COUNT(*): fetch one extra row to determine hasMore.
        const offset = noPaging ? 0 : (pageNum - 1) * pageSizeNum;
        // 🚀 OPTIMIZATION: Use indexed PublishedAt column for sorting
        dataQuery += ` ORDER BY ${orderPrefix}${normalizedSort} ${normalizedOrder}, j.JobID ${normalizedOrder} 
                      OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY
                      OPTION (OPTIMIZE FOR (@param${paramIndex} = 0))`;
        dataParams.push(offset, pageSizeNum + 1);
        paramIndex += 2;

        const dataResult = await dbService.executeQuery<Job>(dataQuery, dataParams);
        const fetched = dataResult.recordset || [];

        const hasMore = fetched.length > pageSizeNum;
        const rows = hasMore ? fetched.slice(0, pageSizeNum) : fetched;

        return { jobs: rows, hasMore, nextCursor: null };
    }

    // Get job by ID - ENHANCED: Search SQL first, then archived jobs in blob storage
    static async getJobById(jobId: string): Promise<Job | null> {
        // First, try to get from SQL database
        const query = `
            SELECT
                j.*,
                jt.Value as JobTypeName,
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
            INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
            LEFT JOIN Users u ON j.PostedByUserID = u.UserID
            LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
            WHERE j.JobID = @param0
        `;

        const result = await dbService.executeQuery<Job>(query, [jobId]);
        
        if (result.recordset && result.recordset.length > 0) {
            console.log(`[JobService] Job ${jobId} found in SQL database`);
            return result.recordset[0];
        }

        // If not found in SQL, search in archived jobs (blob storage)
        try {
            console.log(`[JobService] Job ${jobId} not found in SQL, searching archives...`);
            const { JobArchiveService } = await import('./job-archive.service');
            const archivedJob = await JobArchiveService.getArchivedJob(jobId);
            
            if (archivedJob) {
                console.log(`[JobService] Job ${jobId} found in archive`);
                // Add flag that this is an archived job
                // Frontend uses IsArchived flag to hide Apply/Refer buttons
                return {
                    ...archivedJob,
                    IsArchived: true,
                    Status: 'Archived'
                } as Job;
            }
        } catch (archiveError: any) {
            console.error(`[JobService] Error searching archives for job ${jobId}:`, archiveError.message);
        }

        console.log(`[JobService] Job ${jobId} not found in SQL or archives`);
        return null;
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

        if (job.Status !== 'Draft') {
            throw new ValidationError('Only draft jobs can be published');
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

        // Charge ₹50 to publish a draft job
        const PUBLISH_JOB_FEE = 50;
        const wallet = await WalletService.getOrCreateWallet(userId);
        if (wallet.Balance < PUBLISH_JOB_FEE) {
            throw new InsufficientBalanceError('Insufficient wallet balance to publish job');
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

        // Deduct fee after successful publish; if debit fails, revert publish.
        try {
            await WalletService.debitWallet(
                userId,
                PUBLISH_JOB_FEE,
                'JOB_PUBLISH',
                `Publish job - ${job.Title || jobId}`
            );
        } catch (error) {
            try {
                await dbService.executeQuery(
                    `UPDATE Jobs
                     SET Status = 'Draft',
                         PublishedAt = NULL,
                         ExpiresAt = NULL,
                         UpdatedAt = GETUTCDATE()
                     WHERE JobID = @param0`,
                    [jobId]
                );
            } catch (revertError) {
                console.error('Failed to revert job after wallet debit failure:', revertError);
            }
            throw error;
        }

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
                j.*, jt.Value as JobTypeName, o.Name as OrganizationName
            FROM Jobs j
            INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            ${whereClause}
            ORDER BY ${normalizedSort} ${normalizedOrder}
            OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY`;
        queryParams.push(offset, pageSize);

        const dataResult = await dbService.executeQuery<Job>(dataQuery, queryParams);
        return { jobs: dataResult.recordset || [], total, totalPages };
    }

    // Get currencies (reference data) - unchanged
    static async getCurrencies(): Promise<any[]> {
        const query = 'SELECT * FROM Currencies WHERE IsActive = 1 ORDER BY Code';
        const result = await dbService.executeQuery(query);
        return result.recordset || [];
    }

    // Search jobs with advanced filters (page-based only) - OPTIMIZED for performance
    static async searchJobs(searchParams: any): Promise<{ jobs: Job[]; hasMore: boolean; nextCursor: any | null }> {
        const searchStartTime = Date.now();
        console.log('🔍 searchJobs started:', { searchParams, timestamp: new Date().toISOString() });

        try {
            const { page = 1, pageSize = 20, excludeUserApplications, ...rest } = searchParams || {};
            const f = { ...rest } as any;
            
            // 🚀 Use shared filter builder to avoid duplication
            const { whereClause, queryParams, paramIndex: currentParamIndex } = this.buildJobFilters(f, excludeUserApplications);
            let paramIndex = currentParamIndex;

            // NOTE: We intentionally do not run COUNT(*) for perf.
            // If all=true is requested, we cap to MAX_UNPAGED_TOTAL and signal more via hasMore.
            const requestedAll = (f.all === true || f.all === 'true' || f.all === 1 || f.all === '1' || Number(pageSize) <= 0);
            const noPaging = !!requestedAll;
            const pageNum = Math.max(Number(page) || 1, 1);
            const pageSizeNum = noPaging
                ? MAX_UNPAGED_TOTAL
                : Math.min(Math.max(Number(pageSize) || 20, 1), MAX_PAGE_SIZE);

            // Fetch personalization once (fast indexed lookup) to avoid per-row correlated subqueries
            const personalization = await this.getApplicantPersonalization(excludeUserApplications);

            // Add personalization parameters once; used in ORDER BY scoring.
            const dataParams: any[] = [...queryParams];

            const pjtParam = `@param${paramIndex}`; dataParams.push(personalization.preferredJobTypes); paramIndex++;
            const pwtParam = `@param${paramIndex}`; dataParams.push(personalization.preferredWorkTypes); paramIndex++;
            const plocParam = `@param${paramIndex}`; dataParams.push(personalization.preferredLocations); paramIndex++;
            const pcsParam = `@param${paramIndex}`; dataParams.push(personalization.preferredCompanySize); paramIndex++;
            const latestTitleParam = `@param${paramIndex}`; dataParams.push(personalization.latestJobTitle); paramIndex++;

            const personalizationCtes = this.buildPersonalizationCtesSql(pjtParam, pwtParam, plocParam, latestTitleParam);

            // 🚀 OPTIMIZATION: Select ONLY columns needed for JobCard display (removed unused columns)
            const dataStartTime = Date.now();
            let dataQuery = `${personalizationCtes}
                SELECT
                    j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
                    j.OrganizationID,
                    j.Location, j.City, j.Country, j.IsRemote, 
                    j.SalaryRangeMin, j.SalaryRangeMax, j.SalaryPeriod,
                    j.PublishedAt, j.CreatedAt,
                    jt.Value as JobTypeName,
                    wt.Value as WorkplaceTypeName,
                    o.Name as OrganizationName,
                    ISNULL(o.LogoURL, '') as OrganizationLogo
                FROM Jobs j
                INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                LEFT JOIN ReferenceMetadata wt ON j.WorkplaceTypeID = wt.ReferenceID AND wt.RefType = 'WorkplaceType'
                ${whereClause}
            `;

            const preferenceScoreSql = this.buildPreferenceScoreSql(pjtParam, pwtParam, plocParam, pcsParam);
            const roleTitleScoreSql = this.buildRoleTitleScoreSql(latestTitleParam);
            const hasSearchText = ((f.search || f.q || '') as any).toString().trim().length > 0;
            const roleTitlePersonalizationDisabled = ['false', '0', 'no', 'off'].includes(String(f.roleTitlePersonalization ?? '').toLowerCase())
                || f.roleTitlePersonalization === false
                || f.roleTitlePersonalization === 0;
            const hasRoleTitle = (personalization.latestJobTitle || '').toString().trim().length > 0;
            const useRoleTitleScore = !hasSearchText && !roleTitlePersonalizationDisabled && hasRoleTitle;

            const orderPrefix = hasSearchText
                ? `${preferenceScoreSql} DESC, `
                : (useRoleTitleScore ? `${roleTitleScoreSql} DESC, ${preferenceScoreSql} DESC, ` : `${preferenceScoreSql} DESC, `);

            // Page-based pagination without COUNT(*): fetch one extra row to determine hasMore.
            const offset = noPaging ? 0 : (pageNum - 1) * pageSizeNum;
            // 🚀 OPTIMIZATION: Use indexed PublishedAt instead of PublishedDate
            dataQuery += ` ORDER BY ${orderPrefix}j.PublishedAt DESC, j.JobID DESC 
                          OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY
                          OPTION (OPTIMIZE FOR (@param${paramIndex} = 0))`;
            dataParams.push(offset, pageSizeNum + 1);
            paramIndex += 2;

            console.log('🔍 Executing data query');
            const dataResult = await dbService.executeQuery<Job>(dataQuery, dataParams);
            const dataTime = Date.now() - dataStartTime;
            const fetched = dataResult.recordset || [];
            const hasMore = fetched.length > pageSizeNum;
            const rows = hasMore ? fetched.slice(0, pageSizeNum) : fetched;

            console.log('✅ Data query completed:', { rowCount: rows.length, hasMore, dataTime: `${dataTime}ms` });

            const totalTime = Date.now() - searchStartTime;
            console.log('✅ searchJobs completed:', {
                totalTime: `${totalTime}ms`,
                dataTime: `${dataTime}ms`,
                returned: rows.length
            });

            return { jobs: rows, hasMore, nextCursor: null };
        } catch (error) {
            const totalTime = Date.now() - searchStartTime;
            console.error('❌ Error in JobService.searchJobs:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                totalTime: `${totalTime}ms`
            });
            return { jobs: [], hasMore: false, nextCursor: null };
        }
    }
}