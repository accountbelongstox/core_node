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
const { APP_DATA_CACHE_DIR } = require('#@global_dir');
const FormData = require('form-data');
const axios = require('axios');
const { SUBMIT_AUDIO_SIMPLE_URL } = require('../provider/baseDir/BaseDirProvider.js');
const {readJson} = require('#@freader');

const SIMPLE_SUBMISSION_LOG_FILE = path.join(APP_DATA_CACHE_DIR, 'audio_simple_submissions.json');
const logger = require('#@logger');

let submissionsCache = null;

function loadSubmissionsCache() {
    if (submissionsCache !== null) return;
    try {
        ensureSimpleSubmissionLog();
        submissionsCache = readJson(SIMPLE_SUBMISSION_LOG_FILE);
        let removed = false;
        for (const [key, value] of Object.entries(submissionsCache)) {
            if (value.success === false) {
                delete submissionsCache[key];
                removed = true;
            }
        }
        if (removed) {
            fs.writeFileSync(SIMPLE_SUBMISSION_LOG_FILE, JSON.stringify(submissionsCache, null, 2));
            logger.info('Removed unsuccessful entries and updated cache file');
        }
    } catch (error) {
        logger.error('Error loading submissions cache:', error);
        logger.error(SIMPLE_SUBMISSION_LOG_FILE);

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
        logger.error('Error checking submission:', error);
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
        logger.error('Error getting submission stats:', error);
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
        logger.error('Error getting submission count:', error);
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
            logger.error('Error writing to submission log file:', fileError);
        }
    } catch (error) {
        logger.error('Error recording submission:', error);
    }
}

loadSubmissionsCache();

async function submitSimpleAudio(audioFiles, content_type, callback) {
    const startTime = Date.now();
    let success = false;
    let shouldReturn = false;

    try {
        if (!audioFiles || audioFiles.length === 0) {
            logger.error('No audio files provided');
            shouldReturn = true;
            return;
        }
        
        for (const audioFile of audioFiles) {
            const existingSubmission = await checkSimpleSubmission(audioFile);
            if (existingSubmission && existingSubmission.success) {
                logger.warn(`File "${path.basename(audioFile)}" was already submitted successfully on ${existingSubmission.submittedAt} (took ${existingSubmission.duration})`);
                success = true;
                shouldReturn = true;
                return;
            }
        }

        if (shouldReturn) return;

        logger.info('=== Starting Audio Submission ===');
        logger.info('Total Files:', audioFiles.length);

        if (shouldReturn) return;

        const simpleForm = new FormData();
        simpleForm.append('type', content_type);

        logger.info('\n=== Preparing Files ===');
        audioFiles.forEach((filePath, index) => {
            const fileName = path.basename(filePath);
            simpleForm.append(`audio_${index}`, fs.createReadStream(filePath));
        });

        const trimAudioFiles = audioFiles.slice(0,10)
        const audioString = `[Adding / ${audioFiles.length}]` + trimAudioFiles.map(file => path.basename(file)).join(', '); 
        logger.info(audioString);
        logger.info('=== Submitting Request ===');
        logger.info(`Endpoint: ${SUBMIT_AUDIO_SIMPLE_URL}`);

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
            logger.success('\n=== Submission Successful ===');
            logger.success('Server Response:', result);
        } else {
            logger.error('\n=== Submission Failed ===');
            logger.error(`Error: ${result.message}`);
        }

    } catch (error) {
        logger.error('=== Submission Error ===');
        if (error.code === 'ECONNABORTED') {
            logger.error('Request timeout: Operation took too long to complete');
        } else if (error.response) {
            logger.error('Server Error:', {
                status: error.response.status,
                data: error.response.data
            });
        } else if (error.request) {
            logger.error('Network Error: No response from server');
        } else {
            logger.error('Client Error:', error.message);
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
            logger.info(`DEBUG:`)
            logger.info(audioFiles)
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
        logger.error('Please provide at least one audio file path');
        logger.info('Usage: node submit_audio.js <file_path1> [file_path2] ...');
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