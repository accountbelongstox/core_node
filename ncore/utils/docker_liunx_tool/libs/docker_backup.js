// Docker backup utility
    const Base = require('#@base');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

    class DockerBackup extends Base {
        constructor() {
            super();
            this.backupAddress = ''; // Backup address (local/remote)
            this.autoBackup = false; // Whether auto backup is enabled
            this.autoBackupInterval = 24 * 60 * 60 * 1000; // Auto backup interval, default is 24 hours
        }

        /**
         * Set backup address
         * @param {string} address - Backup address (local/remote)
         */
        setBackupAddress(address) {
            this.backupAddress = address;
        }

        /**
         * Set whether auto backup is enabled
         * @param {boolean} autoBackup - Whether auto backup is enabled
         */
        setAutoBackup(autoBackup) {
            this.autoBackup = autoBackup;
        }

        /**
         * Set auto backup interval
         * @param {number} interval - Auto backup interval in milliseconds
         */
        setAutoBackupInterval(interval) {
            this.autoBackupInterval = interval;
        }

        /**
         * Backup a container by its name, supports Debian9-12, Ubuntu 18-24
         * @param {string} containerName - Container name
         */
        backupContainer(containerName) {
            if (!containerName) {
                throw new Error('Container name is required.');
            }

            const backupPath = path.join(this.backupAddress, `${containerName}-backup.tar`);
            const command = `docker export ${containerName} -o ${backupPath}`;

            try {
                execSync(command, { stdio: 'inherit' });
                console.log(`Backup for container ${containerName} created at ${backupPath}`);
            } catch (error) {
                throw new Error(`Error backing up container ${containerName}: ${error.message}`);
            }
        }

        /**
         * Mount a container by its name, supports Debian9-12, Ubuntu 18-24
         * @param {string} containerName - Container name
         * @param {string} mountPoint - Mount point
         */
        mountContainer(containerName, mountPoint) {
            if (!containerName || !mountPoint) {
                throw new Error('Container name and mount point are required.');
            }

            // Example command to mount a container's volume to the host
            const command = `docker run --rm -v ${mountPoint}:/mnt ${containerName} /bin/bash -c "cp -r /data/* /mnt/"`;

            try {
                execSync(command, { stdio: 'inherit' });
                console.log(`Container ${containerName} mounted to ${mountPoint}`);
            } catch (error) {
                throw new Error(`Error mounting container ${containerName}: ${error.message}`);
            }
        }

        /**
         * Export the current container as an image for backup
         * @param {string} containerName - Container name
         * @param {string} imageName - Image name
         */
        exportContainerAsImage(containerName, imageName) {
            if (!containerName || !imageName) {
                throw new Error('Container name and image name are required.');
            }

            const command = `docker commit ${containerName} ${imageName}`;

            try {
                execSync(command, { stdio: 'inherit' });
                console.log(`Container ${containerName} exported as image ${imageName}`);
            } catch (error) {
                throw new Error(`Error exporting container ${containerName} as image ${imageName}: ${error.message}`);
            }
        }
    }

    module.exports = DockerBackup;