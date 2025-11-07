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

const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const gconfig = require('#@gconfig');
const { ROOT_APP_CACHE_DIR, APP_TMP_DIR } = require('#@global_dir');
const log = require('#@logger');

// Helper: generate a unique filename
function generateUniqueFilename(originalName) {
    const ext = path.extname(originalName || '');
    const base = path.basename(originalName || '', ext);
    const unique =
        (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() :
            `${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    return `${base}_${unique}${ext}`;
}

// Helper: get upload record file path
function getUploadRecordPath() {
    if (!fs.existsSync(ROOT_APP_CACHE_DIR)) {
        fs.mkdirSync(ROOT_APP_CACHE_DIR, { recursive: true });
    }
    return path.join(ROOT_APP_CACHE_DIR, 'upload_records.json');
}

// Helper: load upload records
function loadUploadRecords() {
    const recordPath = getUploadRecordPath();
    if (fs.existsSync(recordPath)) {
        try {
            return JSON.parse(fs.readFileSync(recordPath, 'utf8'));
        } catch (e) {
            log.error('Failed to parse upload_records.json:', e);
        }
    }
    return [];
}

// Helper: save upload records
function saveUploadRecords(records) {
    const recordPath = getUploadRecordPath();
    fs.writeFileSync(recordPath, JSON.stringify(records, null, 2));
}

// Helper: get file signature (md5 hash)
function getFileSignature(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

// Check and record upload: parses req, checks for duplicate, records if new
async function checkAndRecordUpload(req, uploadDir = APP_TMP_DIR) {
    const { fields, files, filePaths } = await uploadAndKeepOriginName(req, uploadDir);
    const fileDetail = filePaths.fileDetails[0];
    if (!fileDetail || !fileDetail.path) {
        return { error: 'No file provided or file path missing.' };
    }
    const stats = fs.statSync(fileDetail.path);
    let signature = fields.fileMd5;
    if (!signature) {
        signature = await getFileSignature(fileDetail.path);
    }
    const records = loadUploadRecords();
    const duplicate = records.find(r =>
        r.signature === signature && r.size === stats.size
    );
    if (duplicate) {
        return { duplicate: true, record: duplicate };
    }
    const uniqueName = generateUniqueFilename(fileDetail.originalName || path.basename(fileDetail.path));
    const newRecord = {
        uniqueName,
        originalName: fileDetail.originalName || path.basename(fileDetail.path),
        path: fileDetail.path,
        size: stats.size,
        signature,
        uploadDate: new Date().toISOString()
    };
    records.push(newRecord);
    saveUploadRecords(records);
    return { duplicate: false, record: newRecord };
}

// Universal upload handler using formidable (CommonJS style)
function uploadAndKeepOriginName(req, uploadDir, form) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        if (!form) {
            form = wrapFormidable(uploadDir);
        }
        form.parse(req, (err, fields, files) => {
            if (err) {
                reject(err);
                return;
            }
            const filePaths = {
                absolutePaths: [],
                fileDetails: []
            };
            // Fix: handle formidable v3+ files structure (arrays)
            Object.entries(files).forEach(([key, fileArr]) => {
                if (Array.isArray(fileArr)) {
                    fileArr.forEach(file => {
                        filePaths.absolutePaths.push(file.filepath);
                        filePaths.fileDetails.push({
                            originalName: file.originalFilename,
                            path: file.filepath,
                            size: file.size,
                            type: file.mimetype
                        });
                    });
                } else if (fileArr && typeof fileArr === 'object') {
                    filePaths.absolutePaths.push(fileArr.filepath);
                    filePaths.fileDetails.push({
                        originalName: fileArr.originalFilename,
                        path: fileArr.filepath,
                        size: fileArr.size,
                        type: fileArr.mimetype
                    });
                }
            });
            resolve({ fields, files, filePaths });
        });
    });
}

// Always use formidable.default(options) as per actual module export
function wrapFormidable(uploadDir) {
    const defaultOptions = {
        uploadDir: uploadDir || APP_TMP_DIR,
        keepExtensions: true,
        maxFiles: 10,
        maxFileSize: 1024 * 1024 * 1024 * 10,
        filter: () => true,
        filename: (name, ext, part, form) => part.originalFilename
    };
    return formidable.default({ ...defaultOptions });
}

function wrapFileDetails(req, form) {
    if (!form) {
        form = wrapFormidable(APP_TMP_DIR);
    }
    return new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) {
                log.error('Upload Error:', err);
                reject({});
                return;
            }
            resolve({ fields });
        });
    });
}

module.exports = {
    uploadAndKeepOriginName,
    wrapFileDetails,
    wrapFormidable,
    checkAndRecordUpload,
    generateUniqueFilename
};

