/**
 * Direct Career Site Scraper Service
 * Scrapes jobs DIRECTLY from company career pages via their ATS APIs.
 * 
 * Unlike the Adzuna-based scraper, every job from this service has:
 * ✅ A direct URL to the company's official career page
 * ✅ The company's real job/requisition ID
 * ✅ Guaranteed real-time availability (if it's on their site, it's real)
 * 
 * Supports: Workday, Greenhouse, SmartRecruiters, Amazon.jobs, Lever
 */

import axios from 'axios';
import { dbService } from './database.service';
import { AuthService } from './auth.service';
import {
  CAREER_SITE_CONFIGS,
  DIRECT_SCRAPER_CONFIG,
  CompanyCareerConfig,
  ATSPlatform,
} from '../config/direct-career-scraper.config';
import { findFortune500Match } from '../data/fortune500-companies';

// ─── Types ───────────────────────────────────────────────────────

interface DirectScrapedJob {
  externalJobId: string;    // e.g., "direct_boeing_JR2026497191"
  companyJobId: string;     // The company's own requisition/job ID
  title: string;
  company: string;
  location: string;
  description: string;
  applicationUrl: string;   // DIRECT link to company career page
  careerPageUrl: string;    // Company's career site root
  postedDate?: Date;
  jobType: string;
  workplaceType: string;
  department?: string;
  source: ATSPlatform;
}

interface DirectScrapingResult {
  success: boolean;
  jobsAdded: number;
  errors: string[];
  summary: {
    totalJobsScraped: number;
    companiesScraped: number;
    companyBreakdown: { [key: string]: number };
    executionTime: number;
  };
}

// ─── Main Service ────────────────────────────────────────────────

export class DirectCareerScraperService {

  // ─── Workday Adapter ─────────────────────────────────────────
  
  private static async scrapeWorkday(config: CompanyCareerConfig): Promise<DirectScrapedJob[]> {
    const jobs: DirectScrapedJob[] = [];
    
    if (!config.tenant || !config.wdNumber || !config.site) {
      console.error(`❌ ${config.name}: Missing Workday config`);
      return jobs;
    }
    
    const baseUrl = `https://${config.tenant}.wd${config.wdNumber}.myworkdayjobs.com/wday/cxs/${config.tenant}/${config.site}/jobs`;
    
    // Workday API returns max 20 per page. Use search terms + pagination.
    const allSearchTerms = DIRECT_SCRAPER_CONFIG.workdaySearchTerms;
    const rotationIndex = Math.floor(new Date().getUTCHours() / 6); // 0-3
    const termsCount = DIRECT_SCRAPER_CONFIG.workdaySearchTermsPerCompany;
    const startIdx = (rotationIndex * termsCount) % allSearchTerms.length;
    const searchTerms = allSearchTerms.slice(startIdx, startIdx + termsCount);
    
    // Also do one blank search to get latest jobs regardless of title
    const allTerms = ['', ...searchTerms];
    const seenIds = new Set<string>();
    
    for (const term of allTerms) {
      if (jobs.length >= config.maxJobs) break;
      
      try {
        const body = {
          appliedFacets: {},
          limit: 20,
          offset: 0,
          searchText: term,
        };
        
        const response = await axios.post(baseUrl, body, {
          timeout: DIRECT_SCRAPER_CONFIG.requestTimeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0',
          },
          validateStatus: (s) => s === 200,
        });
        
        const postings = response.data?.jobPostings || [];
        
        for (const posting of postings) {
          if (jobs.length >= config.maxJobs) break;
          
          const jobId = (posting.bulletFields || [])[0] || posting.externalPath?.split('/')?.pop() || '';
          if (!jobId || seenIds.has(jobId)) continue;
          seenIds.add(jobId);
          
          const directUrl = config.jobUrlTemplate
            .replace('{externalPath}', posting.externalPath || '')
            .replace('{jobId}', jobId);
          
          // Extract location
          const location = posting.locationsText || posting.location || '';
          
          // Parse posted date
          let postedDate: Date | undefined;
          if (posting.postedOn) {
            // Workday uses "Posted 2 Days Ago", "Posted Today", "Posted 30+ Days Ago"
            const daysMatch = posting.postedOn.match(/(\d+)\s*(?:days?|d)/i);
            if (daysMatch) {
              postedDate = new Date(Date.now() - parseInt(daysMatch[1]) * 86400000);
            } else if (/today/i.test(posting.postedOn)) {
              postedDate = new Date();
            } else if (/yesterday/i.test(posting.postedOn)) {
              postedDate = new Date(Date.now() - 86400000);
            }
          }
          
          jobs.push({
            externalJobId: `direct_${config.name.toLowerCase().replace(/\s+/g, '_')}_${jobId}`,
            companyJobId: jobId,
            title: (posting.title || '').substring(0, 200),
            company: config.name,
            location: location.substring(0, 200),
            description: posting.descriptionPlainText || posting.description || `${posting.title} at ${config.name}. Apply directly on the official career site.`,
            applicationUrl: directUrl,
            careerPageUrl: config.careerPageUrl,
            postedDate,
            jobType: this.detectJobType(posting.title, posting.employmentType),
            workplaceType: this.detectWorkplaceType(location, posting.title),
            department: posting.category || undefined,
            source: 'workday',
          });
        }
        
        await this.delay(DIRECT_SCRAPER_CONFIG.requestDelayMs);
        
      } catch (error: any) {
        if (error.response?.status === 429) {
          console.warn(`⚠️ ${config.name} (Workday): Rate limited, stopping`);
          break;
        }
        console.warn(`⚠️ ${config.name} (Workday) search="${term}": ${error.message}`);
      }
    }
    
    return jobs;
  }

  // ─── Greenhouse Adapter ──────────────────────────────────────
  
  private static async scrapeGreenhouse(config: CompanyCareerConfig): Promise<DirectScrapedJob[]> {
    const jobs: DirectScrapedJob[] = [];
    
    if (!config.slug) {
      console.error(`❌ ${config.name}: Missing Greenhouse slug`);
      return jobs;
    }
    
    try {
      // Greenhouse API returns all jobs in one call (paginated with per_page)
      const url = `https://boards-api.greenhouse.io/v1/boards/${config.slug}/jobs?content=true&per_page=${config.maxJobs}`;
      
      const response = await axios.get(url, {
        timeout: DIRECT_SCRAPER_CONFIG.requestTimeoutMs,
        validateStatus: (s) => s === 200,
      });
      
      const postings = response.data?.jobs || [];
      
      for (const posting of postings.slice(0, config.maxJobs)) {
        const jobId = posting.id?.toString() || '';
        if (!jobId) continue;
        
        const directUrl = posting.absolute_url || 
          config.jobUrlTemplate.replace('{jobId}', jobId).replace('{slug}', config.slug);
        
        // Extract location from Greenhouse's location object
        const location = posting.location?.name || 'Remote';
        
        // Clean HTML from description
        const description = (posting.content || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 3000);
        
        let postedDate: Date | undefined;
        if (posting.updated_at) {
          postedDate = new Date(posting.updated_at);
        }
        
        // Extract department from Greenhouse metadata
        const department = posting.departments?.[0]?.name || undefined;
        
        jobs.push({
          externalJobId: `direct_${config.slug}_gh_${jobId}`,
          companyJobId: jobId,
          title: (posting.title || '').substring(0, 200),
          company: config.name,
          location,
          description: description || `${posting.title} at ${config.name}. Apply directly on the official career site.`,
          applicationUrl: directUrl,
          careerPageUrl: config.careerPageUrl,
          postedDate,
          jobType: this.detectJobType(posting.title),
          workplaceType: this.detectWorkplaceType(location, posting.title),
          department,
          source: 'greenhouse',
        });
      }
      
    } catch (error: any) {
      console.error(`❌ ${config.name} (Greenhouse): ${error.message}`);
    }
    
    return jobs;
  }

  // ─── SmartRecruiters Adapter ─────────────────────────────────
  
  private static async scrapeSmartRecruiters(config: CompanyCareerConfig): Promise<DirectScrapedJob[]> {
    const jobs: DirectScrapedJob[] = [];
    
    if (!config.slug) {
      console.error(`❌ ${config.name}: Missing SmartRecruiters slug`);
      return jobs;
    }
    
    try {
      // SmartRecruiters API paginates with limit/offset
      let offset = 0;
      const limit = 100; // API max per request
      
      while (jobs.length < config.maxJobs) {
        const url = `https://api.smartrecruiters.com/v1/companies/${config.slug}/postings?limit=${limit}&offset=${offset}`;
        
        const response = await axios.get(url, {
          timeout: DIRECT_SCRAPER_CONFIG.requestTimeoutMs,
          headers: { 'Accept': 'application/json' },
          validateStatus: (s) => s === 200,
        });
        
        const postings = response.data?.content || [];
        if (postings.length === 0) break;
        
        for (const posting of postings) {
          if (jobs.length >= config.maxJobs) break;
          
          const jobId = posting.id || '';
          if (!jobId) continue;
          
          const location = [
            posting.location?.city,
            posting.location?.region,
            posting.location?.country,
          ].filter(Boolean).join(', ') || 'Remote';
          
          const directUrl = `https://jobs.smartrecruiters.com/${config.slug}/${jobId}`;
          
          // Clean description
          const description = (posting.jobAd?.sections?.jobDescription?.text || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 3000) || `${posting.name} at ${config.name}`;
          
          let postedDate: Date | undefined;
          if (posting.releasedDate) {
            postedDate = new Date(posting.releasedDate);
          }
          
          jobs.push({
            externalJobId: `direct_${config.slug.toLowerCase()}_sr_${jobId}`,
            companyJobId: posting.refNumber || jobId,
            title: (posting.name || '').substring(0, 200),
            company: config.name,
            location,
            description,
            applicationUrl: directUrl,
            careerPageUrl: config.careerPageUrl,
            postedDate,
            jobType: this.detectJobType(posting.name, posting.typeOfEmployment?.label),
            workplaceType: this.detectWorkplaceType(location, posting.name),
            department: posting.department?.label || undefined,
            source: 'smartrecruiters',
          });
        }
        
        offset += limit;
        if (postings.length < limit) break; // No more pages
        
        await this.delay(DIRECT_SCRAPER_CONFIG.requestDelayMs);
      }
      
    } catch (error: any) {
      console.error(`❌ ${config.name} (SmartRecruiters): ${error.message}`);
    }
    
    return jobs;
  }

  // ─── Amazon.jobs Adapter ─────────────────────────────────────
  
  private static async scrapeAmazon(config: CompanyCareerConfig): Promise<DirectScrapedJob[]> {
    const jobs: DirectScrapedJob[] = [];
    
    const searchTerms = ['software engineer', 'data scientist', 'product manager', 'cloud engineer'];
    const seenIds = new Set<string>();
    
    for (const term of searchTerms) {
      if (jobs.length >= config.maxJobs) break;
      
      try {
        const url = `https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(term)}&result_limit=25&sort=recent`;
        
        const response = await axios.get(url, {
          timeout: DIRECT_SCRAPER_CONFIG.requestTimeoutMs,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0' },
          validateStatus: (s) => s === 200,
        });
        
        const postings = response.data?.jobs || [];
        
        for (const posting of postings) {
          if (jobs.length >= config.maxJobs) break;
          
          const jobId = (posting.id_icims || posting.id || '').toString();
          if (!jobId || seenIds.has(jobId)) continue;
          seenIds.add(jobId);
          
          const directUrl = `https://www.amazon.jobs${posting.job_path || `/en/jobs/${jobId}`}`;
          const location = [posting.city, posting.state, posting.country_code].filter(Boolean).join(', ');
          
          let postedDate: Date | undefined;
          if (posting.posted_date) {
            const parsed = new Date(posting.posted_date);
            if (!isNaN(parsed.getTime())) postedDate = parsed;
          }
          
          jobs.push({
            externalJobId: `direct_amazon_${jobId}`,
            companyJobId: jobId,
            title: (posting.title || '').substring(0, 200),
            company: 'Amazon',
            location,
            description: (posting.description || posting.basic_qualifications || `${posting.title} at Amazon`).substring(0, 3000),
            applicationUrl: directUrl,
            careerPageUrl: config.careerPageUrl,
            postedDate,
            jobType: this.detectJobType(posting.title, posting.job_category),
            workplaceType: this.detectWorkplaceType(location, posting.title),
            department: posting.job_category || undefined,
            source: 'amazon',
          });
        }
        
        await this.delay(DIRECT_SCRAPER_CONFIG.requestDelayMs);
        
      } catch (error: any) {
        console.warn(`⚠️ Amazon.jobs search="${term}": ${error.message}`);
      }
    }
    
    return jobs;
  }

  // ─── Lever Adapter ───────────────────────────────────────────
  
  private static async scrapeLever(config: CompanyCareerConfig): Promise<DirectScrapedJob[]> {
    const jobs: DirectScrapedJob[] = [];
    
    if (!config.slug) {
      console.error(`❌ ${config.name}: Missing Lever slug`);
      return jobs;
    }
    
    try {
      const url = `https://api.lever.co/v0/postings/${config.slug}?limit=${config.maxJobs}&mode=json`;
      
      const response = await axios.get(url, {
        timeout: DIRECT_SCRAPER_CONFIG.requestTimeoutMs,
        validateStatus: (s) => s === 200,
      });
      
      if (!Array.isArray(response.data)) return jobs;
      
      for (const posting of response.data.slice(0, config.maxJobs)) {
        const jobId = posting.id || '';
        if (!jobId) continue;
        
        const location = posting.categories?.location || 'Remote';
        const directUrl = posting.hostedUrl || posting.applyUrl || 
          `https://jobs.lever.co/${config.slug}/${jobId}`;
        
        const description = (posting.descriptionPlain || posting.description || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 3000);
        
        let postedDate: Date | undefined;
        if (posting.createdAt) {
          postedDate = new Date(posting.createdAt);
        }
        
        jobs.push({
          externalJobId: `direct_${config.slug}_lever_${jobId}`,
          companyJobId: jobId,
          title: (posting.text || '').substring(0, 200),
          company: config.name,
          location,
          description: description || `${posting.text} at ${config.name}`,
          applicationUrl: directUrl,
          careerPageUrl: config.careerPageUrl,
          postedDate,
          jobType: this.detectJobType(posting.text, posting.categories?.commitment),
          workplaceType: this.detectWorkplaceType(location, posting.text),
          department: posting.categories?.department || posting.categories?.team || undefined,
          source: 'lever',
        });
      }
      
    } catch (error: any) {
      console.error(`❌ ${config.name} (Lever): ${error.message}`);
    }
    
    return jobs;
  }

  // ─── Netflix Adapter ───────────────────────────────────────────
  
  private static async scrapeNetflix(config: CompanyCareerConfig): Promise<DirectScrapedJob[]> {
    const jobs: DirectScrapedJob[] = [];
    const searchTerms = ['software engineer', 'data scientist', 'product manager', 'machine learning'];
    const seenIds = new Set<string>();
    
    for (const term of searchTerms) {
      if (jobs.length >= config.maxJobs) break;
      
      try {
        const url = `https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&start=0&num=25&query=${encodeURIComponent(term)}`;
        const response = await axios.get(url, {
          timeout: DIRECT_SCRAPER_CONFIG.requestTimeoutMs,
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/121.0' },
          validateStatus: (s) => s === 200,
        });
        
        const positions = response.data?.positions || [];
        for (const p of positions) {
          if (jobs.length >= config.maxJobs) break;
          const jobId = (p.id || '').toString();
          if (!jobId || seenIds.has(jobId)) continue;
          seenIds.add(jobId);
          
          const location = p.location || 'Remote';
          const directUrl = config.jobUrlTemplate.replace('{jobId}', jobId);
          
          jobs.push({
            externalJobId: `direct_netflix_${jobId}`,
            companyJobId: jobId,
            title: (p.name || p.title || '').substring(0, 200),
            company: 'Netflix',
            location,
            description: (p.description || `${p.name} at Netflix`).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000),
            applicationUrl: directUrl,
            careerPageUrl: config.careerPageUrl,
            postedDate: p.t_create ? new Date(p.t_create) : undefined,
            jobType: this.detectJobType(p.name),
            workplaceType: this.detectWorkplaceType(location, p.name),
            department: p.department || undefined,
            source: 'netflix',
          });
        }
        
        await this.delay(DIRECT_SCRAPER_CONFIG.requestDelayMs);
      } catch (error: any) {
        console.warn(`⚠️ Netflix search="${term}": ${error.message}`);
      }
    }
    
    return jobs;
  }

  // ─── Ashby Adapter ───────────────────────────────────────────
  
  private static async scrapeAshby(config: CompanyCareerConfig): Promise<DirectScrapedJob[]> {
    const jobs: DirectScrapedJob[] = [];
    
    if (!config.slug) {
      console.error(`❌ ${config.name}: Missing Ashby slug`);
      return jobs;
    }
    
    try {
      const query = `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
        jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
          jobPostings { id title locationName teamName employmentType descriptionPlain }
        }
      }`;
      
      const response = await axios.post('https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams', {
        operationName: 'ApiJobBoardWithTeams',
        variables: { organizationHostedJobsPageName: config.slug },
        query,
      }, {
        timeout: DIRECT_SCRAPER_CONFIG.requestTimeoutMs,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: (s) => s === 200,
      });
      
      const postings = response.data?.data?.jobBoard?.jobPostings || [];
      
      for (const p of postings.slice(0, config.maxJobs)) {
        const jobId = p.id || '';
        if (!jobId) continue;
        
        const directUrl = config.jobUrlTemplate.replace('{jobId}', jobId);
        const location = p.locationName || 'Remote';
        
        jobs.push({
          externalJobId: `direct_${config.slug}_ashby_${jobId}`,
          companyJobId: jobId,
          title: (p.title || '').substring(0, 200),
          company: config.name,
          location,
          description: (p.descriptionPlain || `${p.title} at ${config.name}`).substring(0, 3000),
          applicationUrl: directUrl,
          careerPageUrl: config.careerPageUrl,
          jobType: this.detectJobType(p.title, p.employmentType),
          workplaceType: this.detectWorkplaceType(location, p.title),
          department: p.teamName || undefined,
          source: 'ashby',
        });
      }
      
    } catch (error: any) {
      console.error(`❌ ${config.name} (Ashby): ${error.message}`);
    }
    
    return jobs;
  }

  // ─── Adapter Router ──────────────────────────────────────────
  
  private static async scrapeCompany(config: CompanyCareerConfig): Promise<DirectScrapedJob[]> {
    switch (config.ats) {
      case 'workday':         return this.scrapeWorkday(config);
      case 'greenhouse':      return this.scrapeGreenhouse(config);
      case 'smartrecruiters':  return this.scrapeSmartRecruiters(config);
      case 'amazon':          return this.scrapeAmazon(config);
      case 'lever':           return this.scrapeLever(config);
      case 'netflix':         return this.scrapeNetflix(config);
      case 'ashby':           return this.scrapeAshby(config);
      default:
        console.error(`❌ Unknown ATS platform: ${config.ats}`);
        return [];
    }
  }

  // ─── Database Integration ────────────────────────────────────
  
  private static async insertJob(job: DirectScrapedJob): Promise<void> {
    // Find or create organization
    const orgQuery = `
      SELECT TOP 1 OrganizationID FROM Organizations 
      WHERE Name = @param0 AND IsActive = 1
    `;
    const orgResult = await dbService.executeQuery(orgQuery, [job.company]);
    
    let organizationId: number;
    if (orgResult.recordset.length > 0) {
      organizationId = orgResult.recordset[0].OrganizationID;
    } else {
      // Create organization
      const fortune500Match = findFortune500Match(job.company);
      const insertOrgQuery = `
        INSERT INTO Organizations (Name, Type, Industry, CreatedAt, UpdatedAt, IsActive, IsFortune500)
        OUTPUT INSERTED.OrganizationID
        VALUES (@param0, 'Company', @param1, @param2, @param3, 1, @param4)
      `;
      const now = new Date().toISOString();
      const result = await dbService.executeQuery(insertOrgQuery, [
        job.company,
        fortune500Match?.industry || 'Technology',
        now, now,
        fortune500Match ? 1 : 0,
      ]);
      organizationId = result.recordset[0].OrganizationID;
    }
    
    const jobId = AuthService.generateUniqueId();
    const now = new Date().toISOString();
    const postedAt = job.postedDate?.toISOString() || now;
    const expiresAt = new Date(Date.now() + 45 * 86400000).toISOString(); // 45 days (longer than Adzuna since URLs are reliable)
    
    const jobTypeId = this.getJobTypeId(job.jobType);
    const workplaceTypeId = this.getWorkplaceTypeId(job.workplaceType);
    const currencyId = this.detectCurrencyFromLocation(job.location);
    const country = this.extractCountry(job.location);
    
    // Parse experience from title/description (same logic as Adzuna scraper)
    let experienceMin = this.extractMinExperience(job.title, job.description);
    let experienceMax = this.extractMaxExperience(job.title, job.description);
    experienceMin = Math.max(0, experienceMin);
    experienceMax = Math.max(experienceMin, experienceMax);
    
    // Dynamic priority based on job age
    const jobAge = job.postedDate ? Math.floor((Date.now() - job.postedDate.getTime()) / 86400000) : 0;
    const priority = jobAge <= 3 ? 'High' : jobAge <= 7 ? 'Medium' : jobAge <= 30 ? 'Normal' : 'Low';
    
    const insertQuery = `
      INSERT INTO Jobs (
        JobID, OrganizationID, PostedByType, Title, JobTypeID, WorkplaceTypeID,
        Department, Description, Location, Country, IsRemote,
        CurrencyID, SalaryPeriod, CompensationType,
        ExperienceMin, ExperienceMax, Status, Priority, Visibility,
        PublishedAt, ExpiresAt, CreatedAt, UpdatedAt, ExternalJobID,
        Tags, CurrentApplications, ApplicationURL
      )
      VALUES (
        @param0, @param1, 0, @param2, @param3, @param4,
        @param5, @param6, @param7, @param8, @param9,
        @param10, 'Annual', 'Salary',
        @param11, @param12, 'Published', @param13, 'Public',
        @param14, @param15, @param16, @param17, @param18,
        @param19, 0, @param20
      )
    `;
    
    await dbService.executeQuery(insertQuery, [
      jobId, organizationId, job.title, jobTypeId, workplaceTypeId,
      job.department || this.extractDepartment(job.title),
      job.description, job.location, country,
      job.workplaceType === 'Remote' ? 1 : 0,
      currencyId,
      experienceMin, experienceMax, priority,
      postedAt, expiresAt, now, now, job.externalJobId,
      `Direct, ${job.source}, ${job.company}, ${job.jobType}`,
      job.applicationUrl,
    ]);
  }

  // ─── Main Orchestrator ───────────────────────────────────────
  
  static async scrapeDirectJobs(): Promise<DirectScrapingResult> {
    const startTime = Date.now();
    
    const result: DirectScrapingResult = {
      success: true,
      jobsAdded: 0,
      errors: [],
      summary: {
        totalJobsScraped: 0,
        companiesScraped: 0,
        companyBreakdown: {},
        executionTime: 0,
      },
    };
    
    if (!DIRECT_SCRAPER_CONFIG.enabled) {
      result.errors.push('Direct career scraper is disabled');
      return result;
    }
    
    console.log('🎯 Direct Career Site Scraper Started');
    console.log(`📋 ${CAREER_SITE_CONFIGS.filter(c => c.enabled).length} companies configured`);
    
    // Load existing job IDs for dedup
    const existingIds = await this.getExistingDirectJobIds();
    console.log(`📊 ${existingIds.size} existing direct jobs in database`);
    
    const enabledConfigs = CAREER_SITE_CONFIGS.filter(c => c.enabled);
    let totalAdded = 0;
    
    for (const config of enabledConfigs) {
      if (totalAdded >= DIRECT_SCRAPER_CONFIG.maxJobsPerRun) {
        console.log(`🏁 Reached max jobs per run: ${DIRECT_SCRAPER_CONFIG.maxJobsPerRun}`);
        break;
      }
      
      try {
        console.log(`\n🔍 Scraping ${config.name} (${config.ats})...`);
        const jobs = await this.scrapeCompany(config);
        
        // Filter duplicates
        const newJobs = jobs.filter(j => !existingIds.has(j.externalJobId));
        
        console.log(`📈 ${config.name}: ${jobs.length} scraped, ${newJobs.length} new`);
        result.summary.companyBreakdown[config.name] = newJobs.length;
        result.summary.totalJobsScraped += jobs.length;
        result.summary.companiesScraped++;
        
        // Insert new jobs
        let inserted = 0;
        for (const job of newJobs) {
          if (totalAdded >= DIRECT_SCRAPER_CONFIG.maxJobsPerRun) break;
          
          try {
            await this.insertJob(job);
            existingIds.add(job.externalJobId);
            inserted++;
            totalAdded++;
          } catch (error: any) {
            // Skip duplicates silently (unique constraint)
            if (!error.message?.includes('UNIQUE') && !error.message?.includes('duplicate')) {
              console.warn(`⚠️ Insert failed: ${job.title} — ${error.message}`);
              result.errors.push(`${config.name}: ${error.message}`);
            }
          }
        }
        
        console.log(`✅ ${config.name}: ${inserted} jobs added to database`);
        
      } catch (error: any) {
        console.error(`❌ ${config.name}: ${error.message}`);
        result.errors.push(`${config.name}: ${error.message}`);
      }
    }
    
    result.jobsAdded = totalAdded;
    result.summary.executionTime = Date.now() - startTime;
    
    console.log(`\n🎊 Direct scraping completed!`);
    console.log(`📊 ${totalAdded} jobs added from ${result.summary.companiesScraped} companies`);
    console.log(`⏱️ ${Math.round(result.summary.executionTime / 1000)}s`);
    
    return result;
  }

  // ─── Dedup Helper ────────────────────────────────────────────
  
  private static async getExistingDirectJobIds(): Promise<Set<string>> {
    const query = `
      SELECT ExternalJobID FROM Jobs 
      WHERE ExternalJobID LIKE 'direct_%'
        AND CreatedAt >= DATEADD(day, -60, GETUTCDATE())
    `;
    const result = await dbService.executeQuery(query);
    return new Set(result.recordset.map((r: any) => r.ExternalJobID));
  }

  // ─── Stats ───────────────────────────────────────────────────
  
  static async getStats(): Promise<any> {
    const query = `
      SELECT 
        SUBSTRING(ExternalJobID, 8, CHARINDEX('_', ExternalJobID + '_', 8) - 8) as Company,
        COUNT(*) as JobCount,
        MAX(CreatedAt) as LastAdded
      FROM Jobs 
      WHERE ExternalJobID LIKE 'direct_%'
        AND Status = 'Published'
      GROUP BY SUBSTRING(ExternalJobID, 8, CHARINDEX('_', ExternalJobID + '_', 8) - 8)
      ORDER BY JobCount DESC
    `;
    const result = await dbService.executeQuery(query);
    
    const totalQuery = `
      SELECT COUNT(*) as Total, 
             COUNT(CASE WHEN CreatedAt >= DATEADD(day, -1, GETUTCDATE()) THEN 1 END) as Last24h
      FROM Jobs WHERE ExternalJobID LIKE 'direct_%' AND Status = 'Published'
    `;
    const totalResult = await dbService.executeQuery(totalQuery);
    
    return {
      companies: result.recordset,
      summary: totalResult.recordset[0],
      configuredCompanies: CAREER_SITE_CONFIGS.filter(c => c.enabled).length,
    };
  }

  static getConfig() {
    return {
      ...DIRECT_SCRAPER_CONFIG,
      companies: CAREER_SITE_CONFIGS.map(c => ({
        name: c.name,
        ats: c.ats,
        enabled: c.enabled,
        maxJobs: c.maxJobs,
        careerPageUrl: c.careerPageUrl,
      })),
    };
  }

  // ─── Utility Methods ─────────────────────────────────────────
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static detectJobType(title: string = '', typeHint?: string): string {
    if (typeHint) {
      const h = typeHint.toLowerCase();
      if (h.includes('part')) return 'Part-time';
      if (h.includes('contract') || h.includes('temp')) return 'Contract';
      if (h.includes('intern')) return 'Internship';
    }
    const t = title.toLowerCase();
    if (t.includes('intern') || t.includes('internship')) return 'Internship';
    if (t.includes('contract') || t.includes('contractor')) return 'Contract';
    return 'Full-time';
  }

  private static detectWorkplaceType(location: string = '', title: string = ''): string {
    const content = `${location} ${title}`.toLowerCase();
    if (content.includes('remote')) return 'Remote';
    if (content.includes('hybrid')) return 'Hybrid';
    return 'Onsite';
  }

  private static getJobTypeId(jobType: string): number {
    const map: Record<string, number> = { 'Full-time': 438, 'Part-time': 440, 'Contract': 436, 'Internship': 439, 'Freelance': 437 };
    return map[jobType] || 438;
  }

  private static getWorkplaceTypeId(type: string): number {
    const map: Record<string, number> = { 'Onsite': 443, 'Remote': 444, 'Hybrid': 442 };
    return map[type] || 443;
  }

  private static detectCurrencyFromLocation(location: string): number {
    const l = location.toLowerCase();
    if (l.includes('india') || l.includes('bangalore') || l.includes('mumbai') || l.includes('delhi') || l.includes('hyderabad')) return 2;
    if (l.includes('canada') || l.includes('toronto') || l.includes('vancouver')) return 3;
    if (l.includes('uk') || l.includes('london') || l.includes('england')) return 4;
    if (l.includes('australia') || l.includes('sydney')) return 5;
    if (l.includes('germany') || l.includes('france') || l.includes('netherlands')) return 6;
    return 1; // USD
  }

  private static extractCountry(location: string): string {
    const l = location.toLowerCase();
    if (l.includes('india') || l.includes('bangalore') || l.includes('mumbai') || l.includes('delhi') || l.includes('hyderabad') || l.includes('pune')) return 'India';
    if (l.includes('canada') || l.includes('toronto')) return 'Canada';
    if (l.includes('uk') || l.includes('london') || l.includes('england')) return 'United Kingdom';
    if (l.includes('australia') || l.includes('sydney')) return 'Australia';
    if (l.includes('germany') || l.includes('berlin') || l.includes('munich')) return 'Germany';
    if (l.includes('singapore')) return 'Singapore';
    return 'United States';
  }

  private static extractDepartment(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('engineer') || t.includes('developer') || t.includes('architect')) return 'Engineering';
    if (t.includes('data') || t.includes('analyst') || t.includes('scientist')) return 'Data Science';
    if (t.includes('product manager') || t.includes('product owner')) return 'Product';
    if (t.includes('designer') || t.includes('ux') || t.includes('ui')) return 'Design';
    if (t.includes('marketing')) return 'Marketing';
    if (t.includes('sales') || t.includes('account')) return 'Sales';
    if (t.includes('manager') || t.includes('director') || t.includes('vp')) return 'Management';
    if (t.includes('finance') || t.includes('accounting')) return 'Finance';
    if (t.includes('hr') || t.includes('recruit') || t.includes('people')) return 'Human Resources';
    return 'Technology';
  }

  private static extractMinExperience(title: string, description: string): number {
    const content = `${title} ${description}`.toLowerCase();
    const patterns = [/(\d+)\+?\s*years?\s+(?:of\s+)?experience/, /(\d+)-\d+\s*years/];
    for (const p of patterns) {
      const m = content.match(p);
      if (m) return Math.max(0, Math.min(parseInt(m[1]), 50));
    }
    if (content.includes('senior') || content.includes('lead')) return 5;
    if (content.includes('mid') || content.includes('intermediate')) return 3;
    if (content.includes('junior') || content.includes('entry')) return 0;
    return 0;
  }

  private static extractMaxExperience(title: string, description: string): number {
    const minExp = this.extractMinExperience(title, description);
    const content = `${title} ${description}`.toLowerCase();
    const rangeMatch = content.match(/(\d+)-(\d+)\s*years/);
    if (rangeMatch) return Math.max(minExp, Math.min(parseInt(rangeMatch[2]), 50));
    if (content.includes('senior') || content.includes('lead')) return Math.max(minExp + 5, 10);
    if (content.includes('mid')) return Math.max(minExp + 3, 7);
    return Math.max(minExp + 3, 5);
  }
}
