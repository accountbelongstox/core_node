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