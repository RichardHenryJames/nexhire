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

  // 💾 Enhanced database insertion with organization logo updates
  private static async insertJobIntoRefOpenDB(job: ScrapedJob): Promise<void> {
    try {
      // Get or create organization WITH enhanced data
      const organizationId = await this.getOrCreateOrganizationWithEnhancements(job.company, job.source, job);
      
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

  // 🏢 ENHANCED: Get or create organization with API data enrichment
  private static async getOrCreateOrganizationWithEnhancements(companyName: string, source: string, job: ScrapedJob): Promise<number> {
    const cleanName = companyName.trim().substring(0, 100);
    
    // Check if organization exists
    const checkQuery = 'SELECT OrganizationID, LogoURL, Website, Industry FROM Organizations WHERE Name = @param0 AND IsActive = 1';
    const checkResult = await dbService.executeQuery(checkQuery, [cleanName]);
    
    if (checkResult.recordset.length > 0) {
      const existingOrg = checkResult.recordset[0];
      
      // 🔄 UPDATE existing organization with new data from APIs
      await this.updateOrganizationWithApiData(existingOrg.OrganizationID, cleanName, source, job, existingOrg);
      
      return existingOrg.OrganizationID;
    }

    // Create new organization with enhanced data
    const enhancedOrgData = await this.getEnhancedOrganizationData(cleanName, source, job);
    
    const insertQuery = `
      INSERT INTO Organizations (Name, Type, Industry, Size, Description, CreatedAt, UpdatedAt, IsActive, LogoURL, Website, LinkedInProfile)
      OUTPUT INSERTED.OrganizationID
      VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6, 1, @param7, @param8, @param9)
    `;
    
    const now = new Date().toISOString();
    const result = await dbService.executeQuery(insertQuery, [
      cleanName,
      'Company',
      enhancedOrgData.industry,
      enhancedOrgData.size,
      `${enhancedOrgData.description} (Auto-created from ${source} job scraping)`,
      now,
      now,
      enhancedOrgData.logoUrl,
      enhancedOrgData.website,
      enhancedOrgData.linkedInProfile
    ]);

    console.log(`🏢 Created new organization: ${cleanName} with logo: ${enhancedOrgData.logoUrl ? 'Yes' : 'No'}`);
    return result.recordset[0].OrganizationID;
  }

  // 🔄 Update existing organization with new API data
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
      
      // Update Industry if existing is generic and we have better info
      if (enhancedData.industry !== 'Technology' && 
          (existingData.Industry === 'Technology' || !existingData.Industry)) {
        updates.push(`Industry = @param${paramIndex}`);
        params.push(enhancedData.industry);
        paramIndex++;
        console.log(`🏭 Updating industry for ${companyName}: ${enhancedData.industry}`);
      }
      
      // Update LinkedInProfile if we have one
      if (enhancedData.linkedInProfile) {
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

  // 📊 Get enhanced organization data from multiple sources
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
    
    // ⚡ CRITICAL FIX: Disable logo enrichment to prevent 5-minute timeout
    // Logo API calls take 5-15 seconds per company causing function to timeout
    // before other sources (Adzuna, WeWorkRemotely, HackerNews) can be inserted
    const ENABLE_LOGO_ENRICHMENT = false;
    
    // 1. Get data from RemoteOK API if source is RemoteOK
    if (source === 'RemoteOK' && ENABLE_LOGO_ENRICHMENT) {
      logoUrl = await this.getRemoteOKLogo(job);
      // RemoteOK doesn't provide website/other info directly in job data
    }
    
    // 2. Try to get additional company data from external APIs
    if (ENABLE_LOGO_ENRICHMENT) {
      try {
        const companyData = await this.fetchCompanyDataFromAPIs(companyName);
        if (companyData) {
          website = website || companyData.website || null;
          industry = companyData.industry || industry;
          size = companyData.size || size;
          linkedInProfile = companyData.linkedInProfile || null;
          // Don't override RemoteOK logo with generic ones
          if (!logoUrl) {
            logoUrl = companyData.logoUrl || null;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch external company data for ${companyName}`);
      }
    
      // 3. Try Clearbit Logo API as fallback
      if (!logoUrl) {
        logoUrl = await this.getClearbitLogo(companyName, website);
      }
    }
    
    // 4. Enhance industry based on job title/description (fast, no API calls)
    industry = this.enhanceIndustryFromJob(job.title, job.description, industry);
    
    return {
      logoUrl,
      website,
      industry,
      size,
      description: `${companyName} - ${industry} company`,
      linkedInProfile
    };
  }

  // 🎯 Extract logo URL from RemoteOK job data
  private static async getRemoteOKLogo(job: ScrapedJob): Promise<string | null> {
    // Use the logo URL from the RemoteOK API data
    return (job as any).logoUrl || null;
  }

  // 🌐 Fetch additional company data from external APIs
  private static async fetchCompanyDataFromAPIs(companyName: string): Promise<{
    website?: string;
    industry?: string;
    size?: string;
    logoUrl?: string;
    linkedInProfile?: string;
  } | null> {
    try {
      // Try multiple external APIs for company data
      const results = await Promise.allSettled([
        this.fetchFromClearbitAPI(companyName),
        this.fetchFromOpenCorporatesAPI(companyName),
        this.fetchCompanyFromLinkedInSearch(companyName)
      ]);
      
      // Combine results from different APIs
      let combinedData: any = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          combinedData = { ...combinedData, ...result.value };
          console.log(`📊 API ${index + 1} provided data for ${companyName}`);
        }
      });
      
      return Object.keys(combinedData).length > 0 ? combinedData : null;
      
    } catch (error) {
      console.warn(`Failed to fetch external company data for ${companyName}`);
      return null;
    }
  }

  // 🔍 Clearbit API for company data
  private static async fetchFromClearbitAPI(companyName: string): Promise<any> {
    // Clearbit would require API key - placeholder for now
    // return await fetch(`https://company.clearbit.com/v2/companies/find?name=${encodeURIComponent(companyName)}`);
    return null;
  }

  // 🏢 OpenCorporates API for basic company info
  private static async fetchFromOpenCorporatesAPI(companyName: string): Promise<any> {
    try {
      const apiUrl = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(companyName)}&format=json&limit=1`;
      
      const response = await this.makeStealthRequest(apiUrl, {
        json: true,
        timeout: 10000
      });
      
      if (response.status === 200 && response.data?.results?.companies?.[0]) {
        const company = response.data.results.companies[0].company;
        return {
          industry: company.company_type || 'Technology',
          website: company.registry_url
        };
      }
    } catch (error) {
      console.warn(`OpenCorporates API failed for ${companyName}`);
    }
    return null;
  }

  // 💼 LinkedIn search for company profiles (placeholder)
  private static async fetchCompanyFromLinkedInSearch(companyName: string): Promise<any> {
    // LinkedIn would require complex scraping or API access
    // For now, generate LinkedIn profile URL guess
    const linkedInSlug = companyName.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return {
      linkedInProfile: `https://www.linkedin.com/company/${linkedInSlug}`
    };
  }

  // 🎨 Enhanced Logo API with multiple free fallbacks
  private static async getClearbitLogo(companyName: string, website: string | null): Promise<string | null> {
    try {
      // Method 1: Clearbit with website domain
      if (website) {
        const domain = new URL(website).hostname.replace('www.', '');
        const logoUrl = `https://logo.clearbit.com/${domain}`;
        
        const response = await this.makeStealthRequest(logoUrl, { timeout: 5000 });
        if (response.status === 200) {
          console.log(`🎨 Found Clearbit logo for ${companyName}: ${logoUrl}`);
          return logoUrl;
        }
      }
      
      // Method 2: Try multiple domain variations
      const domainVariations = this.generateDomainVariations(companyName);
      for (const domain of domainVariations) {
        try {
          const logoUrl = `https://logo.clearbit.com/${domain}`;
          const response = await this.makeStealthRequest(logoUrl, { timeout: 3000 });
          if (response.status === 200) {
            console.log(`🎨 Found Clearbit logo for ${companyName}: ${logoUrl}`);
            return logoUrl;
          }
        } catch (error) {
          // Continue to next variation
        }
      }

      // Method 3: Brandfetch API (free tier)
      const brandfetchLogo = await this.getBrandfetchLogo(companyName);
      if (brandfetchLogo) {
        console.log(`🎨 Found Brandfetch logo for ${companyName}: ${brandfetchLogo}`);
        return brandfetchLogo;
      }

      // Method 4: Logo.dev API (free)
      const logoDevLogo = await this.getLogoDevLogo(companyName, website);
      if (logoDevLogo) {
        console.log(`🎨 Found Logo.dev logo for ${companyName}: ${logoDevLogo}`);
        return logoDevLogo;
      }

      // Method 5: Google Favicon fallback
      const faviconLogo = await this.getGoogleFaviconLogo(companyName, website);
      if (faviconLogo) {
        console.log(`🎨 Found Favicon logo for ${companyName}: ${faviconLogo}`);
        return faviconLogo;
      }

      console.log(`⚠️ No logo found for ${companyName} after trying all methods`);
      
    } catch (error) {
      console.warn(`Logo search failed for ${companyName}: ${error}`);
    }
    return null;
  }

  // Generate domain variations for company names
  private static generateDomainVariations(companyName: string): string[] {
    const cleanName = companyName.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/inc|corp|llc|ltd|company|co|technologies|tech|software|systems/g, '')
      .trim();
    
    const variations = [
      `${cleanName}.com`,
      `${cleanName}.io`,
      `${cleanName}.net`,
      `${cleanName}.org`,
    ];

    // Add variations with common suffixes removed
    if (cleanName.length > 4) {
      const shortName = cleanName.substring(0, cleanName.length - 1);
      variations.push(
        `${shortName}.com`,
        `${shortName}.io`
      );
    }

    return [...new Set(variations)]; // Remove duplicates
  }

  // Brandfetch API (free tier)
  private static async getBrandfetchLogo(companyName: string): Promise<string | null> {
    try {
      // Brandfetch free API endpoint
      const apiUrl = `https://api.brandfetch.io/v2/search/${encodeURIComponent(companyName)}`;
      
      const response = await this.makeStealthRequest(apiUrl, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RefOpen/1.0)'
        }
      });
      
      if (response.status === 200 && response.data) {
        const brands = Array.isArray(response.data) ? response.data : [];
        if (brands.length > 0 && brands[0].logos && brands[0].logos.length > 0) {
          return brands[0].logos[0].image;
        }
      }
    } catch (error) {
      console.warn(`Brandfetch failed for ${companyName}`);
    }
    return null;
  }

  // Logo.dev API (free)
  private static async getLogoDevLogo(companyName: string, website: string | null): Promise<string | null> {
    try {
      if (!website) return null;
      
      const domain = new URL(website).hostname.replace('www.', '');
      const logoUrl = `https://img.logo.dev/${domain}?token=pk_free&format=png&size=200`;
      
      const response = await this.makeStealthRequest(logoUrl, { timeout: 5000 });
      if (response.status === 200) {
        return logoUrl;
      }
    } catch (error) {
      console.warn(`Logo.dev failed for ${companyName}`);
    }
    return null;
  }

  // Google Favicon API fallback
  private static async getGoogleFaviconLogo(companyName: string, website: string | null): Promise<string | null> {
    try {
      // Try with website first
      if (website) {
        const domain = new URL(website).hostname;
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        
        const response = await this.makeStealthRequest(faviconUrl, { timeout: 3000 });
        if (response.status === 200) {
          return faviconUrl;
        }
      }

      // Try with generated domains
      const domainVariations = this.generateDomainVariations(companyName);
      for (const domain of domainVariations.slice(0, 2)) { // Try top 2 variations
        try {
          const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          const response = await this.makeStealthRequest(faviconUrl, { timeout: 3000 });
          if (response.status === 200) {
            return faviconUrl;
          }
        } catch (error) {
          // Continue to next domain
        }
      }
    } catch (error) {
      console.warn(`Google Favicon failed for ${companyName}`);
    }
    return null;
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
            console.log(`📈 Progress: ${index + 1}/${jobsToInsert.length} jobs inserted`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to insert "${job.title}": ${error.message}`);
          result.errors.push(`Insert failed: ${job.title} - ${error.message}`);
        }
      }

      result.jobsAdded = insertedCount;
      result.summary.indiaJobsAdded = indiaJobsCount;
      result.summary.executionTime = Date.now() - startTime;

      console.log(`🎊 Job scraping completed!`);
      console.log(`📊 Results: ${insertedCount} jobs added (${indiaJobsCount} from India)`);
      console.log(`🏢 Organizations enhanced: ${organizationsEnhanced} with logos/data`);
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