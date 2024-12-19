const Base = require('#@base');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

    class DockerControl extends Base {
        constructor() {
            super();
        }

        /**
         * Start/Stop Docker service
         * @param {string} action - 'start' or 'stop'
         */
        controlDockerService(action) {
            const validActions = ['start', 'stop'];
            if (!validActions.includes(action)) {
                throw new Error('Invalid action. Use "start" or "stop".');
            }
            try {
                console.log(`Attempting to ${action} Docker service...`);
                execSync(`systemctl ${action} docker`);
                console.log(`Docker service ${action}ed successfully.`);
            } catch (error) {
                console.error(`Failed to ${action} Docker service`, error);
            }
        }

        /**
         * Get all running Docker containers
         * @returns {Array} Array of container IDs
         */
        getRunningContainers() {
            try {
                const result = execSync(`docker ps --filter "status=running" --format "{{.ID}}"`);
                const containers = result.toString().trim().split('\n');
                return containers.filter(container => container);
            } catch (error) {
                console.error('Failed to get running containers', error);
                return [];
            }
        }

        /**
         * Get all paused Docker containers
         * @returns {Array} Array of container IDs
         */
        getPausedContainers() {
            try {
                const result = execSync(`docker ps --filter "status=paused" --format "{{.ID}}"`);
                const containers = result.toString().trim().split('\n');
                return containers.filter(container => container);
            } catch (error) {
                console.error('Failed to get paused containers', error);
                return [];
            }
        }

        /**
         * Get all stopped Docker containers
         * @returns {Array} Array of container IDs
         */
        getStoppedContainers() {
            try {
                const result = execSync(`docker ps --filter "status=exited" --format "{{.ID}}"`);
                const containers = result.toString().trim().split('\n');
                return containers.filter(container => container);
            } catch (error) {
                console.error('Failed to get stopped containers', error);
                return [];
            }
        }

        /**
         * Start all paused containers
         */
        startPausedContainers() {
            const pausedContainers = this.getPausedContainers();
            pausedContainers.forEach(containerID => {
                try {
                    execSync(`docker unpause ${containerID}`);
                    console.log(`Started paused container: ${containerID}`);
                } catch (error) {
                    console.error(`Failed to start paused container: ${containerID}`, error);
                }
            });
        }

        /**
         * Start all stopped containers
         */
        startStoppedContainers() {
            const stoppedContainers = this.getStoppedContainers();
            stoppedContainers.forEach(containerID => {
                try {
                    execSync(`docker start ${containerID}`);
                    console.log(`Started stopped container: ${containerID}`);
                } catch (error) {
                    console.error(`Failed to start stopped container: ${containerID}`, error);
                }
            });
        }

        /**
         * Get Docker logs
         * @param {string} containerName - Container name
         * @returns {string} Log contents
         */
        getDockerLogs(containerName) {
            try {
                const logs = execSync(`docker logs ${containerName}`).toString();
                return logs;
            } catch (error) {
                console.error(`Failed to get logs for container: ${containerName}`, error);
                return '';
            }
        }

        /**
         * Get Docker error logs
         * @param {string} containerName - Container name
         * @returns {string} Error log contents
         */
        getDockerErrorLogs(containerName) {
            try {
                const logs = execSync(`docker logs ${containerName} 2>&1 | grep -i error`).toString();
                return logs;
            } catch (error) {
                console.error(`Failed to get error logs for container: ${containerName}`, error);
                return '';
            }
        }

        /**
         * Start/Stop/Pause/Restart a Docker container
         * @param {string} containerName - Container name
         * @param {string} action - 'start', 'stop', 'pause', 'restart'
         */
        controlContainer(containerName, action) {
            const validActions = ['start', 'stop', 'pause', 'restart'];
            if (!validActions.includes(action)) {
                throw new Error('Invalid action. Use "start", "stop", "pause", or "restart".');
            }
            try {
                console.log(`Attempting to ${action} container: ${containerName}`);
                execSync(`docker ${action} ${containerName}`);
                console.log(`Container ${containerName} ${action}ed successfully.`);
            } catch (error) {
                console.error(`Failed to ${action} container: ${containerName}`, error);
            }
        }
    }

    module.exports = DockerControl;