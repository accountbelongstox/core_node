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

const fs = require('fs');
const { appname } = require('#@global_vars');
const logger = require('#@logger');
const rpc = require('#@ncore/utils/rpc/index.js');
const router = require('./router.js');

class HttpMain {
    constructor() {
        this.expressServer = null;
    }

    async start(config) {
        if(!config) config = require('../config/index.js');

        if (config.SHARE_DIR) {
            try {
                fs.mkdirSync(config.SHARE_DIR, { recursive: true });
            } catch (error) {
                logger.error(`Cannot create share directory ${config.SHARE_DIR}: ${error.message}`);
            }
        }

        this.expressServer = rpc.createExpressServer({
            HTTP_PORT: config.HTTP_PORT || 3000,
            HTTP_HOST: config.HTTP_HOST,
            STATIC_PATHS: config.STATIC_PATHS,
            auth: { enabled: false }
        });

        router.initializeRoutes(this.expressServer.getRouterManager());

        await this.expressServer.start();
    }
}

module.exports = new HttpMain();