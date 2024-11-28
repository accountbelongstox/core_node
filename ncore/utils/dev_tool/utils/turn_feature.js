import Base from '#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js';
import { execSync, exec } from 'child_process';

class TurnFeature extends Base {
    constructor() {
        super();
        this.dismPath = 'C:\\Windows\\System32\\dism.exe';
    }

    ensureAdminPrivileges() {
        if (!this.isAdmin()) {
            console.log('Not running with admin privileges, attempting to elevate...');
            this.runAsAdmin();
        } else {
            console.log('Running with admin privileges.');
        }
    }

    isAdmin() {
        try {
            execSync('net session', { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }

    runAsAdmin() {
        const scriptPath = process.argv[1];
        this.execPowerShell(`Start-Process 'node' -ArgumentList '${scriptPath}' -Verb RunAs`);
        process.exit();
    }

    getHyperFeatures(feature_name = 'Hyper') {
        try {
            console.log('Running dism command to retrieve features...');
            const output = this.execCmd(`${this.dismPath} /online /get-features /format:table`);
            console.log('dism command output:', output);

            const lines = output.split('\n');
            return lines.filter(line => line.includes(feature_name)).map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    featureName: parts[0],
                    isEnable: parts[1] === 'Enabled'
                };
            });
        } catch (error) {
            console.error('Error retrieving Hyper-V features:', error);
            return [];
        }
    }

    enableFeature(featureName) {
        try {
            console.log(`Enabling feature: ${featureName}`);
            const enableCmd = `${this.dismPath} /online /enable-feature /featurename:${featureName} /norestart`;
            console.log(`Executing command: ${enableCmd}`);
            this.pipeExecCmd(enableCmd);
            console.log(`Feature ${featureName} successfully enabled.`);
        } catch (error) {
            console.error(`Failed to enable feature ${featureName}:`, error);
            console.log(`Retrying command: ${this.dismPath} /online /enable-feature /featurename:${featureName} /norestart`);
        }
    }

    enableAllHyperFeatures() {
        console.log('Enabling all Hyper-V features...');
        const hyperFeatures = this.getHyperFeatures('Hyper');
        if (hyperFeatures.length === 0) {
            console.log('No Hyper-V features found to enable.');
            return;
        }

        hyperFeatures.forEach(feature => {
            if (!feature.isEnable) {
                this.enableFeature(feature.featureName);
                this.addDelay(5000);
            } else {
                console.log(`Feature ${feature.featureName} is already enabled, skipping.`);
            }
        });
    }

    addDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    start() {
        this.ensureAdminPrivileges();
        console.log('Starting to manage Hyper-V features...');
        
        const features = this.getHyperFeatures('Hyper');
        if (features.length > 0) {
            console.log('Detected the following Hyper-V features:');
            features.forEach(feature => {
                console.log(`- ${feature.featureName}: ${feature.isEnable ? 'Enabled' : 'Disabled'}`);
            });

            this.enableAllHyperFeatures();
            this.enableAllHyperFeatures();
        } else {
            console.log('No Hyper-V features detected.');
        }
    }

    disableAllHyperFeatures() {
        console.log('Disabling all Hyper-V features...');
        const hyperFeatures = this.getHyperFeatures('Hyper');
        if (hyperFeatures.length === 0) {
            console.log('No Hyper-V features found to disable.');
            return;
        }

        hyperFeatures.forEach(feature => {
            if (feature.isEnable) {
                this.disableFeature(feature.featureName);
                this.addDelay(5000);
            } else {
                console.log(`Feature ${feature.featureName} is already disabled, skipping.`);
            }
        });
    }

    disableFeature(featureName) {
        try {
            console.log(`Disabling feature: ${featureName}`);
            this.pipeExecCmd(`${this.dismPath} /online /disable-feature /featurename:${featureName} /norestart`);
            console.log(`Feature ${featureName} successfully disabled.`);
        } catch (error) {
            console.error(`Failed to disable feature ${featureName}:`, error);
        }
    }
}

const turnFeature = new TurnFeature();

export default turnFeature;
