/**
 * OKX Price Monitor - Central Configuration
 *
 * All application configuration in one place
 */

const AppConfig = {
    // API Configuration
    api: {
        baseUrl: window.location.origin,
        rpcPath: '/rpc',
        timeout: 30000,
        retryCount: 3
    },

    // Application Information
    app: {
        name: 'OKX Price Monitor',
        version: '1.0.0',
        description: 'Real-time cryptocurrency price monitoring and analysis'
    },

    // UI Configuration
    ui: {
        theme: 'dark',
        animationSpeed: 300,
        refreshInterval: 5000, // 5 seconds
        dateFormat: 'YYYY-MM-DD HH:mm:ss',
        numberFormat: {
            decimals: 4,
            thousandsSeparator: ',',
            decimalSeparator: '.'
        }
    },

    // Layout Configuration
    layout: {
        topMenuHeight: '60px',
        leftMenuWidth: '250px',
        rightMenuWidth: '250px',
        bottomMenuHeight: '40px',
        menuCollapsedWidth: '60px'
    },

    // Menu Items Configuration
    menus: {
        top: [
            { id: 'home', label: 'Home', icon: '🏠' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
            { id: 'help', label: 'Help', icon: '❓' }
        ],
        left: [
            {
                id: 'dashboard',
                label: 'Dashboard',
                icon: '📊',
                page: 'dashboard'
            },
            {
                id: 'history_stats',
                label: 'History Statistics',
                icon: '📈',
                page: 'history_stats'
            },
            {
                id: 'price_monitor',
                label: 'Price Monitor',
                icon: '💹',
                page: 'price_monitor'
            },
            {
                id: 'alerts',
                label: 'Alerts',
                icon: '🔔',
                page: 'alerts'
            },
            {
                id: 'charts',
                label: 'Charts',
                icon: '📉',
                page: 'charts'
            }
        ],
        right: [
            {
                id: 'notifications',
                label: 'Notifications',
                icon: '🔔'
            },
            {
                id: 'quick_stats',
                label: 'Quick Stats',
                icon: '⚡'
            }
        ],
        bottom: [
            { id: 'status', label: 'Status: Online', icon: '🟢' },
            { id: 'version', label: 'v1.0.0', icon: 'ℹ️' }
        ]
    },

    // API Routes
    routes: {
        coinsStats: 'api/coins/stats',
        coinsSummaries: 'api/coins/summaries',
        coinSummary: 'api/coins/summary',
        priceChanges: 'api/coins/changes',
        serverStatus: 'api/status'
    },

    // Table Configuration
    table: {
        pageSize: 50,
        pageSizes: [10, 25, 50, 100, 200],
        sortable: true,
        filterable: true
    },

    // Chart Configuration
    charts: {
        defaultType: 'line',
        colors: [
            '#00ff00', '#ff00ff', '#00ffff', '#ffff00',
            '#ff6600', '#6600ff', '#00ff66', '#ff0066'
        ],
        gridColor: '#333333',
        textColor: '#ffffff'
    },

    // Price Change Thresholds
    thresholds: {
        change_30s: 1.0,  // 1%
        change_1min: 2.0, // 2%
        change_2min: 3.0  // 3%
    },

    // Debug Mode
    debug: true
};

// Freeze configuration to prevent accidental modification
Object.freeze(AppConfig);
Object.freeze(AppConfig.api);
Object.freeze(AppConfig.app);
Object.freeze(AppConfig.ui);
Object.freeze(AppConfig.layout);
Object.freeze(AppConfig.menus);
Object.freeze(AppConfig.routes);
Object.freeze(AppConfig.table);
Object.freeze(AppConfig.charts);
Object.freeze(AppConfig.thresholds);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}
