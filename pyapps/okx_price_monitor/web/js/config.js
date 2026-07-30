/**
 * Application Configuration
 * Central configuration for the web UI
 */

window.AppConfig = {
    // API Configuration
    api: {
        baseUrl: window.location.origin,
        rpcPath: '/api/controller',
        timeout: 30000, // 30 seconds
        retryAttempts: 3,
        retryDelay: 1000
    },

    // RPC Routes
    routes: {
        // Monitor routes
        stats: 'monitor.stats',
        coinsList: 'monitor.coins_list',
        coinSummary: 'monitor.coin_summary',
        allSummaries: 'monitor.all_summaries',
        alerts: 'monitor.alerts',
        config: 'monitor.config',
        updateConfig: 'monitor.update_config',
        startMonitoring: 'monitor.start',
        stopMonitoring: 'monitor.stop',

        // Trading routes
        tradingSummary: 'trading.summary',
        tradingPositions: 'trading.positions',
        tradingHistory: 'trading.history',
        tradingBalance: 'trading.balance',

        // Legacy routes (for compatibility)
        coinsStats: 'monitor.stats',
        coinsSummaries: 'monitor.all_summaries',
        priceChanges: 'monitor.all_summaries',
        serverStatus: 'monitor.stats'
    },

    // Menu Configuration
    menus: {
        top: [],
        left: [
            {
                id: 'history',
                page: 'history_stats',
                label: 'History Stats',
                icon: '📊'
            },
            {
                id: 'monitoring',
                page: 'monitoring',
                label: 'Real-time Monitor',
                icon: '📈'
            },
            {
                id: 'trading',
                page: 'trading',
                label: 'Simulated Trading',
                icon: '💰'
            },
            {
                id: 'alerts',
                page: 'alerts',
                label: 'Trading Alerts',
                icon: '🔔'
            },
            {
                id: 'config',
                page: 'config',
                label: 'Configuration',
                icon: '⚙️'
            },
            {
                id: 'stats',
                page: 'stats',
                label: 'System Stats',
                icon: '📉'
            }
        ],
        right: [],
        bottom: []
    },

    // UI Configuration
    ui: {
        refreshInterval: 5000, // 5 seconds
        maxCoinsDisplay: 297,  // Support all 297 coins
        tablePageSize: 50,

        // Pagination for handling 297 coins
        pagination: {
            enabled: true,
            pageSize: 50,
            pageSizeOptions: [25, 50, 100, 200],
            showTotal: true
        },

        // Virtual scrolling for performance (when showing all coins)
        virtualScroll: {
            enabled: true,
            itemHeight: 60,  // Height of each coin row
            bufferSize: 10   // Extra items to render
        },

        // Chart configuration for 297 coins
        charts: {
            // Don't render all charts at once
            lazyLoad: true,           // Load charts only when visible
            maxSimultaneous: 20,      // Max 20 charts rendered at once
            defaultVisible: 10,       // Show charts for top 10 coins by default
            miniChart: {
                width: 200,
                height: 60,
                showAxis: false,
                showTooltip: true
            }
        },

        numberFormat: {
            decimals: 6,
            thousandsSeparator: ',',
            decimalSeparator: '.'
        },

        priceChangeColors: {
            up: '#00ff88',
            down: '#ff4444',
            neutral: '#ffbb33'
        },

        // Filtering and sorting for 297 coins
        filter: {
            enabled: true,
            defaultSortBy: 'volume',  // Sort by volume by default
            defaultSortOrder: 'desc',
            searchPlaceholder: 'Search coins...',
            filters: [
                { id: 'all', label: 'All Coins', filter: () => true },
                { id: 'top50', label: 'Top 50', filter: (coin, index) => index < 50 },
                { id: 'active', label: 'Active (>0.1% change)', filter: (coin) => Math.abs(coin.change || 0) > 0.1 }
            ]
        }
    },

    // Alert Thresholds
    alerts: {
        thresholds: {
            '30s': 1.0,  // 1% in 30 seconds
            '1m': 2.0,   // 2% in 1 minute
            '2m': 3.0    // 3% in 2 minutes
        },
        soundEnabled: true,
        notificationsEnabled: true
    },

    // Monitor Configuration
    monitor: {
        historyWindowHours: 3,
        updateIntervalMs: 2000,
        barSize: '1H',
        targetRecordsPerCoin: 10000
    },

    // Debug Mode
    debug: true,

    // App Version
    version: '1.0.0',
    appName: 'OKX Price Monitor'
};

console.log('[Config] Application configuration loaded');
