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
const logger = require('./log_utils');

/**
 * Recursively copy files and directories from source to destination
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 */
function copyRecursive(src, dest) {
    try {
        // Ensure the destination directory exists
        fs.mkdirSync(dest, { recursive: true });
        logger.log(`Ensuring destination directory exists: ${dest}`);

        // Read the contents of the source directory
        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (let entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                // Recursively copy subdirectories
                logger.log(`Copying directory: ${srcPath} to ${destPath}`);
                copyRecursive(srcPath, destPath);
            } else {
                // Copy files
                logger.log(`Copying file: ${srcPath} to ${destPath}`);
                fs.copyFileSync(srcPath, destPath);
            }
        }

        logger.logGreen(`Successfully copied ${src} to ${dest}`);
    } catch (error) {
        logger.logRed(`Error during copy process: ${error}`);
    }
}

/**
 * Copy a file or directory
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 */
function copy(src, dest) {
    try {
        const srcStat = fs.statSync(src);

        if (srcStat.isDirectory()) {
            copyRecursive(src, dest);
        } else {
            const destDir = path.dirname(dest);
            fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(src, dest);
            logger.logGreen(`Successfully copied file ${src} to ${dest}`);
        }
    } catch (error) {
        logger.logRed(`Error during copy: ${error}`);
        throw error;
    }
}

module.exports = {
    copy,
    copyRecursive
};
