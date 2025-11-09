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
const mime = require('mime');
const logger = require('#@logger');

/**
 * File Query Module
 * Contains all file query and download related functionality
 */
class FileQuery {
    constructor() {
        this.supportedMethods = ['HEAD', 'GET', 'RANGE'];
    }

    /**
     * Get comprehensive file information
     * @param {string} filePath - Path to the file
     * @returns {Object} File information object
     */
    getFileInfo(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                exists: true,
                size: stats.size,
                modifiedTime: stats.mtime,
                createdTime: stats.birthtime,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                mimeType: stats.isFile() ? mime.getType(filePath) || 'application/octet-stream' : null,
                filename: path.basename(filePath),
                lastModified: stats.mtime.toUTCString(),
                etag: this.generateETag(stats),
                acceptRanges: 'bytes'
            };
        } catch (error) {
            return {
                exists: false,
                error: error.message
            };
        }
    }

    /**
     * Generate ETag for file caching
     * @param {Object} stats - File stats
     * @returns {string} ETag value
     */
    generateETag(stats) {
        const hash = `${stats.size}-${stats.mtime.getTime()}`;
        return `"${hash}"`;
    }

    /**
     * Validate file path
     * @param {string} filePath - Path to validate
     * @returns {Object} Validation result
     */
    validateFilePath(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            return {
                valid: false,
                error: 'File path must be a non-empty string'
            };
        }

        if (!fs.existsSync(filePath)) {
            return {
                valid: false,
                error: 'File does not exist',
                path: filePath
            };
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            return {
                valid: false,
                error: 'Path is not a file',
                path: filePath
            };
        }

        return {
            valid: true,
            path: filePath,
            stats: stats
        };
    }

    /**
     * Handle HEAD request for file info
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if response was sent
     */
    handleHeadRequest(req, res, filePath) {
        const fileInfo = this.getFileInfo(filePath);
        
        if (!fileInfo.exists) {
            res.status(404).end();
            return true;
        }

        // Set headers that download tools expect
        res.set({
            'Content-Length': fileInfo.size,
            'Content-Type': fileInfo.mimeType,
            'Last-Modified': fileInfo.lastModified,
            'ETag': fileInfo.etag,
            'Accept-Ranges': fileInfo.acceptRanges,
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Connection': 'keep-alive'
        });

        res.status(200).end();
        return true;
    }

    /**
     * Handle file download with proper headers
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if response was sent
     */
    handleFileDownload(req, res, filePath) {
        const fileInfo = this.getFileInfo(filePath);
        
        if (!fileInfo.exists) {
            return res.status(404).send('File not found');
        }
        
        // Set proper headers for download
        res.set({
            'Content-Length': fileInfo.size,
            'Content-Type': fileInfo.mimeType,
            'Last-Modified': fileInfo.lastModified,
            'ETag': fileInfo.etag,
            'Accept-Ranges': fileInfo.acceptRanges,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // Create read stream and pipe to response
        const stream = fs.createReadStream(filePath);
        
        stream.on('error', err => {
            logger.error('File stream error:', err);
            if (!res.headersSent) {
                res.status(500).send('File read error');
            }
        });
        
        stream.on('open', () => {
            logger.debug(`Started streaming file: ${fileInfo.filename} (${fileInfo.size} bytes)`);
        });
        
        stream.on('end', () => {
            logger.debug(`Finished streaming file: ${fileInfo.filename}`);
        });
        
        // Pipe the stream to response
        stream.pipe(res);
        return true;
    }

    /**
     * Handle Range request (for resume download support)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if response was sent
     */
    handleRangeRequest(req, res, filePath) {
        const range = req.headers.range;
        
        if (!range) {
            return false; // No range header, continue with normal file serving
        }

        const fileInfo = this.getFileInfo(filePath);
        
        if (!fileInfo.exists) {
            res.status(404).end();
            return true;
        }

        const fileSize = fileInfo.size;
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        if (start >= fileSize || end >= fileSize) {
            res.status(416).json({
                success: false,
                error: 'Requested range not satisfiable',
                fileSize: fileSize
            });
            return true;
        }

        res.status(206);
        res.set({
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': fileInfo.mimeType,
            'Last-Modified': fileInfo.lastModified,
            'ETag': fileInfo.etag
        });

        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
        return true;
    }

    /**
     * Main handler that processes all file-related requests
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if response was sent, false to continue with normal handling
     */
    handleRequest(req, res, filePath) {
        const method = req.method.toUpperCase();
        
        // Handle HEAD requests (Thunder, IDM, etc. use this to get file info)
        if (method === 'HEAD') {
            return this.handleHeadRequest(req, res, filePath);
        }
        
        // Handle GET requests
        if (method === 'GET') {
            // Check for range request first
            if (this.handleRangeRequest(req, res, filePath)) {
                return true;
            }
            
            // Handle normal file download
            return this.handleFileDownload(req, res, filePath);
        }
        
        return false; // Continue with normal handling
    }

    /**
     * Create enhanced file serving handler with proper headers
     * @param {string} filePath - Path to the file
     * @returns {Function} Express handler function
     */
    createFileHandler(filePath) {
        return (req, res, next) => {
            // First, try to handle special requests (HEAD, range)
            if (this.handleRequest(req, res, filePath)) {
                return; // Response already sent
            }
            
            next(); // Continue to next middleware
        };
    }

    /**
     * Get download tool specific headers
     * @param {string} filePath - Path to the file
     * @param {string} tool - Download tool name ('thunder', 'idm', 'aria2', etc.)
     * @returns {Object} Headers object
     */
    getToolSpecificHeaders(filePath, tool = 'thunder') {
        const fileInfo = this.getFileInfo(filePath);
        
        if (!fileInfo.exists) {
            return {};
        }

        const baseHeaders = {
            'Content-Length': fileInfo.size,
            'Content-Type': fileInfo.mimeType,
            'Last-Modified': fileInfo.lastModified,
            'ETag': fileInfo.etag,
            'Accept-Ranges': fileInfo.acceptRanges,
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        };

        // Tool-specific headers
        switch (tool.toLowerCase()) {
            case 'thunder':
                return {
                    ...baseHeaders,
                    'X-Thunder-Version': '1.0',
                    'X-Accel-Buffering': 'no'
                };
            case 'idm':
                return {
                    ...baseHeaders,
                    'X-IDM-Version': '1.0',
                    'Accept-Encoding': 'identity'
                };
            case 'aria2':
                return {
                    ...baseHeaders,
                    'X-Aria2-Version': '1.0'
                };
            default:
                return baseHeaders;
        }
    }

    /**
     * Create download handlers for RouterManager
     * @param {string|Function} filePathOrHandler - File path or handler function
     * @returns {Object} Object containing get and head handlers
     */
    createDownloadHandlers(filePathOrHandler) {
        // Create GET handler for file download
        const getHandler = async (req, res, next) => {
            try {
                let filePath = await this.resolveFilePath(filePathOrHandler, req, res, next);
                
                // Validate file path
                const validation = this.validateFilePath(filePath);
                if (!validation.valid) {
                    logger.warn(`Download file validation failed: ${validation.error} - ${validation.path || 'N/A'}`);
                    return res.status(404).send('File not found or invalid');
                }
                
                // Handle the download
                this.handleFileDownload(req, res, filePath);
                
            } catch (error) {
                logger.error(`Error in download handler: ${error.message}`);
                res.status(500).send('Download error');
            }
        };

        // Create HEAD handler for file info
        const headHandler = async (req, res, next) => {
            try {
                let filePath = await this.resolveFilePath(filePathOrHandler, req, res, next);
                
                // Validate file path
                const validation = this.validateFilePath(filePath);
                if (!validation.valid) {
                    logger.warn(`Download HEAD file validation failed: ${validation.error} - ${validation.path || 'N/A'}`);
                    return res.status(404).end();
                }
                
                // Handle the HEAD request
                this.handleHeadRequest(req, res, filePath);
                
            } catch (error) {
                logger.error(`Error in download HEAD handler: ${error.message}`);
                res.status(500).end();
            }
        };

        return { getHandler, headHandler };
    }

    /**
     * Resolve file path from handler function or string
     * @param {string|Function} filePathOrHandler - File path or handler function
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     * @returns {string} Resolved file path
     */
    async resolveFilePath(filePathOrHandler, req, res, next) {
        if (typeof filePathOrHandler === 'function') {
            // Call the handler function to get file path
            const result = await filePathOrHandler(req, res, next);
            
            // Check if handler returned null (validation failed)
            if (result === null) {
                throw new Error('File validation failed - handler returned null');
            }
            
            // Validate the returned result
            if (!result || typeof result !== 'string') {
                logger.error(`Download handler returned invalid result: ${result}`);
                throw new Error('Invalid file path returned by handler');
            }
            
            return result;
        } else if (typeof filePathOrHandler === 'string') {
            return filePathOrHandler;
        } else {
            logger.error(`Download method received invalid parameter: ${typeof filePathOrHandler}`);
            throw new Error('Invalid download configuration');
        }
    }
}

module.exports = new FileQuery();
