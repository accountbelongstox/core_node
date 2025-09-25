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

#!/usr/bin/env node

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

class CaddyScanner {
    constructor(port = 8080) {
        this.port = port;
        this.scanResults = {};
    }

    async executeCommand(command) {
        return new Promise((resolve) => {
            exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
                resolve({ success: !error, stdout: stdout?.trim(), error: error?.message });
            });
        });
    }

    async performScan() {
        console.log('🔍 开始Caddy扫描...');
        
        const results = {
            timestamp: new Date().toISOString(),
            installation: await this.checkInstallation(),
            services: await this.checkServices(),
            network: await this.checkNetwork(),
            config: await this.checkConfig(),
            system: this.getSystemInfo()
        };

        this.scanResults = results;
        console.log('✅ 扫描完成！');
        return results;
    }

    async checkInstallation() {
        const which = await this.executeCommand('which caddy');
        const version = await this.executeCommand('caddy version');
        const modules = await this.executeCommand('caddy list-modules');

        return {
            installed: which.success,
            path: which.stdout,
            version: version.stdout,
            modules: modules.success ? modules.stdout.split('\n').filter(l => l.trim()) : []
        };
    }

    async checkServices() {
        const status = await this.executeCommand('systemctl status caddy.service');
        const isActive = await this.executeCommand('systemctl is-active caddy.service');
        const isEnabled = await this.executeCommand('systemctl is-enabled caddy.service');
        const processes = await this.executeCommand('ps aux | grep caddy | grep -v grep');

        return {
            systemd: {
                status: status.stdout,
                active: isActive.success && isActive.stdout === 'active',
                enabled: isEnabled.success && isEnabled.stdout === 'enabled'
            },
            processes: processes.success ? processes.stdout.split('\n').filter(l => l.trim()) : []
        };
    }

    async checkNetwork() {
        const listening = await this.executeCommand('ss -tulpn | grep caddy');
        const connections = await this.executeCommand('netstat -tulpn | grep caddy');

        return {
            listening: listening.success ? listening.stdout.split('\n').filter(l => l.trim()) : [],
            connections: connections.success ? connections.stdout.split('\n').filter(l => l.trim()) : []
        };
    }

    async checkConfig() {
        const configPaths = ['/etc/caddy/Caddyfile', '/etc/caddyfile', './Caddyfile'];
        let caddyfile = { exists: false, path: null, content: null };

        for (const path of configPaths) {
            if (fs.existsSync(path)) {
                caddyfile = {
                    exists: true,
                    path: path,
                    content: fs.readFileSync(path, 'utf8')
                };
                break;
            }
        }

        return { caddyfile };
    }

    getSystemInfo() {
        return {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            cpus: os.cpus().length,
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem()
            },
            loadAverage: os.loadavg(),
            uptime: os.uptime()
        };
    }

    generateHTML() {
        const data = this.scanResults;
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Caddy 扫描报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { background: #667eea; color: white; padding: 20px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .warning { background: #fff3cd; color: #856404; }
        .code { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Caddy 扫描报告</h1>
            <p>扫描时间: ${new Date(data.timestamp).toLocaleString()}</p>
        </div>

        <div class="section">
            <h2>📊 概览</h2>
            <div class="grid">
                <div class="metric">
                    <h4>安装状态</h4>
                    <span class="status ${data.installation.installed ? 'success' : 'error'}">
                        ${data.installation.installed ? '已安装' : '未安装'}
                    </span>
                </div>
                <div class="metric">
                    <h4>服务状态</h4>
                    <span class="status ${data.services.systemd.active ? 'success' : 'warning'}">
                        ${data.services.systemd.active ? '运行中' : '未运行'}
                    </span>
                </div>
                <div class="metric">
                    <h4>监听端口</h4>
                    <span>${data.network.listening.length} 个</span>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔧 安装信息</h2>
            <div class="grid">
                <div class="metric">
                    <h4>可执行路径</h4>
                    <span>${data.installation.path || '未找到'}</span>
                </div>
                <div class="metric">
                    <h4>版本</h4>
                    <span>${data.installation.version || '未知'}</span>
                </div>
                <div class="metric">
                    <h4>模块数量</h4>
                    <span>${data.installation.modules.length} 个</span>
                </div>
            </div>
            ${data.installation.modules.length > 0 ? `
            <h4>模块列表:</h4>
            <div class="code">${data.installation.modules.join('\n')}</div>
            ` : ''}
        </div>

        <div class="section">
            <h2>🖥️ 服务状态</h2>
            <div class="grid">
                <div class="metric">
                    <h4>Systemd 状态</h4>
                    <span class="status ${data.services.systemd.active ? 'success' : 'warning'}">
                        ${data.services.systemd.active ? '活跃' : '非活跃'}
                    </span>
                </div>
                <div class="metric">
                    <h4>开机自启</h4>
                    <span class="status ${data.services.systemd.enabled ? 'success' : 'warning'}">
                        ${data.services.systemd.enabled ? '已启用' : '未启用'}
                    </span>
                </div>
                <div class="metric">
                    <h4>进程数量</h4>
                    <span>${data.services.processes.length} 个</span>
                </div>
            </div>
            ${data.services.processes.length > 0 ? `
            <h4>进程详情:</h4>
            <div class="code">${data.services.processes.join('\n')}</div>
            ` : ''}
        </div>

        <div class="section">
            <h2>🌐 网络端口</h2>
            <div class="grid">
                <div class="metric">
                    <h4>监听端口</h4>
                    <span>${data.network.listening.length} 个</span>
                </div>
                <div class="metric">
                    <h4>活跃连接</h4>
                    <span>${data.network.connections.length} 个</span>
                </div>
            </div>
            ${data.network.listening.length > 0 ? `
            <h4>监听端口详情:</h4>
            <div class="code">${data.network.listening.join('\n')}</div>
            ` : ''}
        </div>

        <div class="section">
            <h2>📄 配置文件</h2>
            <div class="grid">
                <div class="metric">
                    <h4>Caddyfile 存在</h4>
                    <span class="status ${data.config.caddyfile.exists ? 'success' : 'warning'}">
                        ${data.config.caddyfile.exists ? '是' : '否'}
                    </span>
                </div>
                <div class="metric">
                    <h4>配置文件路径</h4>
                    <span>${data.config.caddyfile.path || '未找到'}</span>
                </div>
            </div>
            ${data.config.caddyfile.exists ? `
            <h4>Caddyfile 内容:</h4>
            <div class="code">${data.config.caddyfile.content}</div>
            ` : ''}
        </div>

        <div class="section">
            <h2>🧾 系统信息</h2>
            <div class="grid">
                <div class="metric">
                    <h4>主机名</h4>
                    <span>${data.system.hostname}</span>
                </div>
                <div class="metric">
                    <h4>操作系统</h4>
                    <span>${data.system.platform} ${data.system.release}</span>
                </div>
                <div class="metric">
                    <h4>架构</h4>
                    <span>${data.system.arch}</span>
                </div>
                <div class="metric">
                    <h4>CPU 核心</h4>
                    <span>${data.system.cpus} 核</span>
                </div>
                <div class="metric">
                    <h4>总内存</h4>
                    <span>${(data.system.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                </div>
                <div class="metric">
                    <h4>可用内存</h4>
                    <span>${(data.system.memory.free / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📋 JSON 数据</h2>
            <button onclick="downloadJSON()" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-bottom: 15px;">
                💾 下载 JSON
            </button>
            <div class="code">${JSON.stringify(data, null, 2)}</div>
        </div>
    </div>

    <script>
        function downloadJSON() {
            const data = ${JSON.stringify(this.scanResults)};
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'caddy-scan-report.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>`;
    }

    async startServer() {
        const server = http.createServer(async (req, res) => {
            if (req.url === '/') {
                await this.performScan();
                const html = this.generateHTML();
                
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8'
                });
                res.end(html);
            } else if (req.url === '/api/scan') {
                await this.performScan();
                
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(this.scanResults, null, 2));
            } else if (req.url === '/api/scan/json') {
                await this.performScan();
                
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="caddy-scan-report.json"',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(this.scanResults, null, 2));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            }
        });

        server.listen(this.port, () => {
            console.log(`🚀 Caddy扫描服务器已启动！`);
            console.log(`📊 访问地址: http://localhost:${this.port}`);
            console.log(`🔗 API端点:`);
            console.log(`   - 主页: http://localhost:${this.port}/`);
            console.log(`   - JSON API: http://localhost:${this.port}/api/scan`);
            console.log(`   - JSON下载: http://localhost:${this.port}/api/scan/json`);
            console.log(`\n按 Ctrl+C 停止服务器`);
        });
    }
}

async function main() {
    const scanner = new CaddyScanner(8080);
    await scanner.startServer();
}

process.on('SIGINT', () => {
    console.log('\n👋 正在关闭Caddy扫描服务器...');
    process.exit(0);
});

main().catch(error => {
    console.error('❌ 启动服务器时发生错误:', error);
    process.exit(1);
}); 