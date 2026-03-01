/**
 * Blocked Organizations — Marketplace / Job Portal / Staffing Platform Companies
 * 
 * These companies are NOT direct employers. They are:
 * - Job marketplaces (Turing, Toptal, Upwork, etc.)
 * - Job portals/aggregators (Naukri, Indeed, LinkedIn, etc.)
 * - Freelance platforms (Fiverr, Contra, Freelancer, etc.)
 * 
 * Why blocked:
 * 1. Referrals to these companies are meaningless — they don't directly hire
 * 2. "Referrers" from these companies game the system by referring to their
 *    platform (earning affiliate commission) instead of actual jobs
 * 3. Jobs scraped from these companies are just re-listings from other employers
 * 
 * Used by:
 * - Job scraper: skip jobs from these companies
 * - Registration: prevent selecting these as current employer
 * - Organization search: filter out from results
 * 
 * Format: lowercase company names for case-insensitive matching
 * Last updated: 2026-03-01
 */

export const BLOCKED_MARKETPLACE_COMPANIES = [
  // ── Remote job marketplaces ──────────────────────
  'turing',
  'toptal',
  'upwork',
  'fiverr',
  'freelancer',
  'freelance',
  'andela',
  'crossover',
  'deel',
  'contra',
  'lemon.io',
  'a.team',
  'arc.dev',
  'gun.io',
  'x-team',
  'braintrust',
  'hired',
  'triplebyte',
  'vettery',
  'remoteok',
  'working nomads',
  'weworkremotely',
  'flexjobs',
  
  // ── Job portals / aggregators ────────────────────
  'naukri',
  'monster',
  'indeed',
  'glassdoor',
  'linkedin',
  'shine.com',
  'foundit',
  'apna',
  'angellist',
  'wellfound',
  'instahyre',
  'cutshort',
  'hirect',
  'bigshyft',
  'hirist',
  'iimjobs',
  'talent.com',
  'ziprecruiter',
  'careerbuilder',
  'simplyhired',
  'dice',
  'ladders',
  'snagajob',
];

/**
 * Check if a company name matches a blocked marketplace
 * @param {string} companyName - Company name to check
 * @returns {boolean} true if blocked
 */
export function isBlockedMarketplace(companyName: string | null | undefined): boolean {
  if (!companyName) return false;
  const lower = companyName.trim().toLowerCase();
  return BLOCKED_MARKETPLACE_COMPANIES.some(blocked => 
    lower === blocked || lower.includes(blocked)
  );
}
