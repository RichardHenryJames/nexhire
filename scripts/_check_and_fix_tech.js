const sql = require('mssql');
(async () => {
  const p = await sql.connect({
    server: 'refopen-sqlserver-dev.database.windows.net',
    database: 'refopen-sql-db-dev',
    user: 'sqladmin',
    password: 'RefOpenDev@2024!Tle@yTK$',
    options: { encrypt: true }
  });
  const r = await p.request().query(
    'SELECT Slug, LEN(HtmlTemplate) as HtmlLen, LEN(CssTemplate) as CssLen FROM ResumeBuilderTemplates ORDER BY SortOrder'
  );
  r.recordset.forEach(x => console.log(x.Slug, ': html=' + x.HtmlLen + ' css=' + x.CssLen));
  
  // Also seed tech if missing
  const tech = r.recordset.find(x => x.Slug === 'tech');
  if (tech && tech.HtmlLen < 100) {
    console.log('Tech template needs update...');
    await p.request()
      .input('slug', sql.NVarChar, 'tech')
      .input('html', sql.NVarChar(sql.MAX), `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{{TITLE}} - Resume</title><style>{{STYLES}}</style></head><body><div class="resume"><header class="header"><div class="header-accent"></div><h1 class="name">{{FULL_NAME}}</h1><div class="contact">{{CONTACT_HTML}}</div><div class="links">{{LINKS_HTML}}</div></header><div class="summary">{{SUMMARY_TEXT}}</div><main>{{SECTIONS_HTML}}</main></div></body></html>`)
      .input('css', sql.NVarChar(sql.MAX), `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',system-ui,sans-serif;font-size:10pt;line-height:1.4;color:#C9D1D9;background:#0D1117}.resume{max-width:8.5in;margin:0 auto;padding:.55in .7in;background:#0D1117}.header{margin-bottom:14pt;padding-bottom:12pt;border-bottom:1px solid #21262D;position:relative}.header-accent{position:absolute;top:0;left:0;width:4pt;height:100%;background:#58A6FF;border-radius:2pt}.name{font-family:'JetBrains Mono',monospace;font-size:24pt;font-weight:700;color:#F0F6FC;margin-bottom:5pt;padding-left:14pt}.contact{font-size:9pt;color:#8B949E;padding-left:14pt;margin-bottom:2pt}.contact .sep{margin:0 8pt;color:#30363D}.links{font-size:9pt;padding-left:14pt}.links a{color:#58A6FF;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:8.5pt}.links .sep{margin:0 6pt;color:#30363D}.summary{font-size:10pt;color:#8B949E;margin-bottom:14pt;padding:10pt 14pt;background:#161B22;border:1px solid #21262D;border-radius:6pt;border-left:3px solid #58A6FF;line-height:1.5}.section{margin-bottom:14pt}.section-title{font-family:'JetBrains Mono',monospace;font-size:9pt;font-weight:600;text-transform:uppercase;letter-spacing:1.5pt;color:#58A6FF;margin-bottom:8pt;padding-bottom:4pt;border-bottom:1px solid #21262D}.entry{margin-bottom:8pt;padding:8pt 10pt;background:#161B22;border:1px solid #21262D;border-radius:6pt}.entry-header{display:flex;justify-content:space-between;align-items:baseline}.entry-title{font-weight:600;font-size:10pt;color:#F0F6FC}.entry-subtitle{font-size:9.5pt;color:#8B949E}.entry-date{font-family:'JetBrains Mono',monospace;font-size:8pt;color:#484F58;white-space:nowrap}.entry-location{font-size:8.5pt;color:#484F58;margin-top:1pt}.bullets{padding-left:14pt;margin-top:4pt}.bullets li{font-size:9.5pt;margin-bottom:2pt;line-height:1.4;color:#C9D1D9}.skill-category{margin-bottom:6pt}.skill-category-name{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:9pt;color:#F0F6FC}.skill-tags{display:flex;flex-wrap:wrap;gap:5pt;margin-top:3pt}.skill-tag{font-family:'JetBrains Mono',monospace;font-size:8pt;padding:3pt 8pt;background:rgba(31,111,235,0.13);color:#58A6FF;border:1px solid rgba(31,111,235,0.25);border-radius:4pt;font-weight:500}.cert-entry{margin-bottom:4pt;padding:4pt 10pt;background:#161B22;border:1px solid #21262D;border-radius:4pt}.cert-name{font-weight:600;font-size:9.5pt;color:#F0F6FC}.cert-issuer{font-size:8.5pt;color:#484F58}@media print{body{background:#fff;color:#000}.resume{background:#fff}.name,.entry-title,.cert-name{color:#000}.section-title,.skill-tag,.links a{color:#2563EB}.entry,.cert-entry,.summary{background:#f8f8f8;border-color:#e0e0e0}}`)
      .query('UPDATE ResumeBuilderTemplates SET HtmlTemplate=@html, CssTemplate=@css, UpdatedAt=GETUTCDATE() WHERE Slug=@slug');
    console.log('Tech template updated!');
  }
  
  p.close();
})().catch(e => console.error('ERR:', e.message));
