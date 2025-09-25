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

const { appname,isServer,isService } = require('#@global_vars');
const config = require('./config/index.js');
const http = require('./http/index.js');
const logger = require('#@logger');
const ClientMaster = require('./server_controller/ClientMaster.js');
const pythonSetup = require('#@/ncore/utils/dev_tool/lang_deploy/pythonSetup.js');
const edgeTTSFinder = require('./basetool/ptools/edgeTTSFinder.js');
const pythonVenv = require('#@/ncore/utils/dev_tool/lang_deploy/pythonVenv.js');
const InitController = require('./libs/main_init.js');
const { setServerStatus } = require('./provider/constants/WordDynamicData.js');
const debug = true

class Main {
    constructor() {
    }

    async start() {
        logger.info(`App name: ${appname}`);
        logger.info(`Is server: ${isServer}`);
        logger.info(`Is service: ${isService}`);
        const pythonStatus = await pythonSetup.ensurePythonEnvironment(debug)
        if(!pythonStatus.success){
            logger.error(pythonStatus.error)
            logger.error('Python environment setup failed!');
            logger.error('Please check the following:');
            logger.error('1. Python3 is installed and accessible from command line');
            logger.error('   - Windows: https://www.python.org/downloads/');
            logger.error('   - Linux: sudo apt install python3 python3-pip (Ubuntu/Debian)');
            logger.error('   - Linux: sudo yum install python3 python3-pip (CentOS/RHEL)');
            logger.error('2. pip3 is installed and working');
            logger.error('   - Try running: pip3 --version');
            logger.error('   - If pip3 not found, install it manually');
            logger.error('3. Check system PATH includes Python and pip');
            logger.error('4. Try running commands manually:');
            logger.error('   - python3 --version');
            logger.error('   - pip3 --version');
            logger.error('Error details:', pythonStatus.error);
        }else{
            await pythonVenv.configurePython(debug)
        }
        const edgeTTSPath = await edgeTTSFinder.findEdgeTTSBinary()
        if(!edgeTTSPath){
            logger.error('EdgeTTS binary not found!');
            logger.error('Please check the following:');
            logger.error('1. EdgeTTS is installed and accessible from command line');
            logger.error('   - Try running: edge-tts --version');
            logger.error('   - If edge-tts not found, install it manually');
            logger.error('Error details:', edgeTTSPath);
        }
        setServerStatus("starting   ");
        http.start(config)
        await InitController.initialize()
        await ClientMaster.start()
        setServerStatus("open");
    }
}

// Export both the class and an instance
module.exports.Main = Main;
module.exports = new Main();