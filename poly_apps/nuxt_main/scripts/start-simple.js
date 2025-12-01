#!/usr/bin/env node
/**
 * Simplified Nuxt App Launcher (JavaScript Version)
 *
 * Equivalent to start.ps1 core logic for launching a single app
 * Usage: node start-simple.js <appname> [port]
 *
 * Example:
 *   node start-simple.js pymatrix 3007
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ============================================================
// Configuration
// ============================================================
const SCRIPT_DIR = __dirname;
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const SWITCH_APP_SCRIPT = path.join(SCRIPT_DIR, 'switch-app.js');

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('[ERROR] Usage: node start-simple.js <appname> [port]');
  console.error('[ERROR] Example: node start-simple.js pymatrix 3007');
  process.exit(1);
}

const APP_NAME = args[0];
const PORT = args[1] || '3000'; // Default port

console.log('');
console.log('='.repeat(70));
console.log('[Nuxt Launcher] Simplified Launcher Starting...');
console.log('='.repeat(70));
console.log(`[Config] App Name: ${APP_NAME}`);
console.log(`[Config] Port: ${PORT}`);
console.log(`[Config] Script Dir: ${SCRIPT_DIR}`);
console.log(`[Config] App Dir: ${APP_DIR}`);
console.log('='.repeat(70));
console.log('');

// ============================================================
// Step 1: Change to app directory
// ============================================================
console.log('[Step 1] Changing to app directory...');
process.chdir(APP_DIR);
console.log(`[Step 1] ✓ Working directory: ${process.cwd()}`);
console.log('');

// ============================================================
// Step 2: Set environment variables
// ============================================================
console.log('[Step 2] Setting environment variables...');
process.env.NUXT_HOST = '0.0.0.0';
process.env.NUXT_PORT = PORT;
process.env.APP_ENTRY = APP_NAME;
console.log(`[Step 2] ✓ NUXT_HOST = 0.0.0.0`);
console.log(`[Step 2] ✓ NUXT_PORT = ${PORT}`);
console.log(`[Step 2] ✓ APP_ENTRY = ${APP_NAME}`);
console.log('');

// ============================================================
// Step 3: Switch pages directory
// ============================================================
console.log('='.repeat(70));
console.log('[Step 3] Switching pages directory...');
console.log('='.repeat(70));
console.log(`[Step 3] Command: node ${SWITCH_APP_SCRIPT} ${APP_NAME}`);
console.log('');

try {
  execSync(`node "${SWITCH_APP_SCRIPT}" ${APP_NAME}`, {
    stdio: 'inherit',
    cwd: APP_DIR,
    env: process.env
  });
  console.log('');
  console.log('[Step 3] ✓ Pages directory switched successfully');
  console.log('');
} catch (error) {
  console.error('[Step 3] ✗ Failed to switch pages directory');
  console.error(error.message);
  process.exit(1);
}

// ============================================================
// Step 4: Start factory sync + dev server
// ============================================================
console.log('='.repeat(70));
console.log('[Step 4] Starting factory sync and dev server...');
console.log('='.repeat(70));
console.log(`[Step 4] Command: node ${SWITCH_APP_SCRIPT} ${APP_NAME} --mode dev`);
console.log(`[Step 4] URL: http://localhost:${PORT}`);
console.log('='.repeat(70));
console.log('');

try {
  // Run in foreground (blocking)
  execSync(`node "${SWITCH_APP_SCRIPT}" ${APP_NAME} --mode dev`, {
    stdio: 'inherit',
    cwd: APP_DIR,
    env: process.env
  });
} catch (error) {
  console.error('[Step 4] ✗ Failed to start dev server');
  console.error(error.message);
  process.exit(1);
}
