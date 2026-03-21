import { JobRepository } from '../repositories/job.repository';
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
import { PricingService } from './pricing.service';

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
        preferredRoles: string | null;
        isFresher: boolean;
        totalExperienceMonths: number;
    }> {
        if (!userId) {
            return {
                preferredJobTypes: null,
                preferredWorkTypes: null,
                preferredLocations: null,
                preferredCompanySize: null,
                latestJobTitle: null,
                preferredRoles: null,
                isFresher: false,
                totalExperienceMonths: 0
            };
        }

        const result = await JobRepository.getApplicantPersonalization(userId);
        const row = result;
        
        // User is fresher if:
        // 1. No work experience OR total experience < 12 months
        // 2. OR graduation year is >= current year (still in college or just graduated)
        const totalExpMonths = row?.totalExperienceMonths ?? 0;
        const workExpCount = row?.workExperienceCount ?? 0;
        const graduationYearStr = row?.graduationYear ?? '';
        const graduationYear = parseInt(graduationYearStr, 10) || 0;
        const currentYear = new Date().getFullYear();
        
        const isFresherByExperience = workExpCount === 0 || totalExpMonths < 12;
        const isFresherByEducation = graduationYear > 0 && graduationYear >= currentYear; // Still studying or graduating this year
        const isFresher = isFresherByExperience || isFresherByEducation;
        
        return {
            preferredJobTypes: row?.preferredJobTypes ?? null,
            preferredWorkTypes: row?.preferredWorkTypes ?? null,
            preferredLocations: row?.preferredLocations ?? null,
            preferredCompanySize: row?.preferredCompanySize ?? null,
            latestJobTitle: row?.latestJobTitle ?? null,
            preferredRoles: row?.preferredRoles ?? null,
            isFresher,
            totalExperienceMonths: totalExpMonths
        };
    }

    private static buildPreferenceScoreSql(
        preferredJobTypesParam: string,
        preferredWorkTypesParam: string,
        preferredLocationsParam: string,
        preferredCompanySizeParam: string
    ): string {
        // Scores are additive; higher means better match.
        // Weights: WorkplaceType=4 (highest), JobType=2, Location=2, CompanySize=1
        // PERF: expects CTEs `pjt`, `pwt`, `ploc` to exist so STRING_SPLIT runs once per request.
        return `(
            (CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM pjt
                    WHERE pjt.v = LOWER(REPLACE(LTRIM(RTRIM(jt.Value)), ' ', ''))
                )
                THEN 2 ELSE 0
            END)
            +
            (CASE
                WHEN NULLIF(LTRIM(RTRIM(wt.Value)), '') IS NOT NULL
                 AND EXISTS (
                    SELECT 1
                    FROM pwt
                    WHERE pwt.v = LOWER(REPLACE(LTRIM(RTRIM(wt.Value)), ' ', ''))
                 )
                THEN 4 ELSE 0
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

    /**
     * 🚀 PERF: Score job title match in application layer (JS) instead of SQL.
     * SQL LIKE '%token%' on thousands of rows is extremely slow (4-17s).
     * JS string.includes() on the same data takes <30ms.
     * Scoring:
     *   - Exact full title match: +6 pts if ANY combined title is found in job title
     *   - Per-token match: +2 pts per unique token (>=3 chars) found
     * @param jobTitle - The job's title from SQL result
     * @param combinedTitles - Pipe-separated titles (e.g. "Senior Backend Developer|Senior Business Analyst")
     */
    private static scoreTitleInApp(jobTitle: string, combinedTitles: string): number {
        if (!combinedTitles || !jobTitle) return 0;
        const titleLower = jobTitle.toLowerCase();
        const fullTitles = combinedTitles.split('|').map(t => t.trim()).filter(t => t.length > 0);
        const tokens = [...new Set(fullTitles.flatMap(t => t.split(' ')).filter(w => w.length >= 3))];
        const exactMatch = fullTitles.some(ft => titleLower.includes(ft.toLowerCase())) ? 6 : 0;
        const tokenMatches = tokens.filter(tok => titleLower.includes(tok.toLowerCase())).length * 2;
        return exactMatch + tokenMatches;
    }

    private static buildPersonalizationCtesSql(
        preferredJobTypesParam: string,
        preferredWorkTypesParam: string,
        preferredLocationsParam: string
    ): string {
        // These CTEs are independent of Jobs, so SQL Server can compute them once.
        // 🚀 PERF: Title scoring (rtitles/rtok) moved to app layer — see scoreTitleInApp().
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
            )
        `;
    }

    /**
     * \ud83d\ude80 OPTIMIZATION: Shared filter builder to avoid code duplication between getJobs and searchJobs
     * Builds WHERE clause and parameters for job queries with common filters
     */
    private static buildJobFilters(
        filters: any,
        excludeUserApplications?: string,
        options?: { excludeAppliedJobs?: boolean }
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
        // Only exclude when explicitly requested (internal services like email/AI)
        // User-facing APIs use LEFT JOIN + HasApplied flag instead
        if (excludeUserApplications && options?.excludeAppliedJobs) {
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

        // 🚀 OPTIMIZATION: Search term handling - Always use LIKE (faster than full-text for our data size)
        // Performance test results: LIKE 12-18ms vs Full-text 700-17000ms
        const searchTerm = (f.search || f.q || '').toString().trim();
        const searchTitleOnly = (f.searchTitle || '').toString().trim();
        if (searchTitleOnly && searchTitleOnly.length > 0) {
            // 🚀 Title-only search (used by AI recommendations) — avoids expensive o.Name LIKE scan
            whereClause += ` AND j.Title LIKE @param${paramIndex}`;
            queryParams.push(`%${searchTitleOnly}%`);
            paramIndex += 1;
        } else if (searchTerm && searchTerm.length > 0) {
            // Full search on Title + Organization Name (used by user-facing search)
            // This is 50-100x faster than full-text search for our dataset
            whereClause += ` AND (j.Title LIKE @param${paramIndex} OR o.Name LIKE @param${paramIndex + 1})`;
            queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
            paramIndex += 2;
        }

        // Location filter (supports comma-separated for multi-select)
        if (f.location) {
            const locations = f.location.split(',').map((l: string) => l.trim()).filter(Boolean);
            if (locations.length === 1) {
                whereClause += ` AND (j.Location LIKE @param${paramIndex} OR j.City LIKE @param${paramIndex + 1} OR j.Country LIKE @param${paramIndex + 2})`;
                queryParams.push(`%${locations[0]}%`, `%${locations[0]}%`, `%${locations[0]}%`);
                paramIndex += 3;
            } else if (locations.length > 1) {
                const orClauses = locations.map((loc: string, i: number) => {
                    const base = paramIndex + (i * 3);
                    queryParams.push(`%${loc}%`, `%${loc}%`, `%${loc}%`);
                    return `(j.Location LIKE @param${base} OR j.City LIKE @param${base + 1} OR j.Country LIKE @param${base + 2})`;
                });
                whereClause += ` AND (${orClauses.join(' OR ')})`;
                paramIndex += locations.length * 3;
            }
        }

        // Department filter
        if (f.department) {
            whereClause += ` AND j.Department LIKE @param${paramIndex}`;
            queryParams.push(`%${f.department}%`);
            paramIndex++;
        }

        // Organization filter (multiple organizations support)
        if (f.organizationIds) {
            const orgIdsStr = String(f.organizationIds).trim();
            
            if (orgIdsStr) {
                // Parse comma-separated organization IDs and convert to integers
                const orgIds = orgIdsStr.split(',')
                    .map(s => parseInt(s.trim(), 10))
                    .filter(n => !isNaN(n) && n > 0);
                
                if (orgIds.length > 0) {
                    // Build IN clause with parameterized values
                    const placeholders = orgIds.map(() => {
                        const placeholder = `@param${paramIndex}`;
                        paramIndex++;
                        return placeholder;
                    }).join(',');
                    
                    whereClause += ` AND j.OrganizationID IN (${placeholders})`;
                    queryParams.push(...orgIds);
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

        // 🧑‍💼 PostedByType filter - filter by who posted the job (0=Scraped, 1=Employer, 2=Referrer)
        if (f.postedByType !== undefined && f.postedByType !== null && f.postedByType !== '') {
            const postedByTypeValue = parseInt(String(f.postedByType), 10);
            if (!isNaN(postedByTypeValue) && [0, 1, 2].includes(postedByTypeValue)) {
                whereClause += ` AND j.PostedByType = @param${paramIndex}`;
                queryParams.push(postedByTypeValue);
                paramIndex++;
            }
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
            const wtResult = await JobRepository.resolveWorkplaceTypeId(workplaceTypeNormalized);
            if (wtResult) {
                workplaceTypeId = wtResult;
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
        // PostedByType: 0 = Scraped, 1 = Employer posted, 2 = Referrer posted
        add('PostedByType', validated.postedByType === 'Referrer' ? 2 : 1);
        add('Title', validated.title);
        add('JobTypeID', validated.jobTypeID || 1);
        add('WorkplaceTypeID', workplaceTypeId);
        add('Department', department);
        add('Description', validated.description);
        add('Location', location);
        add('ExternalJobID', validated.externalJobID || externalJobId);

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

        // Debug logging
        console.log('📝 Job INSERT - Fields:', fields);
        console.log('📝 Job INSERT - Values count:', values.length);

        try {
            const job = await JobRepository.insertJob(fields, values);
            if (!job) {
                throw new Error('Failed to create job');
            }
            return job;
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
        const { page, pageSize, excludeUserApplications, excludeAppliedJobs } = params;
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
        // excludeAppliedJobs=true: internal services (email/AI) keep old NOT EXISTS behavior
        // excludeAppliedJobs=falsy: user-facing API returns HasApplied flag via LEFT JOIN
        let { whereClause, queryParams, paramIndex: currentParamIndex } = this.buildJobFilters(f, excludeUserApplications, { excludeAppliedJobs: !!excludeAppliedJobs });
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

        // 🎓 FRESHER FILTERING: For freshers (< 1 year experience), show only entry-level Engineer jobs
        // BUT: If user has a current job title, prioritize that over fresher status
        // Example: A user with "Senior Software Engineer" title but only 6 months logged experience
        //          should still see SSE jobs, not be restricted to entry-level
        const hasJobTitle = personalization.latestJobTitle && personalization.latestJobTitle.trim().length > 0;
        
        if (personalization.isFresher && !f.skipFresherFilter && !hasJobTitle) {
            // Only apply fresher filter if user has NO job title set
            whereClause += ` AND j.Title LIKE '%Engineer%'
                AND j.Title NOT LIKE '%Senior%'
                AND j.Title NOT LIKE '%Lead%'
                AND j.Title NOT LIKE '%Principal%'
                AND j.Title NOT LIKE '%Staff%'
                AND j.Title NOT LIKE '%Head%'
                AND j.Title NOT LIKE '%Director%'
                AND j.Title NOT LIKE '%Manager%'
                AND j.Title NOT LIKE '%VP%'
                AND j.Title NOT LIKE '%Chief%'
                AND j.Title NOT LIKE '%Architect%'`;
        }

        // Add personalization parameters — only needed for the non-useRoleTitleScore path (SQL CTEs).
        // For useRoleTitleScore, we skip CTEs and do all scoring in JS, so these params are unused in SQL
        // but still safe to include (SQL Server ignores undeclared params).
        const dataParams: any[] = [...queryParams];

        const pjtParam = `@param${paramIndex}`; dataParams.push(personalization.preferredJobTypes); paramIndex++;
        const pwtParam = `@param${paramIndex}`; dataParams.push(personalization.preferredWorkTypes); paramIndex++;
        const plocParam = `@param${paramIndex}`; dataParams.push(personalization.preferredLocations); paramIndex++;
        const pcsParam = `@param${paramIndex}`; dataParams.push(personalization.preferredCompanySize); paramIndex++;

        // Build combined pipe-separated titles: latestJobTitle + preferredRoles + AI's preferredRoleTitles
        // This ensures scoring considers ALL relevant role titles, not just the single latest one
        const titleParts: string[] = [];
        if (personalization.latestJobTitle?.trim()) titleParts.push(personalization.latestJobTitle.trim());
        // preferredRoleTitles from AI filters (already pipe-separated)
        if (f.preferredRoleTitles?.trim()) {
            f.preferredRoleTitles.split('|').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
                .forEach((t: string) => { if (!titleParts.includes(t)) titleParts.push(t); });
        }
        // preferredRoles from Applicants table (comma-separated)
        if (personalization.preferredRoles?.trim()) {
            personalization.preferredRoles.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
                .forEach((t: string) => { if (!titleParts.includes(t)) titleParts.push(t); });
        }
        const combinedTitles = titleParts.join('|') || '';

        const personalizationCtes = this.buildPersonalizationCtesSql(pjtParam, pwtParam, plocParam);

        const preferenceScoreSql = this.buildPreferenceScoreSql(pjtParam, pwtParam, plocParam, pcsParam);
        const hasSearchText = ((f.search || f.q || '') as any).toString().trim().length > 0;
        const roleTitlePersonalizationDisabled = ['false', '0', 'no', 'off'].includes(String(f.roleTitlePersonalization ?? '').toLowerCase())
            || f.roleTitlePersonalization === false
            || f.roleTitlePersonalization === 0;
        // NEW: Skip personalization if dontPersonalize=true is passed from frontend
        const skipPersonalization = f.dontPersonalize === true;
        const hasRoleTitle = combinedTitles.length > 0;
        const useRoleTitleScore = !skipPersonalization && !hasSearchText && !roleTitlePersonalizationDisabled && hasRoleTitle;

        // Workplace type ordering: Remote (444) > Hybrid (442) > Onsite (443)
        const workplaceOrderSql = `CASE j.WorkplaceTypeID WHEN 444 THEN 1 WHEN 442 THEN 2 WHEN 443 THEN 3 ELSE 4 END`;

        // HasApplied: For user-facing APIs (no excludeAppliedJobs), add LEFT JOIN to flag applied jobs
        const includeHasApplied = !!excludeUserApplications && !excludeAppliedJobs;
        let hasAppliedJoin = '';
        let hasAppliedColumn = '';
        if (includeHasApplied) {
            hasAppliedJoin = `
            LEFT JOIN (
                SELECT ja.JobID
                FROM JobApplications ja
                INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
                WHERE a.UserID = @param${paramIndex} AND ja.StatusID != 6
            ) ua ON ua.JobID = j.JobID`;
            hasAppliedColumn = `,
                CASE WHEN ua.JobID IS NOT NULL THEN 1 ELSE 0 END AS HasApplied`;
            dataParams.push(excludeUserApplications);
            paramIndex++;
        }

        // 🚀 OPTIMIZATION: Select ONLY columns needed for JobCard display (removed unused columns)
        // When useRoleTitleScore: skip CTEs, include o.Size for JS-side preference scoring
        let dataQuery: string;
        if (useRoleTitleScore) {
            // 🚀 PERF v3: No CTEs in SQL — all scoring in JS.
            // Diagnosis showed CTEs add ~1,500ms to SQL query (3,984ms → 2,502ms without).
            // JS preference scoring takes only ~30ms for 3,225 rows with identical results.
            dataQuery = `
            SELECT
                j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
                j.OrganizationID, j.PostedByType,
                j.Location, j.City, j.State, j.Country, j.IsRemote, 
                j.ExperienceMin, j.ExperienceMax,
                j.PublishedAt, j.CreatedAt,
                jt.Value as JobTypeName,
                wt.Value as WorkplaceTypeName,
                o.Name as OrganizationName,
                ISNULL(o.LogoURL, '') as OrganizationLogo,
                ISNULL(o.Size, '') as OrganizationSize,
                ISNULL(o.Tier, 'Standard') as OrganizationTier${hasAppliedColumn}
            FROM Jobs j
            INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            LEFT JOIN ReferenceMetadata wt ON j.WorkplaceTypeID = wt.ReferenceID AND wt.RefType = 'WorkplaceType'${hasAppliedJoin}
            ${whereClause}
        `;
        } else {
            dataQuery = `${personalizationCtes}
            SELECT
                j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
                j.OrganizationID, j.PostedByType,
                j.Location, j.City, j.State, j.Country, j.IsRemote, 
                j.ExperienceMin, j.ExperienceMax,
                j.PublishedAt, j.CreatedAt,
                jt.Value as JobTypeName,
                wt.Value as WorkplaceTypeName,
                o.Name as OrganizationName,
                ISNULL(o.LogoURL, '') as OrganizationLogo,
                ISNULL(o.Tier, 'Standard') as OrganizationTier${hasAppliedColumn}
            FROM Jobs j
            INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            LEFT JOIN ReferenceMetadata wt ON j.WorkplaceTypeID = wt.ReferenceID AND wt.RefType = 'WorkplaceType'${hasAppliedJoin}
            ${whereClause}
        `;
        }

        let fetched: any[];

        if (useRoleTitleScore) {
            // 🚀 PERF v3: No CTEs in SQL. All scoring (preference + title) in JS.
            // Diagnosis: CTEs added ~1,500ms. JS scoring for 3,225 rows = ~30ms.
            // Result: 4,000ms → ~2,500ms with identical page 1 results.
            dataQuery += ` ORDER BY ${normalizedSort} ${normalizedOrder}, j.JobID ${normalizedOrder}`;

            const allRows = await JobRepository.executeQuery<any>(dataQuery, dataParams);

            // Parse user preferences for JS-side scoring
            const prefJobTypes = (personalization.preferredJobTypes || '').split(',')
                .map((s: string) => s.trim().toLowerCase().replace(/\s+/g, '')).filter(Boolean);
            const prefWorkTypes = (personalization.preferredWorkTypes || '').split(',')
                .map((s: string) => s.trim().toLowerCase().replace(/\s+/g, '')).filter(Boolean);
            const prefLocations = (personalization.preferredLocations || '').split(',')
                .map((s: string) => s.trim().toLowerCase()).filter(Boolean);
            const prefCompanySize = (personalization.preferredCompanySize || '').trim().toLowerCase();

            // Score preference + title in JS (~30ms for 3,225 rows)
            const wpOrder: Record<number, number> = { 444: 1, 442: 2, 443: 3 };
            const scored = allRows.map((row: any) => {
                // Preference score (same weights as SQL CTEs: workplace=4, jobType=2, location=2, companySize=1)
                let prefScore = 0;
                const jobType = (row.JobTypeName || '').trim().toLowerCase().replace(/\s+/g, '');
                if (jobType && prefJobTypes.includes(jobType)) prefScore += 2;
                const workType = (row.WorkplaceTypeName || '').trim().toLowerCase().replace(/\s+/g, '');
                if (workType && prefWorkTypes.includes(workType)) prefScore += 4;
                const loc = (row.Location || '').toLowerCase();
                const city = (row.City || '').toLowerCase();
                const country = (row.Country || '').toLowerCase();
                if (prefLocations.some((pl: string) => loc.includes(pl) || city.includes(pl) || country.includes(pl))) prefScore += 2;
                const orgSize = ((row as any).OrganizationSize || '').trim().toLowerCase();
                if (prefCompanySize && orgSize && orgSize === prefCompanySize) prefScore += 1;
                (row as any)._prefScore = prefScore;

                // Title score
                (row as any)._titleScore = this.scoreTitleInApp(row.Title, combinedTitles);
                return row;
            });

            // Sort: India first > titleScore DESC > prefScore DESC > workplace order > recency
            // No tier boosting — JobsLandingScreen has dedicated Top MNC section
            scored.sort((a: any, b: any) => {
                // India jobs first
                const countryA = (a.Country || '').toLowerCase();
                const countryB = (b.Country || '').toLowerCase();
                const isIndiaA = (countryA === 'in' || countryA === 'india') ? 0 : 1;
                const isIndiaB = (countryB === 'in' || countryB === 'india') ? 0 : 1;
                if (isIndiaA !== isIndiaB) return isIndiaA - isIndiaB;
                if (b._titleScore !== a._titleScore) return b._titleScore - a._titleScore;
                if (b._prefScore !== a._prefScore) return b._prefScore - a._prefScore;
                const wa = wpOrder[a.WorkplaceTypeID] || 4;
                const wb = wpOrder[b.WorkplaceTypeID] || 4;
                if (wa !== wb) return wa - wb;
                const pa = a.PublishedAt?.getTime?.() || 0;
                const pb = b.PublishedAt?.getTime?.() || 0;
                if (pb !== pa) return pb - pa;
                return (b.JobID || '').localeCompare(a.JobID || '');
            });

            // Paginate in JS
            const offset = noPaging ? 0 : (pageNum - 1) * pageSizeNum;
            fetched = scored.slice(offset, offset + pageSizeNum + 1);
        } else {
            // No title scoring needed — keep fast SQL-only pagination
            // Uses pre-computed indexed columns for O(1) sort:
            //   j.CountryRank (0=India, 1=Other) — indexed in IX_Jobs_SortRank
            //   j.TierRank (0=Elite, 1=Premium, 2=Standard) — indexed in IX_Jobs_SortRank
            // This avoids CASE WHEN on every row and enables index-assisted ORDER BY
            const orderPrefix = skipPersonalization
                ? `j.CountryRank, j.TierRank, ${workplaceOrderSql}, `
                : (hasSearchText
                    ? `j.CountryRank, j.TierRank, ${preferenceScoreSql} DESC, ${workplaceOrderSql}, `
                    : `j.CountryRank, j.TierRank, ${preferenceScoreSql} DESC, ${workplaceOrderSql}, `);

            const offset = noPaging ? 0 : (pageNum - 1) * pageSizeNum;
            dataQuery += ` ORDER BY ${orderPrefix}${normalizedSort} ${normalizedOrder}, j.JobID ${normalizedOrder} 
                          OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY
                          OPTION (OPTIMIZE FOR (@param${paramIndex} = 0))`;
            dataParams.push(offset, pageSizeNum + 1);
            paramIndex += 2;

            fetched = await JobRepository.executeQuery<Job>(dataQuery, dataParams);
        }

        const hasMore = fetched.length > pageSizeNum;
        const rows = hasMore ? fetched.slice(0, pageSizeNum) : fetched;

        return { jobs: rows, hasMore, nextCursor: null };
    }

    // Get job by ID - ENHANCED: Search SQL first, then archived jobs in blob storage
    static async getJobById(jobId: string): Promise<Job | null> {
        // First, try to get from SQL database
        const job = await JobRepository.findJobById(jobId);
        
        if (job) {
            return job;
        }

        // If not found in SQL, search in archived jobs (blob storage)
        try {
            const { JobArchiveService } = await import('./job-archive.service');
            const archivedJob = await JobArchiveService.getArchivedJob(jobId);
            
            if (archivedJob) {
                // Add flag that this is an archived job
                // Frontend uses IsArchived flag to hide Apply/Refer buttons
                return {
                    ...archivedJob,
                    IsArchived: true,
                    Status: 'Archived'
                } as Job;
            }
        } catch (archiveError: any) {
            console.error(`Error searching archives for job ${jobId}:`, archiveError.message);
        }

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
            const hasPermission = await JobRepository.checkEmployerPermission(userId, Number(existingJob.OrganizationID));

            if (!hasPermission) {
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

        await JobRepository.updateJob(jobId, updateFields, values);

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

        // Check permissions - user must be the one who posted the job OR an employer at that org
        if (job.PostedByUserID !== userId) {
            const hasPermission = await JobRepository.checkEmployerPermission(userId, Number(job.OrganizationID));

            if (!hasPermission) {
                throw new ValidationError('Insufficient permissions to publish this job');
            }
        }
        // If job.PostedByUserID === userId, user is the original poster (employer OR referrer), allow publish

        // Check if this is a referrer-posted job or employer-posted job
        // PostedByType: 0 = Scraped, 1 = Employer, 2 = Referrer
        const isReferrerPostedJob = job.PostedByType === 2;
        const PUBLISH_JOB_FEE = await PricingService.getJobPublishCost(); // Dynamic pricing (default: ₹0 — free)

        // Only charge if fee > 0 and not a referrer-posted job
        const shouldChargeFee = !isReferrerPostedJob && PUBLISH_JOB_FEE > 0;
        if (shouldChargeFee) {
            const wallet = await WalletService.getOrCreateWallet(userId);
            if (wallet.Balance < PUBLISH_JOB_FEE) {
                throw new InsufficientBalanceError('Insufficient wallet balance to publish job');
            }
        }

        // Update job status to Published
        await JobRepository.publishJob(jobId);

        // Deduct fee after successful publish (only if fee is configured and not referrer-posted)
        if (shouldChargeFee) {
            try {
                await WalletService.debitWallet(
                    userId,
                    PUBLISH_JOB_FEE,
                    'JOB_PUBLISH',
                    `Publish job - ${job.Title || jobId}`
                );
            } catch (error) {
                try {
                    await JobRepository.revertToDraft(jobId);
                } catch (revertError) {
                    console.error('Failed to revert job after wallet debit failure:', revertError);
                }
                throw error;
            }
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
            const hasPermission = await JobRepository.checkEmployerPermission(userId, Number(job.OrganizationID));

            if (!hasPermission) {
                throw new ValidationError('Insufficient permissions to close this job');
            }
        }

        await JobRepository.closeJob(jobId);
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

        const applicationCount = await JobRepository.countApplications(jobId);

        if (applicationCount > 0) {
            throw new ValidationError('Cannot delete job with existing applications');
        }

        await JobRepository.deleteJob(jobId);
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

        const total = await JobRepository.countByOrganization(whereClause, queryParams);
        const totalPages = Math.max(Math.ceil(total / pageSize), 1);

        const offset = (page - 1) * pageSize;
        const dataQuery = `
            SELECT
                j.*, jt.Value as JobTypeName, o.Name as OrganizationName, ISNULL(o.Tier, 'Standard') as OrganizationTier
            FROM Jobs j
            INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
            INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
            ${whereClause}
            ORDER BY ${normalizedSort} ${normalizedOrder}
            OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY`;
        queryParams.push(offset, pageSize);

        const jobs = await JobRepository.executeQuery<Job>(dataQuery, queryParams);
        return { jobs, total, totalPages };
    }

    // Get jobs posted by a specific user (for referrers and employers)
    static async getJobsByPostedUser(userId: string, params: PaginationParams & { status?: string; search?: string }): Promise<{ jobs: Job[]; total: number; totalPages: number }> {
        const { page, pageSize, sortBy = 'CreatedAt', sortOrder = 'desc', status, search } = params as any;

        const allowedSort: Record<string, string> = {
            CreatedAt: 'j.CreatedAt',
            UpdatedAt: 'j.UpdatedAt',
            PublishedAt: 'j.PublishedAt',
            Title: 'j.Title'
        };
        const normalizedSort = allowedSort[sortBy] || 'j.CreatedAt';
        const normalizedOrder = (sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        let whereClause = 'WHERE j.PostedByUserID = @param0';
        const queryParams: any[] = [userId];
        let paramIndex = 1;

        if (status) {
            const normalizedStatus = String(status).trim();
            if (['Draft', 'Published', 'Closed'].includes(normalizedStatus)) {
                // Use simple equality - Status values are already clean in DB
                whereClause += ` AND j.Status = @param${paramIndex}`;
                queryParams.push(normalizedStatus);
                paramIndex++;
            }
        }

        if (search) {
            const tokens = String(search).trim().split(/\s+/).filter(Boolean);
            if (tokens.length) {
                const tokenClauses: string[] = [];
                tokens.forEach(tok => {
                    tokenClauses.push(`(j.Title LIKE @param${paramIndex} OR j.Description LIKE @param${paramIndex})`);
                    queryParams.push(`%${tok}%`);
                    paramIndex += 1;
                });
                whereClause += ` AND (${tokenClauses.join(' OR ')})`;
            }
        }

        const total = await JobRepository.countByOrganization(whereClause, queryParams);
        const totalPages = Math.max(Math.ceil(total / pageSize), 1);

        const offset = (page - 1) * pageSize;
        // 🚀 Use subqueries instead of JOINs for better query plan optimization
        // INNER JOIN to ReferenceMetadata was causing 120s+ timeouts on 118k jobs
        // Subqueries execute in ~20ms
        const dataQuery = `
            SELECT
                j.JobID, j.Title, j.Status, j.JobTypeID, j.WorkplaceTypeID,
                j.OrganizationID, j.PostedByType, j.PostedByUserID,
                j.Location, j.City, j.State, j.Country, j.IsRemote,
                j.SalaryRangeMin, j.SalaryRangeMax, j.SalaryPeriod,
                j.PublishedAt, j.CreatedAt, j.UpdatedAt,
                (SELECT TOP 1 Value FROM ReferenceMetadata WHERE ReferenceID = j.JobTypeID AND RefType = 'JobType') as JobTypeName,
                (SELECT TOP 1 Name FROM Organizations WHERE OrganizationID = j.OrganizationID) as OrganizationName,
                ISNULL((SELECT TOP 1 LogoURL FROM Organizations WHERE OrganizationID = j.OrganizationID), '') as OrganizationLogo
            FROM Jobs j
            ${whereClause}
            ORDER BY ${normalizedSort} ${normalizedOrder}
            OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY`;
        queryParams.push(offset, pageSize);

        const jobs = await JobRepository.executeQuery<Job>(dataQuery, queryParams);
        return { jobs, total, totalPages };
    }

    // Get currencies (reference data) — delegates to ReferenceRepository (cached, 30 min TTL)
    static async getCurrencies(): Promise<any[]> {
        const { ReferenceRepository } = await import('../repositories/reference.repository');
        return ReferenceRepository.getCurrencies();
    }

    // ── Job Locations (cached) ──────────────────────────────────
    private static _locationCache: { data: any[]; expiresAt: number } | null = null;
    private static readonly LOCATION_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

    /**
     * Get distinct job locations with job counts.
     * Cached in-memory for 4 hours (refreshed with scraper cycle).
     */
    static async getJobLocations(): Promise<any[]> {
        // Return cache if valid
        if (this._locationCache && Date.now() < this._locationCache.expiresAt) {
            return this._locationCache.data;
        }

        const rows = await JobRepository.getLocationCounts();

        // Extract clean city names from "City, State" format
        const cityMap = new Map<string, number>();
        for (const row of rows) {
            const loc = (row.Location || '').trim();
            if (!loc) continue;

            // Use the first part (city) as the label
            const city = loc.split(',')[0].trim();
            if (!city || city.length < 2) continue;

            // Aggregate job counts for same city
            cityMap.set(city, (cityMap.get(city) || 0) + row.JobCount);
        }

        // Convert to sorted array, top 100
        const locations = Array.from(cityMap.entries())
            .map(([city, count]) => ({ city, jobCount: count }))
            .sort((a, b) => b.jobCount - a.jobCount)
            .slice(0, 100);

        // Cache it
        this._locationCache = {
            data: locations,
            expiresAt: Date.now() + this.LOCATION_CACHE_TTL,
        };

        console.log(`📍 Job locations cached: ${locations.length} cities`);
        return locations;
    }

    /**
     * Search jobs with advanced filters and pagination
     * Supports personalization based on user preferences
     */
    static async searchJobs(searchParams: any): Promise<{ jobs: Job[]; hasMore: boolean; nextCursor: any | null }> {
        try {
            const { page = 1, pageSize = 20, excludeUserApplications, excludeAppliedJobs, ...rest } = searchParams || {};
            const f = { ...rest } as any;
            
            // 🚀 Use shared filter builder to avoid duplication
            // excludeAppliedJobs=true: internal services keep old NOT EXISTS behavior
            // excludeAppliedJobs=falsy: user-facing API returns HasApplied flag via LEFT JOIN
            const { whereClause, queryParams, paramIndex: currentParamIndex } = this.buildJobFilters(f, excludeUserApplications, { excludeAppliedJobs: !!excludeAppliedJobs });
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

            // Build combined pipe-separated titles for scoring (same as getJobs)
            const titleParts: string[] = [];
            if (personalization.latestJobTitle?.trim()) titleParts.push(personalization.latestJobTitle.trim());
            if (personalization.preferredRoles?.trim()) {
                personalization.preferredRoles.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
                    .forEach((t: string) => { if (!titleParts.includes(t)) titleParts.push(t); });
            }
            const combinedTitles = titleParts.join('|') || '';

            const personalizationCtes = this.buildPersonalizationCtesSql(pjtParam, pwtParam, plocParam);

            const preferenceScoreSql = this.buildPreferenceScoreSql(pjtParam, pwtParam, plocParam, pcsParam);
            const hasSearchText = ((f.search || f.q || '') as any).toString().trim().length > 0;
            const roleTitlePersonalizationDisabled = ['false', '0', 'no', 'off'].includes(String(f.roleTitlePersonalization ?? '').toLowerCase())
                || f.roleTitlePersonalization === false
                || f.roleTitlePersonalization === 0;
            // NEW: Skip personalization if dontPersonalize=true is passed from frontend
            const skipPersonalization = f.dontPersonalize === true;
            const hasRoleTitle = combinedTitles.length > 0;
            const useRoleTitleScore = !skipPersonalization && !hasSearchText && !roleTitlePersonalizationDisabled && hasRoleTitle;

            // HasApplied: For user-facing APIs (no excludeAppliedJobs), add LEFT JOIN to flag applied jobs
            const includeHasApplied = !!excludeUserApplications && !excludeAppliedJobs;
            let hasAppliedJoin = '';
            let hasAppliedColumn = '';
            if (includeHasApplied) {
                hasAppliedJoin = `
                LEFT JOIN (
                    SELECT ja.JobID
                    FROM JobApplications ja
                    INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
                    WHERE a.UserID = @param${paramIndex} AND ja.StatusID != 6
                ) ua ON ua.JobID = j.JobID`;
                hasAppliedColumn = `,
                    CASE WHEN ua.JobID IS NOT NULL THEN 1 ELSE 0 END AS HasApplied`;
                dataParams.push(excludeUserApplications);
                paramIndex++;
            }

            // 🚀 OPTIMIZATION: Select ONLY columns needed for JobCard display (removed unused columns)
            const dataStartTime = Date.now();
            let dataQuery = `${personalizationCtes}
                SELECT
                    j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
                    j.OrganizationID, j.PostedByType,
                    j.Location, j.City, j.Country, j.IsRemote, 
                    j.SalaryRangeMin, j.SalaryRangeMax, j.SalaryPeriod,
                    j.PublishedAt, j.CreatedAt,
                    jt.Value as JobTypeName,
                    wt.Value as WorkplaceTypeName,
                    o.Name as OrganizationName,
                    ISNULL(o.LogoURL, '') as OrganizationLogo,
                    ISNULL(o.Tier, 'Standard') as OrganizationTier${hasAppliedColumn}
                    ${useRoleTitleScore ? `, ${preferenceScoreSql} AS _prefScore` : ''}
                FROM Jobs j
                INNER JOIN ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                LEFT JOIN ReferenceMetadata wt ON j.WorkplaceTypeID = wt.ReferenceID AND wt.RefType = 'WorkplaceType'${hasAppliedJoin}
                ${whereClause}
            `;

            let fetched: any[];

            if (useRoleTitleScore) {
                // 🚀 PERF: Title scoring in app layer — see getJobs for detailed explanation
                dataQuery += ` ORDER BY ${preferenceScoreSql} DESC, j.PublishedAt DESC, j.JobID DESC`;

                const allRows = await JobRepository.executeQuery<any>(dataQuery, dataParams);

                const wpOrder: Record<number, number> = { 444: 1, 442: 2, 443: 3 };
                const scored = allRows.map((row: any) => {
                    (row as any)._titleScore = this.scoreTitleInApp(row.Title, combinedTitles);
                    return row;
                });

                scored.sort((a: any, b: any) => {
                    // Sort by title relevance first, then preference score, then recency
                    // No tier boosting — JobsLandingScreen has dedicated Top MNC section
                    if (b._titleScore !== a._titleScore) return b._titleScore - a._titleScore;
                    if (b._prefScore !== a._prefScore) return b._prefScore - a._prefScore;
                    const wa = wpOrder[a.WorkplaceTypeID] || 4;
                    const wb = wpOrder[b.WorkplaceTypeID] || 4;
                    if (wa !== wb) return wa - wb;
                    const pa = a.PublishedAt?.getTime?.() || 0;
                    const pb = b.PublishedAt?.getTime?.() || 0;
                    if (pb !== pa) return pb - pa;
                    return (b.JobID || '').localeCompare(a.JobID || '');
                });

                const offset = noPaging ? 0 : (pageNum - 1) * pageSizeNum;
                fetched = scored.slice(offset, offset + pageSizeNum + 1);
            } else {
                // Default: boost India jobs first using pre-computed indexed column j.CountryRank
                // CountryRank (0=India, 1=Other) is indexed in IX_Jobs_SortRank
                const orderPrefix = skipPersonalization
                    ? `j.CountryRank, ` // No personalization — just India first, then newest
                    : (hasSearchText
                        ? `j.CountryRank, ${preferenceScoreSql} DESC, `
                        : `j.CountryRank, ${preferenceScoreSql} DESC, `);

                const offset = noPaging ? 0 : (pageNum - 1) * pageSizeNum;
                dataQuery += ` ORDER BY ${orderPrefix}j.PublishedAt DESC, j.JobID DESC 
                              OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY
                              OPTION (OPTIMIZE FOR (@param${paramIndex} = 0))`;
                dataParams.push(offset, pageSizeNum + 1);
                paramIndex += 2;

                fetched = await JobRepository.executeQuery<Job>(dataQuery, dataParams);
            }

            const hasMore = fetched.length > pageSizeNum;
            const rows = hasMore ? fetched.slice(0, pageSizeNum) : fetched;

            return { jobs: rows, hasMore, nextCursor: null };
        } catch (error) {
            console.error('Error in JobService.searchJobs:', error instanceof Error ? error.message : 'Unknown error');
            return { jobs: [], hasMore: false, nextCursor: null };
        }
    }
}