const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const Base = require('#@base');

class DownloadManager extends Base {
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