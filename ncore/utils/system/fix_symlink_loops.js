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
const { execSync } = require('child_process');

class SymlinkLoopFixer {
    constructor() {
        this.visitedPaths = new Set();
        this.problematicPaths = new Set();
        this.fixedPaths = new Set();
    }

    /**
     * Detect and fix symbolic link loops in system directories
     * @param {string[]} searchPaths - Paths to check for symbolic link loops
     * @returns {Object} Results of the fix operation
     */
    async fixSymlinkLoops(searchPaths = ['/usr/bin', '/usr/local/bin']) {
        const results = {
            detected: [],
            fixed: [],
            errors: []
        };

        console.log('🔍 Scanning for symbolic link loops...');
        
        for (const searchPath of searchPaths) {
            if (!fs.existsSync(searchPath)) {
                console.log(`⚠️  Path does not exist: ${searchPath}`);
                continue;
            }

            try {
                await this.scanDirectory(searchPath, results);
            } catch (error) {
                console.error(`❌ Error scanning ${searchPath}:`, error.message);
                results.errors.push({ path: searchPath, error: error.message });
            }
        }

        // Fix detected loops
        if (results.detected.length > 0) {
            console.log(`🔧 Found ${results.detected.length} symbolic link loops. Attempting to fix...`);
            await this.fixDetectedLoops(results);
        } else {
            console.log('✅ No symbolic link loops detected.');
        }

        return results;
    }

    /**
     * Scan directory for symbolic link loops
     * @private
     */
    async scanDirectory(dirPath, results, depth = 0, maxDepth = 5) {
        if (depth > maxDepth) {
            return;
        }

        let realPath;
        try {
            realPath = fs.realpathSync(dirPath);
        } catch (error) {
            if (error.code === 'ELOOP') {
                console.log(`🔴 Detected symbolic link loop: ${dirPath}`);
                results.detected.push(dirPath);
                this.problematicPaths.add(dirPath);
            }
            return;
        }

        if (this.visitedPaths.has(realPath)) {
            return;
        }
        this.visitedPaths.add(realPath);

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isSymbolicLink()) {
                    try {
                        // Try to resolve the symbolic link
                        fs.realpathSync(fullPath);
                    } catch (error) {
                        if (error.code === 'ELOOP') {
                            console.log(`🔴 Detected symbolic link loop: ${fullPath}`);
                            results.detected.push(fullPath);
                            this.problematicPaths.add(fullPath);
                        }
                    }
                } else if (entry.isDirectory()) {
                    await this.scanDirectory(fullPath, results, depth + 1, maxDepth);
                }
            }
        } catch (error) {
            // Ignore permission errors and continue
            if (error.code !== 'EACCES' && error.code !== 'EPERM') {
                console.debug(`Warning: Cannot read directory ${dirPath}:`, error.message);
            }
        }
    }

    /**
     * Fix detected symbolic link loops
     * @private
     */
    async fixDetectedLoops(results) {
        for (const problematicPath of this.problematicPaths) {
            try {
                console.log(`🔧 Attempting to fix: ${problematicPath}`);
                
                // Check if it's a symbolic link
                const stats = fs.lstatSync(problematicPath);
                if (stats.isSymbolicLink()) {
                    // Get the link target
                    let linkTarget;
                    try {
                        linkTarget = fs.readlinkSync(problematicPath);
                    } catch (error) {
                        console.log(`⚠️  Cannot read link target for ${problematicPath}: ${error.message}`);
                        continue;
                    }

                    // Check if this is a self-referencing or circular link
                    if (this.isCircularLink(problematicPath, linkTarget)) {
                        console.log(`🗑️  Removing circular symbolic link: ${problematicPath} -> ${linkTarget}`);
                        
                        // Backup the link information
                        const backupInfo = {
                            path: problematicPath,
                            target: linkTarget,
                            timestamp: new Date().toISOString()
                        };
                        
                        // Remove the problematic link
                        fs.unlinkSync(problematicPath);
                        
                        results.fixed.push(backupInfo);
                        this.fixedPaths.add(problematicPath);
                        
                        console.log(`✅ Fixed: ${problematicPath}`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error fixing ${problematicPath}:`, error.message);
                results.errors.push({ path: problematicPath, error: error.message });
            }
        }
    }

    /**
     * Check if a symbolic link is circular
     * @private
     */
    isCircularLink(linkPath, linkTarget) {
        // Convert relative target to absolute
        const absoluteTarget = path.isAbsolute(linkTarget) 
            ? linkTarget 
            : path.resolve(path.dirname(linkPath), linkTarget);
        
        // Check for self-reference
        if (absoluteTarget === linkPath) {
            return true;
        }
        
        // Check for common circular patterns
        const linkDir = path.dirname(linkPath);
        const targetDir = path.dirname(absoluteTarget);
        
        // If target points to a parent directory that contains the link
        if (linkPath.startsWith(absoluteTarget)) {
            return true;
        }
        
        // Check for X11 specific circular links
        if (linkPath.includes('/X11/') && absoluteTarget.includes('/X11/')) {
            const linkParts = linkPath.split('/X11/');
            const targetParts = absoluteTarget.split('/X11/');
            if (linkParts.length > 1 && targetParts.length > 1) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Create a backup of symbolic link information before fixing
     * @private
     */
    createBackup(results) {
        if (results.fixed.length === 0) {
            return;
        }

        const backupDir = '/tmp/symlink_loop_backup';
        const backupFile = path.join(backupDir, `backup_${Date.now()}.json`);
        
        try {
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            fs.writeFileSync(backupFile, JSON.stringify(results.fixed, null, 2));
            console.log(`📝 Backup created: ${backupFile}`);
        } catch (error) {
            console.error(`⚠️  Could not create backup: ${error.message}`);
        }
    }
}

/**
 * Main function to fix Chrome/Puppeteer symbolic link issues
 */
async function fixChromeSymlinkIssues() {
    console.log('🚀 Starting Chrome/Puppeteer symbolic link loop fix...');
    
    const fixer = new SymlinkLoopFixer();
    const results = await fixer.fixSymlinkLoops([
        '/usr/bin',
        '/usr/local/bin',
        '/usr/bin/X11',
        '/usr/X11R6/bin'
    ]);
    
    // Create backup of fixed links
    fixer.createBackup(results);
    
    console.log('\n📊 Fix Summary:');
    console.log(`   Loops detected: ${results.detected.length}`);
    console.log(`   Loops fixed: ${results.fixed.length}`);
    console.log(`   Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        results.errors.forEach(error => {
            console.log(`   ${error.path}: ${error.error}`);
        });
    }
    
    return results;
}

module.exports = {
    SymlinkLoopFixer,
    fixChromeSymlinkIssues
};

// If run directly
if (require.main === module) {
    fixChromeSymlinkIssues()
        .then(results => {
            process.exit(results.errors.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}
