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

const zlib = require('zlib');
const { promisify } = require('util');
const logger = require('#@logger');
const { WS_RPC_CONSTANTS } = require('#@global_vars');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

const DEFAULTS = WS_RPC_CONSTANTS.DEFAULTS;

class MessageCompressor {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.threshold = options.threshold || DEFAULTS.COMPRESSION_THRESHOLD;
        this.algorithm = options.algorithm || 'gzip';
        this.level = options.level || zlib.constants.Z_DEFAULT_COMPRESSION;

        this.stats = {
            compressed: 0,
            decompressed: 0,
            originalSize: 0,
            compressedSize: 0,
            savedBytes: 0
        };
    }

    async compress(data) {
        if (!this.enabled) {
            return { data, compressed: false };
        }

        try {
            const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
            const originalSize = Buffer.byteLength(dataStr);

            if (originalSize < this.threshold) {
                return { data, compressed: false };
            }

            const buffer = Buffer.from(dataStr);
            let compressed;

            if (this.algorithm === 'gzip') {
                compressed = await gzip(buffer, { level: this.level });
            } else if (this.algorithm === 'deflate') {
                compressed = await deflate(buffer, { level: this.level });
            } else {
                logger.error(`Unknown compression algorithm: ${this.algorithm}`);
                return { data, compressed: false };
            }

            const compressedSize = compressed.length;
            const savedBytes = originalSize - compressedSize;

            this.stats.compressed++;
            this.stats.originalSize += originalSize;
            this.stats.compressedSize += compressedSize;
            this.stats.savedBytes += savedBytes;

            const compressionRatio = ((savedBytes / originalSize) * 100).toFixed(2);
            logger.debug(`Compressed message: ${originalSize} -> ${compressedSize} bytes (${compressionRatio}% saved)`);

            return {
                data: compressed.toString('base64'),
                compressed: true,
                algorithm: this.algorithm,
                originalSize,
                compressedSize
            };

        } catch (error) {
            logger.error('Compression error:', error);
            return { data, compressed: false };
        }
    }

    async decompress(data, algorithm = null) {
        if (!data.compressed) {
            return data.data;
        }

        try {
            const buffer = Buffer.from(data.data, 'base64');
            const algo = algorithm || data.algorithm || this.algorithm;
            let decompressed;

            if (algo === 'gzip') {
                decompressed = await gunzip(buffer);
            } else if (algo === 'deflate') {
                decompressed = await inflate(buffer);
            } else {
                logger.error(`Unknown decompression algorithm: ${algo}`);
                return data.data;
            }

            this.stats.decompressed++;

            const result = decompressed.toString();
            logger.debug(`Decompressed message: ${buffer.length} -> ${result.length} bytes`);

            try {
                return JSON.parse(result);
            } catch (e) {
                return result;
            }

        } catch (error) {
            logger.error('Decompression error:', error);
            return data.data;
        }
    }

    getStats() {
        const avgCompressionRatio = this.stats.originalSize > 0
            ? ((this.stats.savedBytes / this.stats.originalSize) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            avgCompressionRatio: parseFloat(avgCompressionRatio)
        };
    }

    resetStats() {
        this.stats = {
            compressed: 0,
            decompressed: 0,
            originalSize: 0,
            compressedSize: 0,
            savedBytes: 0
        };
        logger.debug('Compression stats reset');
    }
}

module.exports = MessageCompressor;
