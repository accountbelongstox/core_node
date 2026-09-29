const { uploadFile, checkFileExists, getAllUploadDirs } = require('../http_controller/update.js');
const { getSubDirs } = require('../http_controller/up-dir-selector.js');
const download = require('../http_controller/download.js');

const logger = require('#@logger');
const printLog = false;

class RouteInitializer {
    static initializeRoutes(routerManager) {
        if (!routerManager) {
            logger.error('RouterManager is required');
            return;
        }

        // File check route
        routerManager.api('/check-file', async (req, res) => {
            const result = await checkFileExists(req, res);
            res.json(result);
        }, printLog);

        // File upload route
        routerManager.api('/upload', async (req, res) => {
            const result = await uploadFile(req, res);
            res.json(result);
        }, printLog);

        // Upload directories route
        routerManager.api('/upload-dirs', async (req, res) => {
            const dirs = getAllUploadDirs();
            res.json({ dirs });
        }, printLog);

        // New: Directory selector for path picker
        routerManager.api('/upload-dir-list', async (req, res) => {
            const parent = req.query.parent || '/';
            const dirs = getSubDirs(parent);
            res.json({ dirs });
        }, printLog);

        // File browser API for download.html
        routerManager.api('/api/list', download.listDir, printLog);
        routerManager.download('/api/download', download.downloadFile, printLog);
    }
}

module.exports = RouteInitializer;
