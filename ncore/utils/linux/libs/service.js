import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
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

// If run directly via command line
if (import.meta.url === `file://${__filename}`) {
    ServiceManager.handleCLI();
}

export default ServiceManager;
