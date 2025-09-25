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

const logger = require('#@logger');
const expressProvider = require('../provider/expressProvider');
const path = require('path');
const fs = require('fs');
const { APP_TEMPLATE_DIR } = require('#@global_dir');
const app = expressProvider.getExpressApp()

function findFirstAvailableFile(filePaths) {
    for (let filePath of filePaths) {
        const resolvedPath = path.resolve(filePath);
        if (fs.existsSync(resolvedPath)) {
            return resolvedPath;
        }
    }
    return null;
}

class RouterFinal {
    constructor() {
    }

    async setFinalRoutes(config) {
        const notFoundPage = findFirstAvailableFile([
            path.join(APP_TEMPLATE_DIR, '404.html'),
            path.join(__dirname, '../template/404.html')
        ])
        const forbiddenPage = findFirstAvailableFile([
            path.join(APP_TEMPLATE_DIR, '403.html'),
            path.join(__dirname, '../template/403.html')
        ])
        app.use((req, res, next) => {
            res.status(404).sendFile(fs.existsSync(notFoundPage) ? notFoundPage : path.join(APP_TEMPLATE_DIR, '404.html'));
        });
        app.use((req, res, next) => {
            res.status(403).sendFile(fs.existsSync(forbiddenPage) ? forbiddenPage : path.join(APP_TEMPLATE_DIR, '403.html'));
        });
        logger.debug('404 and 403 pages setup.');
    }
}

module.exports = new RouterFinal();