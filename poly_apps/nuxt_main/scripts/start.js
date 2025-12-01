#!/usr/bin/env node
/**
 * Nuxt Main Start Script - Full Featured Launcher (JavaScript Version)
 *
 * Equivalent to start.ps1 with all features
 *
 * Usage:
 *   node start.js                    # Interactive menu
 *   node start.js <app>              # Direct launch in debug mode
 *   node start.js <app> debug        # Direct launch in debug mode
 *   node start.js <app> build        # Direct launch in build mode
 *   node start.js help               # Show help
 *   node start.js list               # List available apps
 *   node start.js -MultiApps a,b     # Multi-app debug mode
 *
 * Examples:
 *   node start.js pymatrix           # Start pyMatrix in debug mode
 *   node start.js ittools build      # Build ITTools
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, execSync } = require('child_process');

// ============================================================
// Global Variables
// ============================================================
const ORIGINAL_WORKING_DIR = process.cwd();
const SCRIPT_DIR = __dirname;
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const SWITCH_APP_SCRIPT = path.join(SCRIPT_DIR, 'switch-app.js');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator(color = 'cyan') {
  log('='.repeat(79), color);
}

// ============================================================
// App Configuration Scanner
// ============================================================
function scanAppConfigs() {
  const appsDir = path.join(APP_DIR, 'apps');
  const appConfigs = {};

  if (!fs.existsSync(appsDir)) {
    return appConfigs;
  }

  const entries = fs.readdirSync(appsDir, { withFileTypes: true });

  entries.forEach(entry => {
    if (entry.isDirectory() && entry.name.startsWith('app_')) {
      const appName = entry.name.replace(/^app_/, '');
      const configPath = path.join(appsDir, entry.name, 'app-config.json');

      if (fs.existsSync(configPath)) {
        try {
          const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          appConfigs[appName] = {
            name: appName,
            displayName: configData.displayName || configData.display_name || appName,
            port: configData.port || 3000,
            devCommand: configData.devCommand || configData.dev_command || 'nuxt dev',
            buildCommand: configData.buildCommand || configData.build_command || 'nuxt build'
          };
        } catch (e) {
          // Skip invalid config
        }
      }
    }
  });

  return appConfigs;
}

// ============================================================
// Interactive Menu
// ============================================================
async function showInteractiveMenu(appConfigs, savedState) {
  const apps = Object.keys(appConfigs).sort();
  let selectedIndex = savedState.selectedIndex || 0;
  let mode = savedState.mode || 'debug';

  if (selectedIndex >= apps.length) selectedIndex = 0;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  function render() {
    console.clear();
    separator('green');
    log('  NUXT MULTI-APP LAUNCHER - INTERACTIVE MENU', 'green');
    separator('green');
    log('');
    log('Use Arrow Keys to navigate, Enter to select, Q to quit', 'yellow');
    log('Press D for Debug mode, B for Build mode', 'yellow');
    log('');
    log(`Current Mode: ${mode.toUpperCase()}`, mode === 'debug' ? 'cyan' : 'magenta');
    log('');

    apps.forEach((appName, index) => {
      const config = appConfigs[appName];
      const prefix = index === selectedIndex ? '→' : ' ';
      const color = index === selectedIndex ? 'cyan' : 'white';
      log(`  ${prefix} [${index + 1}] ${config.displayName} (${appName}) - Port ${config.port}`, color);
    });

    log('');
    separator('green');
  }

  return new Promise((resolve) => {
    render();

    process.stdin.on('keypress', (str, key) => {
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        process.stdin.setRawMode(false);
        rl.close();
        process.exit(0);
      }

      if (key.name === 'up') {
        selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : apps.length - 1;
        render();
      } else if (key.name === 'down') {
        selectedIndex = selectedIndex < apps.length - 1 ? selectedIndex + 1 : 0;
        render();
      } else if (key.name === 'd') {
        mode = 'debug';
        render();
      } else if (key.name === 'b') {
        mode = 'build';
        render();
      } else if (key.name === 'return') {
        process.stdin.setRawMode(false);
        rl.close();
        const appName = apps[selectedIndex];
        resolve({
          selectedApp: appConfigs[appName],
          mode: mode,
          selectedIndex: selectedIndex
        });
      }
    });
  });
}

// ============================================================
// Menu State Management
// ============================================================
function getMenuState() {
  const statePath = path.join(APP_DIR, '.menu-state.json');
  try {
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (e) {
    // Return default
  }
  return { selectedIndex: 0, mode: 'debug' };
}

function saveMenuState(selectedIndex, mode) {
  const statePath = path.join(APP_DIR, '.menu-state.json');
  fs.writeFileSync(statePath, JSON.stringify({ selectedIndex, mode }), 'utf8');
}

// ============================================================
// Parse Arguments
// ============================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    appName: '',
    mode: 'debug',
    multiApps: [],
    showHelp: false,
    showList: false
  };

  if (args.length === 0) {
    return result; // Interactive mode
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === 'help' || arg === '-h' || arg === '--help') {
      result.showHelp = true;
      return result;
    }

    if (arg === 'list' || arg === '-list' || arg === '--list') {
      result.showList = true;
      return result;
    }

    if (arg === '-MultiApps' || arg === '--multi' || arg === 'multi') {
      const nextArg = args[i + 1];
      if (nextArg) {
        result.multiApps = nextArg.split(',').map(s => s.trim());
        i++;
      }
      continue;
    }

    if (i === 0) {
      result.appName = arg;
    } else if (i === 1) {
      if (arg === 'debug' || arg === 'build') {
        result.mode = arg;
      }
    }
  }

  return result;
}

// ============================================================
// Show Help
// ============================================================
function showHelp(appConfigs) {
  log('');
  separator('green');
  log('  NUXT MAIN LAUNCHER - HELP', 'green');
  separator('green');
  log('');
  log('Usage:', 'yellow');
  log('  node start.js                    Interactive menu', 'white');
  log('  node start.js <app>              Direct launch in debug mode', 'white');
  log('  node start.js <app> debug        Direct launch in debug mode', 'white');
  log('  node start.js <app> build        Direct launch in build mode', 'white');
  log('  node start.js list               List available apps', 'white');
  log('  node start.js help               Show this help', 'white');
  log('  node start.js -MultiApps a,b     Multi-app debug mode', 'white');
  log('');
  log('Available Apps:', 'yellow');
  Object.keys(appConfigs).sort().forEach(key => {
    const config = appConfigs[key];
    log(`  - ${key}`, 'cyan');
    log(`    (${config.displayName} on port ${config.port})`, 'gray');
  });
  log('');
  log('Examples:', 'yellow');
  log('  node start.js pymatrix           Start pyMatrix in debug mode', 'white');
  log('  node start.js ittools build      Build ITTools', 'white');
  log('');
  separator('green');
}

// ============================================================
// Show List
// ============================================================
function showList(appConfigs) {
  log('');
  separator('green');
  log('  AVAILABLE APPLICATIONS', 'green');
  separator('green');
  log('');
  Object.keys(appConfigs).sort().forEach(key => {
    const config = appConfigs[key];
    log('  App Name     : ', 'yellow');
    log(`  ${key}`, 'cyan');
    log('  Display Name : ', 'yellow');
    log(`  ${config.displayName}`, 'white');
    log('  Port         : ', 'yellow');
    log(`  ${config.port}`, 'white');
    log('');
  });
  separator('green');
}

// ============================================================
// Execute Command with Error Handling
// ============================================================
function executeCommand(command, args, description, cwd, env) {
  log('');
  separator('magenta');
  log(`  ${description}`, 'magenta');
  separator('magenta');
  log(`[COMMAND] ${command} ${args.join(' ')}`, 'yellow');
  log('');

  try {
    execSync(`${command} ${args.join(' ')}`, {
      cwd: cwd,
      env: { ...process.env, ...env },
      stdio: 'inherit'
    });
    log('');
    log(`[SUCCESS] ${description} completed`, 'green');
    separator('magenta');
    log('');
    return true;
  } catch (error) {
    log('');
    log(`[ERROR] ${description} failed`, 'red');
    log(`[ERROR] ${error.message}`, 'red');
    separator('magenta');
    log('');
    return false;
  }
}

// ============================================================
// Main Function
// ============================================================
async function main() {
  log('');
  separator('cyan');
  log('  NUXT MAIN APPLICATION LAUNCHER - INITIALIZATION', 'cyan');
  separator('cyan');
  log('');
  log('[TRACE] Script Initialization:', 'yellow');
  log(`  > Original Working Directory: ${ORIGINAL_WORKING_DIR}`, 'white');
  log(`  > Script Directory: ${SCRIPT_DIR}`, 'white');
  log(`  > Application Directory: ${APP_DIR}`, 'white');
  log('');

  // Scan app configs
  log('[TRACE] Scanning application configurations...', 'yellow');
  const appConfigs = scanAppConfigs();
  log(`  [OK] Found ${Object.keys(appConfigs).length} applications`, 'green');
  log('');

  // Change to app directory
  log('[TRACE] Changing Directory to Application Root:', 'yellow');
  log(`  > Set Working Directory: ${APP_DIR}`, 'white');
  process.chdir(APP_DIR);
  log(`  [OK] Current Location: ${process.cwd()}`, 'green');
  log('');
  separator('cyan');
  log('');

  // Parse arguments
  const parsedArgs = parseArgs();

  if (parsedArgs.showHelp) {
    showHelp(appConfigs);
    process.exit(0);
  }

  if (parsedArgs.showList) {
    showList(appConfigs);
    process.exit(0);
  }

  // Determine mode
  let selectedApp;
  let mode;
  let selectedIndex = 0;

  if (parsedArgs.appName) {
    // Command-line mode
    if (!appConfigs[parsedArgs.appName]) {
      log('');
      separator('red');
      log(`  ERROR: Unknown application '${parsedArgs.appName}'`, 'red');
      separator('red');
      log('');
      log('Available apps:', 'yellow');
      Object.keys(appConfigs).sort().forEach(key => {
        log(`  - ${key}`, 'cyan');
      });
      log('');
      process.exit(1);
    }

    selectedApp = appConfigs[parsedArgs.appName];
    mode = parsedArgs.mode;

    log('');
    separator('green');
    log('  COMMAND-LINE MODE ACTIVATED', 'green');
    separator('green');
    log(`  Selected App: ${selectedApp.displayName}`, 'cyan');
    log(`  Mode: ${mode}`, 'cyan');
    separator('green');
    log('');
  } else {
    // Interactive mode
    const savedState = getMenuState();
    const menuResult = await showInteractiveMenu(appConfigs, savedState);
    selectedApp = menuResult.selectedApp;
    mode = menuResult.mode;
    selectedIndex = menuResult.selectedIndex;
    saveMenuState(selectedIndex, mode);
  }

  // Set environment variables
  const env = {
    NUXT_HOST: '0.0.0.0',
    NUXT_PORT: selectedApp.port.toString(),
    APP_ENTRY: selectedApp.name
  };

  log('');
  separator('cyan');
  log('  APPLICATION STARTUP INFO', 'cyan');
  separator('cyan');
  log('');
  log('=== Application Selection ===', 'yellow');
  log(`  Selected App     : ${selectedApp.displayName}`, 'green');
  log(`  Namespace        : ${selectedApp.name}`, 'green');
  log(`  Mode             : ${mode}`, 'green');
  log(`  Port             : ${selectedApp.port}`, 'green');
  log(`  Host             : 0.0.0.0`, 'green');
  log('');
  log('=== Network Configuration ===', 'yellow');
  log(`  Local URL        : http://127.0.0.1:${selectedApp.port}`, 'cyan');
  log(`  Network URL      : http://0.0.0.0:${selectedApp.port}`, 'cyan');
  log('');
  separator('cyan');
  log('');

  // Step 1: Switch pages directory
  const switchSuccess = executeCommand(
    'node',
    [SWITCH_APP_SCRIPT, selectedApp.name],
    'STEP 1: SWITCHING APP PAGES DIRECTORY',
    APP_DIR,
    env
  );

  if (!switchSuccess) {
    log('[ERROR] Failed to switch pages directory', 'red');
    process.exit(1);
  }

  // Step 2: Start application server
  if (mode === 'debug') {
    log('');
    log('[INFO] Opening browser...', 'green');
    const url = `http://127.0.0.1:${selectedApp.port}`;
    try {
      const openCommand = process.platform === 'win32' ? 'start' :
                         process.platform === 'darwin' ? 'open' : 'xdg-open';
      require('child_process').exec(`${openCommand} ${url}`);
    } catch (e) {
      log('[WARNING] Could not open browser automatically', 'yellow');
    }

    executeCommand(
      'node',
      [SWITCH_APP_SCRIPT, selectedApp.name, '--mode', 'dev'],
      'STEP 2: STARTING APPLICATION SERVER (DEBUG MODE)',
      APP_DIR,
      env
    );
  } else {
    executeCommand(
      'node',
      [SWITCH_APP_SCRIPT, selectedApp.name, '--mode', 'build'],
      'STEP 2: BUILDING APPLICATION (BUILD MODE)',
      APP_DIR,
      env
    );
  }

  // Restore original directory
  process.chdir(ORIGINAL_WORKING_DIR);
}

// ============================================================
// Entry Point
// ============================================================
main().catch(error => {
  console.error('[FATAL ERROR]', error);
  process.exit(1);
});
