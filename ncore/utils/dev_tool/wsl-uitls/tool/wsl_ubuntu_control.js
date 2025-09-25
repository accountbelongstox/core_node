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

const Base = require('#@/ncore/utils/dev_tool/lang_deploy/libs/base_utils.js');
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