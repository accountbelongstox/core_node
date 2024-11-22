import fs from 'fs';
import { execSync } from 'child_process';

// Get memory limit from command line argument
const memoryArg = process.argv[2];
if (!memoryArg || !/^\d+M$/.test(memoryArg)) {
    console.error('Please provide memory limit in format: 100M/200M/300M/400M/500M');
    process.exit(1);
}

// Convert memory string to number (MB)
const totalMemoryMB = parseInt(memoryArg);

// Calculate memory settings based on total available memory
function calculateMemorySettings(totalMemoryMB) {
    // Basic allocation percentages
    const settings = {
        innodb_buffer_pool_size: Math.floor(totalMemoryMB * 0.5), // 50% of total memory
        key_buffer_size: Math.floor(totalMemoryMB * 0.2),         // 20% of total memory
        max_allowed_packet: Math.min(64, Math.floor(totalMemoryMB * 0.1)), // 10% but max 64MB
        thread_stack: 192,                                         // Fixed 192KB
        thread_cache_size: Math.min(8, Math.floor(totalMemoryMB * 0.01)), // 1% but max 8
        max_connections: Math.min(100, Math.floor(totalMemoryMB / 2)), // 2MB per connection
        table_open_cache: Math.min(2000, Math.floor(totalMemoryMB * 2)), // Proportional to memory
        innodb_log_file_size: Math.min(256, Math.floor(totalMemoryMB * 0.25)) // 25% but max 256MB
    };

    // Adjust settings for very small memory configurations
    if (totalMemoryMB <= 100) {
        settings.innodb_buffer_pool_size = Math.floor(totalMemoryMB * 0.4);
        settings.key_buffer_size = Math.floor(totalMemoryMB * 0.1);
        settings.max_connections = 50;
        settings.table_open_cache = 400;
    }

    return settings;
}

// Format memory value for config file
function formatMemoryValue(value, isKB = false) {
    return isKB ? `${value}K` : `${value}M`;
}

// Backup configuration file
function backupConfig(configPath) {
    const backupPath = `${configPath}.backup-${Date.now()}`;
    try {
        fs.copyFileSync(configPath, backupPath);
        console.log(`Backup created: ${backupPath}`);
        return backupPath;
    } catch (error) {
        console.error('Error creating backup:', error.message);
        process.exit(1);
    }
}

// Restore configuration from backup
function restoreConfig(backupPath, configPath) {
    try {
        fs.copyFileSync(backupPath, configPath);
        console.log(`Configuration restored from backup: ${backupPath}`);
        return true;
    } catch (error) {
        console.error('Error restoring backup:', error.message);
        return false;
    }
}

// Restart MariaDB service
function restartMariaDB() {
    try {
        execSync('systemctl restart mariadb');
        // Wait a moment and check if the service is running
        setTimeout(() => {
            try {
                execSync('systemctl is-active --quiet mariadb');
                return true;
            } catch {
                return false;
            }
        }, 2000);
        return true;
    } catch {
        return false;
    }
}

// Update MariaDB configuration
function updateMariaDBConfig(settings) {
    const configPath = '/etc/mysql/mysql.conf.d/mysqld.cnf';
    const backupPath = backupConfig(configPath);

    try {
        // Read current config
        let config = fs.readFileSync(configPath, 'utf8');
        let lines = config.split('\n');
        let updatedConfig = [];
        let settingsFound = new Set();

        // Process existing lines
        for (let line of lines) {
            let matched = false;
            for (const [key, value] of Object.entries(settings)) {
                const regex = new RegExp(`^\\s*${key}\\s*=`);
                if (regex.test(line)) {
                    updatedConfig.push(`${key} = ${typeof value === 'number' ? 
                        (key.includes('size') ? formatMemoryValue(value) : value) : 
                        value}`);
                    settingsFound.add(key);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                updatedConfig.push(line);
            }
        }

        // Add missing settings
        for (const [key, value] of Object.entries(settings)) {
            if (!settingsFound.has(key)) {
                updatedConfig.push(`${key} = ${typeof value === 'number' ? 
                    (key.includes('size') ? formatMemoryValue(value) : value) : 
                    value}`);
            }
        }

        // Write updated config
        fs.writeFileSync(configPath, updatedConfig.join('\n'));
        console.log('Configuration updated successfully.');

        // Attempt to restart MariaDB
        console.log('Restarting MariaDB service...');
        if (!restartMariaDB()) {
            console.error('Failed to restart MariaDB. Restoring previous configuration...');
            if (restoreConfig(backupPath, configPath)) {
                if (restartMariaDB()) {
                    console.log('Previous configuration restored and MariaDB restarted successfully.');
                } else {
                    console.error('Failed to restart MariaDB even with restored configuration.');
                    console.error('Please check MariaDB logs: journalctl -u mariadb');
                }
            }
            process.exit(1);
        }

        console.log('MariaDB restarted successfully with new configuration.');
        console.log('\nNew memory settings:');
        Object.entries(settings).forEach(([key, value]) => {
            console.log(`${key} = ${key.includes('size') ? formatMemoryValue(value) : value}`);
        });

    } catch (error) {
        console.error('Error updating MariaDB configuration:', error.message);
        console.log('Attempting to restore previous configuration...');
        if (restoreConfig(backupPath, configPath)) {
            if (restartMariaDB()) {
                console.log('Previous configuration restored and MariaDB restarted successfully.');
            } else {
                console.error('Failed to restart MariaDB even with restored configuration.');
                console.error('Please check MariaDB logs: journalctl -u mariadb');
            }
        }
        process.exit(1);
    }
}

// Execute the configuration update
const settings = calculateMemorySettings(totalMemoryMB);
updateMariaDBConfig(settings);
