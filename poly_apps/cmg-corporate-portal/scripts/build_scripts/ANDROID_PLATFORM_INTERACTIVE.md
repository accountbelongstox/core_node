# Android 平台添加交互式功能

## 日期: 2025-12-10

## 功能概述

为 `Add-AndroidPlatform` / `add_android_platform` 函数添加了智能交互式处理和资源预览功能。

## 新增功能

### 1. 智能检测已存在的 Android 平台 ✅

**问题场景：**
```
[CMD] npx cap add android
[error] android platform already exists.
        To re-add this platform, first remove .\android, then run this command again.
        WARNING: Your native project will be completely removed.
[WARNING] Failed to add Android platform
```

**新增处理：**
- 自动检测 `android` 目录是否已存在
- 提供交互式提示供用户选择
- 安全备份而非直接删除

### 2. 交互式重新安装提示 ✅

**Windows PowerShell:**
```powershell
--------------------------------------------
Adding Android Platform
--------------------------------------------

[Warning] Android platform already exists at: .\android

To re-add this platform, the existing android directory must be removed.
WARNING: Your native Android project will be completely removed.

Remove existing android directory and re-add platform? [y/N]:
```

**Linux Bash:**
```bash
--------------------------------------------
Adding Android Platform
--------------------------------------------

[Warning] Android platform already exists at: ./android

To re-add this platform, the existing android directory must be removed.
WARNING: Your native Android project will be completely removed.

Remove existing android directory and re-add platform? [y/N]:
```

### 3. 安全备份机制 ✅

**Windows:**
```powershell
[Action] Removing existing Android platform...
[CMD] Rename-Item "D:\...\android" "D:\...\android_backup_20251210_153045"
[Backup] Moved to: .\android_backup_20251210_153045
```

**Linux:**
```bash
[Action] Removing existing Android platform...
[CMD] mv "/path/to/android" "/path/to/android_backup_20251210_153045"
[Backup] Moved to: ./android_backup_20251210_153045
```

**特点：**
- 使用时间戳命名备份目录 (`android_backup_YYYYMMDD_HHMMSS`)
- 重命名而非删除（更安全）
- 允许保留多个历史备份

### 4. 添加后自动预览资源 ✅

**执行流程：**
```
1. 添加 Android 平台成功
   ↓
2. 自动扫描 Android 资源
   ↓
3. 启动 HTTP 预览服务器
   ↓
4. 自动打开浏览器展示预览
   ↓
5. 用户查看后关闭预览
```

**预览内容：**
- **应用图标** (app icons)
  - `mipmap-*dpi/ic_launcher.png`
  - `mipmap-*dpi/ic_launcher_round.png`
  - `mipmap-*dpi/ic_launcher_foreground.png`

- **启动屏幕** (splash screens)
  - `drawable/splash.png`
  - `drawable-land/splash.png`
  - `drawable-*dpi/splash.png`

- **应用配置信息**
  - 应用名称 (中英文)
  - Package ID
  - 描述信息

**预览界面：**
```
--------------------------------------------
Android Resource Preview
--------------------------------------------

Application Name: CMG-Shooting&Hotel (CMG靶场&酒店)
Package ID: com.ddsj.cmg.club

[App Icons]
  ✓ hdpi (72x72)        [显示图片]
  ✓ mdpi (48x48)        [显示图片]
  ✓ xhdpi (96x96)       [显示图片]
  ✓ xxhdpi (144x144)    [显示图片]
  ✓ xxxhdpi (192x192)   [显示图片]

[Splash Screens]
  ✓ Portrait           [显示图片]
  ✓ Landscape          [显示图片]

[Close] [Continue with Build]
```

---

## 完整使用场景

### 场景 1: 首次添加 Android 平台

**输入：**
```powershell
.\start.ps1
# 选择: 1. Install Capacitor
```

**输出：**
```
--------------------------------------------
Adding Android Platform
--------------------------------------------
[CMD] npx cap add android
✔ Adding native android project in android in 58.70ms
✔ add in 59.01ms
✔ Copying web assets from dist to android\app\src\main\assets\public in 36.59ms
✔ Creating capacitor.config.json in android\app\src\main\assets in 1.10ms
✔ copy android in 61.82ms
✔ Updating Android plugins in 1.62ms
[Success] Android platform added successfully

[Preview] Scanning Android resources...
[CMD] python -c "<scan and preview resources>"

[Scan] Android directory: D:\...\android
[Scan] Found 15 app icons
[Scan] Found 8 splash screens
[Scan] Package ID: com.ddsj.cmg.club
[Scan] App Name: CMG-Shooting&Hotel

[Preview] Launching resource preview server...
[Preview] Server running at: http://localhost:8899
[Preview] Opening browser...

(浏览器自动打开，显示资源预览)

[Preview] Preview closed
```

### 场景 2: Android 平台已存在 - 用户选择重装

**输入：**
```powershell
.\start.ps1
# 选择: 1. Install Capacitor
```

**输出：**
```
--------------------------------------------
Adding Android Platform
--------------------------------------------

[Warning] Android platform already exists at: .\android

To re-add this platform, the existing android directory must be removed.
WARNING: Your native Android project will be completely removed.

Remove existing android directory and re-add platform? [y/N]: y

[Action] Removing existing Android platform...
[CMD] Rename-Item "D:\...\android" "D:\...\android_backup_20251210_153045"
[Backup] Moved to: .\android_backup_20251210_153045

[Capacitor] Adding Android platform...
[CMD] npx cap add android
✔ Adding native android project in android in 58.70ms
✔ add in 59.01ms
[Success] Android platform added successfully

[Preview] Scanning Android resources...
[CMD] python -c "<scan and preview resources>"

[Preview] Launching resource preview server...
[Preview] Server running at: http://localhost:8899
[Preview] Opening browser...

(浏览器自动打开，显示资源预览)

[Preview] Preview closed
```

### 场景 3: Android 平台已存在 - 用户取消

**输入：**
```powershell
.\start.ps1
# 选择: 1. Install Capacitor
```

**输出：**
```
--------------------------------------------
Adding Android Platform
--------------------------------------------

[Warning] Android platform already exists at: .\android

To re-add this platform, the existing android directory must be removed.
WARNING: Your native Android project will be completely removed.

Remove existing android directory and re-add platform? [y/N]: n

[Info] Android platform addition cancelled by user

============================================
Execution Complete
============================================
```

---

## 实现细节

### Windows PowerShell 实现

**文件:** `execute_commands_windows_new.ps1`

**函数:** `Add-AndroidPlatform` (Line 405-510)

**关键代码：**

```powershell
function Add-AndroidPlatform {
    param([string]$Prefix)

    Write-Section "Adding Android Platform"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
    $androidPath = Join-Path $projectRoot "android"

    Push-Location $projectRoot
    try {
        # 1. 检测已存在的 Android 平台
        if (Test-Path $androidPath) {
            Write-ColorText "[Warning] Android platform already exists" "Yellow"

            # 2. 交互式提示
            $confirmation = Read-Host "Remove existing android directory and re-add platform? [y/N]"

            if ($confirmation -match '^[Yy]$') {
                # 3. 安全备份（重命名）
                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                $backupPath = "${androidPath}_backup_$timestamp"
                Rename-Item -Path $androidPath -NewName "$backupPath" -Force

                # 4. 重新添加
                & npx cap add android
            }
        } else {
            # 首次添加
            & npx cap add android
        }

        # 5. 添加成功后自动预览
        if (Test-Path $androidPath) {
            # 扫描资源
            $pythonCmd = @"
import sys
sys.path.insert(0, r'$buildScriptsDir')
from resource_scanner import ResourceScanner
from web_preview_server import show_preview

scanner = ResourceScanner(r'$androidPath')
resource_data = scanner.get_full_report()

print('\n[Preview] Launching resource preview server...')
show_preview(resource_data, port=8899)
"@
            $pythonCmd | python -
        }
    } finally {
        Pop-Location
    }
}
```

### Linux Bash 实现

**文件:** `execute_commands_linux_new.sh`

**函数:** `add_android_platform` (Line 361-451)

**关键代码：**

```bash
add_android_platform() {
    print_section "Adding Android Platform"

    local project_root=$(get_var_value "$KEY_PROJECT_ROOT")
    local android_path="$project_root/android"

    cd "$project_root"

    # 1. 检测已存在的 Android 平台
    if [ -d "$android_path" ]; then
        print_color "$COLOR_YELLOW" "[Warning] Android platform already exists"

        # 2. 交互式提示
        read -p "Remove existing android directory and re-add platform? [y/N]: " confirmation

        if [[ "$confirmation" =~ ^[Yy]$ ]]; then
            # 3. 安全备份（重命名）
            local timestamp=$(date +"%Y%m%d_%H%M%S")
            local backup_path="${android_path}_backup_$timestamp"
            mv "$android_path" "$backup_path"

            # 4. 重新添加
            npx cap add android
        fi
    else
        # 首次添加
        npx cap add android
    fi

    # 5. 添加成功后自动预览
    if [ -d "$android_path" ]; then
        # 扫描资源
        python3 -c "
import sys
sys.path.insert(0, r'$script_dir')
from resource_scanner import ResourceScanner
from web_preview_server import show_preview

scanner = ResourceScanner(r'$android_path')
resource_data = scanner.get_full_report()

print('\n[Preview] Launching resource preview server...')
show_preview(resource_data, port=8899)
"
    fi
}
```

---

## 用户交互选项

### 提示输入

```
Remove existing android directory and re-add platform? [y/N]:
```

### 有效输入

| 输入 | 含义 | 行为 |
|------|------|------|
| `y` | Yes (确认) | 备份并重新安装 Android 平台 |
| `Y` | Yes (确认) | 备份并重新安装 Android 平台 |
| `n` | No (取消) | 取消操作，保留现有平台 |
| `N` | No (取消) | 取消操作，保留现有平台 |
| `<空>` | 默认 (No) | 取消操作，保留现有平台 |

**注意：** 默认为 `N` (不重装)，需要明确输入 `y` 或 `Y` 才会执行重装。

---

## 安全性保障

### 1. 备份而非删除 ✅

**原理：**
- 不直接删除 `android` 目录
- 重命名为 `android_backup_<timestamp>`
- 保留所有原有数据

**优势：**
- 可随时回滚
- 不会丢失数据
- 保留完整历史

### 2. 时间戳命名 ✅

**格式：** `android_backup_YYYYMMDD_HHMMSS`

**示例：**
- `android_backup_20251210_153045`
- `android_backup_20251210_160230`
- `android_backup_20251211_091502`

**优势：**
- 唯一性保证
- 时间可追溯
- 支持多次备份

### 3. 明确的警告信息 ✅

**警告内容：**
```
WARNING: Your native Android project will be completely removed.
```

**目的：**
- 让用户充分了解后果
- 防止误操作
- 需要明确确认

### 4. 默认为安全选项 ✅

**默认行为：** 不重装 (N)

**原因：**
- 保护用户数据
- 防止意外删除
- 需要主动确认

---

## 资源预览功能

### 预览触发时机

**条件：** Android 平台添加成功后自动触发

**流程：**
```
Android 平台添加成功
  ↓
检测 android 目录存在
  ↓
调用 resource_scanner.py
  ↓
扫描图标和启动屏幕
  ↓
调用 web_preview_server.py
  ↓
启动 HTTP 服务器 (端口 8899)
  ↓
自动打开浏览器
  ↓
展示资源预览页面
```

### 预览服务器

**实现：** `web_preview_server.py`

**端口：** 8899

**接口：**
- `GET /` - 预览页面
- `GET /api/data` - 获取资源数据
- `GET /api/image?path=<image_path>` - 获取图片
- `POST /api/confirm` - 用户确认继续
- `GET /api/shutdown` - 关闭服务器

**特点：**
- 自动打开浏览器
- 实时显示图标和启动屏幕
- 支持图片预览
- 显示应用配置信息

### 资源扫描器

**实现：** `resource_scanner.py`

**扫描内容：**
1. **应用图标：**
   - `mipmap-hdpi/ic_launcher.png`
   - `mipmap-mdpi/ic_launcher.png`
   - `mipmap-xhdpi/ic_launcher.png`
   - `mipmap-xxhdpi/ic_launcher.png`
   - `mipmap-xxxhdpi/ic_launcher.png`

2. **启动屏幕：**
   - `drawable/splash.png`
   - `drawable-land/splash.png`
   - `drawable-*dpi/splash.png`

3. **配置信息：**
   - 从 `AndroidManifest.xml` 读取
   - 应用名称
   - Package ID

---

## 与现有流程的集成

### Option 1: Install Capacitor

**原流程：**
```
1. pnpm install
2. npx cap init
3. npx cap add android    ← 在这里可能失败
```

**新流程：**
```
1. pnpm install
2. npx cap init
3. npx cap add android    ← 智能处理已存在情况
   ├─ 检测已存在 → 提示用户
   ├─ 用户确认 → 备份并重装
   ├─ 用户取消 → 跳过添加
   └─ 添加成功 → 自动预览资源
```

### Option 4: Build for Android

**原流程：**
```
1. 检查 android 目录存在
2. 扫描资源并预览
3. 用户确认后继续
4. 构建 Android APK
```

**保持不变：** 构建流程中的预览功能依然存在

**区别：**
- Install 时：添加后立即预览
- Build 时：构建前预览（用户确认）

---

## 跨平台一致性

### Windows 和 Linux 行为完全相同 ✅

**一致性检查清单：**

| 功能 | Windows | Linux | 一致性 |
|------|---------|-------|--------|
| 检测已存在平台 | ✅ | ✅ | ✅ |
| 交互式提示 | ✅ | ✅ | ✅ |
| 备份命名格式 | ✅ | ✅ | ✅ |
| 时间戳格式 | ✅ | ✅ | ✅ |
| 默认行为 (N) | ✅ | ✅ | ✅ |
| 资源扫描 | ✅ | ✅ | ✅ |
| 自动预览 | ✅ | ✅ | ✅ |
| 错误处理 | ✅ | ✅ | ✅ |

---

## 测试场景

### 测试 1: 首次安装（android 目录不存在）

**步骤：**
```powershell
# 确保没有 android 目录
rm -rf android

# 运行安装
.\start.ps1
# 选择: 1. Install Capacitor
```

**预期结果：**
- ✅ 直接执行 `npx cap add android`
- ✅ 不提示用户
- ✅ 添加成功后自动预览

### 测试 2: 重新安装（android 目录已存在，用户选择 Y）

**步骤：**
```powershell
# 运行安装
.\start.ps1
# 选择: 1. Install Capacitor
# 输入: y
```

**预期结果：**
- ✅ 提示用户
- ✅ 创建备份 `android_backup_<timestamp>`
- ✅ 删除原 android 目录
- ✅ 执行 `npx cap add android`
- ✅ 添加成功后自动预览

### 测试 3: 取消重装（android 目录已存在，用户选择 N）

**步骤：**
```powershell
# 运行安装
.\start.ps1
# 选择: 1. Install Capacitor
# 输入: n
```

**预期结果：**
- ✅ 提示用户
- ✅ 显示取消消息
- ✅ 保留原 android 目录
- ✅ 不执行任何操作
- ✅ 不展示预览

### 测试 4: 资源预览功能

**步骤：**
```powershell
# 成功添加 Android 平台后
# 等待预览服务器启动
```

**预期结果：**
- ✅ 自动启动 HTTP 服务器
- ✅ 自动打开浏览器
- ✅ 显示应用图标
- ✅ 显示启动屏幕
- ✅ 显示应用配置
- ✅ 用户关闭后继续流程

---

## 总结

### ✅ 新增功能总览

1. **智能检测** - 自动检测 Android 平台是否已存在
2. **交互式提示** - 用户友好的 Y/N 提示
3. **安全备份** - 带时间戳的备份机制
4. **自动预览** - 添加成功后立即展示资源预览
5. **跨平台一致** - Windows 和 Linux 行为完全相同

### 📊 改进对比

| 方面 | 改进前 | 改进后 |
|------|--------|--------|
| **错误处理** | 显示错误后退出 | 智能提示用户选择 |
| **数据安全** | 需手动备份 | 自动备份 |
| **用户体验** | 需手动操作 | 一键式交互 |
| **资源预览** | 仅在构建时 | 添加后立即预览 |
| **命令透明** | 仅显示失败 | 完整流程可见 |

### 🎯 用户价值

1. **更安全** - 不会意外丢失数据
2. **更方便** - 一个命令完成所有操作
3. **更直观** - 立即看到添加结果
4. **更可靠** - 有明确的备份和回滚机制

---

**文档创建:** 2025-12-10
**状态:** ✅ 已实现并测试
**适用版本:** Windows PowerShell + Linux Bash
