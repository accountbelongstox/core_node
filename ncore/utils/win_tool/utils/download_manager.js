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

const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const https = require('https');
    const http = require('http');

    class DownloadManager{
        async downloadCurl(url, tempDir) {
            return new Promise((resolve, reject) => {
                const fileName = this.getFileNameFromUrl(url);
                const downloadPath = path.join(tempDir, fileName);

                this.ensureDirExists(tempDir);

                const curlCommand = `curl -o "${downloadPath}" "${url}" --progress-bar`;

                try {
                    this.execCmd(curlCommand, false, null, false);
                    resolve(downloadPath);
                } catch (error) {
                    this.error(`curl process exited with an error: ${error.message}`);
                    reject(null);
                }
            });
        }

        async downloadAndExtractCurl(url, savePath = path.join(os.homedir(), 'Downloads'), deleteAfterExtract = false) {
            const tempDir = os.tmpdir();

            try {
                const downloadPath = await this.downloadCurl(url, tempDir);
                await this.extractZip(downloadPath, savePath);

                if (deleteAfterExtract) {
                    fs.unlinkSync(downloadPath);
                }

                return downloadPath;
            } catch (error) {
                throw error;
            }
        }

        async extractZip(zipPath, extractTo) {
            return new Promise((resolve, reject) => {
                this.ensureDirExists(extractTo);
                let unzipCommand;

                if (os.platform() === 'win32') {
                    if (zipPath.endsWith('.tar.xz')) {
                        unzipCommand = `tar -xJf "${zipPath}" -C "${extractTo}"`;
                    } else if (zipPath.endsWith('.tar.gz')) {
                        unzipCommand = `tar -xzf "${zipPath}" -C "${extractTo}"`;
                    } else if (zipPath.endsWith('.tar.bz2')) {
                        unzipCommand = `tar -xjf "${zipPath}" -C "${extractTo}"`;
                    } else {
                        unzipCommand = `tar -xf "${zipPath}" -C "${extractTo}"`;
                    }
                } else {
                    if (zipPath.endsWith('.tar.xz')) {
                        unzipCommand = `tar -xJf "${zipPath}" -C "${extractTo}"`;
                    } else if (zipPath.endsWith('.tar.gz')) {
                        unzipCommand = `tar -xzf "${zipPath}" -C "${extractTo}"`;
                    } else if (zipPath.endsWith('.tar.bz2')) {
                        unzipCommand = `tar -xjf "${zipPath}" -C "${extractTo}"`;
                    } else {
                        unzipCommand = `tar -xf "${zipPath}" -C "${extractTo}"`;
                    }
                }

                try {
                    this.execCmd(unzipCommand, false, null, false);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }

        ensureDirExists(dirPath) {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }

        getFileNameFromUrl(url) {
            const parsedUrl = new URL(url);
            const pathname = parsedUrl.pathname;
            const fileName = pathname.substring(pathname.lastIndexOf('/') + 1) || 'index.html';
            return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        }

        async getJSON(url) {
            return new Promise((resolve, reject) => {
                const protocol = url.startsWith('https') ? https : http;

                const req = protocol.get(url, res => {
                    let data = '';

                    if (res.statusCode !== 200) {
                        reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
                        return;
                    }

                    res.on('data', chunk => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve(json);
                        } catch (e) {
                            reject(e);
                        }
                    });
                });

                req.on('error', error => {
                    reject(error);
                });

                req.end();
            });
        }
    }

    module.exports = new DownloadManager();