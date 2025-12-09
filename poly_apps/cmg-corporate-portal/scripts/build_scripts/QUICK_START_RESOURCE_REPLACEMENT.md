# 资源替换功能 - 快速开始

**功能状态:** ✅ 已集成到构建流程

---

## 🚀 立即开始

### Step 1: 准备源图片

您的项目已经有 `assets/logo.png` ✓

还需要添加：
```bash
cd D:\programing\core_node\poly_apps\cmg-corporate-portal\assets
# 放置 splash.png (启动屏幕)
```

**当前状态：**
```
assets/
├── logo.png           ✓ 已存在 (374KB)
├── logo-min.png       (备用)
└── splash.png         ✗ 需要添加
```

### Step 2: 运行构建

```powershell
cd D:\programing\core_node\poly_apps\cmg-corporate-portal\scripts
.\start.ps1
# 选择: 4. Build for Android
```

### Step 3: 查看自动替换

系统会自动：
1. 扫描 Android 资源
2. **替换所有图标和启动屏幕** ← 新功能！
3. 重新扫描显示替换后的资源
4. 打开浏览器预览效果
5. 等待确认后继续构建

---

## 📊 预期输出

### 替换过程

```
[Python] Scanning Android resources...

============================================================
Android Resource Replacement
============================================================

[Source] logo.png
  Path: D:\...\assets\logo.png
  Size: 1000x1000 (示例)

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
  ✓ Replaced: ... (5个文件)

[Target Pattern] ic_launcher_foreground.png
  Found 5 files to replace:
  ✓ Replaced: ... (5个文件)

[Source] splash.png
  Path: D:\...\assets\splash.png

[Skip] Source not found: splash.png  ← 如果没有splash.png

============================================================
Replacement Summary
============================================================

logo.png:
  ✓ Replaced: 15/15

splash.png: No files processed

Total Replaced: 15

[Python] Re-scanning resources after replacement...
[Python] Launching resource preview...
```

### 预览页面

浏览器会自动打开 `http://localhost:8899`，显示：
- ✅ 所有替换后的图标（5种密度 × 3种类型 = 15个）
- ✅ 应用名称和包ID
- ⚠️ 启动屏幕（如果splash.png存在）

---

## 🎨 源图片要求

### logo.png (已存在)

**当前文件：** `assets/logo.png` (374KB)

**要求：**
- ✅ 正方形 (1:1 比例)
- ✅ 建议 512x512 或更大
- ✅ PNG格式 (支持透明)

**检查：**
```powershell
# 查看图片信息
magick identify assets\logo.png
# 或使用图片查看器查看尺寸
```

### splash.png (需要添加)

**建议：**
- 尺寸：1080x1920 (9:16 竖屏比例)
- 格式：PNG 或 JPEG
- 内容：品牌Logo + 背景
- 重要内容放在中心区域

**创建方法：**
1. 使用 Photoshop/GIMP/Figma 等工具
2. 创建 1080x1920 画布
3. 设计启动屏幕
4. 导出为 PNG
5. 保存到 `assets/splash.png`

**或者暂时跳过：**
- 不添加 splash.png 也可以构建
- 系统会使用 Android 默认的启动屏幕

---

## ✅ 验证替换效果

### 方法 1: Web预览 (自动)

构建时会自动打开浏览器预览：
- 查看所有密度下的图标
- 确认图标清晰度
- 检查是否有裁剪问题

### 方法 2: 直接查看文件

```powershell
# 查看替换后的文件
cd android\app\src\main\res

# 查看所有图标
ls mipmap-*\ic_launcher.png

# 查看具体文件
start mipmap-xxhdpi\ic_launcher.png
```

### 方法 3: APK安装测试

构建完成后：
```powershell
# APK位置
cd android\app\build\outputs\apk\debug

# 安装到设备
adb install app-debug.apk

# 查看桌面图标和启动屏幕
```

---

## 🔧 自定义配置 (高级)

### 添加更多源图片映射

编辑 `resource_replacer.py`:

```python
self.mappings = {
    "logo.png": [
        "ic_launcher.png",
        "ic_launcher_round.png",
        "ic_launcher_foreground.png"
    ],
    "splash.png": ["splash.png"],

    # 添加自定义映射
    "banner.png": ["banner.png"],  # 新增
    "background.png": ["background.png"]  # 新增
}
```

### 修改源图片路径

编辑 `build_config.ini`:

```ini
[resources]
icon_file = assets/custom_logo.png
splash_screen_file = assets/custom_splash.png
```

系统会优先使用配置文件中指定的路径。

---

## 📋 完整流程示意图

```
准备图片
  ↓
assets/logo.png ✓
assets/splash.png (可选)
  ↓
运行构建 (.\start.ps1 → 4)
  ↓
┌────────────────────────────────┐
│ 1. 扫描 Android 资源            │
│    - 找到所有 ic_launcher*.png  │
│    - 找到所有 splash.png        │
└────────────────────────────────┘
  ↓
┌────────────────────────────────┐
│ 2. 替换资源                     │
│    logo.png → 15个图标文件      │
│    splash.png → 3个启动屏幕     │
│                                │
│    智能缩放 + 裁剪：            │
│    - 72x72, 48x48, 96x96...    │
│    - 自动适配所有尺寸          │
└────────────────────────────────┘
  ↓
┌────────────────────────────────┐
│ 3. 重新扫描                     │
│    - 验证替换结果              │
│    - 收集图片信息              │
└────────────────────────────────┘
  ↓
┌────────────────────────────────┐
│ 4. Web预览 (http://localhost:8899) │
│    - 显示所有图标              │
│    - 显示启动屏幕              │
│    - 显示应用信息              │
└────────────────────────────────┘
  ↓
用户确认 (Continue / Cancel)
  ↓
┌────────────────────────────────┐
│ 5. 构建 APK                     │
│    - pnpm run build            │
│    - npx cap sync android      │
│    - gradlew assembleDebug     │
└────────────────────────────────┘
  ↓
完成！
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## ⚠️ 常见问题

### Q1: splash.png 不是必需的吗？

**A:** 不是必需的。
- 如果不提供，系统会跳过启动屏幕替换
- Android 会使用默认的白色背景启动屏幕
- 只替换图标也可以正常构建

### Q2: logo.png 可以是长方形吗？

**A:** 不建议。
- 系统会强制裁剪为正方形
- 可能导致内容被裁剪
- 最好使用正方形源图片

### Q3: 替换会影响原始文件吗？

**A:** 是的，但这是预期行为。
- 系统会**直接覆盖** Android 资源文件
- 这是为了在预览时看到实际效果
- 如果需要恢复，重新运行 `npx cap add android`

### Q4: 可以看到替换前的原始图标吗？

**A:** 可以。
- 第一次添加 Android 平台时，系统会使用 Capacitor 默认图标
- 替换前的图标是 Capacitor 的绿色机器人图标
- 如果想恢复，删除 `android/` 目录后重新添加

### Q5: 预览时看到的就是最终效果吗？

**A:** 是的。
- 预览显示的是替换后的实际文件
- APK 中的图标和启动屏幕与预览一致
- 建议在预览时仔细检查

---

## 📚 相关文档

- **`RESOURCE_REPLACEMENT_GUIDE.md`** - 完整功能文档
- **`resource_replacer.py`** - 替换实现代码
- **`main_controller.py`** - 构建流程控制

---

## 🎯 下一步

1. **（可选）添加 splash.png**
   ```bash
   # 放置启动屏幕图片
   cp your_splash.png assets/splash.png
   ```

2. **运行构建**
   ```powershell
   cd scripts
   .\start.ps1
   # 选择 4
   ```

3. **查看预览**
   - 浏览器自动打开
   - 检查所有图标
   - 确认后继续

4. **测试APK**
   ```powershell
   adb install android\app\build\outputs\apk\debug\app-debug.apk
   ```

---

**功能就绪！** ✅ 现在可以使用资源自动替换功能了。

**当前项目状态：**
- ✅ logo.png 已存在 (374KB)
- ⚠️ splash.png 未添加 (可选)
- ✅ 替换功能已集成
- ✅ 预览功能可用

**立即体验：** `.\start.ps1` → 选择 `4`
