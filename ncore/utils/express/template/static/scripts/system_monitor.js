// System monitoring related code
const systemMonitor = {
    updateInterval: null,

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

    // Update timestamp display
    updateTimestamp(timestamp) {
        const date = new Date(timestamp);
        document.getElementById('updateTime').textContent = 
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

    // Update all monitoring data
    updateAll(data) {
        if (!data || !data.summary) return;
        
        this.updateSystemStatus(data.summary);
        this.updateCPU(data.summary['%Cpu(s)']);
        this.updateMemory(data.summary['MiB Mem']);
        this.updateTasks(data.summary.Tasks);
    },

    // Fetch system load data from server
    async fetchSystemLoad() {
        try {
            const response = await fetch('/systemload');
            const result = await response.json();
            
            if (result.success) {
                this.updateTimestamp(result.timestamp);
                this.updateAll(result.data);
            } else {
                console.error('Failed to fetch system load:', result.message);
            }
        } catch (error) {
            console.error('Error fetching system load:', error);
        }
    },

    // Start monitoring
    start() {
        this.fetchSystemLoad(); // Execute immediately
        this.updateInterval = setInterval(() => this.fetchSystemLoad(), 10000);
    },

    // Stop monitoring
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
};

// Panel collapse functionality
const systemMonitorPanel = {
    panel: null,
    
    initialize() {
        this.panel = document.getElementById('systemMonitorPanel');
        if (this.panel) {
            this.panel.addEventListener('click', (e) => {
                // Don't collapse if clicking inside the content area
                if (e.target.closest('.card-body')) {
                    return;
                }
                this.toggleCollapse();
            });
        }
    },
    
    toggleCollapse() {
        if (this.panel) {
            this.panel.classList.toggle('collapsed');
        }
    }
};

// Start monitoring when page loads
document.addEventListener('DOMContentLoaded', () => {
    systemMonitor.start();
    systemMonitorPanel.initialize();
});

// Stop monitoring when page unloads
window.addEventListener('beforeunload', () => {
    systemMonitor.stop();
});