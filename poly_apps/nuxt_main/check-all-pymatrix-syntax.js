#!/usr/bin/env node
/**
 * Comprehensive syntax check for all PyMatrix files
 */

const fs = require('fs');
const path = require('path');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.vue')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

const appDir = path.join(__dirname, 'apps/app_pymatrix');
const allFiles = getAllFiles(appDir);

console.log(`\n📋 Checking ${allFiles.length} PyMatrix files for syntax issues...\n`);

let errorsFound = 0;
let filesWithErrors = [];

allFiles.forEach(filePath => {
  const relativePath = path.relative(appDir, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const issues = [];

  // Check for common issues
  let openBraces = 0;
  let openParens = 0;
  let openBrackets = 0;

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Skip comments and strings (simple check)
    const noComments = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    const noStrings = noComments.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, '``');

    // Count braces
    openBraces += (noStrings.match(/\{/g) || []).length;
    openBraces -= (noStrings.match(/\}/g) || []).length;

    // Count parentheses
    openParens += (noStrings.match(/\(/g) || []).length;
    openParens -= (noStrings.match(/\)/g) || []).length;

    // Count brackets
    openBrackets += (noStrings.match(/\[/g) || []).length;
    openBrackets -= (noStrings.match(/\]/g) || []).length;

    // Check for negative counts (more closing than opening)
    if (openBraces < 0) {
      issues.push({ lineNum, type: 'extra-closing-brace', line: line.trim() });
      openBraces = 0; // Reset to avoid cascading errors
    }
    if (openParens < 0) {
      issues.push({ lineNum, type: 'extra-closing-paren', line: line.trim() });
      openParens = 0;
    }
    if (openBrackets < 0) {
      issues.push({ lineNum, type: 'extra-closing-bracket', line: line.trim() });
      openBrackets = 0;
    }
  });

  // Check final counts
  if (openBraces > 0) {
    issues.push({ lineNum: lines.length, type: 'unclosed-braces', count: openBraces });
  }
  if (openParens > 0) {
    issues.push({ lineNum: lines.length, type: 'unclosed-parens', count: openParens });
  }
  if (openBrackets > 0) {
    issues.push({ lineNum: lines.length, type: 'unclosed-brackets', count: openBrackets });
  }

  if (issues.length > 0) {
    console.log(`❌ ${relativePath}:`);
    issues.forEach(issue => {
      if (issue.count) {
        console.log(`   End of file: [${issue.type}] ${issue.count} unclosed`);
      } else {
        console.log(`   Line ${issue.lineNum}: [${issue.type}] ${issue.line.substring(0, 60)}...`);
      }
    });
    console.log('');
    errorsFound += issues.length;
    filesWithErrors.push(relativePath);
  }
});

console.log(`${'='.repeat(80)}`);
if (errorsFound === 0) {
  console.log(`✅ All ${allFiles.length} PyMatrix files passed syntax checks!`);
} else {
  console.log(`⚠️  Found ${errorsFound} potential issues in ${filesWithErrors.length} files:`);
  filesWithErrors.forEach(f => console.log(`   - ${f}`));
}
console.log(`${'='.repeat(80)}\n`);

process.exit(errorsFound > 0 ? 1 : 0);
