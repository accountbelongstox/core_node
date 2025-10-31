# 断点续传逻辑说明

## 智能恢复策略

程序会自动检测每个文件的处理状态，智能跳过或继续处理。

## 处理场景

### 场景 1: 文件已完全压缩
**情况**：JSON中 `status='compressed'`

**处理**：
```
✓ 跳过此文件
```

**输出示例**：
```
Skip compressed: videos/example.mp4
```

---

### 场景 2: 压缩完成但JSON未更新
**情况**：
- `_compress` 目录中文件存在且完整
- JSON中 `status='copied'` 或 `status='pending'`

**处理**：
```
1. 检测到压缩文件已存在
2. 验证文件完整性
3. 仅更新JSON（不重新压缩）
4. 删除临时文件（如果存在）
5. 继续下一个
```

**输出示例**：
```
[5/100] Processing: videos/example.mp4
  Original size: 50.0MB
  → Compressed file exists, verifying...
  ✓ Compressed file valid, updating cache only
  ✓ Size: 15.3MB (saved 69.4%)
  📊 Cumulative: 250.0MB -> 85.0MB (saved 165.0MB, 66.0%)
  Progress: 5.0% (5 success, 0 failed, 0 skipped)
```

---

### 场景 3: 临时文件已完整复制
**情况**：
- `_tmp` 目录中文件存在
- 文件大小与源文件相同
- 文件完整（图片会额外验证）

**处理**：
```
1. 检测到临时文件已存在
2. 验证大小匹配
3. 图片额外验证完整性
4. 跳过复制，直接压缩
```

**输出示例**：
```
[10/100] Processing: images/photo.jpg
  Original size: 5.2MB
  → Temp file exists, verifying...
  ✓ Temp file valid, skipping copy
  → Compressing...
  ✓ Compressed: 850.0KB (saved 83.7%)
```

---

### 场景 4: 临时文件损坏（复制到一半）
**情况**：
- `_tmp` 目录中文件存在
- 文件大小与源文件不同（复制未完成）
- 或文件损坏（验证失败）

**处理**：
```
1. 检测到临时文件存在
2. 发现大小不匹配或验证失败
3. 删除损坏的临时文件
4. 重新从源文件复制
5. 继续压缩流程
```

**输出示例**：
```
[15/100] Processing: videos/movie.mp4
  Original size: 500.0MB
  → Temp file exists, verifying...
  ⚠ Temp file incomplete (size mismatch), deleting...
  → Copying to temp...
  → Compressing...
  ✓ Compressed: 180.5MB (saved 63.9%)
```

---

### 场景 5: 压缩文件损坏
**情况**：
- `_compress` 目录中文件存在
- 但文件损坏（验证失败）

**处理**：
```
1. 检测到压缩文件存在
2. 验证失败
3. 删除损坏的压缩文件
4. 检查临时文件或重新复制
5. 重新压缩
```

**输出示例**：
```
[20/100] Processing: videos/clip.mp4
  Original size: 100.0MB
  → Compressed file exists, verifying...
  ⚠ Compressed file corrupted, deleting...
  → Copying to temp...
  → Compressing...
  ✓ Compressed: 35.2MB (saved 64.8%)
```

---

## 验证策略

### 图片文件
- **大小检查**：文件大小 > 0
- **完整性验证**：使用 PIL 打开并验证
- **临时文件**：完整验证
- **压缩文件**：完整验证

### 视频/音频文件
- **大小检查**：文件大小 > 0
- **完整性验证**：使用 ffprobe 验证
- **临时文件**：仅检查大小（验证耗时）
- **压缩文件**：完整验证

---

## 中断与恢复示例

### 示例 1：压缩过程中断

**第一次运行**：
```
[1/100] Processing: video1.mp4
  → Copying to temp...
  → Compressing...
  [Ctrl+C 中断]
```

**第二次运行**：
```
[1/100] Processing: video1.mp4
  → Compressed file exists, verifying...
  ✓ Compressed file valid, updating cache only
  ✓ Size: 15.3MB (saved 69.4%)

[2/100] Processing: video2.mp4
  → Copying to temp...
  ...
```

### 示例 2：复制过程中断

**第一次运行**：
```
[5/100] Processing: large_video.mp4
  → Copying to temp...
  [Ctrl+C 中断 - 复制到一半]
```

**第二次运行**：
```
[5/100] Processing: large_video.mp4
  → Temp file exists, verifying...
  ⚠ Temp file incomplete (size mismatch), deleting...
  → Copying to temp...
  → Compressing...
  ✓ Compressed: 180.5MB (saved 63.9%)
```

---

## JSON 缓存状态

### 状态值说明

```json
{
  "files": {
    "video/example.mp4": {
      "type": "video",
      "source": "D:\\...\\example.mp4",
      "size": 52428800,
      "status": "compressed",          // 处理状态
      "compressed_size": 16777216,
      "compression_ratio": "68.0%",
      "compressed_at": "2025-10-31T10:30:00"
    }
  }
}
```

### 状态类型

| 状态 | 说明 | 处理行为 |
|------|------|----------|
| `pending` | 未开始处理 | 完整处理流程 |
| `copied` | 已复制到临时目录 | 检查临时文件 → 压缩 |
| `compressed` | 已压缩完成 | 跳过 |
| `replaced` | 已替换回源文件 | 跳过 |
| `failed` | 处理失败 | 重新处理 |

---

## 恢复性能优化

### 避免重复操作
1. ✅ 已压缩文件：直接跳过（秒级）
2. ✅ 压缩完成未更新JSON：仅验证+更新（秒级）
3. ✅ 临时文件已完整：跳过复制（节省大量时间）
4. ✅ 临时文件损坏：仅重新复制和压缩

### 时间对比

**100个视频文件（每个50MB）中断后恢复：**

| 场景 | 旧逻辑 | 新逻辑 | 节省 |
|------|--------|--------|------|
| 50个已压缩完成 | 重新验证50次 | 跳过50次 | ~5分钟 |
| 10个压缩完成但JSON未更新 | 重新压缩10次 | 仅验证+更新 | ~30分钟 |
| 5个复制完成未压缩 | 重新复制5次 | 跳过复制 | ~2分钟 |
| 5个复制到一半 | 继续损坏文件压缩 | 删除+重新复制 | 避免错误 |

---

## 最佳实践

### 1. 定期保存
程序每处理5个文件自动保存JSON缓存，确保中断后能恢复。

### 2. 中断恢复
可以随时按 `Ctrl+C` 中断，下次运行会自动继续。

### 3. 验证建议
- 小文件：完整验证
- 大文件：信任大小匹配（提高速度）
- 关键文件：可手动验证 `_compress` 目录

### 4. 故障排除
如果发现文件处理异常：
1. 检查 `compression_cache.json` 中的状态
2. 手动删除损坏的 `_compress` 文件
3. 重新运行程序，会自动重新处理

---

## 技术细节

### 文件验证方法

```python
def _verify_file(self, filepath: Path) -> bool:
    # 1. 基本检查：文件存在且大小>0
    if not filepath.exists() or filepath.stat().st_size == 0:
        return False

    # 2. 图片验证：使用PIL
    if is_image:
        with Image.open(filepath) as img:
            img.verify()

    # 3. 视频/音频验证：使用ffprobe
    if is_video_or_audio:
        result = subprocess.run(['ffprobe', '-v', 'error', filepath])
        return result.returncode == 0
```

### 大小匹配策略

```python
# 临时文件大小检查
if tmp_path.stat().st_size == source_path.stat().st_size:
    # 图片：额外验证完整性
    if is_image:
        verify_file(tmp_path)
    # 视频/音频：信任大小匹配
    else:
        skip_copy = True
```

---

## 总结

✅ **自动检测**：智能识别各种中断场景
✅ **智能恢复**：跳过已完成的步骤
✅ **损坏处理**：自动删除并重新处理损坏文件
✅ **性能优化**：避免重复的耗时操作
✅ **安全可靠**：多层验证确保文件完整性
