# Capacitor Android 构建完整流程

## 概述

Capacitor 是一个跨平台应用运行时，可以将 Web 应用（React、Vue、Angular 等）打包成原生 Android/iOS 应用。

## 构建流程图

```
┌─────────────────┐
│  Web 代码       │ (React/Vue/Angular)
│  src/           │
└────────┬────────┘
         │ pnpm run build
         ▼
┌─────────────────┐
│  dist/          │ (编译后的 HTML/JS/CSS)
└────────┬────────┘
         │ npx cap sync android
         ▼
┌─────────────────┐
│  android/       │ (Android Studio 项目)
│  app/src/main/  │
│    ├─ assets/public/  ← Web 资源复制到这里
│    ├─ java/           ← Java/Kotlin 代码
│    └─ res/            ← Android 资源(图标、布局等)
└────────┬────────┘
         │ ./gradlew assembleDebug
         ▼
┌─────────────────┐
│  app-debug.apk  │ (Android 安装包)
└─────────────────┘
```

## 详细步骤

### 步骤 1：初始化 Capacitor

#### 命令
```bash
npx cap init [APP_NAME] [PACKAGE_ID]
```

#### 示例
```bash
npx cap init "cmg_club" "com.ddsj.cmg.club"
```

#### 实现代码（PowerShell）
```powershell
function Initialize-Capacitor {
    param(
        [string]$AppName,       # 技术名称（英文）
        [string]$PackageId,     # Android 包名（反向域名）
        [string]$Prefix         # 变量前缀
    )

    Write-Section "Initializing Capacitor"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix

    # 显示配置信息
    Write-ColorText "[Config] App Name (Technical): $AppName" "Cyan"
    Write-ColorText "[Config] Package ID: $PackageId" "Cyan"

    Push-Location $projectRoot
    try {
        # 执行 Capacitor 初始化命令
        Print-Command "npx cap init `"$AppName`" `"$PackageId`""
        $output = & npx cap init "$AppName" "$PackageId" 2>&1 | Out-String

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Capacitor initialization failed" "Red"
            Write-Host $output

            # 检查是否因为配置文件已存在而失败
            if ($output -match "non-JSON configuration file") {
                # 提示用户删除现有配置文件
                # ... (删除备份逻辑)
            }
        } else {
            Write-ColorText "[Success] Capacitor initialized successfully" "Green"
        }
    } finally {
        Pop-Location
    }
}
```

#### 生成的文件
- `capacitor.config.json` - Capacitor 配置文件
  ```json
  {
    "appId": "com.ddsj.cmg.club",
    "appName": "cmg_club",
    "webDir": "dist",
    "bundledWebRuntime": false
  }
  ```

---

### 步骤 2：添加 Android 平台

#### 命令
```bash
npx cap add android
```

#### 实现代码（PowerShell）
```powershell
function Add-AndroidPlatform {
    param([string]$Prefix)

    Write-Section "Adding Android Platform"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
    $androidPath = Join-Path $projectRoot "android"

    Push-Location $projectRoot
    try {
        # 检查 Android 平台是否已存在
        if (Test-Path $androidPath) {
            Write-ColorText "[Warning] Android platform already exists" "Yellow"

            # 提示用户是否删除并重新添加
            $confirmation = Read-Host "Remove existing android directory? [y/N]"

            if ($confirmation -match '^[Yy]$') {
                # 备份现有目录
                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                $backupPath = "${androidPath}_backup_$timestamp"

                Print-Command "Rename-Item `"$androidPath`" `"$backupPath`""
                Rename-Item -Path $androidPath -NewName "$backupPath" -Force
                Write-ColorText "[Backup] Moved to: .\android_backup_$timestamp" "Green"
            } else {
                Write-ColorText "[Info] Platform addition cancelled" "Cyan"
                return
            }
        }

        # 添加 Android 平台
        Print-Command "npx cap add android"
        & npx cap add android

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Failed to add Android platform" "Red"
        } else {
            Write-ColorText "[Success] Android platform added successfully" "Green"
        }
    } finally {
        Pop-Location
    }
}
```

#### 生成的目录结构
```
android/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── assets/          ← Web 资源将复制到这里
│   │       ├── java/            ← Java/Kotlin 代码
│   │       │   └── com/ddsj/cmg/club/
│   │       │       └── MainActivity.java
│   │       ├── res/             ← Android 资源
│   │       │   ├── drawable/    ← 图标
│   │       │   ├── layout/      ← 布局
│   │       │   ├── values/      ← 字符串、颜色等
│   │       │   └── mipmap-*/    ← 启动图标
│   │       └── AndroidManifest.xml
│   └── build.gradle             ← 应用级 Gradle 配置
├── gradle/
│   └── wrapper/
│       └── gradle-wrapper.properties  ← Gradle 版本配置
├── build.gradle                 ← 项目级 Gradle 配置
├── settings.gradle              ← Gradle 设置
├── gradlew                      ← Gradle 包装器(Linux/Mac)
└── gradlew.bat                  ← Gradle 包装器(Windows)
```

---

### 步骤 3：生成资源文件（图标、启动屏）

#### 命令
```bash
npx @capacitor/assets generate --android
```

#### 实现代码（PowerShell）
```powershell
function Generate-CapacitorAssets {
    param([string]$Prefix)

    Write-Section "Generating Capacitor Assets"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
    $runAssets = Get-VarValue -Key "RUN_CAPACITOR_ASSETS" -Prefix $Prefix

    # 检查是否准备好有效的图标
    if ($runAssets -ne "true") {
        Write-ColorText "[Skip] No valid icon provided" "Yellow"
        return
    }

    Push-Location $projectRoot
    try {
        Write-ColorText "[Assets] Generating Android resources..." "Cyan"
        Print-Command "npx @capacitor/assets generate --android"
        & npx @capacitor/assets generate --android

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Assets generation failed" "Red"
            Write-ColorText "[INFO] Install: pnpm add -D @capacitor/assets" "Yellow"
        } else {
            Write-ColorText "[Success] Assets generated successfully" "Green"
            Write-ColorText "[Info] All icon densities auto-generated" "DarkGray"
        }
    } finally {
        Pop-Location
    }
}
```

#### 生成的资源文件
```
android/app/src/main/res/
├── drawable/              # 通用图标
│   ├── splash.png
│   └── ic_launcher_foreground.xml
├── mipmap-mdpi/          # 中密度 (160dpi)
│   └── ic_launcher.png
├── mipmap-hdpi/          # 高密度 (240dpi)
│   └── ic_launcher.png
├── mipmap-xhdpi/         # 超高密度 (320dpi)
│   └── ic_launcher.png
├── mipmap-xxhdpi/        # 超超高密度 (480dpi)
│   └── ic_launcher.png
├── mipmap-xxxhdpi/       # 超超超高密度 (640dpi)
│   └── ic_launcher.png
└── values/
    └── strings.xml       # 应用名称等字符串
```

---

### 步骤 4：构建 Web 资源

#### 命令
```bash
pnpm run build
```

#### 实现代码（PowerShell）
```powershell
function Build-Web {
    param([string]$Prefix)

    Write-Section "Building Web Assets"

    # 使用通用项目命令执行器
    Invoke-ProjectCommand `
        -Command "pnpm run build" `
        -Description "Web build" `
        -Prefix $Prefix
}
```

#### 底层实现（package.json）
```json
{
  "scripts": {
    "build": "vite build"  // 或 webpack、rollup 等
  }
}
```

#### 生成的文件
```
dist/
├── index.html            # 入口 HTML
├── assets/
│   ├── index-abc123.js   # 编译后的 JavaScript（带哈希）
│   ├── index-def456.css  # 编译后的 CSS（带哈希）
│   └── logo-ghi789.png   # 图片资源（带哈希）
└── favicon.ico
```

---

### 步骤 5：同步到 Android

#### 命令
```bash
npx cap sync android
```

#### 实现代码（PowerShell）
```powershell
function Sync-CapacitorAndroid {
    param([string]$Prefix)

    Write-Section "Syncing Capacitor"

    Invoke-ProjectCommand `
        -Command "npx cap sync android" `
        -Description "Capacitor sync" `
        -Prefix $Prefix
}
```

#### 同步操作详细说明

`npx cap sync android` 执行以下操作：

1. **复制 Web 资源**
   ```
   dist/ → android/app/src/main/assets/public/
   ```

2. **更新插件**
   - 扫描 `package.json` 中的 Capacitor 插件
   - 更新 `android/capacitor.settings.gradle`
   - 添加插件依赖到 `android/app/build.gradle`

3. **更新配置**
   - 读取 `capacitor.config.json`
   - 更新 `AndroidManifest.xml` 中的配置

#### 示例：capacitor.settings.gradle
```gradle
// Auto-generated by Capacitor
include ':capacitor-android'
project(':capacitor-android').projectDir =
    new File('../node_modules/@capacitor/android/capacitor')

include ':capacitor-app'
project(':capacitor-app').projectDir =
    new File('../node_modules/@capacitor/app/android')

include ':capacitor-action-sheet'
project(':capacitor-action-sheet').projectDir =
    new File('../node_modules/@capacitor/action-sheet/android')
```

---

### 步骤 6：构建 Android APK

#### 命令
```bash
cd android
./gradlew assembleDebug
```

#### 实现代码（PowerShell）
```powershell
function Build-AndroidApk {
    param([string]$Prefix)

    Write-Section "Building Android APK"

    $androidPath = Get-VarValue -Key $KEY_ANDROID_PATH -Prefix $Prefix
    $gradlewPath = Join-Path $androidPath "gradlew.bat"

    # 验证 Gradle wrapper 存在
    if (-not (Test-RequiredPath $gradlewPath "Gradle wrapper" "File")) {
        return
    }

    Push-Location $androidPath
    try {
        # === 防止缓存损坏：构建前停止 Gradle Daemon ===
        $stopDaemonFlag = Get-VarValue -Key "STOP_GRADLE_DAEMON_BEFORE_BUILD" -Prefix $Prefix
        if ($stopDaemonFlag -eq "true") {
            Write-ColorText "[Gradle] Stopping Gradle Daemon..." "Cyan"
            Print-Command ".\gradlew.bat --stop"
            & .\gradlew.bat --stop
            Start-Sleep -Seconds 2
            Write-ColorText "[Gradle] Daemon stopped" "Green"
        }

        # === 第一次构建尝试 ===
        Print-Command ".\gradlew.bat assembleDebug"
        & .\gradlew.bat assembleDebug

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Android build failed" "Red"
            Write-ColorText "[INFO] Attempting cache cleanup..." "Yellow"

            # === 构建失败：自动修复流程 ===

            # Step 1: 停止所有 Gradle Daemon
            Write-ColorText "`n[Gradle] Stopping all Daemons..." "Cyan"
            Print-Command ".\gradlew.bat --stop"
            & .\gradlew.bat --stop
            Start-Sleep -Seconds 2

            # Step 2: 清理构建目录
            Write-ColorText "`n[Gradle] Cleaning build directory..." "Cyan"
            Print-Command ".\gradlew.bat clean"
            & .\gradlew.bat clean

            # Step 3: 清理 Gradle 用户缓存
            $gradleCacheDir = "$env:USERPROFILE\.gradle\caches"
            if (Test-Path $gradleCacheDir) {
                Write-ColorText "[Gradle] Clearing caches: $gradleCacheDir" "Cyan"
                try {
                    Remove-Item -Path "$gradleCacheDir\*" -Recurse -Force -ErrorAction SilentlyContinue
                    Write-ColorText "[Gradle] Cache cleared" "Green"
                } catch {
                    Write-ColorText "[Gradle] Warning: Partial clear only" "Yellow"
                }
            }

            # Step 4: 重试构建
            Write-ColorText "`n[Gradle] Retrying build..." "Cyan"
            Print-Command ".\gradlew.bat assembleDebug"
            & .\gradlew.bat assembleDebug

            if ($LASTEXITCODE -ne 0) {
                Write-ColorText "[ERROR] Build failed after cleanup" "Red"
                Write-ColorText "[SOLUTION] Manual steps:" "Yellow"
                Write-ColorText "  cd android" "DarkGray"
                Write-ColorText "  .\gradlew.bat --stop" "DarkGray"
                Write-ColorText "  .\gradlew.bat clean build --refresh-dependencies" "DarkGray"
            } else {
                Write-ColorText "[Success] APK built after retry" "Green"
            }
        } else {
            Write-ColorText "[Success] Android build completed" "Green"
        }

        # === 显示 APK 位置 ===
        $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            $fullPath = (Get-Item $apkPath).FullName
            Write-ColorText "`n[APK] $fullPath" "Green"
        } else {
            Write-ColorText "[Output] APK: android\app\build\outputs\apk\debug\" "Cyan"
        }
    } finally {
        Pop-Location
    }
}
```

#### Gradle 构建详细过程

**1. 配置阶段（Configuration Phase）**
```gradle
// build.gradle (Project level)
buildscript {
    repositories {
        google()        // Google Maven 仓库
        mavenCentral()  // Maven 中央仓库
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.1'
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

**2. 解析依赖**
```gradle
// app/build.gradle
dependencies {
    implementation "androidx.appcompat:appcompat:1.6.1"
    implementation project(':capacitor-android')
    implementation project(':capacitor-app')
    implementation project(':capacitor-action-sheet')
    // ... 更多 Capacitor 插件
}
```

**3. 编译 Java/Kotlin 代码**
```
src/main/java/ → .class 文件 → DEX 文件
```

**4. 处理资源**
```
res/ → 编译 → resources.arsc
```

**5. 打包 APK**
```
APK 结构：
├── AndroidManifest.xml      # 应用清单
├── classes.dex              # Dalvik 可执行文件
├── resources.arsc           # 资源表
├── res/                     # 资源文件
├── assets/                  # 资产文件
│   └── public/              # ← Web 应用在这里
│       ├── index.html
│       └── assets/
└── META-INF/                # 签名信息
    ├── MANIFEST.MF
    ├── CERT.SF
    └── CERT.RSA
```

**6. 签名 APK**
```
Debug 签名：使用 ~/.android/debug.keystore
Release 签名：使用自定义密钥库
```

---

## 关键配置文件

### capacitor.config.json
```json
{
  "appId": "com.ddsj.cmg.club",
  "appName": "CMG Club",
  "webDir": "dist",
  "bundledWebRuntime": false,
  "android": {
    "buildOptions": {
      "keystorePath": "/path/to/keystore.jks",
      "keystoreAlias": "my-key-alias"
    }
  }
}
```

### android/app/build.gradle
```gradle
apply plugin: 'com.android.application'

android {
    namespace "com.ddsj.cmg.club"
    compileSdk 34

    defaultConfig {
        applicationId "com.ddsj.cmg.club"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt')
        }
    }
}

dependencies {
    implementation fileTree(include: ['*.jar'], dir: 'libs')
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation project(':capacitor-android')
    implementation project(':capacitor-cordova-android-plugins')
}

apply from: 'capacitor.build.gradle'
```

### android/gradle/wrapper/gradle-wrapper.properties
```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.2.1-all.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

---

## 常见构建错误和解决方案

### 错误 1：Failed to create Jar file

**原因**：
- Windows Defender/杀毒软件干扰
- Gradle 缓存损坏
- 并发 Daemon 冲突

**解决方案**：
```powershell
# 1. 添加 Windows Defender 排除项
# 路径：C:\Users\USERNAME\.gradle

# 2. 清理缓存
.\gradlew.bat --stop
Remove-Item -Path "$env:USERPROFILE\.gradle\caches\*" -Recurse -Force

# 3. 重新构建
.\gradlew.bat assembleDebug
```

### 错误 2：Could not resolve dependencies

**原因**：
- 网络连接问题
- Maven 仓库不可达
- 依赖版本冲突

**解决方案**：
```gradle
// 添加国内镜像（build.gradle）
repositories {
    maven { url 'https://maven.aliyun.com/repository/google' }
    maven { url 'https://maven.aliyun.com/repository/central' }
    google()
    mavenCentral()
}
```

### 错误 3：Execution failed for task ':app:processDebugResources'

**原因**：
- 资源文件损坏
- XML 格式错误
- 图片尺寸不符合要求

**解决方案**：
```powershell
# 清理构建并重新生成资源
.\gradlew.bat clean
npx @capacitor/assets generate --android
.\gradlew.bat assembleDebug
```

---

## 优化建议

### 1. 加速构建

**启用 Gradle 守护进程**
```properties
# ~/.gradle/gradle.properties
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.caching=true
```

**使用本地缓存**
```gradle
buildscript {
    repositories {
        mavenLocal()  // 优先使用本地缓存
        google()
        mavenCentral()
    }
}
```

### 2. 减小 APK 大小

**启用代码压缩**
```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
    }
}
```

**使用 WebP 图片**
```bash
# 转换 PNG 到 WebP
npx @squoosh/cli --webp auto assets/*.png
```

### 3. 自动化构建

**使用 CI/CD**
```yaml
# .github/workflows/android.yml
name: Android Build
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Build web
        run: pnpm run build

      - name: Sync Capacitor
        run: npx cap sync android

      - name: Build APK
        run: |
          cd android
          ./gradlew assembleDebug

      - name: Upload APK
        uses: actions/upload-artifact@v2
        with:
          name: app-debug
          path: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 参考资料

- [Capacitor 官方文档](https://capacitorjs.com/docs)
- [Android Gradle Plugin 文档](https://developer.android.com/studio/build)
- [Gradle 构建生命周期](https://docs.gradle.org/current/userguide/build_lifecycle.html)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)

---

**文档版本**：1.0
**更新日期**：2025-12-10
**作者**：Claude Code
