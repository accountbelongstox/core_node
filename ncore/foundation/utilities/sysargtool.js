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
