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

'use strict';
const os = require('os')
const { execSync, exec } = require('child_process');

class Platform {

    isWindows() {
        return os.platform() === 'win32';
    }

    isLinux() {
        return os.platform() === 'linux';
    }
    
    killChromeCommand() {
        const cmd = 'pkill chrome';
        return cmd;
    }

    getParameters(para_key) {
        const args = process.argv.slice(1);
        if (this.parsedArgs) {
            if (para_key) {
                return this.parsedArgs[para_key]
            }
            return this.parsedArgs
        }
        this.parsedArgs = {};
        let currentKey = null;

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg.startsWith('-')) {
                const keyValue = arg.replace(/^-+/, '');
                const [key, value] = keyValue.includes(':')
                    ? keyValue.split(':')
                    : keyValue.split('=');

                currentKey = key;
                this.parsedArgs[currentKey] = value || true;
            } else if (currentKey !== null) {
                this.parsedArgs[currentKey] = arg.replace(/"/g, ''); // Remove surrounding quotes
                currentKey = null;
            }
        }
        if (para_key) {
            return this.parsedArgs[para_key]
        }
        return this.parsedArgs;
    }

    isParameter(key) {
        if (!this.parsedArgs) {
            this.getParameters()
        }
        return key in this.parsedArgs;
    }

    getParameter(para_key) {
        return this.getParameters(para_key)
    }

    processesCount(processe_name) {
        let cmd;
        const normalizedProcessName = processe_name.toLowerCase();
        if (os.platform() === 'win32') {
            cmd = 'tasklist';
        } else {
            cmd = 'ps aux';
        }
        try {
            const stdout = execSync(cmd, { encoding: 'utf8' });
            const count = stdout.split('\n').filter(line => line.toLowerCase().includes(normalizedProcessName)).length;
            return count;
        } catch (err) {
            console.error('Error executing command:', err);
            return 10000;
        }
    }

}

Platform.toString = () => '[class Platform]';
module.exports = new Platform();

