/**
 * Resume Analyzer Service
 * 
 * Analyzes resumes against job descriptions using Google Gemini AI.
 * 
 * Features:
 * - PDF text extraction using pdf-parse
 * - Personal data extraction (name, email, phone, LinkedIn, etc.)
 * - Resume anonymization for privacy before AI analysis
 * - Job description fetching from URLs via Jina AI Reader
 * - Job fetching from RefOpen database by jobId
 * - AI-powered resume analysis with match scoring
 * - Stores resume metadata for analytics
 * 
 * @module ResumeAnalyzerService
 * @author RefOpen Team
 * @since 2026-01-29
 */

import { dbService } from './database.service';

const pdfParse = require('pdf-parse');

/** Gemini API key from environment */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/** Gemini API endpoint - using Gemini 2.5 Flash for best price-performance */
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/** Groq API key from environment (fallback when Gemini rate limited) */
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

/** Groq API endpoint - using Llama 3.3 70B */
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Jina AI Reader URL for extracting content from web pages */
const JINA_READER_URL = 'https://r.jina.ai/';

/** Jina AI API key for higher rate limits (500 RPM vs 20 RPM) */
const JINA_API_KEY = process.env.JINA_API_KEY || '';

/**
 * Request parameters for resume analysis
 */
export interface ResumeAnalysisRequest {
  /** PDF file buffer (optional if resumeId provided with cached text) */
  resumeBuffer?: Buffer;
  /** Original filename (used for smart name extraction) */
  fileName?: string;
  /** File size in bytes */
  fileSize?: number;
  /** User ID if authenticated (null for anonymous users) */
  userId?: string;
  /** ResumeID from ApplicantResumes table (to look up cached parsed text) */
  resumeId?: string;
  /** RefOpen job ID to analyze against */
  jobId?: string;
  /** External job URL to fetch and analyze against */
  jobUrl?: string;
  /** Raw job description text */
  jobDescription?: string;
}

/**
 * Extracted personal information from resume
 */
export interface ExtractedPersonalData {
  fullName: string | null;
  email: string | null;
  mobile: string | null;
  linkedIn: string | null;
  github: string | null;
  portfolio: string | null;
  dateOfBirth: string | null;
  address: string | null;
  skills: string | null;
}

/**
 * Resume analysis result returned to client
 */
export interface ResumeAnalysisResult {
  matchScore: number;
  missingKeywords: string[];
  tips: string[];
  strengths: string[];
  overallAssessment: string;
  aiModel?: string;
  jobTitle?: string;
  companyName?: string;
  resumeMetadataId?: string;
  extractedData?: ExtractedPersonalData;
}

export class ResumeAnalyzerService {
  
  /**
   * Analyze a resume against a job description using AI.
   * 
   * Process:
   * 1. Extract text from PDF
   * 2. Extract personal data (name, email, phone, etc.)
   * 3. Anonymize resume for privacy
   * 4. Fetch job description (from DB, URL, or direct input)
   * 5. Send to Gemini AI for analysis
   * 6. Save metadata to database
   * 
   * @param request - Resume analysis request parameters
   * @returns Analysis result with match score, tips, and extracted data
   */
  static async analyzeResume(request: ResumeAnalysisRequest): Promise<ResumeAnalysisResult> {
    let resumeText = '';
    let usedCache = false;

    // Step 1: Try to get cached parsed text from ApplicantResumes (if resumeId provided)
    if (request.resumeId) {
      try {
        const cachedText = await this.getCachedResumeText(request.resumeId);
        if (cachedText) {
          resumeText = cachedText;
          usedCache = true;
          console.log(`[ResumeAnalyzer] Using cached parsed text from ApplicantResumes (${resumeText.length} chars)`);
        }
      } catch (cacheErr: any) {
        console.warn('[ResumeAnalyzer] Cache lookup failed, will parse PDF:', cacheErr?.message);
      }
    }

    // Step 1b: If no cache hit, extract text from PDF buffer
    if (!resumeText) {
      if (!request.resumeBuffer) {
        throw new Error('Resume file is required when no cached text is available.');
      }
      resumeText = await this.extractPdfText(request.resumeBuffer);

      // Backfill: Store parsed text in ApplicantResumes for future use
      if (request.resumeId && resumeText) {
        this.backfillParsedText(request.resumeId, resumeText).catch(err =>
          console.warn('[ResumeAnalyzer] Backfill failed (non-blocking):', err?.message)
        );
      }
    }
    
    // Step 2: Always re-extract personal data (fast ~50ms, and regex patterns may improve)
    const extractedData = this.extractPersonalData(resumeText, request.fileName);
    
    // Step 3: Anonymize resume (remove PII before sending to AI)
    const anonymizedResume = this.anonymizeText(resumeText);
    
    // Step 4: Get job description from one of the sources
    let jobDescription = '';
    let jobTitle = '';
    let companyName = '';
    
    if (request.jobId) {
      const jobData = await this.getJobById(request.jobId);
      jobDescription = jobData.description;
      jobTitle = jobData.title;
      companyName = jobData.company;
    } else if (request.jobUrl) {
      const urlContent = await this.fetchJobFromUrl(request.jobUrl);
      jobDescription = urlContent.content;
      jobTitle = urlContent.title || 'External Job';
    } else if (request.jobDescription) {
      jobDescription = request.jobDescription;
    } else {
      throw new Error('Please provide either a job ID, job URL, or job description');
    }
    
    // Step 5: Save resume metadata FIRST (before AI call - so we capture even if AI fails)
    let resumeMetadataId: string | undefined;
    try {
      resumeMetadataId = await this.saveResumeMetadata({
        userId: request.userId,
        fileName: request.fileName,
        fileSize: request.fileSize,
        extractedData,
        parsedText: resumeText,
        jobUrl: request.jobUrl,
        jobId: request.jobId,
        matchScore: 0, // Will be updated after AI analysis
        aiModel: undefined // Will be updated after AI analysis
      });
    } catch (dbError) {
      console.error('[ResumeAnalyzer] Failed to save metadata:', dbError);
    }
    
    // Step 6: Analyze with AI (Gemini with Groq fallback)
    let analysis: ResumeAnalysisResult;
    try {
      analysis = await this.analyzeWithAI(anonymizedResume, jobDescription, jobTitle);
      console.log(`[ResumeAnalyzer] AI: ${analysis.aiModel} | Score: ${analysis.matchScore}%`);
      
      // Update metadata with AI results
      if (resumeMetadataId) {
        try {
          await this.updateResumeMetadataScore(resumeMetadataId, analysis.matchScore, analysis.aiModel);
        } catch (updateError) {
          console.error('[ResumeAnalyzer] Failed to update AI score:', updateError);
        }
      }
    } catch (aiError: any) {
      console.error('[ResumeAnalyzer] AI analysis failed:', aiError.message);
      // Re-throw the error so user sees the message
      throw aiError;
    }
    
    return {
      ...analysis,
      jobTitle,
      companyName,
      resumeMetadataId,
      extractedData
    };
  }
  
  /**
   * Extract text from PDF buffer using pdf-parse v1.x
   */
  private static async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      const text = data.text || '';
      if (!text.trim()) {
        throw new Error('No text content found in PDF');
      }
      return text;
    } catch (error: any) {
      console.error('PDF parsing error:', error);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }
  
  /**
   * Anonymize resume text by removing PII
   * - Removes email addresses
   * - Removes phone numbers
   * - Removes common name patterns at the beginning
   */
  private static anonymizeText(text: string): string {
    let anonymized = text;
    
    // Remove email addresses
    anonymized = anonymized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    
    // Remove phone numbers (various formats)
    // US format: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx
    anonymized = anonymized.replace(/(\+1[-.\ s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');
    // Indian format: +91 xxxxx xxxxx, +91-xxxxx-xxxxx, +91- xxxxx xxxxx
    anonymized = anonymized.replace(/(\+91[-.\s]*)?\d{5}[-.\s]*\d{5}/g, '[PHONE]');
    // Generic international format
    anonymized = anonymized.replace(/\+\d{1,3}[-.\s]*\d{4,14}/g, '[PHONE]');
    
    // Remove LinkedIn URLs
    anonymized = anonymized.replace(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/gi, '[LINKEDIN]');
    
    // Remove GitHub URLs
    anonymized = anonymized.replace(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+\/?/gi, '[GITHUB]');
    
    // Remove full addresses (basic pattern)
    anonymized = anonymized.replace(/\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\.?\s*,?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(-\d{4})?/gi, '[ADDRESS]');
    
    return anonymized;
  }
  
  /**
   * Extract personal data from resume text
   * @param text - The extracted resume text
   * @param fileName - Original filename (optional, used for smart name extraction)
   */
  private static extractPersonalData(text: string, fileName?: string): ExtractedPersonalData {
    const result: ExtractedPersonalData = {
      fullName: null,
      email: null,
      mobile: null,
      linkedIn: null,
      github: null,
      portfolio: null,
      dateOfBirth: null,
      address: null,
      skills: null
    };
    
    // Extract email FIRST (needed for name extraction strategy)
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      result.email = emailMatch[0].toLowerCase();
    }
    
    // Extract phone numbers (collect all, normalize and deduplicate)
    const rawPhones: { phone: string, type: 'us' | 'india' | 'intl' }[] = [];
    
    // International format FIRST (most specific - has country code)
    const intlPhones = text.match(/\+\d{1,3}[-.\s]*\d{10,14}/g);
    if (intlPhones) intlPhones.forEach(p => rawPhones.push({ phone: p, type: 'intl' }));
    
    // Indian format with +91 prefix (must have +91 to be sure it's Indian)
    const indiaWithCode = text.match(/\+91[-.\s]*\d{5}[-.\s]*\d{5}/g);
    if (indiaWithCode) indiaWithCode.forEach(p => {
      // Check if not already added by intl
      const cleaned = p.replace(/[^\d+]/g, '');
      if (!rawPhones.some(rp => rp.phone.replace(/[^\d+]/g, '') === cleaned)) {
        rawPhones.push({ phone: p, type: 'india' });
      }
    });
    
    // US format with +1 prefix (must have +1 to be sure it's US)
    const usWithCode = text.match(/\+1[-.\s]*\(?\d{3}\)?[-.\s]*\d{3}[-.\s]*\d{4}/g);
    if (usWithCode) usWithCode.forEach(p => {
      const cleaned = p.replace(/[^\d+]/g, '');
      if (!rawPhones.some(rp => rp.phone.replace(/[^\d+]/g, '') === cleaned)) {
        rawPhones.push({ phone: p, type: 'us' });
      }
    });
    
    if (rawPhones.length > 0) {
      // Normalize: keep only digits and leading +
      const normalizePhone = (phone: string) => {
        return phone.replace(/[^\d+]/g, '');
      };
      
      // Deduplicate based on normalized digits
      const seen = new Map<string, string>();
      for (const { phone } of rawPhones) {
        const normalized = normalizePhone(phone);
        const key = normalized.slice(-10); // Use last 10 digits as key for dedup
        
        // Keep the longer version (with country code)
        if (!seen.has(key) || normalized.length > (seen.get(key)?.length || 0)) {
          seen.set(key, normalized);
        }
      }
      
      // Take first 2 unique numbers
      result.mobile = [...seen.values()].slice(0, 2).join(', ');
    }
    
    // Extract LinkedIn URL
    const linkedInMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9-]+)\/?/i);
    if (linkedInMatch) {
      result.linkedIn = `linkedin.com/in/${linkedInMatch[1]}`;
    }
    
    // Extract GitHub URL
    const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9-]+)\/?/i);
    if (githubMatch) {
      result.github = `github.com/${githubMatch[1]}`;
    }
    
    // Extract portfolio/personal website (common patterns)
    // Exclude common email domains
    const excludedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 
                            'icloud.com', 'protonmail.com', 'mail.com', 'aol.com', 'msn.com',
                            'rediffmail.com', 'ymail.com', 'zoho.com', 'proton.me'];
    const portfolioMatch = text.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.(?:dev|io|me|com|co|tech|site|xyz|portfolio|in|org|net))\/?/i);
    if (portfolioMatch) {
      const domain = portfolioMatch[1].toLowerCase();
      // Exclude linkedin, github, and common email domains
      if (!portfolioMatch[0].includes('linkedin') && 
          !portfolioMatch[0].includes('github') &&
          !excludedDomains.includes(domain)) {
        result.portfolio = portfolioMatch[0].replace(/^(?:https?:\/\/)?(?:www\.)?/, '');
      }
    }
    
    // Extract DOB (various formats)
    const dobPatterns = [
      /(?:DOB|Date of Birth|D\.O\.B|Born)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(?:DOB|Date of Birth|D\.O\.B|Born)[\s:]*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
      /(?:DOB|Date of Birth|D\.O\.B|Born)[\s:]*(\w+\s+\d{1,2},?\s+\d{4})/i
    ];
    for (const pattern of dobPatterns) {
      const dobMatch = text.match(pattern);
      if (dobMatch) {
        result.dateOfBirth = dobMatch[1].trim();
        break;
      }
    }
    
    // Extract address (US format)
    const addressMatch = text.match(/\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\.?\s*,?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(-\d{4})?/i);
    if (addressMatch) {
      result.address = addressMatch[0].trim();
    }
    
    // Extract skills
    result.skills = this.extractSkills(text);
    
    // Extract name using smart strategies (in order of reliability)
    // Strategy 1: Extract from filename and verify it exists in resume text
    result.fullName = this.extractNameFromFilename(fileName, text);
    
    // Strategy 2: If not found in filename, try text pattern matching
    if (!result.fullName) {
      result.fullName = this.extractNameFromText(text, result.email);
    }
    
    return result;
  }
  
  /**
   * Extract name from filename and verify it exists in resume text.
   * 
   * Supports various filename patterns:
   * - "John Doe.pdf"
   * - "John Doe-2026.pdf"
   * - "John_Doe_Resume.pdf"
   * - "Resume_John_Doe.pdf"
   * - "john-doe.pdf"
   * - "JohnDoe.pdf" (camelCase)
   * 
   * @param fileName - Original filename
   * @param resumeText - Extracted resume text for verification
   * @returns Extracted name in Title Case, or null if not found
   */
  private static extractNameFromFilename(fileName: string | undefined, resumeText: string): string | null {
    if (!fileName) return null;
    
    // Remove extension
    let nameFromFile = fileName.replace(/\.[^.]+$/, '');
    
    // Remove common non-name words (order matters - remove these first)
    const nonNameWords = /[-_\s]?(resume|cv|curriculum|vitae|updated|final|new|latest|draft|v\d+|copy|\(\d+\))[-_\s]?/gi;
    nameFromFile = nameFromFile.replace(nonNameWords, ' ');
    
    // Remove years (4 digits) - but be careful not to remove if it's part of a word
    nameFromFile = nameFromFile.replace(/[-_\s]?\b(19|20)\d{2}\b[-_\s]?/g, ' ');
    
    // Handle camelCase: "DeepansheeShrivastava" -> "Deepanshee Shrivastava"
    nameFromFile = nameFromFile.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Replace dashes/underscores with spaces
    nameFromFile = nameFromFile.replace(/[-_]+/g, ' ');
    
    // Clean up multiple spaces and trim
    nameFromFile = nameFromFile.replace(/\s+/g, ' ').trim();
    
    // Validate: should have reasonable length and look like a name
    if (nameFromFile.length < 3 || nameFromFile.length > 60) return null;
    
    // Should have at least some letters
    if (!/[a-zA-Z]{2,}/.test(nameFromFile)) return null;
    
    // Convert to lowercase for comparison
    const textLower = resumeText.toLowerCase();
    const nameLower = nameFromFile.toLowerCase();
    
    // Strategy 1: Full name found in resume text
    if (textLower.includes(nameLower)) {
      return this.toTitleCase(nameFromFile);
    }
    
    // Strategy 2: Check individual words (at least 2 must match)
    const nameParts = nameFromFile.split(/\s+/).filter(p => p.length >= 2);
    if (nameParts.length >= 2) {
      let matchCount = 0;
      for (const part of nameParts) {
        // Word boundary check - make sure it's a whole word match
        const wordPattern = new RegExp(`\\b${part.toLowerCase()}\\b`, 'i');
        if (wordPattern.test(resumeText)) {
          matchCount++;
        }
      }
      
      // If at least 2 name parts found in text, it's likely the name
      if (matchCount >= 2) {
        return this.toTitleCase(nameFromFile);
      }
      
      // If first AND last name found, accept it
      const firstName = nameParts[0].toLowerCase();
      const lastName = nameParts[nameParts.length - 1].toLowerCase();
      const firstNamePattern = new RegExp(`\\b${firstName}\\b`, 'i');
      const lastNamePattern = new RegExp(`\\b${lastName}\\b`, 'i');
      
      if (firstNamePattern.test(resumeText) && lastNamePattern.test(resumeText)) {
        return this.toTitleCase(nameFromFile);
      }
    }
    
    return null;
  }
  
  /**
   * Convert string to Title Case
   */
  private static toTitleCase(str: string): string {
    return str.split(/\s+/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
  
  /**
   * Extract name from resume text using multiple strategies
   */
  private static extractNameFromText(text: string, email: string | null): string | null {
    // Strategy 0: First 2-3 words of the resume are often the name
    // Look at the very beginning of the text
    const trimmedText = text.trim();
    const firstChunk = trimmedText.substring(0, 100); // First 100 chars
    
    // Try to find a name pattern at the start (2-3 capitalized words)
    const startNameMatch = firstChunk.match(/^[\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
    if (startNameMatch) {
      const potentialName = startNameMatch[1].trim();
      // Verify it's not a common header word
      const headerWords = ['resume', 'curriculum', 'vitae', 'objective', 'summary', 'profile', 'contact', 'about'];
      const firstWord = potentialName.split(/\s+/)[0].toLowerCase();
      if (!headerWords.includes(firstWord) && potentialName.length >= 5 && potentialName.length <= 50) {
        return potentialName;
      }
    }
    
    // Strategy 1: Look for text before "Email:" or "Email :" label
    const emailLabelPatterns = [
      /([A-Za-z][A-Za-z\s.'-]{3,50}?)[\s\n]*(?:Email|E-mail|Mail)[\s]*:/i,
      /([A-Za-z][A-Za-z\s.'-]{3,50}?)[\s\n]*(?:email|e-mail)[\s]*[:\|]/i,
    ];
    
    for (const pattern of emailLabelPatterns) {
      const match = text.match(pattern);
      if (match) {
        const potentialName = match[1].trim();
        const words = potentialName.split(/\s+/);
        if (words.length >= 2 && words.length <= 4 && /^[A-Za-z\s.'-]+$/.test(potentialName)) {
          return potentialName;
        }
      }
    }
    
    // Strategy 2: Look for name right before the actual email address
    if (email) {
      const emailIndex = text.indexOf(email);
      if (emailIndex > 0) {
        // Get 300 chars before email
        const textBeforeEmail = text.substring(Math.max(0, emailIndex - 300), emailIndex);
        // Split by newlines, pipes, or multiple spaces
        const segments = textBeforeEmail.split(/[\n|]+|\s{3,}/).map(s => s.trim()).filter(s => s.length > 0);
        
        // Check last few segments for a name
        for (let i = segments.length - 1; i >= Math.max(0, segments.length - 5); i--) {
          const segment = segments[i];
          const words = segment.split(/\s+/);
          
          // Valid name: 2-4 words, only letters/spaces/dots/hyphens, reasonable length
          if (words.length >= 2 && words.length <= 4 && 
              /^[A-Za-z\s.'-]+$/.test(segment) && 
              segment.length >= 5 && segment.length <= 60 &&
              !segment.toLowerCase().includes('email') &&
              !segment.toLowerCase().includes('contact') &&
              !segment.toLowerCase().includes('phone') &&
              !segment.toLowerCase().includes('address') &&
              !segment.toLowerCase().includes('resume') &&
              !segment.toLowerCase().includes('objective')) {
            return segment;
          }
        }
      }
    }
    
    // Strategy 3: First meaningful line of resume
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      
      // Skip common headers
      if (line.toLowerCase().includes('resume') || 
          line.toLowerCase().includes('curriculum') ||
          line.toLowerCase().includes('cv') ||
          line.toLowerCase().includes('objective') ||
          line.length > 60) {
        continue;
      }
      
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4 && 
          /^[A-Za-z\s.'-]+$/.test(line) && 
          line.length >= 5 && line.length <= 50) {
        return line;
      }
    }
    
    return null;
  }
  
  /**
   * Extract skills from resume text by finding Skills section
   * Much smarter than hardcoded list - extracts whatever candidate listed
   */
  private static extractSkills(text: string): string | null {
    // Common section headers for skills
    const skillHeaders = [
      /(?:^|\n)\s*(?:technical\s+)?skills?\s*[:|\n|–|-]/i,
      /(?:^|\n)\s*(?:core\s+)?competenc(?:ies|y)\s*[:|\n|–|-]/i,
      /(?:^|\n)\s*technologies?\s*[:|\n|–|-]/i,
      /(?:^|\n)\s*tech\s+stack\s*[:|\n|–|-]/i,
      /(?:^|\n)\s*expertise\s*[:|\n|–|-]/i,
      /(?:^|\n)\s*proficienc(?:ies|y)\s*[:|\n|–|-]/i,
      /(?:^|\n)\s*tools?\s*(?:&|and)?\s*technologies?\s*[:|\n|–|-]/i,
    ];
    
    // Section headers that indicate end of skills section
    const endHeaders = [
      /(?:^|\n)\s*(?:work\s+)?experience/i,
      /(?:^|\n)\s*education/i,
      /(?:^|\n)\s*projects?/i,
      /(?:^|\n)\s*certifications?/i,
      /(?:^|\n)\s*achievements?/i,
      /(?:^|\n)\s*awards?/i,
      /(?:^|\n)\s*publications?/i,
      /(?:^|\n)\s*references?/i,
      /(?:^|\n)\s*summary/i,
      /(?:^|\n)\s*objective/i,
      /(?:^|\n)\s*about\s+me/i,
      /(?:^|\n)\s*profile/i,
      /(?:^|\n)\s*employment/i,
      /(?:^|\n)\s*career/i,
    ];
    
    let skillsText = '';
    
    // Find skills section
    for (const headerRegex of skillHeaders) {
      const match = text.match(headerRegex);
      if (match) {
        const startIndex = match.index! + match[0].length;
        let endIndex = text.length;
        
        // Find where skills section ends (next major section)
        for (const endRegex of endHeaders) {
          const endMatch = text.slice(startIndex).match(endRegex);
          if (endMatch && endMatch.index! < endIndex - startIndex) {
            endIndex = startIndex + endMatch.index!;
          }
        }
        
        // Extract the skills section (limit to reasonable length)
        skillsText = text.slice(startIndex, Math.min(endIndex, startIndex + 2000)).trim();
        break;
      }
    }
    
    if (!skillsText) {
      return null;
    }
    
    // Parse skills from the extracted section
    // Skills are usually separated by: commas, bullets, pipes, newlines, semicolons
    const skills: string[] = [];
    
    // First, try to split merged words (like "C++Desktop browserJava")
    // This happens when PDF parsing loses formatting
    // Split on patterns where lowercase/symbol is followed by uppercase (new skill start)
    let processedText = skillsText
      .replace(/([a-z+#])([A-Z])/g, '$1, $2') // "browserJava" -> "browser, Java"
      .replace(/(\d)([A-Z])/g, '$1, $2') // "C++Desktop" already handled by above, but for numbers
      .replace(/([a-z])(\d)/g, '$1, $2'); // handle cases like "Python3" -> keep as is actually
    
    // Split by common delimiters
    const rawSkills = processedText
      .replace(/[•●○◦▪▸►→✓✔★☆]/g, ',') // bullets to comma
      .replace(/\|/g, ',') // pipes to comma
      .replace(/;/g, ',') // semicolons to comma
      .replace(/\n+/g, ',') // newlines to comma
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const raw of rawSkills) {
      // Clean up each skill
      let skill = raw
        .replace(/^\s*[-–—]\s*/, '') // remove leading dashes
        .replace(/\s*[-–—]\s*$/, '') // remove trailing dashes
        .replace(/^\d+\.\s*/, '') // remove numbering like "1."
        .replace(/\s+/g, ' ') // normalize whitespace
        .trim();
      
      // Skip if too short, too long, or looks like a sentence
      if (skill.length < 2 || skill.length > 50) continue;
      if (skill.split(' ').length > 5) continue; // Skip if more than 5 words (likely a sentence)
      if (/[.!?]$/.test(skill)) continue; // Skip sentences
      
      // Skip common non-skill words that might appear
      const skipWords = ['and', 'or', 'with', 'using', 'including', 'etc', 'years', 'experience', 'proficient', 'advanced', 'intermediate', 'beginner', 'expert'];
      if (skipWords.includes(skill.toLowerCase())) continue;
      
      // Add if not duplicate (keep original casing from resume)
      if (skill && !skills.some(s => s.toLowerCase() === skill.toLowerCase())) {
        skills.push(skill);
      }
    }
    
    // Return top 40 skills, comma-separated
    if (skills.length > 0) {
      return skills.slice(0, 40).join(', ');
    }
    
    return null;
  }
  
  /**
   * Look up cached parsed resume text from ApplicantResumes table.
   * Returns the pre-parsed text if available, null otherwise.
   */
  private static async getCachedResumeText(resumeId: string): Promise<string | null> {
    const query = `
      SELECT ParsedResumeText 
      FROM ApplicantResumes 
      WHERE ResumeID = @param0 AND (IsDeleted = 0 OR IsDeleted IS NULL)
    `;
    const result = await dbService.executeQuery(query, [resumeId]);
    const text = result.recordset?.[0]?.ParsedResumeText;
    return text && text.trim().length > 0 ? text : null;
  }

  /**
   * Backfill ParsedResumeText in ApplicantResumes for a resume that was
   * uploaded before the parsing-at-upload feature was added.
   */
  private static async backfillParsedText(resumeId: string, parsedText: string): Promise<void> {
    const query = `
      UPDATE ApplicantResumes 
      SET ParsedResumeText = @param1, UpdatedAt = GETUTCDATE()
      WHERE ResumeID = @param0 AND ParsedResumeText IS NULL
    `;
    await dbService.executeQuery(query, [resumeId, parsedText]);
    console.log(`[ResumeAnalyzer] Backfilled parsed text for resume ${resumeId}`);
  }

  /**
   * Save or update resume metadata in database.
   * 
   * If a resume with the same email already exists, updates the existing record
   * and increments the analysis count. Otherwise creates a new record.
   * 
   * Note: UserID is optional and will be NULL for anonymous users (public endpoint).
   * This is expected behavior as the resume analyzer is available without login.
   * 
   * @param params - Resume metadata parameters
   * @returns The ResumeMetadataID (new or existing)
   */
  private static async saveResumeMetadata(params: {
    userId?: string;
    fileName?: string;
    fileSize?: number;
    extractedData: ExtractedPersonalData;
    parsedText: string;
    jobUrl?: string;
    jobId?: string;
    matchScore: number;
    aiModel?: string;
  }): Promise<string> {
    const { userId, fileName, fileSize, extractedData, parsedText, jobUrl, jobId, matchScore, aiModel } = params;
    
    // Check if resume with same email already exists
    if (extractedData.email) {
      const existingQuery = `
        SELECT ResumeMetadataID, AnalysisCount 
        FROM ResumeMetadata 
        WHERE Email = @param0
        ORDER BY CreatedAt DESC
      `;
      const existing = await dbService.executeQuery(existingQuery, [extractedData.email]);
      
      if (existing.recordset && existing.recordset.length > 0) {
        // Update existing record and increment analysis count
        const existingId = existing.recordset[0].ResumeMetadataID;
        const currentCount = existing.recordset[0].AnalysisCount || 1;
        
        const updateQuery = `
          UPDATE ResumeMetadata SET
            FileName = COALESCE(@param1, FileName),
            FileSizeBytes = COALESCE(@param2, FileSizeBytes),
            FullName = COALESCE(@param3, FullName),
            Mobile = COALESCE(@param4, Mobile),
            Skills = COALESCE(@param5, Skills),
            ParsedText = @param6,
            LastJobUrl = @param7,
            LastJobId = @param8,
            LastMatchScore = @param9,
            AnalysisCount = @param10,
            AIModel = @param11,
            LastAnalyzedAt = GETUTCDATE()
          WHERE ResumeMetadataID = @param0
        `;
        
        await dbService.executeQuery(updateQuery, [
          existingId,
          fileName || null,
          fileSize || null,
          extractedData.fullName,
          extractedData.mobile,
          extractedData.skills,
          parsedText?.trim() || null,
          jobUrl || null,
          jobId || null,
          matchScore,
          currentCount + 1,
          aiModel || null
        ]);
        
        console.log(`[ResumeAnalyzer] Updated record, count: ${currentCount + 1}`);
        return existingId;
      }
    }
    
    // Insert new record
    const insertQuery = `
      INSERT INTO ResumeMetadata (
        UserID, FileName, FileSizeBytes, FullName, Email, Mobile, 
        Skills, ParsedText, LastJobUrl, LastJobId, LastMatchScore, AIModel
      )
      OUTPUT INSERTED.ResumeMetadataID
      VALUES (
        @param0, @param1, @param2, @param3, @param4, @param5,
        @param6, @param7, @param8, @param9, @param10, @param11
      )
    `;
    
    const result = await dbService.executeQuery(insertQuery, [
      userId || null,
      fileName || null,
      fileSize || null,
      extractedData.fullName,
      extractedData.email,
      extractedData.mobile,
      extractedData.skills,
      parsedText?.trim() || null,
      jobUrl || null,
      jobId || null,
      matchScore,
      aiModel || null
    ]);
    
    return result.recordset[0].ResumeMetadataID;
  }
  
  /**
   * Update resume metadata with AI analysis results
   */
  private static async updateResumeMetadataScore(
    resumeMetadataId: string,
    matchScore: number,
    aiModel?: string
  ): Promise<void> {
    const updateQuery = `
      UPDATE ResumeMetadata SET
        LastMatchScore = @param1,
        AIModel = @param2,
        LastAnalyzedAt = GETUTCDATE()
      WHERE ResumeMetadataID = @param0
    `;
    
    await dbService.executeQuery(updateQuery, [
      resumeMetadataId,
      matchScore,
      aiModel || null
    ]);
  }
  
  /**
   * Get job details from RefOpen database by ID
   */
  private static async getJobById(jobId: string): Promise<{ title: string; description: string; company: string }> {
    const query = `
      SELECT 
        j.Title,
        j.Description,
        j.Responsibilities,
        j.RequiredEducation,
        j.RequiredCertifications,
        j.ExperienceMin,
        j.ExperienceMax,
        j.Location,
        COALESCE(o.Name, 'Unknown Company') as CompanyName
      FROM Jobs j
      LEFT JOIN Organizations o ON j.OrganizationID = o.OrganizationID
      WHERE j.JobID = @param0
    `;
    
    const result = await dbService.executeQuery(query, [jobId]);
    
    if (!result.recordset || result.recordset.length === 0) {
      throw new Error('Job not found');
    }
    
    const job = result.recordset[0];
    
    // Build a comprehensive job description from available fields
    let fullDescription = job.Description || '';
    if (job.Responsibilities) {
      fullDescription += `\n\nResponsibilities:\n${job.Responsibilities}`;
    }
    if (job.RequiredEducation) {
      fullDescription += `\n\nEducation Required: ${job.RequiredEducation}`;
    }
    if (job.RequiredCertifications) {
      fullDescription += `\n\nCertifications Required: ${job.RequiredCertifications}`;
    }
    if (job.ExperienceMin || job.ExperienceMax) {
      fullDescription += `\n\nExperience: ${job.ExperienceMin || 0}-${job.ExperienceMax || 'N/A'} years`;
    }
    if (job.Location) {
      fullDescription += `\n\nLocation: ${job.Location}`;
    }
    
    return {
      title: job.Title || 'Unknown Position',
      description: fullDescription,
      company: job.CompanyName || 'Unknown Company'
    };
  }
  
  /**
   * Fetch job description from external URL using Jina AI Reader
   */
  private static async fetchJobFromUrl(url: string): Promise<{ title: string; content: string }> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'text/plain',
      };
      
      // Add API key for higher rate limits (500 RPM vs 20 RPM)
      if (JINA_API_KEY) {
        headers['Authorization'] = `Bearer ${JINA_API_KEY}`;
      }
      
      const response = await fetch(`${JINA_READER_URL}${encodeURIComponent(url)}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }
      
      let content = await response.text();
      
      // Try to extract title from content (first heading)
      const titleMatch = content.match(/^#\s*(.+)$/m);
      let title = titleMatch ? titleMatch[1].trim() : 'External Job';
      
      // Clean up the content - remove navigation, footer, and other noise
      // Look for the actual job title/description section
      // Most job pages have a clear title with === or ### followed by job details
      
      // Strategy 1: Find a line that looks like a job title (e.g., "Senior Backend Software Engineer")
      // followed by === or standalone
      const jobTitlePattern = /\n((?:Senior|Junior|Lead|Staff|Principal|Associate|Mid-Level)?\s*(?:\w+\s+)?(?:Software|Backend|Frontend|Full[- ]?Stack|DevOps|Data|ML|AI|Cloud|Platform|Site Reliability|Product|Project|Program|Engineering|Design|UX|UI)?\s*(?:Engineer|Developer|Manager|Architect|Designer|Analyst|Scientist|Lead|Director|Specialist|Consultant|Administrator|Coordinator)[^\n]*)\s*\n={3,}/i;
      
      let jobContentStart = 0;
      const jobTitleMatch = content.match(jobTitlePattern);
      if (jobTitleMatch && jobTitleMatch.index !== undefined) {
        jobContentStart = jobTitleMatch.index;
        // Extract better title
        title = jobTitleMatch[1].trim();
      } else {
        // Strategy 2: Look for "Working at" or "About the Role" markers
        const altMarkers = [
          /\n\*\*Working at /i,
          /\n\*\*About the Role/i,
          /\n\*\*Job Description/i,
          /\n## (?:About|Role|Position|Overview)/i,
        ];
        for (const marker of altMarkers) {
          const match = content.match(marker);
          if (match && match.index !== undefined && match.index > 1000) {
            // Go back a bit to capture the title
            jobContentStart = Math.max(0, match.index - 300);
            break;
          }
        }
      }
      
      // Look for end markers (footer, legal, social links)
      const endMarkers = [
        /\n(?:Privacy Policy|Terms of Service|Copyright ©)/i,
        /\n### Join the.*(?:Talent Community|Newsletter)/i,
        /\n\[.*\]\(https:\/\/(?:www\.)?(?:facebook|twitter|linkedin|youtube|instagram)\.com/i,
      ];
      
      let jobContentEnd = content.length;
      for (const marker of endMarkers) {
        const match = content.match(marker);
        if (match && match.index !== undefined && match.index > jobContentStart + 500) {
          jobContentEnd = Math.min(jobContentEnd, match.index);
          break;
        }
      }
      
      // Extract the relevant portion
      if (jobContentStart > 0 || jobContentEnd < content.length) {
        content = content.substring(jobContentStart, jobContentEnd);
        console.log(`[ResumeAnalyzer] Extracted job content from position ${jobContentStart} to ${jobContentEnd}`);
      }
      
      // Further limit content to prevent token overflow (max ~8000 chars for good context)
      if (content.length > 8000) {
        content = content.substring(0, 8000) + '\n...[Content truncated]';
      }
      
      // Validate that we got meaningful job content
      // Check for signs of failed extraction (mostly JSON config, no job keywords)
      const jobKeywords = ['experience', 'qualifications', 'responsibilities', 'skills', 'requirements', 'salary', 'benefits', 'team', 'role', 'position'];
      const keywordCount = jobKeywords.filter(kw => content.toLowerCase().includes(kw)).length;
      const jsonConfigRatio = (content.match(/["{}:,\[\]]/g) || []).length / content.length;
      
      // If content is mostly JSON/config OR has very few job keywords OR title wasn't found
      if (jsonConfigRatio > 0.15 || keywordCount < 3 || (title === 'External Job' && jobContentStart === 0)) {
        console.log(`[ResumeAnalyzer] Job extraction failed - jsonRatio: ${jsonConfigRatio.toFixed(2)}, keywords: ${keywordCount}`);
        throw new Error('PASTE_JOB_DESCRIPTION: This job site requires the job description to be pasted manually. Please copy the job details from the website and use the "Paste Job Detail" tab.');
      }
      
      console.log(`[ResumeAnalyzer] Fetched job: "${title}" (${content.length} chars)`);
      
      return { title, content };
    } catch (error: any) {
      console.error('URL fetch error:', error);
      // Preserve our custom error message
      if (error.message?.startsWith('PASTE_JOB_DESCRIPTION:')) {
        throw new Error(error.message.replace('PASTE_JOB_DESCRIPTION: ', ''));
      }
      throw new Error(`Failed to fetch job from URL: ${error.message}`);
    }
  }
  
  /**
   * Analyze resume against job description using AI (Gemini with Groq fallback)
   */
  private static async analyzeWithAI(
    resume: string, 
    jobDescription: string,
    jobTitle?: string
  ): Promise<ResumeAnalysisResult> {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }
    
    const prompt = `You are an expert resume analyzer and career coach. Analyze the following resume against the job description and provide a detailed assessment.

JOB TITLE: ${jobTitle || 'Not specified'}

JOB DESCRIPTION:
${jobDescription}

RESUME (anonymized):
${resume}

Provide your analysis in the following JSON format ONLY (no markdown, no code blocks, just pure JSON):
{
  "matchScore": <number between 0-100 representing how well the resume matches the job>,
  "missingKeywords": [<array of important keywords/skills from the job description that are missing in the resume>],
  "strengths": [<array of strong points where the candidate matches or exceeds requirements>],
  "tips": [<array of specific, actionable tips to improve the resume for this job>],
  "overallAssessment": "<2-3 sentence summary of the candidate's fit for this role>"
}

Be specific and constructive. Focus on:
1. Technical skills match
2. Experience relevance
3. Education alignment
4. Missing certifications or skills
5. Resume formatting/presentation issues that might hurt ATS compatibility`;

    // Try Gemini first, fallback to Groq on rate limit
    let useGroq = false;
    
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          }
        })
      });
      
      if (!response.ok) {
        // If rate limited (429), try Groq as fallback
        if (response.status === 429) {
          useGroq = true;
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('AI service configuration error. Please contact support.');
        } else if (response.status >= 500) {
          throw new Error('AI service is temporarily unavailable. Please try again later.');
        } else {
          throw new Error('Unable to analyze resume at this time. Please try again.');
        }
      }
      
      if (!useGroq) {
        const data: any = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResponse) {
          throw new Error('Empty response from Gemini');
        }
        
        // Parse and return with Gemini model tag
        const result = this.parseAIResponse(textResponse);
        result.aiModel = 'gemini-2.5-flash';
        return result;
      }
    } catch (error: any) {
      // If Gemini fails with rate limit, try Groq
      if (error.message?.includes('429') || useGroq) {
        useGroq = true;
      } else if (!useGroq) {
        throw error;
      }
    }
    
    // Fallback to Groq
    if (useGroq) {
      if (!GROQ_API_KEY) {
        throw new Error('We\'re experiencing high demand right now. Please try again in sometime.');
      }
      
      const groqResponse = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
        })
      });
      
      if (!groqResponse.ok) {
        throw new Error('We\'re experiencing high demand right now. Please try again in sometime.');
      }
      
      const groqData: any = await groqResponse.json();
      const groqText = groqData.choices?.[0]?.message?.content;
      
      if (!groqText) {
        throw new Error('Empty response from AI');
      }
      
      // Parse and return with Groq model tag
      const result = this.parseAIResponse(groqText);
      result.aiModel = 'llama-3.3-70b';
      return result;
    }
    
    throw new Error('AI analysis failed. Please try again.');
  }
  
  /**
   * Parse AI response and extract JSON
   */
  private static parseAIResponse(textResponse: string): ResumeAnalysisResult {
    // Parse JSON from response (handle potential markdown code blocks)
    let jsonString = textResponse.trim();
    
    // Remove markdown code blocks if present (various formats)
    jsonString = jsonString.replace(/^```(?:json)?\s*/i, '');
    jsonString = jsonString.replace(/\s*```$/i, '');
    jsonString = jsonString.trim();
    
    // If still not starting with {, try to extract JSON from the text
    if (!jsonString.startsWith('{')) {
      // Find the first { and extract to the matching }
      const startIdx = jsonString.indexOf('{');
      if (startIdx !== -1) {
        let braceCount = 0;
        let endIdx = startIdx;
        for (let i = startIdx; i < jsonString.length; i++) {
          if (jsonString[i] === '{') braceCount++;
          if (jsonString[i] === '}') braceCount--;
          if (braceCount === 0) {
            endIdx = i + 1;
            break;
          }
        }
        jsonString = jsonString.slice(startIdx, endIdx);
      }
    }
    
    // Clean up common JSON issues
    // Remove trailing commas before } or ]
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
    // Remove control characters except newlines/tabs
    jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    
    try {
      const analysis = JSON.parse(jsonString);
      
      // Validate and return with defaults
      return {
        matchScore: Math.min(100, Math.max(0, Number(analysis.matchScore) || 0)),
        missingKeywords: Array.isArray(analysis.missingKeywords) ? analysis.missingKeywords : [],
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
        tips: Array.isArray(analysis.tips) ? analysis.tips : [],
        overallAssessment: analysis.overallAssessment || 'Analysis completed.'
      };
    } catch (parseError: any) {
      console.error('[ResumeAnalyzer] Failed to parse AI response. Error:', parseError.message);
      console.error('[ResumeAnalyzer] Response preview:', jsonString.substring(0, 500));
      throw new Error('Failed to parse AI response. Please try again.');
    }
  }
}
