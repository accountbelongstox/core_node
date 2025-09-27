# Flutter Bloom 权限配置分析工具

## 📋 概述

本工具用于分析 Flutter Bloom 项目中的 Android、iOS 和 Web 平台权限配置，提供完整的权限清单和搜索功能。

## 📁 生成的文件

### 1. 权限配置清单
- **文件**: `auth_manifest_list.txt`
- **内容**: 完整的权限配置文件清单，包含所有平台的权限详情

### 2. 权限搜索脚本
- **文件**: `search_auth_files.py`
- **功能**: 智能搜索和分析权限配置文件

## 🔍 权限配置概览

### Android 平台 (14个权限)
```
✓ android.permission.INTERNET
✓ android.permission.ACCESS_FINE_LOCATION
✓ android.permission.ACCESS_COARSE_LOCATION
✓ android.permission.ACCESS_BACKGROUND_LOCATION
✓ android.permission.READ_PHONE_STATE
✓ android.permission.READ_PHONE_NUMBERS
✓ android.permission.READ_EXTERNAL_STORAGE
✓ android.permission.WRITE_EXTERNAL_STORAGE
✓ android.permission.MANAGE_EXTERNAL_STORAGE
✓ android.permission.CAMERA
✓ android.permission.RECORD_AUDIO
✓ FEATURE: android.hardware.camera
✓ FEATURE: android.hardware.camera.autofocus
✓ FEATURE: android.hardware.microphone
```

### iOS 平台 (17个权限)
```
✓ NSCameraUsageDescription
✓ NSMicrophoneUsageDescription
✓ NSLocationWhenInUseUsageDescription
✓ NSLocationAlwaysAndWhenInUseUsageDescription
✓ NSLocationAlwaysUsageDescription
✓ NSPhotoLibraryUsageDescription
✓ NSPhotoLibraryAddUsageDescription
✓ NSContactsUsageDescription
✓ NSDocumentsFolderUsageDescription
✓ NSDownloadsFolderUsageDescription
✓ NSDesktopFolderUsageDescription
✓ NSUserTrackingUsageDescription
✓ NSAppleMusicUsageDescription
✓ BACKGROUND_MODE: location
✓ BACKGROUND_MODE: audio
✓ BACKGROUND_MODE: fetch
✓ BACKGROUND_MODE: remote-notification
```

## 🛠️ 搜索脚本使用方法

### 基本命令

```bash
# 显示所有权限配置文件
python search_auth_files.py

# 显示权限摘要报告
python search_auth_files.py --summary

# 搜索特定文件
python search_auth_files.py AndroidManifest
python search_auth_files.py Info.plist
python search_auth_files.py build.gradle

# 显示文件内容
python search_auth_files.py AndroidManifest --content
python search_auth_files.py Info.plist --content
```

### 命令参数

| 参数 | 简写 | 说明 |
|------|------|------|
| `--content` | `-c` | 显示文件内容 |
| `--summary` | `-s` | 显示权限摘要报告 |

### 使用示例

```bash
# 1. 查看所有权限配置文件
python search_auth_files.py

# 2. 生成权限摘要报告
python search_auth_files.py --summary

# 3. 搜索Android权限配置
python search_auth_files.py AndroidManifest

# 4. 查看iOS权限配置详情
python search_auth_files.py Info.plist --content

# 5. 搜索构建配置文件
python search_auth_files.py build.gradle
```

## 📊 配置文件统计

| 平台 | 文件数量 | 主要文件 |
|------|----------|----------|
| Android | 7个 | AndroidManifest.xml, build.gradle |
| iOS | 3个 | Info.plist, Podfile |
| Web | 2个 | manifest.json, index.html |
| 项目配置 | 2个 | pubspec.yaml, flutter_native_splash.yaml |
| **总计** | **14个** | - |

## ⚠️ 权限风险评估

### 🔴 高风险权限
- `MANAGE_EXTERNAL_STORAGE` - 管理所有文件权限
- `ACCESS_BACKGROUND_LOCATION` - 后台位置权限
- `READ_PHONE_STATE` - 读取设备状态
- `READ_PHONE_NUMBERS` - 读取手机号码

### 🟡 中等风险权限
- `CAMERA` - 相机权限
- `RECORD_AUDIO` - 录音权限
- `ACCESS_FINE_LOCATION` - 精确位置权限

### 🟢 低风险权限
- `INTERNET` - 网络访问
- `READ_EXTERNAL_STORAGE` - 读取存储
- `WRITE_EXTERNAL_STORAGE` - 写入存储

## 🔧 配置文件路径

### Android
```
android/app/src/main/AndroidManifest.xml      # 主要权限配置
android/app/src/debug/AndroidManifest.xml     # 调试权限配置
android/app/src/profile/AndroidManifest.xml   # 性能分析权限配置
android/app/build.gradle                      # 应用构建配置
android/build.gradle                          # 项目构建配置
android/gradle.properties                     # Gradle属性配置
android/app/proguard-rules.pro               # 代码混淆规则
```

### iOS
```
ios/Runner/Info.plist                         # 主要权限配置
ios/Podfile                                   # 依赖管理配置
ios/Runner.xcodeproj/project.pbxproj          # Xcode项目配置
```

### Web
```
web/manifest.json                             # Web应用清单
web/index.html                                # Web入口文件
```

### 项目配置
```
pubspec.yaml                                  # Flutter项目配置
flutter_native_splash.yaml                    # 启动画面配置
```

## 💡 建议优化

1. **权限最小化**: 移除不必要的高风险权限
2. **运行时权限**: 实现动态权限请求
3. **权限说明**: 添加详细的权限使用说明
4. **定期审查**: 定期检查权限需求变化
5. **安全审计**: 进行权限安全审计

## 🚀 快速开始

1. 查看权限摘要:
   ```bash
   python search_auth_files.py --summary
   ```

2. 搜索特定配置:
   ```bash
   python search_auth_files.py AndroidManifest
   ```

3. 查看详细内容:
   ```bash
   python search_auth_files.py Info.plist --content
   ```

## 📝 注意事项

- 脚本会自动检测项目根目录
- 支持中文路径和文件名
- 权限分析基于正则表达式匹配
- 建议定期更新权限配置清单

---

**生成时间**: 2025-01-27  
**项目路径**: `D:\programing\core_node\poly_apps\flutter_bloom`  
**工具版本**: v1.0
