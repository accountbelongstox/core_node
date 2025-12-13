# Cross-Platform Setup Scripts - Completion Report

## Completion Date
2025-12-13

## Overview

Completed Windows and Linux/macOS platform one-click installation scripts with platform-specific handling and automatic retry logic for build failures.

---

## Script Files

### 1. Windows Script
**File**: `scripts/start.ps1`
**Status**: ✅ Completed with retry logic

**Features**:
- [x] Dependency checking (Node.js >= 18.19.0, pnpm)
- [x] Chrome/Chromium detection (Windows paths)
- [x] Automatic dependency installation
- [x] Build all components (shared → native → extension)
- [x] **Retry logic for build failures** (2-3 retries per component)
- [x] Register local development version (uses `scripts/register-local-dev.cjs`)
- [x] Verify registration (check manifest files and registry)
- [x] Detailed setup instructions
- [x] Extension ID verification steps
- [x] MCP client configuration examples
- [x] Windows-specific notes
- [x] Comprehensive troubleshooting guide

**Windows-Specific Handling**:
```powershell
# Registry paths
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost

# Manifest file path
%APPDATA%\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json

# Startup script
run_host.bat
```

**New Features**:
- **Automatic retry logic**: Each build step retries 2-3 times on failure
- **Better error handling**: Clear error messages with actionable solutions
- **EPERM workaround**: Suggests closing Node.js processes if permission errors occur

### 2. Linux/macOS Script
**File**: `scripts/start.sh`
**Status**: ✅ Completed with retry logic

**Features**:
- [x] Dependency checking (Node.js >= 18.19.0, pnpm)
- [x] Chrome/Chromium detection (Linux/macOS paths)
- [x] Automatic dependency installation
- [x] Build all components (shared → native → extension)
- [x] **Retry logic for build failures** (2-3 retries per component)
- [x] Register local development version (uses `scripts/register-local-dev.cjs`)
- [x] Automatic execution permissions (chmod +x)
- [x] Verify registration (check manifest files)
- [x] Detailed setup instructions
- [x] Extension ID verification steps
- [x] MCP client configuration examples
- [x] Linux/macOS-specific notes
- [x] Comprehensive troubleshooting guide

**Linux-Specific Handling**:
```bash
# Manifest file path
~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json

# Startup script
run_host.sh (automatically set 755 permissions)
```

**macOS-Specific Handling**:
```bash
# Manifest file path
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json

# Startup script
run_host.sh (automatically set 755 permissions)
```

**New Features**:
- **Automatic retry logic**: Each build step retries 2-3 times on failure
- **Better error handling**: Clear error messages with actionable solutions
- **WASM build workaround**: Automatically retries if WASM file errors occur

---

## Platform Differences Summary

### Path Mapping

| Platform | Chrome Manifest Path | Chromium Manifest Path |
|----------|---------------------|----------------------|
| **Windows** | `%APPDATA%\Google\Chrome\NativeMessagingHosts\` | `%APPDATA%\Chromium\NativeMessagingHosts\` |
| **Linux** | `~/.config/google-chrome/NativeMessagingHosts/` | `~/.config/chromium/NativeMessagingHosts/` |
| **macOS** | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` | `~/Library/Application Support/Chromium/NativeMessagingHosts/` |

### Registration Mechanism

| Platform | Registration Method | Additional Steps |
|----------|-------------------|------------------|
| **Windows** | File + Registry | Creates registry keys in HKCU |
| **Linux** | File only | Requires execution permissions (chmod +x) |
| **macOS** | File only | Requires execution permissions (chmod +x) |

### Startup Scripts

| Platform | Script File | Characteristics |
|----------|-----------|-----------------|
| **Windows** | `run_host.bat` | Batch file |
| **Linux/macOS** | `run_host.sh` | Shell script, requires execute permissions |

### Browser Detection

| Platform | Chrome Detection | Chromium Detection |
|----------|-----------------|-------------------|
| **Windows** | `C:\Program Files\Google\Chrome\Application\chrome.exe` | `C:\Program Files\Chromium\Application\chrome.exe` |
| **Linux** | `google-chrome` or `google-chrome-stable` command | `chromium` or `chromium-browser` command |
| **macOS** | `/Applications/Google Chrome.app` | `/Applications/Chromium.app` |

---

## Usage

### Windows

```powershell
# Run in project root directory
cd D:\programing\core_node\apps\mcp-chrome
.\scripts\start.ps1
```

### Linux

```bash
# Run in project root directory
cd /path/to/core_node/apps/mcp-chrome
bash scripts/start.sh

# Or execute directly (if execute permissions set)
./scripts/start.sh
```

### macOS

```bash
# Run in project root directory
cd /path/to/core_node/apps/mcp-chrome
bash scripts/start.sh

# Or execute directly (if execute permissions set)
./scripts/start.sh
```

---

## Installation Steps (All Platforms)

Both scripts execute the same 6 steps:

1. **[1/6] Check Dependencies** - Verify Node.js and pnpm
2. **[2/6] Install Dependencies** - Run `pnpm install`
3. **[3/6] Build Shared Package** - Build shared code
4. **[4/6] Build Native Server** - Build backend service
5. **[5/6] Build Chrome Extension** - Build browser extension (with 3 retries)
6. **[6/6] Register Native Messaging Host** - Register local development version

---

## Script Output

Both scripts provide the following information:

### ✅ Build Complete Notification
- Important file paths
- Chrome Extension output directory
- Native Server distribution directory
- MCP STDIO Server path

### 📋 Next Steps
1. **Load Extension** - Detailed chrome://extensions setup instructions
2. **Verify Extension ID** - ID matching check and update instructions
3. **Start MCP Service** - Connect button and port information

### 🔧 MCP Client Configuration
- **Streamable HTTP** (Recommended) - Claude Desktop, CherryStudio
- **STDIO** (Alternative) - Cursor, older clients

### 🛠️ Development Commands
- Watch mode commands
- Rebuild commands
- Register/unregister commands

### 💡 Platform-Specific Notes
- Windows: Registry, manifest location, startup script
- Linux: Manifest location, permissions, startup script
- macOS: Manifest location, permissions, startup script

### 🔍 Troubleshooting
- Connection issues
- Port conflicts
- Build issues (EPERM, WASM errors)
- Permission issues (Linux/macOS)
- Documentation links

---

## Related Files

### Core Scripts
- ✅ `scripts/start.ps1` - Windows installation script with retry logic
- ✅ `scripts/start.sh` - Linux/macOS installation script with retry logic
- ✅ `scripts/register-local-dev.cjs` - Cross-platform local registration script
- ✅ `scripts/unregister-local-dev.cjs` - Cross-platform unregistration script

### Documentation
- ✅ `LOCAL_DEVELOPMENT_GUIDE.md` - Detailed local development guide
- ✅ `CONFIGURATION_CHECKLIST.md` - Configuration consistency checklist
- ✅ `CROSS_PLATFORM_SETUP_COMPLETE.md` - This document

### Configuration
- ✅ `package.json` - Added convenience scripts
  - `pnpm run build:all` - Build all components
  - `pnpm run register:local` - Register local version
  - `pnpm run unregister:local` - Unregister local version
  - `pnpm run setup:local` - One-click build and register

---

## Verification Checklist

### Windows
- [x] Script runs without errors
- [x] Detects Chrome installation
- [x] Detects Chromium installation
- [x] Creates registry entries
- [x] Creates manifest file
- [x] Verifies run_host.bat exists
- [x] Provides detailed next steps
- [x] Provides troubleshooting guide
- [x] Retry logic works for build failures

### Linux
- [x] Script runs without errors
- [x] Detects Chrome installation (google-chrome command)
- [x] Detects Chromium installation (chromium command)
- [x] Creates manifest file
- [x] Sets script execution permissions (chmod +x)
- [x] Verifies run_host.sh exists
- [x] Provides detailed next steps
- [x] Provides troubleshooting guide
- [x] Retry logic works for build failures

### macOS
- [x] Script compatible with macOS
- [x] Detects Chrome installation (/Applications/Google Chrome.app)
- [x] Detects Chromium installation (/Applications/Chromium.app)
- [x] Creates manifest file (macOS path)
- [x] Sets script execution permissions
- [x] Verifies run_host.sh exists
- [x] Provides macOS-specific notes
- [x] Retry logic works for build failures

---

## Known Issues & Solutions

### Issue 1: EPERM Permission Error (Windows)
**Symptom**: `EPERM, Permission denied` when cleaning dist folder

**Solution**:
- Error is non-blocking, build continues
- To prevent: Close all Node.js processes before running script
- Command: `taskkill /F /IM node.exe`

### Issue 2: WASM File Not Found (Chrome Extension)
**Symptom**: `ENOENT: no such file or directory, stat '...simd_math_bg.wasm'`

**Solution**:
- Timing issue during first build
- Script automatically retries up to 3 times
- Usually succeeds on second attempt

### Issue 3: pnpm Update Notice
**Symptom**: Warning about newer pnpm version available

**Solution**:
- Non-blocking informational message
- Optional: Run `pnpm self-update` to update

---

## Next Steps

Users can now:

1. **Windows Users**: Run `.\scripts\start.ps1`
2. **Linux/macOS Users**: Run `bash scripts/start.sh`
3. Follow script output steps to complete setup
4. Load Chrome Extension
5. Verify Extension ID matches
6. Start using local development version

---

## Technical Highlights

### Cross-Platform Compatibility
- Same Node.js registration script (`register-local-dev.cjs`) supports all platforms
- Automatically detects OS and uses correct paths
- Platform-specific startup scripts (Windows: .bat, Unix: .sh)

### Robust Error Handling
- **Automatic retry logic**: 2-3 retries per build step
- Each step has error checking
- Clear error messages with actionable solutions
- Exit codes for CI/CD integration
- Failure suggestions provided

### User Experience
- Colored output (Windows: PowerShell, Linux/macOS: ANSI)
- Progress indicators ([1/6], [2/6], ...)
- Detailed verification and confirmation messages
- Complete next steps guide
- All text in English

### Development Friendly
- Supports watch mode (development mode)
- Quick re-registration commands
- Detailed troubleshooting guide
- Complete documentation

---

**Last Updated**: 2025-12-13
**Status**: ✅ Complete

Cross-platform installation scripts completed for Windows, Linux, and macOS with platform-specific handling and automatic retry logic for build failures.
