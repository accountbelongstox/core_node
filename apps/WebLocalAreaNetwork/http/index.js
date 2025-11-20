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

const { appname } = require('#@global_vars');
const rpc = require('#@ncore/utils/rpc');
const router = require('./router.js');

class HttpMain {
    constructor() {
        this.expressServer = null;
    }

    async start(config) {
        if(!config) config = require('../config/index.js');

        this.expressServer = rpc.createExpressServer({
            HTTP_PORT: config.HTTP_PORT || 3000,
            HTTP_HOST: config.HTTP_HOST || '0.0.0.0',
            STATIC_PATHS: config.STATIC_PATHS,
            auth: { enabled: false }
        });

        router.initializeRoutes(this.expressServer.getRouterManager());

        await this.expressServer.start();
    }
}

module.exports = new HttpMain();