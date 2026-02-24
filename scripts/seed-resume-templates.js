/**
 * Seed Resume Builder templates with real HTML + CSS
 * 
 * Usage:
 *   node scripts/seed-resume-templates.js              # defaults to dev (reads local.settings.json)
 *   node scripts/seed-resume-templates.js --env=prod   # uses prod DB credentials
 * 
 * DB credentials are read from local.settings.json (gitignored, never committed).
 * Falls back to environment variables DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD.
 * 
 * Idempotent: safe to run multiple times. Updates existing, inserts new.
 */
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Parse --env flag
const args = process.argv.slice(2);
const envFlag = args.find(a => a.startsWith('--env='));
const targetEnv = envFlag ? envFlag.split('=')[1] : 'dev';

// Load DB credentials from local.settings.json (gitignored — safe)
function loadDbConfig() {
  const localSettingsPath = path.join(__dirname, '..', 'local.settings.json');
  
  if (fs.existsSync(localSettingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
      const values = settings.Values || {};
      
      if (values.DB_SERVER && values.DB_PASSWORD) {
        console.log(`📁 Loaded credentials from local.settings.json`);
        return {
          server: values.DB_SERVER,
          database: values.DB_NAME || 'refopen-sql-db-dev',
          user: values.DB_USER || 'sqladmin',
          password: values.DB_PASSWORD,
        };
      }
    } catch (e) {
      console.warn('⚠️ Could not parse local.settings.json:', e.message);
    }
  }

  // Fallback to environment variables
  if (process.env.DB_SERVER && process.env.DB_PASSWORD) {
    console.log(`🌍 Using environment variables for DB credentials`);
    return {
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME || 'refopen-sql-db-dev',
      user: process.env.DB_USER || 'sqladmin',
      password: process.env.DB_PASSWORD,
    };
  }

  console.error('❌ No DB credentials found!');
  console.error('   Create local.settings.json with DB_SERVER, DB_PASSWORD in Values');
  console.error('   Or set DB_SERVER, DB_PASSWORD environment variables');
  process.exit(1);
}

const dbCreds = loadDbConfig();
const config = {
  ...dbCreds,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000 }
};

console.log(`🎯 Target: ${config.server} / ${config.database}`);
console.log(`🌍 Environment: ${targetEnv}\n`);

// ═══════════════════════════════════════════════════════════
// SHARED: Section renderers produce these CSS classes:
//   .section, .section-title, .entry, .entry-header,
//   .entry-title, .entry-subtitle, .entry-date, .entry-location,
//   .bullets, .skill-category, .skill-tag, .cert-entry, .sep
// 
// Template placeholders:
//   {{STYLES}}              → CssTemplate column
//   {{TITLE}}               → escaped full name
//   {{FULL_NAME}}           → name
//   {{CONTACT_HTML}}        → email | phone | location
//   {{LINKS_HTML}}          → LinkedIn · GitHub · Portfolio
//   {{SUMMARY_TEXT}}        → professional summary
//   {{SECTIONS_HTML}}       → all sections combined
//   {{MAIN_SECTIONS_HTML}}  → main column (for 2-col)
//   {{SIDEBAR_SECTIONS_HTML}} → sidebar (for 2-col)
// ═══════════════════════════════════════════════════════════

const TEMPLATES = [
  {
    slug: 'classic',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><main>{{SECTIONS_HTML}}</main></div></body></html>`,
    css: `@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'EB Garamond',Georgia,serif;font-size:10pt;line-height:1.35;color:#1a1a1a;background:#fff}.resume{max-width:8.5in;margin:0 auto;padding:.4in .7in}.header{text-align:center;margin-bottom:8pt;padding-bottom:6pt;border-bottom:1.5px solid #1a1a1a}.name{font-size:22pt;font-weight:700;letter-spacing:1pt;text-transform:uppercase;margin-bottom:4pt;color:#1a1a1a}.contact{font-size:9pt;color:#555;margin-bottom:2pt}.contact .sep{margin:0 6pt;color:#aaa}.links{font-size:9pt}.links a{color:#2563EB;text-decoration:none}.links .sep{margin:0 5pt;color:#ccc}.summary{font-size:9.5pt;color:#333;font-style:italic;text-align:center;margin-bottom:10pt;padding:0 16pt;line-height:1.4}.section{margin-bottom:8pt}.section-title{font-size:10pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5pt;color:#1a1a1a;border-bottom:1px solid #1a1a1a;padding-bottom:2pt;margin-bottom:5pt}.entry{margin-bottom:5pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:700;font-size:10pt}.entry-subtitle{font-size:9.5pt;color:#555}.entry-date{font-size:8.5pt;color:#555;white-space:nowrap}.entry-location{font-size:8.5pt;color:#555;margin-top:1pt}.bullets{padding-left:16pt;margin-top:2pt}.bullets li{font-size:9.5pt;margin-bottom:1pt;line-height:1.35}.skill-category{margin-bottom:3pt}.skill-category-name{font-weight:600;font-size:9.5pt}.skill-tags{display:flex;flex-wrap:wrap;gap:3pt;margin-top:2pt}.skill-tag{font-size:8.5pt;padding:1pt 6pt;border:1px solid #bbb;border-radius:3pt;background:#f5f5f5;color:#333}.cert-entry{margin-bottom:2pt}.cert-name{font-weight:600;font-size:9.5pt}.cert-issuer{font-size:8.5pt;color:#555}@media print{body{padding:0}.resume{padding:.35in .65in}}`
  },
  {
    slug: 'modern',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><div class="two-col"><main class="main-col">{{MAIN_SECTIONS_HTML}}</main><aside class="sidebar-col">{{SIDEBAR_SECTIONS_HTML}}</aside></div></div></body></html>`,
    css: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',system-ui,sans-serif;font-size:9.5pt;line-height:1.35;color:#111827;background:#fff}.resume{max-width:8.5in;margin:0 auto;padding:.4in .55in}.header{margin-bottom:8pt;padding-bottom:6pt;border-bottom:2px solid #2563EB}.name{font-size:22pt;font-weight:700;letter-spacing:-.5pt;color:#111827;margin-bottom:3pt}.contact{font-size:9pt;color:#6B7280;margin-bottom:2pt}.contact .sep{margin:0 6pt;color:#D1D5DB}.links{font-size:9pt}.links a{color:#2563EB;text-decoration:none;font-weight:500}.links .sep{margin:0 5pt;color:#D1D5DB}.summary{font-size:9pt;color:#374151;margin-bottom:10pt;line-height:1.4;padding:6pt 10pt;background:#F9FAFB;border-left:3px solid #2563EB;border-radius:0 4pt 4pt 0}.two-col{display:flex;gap:18pt}.main-col{flex:2.2}.sidebar-col{flex:1;padding-left:12pt;border-left:1px solid #E5E7EB}.section{margin-bottom:8pt}.section-title{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5pt;color:#2563EB;margin-bottom:5pt;padding-bottom:2pt;border-bottom:.75pt solid #E5E7EB}.entry{margin-bottom:5pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:600;font-size:9.5pt}.entry-subtitle{font-size:9pt;color:#6B7280}.entry-date{font-size:8pt;color:#666;white-space:nowrap;font-weight:500}.entry-location{font-size:8pt;color:#666;margin-top:1pt}.bullets{padding-left:12pt;margin-top:2pt}.bullets li{font-size:9pt;margin-bottom:1pt;line-height:1.35;color:#374151}.skill-category{margin-bottom:4pt}.skill-category-name{font-weight:600;font-size:9pt;color:#374151}.skill-tags{display:flex;flex-wrap:wrap;gap:3pt;margin-top:2pt}.skill-tag{font-size:8pt;padding:1pt 6pt;border-radius:99pt;background:#EFF6FF;color:#1D4ED8;font-weight:500}.cert-entry{margin-bottom:2pt}.cert-name{font-weight:600;font-size:9pt}.cert-issuer{font-size:8pt;color:#666}@media print{.resume{padding:.35in .5in}}`
  },
  {
    slug: 'minimal',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><main>{{SECTIONS_HTML}}</main></div></body></html>`,
    css: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',system-ui,sans-serif;font-size:9.5pt;line-height:1.35;color:#000;background:#fff}.resume{max-width:8.5in;margin:0 auto;padding:.4in .75in}.header{margin-bottom:10pt}.name{font-size:22pt;font-weight:700;letter-spacing:-.5pt;color:#000;margin-bottom:4pt}.contact{font-size:9pt;color:#666;margin-bottom:2pt}.contact .sep{margin:0 8pt;color:#ccc}.links{font-size:9pt}.links a{color:#000;text-decoration:underline;text-underline-offset:2pt}.links .sep{margin:0 6pt;color:#ccc}.summary{font-size:9.5pt;color:#333;margin-bottom:10pt;line-height:1.4}.section{margin-bottom:8pt}.section-title{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:2.5pt;color:#777;margin-bottom:6pt}.entry{margin-bottom:5pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1pt}.entry-title{font-weight:600;font-size:9.5pt}.entry-subtitle{font-size:9pt;color:#666}.entry-date{font-size:8.5pt;color:#666;white-space:nowrap}.entry-location{font-size:8.5pt;color:#666}.bullets{padding-left:14pt;margin-top:2pt}.bullets li{font-size:9pt;margin-bottom:1pt;line-height:1.35;color:#333}.skill-category{margin-bottom:3pt}.skill-category-name{font-weight:600;font-size:9pt;color:#333}.skill-tags{display:flex;flex-wrap:wrap;gap:4pt;margin-top:2pt}.skill-tag{font-size:8.5pt;padding:2pt 8pt;border:1px solid #e0e0e0;border-radius:2pt;color:#333}.cert-entry{margin-bottom:2pt}.cert-name{font-weight:600;font-size:9pt}.cert-issuer{font-size:8.5pt;color:#666}@media print{.resume{padding:.35in .65in}}`
  },
  {
    slug: 'executive',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><main>{{SECTIONS_HTML}}</main></div></body></html>`,
    css: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Source Sans 3',sans-serif;font-size:9.5pt;line-height:1.35;color:#1F2937;background:#fff}.resume{max-width:8.5in;margin:0 auto}.header{background:#111827;color:#fff;padding:16pt 28pt 12pt;text-align:center}.name{font-family:'Playfair Display',serif;font-size:20pt;font-weight:700;letter-spacing:1.5pt;text-transform:uppercase;margin-bottom:4pt;color:#fff}.contact{font-size:8.5pt;color:rgba(255,255,255,.7);margin-bottom:2pt}.contact .sep{margin:0 6pt;color:rgba(255,255,255,.3)}.links{font-size:8.5pt}.links a{color:#93C5FD;text-decoration:none}.links .sep{margin:0 5pt;color:rgba(255,255,255,.3)}.summary{font-size:9.5pt;color:#374151;padding:10pt 28pt;margin-bottom:2pt;font-style:italic;line-height:1.4;border-bottom:1px solid #E5E7EB}main{padding:8pt 28pt 16pt}.section{margin-bottom:8pt}.section-title{font-family:'Playfair Display',serif;font-size:10pt;font-weight:700;color:#1E40AF;margin-bottom:5pt;padding-bottom:2pt;border-bottom:1pt solid #1E40AF}.entry{margin-bottom:5pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:600;font-size:9.5pt;color:#111827}.entry-subtitle{font-size:9pt;color:#6B7280}.entry-date{font-size:8pt;color:#666;white-space:nowrap}.entry-location{font-size:8pt;color:#666;margin-top:1pt}.bullets{padding-left:14pt;margin-top:2pt}.bullets li{font-size:9pt;margin-bottom:1pt;line-height:1.35;color:#374151}.skill-category{margin-bottom:3pt}.skill-category-name{font-weight:600;font-size:9pt}.skill-tags{display:flex;flex-wrap:wrap;gap:3pt;margin-top:2pt}.skill-tag{font-size:8pt;padding:1pt 7pt;background:#EFF6FF;color:#1E40AF;border-radius:2pt;font-weight:500}.cert-entry{margin-bottom:2pt}.cert-name{font-weight:600;font-size:9pt}.cert-issuer{font-size:8pt;color:#666}@media print{.header{padding:12pt 24pt 10pt}main{padding:6pt 24pt 12pt}}`
  },
  {
    slug: 'ats-optimized',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><main>{{SECTIONS_HTML}}</main></div></body></html>`,
    css: `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.35;color:#000;background:#fff}.resume{max-width:8.5in;margin:0 auto;padding:.4in .7in}.header{margin-bottom:8pt;padding-bottom:6pt;border-bottom:2px solid #000}.name{font-size:20pt;font-weight:700;color:#000;margin-bottom:3pt}.contact{font-size:9pt;color:#333;margin-bottom:2pt}.contact .sep{margin:0 5pt;color:#999}.links{font-size:9pt}.links a{color:#000;text-decoration:underline}.links .sep{margin:0 5pt;color:#999}.summary{font-size:9.5pt;color:#000;margin-bottom:8pt;line-height:1.4}.section{margin-bottom:8pt}.section-title{font-size:10pt;font-weight:700;text-transform:uppercase;color:#000;border-bottom:1px solid #000;padding-bottom:2pt;margin-bottom:5pt}.entry{margin-bottom:5pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:700;font-size:10pt}.entry-subtitle{font-size:9.5pt;color:#333}.entry-date{font-size:9pt;color:#333;white-space:nowrap}.entry-location{font-size:9pt;color:#333;margin-top:1pt}.bullets{padding-left:16pt;margin-top:2pt}.bullets li{font-size:9.5pt;margin-bottom:1pt;line-height:1.35}.skill-category{margin-bottom:3pt}.skill-category-name{font-weight:700;font-size:9.5pt}.skill-tags{display:inline}.skill-tag{font-size:9.5pt;display:inline}.skill-tag::after{content:", "}.skill-tag:last-child::after{content:""}.cert-entry{margin-bottom:2pt}.cert-name{font-weight:700;font-size:9.5pt}.cert-issuer{font-size:9pt;color:#333}@media print{.resume{padding:.35in .65in}}`
  },
  {
    slug: 'tech',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><div class="header-accent"></div><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><main>{{SECTIONS_HTML}}</main></div></body></html>`,
    css: `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',system-ui,sans-serif;font-size:9.5pt;line-height:1.35;color:#C9D1D9;background:#0D1117}.resume{max-width:8.5in;margin:0 auto;padding:.4in .6in;background:#0D1117}.header{margin-bottom:8pt;padding-bottom:8pt;border-bottom:1px solid #21262D;position:relative}.header-accent{position:absolute;top:0;left:0;width:3pt;height:100%;background:#58A6FF;border-radius:2pt}.name{font-family:'JetBrains Mono',monospace;font-size:20pt;font-weight:700;color:#F0F6FC;margin-bottom:3pt;padding-left:12pt}.contact{font-size:8.5pt;color:#8B949E;padding-left:12pt;margin-bottom:2pt}.contact .sep{margin:0 6pt;color:#30363D}.links{font-size:8.5pt;padding-left:12pt}.links a{color:#58A6FF;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:8pt}.links .sep{margin:0 5pt;color:#30363D}.summary{font-size:9pt;color:#8B949E;margin-bottom:8pt;padding:6pt 10pt;background:#161B22;border:1px solid #21262D;border-radius:4pt;border-left:2px solid #58A6FF;line-height:1.4}.section{margin-bottom:8pt}.section-title{font-family:'JetBrains Mono',monospace;font-size:8.5pt;font-weight:600;text-transform:uppercase;letter-spacing:1.5pt;color:#58A6FF;margin-bottom:5pt;padding-bottom:3pt;border-bottom:1px solid #21262D}.entry{margin-bottom:5pt;padding:5pt 8pt;background:#161B22;border:1px solid #21262D;border-radius:4pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:600;font-size:9.5pt;color:#F0F6FC}.entry-subtitle{font-size:9pt;color:#8B949E}.entry-date{font-family:'JetBrains Mono',monospace;font-size:7.5pt;color:#484F58;white-space:nowrap}.entry-location{font-size:8pt;color:#484F58;margin-top:1pt}.bullets{padding-left:12pt;margin-top:2pt}.bullets li{font-size:9pt;margin-bottom:1pt;line-height:1.35;color:#C9D1D9}.skill-category{margin-bottom:3pt}.skill-category-name{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:8.5pt;color:#F0F6FC}.skill-tags{display:flex;flex-wrap:wrap;gap:3pt;margin-top:2pt}.skill-tag{font-family:'JetBrains Mono',monospace;font-size:7.5pt;padding:2pt 6pt;background:#1F6FEB20;color:#58A6FF;border:1px solid #1F6FEB40;border-radius:3pt;font-weight:500}.cert-entry{margin-bottom:2pt;padding:3pt 8pt;background:#161B22;border:1px solid #21262D;border-radius:3pt}.cert-name{font-weight:600;font-size:9pt;color:#F0F6FC}.cert-issuer{font-size:8pt;color:#484F58}@media print{body{background:#fff;color:#000}.resume{background:#fff;padding:.35in .55in}.header-accent{background:#2563EB}.name,.entry-title,.cert-name,.skill-category-name{color:#000}.contact,.links a,.entry-subtitle,.entry-date,.entry-location,.cert-issuer,.bullets li,.summary{color:#333}.section-title,.skill-tag{color:#2563EB}.entry,.cert-entry,.summary{background:#f8f8f8;border-color:#e0e0e0}.skill-tag{background:#EFF6FF;border-color:#BFDBFE}}`
  }
];

(async () => {
  const pool = await sql.connect(config);
  
  for (const t of TEMPLATES) {
    const result = await pool.request()
      .input('slug', sql.NVarChar, t.slug)
      .input('html', sql.NVarChar(sql.MAX), t.html)
      .input('css', sql.NVarChar(sql.MAX), t.css)
      .query(`
        UPDATE ResumeBuilderTemplates 
        SET HtmlTemplate = @html, CssTemplate = @css, UpdatedAt = GETUTCDATE()
        WHERE Slug = @slug
      `);
    console.log(`✅ ${t.slug}: ${result.rowsAffected[0]} row(s) updated`);
  }
  
  console.log('\n🎉 All templates updated!');
  
  // ═══════════════════════════════════════════════════════════
  // INSERT NEW TEMPLATES (skip if already exist)
  // ═══════════════════════════════════════════════════════════
  const newTemplates = [
    {
      name: 'Elegant', slug: 'elegant', category: 'Professional',
      description: 'Sophisticated design with teal accents and clean typography. Perfect for creative professionals.',
      isPremium: false, sortOrder: 7,
      config: '{"fontFamily":"Lora, Georgia, serif","fontSize":"9.5pt","lineHeight":"1.35","primaryColor":"#1a1a1a","accentColor":"#0D9488","marginTop":"0.4in","marginSide":"0.7in","showPhoto":false}',
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><main>{{SECTIONS_HTML}}</main></div></body></html>`,
      css: `@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Nunito+Sans:wght@400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Nunito Sans',sans-serif;font-size:9.5pt;line-height:1.35;color:#1a1a1a;background:#fff}.resume{max-width:8.5in;margin:0 auto;padding:.4in .7in}.header{text-align:center;margin-bottom:10pt;padding-bottom:8pt;border-bottom:2pt solid #0D9488}.name{font-family:'Lora',serif;font-size:24pt;font-weight:700;color:#0D9488;margin-bottom:4pt;letter-spacing:.5pt}.contact{font-size:9pt;color:#555;margin-bottom:2pt}.contact .sep{margin:0 6pt;color:#ccc}.links{font-size:9pt}.links a{color:#0D9488;text-decoration:none;font-weight:600}.links .sep{margin:0 5pt;color:#ccc}.summary{font-size:9.5pt;color:#333;margin-bottom:10pt;text-align:center;line-height:1.45;padding:0 20pt}.section{margin-bottom:8pt}.section-title{font-family:'Lora',serif;font-size:10pt;font-weight:700;color:#0D9488;text-transform:uppercase;letter-spacing:1.5pt;border-bottom:1pt solid #0D9488;padding-bottom:2pt;margin-bottom:5pt}.entry{margin-bottom:5pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:700;font-size:9.5pt;color:#1a1a1a}.entry-subtitle{font-size:9pt;color:#555}.entry-date{font-size:8pt;color:#888;white-space:nowrap}.entry-location{font-size:8pt;color:#888}.bullets{padding-left:14pt;margin-top:2pt}.bullets li{font-size:9pt;margin-bottom:1pt;line-height:1.35;color:#333}.skill-category{margin-bottom:3pt}.skill-category-name{font-weight:600;font-size:9pt;color:#1a1a1a}.skill-tags{display:flex;flex-wrap:wrap;gap:3pt;margin-top:2pt}.skill-tag{font-size:8pt;padding:2pt 7pt;background:#F0FDFA;color:#0D9488;border:1px solid #99F6E4;border-radius:99pt;font-weight:500}.cert-entry{margin-bottom:2pt}.cert-name{font-weight:600;font-size:9pt}.cert-issuer{font-size:8pt;color:#888}@media print{.resume{padding:.35in .65in}}`
    },
    {
      name: 'Bold', slug: 'bold', category: 'Creative',
      description: 'Strong left accent bar with bold section headers. Stands out while staying professional.',
      isPremium: false, sortOrder: 8,
      config: '{"fontFamily":"Poppins, sans-serif","fontSize":"9.5pt","lineHeight":"1.35","primaryColor":"#111","accentColor":"#E11D48","marginTop":"0.4in","marginSide":"0.65in","showPhoto":false}',
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><main>{{SECTIONS_HTML}}</main></div></body></html>`,
      css: `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Poppins',sans-serif;font-size:9.5pt;line-height:1.35;color:#111;background:#fff}.resume{max-width:8.5in;margin:0 auto;padding:.4in .65in;border-left:5pt solid #E11D48}.header{margin-bottom:10pt;padding-bottom:6pt}.name{font-size:24pt;font-weight:800;color:#111;letter-spacing:-.5pt;margin-bottom:3pt}.contact{font-size:8.5pt;color:#555;margin-bottom:2pt}.contact .sep{margin:0 6pt;color:#ddd}.links{font-size:8.5pt}.links a{color:#E11D48;text-decoration:none;font-weight:600}.links .sep{margin:0 5pt;color:#ddd}.summary{font-size:9pt;color:#444;margin-bottom:10pt;line-height:1.45;padding-left:10pt;border-left:3pt solid #E11D48}.section{margin-bottom:8pt}.section-title{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:2pt;color:#E11D48;margin-bottom:5pt;padding-bottom:2pt}.entry{margin-bottom:5pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:700;font-size:9.5pt;color:#111}.entry-subtitle{font-size:9pt;color:#555}.entry-date{font-size:8pt;color:#888;white-space:nowrap;font-weight:500}.entry-location{font-size:8pt;color:#888}.bullets{padding-left:14pt;margin-top:2pt}.bullets li{font-size:9pt;margin-bottom:1pt;line-height:1.35;color:#333}.skill-category{margin-bottom:3pt}.skill-category-name{font-weight:600;font-size:9pt}.skill-tags{display:flex;flex-wrap:wrap;gap:3pt;margin-top:2pt}.skill-tag{font-size:8pt;padding:2pt 7pt;background:#FFF1F2;color:#BE123C;border-radius:3pt;font-weight:500}.cert-entry{margin-bottom:2pt}.cert-name{font-weight:600;font-size:9pt}.cert-issuer{font-size:8pt;color:#888}@media print{.resume{border-left-width:3pt;padding:.35in .6in}}`
    },
    {
      name: 'Compact', slug: 'compact', category: 'ATS-Friendly',
      description: 'Maximum content in minimum space. Two-column layout with inline skills. Great for experienced professionals.',
      isPremium: false, sortOrder: 9,
      config: '{"fontFamily":"Roboto, sans-serif","fontSize":"9pt","lineHeight":"1.3","primaryColor":"#222","accentColor":"#4F46E5","marginTop":"0.35in","marginSide":"0.5in","showPhoto":false,"layout":"two-column"}',
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><div class="two-col"><main class="main-col">{{MAIN_SECTIONS_HTML}}</main><aside class="sidebar-col">{{SIDEBAR_SECTIONS_HTML}}</aside></div></div></body></html>`,
      css: `@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Roboto',sans-serif;font-size:9pt;line-height:1.3;color:#222;background:#fff}.resume{max-width:8.5in;margin:0 auto;padding:.35in .5in}.header{margin-bottom:6pt;padding-bottom:5pt;border-bottom:2px solid #4F46E5}.name{font-size:20pt;font-weight:700;color:#222;margin-bottom:2pt}.contact{font-size:8.5pt;color:#555;margin-bottom:1pt}.contact .sep{margin:0 4pt;color:#ccc}.links{font-size:8.5pt}.links a{color:#4F46E5;text-decoration:none;font-weight:500}.links .sep{margin:0 4pt;color:#ccc}.summary{font-size:8.5pt;color:#444;margin-bottom:8pt;line-height:1.35}.two-col{display:flex;gap:14pt}.main-col{flex:2.5}.sidebar-col{flex:1;padding-left:10pt;border-left:1px solid #E5E7EB}.section{margin-bottom:6pt}.section-title{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1pt;color:#4F46E5;margin-bottom:4pt;padding-bottom:1pt;border-bottom:.5pt solid #E5E7EB}.entry{margin-bottom:4pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:700;font-size:9pt}.entry-subtitle{font-size:8.5pt;color:#666}.entry-date{font-size:7.5pt;color:#666;white-space:nowrap}.entry-location{font-size:7.5pt;color:#666}.bullets{padding-left:12pt;margin-top:1pt}.bullets li{font-size:8.5pt;margin-bottom:1pt;line-height:1.3;color:#333}.skill-category{margin-bottom:3pt}.skill-category-name{font-weight:700;font-size:8.5pt;color:#222}.skill-tags{display:flex;flex-wrap:wrap;gap:3pt;margin-top:2pt}.skill-tag{font-size:7.5pt;padding:1pt 5pt;background:#EEF2FF;color:#4338CA;border-radius:2pt;font-weight:500}.cert-entry{margin-bottom:2pt}.cert-name{font-weight:700;font-size:8.5pt}.cert-issuer{font-size:7.5pt;color:#666}@media print{.resume{padding:.3in .45in}}`
    },
    {
      name: 'Professional', slug: 'professional', category: 'Professional',
      description: 'Navy blue header with gold accents. Polished and corporate-ready for senior roles.',
      isPremium: true, sortOrder: 10,
      config: '{"fontFamily":"Crimson Pro, Georgia, serif","fontSize":"9.5pt","lineHeight":"1.35","primaryColor":"#1B2A4A","accentColor":"#B8860B","marginTop":"0in","marginSide":"0.6in","showPhoto":false}',
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><main>{{SECTIONS_HTML}}</main></div></body></html>`,
      css: `@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Nunito Sans',sans-serif;font-size:9.5pt;line-height:1.35;color:#1B2A4A;background:#fff}.resume{max-width:8.5in;margin:0 auto}.header{background:#1B2A4A;color:#fff;padding:16pt 28pt 12pt;border-bottom:3pt solid #B8860B}.name{font-family:'Crimson Pro',serif;font-size:22pt;font-weight:700;color:#fff;letter-spacing:1pt;margin-bottom:4pt}.contact{font-size:8.5pt;color:rgba(255,255,255,.75);margin-bottom:2pt}.contact .sep{margin:0 6pt;color:rgba(255,255,255,.3)}.links{font-size:8.5pt}.links a{color:#F5DEB3;text-decoration:none}.links .sep{margin:0 5pt;color:rgba(255,255,255,.3)}.summary{font-size:9.5pt;color:#333;padding:10pt 28pt;margin-bottom:2pt;line-height:1.4;border-bottom:1px solid #E5E7EB}main{padding:8pt 28pt 16pt}.section{margin-bottom:8pt}.section-title{font-family:'Crimson Pro',serif;font-size:10pt;font-weight:700;color:#B8860B;text-transform:uppercase;letter-spacing:1pt;margin-bottom:5pt;padding-bottom:2pt;border-bottom:1pt solid #B8860B}.entry{margin-bottom:5pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:700;font-size:9.5pt;color:#1B2A4A}.entry-subtitle{font-size:9pt;color:#555}.entry-date{font-size:8pt;color:#888;white-space:nowrap}.entry-location{font-size:8pt;color:#888}.bullets{padding-left:14pt;margin-top:2pt}.bullets li{font-size:9pt;margin-bottom:1pt;line-height:1.35;color:#333}.skill-category{margin-bottom:3pt}.skill-category-name{font-weight:600;font-size:9pt}.skill-tags{display:flex;flex-wrap:wrap;gap:3pt;margin-top:2pt}.skill-tag{font-size:8pt;padding:2pt 7pt;background:#FDF8EC;color:#92400E;border:1px solid #F5DEB3;border-radius:2pt;font-weight:500}.cert-entry{margin-bottom:2pt}.cert-name{font-weight:600;font-size:9pt}.cert-issuer{font-size:8pt;color:#888}@media print{.header{padding:12pt 24pt 10pt}main{padding:6pt 24pt 12pt}}`
    }
  ];

  for (const t of newTemplates) {
    // Check if exists
    const existing = await pool.request()
      .input('slug', sql.NVarChar, t.slug)
      .query('SELECT TemplateID FROM ResumeBuilderTemplates WHERE Slug = @slug');
    
    if (existing.recordset.length > 0) {
      // Update
      await pool.request()
        .input('slug', sql.NVarChar, t.slug)
        .input('html', sql.NVarChar(sql.MAX), t.html)
        .input('css', sql.NVarChar(sql.MAX), t.css)
        .input('config', sql.NVarChar(sql.MAX), t.config)
        .input('desc', sql.NVarChar, t.description)
        .query('UPDATE ResumeBuilderTemplates SET HtmlTemplate=@html,CssTemplate=@css,DefaultConfig=@config,Description=@desc,UpdatedAt=GETUTCDATE() WHERE Slug=@slug');
      console.log(`🔄 ${t.slug}: updated`);
    } else {
      // Insert
      await pool.request()
        .input('name', sql.NVarChar, t.name)
        .input('slug', sql.NVarChar, t.slug)
        .input('category', sql.NVarChar, t.category)
        .input('desc', sql.NVarChar, t.description)
        .input('premium', sql.Bit, t.isPremium ? 1 : 0)
        .input('order', sql.Int, t.sortOrder)
        .input('config', sql.NVarChar(sql.MAX), t.config)
        .input('html', sql.NVarChar(sql.MAX), t.html)
        .input('css', sql.NVarChar(sql.MAX), t.css)
        .query('INSERT INTO ResumeBuilderTemplates (Name,Slug,Category,Description,IsPremium,SortOrder,DefaultConfig,HtmlTemplate,CssTemplate) VALUES (@name,@slug,@category,@desc,@premium,@order,@config,@html,@css)');
      console.log(`✨ ${t.slug}: INSERTED (new template!)`);
    }
  }

  console.log('\n🎉 All done! 10 templates total.');
  pool.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
