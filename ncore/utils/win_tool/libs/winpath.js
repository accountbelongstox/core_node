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

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
}

const checkSilent = () => {
    const argname = '--silent'
    const args = process.argv.slice(2)
    return args.includes(argname)
}
const isSilent = checkSilent()
const logger = {
    log: (message) => {
        if (!isSilent) {
            console.log(colors.white + message + colors.reset);
        }
    },
    success: (message) => {
        if (!isSilent) {
            console.log(colors.green + message + colors.reset);
        }
    },
    error: (message) => {
        if (!isSilent) {
            console.error(colors.red + message + colors.reset);
        }
    },
    warn: (message) => {
        if (!isSilent) {
            console.warn(colors.yellow + message + colors.reset);
        }
    },
    info: (message) => {
        if (!isSilent) {
            console.info(colors.cyan + message + colors.reset);
        }
    },
    debug: (message) => {
        if (!isSilent) {
            console.debug(colors.blue + message + colors.reset);
        }
    }
}

class PathManager {
    regType = null
    constructor() {
        this.currentPath = this.getCurrentPath();
    }

    findRegTypeStartingWithREG(registryString) {
        if(this.regType)return this.regType;
        const parts = registryString.split('    '); // Split by multiple spaces
        for (const part of parts) {
            const trimmedPart = part.trim();
            if (trimmedPart.startsWith('REG_')) {
                this.regType = trimmedPart;
                return this.regType;
            }
        }
        this.regType = "REG_SZ";
        return this.regType;
    }

    hasSuffix(filePath) {
        const ext = path.extname(filePath);
        if (ext) {
            return true;
        } else {
            return false;
        }
    }

    isFile(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.isFile();
        } catch (error) {
            return false;
        }
    }

    ifFileGetBaseDir(filePath) {
        if (this.isFile(filePath)) {
            let baseDir = path.dirname(filePath);
            baseDir = baseDir.replace(/\/$/, '');
            baseDir = baseDir.replace(/\\$/, '');
            return baseDir;
        } else {
            return filePath;
        }
    }

    getBackupTmpDir() {
        let tmpDir;
        if (os.platform() === 'win32') {
            tmpDir = 'D:\\.tmp';
        } else {
            tmpDir = '/tmp';
        }

        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        return tmpDir;
    }

    getBackupTmpFile() {
        const environmentDir = this.getBackupTmpDir();
        const timestamp = this.getTimestamp();
        const environmentFile = path.join(environmentDir, `path_${timestamp}.bak`);
        return environmentFile;
    }

    backupEnvPath(currentPath) {
        const backupTmpFile = this.getBackupTmpFile();
        const currentPathString = this.getCurrentPathString(currentPath);
        fs.writeFileSync(backupTmpFile, currentPathString);
    }

    getAction() {
        if (process.argv.length > 1) {
            return process.argv[2];
        } else {
            return null;
        }
    }

    getPathString() {
        if (process.argv.length > 2) {
            return process.argv[3];
        } else {
            return null;
        }
    }

    getTimestamp() {
        const now = new Date();
        const year = now.getFullYear().toString().padStart(4, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hour = now.getHours().toString().padStart(2, '0');
        const minute = now.getMinutes().toString().padStart(2, '0');
        const second = now.getSeconds().toString().padStart(2, '0');
        return `${year}${month}${day}_${hour}${minute}${second}`;
    }

    getCurrentPath() {
        const result = execSync('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path').toString();
        const regType = this.findRegTypeStartingWithREG(result)
        const PathsMatch = result.split(new RegExp(`${regType}\\s+`))
        const Paths = PathsMatch[1].trim()
        const cleanedPaths = Paths.split(/;+/).filter(path => path.trim() !== '').map(path => path.trim());
        const formattedPaths = cleanedPaths.map(p => this.normalizeWinPath(p));
        return formattedPaths;
    }

    getCurrentPathString(currentPath) {
        if (!currentPath) currentPath = this.getCurrentPath()
        const formattedPaths = currentPath.join(`;`)
        return formattedPaths;
    }

    normalizeWinPath(p) {
        return path.win32.normalize(p)
    }

    createEnvironmentDir() {
        if (!fs.existsSync(this.environmentDir)) {
            logger.log('Creating environment directory...');
            fs.mkdirSync(this.environmentDir);
            logger.log('Environment directory created successfully.');
        }
    }

    backupCurrentPath() {
        fs.appendFileSync(this.environmentFile, `${this.currentPath}\r\n`);
    }

    addPath(newPath) {
        const currentPath = this.getCurrentPath()
        newPath = this.normalizeWinPath(newPath)
        newPath = this.ifFileGetBaseDir(newPath)
        if (!this.isPathIncluded(newPath)) {
            currentPath.push(newPath)
            const addPath = this.getCurrentPathString(currentPath)
            this.backupEnvPath(currentPath)
            if (addPath) {
                logger.info(`Adding ${addPath} to the Path...`);
                execSync(`reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path /t ${this.regType} /d "${addPath}" /f`);
                logger.success('Path updated successfully.');
            }
        } else {
            logger.warn(`The ${newPath} already exists in the environment.`);
        }
    }

    showPath() {
        logger.log(this.getCurrentPath());
    }

    removePath(pathToRemove) {
        const currentPath = this.getCurrentPath();
        pathToRemove = this.normalizeWinPath(pathToRemove);
        if (this.isPathIncluded(pathToRemove)) {
            const updatedPath = currentPath.filter(p => p !== pathToRemove);
            const updatedPathString = this.getCurrentPathString(updatedPath);
            this.backupEnvPath(updatedPath);
            if (updatedPathString) {
                logger.info(`Removing ${pathToRemove} from the Path...`);
                execSync(`reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path /t ${this.regType} /d "${updatedPathString}" /f`);
                logger.success('Path updated successfully.');
            }
        } else {
            logger.warn(`The ${pathToRemove} does not exist in the environment.`);
        }
    }

    isPathIncluded(pathToCheck) {
        const currentPath = this.getCurrentPath()
        pathToCheck = this.normalizeWinPath(pathToCheck)
        if (currentPath.includes(pathToCheck)) {
            return true
        } else {
            return false
        }
    }

    getEnvVar(varName) {
        try {
            const result = execSync(`reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v ${varName}`).toString();
            const regType = this.findRegTypeStartingWithREG(result);
            const valueMatch = result.split(new RegExp(`${regType}\\s+`));
            if (valueMatch.length > 1) {
                return valueMatch[1].trim();
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    setEnvVar(varName, varValue) {
        try {
            const currentValue = this.getEnvVar(varName);
            if (currentValue !== null) {
                logger.info(`Updating ${varName} environment variable...`);
            } else {
                logger.info(`Adding ${varName} environment variable...`);
            }
            execSync(`reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v ${varName} /t REG_SZ /d "${varValue}" /f`);
            logger.success(`${varName} environment variable updated successfully.`);
            return true;
        } catch (error) {
            logger.error(`Failed to set ${varName} environment variable: ${error.message}`);
            return false;
        }
    }

    removeEnvVar(varName) {
        try {
            if (this.getEnvVar(varName) !== null) {
                logger.info(`Removing ${varName} environment variable...`);
                execSync(`reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v ${varName} /f`);
                logger.success(`${varName} environment variable removed successfully.`);
                return true;
            } else {
                logger.warn(`${varName} environment variable does not exist.`);
                return false;
            }
        } catch (error) {
            logger.error(`Failed to remove ${varName} environment variable: ${error.message}`);
            return false;
        }
    }

    hasEnvVar(varName) {
        return this.getEnvVar(varName) !== null;
    }

    start() {
        const action = this.getAction();
        const newPath = this.getPathString();
        const varName = process.argv[3];
        const varValue = process.argv[4];

        if (action === null) {
            logger.warn('No action provided. Please specify an action (add, remove, is, get, setvar, or removevar).');
            return;
        }

        if (action === 'get') {
            if (varName) {
                const value = this.getEnvVar(varName);
                if (value !== null) {
                    logger.log(`${varName}=${value}`);
                } else {
                    logger.warn(`${varName} environment variable does not exist.`);
                }
            } else {
                logger.warn('No variable name provided for get action.');
            }
            return;
        }

        if (action === 'setvar') {
            if (varName && varValue) {
                this.setEnvVar(varName, varValue);
            } else {
                logger.warn('Variable name and value are required for setvar action.');
            }
            return;
        }

        if (action === 'removevar') {
            if (varName) {
                this.removeEnvVar(varName);
            } else {
                logger.warn('Variable name is required for removevar action.');
            }
            return;
        }

        if (newPath === null && action !== 'is') {
            logger.warn('No path provided. Please specify a path to add or remove.');
            return;
        }

        switch (action) {
            case 'add':
                this.addPath(newPath);
                break;
            case 'show':
                this.showPath();
                break;
            case 'remove':
                this.removePath(newPath);
                break;
            case 'is':
                logger.log(this.isPathIncluded(newPath))
                break;
            default:
                logger.warn(` add / remove / is / show`);
        }
    }
}

const pathManager = new PathManager();
function addPath(newPath) {
    pathManager.addPath(newPath);
}

function removePath(pathToRemove) {
    pathManager.removePath(pathToRemove);
}

function isPathIncluded(pathToCheck) {
    return pathManager.isPathIncluded(pathToCheck);
}

function showPath() {
    pathManager.showPath();
}

if (require.main === module) {
    pathManager.start();
}

module.exports = {
    addPath,
    removePath,
    isPathIncluded,
    showPath
};