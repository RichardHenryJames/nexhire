/**
 * AI-Powered Job Recommendations Service
 * Now uses backend AI filters API for consistency
 */

import refopenAPI from './api';

class AIJobRecommendationsService {
  /**
   * Fetch AI-recommended jobs using backend AI filters
   * FREE - No wallet deduction (uses /jobs/ai-filters endpoint)
   */
  async getPersonalizedJobs(userId, pageSize = 5) {
    
    try {
      // Get AI filters from backend (FREE - no wallet deduction)
      const filtersResult = await refopenAPI.apiCall('/jobs/ai-filters');
      
      if (!filtersResult.success || !filtersResult.data) {
        console.warn('🤖 AI: Failed to get filters from backend, using defaults');
        return { success: false, jobs: [], error: 'Failed to generate AI filters' };
      }
      
      const filters = filtersResult.data;
      
      // Fetch jobs with AI-generated filters
      const result = await refopenAPI.getJobs(1, pageSize, filters);
      
      if (result.success && result.data) {
        return {
          success: true,
          jobs: result.data,
          filters: filters // Return filters for debugging
        };
      }
      
      return { success: false, jobs: [], filters: filters };
      
    } catch (error) {
      console.error('🤖 AI: Error fetching personalized jobs:', error);
      return { success: false, jobs: [], error: error.message };
    }
  }

  /**
   * Get explanation of why jobs were recommended
   */
  getRecommendationReason(profile, filters) {
    const reasons = [];
    
    if (filters.experienceMin !== undefined) {
      reasons.push(`${filters.experienceMin}-${filters.experienceMax} years experience match`);
    }
    
    if (filters.location) {
      reasons.push(`Located in ${filters.location}`);
    }
    
    if (filters.search) {
      const skills = filters.search.split(' ').slice(0, 3).join(', ');
      reasons.push(`Skills: ${skills}`);
    }
    
    return reasons.length > 0 
      ? `AI matched based on: ${reasons.join(' • ')}` 
      : 'AI-powered personalized recommendation';
  }
}

// Export singleton instance
const aiJobRecommendations = new AIJobRecommendationsService();
export default aiJobRecommendations;
