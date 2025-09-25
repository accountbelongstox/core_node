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

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execCmd } = require('#@commander');
const logger = require('#@logger');
const gconfig = require('#@gconfig');
const { Command } = require('commander');
gconfig.CURRENT_USER

class FilePrivilegeHandler {
    static hasWritePermission(filePath) {
        try {
            fs.accessSync(filePath, fs.constants.W_OK);
            return true;
        } catch {
            return false;
        }
    }

    static writeWithPrivileges(filePath, content) {
        try {
            if (this.hasWritePermission(filePath)) {
                fs.writeFileSync(filePath, content);
            } else {
                const tempFile = path.join(os.tmpdir(), 'env-update-' + Date.now());
                fs.writeFileSync(tempFile, content);
                execCmd(`sudo cp "${tempFile}" "${filePath}"`);
                fs.unlinkSync(tempFile);
            }
            return true;
        } catch (error) {
            logger.error(`Failed to write to ${filePath}:`, error);
            return false;
        }
    }

    static readWithPrivileges(filePath) {
        try {
            if (this.hasWritePermission(filePath)) {
                return fs.readFileSync(filePath, 'utf8');
            } else {
                return execCmd(`sudo cat "${filePath}"`);
            }
        } catch (error) {
            logger.error(`Failed to read ${filePath}:`, error);
            return '';
        }
    }

    static isExecutable(filePath) {
        try {
            fs.accessSync(filePath, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }
}

class LinuxPathManager {
    constructor() {
        this.homeDir = os.homedir();
        this.localBinPath = '/usr/local/bin';
        this.profileFiles = {
            bashrc: '/etc/bash.bashrc',
            bashProfile: '/etc/profile',
            zprofile: '/etc/zsh/zprofile'
        };
        this.shellRcFiles = {
            bash: path.join(this.homeDir, '.bashrc'),
            zsh: path.join(this.homeDir, '.zshrc')
        };
    }

    addPath(targetPath) {
        try {
            const absolutePath = path.resolve(targetPath);
            if (!fs.existsSync(absolutePath)) {
                logger.error(`File does not exist: ${absolutePath}`);
                return false;
            }
            return this.createBinaryLink(absolutePath);
        } catch (error) {
            logger.error('Error processing binary file:', error);
            return false;
        }
    }

    addPaths(targetPaths) {
        if (!Array.isArray(targetPaths) || targetPaths.length === 0) {
            logger.error('Invalid input: targetPaths must be a non-empty array.');
            return [];
        }
        return targetPaths.map((targetPath) => this.addPath(targetPath));
    }

    createBinaryLink(binPath) {
        try {
            if (!FilePrivilegeHandler.isExecutable(binPath)) {
                logger.info(`Making ${binPath} executable...`);
                execCmd(`chmod 755 "${binPath}"`);
            }

            const binName = path.basename(binPath);
            const linkPath = path.join(this.localBinPath, binName);

            if (fs.existsSync(linkPath)) {
                try {
                    const realPath = fs.readlinkSync(linkPath);
                    if (realPath === binPath) {
                        logger.info(`Link already exists and is valid: ${linkPath}`);
                        return true;
                    }
                    execCmd(`rm "${linkPath}"`);
                    logger.warn(`Removed invalid link: ${linkPath}`);
                } catch (error) {
                    execCmd(`rm "${linkPath}"`);
                    logger.warn(`Removed existing file: ${linkPath}`);
                }
            }

            execCmd(`ln -s "${binPath}" "${linkPath}"`);
            logger.success(`Created symlink: ${linkPath} -> ${binPath}`);

            if (this.verifyBinaryLink(binName)) {
                logger.success(`Successfully verified binary link: ${binName}`);
                return true;
            } else {
                execCmd(`rm "${linkPath}"`);
                logger.error(`Binary link verification failed: ${binName}`);
                return false;
            }
        } catch (error) {
            logger.error('Error creating binary link:', error);
            return false;
        }
    }

    verifyBinaryLink(binName) {
        try {
            const linkPath = path.join(this.localBinPath, binName);
            return fs.existsSync(linkPath) && FilePrivilegeHandler.isExecutable(linkPath);
        } catch {
            return false;
        }
    }

    removePath(targetPath) {
        try {
            const absolutePath = path.resolve(targetPath);
            if (fs.existsSync(absolutePath)) {
                return this.removeBinaryLink(absolutePath);
            } else {
                logger.error(`Path does not exist: ${absolutePath}`);
                return false;
            }
        } catch (error) {
            logger.error('Error removing path:', error);
            return false;
        }
    }

    checkExistingFiles() {
        const existing = {};
        for (const [key, filePath] of Object.entries(this.profileFiles)) {
            existing[key] = fs.existsSync(filePath);
        }
        return existing;
    }

    setEnvironmentVariable(name, value) {
        if (!name || typeof value === 'undefined') {
            logger.error('Name and value are required');
            return false;
        }

        const existingFiles = this.checkExistingFiles();
        const availableFiles = Object.entries(existingFiles)
            .filter(([_, exists]) => exists)
            .map(([key]) => this.profileFiles[key]);

        if (availableFiles.length === 0) {
            logger.error('No shell profile files found');
            return false;
        }

        try {
            process.env[name] = value;
            const targetFile = availableFiles[0];
            const content = FilePrivilegeHandler.readWithPrivileges(targetFile);
            const envLine = `export ${name}="${value}"`;
            
            const lines = content.split('\n');
            const newLines = lines.filter(line => !line.startsWith(`export ${name}=`));
            newLines.push(envLine);

            const success = FilePrivilegeHandler.writeWithPrivileges(targetFile, newLines.join('\n'));
            if (!success) {
                logger.error(`Failed to write to ${targetFile}`);
                return false;
            }
            
            execCmd(`sudo -s source "${targetFile}"`);
            const verifyCmd = execCmd(`echo $${name}`);
            const isSet = verifyCmd.trim() === value;
            
            if (isSet) {
                logger.success(`Environment variable ${name} set successfully in ${targetFile}`);
                return true;
            } else {
                logger.error(`Failed to verify environment variable ${name}`);
                return false;
            }
        } catch (error) {
            logger.error('Error setting environment variable:', error);
            return false;
        }
    }
}

module.exports = new LinuxPathManager();

// CLI Implementation
const program = new Command();

program
  .name('envlink')
  .version('1.0.0')
  .description('Linux environment path management tool');

program.command('add-path')
  .description('Add a single binary to system path')
  .argument('<path>', 'Path to the binary file')
  .action((targetPath) => {
    const success = LinuxPathManager.addPath(targetPath);
    process.exit(success ? 0 : 1);
  });

program.command('add-paths')
  .description('Add multiple binaries to system path')
  .argument('<paths...>', 'Space-separated list of paths')
  .action((paths) => {
    const results = LinuxPathManager.addPaths(paths);
    process.exit(results.every(r => r) ? 0 : 1);
  });

program.command('remove-path')
  .description('Remove a binary link from system path')
  .argument('<path>', 'Path to remove')
  .action((targetPath) => {
    const success = LinuxPathManager.removePath(targetPath);
    process.exit(success ? 0 : 1);
  });

program.command('set-env')
  .description('Set a system-wide environment variable')
  .requiredOption('-n, --name <name>', 'Variable name')
  .requiredOption('-v, --value <value>', 'Variable value')
  .action((options) => {
    const success = LinuxPathManager.setEnvironmentVariable(options.name, options.value);
    process.exit(success ? 0 : 1);
  });

program.command('verify-link')
  .description('Verify a binary link exists and is valid')
  .argument('<name>', 'Binary name to verify')
  .action((binName) => {
    const isValid = LinuxPathManager.verifyBinaryLink(binName);
    logger.info(isValid ? 'Valid link' : 'Invalid or missing link');
    process.exit(isValid ? 0 : 1);
  });

if (require.main === module) {
  program.parseAsync(process.argv).catch((err) => {
    logger.error('Command failed:', err);
    process.exit(1);
  });
}
