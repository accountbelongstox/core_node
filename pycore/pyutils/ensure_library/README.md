# Ensure Library Module

自动检测、下载和安装第三方系统库（FFmpeg 等）。

## 特性

- ✅ 跨平台支持 (Windows/Linux)
- ✅ 自动检测已安装库
- ✅ 自动下载和安装
- ✅ 遵循项目规范（无 try-except）
- ✅ 使用项目标准工具（Commander、ColorPrint）

## Installation位置

### FFmpeg 安装目录

使用 `compile_dir` 命名空间，确保不污染根目录：

#### Windows
```
D:\_win10\ffmpeg\        (Windows 10)
D:\_win11\ffmpeg\        (Windows 11)
```

#### Linux
```
/mnt/d/_ubuntu24/ffmpeg/     (Ubuntu 24)
/mnt/d/_debian12/ffmpeg/     (Debian 12)
/_ubuntu24/ffmpeg/           (服务器模式，无挂载盘)
```

## Usage

### 基础用法

```python
from pycore.pyutils.ensure_library import ensure_ffmpeg

# 自动检测并安装 FFmpeg
ffmpeg_path = ensure_ffmpeg(auto_install=True)

if ffmpeg_path:
    print(f"FFmpeg 可用: {ffmpeg_path}")
else:
    print("FFmpeg 不可用")
```

### 集成到应用

```python
# 在应用启动时检查多媒体环境
from pyapps.matrix.matrix_config.multimedia_check import check_multimedia_environment

def start():
    # 检查 FFmpeg（在应用启动早期）
    check_multimedia_environment()

    # 继续应用启动流程
    ...
```

### 获取 FFmpeg 详细信息

```python
from pycore.pyutils.ensure_library.ffmpeg_installer import get_ffmpeg_info

ffmpeg_path = ensure_ffmpeg()
if ffmpeg_path:
    info = get_ffmpeg_info(ffmpeg_path)
    print(f"版本: {info['version']}")
    print(f"编解码器: {len(info['codecs'])} 个")
    print(f"格式: {len(info['formats'])} 个")
```

## 检测逻辑

### 1. 检查 PATH

首先检查系统 PATH 中是否有 FFmpeg：

```python
ffmpeg_path = check_ffmpeg_in_path()
```

### 2. 检查托管安装目录

然后检查项目托管的安装目录：

```python
ffmpeg_path = check_ffmpeg_in_install_dir()
```

### 3. 自动安装

如果未找到且 `auto_install=True`，则自动下载安装：

- **Windows**: 从 gyan.dev 下载 essentials 版本
- **Linux**: 使用 apt-get 安装
- **macOS**: 提示使用 Homebrew 手动安装

## Windows 安装流程

1. 从 gyan.dev 下载 FFmpeg essentials 7z 包
2. 使用 7-Zip 解压到 `D:\_win10\ffmpeg\`
3. 递归搜索 `ffmpeg.exe`
4. 验证可执行
5. 清理下载的压缩包

## Linux 安装流程

1. 更新包列表 (`apt-get update`)
2. 安装 FFmpeg (`apt-get install -y ffmpeg`)
3. 验证安装
4. 返回可执行路径

## 依赖要求

### Windows
- **7-Zip**: 用于解压 .7z 文件
  - 自动检测常见安装位置
  - 未找到时提示安装: `winget install 7zip.7zip`

### Linux
- **sudo 权限**: 需要执行 apt-get
- **网络连接**: 下载包

## 项目规范遵循

### ✅ 不使用 try-except

```python
# ❌ 错误做法
try:
    import ffmpeg
except ImportError:
    pass

# ✅ 正确做法 - 使用 Commander 检查命令
result = Commander.exec_silent(['ffmpeg', '-version'])
if result.success:
    # FFmpeg 可用
    pass
```

### ✅ 使用项目标准工具

```python
# 使用 ColorPrint 输出
ColorPrint.blue("[FFmpegInstaller] 开始安装...")
ColorPrint.green("[FFmpegInstaller] ✓ 安装完成")

# 使用 Commander 执行命令
result = Commander.exec_realtime(cmd, info=True, show_output=True)

# 使用 map_web_path 获取路径
install_dir = map_web_path("compile_dir", "ffmpeg")
```

### ✅ 使用第三方包管理

```python
# 使用 lazy loader 导入 requests
from pycore.pyfoundations.third_party import get_third_package_requests
requests = get_third_package_requests()
```

## 测试

运行测试脚本：

```bash
python pycore\pyutils\ensure_library\test_ensure_library.py
```

测试内容：
1. 平台检测
2. PATH 中查找 FFmpeg
3. 安装目录查找 FFmpeg
4. 获取 FFmpeg 信息
5. 自动安装测试（需用户确认）

## 故障排查

### Windows

#### 问题：7-Zip 未找到
```
[FFmpegInstaller] ✗ 7-Zip not found
```

**解决方案**:
```powershell
winget install 7zip.7zip
```

#### 问题：下载失败
```
[FFmpegInstaller] ✗ Download failed with status: 404
```

**解决方案**:
- 检查网络连接
- 尝试手动访问下载链接
- 等待一段时间后重试（可能是临时网络问题）

### Linux

#### 问题：需要 sudo 权限
```
[FFmpegInstaller] ✗ FFmpeg installation failed
```

**解决方案**:
```bash
# 确保有 sudo 权限
sudo apt-get update
sudo apt-get install -y ffmpeg
```

#### 问题：包管理器不是 apt
```
[FFmpegInstaller] ✗ Unsupported platform
```

**解决方案**:
```bash
# Fedora/CentOS
sudo dnf install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

## 扩展支持

### 添加新的库支持

1. 在 `ensure_library` 目录创建新文件：
   ```
   pycore/pyutils/ensure_library/
   ├── __init__.py
   ├── ffmpeg_installer.py      # 已有
   └── your_library_installer.py # 新增
   ```

2. 实现 `ensure_your_library()` 函数：
   ```python
   def ensure_your_library(auto_install=True):
       """确保库可用"""
       # 1. 检查 PATH
       # 2. 检查安装目录
       # 3. 自动安装
       pass
   ```

3. 在 `__init__.py` 中导出：
   ```python
   from pycore.pyutils.ensure_library.your_library_installer import ensure_your_library

   __all__ = [
       'ensure_ffmpeg',
       'ensure_your_library',  # 新增
   ]
   ```

## 参考资料

- [FFmpeg 官方网站](https://ffmpeg.org/)
- [FFmpeg Windows 构建 (gyan.dev)](https://www.gyan.dev/ffmpeg/builds/)
- [项目 Python 开发规范](../../../development-guides/PYTHON_PYCORE.md)
