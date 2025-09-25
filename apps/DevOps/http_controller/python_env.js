// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const pythonSetup = require('#@/ncore/utils/dev_tool/lang_deploy/pythonSetup.js');
const pythonVenv = require('#@/ncore/utils/dev_tool/lang_deploy/pythonVenv.js');
const logger = require('#@logger');

async function getPythonStatus(req, res) {
    try {
        const pythonStatus = await pythonSetup.ensurePythonEnvironment(false);
        const venvStatus = await pythonVenv.getVenvStatus();
        return {
            success: true,
            data: {
                python: pythonStatus,
                venv: venvStatus
            }
        };
    } catch (error) {
        logger.error('Error getting python status:', error);
        return {
            success: false,
            message: `Failed to get python status: ${error.message}`,
            data: null
        };
    }
}

async function setupPython(req, res) {
    try {
        const pythonStatus = await pythonSetup.ensurePythonEnvironment(true);
        if (!pythonStatus.success) {
            return pythonStatus;
        }
        const venvStatus = await pythonVenv.configurePython(true);
        return venvStatus;
    } catch (error) {
        logger.error('Error setting up python:', error);
        return {
            success: false,
            message: `Failed to set up python: ${error.message}`,
            data: null
        };
    }
}

module.exports = {
    getPythonStatus,
    setupPython
};
