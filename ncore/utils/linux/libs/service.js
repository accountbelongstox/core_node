const { exec } = require('child_process');
    const { promisify } = require('util');
    const fs = require('fs');
    const path = require('path');
    const execSync = require('child_process').execSync;

    const execAsync = promisify(exec);
    const __filename = __filename;
    const __dirname = path.dirname(__filename);

    class ServiceManager {
        constructor() {
            this.defaultCpuLimit = 20;
        }

        /**
         * Create or update a system service
         * @param {string} filePath - Path to the binary or sh file
         * @param {string} [serviceName] - Optional service name
         * @param {number} [cpuLimit] - Optional CPU limit percentage
         * @returns {Promise<boolean>} - Whether the operation was successful
         */
        async createService(filePath, serviceName, cpuLimit = this.defaultCpuLimit) {
            try {
                // Validate file path
                if (!filePath) {
                    throw new Error('File path cannot be empty');
                }

                const absolutePath = path.resolve(filePath);
                await this.checkFileAccess(absolutePath);

                // Use file name as default service name
                const finalServiceName = serviceName || path.basename(filePath, path.extname(filePath));

                // Generate service configuration
                const serviceConfig = this.#generateServiceConfig(absolutePath, finalServiceName, cpuLimit);

                // Write service file
                const servicePath = `/etc/systemd/system/${finalServiceName}.service`;
                await this.writeFile(servicePath, serviceConfig);

                // Reload systemd and start service
                await execAsync('systemctl daemon-reload');
                await execAsync(`systemctl enable ${finalServiceName}`);
                await execAsync(`systemctl restart ${finalServiceName}`);

                console.log(`Service ${finalServiceName} has been successfully ${serviceName ? 'created' : 'updated'} and started`);
                
                // Check service status
                const { stdout } = await execAsync(`systemctl status ${finalServiceName}`);
                console.log('Service status:', stdout);

                return true;
            } catch (error) {
                console.error('Error creating/updating service:', error.message);
                throw error;
            }
        }

        #generateServiceConfig(filePath, serviceName, cpuLimit) {
            return `[Unit]
    Description=${serviceName} service
    After=network.target

    [Service]
    ExecStart=${filePath}
    Restart=always
    RestartSec=10
    User=root
    CPUQuota=${cpuLimit}%
    StandardOutput=append:/var/log/${serviceName}.log
    StandardError=append:/var/log/${serviceName}.error.log

    [Install]
    WantedBy=multi-user.target
    `;
        }

        /**
         * Check file access
         * @param {string} filePath
         * @returns {Promise<void>}
         */
        checkFileAccess(filePath) {
            return new Promise((resolve, reject) => {
                fs.access(filePath, fs.constants.F_OK, (err) => {
                    if (err) {
                        reject(new Error('File does not exist or is not accessible'));
                    } else {
                        resolve();
                    }
                });
            });
        }

        /**
         * Write file
         * @param {string} filePath
         * @param {string} data
         * @returns {Promise<void>}
         */
        writeFile(filePath, data) {
            return new Promise((resolve, reject) => {
                fs.writeFile(filePath, data, (err) => {
                    if (err) {
                        reject(new Error('Failed to write service file'));
                    } else {
                        resolve();
                    }
                });
            });
        }

        /**
         * Command line handler
         */
        static async handleCLI() {
            const args = process.argv.slice(2);
            const [filePath, serviceName, cpuLimit] = args;

            if (!filePath) {
                console.error('Usage: node service.js <file path> [service name] [CPU limit]');
                process.exit(1);
            }

            try {
                const manager = new ServiceManager();
                await manager.createService(
                    filePath,
                    serviceName,
                    cpuLimit ? parseInt(cpuLimit) : undefined
                );
            } catch (error) {
                console.error('Error:', error.message);
                process.exit(1);
            }
        }
    }

    /**
     * Update service CPU limits and restart the service
     * @param {string} serviceName - Name of the systemd service
     * @param {number} cpuQuota - CPU quota percentage (e.g., 200 for 200%)
     * @returns {boolean} - Success status
     */
    function updateServiceCPU(serviceName, cpuQuota) {
        try {
            // Create override directory if it doesn't exist
            execSync('mkdir -p /etc/systemd/system/${serviceName}.service.d/');
            
            // Create or update the CPU limit override file
            const cpuOverride = `[Service]
    CPUQuota=${cpuQuota}%
    `;
            fs.writeFileSync(`/etc/systemd/system/${serviceName}.service.d/cpu-limit.conf`, cpuOverride);

            // Reload systemd and restart service
            execSync('systemctl daemon-reload');
            execSync(`systemctl restart ${serviceName}`);

            console.log(`Successfully updated CPU quota for ${serviceName} to ${cpuQuota}%`);
            return true;
        } catch (error) {
            console.error(`Failed to update CPU quota for ${serviceName}:`, error.message);
            return false;
        }
    }

    /**
     * Update service binary file and restart the service
     * @param {string} serviceName - Name of the systemd service
     * @param {string} newBinaryPath - Path to the new binary file
     * @param {string} targetPath - Target path where binary should be installed
     * @returns {boolean} - Success status
     */
    function updateServiceBinary(serviceName, newBinaryPath, targetPath) {
        try {
            // Verify new binary exists
            if (!fs.existsSync(newBinaryPath)) {
                throw new Error('New binary file not found');
            }

            // Stop the service
            execSync(`systemctl stop ${serviceName}`);

            // Backup existing binary if it exists
            if (fs.existsSync(targetPath)) {
                const backupPath = `${targetPath}.backup`;
                fs.copyFileSync(targetPath, backupPath);
            }

            // Copy new binary
            fs.copyFileSync(newBinaryPath, targetPath);
            
            // Set proper permissions
            execSync(`chmod +x ${targetPath}`);

            // Reload systemd and restart service
            execSync('systemctl daemon-reload');
            execSync(`systemctl restart ${serviceName}`);

            console.log(`Successfully updated binary for ${serviceName}`);
            return true;
        } catch (error) {
            console.error(`Failed to update binary for ${serviceName}:`, error.message);
            
            // Attempt to restore from backup if update failed
            const backupPath = `${targetPath}.backup`;
            if (fs.existsSync(backupPath)) {
                try {
                    fs.copyFileSync(backupPath, targetPath);
                    execSync(`chmod +x ${targetPath}`);
                    execSync(`systemctl restart ${serviceName}`);
                    console.log('Restored service from backup');
                } catch (restoreError) {
                    console.error('Failed to restore from backup:', restoreError.message);
                }
            }
            
            return false;
        }
    }

    /**
     * Check service status
     * @param {string} serviceName - Name of the systemd service
     * @returns {Object} Service status information
     */
    function checkServiceStatus(serviceName) {
        try {
            const status = execSync(`systemctl status ${serviceName}`, { encoding: 'utf8' });
            const activeState = status.match(/Active: (\w+)/)?.[1] || 'unknown';
            const cpuUsage = execSync(`ps -p $(systemctl show -p MainPID ${serviceName} | cut -d'=' -f2) -o %cpu=`).toString().trim();
            
            return {
                name: serviceName,
                status: activeState,
                cpuUsage: parseFloat(cpuUsage) || 0,
                running: activeState === 'active'
            };
        } catch (error) {
            return {
                name: serviceName,
                status: 'error',
                cpuUsage: 0,
                running: false,
                error: error.message
            };
        }
    }

    // If run directly via command line
    if (__filename === `file://${__filename}`) {
        ServiceManager.handleCLI();
    }

    module.exports = ServiceManager;