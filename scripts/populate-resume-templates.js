/**
 * Resume Template Populator — v2 (March 2026)
 * 
 * Updates HTML + CSS + metadata for all 10 resume templates in the DB.
 * 
 * Design principles:
 *   - 10pt+ body text on ALL templates (readable in print)
 *   - 0.5in+ margins (no printer clipping)
 *   - break-inside: avoid on entries (no mid-page splits)
 *   - Consistent CSS class names across all templates
 *   - Google Fonts for premium typography
 *   - @media print overrides on every template
 *   - Role-specific naming so users know which to pick
 * 
 * Templates:
 *   1. Classic     — Finance, Law, Government, Banking
 *   2. Modern      — Product, Business, Marketing
 *   3. Minimal     — Startups, Consulting, Design
 *   4. Executive   — Directors, VPs, C-suite (Premium)
 *   5. ATS-Safe    — Fortune 500, Mass applications
 *   6. Developer   — Engineers, DevOps, Data Scientists
 *   7. Elegant     — HR, Healthcare, Education
 *   8. Creative    — Marketing, Media, Brand roles
 *   9. Academic    — Researchers, PhDs, Professors
 *  10. Corporate   — Consulting, Big 4, Strategy (Premium)
 * 
 * Usage:
 *   node scripts/populate-resume-templates.js          (uses local.settings.json → dev)
 *   DB_SERVER=xxx DB_PASSWORD=xxx node scripts/populate-resume-templates.js  (explicit)
 */
const sql = require('mssql');
const { getDbConfig } = require('./utils/db-config');
const config = getDbConfig();

// ── Shared Google Fonts link ──
const FONTS_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&family=Merriweather:wght@300;400;700&family=JetBrains+Mono:wght@400;500;600&family=Poppins:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Nunito+Sans:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">';

// ── HTML wrapper ──
function wrap(bodyHtml) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>{{TITLE}}</title>\n' + FONTS_LINK + '\n<style>{{STYLES}}</style>\n</head>\n<body>\n' + bodyHtml + '\n</body>\n</html>';
}

// ── Shared base reset + print rules (prepended to every CSS) ──
const BASE = '*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; } @page { size: A4; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .entry { break-inside: avoid; } .section { break-inside: avoid; } .header { break-inside: avoid; } } ';

const templates = [

  // ════════════════════════════════════════════════════════════
  // 1. CLASSIC — Finance, Law, Government, Banking
  // ════════════════════════════════════════════════════════════
  {
    slug: 'classic',
    name: 'Classic',
    category: 'Professional',
    description: 'Traditional serif layout. Ideal for Finance, Law, Government & Banking roles.',
    searchTags: 'serif traditional clean timeless ats-friendly single-column professional formal finance law government banking conservative classic',
    isPremium: false,
    sortOrder: 1,
    defaultConfig: '{"fontFamily":"Crimson Pro, Georgia, serif","fontSize":"11pt","lineHeight":"1.45","primaryColor":"#1a1a1a","accentColor":"#2563EB","marginTop":"0.65in","marginSide":"0.75in","showPhoto":false}',
    html: wrap('<div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="summary-block">{{SUMMARY_TEXT}}</div><main class="content">{{SECTIONS_HTML}}</main></div>'),
    css: BASE + 'body { font-family: "Crimson Pro", Georgia, "Times New Roman", serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; background: #fff; -webkit-font-smoothing: antialiased; } .resume { max-width: 8.5in; margin: 0 auto; padding: 0.65in 0.75in; } .header { text-align: center; margin-bottom: 16pt; border-bottom: 1.5pt solid #1a1a1a; padding-bottom: 12pt; } .name { font-size: 26pt; font-weight: 600; letter-spacing: 0.5pt; color: #1a1a1a; margin-bottom: 6pt; } .contact-line { font-size: 10pt; color: #444; margin-bottom: 4pt; } .contact-line .sep { margin: 0 8pt; color: #bbb; } .links-line { font-size: 10pt; } .links-line a { color: #2563EB; text-decoration: none; } .links-line .sep { margin: 0 6pt; color: #bbb; } .summary-block { font-size: 10.5pt; color: #333; font-style: italic; margin-bottom: 18pt; line-height: 1.55; padding: 0 4pt; } .section { margin-bottom: 16pt; } .section-title { font-size: 12pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5pt; color: #1a1a1a; border-bottom: 0.75pt solid #ccc; padding-bottom: 4pt; margin-bottom: 10pt; } .entry { margin-bottom: 12pt; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: 600; font-size: 11pt; } .entry-subtitle { font-size: 10.5pt; color: #555; } .entry-date { font-size: 10pt; color: #666; white-space: nowrap; } .entry-location { font-size: 10pt; color: #666; margin-top: 1pt; } .bullets { margin: 4pt 0 0 18pt; } .bullets li { font-size: 10.5pt; line-height: 1.5; margin-bottom: 3pt; color: #222; } .skill-category { margin-bottom: 8pt; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4pt; } .skill-category-name { font-weight: 600; font-size: 10.5pt; margin-right: 4pt; } .skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; } .skill-tag { font-size: 10pt; padding: 2pt 8pt; background: #f3f4f6; border: 0.5pt solid #e5e7eb; border-radius: 3pt; color: #374151; } .cert-entry { margin-bottom: 5pt; font-size: 10.5pt; } .cert-name { font-weight: 600; } .cert-issuer { color: #555; }'
  },

  // ════════════════════════════════════════════════════════════
  // 2. MODERN — Product, Business, Marketing
  // ════════════════════════════════════════════════════════════
  {
    slug: 'modern',
    name: 'Modern',
    category: 'Professional',
    description: 'Two-column with skills sidebar. Great for Product, Business & Marketing roles.',
    searchTags: 'sans-serif modern blue two-column sidebar skills-panel clean inter contemporary professional product business marketing',
    isPremium: true,
    sortOrder: 2,
    defaultConfig: '{"fontFamily":"Inter, Helvetica, sans-serif","fontSize":"10.5pt","lineHeight":"1.45","primaryColor":"#111827","accentColor":"#2563EB","marginTop":"0.5in","marginSide":"0in","showPhoto":false,"layout":"two-column"}',
    html: wrap('<div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="summary-block">{{SUMMARY_TEXT}}</div><div class="two-col"><main class="main-col">{{MAIN_SECTIONS_HTML}}</main><aside class="sidebar-col">{{SIDEBAR_SECTIONS_HTML}}</aside></div></div>'),
    css: BASE + 'body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 10.5pt; line-height: 1.45; color: #111827; background: #fff; -webkit-font-smoothing: antialiased; } .resume { max-width: 8.5in; margin: 0 auto; padding: 0.5in 0.6in; } .header { text-align: center; padding-bottom: 16pt; margin-bottom: 16pt; background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); margin: -0.5in -0.6in 16pt -0.6in; padding: 0.5in 0.6in 16pt 0.6in; } .name { font-size: 26pt; font-weight: 700; color: #1E3A5F; letter-spacing: -0.5pt; margin-bottom: 6pt; } .contact-line { font-size: 10pt; color: #4B5563; margin-bottom: 4pt; } .contact-line .sep { margin: 0 8pt; color: #9CA3AF; } .links-line { font-size: 10pt; } .links-line a { color: #2563EB; text-decoration: none; font-weight: 500; } .links-line .sep { margin: 0 6pt; color: #9CA3AF; } .summary-block { font-size: 10.5pt; color: #374151; margin-bottom: 18pt; line-height: 1.55; border-left: 3pt solid #2563EB; padding-left: 12pt; } .two-col { display: flex; gap: 24pt; } .main-col { flex: 7; } .sidebar-col { flex: 3; border-left: 1pt solid #E5E7EB; padding-left: 16pt; } .section { margin-bottom: 16pt; } .section-title { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2pt; color: #1E3A5F; border-bottom: 2pt solid #2563EB; padding-bottom: 4pt; margin-bottom: 10pt; display: inline-block; } .entry { margin-bottom: 12pt; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: 600; font-size: 10.5pt; color: #111827; } .entry-subtitle { font-size: 10pt; color: #6B7280; } .entry-date { font-size: 9.5pt; color: #2563EB; font-weight: 500; white-space: nowrap; } .entry-location { font-size: 9.5pt; color: #6B7280; margin-top: 1pt; } .bullets { margin: 4pt 0 0 16pt; } .bullets li { font-size: 10pt; line-height: 1.45; margin-bottom: 3pt; color: #374151; } .skill-category { margin-bottom: 10pt; } .skill-category-name { font-weight: 600; font-size: 10pt; color: #1E3A5F; display: block; margin-bottom: 5pt; } .skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; } .skill-tag { font-size: 9pt; padding: 3pt 9pt; background: #EEF2FF; color: #3B52A5; border-radius: 10pt; font-weight: 500; } .cert-entry { margin-bottom: 6pt; font-size: 10pt; } .cert-name { font-weight: 600; } .cert-issuer { color: #6B7280; font-size: 10pt; }'
  },

  // ════════════════════════════════════════════════════════════
  // 3. MINIMAL — Startups, Consulting, Design
  // ════════════════════════════════════════════════════════════
  {
    slug: 'minimal',
    name: 'Minimal',
    category: 'Professional',
    description: 'Clean whitespace-heavy design. Popular with Startup, Consulting & Design roles.',
    searchTags: 'minimal clean whitespace simple elegant developer minimalist startup consulting design ux light spacious less-is-more',
    isPremium: true,
    sortOrder: 3,
    defaultConfig: '{"fontFamily":"system-ui, -apple-system, sans-serif","fontSize":"10.5pt","lineHeight":"1.55","primaryColor":"#000000","accentColor":"#6B7280","marginTop":"0.7in","marginSide":"0.85in","showPhoto":false}',
    html: wrap('<div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="summary-block">{{SUMMARY_TEXT}}</div><main class="content">{{SECTIONS_HTML}}</main></div>'),
    css: BASE + 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #000; background: #fff; -webkit-font-smoothing: antialiased; } .resume { max-width: 8.5in; margin: 0 auto; padding: 0.7in 0.85in; } .header { margin-bottom: 22pt; } .name { font-size: 28pt; font-weight: 300; letter-spacing: -0.5pt; color: #000; margin-bottom: 8pt; } .contact-line { font-size: 10pt; color: #666; } .contact-line .sep { margin: 0 10pt; color: #ccc; } .links-line { font-size: 10pt; margin-top: 4pt; } .links-line a { color: #000; text-decoration: none; border-bottom: 0.5pt solid #999; padding-bottom: 0.5pt; } .links-line .sep { margin: 0 8pt; color: #ccc; } .summary-block { font-size: 10.5pt; color: #444; margin-bottom: 24pt; line-height: 1.6; } .section { margin-bottom: 20pt; } .section-title { font-size: 9.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 2.5pt; color: #999; margin-bottom: 12pt; } .entry { margin-bottom: 14pt; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: 600; font-size: 10.5pt; } .entry-subtitle { font-size: 10pt; color: #666; font-weight: 400; } .entry-date { font-size: 9.5pt; color: #999; white-space: nowrap; } .entry-location { font-size: 9.5pt; color: #999; margin-top: 2pt; } .bullets { margin: 5pt 0 0 16pt; } .bullets li { font-size: 10.5pt; line-height: 1.55; margin-bottom: 4pt; color: #333; } .skill-category { margin-bottom: 8pt; display: flex; flex-wrap: wrap; align-items: baseline; gap: 5pt; } .skill-category-name { font-weight: 600; font-size: 10pt; color: #333; margin-right: 6pt; } .skill-tags { display: flex; flex-wrap: wrap; gap: 8pt; } .skill-tag { font-size: 10pt; color: #555; padding: 0; } .cert-entry { margin-bottom: 5pt; font-size: 10.5pt; } .cert-name { font-weight: 500; } .cert-issuer { color: #999; }'
  },

  // ════════════════════════════════════════════════════════════
  // 4. EXECUTIVE — Directors, VPs, C-suite (PREMIUM)
  // ════════════════════════════════════════════════════════════
  {
    slug: 'executive',
    name: 'Executive',
    category: 'Premium',
    description: 'Dark header with authority. Built for Directors, VPs & C-suite leaders.',
    searchTags: 'executive dark-header serif leadership corporate enterprise senior premium navy formal c-suite director vp merriweather',
    isPremium: true,
    sortOrder: 4,
    defaultConfig: '{"fontFamily":"Merriweather, Georgia, serif","fontSize":"10.5pt","lineHeight":"1.5","primaryColor":"#1F2937","accentColor":"#1E40AF","headerBg":"#111827","headerText":"#FFFFFF","marginTop":"0in","marginSide":"0.65in","showPhoto":false}',
    html: wrap('<div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="body-content"><div class="summary-block">{{SUMMARY_TEXT}}</div><main class="content">{{SECTIONS_HTML}}</main></div></div>'),
    css: BASE + 'body { font-family: "Merriweather", Georgia, serif; font-size: 10.5pt; line-height: 1.5; color: #1F2937; background: #fff; -webkit-font-smoothing: antialiased; } .resume { max-width: 8.5in; margin: 0 auto; } .header { background: #111827; color: #fff; padding: 0.55in 0.65in 0.4in; text-align: center; } .name { font-size: 26pt; font-weight: 700; letter-spacing: 1pt; margin-bottom: 8pt; color: #F9FAFB; } .contact-line { font-size: 10pt; color: #D1D5DB; margin-bottom: 4pt; } .contact-line .sep { margin: 0 10pt; color: #6B7280; } .links-line { font-size: 10pt; } .links-line a { color: #93C5FD; text-decoration: none; } .links-line .sep { margin: 0 6pt; color: #6B7280; } .body-content { padding: 0.15in 0.65in 0.55in; } .summary-block { font-size: 10.5pt; color: #374151; line-height: 1.55; margin: 18pt 0 18pt; border-left: 3pt solid #1E40AF; padding-left: 14pt; } .section { margin-bottom: 16pt; } .section-title { font-size: 11.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5pt; color: #111827; border-bottom: 2pt solid #1E40AF; padding-bottom: 4pt; margin-bottom: 10pt; } .entry { margin-bottom: 12pt; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: 700; font-size: 11pt; color: #111827; } .entry-subtitle { font-size: 10.5pt; color: #4B5563; } .entry-date { font-size: 10pt; color: #1E40AF; font-weight: 600; white-space: nowrap; } .entry-location { font-size: 10pt; color: #6B7280; margin-top: 1pt; font-style: italic; } .bullets { margin: 5pt 0 0 18pt; } .bullets li { font-size: 10.5pt; line-height: 1.5; margin-bottom: 3pt; color: #1F2937; } .skill-category { margin-bottom: 10pt; display: flex; flex-wrap: wrap; align-items: baseline; gap: 5pt; } .skill-category-name { font-weight: 700; font-size: 10.5pt; color: #111827; margin-right: 6pt; } .skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; } .skill-tag { font-size: 10pt; padding: 3pt 10pt; background: #F3F4F6; border: 0.5pt solid #D1D5DB; border-radius: 3pt; color: #1F2937; font-weight: 500; } .cert-entry { margin-bottom: 6pt; font-size: 10.5pt; } .cert-name { font-weight: 700; } .cert-issuer { color: #4B5563; }'
  },

  // ════════════════════════════════════════════════════════════
  // 5. ATS-SAFE — Fortune 500, Mass applications
  // ════════════════════════════════════════════════════════════
  {
    slug: 'ats-optimized',
    name: 'ATS-Safe',
    category: 'ATS-Friendly',
    description: 'Zero design — 100% ATS parsable. Use for Fortune 500 & mass applications.',
    searchTags: 'ats ats-friendly ats-optimized plain simple no-graphics parsable recruiter-friendly applicant-tracking arial safe compatible fortune-500',
    isPremium: true,
    sortOrder: 5,
    defaultConfig: '{"fontFamily":"Arial, sans-serif","fontSize":"11pt","lineHeight":"1.45","primaryColor":"#000000","accentColor":"#000000","marginTop":"0.5in","marginSide":"0.75in","showPhoto":false}',
    html: wrap('<div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="summary-block">{{SUMMARY_TEXT}}</div><main class="content">{{SECTIONS_HTML}}</main></div>'),
    css: BASE + 'body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.45; color: #000; background: #fff; } .resume { max-width: 8.5in; margin: 0 auto; padding: 0.5in 0.75in; } .header { text-align: center; margin-bottom: 14pt; padding-bottom: 10pt; border-bottom: 1pt solid #000; } .name { font-size: 22pt; font-weight: bold; margin-bottom: 5pt; } .contact-line { font-size: 10.5pt; margin-bottom: 3pt; } .contact-line .sep { margin: 0 6pt; } .links-line { font-size: 10.5pt; } .links-line a { color: #000; text-decoration: underline; } .links-line .sep { margin: 0 6pt; } .summary-block { font-size: 10.5pt; margin-bottom: 16pt; line-height: 1.5; } .section { margin-bottom: 14pt; } .section-title { font-size: 12pt; font-weight: bold; text-transform: uppercase; border-bottom: 1pt solid #000; padding-bottom: 3pt; margin-bottom: 8pt; } .entry { margin-bottom: 10pt; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: bold; font-size: 11pt; } .entry-subtitle { font-size: 10.5pt; } .entry-date { font-size: 10pt; white-space: nowrap; } .entry-location { font-size: 10pt; } .bullets { margin: 4pt 0 0 18pt; } .bullets li { font-size: 10.5pt; line-height: 1.45; margin-bottom: 3pt; } .skill-category { margin-bottom: 5pt; } .skill-category-name { font-weight: bold; font-size: 10.5pt; } .skill-tags { display: inline; } .skill-tag { font-size: 10.5pt; } .skill-tag::after { content: ", "; } .skill-tag:last-child::after { content: ""; } .cert-entry { margin-bottom: 4pt; font-size: 10.5pt; } .cert-name { font-weight: bold; }'
  },

  // ════════════════════════════════════════════════════════════
  // 6. DEVELOPER — Engineers, DevOps, Data Scientists
  //    (Light theme — print-safe, monospace accents, card sections)
  // ════════════════════════════════════════════════════════════
  {
    slug: 'tech',
    name: 'Developer',
    category: 'Technical',
    description: 'Monospace accents & card sections. Made for Engineers, DevOps & Data Scientists.',
    searchTags: 'tech developer github monospace code engineering jetbrains programmer software-engineer devops data-scientist terminal technical',
    isPremium: true,
    sortOrder: 6,
    defaultConfig: '{"fontFamily":"Inter, sans-serif","fontSize":"10.5pt","lineHeight":"1.45","primaryColor":"#1F2937","accentColor":"#2563EB","marginTop":"0.5in","marginSide":"0.6in","showPhoto":false}',
    html: wrap('<div class="resume"><header class="header"><div class="header-prefix">&gt;_</div><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="summary-block">{{SUMMARY_TEXT}}</div><main class="content">{{SECTIONS_HTML}}</main></div>'),
    css: BASE + 'body { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1F2937; background: #fff; -webkit-font-smoothing: antialiased; } .resume { max-width: 8.5in; margin: 0 auto; padding: 0.5in 0.6in; } .header { border: 1.5pt solid #E5E7EB; border-radius: 8pt; padding: 18pt 22pt; margin-bottom: 16pt; background: #F9FAFB; text-align: center; } .header-prefix { font-family: "JetBrains Mono", "Fira Code", monospace; font-size: 11pt; color: #2563EB; margin-bottom: 4pt; } .name { font-family: "JetBrains Mono", monospace; font-size: 24pt; font-weight: 600; color: #111827; letter-spacing: -0.5pt; margin-bottom: 8pt; } .contact-line { font-size: 10pt; color: #6B7280; } .contact-line .sep { margin: 0 8pt; color: #D1D5DB; } .links-line { font-size: 10pt; margin-top: 4pt; } .links-line a { color: #2563EB; text-decoration: none; font-family: "JetBrains Mono", monospace; font-size: 9.5pt; } .links-line .sep { margin: 0 6pt; color: #D1D5DB; } .summary-block { font-size: 10.5pt; color: #4B5563; margin-bottom: 18pt; padding: 12pt 16pt; background: #F9FAFB; border-left: 3pt solid #2563EB; border-radius: 4pt; line-height: 1.55; } .section { margin-bottom: 16pt; border: 1pt solid #E5E7EB; border-radius: 8pt; padding: 14pt 18pt; background: #FAFAFA; } .section-title { font-family: "JetBrains Mono", monospace; font-size: 10.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5pt; color: #2563EB; margin-bottom: 10pt; padding-bottom: 6pt; border-bottom: 1pt solid #E5E7EB; } .entry { margin-bottom: 12pt; padding-bottom: 10pt; border-bottom: 1pt solid #F3F4F6; } .entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: 600; font-size: 10.5pt; color: #111827; } .entry-subtitle { font-size: 10pt; color: #6B7280; } .entry-date { font-family: "JetBrains Mono", monospace; font-size: 9pt; color: #2563EB; white-space: nowrap; background: #EEF2FF; padding: 2pt 8pt; border-radius: 10pt; } .entry-location { font-size: 9.5pt; color: #6B7280; margin-top: 2pt; } .bullets { margin: 5pt 0 0 16pt; } .bullets li { font-size: 10pt; line-height: 1.45; margin-bottom: 3pt; color: #374151; } .skill-category { margin-bottom: 10pt; } .skill-category-name { font-family: "JetBrains Mono", monospace; font-weight: 600; font-size: 10pt; color: #111827; display: block; margin-bottom: 5pt; } .skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; } .skill-tag { font-family: "JetBrains Mono", monospace; font-size: 9pt; padding: 3pt 10pt; background: #ECFDF5; color: #065F46; border: 1pt solid #A7F3D0; border-radius: 12pt; font-weight: 500; } .cert-entry { margin-bottom: 6pt; font-size: 10pt; } .cert-name { font-weight: 600; color: #111827; } .cert-issuer { color: #6B7280; }'
  },

  // ════════════════════════════════════════════════════════════
  // 7. ELEGANT — HR, Healthcare, Education
  // ════════════════════════════════════════════════════════════
  {
    slug: 'elegant',
    name: 'Elegant',
    category: 'Professional',
    description: 'Refined serif headings with teal accent. Fits HR, Healthcare & Education roles.',
    searchTags: 'elegant teal sophisticated creative serif lora healthcare hr education administrative refined classy polished warm',
    isPremium: true,
    sortOrder: 7,
    defaultConfig: '{"fontFamily":"Nunito Sans, sans-serif","fontSize":"10.5pt","lineHeight":"1.5","primaryColor":"#1a1a1a","accentColor":"#0D9488","marginTop":"0.5in","marginSide":"0.7in","showPhoto":false}',
    html: wrap('<div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="summary-block">{{SUMMARY_TEXT}}</div><main class="content">{{SECTIONS_HTML}}</main></div>'),
    css: BASE + 'body { font-family: "Nunito Sans", -apple-system, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1a1a1a; background: #fff; -webkit-font-smoothing: antialiased; } .resume { max-width: 8.5in; margin: 0 auto; padding: 0.5in 0.7in; } .header { text-align: center; margin-bottom: 16pt; padding-bottom: 12pt; border-bottom: 2pt solid #0D9488; } .name { font-family: "Lora", Georgia, serif; font-size: 26pt; font-weight: 700; color: #0D9488; margin-bottom: 6pt; letter-spacing: 0.5pt; } .contact-line { font-size: 10pt; color: #555; margin-bottom: 4pt; } .contact-line .sep { margin: 0 8pt; color: #ccc; } .links-line { font-size: 10pt; } .links-line a { color: #0D9488; text-decoration: none; font-weight: 600; } .links-line .sep { margin: 0 6pt; color: #ccc; } .summary-block { font-size: 10.5pt; color: #333; margin-bottom: 18pt; text-align: center; line-height: 1.55; padding: 0 20pt; } .section { margin-bottom: 16pt; } .section-title { font-family: "Lora", Georgia, serif; font-size: 11.5pt; font-weight: 700; color: #0D9488; text-transform: uppercase; letter-spacing: 1.5pt; border-bottom: 1pt solid #0D9488; padding-bottom: 3pt; margin-bottom: 10pt; } .entry { margin-bottom: 12pt; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: 700; font-size: 10.5pt; color: #1a1a1a; } .entry-subtitle { font-size: 10pt; color: #555; } .entry-date { font-size: 9.5pt; color: #888; white-space: nowrap; } .entry-location { font-size: 9.5pt; color: #888; } .bullets { padding-left: 16pt; margin-top: 4pt; } .bullets li { font-size: 10pt; margin-bottom: 3pt; line-height: 1.5; color: #333; } .skill-category { margin-bottom: 8pt; } .skill-category-name { font-weight: 600; font-size: 10pt; color: #1a1a1a; } .skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; margin-top: 4pt; } .skill-tag { font-size: 9pt; padding: 3pt 10pt; background: #F0FDFA; color: #0D9488; border: 1px solid #99F6E4; border-radius: 99pt; font-weight: 500; } .cert-entry { margin-bottom: 5pt; } .cert-name { font-weight: 600; font-size: 10.5pt; } .cert-issuer { font-size: 10pt; color: #888; }'
  },

  // ════════════════════════════════════════════════════════════
  // 8. CREATIVE — Marketing, Media, Brand (slug stays 'bold')
  // ════════════════════════════════════════════════════════════
  {
    slug: 'bold',
    name: 'Creative',
    category: 'Creative',
    description: 'Bold accent bar with strong typography. Designed for Marketing, Media & Brand roles.',
    searchTags: 'creative bold accent-bar marketing media brand advertising content poppins standout vibrant impactful dynamic design',
    isPremium: true,
    sortOrder: 8,
    defaultConfig: '{"fontFamily":"Poppins, sans-serif","fontSize":"10.5pt","lineHeight":"1.45","primaryColor":"#111","accentColor":"#E11D48","marginTop":"0.5in","marginSide":"0.65in","showPhoto":false}',
    html: wrap('<div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="summary-block">{{SUMMARY_TEXT}}</div><main class="content">{{SECTIONS_HTML}}</main></div>'),
    css: BASE + 'body { font-family: "Poppins", -apple-system, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #111; background: #fff; -webkit-font-smoothing: antialiased; } .resume { max-width: 8.5in; margin: 0 auto; padding: 0.5in 0.65in; border-left: 5pt solid #E11D48; } .header { margin-bottom: 16pt; padding-bottom: 10pt; } .name { font-size: 26pt; font-weight: 800; color: #111; letter-spacing: -0.5pt; margin-bottom: 5pt; } .contact-line { font-size: 10pt; color: #555; margin-bottom: 4pt; } .contact-line .sep { margin: 0 8pt; color: #ddd; } .links-line { font-size: 10pt; } .links-line a { color: #E11D48; text-decoration: none; font-weight: 600; } .links-line .sep { margin: 0 6pt; color: #ddd; } .summary-block { font-size: 10.5pt; color: #444; margin-bottom: 18pt; line-height: 1.55; padding-left: 12pt; border-left: 3pt solid #E11D48; } .section { margin-bottom: 16pt; } .section-title { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2pt; color: #E11D48; margin-bottom: 8pt; padding-bottom: 3pt; } .entry { margin-bottom: 12pt; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: 700; font-size: 10.5pt; color: #111; } .entry-subtitle { font-size: 10pt; color: #555; } .entry-date { font-size: 9.5pt; color: #888; white-space: nowrap; font-weight: 500; } .entry-location { font-size: 9.5pt; color: #888; } .bullets { padding-left: 16pt; margin-top: 4pt; } .bullets li { font-size: 10pt; margin-bottom: 3pt; line-height: 1.5; color: #333; } .skill-category { margin-bottom: 8pt; } .skill-category-name { font-weight: 600; font-size: 10pt; } .skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; margin-top: 4pt; } .skill-tag { font-size: 9pt; padding: 3pt 10pt; background: #FFF1F2; color: #BE123C; border-radius: 3pt; font-weight: 500; } .cert-entry { margin-bottom: 5pt; } .cert-name { font-weight: 600; font-size: 10.5pt; } .cert-issuer { font-size: 10pt; color: #888; } @media print { .resume { border-left-width: 3pt; } }'
  },

  // ════════════════════════════════════════════════════════════
  // 9. ACADEMIC — Researchers, PhDs, Professors (slug stays 'compact')
  // ════════════════════════════════════════════════════════════
  {
    slug: 'compact',
    name: 'Academic',
    category: 'Academic',
    description: 'Structured CV layout for Publications, Grants & Teaching. For Researchers & PhDs.',
    searchTags: 'academic cv research phd professor scientist scholar publications grants teaching university thesis dissertation source-serif',
    isPremium: true,
    sortOrder: 9,
    defaultConfig: '{"fontFamily":"Source Serif 4, Georgia, serif","fontSize":"10.5pt","lineHeight":"1.5","primaryColor":"#1a1a1a","accentColor":"#7C3AED","marginTop":"0.5in","marginSide":"0.7in","showPhoto":false}',
    html: wrap('<div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="summary-block">{{SUMMARY_TEXT}}</div><main class="content">{{SECTIONS_HTML}}</main></div>'),
    css: BASE + 'body { font-family: "Source Serif 4", Georgia, "Times New Roman", serif; font-size: 10.5pt; line-height: 1.5; color: #1a1a1a; background: #fff; -webkit-font-smoothing: antialiased; } .resume { max-width: 8.5in; margin: 0 auto; padding: 0.5in 0.7in; } .header { margin-bottom: 16pt; padding-bottom: 12pt; border-bottom: 2pt solid #7C3AED; } .name { font-size: 24pt; font-weight: 700; color: #1a1a1a; margin-bottom: 6pt; letter-spacing: 0.3pt; } .contact-line { font-size: 10pt; color: #555; margin-bottom: 4pt; } .contact-line .sep { margin: 0 8pt; color: #ccc; } .links-line { font-size: 10pt; } .links-line a { color: #7C3AED; text-decoration: none; } .links-line .sep { margin: 0 6pt; color: #ccc; } .summary-block { font-size: 10.5pt; color: #333; margin-bottom: 18pt; line-height: 1.55; font-style: italic; } .section { margin-bottom: 16pt; } .section-title { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5pt; color: #7C3AED; border-bottom: 1pt solid #7C3AED; padding-bottom: 3pt; margin-bottom: 10pt; } .entry { margin-bottom: 10pt; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: 700; font-size: 10.5pt; color: #1a1a1a; } .entry-subtitle { font-size: 10pt; color: #555; font-style: italic; } .entry-date { font-size: 9.5pt; color: #666; white-space: nowrap; } .entry-location { font-size: 9.5pt; color: #666; font-style: italic; } .bullets { padding-left: 16pt; margin-top: 4pt; } .bullets li { font-size: 10pt; margin-bottom: 3pt; line-height: 1.5; color: #333; } .skill-category { margin-bottom: 8pt; display: flex; flex-wrap: wrap; align-items: baseline; gap: 5pt; } .skill-category-name { font-weight: 700; font-size: 10pt; color: #1a1a1a; margin-right: 6pt; } .skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; } .skill-tag { font-size: 9.5pt; padding: 2pt 8pt; background: #F5F3FF; color: #6D28D9; border: 0.5pt solid #DDD6FE; border-radius: 3pt; font-weight: 500; } .cert-entry { margin-bottom: 5pt; font-size: 10.5pt; } .cert-name { font-weight: 700; } .cert-issuer { color: #555; }'
  },

  // ════════════════════════════════════════════════════════════
  // 10. CORPORATE — Consulting, Big 4, Strategy (PREMIUM)
  // ════════════════════════════════════════════════════════════
  {
    slug: 'professional',
    name: 'Corporate',
    category: 'Premium',
    description: 'Navy & gold — boardroom ready. Built for Consulting, Big 4 & Strategy roles.',
    searchTags: 'corporate professional navy gold consulting big4 mckinsey bcg strategy investment-banking boardroom senior luxury premium',
    isPremium: true,
    sortOrder: 10,
    defaultConfig: '{"fontFamily":"Nunito Sans, sans-serif","fontSize":"10.5pt","lineHeight":"1.5","primaryColor":"#1B2A4A","accentColor":"#B8860B","marginTop":"0in","marginSide":"0in","showPhoto":false}',
    html: wrap('<div class="resume"><header class="header"><h1 class="name">{{FULL_NAME}}</h1><div class="contact-line">{{CONTACT_HTML}}</div><div class="links-line">{{LINKS_HTML}}</div></header><div class="body-content"><div class="summary-block">{{SUMMARY_TEXT}}</div><main class="content">{{SECTIONS_HTML}}</main></div></div>'),
    css: BASE + 'body { font-family: "Nunito Sans", -apple-system, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1B2A4A; background: #fff; -webkit-font-smoothing: antialiased; } .resume { max-width: 8.5in; margin: 0 auto; } .header { background: #1B2A4A; color: #fff; padding: 20pt 32pt 16pt; border-bottom: 3pt solid #B8860B; } .name { font-family: "Crimson Pro", Georgia, serif; font-size: 24pt; font-weight: 700; color: #fff; letter-spacing: 1pt; margin-bottom: 6pt; } .contact-line { font-size: 10pt; color: rgba(255,255,255,0.8); margin-bottom: 4pt; } .contact-line .sep { margin: 0 8pt; color: rgba(255,255,255,0.35); } .links-line { font-size: 10pt; } .links-line a { color: #F5DEB3; text-decoration: none; } .links-line .sep { margin: 0 6pt; color: rgba(255,255,255,0.35); } .body-content { padding: 16pt 32pt 24pt; } .summary-block { font-size: 10.5pt; color: #333; margin-bottom: 18pt; line-height: 1.55; border-bottom: 1px solid #E5E7EB; padding-bottom: 14pt; } .section { margin-bottom: 16pt; } .section-title { font-family: "Crimson Pro", Georgia, serif; font-size: 11.5pt; font-weight: 700; color: #B8860B; text-transform: uppercase; letter-spacing: 1pt; margin-bottom: 8pt; padding-bottom: 3pt; border-bottom: 1pt solid #B8860B; } .entry { margin-bottom: 12pt; } .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; } .entry-title { font-weight: 700; font-size: 10.5pt; color: #1B2A4A; } .entry-subtitle { font-size: 10pt; color: #555; } .entry-date { font-size: 9.5pt; color: #888; white-space: nowrap; } .entry-location { font-size: 9.5pt; color: #888; } .bullets { padding-left: 16pt; margin-top: 4pt; } .bullets li { font-size: 10pt; margin-bottom: 3pt; line-height: 1.5; color: #333; } .skill-category { margin-bottom: 8pt; } .skill-category-name { font-weight: 600; font-size: 10pt; } .skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; margin-top: 4pt; } .skill-tag { font-size: 9pt; padding: 3pt 10pt; background: #FDF8EC; color: #92400E; border: 1px solid #F5DEB3; border-radius: 3pt; font-weight: 500; } .cert-entry { margin-bottom: 5pt; } .cert-name { font-weight: 600; font-size: 10.5pt; } .cert-issuer { font-size: 10pt; color: #888; } @media print { .header { padding: 16pt 28pt 12pt; } .body-content { padding: 12pt 28pt 18pt; } }'
  }
];

// ──────────────────────────────────────────────────────────────
// DATABASE UPDATE
// ──────────────────────────────────────────────────────────────

async function main() {
  let pool;
  try {
    console.log('🔌 Connecting to database...');
    pool = await sql.connect(config);
    console.log(`✅ Connected to: ${config.server} / ${config.database}\n`);

    for (const t of templates) {
      console.log(`📝 Updating: ${t.slug} → "${t.name}" (${t.category})`);
      const r = await pool.request()
        .input('slug', sql.NVarChar, t.slug)
        .input('name', sql.NVarChar, t.name)
        .input('category', sql.NVarChar, t.category)
        .input('description', sql.NVarChar, t.description)
        .input('searchTags', sql.NVarChar, t.searchTags)
        .input('isPremium', sql.Bit, t.isPremium ? 1 : 0)
        .input('sortOrder', sql.Int, t.sortOrder)
        .input('defaultConfig', sql.NVarChar(sql.MAX), t.defaultConfig)
        .input('html', sql.NVarChar(sql.MAX), t.html)
        .input('css', sql.NVarChar(sql.MAX), t.css)
        .query(`UPDATE ResumeBuilderTemplates 
                SET Name=@name, Category=@category, Description=@description, 
                    SearchTags=@searchTags, IsPremium=@isPremium, SortOrder=@sortOrder,
                    DefaultConfig=@defaultConfig, HtmlTemplate=@html, CssTemplate=@css, 
                    UpdatedAt=GETUTCDATE() 
                WHERE Slug=@slug`);
      console.log(`   ✅ ${r.rowsAffected[0]} row(s) updated`);
    }

    // Verify
    const v = await pool.request().query(
      'SELECT TemplateID, Name, Slug, Category, IsPremium, SortOrder, LEN(HtmlTemplate) AS HtmlLen, LEN(CssTemplate) AS CssLen FROM ResumeBuilderTemplates ORDER BY SortOrder'
    );
    console.log('\n🎉 All templates updated successfully!\n');
    console.table(v.recordset);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
