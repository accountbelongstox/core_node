#!/usr/bin/env node

import os from 'os';
import { COMMAND_NAME } from './constant';
import {
  colorText,
  ensureExecutionPermissions,
  tryRegisterUserLevelHost,
  writeNodePath,
} from './utils';

// Check if this script is run directly
const isDirectRun = require.main === module;

// Detect global installation for both npm and pnpm
function detectGlobalInstall(): boolean {
  // npm uses npm_config_global
  if (process.env.npm_config_global === 'true') {
    return true;
  }

  // pnpm detection methods
  // Method 1: Check if PNPM_HOME is set and current path contains it
  if (process.env.PNPM_HOME && __dirname.includes(process.env.PNPM_HOME)) {
    return true;
  }

  // Method 2: Check if we're in a global pnpm directory structure
  // pnpm global packages are typically installed in ~/.local/share/pnpm/global/5/node_modules
  // Windows: %APPDATA%\pnpm\global\5\node_modules
  const globalPnpmPatterns =
    process.platform === 'win32'
      ? ['\\pnpm\\global\\', '\\pnpm-global\\', '\\AppData\\Roaming\\pnpm\\']
      : ['/pnpm/global/', '/.local/share/pnpm/', '/pnpm-global/'];

  if (globalPnpmPatterns.some((pattern) => __dirname.includes(pattern))) {
    return true;
  }

  // Method 3: Check npm_config_prefix for pnpm
  if (process.env.npm_config_prefix && __dirname.includes(process.env.npm_config_prefix)) {
    return true;
  }

  // Method 4: Windows-specific global installation paths
  if (process.platform === 'win32') {
    const windowsGlobalPatterns = [
      '\\npm\\node_modules\\',
      '\\AppData\\Roaming\\npm\\node_modules\\',
      '\\Program Files\\nodejs\\node_modules\\',
      '\\nodejs\\node_modules\\',
    ];

    if (windowsGlobalPatterns.some((pattern) => __dirname.includes(pattern))) {
      return true;
    }
  }

  return false;
}

const isGlobalInstall = detectGlobalInstall();

async function tryRegisterNativeHost(): Promise<void> {
  try {
    console.log(
      colorText('Attempting to register Native Messaging host for detected browsers...', 'blue'),
    );

    // Always ensure execution permissions, regardless of installation type
    await ensureExecutionPermissions();

    if (isGlobalInstall) {
      // First try user-level installation (no elevated permissions required)
      const userLevelSuccess = await tryRegisterUserLevelHost();

      if (!userLevelSuccess) {
        // User-level installation failed, suggest using register command
        console.log(
          colorText(
            'User-level installation failed, system-level installation may be needed',
            'yellow',
          ),
        );
        console.log(
          colorText('Please run the following command for system-level installation:', 'blue'),
        );
        console.log(`  ${COMMAND_NAME} register --system`);
        printManualInstructions();
      }
    } else {
      // Local installation mode, don't attempt automatic registration
      console.log(
        colorText('Local installation detected, skipping automatic registration', 'yellow'),
      );
      printManualInstructions();
    }
  } catch (error) {
    console.log(
      colorText(
        `Error during registration: ${error instanceof Error ? error.message : String(error)}`,
        'red',
      ),
    );
    printManualInstructions();
  }
}

/**
 * Print manual installation guide
 */
function printManualInstructions(): void {
  console.log('\n' + colorText('===== Manual Registration Guide =====', 'blue'));

  console.log(colorText('1. Try user-level installation (recommended):', 'yellow'));
  if (isGlobalInstall) {
    console.log(`  ${COMMAND_NAME} register`);
  } else {
    console.log(`  npx ${COMMAND_NAME} register`);
  }

  console.log(
    colorText('\n2. If user-level installation fails, try system-level installation:', 'yellow'),
  );

  console.log(colorText('   Use --system parameter (auto-elevate permissions):', 'yellow'));
  if (isGlobalInstall) {
    console.log(`  ${COMMAND_NAME} register --system`);
  } else {
    console.log(`  npx ${COMMAND_NAME} register --system`);
  }

  console.log(colorText('\n   Or use administrator privileges directly:', 'yellow'));
  if (os.platform() === 'win32') {
    console.log(
      colorText(
        '   Please run Command Prompt or PowerShell as administrator and execute:',
        'yellow',
      ),
    );
    if (isGlobalInstall) {
      console.log(`  ${COMMAND_NAME} register`);
    } else {
      console.log(`  npx ${COMMAND_NAME} register`);
    }
  } else {
    console.log(colorText('   Please run the following command in terminal:', 'yellow'));
    if (isGlobalInstall) {
      console.log(`  sudo ${COMMAND_NAME} register`);
    } else {
      console.log(`  sudo npx ${COMMAND_NAME} register`);
    }
  }

  console.log(
    '\n' +
      colorText(
        'Ensure the browser extension (Chrome/Chromium/Firefox) is installed and refresh the extension to connect to local service.',
        'blue',
      ),
  );
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log(colorText(`Installing ${COMMAND_NAME}...`, 'green'));

  // Debug information
  console.log(colorText('Installation environment debug info:', 'blue'));
  console.log(`  __dirname: ${__dirname}`);
  console.log(`  npm_config_global: ${process.env.npm_config_global}`);
  console.log(`  PNPM_HOME: ${process.env.PNPM_HOME}`);
  console.log(`  npm_config_prefix: ${process.env.npm_config_prefix}`);
  console.log(`  isGlobalInstall: ${isGlobalInstall}`);

  // Always ensure execution permissions first
  await ensureExecutionPermissions();

  // Write Node.js path for run_host scripts to use
  await writeNodePath();

  // If global installation, try automatic registration
  if (isGlobalInstall) {
    await tryRegisterNativeHost();
  } else {
    console.log(colorText('Local installation detected', 'yellow'));
    printManualInstructions();
  }
}

// Only execute main function when running this script directly
if (isDirectRun) {
  main().catch((error) => {
    console.error(
      colorText(
        `Installation script error: ${error instanceof Error ? error.message : String(error)}`,
        'red',
      ),
    );
  });
}
