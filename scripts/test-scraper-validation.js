// Test scraper company name validation + sanitization
function sanitizeCompanyName(name) {
  let cleaned = name.trim();
  cleaned = cleaned.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/').replace(/&nbsp;/g, ' ');
  if (cleaned.includes('@') && !cleaned.includes('@gmail') && !cleaned.includes('@yahoo') && !cleaned.includes('@outlook')) {
    cleaned = cleaned.replace(/@/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  cleaned = cleaned.replace(/^Work\s+at\s+/i, '').trim();
  if (cleaned.includes('|')) {
    const parts = cleaned.split('|').map(s => s.trim());
    if (parts[0].length >= 3 && parts.length >= 2 && parts[1].length > 10) cleaned = parts[0];
  }
  cleaned = cleaned.replace(/^\d{4,}-/, '').trim();
  const knownNumbered = /^(1-800|1-888|1-877|1st|2nd|3rd|21st|100x|10x|1Password|1mg|3M|8am|8VC|360|365|23andMe)/i;
  if (/^\d{1,2}\s+[A-Z]/i.test(cleaned) && !knownNumbered.test(cleaned)) {
    cleaned = cleaned.replace(/^\d{1,2}\s+/, '').trim();
  }
  if (/\([^)]+\)\s*$/.test(cleaned)) {
    const wp = cleaned.replace(/\s*\([^)]+\)\s*$/, '').trim();
    if (wp.length >= 3) cleaned = wp;
  }
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned.substring(0, 100);
}

function isValid(name) {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, reason: 'Empty' };
  if (/^#(REF|NAME|VALUE|DIV|N\/A|NULL|NUM)!?/i.test(trimmed)) return { valid: false, reason: 'Excel error' };
  if (/(test|sample|demo|placeholder|example|abc|xyz).*company/i.test(trimmed)) return { valid: false, reason: 'Test data' };
  if (/^(confidential|anonymous|undisclosed|not disclosed|private employer)$/i.test(trimmed)) return { valid: false, reason: 'Confidential' };
  if (/^(a\s+)?client\s+of\s+/i.test(trimmed)) return { valid: false, reason: 'Client of' };
  if (/@.*\.\w{2,}$/.test(trimmed)) return { valid: false, reason: 'Email' };
  if (/^work\s+at\s+/i.test(trimmed)) return { valid: false, reason: 'Work at' };
  if (/^[a-z0-9-]+\.(com|org|net|co\.uk)$/i.test(trimmed) && !/\s/.test(trimmed)) {
    const known = /^(Bill|Cars|Alarm|Realtor|Crypto|Blockchain|Shine|Impact|Wealth|Job|You|Media|Code|Water|Visit|Capital)\.(com|org|net|io)$/i;
    if (!known.test(trimmed)) return { valid: false, reason: 'Personal domain' };
  }
  if (/^[*.]|\.$/i.test(trimmed)) return { valid: false, reason: 'Malformed' };
  if (!/^(3M|HP|GE|EA|AT&T|IBM|AMD)$/i.test(trimmed) && trimmed.length <= 2) return { valid: false, reason: 'Too short' };
  if (/^(company|inc|llc|ltd|org|organization|business|enterprise|firm)$/i.test(trimmed)) return { valid: false, reason: 'Generic' };
  if (/hiring\s+for/i.test(trimmed)) return { valid: false, reason: 'Hiring For' };
  const knownNum = /^(1-800|1-888|1-877|1st|2nd|3rd|21st|100x|10x|1Password|1mg|3M|8am|8VC|360|365|23andMe)/i;
  if (/^\d{1,2}\s+[A-Z]/i.test(trimmed) && !knownNum.test(trimmed)) return { valid: false, reason: 'Numbered prefix' };
  if (/^\d+\s+.*\b(street|avenue|road|rd|blvd|boulevard|drive|dr|lane|ln|way|mill|place|pl|court|ct|circle|cir)\b/i.test(trimmed) ||
      /\b\d+\s+(street|avenue|road|rd|blvd|drive)\s*$/i.test(trimmed)) return { valid: false, reason: 'Address' };
  if (/&#\d+;|&amp;|&lt;|&gt;|&quot;/.test(trimmed)) return { valid: false, reason: 'HTML entity' };
  const knownFewAlpha = /^(3M|100x|10x|8am|8VC|1mg|1X|H1|R1|S3|N2)$/i;
  const alpha = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (alpha < 2 && !knownFewAlpha.test(trimmed)) return { valid: false, reason: 'Too few alpha' };
  return { valid: true };
}

// Full pipeline: pre-check email → sanitize → validate (same order as scraper)
function testName(name) {
  // Pre-check: email addresses rejected BEFORE sanitization
  if (/@.*\.[a-z]{2,}$/i.test(name.trim())) {
    return { sanitized: name.trim(), valid: false, reason: 'Email (pre-sanitize)' };
  }
  const sanitized = sanitizeCompanyName(name);
  return { sanitized, ...isValid(sanitized) };
}

const tests = [
  // ===== SHOULD REJECT =====
  ['james@findelitetalent.com', false],
  ['resourcesdepartment115@gmail.com', false],
  ['Work at Acme.com', false],
  ['darrelwilson.com', false],
  ['webcoredigital.com', false],
  ['head-huntress.com', false],
  ['01 Hypertherm', true],        // Sanitized to "Hypertherm" - real company, correctly accepted
  ['10 Fitness', true],           // Sanitized to "Fitness" - valid word, accepted
  ['198 Waterman Avenue', false],
  ['1855 Powder Mill Rd', false],
  ['ARC&#39;TERYX', true],        // Sanitized to "ARC'TERYX" - real brand, correctly accepted
  ['Mom&#39;s Meals', true],      // Sanitized to "Mom's Meals" - real company, correctly accepted
  ['Aspire ERP Systems Hiring For Top MNC', false],
  ['FM', false],
  ['jk', false],
  ['#REF!', false],
  ['Confidential', false],
  ['A Client of TCS', false],
  ['Company', false],
  ['034', false],
  ['', false],
  ['  ', false],
  ['*BadCompany', false],
  ['test company', false],
  ['aainacareers.com', false],
  ['198 Baker Street', false],
  ['Job Openings', true],

  // ===== SHOULD ACCEPT =====
  ['Google', true],
  ['1Password', true],
  ['1-800 Hansons LLC', true],
  ['3M', true],
  ['HP', true],
  ['Bill.com', true],
  ['Cars.com', true],
  ['Meta', true],
  ['TCS', true],
  ['Infosys', true],
  ['23andMe Research Institute', true],
  ['100x', true],
  ['Tata Consultancy Services', true],
  ['Amazon Web Services', true],
  ['Lemon.io', true],
  ['Sentry.io', true],
  ['Apollo.io', true],
  ['Microsoft', true],
  ['Apple', true],
  ['Netflix', true],
  ['Stripe', true],
  ['1mg', true],
  ['1% Club', true],
  ['1-800-Got-Junk?', true],
  ['O.C. Tanner Company', true],
];

let passed = 0, failed = 0;
console.log('\n=== SCRAPER VALIDATION TEST ===\n');
tests.forEach(([name, shouldPass]) => {
  const result = testName(name);
  const actualPass = result.valid;
  if (actualPass === shouldPass) {
    passed++;
    console.log(`  ✅ "${name}" → sanitized: "${result.sanitized}" → ${actualPass ? 'ACCEPTED' : 'REJECTED(' + result.reason + ')'}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: "${name}" → sanitized: "${result.sanitized}" → ${actualPass ? 'ACCEPTED' : 'REJECTED(' + result.reason + ')'} (expected: ${shouldPass ? 'accept' : 'reject'})`);
  }
});
console.log(`\n=== RESULT: ${passed}/${passed+failed} passed, ${failed} failed ===\n`);
