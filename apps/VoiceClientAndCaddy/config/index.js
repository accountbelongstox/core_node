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

// const { env } = require("#@global_vars");
const path = require(`path`)
const { gdir, appname, isServer } = require('#@global_vars');
const serviceContract = require('#@/config/service_contract.js');
const {
    ROOT_APP_STATIC_DIR,
    APP_METADATA_DIR,
} = gdir;

// Caddy Configuration Constants
const CADDY_EXECUTABLE_PATH = `/usr/bin/caddy`;
const CADDY_VERSION = `v2.9.1`;
const CADDY_CONFIG_FILE = `/etc/caddy/Caddyfile`;
const CADDY_ADMIN_PORT = serviceContract.port('frankenphp_admin');
const CADDY_HTTP_PORT = serviceContract.port('frankenphp_http');
const CADDY_ADMIN_API = serviceContract.url('http', serviceContract.host('loopback'), CADDY_ADMIN_PORT);
const CADDY_SERVICE_NAME = `caddy.service`;
const CADDY_SYSTEMD_PATH = `/lib/systemd/system/caddy.service`;

// Caddy System Information Constants
const CADDY_SERVER_WEB_ROOT = `/usr/share/caddy`;
const CADDY_WEBSITE_ROOT = gdir.mapWebPath('wwwroot');

// Caddy Domain Configuration Constants

// File and Directory Constants
const DICT_SOUND_STATIC_NAME = "sound_dir";
const DICT_SOUND_SUBTITLE_STATIC_NAME = "sound_subtitle_dir"
const SENTENCES_SOUND_STATIC_NAME = "sentence_sound_dir"
const SENTENCES_SOUND_SUBTITLE_STATIC_NAME = "sentence_sound_subtitle_dir"
const DICT_SOUND_DIR = path.join(ROOT_APP_STATIC_DIR, 'wordSound');
const DICT_SOUND_SUBTITLE_DIR = path.join(ROOT_APP_STATIC_DIR, 'wordSubtitle');
const SENTENCES_SOUND_DIR = path.join(ROOT_APP_STATIC_DIR, 'sentenceSound');
const SENTENCES_SOUND_SUBTITLE_DIR = path.join(ROOT_APP_STATIC_DIR, 'sentenceSubtitle');

// URL Configuration Constants
const BaseUrl = serviceContract.url('https', serviceContract.serviceDomain('static_local'), serviceContract.port('static_api_https'))
const DownloadPath = `/src/download/softlist/static_src/dictionary/database/`
const DataBakCopyPath = `${DownloadPath}traData.7z`
const USER_TEST_SERVER_URL = serviceContract.url('http', serviceContract.host('loopback'), serviceContract.port('voice_api_local'))
const USER_SERVER_URL = isServer ? serviceContract.url('https', serviceContract.serviceDomain('dictionary_api')) : USER_TEST_SERVER_URL
const USER_API_URL = `${USER_SERVER_URL}/api/dict/v1`
const USER_API_CLIENT_TOKEN = 'SECRET:DICT_API_CLIENT_TOKEN_1'

const config = {
    HTTP_PORT: serviceContract.port('voice_server'),
    HTTP_HOST: isServer ? serviceContract.host('any') : undefined,
    SERVER_URL: serviceContract.url('http', serviceContract.host('cloud_legacy'), serviceContract.port('voice_server')),
    CLIENTS_URL: [
        serviceContract.url('http', serviceContract.host('voice_client_primary'), serviceContract.port('voice_server')),
        serviceContract.url('http', serviceContract.host('voice_client_secondary'), serviceContract.port('voice_client_secondary')),
    ].join(','),
    OLD_DB_URL: `${BaseUrl}${DataBakCopyPath}`,
    OLD_DB_NAME: `traData.db`,
    
    // Directory Paths
    DICT_SOUND_DIR,
    DICT_SOUND_SUBTITLE_DIR,
    SENTENCES_SOUND_DIR,
    SENTENCES_SOUND_SUBTITLE_DIR,
    DICT_SOUND_STATIC_NAME,
    DICT_SOUND_SUBTITLE_STATIC_NAME,
    SENTENCES_SOUND_STATIC_NAME,
    SENTENCES_SOUND_SUBTITLE_STATIC_NAME,
    
    // API Configuration
    USER_SERVER_URL,
    USER_API_URL,
    USER_API_CLIENT_TOKEN,
    
    // Caddy Configuration
    CADDY_EXECUTABLE_PATH,
    CADDY_VERSION,
    CADDY_CONFIG_FILE,
    CADDY_ADMIN_PORT,
    CADDY_HTTP_PORT,
    CADDY_ADMIN_API,
    CADDY_SERVICE_NAME,
    CADDY_SYSTEMD_PATH,
    
    // Caddy Server Information
    CADDY_SERVER_WEB_ROOT,
    CADDY_WEBSITE_ROOT,
    
    STATIC_PATHS: {
        [DICT_SOUND_STATIC_NAME]: `${DICT_SOUND_DIR}`,
        [DICT_SOUND_SUBTITLE_STATIC_NAME]: `${DICT_SOUND_SUBTITLE_DIR}`,
        [SENTENCES_SOUND_STATIC_NAME]: `${SENTENCES_SOUND_DIR}`,
        [SENTENCES_SOUND_SUBTITLE_STATIC_NAME]: `${SENTENCES_SOUND_SUBTITLE_DIR}`
    }
}

module.exports = config;
