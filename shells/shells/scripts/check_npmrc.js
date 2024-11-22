import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Standard npmrc configuration map
const NPMRC_CONFIG_MAP = new Map([
    ['registry', 'http://registry.npmmirror.com/'],
    ['disturl', 'https://registry.npmmirror.com/-/binary/node/'],
    ['sass_binary_site', 'https://registry.npmmirror.com/-/binary/node-sass'],
    ['sharp_libvips_binary_host', 'https://registry.npmmirror.com/-/binary/sharp-libvips'],
    ['python_mirror', 'https://registry.npmmirror.com/-/binary/python/'],
    ['electron_mirror', 'https://registry.npmmirror.com/-/binary/electron/'],
    ['electron_builder_binaries_mirror', 'https://registry.npmmirror.com/-/binary/electron-builder-binaries/'],
    ['canvas_binary_host_mirror', 'https://registry.npmmirror.com/-/binary/canvas'],
    ['node_sqlite3_binary_host_mirror', 'https://registry.npmmirror.com/-/binary/sqlite3'],
    ['better_sqlite3_binary_host_mirror', 'https://registry.npmmirror.com/-/binary/better-sqlite3']
]);

/**
 * Ensure npmrc configuration
 * @param {string} configPath - Path to npmrc file
 */
function ensureNpmrcConfig(configPath) {
    let content = '';
    let existingConfig = new Map();

    // Read existing config if file exists
    if (fs.existsSync(configPath)) {
        content = fs.readFileSync(configPath, 'utf8');
        
        // Parse existing configuration
        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key) {
                    existingConfig.set(key.trim(), valueParts.join('=').trim());
                }
            }
        });
    }

    let configUpdated = false;
    let newContent = [];

    // Add or update configurations
    for (const [key, value] of NPMRC_CONFIG_MAP) {
        const existingValue = existingConfig.get(key);
        if (!existingValue) {
            // Add new configuration
            newContent.push(`${key}=${value}`);
            configUpdated = true;
            console.log(`Adding new config: ${key}=${value}`);
        } else if (existingValue !== value) {
            // Update existing configuration
            newContent.push(`${key}=${value}`);
            configUpdated = true;
            console.log(`Updating config: ${key}=${value} (was: ${existingValue})`);
        } else {
            // Keep existing configuration
            newContent.push(`${key}=${existingValue}`);
        }
    }

    // Keep other existing configurations that are not in our map
    existingConfig.forEach((value, key) => {
        if (!NPMRC_CONFIG_MAP.has(key)) {
            newContent.push(`${key}=${value}`);
        }
    });

    // Write updated configuration if changes were made
    if (configUpdated || !fs.existsSync(configPath)) {
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(configPath, newContent.join('\n') + '\n');
        console.log(`Updated npmrc configuration at: ${configPath}`);
    } else {
        console.log(`No updates needed for: ${configPath}`);
    }
}

/**
 * Get npm configuration paths
 */
function getNpmConfigPaths() {
    const homeDir = os.homedir();
    return {
        userConfig: path.join(homeDir, '.npmrc'),
        projectConfig: path.join(process.cwd(), '.npmrc'),
        globalConfig: execSync('npm config get globalconfig', { encoding: 'utf8' }).trim()
    };
}

/**
 * Main function to check and update npm configuration
 */
async function main() {
    try {
        const configPaths = getNpmConfigPaths();

        // Check and update each configuration file
        console.log('\nChecking npmrc configurations...');
        Object.entries(configPaths).forEach(([type, configPath]) => {
            console.log(`\nChecking ${type}:`);
            ensureNpmrcConfig(configPath);
        });

        // Verify npm configuration
        console.log('\nVerifying npm configuration:');
        for (const [key] of NPMRC_CONFIG_MAP) {
            const value = execSync(`npm config get ${key}`, { encoding: 'utf8' }).trim();
            console.log(`${key}: ${value}`);
        }

    } catch (error) {
        console.error('Error checking npm configuration:', error.message);
        process.exit(1);
    }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    NPMRC_CONFIG_MAP,
    ensureNpmrcConfig,
    getNpmConfigPaths
}; 