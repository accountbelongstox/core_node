// Voice Subtitle Framework Configuration

// ========== Global Debug Control ==========
// Set to true to enable debug logging (console.log and mobile alerts)
// Set to false to disable all debug output
const GLOBAL_DEBUG = false;

// Dynamically determine the base URL based on current location
const _getServerConfig = () => {
    const host = window.location.hostname;
    const port = 59000;
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

    const config = {
        HOST: host,
        PORT: port,
        BASE_URL: `${protocol}://${host}:${port}`,
        WS_URL: `${wsProtocol}://${host}:${port}/rpc/ws`
    };

    // Debug output (only if GLOBAL_DEBUG is true)
    if (GLOBAL_DEBUG) {
        console.log('[CONFIG] Server configuration generated:');
        console.log('[CONFIG]   - Current location:', window.location.href);
        console.log('[CONFIG]   - Hostname:', host);
        console.log('[CONFIG]   - Base URL:', config.BASE_URL);
        console.log('[CONFIG]   - WebSocket URL:', config.WS_URL);
    }

    return config;
};

const CONFIG = {
    // Server configuration (dynamically determined)
    SERVER: _getServerConfig(),

    // Remote API configuration
    REMOTE_API: {
        ENABLED: false,
        AUTO_DISCOVER: true,
        CUSTOM_URL: '',
        DISCOVERED_SERVERS: [],
        SCAN_PORT: 9000,
        SCAN_INTERVAL: 5000,  // 5 seconds
        SCAN_TIMEOUT: 200,     // 200ms
        API_PREFIX: '/api/mcp/v1'
    },

    // API endpoints
    API: {
        // Queue management
        QUEUE: '/voice-subtitle/queue',
        QUEUE_LATEST: '/voice-subtitle/queue/latest',
        QUEUE_TODAY: '/voice-subtitle/queue/filter-by-today',
        QUEUE_BY_CATEGORY: '/voice-subtitle/queue/filter-by-category',
        CLEAR_QUEUE: '/voice-subtitle/clear',
        SET_INDEX: '/voice-subtitle/set-index',
        INCREMENT_PLAY_COUNT: '/voice-subtitle/increment-play-count',

        // Item management
        ADD_TEXT: '/voice-subtitle/add-text',
        ADD_IMAGE: '/voice-subtitle/add-image',
        ADD_VOICE: '/voice-subtitle/add-voice',
        REMOVE_ITEMS: '/voice-subtitle/remove-items',
        CHANGE_CATEGORY: '/voice-subtitle/change-category',

        // Category management
        CATEGORIES: '/voice-subtitle/categories',

        // Audio serving
        AUDIO: '/voice-subtitle/audio',

        // Task management
        TASKS: '/voice-subtitle/tasks',
        TASK_STATUS: '/voice-subtitle/tasks/{task_id}',

        // Background services
        CLIPBOARD_START: '/voice-subtitle/clipboard-monitor/start',
        CLIPBOARD_STOP: '/voice-subtitle/clipboard-monitor/stop',
        CLIPBOARD_STATUS: '/voice-subtitle/clipboard-monitor/status',
        SCREENSHOT_START: '/voice-subtitle/screenshot-monitor/start',
        SCREENSHOT_STOP: '/voice-subtitle/screenshot-monitor/stop',
        SCREENSHOT_STATUS: '/voice-subtitle/screenshot-monitor/status',

        // File upload
        FILE_UPLOAD: '/web/upload-file',

        // Code sync
        CODE_SYNC_STATUS: '/code-sync/status',
        CODE_SYNC_START_SERVER: '/code-sync/set-server',
        CODE_SYNC_START_CLIENT: '/code-sync/set-client',
        CODE_SYNC_STOP: '/code-sync/stop',
        CODE_SYNC_TOGGLE_BACKUP: '/code-sync/toggle-backup',

        // Service discovery
        PING: '/ping'
    },

    // WebSocket configuration (uses dynamically determined URL)
    WEBSOCKET: {
        URL: _getServerConfig().WS_URL,
        OPTIONS: {
            debug: true,
            reconnect: true,
            reconnectInterval: 3000,
            maxReconnectAttempts: 999
        }
    },

    // Default settings
    DEFAULTS: {
        PLAYBACK_MODE: 'all',
        LATEST_COUNT: 300,
        CATEGORY: 'normal',
        LANGUAGES: ['en'],
        SCREENSHOT_INTERVAL: 60, // seconds
        AUTO_REFRESH_INTERVAL: 3000 // milliseconds
    },

    // UI settings
    UI: {
        MODULES: ['voice-player', 'queue-manager', 'window-automation', 'code-sync', 'api-config'],
        DEFAULT_MODULE: 'voice-player'
    }
};

// Helper functions
CONFIG.getBaseUrl = function() {
    if (CONFIG.REMOTE_API.ENABLED) {
        return CONFIG.REMOTE_API.CUSTOM_URL || CONFIG.SERVER.BASE_URL;
    }
    return CONFIG.SERVER.BASE_URL;
};

CONFIG.getApiPrefix = function() {
    return CONFIG.REMOTE_API.ENABLED ? CONFIG.REMOTE_API.API_PREFIX : '';
};

// Freeze configuration to prevent modifications
Object.freeze(CONFIG.SERVER);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.WEBSOCKET);
Object.freeze(CONFIG.DEFAULTS);
Object.freeze(CONFIG.UI);

