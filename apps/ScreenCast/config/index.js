// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const path = require('path');
const { gdir, appname, isServer } = require('#@global_vars');
const { ROOT_APP_STATIC_DIR } = gdir;

const STREAM_OUTPUT_DIR = path.join(ROOT_APP_STATIC_DIR, 'screencast_streams');
const STREAM_THUMBNAIL_DIR = path.join(ROOT_APP_STATIC_DIR, 'screencast_thumbnails');

const HTTP_PORT = 15460;
const HTTP_HOST = '0.0.0.0';
const WS_PORT = 15461;

const STREAM_CONFIG = {
    DEFAULT_BITRATE: '500k',
    HIGH_QUALITY_BITRATE: '800k',
    LOW_QUALITY_BITRATE: '200k',
    DEFAULT_FPS: 30,
    MEDIUM_FPS: 15,
    LOW_FPS: 5,
    DEFAULT_RESOLUTION: '720x1280',
    MEDIUM_RESOLUTION: '540x960',
    LOW_RESOLUTION: '360x640',
    CODEC: 'libx264',
    PRESET: 'ultrafast',
    TUNE: 'zerolatency'
};

const ADB_CONFIG = {
    MAX_DEVICES: 100,
    CONNECTION_TIMEOUT: 5000,
    RECONNECT_INTERVAL: 10000,
    HEALTH_CHECK_INTERVAL: 30000
};

const config = {
    HTTP_PORT,
    HTTP_HOST,
    WS_PORT,
    STREAM_OUTPUT_DIR,
    STREAM_THUMBNAIL_DIR,
    STREAM_CONFIG,
    ADB_CONFIG,

    STATIC_PATHS: {
        'streams': STREAM_OUTPUT_DIR,
        'thumbnails': STREAM_THUMBNAIL_DIR
    }
};

module.exports = config;
