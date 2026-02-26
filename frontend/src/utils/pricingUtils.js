/**
 * Get tier-based referral cost for a job
 * Reads OrganizationTier from job data and returns the correct price
 * 
 * @param {object} job - Job object (must have OrganizationTier from API)
 * @param {object} pricing - Pricing context values
 * @returns {number} The referral cost for this job's company tier
 */
export function getReferralCostForJob(job, pricing) {
  const tier = job?.OrganizationTier || job?.organizationTier || job?.tier || 'Standard';
  if (tier === 'Elite') return pricing.eliteReferralCost || 199;
  if (tier === 'Premium') return pricing.premiumReferralCost || 99;
  return pricing.referralRequestCost || 49; // Standard
}
