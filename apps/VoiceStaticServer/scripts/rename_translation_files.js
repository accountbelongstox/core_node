const fs = require('fs');
const path = require('path');
const logger = require('#@logger');

const TARGET_DIR = 'D:/programing/core_node/public/VoiceStaticServer/metadata/translate';
const OLD_STRING = 'translation_dictionary';
const NEW_STRING = 'olddb';

/**
 * Check if filename contains the target string
 * @param {string} fileName - Name of the file
 * @returns {boolean} Whether the file needs to be renamed
 */
function needsRename(fileName) {
    return fileName.includes(OLD_STRING);
}

/**
 * Rename a file by replacing the target string
 * @param {string} filePath - Path to the file
 */
function renameFile(filePath) {
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const newFileName = fileName.replace(OLD_STRING, NEW_STRING);
    const newPath = path.join(dir, newFileName);

    try {
        if (fs.existsSync(newPath)) {
            logger.warn(`Target file already exists, skipping: ${newPath}`);
            return false;
        }

        fs.renameSync(filePath, newPath);
        logger.info(`Renamed: ${fileName} -> ${newFileName}`);
        return true;
    } catch (error) {
        logger.error(`Failed to rename ${filePath}: ${error.message}`);
        return false;
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

            if (stats.isFile() && needsRename(file)) {
                if (renameFile(filePath)) {
                    renamedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }
        }

        // Log summary
        logger.success(`
Processing completed:
- Total files: ${files.length}
- Renamed: ${renamedCount}
- Skipped: ${skippedCount}
- Search pattern: "${OLD_STRING}" -> "${NEW_STRING}"
`);

    } catch (error) {
        logger.error(`Error processing directory: ${error.message}`);
        process.exit(1);
    }
}

// Execute the script
processDirectory(TARGET_DIR); 