const fs = require('fs').promises;
const path = require('path');
const { static_dir } = require('../provider/global_var');
const logger = require('./log_utils');

async function handleStaticRequest(filePath, respond) {
    const fullFilePath = path.join(static_dir, filePath);

    try {
        const stats = await fs.stat(fullFilePath);
        if (stats.isFile()) {
            let contentType = 'text/plain';
            if (fullFilePath.endsWith('.css')) {
                contentType = 'text/css';
            } else if (fullFilePath.endsWith('.js')) {
                contentType = 'application/javascript';
            } else if (fullFilePath.endsWith('.html')) {
                contentType = 'text/html';
            }

            const data = await fs.readFile(fullFilePath, 'utf-8');
            respond(200, data, contentType);
        } else {
            respond(404, 'File not found', 'text/plain');
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            respond(404, 'File not found', 'text/plain');
        } else {
            logger.log(`Error handling static request: ${error.message}`);
            respond(500, 'Internal Server Error', 'text/plain');
        }
    }
}

module.exports = {
    handleStaticRequest
};