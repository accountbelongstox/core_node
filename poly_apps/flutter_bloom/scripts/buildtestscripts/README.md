# Flutter Splash Screen Auto Replacer

自动化Flutter启动图替换工具，支持多种图片格式自动转换和配置生成。

## 功能特性

- 🔍 **智能图片查找**: 自动按优先级查找背景图片 (jpg → png → webp)
- 🔄 **格式自动转换**: 使用Python PIL库自动转换图片格式为PNG
- ⚙️ **配置自动生成**: 自动生成flutter_native_splash.yaml配置文件
- 🎨 **全屏启动图**: 支持真正的全屏背景图片启动屏幕
- 🖼️ **双模式支持**: 全屏背景模式 或 背景+Logo模式
- 🌙 **深色模式支持**: 自动配置深色模式启动屏幕
- 📱 **多平台支持**: 支持Android、iOS、Web平台
- 🔧 **Android 12+兼容**: 自动配置Android 12+启动屏幕
- 📐 **Android填充优化**: 使用`android_gravity: fill`确保全屏显示

## 目录结构

```
scripts/buildtestscripts/
├── splash_replacer.ps1      # 主PowerShell脚本
├── splash_helper.py         # Python辅助脚本
├── run_splash_replacer.ps1  # 快速启动脚本
└── README.md               # 说明文档
```

## 启动图模式说明

### 🎨 全屏背景模式（默认，推荐）
- **特点**: 背景图片拉伸填充整个屏幕，无Logo覆盖
- **效果**: 真正的全屏启动图体验
- **适用**: 背景图片本身已包含Logo或品牌元素
- **配置**: 只使用`background_image`，不设置`image`参数

### 🖼️ 背景+Logo模式
- **特点**: 背景图片 + 居中Logo图标
- **效果**: 传统的启动屏幕样式
- **适用**: 需要在背景上显示独立Logo的场景
- **配置**: 同时设置`background_image`和`image`参数

## 使用方法

### 方法1: 快速使用（推荐）

```powershell
# 使用默认应用名称 "qy" - 全屏背景模式
.\run_splash_replacer.ps1

# 指定应用名称 - 全屏背景模式
.\run_splash_replacer.ps1 -AppName "bank"

# 背景图 + Logo模式
.\run_splash_replacer.ps1 -AppName "qy" -WithLogo
```

### 方法2: 直接调用主脚本

```powershell
# 基本用法 - 全屏背景模式（默认）
.\splash_replacer.ps1 -AppName "qy"

# 背景图 + Logo模式
.\splash_replacer.ps1 -AppName "qy" -WithLogo

# 指定项目根目录
.\splash_replacer.ps1 -AppName "qy" -ProjectRoot "D:\your\project\path"

# 强制覆盖现有配置
.\splash_replacer.ps1 -AppName "qy" -Force
```

## 资源文件要求

### 目录结构
脚本会在以下目录查找资源文件：
```
assets/apps/app_{AppName}/
├── launch/
│   ├── background.jpg    # 背景图片（优先级1）
│   ├── background.png    # 背景图片（优先级2）
│   └── background.webp   # 背景图片（优先级3）
└── icons/
    └── splash_logo.png   # 启动Logo（可选）
```

### 图片要求
- **背景图片**: 建议尺寸 1080x1920 或更高分辨率
- **Logo图片**: 建议尺寸 512x512，PNG格式，透明背景
- **支持格式**: JPG, JPEG, PNG, WebP

## 工作流程

1. **图片查找**: 按优先级在`assets/apps/app_{AppName}/launch/`目录查找背景图片
2. **格式转换**: 如果图片不是PNG格式，自动转换为PNG
3. **文件复制**: 将图片复制到`assets/common/launch/`目录
4. **配置生成**: 生成`flutter_native_splash.yaml`配置文件
5. **应用启动图**: 运行`dart run flutter_native_splash:create`

## 生成的配置示例

### 全屏背景模式配置
```yaml
flutter_native_splash:
  android: true
  android_12:
    color: '#667eea'
    color_dark: '#121212'
    icon_background_color: '#667eea'
    icon_background_color_dark: '#121212'
  android_gravity: fill
  background_image: assets/common/launch/splash_bg.png
  background_image_dark: assets/common/launch/splash_bg.png
  ios: true
  web: true
```

### 背景+Logo模式配置
```yaml
flutter_native_splash:
  background_image: assets/common/launch/splash_bg.png
  image: assets/common/launch/splash_logo.png
  background_image_dark: assets/common/launch/splash_bg.png
  image_dark: assets/common/launch/splash_logo.png
  android_12:
    color: '#667eea'
    icon_background_color: '#667eea'
    image: assets/common/launch/splash_logo.png
    color_dark: '#121212'
    icon_background_color_dark: '#121212'
    image_dark: assets/common/launch/splash_logo.png
  android: true
  ios: true
  web: true
```

## Python辅助脚本功能

### 图片转换
```bash
python splash_helper.py convert --input input.jpg --output output.png --format png
```

### 配置生成
```bash
python splash_helper.py config \
  --app-name qy \
  --background-image assets/bg.png \
  --logo-image assets/logo.png \
  --output flutter_native_splash.yaml
```

### 图片优化
```bash
python splash_helper.py optimize \
  --input large_image.png \
  --output optimized.png \
  --max-width 1080 \
  --max-height 1920
```

## 依赖要求

### PowerShell
- Windows PowerShell 5.1+ 或 PowerShell Core 7+

### Python
- Python 3.7+
- PIL (Pillow): `pip install Pillow`
- PyYAML: `pip install PyYAML`

### Flutter
- Flutter SDK
- flutter_native_splash包已添加到pubspec.yaml

## 故障排除

### 常见问题

1. **找不到背景图片**
   - 检查`assets/apps/app_{AppName}/launch/`目录是否存在
   - 确认图片文件名为`background.{jpg|png|webp}`

2. **Python脚本执行失败**
   - 安装必要的Python包：`pip install Pillow PyYAML`
   - 检查Python是否在PATH环境变量中

3. **Flutter命令失败**
   - 运行`flutter doctor`检查Flutter环境
   - 确保在项目根目录执行脚本

4. **权限错误**
   - 以管理员身份运行PowerShell
   - 检查文件和目录的读写权限

### 调试模式
在PowerShell脚本中添加`-Verbose`参数可以看到详细的执行信息：
```powershell
.\splash_replacer.ps1 -AppName "qy" -Verbose
```

## 示例用法

### 为app_qy应用设置启动图
```powershell
# 1. 确保资源文件存在
# assets/apps/app_qy/launch/background.jpg
# assets/apps/app_qy/icons/splash_logo.png

# 2. 运行脚本
.\run_splash_replacer.ps1 -AppName "qy"

# 3. 测试应用
flutter clean
flutter run
```

### 为app_bank应用设置启动图
```powershell
# 1. 准备资源文件
# assets/apps/app_bank/launch/background.png

# 2. 运行脚本
.\splash_replacer.ps1 -AppName "bank"

# 3. 构建APK
flutter build apk --release
```

## 注意事项

- 脚本会覆盖现有的`flutter_native_splash.yaml`配置文件
- 建议在运行脚本前备份重要的配置文件
- 转换后的图片会保存在临时位置，原始文件不会被修改
- Android 12+的启动屏幕有特殊要求，脚本会自动处理兼容性

## 更新日志

### v1.0.0 (2025-09-24)
- 初始版本发布
- 支持自动图片查找和格式转换
- 支持配置文件自动生成
- 支持多平台启动屏幕配置
