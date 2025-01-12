const fs = require('fs');
const path = require('path');
const { APP_DATA_CACHE_DIR } = require('#@/ncore/gvar/gdir.js');
const FormData = require('form-data');
const axios = require('axios');
const { SUBMIT_AUDIO_URL, SERVER_URL } = require('../../provider/index.js');

const SUBMISSION_LOG_FILE = path.join(APP_DATA_CACHE_DIR, 'audio_submissions.json');

let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args),
        progressBar: (current, total, options) => logger.progressBar(current, total, options)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        progressBar: (current, total, options) => `Progress: ${current / total * 100}%`
    };
}

/**
 * Ensure submission log file exists
 */
function ensureSubmissionLog() {
    if (!fs.existsSync(APP_DATA_CACHE_DIR)) {
        fs.mkdirSync(APP_DATA_CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(SUBMISSION_LOG_FILE)) {
        fs.writeFileSync(SUBMISSION_LOG_FILE, JSON.stringify({}, null, 2));
    }
}

/**
 * Check if content has been submitted before
 * @param {string} content - Content to check
 * @returns {Promise<Object|null>} Submission record if exists, null otherwise
 */
async function checkSubmissionClient(content) {
    try {
        ensureSubmissionLog();
        const submissions = JSON.parse(fs.readFileSync(SUBMISSION_LOG_FILE, 'utf8'));
        return submissions[content] || null;
    } catch (error) {
        log.error('Error checking submission:', error);
        return null;
    }
}

/**
 * Get submission statistics
 * @returns {Promise<Object>} Statistics about submissions including count and content list
 */
async function getSubmissionClientList() {
    try {
        ensureSubmissionLog();
        const submissions = JSON.parse(fs.readFileSync(SUBMISSION_LOG_FILE, 'utf8'));
        
        const stats = {
            count: {
                total: 0,
                successful: 0,
                failed: 0
            },
            submissions: []
        };
        
        // Calculate counts
        const entries = Object.values(submissions);
        stats.count.total = entries.length;
        stats.count.successful = entries.filter(s => s.success).length;
        stats.count.failed = stats.count.total - stats.count.successful;

        // Get submission details
        stats.submissions = entries.map(entry => ({
            content: entry.content,
            success: entry.success,
            submittedAt: entry.submittedAt,
            duration: entry.duration
        }));

        return stats;
    } catch (error) {
        log.error('Error getting submission stats:', error);
        return null;
    }
}

/**
 * Get total number of submissions
 * @param {boolean} [successOnly=false] - If true, count only successful submissions
 * @returns {Promise<number>} Number of submissions
 */
async function getSubmissionClientCount(successOnly = false) {
    try {
        ensureSubmissionLog();
        const submissions = JSON.parse(fs.readFileSync(SUBMISSION_LOG_FILE, 'utf8'));
        
        if (successOnly) {
            return Object.values(submissions).filter(s => s.success).length;
        }
        return Object.keys(submissions).length;
    } catch (error) {
        log.error('Error getting submission count:', error);
        return 0;
    }
}

/**
 * Record submission result
 * @param {string} content - Submitted content
 * @param {boolean} success - Whether submission was successful
 * @param {number} duration - Time taken in milliseconds
 */
async function recordSubmission(content, success, duration) {
    try {
        ensureSubmissionLog();
        const submissions = JSON.parse(fs.readFileSync(SUBMISSION_LOG_FILE, 'utf8'));

        submissions[content] = {
            success,
            content,
            submittedAt: new Date().toISOString(),
            duration: `${(duration / 1000).toFixed(2)}s`,
            timestamp: Date.now()
        };

        fs.writeFileSync(SUBMISSION_LOG_FILE, JSON.stringify(submissions, null, 2));
    } catch (error) {
        log.error('Error recording submission:', error);
    }
}


async function submitAudio(content, audioFiles, content_type, callback) {
    const startTime = Date.now();
    let success = false;

    try {
        // Check previous submission
        const existingSubmission = await checkSubmissionClient(content);
        if (existingSubmission && existingSubmission.success) {
            log.warn(`Content "${content}" was already submitted successfully on ${existingSubmission.submittedAt} (took ${existingSubmission.duration})`);
            return;
        }

        content = content.trim();
        if (!content) {
            log.error('Content cannot be empty');
            return;
        }
        if (!audioFiles || audioFiles.length === 0) {
            log.error('No audio files provided');
            return;
        }

        log.info('\n=== Starting Audio Submission ===');
        log.info('Content:', content);
        log.info('Total Files:', audioFiles.length);

        // Validate files
        for (const filePath of audioFiles) {
            if (!fs.existsSync(filePath)) {
                log.error(`File not found: ${filePath}`);
                return;
            }
            const stats = fs.statSync(filePath);
            log.info(`Validating file: ${path.basename(filePath)}`, {
                size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
                lastModified: stats.mtime
            });
        }

        // Prepare form data
        if (!content_type) {
            content_type = content.includes(' ') ? 'sentence' : 'word';
        }
        const form = new FormData();
        form.append('content', content);
        form.append('type', content_type);

        log.info('\n=== Preparing Files ===');
        audioFiles.forEach((filePath, index) => {
            const fileName = path.basename(filePath);
            form.append(`audio_${index}`, fs.createReadStream(filePath));
            log.info(`[${index + 1}/${audioFiles.length}] Adding:`, {
                file: fileName,
                index: `audio_${index}`
            });
        });

        // Submit request
        log.info('\n=== Submitting Request ===');
        log.info(`Endpoint: ${SUBMIT_AUDIO_URL}`);
        log.info('Payload:', {
            content,
            type: content_type,
            filesCount: audioFiles.length
        });

        const response = await axios.post(SUBMIT_AUDIO_URL, form, {
            headers: {
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const result = response.data;
        success = result.success;

        if (success) {
            log.success('\n=== Submission Successful ===');
            log.success(`Content: "${content}"`);
            log.success(`Files processed: ${audioFiles.length}`);
            log.info('Server Response:', result);
        } else {
            log.error('\n=== Submission Failed ===');
            log.error(`Error: ${result.message}`);
        }

    } catch (error) {
        log.error('\n=== Submission Error ===');
        if (error.response) {
            log.error('Server Error:', {
                status: error.response.status,
                data: error.response.data
            });
        } else if (error.request) {
            log.error('Network Error: No response from server');
        } else {
            log.error('Client Error:', error.message);
        }
    } finally {
        const duration = Date.now() - startTime;
        await recordSubmission(content, success, duration);

        if (typeof callback === 'function') {
            callback({
                content,
                success,
                duration,
                timestamp: Date.now()
            });
        }
    }
}


// CLI support
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        log.error('Please provide content and at least one audio file path');
        log.info('Usage: node submit_audio.js <content> <file_path1> [file_path2] ...');
        return;
    }

    const content = args[0];
    const audioFiles = args.slice(1).map(file => path.resolve(file));
    await submitAudio(content, audioFiles);
}

if (require.main === module) {
    main();
}

module.exports = {
    submitAudio,
    checkSubmissionClient,
    recordSubmission,
    getSubmissionClientList,
    getSubmissionClientCount    
}; 