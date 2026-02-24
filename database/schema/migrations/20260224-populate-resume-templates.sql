-- ============================================================
-- Migration: Populate Resume Builder Templates with real HTML/CSS
-- Created: 2026-02-24
-- Purpose: Store beautiful, production-ready templates in DB
--          so new designs = just INSERT, no code deploy
--
-- Template Engine:
--   {{fullName}}, {{email}}, {{phone}}, {{location}}
--   {{linkedin}}, {{github}}, {{portfolio}}
--   {{summary}}
--   {{sections}}        — all rendered section blocks
--   {{sidebarSections}} — skills/languages for 2-col layouts
--   {{fontFamily}}, {{fontSize}}, {{lineHeight}}
--   {{primaryColor}}, {{accentColor}}
--   {{marginTop}}, {{marginSide}}
--   {{headerBg}}, {{headerText}}
-- ============================================================

-- ── 1. CLASSIC ─────────────────────────────────────────────
UPDATE ResumeBuilderTemplates
SET HtmlTemplate = N'<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{fullName}} - Resume</title>
<style>{{css}}</style>
</head>
<body>
<div class="resume">
  <header>
    <h1>{{fullName}}</h1>
    <div class="contact">{{contactLine}}</div>
    <div class="links">{{linksLine}}</div>
  </header>
  {{#if summary}}<div class="summary"><p>{{summary}}</p></div>{{/if}}
  {{sections}}
</div>
</body>
</html>',
CssTemplate = N'@import url("https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Source+Sans+3:wght@400;500;600&display=swap");
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: "Source Sans 3", "Georgia", serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #2d2d2d;
  background: #fff;
  -webkit-font-smoothing: antialiased;
}
.resume {
  max-width: 8.5in;
  margin: 0 auto;
  padding: 0.55in 0.7in;
}
header {
  text-align: center;
  padding-bottom: 14pt;
  margin-bottom: 14pt;
  border-bottom: 2pt solid #1a1a1a;
}
header h1 {
  font-family: "Crimson Pro", Georgia, serif;
  font-size: 28pt;
  font-weight: 700;
  letter-spacing: 1pt;
  text-transform: uppercase;
  color: #1a1a1a;
  margin-bottom: 6pt;
}
.contact {
  font-size: 9.5pt;
  color: #555;
  letter-spacing: 0.3pt;
}
.links {
  font-size: 9pt;
  margin-top: 3pt;
}
.links a { color: #2563EB; text-decoration: none; }
.links a:hover { text-decoration: underline; }
.summary {
  margin-bottom: 16pt;
  padding: 10pt 14pt;
  background: #f8f9fa;
  border-left: 3pt solid #2563EB;
  border-radius: 0 4pt 4pt 0;
}
.summary p {
  font-size: 10pt;
  color: #444;
  font-style: italic;
  line-height: 1.55;
}
.section {
  margin-bottom: 16pt;
}
.section-title {
  font-family: "Crimson Pro", Georgia, serif;
  font-size: 12pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5pt;
  color: #1a1a1a;
  border-bottom: 1pt solid #ccc;
  padding-bottom: 3pt;
  margin-bottom: 10pt;
}
.entry {
  margin-bottom: 10pt;
}
.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.entry-title {
  font-weight: 600;
  font-size: 10.5pt;
  color: #1a1a1a;
}
.entry-subtitle {
  font-size: 10pt;
  color: #555;
  font-style: italic;
}
.entry-date {
  font-size: 9pt;
  color: #777;
  white-space: nowrap;
}
.entry-location {
  font-size: 9pt;
  color: #888;
  margin-top: 1pt;
}
.bullets {
  padding-left: 18pt;
  margin-top: 4pt;
}
.bullets li {
  font-size: 10pt;
  margin-bottom: 2pt;
  line-height: 1.45;
  color: #333;
}
.skill-category { margin-bottom: 6pt; }
.skill-category-name { font-weight: 600; font-size: 10pt; }
.skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; margin-top: 3pt; }
.skill-tag {
  font-size: 8.5pt;
  padding: 2pt 8pt;
  border-radius: 3pt;
  background: #eef2ff;
  color: #3730a3;
  border: 0.5pt solid #c7d2fe;
}
.cert-entry { margin-bottom: 3pt; }
.cert-name { font-weight: 600; font-size: 10pt; }
.cert-issuer { font-size: 9pt; color: #777; }
.project-tech { display: flex; flex-wrap: wrap; gap: 4pt; margin-top: 3pt; }
.project-tech span { font-size: 8pt; padding: 1pt 6pt; background: #f3f4f6; border-radius: 2pt; color: #555; }
@page { size: A4; margin: 0.5in; }
@media print { .resume { padding: 0; } }',
UpdatedAt = GETUTCDATE()
WHERE Slug = 'classic';
GO

-- ── 2. MODERN ──────────────────────────────────────────────
UPDATE ResumeBuilderTemplates
SET HtmlTemplate = N'<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{fullName}} - Resume</title>
<style>{{css}}</style>
</head>
<body>
<div class="resume">
  <header>
    <h1>{{fullName}}</h1>
    <div class="contact">{{contactLine}}</div>
    <div class="links">{{linksLine}}</div>
  </header>
  {{#if summary}}<div class="summary"><p>{{summary}}</p></div>{{/if}}
  <div class="two-col">
    <div class="main">{{sections}}</div>
    <div class="sidebar">{{sidebarSections}}</div>
  </div>
</div>
</body>
</html>',
CssTemplate = N'@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: "Inter", -apple-system, sans-serif;
  font-size: 9.5pt;
  line-height: 1.4;
  color: #1f2937;
  background: #fff;
  -webkit-font-smoothing: antialiased;
}
.resume {
  max-width: 8.5in;
  margin: 0 auto;
  padding: 0.45in 0.55in;
}
header {
  text-align: left;
  padding-bottom: 12pt;
  margin-bottom: 14pt;
  border-bottom: 2.5pt solid #2563EB;
}
header h1 {
  font-size: 26pt;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.5pt;
  margin-bottom: 5pt;
}
.contact { font-size: 9pt; color: #6b7280; }
.links { font-size: 8.5pt; margin-top: 2pt; }
.links a { color: #2563EB; text-decoration: none; font-weight: 500; }
.summary {
  margin-bottom: 14pt;
}
.summary p {
  font-size: 9.5pt;
  color: #374151;
  line-height: 1.5;
  border-left: 3pt solid #2563EB;
  padding-left: 10pt;
}
.two-col {
  display: flex;
  gap: 24pt;
}
.main { flex: 2.2; }
.sidebar {
  flex: 1;
  padding-left: 16pt;
  border-left: 1.5pt solid #e5e7eb;
}
.section { margin-bottom: 14pt; }
.section-title {
  font-size: 10pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2pt;
  color: #2563EB;
  margin-bottom: 8pt;
  padding-bottom: 3pt;
  border-bottom: 0.75pt solid #dbeafe;
}
.entry { margin-bottom: 10pt; }
.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.entry-title { font-weight: 600; font-size: 10pt; color: #111827; }
.entry-subtitle { font-size: 9.5pt; color: #6b7280; }
.entry-date { font-size: 8.5pt; color: #9ca3af; white-space: nowrap; }
.entry-location { font-size: 8.5pt; color: #9ca3af; margin-top: 1pt; }
.bullets { padding-left: 16pt; margin-top: 3pt; }
.bullets li { font-size: 9.5pt; margin-bottom: 2pt; line-height: 1.45; }
.skill-category { margin-bottom: 8pt; }
.skill-category-name { font-weight: 600; font-size: 9pt; color: #374151; text-transform: uppercase; letter-spacing: 0.5pt; }
.skill-tags { display: flex; flex-wrap: wrap; gap: 4pt; margin-top: 4pt; }
.skill-tag {
  font-size: 8pt;
  padding: 3pt 8pt;
  border-radius: 4pt;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 500;
}
.cert-entry { margin-bottom: 4pt; }
.cert-name { font-weight: 600; font-size: 9pt; }
.cert-issuer { font-size: 8.5pt; color: #9ca3af; }
.project-tech { display: flex; flex-wrap: wrap; gap: 3pt; margin-top: 3pt; }
.project-tech span { font-size: 7.5pt; padding: 1pt 5pt; background: #f0fdf4; color: #166534; border-radius: 2pt; }
@page { size: A4; margin: 0.4in; }
@media print { .resume { padding: 0; } }',
UpdatedAt = GETUTCDATE()
WHERE Slug = 'modern';
GO

-- ── 3. MINIMAL ─────────────────────────────────────────────
UPDATE ResumeBuilderTemplates
SET HtmlTemplate = N'<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{fullName}} - Resume</title>
<style>{{css}}</style>
</head>
<body>
<div class="resume">
  <header>
    <h1>{{fullName}}</h1>
    <div class="contact">{{contactLine}}</div>
    <div class="links">{{linksLine}}</div>
  </header>
  {{#if summary}}<div class="summary"><p>{{summary}}</p></div>{{/if}}
  {{sections}}
</div>
</body>
</html>',
CssTemplate = N'@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap");
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  font-size: 10pt;
  line-height: 1.55;
  color: #1a1a1a;
  background: #fff;
}
.resume {
  max-width: 8.5in;
  margin: 0 auto;
  padding: 0.65in 0.8in;
}
header {
  margin-bottom: 24pt;
}
header h1 {
  font-size: 30pt;
  font-weight: 600;
  color: #000;
  letter-spacing: -1pt;
  margin-bottom: 6pt;
}
.contact { font-size: 9.5pt; color: #666; }
.links { font-size: 9pt; margin-top: 2pt; }
.links a { color: #000; text-decoration: underline; text-underline-offset: 2pt; }
.summary {
  margin-bottom: 20pt;
}
.summary p {
  font-size: 10pt;
  color: #444;
  line-height: 1.6;
}
.section { margin-bottom: 18pt; }
.section-title {
  font-size: 9pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 2pt;
  color: #999;
  margin-bottom: 10pt;
}
.entry { margin-bottom: 12pt; }
.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2pt;
}
.entry-title { font-weight: 600; font-size: 10.5pt; }
.entry-subtitle { font-size: 10pt; color: #666; }
.entry-date { font-size: 9pt; color: #999; }
.entry-location { font-size: 9pt; color: #999; }
.bullets { padding-left: 16pt; margin-top: 4pt; }
.bullets li { font-size: 10pt; margin-bottom: 3pt; line-height: 1.5; color: #333; }
.skill-category { margin-bottom: 6pt; }
.skill-category-name { font-weight: 500; font-size: 10pt; color: #333; }
.skill-tags { display: flex; flex-wrap: wrap; gap: 6pt; margin-top: 4pt; }
.skill-tag {
  font-size: 9pt;
  padding: 2pt 10pt;
  border: 1pt solid #ddd;
  border-radius: 20pt;
  color: #333;
  background: transparent;
}
.cert-entry { margin-bottom: 4pt; }
.cert-name { font-weight: 500; font-size: 10pt; }
.cert-issuer { font-size: 9pt; color: #999; }
.project-tech { display: flex; flex-wrap: wrap; gap: 4pt; margin-top: 3pt; }
.project-tech span { font-size: 8.5pt; color: #666; }
.project-tech span::after { content: " · "; color: #ccc; }
.project-tech span:last-child::after { content: ""; }
@page { size: A4; margin: 0.6in; }',
UpdatedAt = GETUTCDATE()
WHERE Slug = 'minimal';
GO

-- ── 4. EXECUTIVE ───────────────────────────────────────────
UPDATE ResumeBuilderTemplates
SET HtmlTemplate = N'<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{fullName}} - Resume</title>
<style>{{css}}</style>
</head>
<body>
<div class="resume">
  <header>
    <div class="header-bg">
      <h1>{{fullName}}</h1>
      <div class="contact">{{contactLine}}</div>
      <div class="links">{{linksLine}}</div>
    </div>
  </header>
  <div class="body-content">
    {{#if summary}}<div class="summary"><p>{{summary}}</p></div>{{/if}}
    {{sections}}
  </div>
</div>
</body>
</html>',
CssTemplate = N'@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Source+Sans+3:wght@400;500;600&display=swap");
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: "Source Sans 3", sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #1f2937;
  background: #fff;
}
.resume {
  max-width: 8.5in;
  margin: 0 auto;
}
.header-bg {
  background: linear-gradient(135deg, #111827 0%, #1e3a5f 100%);
  color: #fff;
  padding: 36pt 40pt 28pt;
}
.header-bg h1 {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 32pt;
  font-weight: 800;
  letter-spacing: 0.5pt;
  margin-bottom: 8pt;
}
.header-bg .contact {
  font-size: 9.5pt;
  color: rgba(255,255,255,0.75);
  letter-spacing: 0.3pt;
}
.header-bg .links {
  font-size: 9pt;
  margin-top: 3pt;
}
.header-bg .links a { color: #93c5fd; text-decoration: none; }
.body-content {
  padding: 20pt 40pt 30pt;
}
.summary {
  margin-bottom: 18pt;
  padding: 12pt 16pt;
  background: #f8fafc;
  border-radius: 4pt;
  border-left: 4pt solid #1e40af;
}
.summary p {
  font-size: 10pt;
  color: #475569;
  line-height: 1.55;
  font-style: italic;
}
.section { margin-bottom: 16pt; }
.section-title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 13pt;
  font-weight: 700;
  color: #111827;
  border-bottom: 2pt solid #1e40af;
  padding-bottom: 4pt;
  margin-bottom: 10pt;
}
.entry { margin-bottom: 10pt; }
.entry-header { display: flex; justify-content: space-between; align-items: baseline; }
.entry-title { font-weight: 600; font-size: 10.5pt; color: #111827; }
.entry-subtitle { font-size: 10pt; color: #64748b; }
.entry-date { font-size: 9pt; color: #94a3b8; white-space: nowrap; }
.entry-location { font-size: 9pt; color: #94a3b8; }
.bullets { padding-left: 18pt; margin-top: 4pt; }
.bullets li { font-size: 10pt; margin-bottom: 2pt; line-height: 1.45; }
.skill-category { margin-bottom: 6pt; }
.skill-category-name { font-weight: 600; font-size: 10pt; color: #1e293b; }
.skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; margin-top: 3pt; }
.skill-tag {
  font-size: 8.5pt; padding: 3pt 10pt; border-radius: 3pt;
  background: #1e40af; color: #fff; font-weight: 500;
}
.cert-entry { margin-bottom: 3pt; }
.cert-name { font-weight: 600; font-size: 10pt; }
.cert-issuer { font-size: 9pt; color: #94a3b8; }
.project-tech { display: flex; flex-wrap: wrap; gap: 4pt; margin-top: 3pt; }
.project-tech span { font-size: 8pt; padding: 2pt 6pt; background: #f1f5f9; color: #475569; border-radius: 2pt; }
@page { size: A4; margin: 0; }
@media print { .header-bg { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }',
UpdatedAt = GETUTCDATE()
WHERE Slug = 'executive';
GO

-- ── 5. ATS OPTIMIZED ───────────────────────────────────────
UPDATE ResumeBuilderTemplates
SET HtmlTemplate = N'<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{fullName}} - Resume</title>
<style>{{css}}</style>
</head>
<body>
<div class="resume">
  <header>
    <h1>{{fullName}}</h1>
    <div class="contact">{{contactLine}}</div>
    <div class="links">{{linksLine}}</div>
  </header>
  {{#if summary}}<div class="summary"><p>{{summary}}</p></div>{{/if}}
  {{sections}}
</div>
</body>
</html>',
CssTemplate = N'* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11pt;
  line-height: 1.4;
  color: #000;
  background: #fff;
}
.resume {
  max-width: 8.5in;
  margin: 0 auto;
  padding: 0.5in 0.75in;
}
header {
  margin-bottom: 12pt;
  padding-bottom: 8pt;
  border-bottom: 2pt solid #000;
}
header h1 {
  font-size: 22pt;
  font-weight: bold;
  color: #000;
  margin-bottom: 4pt;
}
.contact { font-size: 10pt; color: #333; }
.links { font-size: 10pt; margin-top: 2pt; }
.links a { color: #000; text-decoration: underline; }
.summary { margin-bottom: 12pt; }
.summary p { font-size: 10.5pt; color: #333; line-height: 1.45; }
.section { margin-bottom: 14pt; }
.section-title {
  font-size: 12pt;
  font-weight: bold;
  text-transform: uppercase;
  color: #000;
  border-bottom: 1pt solid #000;
  padding-bottom: 2pt;
  margin-bottom: 8pt;
}
.entry { margin-bottom: 8pt; }
.entry-header { display: flex; justify-content: space-between; align-items: baseline; }
.entry-title { font-weight: bold; font-size: 11pt; }
.entry-subtitle { font-size: 10.5pt; color: #333; }
.entry-date { font-size: 10pt; color: #555; }
.entry-location { font-size: 10pt; color: #555; }
.bullets { padding-left: 20pt; margin-top: 3pt; }
.bullets li { font-size: 10.5pt; margin-bottom: 2pt; }
.skill-category { margin-bottom: 4pt; }
.skill-category-name { font-weight: bold; font-size: 10.5pt; }
.skill-tags { margin-top: 2pt; }
.skill-tag { font-size: 10pt; display: inline; }
.skill-tag::after { content: ", "; }
.skill-tag:last-child::after { content: ""; }
.cert-entry { margin-bottom: 3pt; }
.cert-name { font-weight: bold; font-size: 10.5pt; }
.cert-issuer { font-size: 10pt; color: #555; }
.project-tech span { font-size: 10pt; }
.project-tech span::after { content: ", "; }
.project-tech span:last-child::after { content: ""; }
@page { size: letter; margin: 0.5in; }',
UpdatedAt = GETUTCDATE()
WHERE Slug = 'ats-optimized';
GO

-- ── 6. TECH ────────────────────────────────────────────────
UPDATE ResumeBuilderTemplates
SET HtmlTemplate = N'<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{fullName}} - Resume</title>
<style>{{css}}</style>
</head>
<body>
<div class="resume">
  <header>
    <h1>{{fullName}}</h1>
    <div class="contact">{{contactLine}}</div>
    <div class="links">{{linksLine}}</div>
  </header>
  {{#if summary}}<div class="summary"><p>{{summary}}</p></div>{{/if}}
  {{sections}}
</div>
</body>
</html>',
CssTemplate = N'@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap");
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: "Inter", sans-serif;
  font-size: 10pt;
  line-height: 1.45;
  color: #c9d1d9;
  background: #0d1117;
  -webkit-font-smoothing: antialiased;
}
.resume {
  max-width: 8.5in;
  margin: 0 auto;
  padding: 0.5in 0.6in;
  background: #0d1117;
}
header {
  padding-bottom: 14pt;
  margin-bottom: 14pt;
  border-bottom: 1pt solid #30363d;
}
header h1 {
  font-family: "JetBrains Mono", monospace;
  font-size: 26pt;
  font-weight: 700;
  color: #58a6ff;
  letter-spacing: -0.5pt;
  margin-bottom: 6pt;
}
header h1::before {
  content: "$ ";
  color: #484f58;
  font-weight: 400;
}
.contact { font-size: 9pt; color: #8b949e; font-family: "JetBrains Mono", monospace; }
.links { font-size: 8.5pt; margin-top: 3pt; font-family: "JetBrains Mono", monospace; }
.links a { color: #58a6ff; text-decoration: none; }
.links a:hover { text-decoration: underline; }
.summary {
  margin-bottom: 14pt;
  padding: 10pt 12pt;
  background: #161b22;
  border: 1pt solid #30363d;
  border-radius: 6pt;
  border-left: 3pt solid #58a6ff;
}
.summary p {
  font-size: 9.5pt;
  color: #8b949e;
  line-height: 1.55;
  font-family: "JetBrains Mono", monospace;
  font-size: 9pt;
}
.section { margin-bottom: 16pt; }
.section-title {
  font-family: "JetBrains Mono", monospace;
  font-size: 10pt;
  font-weight: 600;
  color: #58a6ff;
  margin-bottom: 8pt;
  padding-bottom: 4pt;
  border-bottom: 1pt solid #21262d;
}
.section-title::before { content: "## "; color: #484f58; }
.entry {
  margin-bottom: 10pt;
  padding: 8pt 10pt;
  background: #161b22;
  border: 1pt solid #21262d;
  border-radius: 6pt;
}
.entry-header { display: flex; justify-content: space-between; align-items: baseline; }
.entry-title { font-weight: 600; font-size: 10pt; color: #f0f6fc; }
.entry-subtitle { font-size: 9.5pt; color: #8b949e; }
.entry-date {
  font-size: 8pt; color: #484f58;
  font-family: "JetBrains Mono", monospace;
  background: #21262d; padding: 1pt 6pt; border-radius: 10pt;
}
.entry-location { font-size: 8.5pt; color: #484f58; margin-top: 2pt; }
.bullets { padding-left: 16pt; margin-top: 4pt; list-style-type: "→ "; }
.bullets li {
  font-size: 9.5pt; margin-bottom: 3pt; line-height: 1.45; color: #c9d1d9;
}
.skill-category { margin-bottom: 8pt; }
.skill-category-name {
  font-family: "JetBrains Mono", monospace;
  font-weight: 600; font-size: 9pt; color: #79c0ff;
}
.skill-tags { display: flex; flex-wrap: wrap; gap: 5pt; margin-top: 4pt; }
.skill-tag {
  font-family: "JetBrains Mono", monospace;
  font-size: 8pt; padding: 3pt 8pt; border-radius: 4pt;
  background: #1f6feb22; color: #58a6ff;
  border: 1pt solid #1f6feb44;
}
.cert-entry { margin-bottom: 4pt; }
.cert-name { font-weight: 600; font-size: 9.5pt; color: #f0f6fc; }
.cert-issuer { font-size: 8.5pt; color: #484f58; }
.project-tech { display: flex; flex-wrap: wrap; gap: 4pt; margin-top: 3pt; }
.project-tech span {
  font-family: "JetBrains Mono", monospace;
  font-size: 7.5pt; padding: 2pt 6pt;
  background: #23883622; color: #3fb950; border-radius: 3pt;
  border: 1pt solid #23883644;
}
@page { size: A4; margin: 0.4in; }
@media print {
  body, .resume { background: #0d1117 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}',
UpdatedAt = GETUTCDATE()
WHERE Slug = 'tech';
GO
