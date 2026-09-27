const explorer = require('#@ncore/utils/systool/libs/explorer.js');

// Launcher-facing name for the single explorer launch implementation (ncore/utils/systool/libs/explorer.js)
class AppExecutableLauncher {
    get supportedExtensions() {
        return explorer.supportedExtensions;
    }

    searchExecutableFile(directory, baseName) {
        return explorer.searchExecutableFile(directory, baseName);
    }

    async launchWithExplorer(filePath) {
        return explorer.launchWithExplorer(filePath);
    }

    async searchAndLaunchAppExecutables(appDirectory, appName) {
        return explorer.searchAndLaunchAppExecutables(appDirectory, appName);
    }
}

let _instance = null;

function getAppExecutableLauncher() {
    if (!_instance) {
        _instance = new AppExecutableLauncher();
    }
    return _instance;
}

module.exports = {
    AppExecutableLauncher,
    getAppExecutableLauncher
};
