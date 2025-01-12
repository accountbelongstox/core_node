const voiceMonitor = {
    updateInterval: null,

    // Format time duration
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    },

    // Update timestamp display
    updateTimestamp(timestamp) {
        const date = new Date(timestamp);
        document.getElementById('voiceUpdateTime').textContent = 
            `Last update: ${date.toLocaleTimeString()}`;
    },

    // Update progress display
    updateProgress(data) {
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
        const totalWords = data.wordCount || 0;
        const completedWords = (data.wordSuccessCount || 0);
        const progressPercent = totalWords > 0 ? 
            (completedWords / totalWords * 100).toFixed(1) : 0;

        // Update progress bar
        const progressBar = document.getElementById('wordProgressBar');
        progressBar.style.width = `${progressPercent}%`;

        document.getElementById('existingFiles').textContent = existingFiles + completedWords;
        document.getElementById('role').textContent = data.role;
        // Update count displays
        document.getElementById('wordTotalCount').textContent = data.wordTotalCount;
        document.getElementById('validCount').textContent = (totalWords / 2).toFixed(0);
        document.getElementById('wordSuccessCount').textContent = completedWords;
        document.getElementById('wordFailedCount').textContent = data.wordFailedCount || 0;
        document.getElementById('wordWaitingCount').textContent = data.wordWaitingCount || 0;

        // Update time statistics
        document.getElementById('totalTime').textContent = 
            this.formatDuration(data.wordUsedTime || 0);
        document.getElementById('wordAverageTime').textContent = 
            `${(data.wordAverageTime / 1000).toFixed(2)}s`;
    },

    // Fetch voice status from server
    async fetchVoiceStatus() {
        try {
            const response = await fetch('/voice_status');
            const result = await response.json();
            
            if (result.success) {
                this.updateTimestamp(result.timestamp);
                this.updateProgress(result.data);
            } else {
                console.error('Failed to fetch voice status:', result.message);
            }
        } catch (error) {
            console.error('Error fetching voice status:', error);
        }
    },

    // Start monitoring
    start() {
        this.fetchVoiceStatus(); // Execute immediately
        this.updateInterval = setInterval(() => this.fetchVoiceStatus(), 20000);
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
const voiceStaticPanel = {
    panel: null,
    
    initialize() {
        this.panel = document.getElementById('voiceStaticPanel');
        if (this.panel) {
            this.panel.addEventListener('click', (e) => {
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
    voiceMonitor.start();
    voiceStaticPanel.initialize();
});

// Stop monitoring when page unloads
window.addEventListener('beforeunload', () => {
    voiceMonitor.stop();
});
