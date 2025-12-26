# Octane 后端服务分析报告

## 🔍 服务运行模式

### **运行用户**: ROOT 模式 ⚠️

```
User=root
Group=root
```

**实际运行进程验证**:
```bash
$ ps aux | grep octane
root  4145307  0.6  0.4  /usr/local/bin/php .../artisan octane:start
```

**文件系统所有者**:
```bash
$ stat /www/programing/core_node/poly_apps/laravel_main
Owner: ubuntu:ubuntu
```

---

## 📋 服务文件详情

### **主服务文件**: `/etc/systemd/system/octane-poly-9000.service`

```ini
[Unit]
Description=Laravel Octane Server for path 779f6ad7 on port 9000
After=network.target mysql.service redis.service
Wants=network-online.target

[Service]
Type=simple
User=root                    # ⚠️ ROOT 模式
Group=root                   # ⚠️ ROOT 模式
WorkingDirectory=/www/programing/core_node/poly_apps/laravel_main
ExecStart=/usr/local/bin/php artisan octane:start --host=0.0.0.0 --port=9000 --workers=8 --watch
ExecReload=/bin/kill -USR1 $MAINPID

# Auto-restart configuration
Restart=always
RestartSec=10

# Timeout configuration
TimeoutStopSec=30
TimeoutStartSec=60

# Kill mode configuration
KillMode=mixed
KillSignal=SIGTERM

# Memory limit: 3GB
MemoryMax=3230766K
MemoryHigh=3230766K

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=octane-poly-9000

# Environment
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="NODE_PATH=/usr/local/lib/node_modules"

# Security
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/www/programing/core_node/poly_apps/laravel_main/storage
ReadWritePaths=/www/programing/core_node/poly_apps/laravel_main/bootstrap/cache
ReadWritePaths=/www/wwwroot/laravel_db
ReadWritePaths=/www/programing/core_node/_prompts

[Install]
WantedBy=multi-user.target
```

### **Timer 文件**: `/etc/systemd/system/octane-poly-9000.timer`

```ini
[Unit]
Description=Auto-restart octane-poly-9000 every 48 hours
Requires=octane-poly-9000.service

[Timer]
OnBootSec=48h           # 启动后48小时重启
OnUnitActiveSec=48h     # 每运行48小时重启
Persistent=true

[Install]
WantedBy=timers.target
```

---

## ⚙️ 服务配置分析

### **1. 运行模式**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| User | root | ⚠️ ROOT权限运行 |
| Group | root | ⚠️ ROOT权限运行 |
| File Owner | ubuntu:ubuntu | 文件系统所有者 |
| Type | simple | 简单服务类型 |
| Workers | 8 | Swoole worker数量 |
| Host | 0.0.0.0 | 监听所有网络接口 |
| Port | 9000 | HTTP端口 |

### **2. 启动参数**

```bash
php artisan octane:start \
  --host=0.0.0.0 \
  --port=9000 \
  --workers=8 \
  --watch
```

**参数说明**:
- `--host=0.0.0.0` - 允许外部访问
- `--port=9000` - 服务端口
- `--workers=8` - 8个worker进程
- `--watch` - 🔥 **热重载模式**（开发环境）

### **3. 依赖服务**

```
After=network.target mysql.service redis.service
```

- network.target - 网络就绪
- mysql.service - MySQL数据库
- redis.service - Redis缓存

### **4. 自动重启策略**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Restart | always | 总是自动重启 |
| RestartSec | 10s | 重启间隔10秒 |
| Timer | 48h | 每48小时定时重启 |

### **5. 资源限制**

| 资源 | 限制 | 说明 |
|------|------|------|
| MemoryMax | 3.2GB | 硬性内存上限 |
| MemoryHigh | 3.2GB | 软性内存上限 |
| TimeoutStop | 30s | 停止超时 |
| TimeoutStart | 60s | 启动超时 |

### **6. 安全配置**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| PrivateTmp | true | 私有临时目录 |
| NoNewPrivileges | true | 禁止提权 |
| ProtectSystem | strict | 严格保护系统目录 |
| ProtectHome | true | 保护用户主目录 |
| ReadWritePaths | 4个目录 | 仅允许写入特定目录 |

**可写目录**:
1. `/www/programing/core_node/poly_apps/laravel_main/storage`
2. `/www/programing/core_node/poly_apps/laravel_main/bootstrap/cache`
3. `/www/wwwroot/laravel_db`
4. `/www/programing/core_node/_prompts`

---

## 🚀 当前运行状态

```
● octane-poly-9000.service - Laravel Octane Server
     Loaded: loaded (/etc/systemd/system/octane-poly-9000.service; enabled)
     Active: active (running) since Sun 2025-12-21 17:47:00 +07
   Main PID: 4145307 (php)
      Tasks: 34
     Memory: 990.9M (high: 3.0G max: 3.0G)
```

**进程树**:
```
php (artisan octane:start)
├── swoole_http_server: master process
├── node file-watcher.cjs (热重载)
├── swoole_http_server: manager process
├── swoole_http_server: task worker × 4
└── swoole_http_server: worker × 8
```

---

## ⚠️ ROOT 模式的影响

### **优点**

1. ✅ **完全的文件系统访问权限**
   - 可以读写任何目录
   - 无需担心权限问题

2. ✅ **系统级操作能力**
   - 可以执行需要root权限的操作
   - 适合开发和调试环境

3. ✅ **简化配置**
   - 不需要复杂的权限设置
   - 减少权限相关的问题

### **缺点**

1. ⚠️ **安全风险**
   - 代码漏洞可能导致系统被完全控制
   - 不符合最小权限原则

2. ⚠️ **生产环境不推荐**
   - 违反安全最佳实践
   - 增加被攻击的风险

3. ⚠️ **文件权限问题**
   - 生成的文件默认属于root
   - 可能导致其他用户无法访问

---

## 🔧 如何切换到普通用户模式

### **方案1: 修改服务文件为 ubuntu 用户**

```bash
# 1. 停止服务
sudo systemctl stop octane-poly-9000

# 2. 编辑服务文件
sudo nano /etc/systemd/system/octane-poly-9000.service

# 3. 修改 User 和 Group
[Service]
User=ubuntu      # 改为 ubuntu（当前文件所有者）
Group=ubuntu     # 改为 ubuntu（当前文件所有者）

# 4. 重新加载配置
sudo systemctl daemon-reload

# 5. 修复文件权限（如果需要）
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main/storage
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main/bootstrap/cache
sudo chown -R ubuntu:ubuntu /www/wwwroot/laravel_db

# 6. 启动服务
sudo systemctl start octane-poly-9000
```

### **方案2: 使用专用用户（不推荐，当前使用 ubuntu）**

```bash
# 创建专用用户
sudo useradd -r -s /bin/bash -d /www/programing/core_node laravel

# 设置文件所有权
sudo chown -R laravel:laravel /www/programing/core_node/poly_apps/laravel_main
sudo chown -R laravel:laravel /www/wwwroot/laravel_db

# 修改服务文件
[Service]
User=laravel
Group=laravel
```

**注意**: 当前文件系统所有者是 `ubuntu:ubuntu`，建议使用方案1切换到 ubuntu 用户。

---

## 📊 其他相关服务

### **Laravel Dashboard 前端服务**

```bash
$ systemctl status webapp-laravel_dashboard.service
```

**服务文件**: `/etc/systemd/system/webapp-laravel_dashboard.service`

这个服务运行 React 前端（Laravel Dashboard），与 Octane 后端服务独立。

---

## 🎯 建议

### **开发环境（当前）**
✅ **保持 ROOT 模式**
- 方便开发和调试
- 减少权限问题
- 快速迭代

### **生产环境**
⚠️ **必须切换到普通用户**
- 使用 `ubuntu`（当前文件所有者）
- 遵循最小权限原则
- 增强安全性

### **安全加固建议**

1. **切换用户模式**
   ```
   User=ubuntu
   Group=ubuntu
   ```

2. **增强安全配置**
   ```
   PrivateNetwork=true
   ProtectKernelTunables=true
   ProtectKernelModules=true
   ProtectControlGroups=true
   RestrictRealtime=true
   ```

3. **限制系统调用**
   ```
   SystemCallFilter=@system-service
   SystemCallErrorNumber=EPERM
   ```

4. **禁用敏感目录**
   ```
   InaccessiblePaths=/boot /root
   ```

---

## 📝 总结

| 项目 | 当前状态 |
|------|----------|
| **运行模式** | ⚠️ ROOT |
| **文件所有者** | ubuntu:ubuntu |
| **服务状态** | ✅ Active (Running) |
| **内存使用** | 990.9MB / 3.0GB |
| **Worker数量** | 8个 |
| **热重载** | ✅ 已启用 |
| **自动重启** | ✅ 每48小时 |
| **日志记录** | ✅ Systemd Journal |
| **安全加固** | ⚠️ 部分（需要切换用户） |

**当前环境**: 开发/调试环境
**运行模式**: ROOT（适合开发，不适合生产）
**建议**: 生产环境切换到 `ubuntu` 用户

---

**分析时间**: 2025-12-21
**服务版本**: octane-poly-9000
**系统**: Linux (Systemd)
**真实后端路径**: /www/programing/core_node/poly_apps/laravel_main
**真实用户**: ubuntu (uid=1000)
