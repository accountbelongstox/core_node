const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const { APP_TMP_DIR } = require('#@/ncore/gvar/gdir.js');
let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}

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

            // Process each uploaded file
            Object.entries(files).forEach(([key, file]) => {
                filePaths.absolutePaths.push(file.filepath);
                filePaths.fileDetails.push({
                    originalName: file.originalFilename,
                    path: file.filepath,
                    size: file.size,
                    type: file.mimetype
                });
            });

            resolve({ fields, files, filePaths });
        });
    });
}

function wrapFormidable(uploadDir) {
    const defaultOptions = {
        uploadDir: uploadDir || APP_TMP_DIR,
        keepExtensions: true,
        maxFiles: 10,
        maxFileSize: 1024 * 1024 * 1024 * 10,
        filter: () => true
    };
    const uploadOptions = { ...defaultOptions };
    const form = formidable({
        ...uploadOptions,
        filename: (name, ext, part, form) => {
            return part.originalFilename;
        }
    });
    return form
};

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
    wrapFormidable
};

