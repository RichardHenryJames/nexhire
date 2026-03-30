/**
 * LinkedIn Profile Optimizer Service
 * 
 * Analyzes LinkedIn profiles via:
 * 1. Quick mode: User pastes headline + about + role text
 * 2. Full audit: User uploads LinkedIn "Save to PDF" export
 * 
 * Uses Gemini 2.5 Flash (primary) with Groq Llama 3.3 70B fallback.
 */

import { dbService } from './database.service';

// ── AI API Config ──────────────────────────────────────────────
// Uses dedicated LinkedIn API keys (separate quota from resume analyzer and scraper)
const GEMINI_API_KEY = process.env.GEMINI_LINKEDIN_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const GROQ_API_KEY = process.env.GROQ_LINKEDIN_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ── Interfaces ─────────────────────────────────────────────────

export interface LinkedInOptimizeRequest {
  // Quick mode fields (user pastes)
  headline?: string;
  about?: string;
  currentRole?: string;
  currentCompany?: string;
  skills?: string;
  targetRole?: string;

  // Full audit mode (PDF upload)
  pdfBuffer?: Buffer;
  fileName?: string;

  // Common
  userId: string;
  mode: 'quick' | 'full';
}

export interface SectionAnalysis {
  score: number;           // 0-100
  currentText: string;     // What user has now
  optimizedText: string;   // AI-generated improved version
  issues: string[];        // What's wrong
  tips: string[];          // Specific actionable tips
}

export interface LinkedInOptimizeResult {
  overallScore: number;    // 0-100

  headline: SectionAnalysis;
  about: SectionAnalysis;
  experience: SectionAnalysis;
  skills: SectionAnalysis;

  // Extra insights
  keywordGaps: string[];        // Industry keywords they're missing
  searchAppearance: {
    score: number;
    tips: string[];
  };
  recruiterReadiness: {
    score: number;
    tips: string[];
  };
  networkingTips: string[];
  topPriorities: string[];      // Top 3 things to fix right now

  targetRole: string;
  analyzedAt: string;
}

// ── Service ────────────────────────────────────────────────────

export class LinkedInOptimizerService {

  /**
   * Main entry point - analyze and optimize a LinkedIn profile
   */
  static async optimizeProfile(request: LinkedInOptimizeRequest): Promise<LinkedInOptimizeResult> {
    const startTime = Date.now();

    let profileText = '';

    if (request.mode === 'full' && request.pdfBuffer) {
      // Extract text from LinkedIn PDF
      profileText = await this.extractTextFromPDF(request.pdfBuffer);
      if (!profileText || profileText.length < 50) {
        throw new Error('Could not extract enough text from the PDF. Make sure you uploaded your LinkedIn "Save to PDF" export.');
      }
    } else if (request.mode === 'quick') {
      // Build profile text from pasted fields
      profileText = this.buildQuickModeText(request);
      if (profileText.length < 20) {
        throw new Error('Please provide at least your headline or about section to analyze.');
      }
    } else {
      throw new Error('Invalid request. Please provide profile text or upload a LinkedIn PDF.');
    }

    // Build the AI prompt
    const prompt = this.buildPrompt(profileText, request.targetRole || '', request.mode);

    // Call AI (Gemini primary, Groq fallback)
    const aiResult = await this.callAI(prompt);

    // Parse AI response
    const result = this.parseAIResponse(aiResult, request);

    // Attach elapsed for controller to record usage
    (result as any)._elapsedMs = Date.now() - startTime;

    return result;
  }

  /**
   * Extract text from LinkedIn PDF export
   */
  private static async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      // Use pdf-parse for text extraction (same as resume analyzer)
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (err: any) {
      console.error('PDF parse error:', err.message);
      throw new Error('Failed to read the PDF file. Please make sure it is a valid LinkedIn PDF export.');
    }
  }

  /**
   * Build profile text from quick-mode fields
   */
  private static buildQuickModeText(request: LinkedInOptimizeRequest): string {
    const parts: string[] = [];

    if (request.headline) {
      parts.push(`HEADLINE: ${request.headline}`);
    }
    if (request.about) {
      parts.push(`ABOUT/SUMMARY: ${request.about}`);
    }
    if (request.currentRole || request.currentCompany) {
      parts.push(`CURRENT POSITION: ${request.currentRole || 'Not specified'}${request.currentCompany ? ` at ${request.currentCompany}` : ''}`);
    }
    if (request.skills) {
      parts.push(`SKILLS: ${request.skills}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build the AI analysis prompt
   */
  private static buildPrompt(profileText: string, targetRole: string, mode: 'quick' | 'full'): string {
    const targetContext = targetRole
      ? `The user is targeting the role: "${targetRole}". Optimize for this specific role.`
      : 'The user has not specified a target role. Optimize for general professional visibility and their apparent career direction.';

    const modeNote = mode === 'quick'
      ? 'NOTE: The user provided only select sections (headline, about, current role, skills). Analyze what was provided. For missing sections, still provide scores but note the section was not provided.'
      : 'NOTE: This is a full LinkedIn PDF export. Analyze all sections comprehensively.';

    return `You are a top LinkedIn career strategist with 10+ years of experience helping professionals at Google, McKinsey, and Goldman Sachs optimize their profiles. You've helped 5,000+ professionals increase their profile views by 3-10x.

${targetContext}

${modeNote}

ANALYZE THIS LINKEDIN PROFILE AND RETURN OPTIMIZED VERSIONS:

--- START OF PROFILE ---
${profileText}
--- END OF PROFILE ---

RETURN YOUR ANALYSIS AS A VALID JSON OBJECT with this EXACT structure (no markdown, no explanation outside JSON):

{
  "overallScore": <number 0-100>,
  "headline": {
    "score": <number 0-100>,
    "currentText": "<what they currently have>",
    "optimizedText": "<your improved version, max 220 chars, keyword-rich>",
    "issues": ["<issue 1>", "<issue 2>"],
    "tips": ["<specific tip 1>", "<specific tip 2>"]
  },
  "about": {
    "score": <number 0-100>,
    "currentText": "<first 200 chars of what they have, or 'Not provided'>",
    "optimizedText": "<your full improved version, 1500-2000 chars, compelling first-person narrative with keywords>",
    "issues": ["<issue>"],
    "tips": ["<tip>"]
  },
  "experience": {
    "score": <number 0-100>,
    "currentText": "<summary of their experience section>",
    "optimizedText": "<improved version of their most recent role with bullet points, metrics, action verbs>",
    "issues": ["<issue>"],
    "tips": ["<tip>"]
  },
  "skills": {
    "score": <number 0-100>,
    "currentText": "<their current skills list or 'Not provided'>",
    "optimizedText": "<comma-separated list of 15-20 optimized skills, ordered by relevance to target role>",
    "issues": ["<issue>"],
    "tips": ["<tip>"]
  },
  "keywordGaps": ["<industry keyword 1 they're missing>", "<keyword 2>", "<keyword 3>", ... up to 10],
  "searchAppearance": {
    "score": <number 0-100>,
    "tips": ["<how to appear in more recruiter searches>"]
  },
  "recruiterReadiness": {
    "score": <number 0-100>,
    "tips": ["<what recruiters look for that's missing>"]
  },
  "networkingTips": ["<actionable networking tip 1>", "<tip 2>", "<tip 3>"],
  "topPriorities": ["<#1 most impactful thing to fix>", "<#2>", "<#3>"]
}

SCORING GUIDELINES:
- 90-100: Exceptional, top 1% LinkedIn profile
- 70-89: Strong profile, minor tweaks needed
- 50-69: Average, significant room for improvement
- Below 50: Needs major overhaul

OPTIMIZATION RULES:
- Headline: Include target role + key skill + value prop. No generic "Passionate professional"
- About: Hook in first 3 lines (visible before "See more"). Include metrics. End with CTA
- Experience: Start bullets with action verbs. Include numbers/metrics. Show impact, not duties
- Skills: Industry-standard terms that recruiters actually search for. No soft skills like "teamwork"
- Keep the person's authentic voice, just make it more compelling and keyword-rich`;
  }

  /**
   * Call AI - Groq primary, Gemini fallback
   */
  private static async callAI(prompt: string): Promise<string> {
    // Try Groq first (faster, more reliable rate limits)
    if (GROQ_API_KEY) {
      try {
        const groqResponse = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are a LinkedIn profile optimization expert. Always respond with valid JSON only.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
          }),
        });

        if (groqResponse.ok) {
          const groqData: any = await groqResponse.json();
          const text = groqData?.choices?.[0]?.message?.content;
          if (text) return text;
        }

        if (groqResponse.status === 429) {
          console.log('Groq rate limited, falling back to Gemini');
        } else {
          console.error('Groq error:', groqResponse.status);
        }
      } catch (err: any) {
        console.error('Groq call failed:', err.message);
      }
    }

    // Gemini fallback
    if (!GEMINI_API_KEY) {
      throw new Error('AI service is temporarily busy. Please try again in a few minutes.');
    }

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data: any = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;

      throw new Error('Empty response from AI');
    } catch (err: any) {
      console.error('Gemini fallback failed:', err.message);
      throw new Error('AI service is temporarily busy due to high demand. Please try again in a few minutes.');
    }
  }

  /**
   * Parse AI JSON response with safety fallbacks
   */
  private static parseAIResponse(raw: string, request: LinkedInOptimizeRequest): LinkedInOptimizeResult {
    try {
      // Strip markdown fences if present
      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      // Find JSON object
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) {
        throw new Error('No JSON found in AI response');
      }
      cleaned = cleaned.substring(start, end + 1);

      // Remove trailing commas (common AI mistake)
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

      const parsed = JSON.parse(cleaned);

      // Build result with safe defaults
      const defaultSection: SectionAnalysis = {
        score: 0,
        currentText: 'Not provided',
        optimizedText: '',
        issues: [],
        tips: [],
      };

      const safeSection = (s: any): SectionAnalysis => ({
        score: Math.min(100, Math.max(0, Number(s?.score) || 0)),
        currentText: String(s?.currentText || 'Not provided'),
        optimizedText: String(s?.optimizedText || ''),
        issues: Array.isArray(s?.issues) ? s.issues.map(String) : [],
        tips: Array.isArray(s?.tips) ? s.tips.map(String) : [],
      });

      return {
        overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || 50)),
        headline: safeSection(parsed.headline),
        about: safeSection(parsed.about),
        experience: safeSection(parsed.experience),
        skills: safeSection(parsed.skills),
        keywordGaps: Array.isArray(parsed.keywordGaps) ? parsed.keywordGaps.map(String).slice(0, 10) : [],
        searchAppearance: {
          score: Math.min(100, Math.max(0, Number(parsed.searchAppearance?.score) || 50)),
          tips: Array.isArray(parsed.searchAppearance?.tips) ? parsed.searchAppearance.tips.map(String) : [],
        },
        recruiterReadiness: {
          score: Math.min(100, Math.max(0, Number(parsed.recruiterReadiness?.score) || 50)),
          tips: Array.isArray(parsed.recruiterReadiness?.tips) ? parsed.recruiterReadiness.tips.map(String) : [],
        },
        networkingTips: Array.isArray(parsed.networkingTips) ? parsed.networkingTips.map(String).slice(0, 5) : [],
        topPriorities: Array.isArray(parsed.topPriorities) ? parsed.topPriorities.map(String).slice(0, 3) : [],
        targetRole: request.targetRole || '',
        analyzedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('AI response parse error:', err.message);
      console.error('Raw response (first 500 chars):', raw?.substring(0, 500));
      throw new Error('Failed to parse AI analysis. Please try again.');
    }
  }

  /**
   * Record usage for analytics + free-tier tracking
   */
  private static async recordUsage(
    userId: string,
    mode: string,
    score: number,
    elapsedMs: number
  ): Promise<void> {
    try {
      await dbService.executeQuery(
        `INSERT INTO LinkedInOptimizerUsage (UserID, Mode, OverallScore, ElapsedMs, CreatedAt)
         VALUES (@param0, @param1, @param2, @param3, GETUTCDATE())`,
        [userId, mode, score, elapsedMs]
      );
    } catch (err: any) {
      // Non-critical - don't fail the request
      console.error('Failed to record LinkedIn optimizer usage:', err.message);
    }
  }
}
