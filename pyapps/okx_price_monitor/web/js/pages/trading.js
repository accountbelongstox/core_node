/**
 * Trading Page - Simulated Trading Dashboard
 * Displays trading performance, active positions, and trade history
 */

window.TradingPage = (function() {
    'use strict';

    const config = window.AppConfig;
    const API = window.API;
    const utils = window.Utils;

    let refreshInterval = null;
    let performanceChart = null;
    let positionsChart = null;

    /**
     * Initialize the trading page
     */
    async function init() {
        console.log('[Trading Page] Initializing...');

        // Set page title
        document.getElementById('page-title').textContent = 'Simulated Trading Dashboard';
        document.getElementById('page-description').textContent = 'Virtual money trading performance and positions';

        // Render page structure
        renderPageStructure();

        // Load initial data
        await loadAllData();

        // Start auto-refresh
        startAutoRefresh();

        console.log('[Trading Page] Initialized');
    }

    /**
     * Render page structure
     */
    function renderPageStructure() {
        const container = document.getElementById('page-content');

        container.innerHTML = `
            <!-- Trading Summary Cards -->
            <div class="trading-summary-cards">
                <div class="summary-card">
                    <div class="card-icon">💵</div>
                    <div class="card-content">
                        <div class="card-label">Current Balance</div>
                        <div class="card-value" id="current-balance">Loading...</div>
                        <div class="card-change" id="balance-change">-</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">📊</div>
                    <div class="card-content">
                        <div class="card-label">Total Trades</div>
                        <div class="card-value" id="total-trades">-</div>
                        <div class="card-change" id="win-rate">-</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">💰</div>
                    <div class="card-content">
                        <div class="card-label">Total P&L</div>
                        <div class="card-value" id="total-pnl">-</div>
                        <div class="card-change" id="pnl-percent">-</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">📈</div>
                    <div class="card-content">
                        <div class="card-label">Active Positions</div>
                        <div class="card-value" id="active-positions">-</div>
                        <div class="card-change" id="max-positions">-</div>
                    </div>
                </div>
            </div>

            <!-- Performance Chart -->
            <div class="trading-section">
                <h3 class="section-title">Performance Overview</h3>
                <div id="performance-chart" style="width: 100%; height: 300px;"></div>
            </div>

            <!-- Active Positions -->
            <div class="trading-section">
                <h3 class="section-title">Active Positions</h3>
                <div id="active-positions-container">
                    <div class="loading-message">Loading positions...</div>
                </div>
            </div>

            <!-- Trade History -->
            <div class="trading-section">
                <h3 class="section-title">Recent Trades</h3>
                <div id="trade-history-container">
                    <div class="loading-message">Loading trade history...</div>
                </div>
            </div>
        `;

        // Add inline styles for trading page
        addTradingStyles();
    }

    /**
     * Add trading page styles
     */
    function addTradingStyles() {
        const styleId = 'trading-page-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .trading-summary-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }

            .summary-card {
                background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
                border-radius: 10px;
                padding: 20px;
                display: flex;
                align-items: center;
                gap: 15px;
                border: 1px solid #333;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .summary-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 255, 136, 0.2);
            }

            .card-icon {
                font-size: 2.5em;
                opacity: 0.8;
            }

            .card-content {
                flex: 1;
            }

            .card-label {
                font-size: 0.85em;
                color: #999;
                margin-bottom: 5px;
            }

            .card-value {
                font-size: 1.5em;
                font-weight: bold;
                color: #fff;
                margin-bottom: 5px;
            }

            .card-change {
                font-size: 0.9em;
                font-weight: 500;
            }

            .card-change.positive {
                color: #00ff88;
            }

            .card-change.negative {
                color: #ff4444;
            }

            .trading-section {
                background: #1a1a1a;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
                border: 1px solid #333;
            }

            .section-title {
                font-size: 1.2em;
                margin-bottom: 15px;
                color: #fff;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
            }

            .positions-table, .trades-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }

            .positions-table th, .trades-table th {
                background: #2a2a2a;
                color: #999;
                padding: 12px;
                text-align: left;
                font-weight: 500;
                border-bottom: 2px solid #333;
            }

            .positions-table td, .trades-table td {
                padding: 12px;
                border-bottom: 1px solid #2a2a2a;
            }

            .positions-table tr:hover, .trades-table tr:hover {
                background: #252525;
            }

            .coin-symbol {
                font-weight: bold;
                color: #00ff88;
            }

            .price-value {
                font-family: 'Courier New', monospace;
            }

            .pnl-positive {
                color: #00ff88;
            }

            .pnl-negative {
                color: #ff4444;
            }

            .loading-message {
                text-align: center;
                padding: 20px;
                color: #999;
            }

            .empty-message {
                text-align: center;
                padding: 30px;
                color: #666;
                font-style: italic;
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Load all trading data
     */
    async function loadAllData() {
        try {
            await Promise.all([
                loadTradingSummary(),
                loadActivePositions(),
                loadTradeHistory()
            ]);
        } catch (error) {
            console.error('[Trading Page] Error loading data:', error);
        }
    }

    /**
     * Load trading summary
     */
    async function loadTradingSummary() {
        try {
            const response = await API.call(config.routes.tradingSummary);

            if (response && response.success) {
                const data = response.data;
                updateSummaryCards(data);
                updatePerformanceChart(data);
            }
        } catch (error) {
            console.error('[Trading Page] Error loading summary:', error);
        }
    }

    /**
     * Update summary cards
     */
    function updateSummaryCards(data) {
        // Current Balance
        const balanceEl = document.getElementById('current-balance');
        balanceEl.textContent = `$${utils.formatNumber(data.current_balance, 2)}`;

        const balanceChangeEl = document.getElementById('balance-change');
        const profitLoss = data.current_balance - data.initial_balance;
        const profitLossPercent = ((profitLoss / data.initial_balance) * 100).toFixed(2);
        balanceChangeEl.textContent = `${profitLoss >= 0 ? '+' : ''}$${utils.formatNumber(profitLoss, 2)} (${profitLossPercent >= 0 ? '+' : ''}${profitLossPercent}%)`;
        balanceChangeEl.className = `card-change ${profitLoss >= 0 ? 'positive' : 'negative'}`;

        // Total Trades
        document.getElementById('total-trades').textContent = data.total_trades || 0;

        const winRateEl = document.getElementById('win-rate');
        winRateEl.textContent = `Win Rate: ${data.win_rate ? data.win_rate.toFixed(1) : 0}%`;
        winRateEl.className = `card-change ${data.win_rate >= 50 ? 'positive' : 'negative'}`;

        // Total P&L
        const pnlEl = document.getElementById('total-pnl');
        pnlEl.textContent = `$${utils.formatNumber(data.total_pnl || 0, 2)}`;
        pnlEl.className = `card-value ${data.total_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`;

        const pnlPercentEl = document.getElementById('pnl-percent');
        pnlPercentEl.textContent = `${data.total_return_percent >= 0 ? '+' : ''}${(data.total_return_percent || 0).toFixed(2)}%`;
        pnlPercentEl.className = `card-change ${data.total_return_percent >= 0 ? 'positive' : 'negative'}`;

        // Active Positions
        document.getElementById('active-positions').textContent = data.active_positions || 0;
        document.getElementById('max-positions').textContent = `Max Drawdown: ${data.max_drawdown ? data.max_drawdown.toFixed(2) : 0}%`;
    }

    /**
     * Update performance chart
     */
    function updatePerformanceChart(data) {
        const chartDom = document.getElementById('performance-chart');

        if (!performanceChart) {
            performanceChart = echarts.init(chartDom);
        }

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderColor: '#333',
                textStyle: { color: '#fff' }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: ['Initial', 'Current'],
                axisLine: { lineStyle: { color: '#333' } },
                axisLabel: { color: '#999' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: '#333' } },
                axisLabel: { color: '#999' },
                splitLine: { lineStyle: { color: '#2a2a2a' } }
            },
            series: [{
                name: 'Balance',
                type: 'bar',
                data: [
                    { value: data.initial_balance, itemStyle: { color: '#666' } },
                    { value: data.current_balance, itemStyle: { color: data.current_balance >= data.initial_balance ? '#00ff88' : '#ff4444' } }
                ],
                label: {
                    show: true,
                    position: 'top',
                    formatter: '${c}',
                    color: '#fff'
                }
            }]
        };

        performanceChart.setOption(option);
    }

    /**
     * Load active positions
     */
    async function loadActivePositions() {
        try {
            const response = await API.call(config.routes.tradingPositions);

            if (response && response.success) {
                renderActivePositions(response.data);
            }
        } catch (error) {
            console.error('[Trading Page] Error loading positions:', error);
        }
    }

    /**
     * Render active positions table
     */
    function renderActivePositions(data) {
        const container = document.getElementById('active-positions-container');

        if (!data.positions || data.positions.length === 0) {
            container.innerHTML = '<div class="empty-message">No active positions</div>';
            return;
        }

        let html = `
            <table class="positions-table">
                <thead>
                    <tr>
                        <th>Coin</th>
                        <th>Entry Price</th>
                        <th>Entry Time</th>
                        <th>Size (USDT)</th>
                        <th>Side</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.positions.forEach(position => {
            const entryTime = new Date(position.entry_time).toLocaleString();

            html += `
                <tr>
                    <td><span class="coin-symbol">${position.coin}</span></td>
                    <td class="price-value">$${utils.formatNumber(position.entry_price, 4)}</td>
                    <td>${entryTime}</td>
                    <td>$${utils.formatNumber(position.size, 2)}</td>
                    <td><span class="badge badge-${position.side}">${position.side.toUpperCase()}</span></td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    /**
     * Load trade history
     */
    async function loadTradeHistory() {
        try {
            const response = await API.call(config.routes.tradingHistory, { limit: 50 });

            if (response && response.success) {
                renderTradeHistory(response.data);
            }
        } catch (error) {
            console.error('[Trading Page] Error loading trade history:', error);
        }
    }

    /**
     * Render trade history table
     */
    function renderTradeHistory(data) {
        const container = document.getElementById('trade-history-container');

        if (!data.trades || data.trades.length === 0) {
            container.innerHTML = '<div class="empty-message">No trade history yet</div>';
            return;
        }

        let html = `
            <table class="trades-table">
                <thead>
                    <tr>
                        <th>Coin</th>
                        <th>Entry Price</th>
                        <th>Exit Price</th>
                        <th>Entry Time</th>
                        <th>Exit Time</th>
                        <th>Size (USDT)</th>
                        <th>P&L</th>
                        <th>P&L %</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.trades.forEach(trade => {
            const entryTime = new Date(trade.entry_time).toLocaleString();
            const exitTime = new Date(trade.exit_time).toLocaleString();
            const pnlClass = trade.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';

            html += `
                <tr>
                    <td><span class="coin-symbol">${trade.coin}</span></td>
                    <td class="price-value">$${utils.formatNumber(trade.entry_price, 4)}</td>
                    <td class="price-value">$${utils.formatNumber(trade.exit_price, 4)}</td>
                    <td>${entryTime}</td>
                    <td>${exitTime}</td>
                    <td>$${utils.formatNumber(trade.size, 2)}</td>
                    <td class="${pnlClass}">$${utils.formatNumber(trade.pnl, 2)}</td>
                    <td class="${pnlClass}">${trade.pnl_percent >= 0 ? '+' : ''}${utils.formatNumber(trade.pnl_percent, 2)}%</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    /**
     * Start auto-refresh
     */
    function startAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }

        refreshInterval = setInterval(() => {
            loadAllData();
        }, config.ui.refreshInterval);
    }

    /**
     * Stop auto-refresh
     */
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }

    /**
     * Cleanup when leaving page
     */
    function cleanup() {
        console.log('[Trading Page] Cleaning up...');
        stopAutoRefresh();

        if (performanceChart) {
            performanceChart.dispose();
            performanceChart = null;
        }

        if (positionsChart) {
            positionsChart.dispose();
            positionsChart = null;
        }
    }

    // Public API
    return {
        init,
        cleanup
    };
})();

/**
 * Page loader function (called by AppLayout)
 * @param {HTMLElement} container - Content container
 */
window.load_trading = async function(container) {
    console.log('[Trading] Loading page...');

    // Initialize trading page
    await window.TradingPage.init();

    // Setup cleanup on page change
    window.currentPageCleanup = window.TradingPage.cleanup;

    console.log('[Trading] Page loaded');
};
