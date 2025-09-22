/**
 * Production-Ready Job Scraper Service for NexHire
 * Integrates with existing NexHire database and architecture
 * Features: Human-like scraping, API validation, India market focus
 */

import { dbService } from './database.service';
import { AuthService } from './auth.service';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// ?? FIXED: Remove all cheerio imports to prevent Azure runtime failure
// HTML parsing will be disabled but service will work
// let cheerio: any = null;
// try {
//   cheerio = require('cheerio');
//   console.log('? Cheerio loaded successfully');
// } catch (error) {
//   console.log('?? Cheerio not available in this environment, HTML parsing disabled');
// }

console.log('?? Cheerio disabled for Azure compatibility - API-only scraping mode');

interface ScrapedJob {
  externalJobId: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salaryMin?: number;
  salaryMax?: number;
  jobType: string;
  workplaceType: string;
  experienceLevel?: string;
  requirements?: string;
  applicationUrl?: string;
  source: string;
  postedDate?: Date;
}

interface ScrapingResult {
  success: boolean;
  jobsAdded: number;
  errors: string[];
  summary: {
    totalJobsScraped: number;
    sourceBreakdown: { [key: string]: number };
    indiaJobsAdded: number;
    executionTime: number;
  };
}

export class JobScraperService {
  private static config = {
    enabled: true,
    maxJobsPerRun: 150,
    sources: {
      remoteok: { enabled: true, rateLimit: 2000 },
      adzuna: { enabled: true, rateLimit: 3000 },
      naukri: { enabled: false }, // Disabled until selectors fixed
      weworkremotely: { enabled: false } // Disabled until parsing fixed
    },
    excludeKeywords: ['adult', 'gambling', 'crypto', 'mlm', 'scam']
  };

  // Human-like user agents to avoid blocking
  private static userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  ];

  private static getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  // Human-like delays between requests
  private static async humanDelay(minMs: number = 1500, maxMs: number = 4000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Load Adzuna API keys from environment variables (Production-ready)
  private static loadAdzunaApiKeys(): { appId: string; appKey: string } | null {
    try {
      // ?? PRODUCTION: Use environment variables only
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;
      
      if (appId && appKey) {
        console.log('? Loaded Adzuna API keys from environment variables');
        return { appId, appKey };
      }

      console.log('?? Adzuna API keys not found in environment variables - skipping Adzuna scraping');
      console.log('?? Ensure ADZUNA_APP_ID and ADZUNA_APP_KEY are set in Azure Function App settings');
      return null;
      
    } catch (error: any) {
      console.error('? Error loading Adzuna API keys:', error.message);
      return null;
    }
  }

  // Enhanced HTTP request with human-like behavior
  private static async makeHumanRequest(url: string, options: any = {}): Promise<any> {
    const headers = {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': options.json ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
      ...options.headers
    };

    // Random delay before request (human behavior simulation)
    await this.humanDelay(800, 2000);

    return axios({
      url,
      method: options.method || 'GET',
      headers,
      timeout: options.timeout || 30000,
      params: options.params,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      ...options
    });
  }

  // Scrape RemoteOK API (confirmed working) - ENHANCED POSTED DATE HANDLING
  private static async scrapeRemoteOK(): Promise<ScrapedJob[]> {
    const jobs: ScrapedJob[] = [];
    
    try {
      console.log('??? Scraping RemoteOK API...');
      const response = await this.makeHumanRequest('https://remoteok.io/api', { json: true });
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid API response format');
      }

      const jobsData = response.data.slice(1); // Skip metadata
      console.log(`?? RemoteOK: Found ${jobsData.length} jobs`);

      let processed = 0;
      for (const job of jobsData.slice(0, 50)) { // Limit to 50 jobs
        if (!job.id || !job.position || !job.company) continue;

        // ? ENHANCED POSTED DATE HANDLING
        let postedDate = new Date(); // Default to current time
        if (job.date) {
          if (typeof job.date === 'number') {
            // Unix timestamp (RemoteOK format)
            postedDate = new Date(job.date * 1000);
          } else if (typeof job.date === 'string') {
            // ISO string or other string format
            const parsedDate = new Date(job.date);
            if (!isNaN(parsedDate.getTime())) {
              postedDate = parsedDate;
            }
          }
        } else if (job.created) {
          // Check for 'created' field as fallback
          postedDate = new Date(job.created);
        } else if (job.published) {
          // Check for 'published' field as fallback
          postedDate = new Date(job.published);
        }

        // Validate posted date is reasonable (not in future, not too old)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        if (postedDate > now) {
          postedDate = now; // Cap at current time
        } else if (postedDate < thirtyDaysAgo) {
          console.log(`?? Old job detected: ${job.position} posted ${postedDate.toISOString()}`);
          // Still include but note it's old
        }

        jobs.push({
          externalJobId: `remoteok_${job.id}`,
          title: job.position.substring(0, 200),
          company: job.company.substring(0, 100),
          location: job.location || 'Remote',
          description: job.description ? job.description.substring(0, 2000) : `${job.position} at ${job.company}`,
          salaryMin: job.salary_min ? parseInt(job.salary_min.toString().replace(/[^\d]/g, '')) : undefined,
          salaryMax: job.salary_max ? parseInt(job.salary_max.toString().replace(/[^\d]/g, '')) : undefined,
          jobType: 'Full-time',
          workplaceType: 'Remote',
          requirements: Array.isArray(job.tags) ? job.tags.slice(0, 10).join(', ') : '',
          applicationUrl: job.url,
          source: 'RemoteOK',
          postedDate: postedDate // ? PROPERLY SET POSTED DATE
        });
        processed++;
      }

      console.log(`? RemoteOK: Successfully processed ${processed} jobs with posted dates`);
      
    } catch (error: any) {
      console.error(`? RemoteOK scraping failed: ${error.message}`);
      throw error;
    }

    return jobs;
  }

  // Scrape Adzuna API (confirmed working with your keys) - ENHANCED POSTED DATE HANDLING
  private static async scrapeAdzunaGlobal(): Promise<ScrapedJob[]> {
    const jobs: ScrapedJob[] = [];
    
    try {
      console.log('?? Scraping Adzuna API...');
      
      const apiKeys = this.loadAdzunaApiKeys();
      if (!apiKeys) {
        console.log('?? Skipping Adzuna: No API keys found');
        return jobs;
      }

      const { appId, appKey } = apiKeys;
      
      // Countries and cities (focus on India)
      const searchConfigs = [
        // India (priority market)
        { country: 'in', city: 'bangalore', searchTerms: ['software engineer', 'developer'] },
        { country: 'in', city: 'mumbai', searchTerms: ['software engineer'] },
        { country: 'in', city: 'delhi', searchTerms: ['developer'] },
        // Global markets
        { country: 'us', city: 'san francisco', searchTerms: ['software engineer'] },
        { country: 'ca', city: 'toronto', searchTerms: ['developer'] },
        { country: 'gb', city: 'london', searchTerms: ['software engineer'] }
      ];
      
      for (const config of searchConfigs) {
        for (const searchTerm of config.searchTerms) {
          try {
            const apiUrl = `https://api.adzuna.com/v1/api/jobs/${config.country}/search/1`;
            const params = {
              app_id: appId,
              app_key: appKey,
              what: searchTerm,
              where: config.city,
              results_per_page: 8,
              sort_by: 'date' // ? SORT BY DATE FOR FRESHEST JOBS
            };

            console.log(`?? Adzuna: ${config.country}/${config.city}/${searchTerm}`);
            
            const response = await this.makeHumanRequest(apiUrl, { 
              params,
              json: true,
              timeout: 20000
            });
            
            if (response.status !== 200) {
              console.log(`?? Adzuna ${config.country}: HTTP ${response.status}`);
              continue;
            }

            const data = response.data;
            if (!data.results || !Array.isArray(data.results)) {
              console.log(`?? Adzuna ${config.country}: Invalid response structure`);
              continue;
            }

            console.log(`?? Adzuna ${config.country}: ${data.results.length} jobs (${data.count || 0} total available)`);
            
            for (const job of data.results) {
              if (!job.id || !job.title || !job.company?.display_name) continue;

              // ? ENHANCED POSTED DATE HANDLING FOR ADZUNA
              let postedDate = new Date(); // Default to current time
              if (job.created) {
                const createdDate = new Date(job.created);
                if (!isNaN(createdDate.getTime())) {
                  postedDate = createdDate;
                }
              } else if (job.posted) {
                const jobPostedDate = new Date(job.posted);
                if (!isNaN(jobPostedDate.getTime())) {
                  postedDate = jobPostedDate;
                }
              } else if (job.published_at) {
                const publishedDate = new Date(job.published_at);
                if (!isNaN(publishedDate.getTime())) {
                  postedDate = publishedDate;
                }
              }

              // Validate posted date is reasonable
              const now = new Date();
              const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
              if (postedDate > now) {
                postedDate = now;
              } else if (postedDate < sixtyDaysAgo) {
                console.log(`?? Old Adzuna job: ${job.title} posted ${postedDate.toISOString()}`);
              }

              jobs.push({
                externalJobId: `adzuna_${config.country}_${job.id}`,
                title: job.title.substring(0, 200),
                company: job.company.display_name.substring(0, 100),
                location: job.location?.display_name || `${config.city}, ${this.getCountryName(config.country)}`,
                description: job.description ? job.description.substring(0, 2000) : `${job.title} position`,
                salaryMin: job.salary_min ? Math.round(job.salary_min) : undefined,
                salaryMax: job.salary_max ? Math.round(job.salary_max) : undefined,
                jobType: this.mapJobType(job.contract_type),
                workplaceType: this.detectWorkplaceType(job.location?.display_name, job.title, job.description),
                applicationUrl: job.redirect_url,
                postedDate: postedDate, // ? PROPERLY SET POSTED DATE
                source: `Adzuna_${config.country.toUpperCase()}`
              });
            }
            
            // Human-like delay between API calls
            await this.humanDelay(3000, 6000);
            
          } catch (error: any) {
            console.log(`? Adzuna ${config.country}/${config.city}: ${error.message}`);
            
            // Handle rate limiting
            if (error.response?.status === 429) {
              console.log('? Rate limited, waiting 15 seconds...');
              await new Promise(resolve => setTimeout(resolve, 15000));
            }
          }
        }
      }
      
      console.log(`? Adzuna: Collected ${jobs.length} jobs globally with accurate posted dates`);
      
    } catch (error: any) {
      console.error(`? Adzuna scraping failed: ${error.message}`);
      throw error;
    }

    return jobs;
  }

  // Main scraping orchestrator
  static async scrapeAndPopulateJobs(): Promise<ScrapingResult> {
    const startTime = Date.now();
    const result: ScrapingResult = {
      success: true,
      jobsAdded: 0,
      errors: [],
      summary: {
        totalJobsScraped: 0,
        sourceBreakdown: { },
        indiaJobsAdded: 0,
        executionTime: 0
      }
    };
    
    if (!this.config.enabled) {
      result.errors.push('Job scraping is disabled');
      return result;
    }

    console.log('?? NexHire Job Scraping Started...');

    try {
      // Get existing external job IDs to prevent duplicates
      const existingJobs = await this.getExistingExternalJobIds();
      console.log(`?? Found ${existingJobs.size} existing external jobs in database`);

      const allScrapedJobs: ScrapedJob[] = [];

      // Scrape RemoteOK (confirmed working - 245 jobs/day potential)
      if (this.config.sources.remoteok.enabled) {
        try {
          const remoteOkJobs = await this.scrapeRemoteOK();
          allScrapedJobs.push(...remoteOkJobs);
          result.summary.sourceBreakdown['RemoteOK'] = remoteOkJobs.length;
          console.log(`? RemoteOK: ${remoteOkJobs.length} jobs scraped`);
        } catch (error: any) {
          console.error('? RemoteOK failed:', error.message);
          result.errors.push(`RemoteOK: ${error.message}`);
          result.summary.sourceBreakdown['RemoteOK'] = 0;
        }
        
        await this.humanDelay(2000, 4000);
      }

      // Scrape Adzuna (confirmed working - 60 jobs/day + India coverage)
      if (this.config.sources.adzuna.enabled) {
        try {
          const adzunaJobs = await this.scrapeAdzunaGlobal();
          allScrapedJobs.push(...adzunaJobs);
          
          // Count India jobs
          const indiaJobs = adzunaJobs.filter(job => 
            job.source.includes('IN') || 
            job.location.toLowerCase().includes('bangalore') ||
            job.location.toLowerCase().includes('mumbai') ||
            job.location.toLowerCase().includes('delhi')
          );
          
          result.summary.sourceBreakdown['Adzuna'] = adzunaJobs.length;
          result.summary.sourceBreakdown['Adzuna_India'] = indiaJobs.length;
          console.log(`? Adzuna: ${adzunaJobs.length} jobs scraped (${indiaJobs.length} from India)`);
        } catch (error: any) {
          console.error('? Adzuna failed:', error.message);
          result.errors.push(`Adzuna: ${error.message}`);
          result.summary.sourceBreakdown['Adzuna'] = 0;
        }
      }

      result.summary.totalJobsScraped = allScrapedJobs.length;
      console.log(`?? Total jobs scraped: ${allScrapedJobs.length}`);

      // Filter out duplicates and unwanted jobs
      const filteredJobs = this.filterJobs(allScrapedJobs, existingJobs);
      console.log(`? Jobs after filtering: ${filteredJobs.length}`);

      // Limit to max jobs per run
      const jobsToInsert = filteredJobs.slice(0, this.config.maxJobsPerRun);
      console.log(`?? Jobs to insert: ${jobsToInsert.length}`);

      // Insert jobs into NexHire database
      let insertedCount = 0;
      let indiaJobsCount = 0;
      
      for (const [index, job] of jobsToInsert.entries()) {
        try {
          await this.insertJobIntoNexHireDB(job);
          insertedCount++;
          
          // Count India jobs
          if (job.location.toLowerCase().includes('india') || 
              job.location.toLowerCase().includes('bangalore') ||
              job.location.toLowerCase().includes('mumbai') ||
              job.location.toLowerCase().includes('delhi')) {
            indiaJobsCount++;
          }
          
          if ((index + 1) % 25 === 0) {
            console.log(`?? Progress: ${index + 1}/${jobsToInsert.length} jobs inserted`);
          }
        } catch (error: any) {
          console.error(`? Failed to insert "${job.title}": ${error.message}`);
          result.errors.push(`Insert failed: ${job.title} - ${error.message}`);
        }
      }

      result.jobsAdded = insertedCount;
      result.summary.indiaJobsAdded = indiaJobsCount;
      result.summary.executionTime = Date.now() - startTime;

      console.log(`?? Job scraping completed successfully!`);
      console.log(`?? Results: ${insertedCount} jobs added (${indiaJobsCount} from India)`);
      console.log(`?? Execution time: ${Math.round(result.summary.executionTime / 1000)}s`);

    } catch (error: any) {
      console.error('?? Job scraping process failed:', error);
      result.success = false;
      result.errors.push(`Process failed: ${error.message}`);
      result.summary.executionTime = Date.now() - startTime;
    }

    return result;
  }

  // Insert job into NexHire database with proper organization handling and POSTED DATE PRIORITY
  private static async insertJobIntoNexHireDB(job: ScrapedJob): Promise<void> {
    try {
      // Get or create organization
      const organizationId = await this.getOrCreateOrganization(job.company);
      
      // Map job attributes to NexHire schema
      const jobTypeId = this.getJobTypeId(job.jobType);
      const workplaceTypeId = this.getWorkplaceTypeId(job.workplaceType);
      const currencyId = this.detectCurrencyFromLocation(job.location);
      
      const jobId = AuthService.generateUniqueId();
      const now = new Date().toISOString();
      
      // ? PRIORITIZE ACTUAL POSTED DATE FROM API
      const actualPostedDate = job.postedDate ? job.postedDate.toISOString() : now;
      const jobAge = job.postedDate ? Math.floor((Date.now() - job.postedDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      console.log(`?? Inserting job: "${job.title}" posted ${jobAge} days ago (${actualPostedDate})`);
      
      const insertQuery = `
        INSERT INTO Jobs (
          JobID, OrganizationID, PostedByType, Title, JobTypeID, WorkplaceTypeID,
          Department, Description, Location, Country, IsRemote,
          SalaryRangeMin, SalaryRangeMax, CurrencyID, SalaryPeriod, CompensationType,
          ExperienceMin, ExperienceMax, Status, Priority, Visibility,
          PublishedAt, ExpiresAt, CreatedAt, UpdatedAt, ExternalJobID,
          Tags, CurrentApplications
        )
        VALUES (
          @param0, @param1, 0, @param2, @param3, @param4,
          @param5, @param6, @param7, @param8, @param9,
          @param10, @param11, @param12, @param13, @param14,
          @param15, @param16, @param17, @param18, @param19,
          @param20, @param21, @param22, @param23, @param24,
          @param25, @param26
        )
      `;
      
      const values = [
        jobId, // @param0 - JobID
        organizationId, // @param1 - OrganizationID  
        job.title, // @param2 - Title
        jobTypeId, // @param3 - JobTypeID
        workplaceTypeId, // @param4 - WorkplaceTypeID
        this.extractDepartment(job.title), // @param5 - Department
        job.description, // @param6 - Description
        job.location, // @param7 - Location
        this.extractCountry(job.location), // @param8 - Country
        job.workplaceType === 'Remote' ? 1 : 0, // @param9 - IsRemote
        job.salaryMin, // @param10 - SalaryRangeMin
        job.salaryMax, // @param11 - SalaryRangeMax
        currencyId, // @param12 - CurrencyID (enhanced)
        'Annual', // @param13 - SalaryPeriod
        'Salary', // @param14 - CompensationType
        this.extractMinExperience(job.title, job.description), // @param15 - ExperienceMin
        this.extractMaxExperience(job.title, job.description), // @param16 - ExperienceMax
        'Published', // @param17 - Status
        this.calculateJobPriority(job, jobAge), // @param18 - Priority (enhanced)
        'Public', // @param19 - Visibility
        actualPostedDate, // @param20 - PublishedAt (? ACTUAL API POSTED DATE)
        this.calculateExpiryDate(actualPostedDate, jobAge), // @param21 - ExpiresAt (enhanced)
        actualPostedDate, // @param22 - CreatedAt (? ACTUAL API POSTED DATE) 
        now, // @param23 - UpdatedAt (scraping timestamp)
        job.externalJobId, // @param24 - ExternalJobID
        `${job.source}, ${job.jobType}, ${job.workplaceType}${job.requirements ? ', ' + job.requirements.substring(0, 100) : ''}`, // @param25 - Tags
        0 // @param26 - CurrentApplications
      ];
      
      await dbService.executeQuery(insertQuery, values);
      
    } catch (error: any) {
      throw new Error(`Database insertion failed: ${error.message}`);
    }
  }

  // ? NEW: Enhanced currency detection based on location
  private static detectCurrencyFromLocation(location: string): number {
    if (!location) return 1; // Default USD
    
    const locationLower = location.toLowerCase();
    
    // Currency mapping based on location
    if (locationLower.includes('india') || locationLower.includes('bangalore') || 
        locationLower.includes('mumbai') || locationLower.includes('delhi')) {
      return 2; // INR (assuming currency ID 2 for Indian Rupee)
    }
    if (locationLower.includes('canada') || locationLower.includes('toronto') || 
        locationLower.includes('vancouver')) {
      return 3; // CAD (assuming currency ID 3 for Canadian Dollar)
    }
    if (locationLower.includes('uk') || locationLower.includes('london') || 
        locationLower.includes('manchester')) {
      return 4; // GBP (assuming currency ID 4 for British Pound)
    }
    if (locationLower.includes('eur') || locationLower.includes('berlin') || 
        locationLower.includes('paris')) {
      return 5; // EUR (assuming currency ID 5 for Euro)
    }
    
    return 1; // Default USD
  }

  // ? NEW: Calculate job priority based on freshness and other factors
  private static calculateJobPriority(job: ScrapedJob, jobAge: number): string {
    // Fresh jobs (posted within 3 days) get higher priority
    if (jobAge <= 3) return 'High';
    
    // Recent jobs (posted within 7 days) get normal priority
    if (jobAge <= 7) return 'Normal';
    
    // Older jobs get low priority but are still included
    return 'Low';
  }

  // ? NEW: Calculate expiry date based on posted date and age
  private static calculateExpiryDate(postedDate: string, jobAge: number): string {
    const posted = new Date(postedDate);
    
    // Fresh jobs get longer expiry (60 days from posted date)
    if (jobAge <= 7) {
      return new Date(posted.getTime() + (60 * 24 * 60 * 60 * 1000)).toISOString();
    }
    
    // Older jobs get shorter expiry (30 days from now)
    return new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString();
  }

  // Helper methods
  private static async getExistingExternalJobIds(): Promise<Set<string>> {
    const query = `
      SELECT ExternalJobID 
      FROM Jobs 
      WHERE ExternalJobID IS NOT NULL 
        AND CreatedAt >= DATEADD(day, -45, GETUTCDATE())
        AND PostedByType = 0
    `;
    
    const result = await dbService.executeQuery(query);
    return new Set(result.recordset.map((row: any) => row.ExternalJobID));
  }

  private static filterJobs(jobs: ScrapedJob[], existingIds: Set<string>): ScrapedJob[] {
    return jobs.filter(job => {
      // Skip duplicates
      if (existingIds.has(job.externalJobId)) return false;

      // Skip jobs with excluded keywords
      const content = `${job.title} ${job.description} ${job.company}`.toLowerCase();
      if (this.config.excludeKeywords.some(keyword => content.includes(keyword))) {
        return false;
      }

      // Must have required fields and reasonable content
      return job.title && 
             job.company && 
             job.externalJobId && 
             job.title.length >= 3 && 
             job.company.length >= 2 &&
             job.title.length <= 200 &&
             job.company.length <= 100;
    });
  }

  private static async getOrCreateOrganization(companyName: string): Promise<number> {
    // Clean company name
    const cleanName = companyName.trim().substring(0, 100);
    
    // Check if organization exists
    const checkQuery = 'SELECT OrganizationID FROM Organizations WHERE Name = @param0 AND IsActive = 1';
    const checkResult = await dbService.executeQuery(checkQuery, [cleanName]);
    
    if (checkResult.recordset.length > 0) {
      return checkResult.recordset[0].OrganizationID;
    }

    // Create new organization
    const insertQuery = `
      INSERT INTO Organizations (Name, Type, Industry, Size, Description, CreatedAt, UpdatedAt, IsActive)
      OUTPUT INSERTED.OrganizationID
      VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6, 1)
    `;
    
    const now = new Date().toISOString();
    const result = await dbService.executeQuery(insertQuery, [
      cleanName,
      'Company',
      'Technology',
      'Unknown',
      `Organization created by job scraper for ${cleanName}`,
      now,
      now
    ]);

    return result.recordset[0].OrganizationID;
  }

  private static getJobTypeId(jobType: string): number {
    const mapping: { [key: string]: number } = {
      'Full-time': 1, 'Part-time': 2, 'Contract': 3,
      'Internship': 4, 'Freelance': 5, 'Temporary': 6
    };
    return mapping[jobType] || 1;
  }

  private static getWorkplaceTypeId(workplaceType: string): number {
    const mapping: { [key: string]: number } = {
      'Onsite': 1, 'Remote': 2, 'Hybrid': 3
    };
    return mapping[workplaceType] || 2;
  }

  private static extractDepartment(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('engineer') || titleLower.includes('developer') || titleLower.includes('software')) return 'Engineering';
    if (titleLower.includes('data scientist') || titleLower.includes('analyst') || titleLower.includes('ml')) return 'Data Science';
    if (titleLower.includes('product manager') || titleLower.includes('product owner')) return 'Product';
    if (titleLower.includes('designer') || titleLower.includes('ux') || titleLower.includes('ui')) return 'Design';
    if (titleLower.includes('marketing') || titleLower.includes('growth')) return 'Marketing';
    if (titleLower.includes('sales') || titleLower.includes('business development')) return 'Sales';
    if (titleLower.includes('manager') || titleLower.includes('director') || titleLower.includes('lead')) return 'Management';
    
    return 'Technology';
  }

  private static extractCountry(location: string): string {
    if (!location) return 'United States';
    
    const locationLower = location.toLowerCase();
    if (locationLower.includes('india') || locationLower.includes('bangalore') || locationLower.includes('mumbai') || locationLower.includes('delhi')) return 'India';
    if (locationLower.includes('canada') || locationLower.includes('toronto') || locationLower.includes('vancouver')) return 'Canada';
    if (locationLower.includes('uk') || locationLower.includes('london') || locationLower.includes('manchester')) return 'United Kingdom';
    if (locationLower.includes('australia') || locationLower.includes('sydney') || locationLower.includes('melbourne')) return 'Australia';
    if (locationLower.includes('germany') || locationLower.includes('berlin')) return 'Germany';
    if (locationLower.includes('france') || locationLower.includes('paris')) return 'France';
    if (locationLower.includes('remote') || locationLower.includes('worldwide')) return 'Remote';
    
    return 'United States';
  }

  private static extractMinExperience(title: string, description: string): number {
    const content = `${title} ${description}`.toLowerCase();
    
    // Look for specific experience patterns
    const expPatterns = [
      /(\d+)\+?\s*years?\s+(?:of\s+)?experience/,
      /(\d+)-\d+\s*years/,
      /minimum\s+(?:of\s+)?(\d+)\s*years/
    ];

    for (const pattern of expPatterns) {
      const match = content.match(pattern);
      if (match) return parseInt(match[1]);
    }

    // Infer from title keywords
    if (content.includes('senior') || content.includes('sr.') || content.includes('lead') || content.includes('principal')) return 5;
    if (content.includes('mid') || content.includes('intermediate')) return 3;
    if (content.includes('junior') || content.includes('jr.') || content.includes('entry') || content.includes('trainee')) return 0;
    
    return 0; // Default to entry level
  }

  private static extractMaxExperience(title: string, description: string): number {
    const minExp = this.extractMinExperience(title, description);
    const content = `${title} ${description}`.toLowerCase();
    
    // Look for range patterns
    const rangeMatch = content.match(/(\d+)-(\d+)\s*years/);
    if (rangeMatch) return parseInt(rangeMatch[2]);

    // Default ranges based on level
    if (content.includes('senior') || content.includes('lead') || content.includes('principal')) return Math.max(minExp + 5, 10);
    if (content.includes('mid') || content.includes('intermediate')) return Math.max(minExp + 3, 7);
    if (content.includes('junior') || content.includes('entry') || content.includes('trainee')) return Math.max(minExp + 2, 3);
    
    return Math.max(minExp + 3, 5);
  }

  private static detectWorkplaceType(location: string = '', title: string = '', description: string = ''): string {
    const content = `${location} ${title} ${description}`.toLowerCase();
    
    if (content.includes('remote') || content.includes('work from home') || content.includes('wfh')) return 'Remote';
    if (content.includes('hybrid')) return 'Hybrid';
    
    return 'Onsite';
  }

  private static mapJobType(contractType?: string): string {
    if (!contractType) return 'Full-time';
    
    const type = contractType.toLowerCase();
    if (type.includes('contract') || type.includes('freelance')) return 'Contract';
    if (type.includes('part-time') || type.includes('part time')) return 'Part-time';
    if (type.includes('intern')) return 'Internship';
    if (type.includes('temporary') || type.includes('temp')) return 'Temporary';
    
    return 'Full-time';
  }

  private static getCountryName(countryCode: string): string {
    const mapping: { [key: string]: string } = {
      'us': 'United States', 'ca': 'Canada', 'gb': 'United Kingdom',
      'in': 'India', 'au': 'Australia', 'de': 'Germany', 'fr': 'France'
    };
    return mapping[countryCode] || countryCode.toUpperCase();
  }

  // Public configuration methods
  static getConfig() {
    return { ...this.config };
  }

  static updateConfig(newConfig: Partial<typeof this.config>) {
    this.config = { ...this.config, ...newConfig };
    console.log('?? Job scraper configuration updated');
  }

  // Get scraping statistics
  static async getScrapingStats(): Promise<any> {
    try {
      const query = `
        SELECT 
          LEFT(ExternalJobID, CHARINDEX('_', ExternalJobID + '_') - 1) as Source,
          COUNT(*) as JobCount,
          MAX(CreatedAt) as LastRun,
          COUNT(CASE WHEN Country = 'India' THEN 1 END) as IndiaJobs
        FROM Jobs 
        WHERE PostedByType = 0 
          AND ExternalJobID IS NOT NULL
          AND CreatedAt >= DATEADD(day, -7, GETUTCDATE())
        GROUP BY LEFT(ExternalJobID, CHARINDEX('_', ExternalJobID + '_') - 1)
        ORDER BY JobCount DESC
      `;
      
      const result = await dbService.executeQuery(query);
      
      const totalQuery = `
        SELECT 
          COUNT(*) as TotalScrapedJobs,
          COUNT(CASE WHEN Country = 'India' THEN 1 END) as TotalIndiaJobs,
          COUNT(CASE WHEN CreatedAt >= DATEADD(day, -1, GETUTCDATE()) THEN 1 END) as JobsLast24h
        FROM Jobs 
        WHERE PostedByType = 0 
          AND ExternalJobID IS NOT NULL
      `;
      
      const totalResult = await dbService.executeQuery(totalQuery);
      
      return {
        sourceBreakdown: result.recordset,
        summary: totalResult.recordset[0],
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error: any) {
      throw new Error(`Failed to get scraping stats: ${error.message}`);
    }
  }
}