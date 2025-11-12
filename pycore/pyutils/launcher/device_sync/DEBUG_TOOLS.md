# Device Sync - Debug Tools

## Quick Diagnostic

如果 Device Sync 启动后没有看到托盘图标，请按以下步骤诊断：

### 方法 1: 运行完整诊断（推荐）

```bash
cd D:\programing\core_node\pycore\pyutils\launcher\device_sync
python diagnose.py
```

这会检查：
- IPC 服务器是否运行
- pystray 是否安装
- 进程是否存在
- **显示所有日志文件内容**

### 方法 2: 前台测试（查看所有输出）

```bash
cd D:\programing\core_node\pycore\pyutils\launcher\device_sync
test_startup.bat
```

或直接运行：

```bash
python test_startup.py
```

这会在前台启动 Device Sync，你可以看到所有输出和错误信息。

### 方法 3: 查看日志文件

```bash
cd D:\programing\core_node\pycore\pyutils\launcher\device_sync
view_log.bat
```

查看两个日志文件：
1. `device_sync_launcher.log` - launcher.py 启动日志
2. `device_sync.log` - Device Sync 主进程日志

日志位置：`%TEMP%\device_sync\`（通常是 `C:\Users\你的用户名\AppData\Local\Temp\device_sync\`）

## 调试工具列表

### 1. `diagnose.py` - 完整诊断工具

**功能：**
- 检查 IPC 服务器（端口 45678）
- 检查 pystray 库是否安装
- 检查 pythonw.exe 进程
- 显示所有日志文件内容

**运行：**
```bash
python diagnose.py
```

**输出示例：**
```
[1] Checking IPC Server (Port 45678)...
    ✓ IPC server is RUNNING
    → Device Sync is active

[2] Checking pystray library...
    ✓ pystray is installed

[3] Checking for pythonw.exe process...
    ✓ Found 1 pythonw.exe process(es)

[4] Checking log files...
    ✓ Launcher log found: C:\Users\...\Temp\device_sync\device_sync_launcher.log
    (shows log contents)
```

### 2. `test_startup.py` - 前台启动测试

**功能：**
- 在前台模式启动 Device Sync（不隐藏到后台）
- 显示所有输出和错误信息
- 用于调试启动问题

**运行：**
```bash
python test_startup.py
# 或
test_startup.bat
```

**用途：**
- 查看 Device Sync 是否能正常启动
- 查看是否有 Python 错误
- 查看 pystray 是否工作

### 3. `start_debug.bat` - 调试模式启动

**功能：**
- 在前台运行 Device Sync（不隐藏）
- 设置 `DEVICE_SYNC_NO_BACKGROUND=1`
- 控制台窗口保持打开

**运行：**
```bash
start_debug.bat
```

### 4. `view_log.bat` - 查看日志文件

**功能：**
- 显示所有日志文件内容
- 查看 launcher.py 启动日志
- 查看 Device Sync 主进程日志

**运行：**
```bash
view_log.bat
```

### 5. `check_status.py` - 状态检查

**功能：**
- 检查 IPC 服务器
- 检查 pystray
- 检查进程
- 不显示日志文件

**运行：**
```bash
python check_status.py
```

## 常见问题诊断

### 问题 1: 启动后没有托盘图标

**步骤：**

1. 运行诊断：
   ```bash
   python diagnose.py
   ```

2. 查看输出：
   - 如果显示 "pystray NOT installed"：
     ```bash
     pip install pystray pillow
     ```

   - 如果显示 "IPC server NOT responding"：
     - Device Sync 没有启动或已崩溃
     - 运行 `test_startup.bat` 查看错误

   - 如果显示 "IPC server is RUNNING"：
     - Device Sync 正在运行
     - 检查系统托盘（点击 ^ 箭头）
     - 图标可能在隐藏区域

### 问题 2: 启动失败或立即退出

**步骤：**

1. 前台测试：
   ```bash
   test_startup.bat
   ```

2. 查看错误信息：
   - 如果有 Python 错误，会直接显示
   - 记录错误信息用于修复

3. 查看日志：
   ```bash
   view_log.bat
   ```

### 问题 3: 无法确定是否在运行

**步骤：**

1. 检查 IPC 服务器：
   ```bash
   python check_status.py
   ```

2. 查看进程：
   ```bash
   tasklist | findstr pythonw
   ```

3. 查看日志：
   ```bash
   view_log.bat
   ```

## 日志文件位置

所有日志文件位于：`%TEMP%\device_sync\`

- **Windows 路径：** `C:\Users\你的用户名\AppData\Local\Temp\device_sync\`

**日志文件：**
1. `device_sync_launcher.log` - launcher.py 启动时的输出
2. `device_sync.log` - Device Sync 主进程输出

## 手动清理

如果需要完全重启 Device Sync：

### Windows:

```bash
# 1. 停止所有 Device Sync 进程
taskkill /F /IM pythonw.exe

# 2. 删除日志文件
del /Q %TEMP%\device_sync\*.log

# 3. 重新启动
python -m pycore.pyutils.launcher.launcher
# 选择 [2] - Launch Device Sync Only
```

### Linux:

```bash
# 1. 停止进程
pkill -f device_sync

# 2. 删除日志
rm -rf /tmp/device_sync/

# 3. 重新启动
python -m pycore.pyutils.launcher.launcher
```

## 获取帮助

如果以上方法都无法解决问题：

1. 运行完整诊断：
   ```bash
   python diagnose.py > diagnosis_report.txt
   ```

2. 前台测试并截图：
   ```bash
   test_startup.bat
   # 截图所有输出
   ```

3. 收集日志：
   ```bash
   view_log.bat > logs_output.txt
   ```

4. 提供以下信息：
   - `diagnosis_report.txt` 内容
   - 前台测试的截图/输出
   - `logs_output.txt` 内容
   - 操作系统版本
   - Python 版本（`python --version`）
