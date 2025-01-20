const { appname } = require('#@/ncore/globalvars.js');
const config = require('./config/index.js');
const http = require('./http/index.js');
const logger = require('#@logger');
const wordMaster = require('./processor/wordMaster.js');
const pythonSetup = require('#@/ncore/utils/dev_tool/lang_compiler_deploy/pythonSetup.js');
const edgeTTSFinder = require('./processor/tools/mate_libs/edgeTTSFinder.js');
const pythonVenv = require('#@/ncore/utils/dev_tool/lang_compiler_deploy/pythonVenv.js');

class Main {
    constructor() {}

    async start() {
        await pythonSetup.ensurePythonEnvironment()
        const pythonStatus = await pythonSetup.ensurePythonEnvironment()
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
            logger.info('Python environment setup successfully!');
            await pythonVenv.configurePython()
        }
        const edgeTTSPath = await edgeTTSFinder.findEdgeTTSBinary()
        if(!edgeTTSPath){
            logger.error('EdgeTTS binary not found!');
            logger.error('Please check the following:');
            logger.error('1. EdgeTTS is installed and accessible from command line');
            logger.error('   - Try running: edge-tts --version');
            logger.error('   - If edge-tts not found, install it manually');
            logger.error('Error details:', edgeTTSPath);
        }else{
            logger.info('EdgeTTS binary found successfully! Path: ', edgeTTSPath);
        }
        logger.info(`usage:  --app=${appname} --word_segmentation=0-30000`);

        wordMaster.start()
        // http.start(config)
    }
}

// Export both the class and an instance
module.exports.Main = Main;
module.exports = new Main();