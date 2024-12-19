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

    getArg(name, defaultValue = null, info = false) {
        if (typeof name === 'number') {
            return this.getArgByIndex(name, defaultValue);
        }

        const lowerCaseName = name.toLowerCase();

        if (info) {
            console.log('getArg');
            console.log(process.argv);
        }

        for (let i = 0; i < process.argv.length; i++) {
            const arg = process.argv[i].toLowerCase(); // Convert argument to lowercase
            const regex = new RegExp(`^[-]*${lowerCaseName}(\$|=|-|:)`);

            if (regex.test(arg)) {
                if (arg.includes(`${lowerCaseName}:`)) {
                    return process.argv[i].split(':')[1];
                } else if (arg.includes(`${lowerCaseName}=`)) {
                    return process.argv[i].split('=')[1];
                } else if (arg === `--${lowerCaseName}` || arg === `-${lowerCaseName}` || arg.match(`^-{0,1}\\*{1}${lowerCaseName}`)) {
                    return i + 1 < process.argv.length ? process.argv[i + 1] : defaultValue;
                } else if (arg === lowerCaseName) {
                    return i + 1 < process.argv.length && !process.argv[i + 1].startsWith('-') ? process.argv[i + 1] : '';
                }
            }
        }

        return defaultValue;
    }

    getArgByIndex(index, defaultValue = null) {
        index += 1; // Adjusting because process.argv includes node executable and script path
        return process.argv.length > index ? process.argv[index] : defaultValue;
    }

    isArg(name) {
        return this.getArg(name) !== null;
    }

    isArgByIndex(index) {
        return this.getArgByIndex(index) !== null;
    }

    getArgs() {
        return this.commandLineArgs;
    }

    getArgsLength() {
        return this.commandLineArgs.length - 2; // Excluding node executable and script path
    }
}

SysArg.toString = () => '[class SysArg]';

module.exports = new SysArg();
