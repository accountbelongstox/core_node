#!/usr/bin/env node

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
const { execSync, spawn } = require('child_process');

console.log('🚀 Chrome/Puppeteer Symbolic Link Loop Fix Script');
console.log('================================================\n');

/**
 * Check if running as root/sudo
 */
function checkPermissions() {
    if (process.getuid && process.getuid() !== 0) {
        console.log('⚠️  This script may need sudo privileges to fix system symbolic links.');
        console.log('   If you encounter permission errors, try running with sudo.\n');
    }
}

/**
 * Detect symbolic link loops in common problematic directories
 */
function detectSymlinkLoops() {
    console.log('🔍 Detecting symbolic link loops...');
    
    const problematicPaths = [];
    const checkPaths = [
        '/usr/bin/X11',
        '/usr/X11R6/bin',
        '/usr/bin',
        '/usr/local/bin'
    ];

    for (const checkPath of checkPaths) {
        if (!fs.existsSync(checkPath)) {
            continue;
        }

        try {
            // Try to resolve the real path
            fs.realpathSync(checkPath);
            console.log(`✅ ${checkPath} - OK`);
        } catch (error) {
            if (error.code === 'ELOOP') {
                console.log(`🔴 ${checkPath} - SYMBOLIC LINK LOOP DETECTED`);
                problematicPaths.push(checkPath);
            } else {
                console.log(`⚠️  ${checkPath} - ${error.message}`);
            }
        }

        // Check for specific FileCheck issues
        try {
            const entries = fs.readdirSync(checkPath);
            for (const entry of entries) {
                if (entry.includes('FileCheck')) {
                    const fullPath = path.join(checkPath, entry);
                    try {
                        fs.realpathSync(fullPath);
                    } catch (error) {
                        if (error.code === 'ELOOP') {
                            console.log(`🔴 ${fullPath} - SYMBOLIC LINK LOOP DETECTED`);
                            problematicPaths.push(fullPath);
                        }
                    }
                }
            }
        } catch (error) {
            // Ignore read errors
        }
    }

    return problematicPaths;
}

/**
 * Fix symbolic link loops
 */
function fixSymlinkLoops(problematicPaths) {
    if (problematicPaths.length === 0) {
        console.log('✅ No symbolic link loops to fix.\n');
        return true;
    }

    console.log(`\n🔧 Fixing ${problematicPaths.length} symbolic link loops...`);
    
    const fixed = [];
    const errors = [];

    for (const problematicPath of problematicPaths) {
        try {
            console.log(`   Fixing: ${problematicPath}`);
            
            // Check if it's a symbolic link
            const stats = fs.lstatSync(problematicPath);
            if (stats.isSymbolicLink()) {
                // Get link target for backup
                let linkTarget = '';
                try {
                    linkTarget = fs.readlinkSync(problematicPath);
                } catch (error) {
                    // If we can't read the link, it's definitely broken
                }

                // Create backup info
                const backupInfo = {
                    path: problematicPath,
                    target: linkTarget,
                    timestamp: new Date().toISOString()
                };

                // Remove the problematic link
                fs.unlinkSync(problematicPath);
                
                console.log(`   ✅ Removed: ${problematicPath} -> ${linkTarget}`);
                fixed.push(backupInfo);
            }
        } catch (error) {
            console.log(`   ❌ Error fixing ${problematicPath}: ${error.message}`);
            errors.push({ path: problematicPath, error: error.message });
        }
    }

    // Create backup file
    if (fixed.length > 0) {
        try {
            const backupDir = '/tmp/chrome_symlink_fix_backup';
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const backupFile = path.join(backupDir, `backup_${Date.now()}.json`);
            fs.writeFileSync(backupFile, JSON.stringify(fixed, null, 2));
            console.log(`\n📝 Backup created: ${backupFile}`);
        } catch (error) {
            console.log(`⚠️  Could not create backup: ${error.message}`);
        }
    }

    console.log(`\n📊 Fix Summary:`);
    console.log(`   Fixed: ${fixed.length}`);
    console.log(`   Errors: ${errors.length}`);

    return errors.length === 0;
}

/**
 * Test Chrome launch after fix
 */
async function testChromeAfterFix() {
    console.log('\n🧪 Testing Chrome launch after fix...');
    
    // Try to find Chrome
    const chromePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ];

    let chromePath = null;
    for (const path of chromePaths) {
        if (fs.existsSync(path)) {
            try {
                fs.accessSync(path, fs.constants.X_OK);
                chromePath = path;
                break;
            } catch (error) {
                continue;
            }
        }
    }

    if (!chromePath) {
        console.log('⚠️  Chrome not found in standard locations. Install Chrome first.');
        return false;
    }

    console.log(`   Found Chrome: ${chromePath}`);

    // Test Chrome launch with minimal arguments
    return new Promise((resolve) => {
        const testArgs = [
            '--version',
            '--no-sandbox',
            '--disable-dev-shm-usage'
        ];

        console.log('   Testing Chrome version check...');
        
        const chromeProcess = spawn(chromePath, testArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 10000
        });

        let output = '';
        let errorOutput = '';

        chromeProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        chromeProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        chromeProcess.on('close', (code) => {
            if (code === 0 && output.includes('Google Chrome') || output.includes('Chromium')) {
                console.log(`   ✅ Chrome test successful: ${output.trim()}`);
                resolve(true);
            } else {
                console.log(`   ❌ Chrome test failed (exit code: ${code})`);
                if (errorOutput) {
                    console.log(`   Error output: ${errorOutput.trim()}`);
                }
                resolve(false);
            }
        });

        chromeProcess.on('error', (error) => {
            console.log(`   ❌ Chrome test error: ${error.message}`);
            resolve(false);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            chromeProcess.kill('SIGKILL');
            console.log('   ⏰ Chrome test timed out');
            resolve(false);
        }, 10000);
    });
}

/**
 * Provide recommendations
 */
function provideRecommendations() {
    console.log('\n💡 Recommendations:');
    console.log('   1. If Chrome still fails to start, try reinstalling Chrome:');
    console.log('      sudo apt update && sudo apt install --reinstall google-chrome-stable');
    console.log('   2. Check for system updates that might fix X11 issues:');
    console.log('      sudo apt update && sudo apt upgrade');
    console.log('   3. If using WSL, ensure X11 forwarding is properly configured');
    console.log('   4. Consider using Chrome in headless mode for Puppeteer:');
    console.log('      { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }');
    console.log('   5. Set CHROME_BIN environment variable to bypass path detection:');
    console.log('      export CHROME_BIN=/usr/bin/google-chrome-stable');
}

/**
 * Main execution
 */
async function main() {
    try {
        checkPermissions();
        
        const problematicPaths = detectSymlinkLoops();
        const fixSuccess = fixSymlinkLoops(problematicPaths);
        
        if (fixSuccess) {
            const testSuccess = await testChromeAfterFix();
            
            if (testSuccess) {
                console.log('\n🎉 Chrome/Puppeteer symbolic link issue has been resolved!');
                console.log('   You can now try running your Puppeteer application again.');
            } else {
                console.log('\n⚠️  Symbolic links were fixed, but Chrome test failed.');
                console.log('   There may be other issues preventing Chrome from starting.');
                provideRecommendations();
            }
        } else {
            console.log('\n❌ Some symbolic link fixes failed.');
            console.log('   You may need to run this script with sudo or fix manually.');
            provideRecommendations();
        }
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().then(() => {
        console.log('\n✨ Fix script completed.');
    }).catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = {
    detectSymlinkLoops,
    fixSymlinkLoops,
    testChromeAfterFix
};
