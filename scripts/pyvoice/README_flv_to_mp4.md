# FLV转MP4批量转换工具

## 功能特点

✅ 递归扫描目录中的所有FLV文件
✅ 批量转换为MP4格式（H.264视频 + AAC音频）
✅ 支持保留或删除原FLV文件
✅ 自动跳过已转换的文件
✅ 支持自定义输出目录
✅ 保持或合并目录结构
✅ 支持多线程并行处理
✅ 自动处理Windows路径转义
✅ 支持中文路径和特殊字符
✅ 优化MP4文件以支持流媒体播放

## 安装要求

### FFmpeg

必须先安装FFmpeg。参考 [README_trim_concat.md](./README_trim_concat.md) 中的安装说明。

## 使用方法

### 基本使用

```bash
# 在原位置转换（FLV文件所在目录生成MP4）
python flv_to_mp4.py <目录路径>
```

### Windows 路径示例

```bash
# 使用引号（推荐）
python flv_to_mp4.py "D:\.tmp\BaiduNetdiskDownload\videos"

# 不使用引号
python flv_to_mp4.py D:\.tmp\videos

# 正斜杠
python flv_to_mp4.py D:/.tmp/videos
```

### 常用选项

#### 1. 转换后删除原文件

```bash
python flv_to_mp4.py ./videos --delete-original
```

⚠️ **警告**: 此选项会永久删除原FLV文件，请确保转换成功后再使用！

#### 2. 覆盖已存在的MP4文件

```bash
python flv_to_mp4.py ./videos --overwrite
```

默认情况下，如果MP4文件已存在，会跳过转换。使用此选项强制重新转换。

#### 3. 输出到指定目录

```bash
# 保持原目录结构
python flv_to_mp4.py ./videos --output ./converted

# 所有文件输出到同一目录
python flv_to_mp4.py ./videos --output ./converted --no-keep-structure
```

**目录结构对比：**

保持结构 (默认):
```
videos/
  ├── folder1/
  │   └── video1.flv
  └── folder2/
      └── video2.flv

→

converted/
  ├── folder1/
  │   └── video1.mp4
  └── folder2/
      └── video2.mp4
```

不保持结构 (--no-keep-structure):
```
videos/
  ├── folder1/
  │   └── video1.flv
  └── folder2/
      └── video2.flv

→

converted/
  ├── video1.mp4
  └── video2.mp4
```

#### 4. 并行处理（多线程）

```bash
# 使用4个线程同时处理
python flv_to_mp4.py ./videos --parallel 4
```

适合处理大量小文件。建议线程数不超过CPU核心数。

### 组合使用

```bash
# 转换到新目录，完成后删除原文件，使用4线程
python flv_to_mp4.py "D:\videos" --output "D:\converted" --delete-original --parallel 4

# 强制重新转换所有文件
python flv_to_mp4.py ./videos --overwrite --parallel 2
```

## 转换参数

脚本使用以下FFmpeg参数进行转换：

```
-c:v libx264              # 视频编码器: H.264
-c:a aac                  # 音频编码器: AAC
-b:a 192k                 # 音频比特率: 192kbps
-movflags +faststart      # 优化流媒体播放
```

### 为什么选择这些参数？

- **H.264视频**: 兼容性最好，所有设备都支持
- **AAC音频**: 高质量，文件小
- **faststart**: 允许边下载边播放（网络流媒体）

## 使用场景

### 场景1: 批量转换下载的FLV视频

```bash
python flv_to_mp4.py "D:\downloads\videos"
```

**输出示例：**
```
找到 25 个FLV文件
======================================================================

[1/25] 处理中: video_001.flv
  输入: D:\downloads\videos\video_001.flv
  输出: D:\downloads\videos\video_001.mp4
  ✅ 转换成功
  大小: 45.32 MB → 42.18 MB

[2/25] 处理中: video_002.flv
  输入: D:\downloads\videos\video_002.flv
  输出: D:\downloads\videos\video_002.mp4
  ✅ 转换成功
  大小: 38.76 MB → 36.45 MB

...

======================================================================
转换摘要 / Conversion Summary
======================================================================
总文件数 / Total: 25
✅ 成功 / Success: 25
❌ 失败 / Failed: 0
⏭️  跳过 / Skipped: 0
======================================================================
```

### 场景2: 递归转换多级目录

```
videos/
├── series1/
│   ├── ep01.flv
│   └── ep02.flv
├── series2/
│   ├── ep01.flv
│   └── ep02.flv
└── movie.flv
```

```bash
python flv_to_mp4.py ./videos --output ./converted
```

所有子目录中的FLV都会被找到并转换。

### 场景3: 快速转换大量文件

```bash
# 使用8个线程并行处理
python flv_to_mp4.py ./videos --parallel 8
```

适合CPU性能强劲的机器。

### 场景4: 转换并清理原文件

```bash
# 1. 先试运行，确保转换正常
python flv_to_mp4.py ./videos

# 2. 检查转换后的MP4文件

# 3. 确认无误后，转换并删除原文件
python flv_to_mp4.py ./videos --delete-original --overwrite
```

## 批处理脚本（Windows）

创建 `convert_flv.bat`:

```batch
@echo off
python flv_to_mp4.py "D:\videos" --parallel 4
pause
```

双击即可运行。

## 命令行参数

### `directory` (必需)
FLV文件所在目录（支持递归扫描）

### `--output <path>` (可选)
输出目录
- 默认: 在原位置生成MP4
- 示例: `--output ./converted`

### `--delete-original` (可选)
转换成功后删除原FLV文件
- 默认: 不删除
- ⚠️ 谨慎使用！

### `--overwrite` (可选)
覆盖已存在的MP4文件
- 默认: 跳过已存在的文件
- 使用场景: 重新转换或修复损坏的文件

### `--no-keep-structure` (可选)
不保持目录结构（所有文件输出到同一目录）
- 默认: 保持目录结构
- 仅在指定 `--output` 时有效

### `--parallel <N>` (可选)
并行处理的线程数
- 默认: 1（顺序处理）
- 建议: CPU核心数或更少
- 示例: `--parallel 4`

## 文件大小对比

FLV转MP4通常会减小文件大小：

| 原FLV大小 | 转换后MP4 | 压缩率 |
|----------|----------|-------|
| 50 MB    | ~45 MB   | 10%   |
| 100 MB   | ~90 MB   | 10%   |
| 500 MB   | ~450 MB  | 10%   |

实际效果取决于原始FLV的编码格式。

## 性能建议

### 顺序处理 vs 并行处理

**顺序处理** (--parallel 1):
- ✅ 稳定，资源占用低
- ✅ 适合大文件
- ❌ 速度慢

**并行处理** (--parallel 4+):
- ✅ 速度快
- ✅ 适合大量小文件
- ❌ 高CPU/内存占用
- ❌ 可能影响系统响应

**建议：**
```bash
# 小文件 (<100MB): 使用并行
python flv_to_mp4.py ./videos --parallel 8

# 大文件 (>500MB): 使用顺序
python flv_to_mp4.py ./videos --parallel 1

# 中等文件: 使用2-4线程
python flv_to_mp4.py ./videos --parallel 4
```

## 常见问题

### Q: 转换速度慢怎么办？

A:
1. 使用 `--parallel` 并行处理
2. 检查CPU性能
3. 使用SSD硬盘

### Q: 转换后视频质量下降？

A: 这是正常的。FLV转MP4需要重新编码。如果想保持原始质量：

```bash
# 使用更高的视频质量（但文件会更大）
# 需要手动修改脚本中的FFmpeg参数
```

### Q: 如何只转换特定子目录？

A: 直接指定该子目录：

```bash
python flv_to_mp4.py ./videos/series1
```

### Q: 转换失败怎么办？

A: 检查：
1. FFmpeg是否正确安装
2. 原FLV文件是否损坏
3. 磁盘空间是否充足
4. 文件路径是否包含特殊字符

### Q: 如何中断转换？

A: 按 `Ctrl+C` 终止。已转换的文件会保留。

### Q: 转换后能否删除脚本？

A: 可以。转换完成后MP4文件不依赖脚本。

### Q: 支持其他格式转换吗？

A: 脚本专门用于FLV→MP4。如需其他格式，可以修改脚本。

## 技术细节

### FFmpeg转换命令

```bash
ffmpeg -i input.flv \
  -c:v libx264 \
  -c:a aac \
  -strict experimental \
  -b:a 192k \
  -movflags +faststart \
  output.mp4
```

### 递归扫描实现

使用 `os.walk()` 递归遍历：

```python
for root, dirs, files in os.walk(directory):
    for file in files:
        if file.lower().endswith('.flv'):
            # 处理FLV文件
```

### 并行处理实现

使用 `concurrent.futures.ThreadPoolExecutor`:

```python
with ThreadPoolExecutor(max_workers=4) as executor:
    futures = [executor.submit(convert, file) for file in files]
    for future in as_completed(futures):
        result = future.result()
```

## 示例输出

```
======================================================================
FLV转MP4批量转换工具 / FLV to MP4 Batch Converter
======================================================================

输入目录: D:\videos
输出位置: 原位置转换
删除原文件: 否
覆盖已存在文件: 否

找到 10 个FLV文件
======================================================================

[1/10] 处理中: video1.flv
  输入: D:\videos\video1.flv
  输出: D:\videos\video1.mp4
  ✅ 转换成功
  大小: 45.32 MB → 42.18 MB

[2/10] 处理中: video2.flv
  输入: D:\videos\subfolder\video2.flv
  输出: D:\videos\subfolder\video2.mp4
  ✅ 转换成功
  大小: 38.76 MB → 36.45 MB

[3/10] 处理中: video3.flv
  输入: D:\videos\video3.flv
  输出: D:\videos\video3.mp4
  ❌ 失败: 输出文件已存在（使用 --overwrite 强制覆盖）

...

======================================================================
转换摘要 / Conversion Summary
======================================================================
总文件数 / Total: 10
✅ 成功 / Success: 8
❌ 失败 / Failed: 0
⏭️  跳过 / Skipped: 2
======================================================================
```

## 安全提示

⚠️ **删除原文件前的检查清单：**

1. ✅ 先不使用 `--delete-original` 运行一次
2. ✅ 检查所有MP4文件是否正常播放
3. ✅ 对比文件数量是否一致
4. ✅ 备份重要文件
5. ✅ 然后再使用 `--delete-original` 选项

## 扩展功能

如需添加其他功能，可以修改脚本：

- 自定义视频比特率
- 调整分辨率
- 添加水印
- 转换其他格式（AVI, MKV等）

## 相关工具

- [trim_and_concat_videos.py](./trim_and_concat_videos.py) - 视频裁剪合并工具
- [FFmpeg官方文档](https://ffmpeg.org/documentation.html)

## 许可证

此脚本是 pycore 项目的一部分。
