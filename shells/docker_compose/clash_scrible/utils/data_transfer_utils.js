const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const { base_data_dir, exportsDir, importsDir, bak_dir } = require('../provider/global_var');
const logger = require('./log_utils');
const { copy, copyRecursive } = require('./copy_utils');
const { mkdir, unlink } = require('./file_utils');

async function exportDataUtil() {
    const bakDir = path.join(base_data_dir, '.bak');
    if (fs.existsSync(bakDir)) {
        logger.log(`Removing .bak directory: ${bakDir}`);
        unlink(bakDir);
    }

    const updateTestDir = path.join(base_data_dir, '.out', '.update_test');
    if (fs.existsSync(updateTestDir)) {
        logger.log(`Removing .out/.update_test directory: ${updateTestDir}`);
        unlink(updateTestDir);
    }

    const zipFilePath = path.join(exportsDir, 'clash_subscribe_data.zip');

    if (fs.existsSync(zipFilePath)) {
        logger.log(`Removing old export file: ${zipFilePath}`);
        unlink(zipFilePath);
    }

    logger.log(`Creating new zip file at: ${zipFilePath}`);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Set compression level
    });

    return new Promise((resolve, reject) => {
        output.on('close', () => {
            logger.logGreen(`Zip file created successfully. Total bytes: ${archive.pointer()}`);
            resolve(zipFilePath);
        });
        archive.on('error', (err) => {
            logger.logRed(`Error during zip creation: ${err}`);
            reject(err);
        });

        archive.pipe(output);
        logger.log(`Adding directory to zip: ${base_data_dir}`);
        archive.directory(base_data_dir, false);
        archive.finalize();
    });
}

function importDataUtil(zipBuffer) {
    fs.mkdirSync(importsDir, { recursive: true });
    try {
        // Create a timestamp for the backup directory
        const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
        const backupDir = path.join(bak_dir, `data_backup_${timestamp}`);

        // Backup the current base_data_dir
        logger.log(`Backing up current data to: ${backupDir}`);
        copy(base_data_dir, backupDir);

        const tempZipPath = path.join(importsDir, `temp_import_${timestamp}.zip`);
        logger.log(`Writing uploaded zip to: ${tempZipPath}`);
        fs.writeFileSync(tempZipPath, zipBuffer);

        const tempDir = path.join(importsDir, `temp_extract_${timestamp}`);
        logger.log(`Creating temporary directory for extraction: ${tempDir}`);
        mkdir(tempDir);

        // Extract the zip file
        fs.createReadStream(tempZipPath)
            .pipe(unzipper.Extract({ path: tempDir }))
            .on('close', () => {
                // Clear contents of each subdirectory in base_data_dir
                const entries = fs.readdirSync(base_data_dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const subDir = path.join(base_data_dir, entry.name);
                        logger.log(`Clearing contents of: ${subDir}`);
                        unlink(subDir);
                        mkdir(subDir);
                    }
                }

                // Copy extracted data to base_data_dir
                logger.log(`Copying extracted data to: ${base_data_dir}`);
                copyRecursive(tempDir, base_data_dir);

                // Clean up
                logger.log(`Cleaning up temporary files: ${tempZipPath} and ${tempDir}`);
                unlink(tempZipPath);
                unlink(tempDir);
                const parentDir = path.dirname(tempDir);
                unlink(parentDir);

                logger.logGreen("Import process completed successfully");
            })
            .on('error', (error) => {
                logger.logRed(`Error during import process: ${error}`);
            });
    } catch (error) {
        logger.logRed(`Error during import process: ${error}`);
    }
}

module.exports = {
    exportDataUtil,
    importDataUtil
};
