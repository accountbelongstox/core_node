#!/usr/bin/env node
/**
 * Quick syntax check for all store files
 * Looks for common syntax errors
 */

const fs = require('fs');
const path = require('path');

const storesDir = path.join(__dirname, 'app_pymatrix_pages/stores');
const stores = fs.readdirSync(storesDir).filter(f => f.endsWith('.ts'));

console.log(`\n📋 Checking ${stores.length} store files for syntax issues...\n`);

let errorsFound = 0;

stores.forEach(storeName => {
  const filePath = path.join(storesDir, storeName);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const issues = [];

  // Check for common issues
  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for double closing braces on same line
    if (/}\s*}/.test(line) && !/\/\/|\/\*|\*\//.test(line)) {
      // Skip if it's in comments or legitimate object/function nesting
      const trimmed = line.trim();
      if (trimmed === '}' || trimmed === '}}' || trimmed === '});' || trimmed === '}};') {
        // This might be suspicious
        issues.push({ lineNum, type: 'double-brace', line: trimmed });
      }
    }

    // Check for function keyword outside of expected contexts
    if (/^\s*function\s/.test(line)) {
      // This might be okay, but let's flag it for review
      const prevLine = lines[index - 1] || '';
      const nextFewLines = lines.slice(index - 2, index + 1).join('\n');

      // Check if there's a dangling opening paren
      const openParens = (nextFewLines.match(/\(/g) || []).length;
      const closeParens = (nextFewLines.match(/\)/g) || []).length;

      if (openParens > closeParens && !/\/\*|\/\//.test(prevLine)) {
        issues.push({ lineNum, type: 'function-context', line: line.trim() });
      }
    }
  });

  if (issues.length > 0) {
    console.log(`❌ ${storeName}:`);
    issues.forEach(issue => {
      console.log(`   Line ${issue.lineNum}: [${issue.type}] ${issue.line}`);
    });
    console.log('');
    errorsFound += issues.length;
  } else {
    console.log(`✅ ${storeName}`);
  }
});

console.log(`\n${'='.repeat(60)}`);
if (errorsFound === 0) {
  console.log(`✅ All ${stores.length} store files passed basic syntax checks!`);
} else {
  console.log(`⚠️  Found ${errorsFound} potential issues to review.`);
  console.log(`Note: Some issues may be false positives.`);
}
console.log(`${'='.repeat(60)}\n`);

process.exit(errorsFound > 0 ? 1 : 0);
