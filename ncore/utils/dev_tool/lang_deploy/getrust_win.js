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

const os = require('os');
const path = require('path');
const fs = require('fs');
const { execCmd } = require('#@commander');
const { gdir } = require('#@global_vars'); 
const bdir = require('#@/ncore/global_vars/global_dir/globaldir.js');
const gconfig = require('#@gconfig');
const logger = require('#@logger');
const winget = require('#@/ncore/utils/dev_tool/win-libs/winget.js');

class GetRustWin {
    constructor() {
        this.rustupId = "Rustlang.Rust.MSVC";
        this.baseInstallDir = path.join(gconfig.DEV_LANG_DIR);
        this.programDirs = [
            "C:\\Program Files",
            "C:\\Program Files (x86)"
        ];
        this.prepareDirectories();
    }

    prepareDirectories() {
        if (!fs.existsSync(this.baseInstallDir)) {
            fs.mkdirSync(this.baseInstallDir, { recursive: true });
        }
    }

    findExecutable(dir, exeName) {
        const exePath = path.join(dir, exeName);
        if (fs.existsSync(exePath)) {
            return exePath;
        }

        const items = fs.readdirSync(dir);
        for (const item of items) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                const found = this.findExecutable(itemPath, exeName);
                if (found) return found;
            }
        }
        return null;
    }

    findRustupInit(dir) {
        return this.findExecutable(dir, 'rustup-init.exe');
    }

    findRustc(dir) {
        return this.findExecutable(dir, 'rustc.exe');
    }

    isValidRustInstallation(dir) {
        try {
            if (!fs.existsSync(dir)) {
                return false;
            }

            const items = fs.readdirSync(dir);
            if (items.length === 0) {
                return false;
            }
            return true;
        } catch (error) {
            logger.error('Error checking Rust installation validity:', error);
            return false;
        }
    }

    findRustInstallationInDir(baseDir) {
        try {
            logger.info('Searching for Rust installation in:', baseDir);
            
            if (!fs.existsSync(baseDir)) {
                logger.warn('Base directory does not exist:', baseDir);
                return null;
            }

            // 检查 baseDir 本身是否以 rustupId 开头
            const baseDirName = path.basename(baseDir);
            if (baseDirName.startsWith(this.rustupId)) {
                logger.info('Found potential Rust directory:', baseDir);
                // 检查目录是否为空
                if (this.isValidRustInstallation(baseDir)) {
                    logger.success('Valid Rust installation found at base directory');
                    return baseDir;
        } else {
                    logger.warn('Directory is empty or invalid:', baseDir);
                    return null;
                }
            }

            // 扫描子目录
            const items = fs.readdirSync(baseDir);
            for (const item of items) {
                if (item.startsWith(this.rustupId)) {
                    const fullPath = path.join(baseDir, item);
                    logger.info('Found potential Rust subdirectory:', fullPath);
                    
                    if (fs.statSync(fullPath).isDirectory()) {
                        if (this.isValidRustInstallation(fullPath)) {
                            logger.success('Valid Rust installation found in subdirectory');
                            return fullPath;
        } else {
                            logger.warn('Subdirectory is empty or invalid:', fullPath);
                        }
                    }
                }
            }

            logger.warn('No valid Rust installation found in:', baseDir);
            return null;
        } catch (error) {
            logger.error('Error finding Rust installation:', error);
            return null;
        }
    }

    async isRustInstalled() {
        try {
            logger.info('Checking Rust installation...');
            
            // 检查安装目录
            const installDir = this.findRustInstallationInDir(this.baseInstallDir);
            if (!installDir) {
                logger.warn('No Rust installation directory found in:', this.baseInstallDir);
                return false;
            }
            logger.info('Found Rust installation directory:', installDir);

            // 检查 rustc.exe
            const rustcPath = this.findExecutable(installDir, 'rustc.exe');
            if (!rustcPath) {
                logger.warn('rustc.exe not found in installation directory');
                return false;
            }
            logger.info('Found rustc.exe at:', rustcPath);

            // 检查其他关键组件
            const cargoPath = this.findExecutable(installDir, 'cargo.exe');
            if (cargoPath) {
                logger.info('Found cargo.exe at:', cargoPath);
            } else {
                logger.warn('cargo.exe not found');
            }

            const rustupPath = this.findExecutable(installDir, 'rustup.exe');
            if (rustupPath) {
                logger.info('Found rustup.exe at:', rustupPath);
            } else {
                logger.warn('rustup.exe not found');
            }

            // 尝试获取版本信息
            try {
                const rustcVersion = await execCmd(`"${rustcPath}" --version`);
                logger.info('Rust version:', rustcVersion.trim());
                
                if (cargoPath) {
                    const cargoVersion = await execCmd(`"${cargoPath}" --version`);
                    logger.info('Cargo version:', cargoVersion.trim());
                }
                
                if (rustupPath) {
                    const rustupVersion = await execCmd(`"${rustupPath}" --version`);
                    logger.info('Rustup version:', rustupVersion.trim());
                }
            } catch (error) {
                logger.warn('Error getting version information:', error);
            }

            // 检查目录结构
            const dirContents = fs.readdirSync(installDir);
            logger.info('Installation directory contents:', dirContents);

            logger.success('Rust installation check completed successfully');
            return true;

        } catch (error) {
            logger.error('Error checking Rust installation:', error);
            return false;
        }
    }

    findRustFolder() {
        for (const programDir of this.programDirs) {
            if (!fs.existsSync(programDir)) continue;

            const items = fs.readdirSync(programDir);
            for (const item of items) {
                if (item.startsWith('Rust stable MSVC')) {
                    return path.join(programDir, item);
                }
            }
        }
        return null;
    }

    copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    async installRust() {
        try {
            if (await this.isRustInstalled()) {
                return true;
            }

            // 检查是否已安装 Rustup
            const isRustupInstalled = await winget.isInstalled(this.rustupId);
            
            if (!isRustupInstalled) {
                logger.info(`Installing Rust using winget...`);
                const success = await winget.installSoftwareById(
                    this.rustupId,
                    null,
                    true,
                    null,
                    (progress, result) => {
                        if (progress === 100) {
                            logger.success(`Rust installation completed`);
                        } else if (progress === -1) {
                            logger.error(`Rust installation failed:`, result);
                        }
                    }
                );

                if (!success) {
                    logger.error('Failed to install Rust');
                    return false;
                }
            }

            const rustSrcDir = this.findRustFolder();
            if (!rustSrcDir) {
                logger.error('Could not find Rust installation in Program Files');
                return false;
            }

            const installDir = path.join(this.baseInstallDir, this.rustupId);
            logger.info(`Copying Rust files from ${rustSrcDir} to ${installDir}...`);
            try {
                // 如果目标目录存在，先清空
                if (fs.existsSync(installDir)) {
                    fs.rmSync(installDir, { recursive: true, force: true });
                }
                this.copyDirectory(rustSrcDir, installDir);
                logger.success('Rust files copied successfully');
            } catch (error) {
                logger.error('Error copying Rust files:', error);
                return false;
            }

            // 验证安装并打印版本
            const rustcPath = this.findRustc(installDir);
            if (!rustcPath) {
                logger.error('Could not find rustc.exe in copied files');
                return false;
            }

            const versionOutput = await execCmd(`"${rustcPath}" --version`);
            if (versionOutput && versionOutput.trim()) {
                logger.success(`Rust installation verified: ${versionOutput.trim()}`);
                return true;
            }

            logger.error('Rust installation verification failed');
            return false;
        } catch (error) {
            logger.error('Error during Rust installation:', error);
            return false;
        }
    }

    async uninstallRust() {
        try {
            if (await winget.isInstalled(this.rustupId)) {
                logger.info(`Uninstalling Rust...`);
                const success = await winget.uninstallSoftwareById(
                    this.rustupId,
                    true,
                    null,
                    (progress, result) => {
                        if (progress === 100) {
                            logger.success(`Rust uninstallation completed`);
                        } else if (progress === -1) {
                            logger.error(`Rust uninstallation failed:`, result);
                        }
                    }
                );
                return success;
            }

            logger.info('Rust is not installed');
            return true;
        } catch (error) {
            logger.error('Error during Rust uninstallation:', error);
            return false;
        }
    }

    async start() {
        await bdir.initializedBDir();
        return await this.installRust();
    }

    /**
     * 获取安装信息，包括环境变量路径和可执行文件路径
     * @returns {{
     *   binPaths: string[],      // 需要添加到环境变量的路径数组
     *   versionExePath: string,  // 用于检查版本的可执行文件完整路径
     *   defaultVersion: string,  // 默认版本号
     *   installedVersions: number // 已安装的版本数量
     * }}
     */
    getInstallInfo() {
        try {
            const rustDir = this.findRustInstallationInDir(this.baseInstallDir);
            if (!rustDir) {
                return {
                    binPaths: [],
                    versionExePath: null,
                    defaultVersion: this.rustupId,
                    installedVersions: 0
                };
            }

            const binPaths = [];
            const mainBinPath = path.join(rustDir, 'bin');
            if (fs.existsSync(mainBinPath)) {
                binPaths.push(mainBinPath);
            }

            const cargoBinPath = path.join(rustDir, 'cargo', 'bin');
            if (fs.existsSync(cargoBinPath)) {
                binPaths.push(cargoBinPath);
            }

            const versionExePath = this.findExecutable(rustDir, 'rustc.exe');

            const installedVersions = this.isValidRustInstallation(rustDir) ? 1 : 0;

            return {
                binPaths,
                versionExePath,
                defaultVersion: this.rustupId,
                installedVersions
            };
        } catch (error) {
            logger.error('Error getting Rust installation info:', error);
            return {
                binPaths: [],
                versionExePath: null,
                defaultVersion: this.rustupId,
                installedVersions: 0
            };
        }
    }

    async printVersionInfo() {
        const { versionExePath, defaultVersion, installedVersions } = this.getInstallInfo();
        
        if (versionExePath && installedVersions > 0) {
            try {
                const version = await execCmd(`"${versionExePath}" --version`);
                logger.info(`Rust Version: ${version.trim()}`);
                logger.info(`Default Version ID: ${defaultVersion}`);
                logger.info(`Installed Versions: ${installedVersions}`);
                logger.info(`Executable Path: ${versionExePath}`);
            } catch (error) {
                logger.error('Error getting Rust version:', error);
            }
        } else {
            logger.warn('Rust is not properly installed');
        }
    }
}

module.exports = new GetRustWin();