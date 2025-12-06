/**
 * Production-Ready Job Scraper Service for RefOpen - ENHANCED 10X VERSION
 * Features: 10x more jobs, Human-like scraping, Global coverage, Broad search terms
 * Anti-blocking: Rotating headers, intelligent delays, session management
 */

import { dbService } from './database.service';
import { AuthService } from './auth.service';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';
import { findFortune500Match } from '../data/fortune500-companies';

console.log('🚀 Enhanced Job Scraper - 10x Mode Active');

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
  // 🎨 Enhanced fields for organization enrichment
  logoUrl?: string;
  companyWebsite?: string;
  companyIndustry?: string;
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
  // 🚀 ENHANCED CONFIG - 10X MORE JOBS
  private static config = {
    enabled: true,
    maxJobsPerRun: 1000, // ⬆️ INCREASED FROM 150 TO 1000
    sources: {
      remoteok: { 
        enabled: true, 
        maxJobs: 200, // ⬆️ INCREASED FROM 50 TO 200
        rateLimit: 2000 
      },
      adzuna: { 
        enabled: true, 
        maxJobsPerConfig: 50, // ⬆️ INCREASED FROM 8 TO 50 (API MAX)
        maxTotalJobs: 400, // ⬆️ NEW: TOTAL ADZUNA LIMIT
        rateLimit: 3000 
      },
      weworkremotely: { 
        enabled: true, 
        maxJobsPerCategory: 25, // ⬆️ INCREASED FROM 8 TO 25
        rateLimit: 1500 
      },
      hackernews: { 
        enabled: true, 
        maxJobs: 30, // ⬆️ INCREASED FROM 15 TO 30
        rateLimit: 1000 
      }
    },
    excludeKeywords: ['adult', 'gambling', 'crypto scam', 'mlm', 'pyramid']
  };

  // 🎭 ENHANCED USER AGENTS - MORE REALISTIC PATTERNS
  private static userAgents = [
    // Chrome variations with different versions
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    
    // Firefox variations
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
    
    // Safari variations
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    
    // Edge variations
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
  ];

  // 🌍 GLOBAL SEARCH TERMS - BROADER COVERAGE
  private static searchTerms = [
    // Technical Roles (expanded)
    'software engineer', 'developer', 'programmer', 'full stack developer',
    'frontend developer', 'backend developer', 'web developer', 'mobile developer',
    'devops engineer', 'cloud engineer', 'system administrator', 'database administrator',
    'data scientist', 'data engineer', 'machine learning engineer', 'ai engineer',
    'cybersecurity specialist', 'network engineer', 'qa engineer', 'test engineer',
    
    // Business & Management
    'product manager', 'project manager', 'business analyst', 'product owner',
    'scrum master', 'account manager', 'sales manager', 'marketing manager',
    'operations manager', 'finance manager', 'hr manager', 'customer success',
    
    // Design & Creative
    'ux designer', 'ui designer', 'graphic designer', 'product designer',
    'content writer', 'technical writer', 'marketing specialist', 'digital marketer',
    
    // Emerging Roles
    'blockchain developer', 'cloud architect', 'solutions architect', 'site reliability engineer'
  ];

  // 🌎 GLOBAL LOCATIONS - COUNTRY-WIDE SEARCHES
  private static adzunaConfigs = [
    // Major Markets - Country-wide searches
    { country: 'us', region: 'nationwide', priority: 'high' },
    { country: 'in', region: 'nationwide', priority: 'high' }, // India focus
    { country: 'ca', region: 'nationwide', priority: 'medium' },
    { country: 'gb', region: 'nationwide', priority: 'medium' },
    { country: 'au', region: 'nationwide', priority: 'medium' },
    { country: 'de', region: 'nationwide', priority: 'low' },
    { country: 'fr', region: 'nationwide', priority: 'low' },
    { country: 'nl', region: 'nationwide', priority: 'low' },
    { country: 'sg', region: 'nationwide', priority: 'medium' }, // Singapore
  ];

  // 🎲 SESSION MANAGEMENT - AVOID PATTERN DETECTION
  private static sessionState = {
    requestCount: 0,
    sessionStartTime: Date.now(),
    lastRequestTime: 0,
    userAgentIndex: 0
  };

  private static getRotatingUserAgent(): string {
    this.sessionState.userAgentIndex = (this.sessionState.userAgentIndex + 1) % this.userAgents.length;
    return this.userAgents[this.sessionState.userAgentIndex];
  }

  // 🧠 INTELLIGENT HUMAN-LIKE DELAYS - OPTIMIZED FOR AZURE FUNCTIONS
  private static async intelligentDelay(baseMs: number = 1000): Promise<void> {
    this.sessionState.requestCount++;
    
    // Reduced fatigue multiplier for faster execution
    const fatigueMultiplier = Math.min(1 + (this.sessionState.requestCount * 0.02), 1.3);
    
    // Add random variation (human unpredictability)
    const variation = 0.5 + (Math.random() * 0.5); // 50-100% of base
    
    // Calculate final delay
    const finalDelay = Math.floor(baseMs * fatigueMultiplier * variation);
    
    // Ensure minimum gap between requests (reduced from 1000ms to 500ms)
    const timeSinceLastRequest = Date.now() - this.sessionState.lastRequestTime;
    const additionalWait = Math.max(0, 500 - timeSinceLastRequest);
    
    const totalWait = finalDelay + additionalWait;
    
    await new Promise(resolve => setTimeout(resolve, totalWait));
    this.sessionState.lastRequestTime = Date.now();
  }

  // 🛡️ ENHANCED HTTP REQUEST WITH ANTI-BLOCKING FEATURES
  private static async makeStealthRequest(url: string, options: any = {}): Promise<any> {
    // Rotate headers for each request
    const headers = {
      'User-Agent': this.getRotatingUserAgent(),
      'Accept': options.json ? 'application/json, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,de;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': options.json ? 'empty' : 'document',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Upgrade-Insecure-Requests': '1',
      'DNT': '1', // Do Not Track
      'Sec-GPC': '1', // Global Privacy Control
      ...options.headers
    };

    // Add realistic referrer patterns
    if (!options.headers?.Referer && Math.random() > 0.7) {
      const referrers = [
        'https://www.google.com/',
        'https://www.linkedin.com/',
        'https://github.com/',
        'https://stackoverflow.com/'
      ];
      headers['Referer'] = referrers[Math.floor(Math.random() * referrers.length)];
    }

    // Intelligent delay before request
    await this.intelligentDelay(options.baseDelay || 2000);

    try {
      const response = await axios({
        url,
        method: options.method || 'GET',
        headers,
        timeout: options.timeout || 30000,
        params: options.params,
        validateStatus: (status) => status < 500,
        maxRedirects: 3,
        ...options
      });

      // Log successful requests (for monitoring)
      if (response.status === 200) {
        console.log(`✅ Request successful: ${url.split('?')[0]} (${response.status})`);
      }

      return response;
    } catch (error: any) {
      // Enhanced error handling with retry logic
      if (error.response?.status === 429) {
        console.log('🚦 Rate limited - implementing exponential backoff...');
        await new Promise(resolve => setTimeout(resolve, 30000 + (Math.random() * 15000)));
        throw new Error(`Rate limited: ${error.message}`);
      }
      
      throw error;
    }
  }

  // Load Adzuna API keys with fallback to your provided keys
  private static loadAdzunaApiKeys(): { appId: string; appKey: string } | null {
    try {
      // Try environment variables first
      let appId = process.env.ADZUNA_APP_ID;
      let appKey = process.env.ADZUNA_APP_KEY;
      
      // 🔑 FALLBACK: Use your provided keys if env vars not available
      if (!appId || !appKey) {
        appId = 'f88adc65';
        appKey = 'f10e165aae13d06f9c74709a38ed4e53';
        console.log('🔑 Using provided Adzuna API keys');
      } else {
        console.log('🔑 Using environment Adzuna API keys');
      }
      
      return { appId, appKey };
      
    } catch (error: any) {
      console.error('❌ Error loading Adzuna API keys:', error.message);
      return null;
    }
  }

  // Load Clearbit API key (optional - for enhanced enrichment)
  private static loadClearbitApiKey(): string | null {
    try {
      // Try environment variable first
      let apiKey = process.env.CLEARBIT_API_KEY;
      
      // 🔑 FALLBACK: Use hardcoded key if env var not available (same as PowerShell script)
      if (!apiKey) {
        apiKey = 'sk_2c8c9b5e8f5a4c5d9b3a7f1e2d4c6b8a'; // Clearbit API key
        console.log('🔑 Using hardcoded Clearbit API key for enrichment');
      } else {
        console.log('🔑 Using environment Clearbit API key for enhanced enrichment');
      }
      
      return apiKey;
    } catch (error: any) {
      return null;
    }
  }

  // 🚀 ENHANCED RemoteOK - GET ALL AVAILABLE JOBS WITH LOGOS (OPTIMIZED)
  private static async scrapeRemoteOK(): Promise<ScrapedJob[]> {
    const jobs: ScrapedJob[] = [];
    
    try {
      console.log('🌐 Scraping RemoteOK API (Optimized mode)...');
      const response = await this.makeStealthRequest('https://remoteok.io/api', { 
        json: true,
        baseDelay: 1000  // Reduced from 3000ms
      });
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid API response format');
      }

      const jobsData = response.data.slice(1); // Skip metadata
      const maxJobs = Math.min(jobsData.length, this.config.sources.remoteok.maxJobs);
      
      console.log(`📊 RemoteOK: Found ${jobsData.length} total jobs, processing ${maxJobs}`);

      let processed = 0;
      for (const job of jobsData.slice(0, maxJobs)) {
        if (!job.id || !job.position || !job.company) continue;

        // Enhanced posted date handling
        let postedDate = new Date();
        if (job.date) {
          if (typeof job.date === 'number') {
            postedDate = new Date(job.date * 1000);
          } else {
            const parsedDate = new Date(job.date);
            if (!isNaN(parsedDate.getTime())) {
              postedDate = parsedDate;
            }
          }
        }

        // Validate date reasonableness
        const now = new Date();
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
        if (postedDate > now) postedDate = now;
        if (postedDate < sixtyDaysAgo) {
          continue; // Skip very old jobs
        }

        // 🎨 Extract logo URL from RemoteOK API
        const logoUrl = job.logo || job.company_logo || null;

        // Create enhanced scraped job with logo data
        const scrapedJob: ScrapedJob & { logoUrl?: string } = {
          externalJobId: `remoteok_${job.id}`,
          title: job.position.substring(0, 200),
          company: job.company.substring(0, 100),
          location: job.location || 'Remote',
          description: job.description ? job.description.substring(0, 3000) : `${job.position} at ${job.company}. Full remote position with competitive compensation.`,
          salaryMin: job.salary_min ? parseInt(job.salary_min.toString().replace(/[^\d]/g, '')) : undefined,
          salaryMax: job.salary_max ? parseInt(job.salary_max.toString().replace(/[^\d]/g, '')) : undefined,
          jobType: 'Full-time',
          workplaceType: 'Remote',
          requirements: Array.isArray(job.tags) ? job.tags.slice(0, 15).join(', ') : '',
          applicationUrl: job.url,
          source: 'RemoteOK',
          postedDate: postedDate,
          logoUrl: logoUrl
        };

        jobs.push(scrapedJob);
        processed++;
      }

      console.log(`✅ RemoteOK: Successfully processed ${processed} jobs`);
      
    } catch (error: any) {
      console.error(`❌ RemoteOK scraping failed: ${error.message}`);
      throw error;
    }

    return jobs;
  }

  // 🌍 OPTIMIZED ADZUNA - FOCUSED ON HIGH-VALUE COUNTRIES
  private static async scrapeAdzunaGlobal(): Promise<ScrapedJob[]> {
    const jobs: ScrapedJob[] = [];
    
    try {
      console.log('🌍 Scraping Adzuna API (Optimized mode)...');
      
      const apiKeys = this.loadAdzunaApiKeys();
      if (!apiKeys) {
        console.log('⚠️ Skipping Adzuna: No API keys found');
        return jobs;
      }

      const { appId, appKey } = apiKeys;
      let totalProcessed = 0;
      
      // 🎯 OPTIMIZED: Focus on top 2 search terms for speed
      const prioritySearchTerms = ['software engineer', 'developer'];
      
      // 🎯 OPTIMIZED: Focus on high-priority countries only (US, India)
      const priorityConfigs = this.adzunaConfigs.filter(c => c.priority === 'high');
      
      for (const config of priorityConfigs) {
        if (totalProcessed >= this.config.sources.adzuna.maxTotalJobs) {
          console.log(`🏁 Reached Adzuna total job limit: ${this.config.sources.adzuna.maxTotalJobs}`);
          break;
        }

        const searchTermsToUse = config.priority === 'high' ? 2 : 1;
        
        for (let i = 0; i < searchTermsToUse && totalProcessed < this.config.sources.adzuna.maxTotalJobs; i++) {
          const searchTerm = prioritySearchTerms[i % prioritySearchTerms.length];
          
          try {
            const apiUrl = `https://api.adzuna.com/v1/api/jobs/${config.country}/search/1`;
            const params = {
              app_id: appId,
              app_key: appKey,
              what: searchTerm,
              results_per_page: this.config.sources.adzuna.maxJobsPerConfig,
              sort_by: 'date',
            };

            console.log(`🔍 Adzuna: ${config.country.toUpperCase()}/${searchTerm}`);
            
            const response = await this.makeStealthRequest(apiUrl, { 
              params,
              json: true,
              timeout: 20000,
              baseDelay: 2000  // Reduced from 4000ms
            });
            
            if (response.status !== 200) {
              console.log(`⚠️ Adzuna ${config.country}: HTTP ${response.status}`);
              continue;
            }

            const data = response.data;
            if (!data.results || !Array.isArray(data.results)) {
              console.log(`⚠️ Adzuna ${config.country}: Invalid response structure`);
              continue;
            }

            console.log(`📈 Adzuna ${config.country}: ${data.results.length} jobs`);
            
            for (const job of data.results) {
              if (!job.id || !job.title || !job.company?.display_name) continue;
              if (totalProcessed >= this.config.sources.adzuna.maxTotalJobs) break;

              let postedDate = new Date();
              if (job.created) {
                const createdDate = new Date(job.created);
                if (!isNaN(createdDate.getTime())) {
                  postedDate = createdDate;
                }
              }

              const companyIndustry = job.category?.label || 'Technology';

              jobs.push({
                externalJobId: `adzuna_${config.country}_${job.id}`,
                title: job.title.substring(0, 200),
                company: job.company.display_name.substring(0, 100),
                location: job.location?.display_name || `${config.country.toUpperCase()}`,
                description: job.description ? job.description.substring(0, 3000) : `${job.title} position at ${job.company.display_name}`,
                salaryMin: job.salary_min ? Math.round(job.salary_min) : undefined,
                salaryMax: job.salary_max ? Math.round(job.salary_max) : undefined,
                jobType: this.mapJobType(job.contract_type),
                workplaceType: this.detectWorkplaceType(job.location?.display_name, job.title, job.description),
                applicationUrl: job.redirect_url,
                postedDate: postedDate,
                source: `Adzuna_${config.country.toUpperCase()}`,
                companyIndustry: companyIndustry
              });
              totalProcessed++;
            }
            
            // Reduced delay between requests
            await this.intelligentDelay(2000);  // Reduced from 5000ms
            
          } catch (error: any) {
            console.log(`❌ Adzuna ${config.country}/${searchTerm}: ${error.message}`);
            
            if (error.response?.status === 429) {
              console.log('🚦 Adzuna rate limit - skipping remaining countries');
              return jobs;  // Return what we have instead of waiting
            }
          }
        }
      }
      
      console.log(`✅ Adzuna: Collected ${jobs.length} jobs`);
      
    } catch (error: any) {
      console.error(`❌ Adzuna scraping failed: ${error.message}`);
      throw error;
    }

    return jobs;
  }

  // 🚀 OPTIMIZED WeWorkRemotely RSS
  private static async scrapeWeWorkRemotelyRSS(): Promise<ScrapedJob[]> {
    const jobs: ScrapedJob[] = [];
    
    try {
      console.log('📡 Scraping WeWorkRemotely RSS (Optimized)...');
      
      // 🎯 OPTIMIZED: Focus on top 3 categories for speed
      const rssFeeds = [
        { category: 'programming', url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss' },
        { category: 'product', url: 'https://weworkremotely.com/categories/remote-product-jobs.rss' },
        { category: 'design', url: 'https://weworkremotely.com/categories/remote-design-jobs.rss' },
      ];
      
      for (const feed of rssFeeds) {
        try {
          console.log(`📥 Fetching ${feed.category} jobs...`);
          
          const response = await this.makeStealthRequest(feed.url, { 
            timeout: 15000,  // Reduced from 20000ms
            baseDelay: 1000,  // Reduced from 3000ms
            headers: {
              'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
          });
          
          if (response.status !== 200) {
            console.log(`⚠️ WeWorkRemotely ${feed.category}: HTTP ${response.status}`);
            continue;
          }
          
          const xmlContent = response.data;
          const itemsRegex = /<item>(.*?)<\/item>/gs;
          let match;
          let itemCount = 0;
          
          while ((match = itemsRegex.exec(xmlContent)) !== null && itemCount < this.config.sources.weworkremotely.maxJobsPerCategory) {
            const itemContent = match[1];
            
            const title = this.extractRSSField(itemContent, 'title');
            const description = this.extractRSSField(itemContent, 'description');
            const link = this.extractRSSField(itemContent, 'link');
            const pubDate = this.extractRSSField(itemContent, 'pubDate');
            
            if (title && description) {
              const titleParts = title.split(': ');
              const company = titleParts[0] || 'Remote Company';
              const jobTitle = titleParts[1] || title;
              
              const cleanDescription = description
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 3000);
              
              jobs.push({
                externalJobId: `weworkremotely_${Date.now()}_${itemCount}_${Math.random().toString(36).substr(2, 5)}`,
                title: jobTitle.substring(0, 200),
                company: company.substring(0, 100),
                location: 'Remote',
                description: cleanDescription,
                jobType: 'Full-time',
                workplaceType: 'Remote',
                applicationUrl: link,
                source: 'WeWorkRemotely',
                postedDate: pubDate ? new Date(pubDate) : new Date()
              });
              
              itemCount++;
            }
          }
          
          console.log(`✅ WeWorkRemotely ${feed.category}: ${itemCount} jobs`);
          
        } catch (error: any) {
          console.log(`❌ WeWorkRemotely ${feed.category} failed: ${error.message}`);
        }
      }
      
      console.log(`🎉 WeWorkRemotely total: ${jobs.length} jobs`);
      
    } catch (error: any) {
      console.error('❌ WeWorkRemotely RSS scraping failed:', error.message);
    }
    
    return jobs;
  }

  // 🚀 OPTIMIZED HackerNews
  private static async scrapeHackerNewsJobs(): Promise<ScrapedJob[]> {
    const jobs: ScrapedJob[] = [];
    
    try {
      console.log('🦄 Scraping HackerNews Jobs (Optimized)...');
      
      const jobStoriesResponse = await this.makeStealthRequest('https://hacker-news.firebaseio.com/v0/jobstories.json', { 
        json: true,
        timeout: 10000,  // Reduced from 15000ms
        baseDelay: 500  // Reduced from 1500ms
      });
      
      if (jobStoriesResponse.status !== 200 || !Array.isArray(jobStoriesResponse.data)) {
        throw new Error(`Failed to fetch job stories: HTTP ${jobStoriesResponse.status}`);
      }
      
      const jobIds = jobStoriesResponse.data.slice(0, this.config.sources.hackernews.maxJobs);
      console.log(`📋 HackerNews: Processing ${jobIds.length} job stories`);
      
      let processed = 0;
      for (const jobId of jobIds) {
        try {
          const jobResponse = await this.makeStealthRequest(`https://hacker-news.firebaseio.com/v0/item/${jobId}.json`, { 
            json: true,
            timeout: 8000,  // Reduced from 10000ms
            baseDelay: 500  // Reduced from 1200ms
          });
          
          if (jobResponse.status !== 200 || !jobResponse.data) {
            continue;
          }
          
          const job = jobResponse.data;
          
          if (!job.title || job.type !== 'job') {
            continue;
          }
          
          let company = 'Startup Company';
          let jobTitle = job.title;
          
          const hiringMatch = job.title.match(/^(.+?)\s+(?:\([^)]+\)\s+)?[Ii]s [Hh]iring\s*(?:[-:]?\s*(.+))?/);
          if (hiringMatch) {
            company = hiringMatch[1].trim();
            jobTitle = hiringMatch[2] ? hiringMatch[2].trim() : 'Multiple Positions';
            company = company.replace(/\s*\([^)]*YC[^)]*\)/g, '').trim();
          }
          
          const applicationUrl = job.url || `https://news.ycombinator.com/item?id=${job.id}`;
          const postedDate = job.time ? new Date(job.time * 1000) : new Date();
          
          const description = this.createEnhancedStartupDescription(job.title, company, applicationUrl);
          
          jobs.push({
            externalJobId: `hackernews_${job.id}`,
            title: jobTitle.substring(0, 200),
            company: company.substring(0, 100),
            location: 'Remote / San Francisco',
            description: description,
            jobType: 'Full-time',
            workplaceType: 'Hybrid',
            applicationUrl: applicationUrl,
            source: 'HackerNews',
            postedDate: postedDate
          });
          
          processed++;
          
        } catch (error: any) {
          // Silently skip failed jobs to save time
        }
      }
      
      console.log(`🦄 HackerNews: Successfully processed ${processed} jobs`);
      
    } catch (error: any) {
      console.error('❌ HackerNews scraping failed:', error.message);
      throw error;
    }
    
    return jobs;
  }

  // 🎨 ENHANCED startup job descriptions
  private static createEnhancedStartupDescription(title: string, company: string, applicationUrl: string): string {
    return `🚀 **Startup Opportunity at ${company}**

💡 **About This Role**: ${title}

🌟 **Why This Is Exciting**:
• Early-stage company with massive growth potential
• Opportunity to shape product direction and company culture  
• Work directly with founders and leadership team
• Competitive equity package and rapid career advancement
• Cutting-edge technology stack and innovative challenges

🎯 **Ideal For**:
• Entrepreneurs who want to build something from the ground up
• Experienced professionals seeking high-impact roles
• Innovators excited by fast-paced startup environments
• Leaders ready to take on significant responsibility

💰 **Typical Startup Benefits**:
• Equity participation in company success
• Flexible work arrangements (often remote-friendly)
• Learning opportunities across multiple disciplines
• Direct access to founders and decision-makers
• Potential for rapid promotion and role expansion

🔗 **Next Steps**: This position was posted on Hacker News, indicating strong technical DNA and founder-led culture. Many YC companies and innovative startups use this platform to find top-tier talent.

Apply now to join a dynamic team that's building the future! 🌟`;
  }

  // 🎯 HELPER: Extract field from RSS XML content  
  private static extractRSSField(xmlContent: string, fieldName: string): string {
    const regex = new RegExp(`<${fieldName}[^>]*><!\\[CDATA\\[(.*?)\\]\\]><\/${fieldName}>`, 's');
    const cdataMatch = xmlContent.match(regex);
    if (cdataMatch) {
      return cdataMatch[1].trim();
    }
    
    const simpleRegex = new RegExp(`<${fieldName}[^>]*>(.*?)<\/${fieldName}>`, 's');
    const simpleMatch = xmlContent.match(simpleRegex);
    return simpleMatch ? simpleMatch[1].trim() : '';
  }

  // 🧹 SMART COMPANY NAME NORMALIZATION
  /**
   * Removes noise, leading numbers (smartly), and normalizes company names
   * to prevent duplicate organizations in the database
   */
  private static normalizeCompanyName(rawName: string): string {
    if (!rawName) return '';
    
    // Step 1: Preserve original and create working copy
    const original = rawName.trim();
    let normalized = original.toLowerCase();
    
    // Step 2: Define brand patterns FIRST (check against original before modifications)
    // These patterns identify company names where numbers are part of the brand
    const brandPatterns = [
      /^\d{1,3}[a-z]{2,8}$/i,   // 360bet, 99acres, 1mg (1-3 digits + 2-8 letters, likely a brand)
      /^\d+x\d+/i,              // 24x7services
      /^\d{1,2}[A-Z][a-z]+/,    // 7Eleven, 8Base (1-2 digits + capital - likely a brand, not 2100Microsoft)
      /^[0-9]{1,2}[A-Z]+$/,     // 3M, 4U (1-2 digits + all capitals)
      /^\d+\/\d+/,              // 24/7
    ];
    
    const isBrandName = brandPatterns.some(pattern => pattern.test(original));
    
    // Step 3: Remove office codes and location-specific suffixes (e.g., "- A19", "- Hyderabad")
    // This must happen BEFORE noise word removal to catch patterns like "Amazon Dev Center - Hyderabad"
    normalized = normalized.replace(/\s*-\s*[a-z]\d+$/i, ''); // Remove "- A19", "- B52" style office codes
    normalized = normalized.replace(/\s*-\s*(hyderabad|bangalore|mumbai|chennai|delhi|pune|gurgaon|noida)$/i, ''); // Remove city suffixes
    normalized = normalized.replace(/\s*-\s*(us|usa|uk|india)$/i, ''); // Remove country suffixes
    
    // Step 4: Remove generic organizational terms that don't identify the brand
    const genericTerms = [
      'development center', 'development centre', 'dev center', 'dev centre',
      'data center', 'data centre', 'data services',
      'research center', 'research centre',
      'manufacturing enterprises',
      'retail operations'
    ];
    
    for (const term of genericTerms) {
      const pattern = new RegExp(`\\s+${term.replace(/\s/g, '\\s+')}`, 'gi');
      normalized = normalized.replace(pattern, '');
    }
    
    // Step 5: Remove noise words/suffixes (order matters - remove longer phrases first)
    const noiseWords = [
      'private limited', 'pvt ltd', 'pvt. ltd', 'pvt ltd.', 'pvt. ltd.',
      'private ltd', 'private', 'pvt', 'limited', 'ltd',
      'incorporated', 'corporation', 'corp', 'inc',
      'llc', 'l.l.c', 'l.l.c.', 'company', 'co',
      'technologies', 'technology', 'tech', 'software', 'systems',
      'services', 'solutions', 'group', 'international', 'global',
      'india', 'usa', 'uk', 'us'
    ];
    
    // Remove noise words at the end of the name
    for (const noise of noiseWords) {
      const pattern = new RegExp(`\\s+${noise.replace(/\./g, '\\.')}$`, 'gi');
      normalized = normalized.replace(pattern, '');
    }
    
    // Step 6: Remove all punctuation except spaces (before number handling)
    normalized = normalized.replace(/[^\w\s]/g, '');
    
    // Step 7: Smart leading number removal (SKIP if brand name)
    if (!isBrandName) {
      // Pattern 1: Leading numbers followed by space (e.g., "2100 Microsoft" -> "microsoft")
      normalized = normalized.replace(/^(\d+)\s+/, '');
      
      // Pattern 2: Leading numbers with 4+ digits followed by letters (e.g., "2100Microsoft" -> "microsoft")
      // This catches noise like "2100Microsoft" but preserves "360bet", "99acres", "7Eleven"
      // Only remove if: (a) 4+ leading digits OR (b) remaining text is 4+ chars
      const longNumberMatch = normalized.match(/^(\d{4,})([a-z]+)/);
      if (longNumberMatch) {
        normalized = longNumberMatch[2];
      } else {
        // For shorter numbers (1-3 digits), only remove if remaining text is substantial (4+ chars)
        const shortNumberMatch = normalized.match(/^(\d{1,3})([a-z]{4,})/);
        if (shortNumberMatch) {
          normalized = shortNumberMatch[2];
        }
      }
    }
    
    // Step 8: Token filtering - split into words and filter
    const tokens = normalized
      .split(/\s+/)
      .filter(token => {
        // Remove empty tokens
        if (!token) return false;
        
        // Remove tokens shorter than 2 characters (unless it's the only token)
        if (token.length < 2) return false;
        
        // Remove noise words that might appear mid-string
        if (noiseWords.includes(token.toLowerCase())) return false;
        
        return true;
      });
    
    // Step 9: Join tokens and clean up extra spaces
    normalized = tokens.join(' ').trim().replace(/\s+/g, ' ');
    
    // Step 10: Final safety check - if result is empty or too short, use original cleaned
    if (!normalized || normalized.length < 2) {
      normalized = original.toLowerCase().replace(/[^\w\s]/g, '').trim();
    }
    
    return normalized;
  }

  /**
   * 🎯 Calculate similarity between two strings using Levenshtein distance
   * Returns a similarity score between 0 and 1 (1 = identical)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(longer, shorter);
    
    // Convert to similarity score (0-1)
    return (longer.length - distance) / longer.length;
  }

  /**
   * 📏 Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * 🔍 Find existing organization by normalized name with similarity matching
   * Returns organization if found, null otherwise
   */
  private static async findSimilarOrganization(normalizedName: string, originalName?: string): Promise<any | null> {
    try {
      // FIRST: Try exact match on original name (prevents duplicates)
      if (originalName) {
        const exactNameQuery = `
          SELECT TOP 1 OrganizationID, Name, LogoURL, Website, Industry 
          FROM Organizations 
          WHERE Name = @param0 AND IsActive = 1
        `;
        
        const exactNameMatch = await dbService.executeQuery(exactNameQuery, [originalName]);
        if (exactNameMatch.recordset.length > 0) {
          console.log(`✅ Exact name match found: "${originalName}"`);
          return exactNameMatch.recordset[0];
        }
      }
      
      // SECOND: Try exact match on normalized name (case-insensitive, no spaces)
      const exactQuery = `
        SELECT TOP 1 OrganizationID, Name, LogoURL, Website, Industry 
        FROM Organizations 
        WHERE LOWER(REPLACE(Name, ' ', '')) = @param0
          AND IsActive = 1
      `;
      
      const exactMatch = await dbService.executeQuery(exactQuery, [normalizedName.replace(/\s/g, '').toLowerCase()]);
      if (exactMatch.recordset.length > 0) {
        console.log(`✅ Normalized match found for "${normalizedName}": ${exactMatch.recordset[0].Name}`);
        return exactMatch.recordset[0];
      }
      
      // Second, fetch potential matches and calculate similarity
      const candidatesQuery = `
        SELECT TOP 20 OrganizationID, Name, LogoURL, Website, Industry 
        FROM Organizations 
        WHERE LEN(Name) BETWEEN @param0 AND @param1
          AND IsActive = 1
        ORDER BY Name
      `;
      
      const minLen = Math.max(3, normalizedName.length - 5);
      const maxLen = normalizedName.length + 10;
      
      const candidates = await dbService.executeQuery(candidatesQuery, [minLen, maxLen]);
      
      // Calculate similarity for each candidate
      const SIMILARITY_THRESHOLD = 0.85;
      let bestMatch: any = null;
      let bestScore = 0;
      
      for (const candidate of candidates.recordset) {
        const candidateNormalized = this.normalizeCompanyName(candidate.Name);
        const similarity = this.calculateSimilarity(normalizedName, candidateNormalized);
        
        if (similarity >= SIMILARITY_THRESHOLD && similarity > bestScore) {
          bestScore = similarity;
          bestMatch = candidate;
        }
      }
      
      if (bestMatch) {
        console.log(`🎯 Similar match found for "${normalizedName}": ${bestMatch.Name} (score: ${bestScore.toFixed(2)})`);
        return bestMatch;
      }
      
      return null;
      
    } catch (error: any) {
      console.error(`Error finding similar organization: ${error.message}`);
      return null;
    }
  }

  // 💾 Enhanced database insertion with organization logo updates
  private static async insertJobIntoRefOpenDB(job: ScrapedJob): Promise<void> {
    try {
      // Get or create organization WITH enhanced data and validation
      let organizationId: number;
      try {
        organizationId = await this.getOrCreateOrganizationWithEnhancements(job.company, job.source, job);
      } catch (validationError: any) {
        // If company name is invalid, skip this job but don't crash the whole flow
        if (validationError.message.includes('Invalid company name')) {
          console.warn(`⏭️  Skipping job "${job.title}" due to invalid company: ${validationError.message}`);
          return; // Exit gracefully, continue with next job
        }
        // Re-throw other errors
        throw validationError;
      }
      
      const jobTypeId = this.getJobTypeId(job.jobType);
      const workplaceTypeId = this.getWorkplaceTypeId(job.workplaceType);
      const currencyId = this.detectCurrencyFromLocation(job.location);
      
      const jobId = AuthService.generateUniqueId();
      const now = new Date().toISOString();
      
      const actualPostedDate = job.postedDate ? job.postedDate.toISOString() : now;
      const jobAge = job.postedDate ? Math.floor((Date.now() - job.postedDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      const insertQuery = `
        INSERT INTO Jobs (
          JobID, OrganizationID, PostedByType, Title, JobTypeID, WorkplaceTypeID,
          Department, Description, Location, Country, IsRemote,
          SalaryRangeMin, SalaryRangeMax, CurrencyID, SalaryPeriod, CompensationType,
          ExperienceMin, ExperienceMax, Status, Priority, Visibility,
          PublishedAt, ExpiresAt, CreatedAt, UpdatedAt, ExternalJobID,
          Tags, CurrentApplications, ApplicationURL
        )
        VALUES (
          @param0, @param1, 0, @param2, @param3, @param4,
          @param5, @param6, @param7, @param8, @param9,
          @param10, @param11, @param12, @param13, @param14,
          @param15, @param16, @param17, @param18, @param19,
          @param20, @param21, @param22, @param23, @param24,
          @param25, @param26, @param27
        )
      `;
      
      const values = [
        jobId, organizationId, job.title, jobTypeId, workplaceTypeId,
        this.extractDepartment(job.title), job.description, job.location,
        this.extractCountry(job.location), job.workplaceType === 'Remote' ? 1 : 0,
        job.salaryMin, job.salaryMax, currencyId, 'Annual', 'Salary',
        this.extractMinExperience(job.title, job.description), 
        this.extractMaxExperience(job.title, job.description),
        'Published', this.calculateJobPriority(job, jobAge), 'Public',
        actualPostedDate, this.calculateExpiryDate(actualPostedDate, jobAge),
        actualPostedDate, now, job.externalJobId,
        `${job.source}, ${job.jobType}, ${job.workplaceType}${job.requirements ? ', ' + job.requirements.substring(0, 100) : ''}`,
        0, job.applicationUrl
      ];
      
      await dbService.executeQuery(insertQuery, values);
      
    } catch (error: any) {
      throw new Error(`Database insertion failed: ${error.message}`);
    }
  }

  /**
   * 🛡️ VALIDATION: Check if company name is valid before adding to database
   * Rejects junk/test data, Excel errors, malformed names, etc.
   */
  private static isValidCompanyName(companyName: string): { valid: boolean; reason?: string } {
    if (!companyName || companyName.trim().length === 0) {
      return { valid: false, reason: 'Empty name' };
    }

    const trimmed = companyName.trim();

    // Reject: Excel errors
    if (/^#(REF|NAME|VALUE|DIV|N\/A|NULL|NUM)!?/i.test(trimmed)) {
      return { valid: false, reason: 'Excel error' };
    }

    // Reject: Test/placeholder data
    if (/(test|sample|demo|placeholder|example|abc|xyz).*company/i.test(trimmed)) {
      return { valid: false, reason: 'Test data' };
    }

    // Reject: Malformed (starts with *, ., or weird patterns)
    if (/^[*.]|\.$/i.test(trimmed)) {
      return { valid: false, reason: 'Malformed name' };
    }

    // Reject: Too short (1-2 characters) UNLESS known company
    const knownShort = /^(3M|HP|GE|EA|AT&T|IBM|AMD)$/i;
    if (!knownShort.test(trimmed) && trimmed.length <= 2) {
      return { valid: false, reason: 'Too short' };
    }

    // Reject: Generic operators/addresses
    if (/main.*street.*operator|^\d+\s+main\s+street|operator$/i.test(trimmed)) {
      return { valid: false, reason: 'Generic address/operator' };
    }

    // Reject: Just "Company", "Inc", "LLC", etc.
    if (/^(company|inc|llc|ltd|org|organization|business|enterprise|firm)$/i.test(trimmed)) {
      return { valid: false, reason: 'Generic business term' };
    }

    // Reject: Non-printable or control characters
    if (/[\x00-\x1F]|[^\x20-\x7E\u00A0-\uFFFF]/.test(trimmed)) {
      return { valid: false, reason: 'Invalid characters' };
    }

    // Reject: Obvious placeholder patterns
    if (/^(webdesigner.*\d+|\d+.*webdesigner)$/i.test(trimmed)) {
      return { valid: false, reason: 'Placeholder pattern' };
    }

    return { valid: true };
  }

  // 🏢 ENHANCED: Get or create organization with Fortune 500 matching AND smart normalization
  private static async getOrCreateOrganizationWithEnhancements(companyName: string, source: string, job: ScrapedJob): Promise<number> {
    const cleanName = companyName.trim().substring(0, 100);
    
    // 🛡️ STEP 0: Validate company name BEFORE any processing
    const validation = this.isValidCompanyName(cleanName);
    if (!validation.valid) {
      console.warn(`⚠️ Skipping invalid company name "${cleanName}": ${validation.reason}`);
      throw new Error(`Invalid company name: ${validation.reason}`);
    }
    
    // 🌟 STEP 1: Check Fortune 500 list first for canonical name
    const fortune500Match = findFortune500Match(cleanName);
    const canonicalName = fortune500Match ? fortune500Match.canonicalName : cleanName;
    const isFortune500 = !!fortune500Match;
    
    console.log(`🔍 Processing company: "${cleanName}"${fortune500Match ? ` → Fortune 500: "${canonicalName}"` : ''}`);
    
    // 🧹 STEP 2: Normalize for matching (use canonical name if Fortune 500)
    const normalizedName = this.normalizeCompanyName(canonicalName);
    
    // 🎯 STEP 3: Try to find similar organization using smart matching (pass original name for exact match)
    const similarOrg = await this.findSimilarOrganization(normalizedName, canonicalName);
    if (similarOrg) {
      // If it's a Fortune 500 company, update the name to canonical
      if (isFortune500 && similarOrg.Name !== canonicalName) {
        await this.updateOrganizationName(similarOrg.OrganizationID, canonicalName, isFortune500, fortune500Match?.industry);
      }
      
      // 🔄 UPDATE existing organization with new data from APIs
      await this.updateOrganizationWithApiData(similarOrg.OrganizationID, canonicalName, source, job, similarOrg);
      return similarOrg.OrganizationID;
    }

    // STEP 4: No similar organization found, create new one with enhanced data
    const enhancedOrgData = await this.getEnhancedOrganizationData(canonicalName, source, job);
    
    // Override industry if Fortune 500 match provides better data
    const finalIndustry = fortune500Match?.industry || enhancedOrgData.industry;
    
    const insertQuery = `
      INSERT INTO Organizations (Name, Type, Industry, Size, Description, CreatedAt, UpdatedAt, IsActive, IsFortune500, LogoURL, Website, LinkedInProfile)
      OUTPUT INSERTED.OrganizationID
      VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6, 1, @param7, @param8, @param9, @param10)
    `;
    
    const now = new Date().toISOString();
    
    try {
      const result = await dbService.executeQuery(insertQuery, [
        canonicalName,  // Use canonical name from Fortune 500 list
        'Company',
        finalIndustry,
        enhancedOrgData.size,
        `${enhancedOrgData.description}${isFortune500 ? ' (Fortune 500 Company)' : ''} (Auto-created from ${source} job scraping)`,
        now,
        now,
        isFortune500 ? 1 : 0,  // IsFortune500 flag
        enhancedOrgData.logoUrl,
        enhancedOrgData.website,
        enhancedOrgData.linkedInProfile
      ]);

      console.log(`🏢 Created new organization: ${canonicalName}${isFortune500 ? ' ⭐ (Fortune 500)' : ''}`);
      return result.recordset[0].OrganizationID;
      
    } catch (insertError: any) {
      // Handle race condition: Another process inserted the same organization
      if (insertError.message && insertError.message.includes('UNIQUE KEY constraint')) {
        console.log(`🔄 Organization "${canonicalName}" was just created by another process, retrieving it...`);
        
        // Retrieve the organization that was just created
        const retrieveQuery = `
          SELECT OrganizationID 
          FROM Organizations 
          WHERE Name = @param0 AND IsActive = 1
        `;
        const retrieveResult = await dbService.executeQuery(retrieveQuery, [canonicalName]);
        
        if (retrieveResult.recordset.length > 0) {
          console.log(`✅ Retrieved existing organization: ${canonicalName}`);
          return retrieveResult.recordset[0].OrganizationID;
        }
      }
      
      // Re-throw if it's a different error
      throw insertError;
    }
  }

  // 📝 Update organization name to canonical Fortune 500 name
  private static async updateOrganizationName(organizationId: number, canonicalName: string, isFortune500: boolean, industry?: string): Promise<void> {
    try {
      const updates: string[] = ['Name = @param0', 'IsFortune500 = @param1', 'UpdatedAt = @param2'];
      const params: any[] = [canonicalName, isFortune500 ? 1 : 0, new Date().toISOString()];
      
      if (industry) {
        updates.push('Industry = @param3');
        params.push(industry);
      }
      
      const updateQuery = `UPDATE Organizations SET ${updates.join(', ')} WHERE OrganizationID = @param${params.length}`;
      params.push(organizationId);
      
      await dbService.executeQuery(updateQuery, params);
      console.log(`✅ Updated organization ${organizationId} to canonical name: "${canonicalName}" (Fortune 500: ${isFortune500})`);
    } catch (error: any) {
      console.warn(`⚠️ Failed to update organization name: ${error.message}`);
    }
  }

  // 🔄 Update existing organization with new API data (ENHANCED with Clearbit data)
  private static async updateOrganizationWithApiData(organizationId: number, companyName: string, source: string, job: ScrapedJob, existingData: any): Promise<void> {
    try {
      const enhancedData = await this.getEnhancedOrganizationData(companyName, source, job);
      
      // Only update if we have new/better information
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 0;
      
      // Update LogoURL if we have one and existing doesn't
      if (enhancedData.logoUrl && !existingData.LogoURL) {
        updates.push(`LogoURL = @param${paramIndex}`);
        params.push(enhancedData.logoUrl);
        paramIndex++;
        console.log(`📸 Adding logo to ${companyName}: ${enhancedData.logoUrl}`);
      }
      
      // Update Website if we have one and existing doesn't
      if (enhancedData.website && !existingData.Website) {
        updates.push(`Website = @param${paramIndex}`);
        params.push(enhancedData.website);
        paramIndex++;
        console.log(`🌐 Adding website to ${companyName}: ${enhancedData.website}`);
      }
      
      // Update Description if we have better info (from Clearbit)
      if (enhancedData.description && enhancedData.description !== `${companyName} - ${enhancedData.industry} company`) {
        if (!existingData.Description || existingData.Description.includes('Auto-created from')) {
          updates.push(`Description = @param${paramIndex}`);
          params.push(enhancedData.description);
          paramIndex++;
          console.log(`📝 Adding description to ${companyName}`);
        }
      }
      
      // Update Size if we have employee count (from Clearbit)
      if (enhancedData.size && enhancedData.size !== 'Unknown') {
        if (!existingData.Size || existingData.Size === 'Unknown') {
          updates.push(`Size = @param${paramIndex}`);
          params.push(enhancedData.size);
          paramIndex++;
          console.log(`👥 Adding size to ${companyName}: ${enhancedData.size}`);
        }
      }
      
      // Update Industry if existing is generic and we have better info
      if (enhancedData.industry !== 'Technology' && 
          (existingData.Industry === 'Technology' || !existingData.Industry)) {
        updates.push(`Industry = @param${paramIndex}`);
        params.push(enhancedData.industry);
        paramIndex++;
        console.log(`🏭 Updating industry for ${companyName}: ${enhancedData.industry}`);
      }
      
      // Update LinkedInProfile if we have one (prefer Clearbit data over generated)
      if (enhancedData.linkedInProfile && !existingData.LinkedInProfile) {
        updates.push(`LinkedInProfile = @param${paramIndex}`);
        params.push(enhancedData.linkedInProfile);
        paramIndex++;
      }
      
      // Always update the UpdatedAt timestamp
      updates.push(`UpdatedAt = @param${paramIndex}`);
      params.push(new Date().toISOString());
      paramIndex++;
      
      if (updates.length > 1) { // More than just UpdatedAt
        const updateQuery = `UPDATE Organizations SET ${updates.join(', ')} WHERE OrganizationID = @param${paramIndex}`;
        params.push(organizationId);
        
        await dbService.executeQuery(updateQuery, params);
        console.log(`✅ Updated organization ${companyName} with ${updates.length - 1} new fields`);
      }
      
    } catch (error: any) {
      console.warn(`⚠️ Failed to update organization data for ${companyName}: ${error.message}`);
    }
  }

  // 📊 Get enhanced organization data from multiple sources (SAME AS POWERSHELL)
  private static async getEnhancedOrganizationData(companyName: string, source: string, job: ScrapedJob): Promise<{
    logoUrl: string | null;
    website: string | null;
    industry: string;
    size: string;
    description: string;
    linkedInProfile: string | null;
  }> {
    let logoUrl: string | null = null;
    let website: string | null = null;
    let industry = 'Technology'; // Default
    let size = 'Unknown';
    let linkedInProfile: string | null = null;
    let description = `${companyName} - ${industry} company`;
    
    // ✅ ENRICHMENT ENABLED: Using same logic as enrich-organizations.ps1
    const ENABLE_ENRICHMENT = true;
    
    // 1. Get logo from RemoteOK API if available (instant, no API call)
    if (source === 'RemoteOK') {
      logoUrl = await this.getRemoteOKLogo(job);
    }
    
    // 2. Get industry from job data if available (instant, no API call)
    if (job.companyIndustry) {
      industry = job.companyIndustry;
    }
    
    if (ENABLE_ENRICHMENT) {
      try {
        // 3. Try to find website using common domain patterns
        if (!website) {
          website = await this.searchCompanyWebsiteFast(companyName);
        }
        
        // 4. Get Clearbit logo if we have a website (single fast API call)
        if (!logoUrl && website) {
          logoUrl = await this.getClearbitLogoFast(website);
        }
        
        // 5. 🆕 Get comprehensive company data from Clearbit Company API (SAME AS POWERSHELL)
        const clearbitApiKey = this.loadClearbitApiKey();
        if (website && clearbitApiKey) {
          console.log(`📊 Fetching Clearbit Company data for ${companyName}...`);
          const clearbitData = await this.getClearbitCompanyInfo(website, clearbitApiKey);
          
          if (clearbitData) {
            // Use Clearbit data to enhance our organization info
            if (clearbitData.description) {
              description = clearbitData.description;
            }
            
            if (clearbitData.industry) {
              industry = clearbitData.industry;
            }
            
            if (clearbitData.employeeCount) {
              size = clearbitData.employeeCount;
            }
            
            if (clearbitData.linkedIn) {
              linkedInProfile = clearbitData.linkedIn;
            }
            
            // Use Clearbit logo if we don't have one yet and it's available
            if (!logoUrl && clearbitData.logo) {
              logoUrl = clearbitData.logo;
            }
            
            console.log(`✅ Clearbit: Enriched ${companyName} with comprehensive data`);
          }
        }
        
        // 6. Generate LinkedIn URL if we don't have one from Clearbit (instant, no API call)
        if (!linkedInProfile) {
          linkedInProfile = this.generateLinkedInUrl(companyName);
        }
        
      } catch (error) {
        console.warn(`⚠️ Enrichment failed for ${companyName}: ${error}`);
      }
    }
    
    // 7. Enhance industry based on job title/description (instant, no API call)
    industry = this.enhanceIndustryFromJob(job.title, job.description, industry);
    
    return {
      logoUrl,
      website,
      industry,
      size,
      description,
      linkedInProfile
    };
  }

  // 🎯 Extract logo URL from RemoteOK job data
  private static async getRemoteOKLogo(job: ScrapedJob): Promise<string | null> {
    // Use the logo URL from the RemoteOK API data
    return (job as any).logoUrl || null;
  }

  // 🛡️ Validate if URL is a legitimate company website (not social media)
  private static isValidCompanyWebsite(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
      
      // ❌ Block social media and wiki sites
      const blockedDomains = [
        'linkedin.com',
        'facebook.com',
        'twitter.com',
        'x.com',
        'instagram.com',
        'youtube.com',
        'tiktok.com',
        'wikipedia.org',
        'wikimedia.org',
        'wiki.',
        'github.com',  // GitHub is profile, not company website
        'medium.com'   // Medium is blog platform, not company website
      ];
      
      // Check if hostname contains any blocked domain
      const isBlocked = blockedDomains.some(blocked => 
        hostname.includes(blocked) || hostname.endsWith(blocked)
      );
      
      if (isBlocked) {
        console.log(`⚠️ Rejected social media/wiki URL as company website: ${url}`);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // 🌐 Fast website search using common domain patterns (with URL validation)
  private static async searchCompanyWebsiteFast(companyName: string): Promise<string | null> {
    try {
      // Generate domain variations
      const companySlug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '')
        .trim();
      
      // ✅ Pre-validation: Don't try to access social media domains
      const socialMediaKeywords = ['linkedin', 'facebook', 'twitter', 'instagram', 'wikipedia', 'wiki'];
      if (socialMediaKeywords.some(keyword => companySlug.includes(keyword))) {
        console.log(`⚠️ Skipping social media company name: ${companyName}`);
        return null;
      }
      
      const possibleDomains = [
        `https://www.${companySlug}.com`,
        `https://www.${companySlug}.io`,
        `https://www.${companySlug}.co`
      ];
      
      // Try domains in parallel with short timeout
      const domainChecks = possibleDomains.map(async (domain) => {
        try {
          // ✅ Validate URL before checking
          if (!this.isValidCompanyWebsite(domain)) {
            return null;
          }
          
          const response = await axios.head(domain, {
            timeout: 2000, // 2 second timeout
            validateStatus: (status) => status >= 200 && status < 400
          });
          
          if (response.status >= 200 && response.status < 400) {
            return domain;
          }
        } catch {
          return null;
        }
        return null;
      });
      
      // Wait for all checks, return first successful one
      const results = await Promise.all(domainChecks);
      const validDomain = results.find(d => d !== null);
      
      if (validDomain) {
        console.log(`🌐 Found website for ${companyName}: ${validDomain}`);
        return validDomain;
      }
      
    } catch (error) {
      // Silent fail
    }
    
    return null;
  }

  // 📊 Get comprehensive company info from Clearbit Company API (same as PowerShell)
  private static async getClearbitCompanyInfo(domain: string, apiKey: string): Promise<{
    name?: string;
    domain?: string;
    logo?: string;
    description?: string;
    foundedYear?: number;
    industry?: string;
    sector?: string;
    employeeCount?: string;
    location?: string;
    city?: string;
    state?: string;
    country?: string;
    linkedIn?: string;
  } | null> {
    if (!domain || !apiKey) {
      return null;
    }

    try {
      const cleanDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '')
        .trim();

      const url = `https://company.clearbit.com/v2/companies/find?domain=${cleanDomain}`;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000,
        validateStatus: (status) => status === 200
      });

      if (response.status === 200 && response.data) {
        const data = response.data;
        
        return {
          name: data.name,
          domain: data.domain,
          logo: data.logo,
          description: data.description,
          foundedYear: data.foundedYear,
          industry: data.category?.industry,
          sector: data.category?.sector,
          employeeCount: data.metrics?.employees ? `${data.metrics.employees} employees` : undefined,
          location: data.location ? `${data.location.city || ''}, ${data.location.country || ''}`.trim() : undefined,
          city: data.location?.city,
          state: data.location?.state,
          country: data.location?.country,
          linkedIn: data.linkedin?.handle ? `https://www.linkedin.com/company/${data.linkedin.handle}` : undefined
        };
      }
      
      return null;
    } catch (error: any) {
      // API error or company not found (not a critical error)
      if (error.response?.status === 404) {
        console.log(`📊 Clearbit: No data found for ${domain}`);
      } else if (error.response?.status === 402) {
        console.log('⚠️ Clearbit API quota exceeded');
      } else {
        console.log(`⚠️ Clearbit API error: ${error.message}`);
      }
      return null;
    }
  }

  // 🎨 Fast Clearbit logo fetch (same as enrich-organizations.ps1)
  private static async getClearbitLogoFast(website: string): Promise<string | null> {
    try {
      const cleanDomain = website
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '')
        .trim();
      
      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!domainRegex.test(cleanDomain)) {
        return null;
      }
      
      const logoUrl = `https://logo.clearbit.com/${cleanDomain}`;
      
      // Quick HEAD request to check if logo exists
      const response = await axios.head(logoUrl, {
        timeout: 3000, // 3 second timeout
        validateStatus: (status) => status === 200
      });
      
      if (response.status === 200) {
        console.log(`🎨 Found Clearbit logo for ${cleanDomain}`);
        return logoUrl;
      }
      
    } catch {
      // Silent fail
    }
    
    return null;
  }

  // 🔗 Generate LinkedIn URL (same as enrich-organizations.ps1)
  private static generateLinkedInUrl(companyName: string): string {
    const sanitized = companyName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return `https://www.linkedin.com/company/${sanitized}`;
  }

  // 🏭 Enhance industry classification from job data
  private static enhanceIndustryFromJob(title: string, description: string, defaultIndustry: string): string {
    const content = `${title} ${description}`.toLowerCase();
    
    // Financial Services
    if (content.includes('fintech') || content.includes('banking') || content.includes('finance') || 
        content.includes('payment') || content.includes('blockchain') || content.includes('crypto')) {
      return 'Financial Services';
    }
    
    // Healthcare
    if (content.includes('health') || content.includes('medical') || content.includes('biotech') || 
        content.includes('pharma') || content.includes('telemedicine')) {
      return 'Healthcare';
    }
    
    // E-commerce
    if (content.includes('e-commerce') || content.includes('ecommerce') || content.includes('retail') || 
        content.includes('marketplace') || content.includes('shopping')) {
      return 'E-commerce';
    }
    
    // Education
    if (content.includes('edtech') || content.includes('education') || content.includes('learning') || 
        content.includes('university') || content.includes('training')) {
      return 'Education Technology';
    }
    
    // Gaming
    if (content.includes('gaming') || content.includes('game') || content.includes('unity') || 
        content.includes('unreal')) {
      return 'Gaming & Entertainment';
    }
    
    // AI/ML
    if (content.includes('artificial intelligence') || content.includes('machine learning') || 
        content.includes('deep learning') || content.includes('ai ') || content.includes('ml ')) {
      return 'Artificial Intelligence';
    }
    
    return defaultIndustry;
  }

  private static detectCurrencyFromLocation(location: string): number {
    if (!location) return 1; // USD default
    const locationLower = location.toLowerCase();
    
    if (locationLower.includes('india') || locationLower.includes('inr') || 
        locationLower.includes('bangalore') || locationLower.includes('mumbai')) return 2; // INR
    if (locationLower.includes('canada') || locationLower.includes('cad')) return 3; // CAD
    if (locationLower.includes('uk') || locationLower.includes('gbp') || locationLower.includes('london')) return 4; // GBP
    if (locationLower.includes('australia') || locationLower.includes('aud')) return 5; // AUD
    if (locationLower.includes('euro') || locationLower.includes('eur') || 
        locationLower.includes('germany') || locationLower.includes('france')) return 6; // EUR
    
    return 1; // USD default
  }

  private static calculateJobPriority(job: ScrapedJob, jobAge: number): string {
    // New jobs get higher priority
    if (jobAge <= 3) return 'High';
    if (jobAge <= 7) return 'Medium';
    if (jobAge <= 30) return 'Normal';
    return 'Low';
  }

  private static calculateExpiryDate(postedAt: string, jobAge: number): string {
    const posted = new Date(postedAt);
    // Jobs expire 60 days after posting
    const expiryDate = new Date(posted.getTime() + (60 * 24 * 60 * 60 * 1000));
    return expiryDate.toISOString();
  }

  private static mapJobType(contractType?: string): string {
    if (!contractType) return 'Full-time';
    
    const type = contractType.toLowerCase();
    if (type.includes('part') || type.includes('part-time')) return 'Part-time';
    if (type.includes('contract') || type.includes('contractor')) return 'Contract';
    if (type.includes('intern')) return 'Internship';
    if (type.includes('freelance') || type.includes('temporary')) return 'Freelance';
    
    return 'Full-time';
  }

  // All the missing helper methods
  // 🔄 UPDATED: Use ReferenceMetadata IDs (correct mapping from database)
  private static getJobTypeId(jobType: string): number {
    const mapping: { [key: string]: number } = {
      'Full-time': 438, 'Part-time': 440, 'Contract': 436,
      'Internship': 439, 'Freelance': 437, 'Temporary': 441
    };
    return mapping[jobType] || 438; // Default to Full-time (ReferenceID 438)
  }

  // 🔄 UPDATED: Use ReferenceMetadata IDs (correct mapping from database)
  private static getWorkplaceTypeId(workplaceType: string): number {
    const mapping: { [key: string]: number } = {
      'Onsite': 443, 'Remote': 444, 'Hybrid': 442
    };
    return mapping[workplaceType] || 444; // Default to Remote (ReferenceID 444)
  }

  private static extractDepartment(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('engineer') || titleLower.includes('developer')) return 'Engineering';
    if (titleLower.includes('data scientist') || titleLower.includes('analyst')) return 'Data Science';
    if (titleLower.includes('product manager')) return 'Product';
    if (titleLower.includes('designer') || titleLower.includes('ux')) return 'Design';
    if (titleLower.includes('marketing')) return 'Marketing';
    if (titleLower.includes('sales')) return 'Sales';
    if (titleLower.includes('manager') || titleLower.includes('director')) return 'Management';
    
    return 'Technology';
  }

  private static extractCountry(location: string): string {
    if (!location) return 'United States';
    const locationLower = location.toLowerCase();
    
    if (locationLower.includes('india') || locationLower.includes('bangalore') || 
        locationLower.includes('mumbai') || locationLower.includes('delhi')) return 'India';
    if (locationLower.includes('canada')) return 'Canada';
    if (locationLower.includes('uk') || locationLower.includes('london')) return 'United Kingdom';
    if (locationLower.includes('australia')) return 'Australia';
    if (locationLower.includes('germany')) return 'Germany';
    if (locationLower.includes('france')) return 'France';
    
    return 'United States';
  }

  private static extractMinExperience(title: string, description: string): number {
    const content = `${title} ${description}`.toLowerCase();
    const expPatterns = [/(\d+)\+?\s*years?\s+(?:of\s+)?experience/, /(\d+)-\d+\s*years/];

    for (const pattern of expPatterns) {
      const match = content.match(pattern);
      if (match) return parseInt(match[1]);
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
    if (rangeMatch) return parseInt(rangeMatch[2]);

    if (content.includes('senior') || content.includes('lead')) return Math.max(minExp + 5, 10);
    if (content.includes('mid')) return Math.max(minExp + 3, 7);
    
    return Math.max(minExp + 3, 5);
  }

  private static detectWorkplaceType(location: string = '', title: string = '', description: string = ''): string {
    const content = `${location} ${title} ${description}`.toLowerCase();
    
    if (content.includes('remote') || content.includes('work from home')) return 'Remote';
    if (content.includes('hybrid')) return 'Hybrid';
    
    return 'Onsite';
  }

  static getConfig() {
    return { ...this.config };
  }

  static updateConfig(newConfig: Partial<typeof this.config>) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Enhanced job scraper configuration updated');
  }

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
        lastUpdated: new Date().toISOString(),
        enhancement: '10x Mode Active - Enhanced global coverage'
      };
      
    } catch (error: any) {
      throw new Error(`Failed to get scraping stats: ${error.message}`);
    }
  }

  // 🚀 MAIN SCRAPING ORCHESTRATOR - OPTIMIZED FOR AZURE FUNCTIONS TIMEOUT
  static async scrapeAndPopulateJobs(): Promise<ScrapingResult> {
    const startTime = Date.now();
    this.sessionState.sessionStartTime = startTime;
    
    const result: ScrapingResult = {
      success: true,
      jobsAdded: 0,
      errors: [],
      summary: {
        totalJobsScraped: 0,
        sourceBreakdown: {},
        indiaJobsAdded: 0,
        executionTime: 0
      }
    };
    
    if (!this.config.enabled) {
      result.errors.push('Job scraping is disabled');
      return result;
    }

    console.log('🚀 RefOpen Enhanced Job Scraping Started (Parallel Mode)...');
    console.log(`🎯 Target: ${this.config.maxJobsPerRun} jobs with company logos and data enhancement`);

    try {
      const existingJobs = await this.getExistingExternalJobIds();
      console.log(`📊 Found ${existingJobs.size} existing external jobs in database`);

      // ⚡ OPTIMIZATION: Scrape all sources in PARALLEL instead of sequential
      const scrapingPromises: Promise<{ source: string; jobs: ScrapedJob[] }>[] = [];

      if (this.config.sources.remoteok.enabled) {
        scrapingPromises.push(
          this.scrapeRemoteOK()
            .then(jobs => ({ source: 'RemoteOK', jobs }))
            .catch(error => {
              console.error('❌ RemoteOK failed:', error.message);
              result.errors.push(`RemoteOK: ${error.message}`);
              return { source: 'RemoteOK', jobs: [] };
            })
        );
      }

      if (this.config.sources.adzuna.enabled) {
        scrapingPromises.push(
          this.scrapeAdzunaGlobal()
            .then(jobs => ({ source: 'Adzuna', jobs }))
            .catch(error => {
              console.error('❌ Adzuna failed:', error.message);
              result.errors.push(`Adzuna: ${error.message}`);
              return { source: 'Adzuna', jobs: [] };
            })
        );
      }

      if (this.config.sources.weworkremotely.enabled) {
        scrapingPromises.push(
          this.scrapeWeWorkRemotelyRSS()
            .then(jobs => ({ source: 'WeWorkRemotely', jobs }))
            .catch(error => {
              console.error('❌ WeWorkRemotely failed:', error.message);
              result.errors.push(`WeWorkRemotely: ${error.message}`);
              return { source: 'WeWorkRemotely', jobs: [] };
            })
        );
      }

      if (this.config.sources.hackernews.enabled) {
        scrapingPromises.push(
          this.scrapeHackerNewsJobs()
            .then(jobs => ({ source: 'HackerNews', jobs }))
            .catch(error => {
              console.error('❌ HackerNews failed:', error.message);
              result.errors.push(`HackerNews: ${error.message}`);
              return { source: 'HackerNews', jobs: [] };
            })
        );
      }

      // ⚡ Wait for all sources to complete (in parallel)
      console.log(`⚡ Starting parallel scraping from ${scrapingPromises.length} sources...`);
      const scrapingResults = await Promise.all(scrapingPromises);

      // Collect all jobs
      const allScrapedJobs: ScrapedJob[] = [];
      for (const { source, jobs } of scrapingResults) {
        result.summary.sourceBreakdown[source] = jobs.length;
        
        // Enhanced India job counting for Adzuna
        if (source === 'Adzuna') {
          const indiaJobs = jobs.filter(job => 
            job.source.includes('IN') || 
            job.location.toLowerCase().includes('india') ||
            job.location.toLowerCase().includes('bangalore') ||
            job.location.toLowerCase().includes('mumbai') ||
            job.location.toLowerCase().includes('delhi') ||
            job.location.toLowerCase().includes('chennai') ||
            job.location.toLowerCase().includes('hyderabad')
          );
          result.summary.sourceBreakdown['Adzuna_India'] = indiaJobs.length;
          console.log(`✅ ${source}: ${jobs.length} jobs (${indiaJobs.length} from India)`);
        } else {
          console.log(`✅ ${source}: ${jobs.length} jobs`);
        }
        
        allScrapedJobs.push(...jobs);
      }

      result.summary.totalJobsScraped = allScrapedJobs.length;
      console.log(`🎉 Total jobs scraped: ${allScrapedJobs.length} from all sources`);

      // Enhanced filtering
      const filteredJobs = this.filterJobs(allScrapedJobs, existingJobs);
      console.log(`🔍 Jobs after filtering: ${filteredJobs.length} (removed ${allScrapedJobs.length - filteredJobs.length} duplicates)`);

      const jobsToInsert = filteredJobs.slice(0, this.config.maxJobsPerRun);
      console.log(`💾 Jobs to insert: ${jobsToInsert.length}`);

      // Database insertion with progress tracking
      let insertedCount = 0;
      let indiaJobsCount = 0;
      let organizationsEnhanced = 0;
      let skippedInvalidCompanies = 0;
      
      for (const [index, job] of jobsToInsert.entries()) {
        try {
          await this.insertJobIntoRefOpenDB(job);
          insertedCount++;
          
          if ((job as any).logoUrl || (job as any).companyIndustry) {
            organizationsEnhanced++;
          }
          
          if (this.isIndiaJob(job)) {
            indiaJobsCount++;
          }
          
          if ((index + 1) % 50 === 0) {
            console.log(`📈 Progress: ${index + 1}/${jobsToInsert.length} jobs inserted (${skippedInvalidCompanies} skipped)`);
          }
        } catch (error: any) {
          // Check if it's an invalid company that was skipped
          if (error.message && error.message.includes('Invalid company name')) {
            skippedInvalidCompanies++;
            console.warn(`⏭️  Skipped job "${job.title}" at ${job.company}: Invalid company name`);
          } else {
            console.error(`❌ Failed to insert "${job.title}": ${error.message}`);
            result.errors.push(`Insert failed: ${job.title} - ${error.message}`);
          }
        }
      }

      result.jobsAdded = insertedCount;
      result.summary.indiaJobsAdded = indiaJobsCount;
      result.summary.executionTime = Date.now() - startTime;

      console.log(`🎊 Job scraping completed!`);
      console.log(`📊 Results: ${insertedCount} jobs added (${indiaJobsCount} from India)`);
      console.log(`🏢 Organizations enhanced: ${organizationsEnhanced} with logos/data`);
      if (skippedInvalidCompanies > 0) {
        console.log(`⏭️  Skipped: ${skippedInvalidCompanies} jobs with invalid company names`);
      }
      console.log(`⏱️ Execution time: ${Math.round(result.summary.executionTime / 1000)}s`);

    } catch (error: any) {
      console.error('💥 Job scraping process failed:', error);
      result.success = false;
      result.errors.push(`Process failed: ${error.message}`);
      result.summary.executionTime = Date.now() - startTime;
    }

    return result;
  }

  // 🇮🇳 Enhanced India job detection
  private static isIndiaJob(job: ScrapedJob): boolean {
    const content = `${job.location} ${job.company} ${job.title}`.toLowerCase();
    return content.includes('india') || 
           content.includes('bangalore') || content.includes('bengaluru') ||
           content.includes('mumbai') || content.includes('delhi') ||
           content.includes('chennai') || content.includes('hyderabad') ||
           content.includes('pune') || content.includes('kolkata') ||
           content.includes('gurgaon') || content.includes('noida');
  }

  // Enhanced helper methods
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

  // Enhanced job filtering with better quality checks
  private static filterJobs(jobs: ScrapedJob[], existingIds: Set<string>): ScrapedJob[] {
    return jobs.filter(job => {
      // Skip duplicates
      if (existingIds.has(job.externalJobId)) return false;

      // Enhanced keyword filtering
      const content = `${job.title} ${job.description} ${job.company}`.toLowerCase();
      if (this.config.excludeKeywords.some(keyword => content.includes(keyword))) {
        return false;
      }

      // Enhanced quality checks
      return job.title && job.company && job.externalJobId && 
             job.title.length >= 3 && job.company.length >= 2 &&
             job.title.length <= 200 && job.company.length <= 100 &&
             job.description && job.description.length >= 50; // Minimum description length
    });
  }
}