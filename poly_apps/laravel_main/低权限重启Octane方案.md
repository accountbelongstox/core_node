# Laravel Octane 低权限重启方案

## 问题现状

### 当前环境
- **Octane 运行用户**: root (systemd 服务)
- **开发用户**: ubuntu
- **问题**: 修改代码后无法重启 Octane 加载新代码

### 失败的方法
```bash
# ❌ 方法1: artisan reload - 权限不足
php artisan octane:reload
# Error: Operation not permitted

# ❌ 方法2: systemctl restart - 需要密码
sudo systemctl restart ncore-laravel_main
# Error: sudo requires password

# ❌ 方法3: kill 进程 - 权限不足
kill -TERM 2228379
# Error: Operation not permitted
```

---

## 解决方案

### 方案 1: 配置 sudo 免密（推荐）⭐

**配置步骤**:
```bash
# 1. 创建 sudoers 配置文件
sudo visudo -f /etc/sudoers.d/octane-reload

# 2. 添加以下内容（允许 ubuntu 用户无密码重启 Octane）
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl stop ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl start ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl status ncore-laravel_main

# 3. 保存并退出（按 Ctrl+X, Y, Enter）

# 4. 测试无密码重启
sudo systemctl restart ncore-laravel_main
```

**使用方法**:
```bash
# 重启 Octane
sudo systemctl restart ncore-laravel_main

# 或者使用脚本
cd /www/programing/core_node/scripts/shells/linux/debian/install_shells
./restart_octane.sh  # 不再需要输入密码
```

**优点**:
✅ 安全（只允许特定命令）
✅ 简单（一次配置，永久有效）
✅ 标准做法（Linux 最佳实践）

---

### 方案 2: 使用信号文件触发重启

**原理**: 创建一个文件监视服务，检测到信号文件时自动重启 Octane

**实现步骤**:

1. **创建信号文件监视脚本**:
```bash
# /var/_core_node/scripts/octane-watcher.sh
#!/bin/bash

SIGNAL_FILE="/tmp/octane-reload.signal"
CHECK_INTERVAL=1

while true; do
    if [ -f "$SIGNAL_FILE" ]; then
        echo "[$(date)] Reload signal detected, restarting Octane..."
        rm -f "$SIGNAL_FILE"
        systemctl restart ncore-laravel_main
        echo "[$(date)] Octane restarted"
    fi
    sleep $CHECK_INTERVAL
done
```

2. **创建 systemd 服务**:
```ini
# /etc/systemd/system/octane-watcher.service
[Unit]
Description=Octane Reload Watcher
After=network.target

[Service]
Type=simple
User=root
ExecStart=/var/_core_node/scripts/octane-watcher.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

3. **启用服务**:
```bash
sudo chmod +x /var/_core_node/scripts/octane-watcher.sh
sudo systemctl daemon-reload
sudo systemctl enable octane-watcher
sudo systemctl start octane-watcher
```

4. **使用方法**（无需 sudo）:
```bash
# 触发重启
touch /tmp/octane-reload.signal

# 等待1秒，Octane 会自动重启
```

**优点**:
✅ 完全无需 sudo
✅ 可以集成到 IDE/编辑器保存钩子
✅ 自动化友好

**缺点**:
⚠️ 需要额外的后台服务
⚠️ 1秒延迟

---

### 方案 3: HTTP API 触发重启

**原理**: 添加一个受保护的 API 端点，通过 HTTP 请求触发重启

**实现步骤**:

1. **创建重启控制器**:
```php
// app/Http/Controllers/Admin/OctaneController.php
namespace App\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class OctaneController extends Controller
{
    public function reload(Request $request): JsonResponse
    {
        // 验证 API key
        $apiKey = $request->header('X-Reload-Key');
        if ($apiKey !== env('OCTANE_RELOAD_KEY')) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // 创建信号文件让外部脚本处理
        file_put_contents('/tmp/octane-reload.signal', time());

        return response()->json([
            'success' => true,
            'message' => 'Reload signal sent'
        ]);
    }
}
```

2. **添加路由**:
```php
// routes/api.php
Route::post('/admin/octane/reload', [OctaneController::class, 'reload']);
```

3. **配置 API key**:
```bash
# .env
OCTANE_RELOAD_KEY=your-secret-key-here
```

4. **使用方法**:
```bash
# 通过 API 触发重启
curl -X POST http://localhost:9000/api/admin/octane/reload \
  -H "X-Reload-Key: your-secret-key-here"
```

**优点**:
✅ 可以远程触发
✅ 可以集成到 CI/CD
✅ 带认证保护

**缺点**:
⚠️ 需要配合方案2的监视服务
⚠️ 需要管理 API key

---

### 方案 4: 改变 Octane 运行用户

**原理**: 让 Octane 以 ubuntu 用户运行，这样就可以直接使用 `php artisan octane:reload`

**修改步骤**:

1. **修改 systemd 服务文件**:
```bash
sudo vim /etc/systemd/system/ncore-laravel_main.service

# 找到 User=root，改为：
User=ubuntu
Group=ubuntu
```

2. **确保目录权限正确**:
```bash
# 给 ubuntu 用户所有权限
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main/storage
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main/bootstrap/cache
```

3. **重启服务**:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ncore-laravel_main
```

4. **使用方法**（无需 sudo）:
```bash
cd /www/programing/core_node/poly_apps/laravel_main
php artisan octane:reload  # 现在可以直接使用！
```

**优点**:
✅ 最简单的使用方式
✅ 符合最小权限原则
✅ 开发体验最好

**缺点**:
⚠️ 如果需要访问系统资源可能权限不足
⚠️ 需要确保所有文件权限正确

---

## 推荐方案对比

| 方案 | 复杂度 | 安全性 | 使用便捷性 | 适用场景 |
|-----|--------|--------|-----------|----------|
| **方案1: sudo免密** | ⭐ 低 | ⭐⭐⭐ 高 | ⭐⭐⭐ 高 | **生产/开发** ✅ 推荐 |
| 方案2: 信号文件 | ⭐⭐ 中 | ⭐⭐ 中 | ⭐⭐⭐ 高 | 自动化部署 |
| 方案3: HTTP API | ⭐⭐⭐ 高 | ⭐⭐ 中 | ⭐⭐ 中 | 远程管理/CI/CD |
| 方案4: 改用户 | ⭐ 低 | ⭐⭐ 中 | ⭐⭐⭐⭐ 最高 | **纯开发环境** ✅ 推荐 |

---

## 快速实施指南

### 开发环境（推荐方案4）

```bash
# 1. 停止服务
sudo systemctl stop ncore-laravel_main

# 2. 修改服务用户
sudo sed -i 's/User=root/User=ubuntu/' /etc/systemd/system/ncore-laravel_main.service
sudo sed -i '/User=ubuntu/a Group=ubuntu' /etc/systemd/system/ncore-laravel_main.service

# 3. 修复权限
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main

# 4. 重启服务
sudo systemctl daemon-reload
sudo systemctl start ncore-laravel_main

# 5. 测试重启（无需 sudo）
cd /www/programing/core_node/poly_apps/laravel_main
php artisan octane:reload
```

### 生产环境（推荐方案1）

```bash
# 1. 配置 sudo 免密
echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart ncore-laravel_main" | \
  sudo tee /etc/sudoers.d/octane-reload

echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload ncore-laravel_main" | \
  sudo tee -a /etc/sudoers.d/octane-reload

sudo chmod 0440 /etc/sudoers.d/octane-reload

# 2. 测试无密码重启
sudo systemctl restart ncore-laravel_main
```

---

## 当前立即解决方案

**临时解决（使用方案1）**:

```bash
# 一键配置 sudo 免密
echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl stop ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl start ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl status ncore-laravel_main" | \
sudo tee /etc/sudoers.d/octane-reload

sudo chmod 0440 /etc/sudoers.d/octane-reload

# 现在可以无密码重启了
sudo systemctl restart ncore-laravel_main
```

**验证修复生效**:
```bash
# 等待5秒让 Octane 重启完成
sleep 5

# 测试 SSL Certificates API
curl http://192.168.50.3:9000/api/servermanager/v1/ssl/certificates

# 应该返回 200 JSON，不是 500 HTML
```

---

**文档创建时间**: 2025-12-18 19:35
**当前推荐**: 方案1（sudo免密）或 方案4（改用户）
**状态**: 待实施
