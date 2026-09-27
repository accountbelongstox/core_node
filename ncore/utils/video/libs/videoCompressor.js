const path = require('path');
const fs = require('fs');
const { spawnAsync, runCommand } = require('#@commander');
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
        const ffmpegPath = await ffmpegSetup.getFFmpegPath();
        if (!ffmpegPath) {
            logger.error('FFmpeg not found or not installed');
            return null;
        }
        return ffmpegPath;
    }

    /**
     * Get video information
     * @param {string} filePath - Path to video file
     * @returns {Promise<Object>} Video information
     */
    static async getVideoInfo(filePath) {
        const ffmpegPath = await VideoCompressor._getFFmpegPath();
        if (!ffmpegPath) {
            return this._parseVideoInfo('');
        }
        const args = [ffmpegPath, '-hide_banner', '-i', filePath];

        // Without an output file ffmpeg exits non-zero and prints the stream info to stderr
        const result = runCommand(args, { info: true });
        return this._parseVideoInfo(`${result.stdout}\n${result.stderr}`);
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
        if (!ffmpegPath) {
            return false;
        }
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

        // ffmpeg writes progress to stderr; spawnAsync passes each stdout/stderr chunk to the progress callback
        const result = await spawnAsync(
            commandArray,
            false,
            null,
            null,
            undefined,
            (data) => {
                if (data.includes('frame=')) {
                    logger.info(`  - Compression progress: ${data.trim()}`);
                }
            }
        );

        if (!result.success) {
            logger.error(`FFmpeg compression failed (exit ${result.code}): ${String(result.error || '').trim()}`);
            return false;
        }
        return true;
    }
}

module.exports = VideoCompressor; 