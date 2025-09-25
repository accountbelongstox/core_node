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

const path = require('path');
const { execCmdResultText } = require('../../common/cmder.js');
const os = require('os');

// Common binary name mappings between Windows and Linux
const binaryNameMap = {
    // Compression tools
    '7z': ['7z', '7za', '7zr'],
    '7zz': ['7zz', '7z', '7za'],
    'tar': ['tar', 'bsdtar'],
    // Text processing
    'grep': ['grep', 'findstr'],
    'sed': ['sed', 'gsed'],
    'awk': ['awk', 'gawk'],
    // Network tools
    'curl': ['curl', 'curl.exe'],
    'wget': ['wget', 'wget.exe'],
    // System tools
    'ps': ['ps', 'tasklist'],
    'kill': ['kill', 'taskkill'],
    // Development tools
    'gcc': ['gcc', 'gcc.exe'],
    'make': ['make', 'mingw32-make', 'nmake'],
    'git': ['git', 'git.exe'],
    // Other common tools
    'python': ['python', 'python3', 'py'],
    'node': ['node', 'nodejs'],
    'npm': ['npm', 'npm.cmd'],
};

/**
 * Normalize binary name by removing extensions and path
 * @param {string} binaryName - Input binary name
 * @returns {string} Normalized name
 */
function normalizeBinaryName(binaryName) {
    // Get base name (without path)
    let baseName = path.basename(binaryName);
    
    // Remove common executable extensions
    const exts = ['.exe', '.cmd', '.bat', '.sh'];
    for (const ext of exts) {
        if (baseName.toLowerCase().endsWith(ext)) {
            baseName = baseName.slice(0, -ext.length);
            break;
        }
    }
    
    return baseName.toLowerCase();
}

/**
 * Get platform-specific possible binary names
 * @param {string} normalizedName - Normalized binary name
 * @returns {string[]} List of possible binary names
 */
function getPossibleNames(normalizedName) {
    const isWindows = os.platform() === 'win32';
    const names = new Set();
    
    // Add original name
    names.add(normalizedName);
    
    // Add mapped names
    if (normalizedName in binaryNameMap) {
        binaryNameMap[normalizedName].forEach(name => names.add(name));
    }
    
    // Automatically add .exe extension on Windows
    if (isWindows) {
        const withoutExe = Array.from(names);
        withoutExe.forEach(name => {
            if (!name.toLowerCase().endsWith('.exe')) {
                names.add(`${name}.exe`);
            }
        });
    }
    
    return Array.from(names);
}

/**
 * Find the path of a binary file
 * @param {string} binaryName - Binary name to find
 * @returns {Promise<string|null>} Found binary path or null if not found
 */
async function findBinary(binaryName) {
    const normalizedName = normalizeBinaryName(binaryName);
    const possibleNames = getPossibleNames(normalizedName);
    
    for (const name of possibleNames) {
        try {
            const result = await execCmdResultText(`which ${name}`, true, null);
            if (result && result.trim()) {
                return result.trim();
            }
        } catch (error) {
            // Ignore error and continue with next name
            continue;
        }
    }
    
    return null;
}

module.exports = {
    findBinary,
    normalizeBinaryName,
    getPossibleNames,
    binaryNameMap
};
