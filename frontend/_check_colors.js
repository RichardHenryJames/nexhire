const fs = require('fs');
const path = require('path');

const files = fs.readFileSync(path.join(process.env.TEMP, 'changed_files.txt'), 'utf8')
  .split('\n').map(f => f.trim()).filter(f => f && f.endsWith('.js'));

const results = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  let braceDepth = 0;
  let parenDepth = 0;
  let inMultiLineComment = false;
  let issues = [];
  let inArrowFnWithColors = false;  // tracks (colors) => { ... }
  let arrowFnBraceStart = -1;
  let arrowFnParenStart = -1;
  let componentStartLine = -1;
  
  // First pass: find where the main component function starts
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Component function patterns
    if (/^export\s+default\s+function\s+[A-Z]/.test(trimmed) ||
        /^export\s+function\s+[A-Z]/.test(trimmed) ||
        /^function\s+[A-Z]/.test(trimmed) ||
        /^(export\s+)?(const|let|var)\s+[A-Z][A-Za-z0-9]+\s*=\s*\(/.test(trimmed) ||
        /^(export\s+)?(const|let|var)\s+[A-Z][A-Za-z0-9]+\s*=\s*React\./.test(trimmed) ||
        /^(export\s+)?(const|let|var)\s+[A-Z][A-Za-z0-9]+\s*=\s*memo/.test(trimmed) ||
        /^export\s+default\s+\(/.test(trimmed)) {
      
      // But not if it's something like const ChartIcon = ... (simple assignment)
      // Only if it looks like a function/component
      componentStartLine = i;
      break;
    }
  }
  
  // Second pass: scan module-level code before the component
  braceDepth = 0;
  parenDepth = 0;
  let arrowColorsFnDepth = -1; // brace depth when we enter a (colors) => function
  
  for (let i = 0; i < lines.length; i++) {
    if (componentStartLine >= 0 && i >= componentStartLine) break;
    
    const line = lines[i];
    const trimmed = line.trim();
    
    // Track multi-line comments
    if (inMultiLineComment) {
      if (trimmed.includes('*/')) { inMultiLineComment = false; }
      continue;
    }
    if (trimmed.startsWith('/*')) { 
      inMultiLineComment = true; 
      if (trimmed.includes('*/')) { inMultiLineComment = false; }
      continue; 
    }
    
    // Skip single-line comments
    if (trimmed.startsWith('//')) continue;
    
    // Skip import lines
    if (trimmed.startsWith('import ')) continue;
    
    // Detect arrow function with colors param: = (colors) => or = (colors, ...)  =>
    if (/=\s*\(\s*colors[\s,)]/.test(trimmed) && /=>/.test(trimmed)) {
      arrowColorsFnDepth = braceDepth;
    }
    // Also detect: function xxx(colors) 
    if (/function\s+\w+\s*\(\s*colors[\s,)]/.test(trimmed)) {
      arrowColorsFnDepth = braceDepth;
    }
    
    // Count braces to track depth
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') {
        braceDepth--;
        if (arrowColorsFnDepth >= 0 && braceDepth <= arrowColorsFnDepth) {
          arrowColorsFnDepth = -1; // exited the colors arrow function
        }
      }
    }
    
    // If we're inside a function that receives colors as param, skip
    if (arrowColorsFnDepth >= 0) continue;
    
    // Skip const colors = definitions
    if (/^\s*(const|let|var)\s+colors\s*=/.test(trimmed)) continue;
    
    // Skip brandColors, authDarkColors
    if (/brandColors|authDarkColors/.test(trimmed)) continue;
    
    // Now check for colors. at module level
    // Remove string literals and comments from the line first
    let codeLine = trimmed.replace(/\/\/.*$/, ''); // remove inline comments
    codeLine = codeLine.replace(/'[^']*'/g, '""').replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '""');
    
    if (/colors\./.test(codeLine)) {
      issues.push({ line: i + 1, text: trimmed });
    }
  }
  
  if (issues.length > 0) {
    results.push({ file, issues });
  }
}

// Output results
for (const r of results) {
  console.log(`\n=== ${r.file} ===`);
  for (const iss of r.issues) {
    console.log(`  Line ${iss.line}: ${iss.text}`);
  }
}

if (results.length === 0) {
  console.log('No module-level colors. issues found.');
}
