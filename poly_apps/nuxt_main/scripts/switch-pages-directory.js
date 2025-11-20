#!/usr/bin/env node

// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

// ============================================================================
// MULTI-APP PAGES DIRECTORY SWITCHER
// ============================================================================
//
// **CRITICAL FUNCTION**:
// This script is the CORE of the multi-app architecture. It physically replaces
// the entire pages/ directory with the target app's pages directory BEFORE Nuxt build/dev starts.
//
// **WHY THIS APPROACH**:
// 1. **Physical Isolation**: Nuxt only sees ONE app's pages at a time
// 2. **Zero Cross-Contamination**: Other apps' pages are not even visible to Nuxt
// 3. **Optimal Tree-Shaking**: Only the active app's pages are included in the build
// 4. **No Runtime Overhead**: No dynamic loading, no conditional imports
// 5. **Prevents Directory Lock**: Recursively clears and copies instead of renaming
//
// **WORKFLOW**:
// 1. start.ps1 calls this script: node switch-pages-directory.js ittools
// 2. Validate 'ittools' is in SUPPORTED_APPS
// 3. Backup current pages/ directory → .app-backups/pages.backup.{timestamp}/
// 4. Recursively clear pages/ directory
// 5. Copy app_{namespace}_pages/ → pages/ (with metadata files)
// 6. Nuxt dev/build starts → only sees pages/ (which is app_{namespace}_pages)
//
// **RESULT**:
// When you run 'yarn dev:ittools', the build ONLY includes:
// - pages/** (copied from app_ittools_pages/)
// - apps/app_ittools/** (imported by pages)
// - common/** (imported by ittools)
//
// Other apps' pages are NOT included.
//
// **USAGE**:
//   node scripts/switch-pages-directory.js [appname]
//   APP_ENTRY=dev node scripts/switch-pages-directory.js
//
// **SUPPORTED APPS**: Automatically discovered from app_{namespace}_pages directories
//
// **COMMANDS**:
//   --current     Show currently active app
//   --list        List all backup directories
//   --restore     Restore from backup
//   --help        Show help message
// ============================================================================

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = path.join(__dirname, '..');
const PAGES_DIR = path.join(PROJECT_ROOT, 'pages');
const BACKUP_DIR = path.join(PROJECT_ROOT, '.app-backups');
const APP_MAIN_PAGES_DIR = path.join(PROJECT_ROOT, 'app_main_pages');
const ARCHITECTURE_GUIDE_PATH = 'development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md';
const INDICATOR_FILE = 'INDEX.md';

// Automatically scan for available apps
function scanAvailableApps() {
  const apps = [];
  const entries = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true });
  
  entries.forEach(entry => {
    if (entry.isDirectory() && entry.name.startsWith('app_') && entry.name.endsWith('_pages')) {
      const appName = entry.name.replace(/^app_/, '').replace(/_pages$/, '');
      if (appName !== 'main') {
        apps.push(appName);
      }
    }
  });
  
  return apps.sort();
}

const SUPPORTED_APPS = scanAvailableApps();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ Error: ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Get target app from command line argument or environment variable
function getTargetApp() {
  const argApp = process.argv[2];
  const envApp = process.env.APP_ENTRY;
  
  const targetApp = argApp || envApp || 'main';
  
  if (targetApp === 'main') {
    return 'main';
  }
  
  if (!SUPPORTED_APPS.includes(targetApp)) {
    error(`Unsupported app: ${targetApp}`);
    info(`Supported apps: ${SUPPORTED_APPS.join(', ')}`);
    info(`Use 'main' for app_main_pages`);
    process.exit(1);
  }
  
  return targetApp;
}

// Get source pages directory
function getSourcePagesDir(targetApp) {
  if (targetApp === 'main') {
    return APP_MAIN_PAGES_DIR;
  }
  return path.join(PROJECT_ROOT, `app_${targetApp}_pages`);
}

// Recursively remove directory contents
function clearDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  entries.forEach(entry => {
    const entryPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      clearDirectory(entryPath);
      fs.rmdirSync(entryPath);
    } else {
      fs.unlinkSync(entryPath);
    }
  });
}

// Recursively copy directory
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    error(`Source directory not found: ${src}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  entries.forEach(entry => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Create indicator file
function createIndicatorFile(targetApp, pagesDir) {
  const indicatorPath = path.join(pagesDir, INDICATOR_FILE);
  const sourceDir = targetApp === 'main' ? 'app_main_pages' : `app_${targetApp}_pages`;
  
  const content = `# Pages Directory Indicator

⚠️ **DO NOT EDIT FILES IN THIS DIRECTORY DIRECTLY**

This \`pages/\` directory is automatically managed by the multi-app architecture system.

## Current Active App

**App Name:** ${targetApp === 'main' ? 'main (app_main_pages)' : targetApp}
**Source Directory:** \`${sourceDir}/\`

## How It Works

1. The \`pages/\` directory is **recursively cleared and repopulated** when switching apps
2. All files are copied from \`${sourceDir}/\` to \`pages/\`
3. Any changes made directly to \`pages/\` will be **lost** when switching apps

## How to Modify Pages

**✅ CORRECT:** Edit files in \`${sourceDir}/\`
- Changes persist across app switches
- Source of truth for app pages

**❌ WRONG:** Edit files in \`pages/\`
- Changes will be overwritten
- Not the source of truth

## Architecture Guide

For complete architecture documentation, see:
\`${ARCHITECTURE_GUIDE_PATH}\`

## Switching Apps

To switch to a different app:
\`\`\`bash
node scripts/switch-pages-directory.js [appname]
\`\`\`

Available apps: ${SUPPORTED_APPS.join(', ')}, main

## AI Instructions

When AI assistants need to modify pages:
1. **Always** edit files in \`${sourceDir}/\`
2. **Never** edit files in \`pages/\` directly
3. After editing source files, run the switch script to update \`pages/\`
4. Reference this file to understand the architecture
`;

  fs.writeFileSync(indicatorPath, content, 'utf8');
}

// Create backup directory if it doesn't exist
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    info(`Created backup directory: ${BACKUP_DIR}`);
  }
}

// Backup current pages directory
function backupCurrentPages() {
  if (!fs.existsSync(PAGES_DIR)) {
    return null;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `pages.backup.${timestamp}`);
  
  copyDirectory(PAGES_DIR, backupPath);
  info(`Backed up current pages/ to: ${backupPath}`);
  
  return backupPath;
}

// Switch to the target app's pages
function switchToApp(targetApp) {
  const sourcePagesDir = getSourcePagesDir(targetApp);
  
  // Check if source directory exists
  if (!fs.existsSync(sourcePagesDir)) {
    error(`Source pages directory not found: ${sourcePagesDir}`);
    if (targetApp === 'main') {
      info(`Please ensure app_main_pages directory exists`);
    } else {
      info(`Please create the directory: app_${targetApp}_pages`);
      info(`You can copy app_main_pages as a template: cp -r app_main_pages app_${targetApp}_pages`);
    }
    process.exit(1);
  }
  
  // Backup current pages if exists
  backupCurrentPages();
  
  // Clear current pages directory
  if (fs.existsSync(PAGES_DIR)) {
    clearDirectory(PAGES_DIR);
    info(`Cleared pages/ directory`);
  } else {
    fs.mkdirSync(PAGES_DIR, { recursive: true });
  }
  
  // Copy source pages to pages directory
  copyDirectory(sourcePagesDir, PAGES_DIR);
  info(`Copied ${sourcePagesDir} → pages/`);
  
  // Create indicator file
  createIndicatorFile(targetApp, PAGES_DIR);
  info(`Created indicator file: ${INDICATOR_FILE}`);
  
  success(`Successfully switched to ${targetApp} app pages`);
  info(`Source: ${sourcePagesDir}`);
  info(`Target: pages/`);
}

// Restore from backup
function restoreFromBackup(backupName) {
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  if (!fs.existsSync(backupPath)) {
    error(`Backup directory not found: ${backupPath}`);
    process.exit(1);
  }
  
  // Clear current pages
  if (fs.existsSync(PAGES_DIR)) {
    clearDirectory(PAGES_DIR);
  }
  
  // Copy backup to pages
  copyDirectory(backupPath, PAGES_DIR);
  
  success(`Restored pages/ from backup: ${backupName}`);
}

// List available backups
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    info('No backups found');
    return;
  }
  
  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
  const backups = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('pages.backup.'))
    .map(entry => entry.name)
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    info('No backups found');
    return;
  }
  
  info('Available backups:');
  backups.forEach((backup, index) => {
    log(`  ${index + 1}. ${backup}`, 'cyan');
  });
}

// Show current app
function showCurrentApp() {
  if (!fs.existsSync(PAGES_DIR)) {
    warning('pages/ directory does not exist');
    return;
  }
  
  const indicatorPath = path.join(PAGES_DIR, INDICATOR_FILE);
  
  if (fs.existsSync(indicatorPath)) {
    const content = fs.readFileSync(indicatorPath, 'utf8');
    const match = content.match(/\*\*App Name:\*\* (.+)/);
    
    if (match) {
      info(`Current app: ${match[1]}`);
    } else {
      warning('Cannot determine current app from indicator file');
    }
  } else {
    warning('Indicator file not found. Pages directory may not be managed by this script.');
  }
}

// Show help
function showHelp() {
  log('\n📚 Multi-App Pages Directory Switcher', 'bright');
  log('\nUsage:');
  log('  node scripts/switch-pages-directory.js <appname>    Switch to specific app pages');
  log('  node scripts/switch-pages-directory.js --current    Show current app');
  log('  node scripts/switch-pages-directory.js --list       List available backups');
  log('  node scripts/switch-pages-directory.js --help       Show this help');
  log('\nSupported apps:', 'yellow');
  SUPPORTED_APPS.forEach(app => {
    log(`  • ${app}`, 'cyan');
  });
  log('  • main (app_main_pages)', 'cyan');
  log('\nEnvironment variable:');
  log('  APP_ENTRY=dev node scripts/switch-pages-directory.js');
  log('\nExamples:');
  log('  node scripts/switch-pages-directory.js main');
  log('  node scripts/switch-pages-directory.js ittools');
  log('  APP_ENTRY=pymatrix node scripts/switch-pages-directory.js');
  log('\nNote:');
  log('  This script recursively clears and copies the pages/ directory.');
  log('  Always edit files in app_{namespace}_pages/ directories, not pages/ directly.');
}

// Main execution
function main() {
  const arg = process.argv[2];
  
  // Handle special commands
  switch (arg) {
    case '--help':
    case '-h':
      showHelp();
      return;
      
    case '--current':
    case '-c':
      showCurrentApp();
      return;
      
    case '--list':
    case '-l':
      listBackups();
      return;
      
    case '--restore':
    case '-r':
      const backupName = process.argv[3];
      if (!backupName) {
        error('Please specify backup directory to restore');
        listBackups();
        process.exit(1);
      }
      ensureBackupDir();
      restoreFromBackup(backupName);
      return;
  }
  
  // Normal app switching
  const targetApp = getTargetApp();
  
  log(`\n🚀 Switching to ${targetApp} app pages...`, 'bright');
  
  ensureBackupDir();
  switchToApp(targetApp);
  
  log(`\n🎉 Ready to start ${targetApp} app!`, 'green');
  log(`Run: yarn dev:${targetApp}`, 'cyan');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  switchToApp,
  getTargetApp,
  SUPPORTED_APPS
};

