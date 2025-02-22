const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

class PathManager {
    regType=`REG_SZ`
    constructor() {
        this.currentPath = this.getCurrentPath();
    }

    getBackupTmpDir() {
        let tmpDir;
        if (os.platform() === 'win32') {
            tmpDir = 'D:\\lang_compiler\\tmp';
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
        const PathsMatch = result.split(new RegExp(`${this.regType}\\s+`))
        const Paths = PathsMatch[1].trim()
        const cleanedPaths = Paths.split(/;+/).filter(path => path.trim() !== '').map(path => path.trim());
        const formattedPaths = cleanedPaths.map(p => this.normalizeWinPath(p));
        return formattedPaths;
    }

    getCurrentPathString(currentPath) {
        if(!currentPath)currentPath = this.getCurrentPath()
        const formattedPaths = currentPath.join(`;`)
        return formattedPaths;
    }

    normalizeWinPath(p){
        return path.win32.normalize(p)
    }

    createEnvironmentDir() {
        if (!fs.existsSync(this.environmentDir)) {
            console.log('Creating environment directory...');
            fs.mkdirSync(this.environmentDir);
            console.log('Environment directory created successfully.');
        }
    }

    backupCurrentPath() {
        fs.appendFileSync(this.environmentFile, `${this.currentPath}\r\n`);
    }
    
    addPath(newPath) {
        const currentPath = this.getCurrentPath()
        newPath = this.normalizeWinPath(newPath)
        if(!this.isPathIncluded(newPath)){
            currentPath.push(newPath)
            const addPath = this.getCurrentPathString(currentPath)
            this.backupEnvPath(currentPath)
            if (addPath) {
                console.log(`Adding ${addPath} to the Path...`);
                execSync(`reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path /t ${this.regType} /d "${addPath}" /f`);
                console.log('Path updated successfully.');
            }
        }else{
            console.log(`The ${newPath} already exists in the environment.`);
        }
    }
    
    showPath() {
        console.log(this.getCurrentPath());
    }
    
    removePath(pathToRemove) {
        const currentPath = this.getCurrentPath();
        pathToRemove = this.normalizeWinPath(pathToRemove);
        if (this.isPathIncluded(pathToRemove)) {
            const updatedPath = currentPath.filter(p => p !== pathToRemove);
            const updatedPathString = this.getCurrentPathString(updatedPath);
            this.backupEnvPath(updatedPath);
            if (updatedPathString) {
                console.log(`Removing ${pathToRemove} from the Path...`);
                execSync(`reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path /t ${this.regType} /d "${updatedPathString}" /f`);
                console.log('Path updated successfully.');
            }
        } else {
            console.log(`The ${pathToRemove} does not exist in the environment.`);
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
    
    start() {
        const action = this.getAction();
        const newPath = this.getPathString();
        
        if (action === null) {
            console.log('No action provided. Please specify an action (add, remove, or is).');
            return;
        }

        if (newPath === null && action !== 'is') {
            console.log('No path provided. Please specify a path to add or remove.');
            return;
        }
        
        switch(action) {
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
                console.log(this.isPathIncluded(newPath))
                break;
            default:
                console.log(` add / remove / is / show`);
        }
    }
}

const pathManager = new PathManager();
pathManager.start();