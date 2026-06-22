/**
 * System Statistics Page
 * Display system performance and statistics
 */

(function() {
    'use strict';

    const config = window.AppConfig;
    let currentStats = null;
    let autoRefreshInterval = null;

    /**
     * Load stats page
     * @param {HTMLElement} container - Content container
     */
    window.load_stats = async function(container) {
        console.log('[Stats] Loading page...');

        // Render initial structure
        renderPageStructure(container);

        // Load stats
        await loadStats();

        // Setup auto-refresh
        setupAutoRefresh();

        // Setup refresh handler
        window.currentPageRefresh = loadStats;

        console.log('[Stats] Page loaded');
    };

    /**
     * Render page structure
     * @param {HTMLElement} container - Content container
     */
    function renderPageStructure(container) {
        container.innerHTML = `
            <div class="stats-page">
                <!-- System Overview -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-card-title">Total Coins</div>
                        <div class="stat-card-value" id="sys-total-coins">-</div>
                        <div class="stat-card-change text-muted">Tracked coins</div>
                    </div>

                    <div class="stat-card" style="border-left-color: var(--accent-secondary);">
                        <div class="stat-card-title">Initialized Coins</div>
                        <div class="stat-card-value" id="sys-init-coins">-</div>
                        <div class="stat-card-change text-muted">With historical data</div>
                    </div>

                    <div class="stat-card" style="border-left-color: var(--accent-success);">
                        <div class="stat-card-title">System Status</div>
                        <div class="stat-card-value" id="sys-status">-</div>
                        <div class="stat-card-change text-muted" id="sys-status-detail">-</div>
                    </div>

                    <div class="stat-card" style="border-left-color: var(--accent-warning);">
                        <div class="stat-card-title">Request Rate</div>
                        <div class="stat-card-value" id="sys-request-rate">-</div>
                        <div class="stat-card-change text-muted">Per 3 seconds</div>
                    </div>
                </div>

                <!-- Rate Limiter Stats -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Rate Limiter Statistics</h3>
                    </div>
                    <div class="card-body">
                        <div id="rate-limiter-container">
                            <p class="text-center text-muted">Loading rate limiter stats...</p>
                        </div>
                    </div>
                </div>

                <!-- Timestamp Interceptor Stats -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Timestamp Interceptor Statistics</h3>
                    </div>
                    <div class="card-body">
                        <div id="interceptor-container">
                            <p class="text-center text-muted">Loading interceptor stats...</p>
                        </div>
                    </div>
                </div>

                <!-- System Information -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">System Information</h3>
                    </div>
                    <div class="card-body">
                        <div id="system-info-container">
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-card-title">Application</div>
                                    <div class="stat-card-value">${config.appName}</div>
                                    <div class="stat-card-change text-muted">Version ${config.version}</div>
                                </div>

                                <div class="stat-card">
                                    <div class="stat-card-title">API Endpoint</div>
                                    <div class="stat-card-value">${config.api.baseUrl}${config.api.rpcPath}</div>
                                    <div class="stat-card-change text-muted">RPC v2</div>
                                </div>

                                <div class="stat-card">
                                    <div class="stat-card-title">Refresh Interval</div>
                                    <div class="stat-card-value">${config.ui.refreshInterval / 1000}s</div>
                                    <div class="stat-card-change text-muted">Auto-refresh rate</div>
                                </div>

                                <div class="stat-card">
                                    <div class="stat-card-title">Max Display</div>
                                    <div class="stat-card-value">${config.ui.maxCoinsDisplay}</div>
                                    <div class="stat-card-change text-muted">Coins shown</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Load statistics
     */
    async function loadStats() {
        try {
            const result = await window.API.call(config.routes.stats);

            if (!result.success) {
                throw new Error(result.error || 'Failed to load statistics');
            }

            currentStats = result.data || {};

            // Update overview
            updateOverview(currentStats);

            // Update rate limiter stats
            updateRateLimiterStats(currentStats.rate_limiter || {});

            // Update interceptor stats
            updateInterceptorStats(currentStats.interceptor || {});

        } catch (error) {
            console.error('[Stats] Error loading statistics:', error);

            const containers = [
                'rate-limiter-container',
                'interceptor-container'
            ];

            containers.forEach(containerId => {
                const container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = `
                        <div class="alert alert-danger">
                            <strong>Error:</strong> ${error.message}
                        </div>
                    `;
                }
            });
        }
    }

    /**
     * Update overview stats
     * @param {object} stats - System stats
     */
    function updateOverview(stats) {
        // Total coins
        const totalCoins = stats.total_coins || 0;
        document.getElementById('sys-total-coins').textContent = totalCoins.toLocaleString();

        // Initialized coins
        const initCoins = stats.initialized_coins || 0;
        document.getElementById('sys-init-coins').textContent = initCoins.toLocaleString();

        // System status
        const running = stats.running || false;
        const statusEl = document.getElementById('sys-status');
        const statusDetailEl = document.getElementById('sys-status-detail');

        if (running) {
            statusEl.textContent = 'Active';
            statusEl.className = 'stat-card-value price-up';
            statusDetailEl.textContent = 'Monitoring in progress';
        } else {
            statusEl.textContent = 'Idle';
            statusEl.className = 'stat-card-value text-muted';
            statusDetailEl.textContent = 'Ready to start';
        }

        // Request rate
        const rateLimiter = stats.rate_limiter || {};
        const requestRate = rateLimiter.requests_per_window || 0;
        document.getElementById('sys-request-rate').textContent = requestRate;
    }

    /**
     * Update rate limiter stats
     * @param {object} rateLimiterStats - Rate limiter statistics
     */
    function updateRateLimiterStats(rateLimiterStats) {
        const container = document.getElementById('rate-limiter-container');

        if (!container) return;

        let html = '<div class="stats-grid">';

        // Max requests
        html += `
            <div class="stat-card">
                <div class="stat-card-title">Max Requests</div>
                <div class="stat-card-value">${rateLimiterStats.max_requests || 20}</div>
                <div class="stat-card-change text-muted">Per window</div>
            </div>
        `;

        // Time window
        html += `
            <div class="stat-card">
                <div class="stat-card-title">Time Window</div>
                <div class="stat-card-value">${rateLimiterStats.time_window || 3.0}s</div>
                <div class="stat-card-change text-muted">Seconds</div>
            </div>
        `;

        // Current requests
        html += `
            <div class="stat-card">
                <div class="stat-card-title">Current Requests</div>
                <div class="stat-card-value">${rateLimiterStats.requests_per_window || 0}</div>
                <div class="stat-card-change text-muted">In current window</div>
            </div>
        `;

        // Total requests
        html += `
            <div class="stat-card">
                <div class="stat-card-title">Total Requests</div>
                <div class="stat-card-value">${(rateLimiterStats.total_requests || 0).toLocaleString()}</div>
                <div class="stat-card-change text-muted">All time</div>
            </div>
        `;

        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Update interceptor stats
     * @param {object} interceptorStats - Interceptor statistics
     */
    function updateInterceptorStats(interceptorStats) {
        const container = document.getElementById('interceptor-container');

        if (!container) return;

        let html = '<div class="stats-grid">';

        // Total coins tracked
        html += `
            <div class="stat-card">
                <div class="stat-card-title">Coins Tracked</div>
                <div class="stat-card-value">${(interceptorStats.coins_tracked || 0).toLocaleString()}</div>
                <div class="stat-card-change text-muted">Unique coins</div>
            </div>
        `;

        // Total records filtered
        html += `
            <div class="stat-card">
                <div class="stat-card-title">Records Filtered</div>
                <div class="stat-card-value">${(interceptorStats.records_filtered || 0).toLocaleString()}</div>
                <div class="stat-card-change text-muted">Duplicates skipped</div>
            </div>
        `;

        // Total records passed
        html += `
            <div class="stat-card">
                <div class="stat-card-title">Records Passed</div>
                <div class="stat-card-value">${(interceptorStats.records_passed || 0).toLocaleString()}</div>
                <div class="stat-card-change text-muted">New records</div>
            </div>
        `;

        // Filter efficiency
        const filtered = interceptorStats.records_filtered || 0;
        const passed = interceptorStats.records_passed || 0;
        const total = filtered + passed;
        const efficiency = total > 0 ? ((filtered / total) * 100).toFixed(1) : 0;

        html += `
            <div class="stat-card">
                <div class="stat-card-title">Filter Efficiency</div>
                <div class="stat-card-value">${efficiency}%</div>
                <div class="stat-card-change text-muted">Duplicates detected</div>
            </div>
        `;

        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Setup auto-refresh
     */
    function setupAutoRefresh() {
        autoRefreshInterval = setInterval(() => {
            loadStats();
        }, config.ui.refreshInterval);

        console.log('[Stats] Auto-refresh enabled');
    }

})();

console.log('[Stats] System statistics page module loaded');
