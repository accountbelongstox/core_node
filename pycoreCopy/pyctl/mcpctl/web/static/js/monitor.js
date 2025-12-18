/**
 * Monitor Application - Main Entry Point
 *
 * Coordinates RPC client and UI manager to display backend status
 */

class MonitorApp {
    constructor() {
        this.rpcClient = new RPCClient();
        this.uiManager = new UIManager();
        this.updateInterval = null;
        this.backendInfo = null;

        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        this.uiManager.addEvent('Monitor starting...');

        // Register UI event handlers
        this.uiManager.on('action', (data) => this.handleAction(data.action));

        // Start monitoring
        await this.startMonitoring();

        // Set up periodic updates
        this.updateInterval = setInterval(() => {
            this.updateStatus();
        }, 2000); // Update every 2 seconds
    }

    /**
     * Start monitoring - initial data fetch
     */
    async startMonitoring() {
        try {
            // Fetch backend info
            this.backendInfo = await this.rpcClient.getBackendInfo();
            this.uiManager.updateBackendInfo(this.backendInfo);
            this.uiManager.addEvent(`Connected to backend ${this.backendInfo.backend_id}`);

            // Fetch tools list
            const tools = this.backendInfo.tools || [];
            this.uiManager.updateToolsList(tools);
            this.uiManager.addEvent(`Loaded ${tools.length} tools`);

            // Fetch initial state
            await this.updateStatus();

        } catch (error) {
            this.uiManager.addEvent(`Error: ${error.message}`, 'error');
            console.error('Failed to start monitoring:', error);
        }
    }

    /**
     * Update status (called periodically)
     */
    async updateStatus() {
        try {
            // Fetch backend info (to detect replacement)
            const currentInfo = await this.rpcClient.getBackendInfo();

            // Check if backend was replaced
            if (this.backendInfo && currentInfo.backend_id !== this.backendInfo.backend_id) {
                this.uiManager.addEvent(
                    `Backend replaced! Old: ${this.backendInfo.backend_id}, New: ${currentInfo.backend_id}`,
                    'warning'
                );
                this.backendInfo = currentInfo;
                this.uiManager.updateBackendInfo(currentInfo);
            }

            // Fetch processing state
            const state = await this.rpcClient.getBackendState();
            this.uiManager.updateProcessingState(state);

            // Update uptime
            if (currentInfo.start_time) {
                this.uiManager.updateUptime(currentInfo.start_time);
            }

            // Update request count
            this.uiManager.updateRequestCount(this.rpcClient.getTotalCount());

            // Update last update time
            this.uiManager.updateLastUpdate();

        } catch (error) {
            this.uiManager.addEvent(`Update error: ${error.message}`, 'error');
            console.error('Failed to update status:', error);
        }
    }

    /**
     * Handle UI actions
     */
    async handleAction(action) {
        this.uiManager.addEvent(`Action: ${action}`);

        switch (action) {
            case 'refresh':
                await this.startMonitoring();
                break;

            case 'clear-cache':
                try {
                    await this.rpcClient.call('clear_file_cache_tool', {});
                    this.uiManager.addEvent('File cache cleared');
                } catch (error) {
                    this.uiManager.addEvent(`Failed to clear cache: ${error.message}`, 'error');
                }
                break;

            case 'health-check':
                try {
                    const health = await this.rpcClient.healthCheck();
                    this.uiManager.addEvent(`Health check: ${JSON.stringify(health)}`);
                } catch (error) {
                    this.uiManager.addEvent(`Health check failed: ${error.message}`, 'error');
                }
                break;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.monitorApp = new MonitorApp();
});
