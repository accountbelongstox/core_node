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
const logger = require('#@logger');
const { ALLOW_DOWNLOAD_DIR, SKIP_DIRS } = require('#@gconfig');

// List directory contents (dirs and files), skip SKIP_DIRS and __* dirs, only under ALLOW_DOWNLOAD_DIR
function listDir(req, res) {
    let dir = req.query.dir;
    if (!dir || dir === '' || dir === '/') dir = '/';
    let absDir = path.resolve(ALLOW_DOWNLOAD_DIR, '.' + dir);
    // Normalize both paths to remove trailing slashes/backslashes
    const normAbsDir = absDir.replace(/[\\/]+$/, '');
    const normRoot = ALLOW_DOWNLOAD_DIR.replace(/[\\/]+$/, '');
    if (!normAbsDir.startsWith(normRoot)) {
        return res.status(403).json({ error: 'Unauthorized directory' });
    }
    let items = [];
    try {
        const entries = fs.readdirSync(absDir, { withFileTypes: true });
        for (const entry of entries) {
            try {
                const entryPath = path.join(absDir, entry.name);
                if (entry.isDirectory()) {
                    if (SKIP_DIRS.includes(entry.name) || entry.name.startsWith('__')) continue;
                    // Try to access directory to check permissions
                    try {
                        fs.accessSync(entryPath, fs.constants.R_OK | fs.constants.X_OK);
                        items.push({ name: entry.name, type: 'dir' });
                    } catch (err) {
                        logger.warn(`Skip dir (no access): ${entryPath}`);
                        continue;
                    }
                } else if (entry.isFile()) {
                    // Try to access file to check permissions
                    try {
                        fs.accessSync(entryPath, fs.constants.R_OK);
                        items.push({ name: entry.name, type: 'file' });
                    } catch (err) {
                        logger.warn(`Skip file (no access): ${entryPath}`);
                        continue;
                    }
                }
            } catch (entryErr) {
                logger.warn('Error processing entry:', entryErr);
                continue;
            }
        }
        // Always return path as '/' for root
        res.json({ path: dir === '/' ? '/' : dir.replace(/\\/g, '/'), items });
    } catch (e) {
        logger.error('Error listing dir:', e);
        res.status(500).json({ error: 'Failed to list directory' });
    }
}

// Download a file, only if within ALLOW_DOWNLOAD_DIR, using file stream
function downloadFile(req, res) {
    let file = req.query.file;
    if (!file) {
        res.status(400).send('No file specified');
        return null;
    }
    
    let absFile = path.resolve(ALLOW_DOWNLOAD_DIR, '.' + file);
    const normAbsFile = absFile.replace(/[\\/]+$/, '');
    const normRoot = ALLOW_DOWNLOAD_DIR.replace(/[\\/]+$/, '');
    
    if (!normAbsFile.startsWith(normRoot)) {
        res.status(403).send('Unauthorized directory');
        return null;
    }
    
    if (!fs.existsSync(absFile) || !fs.statSync(absFile).isFile()) {
        res.status(404).send('File not found');
        return null;
    }
    
    // Return the absolute file path for RouterManager to handle
    return absFile;
}

module.exports = {
    listDir,
    downloadFile
}; 