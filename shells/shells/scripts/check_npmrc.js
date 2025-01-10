const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const NPMRC_PATH = path.join(os.homedir(), '.npmrc');
const REQUIRED_SETTINGS = {
    'registry': 'https://registry.npmmirror.com',
    'electron_mirror': 'https://npmmirror.com/mirrors/electron/',
    'electron_builder_binaries_mirror': 'https://npmmirror.com/mirrors/electron-builder-binaries/',
    'sass_binary_site': 'https://npmmirror.com/mirrors/node-sass',
    'phantomjs_cdnurl': 'https://npmmirror.com/mirrors/phantomjs',
    'puppeteer_download_host': 'https://npmmirror.com/mirrors',
    'chromedriver_cdnurl': 'https://npmmirror.com/mirrors/chromedriver',
    'operadriver_cdnurl': 'https://npmmirror.com/mirrors/operadriver',
    'selenium_cdnurl': 'https://npmmirror.com/mirrors/selenium',
    'node_inspector_cdnurl': 'https://npmmirror.com/mirrors/node-inspector'
};

/**
 * Read current .npmrc file
 * @returns {Object} Current settings
 */
function readNpmrc() {
    try {
        if (!fs.existsSync(NPMRC_PATH)) {
            return {};
        }

        const content = fs.readFileSync(NPMRC_PATH, 'utf8');
        const settings = {};

        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split('=').map(s => s.trim());
                if (key && value) {
                    settings[key] = value;
                }
            }
        });

        return settings;
    } catch (error) {
        console.error('Error reading .npmrc:', error.message);
        return {};
    }
}

/**
 * Write settings to .npmrc file
 * @param {Object} settings - Settings to write
 */
function writeNpmrc(settings) {
    try {
        const content = Object.entries(settings)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        fs.writeFileSync(NPMRC_PATH, content + '\n');
        console.log('.npmrc file updated successfully');
    } catch (error) {
        console.error('Error writing .npmrc:', error.message);
        process.exit(1);
    }
}

/**
 * Check and update npm configuration
 */
function checkNpmConfig() {
    console.log('Checking npm configuration...');
    
    const currentSettings = readNpmrc();
    let needsUpdate = false;
    const updatedSettings = { ...currentSettings };

    // Check each required setting
    for (const [key, value] of Object.entries(REQUIRED_SETTINGS)) {
        if (currentSettings[key] !== value) {
            console.log(`Setting ${key}=${value}`);
            updatedSettings[key] = value;
            needsUpdate = true;
        }
    }

    // Update if needed
    if (needsUpdate) {
        console.log('Updating .npmrc file...');
        writeNpmrc(updatedSettings);
        
        // Verify npm registry setting
        try {
            execSync('npm config get registry', { stdio: 'inherit' });
        } catch (error) {
            console.error('Error verifying npm registry:', error.message);
        }
    } else {
        console.log('npm configuration is already correct');
    }
}

/**
 * Main function
 */
function main() {
    try {
        checkNpmConfig();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    REQUIRED_SETTINGS,
    readNpmrc,
    writeNpmrc,
    checkNpmConfig,
    main
}; 