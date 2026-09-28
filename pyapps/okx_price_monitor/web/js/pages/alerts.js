/**
 * Trading Alerts Page
 * Displays trading opportunity alerts
 */

(function() {
    'use strict';

    const config = window.AppConfig;
    let currentAlerts = [];
    let alertHistory = [];
    let autoRefreshInterval = null;

    /**
     * Load alerts page
     * @param {HTMLElement} container - Content container
     */
    window.load_alerts = async function(container) {
        console.log('[Alerts] Loading page...');

        // Render initial structure
        renderPageStructure(container);

        // Load initial data
        await loadAlerts();

        // Setup auto-refresh
        setupAutoRefresh();

        // Setup refresh handler
        window.currentPageRefresh = loadAlerts;

        console.log('[Alerts] Page loaded');
    };

    /**
     * Render page structure
     * @param {HTMLElement} container - Content container
     */
    function renderPageStructure(container) {
        container.innerHTML = `
            <div class="alerts-page">
                <!-- Alert Configuration -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Alert Thresholds</h3>
                    </div>
                    <div class="card-body">
                        <div class="stats-grid">
                            <div class="stat-card" style="border-left-color: var(--accent-danger);">
                                <div class="stat-card-title">30 Second Alert</div>
                                <div class="stat-card-value">${config.alerts.thresholds['30s']}%</div>
                                <div class="stat-card-change text-muted">Threshold</div>
                            </div>

                            <div class="stat-card" style="border-left-color: var(--accent-warning);">
                                <div class="stat-card-title">1 Minute Alert</div>
                                <div class="stat-card-value">${config.alerts.thresholds['1m']}%</div>
                                <div class="stat-card-change text-muted">Threshold</div>
                            </div>

                            <div class="stat-card" style="border-left-color: var(--accent-info);">
                                <div class="stat-card-title">2 Minute Alert</div>
                                <div class="stat-card-value">${config.alerts.thresholds['2m']}%</div>
                                <div class="stat-card-change text-muted">Threshold</div>
                            </div>

                            <div class="stat-card">
                                <div class="stat-card-title">Total Alerts</div>
                                <div class="stat-card-value" id="total-alerts-stat">0</div>
                                <div class="stat-card-change text-muted">Currently active</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Active Alerts -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Active Trading Opportunities</h3>
                        <div class="content-actions">
                            <button class="btn btn-primary" id="clear-alerts-btn">
                                <span class="btn-icon">🗑️</span>
                                <span class="btn-text">Clear All</span>
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="active-alerts-container">
                            <p class="text-center text-muted">Loading alerts...</p>
                        </div>
                    </div>
                </div>

                <!-- Alert History -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Recent Alert History</h3>
                    </div>
                    <div class="card-body">
                        <div id="alert-history-container">
                            <p class="no-data">No alert history available</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Setup clear button
        const clearBtn = document.getElementById('clear-alerts-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearAlerts);
        }
    }

    /**
     * Load alerts
     */
    async function loadAlerts() {
        try {
            const result = await window.API.call(config.routes.alerts);

            if (!result.success) {
                throw new Error(result.error || 'Failed to load alerts');
            }

            currentAlerts = result.data.alerts || [];

            // Update stats
            document.getElementById('total-alerts-stat').textContent = currentAlerts.length.toLocaleString();

            // Store in history
            if (currentAlerts.length > 0) {
                alertHistory = [...currentAlerts, ...alertHistory].slice(0, 50);
            }

            // Render alerts
            renderActiveAlerts(currentAlerts);
            renderAlertHistory(alertHistory);

        } catch (error) {
            console.error('[Alerts] Error loading alerts:', error);

            const container = document.getElementById('active-alerts-container');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error:</strong> ${error.message}
                    </div>
                `;
            }
        }
    }

    /**
     * Render active alerts
     * @param {Array} alerts - Alert data
     */
    function renderActiveAlerts(alerts) {
        const container = document.getElementById('active-alerts-container');

        if (!container) return;

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <p>✅ No active alerts</p>
                    <p class="text-muted">All coins are within normal thresholds</p>
                </div>
            `;
            return;
        }

        let alertsHTML = '<div class="alerts-list">';

        alerts.forEach(alert => {
            const isPositive = alert.direction === 'up';
            const bgColor = isPositive ? 'var(--price-up)' : 'var(--price-down)';
            const icon = isPositive ? '📈' : '📉';

            alertsHTML += `
                <div class="alert-item" style="border-left: 4px solid ${bgColor};">
                    <div class="alert-header">
                        <div class="alert-coin">
                            <span class="alert-icon">${icon}</span>
                            <strong>${alert.coin || alert.inst_id}</strong>
                        </div>
                        <div class="alert-time text-muted">
                            ${new Date().toLocaleTimeString()}
                        </div>
                    </div>
                    <div class="alert-details">
                        <div class="alert-change ${isPositive ? 'price-up' : 'price-down'}">
                            ${window.Utils.formatPercent(alert.actual)}
                            in ${alert.window}
                        </div>
                        <div class="alert-price text-muted">
                            Price: ${window.Utils.formatPrice(alert.price)}
                        </div>
                        <div class="alert-threshold text-muted">
                            Threshold: ${alert.threshold}%
                        </div>
                    </div>
                </div>
            `;
        });

        alertsHTML += '</div>';

        alertsHTML += `
            <style>
                .alerts-list {
                    display: grid;
                    gap: var(--spacing-md);
                }

                .alert-item {
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-md);
                    border-left-width: 4px;
                    border-left-style: solid;
                }

                .alert-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-sm);
                }

                .alert-coin {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    font-size: var(--font-lg);
                }

                .alert-icon {
                    font-size: var(--font-xl);
                }

                .alert-details {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--spacing-sm);
                    font-size: var(--font-sm);
                }

                .alert-change {
                    font-size: var(--font-lg);
                    font-weight: 600;
                }
            </style>
        `;

        container.innerHTML = alertsHTML;
    }

    /**
     * Render alert history
     * @param {Array} history - Alert history
     */
    function renderAlertHistory(history) {
        const container = document.getElementById('alert-history-container');

        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = '<p class="no-data">No alert history available</p>';
            return;
        }

        let tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Coin</th>
                        <th>Window</th>
                        <th>Change</th>
                        <th>Direction</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
        `;

        history.slice(0, 20).forEach(alert => {
            const isPositive = alert.direction === 'up';

            tableHTML += `
                <tr>
                    <td class="text-muted">${new Date().toLocaleTimeString()}</td>
                    <td><strong>${alert.coin || alert.inst_id}</strong></td>
                    <td>${alert.window}</td>
                    <td class="${isPositive ? 'price-up' : 'price-down'}">
                        ${window.Utils.formatPercent(alert.actual)}
                    </td>
                    <td>
                        <span class="${isPositive ? 'price-up' : 'price-down'}">
                            ${isPositive ? '📈 Up' : '📉 Down'}
                        </span>
                    </td>
                    <td>${window.Utils.formatPrice(alert.price)}</td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }

    /**
     * Clear alerts
     */
    function clearAlerts() {
        currentAlerts = [];
        alertHistory = [];

        document.getElementById('total-alerts-stat').textContent = '0';
        renderActiveAlerts([]);
        renderAlertHistory([]);

        window.Utils.showNotification('Alerts cleared', 'success');
    }

    /**
     * Setup auto-refresh
     */
    function setupAutoRefresh() {
        autoRefreshInterval = setInterval(() => {
            loadAlerts();
        }, config.ui.refreshInterval);

        console.log('[Alerts] Auto-refresh enabled');
    }

})();

console.log('[Alerts] Trading alerts page module loaded');
