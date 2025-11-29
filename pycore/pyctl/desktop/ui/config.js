// Voice Subtitle Framework Configuration

const CONFIG = {
    // Server configuration
    SERVER: {
        HOST: 'localhost',
        PORT: 59000,
        BASE_URL: 'http://localhost:59000'
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
        CODE_SYNC_TOGGLE_BACKUP: '/code-sync/toggle-backup'
    },

    // WebSocket configuration
    WEBSOCKET: {
        URL: 'ws://localhost:59000/rpc/ws',
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
        MODULES: ['voice-player', 'queue-manager', 'window-automation', 'code-sync'],
        DEFAULT_MODULE: 'voice-player'
    }
};

// Freeze configuration to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.SERVER);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.WEBSOCKET);
Object.freeze(CONFIG.DEFAULTS);
Object.freeze(CONFIG.UI);
