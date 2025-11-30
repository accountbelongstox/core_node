// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');

class MediaTools {
    constructor() {
        this.tools = [
            {
                id: 'image_converter',
                name: 'Image Converter',
                description: 'Convert images between formats',
                category: 'media',
                icon: 'image',
                endpoint: '/media/image/convert',
                method: 'POST',
                keywords: ['image', 'convert', 'format', 'jpg', 'png']
            },
            {
                id: 'video_metadata',
                name: 'Video Metadata Viewer',
                description: 'View and extract video metadata',
                category: 'media',
                icon: 'video',
                endpoint: '/media/video/metadata',
                method: 'POST',
                keywords: ['video', 'metadata', 'info', 'properties']
            },
            {
                id: 'audio_converter',
                name: 'Audio Converter',
                description: 'Convert audio files between formats',
                category: 'media',
                icon: 'music',
                endpoint: '/media/audio/convert',
                method: 'POST',
                keywords: ['audio', 'convert', 'mp3', 'wav', 'format']
            },
            {
                id: 'svg_optimizer',
                name: 'SVG Optimizer',
                description: 'Optimize and minify SVG files',
                category: 'media',
                icon: 'bezier-curve',
                endpoint: '/media/svg/optimize',
                method: 'POST',
                keywords: ['svg', 'optimize', 'minify', 'compress']
            }
        ];
    }

    getToolList() {
        return this.tools;
    }

    async execute(toolId, params) {
        switch (toolId) {
            case 'image_converter':
                return this.imageConverter(params.file, params.format);
            case 'video_metadata':
                return this.videoMetadata(params.file);
            case 'audio_converter':
                return this.audioConverter(params.file, params.format);
            case 'svg_optimizer':
                return this.svgOptimizer(params.svg);
            default:
                throw new Error(`Unknown media tool: ${toolId}`);
        }
    }

    imageConverter(file, format) {
        try {
            return {
                success: false,
                message: 'Image conversion requires file upload and image processing libraries',
                note: 'Consider using sharp or jimp for Node.js image processing'
            };
        } catch (error) {
            logger.error(`Image converter error: ${error.message}`);
            throw new Error(`Failed to convert image: ${error.message}`);
        }
    }

    videoMetadata(file) {
        try {
            return {
                success: false,
                message: 'Video metadata extraction requires file upload and ffmpeg',
                note: 'Consider using fluent-ffmpeg for Node.js video processing'
            };
        } catch (error) {
            logger.error(`Video metadata error: ${error.message}`);
            throw new Error(`Failed to extract video metadata: ${error.message}`);
        }
    }

    audioConverter(file, format) {
        try {
            return {
                success: false,
                message: 'Audio conversion requires file upload and audio processing libraries',
                note: 'Consider using fluent-ffmpeg for Node.js audio processing'
            };
        } catch (error) {
            logger.error(`Audio converter error: ${error.message}`);
            throw new Error(`Failed to convert audio: ${error.message}`);
        }
    }

    svgOptimizer(svg) {
        if (!svg) {
            throw new Error('SVG content is required');
        }

        try {
            const optimized = svg
                .replace(/\s+/g, ' ')
                .replace(/>\s+</g, '><')
                .trim();

            return {
                original: svg,
                optimized: optimized,
                originalSize: svg.length,
                optimizedSize: optimized.length,
                saved: svg.length - optimized.length,
                note: 'For advanced optimization, consider using SVGO library'
            };
        } catch (error) {
            logger.error(`SVG optimizer error: ${error.message}`);
            throw new Error(`Failed to optimize SVG: ${error.message}`);
        }
    }
}

module.exports = MediaTools;
