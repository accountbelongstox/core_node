const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const download_manager = require("../utils/download_manager.js");
    const { rootdir } = require("#@globalvars");

    class Run  {
        constructor() {
            this.initialWorkingDirectory = rootdir;
            this.currentDir = rootdir;
        }

        async checkAdmin(interval) {
            if (!this.isAdmin()) {
                this.warn("Please run as administrator.");
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }

        isAdmin() {
            if (os.platform() === 'win32') {
                try {
                    // Attempt to access a restricted system directory
                    fs.accessSync('C:\\Windows\\System32\\config', fs.constants.W_OK);
                    return true;
                } catch (error) {
                    return false;
                }
            } else {
                try {
                    // Check if the current user is root by checking if the UID is 0
                    return process.getuid && process.getuid() === 0;
                } catch (error) {
                    return false;
                }
            }
        }

        async execByExplorer(command, info = false, cwd = null) {
            let cmd;
            const parsedPath = path.parse(command);

            if (parsedPath.root !== '' && parsedPath.dir !== '') {
                cmd = `explorer "${command}"`;
            } else {
                cmd = `explorer ${command}`;
            }

            return await this.execCmd(cmd, info, cwd);
        }

        async exec_explorer(file_path, group, default_config) {
            file_path = path.normalize(file_path);
            if (!fs.existsSync(file_path) && group && default_config) {
                file_path = path.join(default_config.icon_dir, group);
            }
            const cmd = `explorer "${file_path}"`;
            return await this.execCmd(cmd, true, null, true);
        }

        async runAsAdmin(file_path) {
            file_path = path.normalize(file_path);
            const originalCwd = process.cwd();
            let cmd;
            let result;
            const baseDir = path.dirname(file_path);

            if (!fs.existsSync(file_path)) {
                cmd = `explorer "${baseDir}"`;
                result = { error: 'Executable file does not exist. Opening the parent directory of the executable file.' };
                this.error(result.error);
            } else {
                process.chdir(baseDir);
                cmd = `start ${file_path}`;
                this.info(`Running as admin: ${cmd}`);
                result = await this.execCmd(cmd, true, null, true);
                this.success("Command executed successfully.");
            }

            process.chdir(originalCwd);
        }

        async runAsAdminByGSudo(file_path, group, default_config, pare = '') {
            file_path = path.normalize(file_path);
            let cmd;
            let runmode = `explorer`;

            if (!fs.existsSync(file_path)) {
                if (group && default_config) {
                    file_path = path.join(default_config.icon_dir, group);
                }
                cmd = `explorer "${file_path}"`;
                this.warn("File does not exist. Opening the parent directory.");
            } else {
                if (this.isExecutable(file_path)) {
                    let gsudo = path.join(rootdir, '.bin', 'gsudo.exe');
                    gsudo = path.normalize(gsudo);

                    if (!fs.existsSync(gsudo)) {
                        await this.downloadGsudo();
                    }

                    let current_user = os.userInfo().username;
                    if (pare) {
                        pare = ` ` + pare;
                    }
                    cmd = `${gsudo} -u ${current_user} "${file_path}"${pare}`;
                    runmode = `admin`;
                    this.info(`Running with gsudo: ${cmd}`);
                } else {
                    cmd = `explorer "${file_path}"${pare}`;
                    this.info(`Running with explorer: ${cmd}`);
                }
            }

            await this.execCmd(cmd, true, null, true);
            this.success(`Command executed in ${runmode} mode.`);
        }

        async getLatestGsudoUrl() {
            const apiUrl = 'https://api.github.com/repos/gerardog/gsudo/releases/latest';
            try {
                const response = await download_manager.getJSON(apiUrl);
                const assets = response.assets || [];
                const downloadUrl = assets.find(asset => asset.name.includes('portable')).browser_download_url;
                return downloadUrl;
            } catch (error) {
                this.error("Failed to fetch the latest gsudo release.");
                throw error;
            }
        }

        async downloadGsudo() {
            const downloadUrl = await this.getLatestGsudoUrl();
            const downloadPath = path.join(rootdir, '.bin');
            this.ensureDirExists(downloadPath);
            this.info(`Downloading gsudo from ${downloadUrl} to ${downloadPath}`);
            await download_manager.downloadAndExtractCurl(downloadUrl, downloadPath);
            this.success("gsudo downloaded and extracted successfully.");
        }
    }

    module.exports = new Run();