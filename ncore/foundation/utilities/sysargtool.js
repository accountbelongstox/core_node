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

class SysArg {
    constructor() {
        this.pythonVersion = process.version;
        this.platform = process.platform;
        this.commandLineArgs = process.argv;
    }

    getPythonVersion() {
        return this.pythonVersion;
    }

    getPlatform() {
        return this.platform;
    }

    getArg(name) {
        if (typeof name === 'number') {
            name = name + 1;
            if (process.argv.length > name) {
                return process.argv[name];
            } else {
                return null;
            }
        }
        for (let i = 0; i < this.commandLineArgs.length; i++) {
            const arg = this.commandLineArgs[i];
            const regex = new RegExp("^[-]*" + name + "(\$|=|-|:)");
            console.log(`regex.test(arg)`,regex.test(arg),regex,arg)
            if (regex.test(arg)) {
                if (arg.includes(`${name}:`)) {
                    return arg.split(":")[1];
                } else if (arg === `--${name}` || arg === `-${name}` || arg.match(`^-{0,1}\\*{1}${name}`)) {
                    if (i + 1 < this.commandLineArgs.length) {
                        return this.commandLineArgs[i + 1];
                    } else {
                        return null;
                    }
                } else if (arg === name) {
                    if (i + 1 < this.commandLineArgs.length && !this.commandLineArgs[i + 1].startsWith("-")) {
                        return this.commandLineArgs[i + 1];
                    } else {
                        return "";
                    }
                }
            }
        }
        return null;
    }

    isArg(name) {
        return this.getArg(name) !== null;
    }

    getArgs() {
        return this.commandLineArgs;
    }
}


SysArg.toString = () => '[class SysArg]';
module.exports = new SysArg();
