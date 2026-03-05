/**
 * AI-Powered Job Description Enrichment Service
 * 
 * Runs as a non-blocking post-processing step after job scraping.
 * Takes scraped job context (title, company, department, location, raw description)
 * and generates a professional, detailed JD using AI.
 * 
 * AI Strategy: Gemini 2.5 Flash (primary) → Groq Llama 3.3 70B (fallback)
 */

import { dbService } from './database.service';

/** Gemini API config */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/** Groq API config (fallback) */
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Enrichment config */
const ENRICHMENT_CONFIG = {
  /** Max jobs to enrich per scraper run (to avoid API cost spikes) */
  maxJobsPerRun: 50,
  /** Max concurrent AI calls */
  concurrency: 3,
  /** Delay between batches (ms) to respect rate limits */
  batchDelayMs: 1000,
  /** Max retries per job */
  maxRetries: 1,
};

interface JobToEnrich {
  JobID: string;
  Title: string;
  OrgName: string;
  Department: string;
  Location: string;
  Description: string;
  Responsibilities: string | null;
  WorkplaceType: string;
  ExperienceMin: number | null;
  ExperienceMax: number | null;
  Tags: string | null;
}

interface EnrichmentResult {
  totalProcessed: number;
  totalEnriched: number;
  totalFailed: number;
  errors: string[];
  executionTimeMs: number;
}

export class JobDescriptionEnricherService {

  /**
   * Main entry point: enrich all non-enriched jobs.
   * Called as a non-blocking step after scraping completes.
   * Also picks up any AIEnriched=0 jobs from previous failed runs.
   */
  static async enrichPendingJobs(): Promise<EnrichmentResult> {
    const startTime = Date.now();
    const result: EnrichmentResult = {
      totalProcessed: 0,
      totalEnriched: 0,
      totalFailed: 0,
      errors: [],
      executionTimeMs: 0,
    };

    // Check if AI keys are available
    if (!GEMINI_API_KEY && !GROQ_API_KEY) {
      console.log('⚠️  AI enrichment skipped: No GEMINI_API_KEY or GROQ_API_KEY configured');
      return result;
    }

    try {
      // Fetch jobs that need enrichment (AIEnriched = 0)
      // Order by PublishedAt DESC so newest jobs get enriched first
      const jobs = await this.fetchJobsToEnrich();

      if (jobs.length === 0) {
        console.log('✅ AI enrichment: No pending jobs to enrich');
        return result;
      }

      console.log(`🤖 AI enrichment: ${jobs.length} jobs to process (max ${ENRICHMENT_CONFIG.maxJobsPerRun} per run)`);

      // Process in batches of `concurrency` to respect rate limits
      for (let i = 0; i < jobs.length; i += ENRICHMENT_CONFIG.concurrency) {
        const batch = jobs.slice(i, i + ENRICHMENT_CONFIG.concurrency);
        
        const batchPromises = batch.map(job => this.enrichSingleJob(job));
        const batchResults = await Promise.allSettled(batchPromises);

        for (const [idx, settledResult] of batchResults.entries()) {
          result.totalProcessed++;
          const job = batch[idx];

          if (settledResult.status === 'fulfilled' && settledResult.value) {
            result.totalEnriched++;
          } else {
            result.totalFailed++;
            const errorMsg = settledResult.status === 'rejected' 
              ? settledResult.reason?.message || 'Unknown error'
              : 'Empty result';
            result.errors.push(`${job.Title} @ ${job.OrgName}: ${errorMsg}`);
            
            // Only log first 5 errors to avoid console spam
            if (result.totalFailed <= 5) {
              console.warn(`⚠️  AI enrichment failed for "${job.Title}": ${errorMsg}`);
            }
          }
        }

        // Rate limit delay between batches
        if (i + ENRICHMENT_CONFIG.concurrency < jobs.length) {
          await this.sleep(ENRICHMENT_CONFIG.batchDelayMs);
        }

        // Progress logging every 10 jobs
        if (result.totalProcessed % 10 === 0) {
          console.log(`🤖 AI enrichment progress: ${result.totalProcessed}/${jobs.length} (${result.totalEnriched} enriched, ${result.totalFailed} failed)`);
        }
      }

    } catch (error: any) {
      console.error('❌ AI enrichment process error:', error.message);
      result.errors.push(`Process error: ${error.message}`);
    }

    result.executionTimeMs = Date.now() - startTime;
    console.log(`🤖 AI enrichment complete: ${result.totalEnriched}/${result.totalProcessed} enriched in ${Math.round(result.executionTimeMs / 1000)}s (${result.totalFailed} failed)`);

    return result;
  }

  /**
   * Fetch jobs that need AI enrichment from the database.
   * Gets newest first, limited to maxJobsPerRun.
   */
  private static async fetchJobsToEnrich(): Promise<JobToEnrich[]> {
    const query = `
      SELECT TOP (@param0)
        CAST(j.JobID AS NVARCHAR(36)) AS JobID,
        j.Title,
        o.Name AS OrgName,
        j.Department,
        j.Location,
        CAST(j.Description AS NVARCHAR(MAX)) AS Description,
        CAST(j.Responsibilities AS NVARCHAR(MAX)) AS Responsibilities,
        rm_wt.Value AS WorkplaceType,
        j.ExperienceMin,
        j.ExperienceMax,
        j.Tags
      FROM Jobs j
      JOIN Organizations o ON j.OrganizationID = o.OrganizationID
      LEFT JOIN ReferenceMetadata rm_wt ON j.WorkplaceTypeID = rm_wt.ReferenceID
      WHERE j.Status = 'Published'
        AND j.AIEnriched = 0
      ORDER BY j.PublishedAt DESC
    `;

    const result = await dbService.executeQuery(query, [ENRICHMENT_CONFIG.maxJobsPerRun]);
    return result.recordset || [];
  }

  /**
   * Enrich a single job's description using AI.
   * Returns true if successful, false otherwise.
   */
  private static async enrichSingleJob(job: JobToEnrich): Promise<boolean> {
    try {
      const enrichedDescription = await this.generateEnrichedDescription(job);

      if (!enrichedDescription || enrichedDescription.length < 200) {
        // AI returned something too short — skip but mark as attempted
        console.warn(`⚠️  AI returned short description for "${job.Title}" (${enrichedDescription?.length || 0} chars), skipping`);
        return false;
      }

      // Update the job in DB
      await dbService.executeQuery(
        `UPDATE Jobs 
         SET Description = @param0, 
             AIEnriched = 1, 
             UpdatedAt = SYSDATETIMEOFFSET() 
         WHERE JobID = @param1`,
        [enrichedDescription, job.JobID]
      );

      return true;
    } catch (error: any) {
      // Don't mark AIEnriched=1 on failure — it'll be retried next run
      throw error;
    }
  }

  /**
   * Generate an enriched job description using AI.
   * Uses Gemini as primary, Groq as fallback.
   */
  private static async generateEnrichedDescription(job: JobToEnrich): Promise<string> {
    const prompt = this.buildPrompt(job);

    // Try Gemini first
    if (GEMINI_API_KEY) {
      try {
        const result = await this.callGemini(prompt);
        if (result && result.length >= 200) return result;
      } catch (error: any) {
        // Rate limited (429) or other error — fall through to Groq
        if (error.message?.includes('429') || error.message?.includes('rate')) {
          console.log('🔄 Gemini rate limited, falling back to Groq');
        } else {
          console.warn(`⚠️  Gemini error: ${error.message}, trying Groq fallback`);
        }
      }
    }

    // Fallback to Groq
    if (GROQ_API_KEY) {
      try {
        const result = await this.callGroq(prompt);
        if (result && result.length >= 200) return result;
      } catch (error: any) {
        throw new Error(`Both AI providers failed. Groq: ${error.message}`);
      }
    }

    throw new Error('No AI provider available or both returned empty results');
  }

  /**
   * Build the prompt for AI to generate a professional JD.
   * Uses all available context from the scraped job.
   */
  private static buildPrompt(job: JobToEnrich): string {
    const contextParts: string[] = [];
    contextParts.push(`Job Title: ${job.Title}`);
    contextParts.push(`Company: ${job.OrgName}`);
    if (job.Department) contextParts.push(`Department: ${job.Department}`);
    if (job.Location) contextParts.push(`Location: ${job.Location}`);
    if (job.WorkplaceType) contextParts.push(`Workplace Type: ${job.WorkplaceType}`);
    if (job.ExperienceMin != null || job.ExperienceMax != null) {
      contextParts.push(`Experience: ${job.ExperienceMin ?? 0}-${job.ExperienceMax ?? 'N/A'} years`);
    }
    if (job.Tags) contextParts.push(`Tags/Skills: ${job.Tags}`);

    // Include existing description as context (may be truncated/garbage from scraping)
    const existingDesc = job.Description ? job.Description.substring(0, 800) : '';
    if (existingDesc) {
      contextParts.push(`\nExisting scraped description (may be truncated/incomplete - use as context only):\n${existingDesc}`);
    }

    if (job.Responsibilities) {
      contextParts.push(`\nExisting responsibilities:\n${job.Responsibilities.substring(0, 500)}`);
    }

    return `You are an expert HR content writer. Write a professional, detailed job description for the following position. Use the provided context to create an accurate and compelling JD.

CONTEXT:
${contextParts.join('\n')}

INSTRUCTIONS:
1. Write a 2-3 sentence company intro (use your knowledge of the company if it's well-known, otherwise keep it brief and professional)
2. Write a 2-3 sentence role summary explaining what the position involves
3. Write 6-10 "Key Responsibilities" as bullet points starting with action verbs
4. Write 5-8 "Requirements" as bullet points covering experience, skills, education
5. Make the JD specific to the role and company — NOT generic
6. Use the existing scraped description as context to understand the role, but rewrite it properly
7. Total length should be 1500-2500 characters
8. Do NOT include any markdown formatting (no **, no ##, no bullets with *)
9. Use bullet points as "• " (bullet character + space)
10. Return ONLY the job description text, nothing else — no labels like "Job Description:" at the top

OUTPUT FORMAT:
[Company intro paragraph]

[Role summary paragraph]

Key Responsibilities:
• [responsibility 1]
• [responsibility 2]
...

Requirements:
• [requirement 1]
• [requirement 2]
...`;
  }

  /**
   * Call Gemini 2.5 Flash API
   */
  private static async callGemini(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) throw new Error('429 rate limited');
      throw new Error(`Gemini API error: ${status}`);
    }

    const data: any = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');

    return this.cleanAIOutput(text);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Call Groq API (Llama 3.3 70B)
   */
  private static async callGroq(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 2048,
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty Groq response');

    return this.cleanAIOutput(text);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Clean AI output: remove markdown formatting, code blocks, extra whitespace
   */
  private static cleanAIOutput(text: string): string {
    let cleaned = text.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```(?:text|markdown)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');

    // Remove markdown bold/italic
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
    cleaned = cleaned.replace(/__(.*?)__/g, '$1');

    // Remove markdown headers
    cleaned = cleaned.replace(/^#{1,3}\s+/gm, '');

    // Convert markdown bullets to bullet character
    cleaned = cleaned.replace(/^[-*]\s+/gm, '• ');

    // Remove "Job Description:" prefix if AI added it
    cleaned = cleaned.replace(/^(Job Description|Description|JD):\s*/i, '');

    // Normalize whitespace (no more than 2 consecutive newlines)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
