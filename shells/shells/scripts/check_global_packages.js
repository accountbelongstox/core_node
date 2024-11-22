import { execSync } from 'child_process';
import path from 'path';

/**
 * Get list of globally installed npm packages
 * @returns {Map<string, string>} Map of package names and versions
 */
function getGlobalPackages() {
    try {
        const output = execSync('npm list -g --depth=0', { encoding: 'utf8' });
        const packagesMap = new Map();
        
        output.split('\n').forEach(line => {
            // Skip first line (directory path) and empty lines
            if (line.includes('node_modules')) return;
            if (!line.trim()) return;

            // Extract package name and version
            const match = line.trim().match(/[├└]── ([@\w-]+)@([\d\.]+)/);
            if (match) {
                const [, name, version] = match;
                packagesMap.set(name, version);
            }
        });

        return packagesMap;
    } catch (error) {
        console.error('Error getting global packages:', error.message);
        return new Map();
    }
}

/**
 * Check if a package is installed globally
 * @param {string} packageName - Name of the package to check
 * @returns {boolean} Whether the package is installed
 */
function isPackageInstalled(packageName) {
    const packages = getGlobalPackages();
    return packages.has(packageName);
}

/**
 * Install a global package if not already installed
 * @param {string} packageName - Name of the package to install
 * @returns {boolean} Whether the installation was successful
 */
function ensurePackageInstalled(packageName) {
    if (isPackageInstalled(packageName)) {
        console.log(`Package ${packageName} is already installed`);
        return true;
    }

    try {
        console.log(`Installing ${packageName}...`);
        execSync(`npm install -g ${packageName}`, { stdio: 'inherit' });
        console.log(`Successfully installed ${packageName}`);
        return true;
    } catch (error) {
        console.error(`Failed to install ${packageName}:`, error.message);
        return false;
    }
}

/**
 * List all globally installed packages
 */
function listGlobalPackages() {
    const packages = getGlobalPackages();
    console.log('\nGlobally installed packages:');
    console.log('-'.repeat(50));
    for (const [name, version] of packages) {
        console.log(`${name}@${version}`);
    }
}

/**
 * Main function to handle command line arguments
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const packageName = args[1];

    if (!command) {
        console.log(`
Usage: node ${path.basename(process.argv[1])} <command> [package]

Commands:
  list                     List all globally installed packages
  check <package>          Check if a package is installed
  install <package>        Install a package if not already installed
  ensure <package>         Same as install

Examples:
  node check_global_packages.js list
  node check_global_packages.js check typescript
  node check_global_packages.js install pm2
        `);
        process.exit(1);
    }

    switch (command.toLowerCase()) {
        case 'list':
            listGlobalPackages();
            break;

        case 'check':
            if (!packageName) {
                console.error('Please specify a package name to check');
                process.exit(1);
            }
            const isInstalled = isPackageInstalled(packageName);
            console.log(`Package ${packageName} is ${isInstalled ? 'installed' : 'not installed'}`);
            process.exit(isInstalled ? 0 : 1);
            break;

        case 'install':
        case 'ensure':
            if (!packageName) {
                console.error('Please specify a package name to install');
                process.exit(1);
            }
            const success = ensurePackageInstalled(packageName);
            process.exit(success ? 0 : 1);
            break;

        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

export {
    getGlobalPackages,
    isPackageInstalled,
    ensurePackageInstalled,
    listGlobalPackages
}; 