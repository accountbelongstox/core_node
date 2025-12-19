# Binary Files Management for Git

## 概述 / Overview

由于 Git 不适合直接提交大型二进制文件（.exe、.dll 等），本项目使用**备份复制方案**：

Because Git is not suitable for committing large binary files (.exe, .dll, etc.), this project uses a **backup copy solution**:

- **源文件**：`adb.exe`、`scrcpy.exe`、`*.dll` 等（被 `.gitignore` 忽略）
- **备份文件**：`adb.exe.py`、`scrcpy.exe.py`、`*.dll.py` 等（提交到 Git）

- **Source files**: `adb.exe`, `scrcpy.exe`, `*.dll`, etc. (ignored by `.gitignore`)
- **Backup files**: `adb.exe.py`, `scrcpy.exe.py`, `*.dll.py`, etc. (committed to Git)

## 工作原理 / How It Works

### 1. 备份阶段 (Backup Phase)

将所有二进制文件复制为 `.py` 扩展名：

Copy all binary files with `.py` extension:

```
adb.exe          → adb.exe.py
scrcpy.exe       → scrcpy.exe.py
AdbWinApi.dll    → AdbWinApi.dll.py
scrcpy-console.bat → scrcpy-console.bat.py
```

### 2. Git 提交 (Git Commit)

- ✅ `.gitignore` 忽略原始文件（`*.exe`, `*.dll`, `*.bat`, `*.vbs`）
- ✅ 允许提交备份文件（`*.exe.py`, `*.dll.py`, `*.bat.py`, `*.vbs.py`）

- ✅ `.gitignore` ignores original files (`*.exe`, `*.dll`, `*.bat`, `*.vbs`)
- ✅ Allows committing backup files (`*.exe.py`, `*.dll.py`, `*.bat.py`, `*.vbs.py`)

### 3. 恢复阶段 (Restore Phase)

启动应用前，自动从 `.py` 文件恢复原始二进制文件：

Before starting the app, automatically restore original binary files from `.py` files:

```
adb.exe.py       → adb.exe
scrcpy.exe.py    → scrcpy.exe
AdbWinApi.dll.py → AdbWinApi.dll
```

## 使用方法 / Usage

### 自动恢复 (Automatic Restore)

启动脚本会**自动恢复**二进制文件，无需手动操作：

The startup scripts **automatically restore** binary files, no manual action needed:

```bash
# Windows
.\scripts\start.ps1

# Unix/Linux/macOS
./scripts/start.sh
```

### 手动备份 (Manual Backup)

如果添加了新的二进制文件，手动创建备份：

If you add new binary files, manually create backups:

```bash
# Windows
.\scripts\prepare-binaries.ps1 -Action backup

# Unix/Linux/macOS
./scripts/prepare-binaries.sh backup
```

### 手动恢复 (Manual Restore)

如果需要手动恢复文件：

If you need to manually restore files:

```bash
# Windows
.\scripts\prepare-binaries.ps1 -Action restore

# Unix/Linux/macOS
./scripts/prepare-binaries.sh restore
```

## 处理的文件类型 / File Types Processed

### Windows
- `*.exe` - 可执行文件
- `*.dll` - 动态链接库
- `*.bat` - 批处理脚本
- `*.vbs` - VBScript 脚本

### macOS
- `adb`, `scrcpy` - 可执行文件（无扩展名）
- `*.dylib` - 动态库

### Linux
- `adb`, `scrcpy` - 可执行文件（无扩展名）
- `*.so` - 共享库

## 处理的目录 / Directories Processed

所有 `electron/resources/extra` 下的子目录：

All subdirectories under `electron/resources/extra`:

```
electron/resources/extra/
├── win/
│   ├── scrcpy/       ✓ (adb.exe, scrcpy.exe, *.dll, *.bat, *.vbs)
│   ├── gnirehtet/    ✓ (gnirehtet.exe)
│   └── vbs/          ✓ (*.vbs)
├── mac-x64/scrcpy/   ✓ (adb, scrcpy, scrcpy-server)
├── mac-arm64/scrcpy/ ✓ (adb, scrcpy, scrcpy-server)
├── linux-x64/scrcpy/ ✓ (adb, scrcpy, scrcpy-server)
└── linux-arm64/scrcpy/ ✓ (adb, scrcpy, scrcpy-server)
```

## Git 配置 / Git Configuration

`.gitignore` 配置规则：

`.gitignore` configuration:

```gitignore
# 忽略原始二进制文件 (Ignore original binaries)
electron/resources/extra/**/*.exe
electron/resources/extra/**/*.dll
electron/resources/extra/**/*.bat
electron/resources/extra/**/*.vbs
electron/resources/extra/**/*.so
electron/resources/extra/**/*.dylib

# 但保留 .py 备份 (But keep .py backups)
!electron/resources/extra/**/*.exe.py
!electron/resources/extra/**/*.dll.py
!electron/resources/extra/**/*.bat.py
!electron/resources/extra/**/*.vbs.py
!electron/resources/extra/**/*.so.py
!electron/resources/extra/**/*.dylib.py
```

## 工作流程 / Workflow

### 开发者工作流 (Developer Workflow)

1. **克隆仓库 (Clone repository)**
   ```bash
   git clone <repo-url>
   cd escrcpyup
   ```

2. **启动应用 (Start application)**
   ```bash
   .\scripts\start.ps1  # Windows
   # 或
   ./scripts/start.sh   # Unix/Linux/macOS
   ```
   → 自动恢复所有二进制文件 / Automatically restores all binaries

3. **应用正常运行 (App runs normally)**
   → 使用恢复的 `adb.exe`, `scrcpy.exe` 等 / Uses restored `adb.exe`, `scrcpy.exe`, etc.

### 添加新二进制文件 (Adding New Binary Files)

1. **添加文件到对应目录**
   ```
   electron/resources/extra/win/scrcpy/new-tool.exe
   ```

2. **运行备份脚本 (Run backup script)**
   ```bash
   .\scripts\prepare-binaries.ps1 -Action backup
   ```

3. **提交到 Git (Commit to Git)**
   ```bash
   git add electron/resources/extra/win/scrcpy/new-tool.exe.py
   git commit -m "Add new-tool.exe binary"
   ```

## 故障排查 / Troubleshooting

### 问题：应用启动时找不到 adb.exe
**Problem**: App can't find adb.exe on startup

**解决方案 (Solution)**:
```bash
# 手动恢复二进制文件
.\scripts\prepare-binaries.ps1 -Action restore
```

### 问题：Git 拒绝大文件提交
**Problem**: Git rejects large file commits

**检查 (Check)**:
```bash
# 确保提交的是 .py 文件，不是原始二进制
git status
# 应该看到 *.exe.py, *.dll.py
```

### 问题：备份脚本找不到文件
**Problem**: Backup script can't find files

**检查 (Check)**:
```bash
# 检查文件是否存在
ls electron/resources/extra/win/scrcpy/*.exe
# 检查备份文件
ls electron/resources/extra/win/scrcpy/*.exe.py
```

## 脚本文件 / Script Files

- **`scripts/prepare-binaries.ps1`** - PowerShell 备份/恢复脚本 (Windows)
- **`scripts/prepare-binaries.sh`** - Bash 备份/恢复脚本 (Unix/Linux/macOS)
- **`scripts/start.ps1`** - 集成了自动恢复的启动脚本 (Windows)
- **`scripts/start.sh`** - 集成了自动恢复的启动脚本 (Unix/Linux/macOS)

## 技术细节 / Technical Details

### 为什么用 .py 扩展名？
**Why use .py extension?**

- Git 将其识别为文本文件（即使内容是二进制）
- Git recognizes it as text file (even though content is binary)
- 避免触发 Git LFS 或大文件警告
- Avoids triggering Git LFS or large file warnings
- 扩展名足够特殊，不会与真实 Python 文件冲突
- Extension is unique enough to avoid conflicts with real Python files

### 性能影响 (Performance Impact)

- **备份操作**：~1-2 秒（26 个文件，~17MB）
- **Backup operation**: ~1-2 seconds (26 files, ~17MB)
- **恢复操作**：~1-2 秒（启动时自动执行）
- **Restore operation**: ~1-2 seconds (auto-executed on startup)
- **磁盘空间**：每个文件增加 2 倍（源文件 + .py 备份）
- **Disk space**: 2x per file (source + .py backup)

### 安全性 (Security)

- ✅ 文件内容完全相同（字节级复制）
- ✅ File content is identical (byte-level copy)
- ✅ 保留文件权限（Unix/Linux/macOS）
- ✅ Preserves file permissions (Unix/Linux/macOS)
- ✅ 不会损坏或修改二进制文件
- ✅ Does not corrupt or modify binary files

## 总结 / Summary

✅ **开发者无感**：启动脚本自动恢复，无需手动操作
✅ **Developer-friendly**: Startup scripts auto-restore, no manual action needed

✅ **Git 友好**：只提交 `.py` 备份，不提交大型二进制
✅ **Git-friendly**: Only commit `.py` backups, not large binaries

✅ **全自动化**：备份、恢复、Git 提交全流程自动化
✅ **Fully automated**: Backup, restore, Git commit fully automated

✅ **安全可靠**：字节级复制，文件内容完全一致
✅ **Safe and reliable**: Byte-level copy, file content identical

---

**如有问题，请查看脚本源码或联系开发团队**
**For issues, check script source code or contact development team**
