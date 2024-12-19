const Base = require('#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

    class WSLUbuntuContrl extends Base {
        constructor() {
            super();
        }

        // Start Ubuntu
        startUbuntu() {
            try {
                console.log('Starting Ubuntu...');
                // Use WSL command to start Ubuntu
                const result = this.execCmd('wsl -d Ubuntu');
                console.log('Ubuntu started.');
                return result;
            } catch (error) {
                this.error('Error starting Ubuntu:', error);
                return null;
            }
        }

        // Stop Ubuntu
        stopUbuntu() {
            try {
                console.log('Stopping Ubuntu...');
                // Use WSL command to terminate the Ubuntu instance
                const result = this.execCmd('wsl --terminate Ubuntu');
                console.log('Ubuntu stopped.');
                return result;
            } catch (error) {
                this.error('Error stopping Ubuntu:', error);
                return null;
            }
        }

        // Restart Ubuntu
        restartUbuntu() {
            try {
                console.log('Restarting Ubuntu...');
                this.stopUbuntu(); // First stop
                const result = this.startUbuntu(); // Then start
                console.log('Ubuntu restarted.');
                return result;
            } catch (error) {
                this.error('Error restarting Ubuntu:', error);
                return null;
            }
        }
    }

    module.exports = new WSLUbuntuContrl();