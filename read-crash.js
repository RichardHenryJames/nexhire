const fs = require('fs');
const path = require('path');

const bundleDir = path.join(__dirname, 'frontend', 'web-build', 'bundles');
const files = fs.readdirSync(bundleDir).filter(f => f.endsWith('.js'));
const content = fs.readFileSync(path.join(bundleDir, files[0]), 'utf8');
const lines = content.split('\n');

// The REAL approach: just try to require the bundle and find ALL ReferenceError: colors
// Use a different approach - search for bare `colors.` in module init code
// A module init is: __d(function(g,r,...){  INIT CODE  }, moduleId, [deps])
// Init code runs immediately. If colors.xxx appears before var colors is assigned, crash.

const moduleRegex = /__d\(function\([^)]*\)\{/g;
let match;
const crashes = [];

while ((match = moduleRegex.exec(content)) !== null) {
  const start = match.index + match[0].length;
  // Get 10000 chars of module body
  const body = content.substring(start, start + 10000);
  
  // Find ALL colors.xxx references
  const colorsRefs = [];
  const re = /(?<!\w)colors\.(\w+)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    colorsRefs.push({ offset: m.index, prop: m[1] });
  }
  if (colorsRefs.length === 0) continue;
  
  // Check if colors is defined before the first reference
  const firstRef = colorsRefs[0];
  const beforeFirst = body.substring(0, firstRef.offset);
  
  // Patterns that define colors:
  // - var l=t.colors  (destructuring from useTheme)
  // - colors}=  (destructuring)
  // - ,colors=  (var declaration) 
  // - var colors=
  // - const colors=
  // - function parameter with colors
  const defined = /(?:var|const|let)\s+(?:\w+\s*=\s*[^,;]+,\s*)*colors\s*=/.test(beforeFirst) ||
                  /colors\s*[=}]/.test(beforeFirst) ||
                  /,colors=/.test(beforeFirst) ||
                  /colors=\w/.test(beforeFirst);
  
  if (!defined) {
    // This module uses colors.xxx without defining it first - CRASH
    const lineNum = content.substring(0, start + firstRef.offset).split('\n').length;
    
    // Get identifying strings
    const modBody = body.substring(0, 3000);
    const strs = modBody.match(/'[^']{8,50}'/g) || [];
    
    crashes.push({
      line: lineNum,
      prop: firstRef.prop,
      context: body.substring(Math.max(0, firstRef.offset - 40), firstRef.offset + 60).replace(/\n/g, ' '),
      hints: strs.slice(0, 5).join(', '),
    });
  }
}

console.log(`Found ${crashes.length} potential crashes:\n`);
crashes.forEach((c, i) => {
  console.log(`#${i+1} Line ${c.line}: colors.${c.prop}`);
  console.log(`   Context: ${c.context}`);
  console.log(`   Hints: ${c.hints}`);
  console.log();
});
