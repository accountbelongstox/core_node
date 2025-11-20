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

const { exportDataUtil, importDataUtil } = require('../../utils/data_transfer_utils');
const { standardResponse } = require('../../utils/html_utils');
const logger = require('../../utils/log_utils');
const path = require('path');
const { exportsDir } = require('../../provider/global_var');

async function exportData() {
    try {
        logger.log("Starting data export process");
        const zipFilePath = await exportDataUtil();
        const filename = path.basename(zipFilePath);
        const downloadUrl = `/download/${filename}`;
        logger.logGreen(`Data exported successfully to ${zipFilePath}`);
        logger.log(`Download URL: ${downloadUrl}`);
        return standardResponse(true, "Data exported successfully", filename, 200);
    } catch (error) {
        logger.logRed(`Failed to export data: ${error.message}`);
        return standardResponse(false, `Failed to export data: ${error.message}`, null, 500);
    }
}

async function importData(zipBuffer) {
    try {
        logger.log("Starting data import process");
        await importDataUtil(zipBuffer);
        logger.logGreen("Data imported successfully");
        return standardResponse(true, "Data imported successfully", null, 200);
    } catch (error) {
        logger.logRed(`Failed to import data: ${error.message}`);
        return standardResponse(false, `Failed to import data: ${error.message}`, null, 500);
    }
}

module.exports = {
    exportData,
    importData
};
