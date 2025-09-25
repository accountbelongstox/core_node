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

const { app } = require('electron');
let electronWindow
class ElectronCtrl {

    setElectronWindow(win) {
        electronWindow = win
    }

    minimize() {
        // electronWindow.setFullScreen(false)
        // electronWindow.minimize()
        electronWindow.minimize()
    }

    maximize() {
        // electronWindow.setFullScreen(true)
        electronWindow.maximize()
    }

    relaunch(layout = 0) {
        let restartTime = layout > 0 ? layout / 1000 : 0;
        if (restartTime > 0) {
            console.log(`The application will restart in ${restartTime} seconds...`);
            const timer = setInterval(() => {
                restartTime = restartTime - 1;
                console.log(`Restart countdown: ${restartTime} seconds`);
                if (restartTime <= 0) {
                    clearInterval(timer);
                    console.log('Restarting...');
                    app.relaunch();
                    app.exit();
                }
            }, 1000);
        }
    }

    close() {
        app.exit();
    }

}

module.exports = new ElectronCtrl();