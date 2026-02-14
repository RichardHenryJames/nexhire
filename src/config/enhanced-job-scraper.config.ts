/**
 * Enhanced Job Scraper Configuration - 10x Mode
 * Centralized settings for the enhanced job scraping system
 */

export interface EnhancedScraperConfig {
  enabled: boolean;
  maxJobsPerRun: number;
  sources: {
    [key: string]: {
      enabled: boolean;
      maxJobs?: number;
      maxJobsPerConfig?: number;
      maxTotalJobs?: number;
      maxJobsPerCategory?: number;
      rateLimit: number;
      priority?: 'high' | 'medium' | 'low';
    };
  };
  searchTerms: string[];
  globalLocations: Array<{
    country: string;
    region: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  excludeKeywords: string[];
  excludeCompanies: string[];
  humanBehavior: {
    minDelay: number;
    maxDelay: number;
    fatigueEnabled: boolean;
    sessionRotation: boolean;
  };
}

export const ENHANCED_SCRAPER_CONFIG: EnhancedScraperConfig = {
  enabled: true,
  maxJobsPerRun: 1000, // ?? 10x increase from 150

  sources: {
    remoteok: {
      enabled: true,
      maxJobs: 200, // ?? 4x increase from 50
      rateLimit: 2000,
      priority: 'high'
    },
    adzuna: {
      enabled: true,
      maxJobsPerConfig: 50, // ?? 6x increase from 8 (API maximum)
      maxTotalJobs: 400, // ?? Total limit across all countries
      rateLimit: 3000,
      priority: 'high'
    },
    weworkremotely: {
      enabled: true,
      maxJobsPerCategory: 25, // ?? 3x increase from 8
      rateLimit: 1500,
      priority: 'medium'
    },
    hackernews: {
      enabled: true,
      maxJobs: 30, // ?? 2x increase from 15
      rateLimit: 1000,
      priority: 'medium'
    },
    // ?? Future expansion ready
    indeed: {
      enabled: false, // Enable when API integration ready
      maxJobs: 100,
      rateLimit: 5000,
      priority: 'high'
    },
    glassdoor: {
      enabled: false, // Enable when scraping ready
      maxJobs: 50,
      rateLimit: 4000,
      priority: 'low'
    }
  },

  // ?? MASSIVELY EXPANDED SEARCH TERMS (25+ vs 2 before)
  searchTerms: [
    // Core Technical Roles
    'software engineer', 'developer', 'programmer', 'full stack developer',
    'frontend developer', 'backend developer', 'web developer', 'mobile developer',
    'devops engineer', 'cloud engineer', 'system administrator', 'database administrator',
    
    // Data & AI Roles
    'data scientist', 'data engineer', 'machine learning engineer', 'ai engineer',
    'data analyst', 'business intelligence', 'analytics engineer',
    
    // Security & Infrastructure
    'cybersecurity specialist', 'security engineer', 'network engineer', 
    'infrastructure engineer', 'platform engineer', 'site reliability engineer',
    
    // Quality & Testing
    'qa engineer', 'test engineer', 'automation engineer', 'quality assurance',
    
    // Business & Management
    'product manager', 'project manager', 'business analyst', 'product owner',
    'scrum master', 'technical program manager', 'engineering manager',
    
    // Sales & Marketing
    'account manager', 'sales manager', 'marketing manager', 'sales engineer',
    'customer success manager', 'business development', 'digital marketer',
    
    // Operations & Support
    'operations manager', 'finance manager', 'hr manager', 'technical support',
    'customer support', 'operations analyst',
    
    // Design & Creative
    'ux designer', 'ui designer', 'graphic designer', 'product designer',
    'web designer', 'visual designer',
    
    // Content & Communication
    'content writer', 'technical writer', 'copywriter', 'content marketing',
    'communications specialist',
    
    // Emerging & Specialized Roles
    'blockchain developer', 'cloud architect', 'solutions architect', 
    'kubernetes engineer', 'terraform engineer', 'react developer', 'node developer'
  ],

  // ?? GLOBAL COVERAGE (9 countries vs 6 before)
  globalLocations: [
    // High Priority Markets
    { country: 'us', region: 'nationwide', priority: 'high' },
    { country: 'in', region: 'nationwide', priority: 'high' }, // India focus maintained
    
    // Medium Priority Markets  
    { country: 'ca', region: 'nationwide', priority: 'medium' },
    { country: 'gb', region: 'nationwide', priority: 'medium' },
    { country: 'au', region: 'nationwide', priority: 'medium' },
    { country: 'sg', region: 'nationwide', priority: 'medium' }, // Singapore tech hub
    
    // Lower Priority Markets (still valuable)
    { country: 'de', region: 'nationwide', priority: 'low' },
    { country: 'fr', region: 'nationwide', priority: 'low' },
    { country: 'nl', region: 'nationwide', priority: 'low' }, // Netherlands tech scene
  ],

  // Enhanced filtering
  excludeKeywords: [
    'adult entertainment', 'gambling', 'crypto scam', 'mlm', 'pyramid scheme',
    'get rich quick', 'work from home scam', 'investment scheme', 'binary options'
  ],

  // Company blacklist - exclude jobs from these companies
  excludeCompanies: [
    'Turing'
  ],

  // ?? Human-like behavior settings
  humanBehavior: {
    minDelay: 1500, // Minimum delay between requests
    maxDelay: 6000, // Maximum delay between requests
    fatigueEnabled: true, // Gradually increase delays (human fatigue)
    sessionRotation: true // Rotate user agents and headers
  }
};

// ?? Expected Performance Metrics (10x Improvement)
export const PERFORMANCE_EXPECTATIONS = {
  previousVersion: {
    maxJobsPerRun: 150,
    sources: 4,
    searchTerms: 2,
    countries: 6,
    avgJobsPerRun: 120
  },
  enhancedVersion: {
    maxJobsPerRun: 1000,
    sources: 4, // Same sources but enhanced
    searchTerms: 50, // 50+ search terms
    countries: 9,
    avgJobsPerRun: 800, // Expected average
    improvementFactor: '6.7x more jobs per run'
  }
};

// ?? Source-specific optimization settings
export const SOURCE_OPTIMIZATIONS = {
  remoteok: {
    description: 'Process all available jobs instead of arbitrary 50 limit',
    improvement: '4x more jobs (50 ? 200)'
  },
  adzuna: {
    description: 'Country-wide searches with 50 results per API call',
    improvement: '8x more jobs (48 ? 400 across 9 countries)'
  },
  weworkremotely: {
    description: 'Expanded to 6 categories with 25 jobs each',
    improvement: '6x more jobs (24 ? 150 across categories)'
  },
  hackernews: {
    description: 'Process more startup job postings from YC ecosystem',
    improvement: '2x more jobs (15 ? 30)'
  }
};

export default ENHANCED_SCRAPER_CONFIG;