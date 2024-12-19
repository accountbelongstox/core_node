const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const os = require('os');

class FFmpegSetup {
    constructor() {
        this.platform = os.platform();
        this.ffmpegBinary = this.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
        
        // Try to get path from gconfig
        try {
            const gconfig = require('#@gconfig');
            if(gconfig){
                const baseConfig = gconfig.getBaseConfig();
                this.binDir = baseConfig.appPlatformBinDir;
            }
        } catch (error) {
            // Fallback paths if gconfig is not available
            this.binDir = this.platform === 'win32' 
                ? path.join(os.homedir(), 'AppData', 'Local', 'FFmpeg', 'bin')
                : '/usr/local/bin';
        }

        this.ffmpegPath = path.join(this.binDir, this.ffmpegBinary);
        
        // FFmpeg download URLs
        this.downloadUrls = {
            win32: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
            linux: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
        };
    }

    /**
     * Check if FFmpeg is installed and accessible
     */
    async checkFFmpeg() {
        try {
            // First check if ffmpeg exists in system PATH
            const result = await this._executeCommand(['-version']);
            if (result) return 'system';

            // Then check if ffmpeg exists in specified directory
            if (fs.existsSync(this.ffmpegPath)) {
                const result = await this._executeCommand(['-version'], this.ffmpegPath);
                if (result) return 'local';
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get FFmpeg path
     */
    async getFFmpegPath() {
        const location = await this.checkFFmpeg();
        if (location === 'system') return 'ffmpeg';
        if (location === 'local') return this.ffmpegPath;
        
        // If FFmpeg is not found, try to install it
        const installed = await this.installFFmpeg();
        if (installed) return this.ffmpegPath;
        
        throw new Error('FFmpeg is not installed and automatic installation failed');
    }

    /**
     * Install FFmpeg
     */
    async installFFmpeg() {
        try {
            console.log('Installing FFmpeg...');

            // Create bin directory if it doesn't exist
            if (!fs.existsSync(this.binDir)) {
                fs.mkdirSync(this.binDir, { recursive: true });
            }

            // Download and extract FFmpeg
            const downloadUrl = this.downloadUrls[this.platform];
            if (!downloadUrl) {
                throw new Error(`Unsupported platform: ${this.platform}`);
            }

            console.log(`Downloading FFmpeg from ${downloadUrl}`);
            const archivePath = path.join(this.binDir, 'ffmpeg_temp' + (this.platform === 'win32' ? '.zip' : '.tar.xz'));
            
            await this._downloadFile(downloadUrl, archivePath);
            await this._extractArchive(archivePath);
            
            // Clean up
            fs.unlinkSync(archivePath);

            console.log('FFmpeg installation completed');
            return true;
        } catch (error) {
            console.error('FFmpeg installation failed:', error);
            return false;
        }
    }

    /**
     * Download file from URL
     */
    _downloadFile(url, destination) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destination);
            https.get(url, response => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', error => {
                fs.unlink(destination, () => reject(error));
            });
        });
    }

    /**
     * Extract downloaded archive
     */
    async _extractArchive(archivePath) {
        if (this.platform === 'win32') {
            // Use PowerShell to extract zip on Windows
            const command = `
                Expand-Archive -Path "${archivePath}" -DestinationPath "${this.binDir}" -Force;
                Get-ChildItem -Path "${this.binDir}" -Recurse -Filter ffmpeg.exe | 
                Copy-Item -Destination "${this.ffmpegPath}" -Force
            `;
            await this._executePowerShell(command);
        } else {
            // Use tar on Linux
            await this._executeCommand(['xf', archivePath], 'tar', this.binDir);
            // Move ffmpeg binary to bin directory
            const extractedDir = fs.readdirSync(this.binDir)
                .find(dir => dir.startsWith('ffmpeg'));
            if (extractedDir) {
                const sourcePath = path.join(this.binDir, extractedDir, 'ffmpeg');
                fs.renameSync(sourcePath, this.ffmpegPath);
                fs.chmodSync(this.ffmpegPath, '755');
            }
        }
    }

    /**
     * Execute command and return result
     */
    _executeCommand(args, command = 'ffmpeg', cwd = null) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, { cwd });
            let output = '';

            process.stdout.on('data', data => {
                output += data;
            });

            process.on('close', code => {
                if (code === 0) resolve(output);
                else reject(new Error(`Command failed with code ${code}`));
            });

            process.on('error', reject);
        });
    }

    /**
     * Execute PowerShell command
     */
    _executePowerShell(command) {
        return this._executeCommand(['-Command', command], 'powershell.exe');
    }
}

module.exports = new FFmpegSetup(); 