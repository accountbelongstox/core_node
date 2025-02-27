// Combined monitor functionality
const unifiedMonitor = {
    updateInterval: null,
    systemPanel: null,
    voicePanel: null,
    requestTimeout: 5 * 60 * 1000, // 5-minute timeout
    nextRequestTimer: null,
    isRequestPending: false,
    requestInterval: 20000, // 20-second interval

    // Initialize panels
    initializePanels() {
        // Initialize system monitor panel
        this.systemPanel = document.getElementById('systemMonitorPanel');
        if (this.systemPanel) {
            this.systemPanel.addEventListener('click', (e) => {
                if (e.target.closest('.card-body')) {
                    return;
                }
                this.toggleSystemPanelCollapse();
            });
        }

        // Initialize voice static panel
        this.voicePanel = document.getElementById('voiceStaticPanel');
        if (this.voicePanel) {
            this.voicePanel.addEventListener('click', (e) => {
                if (e.target.closest('.card-body')) {
                    return;
                }
                this.toggleVoicePanelCollapse();
            });
        }
    },

    // Toggle system panel collapse
    toggleSystemPanelCollapse() {
        if (this.systemPanel) {
            this.systemPanel.classList.toggle('collapsed');
        }
    },

    // Toggle voice panel collapse
    toggleVoicePanelCollapse() {
        if (this.voicePanel) {
            this.voicePanel.classList.toggle('collapsed');
        }
    },

    // Format number to fixed decimal places
    formatNumber(num) {
        return parseFloat(num).toFixed(1);
    },

    // Format bytes to appropriate unit
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }
        return `${value.toFixed(1)} ${units[unitIndex]}`;
    },

    // Format time duration
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    },

    // Update timestamp display for system monitor
    updateSystemTimestamp(timestamp) {
        const date = new Date(timestamp);
        document.getElementById('updateTime').textContent =
            `Last update: ${date.toLocaleTimeString()}`;
    },

    // Update timestamp display for voice monitor
    updateVoiceTimestamp(timestamp) {
        const date = new Date(timestamp);
        document.getElementById('voiceUpdateTime').textContent =
            `Last update: ${date.toLocaleTimeString()}`;
    },

    // Update CPU display
    updateCPU(cpuData) {
        if (!cpuData) return;

        // Get CPU usage values
        const userUsage = parseFloat(this.formatNumber(cpuData.us || 0));
        const systemUsage = parseFloat(this.formatNumber(cpuData.sy || 0));
        const idleUsage = parseFloat(this.formatNumber(cpuData.id || 0));

        // Update progress bar with system usage
        const cpuBar = document.getElementById('cpuUsageBar');
        cpuBar.style.width = `${systemUsage}%`;

        // Update all CPU values
        document.getElementById('cpuUser').textContent = userUsage.toFixed(1);
        document.getElementById('cpuSystem').textContent = systemUsage.toFixed(1);
        document.getElementById('cpuIdle').textContent = idleUsage.toFixed(1);
    },

    // Update memory display
    updateMemory(memData) {
        if (!memData) return;

        const totalMem = parseFloat(this.formatNumber(memData.total || 0));
        const freeMem = parseFloat(this.formatNumber(memData.free || 0));
        const usedMem = parseFloat(this.formatNumber(memData.used || 0));
        const buffCache = parseFloat(this.formatNumber(memData['buff/cache'] || 0));

        // Calculate free percentage for progress bar (including cache)
        const freePercent = parseFloat(((freeMem + buffCache) / totalMem * 100).toFixed(1));

        // Format display values
        const totalFormatted = this.formatBytes(totalMem * 1024 * 1024);
        const freeFormatted = this.formatBytes(freeMem * 1024 * 1024);
        const usedFormatted = this.formatBytes(usedMem * 1024 * 1024);
        const cacheFormatted = this.formatBytes(buffCache * 1024 * 1024);

        // Update all memory values
        document.getElementById('memTotal').textContent = totalFormatted;
        document.getElementById('memFree').textContent = freeFormatted;
        document.getElementById('memUsed').textContent = usedFormatted;
        document.getElementById('memCache').textContent = cacheFormatted;

        // Update progress bar (showing free percentage)
        const memBar = document.getElementById('memUsageBar');
        memBar.style.width = `${freePercent}%`;
    },

    // Update task information
    updateTasks(tasksData) {
        if (!tasksData) return;

        // Update all task values
        document.getElementById('tasksTotal').textContent = tasksData.total || 0;
        document.getElementById('tasksRunning').textContent = tasksData.running || 0;
        document.getElementById('tasksSleeping').textContent = tasksData.sleeping || 0;
        document.getElementById('tasksStopped').textContent = tasksData.stopped || 0;
    },

    // Update system status
    updateSystemStatus(summary) {
        if (!summary) return;

        // Update uptime and load average
        document.getElementById('uptime').textContent = summary.uptime || '-';
        const loadAvg = summary['load average']?.undefined;
        document.getElementById('loadAvg').textContent =
            loadAvg ? loadAvg.toFixed(2) : '-';
    },

    // Update voice progress display
    updateVoiceProgress(data) {
        if (!data) return;

        // Update file statistics
        const existingFiles = (data.dictSoundWatcher?.fileNameSet || 0) +
            (data.sentencesSoundWatcher?.fileNameSet || 0);

        // Update index range
        const startIndex = data.wordStartIndex || 0;
        const endIndex = data.wordEndIndex || 0;
        document.getElementById('indexRange').textContent =
            `${startIndex} - ${endIndex}`;

        // Update progress calculation including existing files
        const totalWords = data.wordTotalCount || 0;
        const completedWords = (data.wordSuccessCount || 0);
        const progressPercent = totalWords > 0 ?
            (completedWords / totalWords * 100).toFixed(1) : 0;
        let validVoiceCount = 0;
        if (data.isClient) {
            validVoiceCount = data.wordGeneratedServerTotalCount;
        } else {
            validVoiceCount = data.dictSoundWatcher.fileNameSet;
        }
        console.log(`validVoiceCount : ${validVoiceCount}`);
        validVoiceCount = validVoiceCount > 0 ? validVoiceCount / 2 : 0;

        // Update progress bar
        const progressBar = document.getElementById('wordProgressBar');
        progressBar.style.width = `${progressPercent}%`;

        document.getElementById('existingFiles').textContent = existingFiles + completedWords;
        document.getElementById('role').textContent = data.role;
        document.getElementById('wordTotalCount').textContent = data.wordTotalCount;
        document.getElementById('validVoiceCount').textContent = validVoiceCount.toFixed(0);
        document.getElementById('wordSuccessCount').textContent = completedWords;
        document.getElementById('wordFailedCount').textContent = data.wordFailedCount || 0;
        document.getElementById('wordWaitingCount').textContent = data.wordWaitingCount || 0;

        // Update time statistics
        document.getElementById('totalTime').textContent =
            this.formatDuration(data.wordUsedTime || 0);
        document.getElementById('wordAverageTime').textContent =
            `${(data.wordAverageTime / 1000).toFixed(2)}s`;
    },

    // Update all monitoring data
    updateAll(data, timestamp) {
        if (!data || !data.summary) return;

        this.updateSystemTimestamp(timestamp);
        this.updateVoiceTimestamp(timestamp);
        this.updateSystemStatus(data.summary);
        this.updateCPU(data.summary['%Cpu(s)']);
        this.updateMemory(data.summary['MiB Mem']);
        this.updateTasks(data.summary.Tasks);
        this.updateVoiceProgress(data);
    },

    // Fetch voice status from server
    async fetchVoiceStatus() {
        if (this.isRequestPending) {
            return;
        }

        this.isRequestPending = true;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, this.requestTimeout);

            const response = await fetch('/voice_status', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const result = await response.json();
            if (result.success) {
                this.updateAll(result.data, result.timestamp);
                // Wait 20 seconds after success
                this.scheduleNextRequest(this.requestInterval);
            } else {
                console.error('Failed to fetch voice status:', result.message);
                // Retry immediately after failure
                this.scheduleNextRequest(1000);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('Request timeout after 5 minutes');
            } else {
                console.error('Error fetching voice status:', error);
            }
            // Retry immediately after error
            this.scheduleNextRequest(1000);
        } finally {
            this.isRequestPending = false;
        }
    },

    // Schedule next request with specified delay
    scheduleNextRequest(delay) {
        if (this.nextRequestTimer) {
            clearTimeout(this.nextRequestTimer);
        }
        this.nextRequestTimer = setTimeout(() => {
            this.fetchVoiceStatus();
        }, delay);
    },

    // Start monitoring
    start() {
        this.initializePanels();
        this.fetchVoiceStatus(); // Initial request
    },

    // Stop monitoring
    stop() {
        if (this.nextRequestTimer) {
            clearTimeout(this.nextRequestTimer);
            this.nextRequestTimer = null;
        }
        this.isRequestPending = false;
    }
};

// Start monitoring when page loads
document.addEventListener('DOMContentLoaded', () => {
    unifiedMonitor.start();
});

// Stop monitoring when page unloads
window.addEventListener('beforeunload', () => {
    unifiedMonitor.stop();
});
