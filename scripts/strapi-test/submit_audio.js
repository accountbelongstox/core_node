const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
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
async function submitAudio(content, audioFiles) {
    try {
        // Validate input parameters
        if (!content || content.trim() === '') {
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

        // Check if files exist and validate
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

        // Create form data
        const form = new FormData();
        form.append('content', content);
        form.append('type', 'word');
        
        // Append all audio files with progress
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
        log.info(`Endpoint: http://127.0.0.1:15452/submit_audio`);
        log.info('Payload:', {
            content,
            type: 'word',
            filesCount: audioFiles.length
        });

        const response = await axios.post('http://127.0.0.1:15452/submit_audio', form, {
            headers: {
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        // Handle response
        const result = response.data;
        if (result.success) {
            log.success('\n=== Submission Successful ===');
            log.success(`Content: "${content}"`);
            log.success(`Files processed: ${result.filesCount}`);
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
    }
}

// Handle command line arguments
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

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = submitAudio; 