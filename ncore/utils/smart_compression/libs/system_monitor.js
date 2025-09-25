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

const os = require('os');
const fs = require('fs');
const path = require('path');
const { isWindows, isLinux, isMac } = require('#@global_vars');

// Fallback dependencies if not available
let logger, commander;
try {
    logger = require('#@logger');
} catch (e) {
    logger = console;
}

try {
    commander = require('#@commander');
} catch (e) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    commander = {
        exec: promisify(exec),
        execSync: require('child_process').execSync
    };
}

class SystemMonitor {
    constructor() {
        this.cpuUsageHistory = [];
        this.memoryUsageHistory = [];
        this.maxHistoryLength = 10;
        this.monitoringInterval = null;
        this.isMonitoring = false;

        this.startMonitoring();
    }

    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.updateSystemMetrics();
        }, 2000);

        logger.info('System monitoring started');
    }

    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        logger.info('System monitoring stopped');
    }

    async updateSystemMetrics() {
        try {
            const cpuUsage = await this.getCPUUsage();
            const memoryUsage = this.getMemoryUsage();

            this.cpuUsageHistory.push({
                timestamp: Date.now(),
                usage: cpuUsage
            });

            this.memoryUsageHistory.push({
                timestamp: Date.now(),
                usage: memoryUsage
            });

            if (this.cpuUsageHistory.length > this.maxHistoryLength) {
                this.cpuUsageHistory.shift();
            }

            if (this.memoryUsageHistory.length > this.maxHistoryLength) {
                this.memoryUsageHistory.shift();
            }

        } catch (error) {
            logger.warn(`Failed to update system metrics: ${error.message}`);
        }
    }

    async getCPUUsage() {
        try {
            if (isWindows) {
                return await this.getCPUUsageWindows();
            } else if (isLinux || isMac) {
                return await this.getCPUUsageUnix();
            }
        } catch (error) {
            logger.warn(`Failed to get CPU usage: ${error.message}`);
        }

        return this.getCPUUsageFallback();
    }

    async getCPUUsageWindows() {
        try {
            const result = await commander.exec('wmic cpu get loadpercentage /value');
            const match = result.stdout.match(/LoadPercentage=(\d+)/);
            if (match) {
                return parseInt(match[1]);
            }
        } catch (error) {
            logger.warn('Failed to get Windows CPU usage via wmic');
        }

        try {
            const result = await commander.exec('powershell "Get-Counter \'\\Processor(_Total)\\% Processor Time\' | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue"');
            const usage = parseFloat(result.stdout.trim());
            if (!isNaN(usage)) {
                return Math.round(usage);
            }
        } catch (error) {
            logger.warn('Failed to get Windows CPU usage via PowerShell');
        }

        return this.getCPUUsageFallback();
    }

    async getCPUUsageUnix() {
        try {
            if (isLinux) {
                const result = await commander.exec("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'");
                const usage = parseFloat(result.stdout.trim());
                if (!isNaN(usage)) {
                    return Math.round(usage);
                }
            } else if (isMac) {
                const result = await commander.exec("top -l 1 | grep 'CPU usage' | awk '{print $3}' | awk -F'%' '{print $1}'");
                const usage = parseFloat(result.stdout.trim());
                if (!isNaN(usage)) {
                    return Math.round(usage);
                }
            }
        } catch (error) {
            logger.warn('Failed to get Unix CPU usage via top');
        }

        return this.getCPUUsageFallback();
    }

    getCPUUsageFallback() {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - ~~(100 * idle / total);

        return Math.max(0, Math.min(100, usage));
    }

    getMemoryUsage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const usagePercentage = Math.round((usedMemory / totalMemory) * 100);

        return {
            total: totalMemory,
            used: usedMemory,
            free: freeMemory,
            percentage: usagePercentage
        };
    }

    getAverageCPUUsage(minutes = 5) {
        const cutoffTime = Date.now() - (minutes * 60 * 1000);
        const recentUsage = this.cpuUsageHistory.filter(entry => entry.timestamp > cutoffTime);

        if (recentUsage.length === 0) {
            return this.getCurrentCPUUsage();
        }

        const sum = recentUsage.reduce((acc, entry) => acc + entry.usage, 0);
        return Math.round(sum / recentUsage.length);
    }

    getCurrentCPUUsage() {
        if (this.cpuUsageHistory.length === 0) {
            return 0;
        }
        return this.cpuUsageHistory[this.cpuUsageHistory.length - 1].usage;
    }

    getCurrentMemoryUsage() {
        if (this.memoryUsageHistory.length === 0) {
            return this.getMemoryUsage();
        }
        return this.memoryUsageHistory[this.memoryUsageHistory.length - 1].usage;
    }

    isSystemUnderLoad(cpuThreshold = 80, memoryThreshold = 85) {
        const currentCPU = this.getCurrentCPUUsage();
        const currentMemory = this.getCurrentMemoryUsage();
        const avgCPU = this.getAverageCPUUsage(2);

        const highCPU = currentCPU > cpuThreshold || avgCPU > cpuThreshold;
        const highMemory = currentMemory.percentage > memoryThreshold;

        return {
            underLoad: highCPU || highMemory,
            highCPU,
            highMemory,
            currentCPU,
            averageCPU: avgCPU,
            currentMemory: currentMemory.percentage
        };
    }

    getOptimalParallelTasks() {
        const cpuCores = os.cpus().length;
        const currentLoad = this.isSystemUnderLoad();

        if (currentLoad.underLoad) {
            return Math.max(1, Math.floor(cpuCores / 4));
        } else if (currentLoad.currentCPU > 50) {
            return Math.max(1, Math.floor(cpuCores / 2));
        } else {
            return Math.max(1, Math.floor(cpuCores * 0.75));
        }
    }

    shouldUseParallelProcessing(totalSize, sizeThreshold = 100 * 1024 * 1024) {
        const systemLoad = this.isSystemUnderLoad();

        if (systemLoad.underLoad) {
            return false;
        }

        if (totalSize > sizeThreshold) {
            return false;
        }

        return true;
    }

    getStatus() {
        const currentCPU = this.getCurrentCPUUsage();
        const currentMemory = this.getCurrentMemoryUsage();
        const avgCPU = this.getAverageCPUUsage();
        const systemLoad = this.isSystemUnderLoad();
        const optimalTasks = this.getOptimalParallelTasks();

        return {
            cpu: {
                current: currentCPU,
                average: avgCPU,
                cores: os.cpus().length
            },
            memory: {
                total: this.formatBytes(currentMemory.total),
                used: this.formatBytes(currentMemory.used),
                free: this.formatBytes(currentMemory.free),
                percentage: currentMemory.percentage
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                uptime: os.uptime(),
                loadavg: os.loadavg()
            },
            load: systemLoad,
            recommendations: {
                optimalParallelTasks: optimalTasks,
                useParallelProcessing: this.shouldUseParallelProcessing(50 * 1024 * 1024)
            },
            monitoring: {
                isActive: this.isMonitoring,
                historyLength: this.cpuUsageHistory.length
            }
        };
    }

    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    destroy() {
        this.stopMonitoring();
        this.cpuUsageHistory = [];
        this.memoryUsageHistory = [];
    }
}

module.exports = SystemMonitor;
