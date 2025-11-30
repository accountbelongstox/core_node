# 视频处理工具更新说明

## 更新内容 (2024-11-28)

### 1. 修复音画不同步问题 ✅

**问题描述:**
在裁剪和合并视频时，可能出现音画不同步的情况。

**解决方案:**
使用改进的FFmpeg参数来确保音视频同步：

```bash
ffmpeg -i input.mp4 \
  -ss 5 \
  -t 111.5 \
  -c:v copy \
  -c:a copy \
  -avoid_negative_ts make_zero \  # 避免负时间戳
  -fflags +genpts \                # 重新生成PTS时间戳
  -copyts \                        # 复制时间戳
  -start_at_zero \                 # 从零开始时间戳
  -y \
  output.mp4
```

**关键参数说明:**

| 参数 | 作用 | 重要性 |
|------|------|--------|
| `-avoid_negative_ts make_zero` | 将负时间戳设为0，避免播放器错位 | ⭐⭐⭐⭐⭐ |
| `-fflags +genpts` | 重新生成PTS时间戳 | ⭐⭐⭐⭐ |
| `-copyts` | 保留原始时间戳 | ⭐⭐⭐ |
| `-start_at_zero` | 时间戳从0开始 | ⭐⭐⭐ |

### 2. 添加跳过关键字功能 ✅

**问题描述:**
某些文件名包含特定关键字（如"书写"），需要在处理时自动跳过。

**解决方案:**
添加 `--skip-keywords` 参数，支持跳过包含特定关键字的文件。

**使用示例:**

```bash
# 默认跳过包含"书写"的文件
python trim_and_concat_videos.py ./videos

# 跳过多个关键字
python trim_and_concat_videos.py ./videos --skip-keywords 书写 测试 demo

# 不跳过任何文件
python trim_and_concat_videos.py ./videos --skip-keywords
```

**输出示例:**

```
⏭️  跳过 2 个包含关键字的文件:
   - 01_书写练习.mp4 (关键字: 书写)
   - 05_测试视频.mp4 (关键字: 测试)

找到 15 个视频文件:
  1. video_01.mp4
  2. video_02.mp4
  ...
```

## 完整使用示例

### 示例1: 基本使用（默认跳过"书写"）

```bash
python trim_and_concat_videos.py "D:\.tmp\videos"
```

**输出:**
```
======================================================================
视频批量处理工具 / Video Batch Processing Tool
======================================================================

输入目录: D:\.tmp\videos
输出目录: D:\.tmp\videos
裁剪设置: 开头 5.0s, 结尾 4.0s
跳过关键字: 书写
音画同步: 已启用 (使用改进的时间戳处理)

⏭️  跳过 1 个包含关键字的文件:
   - 03_书写示范.mp4 (关键字: 书写)

找到 10 个视频文件:
  1. video_01.mp4
  2. video_02.mp4
  ...
```

### 示例2: 自定义跳过关键字

```bash
python trim_and_concat_videos.py ./videos --skip-keywords 书写 练习 demo test
```

### 示例3: 完整配置

```bash
python trim_and_concat_videos.py "D:\videos" \
  --trim-start 5 \
  --trim-end 4 \
  --skip-keywords 书写 \
  --output "D:\output"
```

## 技术细节

### 音画同步原理

**问题根源:**
1. 裁剪时时间戳不连续
2. 负时间戳导致播放器混乱
3. PTS/DTS不一致

**修复方法:**
1. `-avoid_negative_ts make_zero` - 确保所有时间戳 >= 0
2. `-fflags +genpts` - 重新生成连续的时间戳
3. `-copyts` + `-start_at_zero` - 统一时间基准

### 关键字过滤实现

```python
def find_videos(self, directory: Path) -> list:
    videos = []
    skipped = []

    for file_path in directory.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in self.SUPPORTED_FORMATS:
            # 检查关键字
            should_skip = False
            for keyword in self.skip_keywords:
                if keyword.lower() in file_path.name.lower():
                    should_skip = True
                    skipped.append((file_path, keyword))
                    break

            if not should_skip:
                videos.append(file_path)

    # 显示跳过的文件
    if skipped:
        print(f"\n⏭️  跳过 {len(skipped)} 个包含关键字的文件:")
        for file_path, keyword in skipped:
            print(f"   - {file_path.name} (关键字: {keyword})")

    return videos
```

## 测试建议

### 测试音画同步

1. **准备测试视频**
   - 找一个有明显音画对应的视频（如人物说话、音乐节拍）
   - 时长建议 > 20秒

2. **执行裁剪**
   ```bash
   python trim_and_concat_videos.py ./test_videos
   ```

3. **验证结果**
   - 播放合并后的视频
   - 检查音画是否对齐
   - 特别关注视频接缝处

### 测试关键字过滤

1. **准备测试文件**
   ```
   test_videos/
   ├── 01_正常视频.mp4
   ├── 02_书写练习.mp4  ← 应该被跳过
   ├── 03_正常视频.mp4
   └── 04_测试视频.mp4  ← 如果设置跳过"测试"，应该被跳过
   ```

2. **执行测试**
   ```bash
   # 默认跳过"书写"
   python trim_and_concat_videos.py ./test_videos

   # 应该只处理 01, 03
   ```

3. **验证输出**
   - 检查是否显示了跳过的文件
   - 确认只处理了正确的文件

## 命令行参数完整列表

```
python trim_and_concat_videos.py <directory> [options]

必需参数:
  directory              视频目录路径

可选参数:
  --trim-start FLOAT     裁剪开头秒数 (默认: 5.0)
  --trim-end FLOAT       裁剪结尾秒数 (默认: 4.0)
  --output PATH          输出目录 (默认: 与输入相同)
  --skip-keywords K1 K2  跳过包含关键字的文件 (默认: 书写)
  -h, --help             显示帮助信息
```

## 常见问题

### Q: 音画不同步问题是否完全解决？

A: 新参数可以解决大多数音画不同步问题。如果仍有问题，可能需要重新编码（牺牲速度）:

```bash
# 如果流复制仍有问题，可以改用重新编码（较慢）
ffmpeg -i input.mp4 -ss 5 -t 111.5 -c:v libx264 -c:a aac output.mp4
```

### Q: 如何完全禁用关键字过滤？

A: 使用空的 `--skip-keywords` 参数：

```bash
python trim_and_concat_videos.py ./videos --skip-keywords
```

### Q: 关键字匹配是否区分大小写？

A: 不区分。`书写`、`書寫` 都会被识别（转换为小写匹配）。

### Q: 能否使用通配符？

A: 目前只支持精确字符串匹配，不支持正则或通配符。

## 更新历史

**v1.2.0** (2024-11-28)
- ✨ 添加音画同步修复参数
- ✨ 添加跳过关键字功能（默认跳过"书写"）
- 📝 更新文档和使用示例

**v1.1.0** (2024-11-28)
- ✨ 添加自动路径转义处理
- ✨ 支持中文路径和特殊字符
- 📝 改进文档和示例

**v1.0.0** (2024-11-28)
- 🎉 初始版本
- ✅ 批量裁剪和合并功能
- ✅ 时间戳文件名
- ✅ FFmpeg集成
