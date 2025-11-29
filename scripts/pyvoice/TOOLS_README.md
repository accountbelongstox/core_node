# 视频和文件处理工具集
Video and File Processing Toolkit

一套完整的文件处理工具，用于批量重命名、视频裁剪、合并等操作。

## 📦 工具列表

### 1. 递归文件/文件夹重命名工具 ⭐ NEW
**文件**: `rename_files_recursive.py`

递归处理所有子目录和文件，自动翻译为英文并清理文件名。

**核心功能**：
- ✅ 递归处理所有子目录和文件
- ✅ 自动翻译为英文（Google Translate + 缓存）
- ✅ 全角字符转半角（１２３ → 123）
- ✅ 空格替换为下划线
- ✅ 智能处理路径变化（深度优先算法）
- ✅ 预览模式（dry-run）
- ✅ 实时进度显示

**快速开始**：
```bash
# 预览模式（推荐）
python scripts/pyvoice/rename_files_recursive.py "D:\folder" --dry-run

# 实际重命名
python scripts/pyvoice/rename_files_recursive.py "D:\folder"

# 只重命名文件
python scripts/pyvoice/rename_files_recursive.py "D:\folder" --files-only

# 只重命名文件夹
python scripts/pyvoice/rename_files_recursive.py "D:\folder" --folders-only
```

**详细文档**: [RENAME_GUIDE.md](RENAME_GUIDE.md)

---

### 2. 视频批量处理工具
**文件**: `trim_and_concat_videos.py`

批量裁剪视频开头和结尾，自动合并为单个文件。

**核心功能**：
- ✅ 自动翻译视频文件名为英文
- ✅ 裁剪视频开头和结尾
- ✅ 批量合并为单个视频
- ✅ H.264 + AAC 重新编码（修复音画不同步）
- ✅ 实时显示FFmpeg处理进度
- ✅ 跳过特定关键字的文件
- ✅ 详细错误日志

**快速开始**：
```bash
# 基本使用（中文文件名 → 英文）
python scripts/pyvoice/trim_and_concat_videos.py "D:\videos"

# 自定义裁剪时间
python scripts/pyvoice/trim_and_concat_videos.py "D:\videos" --trim-start 3 --trim-end 2

# 指定输出目录
python scripts/pyvoice/trim_and_concat_videos.py "D:\videos" --output "D:\output"

# 跳过包含"书写"的文件
python scripts/pyvoice/trim_and_concat_videos.py "D:\videos" --skip-keywords 书写
```

**详细文档**: [CHANGELOG.md](CHANGELOG.md)

---

## 🚀 推荐工作流程

### 场景1：处理视频文件（重命名 + 裁剪合并）

```bash
# Step 1: 重命名所有视频文件（标准化文件名）
python scripts/pyvoice/rename_files_recursive.py "D:\videos" --files-only

# Step 2: 处理视频（裁剪、合并）
python scripts/pyvoice/trim_and_concat_videos.py "D:\videos"
```

**为什么这样做？**
- ✅ 文件名已经是英文，视频处理时不需要再翻译
- ✅ 避免重复翻译，节省时间
- ✅ 更容易追踪和管理

### 场景2：只重命名文件和文件夹

```bash
# 预览重命名效果
python scripts/pyvoice/rename_files_recursive.py "D:\folder" --dry-run

# 确认无误后，实际重命名
python scripts/pyvoice/rename_files_recursive.py "D:\folder"
```

### 场景3：整理多语言文件

```bash
# 日语文件
python scripts/pyvoice/rename_files_recursive.py "D:\日本語" --src-lang ja

# 韩语文件
python scripts/pyvoice/rename_files_recursive.py "D:\한국어" --src-lang ko

# 泰语文件
python scripts/pyvoice/rename_files_recursive.py "D:\ไทย" --src-lang th
```

---

## 📋 系统要求

### Python依赖
```bash
# 项目已包含所需模块
pycore.pyutils.translator   # Google翻译
pycore.pyfoundations.*       # 基础工具
```

### 外部工具
```bash
# FFmpeg（仅视频处理需要）
# Windows: 从 https://ffmpeg.org/download.html 下载
# Linux: sudo apt-get install ffmpeg
# macOS: brew install ffmpeg

# 检查安装
ffmpeg -version
```

---

## 🎯 功能对比

| 功能 | 递归重命名工具 | 视频处理工具 |
|------|---------------|-------------|
| 翻译文件名 | ✅ | ✅ |
| 递归处理子目录 | ✅ | ❌ |
| 重命名文件夹 | ✅ | ❌ |
| 全角转半角 | ✅ | ❌ |
| 预览模式 | ✅ | ❌ |
| 裁剪视频 | ❌ | ✅ |
| 合并视频 | ❌ | ✅ |
| 实时FFmpeg进度 | ❌ | ✅ |
| 处理对象 | 所有文件/文件夹 | 仅视频文件 |

---

## 📚 完整文档

### 主要文档
- **[RENAME_GUIDE.md](RENAME_GUIDE.md)** - 重命名工具完整指南 ⭐
- **[TRANSLATION_DEBUG_GUIDE.md](TRANSLATION_DEBUG_GUIDE.md)** - 翻译调试指南
- **[CHANGELOG.md](CHANGELOG.md)** - 更新日志和视频处理指南

### 测试和示例
- **[test_rename_example.py](test_rename_example.py)** - 创建测试目录结构

---

## ⭐ 快速测试

### 测试重命名功能

```bash
# Step 1: 创建测试目录
python scripts/pyvoice/test_rename_example.py create

# Step 2: 预览重命名
python scripts/pyvoice/rename_files_recursive.py "./test_rename_demo" --dry-run

# Step 3: 实际重命名
python scripts/pyvoice/rename_files_recursive.py "./test_rename_demo"

# Step 4: 清理测试目录
python scripts/pyvoice/test_rename_example.py cleanup
```

---

## 🆘 获取帮助

```bash
# 重命名工具帮助
python scripts/pyvoice/rename_files_recursive.py --help

# 视频处理工具帮助
python scripts/pyvoice/trim_and_concat_videos.py --help

# 测试工具帮助
python scripts/pyvoice/test_rename_example.py
```

---

## 📝 更新日志

### v2.1.0 (2025-11-29) - 最新版本
- ✅ 新增递归重命名工具
- ✅ 修复翻译语言识别问题（强制zh-CN）
- ✅ 实时显示FFmpeg处理进度
- ✅ 全角字符转半角功能
- ✅ 深度优先路径处理算法

完整更新日志: [CHANGELOG.md](CHANGELOG.md)
