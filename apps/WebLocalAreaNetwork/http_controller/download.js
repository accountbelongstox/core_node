const fs = require('fs');
const path = require('path');
const logger = require('#@logger');
const { pathtool } = require('#@btools');
const { ALLOW_DOWNLOAD_DIR, SKIP_DIRS } = require('#@gconfig');

// List directory contents (dirs and files), skip SKIP_DIRS and __* dirs, only under ALLOW_DOWNLOAD_DIR
function listDir(req, res) {
    let dir = req.query.dir;
    if (!dir || dir === '' || dir === '/') dir = '/';
    const absDir = pathtool.resolveInside(ALLOW_DOWNLOAD_DIR, String(dir));
    if (!absDir) {
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
    
    const absFile = pathtool.resolveInside(ALLOW_DOWNLOAD_DIR, String(file));

    if (!absFile) {
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