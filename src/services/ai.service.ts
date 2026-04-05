/**
 * Common AI Service Layer
 * 
 * Single entry point for all AI calls across the app.
 * Groq primary, Gemini fallback. Each caller passes their own API keys.
 * 
 * Usage:
 *   const result = await AIService.call({
 *     prompt: 'Analyze this...',
 *     groqApiKey: process.env.GROQ_RESUME_API_KEY || '',
 *     geminiApiKey: process.env.GEMINI_RESUME_API_KEY || '',
 *     options: { temperature: 0.3, maxTokens: 8192, jsonMode: true }
 *   });
 */

// ── Types ──────────────────────────────────────────────────────

export interface AICallOptions {
  /** Temperature (0-1). Lower = more deterministic. Default 0.3 */
  temperature?: number;
  /** Max output tokens. Default 4096 */
  maxTokens?: number;
  /** Force JSON output (Groq response_format + Gemini responseMimeType). Default false */
  jsonMode?: boolean;
  /** System message prepended to the conversation. Optional */
  systemMessage?: string;
  /** Timeout in milliseconds. Default 60000 (60s) */
  timeoutMs?: number;
  /** Groq model. Default 'openai/gpt-oss-120b' */
  groqModel?: string;
  /** Gemini model. Default 'gemini-2.5-flash' */
  geminiModel?: string;
  /** Provider order. Default ['groq', 'gemini'] */
  providerOrder?: ('groq' | 'gemini')[];
}

export interface AICallRequest {
  /** The user prompt */
  prompt: string;
  /** Groq API key for this caller */
  groqApiKey: string;
  /** Gemini API key for this caller */
  geminiApiKey: string;
  /** Options */
  options?: AICallOptions;
}

export interface AICallResult {
  /** The AI response text */
  text: string;
  /** Which provider was used */
  provider: 'groq' | 'gemini';
  /** Which model was used */
  model: string;
  /** Time taken in ms */
  elapsedMs: number;
}

// ── Constants ──────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const DEFAULT_OPTIONS: Required<AICallOptions> = {
  temperature: 0.3,
  maxTokens: 4096,
  jsonMode: false,
  systemMessage: '',
  timeoutMs: 60000,
  groqModel: 'openai/gpt-oss-120b',
  geminiModel: 'gemini-2.5-flash',
  providerOrder: ['groq', 'gemini'],
};

// ── Service ────────────────────────────────────────────────────

export class AIService {

  /**
   * Call AI with automatic failover between providers.
   * Each caller provides their own API keys (separate quotas).
   */
  static async call(request: AICallRequest): Promise<AICallResult> {
    const opts = { ...DEFAULT_OPTIONS, ...request.options };
    const startTime = Date.now();

    const providers = opts.providerOrder;
    let lastError = '';

    for (const provider of providers) {
      try {
        let text: string | null = null;
        let model = '';

        if (provider === 'groq' && request.groqApiKey) {
          const result = await this.callGroq(request.prompt, request.groqApiKey, opts);
          text = result.text;
          model = result.model;
        } else if (provider === 'gemini' && request.geminiApiKey) {
          const result = await this.callGemini(request.prompt, request.geminiApiKey, opts);
          text = result.text;
          model = result.model;
        } else {
          continue; // No key for this provider, skip
        }

        if (text) {
          return {
            text,
            provider,
            model,
            elapsedMs: Date.now() - startTime,
          };
        }
      } catch (err: any) {
        lastError = err.message || 'Unknown error';
        // Rate limit (429) → try next provider
        if (err.message?.includes('429') || err.message?.includes('rate limit')) {
          console.log(`${provider} rate limited, trying next provider...`);
          continue;
        }
        // Other errors → also try next provider
        console.error(`${provider} failed: ${err.message}`);
        continue;
      }
    }

    throw new Error(`AI service is temporarily busy. Please try again in a few minutes. (${lastError})`);
  }

  // ── Groq ─────────────────────────────────────────────────

  private static async callGroq(
    prompt: string,
    apiKey: string,
    opts: Required<AICallOptions>
  ): Promise<{ text: string | null; model: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const messages: any[] = [];
      if (opts.systemMessage) {
        messages.push({ role: 'system', content: opts.systemMessage });
      }
      messages.push({ role: 'user', content: prompt });

      const body: any = {
        model: opts.groqModel,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      };
      if (opts.jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Groq ${response.status}: ${errText.substring(0, 200)}`);
      }

      const data: any = await response.json();
      const text = data?.choices?.[0]?.message?.content || null;
      return { text, model: opts.groqModel };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Gemini ───────────────────────────────────────────────

  private static async callGemini(
    prompt: string,
    apiKey: string,
    opts: Required<AICallOptions>
  ): Promise<{ text: string | null; model: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const url = `${GEMINI_API_BASE}/${opts.geminiModel}:generateContent?key=${apiKey}`;

      const generationConfig: any = {
        temperature: opts.temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: opts.maxTokens,
      };
      if (opts.jsonMode) {
        generationConfig.responseMimeType = 'application/json';
      }

      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      };

      // Gemini doesn't have a system message in the same way,
      // but we can prepend it to the prompt if needed
      if (opts.systemMessage) {
        body.contents[0].parts[0].text = `${opts.systemMessage}\n\n${prompt}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Gemini ${response.status}: ${errText.substring(0, 200)}`);
      }

      const data: any = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      return { text, model: opts.geminiModel };
    } finally {
      clearTimeout(timeout);
    }
  }
}
