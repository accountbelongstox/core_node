import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { COMMAND_NAME, DESCRIPTION, EXTENSION_ID, HOST_NAME } from './constant';
import { BrowserType, getBrowserConfig, detectInstalledBrowsers } from './browser-config';

export const access = promisify(fs.access);
export const mkdir = promisify(fs.mkdir);
export const writeFile = promisify(fs.writeFile);

/**
 * Print colored text
 */
export function colorText(text: string, color: string): string {
  const colors: Record<string, string> = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
  };

  return colors[color] + text + colors.reset;
}

/**
 * Get user-level manifest file path
 */
export function getUserManifestPath(): string {
  if (os.platform() === 'win32') {
    // Windows: %APPDATA%\Google\Chrome\NativeMessagingHosts\
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  } else if (os.platform() === 'darwin') {
    // macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  } else {
    // Linux: ~/.config/google-chrome/NativeMessagingHosts/
    return path.join(
      os.homedir(),
      '.config',
      'google-chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  }
}

/**
 * Get system-level manifest file path
 */
export function getSystemManifestPath(): string {
  if (os.platform() === 'win32') {
    // Windows: %ProgramFiles%\Google\Chrome\NativeMessagingHosts\
    return path.join(
      process.env.ProgramFiles || 'C:\\Program Files',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  } else if (os.platform() === 'darwin') {
    // macOS: /Library/Google/Chrome/NativeMessagingHosts/
    return path.join('/Library', 'Google', 'Chrome', 'NativeMessagingHosts', `${HOST_NAME}.json`);
  } else {
    // Linux: /etc/opt/chrome/native-messaging-hosts/
    return path.join('/etc', 'opt', 'chrome', 'native-messaging-hosts', `${HOST_NAME}.json`);
  }
}

/**
 * Get native host startup script file path
 */
export async function getMainPath(): Promise<string> {
  try {
    const packageDistDir = path.join(__dirname, '..');
    const wrapperScriptName = process.platform === 'win32' ? 'run_host.bat' : 'run_host.sh';
    const absoluteWrapperPath = path.resolve(packageDistDir, wrapperScriptName);
    return absoluteWrapperPath;
  } catch (error) {
    console.log(colorText('Cannot find global package path, using current directory', 'yellow'));
    throw error;
  }
}

/**
 * Ensure critical files have execution permissions
 */
export async function ensureExecutionPermissions(): Promise<void> {
  try {
    const packageDistDir = path.join(__dirname, '..');

    if (process.platform === 'win32') {
      // Windows platform handling
      await ensureWindowsFilePermissions(packageDistDir);
      return;
    }

    // Unix/Linux platform handling
    const filesToCheck = [
      path.join(packageDistDir, 'index.js'),
      path.join(packageDistDir, 'run_host.sh'),
      path.join(packageDistDir, 'cli.js'),
    ];

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        try {
          fs.chmodSync(filePath, '755');
          console.log(
            colorText(`[OK] Set execution permissions for ${path.basename(filePath)}`, 'green'),
          );
        } catch (err: any) {
          console.warn(
            colorText(
              `[WARNING] Unable to set execution permissions for ${path.basename(filePath)}: ${err.message}`,
              'yellow',
            ),
          );
        }
      } else {
        console.warn(colorText(`⚠️ File not found: ${filePath}`, 'yellow'));
      }
    }
  } catch (error: any) {
    console.warn(colorText(`⚠️ Error ensuring execution permissions: ${error.message}`, 'yellow'));
  }
}

/**
 * Windows platform file permission handling
 */
async function ensureWindowsFilePermissions(packageDistDir: string): Promise<void> {
  const filesToCheck = [
    path.join(packageDistDir, 'index.js'),
    path.join(packageDistDir, 'run_host.bat'),
    path.join(packageDistDir, 'cli.js'),
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      try {
        // Check if file is read-only, if so remove read-only attribute
        const stats = fs.statSync(filePath);
        if (!(stats.mode & parseInt('200', 8))) {
          // Check write permissions
          // Try to remove read-only attribute
          fs.chmodSync(filePath, stats.mode | parseInt('200', 8));
          console.log(
            colorText(`[OK] Removed read-only attribute from ${path.basename(filePath)}`, 'green'),
          );
        }

        // Verify file accessibility
        fs.accessSync(filePath, fs.constants.R_OK);
        console.log(
          colorText(`[OK] Verified file accessibility for ${path.basename(filePath)}`, 'green'),
        );
      } catch (err: any) {
        console.warn(
          colorText(
            `[WARNING] Unable to verify file permissions for ${path.basename(filePath)}: ${err.message}`,
            'yellow',
          ),
        );
      }
    } else {
      console.warn(colorText(`⚠️ File not found: ${filePath}`, 'yellow'));
    }
  }
}

/**
 * Create Native Messaging host manifest content
 */
export async function createManifestContent(): Promise<any> {
  const mainPath = await getMainPath();

  return {
    name: HOST_NAME,
    description: DESCRIPTION,
    path: mainPath, // Node.js executable path
    type: 'stdio',
    allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
  };
}

/**
 * Verify Windows registry entry exists
 */
function verifyWindowsRegistryEntry(registryKey: string, expectedPath: string): boolean {
  if (os.platform() !== 'win32') {
    return true; // Skip verification on non-Windows platforms
  }

  try {
    const result = execSync(`reg query "${registryKey}" /ve`, { encoding: 'utf8', stdio: 'pipe' });
    const lines = result.split('\n');
    for (const line of lines) {
      if (line.includes('REG_SZ') && line.includes(expectedPath.replace(/\\/g, '\\\\'))) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Try to register user-level Native Messaging host
 */
export async function tryRegisterUserLevelHost(targetBrowsers?: BrowserType[]): Promise<boolean> {
  try {
    console.log(colorText('Attempting to register user-level Native Messaging host...', 'blue'));

    // 1. Ensure execution permissions
    await ensureExecutionPermissions();

    // 2. Determine browsers to register
    const browsersToRegister = targetBrowsers || detectInstalledBrowsers();
    if (browsersToRegister.length === 0) {
      // If no browsers detected, register for Chrome and Chromium by default
      browsersToRegister.push(BrowserType.CHROME, BrowserType.CHROMIUM);
      console.log(
        colorText('No browsers detected, registering for Chrome and Chromium by default', 'yellow'),
      );
    } else {
      console.log(colorText(`Detected browsers: ${browsersToRegister.join(', ')}`, 'blue'));
    }

    // 3. Create manifest content
    const manifest = await createManifestContent();

    let successCount = 0;
    const results: { browser: string; success: boolean; error?: string }[] = [];

    // 4. Register for each browser
    for (const browserType of browsersToRegister) {
      const config = getBrowserConfig(browserType);
      console.log(colorText(`\nRegistering for ${config.displayName}...`, 'blue'));

      try {
        // Ensure directory exists
        await mkdir(path.dirname(config.userManifestPath), { recursive: true });

        // Write manifest file
        await writeFile(config.userManifestPath, JSON.stringify(manifest, null, 2));
        console.log(colorText(`[OK] Manifest written to ${config.userManifestPath}`, 'green'));

        // Windows requires additional registry entries
        if (os.platform() === 'win32' && config.registryKey) {
          try {
            const escapedPath = config.userManifestPath.replace(/\\/g, '\\\\');
            const regCommand = `reg add "${config.registryKey}" /ve /t REG_SZ /d "${escapedPath}" /f`;
            execSync(regCommand, { stdio: 'pipe' });

            if (verifyWindowsRegistryEntry(config.registryKey, config.userManifestPath)) {
              console.log(colorText(`[OK] Registry entry created for ${config.displayName}`, 'green'));
            } else {
              throw new Error('Registry verification failed');
            }
          } catch (error: any) {
            throw new Error(`Registry error: ${error.message}`);
          }
        }

        successCount++;
        results.push({ browser: config.displayName, success: true });
        console.log(colorText(`[OK] Successfully registered ${config.displayName}`, 'green'));
      } catch (error: any) {
        results.push({ browser: config.displayName, success: false, error: error.message });
        console.log(
          colorText(`[X] Failed to register ${config.displayName}: ${error.message}`, 'red'),
        );
      }
    }

    // 5. Report results
    console.log(colorText('\n===== Registration Summary =====', 'blue'));
    for (const result of results) {
      if (result.success) {
        console.log(colorText(`[OK] ${result.browser}: Success`, 'green'));
      } else {
        console.log(colorText(`[X] ${result.browser}: Failed - ${result.error}`, 'red'));
      }
    }

    return successCount > 0;
  } catch (error) {
    console.log(
      colorText(
        `User-level registration failed: ${error instanceof Error ? error.message : String(error)}`,
        'yellow',
      ),
    );
    return false;
  }
}

// Import is-admin package (only used on Windows platform)
let isAdmin: () => boolean = () => false;
if (process.platform === 'win32') {
  try {
    isAdmin = require('is-admin');
  } catch (error) {
    console.warn('Missing is-admin dependency, may not be able to correctly detect administrator permissions on Windows');
    console.warn(error);
  }
}

/**
 * Register system-level manifest with elevated permissions
 */
export async function registerWithElevatedPermissions(): Promise<void> {
  try {
    console.log(colorText('Attempting to register system-level manifest...', 'blue'));

    // 1. Ensure execution permissions
    await ensureExecutionPermissions();

    // 2. Prepare manifest content
    const manifest = await createManifestContent();

    // 3. Get system-level manifest path
    const manifestPath = getSystemManifestPath();

    // 4. Create temporary manifest file
    const tempManifestPath = path.join(os.tmpdir(), `${HOST_NAME}.json`);
    await writeFile(tempManifestPath, JSON.stringify(manifest, null, 2));

    // 5. Detect if administrator permissions already exist
    const isRoot = process.getuid && process.getuid() === 0; // Unix/Linux/Mac
    const hasAdminRights = process.platform === 'win32' ? isAdmin() : false; // Windows platform administrator permission detection
    const hasElevatedPermissions = isRoot || hasAdminRights;

    // Prepare command
    const command =
      os.platform() === 'win32'
        ? `if not exist "${path.dirname(manifestPath)}" mkdir "${path.dirname(manifestPath)}" && copy "${tempManifestPath}" "${manifestPath}"`
        : `mkdir -p "${path.dirname(manifestPath)}" && cp "${tempManifestPath}" "${manifestPath}" && chmod 644 "${manifestPath}"`;

    if (hasElevatedPermissions) {
      // Already have administrator permissions, execute command directly
      try {
        // Create directory
        if (!fs.existsSync(path.dirname(manifestPath))) {
          fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        }

        // Copy file
        fs.copyFileSync(tempManifestPath, manifestPath);

        // Set permissions (non-Windows platforms)
        if (os.platform() !== 'win32') {
          fs.chmodSync(manifestPath, '644');
        }

        console.log(colorText('System-level manifest registration successful!', 'green'));
      } catch (error: any) {
        console.error(
          colorText(`System-level manifest installation failed: ${error.message}`, 'red'),
        );
        throw error;
      }
    } else {
      // No administrator permissions, print manual operation instructions
      console.log(
        colorText('[WARNING] Administrator privileges required for system-level installation', 'yellow'),
      );
      console.log(
        colorText(
          'Please run one of the following commands with administrator privileges:',
          'blue',
        ),
      );

      if (os.platform() === 'win32') {
        console.log(colorText('  1. Open Command Prompt as Administrator and run:', 'blue'));
        console.log(colorText(`     ${command}`, 'cyan'));
      } else {
        console.log(colorText('  1. Run with sudo:', 'blue'));
        console.log(colorText(`     sudo ${command}`, 'cyan'));
      }

      console.log(
        colorText('  2. Or run the registration command with elevated privileges:', 'blue'),
      );
      console.log(colorText(`     sudo ${COMMAND_NAME} register --system`, 'cyan'));

      throw new Error('Administrator privileges required for system-level installation');
    }

    // 6. Windows special handling - set system-level registry
    if (os.platform() === 'win32') {
      const registryKey = `HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
      // Ensure path uses correct escape format
      const escapedPath = manifestPath.replace(/\\/g, '\\\\');
      const regCommand = `reg add "${registryKey}" /ve /t REG_SZ /d "${escapedPath}" /f`;

      console.log(colorText(`Creating system registry entry: ${registryKey}`, 'blue'));
      console.log(colorText(`Manifest path: ${manifestPath}`, 'blue'));

      if (hasElevatedPermissions) {
        // Already have administrator permissions, execute registry command directly
        try {
          execSync(regCommand, { stdio: 'pipe' });

          // Verify if registry entry was created successfully
          if (verifyWindowsRegistryEntry(registryKey, manifestPath)) {
            console.log(colorText('Windows registry entry created successfully!', 'green'));
          } else {
            console.log(colorText('[WARNING] Registry entry created but verification failed', 'yellow'));
          }
        } catch (error: any) {
          console.error(
            colorText(`Windows registry entry creation failed: ${error.message}`, 'red'),
          );
          console.error(colorText(`Command: ${regCommand}`, 'red'));
          throw error;
        }
      } else {
        // No administrator permissions, print manual operation instructions
        console.log(
          colorText(
            '[WARNING] Administrator privileges required for Windows registry modification',
            'yellow',
          ),
        );
        console.log(colorText('Please run the following command as Administrator:', 'blue'));
        console.log(colorText(`  ${regCommand}`, 'cyan'));
        console.log(colorText('Or run the registration command with elevated privileges:', 'blue'));
        console.log(
          colorText(
            `  Run Command Prompt as Administrator and execute: ${COMMAND_NAME} register --system`,
            'cyan',
          ),
        );

        throw new Error('Administrator privileges required for Windows registry modification');
      }
    }
  } catch (error: any) {
    console.error(colorText(`Registration failed: ${error.message}`, 'red'));
    throw error;
  }
}
