# Matrix Application - Startup Output Example

## 新版启动输出示例

运行 `python ./pymain.py app=matrix` 后，将看到以下详细的启动流程：

## Phase 1: Frontend Startup

```
======================================================================
 PHASE 1: STARTING FRONTEND
======================================================================

======================================================================
 MATRIX FRONTEND STARTUP FLOW
======================================================================

Step 1: Create temporary batch script
  - Script will launch PowerShell with start.ps1
  - Opens in new console window

Step 2: Execute PowerShell launcher
  Command: powershell.exe -File start.ps1 pymatrix debug

Step 3: Switch app entry point
  Script: switch-app-entry.js pymatrix
  Action: Copy index.pymatrix.vue -> index.vue

Step 4: Factory sync and dev server
  Script: switch-app-entry-plus.js pymatrix --mode dev
  Actions:
    - Mirror project to .build_dir/nuxt_factory/_app_pymatrix
    - Start file watcher (sync every 2 seconds)
    - Execute: pnpm dev:pymatrix

Step 5: Nuxt dev server starts
  Host: 0.0.0.0 (network accessible)
  Port: 3007
  URL:  http://localhost:3007

======================================================================

[EXECUTING] Starting frontend in new console window...
Temp script: C:\Users\MPC\AppData\Local\Temp\tmpXXXXXX.bat
[SUCCESS] Frontend launched in new console window

======================================================================
 WAITING FOR FRONTEND TO BECOME READY
======================================================================

Checking frontend availability: http://localhost:3007
Timeout: 120s | Check interval: 2s

This process includes:
  1. Switching entry point (index.vue)
  2. Mirroring project to factory directory
  3. Installing dependencies
  4. Starting Nuxt dev server
  5. Compiling Vue components

[WAITING] Connecting...
[WAITING] Connecting..
[WAITING] Connecting...

======================================================================
 FRONTEND READY
======================================================================
[SUCCESS] Frontend is now available at http://localhost:3007
```

## Phase 2: Backend Startup

```
======================================================================
 PHASE 2: STARTING BACKEND
======================================================================

Backend Configuration:
  Host: 0.0.0.0
  Port: 8000
  Mode: Production

Endpoints:
  API:      http://0.0.0.0:8000/api
  Docs:     http://0.0.0.0:8000/docs
  Health:   http://0.0.0.0:8000/api/health
  Frontend: http://localhost:3007

======================================================================

======================================================================
 MATRIX APPLICATION READY
======================================================================

All services are running:
  [FRONTEND] Nuxt Dev Server    -> http://localhost:3007
  [BACKEND]  FastAPI Server     -> http://0.0.0.0:8000/api
  [DOCS]     API Documentation  -> http://0.0.0.0:8000/docs

Press Ctrl+C to stop all services

======================================================================
```

## Backend Startup Details

```
======================================================================
 Matrix API Server - Starting
======================================================================
  Mode: dev
  Host: 0.0.0.0:8000
  API Docs: http://0.0.0.0:8000/docs
  Frontend: http://localhost:3007/pymatrix
======================================================================

Checking ADB availability...

✓ ADB is ready: D:\programing\core_node\pyapps\matrix\resources\adb\windows\adb.exe
✓ Connected devices: 1
  1. emulator-5554

✓ Matrix API Server startup complete
======================================================================

INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

## 前端控制台窗口输出

在新打开的控制台窗口中，将看到 start.ps1 的详细输出：

```
===============================================================================
  NUXT MULTI-APP LAUNCHER - APPLICATION STARTUP INFO
===============================================================================

=== Application Selection ===
  Selected App     : pyMatrix
  Namespace        : pymatrix
  Mode             : debug
  Port             : 3007
  Host             : 0.0.0.0 (accessible from network)

=== Entry Point Configuration ===
  Entry File       : pages/index.vue
  Source Template  : pages/index.pymatrix.vue
  Switch Script    : scripts/switch-app-entry.js
  Factory Sync     : scripts/switch-app-entry-plus.js
  APP_ENTRY Env    : pymatrix

=== Architecture Locations ===
  App Directory    : D:\programing\core_node\poly_apps\nuxt_main
  Theme Location   : apps/app_pymatrix/theme_app_pymatrix/
  Store Location   : apps/app_pymatrix/stores_app_pymatrix/
  Constants        : apps/app_pymatrix/constants_app_pymatrix/
  Router           : apps/app_pymatrix/router_app_pymatrix/

=== Network Configuration ===
  Local URL        : http://127.0.0.1:3007
  Network URL      : http://0.0.0.0:3007

===============================================================================


===============================================================================
  STEP 1: SWITCHING APP ENTRY POINT
===============================================================================
[INFO] Target App: pymatrix
[INFO] Switch Script: scripts\switch-app-entry.js

[COMMAND TRACE] Executing:
  > node "scripts\switch-app-entry.js" pymatrix

🚀 Switching to pymatrix app...
✅ Successfully switched to pymatrix app
ℹ️  Source: pages/index.pymatrix.vue
ℹ️  Target: pages/index.vue

🎉 Ready to start pymatrix app!

[SUCCESS] App entry switched successfully
===============================================================================

[INFO] Opening browser at http://127.0.0.1:3007

===============================================================================
  STEP 2: STARTING APPLICATION SERVER
===============================================================================
[INFO] Mode: DEBUG (Factory Sync + Dev Server)
[INFO] Port: 3007
[INFO] Host: 0.0.0.0 (Network Accessible)

[COMMAND TRACE] Environment Variables:
  > $env:NUXT_PORT = 3007
  > $env:NUXT_HOST = 0.0.0.0
  > $env:APP_ENTRY = pymatrix

[COMMAND TRACE] Executing Nuxt Factory Sync:
  > node "scripts\switch-app-entry-plus.js" pymatrix --mode dev

[INFO] switch-app-entry-plus.js will:
  - Mirror the repo to the factory build directory
  - Continuously sync changes every 2 seconds
  - Launch pnpm dev:pymatrix from the mirrored workspace
===============================================================================

[EXEC] node scripts\switch-app-entry-plus.js pymatrix --mode dev

=== Nuxt Factory Sync ===
Source Root: D:\programing\core_node\poly_apps\nuxt_main
Factory Root: D:\programing\.build_dir\nuxt_factory
Platform: windows
Target Apps: pymatrix
[Prep] Preparing runtime for pymatrix
[Sync] Mirroring source -> factory workspace...
[Watch] File watcher started (2s interval)
[Launch] Starting: pnpm dev:pymatrix

Nuxt 3.14.159
> Local:    http://localhost:3007/
> Network:  http://192.168.1.100:3007/

✔ Vite client built in 1234ms
✔ Nitro built in 567ms
ℹ Vite server warmed up in 890ms
✔ Nuxt DevTools is enabled
```

## 输出特点对比

### 旧版输出（简单）
```
Starting frontend in separate console window...
Temporary script: C:\Users\...\tmp.bat
Frontend launched in new console window

Waiting for frontend to start...
Waiting...
```

### 新版输出（详细）
```
======================================================================
 MATRIX FRONTEND STARTUP FLOW
======================================================================

Step 1: Create temporary batch script
Step 2: Execute PowerShell launcher
Step 3: Switch app entry point
Step 4: Factory sync and dev server
Step 5: Nuxt dev server starts

[EXECUTING] Starting frontend...
[SUCCESS] Frontend launched

======================================================================
 WAITING FOR FRONTEND TO BECOME READY
======================================================================

This process includes:
  1. Switching entry point
  2. Mirroring project
  3. Installing dependencies
  4. Starting dev server
  5. Compiling components

[WAITING] Connecting...
[SUCCESS] Frontend ready
```

## 颜色输出

使用 ColorPrint 提供的颜色：
- **蓝色 (blue)**: 主要标题和分隔线
- **绿色 (green)**: 成功消息和配置信息
- **黄色 (yellow)**: 步骤标题和警告
- **白色 (white)**: 详细信息
- **灰色 (gray)**: 辅助信息
- **红色 (red)**: 错误消息

## 启动时间线

```
00:00 - pymain.py 启动
00:01 - 加载 matrix_main.py
00:02 - 打印前端启动流程步骤
00:03 - 创建临时批处理脚本
00:04 - 启动新控制台窗口
00:05 - PowerShell 执行 start.ps1
00:10 - switch-app-entry.js 切换入口点
00:15 - switch-app-entry-plus.js 开始镜像
00:30 - pnpm dev:pymatrix 启动
00:45 - Nuxt 编译完成
00:50 - 前端就绪 (http://localhost:3007)
00:51 - 开始后端启动
00:52 - FastAPI 服务器启动
00:53 - ADB 检查
00:54 - 全部就绪！
```

## 用户体验改进

1. **清晰的流程展示** - 用户知道每一步在做什么
2. **实时进度反馈** - 动态显示连接状态
3. **详细的配置信息** - 一目了然的端口和URL
4. **专业的视觉效果** - 使用分隔线和颜色
5. **有用的错误提示** - 超时时显示手动启动方法
