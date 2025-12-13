# ServerManagerV1 API Extension Documentation

## 概述

本文档补充了 `API_ENDPOINTS_DETAILED.md` 中缺失的 ServerManagerV1 API 端点，提供完整的请求/响应格式和使用示例。

---

## 缺失的 API 端点

### 1. Nginx Site Management (扩展)

#### 1.1 创建 Nginx 站点

**端点**: `POST /api/servermanager/v1/nginx/sites`

**描述**: 创建新的 Nginx 站点配置

**请求格式**:
```typescript
interface CreateSiteRequest {
  domain: string;                    // 域名
  type: 'laravel' | 'html' | 'proxy'; // 站点类型
  www_dir?: string;                   // Web 根目录（可选）
  php_version?: string;               // PHP 版本（默认 8.2）
  php_mode?: 'fpm' | 'swoole';        // PHP 模式
  swoole_port?: number;               // Swoole 端口（php_mode=swoole 时）
  ssl_enabled?: boolean;              // 启用 SSL
  ssl_provider?: string;              // SSL 提供商（dnspod/cloudflare）
  nginx_enabled?: boolean;            // 是否立即启用
}
```

**请求示例**:
```json
POST /api/servermanager/v1/nginx/sites
{
  "domain": "example.com",
  "type": "laravel",
  "php_mode": "swoole",
  "swoole_port": 9001,
  "ssl_enabled": true,
  "ssl_provider": "dnspod",
  "nginx_enabled": true
}
```

**响应格式**:
```typescript
ApiResponse<{
  domain: string;
  type: string;
  www_dir: string;
  php_mode: string;
  swoole_port?: number;
  ssl_enabled: boolean;
  nginx_enabled: boolean;
  nginx_config_file: string;
  created_at: string;
}>
```

**响应示例**:
```json
{
  "success": true,
  "message": "Site created successfully",
  "data": {
    "domain": "example.com",
    "type": "laravel",
    "www_dir": "/www/programing/example.com",
    "php_mode": "swoole",
    "swoole_port": 9001,
    "ssl_enabled": true,
    "nginx_enabled": true,
    "nginx_config_file": "/etc/nginx/sites-available/example.com",
    "created_at": "2025-12-13 10:30:45"
  }
}
```

---

#### 1.2 更新 Nginx 站点配置

**端点**: `PUT /api/servermanager/v1/nginx/sites/{site_name}`

**描述**: 更新已存在的 Nginx 站点配置

**路径参数**:
- `site_name`: 站点域名（例如：example.com）

**请求格式**:
```typescript
interface UpdateSiteRequest {
  php_mode?: 'fpm' | 'swoole';
  swoole_port?: number;
  ssl_enabled?: boolean;
  nginx_enabled?: boolean;
}
```

**请求示例**:
```json
PUT /api/servermanager/v1/nginx/sites/example.com
{
  "php_mode": "swoole",
  "swoole_port": 9002,
  "ssl_enabled": true
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Site updated successfully",
  "data": {
    "domain": "example.com",
    "php_mode": "swoole",
    "swoole_port": 9002,
    "updated_at": "2025-12-13 11:00:00"
  }
}
```

---

#### 1.3 删除 Nginx 站点

**端点**: `DELETE /api/servermanager/v1/nginx/sites/{site_name}`

**描述**: 删除 Nginx 站点配置（包括配置文件和符号链接）

**路径参数**:
- `site_name`: 站点域名

**查询参数**:
```typescript
interface DeleteSiteParams {
  remove_files?: boolean;  // 是否同时删除网站文件（默认 false）
  remove_ssl?: boolean;    // 是否同时删除 SSL 证书（默认 false）
}
```

**请求示例**:
```
DELETE /api/servermanager/v1/nginx/sites/example.com?remove_files=false&remove_ssl=false
```

**响应示例**:
```json
{
  "success": true,
  "message": "Site deleted successfully",
  "data": {
    "domain": "example.com",
    "config_file_removed": true,
    "symlink_removed": true,
    "files_removed": false,
    "ssl_removed": false
  }
}
```

---

#### 1.4 测试 Nginx 配置

**端点**: `POST /api/servermanager/v1/nginx/test`

**描述**: 测试 Nginx 配置语法是否正确

**请求参数**: 无

**响应格式**:
```typescript
ApiResponse<{
  valid: boolean;
  output: string;
  errors: string[];
  warnings: string[];
}>
```

**响应示例（成功）**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "output": "nginx: configuration file /etc/nginx/nginx.conf test is successful",
    "errors": [],
    "warnings": []
  }
}
```

**响应示例（失败）**:
```json
{
  "success": false,
  "data": {
    "valid": false,
    "output": "nginx: [emerg] unexpected \"}\" in /etc/nginx/sites-enabled/example.com:45",
    "errors": [
      "unexpected \"}\" in /etc/nginx/sites-enabled/example.com:45"
    ],
    "warnings": []
  }
}
```

---

#### 1.5 重载 Nginx

**端点**: `POST /api/servermanager/v1/nginx/reload`

**描述**: 重载 Nginx 配置（无需重启服务）

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "message": "Nginx reloaded successfully",
  "data": {
    "reloaded": true,
    "timestamp": "2025-12-13 11:05:30"
  }
}
```

---

### 2. SSL Certificate Management (完整)

#### 2.1 列出所有证书

**端点**: `GET /api/servermanager/v1/certificates/`

**描述**: 获取服务器上所有 SSL 证书列表

**响应格式**:
```typescript
ApiResponse<{
  certificates: Array<{
    name: string;
    domains: string[];
    expiry_date: string;
    certificate_path: string;
    private_key_path: string;
  }>;
  total_certificates: number;
  raw_output: string;
}>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "certificates": [
      {
        "name": "example.com",
        "domains": ["example.com", "www.example.com"],
        "expiry_date": "2026-03-15 10:30:45",
        "certificate_path": "/etc/letsencrypt/live/example.com/fullchain.pem",
        "private_key_path": "/etc/letsencrypt/live/example.com/privkey.pem"
      }
    ],
    "total_certificates": 1,
    "raw_output": "Found the following certs:\n  Certificate Name: example.com\n    Domains: example.com www.example.com\n    Expiry Date: 2026-03-15 10:30:45"
  }
}
```

---

#### 2.2 生成 SSL 证书

**端点**: `POST /api/servermanager/v1/certificates/generate`

**描述**: 为域名生成新的 Let's Encrypt SSL 证书（使用 DNS 验证）

**请求格式**:
```typescript
interface GenerateCertificateRequest {
  domain: string;                          // 域名
  provider?: 'dnspod' | 'cloudflare';      // DNS 提供商（默认 dnspod）
  staging?: boolean;                       // 是否使用测试环境（默认 false）
}
```

**请求示例**:
```json
POST /api/servermanager/v1/certificates/generate
{
  "domain": "example.com",
  "provider": "dnspod",
  "staging": false
}
```

**响应示例（成功）**:
```json
{
  "success": true,
  "message": "SSL certificate generated successfully",
  "data": {
    "domain": "example.com",
    "provider": "dnspod",
    "staging": false,
    "certificate_path": "/etc/letsencrypt/live/example.com/",
    "output": "Successfully received certificate.\nCertificate is saved at: /etc/letsencrypt/live/example.com/fullchain.pem"
  }
}
```

**响应示例（失败）**:
```json
{
  "success": false,
  "message": "Failed to generate SSL certificate",
  "data": {
    "domain": "example.com",
    "error": "DNS challenge failed: Unable to find TXT record",
    "exit_code": 1
  }
}
```

---

#### 2.3 续期 SSL 证书

**端点**: `POST /api/servermanager/v1/certificates/renew`

**描述**: 续期 SSL 证书（单个域名或所有证书）

**请求格式**:
```typescript
interface RenewCertificatesRequest {
  domain?: string;   // 特定域名（可选）
  all?: boolean;     // 续期所有证书（默认 false）
}
```

**请求示例（单个域名）**:
```json
POST /api/servermanager/v1/certificates/renew
{
  "domain": "example.com"
}
```

**请求示例（所有证书）**:
```json
POST /api/servermanager/v1/certificates/renew
{
  "all": true
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Certificate renewal completed successfully",
  "data": {
    "domain": "example.com",
    "all": false,
    "nginx_reloaded": true,
    "output": "Cert not yet due for renewal"
  }
}
```

---

#### 2.4 获取证书状态

**端点**: `GET /api/servermanager/v1/certificates/status`

**描述**: 获取特定域名的证书状态和到期信息

**查询参数**:
```typescript
interface CertificateStatusParams {
  domain: string;  // 域名（必需）
}
```

**请求示例**:
```
GET /api/servermanager/v1/certificates/status?domain=example.com
```

**响应格式**:
```typescript
ApiResponse<{
  domain: string;
  expiry_date: string;
  days_until_expiry: number;
  status: 'ok' | 'warning' | 'critical';
  issuer: string;
  subject: string;
  certificate_path: string;
  private_key_path: string;
  chain_path: string;
}>
```

**响应示例**:
```json
{
  "success": true,
  "message": "Certificate status retrieved successfully",
  "data": {
    "domain": "example.com",
    "expiry_date": "Mar 15 10:30:45 2026 GMT",
    "days_until_expiry": 87,
    "status": "ok",
    "issuer": "CN=R3, O=Let's Encrypt, C=US",
    "subject": "CN=example.com",
    "certificate_path": "/etc/letsencrypt/live/example.com/cert.pem",
    "private_key_path": "/etc/letsencrypt/live/example.com/privkey.pem",
    "chain_path": "/etc/letsencrypt/live/example.com/chain.pem"
  }
}
```

**状态说明**:
- `ok`: 距离到期超过 30 天
- `warning`: 距离到期 7-30 天
- `critical`: 距离到期少于 7 天

---

#### 2.5 检测 Certbot 安装

**端点**: `GET /api/servermanager/v1/certificates/detect-certbot`

**描述**: 检测服务器上 Certbot 的安装状态和版本

**请求参数**: 无

**响应格式**:
```typescript
ApiResponse<{
  installed: boolean;
  path: string | null;
  version?: string;
  nginx_plugin?: boolean;
}>
```

**响应示例（已安装）**:
```json
{
  "success": true,
  "message": "Certbot is installed",
  "data": {
    "installed": true,
    "path": "/usr/bin/certbot",
    "version": "certbot 1.32.0",
    "nginx_plugin": true
  }
}
```

**响应示例（未安装）**:
```json
{
  "success": true,
  "message": "Certbot is not installed",
  "data": {
    "installed": false,
    "path": null
  }
}
```

---

#### 2.6 安装 Certbot

**端点**: `POST /api/servermanager/v1/certificates/install-certbot`

**描述**: 自动安装 Certbot 和 Nginx 插件

**请求参数**: 无

**响应示例（成功）**:
```json
{
  "success": true,
  "message": "Certbot installation completed",
  "data": {
    "exit_code": 0,
    "output": "Installing certbot and python3-certbot-nginx...\nCertbot installed successfully.",
    "installed": true
  }
}
```

---

### 3. Unified Application Manager (扩展)

#### 3.1 列出所有应用

**端点**: `GET /api/servermanager/v1/unified/apps`

**描述**: 获取统一管理器中的所有应用列表

**响应格式**:
```typescript
ApiResponse<{
  apps: Array<{
    name: string;
    description: string;
    status: 'running' | 'stopped' | 'unknown';
    version?: string;
    port?: number;
  }>;
  total_apps: number;
  registry_available: boolean;
  deploy_script: string;
}>
```

**响应示例**:
```json
{
  "success": true,
  "message": "Applications retrieved successfully",
  "data": {
    "apps": [
      {
        "name": "laravel_main",
        "description": "Laravel Main API Application",
        "status": "running",
        "version": "1.0.0",
        "port": 8000
      },
      {
        "name": "nuxt_main",
        "description": "Nuxt Main Frontend Application",
        "status": "running",
        "version": "3.0.0",
        "port": 3000
      }
    ],
    "total_apps": 2,
    "registry_available": true,
    "deploy_script": "/www/programing/core_node/scripts/unified_manager/deploy_apps.sh"
  }
}
```

---

#### 3.2 部署/控制应用

**端点**: `POST /api/servermanager/v1/unified/deploy`

**描述**: 部署、启动、停止或重启应用

**请求格式**:
```typescript
interface DeployAppRequest {
  app_name: string;                                    // 应用名称
  action: 'deploy' | 'start' | 'stop' | 'restart';    // 操作类型
}
```

**请求示例**:
```json
POST /api/servermanager/v1/unified/deploy
{
  "app_name": "laravel_main",
  "action": "restart"
}
```

**响应格式**:
```typescript
ApiResponse<{
  deployment_id: string;
  app_name: string;
  action: string;
  success: boolean;
  output: string;
  error_output: string;
  exit_code: number;
  execution_time: number;
  memory_usage: string;
  timeout_reached: boolean;
  started_at: string;
  completed_at: string;
}>
```

**响应示例（成功）**:
```json
{
  "success": true,
  "message": "Application restart completed successfully",
  "data": {
    "deployment_id": "deploy_6758a12b3c4d5",
    "app_name": "laravel_main",
    "action": "restart",
    "success": true,
    "output": "Stopping laravel_main...\nStarting laravel_main...\nService started successfully.",
    "error_output": "",
    "exit_code": 0,
    "execution_time": 5.234,
    "memory_usage": "45MB",
    "timeout_reached": false,
    "started_at": "2025-12-13 11:00:00",
    "completed_at": "2025-12-13 11:00:05"
  }
}
```

---

#### 3.3 获取应用状态

**端点**: `GET /api/servermanager/v1/unified/status`

**描述**: 获取应用的详细运行状态

**查询参数**:
```typescript
interface AppStatusParams {
  app_name: string;  // 应用名称（必需）
}
```

**请求示例**:
```
GET /api/servermanager/v1/unified/status?app_name=laravel_main
```

**响应格式**:
```typescript
ApiResponse<{
  app_name: string;
  service_status: {
    service_name: string;
    active: boolean;
    enabled: boolean;
    status: 'running' | 'stopped' | 'failed' | 'unknown';
    since: string | null;
  };
  process_info: {
    running: boolean;
    pids: string[];
    count: number;
  };
  port_info: {
    expected_port: number | null;
    listening: boolean;
    port: number | null;
  };
  directory_info: {
    exists: boolean;
    path: string;
    size: number;
  };
  overall_status: 'running' | 'stopped' | 'failed' | 'partial';
}>
```

**响应示例**:
```json
{
  "success": true,
  "message": "Application status retrieved successfully",
  "data": {
    "app_name": "laravel_main",
    "service_status": {
      "service_name": "ncore-laravel_main",
      "active": true,
      "enabled": true,
      "status": "running",
      "since": "Mon 2025-12-13 08:00:00 UTC"
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
    "directory_info": {
      "exists": true,
      "path": "/www/programing/core_node/apps/laravel_main",
      "size": 524288000
    },
    "overall_status": "running"
  }
}
```

---

#### 3.4 获取应用日志

**端点**: `GET /api/servermanager/v1/unified/logs`

**描述**: 获取应用的运行日志（systemd + 应用日志）

**查询参数**:
```typescript
interface AppLogsParams {
  app_name: string;  // 应用名称（必需）
  lines?: number;    // 日志行数（默认 100，最大 1000）
}
```

**请求示例**:
```
GET /api/servermanager/v1/unified/logs?app_name=laravel_main&lines=50
```

**响应格式**:
```typescript
ApiResponse<{
  app_name: string;
  logs: Array<{
    source: string;       // 日志来源（systemd/app.log/error.log）
    line: string;         // 日志内容
    timestamp: number | null;  // Unix 时间戳
  }>;
  total_lines: number;
  requested_lines: number;
  log_sources: string[];
}>
```

**响应示例**:
```json
{
  "success": true,
  "message": "Application logs retrieved successfully",
  "data": {
    "app_name": "laravel_main",
    "logs": [
      {
        "source": "systemd",
        "line": "Dec 13 11:10:45 server ncore-laravel_main[12345]: Server started on port 8000",
        "timestamp": 1702461045
      },
      {
        "source": "app.log",
        "line": "[2025-12-13 11:10:50] local.INFO: Request received GET /api/info",
        "timestamp": 1702461050
      }
    ],
    "total_lines": 2,
    "requested_lines": 50,
    "log_sources": ["systemd", "app.log"]
  }
}
```

---

### 4. Code Executor (脚本执行器)

#### 4.1 列出预定义脚本

**端点**: `GET /api/servermanager/v1/executor/scripts`

**描述**: 获取所有可执行的预定义脚本列表

**查询参数**:
```typescript
interface ListScriptsParams {
  category?: 'diagnostic' | 'system_maintenance' | 'unified_manager';  // 可选过滤
}
```

**请求示例**:
```
GET /api/servermanager/v1/executor/scripts?category=diagnostic
```

**响应格式**:
```typescript
ApiResponse<{
  scripts: Array<{
    id: number;
    name: string;
    category: string;
    description: string;
    command: string;
    timeout: number;
    requires_sudo: boolean;
  }>;
  total_scripts: number;
  categories: string[];
  security_note: string;
}>
```

**响应示例**:
```json
{
  "success": true,
  "message": "Available scripts retrieved successfully",
  "data": {
    "scripts": [
      {
        "id": 1,
        "name": "System Information",
        "category": "diagnostic",
        "description": "Get comprehensive system information",
        "command": "uname -a && uptime && free -h && df -h",
        "timeout": 30,
        "requires_sudo": false
      },
      {
        "id": 2,
        "name": "Process List",
        "category": "diagnostic",
        "description": "List running processes",
        "command": "ps aux --sort=-%cpu | head -20",
        "timeout": 15,
        "requires_sudo": false
      }
    ],
    "total_scripts": 2,
    "categories": ["diagnostic", "system_maintenance", "unified_manager"],
    "security_note": "Only predefined hardcoded scripts can be executed"
  }
}
```

---

#### 4.2 执行预定义脚本

**端点**: `POST /api/servermanager/v1/executor/run`

**描述**: 执行指定 ID 的预定义脚本

**请求格式**:
```typescript
interface ExecuteScriptRequest {
  script_id: number;  // 脚本 ID（必需）
}
```

**请求示例**:
```json
POST /api/servermanager/v1/executor/run
{
  "script_id": 1
}
```

**响应格式**:
```typescript
ApiResponse<{
  execution_id: string;
  script_id: number;
  script_name: string;
  script_category: string;
  command: string;
  success: boolean;
  output: string;
  error_output: string;
  exit_code: number;
  execution_time: number;
  memory_usage: string;
  timeout_reached: boolean;
  started_at: string;
  completed_at: string;
}>
```

**响应示例（成功）**:
```json
{
  "success": true,
  "message": "Script executed successfully",
  "data": {
    "execution_id": "exec_6758a12b3c4d5",
    "script_id": 1,
    "script_name": "System Information",
    "script_category": "diagnostic",
    "command": "uname -a && uptime && free -h && df -h",
    "success": true,
    "output": "Linux server 5.15.0-91-generic #101-Ubuntu x86_64 GNU/Linux\n11:15:30 up 5 days, 3:45, 2 users, load average: 0.15, 0.20, 0.18",
    "error_output": "",
    "exit_code": 0,
    "execution_time": 0.245,
    "memory_usage": "2.5MB",
    "timeout_reached": false,
    "started_at": "2025-12-13 11:15:30",
    "completed_at": "2025-12-13 11:15:30"
  }
}
```

---

#### 4.3 获取执行状态

**端点**: `GET /api/servermanager/v1/executor/status`

**描述**: 查询特定执行 ID 的状态

**查询参数**:
```typescript
interface ExecutionStatusParams {
  execution_id: string;  // 执行 ID（必需）
}
```

**请求示例**:
```
GET /api/servermanager/v1/executor/status?execution_id=exec_6758a12b3c4d5
```

**响应示例**:
```json
{
  "success": true,
  "message": "Execution status retrieved",
  "data": {
    "execution_id": "exec_6758a12b3c4d5",
    "status": "completed",
    "found": true
  }
}
```

---

#### 4.4 获取执行日志

**端点**: `GET /api/servermanager/v1/executor/logs`

**描述**: 获取脚本执行历史日志

**查询参数**:
```typescript
interface ExecutorLogsParams {
  limit?: number;   // 日志数量（默认 50，最大 1000）
}
```

**请求示例**:
```
GET /api/servermanager/v1/executor/logs?limit=100
```

**响应格式**:
```typescript
ApiResponse<{
  logs: Array<{
    timestamp: string;
    message: string;
    type: 'started' | 'completed';
  }>;
  total_logs: number;
  log_source: string;
  note: string;
}>
```

**响应示例**:
```json
{
  "success": true,
  "message": "Execution logs retrieved successfully",
  "data": {
    "logs": [
      {
        "timestamp": "2025-12-13 11:15:30",
        "message": "[2025-12-13 11:15:30] local.INFO: ServerManagerV1: Script execution started",
        "type": "started"
      },
      {
        "timestamp": "2025-12-13 11:15:30",
        "message": "[2025-12-13 11:15:30] local.INFO: ServerManagerV1: Script execution completed",
        "type": "completed"
      }
    ],
    "total_logs": 2,
    "log_source": "Laravel application logs",
    "note": "Database logging not available due to SQLite driver issues"
  }
}
```

---

### 5. API Information Endpoint

#### 5.1 获取 ServerManager API 信息

**端点**: `GET /api/servermanager/v1/info`

**描述**: 获取 ServerManagerV1 的完整 API 文档和信息

**请求参数**: 无

**响应格式**:
```typescript
ApiResponse<{
  app_name: string;
  api_version: string;
  app_description: string;
  base_url: string;
  api_prefix: string;
  endpoints: Array<{
    path: string;
    feature: string;  // 标准特性格式
  }>;
  cli_commands: Array<{
    command: string;
    description: string;
    signature: string;
    arguments: object;
    options: object;
    usage_examples: string[];
    tags: string[];
  }>;
  supported_headers: object;
  authentication: object;
}>
```

**响应示例**（部分）:
```json
{
  "success": true,
  "data": {
    "app_name": "ServerManagerV1",
    "api_version": "v1",
    "app_description": "Comprehensive server management and administration system",
    "base_url": "http://localhost:8000/api",
    "api_prefix": "http://localhost:8000/api/servermanager/v1",
    "endpoints": [
      {
        "path": "http://localhost:8000/api/servermanager/v1/system/info",
        "feature": "auth_required/GET|Get complete system information including hardware and OS details|ServerManagerV1SystemInfoCtl|response:system(object,System details),hardware(object,Hardware info),services(array,Service status)|tags:server,system"
      }
    ],
    "cli_commands": [ /* ... */ ],
    "supported_headers": {
      "X-Server-Manager-Key": {
        "description": "API key for server management authentication",
        "type": "string",
        "required_for": "All authenticated endpoints (bypassed in debug/local mode)"
      }
    },
    "authentication": {
      "type": "api_key",
      "description": "Uses API key authentication via X-Server-Manager-Key header",
      "header_name": "X-Server-Manager-Key"
    }
  }
}
```

---

## TypeScript 类型定义扩展

### Nginx Site Types

```typescript
export interface NginxSite {
  domain: string;
  type: 'laravel' | 'html' | 'proxy';
  www_dir: string;
  php_version: string;
  php_mode: 'fpm' | 'swoole';
  swoole_port?: number;
  swoole_service_name?: string;
  swoole_host?: string;
  swoole_workers?: number;
  ssl_enabled: boolean;
  ssl_provider?: string;
  ssl_certificate_id?: string;
  nginx_enabled: boolean;
  nginx_config_file: string;
  index_file_created: boolean;
  laravel_info?: LaravelInfo;
  created_at: string;
  updated_at: string;
  status: 'active' | 'disabled' | 'error';
  last_deployment?: string;
  deployment_count: number;
}

export interface CreateSiteRequest {
  domain: string;
  type: 'laravel' | 'html' | 'proxy';
  www_dir?: string;
  php_version?: string;
  php_mode?: 'fpm' | 'swoole';
  swoole_port?: number;
  ssl_enabled?: boolean;
  ssl_provider?: string;
  nginx_enabled?: boolean;
}

export interface UpdateSiteRequest {
  php_mode?: 'fpm' | 'swoole';
  swoole_port?: number;
  ssl_enabled?: boolean;
  nginx_enabled?: boolean;
}

export interface DeleteSiteParams {
  remove_files?: boolean;
  remove_ssl?: boolean;
}

export interface NginxTestResult {
  valid: boolean;
  output: string;
  errors: string[];
  warnings: string[];
}
```

---

### SSL Certificate Types

```typescript
export interface SSLCertificate {
  name: string;
  domains: string[];
  expiry_date: string;
  certificate_path: string;
  private_key_path: string;
}

export interface CertificateStatus {
  domain: string;
  expiry_date: string;
  days_until_expiry: number;
  status: 'ok' | 'warning' | 'critical';
  issuer: string;
  subject: string;
  certificate_path: string;
  private_key_path: string;
  chain_path: string;
}

export interface GenerateCertificateRequest {
  domain: string;
  provider?: 'dnspod' | 'cloudflare';
  staging?: boolean;
}

export interface RenewCertificatesRequest {
  domain?: string;
  all?: boolean;
}

export interface CertbotInfo {
  installed: boolean;
  path: string | null;
  version?: string;
  nginx_plugin?: boolean;
}
```

---

### Unified Manager Types

```typescript
export interface UnifiedApp {
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'unknown';
  version?: string;
  port?: number;
}

export interface DeployAppRequest {
  app_name: string;
  action: 'deploy' | 'start' | 'stop' | 'restart';
}

export interface DeploymentResult {
  deployment_id: string;
  app_name: string;
  action: string;
  success: boolean;
  output: string;
  error_output: string;
  exit_code: number;
  execution_time: number;
  memory_usage: string;
  timeout_reached: boolean;
  started_at: string;
  completed_at: string;
}

export interface AppStatus {
  app_name: string;
  service_status: {
    service_name: string;
    active: boolean;
    enabled: boolean;
    status: 'running' | 'stopped' | 'failed' | 'unknown';
    since: string | null;
  };
  process_info: {
    running: boolean;
    pids: string[];
    count: number;
  };
  port_info: {
    expected_port: number | null;
    listening: boolean;
    port: number | null;
  };
  directory_info: {
    exists: boolean;
    path: string;
    size: number;
  };
  overall_status: 'running' | 'stopped' | 'failed' | 'partial';
}

export interface AppLog {
  source: string;
  line: string;
  timestamp: number | null;
}
```

---

### Code Executor Types

```typescript
export interface PredefinedScript {
  id: number;
  name: string;
  category: 'diagnostic' | 'system_maintenance' | 'unified_manager';
  description: string;
  command: string;
  timeout: number;
  requires_sudo: boolean;
}

export interface ExecuteScriptRequest {
  script_id: number;
}

export interface ExecutionResult {
  execution_id: string;
  script_id: number;
  script_name: string;
  script_category: string;
  command: string;
  success: boolean;
  output: string;
  error_output: string;
  exit_code: number;
  execution_time: number;
  memory_usage: string;
  timeout_reached: boolean;
  started_at: string;
  completed_at: string;
}

export interface ExecutionStatus {
  execution_id: string;
  status: 'running' | 'completed' | 'unknown';
  found: boolean;
}

export interface ExecutionLog {
  timestamp: string;
  message: string;
  type: 'started' | 'completed';
}
```

---

## 与现有文档的集成

将以下内容添加到 `types.ts`:

```typescript
// ServerManagerV1 Types
export * from './types/servermanager';
```

创建新文件 `types/servermanager.ts`:

```typescript
// Nginx Management
export interface NginxSite { /* ... */ }
export interface CreateSiteRequest { /* ... */ }
// ... 所有上述类型定义

// SSL Certificates
export interface SSLCertificate { /* ... */ }
export interface CertificateStatus { /* ... */ }
// ...

// Unified Manager
export interface UnifiedApp { /* ... */ }
export interface DeployAppRequest { /* ... */ }
// ...

// Code Executor
export interface PredefinedScript { /* ... */ }
export interface ExecutionResult { /* ... */ }
// ...
```

---

## 与现有端点的对比

### 原 API_ENDPOINTS_DETAILED.md 中已有的端点:
✅ System Information API (已覆盖)
✅ File Management APIs (已覆盖)

### 新增的缺失端点:
1. ✨ Nginx Site Management (CREATE/UPDATE/DELETE)
2. ✨ Nginx Test/Reload
3. ✨ SSL Certificate Generation/Renewal
4. ✨ SSL Certificate Status/List
5. ✨ Certbot Installation/Detection
6. ✨ Unified Application Deployment
7. ✨ Application Status/Logs
8. ✨ Code Executor (预定义脚本执行)
9. ✨ ServerManager API Info

---

## 使用示例

### 完整的域名部署流程（通过 API）

```typescript
// 1. 创建 Nginx 站点
const createResponse = await fetch('/api/servermanager/v1/nginx/sites', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'example.com',
    type: 'laravel',
    php_mode: 'swoole',
    swoole_port: 9001,
    ssl_enabled: true,
    ssl_provider: 'dnspod',
    nginx_enabled: false  // 先不启用，等 SSL 完成
  })
});

// 2. 生成 SSL 证书
const sslResponse = await fetch('/api/servermanager/v1/certificates/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'example.com',
    provider: 'dnspod',
    staging: false
  })
});

// 3. 更新站点配置启用 SSL
const updateResponse = await fetch('/api/servermanager/v1/nginx/sites/example.com', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nginx_enabled: true
  })
});

// 4. 启用站点
const enableResponse = await fetch('/api/servermanager/v1/nginx/enable', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    site_name: 'example.com'
  })
});

// 5. 测试配置
const testResponse = await fetch('/api/servermanager/v1/nginx/test', {
  method: 'POST'
});

// 6. 重载 Nginx
const reloadResponse = await fetch('/api/servermanager/v1/nginx/reload', {
  method: 'POST'
});

// 7. 验证站点状态
const sitesResponse = await fetch('/api/servermanager/v1/nginx/sites');
```

---

## 总结

本扩展文档补充了以下核心功能的 API 端点：

1. **Nginx 站点管理**: 完整的 CRUD 操作（创建、更新、删除、启用、禁用）
2. **SSL 证书管理**: 自动生成、续期、状态检查、Certbot 管理
3. **统一应用管理**: 应用部署、状态监控、日志查看
4. **安全脚本执行**: 预定义脚本列表、执行、状态跟踪
5. **API 信息**: 完整的 API 文档和 CLI 命令说明

这些端点为 `laravel_dashboard` 提供了完整的服务器管理能力，可以完全替代传统的 cPanel/Plesk 面板功能。
