<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Flutter Native Splash 使用文档

## 简介
当应用程序启动时，在原生应用加载 Flutter 的过程中会有短暂的等待时间。默认情况下，这段时间会显示一个白色的启动屏幕。这个包可以自动生成 iOS、Android 和 Web 原生代码，用于自定义原生启动屏幕的背景颜色和启动图片。支持深色模式、全屏显示和平台特定选项。

## 最新特性
- Web 端支持 GIF 图片
- 可以在应用初始化时保持启动屏幕显示！不再需要二级启动屏幕。只需使用 preserve 和 remove 方法来控制启动屏幕的移除时机。

## 使用方法

### 1. 添加依赖
在 pubspec.yaml 文件中添加依赖：
```yaml
dependencies:
  flutter_native_splash: ^2.4.6
```

### 2. 配置启动屏幕
在项目根目录创建 `flutter_native_splash.yaml` 文件或在 `pubspec.yaml` 中添加以下配置：

```yaml
flutter_native_splash:
  # 必需参数：color 或 background_image 二选一
  color: "#42a5f5"  # 设置纯色背景
  #background_image: "assets/background.png"  # 设置背景图片

  # 可选参数
  #image: assets/splash.png  # 启动图片
  #branding: assets/dart.png  # 品牌图片
  #branding_mode: bottom  # 品牌图片位置

  # 深色模式配置
  #color_dark: "#042a49"
  #image_dark: assets/splash-invert.png

  # Android 12 及以上的特殊配置
  android_12:
    #image: assets/android12splash.png
    #color: "#42a5f5"
    #icon_background_color: "#111111"

  # 禁用特定平台的启动屏幕
  #android: false
  #ios: false
  #web: false
```

### 3. 生成启动屏幕
运行以下命令生成启动屏幕：
```bash
dart run flutter_native_splash:create
```

### 4. 应用初始化设置（可选）
如果需要在应用初始化完成后再移除启动屏幕：

```dart
import 'package:flutter_native_splash/flutter_native_splash.dart';

void main() {
  WidgetsBinding widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);
  runApp(const MyApp());
}

// 初始化完成后移除启动屏幕：
FlutterNativeSplash.remove();
```

## Android 12+ 注意事项
- Android 12 使用新的启动屏幕方式，包括窗口背景、图标和图标背景
- 不支持背景图片
- 图标尺寸要求：
  - 无图标背景：1152×1152 像素，适配 768 像素直径的圆形
  - 有图标背景：960×960 像素，适配 640 像素直径的圆形

## 常见问题
1. 模块未找到错误：需要在 iOS 文件夹中运行 pod install
2. iOS 上启动屏幕闪烁：可能是缓存问题，需要卸载应用并重启设备
3. 启动屏幕和应用之间出现白屏：使用 preserve 和 remove 方法来控制启动屏幕的移除时机
4. 无法基于应用设置控制明暗模式：因为启动屏幕在 Flutter 加载前显示，无法访问应用设置

## 工作原理
### Android
- 调整启动图片尺寸适配不同分辨率
- 修改 launch_background.xml 和 styles.xml
- 支持深色模式资源

### iOS
- 生成 @2x 和 @3x 图片
- 修改 LaunchScreen.storyboard
- 通过拉伸单像素图片实现背景色

### Web
- 创建 web/splash 文件夹
- 生成多种分辨率的图片
- 修改 index.html
