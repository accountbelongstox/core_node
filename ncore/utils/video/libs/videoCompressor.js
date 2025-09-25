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

const path = require('path');
const fs = require('fs');
const { spawnAsync, execCmd } = require('#@commander');
const ffmpegSetup = require('./ffmpegSetupBywin');
const logger = require('#@logger');
const { normalizePath } = require('./video-file-operations');

class VideoCompressor {
    constructor() {
        this.defaultOptions = {
            crf: 23,              // Compression quality (0-51, lower is better)
            preset: 'medium',     // Compression speed preset
            codec: 'libx264',     // Video codec
            audioCodec: 'aac',    // Audio codec
            audioBitrate: '128k', // Audio bitrate
            maxSize: '1024M'      // Target file size limit
        };
    }

    /**
     * Get FFmpeg path
     * @returns {Promise<string>} FFmpeg path
     * @private
     */
    static async _getFFmpegPath() {
        try {
            const ffmpegPath = await ffmpegSetup.getFFmpegPath();
            if (!ffmpegPath) {
                throw new Error('FFmpeg not found or not installed');
            }
            return ffmpegPath;
        } catch (error) {
            logger.error('Failed to get FFmpeg path:', error);
            throw error;
        }
    }

    /**
     * Get video information
     * @param {string} filePath - Path to video file
     * @returns {Promise<Object>} Video information
     */
    static async getVideoInfo(filePath) {
        const ffmpegPath = await VideoCompressor._getFFmpegPath();
        const args = [ffmpegPath, '-i', filePath, '-hide_banner'];
        
        try {
            const result = await execCmd(args, true);
            return this._parseVideoInfo(result);
        } catch (error) {
            // FFmpeg outputs info to stderr, so we need to parse the error output
            return this._parseVideoInfo(error.message || error.toString());
        }
    }

    /**
     * Parse video information from ffmpeg output
     */
    static _parseVideoInfo(infoStr) {
        const info = {
            duration: null,
            resolution: null,
            bitrate: null,
            format: null
        };

        // Parse duration
        const durationMatch = infoStr.match(/Duration: (\d{2}):(\d{2}):(\d{2}.\d{2})/);
        if (durationMatch) {
            info.duration = durationMatch[0].replace('Duration: ', '');
        }

        // Parse resolution
        const resolutionMatch = infoStr.match(/(\d{2,5}x\d{2,5})/);
        if (resolutionMatch) {
            info.resolution = resolutionMatch[1];
        }

        // Parse bitrate
        const bitrateMatch = infoStr.match(/bitrate: (\d+ kb\/s)/);
        if (bitrateMatch) {
            info.bitrate = bitrateMatch[1];
        }

        // Parse format
        const formatMatch = infoStr.match(/Input #0, ([^,]+),/);
        if (formatMatch) {
            info.format = formatMatch[1];
        }

        return info;
    }

    /**
     * Compress video using ffmpeg (lossless compression)
     * @param {string} inputPath - Input video path
     * @param {string} outputPath - Output video path
     * @returns {Promise<void>}
     */
    static async compressVideo(inputPath, outputPath) {
        const ffmpegPath = await VideoCompressor._getFFmpegPath();
        const normalizedInput = normalizePath(inputPath);
        const normalizedOutput = normalizePath(outputPath);
        
        // Construct command array
        const commandArray = [
            ffmpegPath,
            '-i', normalizedInput,
            '-c:v', 'libx264',     // Use H.264 codec
            '-preset', 'veryslow', // Slowest preset for best compression
            '-crf', '0',           // Lossless compression
            '-c:a', 'copy',        // Copy audio stream without re-encoding
            '-movflags', '+faststart', // Optimize for web playback 
            '-y',                  // Overwrite output file
            normalizedOutput
        ];

        logger.info(`Executing FFmpeg command with args:`, commandArray.join(' '));

        return new Promise((resolve, reject) => {
            spawnAsync(
                commandArray,           // Command array
                true,                   // Show info logsdata.includes
                null,                   // Working directory (use default)
                null,
                500000,
                (data) => {            // Progress callback
                    if (data.includes('frame=')) {
                        logger.info(`  - Compression progress: ${data.trim()}`);
                    }
                },
                300000                 // Timeout: 5 minutes
            ).then(() => {
                resolve();
            }).catch((error) => {
                reject(new Error(`FFmpeg compression failed: ${error.message || error}`));
            });
        });
    }
}

module.exports = VideoCompressor; 