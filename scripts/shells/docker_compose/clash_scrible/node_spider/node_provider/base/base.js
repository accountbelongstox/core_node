const fs = require('fs');
const path = require('path');
const Log = require('./log.js');

class Base extends Log {
    constructor() {
        super()
    }

    getCwd(filename = null, suffix = "") {
        let cwd;
        if (filename === null) {
            let mainFilePath = path.resolve(process.argv[1]);
            if (fs.existsSync(mainFilePath) && fs.statSync(mainFilePath).isFile()) {
                mainFilePath = path.dirname(mainFilePath)
            }
            cwd = mainFilePath;
        } else {
            cwd = path.dirname(filename);
        }
        if (suffix !== "") {
            cwd = path.join(cwd, suffix);
        }
        return cwd;
    }

    getEnvFile() {
        return path.join(this.getCwd(), ".env");
    }

    readEnv() {
        const filePath = this.getEnvFile();
        let lines = [];
        if (fs.existsSync(filePath)) {
            lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        }
        const result = lines.map(line => line.split('=').map(value => value.trim()));
        return result;
    }

    saveEnv(envArr) {
        const filteredEnvArr = envArr.filter(subarr => subarr.length === 2);
        const formattedLines = filteredEnvArr.map(subarr => `${subarr[0]}=${subarr[1]}`);
        const resultString = formattedLines.join('\n');
        const envFilePath = this.getEnvFile();
        try {
            fs.writeFileSync(envFilePath, resultString, 'utf-8');
        } catch (e) {
            console.log(`Base-Class: Error saving environment variables: ${e}`);
        }
    }

    setEnv(key, value) {
        const envArr = this.readEnv();
        let keyExists = false;
        for (const subarr of envArr) {
            if (subarr[0] === key) {
                subarr[1] = value;
                keyExists = true;
                break;
            }
        }
        if (!keyExists) {
            envArr.push([key, value]);
        }
        this.saveEnv(envArr);
    }

    isEnv(key) {
        const val = this.getEnv(key);
        return val !== "";
    }

    getEnv(key) {
        const envArr = this.readEnv();
        const subarr = envArr.find(entry => entry[0] === key);
        return subarr ? subarr[1] : "";
    }

    easyLog(logText, logType = "info", logfilename = null, maxTotalSizeMb = 500, maxfile = 5, cwd) {
        if (!cwd) cwd = this.getCwd()
        this.writeLog(logText, logType, maxTotalSizeMb, logfilename, maxfile, cwd)
    }

    warn(...args) {
        const yellowColor = '\x1b[93m';
        const noPrintValue = this.getEnv("NO_PRINT");
        const show = !(noPrintValue && noPrintValue.toLowerCase() === "true");
        args.forEach(msg => {
            if (show) {
                this._printFormatted(yellowColor, msg);
            } else {
                this.easyLog(msg, "warn");
            }
        });
    }

    error(...args) {
        const redColor = '\x1b[91m';
        const noPrintValue = this.getEnv("NO_PRINT");
        const show = !(noPrintValue && noPrintValue.toLowerCase() === "true");
        args.forEach(msg => {
            this._printFormatted(redColor, msg);
            this.easyLog(msg, "error");
        });
    }

    success(...args) {
        const greenColor = '\x1b[92m';
        const noPrintValue = this.getEnv("NO_PRINT");
        const show = !(noPrintValue && noPrintValue.toLowerCase() === "true");
        args.forEach(msg => {
            if (show) {
                this._printFormatted(greenColor, msg);
            } else {
                this.easyLog(msg, "success");
            }
        });
    }

    info(...args) {
        const blueColor = '\x1b[94m';
        const noPrintValue = this.getEnv("NO_PRINT");
        const show = !(noPrintValue && noPrintValue.toLowerCase() === "true");
        args.forEach(msg => {
            if (show) {
                this._printFormatted(blueColor, msg);
            } else {
                this.easyLog(msg, "info");
            }
        });
    }

    infoLog(msg, logname) {
        const blueColor = '\x1b[94m';
        const show = this.shouldPrint();
        if (show) {
            this._printFormatted(blueColor, msg);
        } else {
            this.easyLog(msg, "info", logname);
        }
    }

    successLog(msg, logname) {
        const greenColor = '\x1b[32m';
        const show = this.shouldPrint();
        if (show) {
            this._printFormatted(greenColor, msg);
        } else {
            this.easyLog(msg, "success", logname);
        }
    }

    warnLog(msg, logname) {
        const yellowColor = '\x1b[33m';
        const show = this.shouldPrint();
        if (show) {
            this._printFormatted(yellowColor, msg);
        } else {
            this.easyLog(msg, "warn", logname);
        }
    }

    errorLog(msg, logname) {
        const redColor = '\x1b[31m';
        const show = this.shouldPrint();
        if (show) {
            this._printFormatted(redColor, msg);
        } else {
            this.easyLog(msg, "error", logname);
        }
    }

    shouldPrint() {
        const noPrintValue = this.getEnv("NO_PRINT");
        return !(noPrintValue && noPrintValue.toLowerCase() === "true");
    }

    _printFormatted(colorCode, msg) {
        const endColor = '\x1b[0m';
        if (msg instanceof Object) {
            console.log(JSON.stringify(msg, null, 2));
        } else {
            console.log(`${colorCode}${msg}${endColor}`);
        }
    }
}

Base.toString = () => '[class Base]';
module.exports = Base;
