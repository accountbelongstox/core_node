// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const https = require('https');

const NPMRC_PATH = path.join(os.homedir(), '.npmrc');

// Define multiple mirror configurations
const MIRROR_CONFIGS = {
    npmmirror: {
        registry: 'https://registry.npmmirror.com',
        electron_mirror: 'https://cdn.npmmirror.com/mirrors/electron/',
        electron_builder_binaries_mirror: 'https://cdn.npmmirror.com/mirrors/electron-builder-binaries/',
        sass_binary_site: 'https://cdn.npmmirror.com/mirrors/node-sass',
        phantomjs_cdnurl: 'https://cdn.npmmirror.com/mirrors/phantomjs',
        puppeteer_download_host: 'https://cdn.npmmirror.com/mirrors/puppeteer',
        chromedriver_cdnurl: 'https://cdn.npmmirror.com/mirrors/chromedriver',
        operadriver_cdnurl: 'https://cdn.npmmirror.com/mirrors/operadriver',
        selenium_cdnurl: 'https://cdn.npmmirror.com/binaries/selenium',
        node_inspector_cdnurl: 'https://cdn.npmmirror.com/mirrors/node-inspector',
        sharp_libvips_binary_host: 'https://cdn.npmmirror.com/mirrors/sharp-libvips-binary-host',
        python_mirror: 'https://cdn.npmmirror.com/mirrors/python',
        canvas_binary_host_mirror: 'https://cdn.npmmirror.com/mirrors/canvas-binary-host',
        node_gyp_binary_host: 'https://cdn.npmmirror.com/binaries/node-gyp',
        node_gyp: 'https://cdn.npmmirror.com/binaries/node-gyp'
    },
};

/**
 * Test mirror speed
 * @param {string} url - Mirror URL to test
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<number>} Response time in milliseconds
 */
function testMirrorSpeed(url, timeout = 10000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const timeoutId = setTimeout(() => {
            resolve(timeout);
        }, timeout);

        https.get(url, { timeout }, (res) => {
            clearTimeout(timeoutId);
            const endTime = Date.now();
            res.destroy();
            resolve(endTime - startTime);
        }).on('error', () => {
            clearTimeout(timeoutId);
            resolve(timeout);
        });
    });
}

/**
 * Test all mirrors and select the fastest one
 * @returns {Promise<Object>} Configuration of the fastest mirror
 */
async function selectFastestMirror() {
    console.log('Testing mirror speeds...');
    const results = [];

    for (const [name, config] of Object.entries(MIRROR_CONFIGS)) {
        const speed = await testMirrorSpeed(config.registry);
        results.push({
            name,
            config,
            speed: speed >= 10000 ? Infinity : speed
        });
        console.log(`${name}: ${speed >= 10000 ? 'Timeout' : speed + 'ms'}`);
    }

    // Sort by speed and select the fastest
    results.sort((a, b) => a.speed - b.speed);
    const fastest = results[0];

    if (fastest.speed === Infinity) {
        console.error('All mirrors are unreachable! Using npmmirror as fallback.');
        return MIRROR_CONFIGS.npmmirror;
    }

    console.log(`\nSelected fastest mirror: ${fastest.name} (${fastest.speed}ms)`);
    return fastest.config;
}

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
 * Main function
 */
async function main() {
    console.log('Checking npm configuration...');
    
    // Test and select the fastest mirror
    const REQUIRED_SETTINGS = await selectFastestMirror();
    
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
        console.log('npm configuration is already using the fastest mirror');
    }
}

// Run main function when called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = {
    MIRROR_CONFIGS,
    readNpmrc,
    writeNpmrc,
    testMirrorSpeed,
    selectFastestMirror
}; 