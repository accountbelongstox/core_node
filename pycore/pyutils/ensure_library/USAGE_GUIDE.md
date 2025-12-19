# Ensure Library 模块使用指南

## 📋 概述

`ensure_library` 模块已创建完成，用于自动管理第三方系统库（如 FFmpeg）。

## 📦 已创建的文件

```
pycore/pyutils/ensure_library/
├── __init__.py                  # 模块导出
├── ffmpeg_installer.py          # FFmpeg 安装器核心逻辑
├── test_ensure_library.py       # 测试脚本
└── README.md                    # 详细文档

pyapps/matrix/matrix_config/
└── multimedia_check.py          # Matrix 应用集成示例
```

## ✅ 已完成的功能

### 1. FFmpeg 自动检测和安装

- ✅ 跨平台支持（Windows/Linux/macOS）
- ✅ 自动检测 PATH 中的 FFmpeg
- ✅ 检查项目托管安装目录
- ✅ Windows：自动下载并解压 essentials 构建
- ✅ Linux：使用 apt-get 自动安装
- ✅ 遵循项目规范（无 try-except，使用 Commander/ColorPrint）

### 2. 安装位置规范

使用 `compile_dir` 命名空间：

```
Windows:  D:\_win10\ffmpeg\  或  D:\_win11\ffmpeg\
Linux:    /mnt/d/_ubuntu24/ffmpeg/  或  /_ubuntu24/ffmpeg/
```

### 3. Matrix 应用集成

在 `matrix_main.py` 的 `start()` 函数中已添加 FFmpeg 检查：

```python
def start():
    # Check multimedia environment (FFmpeg) FIRST
    from pyapps.matrix.matrix_config.multimedia_check import check_multimedia_environment
    check_multimedia_environment()

    # 继续应用启动...
```

## 🚀 使用方法

### 方法 1：在应用中使用（推荐）

```python
from pycore.pyutils.ensure_library import ensure_ffmpeg

# 在应用启动时检查
ffmpeg_path = ensure_ffmpeg(auto_install=True)

if ffmpeg_path:
    print(f"✓ FFmpeg 可用: {ffmpeg_path}")
else:
    print("✗ FFmpeg 不可用，请手动安装")
```

### 方法 2：独立测试

```bash
# 运行测试脚本
python pycore\pyutils\ensure_library\test_ensure_library.py
```

### 方法 3：手动调用安装

```python
from pycore.pyutils.ensure_library.ffmpeg_installer import (
    check_ffmpeg_in_path,
    check_ffmpeg_in_install_dir,
    install_ffmpeg_windows,
    install_ffmpeg_linux,
)

# 仅检查不安装
ffmpeg_path = check_ffmpeg_in_path()

# 手动触发安装
if platform.system() == 'Windows':
    ffmpeg_path = install_ffmpeg_windows()
```

## 🔧 Windows 依赖

### 必需：7-Zip

FFmpeg 的 essentials 构建使用 .7z 格式压缩，需要 7-Zip 解压。

**自动检测位置：**
- `C:\Program Files\7-Zip\7z.exe`
- `C:\Program Files (x86)\7-Zip\7z.exe`
- PATH 中的 `7z` 或 `7za`

**安装 7-Zip：**
```powershell
winget install 7zip.7zip
```

## 📝 关于 H.264 编解码器问题

### 问题分析

你看到的 `[CodecDiagnostic] ✗ No proprietary codec libraries found` 提示是关于 **PySide6 QtWebEngine** 的编解码器支持，而不是 FFmpeg。

这是两个不同的问题：

1. **FFmpeg**: 用于后端视频处理（已解决，通过 ensure_library 模块）
2. **QtWebEngine**: 用于前端 WebView 中播放视频（需要其他方案）

### QtWebEngine 编解码器限制

PySide6 的 QtWebEngine 默认不包含 H.264 专有编解码器，因为：
- H.264 有专利许可要求
- Qt 官方分发版本不包含专有编解码器

### 解决方案

根据你的 Matrix 应用架构，你已经有三种可行方案：

#### ✅ 方案 1：后端软件解码（推荐）

```python
# 后端使用 FFmpeg 解码 H.264
# 发送 RGB/RGBA 帧到前端
# 前端用 Canvas 渲染
# 无需 QtWebEngine 编解码器支持
```

这是你当前应该使用的方案，因为：
- FFmpeg 可以解码任何格式
- 不依赖浏览器编解码器
- 更灵活可控

#### ✅ 方案 2：YUV420P 格式

```python
# 后端发送 YUV420P 原始帧
# 前端使用 WebGL shader 渲染
# 已在你的代码中实现
# ws://localhost:48000/video/yuv/{device_id}
```

#### ⚠️ 方案 3：重新编译 Qt（不推荐）

需要从源码编译 Qt WebEngine，包含 `-webengine-proprietary-codecs` 标志，非常复杂且耗时。

## 🎯 下一步操作

### 1. 测试 FFmpeg 安装

```bash
cd D:\programing\core_node
python pycore\pyutils\ensure_library\test_ensure_library.py
```

### 2. 运行 Matrix 应用

```bash
python pymain.py app=matrix
```

启动时会自动：
1. 检查 FFmpeg 是否在 PATH
2. 检查项目托管目录
3. 如未找到，提示安装或自动下载

### 3. 验证 FFmpeg 可用

应用启动后会看到：

```
[FFmpegInstaller] Checking if FFmpeg is in PATH...
[FFmpegInstaller] ✓ FFmpeg found in PATH: C:\path\to\ffmpeg.exe
[FFmpegInstaller] ✓ ffmpeg version ...
[Matrix] ✓ Multimedia environment ready
```

## 📚 相关文档

- 详细文档: `pycore/pyutils/ensure_library/README.md`
- 测试脚本: `pycore/pyutils/ensure_library/test_ensure_library.py`
- Matrix 集成: `pyapps/matrix/matrix_config/multimedia_check.py`

## ⚙️ 配置选项

### 禁用自动安装

```python
# 仅检查，不自动安装
ffmpeg_path = ensure_ffmpeg(auto_install=False)
```

### 自定义安装目录

当前使用 `map_web_path("compile_dir", "ffmpeg")`，你可以修改：

```python
# 在 ffmpeg_installer.py 中
FFMPEG_INSTALL_DIR = map_web_path("custom_key", "ffmpeg")
```

## 🐛 故障排查

### Windows: 7-Zip 未找到

```
[FFmpegInstaller] ✗ 7-Zip not found
```

**解决**:
```powershell
winget install 7zip.7zip
```

### Linux: 权限不足

```
[FFmpegInstaller] ✗ FFmpeg installation failed
```

**解决**:
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

### 下载失败

```
[FFmpegInstaller] ✗ Download failed with status: 404
```

**解决**:
- 检查网络连接
- 使用备用 URL（自动尝试）
- 手动下载并放置到 `D:\_win10\ffmpeg\bin\`

## 💡 关键点总结

1. ✅ **FFmpeg 安装器已完成** - 支持 Windows/Linux 自动安装
2. ✅ **已集成到 Matrix** - 应用启动时自动检查
3. ✅ **遵循项目规范** - 无 try-except，使用标准工具
4. ✅ **命名空间隔离** - 安装到 `compile_dir/ffmpeg/`
5. ⚠️ **QtWebEngine 编解码器** - 这是独立问题，使用方案1或2解决

## 🎉 完成状态

| 功能 | 状态 | 说明 |
|------|------|------|
| FFmpeg 检测 | ✅ | PATH 和托管目录 |
| Windows 自动安装 | ✅ | 从 gyan.dev 下载 |
| Linux 自动安装 | ✅ | apt-get install |
| Matrix 集成 | ✅ | 启动时自动检查 |
| 测试脚本 | ✅ | 可独立运行 |
| 文档 | ✅ | README.md 完整 |
| 项目规范 | ✅ | 无 try-except |

所有功能已完成并可以使用！
