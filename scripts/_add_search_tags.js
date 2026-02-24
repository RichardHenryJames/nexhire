const sql = require('mssql');
const path = require('path');
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'local.settings.json'), 'utf8'));
const v = settings.Values || {};

(async () => {
  const pool = await sql.connect({ server: v.DB_SERVER, database: v.DB_NAME, user: v.DB_USER, password: v.DB_PASSWORD, options: { encrypt: true } });
  
  // Check if column exists
  const col = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ResumeBuilderTemplates' AND COLUMN_NAME='SearchTags'");
  console.log('Column exists:', col.recordset.length > 0);
  
  if (col.recordset.length === 0) {
    await pool.request().query("ALTER TABLE ResumeBuilderTemplates ADD SearchTags NVARCHAR(500) NULL");
    console.log('✅ Added SearchTags column');
  }
  
  // Update tags
  const tags = {
    'classic': 'serif traditional clean timeless centered ats-friendly single-column professional formal harvard garamond classic conservative',
    'modern': 'sans-serif modern blue two-column sidebar skills-panel clean inter contemporary professional sleek',
    'minimal': 'minimal clean whitespace simple elegant developer minimalist dm-sans light spacious less-is-more',
    'executive': 'executive dark-header serif leadership corporate enterprise senior premium playfair navy formal c-suite director vp',
    'ats-optimized': 'ats ats-friendly ats-optimized plain simple no-graphics parsable recruiter-friendly applicant-tracking arial safe compatible',
    'tech': 'tech developer github dark-theme monospace code engineering jetbrains programmer software-engineer dark hacker terminal',
    'elegant': 'elegant teal sophisticated creative serif lora centered pill-tags polished refined classy designer',
    'bold': 'bold red accent-bar strong poppins creative standout vibrant energetic impactful modern dynamic',
    'compact': 'compact dense two-column roboto small-font experienced senior lots-of-content space-efficient indigo condensed',
    'professional': 'professional navy gold corporate premium serif crimson executive polished formal senior leadership blue-gold luxury',
  };
  
  for (const [slug, searchTags] of Object.entries(tags)) {
    await pool.request()
      .input('slug', sql.NVarChar, slug)
      .input('tags', sql.NVarChar, searchTags)
      .query('UPDATE ResumeBuilderTemplates SET SearchTags=@tags WHERE Slug=@slug');
  }
  console.log('✅ All 10 templates tagged');
  
  // Verify
  const r = await pool.request().query('SELECT Slug, LEFT(SearchTags, 50) as Tags FROM ResumeBuilderTemplates ORDER BY SortOrder');
  r.recordset.forEach(t => console.log(`  ${t.Slug}: ${t.Tags}...`));
  
  pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
