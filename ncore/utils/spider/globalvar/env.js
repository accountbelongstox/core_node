const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);


class Env {

    mainEnvFile = null;
    annotationSymbol = "#";
    constructor(rootDir = null, envName = ".env", delimiter = "=") {
        if(!rootDir)rootDir = this.getCwd();
        this.setRootDir(rootDir, envName, delimiter);
    }
    getCwd() {
        return process.cwd();
    }
    setDelimiter(delimiter = "=") {
        this.delimiter = delimiter;
    }
    async exampleTo(examplePath) {
        const envFile = examplePath.replace("-example", "").replace("_example", "").replace(".example", "");
        await this.mergeEnv(envFile, examplePath);
    }
    async setRootDir(rootDir, envName = ".env", delimiter = "=") {
        this.setDelimiter(delimiter);
        this.rootDir = rootDir;
        this.localEnvFile = path.join(this.rootDir, envName);
        this.exampleEnvFile = path.join(this.rootDir, `${envName}_example`);
        if (!fs.existsSync(this.exampleEnvFile)) {
            this.exampleEnvFile = path.join(this.rootDir, `${envName}-example`);
        }
        if (!fs.existsSync(this.exampleEnvFile)) {
            this.exampleEnvFile = path.join(this.rootDir, `${envName}.example`);
        }
        await this.getLocalEnvFile();
    }
    async load(rootDir, envName = ".env", delimiter = "=") {
        return new Env(rootDir, envName, delimiter);
    }
    async getLocalEnvFile() {
        if (!fs.existsSync(this.localEnvFile)) {
            fs.writeFileSync(this.localEnvFile, "");
        }
        await this.mergeEnv(this.localEnvFile, this.exampleEnvFile);
        return this.localEnvFile;
    }
    getEnvFile() {
        return this.localEnvFile;
    }
    arrToDict(array) {
        const result = {};
        for (const item of array) {
            if (Array.isArray(item) && item.length > 1) {
                const [key, val] = item;
                result[key] = val;
            }
        }
        return result;
    }
    dictToArr(dictionary) {
        const result = [];
        for (const [key, value] of Object.entries(dictionary)) {
            result.push([key, value]);
        }
        return result;
    }
    async mergeEnv(envFile, exampleEnvFile) {
        if (!fs.existsSync(exampleEnvFile)) {
            return;
        }
        const exampleArr = this.readEnv(exampleEnvFile);
        const localArr = this.readEnv(envFile);
        const addedKeys = [];
        const exampleDict = this.arrToDict(exampleArr);
        const localDict = this.arrToDict(localArr);
        for (const [key, value] of Object.entries(exampleDict)) {
            if (!(key in localDict)) {
                localDict[key] = value;
                addedKeys.push(key);
            }
        }
        if (addedKeys.length > 0) {
            console.log(`Env-Update env: ${envFile}`);
            const updatedArr = this.dictToArr(localDict);
            await this.saveEnv(updatedArr, envFile);
        }
        for (const addedKey of addedKeys) {
            console.log(`Env-Added key: ${addedKey}`);
        }
    }
    readKey(key) {
        const content = fs.readFileSync(this.mainEnvFile, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
            const [k, v] = line.split(this.delimiter);
            if (k.trim() === key) {
                return v.trim();
            }
        }
        return null;
    }
    replaceOrAddKey(key, val) {
        let updated = false;
        const lines = [];
        const content = fs.readFileSync(this.mainEnvFile, 'utf8');
        const fileLines = content.split('\n');
        for (const line of fileLines) {
            const [k, v] = line.split(this.delimiter);
            if (k.trim() === key) {
                lines.push(`${key}${this.delimiter}${val}`);
                updated = true;
            } else {
                lines.push(line);
            }
        }
        if (!updated) {
            lines.push(`${key}${this.delimiter}${val}`);
        }
        const updatedContent = lines.join('\n');
        fs.writeFileSync(this.mainEnvFile, updatedContent);
    }
    readEnv(filePath = null) {
        if (filePath === null) {
            filePath = this.localEnvFile;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const result = lines.map(line => line.split(this.delimiter).map(value => value.trim()));
        return result;
    }
    getEnvs(filePath = null) {
        return this.readEnv(filePath);
    }
    async saveEnv(envArr, filePath = null) {
        if (filePath === null) {
            filePath = this.localEnvFile;
        }
        const filteredEnvArr = envArr.filter(subArr => subArr.length === 2);
        const formattedLines = filteredEnvArr.map(subArr => `${subArr[0]}${this.delimiter}${subArr[1]}`);
        const resultString = formattedLines.join('\n');
        await this.saveFile(filePath, resultString, true);
    }
    async setEnv(key, value, filePath = null) {
        if (filePath === null) {
            filePath = this.localEnvFile;
        }
        const envArr = this.readEnv(filePath);
        let keyExists = false;
        for (const subArr of envArr) {
            if (subArr[0] === key) {
                subArr[1] = value;
                keyExists = true;
                break;
            }
        }
        if (!keyExists) {
            envArr.push([key, value]);
        }
        await this.saveEnv(envArr, filePath);
    }
    isEnv(key, filePath = null) {
        const isArg = process.argv.includes("is_env");
        const val = this.getEnv(key, filePath);
        if (val === "") {
            if (isArg) {
                console.log("False");
            }
            return false;
        }
        if (isArg) {
            console.log("True");
        }
        return true;
    }
    getEnv(key,defaultValue="", filePath = null) {
        if (filePath === null) {
            filePath = this.localEnvFile;
        }
        const envArr = this.readEnv(filePath);
        for (const subArr of envArr) {
            if (subArr[0] === key) {
                return subArr[1];
            }
        }
        return defaultValue;
    }
    async saveFile(filePath, content, overwrite) {
        if (!fs.existsSync(filePath) || overwrite) {
            await writeFileAsync(filePath, content);
        }
    }
}
Env.toString = () => '[class Env]';
module.exports = new Env();