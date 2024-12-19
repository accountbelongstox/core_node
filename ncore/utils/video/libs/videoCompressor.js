const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegSetup = require('./ffmpegSetup');

class VideoCompressor {
    constructor() {
        this.ffmpegPath = 'ffmpeg'; // Will be updated in initialize()
        this.defaultOptions = {
            crf: 23,              // Compression quality (0-51, lower is better)
            preset: 'medium',     // Compression speed preset
            codec: 'libx264',     // Video codec
            audioCodec: 'aac',    // Audio codec
            audioBitrate: '128k', // Audio bitrate
            maxSize: '1024M'      // Target file size limit
        };
    }

    async initialize() {
        try {
            this.ffmpegPath = await ffmpegSetup.getFFmpegPath();
            return true;
        } catch (error) {
            console.error('Failed to initialize FFmpeg:', error);
            return false;
        }
    }

    /**
     * Compress video while maintaining aspect ratio
     * @param {string} inputPath - Input video path
     * @param {string} outputPath - Output video path
     * @param {Object} options - Compression options
     * @returns {Promise} - Compression result
     */
    async compress(inputPath, outputPath = null, options = {}) {
        await this.initialize();
        try {
            // Validate input file
            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file not found: ${inputPath}`);
            }

            // Create output path if not specified
            if (!outputPath) {
                const dir = path.dirname(inputPath);
                const ext = path.extname(inputPath);
                const basename = path.basename(inputPath, ext);
                outputPath = path.join(dir, `${basename}_compressed${ext}`);
            }

            // Create backup
            const backupPath = inputPath + '.bak';
            if (!fs.existsSync(backupPath)) {
                fs.copyFileSync(inputPath, backupPath);
            }

            // Merge options
            const mergedOptions = { ...this.defaultOptions, ...options };

            // Build ffmpeg command
            const args = this._buildFfmpegArgs(inputPath, outputPath, mergedOptions);

            // Execute compression
            await this._executeFFmpeg(args, (progress) => {
                if (progress.percent) {
                    console.log(`Compression progress: ${progress.percent.toFixed(1)}%`);
                }
            });

            return {
                success: true,
                inputPath,
                outputPath,
                backupPath
            };

        } catch (error) {
            console.error('Compression failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Build ffmpeg command arguments
     */
    _buildFfmpegArgs(inputPath, outputPath, options) {
        return [
            '-i', inputPath,
            '-c:v', options.codec,
            '-crf', options.crf.toString(),
            '-preset', options.preset,
            '-c:a', options.audioCodec,
            '-b:a', options.audioBitrate,
            '-fs', options.maxSize,
            '-movflags', '+faststart',  // Optimize for web playback
            '-y',  // Overwrite output file
            outputPath
        ];
    }

    /**
     * Execute ffmpeg command with progress tracking
     */
    _executeFFmpeg(args, progressCallback) {
        return new Promise((resolve, reject) => {
            const process = spawn(this.ffmpegPath, args);
            let duration = 0;
            let timeRegex = /time=(\d{2}):(\d{2}):(\d{2}.\d{2})/;

            process.stderr.on('data', (data) => {
                const line = data.toString();

                // Get video duration
                if (line.includes('Duration')) {
                    const match = line.match(/Duration: (\d{2}):(\d{2}):(\d{2}.\d{2})/);
                    if (match) {
                        duration = (parseFloat(match[1]) * 3600 +
                                  parseFloat(match[2]) * 60 +
                                  parseFloat(match[3]));
                    }
                }

                // Calculate progress
                const timeMatch = line.match(timeRegex);
                if (timeMatch && duration) {
                    const time = (parseFloat(timeMatch[1]) * 3600 +
                                parseFloat(timeMatch[2]) * 60 +
                                parseFloat(timeMatch[3]));
                    const percent = (time / duration) * 100;
                    progressCallback({ percent });
                }
            });

            process.on('error', reject);

            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });
        });
    }

    /**
     * Get video information
     */
    async getVideoInfo(filePath) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const args = [
                '-i', filePath,
                '-hide_banner'
            ];

            const process = spawn(this.ffmpegPath, args);
            let info = '';

            process.stderr.on('data', (data) => {
                info += data.toString();
            });

            process.on('close', (code) => {
                resolve(this._parseVideoInfo(info));
            });

            process.on('error', reject);
        });
    }

    /**
     * Parse video information from ffmpeg output
     */
    _parseVideoInfo(infoStr) {
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
}

module.exports = VideoCompressor; 