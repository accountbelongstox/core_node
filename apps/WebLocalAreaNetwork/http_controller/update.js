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
const gconfig = require('#@gconfig');
const { WWWROOT_DIR, SKIP_DIRS, UPDATE_CACHE_DIR } = gconfig;
const crypto = require('crypto');
const rpc = require('#@ncore/utils/rpc');
const UploadTools = rpc.getExpressServer().uploadTools;
const FILE_RECORDS_PATH = path.join(UPDATE_CACHE_DIR, 'file_records.json');
function getFileRecords() {
    try {
        if (fs.existsSync(FILE_RECORDS_PATH)) {
            return JSON.parse(fs.readFileSync(FILE_RECORDS_PATH, 'utf8'));
        }
    } catch (err) {
        logger.error('Error reading file records:', err);
    }
    return {};
}

// Save file records
function saveFileRecords(records) {
    try {
        const dir = path.dirname(FILE_RECORDS_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(FILE_RECORDS_PATH, JSON.stringify(records, null, 2));
    } catch (err) {
        logger.error('Error saving file records:', err);
    }
}

// Calculate file MD5
function calculateMD5(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

// Check if file already exists
async function checkFile(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const md5 = await calculateMD5(filePath);
        const records = getFileRecords();

        // Check if file with same size and MD5 exists
        for (const [path, record] of Object.entries(records)) {
            if (record.size === stats.size && record.md5 === md5) {
                return {
                    exists: true,
                    existingFile: path,
                    record
                };
            }
        }
        return { exists: false, md5, size: stats.size };
    } catch (err) {
        logger.error('Error checking file:', err);
        return { error: err.message };
    }
}

// Helper: validate and resolve upload directory
function resolveUploadDir(requestedDir) {
    const base = WWWROOT_DIR;
    if (!requestedDir || typeof requestedDir !== 'string') return base;
    // Normalize and resolve
    const absPath = path.resolve(base, '.' + requestedDir);
    // Ensure it's within WWWROOT_DIR
    if (absPath.startsWith(base)) {
        return absPath;
    }
    return base;
}

// Check if file exists by its properties
async function checkFileExists(req, res) {
    try {
        if (!/^multipart\/form-data/.test(req.headers['content-type'] || '')) {
            return { success: false, error: 'Invalid content-type, must be multipart/form-data' };
        }
        const uploadDir = resolveUploadDir(req.body?.uploadDir || req.query?.uploadDir || req.fields?.uploadDir || (req.headers['uploadDir']));
        // Use UploadTools.checkAndRecordUpload for duplicate check and record
        const result = await UploadTools.checkAndRecordUpload(req, uploadDir);
        return {
            success: true,
            ...result
        };
    } catch (err) {
        logger.error('Error in checkFileExists:', err);
        return { success: false, error: err.message };
    }
}

// Upload file with duplication check
async function uploadFile(req, res) {
    return new Promise(async (resolve) => {
        try {
            // First, check if file already exists using checkFileExists
            const checkResult = await checkFileExists(req, res);
            if (checkResult && checkResult.success && checkResult.duplicate) {
                resolve({
                    success: true,
                    message: 'File already exists',
                    existingFile: checkResult.record?.path || checkResult.record,
                    duplicate: true
                });
                return;
            }
            // If not duplicate, proceed to upload
            const uploadDir = resolveUploadDir(req.body?.uploadDir || req.query?.uploadDir || req.fields?.uploadDir || (req.headers['uploadDir']));
            const { filePaths } = await UploadTools.uploadAndKeepOriginName(req, uploadDir);
            const fileDetail = filePaths.fileDetails[0];
            if (!fileDetail || !fileDetail.path) {
                resolve({ success: false, error: 'No file uploaded or file path missing.' });
                return;
            }
            // Move file to final destination (already in uploadDir with original name)
            const destName = fileDetail.originalName || path.basename(fileDetail.path) || 'uploaded_file';
            const destPath = path.join(uploadDir, destName);
            if (fileDetail.path !== destPath) {
                await fs.promises.rename(fileDetail.path, destPath);
            }
            // Update records
            const records = getFileRecords();
            records[destPath] = {
                originalName: fileDetail.originalName || destName,
                size: fileDetail.size,
                md5: fileDetail.md5,
                uploadDate: new Date().toISOString()
            };
            saveFileRecords(records);
            resolve({
                success: true,
                filename: path.basename(destPath),
                path: destPath,
                size: fileDetail.size,
                md5: fileDetail.md5
            });
        } catch (err) {
            logger.error('Error processing upload:', err);
            resolve({ success: false, error: err.message });
        }
    });
}

// Directory scan cache
let _uploadDirsCache = null;
let _uploadDirsCacheTime = 0;
const UPLOAD_DIRS_CACHE_TTL = 5000; // 5 seconds

// Recursively scan all subdirectories (directories only) under WWWROOT_DIR, skipping SKIP_DIRS and __* dirs
function scanSubdirectories(rootDir, baseDir = '') {
    let dirs = [];
    const fullPath = path.join(rootDir, baseDir);
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries) {
        // Skip if in SKIP_DIRS or starts with '__'
        if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name) && !entry.name.startsWith('__')) {
            const relPath = path.join(baseDir, entry.name);
            dirs.push(relPath);
            dirs = dirs.concat(scanSubdirectories(rootDir, relPath));
        }
    }
    return dirs;
}

function getAllUploadDirs() {
    const now = Date.now();
    if (_uploadDirsCache && (now - _uploadDirsCacheTime < UPLOAD_DIRS_CACHE_TTL)) {
        return _uploadDirsCache;
    }
    const dirs = scanSubdirectories(WWWROOT_DIR, '').map(p => path.join('/', p).replace(/\\/g, '/'));
    _uploadDirsCache = dirs;
    _uploadDirsCacheTime = now;
    return dirs;
}

module.exports = {
    uploadFile,
    checkFileExists,
    getAllUploadDirs
}; 