const path = require('path');
const fs = require('fs').promises;
const logger = require('#@logger');

const TARGET_DIR = path.join(process.cwd(), 'public/VoiceStaticServer/metadata/translate');
const EXTENSION_TO_ADD = '.expected_ext_marker.j7son.js';

async function listFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await listFiles(fullPath)));
        } else {
            files.push(fullPath);
        }
    }
    
    return files;
}

async function renameFiles() {
    try {
        // Get all files recursively
        logger.info('Scanning directory:', TARGET_DIR);
        const files = await listFiles(TARGET_DIR);
        logger.info(`Found ${files.length} files`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // Process each file
        for (const filePath of files) {
            try {
                // Skip if file already has the extension
                if (filePath.endsWith(EXTENSION_TO_ADD)) {
                    logger.info(`Skipping (already has extension): ${filePath}`);
                    skipCount++;
                    continue;
                }

                // New file path with added extension
                const newPath = filePath + EXTENSION_TO_ADD;
                
                // Rename file
                await fs.rename(filePath, newPath);
                logger.info(`Renamed: ${path.basename(filePath)} -> ${path.basename(newPath)}`);
                successCount++;

            } catch (error) {
                logger.error(`Error processing file ${filePath}:`, error.message);
                errorCount++;
            }
        }

        // Print statistics
        logger.success('\nProcess completed:');
        logger.info(`- Total files found: ${files.length}`);
        logger.info(`- Successfully renamed: ${successCount}`);
        logger.info(`- Skipped (already had extension): ${skipCount}`);
        logger.info(`- Errors: ${errorCount}`);

    } catch (error) {
        logger.error('Error during process:', error);
        process.exit(1);
    }
}

// Run the script
renameFiles().catch(error => {
    logger.error('Script failed:', error);
    process.exit(1);
}); 