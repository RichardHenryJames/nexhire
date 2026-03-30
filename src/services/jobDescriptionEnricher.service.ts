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
import { AIService } from './ai.service';

// ── AI Keys (shared keys for job enrichment) ──────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

/** Enrichment config */
const ENRICHMENT_CONFIG = {
  /** Max jobs to enrich per run — 150 × 12 runs/day = 1,800/day (within Groq's 14,400 RPD free tier) */
  maxJobsPerRun: 150,
  /** Max concurrent AI calls (2 to stay within 30 RPM free tier limit) */
  concurrency: 2,
  /** Delay between batches (ms) — 2.5s keeps us well under 30 RPM */
  batchDelayMs: 2500,
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
        j.Tags,
        j.ExternalJobID
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

      // Determine if the existing description is already high-quality (from direct career scraper)
      // Direct-scraped jobs have real descriptions from Workday/Greenhouse — don't overwrite those
      const existingDescLength = (job.Description || '').length;
      const hasGoodDescription = existingDescLength >= 500; // 500+ chars = real ATS description
      const isDirectJob = (job as any).ExternalJobID?.startsWith('direct_');

      // Build dynamic SET clause — only update fields that AI returned
      // DON'T overwrite PublishedAt — it destroys the real posted date
      const setClauses: string[] = ['AIEnriched = 1', 'UpdatedAt = SYSDATETIMEOFFSET()'];
      const params: any[] = [];
      let paramIdx = 0;

      // Only overwrite Description if the existing one is thin (< 500 chars)
      // Direct-scraped jobs with full Workday/Greenhouse descriptions should keep theirs
      if (!hasGoodDescription) {
        setClauses.push(`Description = @param${paramIdx}`);
        params.push(enriched.description);
        paramIdx++;
      } else if (isDirectJob) {
        console.log(`📋 Keeping original description for direct job "${job.Title}" (${existingDescLength} chars)`);
      }

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

    // Call AI via common layer (Groq primary for enrichment - higher free tier)
    const aiResult = await AIService.call({
      prompt,
      groqApiKey: GROQ_API_KEY,
      geminiApiKey: GEMINI_API_KEY,
      options: {
        temperature: 0.4,
        maxTokens: 2048,
        timeoutMs: 30000,
        providerOrder: ['groq', 'gemini'],
      },
    });

    const rawText = aiResult.text;
    if (!rawText || rawText.length < 200) {
      throw new Error('AI returned insufficient content');
    }

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
- IMPORTANT: Do NOT include any labels like "SECTION 1", "SECTION 2", "DESCRIPTION:", "RESPONSIBILITIES:", "BENEFITS:", "TAGS:" in your output. Just write the content directly.

OUTPUT FORMAT — Return EXACTLY these 4 sections separated by the delimiter "---SECTION---":

First section (the main job description as PARAGRAPHS, 1500-2500 chars):
Write 2-3 sentences about the company, then 2-3 sentences about the role, then a paragraph about requirements.
This MUST be flowing paragraph text, NOT bullet points. Write it like a professional job posting on LinkedIn.
Use "• " bullets ONLY for the requirements list at the end.

---SECTION---

Second section (responsibilities as a newline-separated list, 6-10 items):
Each responsibility on its own line, starting with an action verb. No bullets, no numbers, just plain text lines.

---SECTION---

Third section (benefits as a newline-separated list, 4-8 items):
Each benefit on its own line. Plain text, no bullets, no labels.
${isWellKnown ? 'Include company-specific benefits if you know them.' : 'Keep generic: Competitive salary, Health insurance, Learning & development, Flexible work arrangements, etc.'}

---SECTION---

Fourth section (comma-separated skills/technologies, 5-12 items):
Just the skills separated by commas. Example: Python, AWS, Microservices, REST APIs, SQL, Docker

Return ONLY the content for each section separated by ---SECTION---. No labels, no headers, no "Section 1" text.`;
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

    // Aggressively strip ALL section labels that AI might include
    const stripSectionLabels = (text: string): string => {
      return text
        // Remove "SECTION X — LABEL:" or "SECTION X - LABEL" or "SECTION X: LABEL"
        .replace(/^SECTION\s*\d+\s*[—–\-:]+\s*[A-Z ]+[:\s]*/gim, '')
        // Remove standalone labels like "DESCRIPTION:", "RESPONSIBILITIES:", "BENEFITS:", "TAGS:"
        .replace(/^(DESCRIPTION|RESPONSIBILITIES|KEY RESPONSIBILITIES|BENEFITS|BENEFITS OFFERED|TAGS|SKILLS|SKILLS & TECHNOLOGIES)[:\s]*/gim, '')
        // Remove "First section", "Second section" etc.
        .replace(/^(First|Second|Third|Fourth)\s+section[:\s]*/gim, '')
        .trim();
    };

    // Section 1 — Description (always present)
    if (sections[0]) {
      result.description = stripSectionLabels(sections[0]);
    }

    // Section 2 — Responsibilities
    if (sections[1]) {
      const respText = stripSectionLabels(sections[1]);
      result.responsibilities = respText
        .split('\n')
        .map(line => line.replace(/^[\u2022\-*]\s+/, '').replace(/^\d{1,2}[.):]\s+/, '').trim())
        .filter(line => line.length > 10)
        .join('\n');
    }

    // Section 3 — Benefits
    if (sections[2]) {
      const benText = stripSectionLabels(sections[2]);
      result.benefits = benText
        .split('\n')
        .map(line => line.replace(/^[\u2022\-*]\s+/, '').replace(/^\d{1,2}[.):]\s+/, '').trim())
        .filter(line => line.length > 5)
        .join('\n');
    }

    // Section 4 — Tags
    if (sections[3]) {
      const tagsText = stripSectionLabels(sections[3]);
      result.tags = tagsText
        .split(/[,\n]/)
        .map(t => t.replace(/^[\u2022\-*]\s+/, '').replace(/^\d{1,2}[.):]\s+/, '').trim())
        .filter(t => t.length > 1 && t.length < 50)
        .slice(0, 12)
        .join(', ');
    }

    // Fallback: if sections didn't parse, put everything in description
    if (!result.description && cleaned.length >= 200) {
      result.description = stripSectionLabels(cleaned);
    }

    return result;
  }

  /**
   * Call Gemini 2.5 Flash API
   */
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
