# HoloFortune - React Native

这是一个完整的React Native应用，可以在本地编译为Android和iOS应用，不依赖Expo。

## 快速开始

### 使用启动脚本（推荐）

启动脚本会自动检测并安装依赖，然后提供交互式菜单选择模式：

**Windows:**
```powershell
# PowerShell (推荐)
npm run start:ps1
# 或直接运行
powershell -ExecutionPolicy Bypass -File scripts/start.ps1

# 批处理脚本
npm run start:win
# 或直接运行
scripts\start.bat
```

**macOS/Linux:**
```bash
npm run start:unix
# 或直接运行
bash scripts/start.sh
```

**跨平台 (Node.js):**
```bash
npm run start:script
# 或直接运行
node scripts/start.js
```

启动脚本提供以下选项：
1. **调试模式** - 启动 Metro bundler 和开发服务器
2. **构建 Android Debug** - 构建 Android Debug APK
3. **构建 Android Release** - 构建 Android Release APK
4. **仅启动 Metro** - 只启动 Metro bundler
5. **清理并重新安装** - 清理并重新安装依赖

### 手动安装依赖

```bash
npm install
```

## Android 开发

### 前置要求
- Node.js 18+
- Java JDK 11+
- Android Studio
- Android SDK

### 运行

```bash
# 启动 Metro bundler
npm start

# 在另一个终端运行 Android
npm run android
```

## iOS 开发 (仅 macOS)

### 前置要求
- Node.js 18+
- Xcode
- CocoaPods

### 安装 iOS 依赖

```bash
cd ios
pod install
cd ..
```

### 运行

```bash
npm run ios
```

## 项目结构

- `App.tsx` - 主应用入口，包含导航配置
- `pages/` - 所有页面组件
- `components/` - 共享组件
- `store/` - 状态管理（使用Context API）
- `services/` - API服务
- `types.ts` - TypeScript类型定义

## 主要依赖

- React Native 0.73.0
- React Navigation - 路由导航
- React Native Maps - 地图功能
- React Native Vector Icons - 图标
- AsyncStorage - 本地存储
- Google Gemini AI - AI服务

## 环境变量

创建 `.env` 文件并添加：

```
GEMINI_API_KEY=your_api_key_here
```

## 构建发布版本

### Android

**使用脚本:**
```bash
npm run build:android        # Release 版本
npm run build:android:debug # Debug 版本
```

**手动构建:**
```bash
cd android
./gradlew assembleRelease   # Release 版本
./gradlew assembleDebug     # Debug 版本
```

构建完成后，APK 文件位于：
- Release: `android/app/build/outputs/apk/release/app-release.apk`
- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`

### iOS

**使用脚本:**
```bash
npm run build:ios
```

**手动构建:**
在Xcode中打开 `ios/holofortune.xcworkspace`，然后选择 Product > Archive。

## 清理项目

```bash
npm run clean          # 清理所有构建文件和依赖
npm run clean:install  # 清理并重新安装所有依赖
```

