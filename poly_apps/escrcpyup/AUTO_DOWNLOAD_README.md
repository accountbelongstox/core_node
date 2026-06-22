# ADB 和 SCRCPY 自动下载功能 / Auto Download for ADB and SCRCPY

## 概述 / Overview

本项目现在支持自动下载 ADB 和 SCRCPY 二进制文件，无需手动下载和配置。所有二进制文件都不会提交到 Git 仓库，而是在编译或运行时自动下载。

This project now supports automatic downloading of ADB and SCRCPY binaries, eliminating manual download and configuration. All binaries are excluded from Git and downloaded automatically during build or runtime.

## ✨ 新特性 / New Features

- ✅ **自动下载** - 编译时或运行时自动下载最新版本
- ✅ **进度显示** - 下载时显示实时进度条和下载速度
- ✅ **多平台支持** - Windows、macOS (x64/ARM64)、Linux (x64/ARM64)
- ✅ **智能检测** - 自动检测缺失的二进制文件并下载
- ✅ **Git 友好** - 不再需要 .py 备份，所有二进制文件从 Git 排除

---

## 使用方法 / Usage

### 方法 1: 编译时自动下载 / Build-Time Auto Download

**Windows PowerShell:**
```powershell
# 方法 A: 使用 start.ps1 启动脚本（推荐）
.\scripts\start.ps1
# 选择 "3. Initialize Environment" 或 "1. Start Development Server"
# 脚本会自动检测并下载缺失的二进制文件（带进度条显示）

# 方法 B: 直接运行下载脚本
.\scripts\download-binaries.ps1
# 自动下载所有平台的二进制文件，显示下载进度
```

**Unix/Linux/macOS Bash:**
```bash
# 方法 A: 使用 start.sh 启动脚本（推荐）
./scripts/start.sh
# 选择对应的选项，脚本会自动处理

# 方法 B: 直接运行下载脚本
./scripts/download-binaries.sh
# 自动下载所有平台的二进制文件，显示下载进度
```

### 方法 2: 运行时自动下载 / Runtime Auto Download

程序启动时会自动检测 ADB 和 SCRCPY 是否存在，如果不存在会自动下载。

The application automatically detects if ADB and SCRCPY exist at startup and downloads them if missing.

**Node.js 代码中使用 / Using in Node.js Code:**
```javascript
import { ensureBinaries, downloadBinaries, checkBinariesExist } from './electron/helpers/download-binaries.js'

// 方法 1: 确保二进制文件存在（不存在则下载）
await ensureBinaries()

// 方法 2: 强制下载二进制文件
await downloadBinaries()

// 方法 3: 检查二进制文件是否存在
const exists = checkBinariesExist()
if (!exists) {
  console.log('Binaries not found')
}
```

**在 Electron 配置中使用 / Using in Electron Config:**
```javascript
import { getAdbPathWithDownload } from './electron/configs/android-platform-tools/index.js'
import { getScrcpyPathWithDownload } from './electron/configs/scrcpy/index.js'

// 获取 ADB 路径（自动下载）
const adbPath = await getAdbPathWithDownload()

// 获取 SCRCPY 路径（自动下载）
const scrcpyPath = await getScrcpyPathWithDownload()
```

---

## 工作流程 / Workflow

### 开发者首次使用 / First-Time Developer Setup

```bash
# 1. 克隆仓库
git clone <repo-url>
cd escrcpyup

# 2. Windows 用户
.\scripts\start.ps1
# 选择 "3. Initialize Environment"

# 2. macOS/Linux 用户
./scripts/start.sh
# 选择 "3. Initialize Environment"

# 3. 启动开发服务器
# 选择 "1. Start Development Server"
# 二进制文件会自动下载并配置
```

### 构建时自动下载 / Build-Time Download

```bash
# Windows
.\scripts\download-binaries.ps1

# macOS/Linux
./scripts/download-binaries.sh

# 下载所有平台的二进制文件（带进度显示）
# - Windows (win)
# - macOS x64 (mac-x64)
# - macOS ARM64 (mac-arm64)
# - Linux x64 (linux-x64)
# - Linux ARM64 (linux-arm64)
```

### 下载进度显示 / Download Progress Display

所有下载脚本都会显示实时下载进度：

- **PowerShell**: 使用 BITS (Background Intelligent Transfer Service) 显示进度条
- **Bash**: 使用 curl/wget 的原生进度条
- **Node.js**: 显示自定义进度条，包括百分比、下载速度和大小

示例输出：
```
[INFO] ████████████████░░░░░░░░░░░░░░ 53.21% | 15.32 MB / 28.80 MB | 2.45 MB/s
```

---

## 下载内容 / What Gets Downloaded

### Android Platform Tools (ADB)
- **来源 / Source**: Google Android SDK
- **包含 / Includes**:
  - Windows: `adb.exe`, `AdbWinApi.dll`, `AdbWinUsbApi.dll`
  - macOS/Linux: `adb` (executable)

### SCRCPY
- **来源 / Source**: GitHub (genymobile/scrcpy)
- **版本 / Version**: Latest release
- **包含 / Includes**:
  - Windows: `scrcpy.exe`, `scrcpy-server`, DLLs
  - macOS/Linux: `scrcpy` (executable), `scrcpy-server`

---

## 下载位置 / Download Locations

所有二进制文件下载到以下目录：

All binaries are downloaded to:

```
electron/resources/extra/
├── win/scrcpy/              # Windows binaries
│   ├── adb.exe
│   ├── AdbWinApi.dll
│   ├── AdbWinUsbApi.dll
│   ├── scrcpy.exe
│   └── scrcpy-server
├── mac-x64/scrcpy/          # macOS x64 binaries
│   ├── adb
│   ├── scrcpy
│   └── scrcpy-server
├── mac-arm64/scrcpy/        # macOS ARM64 binaries
│   ├── adb
│   ├── scrcpy
│   └── scrcpy-server
├── linux-x64/scrcpy/        # Linux x64 binaries
│   ├── adb
│   ├── scrcpy
│   └── scrcpy-server
└── linux-arm64/scrcpy/      # Linux ARM64 binaries
    ├── adb
    ├── scrcpy
    └── scrcpy-server
```

---

## 脚本说明 / Script Descriptions

### `download-binaries.ps1` / `download-binaries.sh`
自动从官方源下载最新的 ADB 和 SCRCPY 二进制文件，带实时进度显示。

Automatically downloads the latest ADB and SCRCPY binaries from official sources with real-time progress display.

**参数 / Parameters:**
- `win` - 仅下载 Windows 版本
- `mac-x64` - 仅下载 macOS x64 版本
- `mac-arm64` - 仅下载 macOS ARM64 版本
- `linux-x64` - 仅下载 Linux x64 版本
- `linux-arm64` - 仅下载 Linux ARM64 版本
- `auto` (默认) - 下载所有平台版本

**特性 / Features:**
- ✅ 实时进度条显示
- ✅ 下载速度显示
- ✅ 文件大小显示
- ✅ 自动解压和安装
- ✅ 错误处理和重试

### `electron/helpers/download-binaries.js`
Node.js 模块，提供运行时自动下载功能。

Node.js module providing runtime auto-download functionality.

**导出函数 / Exported Functions:**
- `downloadBinaries(platform)` - 下载指定平台的二进制文件（带进度显示）
- `ensureBinaries(platform)` - 确保二进制文件存在（不存在则下载）
- `checkBinariesExist(platform)` - 检查二进制文件是否存在

**进度显示 / Progress Display:**
```javascript
// 下载时会显示进度条
[INFO] ████████████████░░░░░░░░░░░░░░ 53.21% | 15.32 MB / 28.80 MB | 2.45 MB/s
```

---

## 常见问题 / FAQ

### 1. 如何仅下载当前平台的二进制文件？

**Windows:**
```powershell
.\scripts\download-binaries.ps1 -Platform win
```

**macOS (x64):**
```bash
./scripts/download-binaries.sh mac-x64
```

**macOS (ARM64):**
```bash
./scripts/download-binaries.sh mac-arm64
```

**Linux (x64):**
```bash
./scripts/download-binaries.sh linux-x64
```

### 2. 下载失败怎么办？

检查网络连接并重试：
```bash
# Windows
.\scripts\download-binaries.ps1

# macOS/Linux
./scripts/download-binaries.sh
```

如果仍然失败，手动下载：
- ADB: https://developer.android.com/tools/releases/platform-tools
- SCRCPY: https://github.com/Genymobile/scrcpy/releases

### 3. 如何更新到最新版本？

重新运行下载脚本：
```bash
# Windows
.\scripts\download-binaries.ps1

# macOS/Linux
./scripts/download-binaries.sh
```

### 4. 下载的文件在哪里？

临时下载目录：
- Windows: `%TEMP%\escrcpy-downloads`
- macOS/Linux: `/tmp/escrcpy-downloads`

最终安装目录：`electron/resources/extra/`

### 5. 如何验证下载是否成功？

检查文件是否存在：
```bash
# Windows
dir electron\resources\extra\win\scrcpy\

# macOS/Linux
ls -la electron/resources/extra/mac-*/scrcpy/
```

或使用 Node.js 检查：
```javascript
import { checkBinariesExist } from './electron/helpers/download-binaries.js'
console.log(checkBinariesExist()) // true or false
```

---

## 系统要求 / System Requirements

### Windows
- PowerShell 5.0+
- 网络连接

### macOS/Linux
- Bash
- `curl` 或 `wget`
- `unzip`
- 网络连接

---

## 故障排查 / Troubleshooting

### Windows: PowerShell 执行策略错误

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Unix: 脚本没有执行权限

```bash
chmod +x scripts/*.sh
```

### 下载超时

增加超时时间或使用代理：
```bash
# 设置代理
export HTTP_PROXY=http://proxy:port
export HTTPS_PROXY=http://proxy:port

# 重新下载
./scripts/download-binaries.sh
```

### unzip 命令不存在 (Linux)

```bash
# Debian/Ubuntu
sudo apt-get install unzip

# CentOS/RHEL
sudo yum install unzip

# Arch
sudo pacman -S unzip
```

---

## 贡献 / Contributing

如果发现问题或有改进建议，请提交 Issue 或 Pull Request。

If you find issues or have suggestions, please submit an Issue or Pull Request.

---

## 许可证 / License

与项目主许可证相同。

Same as the main project license.

---

**祝你使用愉快！/ Happy Coding!**
