const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const Base = require('#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js');
    const { execSync } = require('child_process');
    const { gdir } = require('#@globalvars');  // Import com_bin
    const { bdir } = require('#@/ncore/gvar/bdir.js'); // Import com_bin from #@globalvars
    const gconfig = require('#@/ncore/gvar/gconfig.js');
    const langdir = gconfig.DEV_LANG_DIR;

    const tar = bdir.getTarExecutable(); // Get the tar executable path
    const curl = bdir.getCurlExecutable(); // Get the curl executable path

    class GetJavaWin extends Base {
        constructor() {
            super();
            this.javaVersions = {
                // 8: "jre-8u421-windows-x64.exe",
                22: "jdk-22_windows-x64_bin.zip"
            };
            this.defaultVersionKey = 22;
            this.installDir = path.join(langdir);
            this.tempDir = path.join(this.installDir, 'tmp');
            this.prepareDirectories();
        }

        getDefaultVersion() {
            const details = this.getVersionDetails(this.defaultVersionKey);
            const baseDir = new Set();

            if (details?.javaPath) {
                const javaBaseDir = path.dirname(details.javaPath);
                baseDir.add(javaBaseDir);
            }

            return {
                versionKey: details?.javaVersionKey || null,
                version: details?.javaVersion || null,
                dir: details?.javaDir || null,
                url: details?.javaUrl || null,
                installDir: details?.javaInstallDir || null,
                path: details?.javaPath || null,
                baseDir: Array.from(baseDir)
            };
        }

        getVersionDetails(versionKey) {
            if (!this.cachedVersionDetails) {
                this.cachedVersionDetails = {};
            }
            if (this.cachedVersionDetails[versionKey]) {
                return this.cachedVersionDetails[versionKey];
            }

            if (this.javaVersions[versionKey]) {
                const javaFileName = this.javaVersions[versionKey];
                const javaUrl = versionKey === 8
                    ? `https://javadl.oracle.com/webapps/download/AutoDL?BundleId=250129_d8aa705069af427f9b83e66b34f5e380`
                    : `https://download.oracle.com/java/22/latest/${javaFileName}`;
                
                const baseFileName = javaFileName.split('-')[0];
                const installDirName = `java-${baseFileName}-${versionKey}`;
                const javaInstallDir = path.join(this.installDir, installDirName);
                const javaPath = path.join(javaInstallDir, 'bin', 'java.exe');
                
                this.cachedVersionDetails[versionKey] = {
                    javaVersionKey: versionKey,
                    javaVersion: javaFileName,
                    javaDir: installDirName,
                    javaUrl,
                    javaInstallDir,
                    javaPath
                };
                return this.cachedVersionDetails[versionKey];
            } else {
                console.error(`Java version key ${versionKey} is not supported.`);
                return null;
            }
        }

        setJavaVersion(versionKey) {
            const versionDetails = this.getVersionDetails(versionKey);
            if (versionDetails) {
                this.javaVersionKey = versionDetails.javaVersionKey;
                this.javaVersion = versionDetails.javaVersion;
                this.javaDir = versionDetails.javaDir;
                this.javaUrl = versionDetails.javaUrl;
                this.javaInstallDir = versionDetails.javaInstallDir;
                this.javaPath = versionDetails.javaPath;
            }
        }

        async start(versionKey = null) {
            if (versionKey !== null) {
                this.setJavaVersion(versionKey);
                this.installJava();
            } else {
                for (const key of Object.keys(this.javaVersions)) {
                    this.setJavaVersion(key);
                    this.installJava();
                }
            }
        }

        installJava() {
            if (this.checkJavaInstalled()) {
                console.log(`Java ${this.javaVersion} is already installed.`);
            } else {
                this.downloadAndExtractJava();
            }
            this.verifyInstallation();
            this.configureJava();
        }

        checkJavaInstalled() {
            // Check if the installation directory exists
            return fs.existsSync(this.javaInstallDir);
        }

        prepareDirectories() {
            if (!fs.existsSync(this.installDir)) {
                fs.mkdirSync(this.installDir, { recursive: true });
            }

            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir, { recursive: true });
            }
        }

        downloadAndExtractJava() {
            console.log(`Downloading Java ${this.javaVersion} from ${this.javaUrl}...`);
            const tempJavaFile = path.join(this.tempDir, this.javaVersion);

            // Use curl with -L and -k parameters
            this.execCmd(`${curl} -L -k -o "${tempJavaFile}" "${this.javaUrl}"`);

            console.log(`Extracting Java ${this.javaVersion}...`);
            if (this.javaVersion.endsWith('.exe')) {
                this.execCmd(`msiexec /a "${tempJavaFile}" /qb TARGETDIR="${this.javaInstallDir}"`);
            } else if (this.javaVersion.endsWith('.zip')) {
                this.extractZip(tempJavaFile, this.installDir);
            } else {
                console.error(`Unsupported file format for ${this.javaVersion}`);
            }
        }

        extractZip(zipPath, targetDir) {
            // Ensure target directory exists
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            console.log(`Unzipping ${zipPath} to ${targetDir}...`);
            this.execCmd(`${tar} -xf "${zipPath}" -C "${targetDir}"`);

            // Find the extracted directory and rename it to the installation directory name
            const extractedDirName = fs.readdirSync(targetDir).find(dir => dir.startsWith(`jdk-${this.javaVersionKey}`));
            const extractedDir = path.join(targetDir, extractedDirName);

            if (fs.existsSync(extractedDir)) {
                fs.renameSync(extractedDir, this.javaInstallDir);
            } else {
                console.error(`Failed to locate extracted directory: ${extractedDirName}`);
            }
        }

        verifyInstallation() {
            console.log(`Verifying installation of Java at ${this.javaPath}...`);
            if (fs.existsSync(this.javaPath)) {
                console.log(`Java ${this.javaVersion} installed successfully.`);
                const version = this.execCmd(`"${this.javaPath}" -version`);
                console.log(`Java version: ${version}`);
            } else {
                console.error(`Java ${this.javaVersion} installation failed.`);
            }
        }

        configureJava() {
            const javaBin = path.join(this.javaInstallDir, 'bin');
            if (!process.env.PATH.includes(javaBin)) {
                process.env.PATH = `${javaBin}${path.delimiter}${process.env.PATH}`;
            }

            // Add any additional Java configuration here if needed
        }

        execCmd(command) {
            try {
                return execSync(command, { stdio: 'inherit' });
            } catch (error) {
                console.error(`Failed to execute command: ${command}`);
                console.error(error);
            }
        }
    }

    const getJavaWin = new GetJavaWin();
    module.exports = getJavaWin;