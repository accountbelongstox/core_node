const fs = require('fs');
const path = require('path');
const logger = require('#@logger');

const TARGET_DIR = 'D:/programing/core_node/public/VoiceStaticServer/metadata/translate';
const EXPECTED_EXT = '.expected_ext_marker.j7son.js';

/**
 * Check if a file has the expected extension
 * @param {string} filePath - Path to the file
 * @returns {boolean} Whether the file has the expected extension
 */
function hasExpectedExtension(filePath) {
    return filePath.endsWith(EXPECTED_EXT);
}

/**
 * Rename a file to append the expected extension
 * @param {string} filePath - Path to the file
 */
function renameFile(filePath) {
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);  // Keep the full filename including its extension
    const newPath = path.join(dir, fileName + EXPECTED_EXT);

    try {
        fs.renameSync(filePath, newPath);
        logger.info(`Renamed: ${filePath} -> ${newPath}`);
    } catch (error) {
        logger.error(`Failed to rename ${filePath}: ${error.message}`);
    }
}

/**
 * Process all files in a directory
 * @param {string} dirPath - Path to the directory
 */
function processDirectory(dirPath) {
    try {
        // Get all files in directory
        const files = fs.readdirSync(dirPath);
        let renamedCount = 0;
        let skippedCount = 0;

        logger.info(`Scanning directory: ${dirPath}`);
        logger.info(`Found ${files.length} files`);

        // Process each file
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);

            if (stats.isFile()) {
                if (!hasExpectedExtension(filePath)) {
                    renameFile(filePath);
                    renamedCount++;
                } else {
                    skippedCount++;
                }
            }
        }

        // Log summary
        logger.success(`
Processing completed:
- Total files: ${files.length}
- Renamed: ${renamedCount}
- Skipped (already correct): ${skippedCount}
`);

    } catch (error) {
        logger.error(`Error processing directory: ${error.message}`);
        process.exit(1);
    }
}

// Execute the script
processDirectory(TARGET_DIR); 