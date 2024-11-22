const fs = require('fs');
const path = require('path');

const SSH_CONFIG_PATH = '/etc/ssh/sshd_config';

function checkAndUpdateSSHConfig() {
    try {
        // Check if file exists
        if (!fs.existsSync(SSH_CONFIG_PATH)) {
            console.error(`SSH config file not found at ${SSH_CONFIG_PATH}`);
            process.exit(1);
        }

        // Read the current config
        let config = fs.readFileSync(SSH_CONFIG_PATH, 'utf8');
        let lines = config.split('\n');
        let modified = false;
        let hasPermitRootLogin = false;
        let hasPasswordAuth = false;

        // Process each line
        lines = lines.map(line => {
            // Remove comments and trim
            let processedLine = line.trim();
            if (processedLine.startsWith('#')) {
                processedLine = processedLine.substring(1).trim();
            }

            // Check PermitRootLogin
            if (processedLine.startsWith('PermitRootLogin')) {
                hasPermitRootLogin = true;
                if (!processedLine.includes('yes')) {
                    modified = true;
                    return 'PermitRootLogin yes';
                }
            }

            // Check PasswordAuthentication
            if (processedLine.startsWith('PasswordAuthentication')) {
                hasPasswordAuth = true;
                if (!processedLine.includes('yes')) {
                    modified = true;
                    return 'PasswordAuthentication yes';
                }
            }

            return line;
        });

        // Add missing configurations if needed
        if (!hasPermitRootLogin) {
            lines.push('PermitRootLogin yes');
            modified = true;
        }
        if (!hasPasswordAuth) {
            lines.push('PasswordAuthentication yes');
            modified = true;
        }

        // If changes were made, write the new config
        if (modified) {
            console.log('SSH configuration needs updates. Applying changes...');
            fs.writeFileSync(SSH_CONFIG_PATH, lines.join('\n'));
            console.log('SSH configuration updated successfully.');
            console.log('Please restart the SSH service for changes to take effect.');
        } else {
            console.log('SSH configuration is already correctly set.');
        }

        // Output current settings
        console.log('\nCurrent SSH Settings:');
        console.log('- Root Login: Enabled');
        console.log('- Password Authentication: Enabled');

    } catch (error) {
        console.error('Error processing SSH config:', error.message);
        process.exit(1);
    }
}

checkAndUpdateSSHConfig(); 