const logger = require('#@logger');

const THREAD_REGISTRY = {
    'heartbeat': {
        description: 'Heartbeat system for task scheduling',
        default_enabled: true,
        shutdown_priority: 100
    },
    'rpc': {
        description: 'HTTP/WebSocket RPC server (legacy)',
        default_enabled: false,
        shutdown_priority: 50
    },
    'rpc_v2': {
        description: 'Unified RPC server v2 (Express + WebSocket)',
        default_enabled: false,
        shutdown_priority: 50
    },
    'speech': {
        description: 'Speech transcription service',
        default_enabled: false,
        shutdown_priority: 60
    },
    'tts_switch': {
        description: 'TTS provider switching service',
        default_enabled: false,
        shutdown_priority: 60
    },
    'stt_switch': {
        description: 'STT provider switching service',
        default_enabled: false,
        shutdown_priority: 60
    },
    'ui': {
        description: 'UI service',
        default_enabled: false,
        shutdown_priority: 70
    },
    'electron_ui': {
        description: 'Electron UI service',
        default_enabled: false,
        shutdown_priority: 70
    },
    'tray': {
        description: 'System tray (platform-specific)',
        default_enabled: false,
        shutdown_priority: 85
    }
};

const SERVICE_STARTERS = {};

function registerService(name, starterFunc, description = '', defaultEnabled = false, shutdownPriority = 50) {
    THREAD_REGISTRY[name] = {
        description,
        default_enabled: defaultEnabled,
        shutdown_priority: shutdownPriority
    };

    SERVICE_STARTERS[name] = starterFunc;

    logger.info(`[ThreadRegistry] Registered service: ${name}`);
}

module.exports = {
    THREAD_REGISTRY,
    SERVICE_STARTERS,
    registerService
};
