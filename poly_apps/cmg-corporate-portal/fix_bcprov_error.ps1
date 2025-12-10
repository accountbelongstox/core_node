# 快速修复脚本
# bcprov-jdk18on-1.79.jar 构建失败自动修复

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "bcprov JAR 构建失败自动修复工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: 停止所有 Gradle Daemon
Write-Host "[Step 1/5] 停止所有 Gradle Daemon..." -ForegroundColor Yellow
$androidPath = "D:\programing\core_node\poly_apps\cmg-corporate-portal\android"
Push-Location $androidPath
& .\gradlew.bat --stop
Start-Sleep -Seconds 5
Pop-Location
Write-Host "[✓] Gradle Daemon 已停止" -ForegroundColor Green
Write-Host ""

# Step 2: 删除损坏的 bcprov 缓存
Write-Host "[Step 2/5] 删除损坏的 bcprov 缓存..." -ForegroundColor Yellow
$bcprovCacheDir = "$env:USERPROFILE\.gradle\caches\jars-9\18366b31678c0171857be093a3b8ec22"
if (Test-Path $bcprovCacheDir) {
    Remove-Item -Path $bcprovCacheDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[✓] bcprov 缓存已删除" -ForegroundColor Green
} else {
    Write-Host "[i] bcprov 缓存不存在，跳过" -ForegroundColor Gray
}
Write-Host ""

# Step 3: 清理整个 jars-9 目录
Write-Host "[Step 3/5] 清理整个 jars-9 目录..." -ForegroundColor Yellow
$jars9Dir = "$env:USERPROFILE\.gradle\caches\jars-9"
if (Test-Path $jars9Dir) {
    Remove-Item -Path "$jars9Dir\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[✓] jars-9 目录已清理" -ForegroundColor Green
} else {
    Write-Host "[i] jars-9 目录不存在，跳过" -ForegroundColor Gray
}
Write-Host ""

# Step 4: 清理项目构建目录
Write-Host "[Step 4/5] 清理项目构建目录..." -ForegroundColor Yellow
Push-Location $androidPath
& .\gradlew.bat clean
Pop-Location
Write-Host "[✓] 项目已清理" -ForegroundColor Green
Write-Host ""

# Step 5: 检查 Windows Defender 排除项
Write-Host "[Step 5/5] 检查 Windows Defender 排除项..." -ForegroundColor Yellow
Write-Host ""
Write-Host "重要提示：" -ForegroundColor Red
Write-Host "你必须将以下文件夹添加到 Windows Defender 排除项中：" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. $env:USERPROFILE\.gradle" -ForegroundColor Cyan
Write-Host "  2. D:\programing\core_node\poly_apps\cmg-corporate-portal" -ForegroundColor Cyan
Write-Host ""
Write-Host "步骤：" -ForegroundColor Yellow
Write-Host "  a. 按 Win + I 打开设置" -ForegroundColor Gray
Write-Host "  b. Privacy & Security → Windows Security" -ForegroundColor Gray
Write-Host "  c. Virus & threat protection → Manage settings" -ForegroundColor Gray
Write-Host "  d. Exclusions → Add or remove exclusions" -ForegroundColor Gray
Write-Host "  e. 添加上述两个文件夹" -ForegroundColor Gray
Write-Host ""

$confirmation = Read-Host "你是否已经添加了排除项？(y/n)"

if ($confirmation -match '^[Yy]$') {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "准备重新构建..." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""

    Write-Host "开始构建 Android APK..." -ForegroundColor Yellow
    Push-Location $androidPath
    & .\gradlew.bat assembleDebug
    $exitCode = $LASTEXITCODE
    Pop-Location

    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "构建成功！" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "APK 位置: $androidPath\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Cyan
    } else {
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "构建失败" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "请尝试手动下载 JAR 文件：" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "1. 下载 bcprov-jdk18on-1.79.jar：" -ForegroundColor Cyan
        Write-Host "   https://repo1.maven.org/maven2/org/bouncycastle/bcprov-jdk18on/1.79/bcprov-jdk18on-1.79.jar" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. 将文件复制到：" -ForegroundColor Cyan
        Write-Host "   $bcprovCacheDir\bcprov-jdk18on-1.79.jar" -ForegroundColor Gray
        Write-Host ""
        Write-Host "3. 重新运行此脚本" -ForegroundColor Cyan
    }
} else {
    Write-Host ""
    Write-Host "请先添加 Windows Defender 排除项，然后重新运行此脚本。" -ForegroundColor Yellow
    Write-Host ""

    # 自动打开 Windows Security
    $openSecurity = Read-Host "是否自动打开 Windows Security？(y/n)"
    if ($openSecurity -match '^[Yy]$') {
        Start-Process "windowsdefender:"
    }
}

Write-Host ""
Write-Host "更多详细信息，请查看：BCPROV_JAR_ERROR_ANALYSIS.md" -ForegroundColor Cyan
Write-Host ""
