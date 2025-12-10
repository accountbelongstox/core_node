# ==========================================
# Capacitor Action Sheet 版本冲突修复脚本
# ==========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Capacitor Action Sheet 版本冲突修复" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$androidPath = "D:\programing\core_node\poly_apps\cmg-corporate-portal\android"

# 检测问题
Write-Host "[诊断] 检查当前环境..." -ForegroundColor Yellow
Write-Host ""

# 检查 Java 版本
Write-Host "Java 版本:" -ForegroundColor Cyan
java -version 2>&1 | Select-Object -First 1
Write-Host ""

# 显示发现的问题
Write-Host "发现的问题:" -ForegroundColor Red
Write-Host "  × action-sheet 要求 Java 21，但系统只有 Java 17" -ForegroundColor Red
Write-Host "  × action-sheet 要求 AGP 8.13.0，但项目使用 AGP 8.2.1" -ForegroundColor Red
Write-Host "  × 12 个停止的 Gradle Daemon 可能持有文件锁" -ForegroundColor Red
Write-Host ""

# Step 1: 杀死所有 Gradle 进程
Write-Host "[Step 1/4] 强制杀死所有 Gradle 进程..." -ForegroundColor Yellow
Push-Location $androidPath

# 停止 Gradle Daemon
& .\gradlew.bat --stop 2>&1 | Out-Null
Start-Sleep -Seconds 3

# 强制杀死所有 Java 进程（Gradle Daemon）
$javaProcesses = Get-Process -Name "java" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*gradle*" -or $_.CommandLine -like "*gradle*"
}

if ($javaProcesses) {
    Write-Host "  找到 $($javaProcesses.Count) 个 Gradle Java 进程，正在终止..." -ForegroundColor Gray
    $javaProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Pop-Location
Write-Host "[✓] 所有 Gradle 进程已终止" -ForegroundColor Green
Write-Host ""

# Step 2: 完全清理 Gradle 缓存
Write-Host "[Step 2/4] 完全清理 Gradle 缓存..." -ForegroundColor Yellow

$gradleHome = "$env:USERPROFILE\.gradle"
$cacheDirs = @(
    "$gradleHome\caches\jars-9",
    "$gradleHome\caches\transforms-3",
    "$gradleHome\caches\modules-2",
    "$gradleHome\daemon"
)

foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
        Write-Host "  正在清理: $dir" -ForegroundColor Gray
        Remove-Item -Path "$dir\*" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "[✓] Gradle 缓存已清理" -ForegroundColor Green
Write-Host ""

# Step 3: 覆盖 action-sheet 的版本要求
Write-Host "[Step 3/4] 修复 action-sheet 版本兼容性..." -ForegroundColor Yellow

$variablesGradle = Join-Path $androidPath "variables.gradle"

# 读取现有内容
$content = Get-Content $variablesGradle -Raw

# 检查是否已经添加了覆盖
if ($content -notmatch "// Capacitor Action Sheet version override") {
    Write-Host "  正在添加版本覆盖配置..." -ForegroundColor Gray

    # 在 ext { } 块末尾添加覆盖配置
    $override = @"

    // Capacitor Action Sheet version override
    // 强制使用项目统一的版本，忽略插件自带的配置
}

// 为所有子项目设置统一的 Java 版本和 AGP 版本
subprojects {
    // 如果是 Capacitor 插件，覆盖其 buildscript
    if (project.name.startsWith('capacitor-')) {
        buildscript {
            dependencies {
                // 强制使用项目统一的 AGP 版本
                classpath('com.android.tools.build:gradle') {
                    version {
                        strictly '8.2.1'
                    }
                }
            }
        }
    }

    // 强制所有项目使用 Java 17
    afterEvaluate {
        if (project.hasProperty('android')) {
            android {
                compileOptions {
                    sourceCompatibility JavaVersion.VERSION_17
                    targetCompatibility JavaVersion.VERSION_17
                }
            }
        }
    }
"@

    # 替换最后一个 }
    $content = $content -replace '}\s*$', $override

    # 写回文件
    Set-Content -Path $variablesGradle -Value $content -Encoding UTF8

    Write-Host "[✓] 版本覆盖配置已添加" -ForegroundColor Green
} else {
    Write-Host "[i] 版本覆盖配置已存在" -ForegroundColor Gray
}

Write-Host ""

# Step 4: 清理项目并重新构建
Write-Host "[Step 4/4] 清理项目并重新构建..." -ForegroundColor Yellow
Push-Location $androidPath

Write-Host "  正在清理项目..." -ForegroundColor Gray
& .\gradlew.bat clean --no-daemon 2>&1 | Out-Null

Write-Host "  正在构建 APK..." -ForegroundColor Gray
& .\gradlew.bat assembleDebug --no-daemon --refresh-dependencies
$exitCode = $LASTEXITCODE

Pop-Location
Write-Host ""

if ($exitCode -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ 修复成功！构建完成！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK 位置: $androidPath\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Cyan
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "× 构建仍然失败" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "请尝试以下方案：" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "方案 1：降级 Capacitor Action Sheet 到 6.x" -ForegroundColor Cyan
    Write-Host "  cd .." -ForegroundColor Gray
    Write-Host "  pnpm remove @capacitor/action-sheet" -ForegroundColor Gray
    Write-Host "  pnpm add @capacitor/action-sheet@6.0.0" -ForegroundColor Gray
    Write-Host "  npx cap sync android" -ForegroundColor Gray
    Write-Host ""
    Write-Host "方案 2：升级 Java 到 21" -ForegroundColor Cyan
    Write-Host "  下载 JDK 21: https://www.oracle.com/java/technologies/downloads/#java21" -ForegroundColor Gray
    Write-Host "  安装后设置 JAVA_HOME 环境变量" -ForegroundColor Gray
    Write-Host ""
    Write-Host "方案 3：手动编辑 action-sheet 的 build.gradle" -ForegroundColor Cyan
    Write-Host "  文件位置: node_modules\.pnpm\@capacitor+action-sheet@8.0.0_*\...\build.gradle" -ForegroundColor Gray
    Write-Host "  修改 line 19: classpath 'com.android.tools.build:gradle:8.2.1'" -ForegroundColor Gray
    Write-Host "  修改 line 53-54: JavaVersion.VERSION_17" -ForegroundColor Gray
}

Write-Host ""
