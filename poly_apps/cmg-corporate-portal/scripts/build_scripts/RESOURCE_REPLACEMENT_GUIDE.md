# Android 资源智能替换指南

**日期:** 2025-12-10
**功能:** 自动替换 Android 应用图标和启动屏幕

---

## 📋 功能概述

在构建 Android 应用时，系统会自动：
1. **扫描** Android 资源目录
2. **替换** 应用图标和启动屏幕
3. **预览** 替换后的效果
4. **确认** 后继续构建

---

## 🎯 资源映射规则

### 源文件位置

源文件放置在项目的 `assets/` 目录下：

```
cmg-corporate-portal/
├── assets/
│   ├── logo.png          ← 应用图标源文件
│   └── splash.png        ← 启动屏幕源文件
└── android/
    └── app/src/main/res/
        ├── mipmap-hdpi/
        ├── mipmap-mdpi/
        └── ...
```

### 自动映射关系

| 源文件 | 目标文件模式 | 说明 |
|--------|-------------|------|
| **`logo.png`** | `ic_launcher.png` | 圆角方形图标 |
| **`logo.png`** | `ic_launcher_round.png` | 圆形图标 |
| **`logo.png`** | `ic_launcher_foreground.png` | 自适应图标前景 |
| **`splash.png`** | `splash.png` | 启动屏幕 |

### 自动扫描目标

系统会自动扫描所有相关目录，无需手动指定：

```
android/app/src/main/res/
├── mipmap-hdpi/
│   ├── ic_launcher.png           ← 自动替换
│   ├── ic_launcher_round.png     ← 自动替换
│   └── ic_launcher_foreground.png← 自动替换
├── mipmap-mdpi/
│   ├── ic_launcher.png           ← 自动替换
│   ├── ic_launcher_round.png     ← 自动替换
│   └── ic_launcher_foreground.png← 自动替换
├── mipmap-xhdpi/
│   └── ...                       ← 自动替换
├── mipmap-xxhdpi/
│   └── ...                       ← 自动替换
├── mipmap-xxxhdpi/
│   └── ...                       ← 自动替换
├── drawable/
│   └── splash.png                ← 自动替换
├── drawable-land/
│   └── splash.png                ← 自动替换
└── drawable-*dpi/
    └── splash.png                ← 自动替换
```

**典型替换数量：**
- **图标：** 15个文件 (5个密度 × 3种图标类型)
- **启动屏幕：** 2-8个文件 (取决于配置)

---

## 🖼️ 智能缩放和裁剪算法

### 算法原理

系统会自动处理任意尺寸的源图片，适配到所有目标尺寸：

```
┌─────────────────────────────────────────┐
│  1. 读取目标文件尺寸                      │
│     例如: 72x72, 144x144, 192x192...    │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  2. 计算缩放比例                         │
│     规则: 适配最短边 (cover模式)         │
│     - 源图宽高比 > 目标 → 适配高度        │
│     - 源图宽高比 ≤ 目标 → 适配宽度        │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  3. 高质量缩放                           │
│     使用 Lanczos 重采样算法              │
│     保持图像清晰度                       │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  4. 居中裁剪                             │
│     裁剪到目标精确尺寸                   │
│     保持图像中心区域                     │
└─────────────────────────────────────────┘
```

### 示例场景

#### 场景 1: 源图片较大

**源图片：** 1024x1024
**目标尺寸：** 72x72

```
步骤 1: 计算缩放比例
  - 源宽高比: 1024/1024 = 1.0
  - 目标宽高比: 72/72 = 1.0
  - 缩放比例: 72/1024 = 0.0703

步骤 2: 缩放
  - 新尺寸: 72x72

步骤 3: 裁剪
  - 已经是目标尺寸，无需裁剪
  - 最终: 72x72 ✓
```

#### 场景 2: 源图片较小

**源图片：** 48x48
**目标尺寸：** 192x192

```
步骤 1: 计算缩放比例
  - 源宽高比: 48/48 = 1.0
  - 目标宽高比: 192/192 = 1.0
  - 缩放比例: 192/48 = 4.0

步骤 2: 缩放 (放大)
  - 新尺寸: 192x192

步骤 3: 裁剪
  - 已经是目标尺寸，无需裁剪
  - 最终: 192x192 ✓
```

#### 场景 3: 源图片宽高比不同

**源图片：** 800x600 (4:3)
**目标尺寸：** 144x144 (1:1)

```
步骤 1: 计算缩放比例
  - 源宽高比: 800/600 = 1.33
  - 目标宽高比: 144/144 = 1.0
  - 源更宽 → 适配高度
  - 缩放比例: 144/600 = 0.24

步骤 2: 缩放
  - 新尺寸: 192x144 (保持宽高比)

步骤 3: 裁剪
  - 宽度多余: 192 - 144 = 48
  - 左侧裁掉: 24
  - 右侧裁掉: 24
  - 最终: 144x144 ✓ (中心区域)
```

**图示：**
```
源图 800x600 (4:3)
┌──────────────────────┐
│                      │
│     ┌──────┐         │
│     │ 保留 │         │
│     └──────┘         │
│                      │
└──────────────────────┘

缩放后 192x144
┌─────────────┐
│  ┌──────┐   │
│  │ 保留 │   │
│  └──────┘   │
└─────────────┘
 ↑        ↑
裁掉24  裁掉24

最终 144x144
┌──────┐
│ 保留 │
└──────┘
```

---

## 🔧 使用方法

### 1. 准备源图片

**步骤：**
1. 创建 `assets/` 目录（如果不存在）
2. 放置两个源文件：
   - `assets/logo.png` - 应用图标
   - `assets/splash.png` - 启动屏幕

**建议尺寸：**
- **logo.png：** 512x512 或更大 (正方形)
- **splash.png：** 1080x1920 或更大 (竖屏比例)

**格式要求：**
- 支持 PNG, JPEG
- 建议使用 PNG (支持透明)

### 2. 运行构建

```powershell
cd poly_apps\cmg-corporate-portal\scripts
.\start.ps1
# 选择: 4. Build for Android
```

### 3. 自动替换流程

系统会自动执行：

```
[Python] Preparing Android build...
[Python] Loading existing build_config.ini

[Python] Scanning Android resources...

============================================================
Android Resource Replacement
============================================================

[Source] logo.png
  Path: D:\...\assets\logo.png
  Size: 1024x1024

[Target Pattern] ic_launcher.png
  Found 5 files to replace:
  ✓ Replaced: app\src\main\res\mipmap-hdpi\ic_launcher.png
    Size: 72x72
  ✓ Replaced: app\src\main\res\mipmap-mdpi\ic_launcher.png
    Size: 48x48
  ✓ Replaced: app\src\main\res\mipmap-xhdpi\ic_launcher.png
    Size: 96x96
  ✓ Replaced: app\src\main\res\mipmap-xxhdpi\ic_launcher.png
    Size: 144x144
  ✓ Replaced: app\src\main\res\mipmap-xxxhdpi\ic_launcher.png
    Size: 192x192

[Target Pattern] ic_launcher_round.png
  Found 5 files to replace:
  ✓ Replaced: ... (同上)

[Target Pattern] ic_launcher_foreground.png
  Found 5 files to replace:
  ✓ Replaced: ... (同上)

[Source] splash.png
  Path: D:\...\assets\splash.png
  Size: 1080x1920

[Target Pattern] splash.png
  Found 3 files to replace:
  ✓ Replaced: app\src\main\res\drawable\splash.png
    Size: 2732x2732
  ✓ Replaced: app\src\main\res\drawable-land\splash.png
    Size: 2732x2732
  ✓ Replaced: app\src\main\res\drawable-port\splash.png
    Size: 2732x2732

============================================================
Replacement Summary
============================================================

logo.png:
  ✓ Replaced: 15/15

splash.png:
  ✓ Replaced: 3/3

Total Replaced: 18

[Python] Re-scanning resources after replacement...

============================================================
[Python] Launching resource preview...
============================================================
[Preview] Server running at: http://localhost:8899
[Preview] Opening browser...
```

### 4. 预览替换效果

浏览器会自动打开，显示：
- ✅ **所有图标尺寸** - 查看不同密度下的图标
- ✅ **启动屏幕** - 查看竖屏和横屏效果
- ✅ **应用信息** - 名称、包ID等

### 5. 确认并继续

- **点击 "Continue"** → 继续构建 APK
- **点击 "Cancel"** → 取消构建

---

## 📊 替换统计

### 典型替换结果

**项目：** CMG-Shooting&Hotel

```
源文件: logo.png (1024x1024)
├─ ic_launcher.png × 5        = 5 files
├─ ic_launcher_round.png × 5  = 5 files
└─ ic_launcher_foreground.png × 5 = 5 files
总计: 15 files

源文件: splash.png (1080x1920)
├─ drawable/splash.png        = 1 file
├─ drawable-land/splash.png   = 1 file
└─ drawable-port/splash.png   = 1 file
总计: 3 files

总替换: 18 files ✓
```

---

## 🎨 图像质量

### 重采样算法

使用 **Lanczos** 重采样算法：
- ✅ 最高质量的图像缩放
- ✅ 保持边缘清晰度
- ✅ 减少锯齿和模糊
- ✅ 适合放大和缩小

### 保存质量

- **PNG：** 无损压缩
- **JPEG：** 95% 质量
- **透明通道：** 自动处理 (JPEG转RGB)

---

## ⚠️ 注意事项

### 1. 源图片要求

**图标 (logo.png)：**
- ✅ **必须是正方形** (1:1 宽高比)
- ✅ 建议 512x512 或更大
- ✅ 背景应该是图标主体，避免大量空白
- ⚠️ 避免细小文字（小尺寸下会模糊）

**启动屏幕 (splash.png)：**
- ✅ 建议竖屏比例 (9:16 或 9:19.5)
- ✅ 建议 1080x1920 或更大
- ✅ 重要内容放在中心区域
- ⚠️ 避免边缘重要内容（会被裁剪）

### 2. 文件命名

**必须严格遵守：**
- `logo.png` - 应用图标
- `splash.png` - 启动屏幕

**大小写敏感：**
- ✅ `logo.png`
- ❌ `Logo.png` (不会识别)
- ❌ `LOGO.PNG` (不会识别)

### 3. 目录结构

**正确：**
```
cmg-corporate-portal/
├── assets/
│   ├── logo.png      ✓
│   └── splash.png    ✓
```

**错误：**
```
cmg-corporate-portal/
├── assets/
│   └── images/
│       ├── logo.png  ✗ (嵌套太深)
│       └── splash.png ✗
```

### 4. 透明通道

- **PNG：** 支持透明背景
- **JPEG：** 不支持透明，会转换为白色背景
- **建议：** 图标使用 PNG，启动屏幕可使用 JPEG

---

## 🔍 故障排查

### 问题 1: 源文件未找到

**症状：**
```
[Skip] Source not found: logo.png
```

**解决：**
1. 检查文件是否存在：
   ```powershell
   ls assets\logo.png
   ```
2. 检查文件名大小写
3. 检查文件路径

### 问题 2: 没有找到目标文件

**症状：**
```
[Target Pattern] ic_launcher.png
  No files found matching: ic_launcher.png
```

**解决：**
1. 确保 Android 平台已添加
2. 检查 `android/app/src/main/res/` 目录是否存在
3. 重新添加 Android 平台

### 问题 3: 图像质量不佳

**症状：** 替换后的图标模糊或像素化

**解决：**
1. 使用更大尺寸的源图片 (建议 1024x1024)
2. 确保源图片清晰
3. 避免源图片过度压缩

### 问题 4: 图标内容被裁剪

**症状：** 图标主体显示不完整

**解决：**
1. 确保源图片是**正方形** (1:1)
2. 在源图片中留出适当边距
3. 重要内容放在中心 80% 区域内

---

## 📖 技术细节

### Python 依赖

```python
from PIL import Image  # Pillow 库
```

**安装：**
```bash
pip install Pillow
```

### 核心类

**`ResourceReplacer`** (`resource_replacer.py`)

**主要方法：**
- `scan_target_files()` - 扫描目标文件
- `smart_resize_and_crop()` - 智能缩放裁剪
- `replace_file()` - 替换单个文件
- `replace_resources()` - 批量替换

### 集成点

**`BuildController.prepare_android_build()`** (`main_controller.py`)

```python
# 1. 扫描资源
scanner = ResourceScanner(str(self.android_path))

# 2. 替换资源
replacer = ResourceReplacer(str(self.android_path), str(self.assets_path))
replace_stats = replacer.replace_resources()

# 3. 重新扫描（显示替换后的效果）
scanner = ResourceScanner(str(self.android_path))
resource_data = scanner.get_full_report()

# 4. 预览
user_continues = show_preview(resource_data, port=8899)
```

---

## 🎯 最佳实践

### 1. 图标设计

**推荐尺寸：** 1024x1024

**设计建议：**
- ✅ 简洁明了的图形
- ✅ 适当的内边距 (10-15%)
- ✅ 高对比度
- ✅ 在白色和深色背景下都清晰可见

**避免：**
- ❌ 过于复杂的细节
- ❌ 细小的文字
- ❌ 过度渐变
- ❌ 过于靠近边缘

### 2. 启动屏幕设计

**推荐尺寸：** 1080x1920 (9:16)

**设计建议：**
- ✅ 品牌 Logo 放在中心
- ✅ 简洁的背景
- ✅ 快速加载的设计
- ✅ 与应用主题一致

**安全区域：**
```
1080x1920
┌────────────┐
│   margin   │
│ ┌────────┐ │  ← 重要内容在此区域
│ │        │ │     (中心 80%)
│ │ Logo   │ │
│ │        │ │
│ └────────┘ │
│   margin   │
└────────────┘
```

### 3. 测试流程

1. **第一次构建：** 使用默认图片测试流程
2. **替换图片：** 放置自定义 logo.png 和 splash.png
3. **预览确认：** 检查所有尺寸下的效果
4. **安装测试：** 在实际设备上查看效果

---

## 📚 相关文档

- **`resource_replacer.py`** - 资源替换实现
- **`resource_scanner.py`** - 资源扫描实现
- **`main_controller.py`** - 构建流程控制
- **`web_preview_server.py`** - Web预览服务

---

## ✅ 总结

### 核心优势

1. **全自动** - 无需手动编辑 Android 配置
2. **智能适配** - 自动缩放到所有目标尺寸
3. **即时预览** - 替换后立即查看效果
4. **高质量** - Lanczos 算法保证清晰度
5. **零配置** - 只需放置源文件即可

### 典型工作流

```
1. 准备源图片 (assets/logo.png, assets/splash.png)
   ↓
2. 运行构建 (.\start.ps1 → 选择 4)
   ↓
3. 自动替换 (18个文件)
   ↓
4. 预览效果 (浏览器打开)
   ↓
5. 确认构建 (点击 Continue)
   ↓
6. 完成 APK
```

---

**文档创建:** 2025-12-10
**功能状态:** ✅ 已实现并集成
**测试状态:** 待用户测试
