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