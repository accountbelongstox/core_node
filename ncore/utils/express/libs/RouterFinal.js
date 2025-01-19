const logger = require('#@logger');
const expressProvider = require('../provider/expressProvider');
const path = require('path');
const fs = require('fs');
const { APP_TEMPLATE_DIR } = require('#@/ncore/gvar/gdir.js');
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
        logger.success('404 and 403 pages setup.');
    }
}

module.exports = new RouterFinal();