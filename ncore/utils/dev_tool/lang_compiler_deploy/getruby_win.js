import os from 'os';
import path from 'path';
import fs from 'fs';
import Base from '#@base';
import { execSync } from 'child_process';
import { gdir, com_bin } from '#@globalvars'; // Added com_bin for tar and curl

// Get tar and curl executables
const tar = com_bin.getTarExecutable();
const curl = com_bin.getCurlExecutable();

const langdir = gdir.getDevLangPath(); // Assuming this returns the desired base path

class GetRubyWin extends Base {
    constructor() {
        super();
        this.rbenvRoot = path.join(langdir, 'ruby'); // Install Ruby here
        this.rbenvInstallScriptUrl = "https://gitee.com/ccmywish/rbenv-for-windows/raw/main/tools/install.ps1";
        this.rbenvRootVariable = "RBENV_ROOT";
        this.useMirrorVariable = "RBENV_USE_MIRROR";
        this.prepareDirectories();
    }

    // Prepare directories for installation
    prepareDirectories() {
        if (!fs.existsSync(this.rbenvRoot)) {
            fs.mkdirSync(this.rbenvRoot, { recursive: true });
            this.success(`Created installation directory at: ${this.rbenvRoot}`);
        } else {
            this.info(`Installation directory already exists: ${this.rbenvRoot}`);
        }
    }

    // Install rbenv for Windows
    installRbenv() {
        this.info('Starting installation of rbenv for Windows...');
        
        // Set the RBENV_ROOT environment variable
        this.execPowerShell(`$env:${this.rbenvRootVariable} = '${this.rbenvRoot}'`);

        // Download and run the installation script using curl with -L -k options
        const installCommand = `
            $s = (iwr -useb "${this.rbenvInstallScriptUrl}")
            icm -sc ([scriptblock]::Create($s.Content)) -arg "install", "cn"
        `;
        this.execPowerShell(installCommand);
        
        this.success('rbenv for Windows installed successfully.');
    }

    // Configure environment variables in $profile
    configureProfile() {
        this.info('Configuring environment variables in PowerShell profile...');

        // Profile path for PowerShell
        const profilePath = path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');

        // Check if profile exists, if not, create it
        if (!fs.existsSync(profilePath)) {
            fs.writeFileSync(profilePath, '', 'utf8');
            this.success(`Created new PowerShell profile at: ${profilePath}`);
        } else {
            this.info(`Using existing PowerShell profile: ${profilePath}`);
        }

        // Read the existing profile
        const profileContent = fs.readFileSync(profilePath, 'utf8');

        // Add environment variable configuration to the profile
        const newProfileContent = `
# rbenv for Windows
$env:${this.rbenvRootVariable} = "${this.rbenvRoot}"

# 国内用户使用内置镜像
# 注意，这一行必须放在init之前
$env:${this.useMirrorVariable} = "CN"

& "$env:${this.rbenvRootVariable}\\rbenv\\bin\\rbenv.ps1" init
        `;

        // If the profile doesn't contain the new content, append it
        if (!profileContent.includes('& "$env:RBENV_ROOT\\rbenv\\bin\\rbenv.ps1" init')) {
            fs.appendFileSync(profilePath, newProfileContent, 'utf8');
            this.success('PowerShell profile configured successfully.');
        } else {
            this.info('PowerShell profile is already configured.');
        }
    }

    // Get details of the default Ruby version
    getDefaultVersion() {
        const details = this.getVersionDetails();
        const baseDir = new Set();

        if (details?.rubyPath) {
            const rubyBaseDir = path.dirname(details.rubyPath);
            baseDir.add(rubyBaseDir);
        }

        return {
            versionKey: details?.rubyVersionKey || null,
            version: details?.rubyVersion || null,
            dir: details?.rubyDir || null,
            url: details?.rubyUrl || null,
            installDir: details?.rubyInstallDir || null,
            path: details?.rubyPath || null,
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

    start() {
        this.info('Starting Ruby environment setup...');

        // Install rbenv for Windows
        this.installRbenv();

        // Configure PowerShell profile
        this.configureProfile();

        this.success('Ruby environment setup completed.');
    }
}

export default new GetRubyWin();
