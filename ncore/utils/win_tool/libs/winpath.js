const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('#@logger');
const { execCmd,execPowerShell } = require("#@commander");

class WinPath {
    constructor() {
        this.regType = os.platform() === 'win32' ? 'REG_SZ' : ''; // Windows registry type
        this.supportedCommands = ['add', 'remove', 'is', 'show'];
        this.regCommandPath = os.platform() === 'win32' ? 'C:\\Windows\\System32\\reg.exe' : null; // Absolute path to reg

        // Default system paths to include in PATH
        const systemRoot = process.env.SystemRoot;
        this.defaultPaths = [
            path.join(systemRoot, 'system32'),
            systemRoot,
            path.join(systemRoot, 'System32', 'Wbem'),
            path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0'),
            path.join(systemRoot, 'System32', 'OpenSSH')
        ];

        // Ensure default paths exist in the PATH
    }

    ensureDefaultPathsExist() {
        const currentPath = this.getCurrentPath();
        const missingPaths = this.defaultPaths.filter(defaultPath => !currentPath.includes(defaultPath));
        if (missingPaths.length > 0) {
            logger.info('Adding missing default paths to PATH:', missingPaths);
            this.updatePathRegistry([...missingPaths, ...currentPath]);
            this.refreshEnvironmentVariable();
        } else {
            logger.success('All default paths are already present in PATH.');
        }
    }

    queryEnvironmentVariable() {
        if (os.platform() !== 'win32') {
            logger.error('This function is designed for Windows only.');
            return null;
        }
        const command = `${this.regCommandPath} query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path`;
        const result = execCmd(command);
        if (!result) {
            console.log(`result`, result)
            return { PathType: ``, CurrentPath: '' };
        }
        const match = result.match(/\s{1,}Path\s{1,}(.+)/);
        if (match && match[1]) {
            const pathFullValue = match[1].trim();
            const [PathType, ...rest] = pathFullValue.split(/\s+/);
            const CurrentPath = rest.join(' ');
            return { PathType, CurrentPath: CurrentPath || '' };
        } else {
            logger.error('Failed to parse Path variable from registry output.');
            return { PathType: this.regType, CurrentPath: '' };
        }
    }

    getCurrentPath() {
        const { CurrentPath } = this.queryEnvironmentVariable();
        return CurrentPath.split(';').map(p => p.trim()).filter(Boolean);
    }

    getPathType() {
        const { PathType } = this.queryEnvironmentVariable();
        return PathType || 'REG_SZ';
    }

    backupEnvPath(currentPath) {
        const backupDir = path.join(os.tmpdir(), '$SetPath_bak_');
        fs.mkdirSync(backupDir, { recursive: true });

        const backupFiles = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('$SetPath_bak_') && f.endsWith('.bak'))
            .sort((a, b) => fs.statSync(path.join(backupDir, b)).mtimeMs - fs.statSync(path.join(backupDir, a)).mtimeMs);

        if (backupFiles.length > 30) {
            backupFiles.slice(0, backupFiles.length - 30).forEach(file => {
                fs.unlinkSync(path.join(backupDir, file));
            });
        }

        const currentTime = new Date().toISOString().replace(/:/g, '');
        const backupFilePath = path.join(backupDir, `$SetPath_bak_${currentTime}.bak`);
        fs.writeFileSync(backupFilePath, currentPath.join(';'));

        logger.success(`Backup file saved to: ${backupFilePath}`);
        if (backupFiles.length > 30) {
            logger.info(`Cleaned up ${backupFiles.length - 30} outdated backup files.`);
        }
    }

    addPath(newPath) {
        if (fs.existsSync(newPath) && fs.statSync(newPath).isFile()) {
            newPath = path.dirname(newPath);
        }
        newPath = path.resolve(newPath);
        const currentPath = this.getCurrentPath();
        if (!currentPath.includes(newPath)) {
            const updatedPath = [...currentPath, newPath];
            this.backupEnvPath(updatedPath);
            this.updatePathRegistry(updatedPath);
            this.refreshEnvironmentVariable();
            logger.success(`The path '${newPath}' has been added to the environment.`);
        } else {
            logger.error(`The path '${newPath}' already exists in the environment.`);
        }
    }

    updatePathRegistry(updatedPath) {
        this.defaultPaths.forEach((defaultPath) => {
            if (!updatedPath.includes(defaultPath)) {
                updatedPath.unshift(defaultPath);
            }
        });

        const regType = this.getPathType();
        const addPath = updatedPath.join(';');
        const command = `${this.regCommandPath} add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path /t ${regType} /d "${addPath}" /f`;
        execCmd(command);
        logger.success('Path updated successfully.');
    }

    removePath(pathToRemove) {
        if (fs.existsSync(pathToRemove) && fs.statSync(pathToRemove).isFile()) {
            pathToRemove = path.dirname(pathToRemove);
        }
        pathToRemove = path.resolve(pathToRemove);
        const currentPath = this.getCurrentPath();
        if (currentPath.includes(pathToRemove)) {
            const updatedPath = currentPath.filter(p => p !== pathToRemove);
            this.backupEnvPath(updatedPath);
            this.updatePathRegistry(updatedPath);
            this.refreshEnvironmentVariable();
            logger.success(`The path '${pathToRemove}' has been removed from the environment.`);
        } else {
            logger.error(`The path '${pathToRemove}' does not exist in the environment.`);
        }
    }

    isPath(pathToCheck) {
        if (fs.existsSync(pathToCheck) && fs.statSync(pathToCheck).isFile()) {
            pathToCheck = path.dirname(pathToCheck);
        }
        pathToCheck = path.resolve(pathToCheck);
        const exists = this.getCurrentPath().includes(pathToCheck);
        logger.info(`Path '${pathToCheck}' exists: ${exists}`);
        return exists;
    }

    refreshEnvironmentVariable() {
        const refreshCommand = `$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')`;
        execPowerShell(refreshCommand, true);
        logger.success('Environment variable PATH refreshed.');
    }

    executeCommand(command, arg) {
        if (!this.supportedCommands.includes(command)) {
            logger.error(`Unsupported command. Supported commands are: ${this.supportedCommands.join(', ')}`);
            return;
        }
        switch (command) {
            case 'add':
                this.addPath(arg);
                break;
            case 'remove':
                this.removePath(arg);
                break;
            case 'is':
                this.isPath(arg);
                break;
            case 'show':
                logger.info('Current PATH:', this.getCurrentPath());
                break;
            default:
                logger.error('Invalid command usage.');
        }
    }

    start() {
        this.ensureDefaultPathsExist();
    }
}

let instance = {};
if (os.platform() === 'win32') {
    instance = new WinPath();
}
module.exports = instance;

// Direct execution logic
const normalizeFilePath = (filepath) => filepath.replace(/\\/g, '/');

if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const targetPath = args[1];

    if (!command) {
        logger.error('Please provide a command: add/remove/is/show');
        process.exit(1);
    }

    if (['add', 'remove', 'is'].includes(command) && !targetPath) {
        logger.error(`The ${command} command requires a path argument`);
        process.exit(1);
    }

    if (os.platform() !== 'win32') {
        logger.error('This script can only run on Windows');
        process.exit(1);
    }

    try {
        instance.executeCommand(command, targetPath);
    } catch (error) {
        logger.error('Error executing command:', error.message);
        process.exit(1);
    }
}
