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
const bdir = require('#@/ncore/global_vars/global_dir/globaldir.js');
const gconfig = require('#@gconfig');
const logger = require('#@logger');

class GetFlutterLinux {
    constructor() {
        this.flutterVersion = 'v3.13.0-stable';
        this.downloadUrl = `https://storage.flutter-io.cn/flutter_infra_release/releases/stable/linux/flutter_linux_${this.flutterVersion}.tar.xz`;
        this.installDir = path.join(gconfig.DEV_LANG_DIR, 'flutter');
        
        this.downloadFile = path.join(gconfig.DOWNLOAD_DIR, 'flutter.tar.xz');

        // Environment variables for China region
        this.envVars = {
            'PUB_HOSTED_URL': 'https://mirror.sjtu.edu.cn/dart-pub',
            'FLUTTER_STORAGE_BASE_URL': 'https://mirror.sjtu.edu.cn'
        };

        // Linux dependencies
        this.dependencies = [
            'curl',
            'git',
            'unzip',
            'xz-utils',
            'zip',
            'libglu1-mesa',
            'clang',
            'cmake',
            'ninja-build',
            'pkg-config',
            'libgtk-3-dev',
            'liblzma-dev'
        ];
    }

    /**
     * Set up required directories
     */
    prepareDirectories() {
        fs.mkdirSync(gconfig.DOWNLOAD_DIR, { recursive: true });
    }

    /**
     * Clean up temporary files
     */
    cleanupTemp() {
        if (fs.existsSync(this.downloadFile)) {
            fs.unlinkSync(this.downloadFile);
            logger.info('Cleaned up old download file');
        }
    }

    /**
     * Check if Flutter is already installed
     */
    isFlutterInstalled() {
        return fs.existsSync(path.join(this.installDir, 'bin', 'flutter'));
    }

    /**
     * Install required Linux dependencies
     */
    async installDependencies() {
        try {
            logger.info('Installing Flutter dependencies...');
            
            // Check if apt-get is available (Debian/Ubuntu)
            let hasApt = false;
            try {
                const result = await execCmd('which apt-get');
                hasApt = !!result;
            } catch {
                hasApt = false;
            }
            
            if (hasApt) {
                await execCmd('sudo apt-get update');
                await execCmd(`sudo apt-get install -y ${this.dependencies.join(' ')}`);
                logger.success('Dependencies installed successfully');
            } else {
                logger.warn('apt-get not found. Please install the following dependencies manually:');
                this.dependencies.forEach(dep => logger.info(`- ${dep}`));
            }
        } catch (error) {
            logger.error('Error installing dependencies:', error);
            throw error;
        }
    }

    /**
     * Set Flutter-specific environment variables
     */
    async setFlutterEnv() {
        try {
            // Add environment variables to ~/.profile
            const profilePath = path.join(os.homedir(), '.profile');
            let profileContent = fs.existsSync(profilePath) 
                ? fs.readFileSync(profilePath, 'utf8') 
                : '';

            // Add each environment variable
            for (const [key, value] of Object.entries(this.envVars)) {
                const envLine = `export ${key}="${value}"`;
                if (!profileContent.includes(envLine)) {
                    profileContent += `\n${envLine}`;
                }
                // Set for current session
                process.env[key] = value;
            }

            // Add Flutter to PATH if not already present
            const flutterBinPath = path.join(this.installDir, 'bin');
            const pathLine = `export PATH="$PATH:${flutterBinPath}"`;
            if (!profileContent.includes(flutterBinPath)) {
                profileContent += `\n${pathLine}`;
            }

            fs.writeFileSync(profilePath, profileContent.trim() + '\n');
            logger.success('Environment variables set successfully');
        } catch (error) {
            logger.error('Error setting Flutter environment variables:', error);
            throw error;
        }
    }

    /**
     * Download and install Flutter
     */
    async installFlutter() {
        try {
            // Clean up any old downloads
            this.cleanupTemp();

            // Download Flutter SDK
            logger.info('Downloading Flutter SDK...');
            await bdir.downloadFile(this.downloadUrl, this.downloadFile);

            // Remove existing installation if any
            if (fs.existsSync(this.installDir)) {
                fs.rmSync(this.installDir, { recursive: true, force: true });
            }

            // Extract Flutter SDK
            logger.info('Extracting Flutter SDK...');
            await execCmd(`tar xf "${this.downloadFile}" -C "${gconfig.DEV_LANG_DIR}"`);

            // Set execute permissions
            await execCmd(`chmod +x "${path.join(this.installDir, 'bin', 'flutter')}"`);

            // Clean up download file
            this.cleanupTemp();

            logger.success('Flutter SDK installed successfully');
            return true;
        } catch (error) {
            logger.error('Error installing Flutter:', error);
            return false;
        }
    }

    /**
     * Get installation information
     */
    getInstallInfo() {
        try {
            if (!this.isFlutterInstalled()) {
                return {
                    binPaths: [],
                    versionExePath: null,
                    defaultVersion: this.flutterVersion,
                    installedVersions: 0
                };
            }

            const binPath = path.join(this.installDir, 'bin');
            const flutterExePath = path.join(binPath, 'flutter');

            return {
                binPaths: [binPath],
                versionExePath: flutterExePath,
                defaultVersion: this.flutterVersion,
                installedVersions: 1
            };
        } catch (error) {
            logger.error('Error getting Flutter installation info:', error);
            return {
                binPaths: [],
                versionExePath: null,
                defaultVersion: this.flutterVersion,
                installedVersions: 0
            };
        }
    }

    /**
     * Print Flutter version information
     */
    async printVersionInfo() {
        const { versionExePath } = this.getInstallInfo();
        if (versionExePath && fs.existsSync(versionExePath)) {
            try {
                const version = await execCmd(`"${versionExePath}" --version`);
                logger.info('Flutter Version Information:');
                logger.info(version.trim());

                logger.info('\nFlutter Environment Variables:');
                for (const [key, value] of Object.entries(this.envVars)) {
                    logger.info(`${key}=${value}`);
                }

                // Show doctor information
                logger.info('\nFlutter Doctor Summary:');
                const doctor = await execCmd(`"${versionExePath}" doctor`);
                logger.info(doctor.trim());
            } catch (error) {
                logger.error('Error getting Flutter version:', error);
            }
        } else {
            logger.warn('Flutter is not properly installed');
        }
    }

    /**
     * Start the Flutter installation process
     */
    async start() {
        try {
            await bdir.initializedBDir();
            this.prepareDirectories();

            // Install system dependencies first
            await this.installDependencies();

            // Set environment variables
            await this.setFlutterEnv();

            // Check if Flutter needs to be installed
            if (!this.isFlutterInstalled()) {
                logger.info('Flutter not found, starting installation...');
                const success = await this.installFlutter();
                if (!success) {
                    throw new Error('Flutter installation failed');
                }
            } else {
                logger.info('Flutter is already installed');
            }

            await this.printVersionInfo();
            return true;
        } catch (error) {
            logger.error('Error in Flutter setup:', error);
            return false;
        }
    }
}

module.exports = new GetFlutterLinux(); 