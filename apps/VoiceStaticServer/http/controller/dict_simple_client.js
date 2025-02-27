const fs = require('fs');
const path = require('path');
const { APP_DATA_CACHE_DIR } = require('#@/ncore/gvar/gdir.js');
const FormData = require('form-data');
const axios = require('axios');
const { SUBMIT_AUDIO_SIMPLE_URL } = require('../../provider/index.js');
const {readJson} = require('#@freader');

const SIMPLE_SUBMISSION_LOG_FILE = path.join(APP_DATA_CACHE_DIR, 'audio_simple_submissions.json');
const log = require('#@logger');

let submissionsCache = null;

function loadSubmissionsCache() {
    if (submissionsCache !== null) return;
    try {
        ensureSimpleSubmissionLog();
        submissionsCache = readJson(SIMPLE_SUBMISSION_LOG_FILE);
        log.info('Submissions cache loaded from file');
        let removed = false;
        for (const [key, value] of Object.entries(submissionsCache)) {
            if (value.success === false) {
                delete submissionsCache[key];
                removed = true;
            }
        }
        if (removed) {
            fs.writeFileSync(SIMPLE_SUBMISSION_LOG_FILE, JSON.stringify(submissionsCache, null, 2));
            log.info('Removed unsuccessful entries and updated cache file');
        }
    } catch (error) {
        log.error('Error loading submissions cache:', error);
        log.error(SIMPLE_SUBMISSION_LOG_FILE);

        submissionsCache = {};
    }
}

function ensureSimpleSubmissionLog() {
    if (!fs.existsSync(APP_DATA_CACHE_DIR)) {
        fs.mkdirSync(APP_DATA_CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(SIMPLE_SUBMISSION_LOG_FILE)) {
        fs.writeFileSync(SIMPLE_SUBMISSION_LOG_FILE, JSON.stringify({}, null, 2));
    }
}

async function checkSimpleSubmission(audioFile) {
    try {
        loadSubmissionsCache();
        const fileName = path.basename(audioFile);
        return submissionsCache[fileName] || null;
    } catch (error) {
        log.error('Error checking submission:', error);
        return null;
    }
}

async function getSimpleSubmissionList() {
    try {
        loadSubmissionsCache();
        
        const simpleStats = {
            count: {
                total: 0,
                successful: 0,
                failed: 0
            },
            submissions: []
        };
        
        const entries = Object.values(submissionsCache);
        simpleStats.count.total = entries.length;
        simpleStats.count.successful = entries.filter(s => s.success).length;
        simpleStats.count.failed = simpleStats.count.total - simpleStats.count.successful;

        simpleStats.submissions = entries.map(entry => ({
            fileName: entry.fileName,
            success: entry.success,
            submittedAt: entry.submittedAt,
            duration: entry.duration
        }));

        return simpleStats;
    } catch (error) {
        log.error('Error getting submission stats:', error);
        return null;
    }
}

async function getSimpleSubmissionCount(successOnly = false) {
    try {
        loadSubmissionsCache();
        
        if (successOnly) {
            return Object.values(submissionsCache).filter(s => s.success).length;
        }
        return Object.keys(submissionsCache).length;
    } catch (error) {
        log.error('Error getting submission count:', error);
        return 0;
    }
}

async function recordSimpleSubmission(audioFile, success, duration) {
    try {
        loadSubmissionsCache();
        const fileName = path.basename(audioFile);

        const submissionData = {
            success,
            fileName,
            submittedAt: new Date().toISOString(),
            duration: `${(duration / 1000).toFixed(2)}s`,
            timestamp: Date.now()
        };

        submissionsCache[fileName] = submissionData;

        try {
            fs.writeFileSync(SIMPLE_SUBMISSION_LOG_FILE, JSON.stringify(submissionsCache, null, 2));
        } catch (fileError) {
            log.error('Error writing to submission log file:', fileError);
        }
    } catch (error) {
        log.error('Error recording submission:', error);
    }
}

loadSubmissionsCache();

async function submitSimpleAudio(audioFiles, content_type, callback) {
    const startTime = Date.now();
    let success = false;
    let shouldReturn = false;

    try {
        if (!audioFiles || audioFiles.length === 0) {
            log.error('No audio files provided');
            shouldReturn = true;
            return;
        }
        
        for (const audioFile of audioFiles) {
            const existingSubmission = await checkSimpleSubmission(audioFile);
            if (existingSubmission && existingSubmission.success) {
                log.warn(`File "${path.basename(audioFile)}" was already submitted successfully on ${existingSubmission.submittedAt} (took ${existingSubmission.duration})`);
                success = true;
                shouldReturn = true;
                return;
            }
        }

        if (shouldReturn) return;

        log.info('=== Starting Audio Submission ===');
        log.info('Total Files:', audioFiles.length);

        if (shouldReturn) return;

        const simpleForm = new FormData();
        simpleForm.append('type', content_type);

        log.info('\n=== Preparing Files ===');
        audioFiles.forEach((filePath, index) => {
            const fileName = path.basename(filePath);
            simpleForm.append(`audio_${index}`, fs.createReadStream(filePath));
        });

        const trimAudioFiles = audioFiles.slice(0,10)
        const audioString = `[Adding / ${audioFiles.length}]` + trimAudioFiles.map(file => path.basename(file)).join(', '); 
        log.info(audioString);
        log.info('=== Submitting Request ===');
        log.info(`Endpoint: ${SUBMIT_AUDIO_SIMPLE_URL}`);

        const response = await axios.post(SUBMIT_AUDIO_SIMPLE_URL, simpleForm, {
            headers: {
                ...simpleForm.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 600000,
            timeoutErrorMessage: 'Request timed out after 600 seconds'
        });

        const result = response.data;
        success = result.success;

        if (success) {
            log.success('\n=== Submission Successful ===');
            log.success('Server Response:', result);
        } else {
            log.error('\n=== Submission Failed ===');
            log.error(`Error: ${result.message}`);
        }

    } catch (error) {
        log.error('=== Submission Error ===');
        if (error.code === 'ECONNABORTED') {
            log.error('Request timeout: Operation took too long to complete');
        } else if (error.response) {
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
        if (!shouldReturn) {
            for (const audioFile of audioFiles) {
                if (success) {
                    await recordSimpleSubmission(audioFile, success, duration);
                }
            }
        }
        if (typeof callback === 'function') {
            callback({
                success,
                duration,
                timestamp: Date.now(),
                files: audioFiles ? audioFiles.map(file => path.basename(file)) : [],
                skipped: shouldReturn
            });
        }
    }
}

async function mainSimple() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        log.error('Please provide at least one audio file path');
        log.info('Usage: node submit_audio.js <file_path1> [file_path2] ...');
        return;
    }

    const audioFiles = args.map(file => path.resolve(file));
    await submitSimpleAudio(audioFiles, 'auto');
}

if (require.main === module) {
    mainSimple();
}

module.exports = {
    submitSimpleAudio,
    checkSimpleSubmission,
    recordSimpleSubmission,
    getSimpleSubmissionList,
    getSimpleSubmissionCount    
}; 