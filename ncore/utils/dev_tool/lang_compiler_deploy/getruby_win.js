const os = require('os');
const path = require('path');
const fs = require('fs');
const bdir = require('#@/ncore/gvar/bdir.js');
const { gdir } = require('#@globalvars');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@/ncore/basic/libs/commander.js');
const logger = require('#@logger');
const langdir = gconfig.DEV_LANG_DIR;

class GetRubyWin {
    constructor() {
        this.rbenvRoot = path.join(langdir, 'ruby'); // Install Ruby here
        this.rbenvInstallScriptUrl = "https://gitee.com/ccmywish/rbenv-for-windows/raw/main/tools/install.ps1";
        this.rbenvRootVariable = "RBENV_ROOT";
        this.useMirrorVariable = "RBENV_USE_MIRROR";
    }

    prepareDirectories() {
        if (!fs.existsSync(this.rbenvRoot)) {
            fs.mkdirSync(this.rbenvRoot, { recursive: true });
            logger.success(`Created installation directory at: ${this.rbenvRoot}`);
        } else {
            logger.info(`Installation directory already exists: ${this.rbenvRoot}`);
        }
    }

    async installRbenv() {
        logger.info('Starting installation of rbenv for Windows...');
        await execCmd(`$env:${this.rbenvRootVariable} = '${this.rbenvRoot}'`);
        const installCommand = `
            $s = (iwr -useb "${this.rbenvInstallScriptUrl}")
            icm -sc ([scriptblock]::Create($s.Content)) -arg "install", "cn"
        `;
        await execCmd(installCommand);
        logger.success('rbenv for Windows installed successfully.');
    }

    async configureProfile() {
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

    getVersionDetails() {
        const rubyVersionKey = 'default';
        const rubyVersion = '3.1.0';
        const rubyDir = 'ruby-3.1.0';
        const rubyUrl = 'https://cache.ruby-lang.org/pub/ruby/3.1/ruby-3.1.0.tar.gz';
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
        try {
            await bdir.initializedBDir();
            this.tar = await bdir.getTarExecutable();
            this.curl = await bdir.getCurlExecutable();

            this.prepareDirectories();
            logger.info('Starting Ruby environment setup...');
            await this.installRbenv();
            await this.configureProfile();
            logger.success('Ruby environment setup completed.');
        } catch (error) {
            logger.error(`Error during Ruby environment setup: ${error}`);
        }
    }

    async verifyInstallation() {
        const rubyPath = path.join(this.rbenvRoot, 'rbenv', 'bin', 'ruby.exe');
        if (fs.existsSync(rubyPath)) {
            logger.success('Ruby installation verified successfully.');
            const version = await execCmdResultText(`"${rubyPath}" --version`);
            logger.info(`Ruby version: ${version}`);
            return true;
        } else {
            logger.error('Ruby installation verification failed.');
            return false;
        }
    }
}

module.exports = new GetRubyWin();