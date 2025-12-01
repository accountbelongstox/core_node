# 递归文件/文件夹重命名工具使用指南
Recursive File/Folder Renaming Tool - User Guide

## 🎯 功能特性

### 核心功能
- ✅ **递归处理** - 自动处理所有子目录和文件
- ✅ **智能翻译** - Google翻译自动转英文（支持缓存）
- ✅ **全角转半角** - `１２３` → `123`，`ａｂｃ` → `abc`
- ✅ **空格替换** - 空格和全角空格转为下划线
- ✅ **路径追踪** - 自动处理文件夹重命名后的路径变化
- ✅ **预览模式** - 先预览再执行，避免意外
- ✅ **实时进度** - 实时显示处理进度和详情
- ✅ **冲突处理** - 自动处理文件名冲突（添加序号）

### 关键算法：深度优先处理

**问题**：如果先重命名父文件夹，子文件路径会失效

**解决方案**：
```
原始结构：
  D:\videos\
    ├─ 第一课\
    │   ├─ 视频1.mp4
    │   └─ 视频2.mp4
    └─ 第二课\
        └─ 视频3.mp4

处理顺序（从深到浅）：
  1. D:\videos\第一课\视频1.mp4  → D:\videos\第一课\Video_1.mp4
  2. D:\videos\第一课\视频2.mp4  → D:\videos\第一课\Video_2.mp4
  3. D:\videos\第二课\视频3.mp4  → D:\videos\第二课\Video_3.mp4
  4. D:\videos\第一课\         → D:\videos\Lesson_1\
  5. D:\videos\第二课\         → D:\videos\Lesson_2\

✅ 避免了路径失效问题！
```

## 📦 安装要求

### 依赖项
```bash
# 已安装在项目中
pycore.pyutils.translator  # Google翻译模块
```

### 检查FFmpeg（可选，仅视频处理需要）
```bash
ffmpeg -version
```

## 🚀 快速开始

### 1. 预览模式（推荐第一次使用）

**强烈建议**先使用预览模式，查看会发生什么变化：

```bash
# Windows
python scripts\pyvoice\rename_files_recursive.py "D:\我的文件夹" --dry-run

# Linux/Mac
python scripts/pyvoice/rename_files_recursive.py "/home/user/my_folder" --dry-run
```

**输出示例**：
```
======================================================================
Recursive File/Folder Renaming Tool
递归文件/文件夹重命名工具
======================================================================

📂 Root directory: D:\我的文件夹
🌍 Source language: zh-CN
🔧 Mode: DRY RUN (Preview)
🎯 Target: Files and folders

======================================================================
Step 1: Scanning directory...
======================================================================

📊 Scan results:
  - Total items: 15
  - Files: 10
  - Folders: 5

======================================================================
Step 2: Processing items (from deepest to shallowest)...
======================================================================

[1/15] 📄 File: 第一课_视频.mp4
  ⏳ Step 1: Translating...
      [Translation] 第一课_视频 → Lesson 1_Video
  ⏳ Step 2: Sanitizing...
    Original:   第一课_视频
    Translated: Lesson 1_Video
    Sanitized:  Lesson_1_Video
  🔍 [DRY RUN] Would rename to: Lesson_1_Video.mp4

[2/15] 📁 Folder: 第一课
  ⏳ Step 1: Translating...
      [Translation] 第一课 → Lesson 1
  ⏳ Step 2: Sanitizing...
    Original:   第一课
    Translated: Lesson 1
    Sanitized:  Lesson_1
  🔍 [DRY RUN] Would rename to: Lesson_1

...

======================================================================
Summary / 统计摘要
======================================================================

📊 Statistics:
  - Total items processed: 15
    - Files: 10
    - Folders: 5

✅ Results:
  - Renamed: 12
    - Files: 8
    - Folders: 4
  - Skipped (no change needed): 3
  - Failed: 0

🔍 This was a DRY RUN - no actual changes were made
💡 Remove --dry-run to perform actual renaming
```

### 2. 实际重命名

确认预览结果无误后，移除 `--dry-run` 执行实际重命名：

```bash
python scripts\pyvoice\rename_files_recursive.py "D:\我的文件夹"
```

**输出变化**：
```
[1/15] 📄 File: 第一课_视频.mp4
  ✅ Renamed to: Lesson_1_Video.mp4
```

## 📋 使用场景

### 场景1：只重命名文件，保留文件夹原名

```bash
python scripts\pyvoice\rename_files_recursive.py "D:\videos" --files-only
```

**示例**：
```
原始：
  D:\老挝语课程\
    ├─ 第一课\
    │   └─ 单元音.mp4
    └─ 第二课\
        └─ 辅音.mp4

结果：
  D:\老挝语课程\          ← 保持不变
    ├─ 第一课\            ← 保持不变
    │   └─ Monophthong.mp4  ← 已重命名
    └─ 第二课\            ← 保持不变
        └─ Consonant.mp4    ← 已重命名
```

### 场景2：只重命名文件夹，保留文件原名

```bash
python scripts\pyvoice\rename_files_recursive.py "D:\videos" --folders-only
```

**示例**：
```
原始：
  D:\老挝语课程\
    ├─ 第一课\
    │   └─ 单元音.mp4
    └─ 第二课\
        └─ 辅音.mp4

结果：
  D:\Lao_Language_Course\  ← 已重命名
    ├─ Lesson_1\           ← 已重命名
    │   └─ 单元音.mp4       ← 保持不变
    └─ Lesson_2\           ← 已重命名
        └─ 辅音.mp4         ← 保持不变
```

### 场景3：处理日语文件名

```bash
python scripts\pyvoice\rename_files_recursive.py "D:\日本語" --src-lang ja
```

**支持的语言代码**：
- `zh-CN` - 简体中文（默认）
- `zh-TW` - 繁体中文
- `ja` - 日语
- `ko` - 韩语
- `th` - 泰语
- `vi` - 越南语
- `fr` - 法语
- `de` - 德语
- `es` - 西班牙语

### 场景4：静默模式（只显示摘要）

```bash
python scripts\pyvoice\rename_files_recursive.py "D:\videos" --quiet
```

**输出**：只显示扫描结果和最终统计，不显示每个文件的详细处理过程

## 🔍 处理规则详解

### 1. 全角字符转半角

| 类型 | 全角 | 半角 |
|------|------|------|
| 数字 | ０１２３４５６７８９ | 0123456789 |
| 字母（大写） | ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ | ABCDEFGHIJKLMNOPQRSTUVWXYZ |
| 字母（小写） | ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ | abcdefghijklmnopqrstuvwxyz |
| 符号 | ！＠＃＄％＾＆＊（）＿＋－＝ | !@#$%^&*()_+-= |
| 空格 | 　（全角空格） | （半角空格） |

**示例**：
```
第１课_单元音（Ａ）  →  第1课_单元音(A)
```

### 2. 空格替换为下划线

**所有类型的空格都会被替换**：
- 半角空格：` `
- 全角空格：`　`

**示例**：
```
Lesson 1 Video.mp4  →  Lesson_1_Video.mp4
第一课　视频.mp4    →  Lesson_1_Video.mp4
```

### 3. 特殊字符处理

**保留的字符**：
- 字母（a-z, A-Z）
- 数字（0-9）
- 下划线（_）
- 连字符（-）
- 点（.）
- 非ASCII字符（中文、日文、韩文、泰文等）

**移除的字符**：
```
原始：视频#1@老挝语.mp4
清理：视频_1_老挝语.mp4
```

### 4. 文件名冲突处理

如果重命名后的名称已存在，自动添加序号：

```
原始：
  - 第一课.mp4
  - 第一课(1).mp4
  - 第一课(2).mp4

重命名后：
  - Lesson_1.mp4
  - Lesson_1_1.mp4
  - Lesson_1_2.mp4
```

## ⚠️ 重要注意事项

### 1. 备份数据

**强烈建议**在执行重命名前备份数据：
```bash
# Windows
xcopy "D:\原始文件夹" "D:\备份文件夹" /E /I /H

# Linux/Mac
cp -r "/path/to/original" "/path/to/backup"
```

### 2. 预览模式

**始终先使用 `--dry-run`** 预览结果：
```bash
python scripts\pyvoice\rename_files_recursive.py "D:\folder" --dry-run
```

### 3. 翻译缓存

翻译结果会被缓存，加快后续处理速度。

**缓存位置**：
```
{wwwroot}/pycore_db/translator_cache/zh-CN_to_en/
```

**清理缓存**（如果翻译不准确）：
```bash
python -m pycore.pyutils.translator --clear-cache --src zh-CN --dest en
```

### 4. 路径长度限制

**Windows路径限制**：260字符

如果路径过长，可能导致重命名失败：
```
❌ Error: Path too long
💡 建议：先处理子目录，缩短路径
```

### 5. 权限问题

如果遇到权限错误：
```bash
# Windows：以管理员身份运行CMD
# Linux/Mac：使用sudo（谨慎）
sudo python scripts/pyvoice/rename_files_recursive.py "/path"
```

## 🐛 故障排除

### 问题1：翻译结果不正确

**原因**：缓存了旧的翻译

**解决**：
```bash
# 清理缓存
python -m pycore.pyutils.translator --clear-cache

# 重新运行
python scripts\pyvoice\rename_files_recursive.py "D:\folder" --dry-run
```

### 问题2：部分文件跳过

**原因1**：父文件夹被重命名，路径变化

**检查**：查看输出中的 `⏭️ Skipped (path no longer exists)`

**解释**：这是正常的，因为已经在新路径下处理过了

**原因2**：文件名已经是英文，无需改变

**检查**：查看输出中的 `✅ No change needed`

### 问题3：翻译速度慢

**原因**：首次翻译需要调用Google API

**解决**：
- 第一次运行较慢（需要翻译）
- 后续运行会使用缓存（非常快）
- 如果文件很多，考虑分批处理

### 问题4：文件名仍包含中文

**原因**：Google翻译可能保留某些专有名词

**示例**：
```
第一课_老挝语  →  Lesson 1_Lao  ✅
专有名词       →  专有名词       ✅（保留）
```

**说明**：这是正常的，Google翻译会保留无法翻译的专有名词

## 📊 性能优化

### 1. 分批处理大目录

如果目录包含数千个文件：
```bash
# 先处理第一层
python scripts\pyvoice\rename_files_recursive.py "D:\folder\batch1"

# 再处理第二层
python scripts\pyvoice\rename_files_recursive.py "D:\folder\batch2"
```

### 2. 使用静默模式

减少输出可以提高速度：
```bash
python scripts\pyvoice\rename_files_recursive.py "D:\folder" --quiet
```

### 3. 预热缓存

首次运行时使用 `--dry-run` 预热翻译缓存：
```bash
# 第一次：预热缓存（dry-run）
python scripts\pyvoice\rename_files_recursive.py "D:\folder" --dry-run

# 第二次：实际重命名（使用缓存，很快）
python scripts\pyvoice\rename_files_recursive.py "D:\folder"
```

## 🔗 与视频处理脚本配合使用

### 工作流程

1. **先重命名文件** → 标准化文件名
2. **再处理视频** → 裁剪、合并

```bash
# Step 1: 重命名所有视频文件
python scripts\pyvoice\rename_files_recursive.py "D:\videos" --files-only

# Step 2: 处理视频（裁剪、合并）
python scripts\pyvoice\trim_and_concat_videos.py "D:\videos"
```

### 为什么这样做？

- ✅ 避免在视频处理时再翻译（节省时间）
- ✅ 文件名已经是英文，不会再次翻译
- ✅ 更容易追踪和管理处理过的文件

## 📝 高级用法

### 1. 组合多个选项

```bash
# 只重命名日语文件，预览模式，静默输出
python scripts\pyvoice\rename_files_recursive.py "D:\日本語" \
    --files-only \
    --src-lang ja \
    --dry-run \
    --quiet
```

### 2. 批处理多个目录

创建批处理脚本：

**Windows (batch.bat)**：
```batch
@echo off
python scripts\pyvoice\rename_files_recursive.py "D:\folder1"
python scripts\pyvoice\rename_files_recursive.py "D:\folder2"
python scripts\pyvoice\rename_files_recursive.py "D:\folder3"
pause
```

**Linux/Mac (batch.sh)**：
```bash
#!/bin/bash
python scripts/pyvoice/rename_files_recursive.py "/path/folder1"
python scripts/pyvoice/rename_files_recursive.py "/path/folder2"
python scripts/pyvoice/rename_files_recursive.py "/path/folder3"
```

## 🆘 获取帮助

### 查看帮助信息

```bash
python scripts\pyvoice\rename_files_recursive.py --help
```

### 查看版本信息

```bash
python scripts\pyvoice\rename_files_recursive.py --version
```

### 报告问题

如果遇到问题，请提供：
1. 完整的命令
2. 错误信息
3. 文件结构示例
4. 操作系统版本

## 📚 相关文档

- **TRANSLATION_DEBUG_GUIDE.md** - 翻译调试指南
- **CHANGELOG.md** - 更新日志
- **trim_and_concat_videos.py** - 视频处理脚本

## 🎉 最佳实践

1. ✅ **始终使用预览模式** - 先 `--dry-run` 检查结果
2. ✅ **备份数据** - 重命名前备份重要文件
3. ✅ **清理缓存** - 遇到翻译问题时清理缓存
4. ✅ **分批处理** - 大目录分批处理更安全
5. ✅ **检查结果** - 重命名后检查文件是否正确
6. ✅ **保存日志** - 将输出保存到文件以便检查

**保存日志示例**：
```bash
# Windows
python scripts\pyvoice\rename_files_recursive.py "D:\folder" > rename_log.txt 2>&1

# Linux/Mac
python scripts/pyvoice/rename_files_recursive.py "/path" > rename_log.txt 2>&1
```
