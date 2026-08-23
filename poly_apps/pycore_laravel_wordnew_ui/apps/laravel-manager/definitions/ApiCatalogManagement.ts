/** Laravel API catalog fragment. */
import type { ApiCatalogEndpoint } from '../uiTypes';

export const API_MANAGEMENT_ENDPOINTS: ApiCatalogEndpoint[] = [
{
        id: 'mcp_ss_detail', method: 'GET', path: '/api/mcp/v1/screenshots/{id}', description: 'Get Screenshot Detail', section: 'MCP - Screenshots',
        params: []
    },
{
        id: 'mcp_ss_delete', method: 'DELETE', path: '/api/mcp/v1/screenshots/{id}', description: 'Delete Screenshot', section: 'MCP - Screenshots',
        params: []
    },
{
        id: 'mcp_ss_stats', method: 'GET', path: '/api/mcp/v1/screenshots/stats', description: 'Get Screenshot Stats', section: 'MCP - Screenshots',
        params: []
    },
// --- MCP Task Dispatch Extended ---
    {
        id: 'mcp_task_cat_create', method: 'POST', path: '/api/mcp/v1/task-dispatch/categories', description: 'Create Task Category', section: 'MCP - Tasks',
        params: [
            { name: 'name', type: 'string', required: true },
            { name: 'description', type: 'string', required: false }
        ]
    },
{
        id: 'mcp_task_queue', method: 'GET', path: '/api/mcp/v1/task-dispatch/queue/{categoryId}/tasks', description: 'Get Task Queue', section: 'MCP - Tasks',
        params: [
            { name: 'status', type: 'string', required: false },
            { name: 'limit', type: 'integer', required: false }
        ]
    },
{
        id: 'mcp_task_stats', method: 'GET', path: '/api/mcp/v1/task-dispatch/queue/{categoryId}/stats', description: 'Get Queue Stats', section: 'MCP - Tasks',
        params: []
    },
{
        id: 'mcp_task_mappings', method: 'GET', path: '/api/mcp/v1/task-dispatch/mappings', description: 'Get Prompt Mappings', section: 'MCP - Tasks',
        params: []
    },
{
        id: 'mcp_task_mapping_update', method: 'PUT', path: '/api/mcp/v1/task-dispatch/mappings/{categoryId}', description: 'Update Prompt Mapping', section: 'MCP - Tasks',
        params: [
            { name: 'prompt_file_path', type: 'string', required: true },
            { name: 'prompt_content', type: 'string', required: false }
        ]
    },
// --- MCP Placeholder ---
    {
        id: 'mcp_placeholder_gen', method: 'POST', path: '/api/mcp/v1/placeholders/generate', description: 'Generate Placeholder', section: 'MCP - Placeholder',
        params: [
            { name: 'width', type: 'integer', required: true },
            { name: 'height', type: 'integer', required: true },
            { name: 'text', type: 'string', required: false },
            { name: 'format', type: 'string', required: false, options: ['png', 'jpg', 'svg', 'webp'] }
        ]
    },
{
        id: 'mcp_placeholder_list', method: 'GET', path: '/api/mcp/v1/placeholders/', description: 'Get Placeholders', section: 'MCP - Placeholder',
        params: []
    },
{
        id: 'mcp_placeholder_stats', method: 'GET', path: '/api/mcp/v1/placeholders/stats', description: 'Get Placeholder Stats', section: 'MCP - Placeholder',
        params: []
    },
// --- Octane Tasks ---
    {
        id: 'octane_status', method: 'GET', path: '/octane-tasks/status', description: 'Get Octane Tasks Status', section: 'Octane Tasks',
        params: []
    },
{
        id: 'octane_task_detail', method: 'GET', path: '/octane-tasks/task/{taskName}', description: 'Get Task Detail', section: 'Octane Tasks',
        params: []
    },
{
        id: 'octane_basic', method: 'GET', path: '/octane-tasks/basic', description: 'Get Basic Objects', section: 'Octane Tasks',
        params: []
    },
{
        id: 'octane_verify', method: 'GET', path: '/octane-tasks/verify', description: 'Verify Initialization', section: 'Octane Tasks',
        params: []
    },
// --- ServerManager - API Info ---
    {
        id: 'srvmgr_info', method: 'GET', path: '/api/servermanager/v1/info', 
        description: 'Get ServerManager API information', section: 'ServerManager - API Info',
        params: []
    },
// --- ServerManager - Nginx Management ---
    {
        id: 'nginx1', method: 'GET', path: '/api/servermanager/v1/nginx/sites', 
        description: 'List all nginx sites', section: 'ServerManager - Nginx',
        params: []
    },
{
        id: 'nginx2', method: 'POST', path: '/api/servermanager/v1/nginx/sites', 
        description: 'Create new nginx site', section: 'ServerManager - Nginx',
        params: [
            { name: 'site_name', type: 'string', required: true },
            { name: 'domain', type: 'string', required: true },
            { name: 'site_type', type: 'string', required: true, options: ['laravel', 'static', 'proxy', 'nuxt'] },
            { name: 'www_dir', type: 'string', required: true },
            { name: 'php_mode', type: 'string', required: false, options: ['fpm', 'swoole'] },
            { name: 'swoole_port', type: 'integer', required: false },
            { name: 'ssl_enabled', type: 'boolean', required: false }
        ]
    },
{
        id: 'nginx3', method: 'GET', path: '/api/servermanager/v1/nginx/config', 
        description: 'Get nginx site configuration', section: 'ServerManager - Nginx',
        params: [
            { name: 'site_name', type: 'string', required: true }
        ]
    },
{
        id: 'nginx4', method: 'PUT', path: '/api/servermanager/v1/nginx/sites/{site_name}', 
        description: 'Update nginx site', section: 'ServerManager - Nginx',
        params: [
            { name: 'site_name', type: 'string', required: true, path: true },
            { name: 'site_config', type: 'string', required: true }
        ]
    },
{
        id: 'nginx5', method: 'POST', path: '/api/servermanager/v1/nginx/enable', 
        description: 'Enable nginx site', section: 'ServerManager - Nginx',
        params: [
            { name: 'site_name', type: 'string', required: true }
        ]
    },
{
        id: 'nginx6', method: 'POST', path: '/api/servermanager/v1/nginx/disable', 
        description: 'Disable nginx site', section: 'ServerManager - Nginx',
        params: [
            { name: 'site_name', type: 'string', required: true }
        ]
    },
{
        id: 'nginx7', method: 'POST', path: '/api/servermanager/v1/nginx/test', 
        description: 'Test nginx configuration', section: 'ServerManager - Nginx',
        params: []
    },
{
        id: 'nginx8', method: 'POST', path: '/api/servermanager/v1/nginx/reload', 
        description: 'Reload nginx configuration', section: 'ServerManager - Nginx',
        params: []
    },
{
        id: 'nginx9', method: 'DELETE', path: '/api/servermanager/v1/nginx/sites/{site_name}',
        description: 'Delete nginx site', section: 'ServerManager - Nginx',
        params: [
            { name: 'site_name', type: 'string', required: true, path: true }
        ]
    },
{
        id: 'nginx10', method: 'GET', path: '/api/servermanager/v1/nginx/status',
        description: 'Nginx overview: install/version/running/config-test/site count', section: 'ServerManager - Nginx',
        params: []
    },
{
        id: 'nginx11', method: 'POST', path: '/api/servermanager/v1/nginx/service',
        description: 'Control the nginx service', section: 'ServerManager - Nginx',
        params: [
            { name: 'action', type: 'string', required: true, options: ['start', 'stop', 'restart', 'reload', 'status'] }
        ]
    },
{
        id: 'nginx12', method: 'GET', path: '/api/servermanager/v1/nginx/logs',
        description: 'Read nginx access/error log tail', section: 'ServerManager - Nginx',
        params: [
            { name: 'type', type: 'string', required: false, options: ['access', 'error'], default: 'access' },
            { name: 'lines', type: 'integer', required: false, default: 200, description: '10..2000' },
            { name: 'filter', type: 'string', required: false, description: 'Substring filter' }
        ]
    },
{
        id: 'nginx13', method: 'POST', path: '/api/servermanager/v1/nginx/install',
        description: 'Run the idempotent nginx installer (long-running)', section: 'ServerManager - Nginx',
        params: []
    },
{
        id: 'nginx14', method: 'GET', path: '/api/servermanager/v1/nginx/backups',
        description: 'List nginx config backups', section: 'ServerManager - Nginx',
        params: [
            { name: 'site', type: 'string', required: false }
        ]
    },
{
        id: 'nginx15', method: 'POST', path: '/api/servermanager/v1/nginx/backups/restore',
        description: 'Restore a nginx config backup', section: 'ServerManager - Nginx',
        params: [
            { name: 'file', type: 'string', required: true }
        ]
    },
{
        id: 'nginx16', method: 'GET', path: '/api/servermanager/v1/nginx/main-config',
        description: 'Read nginx.conf + conf.d listing (read-only)', section: 'ServerManager - Nginx',
        params: []
    },
{
        id: 'nginx17', method: 'GET', path: '/api/servermanager/v1/nginx/port-check',
        description: 'Check whether a TCP port is in use', section: 'ServerManager - Nginx',
        params: [
            { name: 'port', type: 'integer', required: true, description: '1..65535' }
        ]
    },
{
        id: 'nginx18', method: 'GET', path: '/api/servermanager/v1/nginx/metrics',
        description: 'Nginx stub_status + process stats', section: 'ServerManager - Nginx',
        params: []
    },
{
        id: 'nginx19', method: 'POST', path: '/api/servermanager/v1/nginx/sites/batch',
        description: 'Batch enable/disable/test nginx sites', section: 'ServerManager - Nginx',
        params: [
            { name: 'action', type: 'string', required: true, options: ['enable', 'disable', 'test'] },
            { name: 'sites', type: 'array', required: true, description: 'Site names' }
        ]
    },
// --- ServerManager - SSL Certificates ---
    {
        id: 'ssl1', method: 'GET', path: '/api/servermanager/v1/certificates/',
        description: 'List SSL certificates', section: 'ServerManager - SSL',
        params: []
    },
{
        id: 'ssl2', method: 'POST', path: '/api/servermanager/v1/certificates/generate',
        description: 'Generate SSL certificate', section: 'ServerManager - SSL',
        params: [
            { name: 'domain', type: 'string', required: true },
            { name: 'provider', type: 'string', required: false, options: ['dnspod', 'cloudflare'] },
            { name: 'staging', type: 'boolean', required: false }
        ]
    },
{
        id: 'ssl3', method: 'POST', path: '/api/servermanager/v1/certificates/renew',
        description: 'Renew SSL certificates', section: 'ServerManager - SSL',
        params: [
            { name: 'all', type: 'boolean', required: false }
        ]
    },
{
        id: 'ssl4', method: 'GET', path: '/api/servermanager/v1/certificates/status',
        description: 'Get SSL certificate status', section: 'ServerManager - SSL',
        params: [
            { name: 'domain', type: 'string', required: true }
        ]
    },
{
        id: 'ssl5', method: 'GET', path: '/api/servermanager/v1/certificates/detect-certbot', 
        description: 'Detect Certbot installation', section: 'ServerManager - SSL',
        params: []
    },
{
        id: 'ssl6', method: 'POST', path: '/api/servermanager/v1/certificates/install-certbot', 
        description: 'Install Certbot', section: 'ServerManager - SSL',
        params: []
    },
// --- ServerManager - System Info ---
    {
        id: 'sysmgr1', method: 'GET', path: '/api/servermanager/v1/system/info', 
        description: 'Get system information', section: 'ServerManager - System',
        params: []
    },
{
        id: 'sysmgr2', method: 'GET', path: '/api/servermanager/v1/system/services', 
        description: 'Get system services status', section: 'ServerManager - System',
        params: []
    },
{
        id: 'sysmgr3', method: 'GET', path: '/api/servermanager/v1/system/processes', 
        description: 'Get system processes list', section: 'ServerManager - System',
        params: []
    },
{
        id: 'sysmgr4', method: 'GET', path: '/api/servermanager/v1/system/storage', 
        description: 'Get system storage information', section: 'ServerManager - System',
        params: []
    },
{
        id: 'sysmgr4b', method: 'GET', path: '/api/servermanager/v1/system/static-resources',
        description: 'Get static resources summary (laravel_db/static)', section: 'ServerManager - System',
        params: []
    },
{
        id: 'sysmgr4c', method: 'GET', path: '/api/servermanager/v1/system/static-resources/files',
        description: 'List files in a static subdirectory (search, sort, pagination)', section: 'ServerManager - System',
        params: [
            { name: 'path', type: 'string', required: true },
            { name: 'q', type: 'string', required: false },
            { name: 'sort', type: 'string', required: false, options: ['name', 'size', 'modified'] },
            { name: 'order', type: 'string', required: false, options: ['asc', 'desc'] },
            { name: 'page', type: 'integer', required: false },
            { name: 'per_page', type: 'integer', required: false }
        ]
    },
{
        id: 'sysmgr5', method: 'GET', path: '/api/servermanager/v1/system/permissions', 
        description: 'Get system permissions check', section: 'ServerManager - System',
        params: []
    },
// --- ServerManager - File Management ---
    {
        id: 'file1', method: 'GET', path: '/api/servermanager/v1/files/browse', 
        description: 'Browse files and directories', section: 'ServerManager - File Management',
        params: [
            { name: 'path', type: 'string', required: false }
        ]
    },
{
        id: 'file2', method: 'GET', path: '/api/servermanager/v1/files/download', 
        description: 'Download file', section: 'ServerManager - File Management',
        params: [
            { name: 'file_path', type: 'string', required: true }
        ]
    },
{
        id: 'file3', method: 'GET', path: '/api/servermanager/v1/files/info', 
        description: 'Get file information', section: 'ServerManager - File Management',
        params: [
            { name: 'file_path', type: 'string', required: true }
        ]
    },
{
        id: 'file4', method: 'GET', path: '/api/servermanager/v1/files/preview', 
        description: 'Preview text file content', section: 'ServerManager - File Management',
        params: [
            { name: 'file_path', type: 'string', required: true },
            { name: 'max_lines', type: 'integer', required: false }
        ]
    },
// --- ServerManager - Code Executor ---
    {
        id: 'exec1', method: 'GET', path: '/api/servermanager/v1/executor/scripts', 
        description: 'List predefined scripts', section: 'ServerManager - Code Executor',
        params: []
    },
{
        id: 'exec2', method: 'POST', path: '/api/servermanager/v1/executor/run', 
        description: 'Execute predefined script', section: 'ServerManager - Code Executor',
        params: [
            { name: 'script_id', type: 'integer', required: true }
        ]
    },
{
        id: 'exec3', method: 'GET', path: '/api/servermanager/v1/executor/logs', 
        description: 'Get execution logs', section: 'ServerManager - Code Executor',
        params: [
            { name: 'execution_id', type: 'string', required: false }
        ]
    },
{
        id: 'exec4', method: 'GET', path: '/api/servermanager/v1/executor/status', 
        description: 'Get execution status', section: 'ServerManager - Code Executor',
        params: []
    },
// --- ServerManager - Unified Manager ---
    {
        id: 'unified1', method: 'GET', path: '/api/servermanager/v1/unified/apps', 
        description: 'List applications from unified manager', section: 'ServerManager - Unified Manager',
        params: []
    },
{
        id: 'unified2', method: 'POST', path: '/api/servermanager/v1/unified/deploy', 
        description: 'Deploy application', section: 'ServerManager - Unified Manager',
        params: [
            { name: 'app_name', type: 'string', required: true },
            { name: 'action', type: 'string', required: true, options: ['deploy', 'start', 'stop', 'restart'] }
        ]
    },
{
        id: 'unified3', method: 'GET', path: '/api/servermanager/v1/unified/status', 
        description: 'Get application status', section: 'ServerManager - Unified Manager',
        params: [
            { name: 'app_name', type: 'string', required: true },
            { name: 'app_type', type: 'string', required: true, options: ['ncoreApp', 'pycoreApp', 'polyApp'] }
        ]
    },
{
        id: 'unified4', method: 'GET', path: '/api/servermanager/v1/unified/logs',
        description: 'Get application logs', section: 'ServerManager - Unified Manager',
        params: [
            { name: 'app_name', type: 'string', required: true },
            { name: 'lines', type: 'integer', required: false }
        ]
    },
// --- Dashboard - DB Manager ---
    {
        id: 'dbmgr_cred_get', method: 'GET', path: '/api/dashboard/db-manager/credentials',
        description: 'Get credential snapshot for a connection', section: 'Dashboard - DB Manager',
        params: [
            { name: 'connection', type: 'string', required: true, description: 'Laravel connection key, e.g. pgsql/mysql/sqlite' }
        ]
    },
{
        id: 'dbmgr_cred_change', method: 'POST', path: '/api/dashboard/db-manager/credentials/change',
        description: 'Set a new password for a connection user', section: 'Dashboard - DB Manager',
        params: [
            { name: 'connection', type: 'string', required: true },
            { name: 'new_password', type: 'string', required: true },
            { name: 'user', type: 'string', required: false, description: 'Defaults to the configured connection user' }
        ]
    },
{
        id: 'dbmgr_cred_reset', method: 'POST', path: '/api/dashboard/db-manager/credentials/reset',
        description: 'Generate a fresh strong password for the connection', section: 'Dashboard - DB Manager',
        params: [
            { name: 'connection', type: 'string', required: true }
        ]
    },
{
        id: 'dbmgr_user_create', method: 'POST', path: '/api/dashboard/db-manager/credentials/users',
        description: 'Create a database account (password is shown once when generated)', section: 'Dashboard - DB Manager',
        params: [
            { name: 'connection', type: 'string', required: true },
            { name: 'username', type: 'string', required: true },
            { name: 'password', type: 'string', required: false, description: 'Generated server-side when omitted' }
        ]
    },
{
        id: 'dbmgr_user_delete', method: 'DELETE', path: '/api/dashboard/db-manager/credentials/users/{username}',
        description: 'Drop a database account (configured superuser is guarded server-side)', section: 'Dashboard - DB Manager',
        params: [
            { name: 'username', type: 'string', required: true, path: true },
            { name: 'connection', type: 'string', required: true }
        ]
    },
// --- Global Tasks (distributed worker queue, control-plane no-auth) ---
    {
        id: 'gtask_create', method: 'POST', path: '/api/task/create',
        description: 'Create a global task (interactive:true → remote_fast fast lane @priority 100)', section: 'Global Tasks',
        params: [
            { name: 'app_name', type: 'string', required: true },
            { name: 'task_type', type: 'string', required: true },
            { name: 'payload', type: 'string', required: true, description: 'JSON object' },
            { name: 'interactive', type: 'boolean', required: false, description: 'User-initiated fast lane' },
            { name: 'capability', type: 'string', required: false, options: ['audio', 'image', 'translate', 'sentence_audio'] }
        ]
    },
{
        id: 'gtask_detail', method: 'GET', path: '/api/task/{taskId}/detail',
        description: 'Full task detail: task + event timeline + current phase + retry metadata', section: 'Global Tasks',
        params: [
            { name: 'taskId', type: 'string', required: true, path: true }
        ]
    },
{
        id: 'gtask_bump', method: 'POST', path: '/api/task/{taskId}/bump',
        description: 'Bump a pending task priority (default 100); 404 unknown, 409 if not pending', section: 'Global Tasks',
        params: [
            { name: 'taskId', type: 'string', required: true, path: true },
            { name: 'priority', type: 'integer', required: false, default: 100 }
        ]
    }
];

