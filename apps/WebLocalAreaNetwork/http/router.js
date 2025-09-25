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

const RouterManager = require('#@/ncore/foundation/express_utils/libs/RouterManager.js');
const { uploadFile, checkFileExists, getAllUploadDirs } = require('../http_controller/update.js');
const { getSubDirs } = require('../http_controller/up-dir-selector.js');
const download = require('../http_controller/download.js');

const logger = require('#@logger');
const printLog = false;

class RouteInitializer {
    static initializeRoutes() {
        // File check route
        RouterManager.post('/check-file', async (req, res) => {
            const result = await checkFileExists(req, res);
            res.json(result);
        }, printLog);

        // File upload route
        RouterManager.post('/upload', async (req, res) => {
            const result = await uploadFile(req, res);
            res.json(result);
        }, printLog);

        // Upload directories route
        RouterManager.get('/upload-dirs', async (req, res) => {
            const dirs = getAllUploadDirs();
            res.json({ dirs });
        }, printLog);

        // New: Directory selector for path picker
        RouterManager.get('/upload-dir-list', async (req, res) => {
            const parent = req.query.parent || '/';
            const dirs = getSubDirs(parent);
            res.json({ dirs });
        }, printLog);

        // File browser API for download.html
        RouterManager.get('/api/list', download.listDir, printLog);
        RouterManager.download('/api/download', download.downloadFile, printLog);
    }
}

module.exports = RouteInitializer;
