# Scrcpy Package Setup - 自动解压方案

## 概述

为了防止 GitHub 仓库体积过大，我们将 scrcpy 工具包改为自动解压方案：

1. 将 scrcpy ZIP 包重命名为 `.pyp` 扩展名存放在项目中
2. `.pyp` 文件被 `.gitignore` 忽略，不会提交到 GitHub
3. 首次使用时自动解压到用户数据目录
4. 所有 ADB 和 scrcpy 调用使用绝对路径

---

## 实施方案

### 1. 包文件位置

```
pyapps/matrix/resources/scrcpy-win64-v3.3.3.pyp  (6.95 MB)
```

- 原始文件：`scrcpy-win64-v3.3.3.zip`
- 重命名为 `.pyp` 后缀（Python Package）
- 包含 adb.exe、scrcpy.exe 及相关库文件

### 2. 用户数据目录

解压目标目录（按操作系统）：

- **Windows**: `C:\Users\<username>\.core_node\scrcpy`
- **Linux**: `/var/_core_node/scrcpy` (无权限时回退到 `~/.core_node/scrcpy`)
- **macOS**: `~/.core_node/scrcpy`

### 3. 自动初始化模块

**文件**: `pycore/pyutils/scrcpy_init.py`

**功能**:
- 检测操作系统和用户数据目录
- 检查 scrcpy 是否已解压
- 自动解压 `.pyp` 包到用户数据目录
- 设置可执行权限（Linux/macOS）
- 返回 adb 和 scrcpy 的绝对路径

**核心类**: `ScrcpyInitializer`

**便捷函数**:
```python
from pycore.pyutils.scrcpy_init import initialize_scrcpy, get_adb_path, get_scrcpy_path

# 初始化（首次使用自动解压）
initialize_scrcpy()

# 获取 ADB 路径
adb_path = get_adb_path()  # Path 对象

# 获取 scrcpy 路径
scrcpy_path = get_scrcpy_path()  # Path 对象
```

### 4. Config 集成

**文件**: `pyapps/matrix/matrix_config/config.py`

**修改内容**:
```python
@staticmethod
def get_adb_path() -> str:
    """
    Get ADB executable path

    Priority:
    1. User data directory (from scrcpy_init.py)  # 新增
    2. System PATH adb
    3. Return "adb" (fallback)
    """
    from pycore.pyutils.scrcpy_init import get_adb_path as get_init_adb_path

    # 1. Try to get from user data directory (auto-extracts if needed)
    try:
        adb_path = get_init_adb_path()
        if adb_path and adb_path.exists():
            return str(adb_path)
    except Exception as e:
        print(f"[Config] Warning: Failed to get ADB from scrcpy_init: {e}")

    # 2. Check system PATH
    # ... (fallback logic)
```

### 5. .gitignore 规则

**文件**: `.gitignore`

**新增规则**:
```gitignore
# Python Package files (.pyp) - Large bundled packages (e.g., scrcpy)
# These are renamed .zip files to prevent git upload, auto-extracted on first use
**/*.pyp
```

---

## 使用方式

### 方式 1: 自动（推荐）

Matrix 启动时会自动调用 `Config.get_adb_path()`，首次使用自动解压。

```python
from pyapps.matrix.matrix_config import Config

# 自动初始化并返回路径
adb_path = Config.get_adb_path()
```

### 方式 2: 手动初始化

```python
from pycore.pyutils.scrcpy_init import get_initializer

initializer = get_initializer()

# 检查是否已初始化
if not initializer.is_initialized():
    print("正在初始化 scrcpy...")
    initializer.initialize()

# 获取所有路径
paths = initializer.get_paths()
print(f"ADB: {paths['adb']}")
print(f"Scrcpy: {paths['scrcpy']}")
print(f"Scrcpy Dir: {paths['scrcpy_dir']}")
```

### 方式 3: 命令行测试

```bash
# 测试初始化
python pycore/pyutils/scrcpy_init.py

# 测试 Config 集成
python pyapps/matrix/show_scrcpy_command_en.py
```

---

## 初始化流程

```
[Matrix 启动]
     ↓
[Config.get_adb_path()]
     ↓
[scrcpy_init.get_adb_path()]
     ↓
[检查是否已初始化] ─ 是 → 返回路径
     ↓ 否
[查找 .pyp 包]
     ↓
[解压到用户数据目录]
     ↓
[设置可执行权限 (Linux/macOS)]
     ↓
[返回 ADB 绝对路径]
```

---

## 优势

1. **即开即用**: `.pyp` 包包含在仓库中，克隆后即可使用
2. **用户隔离**: 每个用户有独立的工具副本
3. **自动化**: 无需手动配置，首次使用自动初始化
4. **绝对路径**: 所有调用使用绝对路径，避免 PATH 冲突
5. **跨平台**: 支持 Windows、Linux、macOS

---

## 故障排查

### 问题 1: 初始化失败

**症状**:
```
[ScrcpyInit] ERROR: No scrcpy package found in resources
```

**解决**:
- 确认 `pyapps/matrix/resources/scrcpy-win64-v3.3.3.pyp` 存在
- 文件大小约 6.95 MB
- 如果文件不存在，从官方下载：
  - 下载地址: https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-win64-v3.3.3.zip
  - 重命名为 `scrcpy-win64-v3.3.3.pyp`
  - 放置到 `pyapps/matrix/resources/` 目录

### 问题 2: 权限不足 (Linux)

**症状**:
```
PermissionError: [Errno 13] Permission denied: '/var/_core_node'
```

**解决**:
- 自动回退到 `~/.core_node/scrcpy`
- 或手动创建 `/var/_core_node` 并设置权限：
  ```bash
  sudo mkdir -p /var/_core_node
  sudo chown $USER:$USER /var/_core_node
  ```

### 问题 3: ADB 版本不匹配

**症状**:
```
adb server version (xx) doesn't match this client (yy)
```

**解决**:
```bash
# 杀掉旧的 ADB 服务器
adb kill-server

# 使用新路径启动
~/.core_node/scrcpy/adb start-server
```

### 问题 4: 重新初始化

如需强制重新解压：

```bash
# Windows
rmdir /s /q C:\Users\<username>\.core_node\scrcpy

# Linux/macOS
rm -rf ~/.core_node/scrcpy

# 重新运行初始化
python pycore/pyutils/scrcpy_init.py
```

---

## 更新 Scrcpy 版本

1. 下载新版本的 scrcpy
2. 解压并重新打包为 ZIP
3. 重命名为 `.pyp` 后缀
4. 替换 `pyapps/matrix/resources/scrcpy-win64-v*.pyp`
5. 更新版本号：
   - `pycore/pyutils/scrcpy_init.py` - glob 模式
   - `pyapps/matrix/matrix_config/config.py` - SCRCPY_SERVER_VERSION
6. 删除用户数据目录强制重新解压

---

## 相关文件

- `pycore/pyutils/scrcpy_init.py` - 初始化模块
- `pyapps/matrix/matrix_config/config.py` - Config 配置
- `pyapps/matrix/resources/scrcpy-win64-v3.3.3.pyp` - scrcpy 包
- `pyapps/matrix/resources/README.md` - 资源说明
- `pyapps/matrix/docs/SCRCPY_INITIALIZATION.md` - 初始化流程详解
- `.gitignore` - Git 忽略规则

---

**文档版本**: 1.0
**更新日期**: 2025-12-08
**Scrcpy 版本**: 3.3.3
