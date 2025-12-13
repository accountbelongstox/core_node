# ServerManagerV1 Feature Analysis

## 概述

ServerManagerV1 是一个**企业级服务器管理系统**，提供了完整的域名管理、SSL证书、Nginx配置、文件管理和应用部署功能。与传统的服务器管理工具相比，它具有多项独特的**非常OK的功能**。

---

## 🌟 核心亮点功能 (Standout Features)

### 1. **环境感知架构** (Environment-Aware Architecture)

**独特价值**: 自动检测并适配不同环境（WSL/生产环境），无需手动配置路径

**实现方式**:
- 使用 `PathMapper` 进行路径映射
- 自动检测 WSL 环境并转换 Windows 路径到 Linux 路径
- 所有控制器和工具类都使用 `PathMapper::mapWebPath()` 替代硬编码路径

**代码示例**:
```php
// 环境感知的路径获取
$wwwroot = PathMapper::mapWebPath('wwwroot');
$dataDir = PathMapper::mapWebPath('laravel_data_dir');
$coreNode = PathMapper::getCoreNodeDir();

// 自动适配 WSL 环境
// WSL: /mnt/c/www/programing → /www/programing
// Production: /www/programing → /www/programing
```

**优势**:
- ✅ 跨环境部署零修改
- ✅ 开发环境和生产环境统一代码
- ✅ 自动处理 WSL 路径转换

---

### 2. **JSON 配置存储** (JSON-Based Configuration)

**独特价值**: 完全不依赖数据库，使用 JSON 文件存储所有域名和部署配置

**实现方式**:
```php
// 文件位置: laravel_data_dir/servermanager/domains/domains.json
{
  "version": "1.0",
  "updated_at": "2025-12-13 10:30:45",
  "domains": {
    "example.com": {
      "domain": "example.com",
      "type": "laravel",
      "www_dir": "/www/programing/example.com",
      "php_mode": "swoole",
      "swoole_port": 9001,
      "ssl_enabled": true,
      "nginx_enabled": true,
      "created_at": "2025-12-01 15:20:30",
      "deployment_count": 5
    }
  }
}
```

**优势**:
- ✅ 无数据库依赖，零配置启动
- ✅ 配置可直接编辑和版本控制
- ✅ 易于备份和迁移
- ✅ 避免 SQLite 驱动问题

**核心类**: `ServerManagerV1DomainManager`
- `loadDomains()`: 从 JSON 加载配置
- `saveDomains()`: 保存配置到 JSON
- `addDomain()`: 添加/更新域名配置

---

### 3. **双向同步系统** (Bidirectional Sync: DATABASE ↔ NGINX)

**独特价值**: 首创的双向配置同步机制，支持两种同步模式

#### 模式 A: DATABASE → NGINX (重新生成所有配置)
```bash
php artisan servermanager:sync --from-db
```
- 从 JSON 数据库读取所有域名配置
- 重新生成所有 Nginx 配置文件
- 自动启用/禁用站点

#### 模式 B: NGINX → DATABASE (导入现有配置)
```bash
php artisan servermanager:sync --from-nginx
```
- **扫描现有 Nginx 配置文件**
- **解析域名、路径、SSL、PHP 模式**
- **自动导入到 JSON 数据库**
- **检测配置冲突并报告**

**实现代码**:
```php
// ServerManagerV1SyncCommand.php
protected function syncFromNginx(): void
{
    // 1. 扫描 sites-available 目录
    $nginxConfigs = glob('/etc/nginx/sites-available/*');

    // 2. 解析每个配置文件
    foreach ($nginxConfigs as $configFile) {
        $config = $this->parseNginxConfig($configFile);

        // 3. 提取域名、路径、PHP模式、SSL
        $domain = $config['server_name'];
        $wwwDir = $config['root'];
        $phpMode = $this->detectPhpMode($config);

        // 4. 保存到数据库
        ServerManagerV1DomainManager::addDomain($domain, [
            'www_dir' => $wwwDir,
            'php_mode' => $phpMode,
            'ssl_enabled' => $config['ssl_enabled']
        ]);
    }
}
```

**优势**:
- ✅ **迁移现有服务器配置零成本**
- ✅ **手动修改 Nginx 配置后可同步回数据库**
- ✅ **支持批量导入和备份**
- ✅ **自动检测和修复配置不一致**

---

### 4. **智能 Swoole 端口共享** (Shared Swoole Port Management)

**独特价值**: 多个域名指向同一目录时，自动共享 Swoole 端口和服务

**实现逻辑**:
```php
// ServerManagerV1DomainManager::addDomain()

// 检查是否有其他域名使用相同目录
foreach ($domains as $existingDomain => $existingConfig) {
    if ($existingConfig['www_dir'] === $wwwDir) {
        // 找到相同目录的域名
        if (ServerManagerV1PathConfig::isSwooleMode($existingConfig['php_mode'])) {
            // 共享 Swoole 端口
            $sharedSwoolePort = $existingConfig['swoole_port'];
            Log::info('Sharing Swoole port with existing domain', [
                'domain' => $domain,
                'existing_domain' => $existingDomain,
                'shared_port' => $sharedSwoolePort
            ]);
        }
    }
}
```

**场景示例**:
```
example.com     → /www/laravel_main → Swoole 9001
www.example.com → /www/laravel_main → Swoole 9001 (共享)
api.example.com → /www/laravel_main → Swoole 9001 (共享)
```

**优势**:
- ✅ **一个应用一个 Swoole 服务**（节省资源）
- ✅ **多域名指向同一应用时自动共享端口**
- ✅ **避免端口冲突**
- ✅ **自动计算服务名称** (`getOctaneServiceNameFromPath()`)

---

### 5. **域名冲突检测** (Domain Conflict Detection)

**独特价值**: 添加域名前自动检测所有可能的冲突

**检测项**:
```php
// 1. 域名是否已存在
if (ServerManagerV1DomainManager::getDomain($domain)) {
    throw new \Exception("Domain already exists: $domain");
}

// 2. 同一目录是否有冲突的 PHP 模式
foreach ($domains as $existingDomain => $existingConfig) {
    if ($existingConfig['www_dir'] === $wwwDir) {
        if ($existingConfig['php_mode'] !== $newPhpMode) {
            throw new \Exception(
                "PHP mode conflict: $existingDomain uses {$existingConfig['php_mode']}, " .
                "but you are trying to add $domain with $newPhpMode"
            );
        }
    }
}

// 3. Swoole 端口冲突检测
if ($swoolePort && self::isPortInUse($swoolePort)) {
    throw new \Exception("Port $swoolePort is already in use");
}
```

**优势**:
- ✅ 提前发现配置错误
- ✅ 防止生产环境配置冲突
- ✅ 详细的错误提示和建议

---

### 6. **预定义脚本执行器** (Hardcoded Script Executor)

**独特价值**: 安全的预定义脚本执行系统，完全避免任意命令执行风险

**实现方式**:
```php
// ServerManagerV1CodeExecutorCtl::getPredefinedScripts()
private function getPredefinedScripts(): array
{
    return [
        1 => [
            'id' => 1,
            'name' => 'System Information',
            'category' => 'diagnostic',
            'command' => 'uname -a && uptime && free -h && df -h',
            'timeout' => 30,
            'requires_sudo' => false
        ],
        2 => [
            'id' => 2,
            'name' => 'Process List',
            'category' => 'diagnostic',
            'command' => 'ps aux --sort=-%cpu | head -20',
            'timeout' => 15
        ],
        // ... 10个预定义脚本
    ];
}
```

**API 调用**:
```json
POST /api/servermanager/v1/executor/run
{
  "script_id": 1
}

Response:
{
  "success": true,
  "data": {
    "execution_id": "exec_6758a12b3c4d5",
    "script_name": "System Information",
    "output": "Linux server 5.15.0 x86_64...",
    "execution_time": 0.245,
    "exit_code": 0
  }
}
```

**安全优势**:
- ✅ **完全禁止任意命令执行**（只能执行预定义脚本）
- ✅ **每个脚本有超时限制**
- ✅ **禁用需要 sudo 的脚本**（生产环境安全）
- ✅ **完整的执行日志记录**
- ✅ **执行 ID 跟踪每次执行**

**脚本分类**:
- `diagnostic`: 诊断类（系统信息、进程列表、网络状态）
- `system_maintenance`: 系统维护（日志轮转、缓存清理）
- `unified_manager`: 统一管理器（应用列表）

---

### 7. **文件管理安全白名单** (File Manager Security Whitelist)

**独特价值**: 严格的路径访问控制，防止任意文件访问

**实现机制**:
```php
// ServerManagerV1Utils::isPathAllowed()
public static function isPathAllowed(string $path): bool
{
    $allowedPaths = ServerManagerV1Constants::getAllowedDownloadPaths();

    // 标准化路径
    $path = realpath($path) ?: $path;

    // 检查是否在白名单内
    foreach ($allowedPaths as $allowedPath) {
        $allowedPath = realpath($allowedPath) ?: $allowedPath;
        if (strpos($path, $allowedPath) === 0) {
            return true;
        }
    }

    return false;
}

// ServerManagerV1Constants::getAllowedDownloadPaths()
public static function getAllowedDownloadPaths(): array
{
    $wwwroot = PathMapper::mapWebPath('wwwroot');
    return [
        "$wwwroot/wwwroot",
        "$wwwroot/core_node",
        "/var/log/nginx",
        "/etc/nginx/sites-available"
    ];
}
```

**安全检查**:
```php
// 1. 路径清理
$filePath = ServerManagerV1Utils::sanitizePath($request->input('file_path'));

// 2. 白名单检查
if (!ServerManagerV1Utils::isPathAllowed($filePath)) {
    return $this->errorResponse('Access denied. Path not in whitelist.');
}

// 3. 文件大小限制
if (filesize($filePath) > ServerManagerV1Constants::MAX_FILE_DOWNLOAD_SIZE) {
    return $this->errorResponse('File too large. Maximum size: 100MB');
}

// 4. 预览文件类型限制
if (!ServerManagerV1Utils::isPreviewAllowed($filePath)) {
    return $this->errorResponse('File type not allowed for preview.');
}
```

**API 功能**:
```json
GET /api/servermanager/v1/file/browse?path=/www/programing
GET /api/servermanager/v1/file/download?file_path=/www/programing/example.com/index.html
GET /api/servermanager/v1/file/preview?file_path=/etc/nginx/sites-available/example.com&max_lines=100
```

**优势**:
- ✅ **完全防止路径遍历攻击**
- ✅ **白名单制度，默认拒绝所有路径**
- ✅ **文件大小限制**（下载 100MB，预览 1MB）
- ✅ **预览文件类型限制**（仅允许文本/代码文件）
- ✅ **完整的访问日志**

---

### 8. **SSL 证书自动化管理** (Automated SSL Certificate Management)

**独特价值**: 完整的 Let's Encrypt 证书生成、续期和管理流程

**功能特性**:
```php
// 1. 自动生成 SSL 证书（使用 DNS 验证）
POST /api/servermanager/v1/certificate/generate
{
  "domain": "example.com",
  "provider": "dnspod",
  "staging": false
}

// 2. 自动续期所有证书
POST /api/servermanager/v1/certificate/renew
{
  "all": true
}

// 3. 证书状态检查
GET /api/servermanager/v1/certificate/status?domain=example.com
Response:
{
  "domain": "example.com",
  "expiry_date": "2026-03-15 10:30:45",
  "days_until_expiry": 87,
  "status": "ok"  // ok/warning/critical
}
```

**DNS 验证支持**:
```php
// ServerManagerV1CertificateManagerCtl::generateCertificateWithDns()
private function generateCertificateWithDns(string $domain, string $provider, array $credentials, bool $staging): array
{
    $command = ['certonly', '--dns-' . $provider];

    if ($staging) {
        $command[] = '--staging';
    }

    $command = array_merge($command, [
        '--email', $credentials['email'],
        '--agree-tos',
        '--non-interactive',
        '-d', $domain
    ]);

    // 设置 DNS 提供商环境变量
    $env = [];
    if ($provider === 'dnspod') {
        $env['CERTBOT_DNS_DNSPOD_CREDENTIALS'] = $this->createDnspodCredentialsFile($credentials);
    }

    return ServerManagerV1Utils::executeCommand('certbot', $command, 300, $env);
}
```

**证书状态分类**:
- `ok`: 超过 30 天到期
- `warning`: 7-30 天到期
- `critical`: 少于 7 天到期

**优势**:
- ✅ **支持 DNS 验证**（无需暴露 80/443 端口）
- ✅ **支持 DNSPod/Cloudflare 等多个 DNS 提供商**
- ✅ **自动续期所有证书**
- ✅ **证书到期预警**
- ✅ **自动 reload Nginx**

---

### 9. **统一应用部署管理** (Unified Application Deployment)

**独特价值**: 通过 API 调用统一管理器脚本，部署和管理所有应用

**实现方式**:
```php
// ServerManagerV1UnifiedManagerCtl::deployApp()
POST /api/servermanager/v1/unified/deploy
{
  "app_name": "laravel_main",
  "action": "deploy"  // deploy, start, stop, restart
}

Response:
{
  "deployment_id": "deploy_6758a12b3c4d5",
  "app_name": "laravel_main",
  "action": "deploy",
  "success": true,
  "output": "Deploying laravel_main...\nService started successfully.",
  "execution_time": 12.5,
  "started_at": "2025-12-13 10:30:00",
  "completed_at": "2025-12-13 10:30:12"
}
```

**支持的操作**:
```php
switch ($action) {
    case 'deploy':
        $args = ['--apps', $appName];
        break;
    case 'start':
        $args = ['--start', $appName];
        break;
    case 'stop':
        $args = ['--stop', $appName];
        break;
    case 'restart':
        $args = ['--restart', $appName];
        break;
}
```

**应用状态检查**:
```json
GET /api/servermanager/v1/unified/status?app_name=laravel_main
Response:
{
  "app_name": "laravel_main",
  "service_status": {
    "service_name": "ncore-laravel_main",
    "active": true,
    "status": "running",
    "since": "Mon 2025-12-13 08:00:00"
  },
  "process_info": {
    "running": true,
    "pids": ["12345", "12346"],
    "count": 2
  },
  "port_info": {
    "expected_port": 8000,
    "listening": true,
    "port": 8000
  },
  "overall_status": "running"
}
```

**应用日志获取**:
```json
GET /api/servermanager/v1/unified/logs?app_name=laravel_main&lines=100
Response:
{
  "app_name": "laravel_main",
  "logs": [
    {
      "source": "systemd",
      "line": "Dec 13 10:30:45 server ncore-laravel_main[12345]: Server started",
      "timestamp": 1702460445
    }
  ],
  "log_sources": ["systemd", "app.log", "error.log"]
}
```

**优势**:
- ✅ **通过 API 完全控制应用生命周期**
- ✅ **支持 systemd 服务管理**
- ✅ **实时状态检查（服务/进程/端口）**
- ✅ **统一日志收集**（systemd + 应用日志）
- ✅ **完整的部署历史记录**

---

### 10. **Nginx 配置解析器** (Nginx Config Parser)

**独特价值**: 可以解析现有 Nginx 配置文件并导入到系统

**核心功能**:
```php
// ServerManagerV1NginxInspectCommand.php
protected function parseNginxConfig(string $configFile): array
{
    $content = file_get_contents($configFile);

    $config = [
        'file' => $configFile,
        'server_name' => null,
        'root' => null,
        'php_mode' => 'fpm',
        'ssl_enabled' => false,
        'ssl_certificate' => null,
        'ssl_certificate_key' => null,
        'swoole_port' => null,
        'enabled' => $this->isSiteEnabled($configFile)
    ];

    // 解析 server_name
    if (preg_match('/server_name\s+([^;]+);/', $content, $matches)) {
        $config['server_name'] = trim($matches[1]);
    }

    // 解析 root 路径
    if (preg_match('/root\s+([^;]+);/', $content, $matches)) {
        $config['root'] = trim($matches[1]);
    }

    // 检测 PHP 模式
    if (strpos($content, 'proxy_pass') !== false) {
        if (preg_match('/proxy_pass\s+http:\/\/([^:]+):(\d+)/', $content, $matches)) {
            $config['php_mode'] = 'swoole';
            $config['swoole_port'] = (int)$matches[2];
        }
    } elseif (strpos($content, 'fastcgi_pass') !== false) {
        $config['php_mode'] = 'fpm';
    }

    // 检测 SSL
    if (strpos($content, 'ssl_certificate') !== false) {
        $config['ssl_enabled'] = true;

        if (preg_match('/ssl_certificate\s+([^;]+);/', $content, $matches)) {
            $config['ssl_certificate'] = trim($matches[1]);
        }

        if (preg_match('/ssl_certificate_key\s+([^;]+);/', $content, $matches)) {
            $config['ssl_certificate_key'] = trim($matches[1]);
        }
    }

    return $config;
}
```

**CLI 命令**:
```bash
# 检查所有 Nginx 站点配置
php artisan servermanager:nginx-inspect

# 检查特定域名
php artisan servermanager:nginx-inspect --domain=example.com

# 导入到数据库
php artisan servermanager:sync --from-nginx
```

**输出示例**:
```
📋 Nginx Sites Inspection Report

✅ example.com
   File: /etc/nginx/sites-available/example.com
   Root: /www/programing/example.com
   PHP Mode: swoole (port 9001)
   SSL: Enabled (/etc/letsencrypt/live/example.com/fullchain.pem)
   Enabled: Yes

⚠️  test.local
   File: /etc/nginx/sites-available/test.local
   Root: /var/www/test
   PHP Mode: fpm
   SSL: Disabled
   Enabled: No
```

**优势**:
- ✅ **导入现有服务器配置**
- ✅ **自动检测 PHP 模式**（FPM/Swoole）
- ✅ **自动提取 SSL 证书路径**
- ✅ **检测站点启用状态**
- ✅ **批量迁移现有站点**

---

### 11. **操作历史记录** (Operation History Tracking)

**独特价值**: 记录所有域名配置变更历史，支持审计和回滚

**实现方式**:
```php
// ServerManagerV1DomainManager::recordHistory()
private static function recordHistory(string $domain, string $action, array $details): void
{
    $historyFile = self::getHistoryFilePath();
    $history = self::loadHistory();

    $entry = [
        'id' => uniqid('history_', true),
        'domain' => $domain,
        'action' => $action,  // create, update, delete, deploy, ssl_enable
        'details' => $details,
        'timestamp' => time(),
        'timestamp_human' => date('Y-m-d H:i:s'),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'cli',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'cli'
    ];

    $history[] = $entry;

    // 限制历史记录数量（保留最近 1000 条）
    if (count($history) > 1000) {
        $history = array_slice($history, -1000);
    }

    file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT));
}
```

**查询历史**:
```json
GET /api/servermanager/v1/history?domain=example.com&limit=20
Response:
{
  "history": [
    {
      "id": "history_6758a12b3c4d5",
      "domain": "example.com",
      "action": "update",
      "details": {
        "old_config": { "php_mode": "fpm" },
        "new_config": { "php_mode": "swoole" }
      },
      "timestamp_human": "2025-12-13 10:30:45",
      "ip": "192.168.1.100"
    }
  ]
}
```

**优势**:
- ✅ **完整的变更审计日志**
- ✅ **支持按域名/操作类型过滤**
- ✅ **记录 IP 和用户代理**
- ✅ **可用于回滚和问题排查**

---

### 12. **批量操作支持** (Batch Operations)

**独特价值**: 支持批量启用/禁用/删除域名

**CLI 命令**:
```bash
# 批量启用多个域名
php artisan servermanager:website enable example.com,www.example.com,api.example.com

# 批量禁用
php artisan servermanager:website disable test1.local,test2.local

# 批量删除
php artisan servermanager:website delete --batch example1.com,example2.com
```

**实现代码**:
```php
// ServerManagerV1WebsiteCommand.php
protected function enableBatch(array $domains): void
{
    $results = [];

    foreach ($domains as $domain) {
        try {
            $this->enableSite($domain);
            $results[$domain] = 'success';
        } catch (\Exception $e) {
            $results[$domain] = 'failed: ' . $e->getMessage();
        }
    }

    // 输出结果
    $this->table(
        ['Domain', 'Result'],
        array_map(fn($domain, $result) => [$domain, $result],
                  array_keys($results),
                  array_values($results))
    );

    // 重载 Nginx
    $this->reloadNginx();
}
```

**优势**:
- ✅ **一次操作处理多个域名**
- ✅ **批量错误处理**
- ✅ **操作结果汇总表格**
- ✅ **自动 Nginx reload**

---

## 📊 完整功能清单

### API 端点 (30+ endpoints)

#### 系统信息
- `GET /api/servermanager/v1/system/info` - 完整系统信息
- `GET /api/servermanager/v1/system/processes` - 进程列表
- `GET /api/servermanager/v1/system/services` - 服务状态
- `GET /api/servermanager/v1/system/permissions` - 权限检查
- `GET /api/servermanager/v1/system/storage` - 存储使用情况

#### 文件管理
- `GET /api/servermanager/v1/file/browse` - 浏览目录
- `GET /api/servermanager/v1/file/download` - 下载文件
- `GET /api/servermanager/v1/file/info` - 文件信息
- `GET /api/servermanager/v1/file/preview` - 预览文本文件

#### 脚本执行
- `GET /api/servermanager/v1/executor/scripts` - 预定义脚本列表
- `POST /api/servermanager/v1/executor/run` - 执行脚本
- `GET /api/servermanager/v1/executor/logs` - 执行日志
- `GET /api/servermanager/v1/executor/status` - 执行状态

#### Nginx 管理
- `GET /api/servermanager/v1/nginx/sites` - 站点列表
- `POST /api/servermanager/v1/nginx/create` - 创建站点
- `GET /api/servermanager/v1/nginx/config` - 获取配置
- `POST /api/servermanager/v1/nginx/enable` - 启用站点
- `POST /api/servermanager/v1/nginx/disable` - 禁用站点
- `POST /api/servermanager/v1/nginx/delete` - 删除站点

#### SSL 证书
- `GET /api/servermanager/v1/certificate/list` - 证书列表
- `POST /api/servermanager/v1/certificate/generate` - 生成证书
- `POST /api/servermanager/v1/certificate/renew` - 续期证书
- `GET /api/servermanager/v1/certificate/status` - 证书状态
- `GET /api/servermanager/v1/certbot/detect` - 检测 Certbot
- `POST /api/servermanager/v1/certbot/install` - 安装 Certbot

#### 统一管理器
- `GET /api/servermanager/v1/unified/apps` - 应用列表
- `POST /api/servermanager/v1/unified/deploy` - 部署应用
- `GET /api/servermanager/v1/unified/status` - 应用状态
- `GET /api/servermanager/v1/unified/logs` - 应用日志

---

### CLI 命令 (50+ commands)

#### 部署命令
```bash
php artisan servermanager:deploy {domain}
php artisan servermanager:deploy-self  # 部署自身
php artisan servermanager:static-app {domain}  # 部署静态应用
php artisan servermanager:nuxt-app {domain}  # 部署 Nuxt 应用
```

#### SSL 命令
```bash
php artisan servermanager:ssl generate {domain}
php artisan servermanager:ssl renew {domain}
php artisan servermanager:ssl list
php artisan servermanager:ssl status {domain}
```

#### 证书命令
```bash
php artisan servermanager:certificate generate {domain}
php artisan servermanager:certificate renew --all
php artisan servermanager:certificate list
php artisan servermanager:check-certbot --install
```

#### 网站管理命令
```bash
php artisan servermanager:website create {domain}
php artisan servermanager:website enable {domain}
php artisan servermanager:website disable {domain}
php artisan servermanager:website delete {domain}
php artisan servermanager:website list
php artisan servermanager:website info {domain}
```

#### 同步命令
```bash
php artisan servermanager:sync --from-db     # 数据库 → Nginx
php artisan servermanager:sync --from-nginx  # Nginx → 数据库
php artisan servermanager:sync --backup      # 备份配置
php artisan servermanager:sync --restore     # 恢复配置
```

#### Nginx 检查命令
```bash
php artisan servermanager:nginx-inspect
php artisan servermanager:nginx-inspect --domain={domain}
php artisan servermanager:nginx-inspect --show-disabled
```

#### Swoole 命令
```bash
php artisan servermanager:swoole start {domain}
php artisan servermanager:swoole stop {domain}
php artisan servermanager:swoole restart {domain}
php artisan servermanager:swoole status {domain}
```

#### 高级命令
```bash
php artisan servermanager:advanced domain-conflicts  # 检测域名冲突
php artisan servermanager:advanced port-scan         # 扫描端口使用
php artisan servermanager:advanced cleanup-orphans   # 清理孤立配置
php artisan servermanager:advanced fix-permissions   # 修复权限
php artisan servermanager:advanced validate-all      # 验证所有配置
```

---

## 🏗️ 技术架构

### 核心组件

```
ServerManagerV1/
├── ServerManagerV1Controllers/        # API 控制器
│   ├── ServerManagerV1SystemInfoCtl.php
│   ├── ServerManagerV1FileManagerCtl.php
│   ├── ServerManagerV1CodeExecutorCtl.php
│   ├── ServerManagerV1NginxManagerCtl.php
│   ├── ServerManagerV1CertificateManagerCtl.php
│   └── ServerManagerV1UnifiedManagerCtl.php
│
├── ServerManagerV1CLI/Commands/       # CLI 命令
│   ├── ServerManagerV1DeployCommand.php
│   ├── ServerManagerV1SSLCommand.php
│   ├── ServerManagerV1WebsiteCommand.php
│   ├── ServerManagerV1SyncCommand.php
│   ├── ServerManagerV1NginxInspectCommand.php
│   └── ServerManagerV1AdvancedCommand.php
│
├── ServerManagerV1Utils/              # 工具类
│   ├── ServerManagerV1Utils.php
│   ├── ServerManagerV1DomainManager.php
│   ├── ServerManagerV1SSLConfigReader.php
│   └── ServerManagerV1OctaneServiceManager.php
│
├── ServerManagerV1Config/             # 配置类
│   └── ServerManagerV1PathConfig.php
│
└── ServerManagerV1Gvar/               # 全局变量/常量
    └── ServerManagerV1Constants.php
```

---

## 🔒 安全特性

### 1. **路径访问控制**
- 严格的文件路径白名单
- 自动路径清理和规范化
- 防止路径遍历攻击

### 2. **命令执行限制**
- 仅允许预定义脚本执行
- 禁用需要 sudo 的脚本
- 命令执行超时保护
- 完整的执行日志

### 3. **文件操作限制**
- 文件大小限制（下载 100MB，预览 1MB）
- 文件类型白名单（预览仅限文本文件）
- 访问日志记录

### 4. **SSL 凭证管理**
- 使用 `GlobalSecretReader` 读取加密凭证
- DNS API Token 存储在加密目录
- 临时凭证文件自动清理

### 5. **操作审计**
- 所有配置变更记录历史
- IP 和用户代理记录
- 操作时间戳

---

## 📈 性能优化

### 1. **配置缓存**
```php
// ServerManagerV1SSLConfigReader.php
private static ?array $cachedConfig = null;

public static function getSSLConfig(): array
{
    if (self::$cachedConfig !== null) {
        return self::$cachedConfig;
    }

    // 加载配置...
    self::$cachedConfig = $config;

    return self::$cachedConfig;
}
```

### 2. **批量操作**
- 批量域名操作（启用/禁用/删除）
- 批量证书续期
- 一次 Nginx reload 处理所有变更

### 3. **JSON 存储**
- 无数据库查询开销
- 配置文件直接读写
- 环境变量缓存

---

## 🆚 与其他工具对比

### vs cPanel/Plesk
| 特性 | ServerManagerV1 | cPanel/Plesk |
|------|----------------|--------------|
| **开源** | ✅ 完全开源 | ❌ 商业软件 |
| **JSON配置** | ✅ 轻量级 | ❌ 依赖数据库 |
| **双向同步** | ✅ DB↔Nginx | ❌ 单向 |
| **环境感知** | ✅ WSL自动适配 | ❌ 固定路径 |
| **API优先** | ✅ RESTful API | ⚠️ 部分支持 |
| **Swoole支持** | ✅ 原生支持 | ❌ 需插件 |
| **价格** | 🆓 免费 | 💰 $15-45/月 |

### vs Webmin
| 特性 | ServerManagerV1 | Webmin |
|------|----------------|--------|
| **现代API** | ✅ JSON API | ❌ 传统Web UI |
| **Laravel集成** | ✅ 原生集成 | ❌ 独立系统 |
| **Swoole管理** | ✅ 智能端口共享 | ❌ 不支持 |
| **配置同步** | ✅ 双向同步 | ❌ 手动管理 |
| **TypeScript类型** | ✅ 完整类型 | ❌ 无类型 |

### vs ISPConfig
| 特性 | ServerManagerV1 | ISPConfig |
|------|----------------|-----------|
| **轻量级** | ✅ 单应用模块 | ❌ 完整系统 |
| **JSON存储** | ✅ 无数据库 | ❌ MySQL必需 |
| **现代技术栈** | ✅ Laravel 12 | ⚠️ 传统PHP |
| **Nginx解析** | ✅ 自动解析导入 | ❌ 手动配置 |
| **历史追踪** | ✅ 完整历史 | ⚠️ 有限支持 |

---

## 💡 最佳实践建议

### 1. **域名部署流程**
```bash
# 步骤 1: 创建域名
php artisan servermanager:website create example.com \
    --type=laravel \
    --php-mode=swoole \
    --swoole-port=9001

# 步骤 2: 生成 SSL 证书
php artisan servermanager:certificate generate example.com \
    --provider=dnspod

# 步骤 3: 启用站点
php artisan servermanager:website enable example.com

# 步骤 4: 验证配置
php artisan servermanager:website info example.com
php artisan servermanager:nginx-inspect --domain=example.com
```

### 2. **迁移现有服务器**
```bash
# 步骤 1: 检查现有 Nginx 配置
php artisan servermanager:nginx-inspect

# 步骤 2: 导入到数据库
php artisan servermanager:sync --from-nginx

# 步骤 3: 验证导入结果
php artisan servermanager:website list

# 步骤 4: 备份配置
php artisan servermanager:sync --backup
```

### 3. **SSL 证书管理**
```bash
# 定期续期（建议设置 cron）
php artisan servermanager:certificate renew --all

# 检查即将到期的证书
php artisan servermanager:certificate list | grep "warning\|critical"

# 为新域名自动生成证书
php artisan servermanager:ssl generate example.com --provider=dnspod
```

### 4. **多域名共享应用**
```bash
# 主域名（会创建 Swoole 服务）
php artisan servermanager:website create example.com \
    --type=laravel \
    --www-dir=/www/laravel_main \
    --php-mode=swoole \
    --swoole-port=9001

# 额外域名（自动共享 Swoole 端口）
php artisan servermanager:website create www.example.com \
    --type=laravel \
    --www-dir=/www/laravel_main \
    --php-mode=swoole
    # 系统会自动检测到 /www/laravel_main 已有 Swoole 服务
    # 并共享端口 9001
```

---

## 🚀 Dashboard 集成建议

### 推荐集成到 `laravel_dashboard` 的功能

#### 1. **Server Status Dashboard** (优先级: P0)
- 系统信息卡片（CPU/内存/磁盘）
- 服务状态监控（Nginx/PHP/MySQL/Redis）
- 实时进程列表
- 存储使用情况图表

#### 2. **Domain Management Panel** (优先级: P0)
- 域名列表（带状态指示）
- 快速启用/禁用域名
- 域名配置编辑器
- Nginx 配置预览

#### 3. **SSL Certificate Manager** (优先级: P1)
- 证书列表（带到期日期和状态）
- 一键生成证书
- 批量续期
- 到期预警

#### 4. **File Browser with Preview** (优先级: P1)
- 文件树浏览器
- 文本文件预览
- 日志文件查看器
- 文件下载

#### 5. **Application Deployment** (优先级: P1)
- 应用列表（带状态）
- 一键部署/重启
- 实时日志查看
- 服务状态监控

#### 6. **Configuration Sync Tool** (优先级: P2)
- DB ↔ Nginx 同步按钮
- 配置备份/恢复
- 配置历史查看
- 冲突检测报告

---

## 📝 总结

### ServerManagerV1 的核心优势

1. ✅ **完全开源免费** - 替代 cPanel/Plesk 等商业软件
2. ✅ **JSON 配置存储** - 零数据库依赖，轻量级部署
3. ✅ **环境感知架构** - WSL/生产环境自动适配
4. ✅ **双向配置同步** - DB↔Nginx，迁移现有服务器零成本
5. ✅ **智能 Swoole 管理** - 多域名自动共享端口
6. ✅ **企业级安全** - 严格的路径白名单和命令限制
7. ✅ **完整的 API** - 可集成到任何前端（Dashboard/移动端）
8. ✅ **强大的 CLI** - 50+ 命令覆盖所有操作
9. ✅ **自动化 SSL** - Let's Encrypt 证书全自动管理
10. ✅ **操作审计** - 完整的历史记录和回滚支持

### 特别适用场景

- 🏢 **中小型开发团队** - 无需昂贵的服务器管理软件
- 🔧 **DevOps 自动化** - 通过 API/CLI 集成 CI/CD
- 🌐 **多站点托管** - 轻松管理数十个域名和应用
- 🐧 **WSL 开发环境** - 自动适配 Windows/Linux 路径
- 🚀 **Laravel Octane 部署** - 原生 Swoole 服务管理
- 📦 **服务器迁移** - 一键导入现有 Nginx 配置

---

**建议下一步**:
将 ServerManagerV1 的核心功能集成到 `laravel_dashboard`，创建一个可视化的服务器管理界面，完全替代传统的 cPanel/Plesk 面板。

**预计工作量**:
- 基础集成: 5-7 天（系统信息 + 域名管理）
- 完整功能: 10-15 天（包含 SSL、文件管理、应用部署）

**技术栈**:
- 后端: ServerManagerV1 提供的 30+ API 端点（已完成）
- 前端: React + TypeScript + Tailwind CSS（laravel_dashboard）
- 实时更新: 使用轮询或 WebSocket
- 图表: Chart.js 或 Recharts
