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

let log;
try {
    const logger = require('#@logger');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}

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

    getArg(name, defaultValue = null) {
        if (typeof name === 'number') {
            return this.getArgByIndex(name, defaultValue);
        }
        const args = this.getArgs();
        const arg = args[name];
        if (arg) {
            return arg;
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

    getArgsNotAlias() {
        const args = this.getArgs();
        const argsNotAlias = {};
        let isNumberKeyReg = /^\d$/;
        for (const key in args) {
            if (!isNumberKeyReg.test(key)) {
                argsNotAlias[key] = args[key];
            }
        }
        return argsNotAlias;
    }

    getArgs() {
        const args = {};
        let isKeyReg = /^-+/;
        // Skip first two elements (node executable and script path)
        for (let i = 0; i < this.commandLineArgs.length; i++) {
            const item = this.commandLineArgs[i];
            if (item.includes('=')) {
                const [rawKey, ...valueParts] = item.split('=');
                const rawValue = valueParts.join('=');
                const key = rawKey.replace(/^-+/, '').toLowerCase();
                const value = rawValue.replace(/^["']|["']$/g, '');
                const itemObject = {}
                itemObject[key] = value;
                args[key] = value;
            }
            else if(item.includes(':')){
                const [rawKey, ...valueParts] = item.split(':');
                const rawValue = valueParts.join(':');
                const key = rawKey.replace(/^-+/, '').toLowerCase();
                const value = rawValue.replace(/^["']|["']$/g, '');
                const itemObject = {}
                itemObject[key] = value;
                args[key] = value;
            }
            else{
                if(isKeyReg.test(item)){
                    const itemObject = {}
                    const key = item.replace(/^-+/, '').toLowerCase();
                    itemObject[key] = true;
                    args[key] = true;
                }else{
                    if(i==0){
                        const key = `exec`
                        const itemObject = {}
                        itemObject[key] = item;
                        args[key] = item;
                    }
                    else if(i==1){
                        const key = `entry`
                        const itemObject = {}
                        itemObject[key] = item;
                        args[key] = item;
                    }
                    else{

                        const keyAlias = item
                        const itemObjectAlias = {}
                        itemObjectAlias[keyAlias] = item;
                        args[keyAlias] = item;
                    }
                    const key = `${i}`
                    const itemObject = {}
                    itemObject[key] = item;
                    args[key] = item;

                }
            }
        }
        
        return args;
    }

    getArgsLength() {
        return this.commandLineArgs.length - 2; // Excluding node executable and script path
    }
}


module.exports = new SysArg();
