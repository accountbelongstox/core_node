import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Get SSH configuration paths
 * @returns {object} SSH configuration paths
 */
function getSSHConfigPaths() {
    const homeDir = os.homedir();
    return {
        userConfig: path.join(homeDir, '.ssh', 'config'),
        systemConfig: '/etc/ssh/ssh_config',
        sshDir: path.join(homeDir, '.ssh')
    };
}

/**
 * Parse SSH config file content
 * @param {string} content - File content
 * @returns {Array<object>} Parsed configuration entries
 */
function parseSSHConfig(content) {
    const entries = [];
    let currentEntry = null;
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        const [key, ...valueParts] = trimmedLine.split(/\s+/);
        const value = valueParts.join(' ');

        // Start new host entry
        if (key.toLowerCase() === 'host') {
            if (currentEntry) {
                entries.push(currentEntry);
            }
            currentEntry = {
                Host: value,
                Options: {}
            };
        } else if (currentEntry && key && value) {
            // Add option to current host entry
            currentEntry.Options[key] = value;
        }
    }

    // Add last entry
    if (currentEntry) {
        entries.push(currentEntry);
    }

    return entries;
}

/**
 * Read SSH config file
 * @param {string} filePath - Path to config file
 * @returns {Array<object>|null} Configuration entries or null
 */
function readSSHConfig(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return parseSSHConfig(content);
        }
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
    }
    return null;
}

/**
 * Check SSH key files
 * @param {string} sshDir - SSH directory path
 * @returns {object} Key file status
 */
function checkSSHKeys(sshDir) {
    const keyStatus = {
        hasPrivateKeys: false,
        hasPublicKeys: false,
        privateKeys: [],
        publicKeys: [],
        knownHosts: false
    };

    try {
        const files = fs.readdirSync(sshDir);
        
        for (const file of files) {
            const filePath = path.join(sshDir, file);
            
            if (file === 'known_hosts') {
                keyStatus.knownHosts = true;
            } else if (file.endsWith('.pub')) {
                keyStatus.hasPublicKeys = true;
                keyStatus.publicKeys.push(file);
            } else if (file !== 'config' && file !== 'known_hosts') {
                const stat = fs.statSync(filePath);
                if (stat.isFile() && (stat.mode & 0o077) === 0) {
                    keyStatus.hasPrivateKeys = true;
                    keyStatus.privateKeys.push(file);
                }
            }
        }
    } catch (error) {
        console.error('Error checking SSH keys:', error.message);
    }

    return keyStatus;
}

/**
 * Check SSH agent status
 * @returns {object} SSH agent status
 */
function checkSSHAgent() {
    const agentStatus = {
        isRunning: false,
        identities: []
    };

    try {
        const result = execSync('ssh-add -l', { encoding: 'utf8' });
        agentStatus.isRunning = true;
        
        const lines = result.split('\n');
        for (const line of lines) {
            if (line.trim()) {
                const parts = line.split(' ');
                if (parts.length >= 3) {
                    agentStatus.identities.push({
                        bits: parts[0],
                        fingerprint: parts[1],
                        comment: parts.slice(2).join(' ')
                    });
                }
            }
        }
    } catch (error) {
        // SSH agent might not be running
        if (!error.message.includes('Could not open a connection to your authentication agent')) {
            console.error('Error checking SSH agent:', error.message);
        }
    }

    return agentStatus;
}

/**
 * Print configuration check results
 * @param {string} title - Section title
 * @param {object|Array} data - Data to print
 */
function printResults(title, data) {
    console.log(`\n${title}`);
    console.log('='.repeat(50));

    if (Array.isArray(data)) {
        data.forEach((entry, index) => {
            console.log(`\nHost Entry ${index + 1}:`);
            console.log(`Host: ${entry.Host}`);
            console.log('Options:');
            Object.entries(entry.Options).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        });
    } else {
        Object.entries(data).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                console.log(`${key}:`);
                value.forEach(item => console.log(`  - ${item}`));
            } else if (typeof value === 'object') {
                console.log(`${key}:`);
                Object.entries(value).forEach(([subKey, subValue]) => {
                    console.log(`  ${subKey}: ${subValue}`);
                });
            } else {
                console.log(`${key}: ${value}`);
            }
        });
    }
}

/**
 * Main function to check SSH configuration
 */
async function main() {
    try {
        const paths = getSSHConfigPaths();

        // Check SSH directory
        if (!fs.existsSync(paths.sshDir)) {
            console.log('\nSSH directory not found. Creating...');
            fs.mkdirSync(paths.sshDir, { mode: 0o700 });
        }

        // Check configurations
        const userConfig = readSSHConfig(paths.userConfig);
        const systemConfig = readSSHConfig(paths.systemConfig);

        if (userConfig) {
            printResults('User SSH Configuration', userConfig);
        } else {
            console.log('\nNo user SSH configuration found');
        }

        if (systemConfig) {
            printResults('System SSH Configuration', systemConfig);
        } else {
            console.log('\nNo system SSH configuration found');
        }

        // Check SSH keys
        const keyStatus = checkSSHKeys(paths.sshDir);
        printResults('SSH Keys Status', keyStatus);

        // Check SSH agent
        const agentStatus = checkSSHAgent();
        printResults('SSH Agent Status', agentStatus);

    } catch (error) {
        console.error('Error checking SSH configuration:', error.message);
        process.exit(1);
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    getSSHConfigPaths,
    parseSSHConfig,
    readSSHConfig,
    checkSSHKeys,
    checkSSHAgent
}; 