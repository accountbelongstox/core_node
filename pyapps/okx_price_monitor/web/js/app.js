/**
 * Main Application Entry Point
 * Initializes and coordinates all modules
 */

(function() {
    'use strict';

    const config = window.AppConfig;
    let monitoringActive = false;
    let statsUpdateInterval = null;

    /**
     * Initialize application
     */
    async function init() {
        console.log(`[App] Initializing ${config.appName} v${config.version}...`);

        try {
            // Initialize layout system
            if (window.AppLayout) {
                window.AppLayout.init();
            }

            // Initialize menu system
            if (window.AppMenu) {
                window.AppMenu.init();
            }

            // Setup top menu buttons
            setupTopMenuButtons();

            // Setup right panel auto-refresh
            setupStatsRefresh();

            // Check connection status
            await checkConnectionStatus();

            console.log('[App] Application initialized successfully');

        } catch (error) {
            console.error('[App] Initialization error:', error);
            showError('Failed to initialize application: ' + error.message);
        }
    }

    /**
     * Setup top menu buttons
     */
    function setupTopMenuButtons() {
        const startBtn = document.getElementById('btn-start-monitoring');
        const stopBtn = document.getElementById('btn-stop-monitoring');
        const refreshBtn = document.getElementById('btn-refresh');

        if (startBtn) {
            startBtn.addEventListener('click', handleStartMonitoring);
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', handleStopMonitoring);
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', handleRefresh);
        }

        // Initial button states
        updateMonitoringButtonStates();
    }

    /**
     * Handle start monitoring
     */
    async function handleStartMonitoring() {
        console.log('[App] Starting monitoring...');

        try {
            window.AppLayout.showLoading('Starting monitoring...');

            const result = await window.API.call(config.routes.startMonitoring);

            if (result.success) {
                monitoringActive = true;
                updateMonitoringButtonStates();
                updateConnectionStatus(true, 'Monitoring Active');
                window.Utils.showNotification('Monitoring started successfully', 'success');
            } else {
                throw new Error(result.error || 'Failed to start monitoring');
            }

        } catch (error) {
            console.error('[App] Start monitoring error:', error);
            window.Utils.showNotification('Failed to start monitoring: ' + error.message, 'error');
        } finally {
            window.AppLayout.hideLoading();
        }
    }

    /**
     * Handle stop monitoring
     */
    async function handleStopMonitoring() {
        console.log('[App] Stopping monitoring...');

        try {
            window.AppLayout.showLoading('Stopping monitoring...');

            const result = await window.API.call(config.routes.stopMonitoring);

            if (result.success) {
                monitoringActive = false;
                updateMonitoringButtonStates();
                updateConnectionStatus(true, 'Monitoring Stopped');
                window.Utils.showNotification('Monitoring stopped', 'info');
            } else {
                throw new Error(result.error || 'Failed to stop monitoring');
            }

        } catch (error) {
            console.error('[App] Stop monitoring error:', error);
            window.Utils.showNotification('Failed to stop monitoring: ' + error.message, 'error');
        } finally {
            window.AppLayout.hideLoading();
        }
    }

    /**
     * Handle refresh button
     */
    function handleRefresh() {
        console.log('[App] Refresh triggered');

        // Trigger page-specific refresh
        if (window.currentPageRefresh) {
            window.currentPageRefresh();
        }

        // Refresh stats
        updateStats();
    }

    /**
     * Update monitoring button states
     */
    function updateMonitoringButtonStates() {
        const startBtn = document.getElementById('btn-start-monitoring');
        const stopBtn = document.getElementById('btn-stop-monitoring');

        if (startBtn) {
            startBtn.disabled = monitoringActive;
        }

        if (stopBtn) {
            stopBtn.disabled = !monitoringActive;
        }
    }

    /**
     * Setup stats auto-refresh
     */
    function setupStatsRefresh() {
        // Update immediately
        updateStats();

        // Setup interval
        statsUpdateInterval = setInterval(() => {
            updateStats();
        }, config.ui.refreshInterval);

        console.log('[App] Stats auto-refresh enabled');
    }

    /**
     * Update stats in right panel
     */
    async function updateStats() {
        try {
            const result = await window.API.call(config.routes.stats);

            if (result.success) {
                const stats = result.data;

                // Update total coins (use new ID from index.html)
                const totalCoinsEl = document.getElementById('stat-total-coins');
                if (totalCoinsEl && stats.total_coins !== undefined) {
                    totalCoinsEl.textContent = stats.total_coins.toLocaleString();
                }

                // Update active alerts (placeholder)
                const activeAlertsEl = document.getElementById('stat-active-alerts');
                if (activeAlertsEl) {
                    activeAlertsEl.textContent = '0';
                }

                // Update monitoring status
                const monitoringStatusEl = document.getElementById('stat-monitoring-status');
                if (monitoringStatusEl) {
                    monitoringStatusEl.textContent = stats.running ? 'Active' : 'Stopped';
                    monitoringStatusEl.className = 'stat-value ' + (stats.running ? 'price-up' : 'text-muted');
                }

                // Update rate
                const updateRateEl = document.getElementById('stat-update-rate');
                if (updateRateEl && stats.rate_limiter) {
                    const rate = stats.rate_limiter.requests_per_window || 0;
                    updateRateEl.textContent = `${rate}/3s`;
                }

                // Update last update time
                const lastUpdateEl = document.getElementById('stat-last-update');
                if (lastUpdateEl) {
                    lastUpdateEl.textContent = new Date().toLocaleTimeString();
                }

                // Update system status
                updateSystemStatus(stats);

            }

        } catch (error) {
            console.warn('[App] Stats update error:', error);
        }
    }

    /**
     * Update system status
     * @param {object} stats - System stats
     */
    function updateSystemStatus(stats) {
        const statusEl = document.getElementById('system-status');

        if (statusEl) {
            if (stats.running) {
                statusEl.textContent = 'Monitoring Active';
                statusEl.className = 'text-success';
            } else {
                statusEl.textContent = 'System Ready';
                statusEl.className = '';
            }
        }

        // Update footer status
        const footerStatusEl = document.getElementById('footer-status');
        if (footerStatusEl) {
            footerStatusEl.textContent = stats.running ? 'Monitoring Active' : 'System Ready';
        }
    }

    /**
     * Check connection status
     */
    async function checkConnectionStatus() {
        try {
            const result = await window.API.call(config.routes.stats);

            if (result.success) {
                updateConnectionStatus(true, 'Connected');

                // Update monitoring state
                if (result.data && result.data.running !== undefined) {
                    monitoringActive = result.data.running;
                    updateMonitoringButtonStates();
                }
            } else {
                updateConnectionStatus(false, 'Connection Error');
            }

        } catch (error) {
            console.error('[App] Connection check error:', error);
            updateConnectionStatus(false, 'Disconnected');
        }
    }

    /**
     * Update connection status indicator
     * @param {boolean} connected - Connection status
     * @param {string} text - Status text
     */
    function updateConnectionStatus(connected, text) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');

        if (statusDot) {
            statusDot.className = 'status-dot ' + (connected ? 'online' : '');
        }

        if (statusText) {
            statusText.textContent = text;
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    function showError(message) {
        const container = document.getElementById('page-container');

        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error:</strong> ${window.Utils.escapeHtml(message)}
                </div>
            `;
        }

        window.Utils.showNotification(message, 'error', 5000);
    }

    /**
     * Cleanup on page unload
     */
    function cleanup() {
        if (statsUpdateInterval) {
            clearInterval(statsUpdateInterval);
        }

        console.log('[App] Cleanup completed');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on unload
    window.addEventListener('beforeunload', cleanup);

    // Expose app functions to window
    window.App = {
        init,
        handleRefresh,
        updateStats,
        checkConnectionStatus
    };

})();

console.log('[App] Main application module loaded');
