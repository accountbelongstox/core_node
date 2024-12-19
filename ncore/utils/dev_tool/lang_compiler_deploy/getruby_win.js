const os = require('os');
    const path = require('path');
    const fs = require('fs');
    // const { execSync } = require('child_process');
    // const { gdir } = require('#@globalvars');  // Import com_bin
    // const { bdir } = require('#@/ncore/gvar/bdir.js'); // Import com_bin from #@globalvars
    const logger = require('#@utils_logger');
    const { execPowerShell } = require('#@utils_commander');
    const gconfig = require('#@/ncore/gvar/gconfig.js');
    const langdir = gconfig.DEV_LANG_DIR;

    // const tar = bdir.getTarExecutable(); // Get the tar executable path
    // const curl = bdir.getCurlExecutable(); // Ge
    class GetRubyWin {
        constructor() {
            this.rbenvRoot = path.join(langdir, 'ruby'); // Install Ruby here
            this.rbenvInstallScriptUrl = "https://gitee.com/ccmywish/rbenv-for-windows/raw/main/tools/install.ps1";
            this.rbenvRootVariable = "RBENV_ROOT";
            this.useMirrorVariable = "RBENV_USE_MIRROR";
        }

        // Prepare directories for installation
        prepareDirectories() {
            if (!fs.existsSync(this.rbenvRoot)) {
                fs.mkdirSync(this.rbenvRoot, { recursive: true });
                logger.success(`Created installation directory at: ${this.rbenvRoot}`);
            } else {
                logger.info(`Installation directory already exists: ${this.rbenvRoot}`);
            }
        }

        // Install rbenv for Windows
        installRbenv() {
            logger.info('Starting installation of rbenv for Windows...');
            execPowerShell(`$env:${this.rbenvRootVariable} = '${this.rbenvRoot}'`);
            const installCommand = `
                $s = (iwr -useb "${this.rbenvInstallScriptUrl}")
                icm -sc ([scriptblock]::Create($s.Content)) -arg "install", "cn"
            `;
            execPowerShell(installCommand);
            logger.success('rbenv for Windows installed successfully.');
        }

        // Configure environment variables in $profile
        configureProfile() {
            logger.info('Configuring environment variables in PowerShell profile...');
            const profilePath = path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
            if (!fs.existsSync(profilePath)) {
                fs.writeFileSync(profilePath, '', 'utf8');
                logger.success(`Created new PowerShell profile at: ${profilePath}`);
            } else {
                logger.info(`Using existing PowerShell profile: ${profilePath}`);
            }
            const profileContent = fs.readFileSync(profilePath, 'utf8');
            const newProfileContent = `
    $env:${this.rbenvRootVariable} = "${this.rbenvRoot}"
    $env:${this.useMirrorVariable} = "CN"
    & "$env:${this.rbenvRootVariable}\\rbenv\\bin\\rbenv.ps1" init
            `;
            if (!profileContent.includes('& "$env:RBENV_ROOT\\rbenv\\bin\\rbenv.ps1" init')) {
                fs.appendFileSync(profilePath, newProfileContent, 'utf8');
                logger.success('PowerShell profile configured successfully.');
            } else {
                logger.info('PowerShell profile is already configured.');
            }
        }

        // Get details of the default Ruby version
        getDefaultVersion() {
            const details = this.getVersionDetails();
            const baseDir = new Set();

            if (details && details.rubyPath) {
                const rubyBaseDir = path.dirname(details.rubyPath);
                baseDir.add(rubyBaseDir);
            }

            return {
                versionKey: details ? details.rubyVersionKey : null,
                version: details ? details.rubyVersion : null,
                dir: details ? details.rubyDir : null,
                url: details ? details.rubyUrl : null,
                installDir: details ? details.rubyInstallDir : null,
                path: details ? details.rubyPath : null,
                baseDir: Array.from(baseDir)
            };
        }

        // Get Ruby version details
        getVersionDetails() {
            const rubyVersionKey = 'default'; // Assuming default is the key for the default Ruby version
            const rubyVersion = '3.1.0'; // Example Ruby version
            const rubyDir = 'ruby-3.1.0'; // Directory name after installation
            const rubyUrl = 'https://cache.ruby-lang.org/pub/ruby/3.1/ruby-3.1.0.tar.gz'; // Example download URL
            const rubyInstallDir = path.join(this.rbenvRoot, rubyDir);
            const rubyPath = path.join(rubyInstallDir, 'bin', 'ruby.exe');

            return {
                rubyVersionKey,
                rubyVersion,
                rubyDir,
                rubyUrl,
                rubyInstallDir,
                rubyPath
            };
        }

        async start() {
            try{
                this.prepareDirectories();
                logger.info('Starting Ruby environment setup...');
                this.installRbenv();
                this.configureProfile();
                logger.success('Ruby environment setup completed.');
            } catch (error) {
                logger.error(`Error during Ruby environment setup: ${error}`);
            }
        }
    }

    module.exports = new GetRubyWin();