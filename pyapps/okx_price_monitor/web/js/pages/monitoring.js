/**
 * Real-time Monitoring Page
 * Displays live price updates and changes
 */

(function() {
    'use strict';

    const config = window.AppConfig;
    let currentData = null;
    let autoRefreshInterval = null;
    let sortColumn = 'coin_symbol';
    let sortDirection = 'asc';

    /**
     * Load monitoring page
     * @param {HTMLElement} container - Content container
     */
    window.load_monitoring = async function(container) {
        console.log('[Monitoring] Loading page...');

        // Render initial structure
        renderPageStructure(container);

        // Load initial data
        await loadData();

        // Setup auto-refresh
        setupAutoRefresh();

        // Setup refresh handler
        window.currentPageRefresh = loadData;

        console.log('[Monitoring] Page loaded');
    };

    /**
     * Render page structure
     * @param {HTMLElement} container - Content container
     */
    function renderPageStructure(container) {
        container.innerHTML = `
            <div class="monitoring-page">
                <!-- Summary Stats -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-card-title">Active Coins</div>
                        <div class="stat-card-value" id="active-coins-stat">-</div>
                        <div class="stat-card-change text-muted">Real-time tracking</div>
                    </div>

                    <div class="stat-card" style="border-left-color: var(--price-up);">
                        <div class="stat-card-title">Top Gainer</div>
                        <div class="stat-card-value price-up" id="top-gainer-stat">-</div>
                        <div class="stat-card-change text-muted" id="top-gainer-coin">-</div>
                    </div>

                    <div class="stat-card" style="border-left-color: var(--price-down);">
                        <div class="stat-card-title">Top Loser</div>
                        <div class="stat-card-value price-down" id="top-loser-stat">-</div>
                        <div class="stat-card-change text-muted" id="top-loser-coin">-</div>
                    </div>

                    <div class="stat-card" style="border-left-color: var(--accent-info);">
                        <div class="stat-card-title">Last Update</div>
                        <div class="stat-card-value" id="last-update-stat">-</div>
                        <div class="stat-card-change text-muted">Seconds ago</div>
                    </div>
                </div>

                <!-- Price Table -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Real-time Price Monitor</h3>
                        <div class="content-actions">
                            <button class="btn btn-primary" id="toggle-auto-refresh">
                                <span class="btn-icon">⏸️</span>
                                <span class="btn-text">Pause Updates</span>
                            </button>
                        </div>
                    </div>

                    <div class="card-body">
                        <div id="price-table-container">
                            <p class="text-center text-muted">Loading price data...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Setup auto-refresh toggle
        const toggleBtn = document.getElementById('toggle-auto-refresh');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleAutoRefresh);
        }
    }

    /**
     * Load monitoring data
     */
    async function loadData() {
        try {
            const result = await window.API.call(config.routes.allSummaries, { limit: config.ui.maxCoinsDisplay });

            if (!result.success) {
                throw new Error(result.error || 'Failed to load data');
            }

            currentData = result.data.summaries || [];

            // Update stats
            updateSummaryStats(currentData);

            // Render table
            renderPriceTable(currentData);

        } catch (error) {
            console.error('[Monitoring] Error loading data:', error);

            const container = document.getElementById('price-table-container');
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
     * Update summary statistics
     * @param {Array} data - Coin summaries
     */
    function updateSummaryStats(data) {
        // Active coins
        document.getElementById('active-coins-stat').textContent = data.length.toLocaleString();

        // Find top gainer and loser (based on 1min change)
        let topGainer = null;
        let topLoser = null;

        data.forEach(coin => {
            const change1m = coin.changes && coin.changes['1m'] ? coin.changes['1m'].change_pct : null;

            if (change1m !== null) {
                if (!topGainer || change1m > topGainer.change) {
                    topGainer = { coin: coin.coin_symbol, change: change1m };
                }

                if (!topLoser || change1m < topLoser.change) {
                    topLoser = { coin: coin.coin_symbol, change: change1m };
                }
            }
        });

        // Update top gainer
        if (topGainer) {
            document.getElementById('top-gainer-stat').textContent = window.Utils.formatPercent(topGainer.change);
            document.getElementById('top-gainer-coin').textContent = topGainer.coin;
        }

        // Update top loser
        if (topLoser) {
            document.getElementById('top-loser-stat').textContent = window.Utils.formatPercent(topLoser.change);
            document.getElementById('top-loser-coin').textContent = topLoser.coin;
        }

        // Update last update time
        document.getElementById('last-update-stat').textContent = new Date().toLocaleTimeString();
    }

    /**
     * Render price table
     * @param {Array} data - Coin summaries
     */
    function renderPriceTable(data) {
        const container = document.getElementById('price-table-container');

        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = '<p class="no-data">No price data available</p>';
            return;
        }

        // Sort data
        const sortedData = sortData(data, sortColumn, sortDirection);

        // Build table HTML
        let tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th class="table-header-sortable" data-column="coin_symbol">
                            Coin ${getSortIcon('coin_symbol')}
                        </th>
                        <th class="table-header-sortable" data-column="current_price">
                            Current Price ${getSortIcon('current_price')}
                        </th>
                        <th class="table-header-sortable" data-column="change_30s">
                            30s ${getSortIcon('change_30s')}
                        </th>
                        <th class="table-header-sortable" data-column="change_1m">
                            1min ${getSortIcon('change_1m')}
                        </th>
                        <th class="table-header-sortable" data-column="change_2m">
                            2min ${getSortIcon('change_2m')}
                        </th>
                        <th>Trend</th>
                        <th>Last Update</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedData.forEach(coin => {
            const change30s = coin.changes && coin.changes['30s'] ? coin.changes['30s'].change_pct : null;
            const change1m = coin.changes && coin.changes['1m'] ? coin.changes['1m'].change_pct : null;
            const change2m = coin.changes && coin.changes['2m'] ? coin.changes['2m'].change_pct : null;
            const trend1m = coin.trends && coin.trends['1m'] ? coin.trends['1m'] : 'flat';

            tableHTML += `
                <tr>
                    <td><strong>${coin.coin_symbol || '-'}</strong></td>
                    <td>${window.Utils.formatPrice(coin.current_price)}</td>
                    <td>${formatPriceChange(change30s)}</td>
                    <td>${formatPriceChange(change1m)}</td>
                    <td>${formatPriceChange(change2m)}</td>
                    <td>${formatTrend(trend1m)}</td>
                    <td class="text-muted">${window.Utils.formatRelativeTime(coin.last_update)}</td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;

        // Setup sort handlers
        setupSortHandlers();
    }

    /**
     * Format price change
     * @param {number} change - Change percentage
     * @returns {string} Formatted HTML
     */
    function formatPriceChange(change) {
        if (change === null || change === undefined) {
            return '<span class="text-muted">-</span>';
        }

        const className = window.Utils.getPriceChangeClass(change);
        const formatted = window.Utils.formatPercent(change);

        return `<span class="${className}">${formatted}</span>`;
    }

    /**
     * Format trend indicator
     * @param {string} trend - Trend value
     * @returns {string} Formatted HTML
     */
    function formatTrend(trend) {
        const icons = {
            up: '📈',
            down: '📉',
            flat: '➡️'
        };

        const colors = {
            up: 'price-up',
            down: 'price-down',
            flat: 'text-muted'
        };

        return `<span class="${colors[trend] || 'text-muted'}">${icons[trend] || '➡️'}</span>`;
    }

    /**
     * Sort data
     * @param {Array} data - Data to sort
     * @param {string} column - Sort column
     * @param {string} direction - Sort direction
     * @returns {Array} Sorted data
     */
    function sortData(data, column, direction) {
        return [...data].sort((a, b) => {
            let aVal, bVal;

            // Handle nested values for changes
            if (column.startsWith('change_')) {
                const window = column.replace('change_', '');
                aVal = a.changes && a.changes[window] ? a.changes[window].change_pct : null;
                bVal = b.changes && b.changes[window] ? b.changes[window].change_pct : null;
            } else {
                aVal = a[column];
                bVal = b[column];
            }

            if (aVal === null || aVal === undefined) aVal = 0;
            if (bVal === null || bVal === undefined) bVal = 0;

            if (typeof aVal === 'string') {
                return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            } else {
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
        });
    }

    /**
     * Get sort icon
     * @param {string} column - Column name
     * @returns {string} Icon HTML
     */
    function getSortIcon(column) {
        if (sortColumn !== column) {
            return '<span class="sort-icon">↕</span>';
        }

        return sortDirection === 'asc'
            ? '<span class="sort-icon">↑</span>'
            : '<span class="sort-icon">↓</span>';
    }

    /**
     * Setup sort handlers
     */
    function setupSortHandlers() {
        document.querySelectorAll('.table-header-sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;

                if (sortColumn === column) {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumn = column;
                    sortDirection = 'asc';
                }

                renderPriceTable(currentData);
            });
        });
    }

    /**
     * Setup auto-refresh
     */
    function setupAutoRefresh() {
        autoRefreshInterval = setInterval(() => {
            loadData();
        }, config.ui.refreshInterval);

        console.log('[Monitoring] Auto-refresh enabled');
    }

    /**
     * Toggle auto-refresh
     */
    function toggleAutoRefresh() {
        const btn = document.getElementById('toggle-auto-refresh');

        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;

            if (btn) {
                btn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Resume Updates</span>';
            }

            window.Utils.showNotification('Auto-refresh paused', 'info');
        } else {
            setupAutoRefresh();

            if (btn) {
                btn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Pause Updates</span>';
            }

            window.Utils.showNotification('Auto-refresh resumed', 'success');
        }
    }

})();

console.log('[Monitoring] Real-time monitoring page module loaded');
