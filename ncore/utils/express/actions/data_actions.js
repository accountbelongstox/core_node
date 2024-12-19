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

    exports.exportData = exportData;
    exports.importData = importData;