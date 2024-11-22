import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class AutoInstall {
    constructor() {
        this.nodePath = process.execPath;
        this.checkedDirectories = new Set();
        this.printNodePathInfo();
    }

    printNodePathInfo() {
        const nodeDir = path.dirname(this.nodePath);
        const nodeBase = path.basename(this.nodePath);
        console.log('Node.js Path Information:');
        console.log('-------------------------');
        console.log(`Full Path: ${this.nodePath}`);
        console.log(`Directory: ${nodeDir}`);
        console.log(`Filename : ${nodeBase}`);
        console.log('-------------------------');
    }

    // Check if a directory contains the package manager
    findPackageManagerInDirectory(directory, managerName) {
        const managerPath = path.join(directory, managerName);
        const managerCmdPath = path.join(directory, `${managerName}.cmd`); // Windows

        if (this.isExecutable(managerPath) || this.isExecutable(managerCmdPath)) {
            return managerPath;
        }

        return null;
    }

    // Check if the file is executable and valid
    isExecutable(filePath) {
        if (fs.existsSync(filePath)) {
            const stats = fs.lstatSync(filePath);

            // Check if it's a symlink or a regular file
            if (stats.isSymbolicLink()) {
                const realPath = fs.realpathSync(filePath);
                if (fs.existsSync(realPath) && fs.lstatSync(realPath).isFile()) {
                    console.log(`Found valid symlink: ${filePath} -> ${realPath}`);
                    return true;
                } else {
                    console.log(`Invalid symlink: ${filePath} -> ${realPath}`);
                    return false;
                }
            } else if (stats.isFile()) {
                console.log(`Found executable: ${filePath}`);
                return true;
            }
        }
        return false;
    }

    // Recursively search for a package manager (npm or yarn)
    findPackageManagerRecursively(directory, managerName) {
        if (this.checkedDirectories.has(directory)) {
            return null;
        }

        this.checkedDirectories.add(directory);

        const managerPath = this.findPackageManagerInDirectory(directory, managerName);
        if (managerPath) {
            return managerPath;
        }

        const subdirectories = this.getSubdirectories(directory);

        for (const subdirectory of subdirectories) {
            const foundPath = this.findPackageManagerRecursively(subdirectory, managerName);
            if (foundPath) {
                return foundPath;
            }
        }

        return null;
    }

    // Start searching for npm
    findNpm() {
        const startDirectory = path.dirname(this.nodePath);
        return this.findPackageManagerRecursively(startDirectory, 'npm');
    }

    // Start searching for yarn
    findYarn() {
        const startDirectory = path.dirname(this.nodePath);
        return this.findPackageManagerRecursively(startDirectory, 'yarn');
    }

    // Ensure node_modules is empty or deleted, then install yarn
    ensureNodeModulesAndInstallYarn(projectPath) {
        console.log(`Starting installation process for project at: ${projectPath}`);

        const nodeModulesPath = path.join(projectPath, 'node_modules');
        const binPath = path.join(nodeModulesPath, '.bin');

        if (!fs.existsSync(nodeModulesPath) || this.isDirectoryEmpty(nodeModulesPath) || !fs.existsSync(binPath) || this.isDirectoryEmpty(binPath)) {
            console.log(`node_modules is empty or missing in ${projectPath}. Deleting...`);

            this.forceDeleteDirectory(nodeModulesPath);
            console.log(`node_modules has been deleted in ${projectPath}.`);

            let yarnPath = this.findYarn();
            if (!yarnPath) {
                console.log('Yarn not found. Looking for npm...');
                const npmPath = this.findNpm();
                if (!npmPath) {
                    throw new Error('npm not found');
                }

                console.log('Installing Yarn globally using npm...');
                execSync(`${npmPath} install -g yarn`, { stdio: 'inherit' });
                yarnPath = this.findYarn();
            }

            if (!yarnPath) {
                throw new Error('Yarn installation failed');
            }

            console.log(`Installing dependencies for project at ${projectPath} using Yarn...`);
            execSync(`${yarnPath} install`, { cwd: projectPath, stdio: 'inherit' });
            console.log(`Dependencies installed successfully for project at ${projectPath}.`);
        } else {
            console.log(`node_modules is not empty in ${projectPath}. Skipping deletion.`);
        }
    }

    // Check if a directory is empty
    isDirectoryEmpty(directoryPath) {
        return fs.readdirSync(directoryPath).length === 0;
    }

    // Force delete a directory
    forceDeleteDirectory(directoryPath) {
        if (fs.existsSync(directoryPath)) {
            fs.rmSync(directoryPath, { recursive: true, force: true });
        }
    }

    // Method One: Recursively scan the current directory and all subdirectories
    scanAllSubdirectories(directory) {
        const subdirectories = this.getSubdirectories(directory);

        for (const subdirectory of subdirectories) {
            if (!this.checkedDirectories.has(subdirectory)) {
                this.checkedDirectories.add(subdirectory);
                console.log(`Scanning directory: ${subdirectory}`);
                this.scanAllSubdirectories(subdirectory); // Recurse into subdirectory
            }
        }
    }

    // Method Two: Start scanning from the process directory upwards
    scanAndFindManagerFromExecPath(managerName) {
        let directory = path.dirname(this.nodePath);
        let managerPath = null;

        while (directory !== path.dirname(directory)) { // Continue until the root directory is reached
            this.scanAllSubdirectories(directory);
            managerPath = this.findPackageManagerRecursively(directory, managerName);
            if (managerPath) {
                break;
            }
            directory = path.resolve(directory, '..');
        }

        return managerPath;
    }

    // Utility to safely get subdirectories (handles errors silently)
    getSubdirectories(directory) {
        try {
            return fs.readdirSync(directory)
                .map(subdir => path.join(directory, subdir))
                .filter(subdir => {
                    try {
                        return fs.lstatSync(subdir).isDirectory();
                    } catch (err) {
                        // Silent error handling for permission issues or other errors
                        return false;
                    }
                });
        } catch (err) {
            // Silent error handling for permission issues or other errors
            return [];
        }
    }

    // Start the process
    start(projectPath) {
        console.log(`Starting the AutoInstall process for project at: ${projectPath}`);
        // Then ensure node_modules is handled and Yarn is installed
        this.ensureNodeModulesAndInstallYarn(projectPath);
        console.log(`AutoInstall process completed for project at: ${projectPath}`);
    }
}

const autoInstall = new AutoInstall();
export default autoInstall;
