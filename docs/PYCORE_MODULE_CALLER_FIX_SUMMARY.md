# pycore_module_caller.py 启动问题修复总结

生成时间: 2025-12-18 20:00
问题: pycore_module_caller.py 启动卡住 + tray 启动失败

## 问题 1: 前端启动卡住 (端口冲突)

### 根本原因
1. **端口冲突**: matrixui 占用 port 3000,pycore-management 也配置使用 3000
2. **Vite 自动递增**: 端口被占用后,vite 自动递增到 3002/3003
3. **健康检查失败**: frontend_thread.py 等待 localhost:3000,但 vite 运行在 3002/3003
4. **无限等待**: 没有超时机制,永远卡住

### 修复方案

#### 修复 1: 修改前端端口配置
**文件**: `/www/programing/core_node/pycore/callmodule/callmodule_config/config.py`
```python
# Line 31 - BEFORE
FRONTEND_PORT = 3000

# Line 31 - AFTER
FRONTEND_PORT = 3100  # 避免和 matrixui 的 3000 冲突
```

#### 修复 2: 更新 vite.config.ts
**文件**: `/www/programing/core_node/poly_apps/pycore-management/vite.config.ts`
```typescript
// Lines 7-14 - BEFORE
const port = parseInt(process.env.PORT || process.env.VITE_PORT || '3000');
const host = process.env.HOST || process.env.VITE_HOST || '0.0.0.0';
return {
  server: {
    port,
    host,
    // no strictPort

// Lines 7-14 - AFTER
const port = parseInt(process.env.PORT || process.env.VITE_PORT || '3100');
const host = process.env.HOST || process.env.VITE_HOST || '0.0.0.0';
return {
  server: {
    port,
    host,
    strictPort: true,  // 端口被占用时失败,不自动递增
```

#### 修复 3: 添加 VITE_PORT 环境变量
**文件**: `/www/programing/core_node/pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`
```python
# Lines 480-481 - 新增
env["VITE_PORT"] = str(self.config.port)  # For Vite
env["VITE_HOST"] = self.config.host  # For Vite
```

## 问题 2: Frontend 进程变成 defunct/zombie

### 根本原因
```python
# Lines 421-422 - 错误配置 (已删除)
stdout = None if self.config.show_output else subprocess.DEVNULL
stderr = None if self.config.show_output else subprocess.DEVNULL
```

- `stdout=None` 继承父进程 file descriptor
- 如果父进程 stdout 不可用,npm/vite 写输出时收到 SIGPIPE 被杀死
- 进程变成 defunct/zombie

### 修复方案

#### 修复 4: 使用 PIPE + 后台线程
**文件**: `/www/programing/core_node/pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`
```python
# Lines 420-445 - 修复后
# Start dev server with PIPE to prevent SIGPIPE and process blocking
# We create a background thread to consume the output
self.process = subprocess.Popen(
    command,
    cwd=str(self.config.app_dir),
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)

# Start background thread to consume stdout (prevent blocking)
def consume_output():
    try:
        for line in self.process.stdout:
            if self.config.show_output:
                stripped = line.strip()
                if stripped:
                    ColorPrint.gray(f"  [vite] {stripped}")
    except:
        pass

import threading
output_thread = threading.Thread(target=consume_output, daemon=True)
output_thread.start()
```

**关键**: 后台线程持续读取 stdout,防止管道填满导致进程阻塞。

## 问题 3: Dev Frontend 被错误杀掉 (端口检查 Bug)

### 根本原因
```python
# Lines 599-602 in launch_native_app.py - BEFORE
ports_to_check = [config.rpc_port]
if config.frontend_enabled and hasattr(config, 'frontend_port'):
    ports_to_check.append(config.frontend_port)  # ← Bug: Dev mode 前端已启动!
```

**执行顺序**:
1. Line 539: 启动前端 `start_frontend_if_needed()` → Vite 在 port 3100 启动
2. Line 595-608: 检查端口可用性,发现 3100 被占用 → **杀掉刚启动的 Vite!**
3. 结果: 窗口一直转圈,无法加载

### 修复方案

#### 修复 4: 跳过 Dev 模式前端端口检查
**文件**: `/www/programing/core_node/pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`

```python
# Lines 599-602 - BEFORE
ports_to_check = [config.rpc_port]
if config.frontend_enabled and hasattr(config, 'frontend_port'):
    ports_to_check.append(config.frontend_port)

# Lines 599-602 - AFTER
ports_to_check = [config.rpc_port]
# Only check frontend port in production mode (dev mode frontend is already running)
if config.frontend_enabled and hasattr(config, 'frontend_port') and config.frontend_mode == 'production':
    ports_to_check.append(config.frontend_port)
```

**原理**:
- Production 模式: 前端构建为静态文件,不占用端口 → 检查端口
- Dev 模式: 前端 vite dev server 占用端口 3100 → **跳过检查**

## 问题 4: Tray 启动失败 (D-Bus 错误)

### 根本原因
```
gi.repository.GLib.GError: g-io-error-quark: The connection is closed (18)
Unable to get the session bus: The connection is closed
```

Linux 上 pystray 依赖 D-Bus session bus,但在当前环境中:
1. 以 root 运行,X11 和 D-Bus 属于用户 ubuntu
2. DBUS_SESSION_BUS_ADDRESS 环境变量不正确
3. D-Bus session 无法连接

### 修复方案

#### 修复 5: 禁用 Linux tray
**文件**: `/www/programing/core_node/pycore/callmodule/callmodule_main.py`
```python
# Lines 215-220 - BEFORE
enable_tray=adapter.can_use_tray(),  # Auto: True if has GUI, False otherwise
tray_type="tk" if (adapter.can_use_tray() and adapter.get_recommended_tray_backend().value == "pystray") else "pyside6",

# Lines 219-220 - AFTER
# Note: Disable tray on Linux due to D-Bus session bus connection issues with pystray
enable_tray=IS_WINDOWS,  # Only enable on Windows for now
tray_type="pyside6",  # Use PySide6 backend (Windows only)
```

## 其他修复

### 修复 6: Vite 输出可见性增强
**文件**: `/www/programing/core_node/pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`

**问题**: Vite 启动输出不够明显,用户无法确认前端是否正常启动

**修复内容**:

#### 6.1 添加启动横幅 (Lines 418-423)
```python
ColorPrint.blue("[FrontendThread] " + "=" * 70)
ColorPrint.cyan(f"[FrontendThread] STARTING VITE DEV SERVER")
ColorPrint.cyan(f"[FrontendThread] Command: {' '.join(command)}")
ColorPrint.cyan(f"[FrontendThread] Port: {self.config.port}")
ColorPrint.cyan(f"[FrontendThread] Host: {self.config.host}")
ColorPrint.blue("[FrontendThread] " + "=" * 70)
```

#### 6.2 智能颜色编码输出 (Lines 433-461)
```python
# 重要消息始终显示(即使 show_output=False)
is_important = any(keyword in stripped.lower() for keyword in [
    'ready', 'vite v', 'local:', 'network:', 'error', 'warn',
    'failed', 'port', 'http://'
])

if is_important:
    if 'ready' in stripped.lower() or 'local:' in stripped.lower():
        ColorPrint.green(f"  [vite] {stripped}")  # 绿色: 就绪消息
    elif 'error' in stripped.lower() or 'failed' in stripped.lower():
        ColorPrint.red(f"  [vite] {stripped}")  # 红色: 错误
    elif 'warn' in stripped.lower():
        ColorPrint.yellow(f"  [vite] {stripped}")  # 黄色: 警告
    else:
        ColorPrint.cyan(f"  [vite] {stripped}")  # 青色: 其他重要信息
elif self.config.show_output:
    ColorPrint.gray(f"  [vite] {stripped}")  # 灰色: 普通输出
```

**预期输出**:
```
======================================================================
[FrontendThread] STARTING VITE DEV SERVER
[FrontendThread] Command: npm run dev -- --host 0.0.0.0 --port 3100
[FrontendThread] Port: 3100
[FrontendThread] Host: 0.0.0.0
======================================================================
  [vite] VITE v6.4.1  ready in 132 ms          (青色)
  [vite] ➜  Local:   http://localhost:3100/   (绿色)
  [vite] ➜  Network: http://192.168.50.3:3100/ (青色)
[FrontendThread] Frontend ready at http://localhost:3100
```

### 修复 7: 音频捕获 duration 计算 bug
**文件**: `/www/programing/core_node/pycore/pyutils/whisper_stt/audio_capture.py`

**问题**: 先清空 frames 再计算 duration,导致 duration 始终为 0

```python
# BEFORE (Lines 217-223)
self._frames = []  # 先清空
duration_seconds = len(self._frames) * ... if self._frames else 0  # 始终为 0!

# AFTER
frame_count = len(self._frames)  # 先保存数量
duration_seconds = frame_count * self._config.chunk_size / self._config.sample_rate
# ... trigger event
self._frames = []  # 再清空
```

## 端口分配方案

| 应用 | 端口 | 说明 |
|------|------|------|
| **matrixui** | 3000 | 用户手动运行 (不要修改) |
| **pycore-management** | 3100 | pycore_module_caller.py 前端 |
| **RPC v2 Backend** | 59000 | FastAPI 后端 API |

## 完整调用链

```
python ./pycore_module_caller.py (默认不带 --legacy)
  ↓
main_native_ui(port=59000)  ← RPC backend port
  ↓
callmodule/callmodule_main.start(port=59000)
  ↓
Config.FRONTEND_PORT = 3100  ← **前端端口**
  ↓
NativeUIConfig(frontend_port=Config.FRONTEND_PORT)
  ↓
launch_native_app(config)
  ↓
_start_frontend(config)
  ↓
FrontendConfig(port=config.frontend_port)
  ↓
FrontendLauncherThread.start()
  ↓
subprocess.Popen([
    "npm", "run", "dev", "--",
    "--host", "0.0.0.0",
    "--port", "3100"
])
环境变量:
  PORT=3100
  VITE_PORT=3100
  VITE_HOST=0.0.0.0
  ↓
vite.config.ts:
  port = parseInt(process.env.VITE_PORT || '3100')
  host = process.env.VITE_HOST || '0.0.0.0'
  strictPort: true
  ↓
Vite 启动在 0.0.0.0:3100
  ↓
健康检查: http://localhost:3100/
```

## 测试验证

### 测试 1: 端口 3100 可用
```bash
lsof -i :3100
# 预期: Port 3100 is free (或显示 vite 进程)
```

### 测试 2: Vite 手动启动
```bash
cd /www/programing/core_node/poly_apps/pycore-management
PORT=3100 VITE_PORT=3100 npm run dev -- --host 0.0.0.0 --port 3100
# 预期:
#   VITE v6.4.1  ready in 132 ms
#   ➜  Local:   http://localhost:3100/
#   ➜  Network: http://192.168.50.3:3100/
```

### 测试 3: pycore_module_caller.py 启动
```bash
python pycore_module_caller.py
# 预期:
# [FrontendThread] Checking if port 3100 is occupied...
# [FrontendThread] Port 3100 is available
# [FrontendThread] Command: npm run dev -- --host 0.0.0.0 --port 3100
# [FrontendThread] Dev server started (PID: XXXXX)
# [FrontendThread] Waiting for frontend at http://localhost:3100/
# [FrontendThread] Frontend ready at http://localhost:3100
# [PySide6Framework] Window visible: True
# (无 tray 错误,因为 Linux 禁用了 tray)
```

## 总结

**修复文件** (8个):
1. ✅ `pycore/callmodule/callmodule_config/config.py` - 端口改为 3100
2. ✅ `poly_apps/pycore-management/vite.config.ts` - 支持环境变量 + strictPort
3. ✅ `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py` - VITE_PORT 环境变量 + PIPE 输出消费 + 输出可见性增强
4. ✅ `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py` - 跳过 Dev 模式前端端口检查 **(NEW!)**
5. ✅ `pycore/callmodule/callmodule_main.py` - 禁用 Linux tray
6. ✅ `pycore/pyutils/whisper_stt/audio_capture.py` - 修复 duration 计算
7. ✅ `THREAD_BUS_INTEGRATION_REPORT.md` - 更新集成状态 (100%)
8. ✅ `PYCORE_MODULE_CALLER_FIX_SUMMARY.md` - 本文档 (完整修复记录)

**关键修复**:
1. 端口冲突 → 改为 3100
2. Vite 自动递增 → strictPort: true
3. 进程 defunct → PIPE + 后台线程消费输出
4. **Dev 前端被杀 → 跳过 Dev 模式端口检查 (CRITICAL!)**
5. D-Bus 错误 → 禁用 Linux tray
6. Duration bug → 先计算再清空 frames
7. **Vite 输出可见性 → 彩色编码 + 启动横幅**

**现在应该可以正常启动,前端不会被错误杀掉,并且能清楚看到 Vite 启动输出!**
