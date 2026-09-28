const fs = require('fs');
const path = require('path');
const logger = require('#@logger');

class FileHandler {
    static async safeReplaceFile(codeResult, filePath) {
        try {
            // Read original file
            const originalContent = fs.readFileSync(filePath, 'utf8');
            const originalLines = originalContent.split('\n').length;

            // Create backup
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(
                path.dirname(filePath),
                `${path.basename(filePath)}.${timestamp}.bak`
            );
            fs.writeFileSync(backupPath, originalContent, 'utf8');

            // Only validate line count for files over 100 lines
            if (originalLines > 100) {
                const lineDifference = Math.abs(originalLines - codeResult.totalLines);
                const lineRatio = codeResult.totalLines / originalLines;

                // If the converted code has less than 80% of original lines or more than 120%
                if (lineRatio < 0.8 || lineRatio > 1.2) {
                    logger.warn(`Warning: Significant line count difference detected!`);
                    logger.warn(`Original: ${originalLines} lines`);
                    logger.warn(`Converted: ${codeResult.totalLines} lines`);
                    logger.warn(`Difference: ${lineDifference} lines`);
                    logger.warn(`Ratio: ${(lineRatio * 100).toFixed(1)}%`);
                    logger.warn(`Backup saved at: ${backupPath}`);
                    return {
                        success: false,
                        backupPath,
                        error: 'Line count mismatch'
                    };
                }
            }
            // For files under 100 lines, proceed directly with replacement
            else {
                logger.info(`Small file (${originalLines} lines), proceeding with direct replacement`);
            }

            // Replace file content
            fs.writeFileSync(filePath, codeResult.toString(), 'utf8');

            return {
                success: true,
                backupPath,
                originalLines,
                newLines: codeResult.totalLines
            };
        } catch (error) {
            logger.error('Error handling file replacement:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    static validateBackup(backupPath, originalPath) {
        try {
            const backupContent = fs.readFileSync(backupPath, 'utf8');
            const originalContent = fs.readFileSync(originalPath, 'utf8');
            return backupContent === originalContent;
        } catch (error) {
            logger.error('Error validating backup:', error);
            return false;
        }
    }
}

module.exports = FileHandler; 