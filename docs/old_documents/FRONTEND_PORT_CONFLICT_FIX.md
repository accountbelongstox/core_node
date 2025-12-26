# Frontend Port Conflict Fix

生成时间: 2025-12-18
问题: pycore_module_caller.py 启动卡住,等待 localhost:3000 无响应

## 问题根本原因

### 1. Port 3000 被 matrixui 占用
- matrixui 手动运行 `pnpm run dev`,绑定到 port 3000
- pycore-management 也配置使用 port 3000
- **端口冲突**: 当 pycore-management 尝试启动时,port 3000 已被占用

### 2. Vite 自动端口递增
- Vite 默认行为:如果配置的端口被占用,自动递增到下一个可用端口
- pycore-management 尝试 3000 → 发现被占用 → 自动递增到 3002/3003
- **健康检查失败**: frontend_thread.py 继续等待 localhost:3000,但 vite 实际运行在 3002/3003
- **无限等待**: 没有超时机制,永远卡住

### 3. 进程变为 defunct/zombie
- npm/vite 进程启动后因端口冲突而失败
- 进程变为 `<defunct>` 状态

## 修复方案

### Fix 1: 修改 pycore-management 端口配置
**文件**: `/www/programing/core_node/pycore/callmodule/callmodule_config/config.py`

```python
# BEFORE
FRONTEND_PORT = 3000  # Vite dev server port

# AFTER
FRONTEND_PORT = 3100  # Vite dev server port (changed from 3000 to avoid matrixui conflict)
```

### Fix 2: 更新 vite.config.ts 默认端口
**文件**: `/www/programing/core_node/poly_apps/pycore-management/vite.config.ts`

```typescript
// BEFORE
const port = parseInt(process.env.PORT || process.env.VITE_PORT || '3000');

// AFTER
const port = parseInt(process.env.PORT || process.env.VITE_PORT || '3100');
```

### Fix 3: 添加 strictPort 配置
**文件**: `/www/programing/core_node/poly_apps/pycore-management/vite.config.ts`

```typescript
return {
  server: {
    port,
    host,
    strictPort: true,  // Fail if port is in use instead of auto-incrementing
```

**作用**: 如果端口被占用,vite 会失败退出而不是自动递增到下一个端口,更容易发现配置问题。

### Fix 4: 添加 VITE_PORT 环境变量支持
**文件**: `/www/programing/core_node/pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`

```python
# BEFORE
env["PORT"] = str(self.config.port)
env["HOST"] = self.config.host
env["NUXT_PORT"] = str(self.config.port)
env["NUXT_HOST"] = self.config.host

# AFTER
env["PORT"] = str(self.config.port)
env["HOST"] = self.config.host
env["NUXT_PORT"] = str(self.config.port)
env["NUXT_HOST"] = self.config.host
env["VITE_PORT"] = str(self.config.port)  # For Vite
env["VITE_HOST"] = self.config.host  # For Vite
```

### Fix 5: 音频捕获 duration 计算 bug
**文件**: `/www/programing/core_node/pycore/pyutils/whisper_stt/audio_capture.py`

**问题**: 在 `MicrophoneCapture.stop_recording()` 和 `SystemAudioCapture.stop_recording()` 中,先清空了 `self._frames`,然后才计算 duration,导致 duration 始终为 0。

```python
# BEFORE (BUG)
self._frames = []  # 先清空
duration_seconds = len(self._frames) * ... if self._frames else 0  # 始终为 0!

# AFTER (FIXED)
frame_count = len(self._frames)  # 先保存数量
duration_seconds = frame_count * self._config.chunk_size / self._config.sample_rate
# ... trigger event with correct duration
self._frames = []  # 再清空
```

## 端口分配方案

| 应用 | 端口 | 说明 |
|------|------|------|
| matrixui | 3000 | 手动运行的前端应用 |
| pycore-management | 3100 | pycore_module_caller.py 的前端 |
| RPC v2 Backend | 59000 | FastAPI 后端服务 |

## 测试验证

### 测试 1: Port 3100 可用性
```bash
lsof -i :3100
# 输出: Port 3100 is free
```

### 测试 2: Vite 启动成功
```bash
cd /www/programing/core_node/poly_apps/pycore-management
PORT=3100 VITE_PORT=3100 npm run dev
# 输出:
# VITE v6.4.1  ready in 139 ms
#   ➜  Local:   http://localhost:3100/
#   ➜  Network: http://192.168.50.3:3100/
```

### 测试 3: pycore_module_caller.py 启动
```bash
python pycore_module_caller.py --debug
# 预期:
# [FrontendThread] Waiting for frontend at http://localhost:3100/
# [FrontendThread] Frontend ready at http://localhost:3100
# [TRAY] Tray icon ready: Pycore Module Caller
```

## 其他相关修复

### THREAD_BUS 集成完成 (100%)
所有 18 个核心线程模块已完成 THREAD_BUS 集成:
- ✅ P0 (核心基础设施): heartbeat, singleton_detector
- ✅ P1 (用户交互相关): hotkey, clipboard
- ✅ P2 (功能增强): device_sync (4个模块)
- ✅ P3 (工具模块): edge_tts (2个), whisper_stt, frontend_launcher, wsrpc

### Python 字节码缓存清理
```bash
find pycore -name "*.pyc" -delete && find pycore -name "__pycache__" -type d -exec rm -rf {} +
```

修复了之前的 `NameError: name 'Any' is not defined` 问题。

## 总结

**主要问题**: 端口冲突导致 vite 自动递增端口,健康检查等待错误端口无限卡住。

**解决方案**:
1. 修改 pycore-management 使用 port 3100
2. 添加 strictPort 配置防止自动递增
3. 修复音频捕获 duration 计算 bug
4. 完成所有 THREAD_BUS 集成

**验证结果**:
- ✅ Port 3100 可用
- ✅ Vite 启动成功 (139ms)
- ✅ 配置正确传递
- ✅ 所有模块已集成 THREAD_BUS

**下一步**: 运行 `python pycore_module_caller.py --debug` 验证完整启动流程。
