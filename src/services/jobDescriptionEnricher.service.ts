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
  OrgTier: string;
  Department: string;
  Location: string;
  Description: string;
  Responsibilities: string | null;
  WorkplaceType: string;
  ExperienceMin: number | null;
  ExperienceMax: number | null;
  Tags: string | null;
}

interface EnrichedJobData {
  description: string;
  responsibilities: string;
  benefits: string;
  tags: string;
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
        o.Tier AS OrgTier,
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
      const enriched = await this.generateStructuredEnrichment(job);

      if (!enriched || !enriched.description || enriched.description.length < 200) {
        console.warn(`⚠️  AI returned short description for "${job.Title}" (${enriched?.description?.length || 0} chars), skipping`);
        return false;
      }

      // Build dynamic SET clause — only update fields that AI returned
      const setClauses: string[] = ['Description = @param0', 'AIEnriched = 1', 'UpdatedAt = SYSDATETIMEOFFSET()', 'PublishedAt = SYSDATETIMEOFFSET()'];
      const params: any[] = [enriched.description];
      let paramIdx = 1;

      if (enriched.responsibilities && enriched.responsibilities.length > 20) {
        setClauses.push(`Responsibilities = @param${paramIdx}`);
        params.push(enriched.responsibilities);
        paramIdx++;
      }

      if (enriched.benefits && enriched.benefits.length > 20) {
        setClauses.push(`BenefitsOffered = @param${paramIdx}`);
        params.push(enriched.benefits);
        paramIdx++;
      }

      // Only update Tags if the job didn't already have good tags
      if (enriched.tags && enriched.tags.length > 5 && (!job.Tags || job.Tags.split(',').length < 3)) {
        setClauses.push(`Tags = @param${paramIdx}`);
        params.push(enriched.tags);
        paramIdx++;
      }

      params.push(job.JobID);

      await dbService.executeQuery(
        `UPDATE Jobs SET ${setClauses.join(', ')} WHERE JobID = @param${paramIdx}`,
        params
      );

      return true;
    } catch (error: any) {
      // Don't mark AIEnriched=1 on failure — it'll be retried next run
      throw error;
    }
  }

  /**
   * Generate structured enrichment data using AI.
   * Returns separate fields for description, responsibilities, benefits, and tags.
   * Uses Gemini as primary, Groq as fallback.
   */
  private static async generateStructuredEnrichment(job: JobToEnrich): Promise<EnrichedJobData> {
    const prompt = this.buildPrompt(job);

    let rawText = '';

    // Try Gemini first
    if (GEMINI_API_KEY) {
      try {
        const result = await this.callGemini(prompt);
        if (result && result.length >= 200) rawText = result;
      } catch (error: any) {
        if (error.message?.includes('429') || error.message?.includes('rate')) {
          console.log('🔄 Gemini rate limited, falling back to Groq');
        } else {
          console.warn(`⚠️  Gemini error: ${error.message}, trying Groq fallback`);
        }
      }
    }

    // Fallback to Groq
    if (!rawText && GROQ_API_KEY) {
      try {
        const result = await this.callGroq(prompt);
        if (result && result.length >= 200) rawText = result;
      } catch (error: any) {
        throw new Error(`Both AI providers failed. Groq: ${error.message}`);
      }
    }

    if (!rawText) throw new Error('No AI provider available or both returned empty results');

    return this.parseStructuredResponse(rawText);
  }

  /**
   * Build the prompt for AI to generate structured job enrichment data.
   * Returns separate sections so we can populate multiple DB columns.
   * 
   * SMART RULES:
   * - If the company is well-known (Elite tier), use real knowledge about it
   * - If the company is not well-known, keep the company intro generic and brief
   * - NEVER fabricate specific benefits (e.g., "401k match") unless the company is well-known for them
   * - Tags/skills should be realistic for the role — don't add trendy buzzwords that don't fit
   */
  private static buildPrompt(job: JobToEnrich): string {
    const contextParts: string[] = [];
    contextParts.push(`Job Title: ${job.Title}`);
    contextParts.push(`Company: ${job.OrgName}`);
    contextParts.push(`Company Tier: ${job.OrgTier || 'Standard'}`);
    if (job.Department) contextParts.push(`Department: ${job.Department}`);
    if (job.Location) contextParts.push(`Location: ${job.Location}`);
    if (job.WorkplaceType) contextParts.push(`Workplace Type: ${job.WorkplaceType}`);
    if (job.ExperienceMin != null || job.ExperienceMax != null) {
      contextParts.push(`Experience: ${job.ExperienceMin ?? 0}-${job.ExperienceMax ?? 'N/A'} years`);
    }
    if (job.Tags) contextParts.push(`Existing Tags/Skills: ${job.Tags}`);

    const existingDesc = job.Description ? job.Description.substring(0, 800) : '';
    if (existingDesc) {
      contextParts.push(`\nExisting scraped description (may be truncated/incomplete — use as context only):\n${existingDesc}`);
    }

    if (job.Responsibilities) {
      contextParts.push(`\nExisting responsibilities:\n${job.Responsibilities.substring(0, 500)}`);
    }

    const isWellKnown = job.OrgTier === 'Elite' || job.OrgTier === 'Premium';

    return `You are an expert HR content writer. Generate structured job enrichment data for this position.

CONTEXT:
${contextParts.join('\n')}

CRITICAL RULES:
- ${isWellKnown ? 'This is a well-known company. Use your knowledge to write an accurate company intro and realistic benefits.' : 'This company may not be well-known. Keep the company intro brief and generic. Do NOT fabricate specific benefits or perks you are unsure about.'}
- Be ACCURATE — do not invent specific details you are unsure about
- For benefits: ${isWellKnown ? 'Include company-specific benefits if known (e.g., Google\'s free meals, Netflix\'s unlimited PTO)' : 'Use ONLY generic/common benefits like "Competitive salary", "Health insurance", "Professional development opportunities". Do NOT make up specific perks.'}
- For tags/skills: Only include technologies and skills genuinely relevant to this specific role. Do NOT add trendy buzzwords (e.g., don\'t add "AI/ML" to a marketing role)
- Responsibilities should use strong action verbs and be specific to the role

OUTPUT FORMAT — Return EXACTLY these 4 sections separated by "---SECTION---":

SECTION 1 — DESCRIPTION (the main job description, 1500-2500 chars):
A 2-3 sentence company intro, then 2-3 sentence role summary, then "Requirements:" with 5-8 bullet points.
Use "• " for bullets. No markdown. No headers with # or **.

---SECTION---

SECTION 2 — RESPONSIBILITIES (newline-separated list, 6-10 items):
Each responsibility on its own line, starting with an action verb. No bullets, no numbers, just plain text lines.
Example:
Design and implement scalable microservices architecture
Collaborate with cross-functional teams to define product requirements

---SECTION---

SECTION 3 — BENEFITS (newline-separated list, 4-8 items):
Each benefit on its own line. Plain text, no bullets.
${isWellKnown ? 'Include company-specific benefits if you know them.' : 'Keep generic: Competitive salary, Health insurance, Learning & development, Flexible work arrangements, etc.'}

---SECTION---

SECTION 4 — TAGS (comma-separated skills/technologies, 5-12 items):
Relevant technical skills, tools, and domain expertise for this role.
Example: Python, AWS, Microservices, REST APIs, SQL, Docker

Return ONLY the 4 sections. No other text.`;
  }

  /**
   * Parse the structured AI response into separate fields.
   * Falls back gracefully if AI doesn't follow the format perfectly.
   */
  private static parseStructuredResponse(rawText: string): EnrichedJobData {
    const cleaned = this.cleanAIOutput(rawText);
    const sections = cleaned.split(/---SECTION---/i).map(s => s.trim()).filter(s => s.length > 0);

    const result: EnrichedJobData = {
      description: '',
      responsibilities: '',
      benefits: '',
      tags: '',
    };

    // Section 1 — Description (always present)
    if (sections[0]) {
      result.description = sections[0]
        .replace(/^SECTION\s*\d+[^:]*:\s*/i, '') // Remove "SECTION 1 — DESCRIPTION:" prefix
        .replace(/^(Description|DESCRIPTION)[:\s]*/i, '')
        .trim();
    }

    // Section 2 — Responsibilities
    if (sections[1]) {
      const respText = sections[1]
        .replace(/^SECTION\s*\d+[^:]*:\s*/i, '')
        .replace(/^(Responsibilities|RESPONSIBILITIES|Key Responsibilities)[:\s]*/i, '')
        .trim();
      // Convert to newline-separated list (remove bullets/numbers if AI added them)
      result.responsibilities = respText
        .split('\n')
        .map(line => line.replace(/^[•\-*\d.]+\s*/, '').trim())
        .filter(line => line.length > 10)
        .join('\n');
    }

    // Section 3 — Benefits
    if (sections[2]) {
      const benText = sections[2]
        .replace(/^SECTION\s*\d+[^:]*:\s*/i, '')
        .replace(/^(Benefits|BENEFITS|Benefits Offered)[:\s]*/i, '')
        .trim();
      result.benefits = benText
        .split('\n')
        .map(line => line.replace(/^[•\-*\d.]+\s*/, '').trim())
        .filter(line => line.length > 5)
        .join('\n');
    }

    // Section 4 — Tags
    if (sections[3]) {
      const tagsText = sections[3]
        .replace(/^SECTION\s*\d+[^:]*:\s*/i, '')
        .replace(/^(Tags|TAGS|Skills)[:\s]*/i, '')
        .trim();
      // Clean up tags: remove bullets, normalize commas
      result.tags = tagsText
        .split(/[,\n]/)
        .map(t => t.replace(/^[•\-*\d.]+\s*/, '').trim())
        .filter(t => t.length > 1 && t.length < 50)
        .slice(0, 12)
        .join(', ');
    }

    // Fallback: if sections didn't parse, put everything in description
    if (!result.description && cleaned.length >= 200) {
      result.description = cleaned;
    }

    return result;
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
