/**
 * Resume Analyzer Controller
 * 
 * Handles multipart file upload and job analysis requests.
 * Requires authentication. First N uses free, then wallet debit.
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as multiparty from 'multiparty';
import { Readable } from 'stream';
import { ResumeAnalyzerService } from '../services/resume-analyzer.service';
import { corsHeaders, authenticate } from '../middleware';
import { PricingService } from '../services/pricing.service';
import { WalletService } from '../services/wallet.service';
import { dbService } from '../services/database.service';

/**
 * Parse multipart form data from Azure Functions HttpRequest
 */
async function parseMultipartFormData(req: HttpRequest): Promise<{
  fields: Record<string, string>;
  files: Array<{ fieldName: string; buffer: Buffer; filename: string; contentType: string }>;
}> {
  return new Promise(async (resolve, reject) => {
    try {
      // Get the raw body as ArrayBuffer
      const bodyBuffer = await req.arrayBuffer();
      const buffer = Buffer.from(bodyBuffer);
      
      // Get content type header
      const contentType = req.headers.get('content-type') || '';
      
      // Create a readable stream from the buffer
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      
      // Add headers property to stream (multiparty needs this)
      (readable as any).headers = { 'content-type': contentType };
      
      const form = new multiparty.Form();
      const fields: Record<string, string> = {};
      const files: Array<{ fieldName: string; buffer: Buffer; filename: string; contentType: string }> = [];
      
      // Collect file data in memory
      const fileBuffers: Map<string, Buffer[]> = new Map();
      const fileInfo: Map<string, { filename: string; contentType: string }> = new Map();
      
      form.on('field', (name: string, value: string) => {
        fields[name] = value;
      });
      
      form.on('part', (part: any) => {
        const chunks: Buffer[] = [];
        const fieldName = part.name;
        
        if (part.filename) {
          fileInfo.set(fieldName, {
            filename: part.filename,
            contentType: part.headers['content-type'] || 'application/octet-stream'
          });
          
          part.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          
          part.on('end', () => {
            fileBuffers.set(fieldName, chunks);
          });
        } else {
          // It's a regular field, concatenate as string
          let data = '';
          part.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          part.on('end', () => {
            fields[fieldName] = data;
          });
        }
        
        part.on('error', (err: Error) => {
          console.error('Part error:', err);
        });
      });
      
      form.on('close', () => {
        // Combine all file buffers
        for (const [fieldName, chunks] of fileBuffers) {
          const info = fileInfo.get(fieldName);
          if (info) {
            files.push({
              fieldName,
              buffer: Buffer.concat(chunks),
              filename: info.filename,
              contentType: info.contentType
            });
          }
        }
        resolve({ fields, files });
      });
      
      form.on('error', (err: Error) => {
        console.error('Form parsing error:', err);
        reject(err);
      });
      
      form.parse(readable as any);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Analyze Resume Against Job Description
 * POST /api/tools/resume-analyzer
 * 
 * This is a PUBLIC endpoint - no authentication required
 * 
 * Accepts multipart/form-data with:
 * - resume: PDF file (required)
 * - jobId: RefOpen job ID (optional)
 * - jobUrl: External job URL (optional)  
 * - jobDescription: Full job description text (optional)
 * 
 * At least one of jobId, jobUrl, or jobDescription is required.
 */
export async function analyzeResume(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return {
      status: 200,
      headers: corsHeaders
    };
  }
  
  try {
    // ── Auth check ─────────────────────────────────────────
    let user: any;
    try {
      user = authenticate(req);
    } catch (authErr: any) {
      return {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Authentication required. Please sign in to use the Resume Analyzer.' }
      };
    }
    const userId = user.userId || user.sub;

    // ── Free-use / wallet check ────────────────────────────
    const [freeUses, costPerUse] = await Promise.all([
      PricingService.getAIResumeFreeUses(),
      PricingService.getAIResumeAnalysisCost(),
    ]);

    // Count how many times this user has used the analyzer
    const usageResult = await dbService.executeQuery(
      `SELECT COUNT(*) AS cnt FROM WalletTransactions wt
       INNER JOIN Wallets w ON wt.WalletID = w.WalletID
       WHERE w.UserID = @param0 AND wt.Source = 'Resume_Analysis'`,
      [userId]
    );
    const usageCount = usageResult.recordset?.[0]?.cnt || 0;
    const isFreeTier = usageCount < freeUses;

    if (!isFreeTier) {
      // Must pay — check balance and debit
      try {
        await WalletService.debitWallet(userId, costPerUse, 'Resume_Analysis', `Resume analysis (use #${usageCount + 1})`);
      } catch (walletErr: any) {
        if (walletErr.message?.includes('Insufficient')) {
          return {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            jsonBody: {
              success: false,
              error: `Insufficient balance. Resume analysis costs ₹${costPerUse}. Please recharge your wallet.`,
              requiresPayment: true,
              cost: costPerUse,
              freeUsesRemaining: 0,
            }
          };
        }
        throw walletErr;
      }
    } else {
      // Free use — record a ₹0 transaction for counting purposes
      try {
        const wallet = await WalletService.getOrCreateWallet(userId);
        const { AuthService } = await import('../services/auth.service');
        const txnId = AuthService.generateUniqueId();
        await dbService.executeQuery(
          `INSERT INTO WalletTransactions (TransactionID, WalletID, TransactionType, Amount, BalanceBefore, BalanceAfter, CurrencyID, Source, Description, Status)
           VALUES (@param0, @param1, 'Debit', 0, @param2, @param2, @param3, 'Resume_Analysis', @param4, 'Completed')`,
          [txnId, wallet.WalletID, wallet.Balance, wallet.CurrencyID, `Free resume analysis (${usageCount + 1}/${freeUses})`]
        );
      } catch (e) {
        // Non-critical — analysis should still proceed even if tracking fails
        context.log('Failed to record free analysis usage:', e);
      }
    }

    context.log(`Resume analyzer: user ${userId}, use #${usageCount + 1}, free=${isFreeTier}`);
    
    // Parse multipart form data
    let fields: Record<string, string> = {};
    let files: Array<{ fieldName: string; buffer: Buffer; filename: string; contentType: string }> = [];
    
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      const parsed = await parseMultipartFormData(req);
      fields = parsed.fields;
      files = parsed.files;
    } else if (contentType.includes('application/json')) {
      // Handle JSON payload with base64 encoded resume
      const body = await req.json() as any;
      fields = {
        jobId: body.jobId || '',
        jobUrl: body.jobUrl || '',
        jobDescription: body.jobDescription || ''
      };
      
      if (body.resumeBase64) {
        const buffer = Buffer.from(body.resumeBase64, 'base64');
        files = [{
          fieldName: 'resume',
          buffer,
          filename: body.resumeFilename || 'resume.pdf',
          contentType: 'application/pdf'
        }];
      }
    }
    
    // Check if resume URL is provided (from user's profile)
    const resumeUrlField = fields.resumeUrl?.trim();
    const resumeIdField = fields.resumeId?.trim();
    let resumeFile = files.find(f => f.fieldName === 'resume');
    
    if (!resumeFile && resumeUrlField) {
      // Fetch resume from URL (Azure Blob Storage)
      context.log(`Fetching resume from URL: ${resumeUrlField}`);
      try {
        const response = await fetch(resumeUrlField);
        if (!response.ok) {
          throw new Error(`Failed to fetch resume: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        resumeFile = {
          fieldName: 'resume',
          buffer,
          filename: fields.resumeFileName || 'resume.pdf',
          contentType: 'application/pdf'
        };
        context.log(`Fetched resume from profile: ${buffer.length} bytes`);
      } catch (fetchError: any) {
        // If resumeId is available, we can still try using cached parsed text
        if (!resumeIdField) {
          context.error('Failed to fetch resume from URL:', fetchError);
          return {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            jsonBody: {
              success: false,
              error: 'Failed to fetch resume from your profile. Please try uploading the file manually.'
            }
          };
        }
        context.log(`Resume URL fetch failed but resumeId available - will try cached text`);
      }
    }
    
    // Allow proceeding without a file if resumeId is provided (cached text may exist)
    if (!resumeFile && !resumeIdField) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: {
          success: false,
          error: 'Resume file is required. Please upload a PDF file.'
        }
      };
    }
    
    // Validate file type and size (only when a file is present)
    if (resumeFile) {
      if (!resumeFile.contentType.includes('pdf')) {
        return {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          jsonBody: {
            success: false,
            error: 'Only PDF files are supported for resume analysis.'
          }
        };
      }
      
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (resumeFile.buffer.length > maxSize) {
        return {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          jsonBody: {
            success: false,
            error: 'Resume file is too large. Maximum size is 10MB.'
          }
        };
      }
    }
    
    // Validate job source
    const jobId = fields.jobId?.trim();
    const jobUrl = fields.jobUrl?.trim();
    const jobDescription = fields.jobDescription?.trim();
    const resumeId = fields.resumeId?.trim();
    
    // userId comes from auth token, not form fields
    
    if (!jobId && !jobUrl && !jobDescription) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: {
          success: false,
          error: 'Please provide a job ID, job URL, or job description to analyze against.'
        }
      };
    }
    
    context.log(`Analyzing resume against: ${jobId ? 'JobID: ' + jobId : jobUrl ? 'URL: ' + jobUrl : 'Description'}`);
    context.log(`User: ${userId}${resumeId ? ', ResumeID: ' + resumeId : ''}`);
    
    // Call the analyzer service
    const result = await ResumeAnalyzerService.analyzeResume({
      resumeBuffer: resumeFile?.buffer,
      fileName: resumeFile?.filename,
      fileSize: resumeFile?.buffer?.length,
      resumeId: resumeId || undefined,
      jobId: jobId || undefined,
      jobUrl: jobUrl || undefined,
      jobDescription: jobDescription || undefined,
      userId: userId
    });
    
    context.log(`Analysis complete. Match score: ${result.matchScore}%`);
    
    return {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: {
        success: true,
        data: result,
        usageInfo: {
          totalUsed: usageCount + 1,
          freeUses: freeUses,
          freeRemaining: Math.max(0, freeUses - (usageCount + 1)),
          costPerUse: costPerUse,
          wasFree: isFreeTier,
        },
        message: 'Resume analysis completed successfully'
      }
    };
    
  } catch (error: any) {
    context.error('Resume analysis error:', error);
    
    const isValidationError = error.message?.includes('required') || 
                              error.message?.includes('provide') ||
                              error.message?.includes('not found');
    
    return {
      status: isValidationError ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: error.message || 'Failed to analyze resume. Please try again.'
      }
    };
  }
}
