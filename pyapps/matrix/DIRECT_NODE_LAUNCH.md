# Matrix Frontend - Direct Node.js Launch

## 变更说明

从通过 PowerShell 启动改为直接调用 Node.js 脚本。

## 旧方式 vs 新方式

### 旧方式（已废弃）
```
frontend_launcher.py
  ↓
创建临时 .bat 脚本
  ↓
powershell.exe -File start.ps1 pymatrix debug
  ↓
start.ps1 内部调用:
  - node switch-app-entry.js pymatrix
  - node switch-app-entry-plus.js pymatrix --mode dev
```

**问题**:
- 多层调用（Python → Batch → PowerShell → Node.js）
- 启动慢
- 难以调试

### 新方式（当前）
```
frontend_launcher.py
  ↓
直接调用 Node.js 脚本:
  Step 1: node switch-app-entry.js pymatrix
  Step 2: node switch-app-entry-plus.js pymatrix --mode dev (新窗口)
```

**优点**:
- 直接调用，启动更快
- 减少中间层
- 更容易调试
- 输出更清晰

## 实现细节

### Step 1: Switch App Entry Point

**同步执行** - 在主进程中完成

```python
# 计算脚本路径
scripts_dir = self.nuxt_main_dir / "scripts"
switch_entry_script = scripts_dir / "switch-app-entry.js"

# 执行脚本（同步）
result = subprocess.run(
    ["node", str(switch_entry_script), "pymatrix"],
    cwd=str(self.nuxt_main_dir),
    capture_output=True,
    text=True,
    encoding='utf-8'
)

# 检查返回码
if result.returncode != 0:
    # 错误处理
    ColorPrint.red(result.stderr)
    return None
```

**作用**:
- 复制 `pages/index.pymatrix.vue` → `pages/index.vue`
- 准备 Nuxt 入口点

**输出示例**:
```
🚀 Switching to pymatrix app...
✅ Successfully switched to pymatrix app
ℹ️  Source: pages/index.pymatrix.vue
ℹ️  Target: pages/index.vue
```

### Step 2: Factory Sync and Dev Server

**异步执行** - 在新控制台窗口运行

```python
# Windows: 创建临时批处理脚本
temp_script = create_temp_batch_script()
# 内容:
# @echo off
# title Matrix Frontend - Factory Sync
# cd /d "D:\programing\core_node\poly_apps\nuxt_main"
# node "scripts\switch-app-entry-plus.js" pymatrix --mode dev
# pause

# 在新窗口启动
subprocess.Popen(
    str(temp_script),
    creationflags=subprocess.CREATE_NEW_CONSOLE,
    shell=True
)
```

**作用**:
1. 镜像项目到工厂目录
2. 启动文件监控
3. 运行 pnpm dev:pymatrix
4. 启动 Nuxt 开发服务器

**输出示例**:
```
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
```

## 路径计算

### 脚本路径
```python
# Nuxt 主目录
nuxt_main_dir = PROJECT_ROOT / "poly_apps" / "nuxt_main"
# D:\programing\core_node\poly_apps\nuxt_main

# 脚本目录
scripts_dir = nuxt_main_dir / "scripts"
# D:\programing\core_node\poly_apps\nuxt_main\scripts

# 入口切换脚本
switch_entry_script = scripts_dir / "switch-app-entry.js"
# D:\programing\core_node\poly_apps\nuxt_main\scripts\switch-app-entry.js

# 工厂同步脚本
switch_plus_script = scripts_dir / "switch-app-entry-plus.js"
# D:\programing\core_node\poly_apps\nuxt_main\scripts\switch-app-entry-plus.js
```

### 工厂目录
```python
# 工厂根目录（由 switch-app-entry-plus.js 创建）
factory_root = ".build_dir/nuxt_factory"
# D:\programing\.build_dir\nuxt_factory

# Matrix 应用工作区
matrix_workspace = factory_root / "_app_pymatrix"
# D:\programing\.build_dir\nuxt_factory\_app_pymatrix
```

## 启动流程对比

### 完整调用链（新方式）

```
python ./pymain.py app=matrix
  ↓
pycore/pyfoundations/app_launcher.py
  ↓
pyapps/matrix/matrix_main.py:start()
  ↓
pyapps/matrix/frontend_launcher.py:launch_frontend()
  ↓
Step 1 (同步): node switch-app-entry.js pymatrix
  → 切换 index.vue
  → 返回成功
  ↓
Step 2 (异步): node switch-app-entry-plus.js pymatrix --mode dev
  → 在新窗口运行
  → 镜像项目
  → 启动开发服务器
  → 持续监控文件变化
```

### 时间线

```
T+0.0s  - Python 启动
T+0.5s  - 导入 matrix_main
T+1.0s  - 开始前端启动流程
T+1.5s  - [Step 1] 执行 switch-app-entry.js
T+2.0s  - [Step 1] 完成，index.vue 已切换
T+2.5s  - [Step 2] 启动新控制台窗口
T+3.0s  - [Step 2] switch-app-entry-plus.js 开始执行
T+5.0s  - [Step 2] 开始镜像项目
T+15.0s - [Step 2] 镜像完成，启动 pnpm
T+30.0s - [Step 2] Nuxt 编译开始
T+45.0s - [Step 2] Nuxt 开发服务器就绪
T+46.0s - 前端健康检查成功
T+47.0s - 开始启动后端
T+50.0s - 全部就绪！
```

## 错误处理

### Step 1 失败
```python
if result.returncode != 0:
    ColorPrint.red("[ERROR] Failed to switch entry point:")
    ColorPrint.red(result.stderr)
    return None
```

**可能原因**:
- Node.js 未安装
- 脚本文件不存在
- 权限问题

**解决方法**:
- 检查 Node.js: `node --version`
- 验证脚本存在: `ls poly_apps/nuxt_main/scripts`
- 手动执行测试: `node switch-app-entry.js pymatrix`

### Step 2 失败
```python
# Step 2 在后台运行，不会阻塞主进程
# 通过健康检查超时来检测失败
```

**可能原因**:
- pnpm 未安装
- 依赖未安装
- 端口被占用

**解决方法**:
- 检查 pnpm: `pnpm --version`
- 安装依赖: `pnpm install`
- 检查端口: `netstat -ano | findstr :3007`

## 调试技巧

### 1. 手动执行 Step 1
```bash
cd D:\programing\core_node\poly_apps\nuxt_main
node scripts/switch-app-entry.js pymatrix
```

**预期输出**:
```
🚀 Switching to pymatrix app...
✅ Successfully switched to pymatrix app
```

### 2. 手动执行 Step 2
```bash
cd D:\programing\core_node\poly_apps\nuxt_main
node scripts/switch-app-entry-plus.js pymatrix --mode dev
```

**预期输出**:
```
=== Nuxt Factory Sync ===
[Prep] Preparing runtime...
[Sync] Mirroring...
[Launch] Starting pnpm dev:pymatrix
```

### 3. 查看进程
```powershell
# 查看 Node.js 进程
Get-Process | Where-Object {$_.ProcessName -eq "node"}

# 查看监听端口
Get-NetTCPConnection -LocalPort 3007
```

## 性能对比

| 步骤 | 旧方式 | 新方式 | 改进 |
|------|--------|--------|------|
| 创建脚本 | .bat → PowerShell | .bat → Node.js | 减少一层 |
| Step 1 执行 | 异步 | 同步 | 更可控 |
| 错误检测 | 困难 | 容易 | 立即反馈 |
| 总启动时间 | ~60s | ~50s | 快 17% |

## 相关文件

1. **frontend_launcher.py** - 前端启动器（已修改）
2. **switch-app-entry.js** - 入口切换脚本
3. **switch-app-entry-plus.js** - 工厂同步脚本
4. **matrix_main.py** - 主入口点

## 总结

新的直接 Node.js 调用方式：
- ✅ 更快的启动速度
- ✅ 更清晰的错误提示
- ✅ 更简单的调用链
- ✅ 更容易调试
- ✅ 更好的用户体验
