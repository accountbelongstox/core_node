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
