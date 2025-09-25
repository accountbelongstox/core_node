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
const { gdir } = require('#@global_vars');
const bdir = require('#@/ncore/global_vars/global_dir/globaldir.js');
const gconfig = require('#@gconfig');
const logger = require('#@logger');
const winget = require('#@/ncore/utils/dev_tool/win-libs/winget.js');
const { execCmd } = require('#@commander');

class GetRubyWin {
    constructor() {
        this.rubyVersions = {
            34: {
                winget_id: "RubyInstallerTeam.RubyWithDevKit.3.4"
            }
        };
        this.defaultVersionKey = 34;
        this.baseInstallDir = path.join(gconfig.DEV_LANG_DIR);
        this.prepareDirectories();
    }

    prepareDirectories() {
        if (!fs.existsSync(this.baseInstallDir)) {
            fs.mkdirSync(this.baseInstallDir, { recursive: true });
        }
    }

    getRubyInstallDir(winget_id) {
        return path.join(this.baseInstallDir, winget_id);
    }

    isRubyExecutableExists(installDir) {
        const rubyExePath = path.join(installDir, 'bin', 'ruby.exe');
        return fs.existsSync(rubyExePath);
    }

    async installRuby() {
        const versionDetails = this.rubyVersions[this.defaultVersionKey];
        if (!versionDetails) {
            logger.error(`Unsupported Ruby version: ${this.defaultVersionKey}`);
            return false;
        }

        try {
            const installDir = this.getRubyInstallDir(versionDetails.winget_id);
            const wingetId = versionDetails.winget_id;
            
            // 检查是否已安装
            const isWingetInstalled = await winget.isInstalled(wingetId);
            const isRubyExeExists = this.isRubyExecutableExists(installDir);

            // 如果 winget 显示已安装但 ruby.exe 不存在，需要先卸载
            if (isWingetInstalled && !isRubyExeExists) {
                logger.warn(`Ruby is registered in winget but executable is missing at ${installDir}`);
                logger.info(`Uninstalling Ruby ${wingetId} from winget...`);
                
                const uninstallSuccess = await winget.uninstallSoftwareById(
                    wingetId,
                    true,
                    null,
                    (progress, result) => {
                        if (progress === 100) {
                            logger.success(`Previous Ruby installation removed successfully`);
                        }
                    }
                );

                if (!uninstallSuccess) {
                    logger.error(`Failed to remove previous Ruby installation`);
                    return false;
                }

                // 确保安装目录是空的
                if (fs.existsSync(installDir)) {
                    logger.info(`Cleaning up installation directory: ${installDir}`);
                    fs.rmSync(installDir, { recursive: true, force: true });
                }
            }

            // 如果目录不存在，创建它
            if (!fs.existsSync(installDir)) {
                fs.mkdirSync(installDir, { recursive: true });
            }

            // 安装 Ruby
            logger.info(`Installing Ruby ${wingetId} to ${installDir}...`);
            const success = await winget.installSoftwareById(
                wingetId,
                installDir,
                true,
                null,
                (progress, result) => {
                    if (progress === 100) {
                        logger.success(`Ruby installation completed`);
                    } else if (progress === -1) {
                        logger.error(`Ruby installation failed:`, result);
                    }
                }
            );

            // 最后验证安装
            if (success) {
                const finalCheck = this.isRubyExecutableExists(installDir);
                if (!finalCheck) {
                    logger.error(`Installation reported success but ruby.exe not found in ${installDir}`);
                    return false;
                }
                logger.success(`Ruby installation verified at ${installDir}`);
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error during Ruby installation:', error);
            return false;
        }
    }

    async verifyInstallation() {
        try {
            const versionDetails = this.rubyVersions[this.defaultVersionKey];
            const installDir = this.getRubyInstallDir(versionDetails.winget_id);

            const isValid = await winget.isInstalled(versionDetails.winget_id) && 
                          this.isRubyExecutableExists(installDir);

            if (isValid) {
                logger.success('Ruby installation verified successfully');
                return true;
            } else {
                logger.error('Ruby installation verification failed');
                return false;
            }
        } catch (error) {
            logger.error('Error verifying Ruby installation:', error);
            return false;
        }
    }

    async uninstallRuby() {
        const versionDetails = this.rubyVersions[this.defaultVersionKey];
        if (!versionDetails) {
            logger.error(`Unsupported Ruby version: ${this.defaultVersionKey}`);
            return false;
        }

        try {
            if (await winget.isInstalled(versionDetails.winget_id)) {
                logger.info(`Uninstalling Ruby ${versionDetails.winget_id}...`);
                const success = await winget.uninstallSoftwareById(
                    versionDetails.winget_id,
                    true,
                    null,
                    (progress, result) => {
                        if (progress === 100) {
                            logger.success(`Ruby uninstallation completed`);
                        } else if (progress === -1) {
                            logger.error(`Ruby uninstallation failed:`, result);
                        }
                    }
                );
                return success;
            }

            logger.info('Ruby is not installed');
            return true;
        } catch (error) {
            logger.error('Error during Ruby uninstallation:', error);
            return false;
        }
    }

    async start() {
        await bdir.initializedBDir();
        
        if (await this.verifyInstallation()) {
            logger.info('Ruby is already installed');
            return true;
        }

        logger.info('Starting Ruby installation...');
        const success = await this.installRuby();
        
        if (success) {
            await this.verifyInstallation();
            return true;
        }
        
        return false;
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
            const installDir = this.getRubyInstallDir(this.rubyVersions[this.defaultVersionKey].winget_id);
            if (!fs.existsSync(installDir)) {
                return {
                    binPaths: [],
                    versionExePath: null,
                    defaultVersion: this.rubyVersions[this.defaultVersionKey].winget_id,
                    installedVersions: 0
                };
            }

            // 收集所有需要的路径
            const binPaths = [];
            
            // Ruby 主目录
            if (fs.existsSync(installDir)) {
                binPaths.push(installDir);
            }

            // bin 目录
            const binPath = path.join(installDir, 'bin');
            if (fs.existsSync(binPath)) {
                binPaths.push(binPath);
            }

            // lib 目录
            const libPath = path.join(installDir, 'lib');
            if (fs.existsSync(libPath)) {
                binPaths.push(libPath);
                
                // gems 目录
                const gemsPath = path.join(libPath, 'ruby', 'gems');
                if (fs.existsSync(gemsPath)) {
                    binPaths.push(gemsPath);
                }
            }

            // 查找 ruby.exe
            const versionExePath = path.join(binPath, 'ruby.exe');
            const isValidInstall = fs.existsSync(versionExePath);

            // 获取已安装的版本数量
            let installedVersions = 0;
            if (isValidInstall) {
                // 检查关键文件是否存在
                const gemPath = path.join(binPath, 'gem.cmd');
                if (fs.existsSync(gemPath)) {
                    installedVersions = 1; // Ruby 通常只安装一个版本
                }
            }

            return {
                binPaths,
                versionExePath: isValidInstall ? versionExePath : null,
                defaultVersion: this.rubyVersions[this.defaultVersionKey].winget_id,
                installedVersions
            };
        } catch (error) {
            logger.error('Error getting Ruby installation info:', error);
            return {
                binPaths: [],
                versionExePath: null,
                defaultVersion: this.rubyVersions[this.defaultVersionKey].winget_id,
                installedVersions: 0
            };
        }
    }

    /**
     * 打印 Ruby 版本信息
     */
    async printVersionInfo() {
        const { versionExePath, defaultVersion, installedVersions, binPaths } = this.getInstallInfo();
        
        if (versionExePath && installedVersions > 0) {
            try {
                // 获取 Ruby 版本
                const rubyVersion = await execCmd(`"${versionExePath}" --version`);
                logger.info(`Ruby Version: ${rubyVersion.trim()}`);
                
                // 获取 gem 版本
                const gemPath = path.join(path.dirname(versionExePath), 'gem.cmd');
                const gemVersion = await execCmd(`"${gemPath}" --version`);
                logger.info(`Gem Version: ${gemVersion.trim()}`);

                logger.info(`Default Version: ${defaultVersion}`);
                logger.info(`Installed Versions: ${installedVersions}`);
                logger.info(`Executable Path: ${versionExePath}`);

                // 显示 Ruby 环境信息
                logger.info('Ruby Environment Information:');
                const rubyEnv = await execCmd(`"${versionExePath}" -e "puts RUBY_DESCRIPTION"`);
                logger.info(`  ${rubyEnv.trim()}`);

                // 显示加载路径
                logger.info('Ruby Load Path:');
                const loadPath = await execCmd(`"${versionExePath}" -e "puts $LOAD_PATH"`);
                loadPath.split('\n').forEach(line => {
                    if (line.trim()) {
                        logger.info(`  ${line.trim()}`);
                    }
                });

                // 显示配置信息
                logger.info('Ruby Configuration Paths:');
                binPaths.forEach(path => {
                    logger.info(`  ${path}`);
                });

                // 显示已安装的 gems
                logger.info('Installed Gems:');
                const gems = await execCmd(`"${gemPath}" list`);
                gems.split('\n').forEach(line => {
                    if (line.trim() && !line.includes('LOCAL GEMS')) {
                        logger.info(`  ${line.trim()}`);
                    }
                });

                // 显示 Ruby 平台信息
                logger.info('Ruby Platform Information:');
                const platform = await execCmd(`"${versionExePath}" -e "puts RUBY_PLATFORM"`);
                logger.info(`  ${platform.trim()}`);

                // 显示编译选项
                logger.info('Ruby Compile Options:');
                const config = await execCmd(`"${versionExePath}" -e "puts RbConfig::CONFIG['configure_args']"`);
                logger.info(`  ${config.trim()}`);

            } catch (error) {
                logger.error('Error getting Ruby version:', error);
            }
        } else {
            logger.warn('Ruby is not properly installed');
        }
    }
}

module.exports = new GetRubyWin();