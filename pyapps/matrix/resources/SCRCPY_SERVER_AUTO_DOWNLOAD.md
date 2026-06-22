# SCRCPY-SERVER 自动下载功能 / Auto-Download Feature

## 概述 / Overview

scrcpy-server.jar 现在支持自动下载，无需手动准备。当视频流服务启动时，如果检测到文件缺失，会自动下载。

The scrcpy-server.jar file now supports automatic downloading. When the video streaming service starts, if the file is missing, it will be downloaded automatically.

---

## 功能特性 / Features

### ✅ 三层确保策略 / 3-Tier Ensure Strategy

1. **检查本地文件 / Check Local File**
   - 如果文件已存在，立即返回
   - If file exists, return immediately

2. **从 scrcpy_init 复制 / Copy from scrcpy_init**
   - 尝试从 `~/.core_node/scrcpy/` 复制已下载的文件
   - Try to copy from `~/.core_node/scrcpy/` if available

3. **从 GitHub 下载 / Download from GitHub**
   - 从官方 GitHub releases 下载 scrcpy-server v3.3.3
   - Download scrcpy-server v3.3.3 from official GitHub releases

### ✅ 实时下载进度显示 / Real-Time Progress Display

下载时会显示详细的实时进度信息：

Detailed real-time progress information during download:

```
[INFO] [==========================------------------------] 52.3% | 0.05/0.09 MB | 1.23 MB/s | ETA: 0s
```

**进度信息包括 / Progress Information Includes:**

- **进度条 / Progress Bar**: ASCII字符显示 (Windows兼容)
  - `=` 表示已下载部分 / Downloaded portion
  - `-` 表示未下载部分 / Remaining portion

- **百分比 / Percentage**: 下载完成百分比 (0.0% - 100.0%)

- **大小显示 / Size Display**: 已下载/总大小 (MB)
  - 格式: `0.05/0.09 MB`

- **下载速度 / Download Speed**: 实时计算的下载速度 (MB/s)
  - 基于实际下载时间计算

- **预计剩余时间 / ETA**: 估算的剩余下载时间
  - 格式: `1m 23s` 或 `45s`

### ✅ 自动集成 / Automatic Integration

已集成到视频流服务中：

Integrated into video streaming service:

- **H.264 直连流 / H.264 Direct Stream** (`start_stream`)
- **YUV 解码流 / YUV Decoded Stream** (`start_yuv_stream`)

---

## 使用方法 / Usage

### 自动模式 / Automatic Mode

**无需任何操作！** 当视频流启动时会自动检测和下载。

**No action needed!** Automatically detects and downloads when video stream starts.

### 手动测试 / Manual Testing

```bash
# 测试下载功能
python -m pyapps.matrix.matrix_config.scrcpy_server_downloader
```

### Python 代码中使用 / Use in Python Code

```python
from pathlib import Path
from pyapps.matrix.matrix_config.scrcpy_server_downloader import ensure_scrcpy_server_jar

# 确保 scrcpy-server.jar 可用
target_path = Path("path/to/scrcpy-server.jar")
success = ensure_scrcpy_server_jar(target_path, auto_download=True)

if success:
    print("✓ scrcpy-server.jar is ready")
else:
    print("✗ Failed to ensure scrcpy-server.jar")
```

---

## 技术细节 / Technical Details

### 下载源 / Download Source

- **GitHub**: https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-server-v3.3.3
- **版本 / Version**: 3.3.3 (与 scrcpy 客户端版本匹配)

### 下载位置 / Download Location

- **目标路径 / Target Path**: `pyapps/matrix/resources/scrcpy-server.jar`
- **临时文件 / Temp File**: `pyapps/matrix/resources/scrcpy-server.jar.tmp` (下载期间)

### 进度更新频率 / Progress Update Frequency

- **更新间隔 / Update Interval**: 0.1秒 (100ms)
- **数据块大小 / Chunk Size**: 8192 字节 (8 KB)

### Windows 兼容性 / Windows Compatibility

- ✅ **编码安全 / Encoding Safe**: 使用 ASCII 字符，避免 GBK 编码错误
- ✅ **实时刷新 / Real-Time Flush**: 使用 `sys.stdout.write()` 和 `flush()` 确保实时显示
- ✅ **覆盖输出 / Overwrite Output**: 使用 `\r` 字符在同一行更新进度

---

## 错误处理 / Error Handling

### 网络错误 / Network Errors

- 显示详细的错误信息
- 自动清理临时文件
- 返回明确的失败状态

### 文件系统错误 / Filesystem Errors

- 自动创建目标目录
- 使用临时文件防止下载中断导致文件损坏
- 下载完成后才重命名为最终文件

---

## 日志示例 / Log Example

### 成功从 scrcpy_init 复制 / Successful Copy from scrcpy_init

```
[ScrcpyServerDownloader] scrcpy-server.jar not found at: D:\...\scrcpy-server.jar
[ScrcpyServerDownloader] Attempting to copy from scrcpy_init directory...
[ScrcpyServerDownloader] Found scrcpy-server at: D:\.tmp\Users\...\.core_node\scrcpy\scrcpy-server
[ScrcpyServerDownloader] ✓ Copied scrcpy-server to: D:\...\scrcpy-server.jar
```

### 从 GitHub 下载 / Download from GitHub

```
================================================================================
[ScrcpyServerDownloader] Downloading scrcpy-server.jar
================================================================================
[ScrcpyServerDownloader] Version: 3.3.3
[ScrcpyServerDownloader] URL: https://github.com/Genymobile/scrcpy/releases/...
[ScrcpyServerDownloader] Target: D:\...\scrcpy-server.jar
[ScrcpyServerDownloader] File size: 0.09 MB

[INFO] [======================----------------------------] 44.2% | 0.04/0.09 MB | 2.15 MB/s | ETA: 0s
[INFO] [==================================================] 100.0% | 0.09/0.09 MB | 1.85 MB/s | ETA: 0s

================================================================================
[ScrcpyServerDownloader] ✓ Download completed successfully
[ScrcpyServerDownloader] ✓ Saved to: D:\...\scrcpy-server.jar
================================================================================
```

---

## 相关文件 / Related Files

- **下载器实现 / Downloader Implementation**:
  - `pyapps/matrix/matrix_config/scrcpy_server_downloader.py`

- **视频流服务集成 / Video Service Integration**:
  - `pyapps/matrix/services/video_stream_service.py`

- **配置 / Configuration**:
  - `pyapps/matrix/matrix_config/config.py`

---

## 注意事项 / Notes

1. **网络要求 / Network Requirement**:
   - 首次使用需要网络连接访问 GitHub
   - 如果已有 scrcpy_init 则不需要网络

2. **磁盘空间 / Disk Space**:
   - scrcpy-server.jar 约 89 KB
   - 下载时需要额外临时空间

3. **版本锁定 / Version Locked**:
   - 固定使用 scrcpy 3.3.3
   - 确保与客户端版本兼容

4. **自动清理 / Auto Cleanup**:
   - 下载失败时自动清理临时文件
   - 不会留下损坏的文件

---

**更新日期 / Last Updated**: 2025-12-19

**版本 / Version**: 1.0.0
