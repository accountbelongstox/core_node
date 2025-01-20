const { execCmdResultText,pipeExecCmd } = require('#@/ncore/basic/libs/commander.js');
const pythonSetup = require('../../../../../ncore/utils/dev_tool/lang_compiler_deploy/pythonSetup');
const pythonVenv = require('../../../../../ncore/utils/dev_tool/lang_compiler_deploy/pythonVenv');
const fs = require('fs');
const path = require('path');

let log;
let edgeTTSPath = null;
try {
    const logger = require('#@logger');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}


const findPythonPath = async () => {
    const { pythonPath, pipPath,venvPath } = await pythonVenv.configurePython()
    if (!pythonPath) {
        log.error(`Failed to find python path`)
        return null
    }
    return { pythonPath, pipPath,venvPath }
}

const checkEdgeTTS = (pythonPath, pipPath) => {
    try {
        if (!pythonPath || !pipPath) {
            log.error('Python/pip environment not properly set up');
            return false;
        }

        const platform = process.platform;

        // Get expected edge-tts path based on pip location
        const pipDir = path.dirname(pipPath);
        const expectedPath = platform === 'win32'
            ? path.join(pipDir, 'edge-tts.exe')
            : path.join(pipDir, 'edge-tts');

        if (fs.existsSync(expectedPath)) {
            return true
        }
        log.warn(`edge-tts not found in PATH`);
        log.warn(`Expected location: ${expectedPath}`);
        return false
    } catch (error) {
        log.error('Error checking edge-tts:', error);
        return false;
    }
};

const installEdgeTTS = async ( pythonPath, pipPath ) => {
    try {
        log.info('Installing edge-tts...');
        await pipeExecCmd(`"${pipPath}" install --break-system-packages edge-tts`);
        return true;
    } catch (error) {
        log.error(`Failed to install edge-tts: ${error.message}`);
        return false;
    }
};

let edgeTTSBinary = null;
const findEdgeTTSBinary = async () => {
    if(edgeTTSBinary){
        return edgeTTSBinary;
    }
    const pythonStatus = await findPythonPath()
    if (!pythonStatus) {
        log.error(`Failed to find python path`)
        return
    }
    const { pythonPath, pipPath,venvPath } = pythonStatus
    const platform = process.platform;
    let binaryPath;

    if (platform === 'win32') {
        binaryPath = path.join(venvPath, 'Scripts', 'edge-tts.exe');
    } else {
        binaryPath = path.join(venvPath, 'bin', 'edge-tts');
    }
    if(!fs.existsSync(binaryPath)){
        log.warn(`edge-tts not found at ${binaryPath} , installing...`)
        await installEdgeTTS( pythonPath, pipPath )
        if(!fs.existsSync(binaryPath)){
            log.error(`Failed to install edge-tts at ${binaryPath}`)
            return null
        }
    }
    edgeTTSBinary = binaryPath;
    return edgeTTSBinary
};

const printVersionByEdgeTTS = async () => {
    const binaryPath = await findEdgeTTSBinary()
    if(!binaryPath){
        log.error(`Failed to find edge-tts binary`)
        return
    }
    await pipeExecCmd(`${binaryPath}`)
}

module.exports = {
    findEdgeTTSBinary,
    printVersionByEdgeTTS
}; 