/** Laravel API catalog fragment. */
import type { ApiCatalogEndpoint } from '../uiTypes';

export const API_CORE_ENDPOINTS: ApiCatalogEndpoint[] = [
// --- System API ---
    { 
        id: 'sys1', method: 'GET', path: '/api_info', description: 'Get all API endpoint information', section: 'System',
        params: [] 
    },
{ 
        id: 'sys2', method: 'GET', path: '/csrf-token', description: 'Get CSRF Token', section: 'System',
        params: [] 
    },
// --- Auth API ---
    { 
        id: 'auth1', method: 'POST', path: '/api/register', description: 'User Registration', section: 'Auth',
        params: [
            { name: 'name', type: 'string', required: true },
            { name: 'email', type: 'email', required: true },
            { name: 'password', type: 'string', required: true },
            { name: 'password_confirmation', type: 'string', required: true }
        ] 
    },
{ 
        id: 'auth2', method: 'POST', path: '/api/login', description: 'User Login', section: 'Auth',
        params: [
            { name: 'email', type: 'email', required: true },
            { name: 'password', type: 'string', required: true }
        ] 
    },
{ id: 'auth3', method: 'POST', path: '/api/logout', description: 'User Logout', section: 'Auth' },
// --- ITTools - Crypto ---
    {
        id: 'cry_hash', method: 'POST', path: '/api/ittools/v1/crypto/hash', description: 'Text Hash Calculation', section: 'ITTools - Crypto',
        params: [
            { name: 'text', type: 'string', required: true },
            { name: 'algorithm', type: 'string', required: true, options: ['md5', 'sha1', 'sha256', 'sha512'] }
        ]
    },
{
        id: 'cry_bcrypt_hash', method: 'POST', path: '/api/ittools/v1/crypto/bcrypt/hash', description: 'Bcrypt Hash', section: 'ITTools - Crypto',
        params: [
            { name: 'password', type: 'string', required: true },
            { name: 'rounds', type: 'integer', required: false, default: 10 }
        ]
    },
{
        id: 'cry_bcrypt_verify', method: 'POST', path: '/api/ittools/v1/crypto/bcrypt/verify', description: 'Bcrypt Verify', section: 'ITTools - Crypto',
        params: [
            { name: 'password', type: 'string', required: true },
            { name: 'hash', type: 'string', required: true }
        ]
    },
{
        id: 'cry_uuid', method: 'POST', path: '/api/ittools/v1/crypto/uuid/generate', description: 'Generate UUID', section: 'ITTools - Crypto',
        params: [
            { name: 'count', type: 'integer', required: false, default: 1 },
            { name: 'uppercase', type: 'boolean', required: false, default: false }
        ]
    },
{
        id: 'cry_ulid', method: 'POST', path: '/api/ittools/v1/crypto/ulid/generate', description: 'Generate ULID', section: 'ITTools - Crypto',
        params: [{ name: 'count', type: 'integer', required: false, default: 1 }]
    },
{
        id: 'cry_token', method: 'POST', path: '/api/ittools/v1/crypto/token/generate', description: 'Generate Random Token', section: 'ITTools - Crypto',
        params: [
             { name: 'length', type: 'integer', required: false, default: 32 },
             { name: 'charset', type: 'string', required: false, options: ['alphanumeric', 'hex', 'numeric'] }
        ]
    },
{
        id: 'cry_basic_auth', method: 'POST', path: '/api/ittools/v1/crypto/basic-auth', description: 'Generate Basic Auth Header', section: 'ITTools - Crypto',
        params: [
            { name: 'username', type: 'string', required: true },
            { name: 'password', type: 'string', required: true }
        ]
    },
{
        id: 'cry_hmac', method: 'POST', path: '/api/ittools/v1/crypto/hmac', description: 'Generate HMAC Signature', section: 'ITTools - Crypto',
        params: [
            { name: 'text', type: 'string', required: true },
            { name: 'secret', type: 'string', required: true },
            { name: 'algorithm', type: 'string', required: true, options: ['sha1', 'sha256', 'sha512'] }
        ]
    },
{
        id: 'cry_rsa', method: 'POST', path: '/api/ittools/v1/crypto/rsa/generate', description: 'Generate RSA Key Pair', section: 'ITTools - Crypto',
        params: [
            { name: 'key_size', type: 'integer', required: false, options: ['1024', '2048', '4096'] }
        ]
    },
{
        id: 'cry_bip39', method: 'POST', path: '/api/ittools/v1/crypto/bip39/generate', description: 'Generate BIP39 Mnemonic', section: 'ITTools - Crypto',
        params: [
            { name: 'strength', type: 'integer', required: false, options: ['128', '256'] }
        ]
    },
{
        id: 'cry_otp_gen', method: 'POST', path: '/api/ittools/v1/crypto/otp/generate', description: 'Generate OTP', section: 'ITTools - Crypto',
        params: [
            { name: 'secret', type: 'string', required: false },
            { name: 'period', type: 'integer', required: false, default: 30 },
            { name: 'digits', type: 'integer', required: false, default: 6 }
        ]
    },
{
        id: 'cry_otp_ver', method: 'POST', path: '/api/ittools/v1/crypto/otp/verify', description: 'Verify OTP', section: 'ITTools - Crypto',
        params: [
            { name: 'otp', type: 'string', required: true },
            { name: 'secret', type: 'string', required: true }
        ]
    },
{
        id: 'cry_pass', method: 'POST', path: '/api/ittools/v1/crypto/password/analyze', description: 'Password Strength Analysis', section: 'ITTools - Crypto',
        params: [{ name: 'password', type: 'string', required: true }]
    },
{
        id: 'cry_enc', method: 'POST', path: '/api/ittools/v1/crypto/encrypt', description: 'AES Encrypt', section: 'ITTools - Crypto',
        params: [
            { name: 'text', type: 'string', required: true },
            { name: 'key', type: 'string', required: true },
            { name: 'algorithm', type: 'string', required: false, default: 'aes-256-cbc' }
        ]
    },
{
        id: 'cry_dec', method: 'POST', path: '/api/ittools/v1/crypto/decrypt', description: 'AES Decrypt', section: 'ITTools - Crypto',
        params: [
            { name: 'encrypted', type: 'string', required: true },
            { name: 'key', type: 'string', required: true },
            { name: 'algorithm', type: 'string', required: false, default: 'aes-256-cbc' }
        ]
    },
// --- ITTools - Converter ---
    {
        id: 'conv_b64e', method: 'POST', path: '/api/ittools/v1/converter/base64/encode', description: 'Base64 Encode', section: 'ITTools - Converter',
        params: [{ name: 'text', type: 'string', required: true }]
    },
{
        id: 'conv_b64d', method: 'POST', path: '/api/ittools/v1/converter/base64/decode', description: 'Base64 Decode', section: 'ITTools - Converter',
        params: [{ name: 'encoded', type: 'string', required: true }]
    },
{
        id: 'conv_case', method: 'POST', path: '/api/ittools/v1/converter/case', description: 'Convert Text Case', section: 'ITTools - Converter',
        params: [{ name: 'text', type: 'string', required: true }]
    },
{
        id: 'conv_url_e', method: 'POST', path: '/api/ittools/v1/converter/url/encode', description: 'URL Encode', section: 'ITTools - Converter',
        params: [{ name: 'url', type: 'string', required: true }]
    },
{
        id: 'conv_url_d', method: 'POST', path: '/api/ittools/v1/converter/url/decode', description: 'URL Decode', section: 'ITTools - Converter',
        params: [{ name: 'encoded', type: 'string', required: true }]
    },
{
        id: 'conv_j2y', method: 'POST', path: '/api/ittools/v1/converter/json-to-yaml', description: 'JSON to YAML', section: 'ITTools - Converter',
        params: [{ name: 'json', type: 'string', required: true }]
    },
{
        id: 'conv_y2j', method: 'POST', path: '/api/ittools/v1/converter/yaml-to-json', description: 'YAML to JSON', section: 'ITTools - Converter',
        params: [{ name: 'yaml', type: 'string', required: true }]
    },
{
        id: 'conv_temp', method: 'POST', path: '/api/ittools/v1/converter/temperature', description: 'Temperature Converter', section: 'ITTools - Converter',
        params: [
            { name: 'value', type: 'numeric', required: true },
            { name: 'from', type: 'string', required: true, options: ['celsius', 'fahrenheit', 'kelvin'] }
        ]
    },
{
        id: 'conv_roman', method: 'POST', path: '/api/ittools/v1/converter/roman/to-arabic', description: 'Roman to Arabic', section: 'ITTools - Converter',
        params: [{ name: 'roman', type: 'string', required: true }]
    },
{
        id: 'conv_date', method: 'POST', path: '/api/ittools/v1/converter/datetime', description: 'DateTime Converter', section: 'ITTools - Converter',
        params: [
            { name: 'input', type: 'string', required: true },
            { name: 'inputFormat', type: 'string', required: false, options: ['iso8601', 'unix', 'date'] }
        ]
    },
// --- ITTools - Web ---
    {
        id: 'web_json', method: 'POST', path: '/api/ittools/v1/web/json/prettify', description: 'JSON Prettify', section: 'ITTools - Web',
        params: [
            { name: 'json', type: 'string', required: true },
            { name: 'indent', type: 'integer', required: false, default: 2 }
        ]
    },
{
        id: 'web_json_min', method: 'POST', path: '/api/ittools/v1/web/json/minify', description: 'JSON Minify', section: 'ITTools - Web',
        params: [{ name: 'json', type: 'string', required: true }]
    },
{
        id: 'web_jwt', method: 'POST', path: '/api/ittools/v1/web/jwt/parse', description: 'JWT Parser', section: 'ITTools - Web',
        params: [{ name: 'token', type: 'string', required: true }]
    },
{
        id: 'web_md', method: 'POST', path: '/api/ittools/v1/web/markdown/to-html', description: 'Markdown to HTML', section: 'ITTools - Web',
        params: [{ name: 'markdown', type: 'string', required: true }]
    },
{
        id: 'web_sql', method: 'POST', path: '/api/ittools/v1/web/sql/format', description: 'SQL Format', section: 'ITTools - Web',
        params: [{ name: 'sql', type: 'string', required: true }]
    },
{
        id: 'web_qr', method: 'POST', path: '/api/ittools/v1/web/qr-code/generate', description: 'Generate QR Code', section: 'ITTools - Web',
        params: [
            { name: 'text', type: 'string', required: true },
            { name: 'size', type: 'integer', required: false, default: 300 }
        ]
    },
{
        id: 'web_wifi', method: 'POST', path: '/api/ittools/v1/web/wifi-qr-code/generate', description: 'Generate WiFi QR Code', section: 'ITTools - Web',
        params: [
            { name: 'ssid', type: 'string', required: true },
            { name: 'password', type: 'string', required: false },
            { name: 'encryption', type: 'string', required: false, default: 'WPA' },
            { name: 'hidden', type: 'boolean', required: false, default: false }
        ]
    },
{
        id: 'web_xml', method: 'POST', path: '/api/ittools/v1/web/xml/format', description: 'XML Format', section: 'ITTools - Web',
        params: [{ name: 'xml', type: 'string', required: true }]
    },
{
        id: 'web_yaml', method: 'POST', path: '/api/ittools/v1/web/yaml/format', description: 'YAML Format', section: 'ITTools - Web',
        params: [{ name: 'yaml', type: 'string', required: true }]
    },
// --- ITTools - Advanced ---
    {
        id: 'adv_img_c', method: 'POST', path: '/api/ittools/v1/advanced/image/compress', description: 'Image Compress', section: 'ITTools - Advanced',
        params: [
            { name: 'image', type: 'file', required: true },
            { name: 'quality', type: 'integer', required: false, default: 85 }
        ]
    },
{
        id: 'adv_img_crop', method: 'POST', path: '/api/ittools/v1/advanced/image/crop', description: 'Image Crop', section: 'ITTools - Advanced',
        params: [
            { name: 'image', type: 'file', required: true },
            { name: 'width', type: 'integer', required: true },
            { name: 'height', type: 'integer', required: true },
            { name: 'x', type: 'integer', required: false, default: 0 },
            { name: 'y', type: 'integer', required: false, default: 0 }
        ]
    },
{
        id: 'adv_pdf_split', method: 'POST', path: '/api/ittools/v1/advanced/pdf/split', description: 'PDF Split', section: 'ITTools - Advanced',
        params: [
            { name: 'pdf', type: 'file', required: true },
            { name: 'ranges', type: 'string', required: true, description: 'e.g. 1-2,4' }
        ]
    },
// --- MCP - Screenshots ---
    {
        id: 'mcp_ss_up', method: 'POST', path: '/api/mcp/v1/screenshots/upload', description: 'Upload Screenshot', section: 'MCP - Screenshots',
        params: [
            { name: 'image', type: 'file', required: true },
            { name: 'description', type: 'string', required: false }
        ]
    },
{
        id: 'mcp_ss_list', method: 'GET', path: '/api/mcp/v1/screenshots/latest', description: 'Get Latest Screenshot', section: 'MCP - Screenshots'
    },
{
        id: 'mcp_ss_search', method: 'GET', path: '/api/mcp/v1/screenshots/search', description: 'Search Screenshots', section: 'MCP - Screenshots',
        params: [{ name: 'keyword', type: 'string', required: true }]
    },
// --- MCP - Task Dispatch ---
    {
        id: 'mcp_task_cat', method: 'GET', path: '/api/mcp/v1/task-dispatch/categories', description: 'Get Task Categories', section: 'MCP - Tasks'
    },
{
        id: 'mcp_task_add', method: 'POST', path: '/api/mcp/v1/task-dispatch/queue/add-file', description: 'Add Task to Queue', section: 'MCP - Tasks',
        params: [
            { name: 'category_id', type: 'string', required: true },
            { name: 'content', type: 'string', required: true }
        ]
    },
// --- MCP - Voice Subtitle ---
    {
        id: 'mcp_voice_add', method: 'POST', path: '/api/mcp/v1/voice-subtitle/add', description: 'Add to Voice Queue', section: 'MCP - Voice',
        params: [
            { name: 'type', type: 'string', required: true, options: ['text', 'url', 'voice'] },
            { name: 'content', type: 'string', required: true },
            { name: 'language', type: 'string', required: false, default: 'en' }
        ]
    },
{
        id: 'mcp_voice_q', method: 'GET', path: '/api/mcp/v1/voice-subtitle/queue', description: 'Get Voice Queue', section: 'MCP - Voice'
    },
{
        id: 'mcp_voice_cur', method: 'GET', path: '/api/mcp/v1/voice-subtitle/current', description: 'Get Current Voice Track', section: 'MCP - Voice'
    },
{
        id: 'mcp_voice_next', method: 'POST', path: '/api/mcp/v1/voice-subtitle/next', description: 'Play Next Voice', section: 'MCP - Voice'
    },
{
        id: 'mcp_voice_prev', method: 'POST', path: '/api/mcp/v1/voice-subtitle/previous', description: 'Play Previous Voice', section: 'MCP - Voice'
    },
// --- Clipboard ---
    {
        id: 'clip_get', method: 'GET', path: '/clipboard/data', description: 'Get Clipboard Data', section: 'Clipboard',
        params: [{ name: 'namespace', type: 'string', required: true }]
    },
{
        id: 'clip_save', method: 'POST', path: '/clipboard/text', description: 'Save Text to Clipboard', section: 'Clipboard',
        params: [
            { name: 'namespace', type: 'string', required: true },
            { name: 'text', type: 'string', required: true }
        ]
    },
// --- Code Browser ---
    {
        id: 'code_tree', method: 'GET', path: '/code-browser/file-tree', description: 'Get File Tree', section: 'Code Browser',
        params: [{ name: 'path', type: 'string', required: false }]
    },
{
        id: 'code_read', method: 'GET', path: '/code-browser/read-file', description: 'Read File Content', section: 'Code Browser',
        params: [{ name: 'path', type: 'string', required: true }]
    },
{
        id: 'code_save', method: 'POST', path: '/code-browser/save-file', description: 'Save File', section: 'Code Browser',
        params: [
            { name: 'path', type: 'string', required: true },
            { name: 'content', type: 'string', required: true }
        ]
    },
// --- Static Resources ---
    {
        id: 'static_tree', method: 'GET', path: '/static-resources/file-tree', description: 'Get Static Resources', section: 'Static Resources',
        params: [{ name: 'path', type: 'string', required: false }]
    },
{
        id: 'static_up', method: 'POST', path: '/static-resources/upload', description: 'Upload Static Files', section: 'Static Resources',
        params: [{ name: 'files', type: 'file', required: true }]
    },
// --- Translation API ---
    {
        id: 'trans_translate', method: 'POST', path: '/translation/translate', description: 'Translate Text', section: 'Translation',
        params: [
            { name: 'text', type: 'string', required: true },
            { name: 'source_language', type: 'string', required: false },
            { name: 'target_language', type: 'string', required: true },
            { name: 'type', type: 'string', required: false, options: ['general', 'learning', 'technical', 'casual'] }
        ]
    },
{
        id: 'trans_batch', method: 'POST', path: '/translation/batch', description: 'Batch Translate', section: 'Translation',
        params: [
            { name: 'texts', type: 'array', required: true },
            { name: 'target_language', type: 'string', required: true }
        ]
    },
{
        id: 'trans_detect', method: 'POST', path: '/translation/detect', description: 'Detect Language', section: 'Translation',
        params: [
            { name: 'text', type: 'string', required: true },
            { name: 'target_language', type: 'string', required: true }
        ]
    },
{
        id: 'trans_languages', method: 'GET', path: '/translation/languages', description: 'Get Supported Languages', section: 'Translation',
        params: []
    },
// --- TTS API ---
    {
        id: 'tts_generate', method: 'POST', path: '/tts/generate', description: 'Generate TTS Audio', section: 'TTS',
        params: [
            { name: 'text', type: 'string', required: true },
            { name: 'language', type: 'string', required: true },
            { name: 'voice_type', type: 'string', required: false },
            { name: 'speed', type: 'numeric', required: false },
            { name: 'pitch', type: 'numeric', required: false },
            { name: 'volume', type: 'numeric', required: false }
        ]
    },
{
        id: 'tts_voices', method: 'GET', path: '/tts/voices', description: 'Get Available Voices', section: 'TTS',
        params: []
    },
{
        id: 'tts_check', method: 'POST', path: '/tts/check', description: 'Check TTS Cache', section: 'TTS',
        params: [
            { name: 'text', type: 'string', required: true },
            { name: 'language', type: 'string', required: true }
        ]
    },
// --- MCP Screenshots Extended ---
    {
        id: 'mcp_ss_batch', method: 'POST', path: '/api/mcp/v1/screenshots/upload-batch', description: 'Batch Upload Screenshots', section: 'MCP - Screenshots',
        params: [{ name: 'images', type: 'file', required: true }]
    },
{
        id: 'mcp_ss_merge', method: 'POST', path: '/api/mcp/v1/screenshots/upload-merge', description: 'Upload & Merge Screenshots', section: 'MCP - Screenshots',
        params: [
            { name: 'images', type: 'file', required: true },
            { name: 'direction', type: 'string', required: false, options: ['vertical', 'horizontal'] }
        ]
    },
{
        id: 'mcp_ss_list_all', method: 'GET', path: '/api/mcp/v1/screenshots/', description: 'Get All Screenshots', section: 'MCP - Screenshots',
        params: [
            { name: 'page', type: 'integer', required: false },
            { name: 'per_page', type: 'integer', required: false }
        ]
    }
];

