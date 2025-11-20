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

const { standardResponse } = require('../../utils/html_utils');
const { checkForNewVersion, updateAndRestart, getLastCommitTime } = require('../update_utils');
const { local_dir } = require('../../provider/global_var');
const path = require('path');
const fs = require('fs');

function isDevEnvironment() {
    const devFilePath = path.join(local_dir, '.devenv');
    return fs.existsSync(devFilePath);
}

async function checkForUpdate(postData) {
    try {
        const versionCheck = await checkForNewVersion();
        
        if (isDevEnvironment()) {
            return standardResponse(
                true,
                `This is a development system. Last commit time: ${new Date(versionCheck.lastCommitTime)}`,
                versionCheck,
                200
            );
        }

        if (versionCheck.newVersionAvailable) {
            return standardResponse(
                true,
                `New version available. Last commit time: ${new Date(versionCheck.lastCommitTime)}`,
                versionCheck,
                200
            );
        } else {
            return standardResponse(
                true,
                "No updates available. System is up-to-date.",
                versionCheck,
                200
            );
        }
    } catch (e) {
        return standardResponse(
            false,
            `An error occurred while checking for updates: ${e}`,
            null,
            500
        );
    }
}

async function performUpdateAndRestart(postData) {
    try {
        await updateAndRestart();
        return standardResponse(
            true,
            "Update process started. The system will restart shortly.",
            null,
            200
        );
    } catch (e) {
        return standardResponse(
            false,
            `An error occurred during the update process: ${e}`,
            null,
            500
        );
    }
}

module.exports = {
    checkForUpdate,
    performUpdateAndRestart
};