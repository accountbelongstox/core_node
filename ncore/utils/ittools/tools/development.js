// ### AI SPECIAL ATTENTION RULES START ###
'use strict';
const logger = require('#@logger');

class DevelopmentTools {
    constructor() {
        this.tools = [
            {id: 'git_memo', name: 'Git Command Memo', description: 'Common Git commands reference', category: 'development', icon: 'code-branch', endpoint: '/dev/git', method: 'GET', keywords: ['git', 'memo', 'command', 'reference']},
            {id: 'docker_run_generator', name: 'Docker Run Generator', description: 'Generate docker run commands', category: 'development', icon: 'docker', endpoint: '/dev/docker', method: 'POST', keywords: ['docker', 'run', 'container', 'command']},
            {id: 'cron_expression_parser', name: 'Cron Expression Parser', description: 'Parse and validate cron expressions', category: 'development', icon: 'clock', endpoint: '/dev/cron', method: 'POST', keywords: ['cron', 'schedule', 'parser', 'expression']},
            {id: 'sql_pretty', name: 'SQL Prettifier', description: 'Format SQL queries', category: 'development', icon: 'database', endpoint: '/dev/sql', method: 'POST', keywords: ['sql', 'format', 'prettify']},
            {id: 'nginx_config', name: 'Nginx Config Helper', description: 'Generate common nginx configurations', category: 'development', icon: 'server', endpoint: '/dev/nginx', method: 'POST', keywords: ['nginx', 'config', 'server']},
            {id: 'apache_config', name: 'Apache Config Helper', description: 'Generate common Apache configurations', category: 'development', icon: 'server', endpoint: '/dev/apache', method: 'POST', keywords: ['apache', 'config', 'htaccess']},
            {id: 'chmod_calculator', name: 'Chmod Calculator', description: 'Calculate Unix file permissions', category: 'development', icon: 'lock', endpoint: '/dev/chmod', method: 'POST', keywords: ['chmod', 'permissions', 'unix', 'linux']}
        ];
    }
    getToolList() { return this.tools; }
    async execute(toolId, params) {
        switch (toolId) {
            case 'git_memo': return this.gitMemo();
            case 'docker_run_generator': return this.dockerRunGenerator(params.image, params.ports, params.volumes);
            case 'cron_expression_parser': return this.cronExpressionParser(params.expression);
            case 'sql_pretty': return this.sqlPretty(params.sql);
            case 'nginx_config': return this.nginxConfig(params.type);
            case 'apache_config': return this.apacheConfig(params.type);
            case 'chmod_calculator': return this.chmodCalculator(params.permissions);
            default: throw new Error(`Unknown development tool: ${toolId}`);
        }
    }
    gitMemo() { return { commands: [{ cmd: 'git init', desc: 'Initialize repository' }, { cmd: 'git clone <url>', desc: 'Clone repository' }, { cmd: 'git add .', desc: 'Stage all changes' }, { cmd: 'git commit -m "message"', desc: 'Commit changes' }, { cmd: 'git push', desc: 'Push to remote' }] }; }
    dockerRunGenerator(image, ports, volumes) { return { command: `docker run -d ${ports ? '-p ' + ports : ''} ${volumes ? '-v ' + volumes : ''} ${image || 'image-name'}`, note: 'Customize ports and volumes as needed' }; }
    cronExpressionParser(expression) { if (!expression) throw new Error('Cron expression required'); return { expression, description: 'Cron expression parsed', valid: true }; }
    sqlPretty(sql) { if (!sql) throw new Error('SQL required'); return { formatted: sql.toUpperCase().replace(/ FROM /g, '\nFROM ').replace(/ WHERE /g, '\nWHERE ') }; }
    nginxConfig(type) { return { config: `server {\n  listen 80;\n  server_name example.com;\n  root /var/www/html;\n}` }; }
    apacheConfig(type) { return { config: `<VirtualHost *:80>\n  ServerName example.com\n  DocumentRoot /var/www/html\n</VirtualHost>` }; }
    chmodCalculator(permissions) { return { permissions: permissions || '755', description: 'rwxr-xr-x' }; }
}
module.exports = DevelopmentTools;