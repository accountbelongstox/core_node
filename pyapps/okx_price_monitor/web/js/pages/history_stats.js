/**
 * History Statistics Page
 * Displays coin history loading statistics
 */

(function() {
    'use strict';

    const config = window.AppConfig;
    let currentData = null;
    let sortColumn = 'coin_symbol';
    let sortDirection = 'asc';

    /**
     * Load history statistics page
     * @param {HTMLElement} container - Content container
     */
    window.load_history_stats = async function(container) {
        console.log('[HistoryStats] Loading page...');

        // Render initial HTML structure
        renderPageStructure(container);

        // Load data
        await loadData();

        // Setup refresh handler
        window.currentPageRefresh = loadData;

        console.log('[HistoryStats] Page loaded');
    };

    /**
     * Render page structure
     * @param {HTMLElement} container - Content container
     */
    function renderPageStructure(container) {
        container.innerHTML = `
            <div class="history-stats-page">
                <!-- Summary Cards -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-card-title">Total Coins Tracked</div>
                        <div class="stat-card-value" id="total-coins-stat">-</div>
                        <div class="stat-card-change text-muted">Database records loaded</div>
                    </div>

                    <div class="stat-card" style="border-left-color: var(--accent-secondary);">
                        <div class="stat-card-title">Total Records</div>
                        <div class="stat-card-value" id="total-records-stat">-</div>
                        <div class="stat-card-change text-muted">From database</div>
                    </div>

                    <div class="stat-card" style="border-left-color: var(--accent-warning);">
                        <div class="stat-card-title">History Duration</div>
                        <div class="stat-card-value" id="history-hours-stat">-</div>
                        <div class="stat-card-change text-muted">Hours of historical data</div>
                    </div>

                    <div class="stat-card" style="border-left-color: var(--accent-info);">
                        <div class="stat-card-title">Average Records/Coin</div>
                        <div class="stat-card-value" id="avg-records-stat">-</div>
                        <div class="stat-card-change text-muted">Mean value</div>
                    </div>
                </div>

                <!-- Coin Details Table -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Coin History Details</h3>
                        <div class="content-actions">
                            <button class="btn btn-primary" id="export-btn">
                                <span class="btn-icon">📥</span>
                                <span class="btn-text">Export CSV</span>
                            </button>
                        </div>
                    </div>

                    <div class="card-body">
                        <div id="table-container">
                            <p class="text-center text-muted">Loading data...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Setup export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportToCSV);
        }
    }

    /**
     * Load statistics data
     */
    async function loadData() {
        try {
            console.log('[HistoryStats] Loading data from API...');

            window.AppLayout.showLoading('Loading history statistics...');

            // Get summaries for all coins
            const result = await window.API.getCoinsSummaries();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load data');
            }

            currentData = result.data || [];

            console.log(`[HistoryStats] Loaded ${currentData.length} coin summaries`);

            // Update summary cards
            updateSummaryCards(currentData);

            // Render table
            renderTable(currentData);

        } catch (error) {
            console.error('[HistoryStats] Error loading data:', error);

            const tableContainer = document.getElementById('table-container');
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error:</strong> ${error.message}
                    </div>
                `;
            }
        } finally {
            window.AppLayout.hideLoading();
        }
    }

    /**
     * Update summary cards
     * @param {Array} data - Coin summaries
     */
    function updateSummaryCards(data) {
        const totalCoins = data.length;
        const totalRecords = data.reduce((sum, coin) => sum + (coin.records_in_buffer || 0), 0);
        const avgRecords = totalCoins > 0 ? Math.round(totalRecords / totalCoins) : 0;

        document.getElementById('total-coins-stat').textContent = totalCoins.toLocaleString();
        document.getElementById('total-records-stat').textContent = totalRecords.toLocaleString();
        document.getElementById('avg-records-stat').textContent = avgRecords.toLocaleString();

        // Get history hours from first coin
        const historyHours = data.length > 0 ? (data[0].history_hours || 3) : 3;
        document.getElementById('history-hours-stat').textContent = `${historyHours}h`;
    }

    /**
     * Render data table
     * @param {Array} data - Coin summaries
     */
    function renderTable(data) {
        const container = document.getElementById('table-container');

        if (!container) {
            console.error('[HistoryStats] Table container not found');
            return;
        }

        if (data.length === 0) {
            container.innerHTML = '<p class="no-data">No coin data available</p>';
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
                            Coin Symbol
                            ${getSortIcon('coin_symbol')}
                        </th>
                        <th class="table-header-sortable" data-column="records_in_buffer">
                            Records Loaded
                            ${getSortIcon('records_in_buffer')}
                        </th>
                        <th class="table-header-sortable" data-column="loaded_from_db">
                            From Database
                            ${getSortIcon('loaded_from_db')}
                        </th>
                        <th class="table-header-sortable" data-column="current_price">
                            Current Price
                            ${getSortIcon('current_price')}
                        </th>
                        <th class="table-header-sortable" data-column="change_30s">
                            Change 30s
                            ${getSortIcon('change_30s')}
                        </th>
                        <th class="table-header-sortable" data-column="change_1min">
                            Change 1min
                            ${getSortIcon('change_1min')}
                        </th>
                        <th class="table-header-sortable" data-column="change_2min">
                            Change 2min
                            ${getSortIcon('change_2min')}
                        </th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedData.forEach(coin => {
            tableHTML += `
                <tr>
                    <td><strong>${coin.coin_symbol || '-'}</strong></td>
                    <td>${(coin.records_in_buffer || 0).toLocaleString()}</td>
                    <td>${(coin.loaded_from_db || 0).toLocaleString()}</td>
                    <td>${formatPrice(coin.current_price)}</td>
                    <td>${formatChange(coin.change_30s)}</td>
                    <td>${formatChange(coin.change_1min)}</td>
                    <td>${formatChange(coin.change_2min)}</td>
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
     * Setup table sort handlers
     */
    function setupSortHandlers() {
        document.querySelectorAll('.table-header-sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;

                if (sortColumn === column) {
                    // Toggle direction
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    // New column
                    sortColumn = column;
                    sortDirection = 'asc';
                }

                console.log(`[HistoryStats] Sort: ${sortColumn} ${sortDirection}`);

                // Re-render table
                renderTable(currentData);
            });
        });
    }

    /**
     * Sort data
     * @param {Array} data - Data to sort
     * @param {string} column - Sort column
     * @param {string} direction - Sort direction
     * @returns {Array} Sorted data
     */
    function sortData(data, column, direction) {
        const sorted = [...data].sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // Handle null/undefined
            if (aVal === null || aVal === undefined) aVal = 0;
            if (bVal === null || bVal === undefined) bVal = 0;

            // Compare
            if (typeof aVal === 'string') {
                return direction === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            } else {
                return direction === 'asc'
                    ? aVal - bVal
                    : bVal - aVal;
            }
        });

        return sorted;
    }

    /**
     * Get sort icon HTML
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
     * Format price
     * @param {number} price - Price value
     * @returns {string} Formatted price
     */
    function formatPrice(price) {
        if (price === null || price === undefined) {
            return '-';
        }

        return price.toFixed(config.ui.numberFormat.decimals);
    }

    /**
     * Format price change
     * @param {number} change - Change percentage
     * @returns {string} Formatted change with color
     */
    function formatChange(change) {
        if (change === null || change === undefined) {
            return '<span class="text-muted">-</span>';
        }

        const formatted = change.toFixed(2) + '%';
        const className = change > 0 ? 'price-up' : change < 0 ? 'price-down' : 'text-muted';

        return `<span class="${className}">${change > 0 ? '+' : ''}${formatted}</span>`;
    }

    /**
     * Export data to CSV
     */
    function exportToCSV() {
        if (!currentData || currentData.length === 0) {
            alert('No data to export');
            return;
        }

        console.log('[HistoryStats] Exporting to CSV...');

        // Build CSV content
        const headers = [
            'Coin Symbol',
            'Records Loaded',
            'From Database',
            'Current Price',
            'Change 30s (%)',
            'Change 1min (%)',
            'Change 2min (%)'
        ];

        const rows = currentData.map(coin => [
            coin.coin_symbol || '',
            coin.records_in_buffer || 0,
            coin.loaded_from_db || 0,
            coin.current_price || '',
            coin.change_30s || '',
            coin.change_1min || '',
            coin.change_2min || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `okx_history_stats_${Date.now()}.csv`;
        a.click();

        console.log('[HistoryStats] CSV exported');
    }

})();
