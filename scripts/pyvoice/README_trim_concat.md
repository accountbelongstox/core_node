# 视频批量裁剪合并工具

## 功能特点

✅ 批量处理目录中的所有视频
✅ 自动裁剪视频开头和结尾（默认：开头5秒，结尾4秒）
✅ 自动合并为单个长视频
✅ 生成时间戳文件名
✅ **自动处理Windows路径转义**
✅ 支持中文路径和特殊字符
✅ 使用FFmpeg快速流复制（无需重新编码）

## 支持的视频格式

- `.mp4`
- `.avi`
- `.mov`
- `.mkv`
- `.flv`
- `.wmv`
- `.webm`
- `.m4v`

## 安装要求

### FFmpeg

**Windows:**
1. 下载 FFmpeg: https://ffmpeg.org/download.html
2. 解压到任意目录（如 `C:\ffmpeg`）
3. 将 `C:\ffmpeg\bin` 添加到系统环境变量 PATH
4. 验证安装：`ffmpeg -version`

**Linux:**
```bash
sudo apt-get install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

## 使用方法

### 基本使用

```bash
python trim_and_concat_videos.py <视频目录路径>
```

### Windows 路径示例

脚本会**自动处理路径转义**，支持以下所有格式：

```bash
# 使用引号（推荐）
python trim_and_concat_videos.py "D:\.tmp\BaiduNetdiskDownload\Laos\v"

# 不使用引号（自动处理）
python trim_and_concat_videos.py D:\.tmp\BaiduNetdiskDownload\Laos\v

# 双反斜杠转义
python trim_and_concat_videos.py D:\\.tmp\\BaiduNetdiskDownload\\Laos\\v

# 使用正斜杠（推荐）
python trim_and_concat_videos.py D:/.tmp/BaiduNetdiskDownload/Laos/v
```

### 自定义裁剪时间

```bash
# 裁剪开头10秒，结尾8秒
python trim_and_concat_videos.py ./videos --trim-start 10 --trim-end 8

# 只裁剪开头
python trim_and_concat_videos.py ./videos --trim-start 5 --trim-end 0

# 只裁剪结尾
python trim_and_concat_videos.py ./videos --trim-start 0 --trim-end 4
```

### 指定输出目录

```bash
# 输出到不同目录
python trim_and_concat_videos.py ./videos --output ./output

# Windows 路径
python trim_and_concat_videos.py "D:\videos" --output "D:\output"
```

### 完整示例

```bash
python trim_and_concat_videos.py "D:\.tmp\BaiduNetdiskDownload\Laos\v" --trim-start 5 --trim-end 4 --output "D:\output"
```

## 工作流程

1. **扫描目录** - 查找所有支持的视频文件
2. **视频排序** - 按文件名排序
3. **裁剪视频** - 去掉每个视频的开头和结尾
4. **存储到临时目录** - 裁剪后的视频存储在临时目录
5. **合并视频** - 将所有裁剪后的视频合并为一个
6. **生成输出** - 创建带时间戳的最终文件
7. **清理临时文件** - 删除临时目录和文件

## 输出文件

输出文件名格式：`concatenated_YYYYMMDD_HHMMSS.mp4`

示例：
- `concatenated_20241128_153045.mp4`
- `concatenated_20241129_091520.mp4`

## 命令行参数

### `directory` (必需)
视频目录路径

### `--trim-start` (可选)
裁剪开头的秒数
- 默认值：`5.0`
- 类型：浮点数

### `--trim-end` (可选)
裁剪结尾的秒数
- 默认值：`4.0`
- 类型：浮点数

### `--output` (可选)
输出目录路径
- 默认值：与输入目录相同
- 类型：字符串

## 路径处理详解

### normalize_path() 函数

脚本内置 `normalize_path()` 函数，自动处理：

1. **移除路径引号** - `"D:\path"` → `D:\path`
2. **转换为Path对象** - 自动处理反斜杠转义
3. **解析为绝对路径** - 相对路径转换为绝对路径
4. **统一路径格式** - Windows/Linux兼容

### 在FFmpeg中的路径处理

在生成FFmpeg的concat文件时，路径格式为：

```
file 'D:/path/to/video1.mp4'
file 'D:/path/to/video2.mp4'
```

使用 `replace('\\', '/')` 确保在所有平台上兼容。

## 示例场景

### 场景1：处理百度网盘下载的视频

```bash
python trim_and_concat_videos.py "D:\.tmp\BaiduNetdiskDownload\Laos\v"
```

**输出：**
```
找到 15 个视频文件:
  1. video_01.mp4
  2. video_02.mp4
  ...
  15. video_15.mp4

处理中: video_01.mp4 (时长: 120.5s → 111.5s)
完成: trimmed_video_01.mp4
...

成功裁剪 15/15 个视频

开始合并 15 个视频...
合并完成: concatenated_20241128_153045.mp4

输出文件: D:\.tmp\BaiduNetdiskDownload\Laos\v\concatenated_20241128_153045.mp4
文件大小: 1234.56 MB
```

### 场景2：处理多个文件夹

创建批处理脚本 `batch_process.bat`:

```batch
@echo off
python trim_and_concat_videos.py "D:\videos\folder1"
python trim_and_concat_videos.py "D:\videos\folder2"
python trim_and_concat_videos.py "D:\videos\folder3"
pause
```

### 场景3：只裁剪开头片头

```bash
python trim_and_concat_videos.py ./videos --trim-start 10 --trim-end 0
```

## 常见问题

### Q: 为什么要裁剪开头和结尾？

A: 许多视频有片头、片尾、广告或水印。批量裁剪可以快速去除这些部分。

### Q: 裁剪会重新编码视频吗？

A: 不会。脚本使用 `ffmpeg -c copy`，直接复制视频流，速度快且无质量损失。

### Q: 支持哪些视频格式？

A: 支持FFmpeg支持的所有常见格式（mp4, avi, mov, mkv, flv, wmv, webm, m4v）。

### Q: 路径包含空格怎么办？

A: 使用引号包裹路径：`"D:\My Videos\folder"`

### Q: 视频太短怎么办？

A: 如果视频时长 ≤ (trim_start + trim_end)，脚本会自动跳过该视频。

### Q: 如何按特定顺序合并？

A: 脚本按文件名排序。建议重命名视频为：
```
video_001.mp4
video_002.mp4
video_003.mp4
```

### Q: 临时文件在哪里？

A: 临时文件存储在 `temp_trimmed_YYYYMMDD_HHMMSS/` 目录，处理完成后自动删除。

### Q: 处理很慢怎么办？

A: 使用 `-c copy` 已经是最快方式。如果仍然慢，可能是：
- 视频文件很大
- 硬盘读写速度慢
- 视频格式需要重新编码（某些格式不支持直接复制）

## 性能建议

1. **使用SSD** - 比HDD快得多
2. **本地处理** - 避免网络驱动器
3. **格式统一** - 所有视频使用相同格式和编码
4. **分批处理** - 一次处理不超过50个视频

## 技术细节

### FFmpeg命令

**裁剪命令：**
```bash
ffmpeg -i input.mp4 -ss 5 -t 111.5 -c copy output.mp4
```

- `-ss 5`: 跳过前5秒
- `-t 111.5`: 持续时长（总时长 - 5 - 4）
- `-c copy`: 直接复制流（无重新编码）

**合并命令：**
```bash
ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4
```

- `-f concat`: concat协议
- `-safe 0`: 允许绝对路径
- `-i filelist.txt`: 文件列表

### 文件列表格式

```
file 'D:/path/video1.mp4'
file 'D:/path/video2.mp4'
file 'D:/path/video3.mp4'
```

## 错误处理

脚本会自动处理以下情况：

- ❌ 目录不存在 → 退出并提示
- ❌ 没有视频文件 → 退出并提示支持的格式
- ❌ FFmpeg未安装 → 退出并提示安装方法
- ⚠️ 视频太短 → 跳过该视频
- ⚠️ 无法获取时长 → 跳过该视频
- ⚠️ 裁剪失败 → 跳过该视频，继续处理其他
- ⚠️ 合并失败 → 保留已裁剪的视频

## 日志输出

脚本提供详细的处理日志：

```
======================================================================
视频批量处理工具 / Video Batch Processing Tool
======================================================================

输入目录: D:\.tmp\BaiduNetdiskDownload\Laos\v
输出目录: D:\.tmp\BaiduNetdiskDownload\Laos\v
裁剪设置: 开头 5.0s, 结尾 4.0s

找到 3 个视频文件:
  1. video1.mp4
  2. video2.mp4
  3. video3.mp4

临时目录: D:\.tmp\BaiduNetdiskDownload\Laos\v\temp_trimmed_20241128_153045
裁剪设置: 去掉开头 5.0s，结尾 4.0s

======================================================================
处理中: video1.mp4 (时长: 120.5s → 111.5s)
完成: trimmed_video1.mp4
处理中: video2.mp4 (时长: 95.3s → 86.3s)
完成: trimmed_video2.mp4
处理中: video3.mp4 (时长: 200.0s → 191.0s)
完成: trimmed_video3.mp4

======================================================================
成功裁剪 3/3 个视频

开始合并 3 个视频...
合并完成: concatenated_20241128_153045.mp4

清理临时文件...

======================================================================
✅ 处理完成!
======================================================================
输出文件: D:\.tmp\BaiduNetdiskDownload\Laos\v\concatenated_20241128_153045.mp4
文件大小: 1234.56 MB
======================================================================
```

## 许可证

此脚本是 pycore 项目的一部分。

## 更新日志

**v1.1.0** (2024-11-28)
- ✨ 添加自动路径转义处理
- ✨ 支持中文路径和特殊字符
- 📝 改进文档和示例

**v1.0.0** (2024-11-28)
- 🎉 初始版本
- ✅ 批量裁剪和合并功能
- ✅ 时间戳文件名
- ✅ FFmpeg集成
