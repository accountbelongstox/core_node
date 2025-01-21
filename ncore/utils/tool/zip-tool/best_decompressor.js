const logger = require('#@logger');
const path = require('path');
const fs = require('fs');
const { get7zExecutable } = require('#@/ncore/gvar/bdir.js');
const { pipeExecCmd } = require('#@commander');

/**
 * Generate default output path based on archive name
 * @param {string} archivePath - Path to the archive
 * @returns {string} Generated output path
 */
function generateOutputPath(archivePath) {
    const archiveBase = path.basename(archivePath)
        .replace(/\.7z(\.001)?$/, ''); // Remove .7z and part number
    return path.join(path.dirname(archivePath), archiveBase);
}

/**
 * Decompress a 7z archive (single or multi-part)
 * @param {string} archivePath - Path to the archive or first part (e.g., 'olddb.7z' or 'olddb.7z.001')
 * @param {string} [outputPath] - Optional output directory path. If not provided, will use archive name in its directory
 * @returns {Promise<Object>} Decompression result with success status, output path, and any error messages
 */
async function decompress(archivePath, outputPath) {
    try {
        // Get 7z executable
        const exe7z = await get7zExecutable();
        if (!exe7z) {
            logger.error('7z executable not found');
            return {
                success: false,
                error: '7z executable not found'
            };
        }

        // Handle multi-part archives
        let targetArchive = archivePath;
        // Generate output path if not provided
        if (!outputPath) {
            outputPath = generateOutputPath(targetArchive);
        }

        // Create output directory if it doesn't exist
        fs.mkdirSync(outputPath, { recursive: true });

        // Execute decompression
        const cmd = `"${exe7z}" x "${targetArchive}" -o"${outputPath}" -y`;
        await pipeExecCmd(cmd);

        return {
            success: true,
            outputPath,
            message: `Successfully decompressed to ${outputPath}`
        };
    } catch (error) {
        logger.error('Decompression failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test if a file is a valid 7z archive
 * @param {string} archivePath - Path to the archive
 * @returns {Promise<boolean>} True if the file is a valid 7z archive
 */
async function testArchive(archivePath) {
    try {
        const exe7z = await get7zExecutable();
        if (!exe7z) {
            logger.error('7z executable not found');
            return false;
        }

        const cmd = `"${exe7z}" t "${archivePath}"`;
        await pipeExecCmd(cmd);
        return true;
    } catch (error) {
        logger.error('Archive test failed:', error);
        return false;
    }
}

module.exports = {
    decompress,
    testArchive,
}; 