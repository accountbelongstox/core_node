import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const distDir = path.join(__dirname, '..', '..', 'dist');
// Clean previous build
console.log('Cleaning previous build...');
try {
  fs.rmSync(distDir, { recursive: true, force: true });
} catch (err: any) {
  // Non-blocking: EPERM errors on Windows are common when files are in use
  // The build will continue and overwrite files as needed
  if (err.code === 'EPERM') {
    console.log('[WARNING] Permission denied when cleaning dist folder (files may be in use)');
    console.log('[INFO] Build will continue and overwrite files as needed');
  } else if (err.code !== 'ENOENT') {
    // ENOENT means directory doesn't exist, which is fine
    console.log('[WARNING] Error cleaning previous build:', err.message);
  }
}

// Create dist directory
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(path.join(distDir, 'logs'), { recursive: true }); // Create logs directory
console.log('dist and dist/logs directories created/verified');

// Compile TypeScript
console.log('Compiling TypeScript...');
execSync('tsc', { stdio: 'inherit' });

// Copy configuration files
console.log('Copying configuration files...');
const configSourcePath = path.join(__dirname, '..', 'mcp', 'stdio-config.json');
const configDestPath = path.join(distDir, 'mcp', 'stdio-config.json');

try {
  // Ensure target directory exists
  fs.mkdirSync(path.dirname(configDestPath), { recursive: true });

  if (fs.existsSync(configSourcePath)) {
    fs.copyFileSync(configSourcePath, configDestPath);
    console.log(`Copied stdio-config.json to ${configDestPath}`);
  } else {
    console.error(`Error: Configuration file not found: ${configSourcePath}`);
  }
} catch (error) {
  console.error('Error copying configuration file:', error);
}

// Copy package.json and update its content
console.log('Preparing package.json...');
const packageJson = require('../../package.json');

// Create installation instructions
const readmeContent = `# ${packageJson.name}

This program is the Native Messaging host for the Chrome extension.

## Installation

1. Ensure Node.js is installed
2. Install this program globally:
   \`\`\`
   npm install -g ${packageJson.name}
   \`\`\`
3. Register the Native Messaging host:
   \`\`\`
   # User-level installation (recommended)
   ${packageJson.name} register

   # If user-level installation fails, try system-level installation
   ${packageJson.name} register --system
   # Or use administrator privileges
   sudo ${packageJson.name} register
   \`\`\`

## Usage

This application is automatically started by the Chrome extension, no manual execution required.
`;

fs.writeFileSync(path.join(distDir, 'README.md'), readmeContent);

console.log('Copying wrapper scripts...');
const scriptsSourceDir = path.join(__dirname, '.');
const macOsWrapperSourcePath = path.join(scriptsSourceDir, 'run_host.sh');
const windowsWrapperSourcePath = path.join(scriptsSourceDir, 'run_host.bat');

const macOsWrapperDestPath = path.join(distDir, 'run_host.sh');
const windowsWrapperDestPath = path.join(distDir, 'run_host.bat');

try {
  if (fs.existsSync(macOsWrapperSourcePath)) {
    fs.copyFileSync(macOsWrapperSourcePath, macOsWrapperDestPath);
    console.log(`Copied ${macOsWrapperSourcePath} to ${macOsWrapperDestPath}`);
  } else {
    console.error(`Error: macOS wrapper script source not found: ${macOsWrapperSourcePath}`);
  }

  if (fs.existsSync(windowsWrapperSourcePath)) {
    fs.copyFileSync(windowsWrapperSourcePath, windowsWrapperDestPath);
    console.log(`Copied ${windowsWrapperSourcePath} to ${windowsWrapperDestPath}`);
  } else {
    console.error(`Error: Windows wrapper script source not found: ${windowsWrapperSourcePath}`);
  }
} catch (error) {
  console.error('Error copying wrapper scripts:', error);
}

// Add executable permissions to key JavaScript files and macOS wrapper script
console.log('Adding executable permissions...');
const filesToMakeExecutable = ['index.js', 'cli.js', 'run_host.sh']; // cli.js is in dist root

filesToMakeExecutable.forEach((file) => {
  const filePath = path.join(distDir, file); // filePath is now target path
  try {
    if (fs.existsSync(filePath)) {
      fs.chmodSync(filePath, '755');
      console.log(`Added executable permissions to ${file} (755)`);
    } else {
      console.warn(`Warning: ${filePath} does not exist, cannot add executable permissions`);
    }
  } catch (error) {
    console.error(`Error adding executable permissions to ${file}:`, error);
  }
});

console.log('[OK] Build completed');
