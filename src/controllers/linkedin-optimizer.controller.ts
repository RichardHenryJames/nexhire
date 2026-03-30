/**
 * LinkedIn Profile Optimizer Controller
 * 
 * POST /api/tools/linkedin-optimizer
 * 
 * Accepts either:
 * - JSON body with quick-mode fields (headline, about, currentRole, skills, targetRole)
 * - Multipart form-data with LinkedIn PDF upload + optional targetRole
 * 
 * Auth required. First N uses free, then wallet debit.
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as multiparty from 'multiparty';
import { Readable } from 'stream';
import { LinkedInOptimizerService } from '../services/linkedin-optimizer.service';
import { corsHeaders, authenticate } from '../middleware';
import { PricingService } from '../services/pricing.service';
import { WalletService } from '../services/wallet.service';
import { dbService } from '../services/database.service';

/**
 * Parse multipart form data (same pattern as resume-analyzer)
 */
async function parseMultipartFormData(req: HttpRequest): Promise<{
  fields: Record<string, string>;
  files: Array<{ fieldName: string; buffer: Buffer; filename: string; contentType: string }>;
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const bodyBuffer = await req.arrayBuffer();
      const buffer = Buffer.from(bodyBuffer);
      const contentType = req.headers.get('content-type') || '';

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      (readable as any).headers = { 'content-type': contentType };

      const form = new multiparty.Form();
      const fields: Record<string, string> = {};
      const files: Array<{ fieldName: string; buffer: Buffer; filename: string; contentType: string }> = [];
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
            contentType: part.headers['content-type'] || 'application/octet-stream',
          });
          part.on('data', (chunk: Buffer) => { chunks.push(chunk); });
          part.on('end', () => { fileBuffers.set(fieldName, chunks); });
        } else {
          let data = '';
          part.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          part.on('end', () => { fields[fieldName] = data; });
        }

        part.on('error', (err: Error) => { console.error('Part error:', err); });
      });

      form.on('close', () => {
        for (const [fieldName, chunks] of fileBuffers) {
          const info = fileInfo.get(fieldName);
          if (info) {
            files.push({
              fieldName,
              buffer: Buffer.concat(chunks),
              filename: info.filename,
              contentType: info.contentType,
            });
          }
        }
        resolve({ fields, files });
      });

      form.on('error', (err: Error) => { console.error('Form parsing error:', err); reject(err); });
      form.parse(readable as any);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Main handler
 */
export async function analyzeLinkedIn(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') {
    return { status: 200, headers: corsHeaders };
  }

  try {
    // ── Auth ────────────────────────────────────────────────
    let user: any;
    try {
      user = authenticate(req);
    } catch (authErr: any) {
      return {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Authentication required. Please sign in to use the LinkedIn Optimizer.' },
      };
    }
    const userId = user.userId || user.sub;

    // ── Free-use / wallet check ─────────────────────────────
    const freeUses = (await PricingService.getSetting('LINKEDIN_OPTIMIZER_FREE_USES')) || 1;
    const costPerUse = (await PricingService.getSetting('LINKEDIN_OPTIMIZER_COST')) || 29;

    const usageResult = await dbService.executeQuery(
      `SELECT COUNT(*) AS cnt FROM LinkedInOptimizerUsage WHERE UserID = @param0`,
      [userId]
    );
    const usageCount = usageResult.recordset?.[0]?.cnt || 0;
    const isFreeTier = usageCount < freeUses;

    if (!isFreeTier) {
      try {
        const wallet = await WalletService.getOrCreateWallet(userId);
        if (wallet.Balance < costPerUse) {
          return {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            jsonBody: {
              success: false,
              error: `Insufficient balance. LinkedIn optimization costs ₹${costPerUse}. Please recharge your wallet.`,
              requiresPayment: true,
              cost: costPerUse,
              freeUsesRemaining: 0,
            },
          };
        }
      } catch (walletErr: any) {
        throw walletErr;
      }
    }

    context.log(`LinkedIn optimizer: user ${userId}, use #${usageCount + 1}, free=${isFreeTier}`);

    // ── Parse request ───────────────────────────────────────
    const contentType = req.headers.get('content-type') || '';
    let mode: 'quick' | 'full' = 'quick';
    let headline = '';
    let about = '';
    let currentRole = '';
    let currentCompany = '';
    let skills = '';
    let targetRole = '';
    let pdfBuffer: Buffer | undefined;
    let fileName = '';

    if (contentType.includes('multipart/form-data')) {
      // Full audit mode (PDF upload)
      context.log(`Parsing multipart form data...`);
      const parsed = await parseMultipartFormData(req);
      context.log(`Parsed: ${parsed.files.length} files, fields: ${Object.keys(parsed.fields).join(',')}`);
      const pdfFile = parsed.files.find(f => f.fieldName === 'pdf' || f.fieldName === 'file');

      if (pdfFile) {
        if (!pdfFile.filename.toLowerCase().endsWith('.pdf')) {
          return {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            jsonBody: { success: false, error: 'Please upload a PDF file. Use LinkedIn\'s "Save to PDF" feature.' },
          };
        }
        if (pdfFile.buffer.length > 10 * 1024 * 1024) {
          return {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            jsonBody: { success: false, error: 'PDF file is too large. Maximum size is 10MB.' },
          };
        }
        mode = 'full';
        pdfBuffer = pdfFile.buffer;
        fileName = pdfFile.filename;
      } else {
        // Multipart request but no PDF found
        return {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          jsonBody: { success: false, error: 'No PDF file found in upload. Please select your LinkedIn PDF and try again.' },
        };
      }
      targetRole = parsed.fields.targetRole?.trim() || '';
    } else {
      // Quick mode (JSON)
      const body = await req.json() as any;
      headline = body.headline?.trim() || '';
      about = body.about?.trim() || '';
      currentRole = body.currentRole?.trim() || '';
      currentCompany = body.currentCompany?.trim() || '';
      skills = body.skills?.trim() || '';
      targetRole = body.targetRole?.trim() || '';
      mode = 'quick';

      if (!headline && !about && !currentRole && !skills) {
        return {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          jsonBody: { success: false, error: 'Please provide at least your headline, about section, or current role.' },
        };
      }
    }

    context.log(`Mode: ${mode}, target: ${targetRole || 'none'}`);

    // ── Run analysis ────────────────────────────────────────
    const result = await LinkedInOptimizerService.optimizeProfile({
      headline,
      about,
      currentRole,
      currentCompany,
      skills,
      targetRole,
      pdfBuffer,
      fileName,
      userId,
      mode,
    });

    context.log(`LinkedIn analysis complete. Score: ${result.overallScore}%`);

    // ── Debit wallet AFTER success ──────────────────────────
    if (!isFreeTier) {
      try {
        await WalletService.debitWallet(
          userId,
          costPerUse,
          'LinkedIn_Optimization',
          `LinkedIn profile optimization (use #${usageCount + 1})`
        );
      } catch (debitErr: any) {
        context.error('Post-analysis wallet debit failed (non-critical):', debitErr.message);
      }
    }

    // ── Record usage AFTER debit ────────────────────────────
    try {
      const elapsed = (result as any)?._elapsedMs || 0;
      await dbService.executeQuery(
        `INSERT INTO LinkedInOptimizerUsage (UserID, Mode, OverallScore, ElapsedMs, CreatedAt) VALUES (@param0, @param1, @param2, @param3, GETUTCDATE())`,
        [userId, mode, result.overallScore, elapsed]
      );
    } catch (usageErr: any) {
      context.error('Usage recording failed (non-critical):', usageErr.message);
    }

    return {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: {
        success: true,
        data: result,
        usageInfo: {
          totalUsed: usageCount + 1,
          freeUses,
          freeRemaining: Math.max(0, freeUses - (usageCount + 1)),
          costPerUse,
          wasFree: isFreeTier,
        },
        message: 'LinkedIn profile optimization completed successfully',
      },
    };
  } catch (error: any) {
    context.error('LinkedIn optimizer error:', error.message, error.stack?.substring(0, 300));

    // Only 400 for actual input validation errors (not AI/DB failures)
    const isValidationError =
      error.message?.includes('provide at least') ||
      error.message?.includes('upload a PDF') ||
      error.message?.includes('No PDF file found') ||
      error.message?.includes('too large');

    return {
      status: isValidationError ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: isValidationError ? error.message : 'Something went wrong. Please try again.',
      },
    };
  }
}
