# Flutter Splash Screen Auto Replacer
# 自动替换Flutter启动图脚本
# Author: Claude AI Assistant
# Date: 2025-09-24

param(
    [Parameter(Mandatory=$false)]
    [string]$AppName = "qy",

    [Parameter(Mandatory=$false)]
    [string]$ProjectRoot = "D:\programing\core_node\poly_apps\flutter_bloom",

    [Parameter(Mandatory=$false)]
    [switch]$Force = $false,

    [Parameter(Mandatory=$false)]
    [switch]$FullscreenMode,

    [Parameter(Mandatory=$false)]
    [switch]$WithLogo
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 设置默认值
if (-not $FullscreenMode -and -not $WithLogo) {
    $FullscreenMode = $true
}

# 脚本信息
Write-Host "=== Flutter Splash Screen Auto Replacer ===" -ForegroundColor Cyan
Write-Host "App Name: $AppName" -ForegroundColor Green
Write-Host "Project Root: $ProjectRoot" -ForegroundColor Green
Write-Host "Mode: $(if ($FullscreenMode -and -not $WithLogo) { 'Fullscreen Background' } elseif ($WithLogo) { 'Background + Logo' } else { 'Background Only' })" -ForegroundColor Green
Write-Host ""

# 定义路径
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonHelper = Join-Path $ScriptDir "splash_helper.py"
$AssetsDir = Join-Path $ProjectRoot "assets\apps\app_$AppName\launch"
$CommonLaunchDir = Join-Path $ProjectRoot "assets\common\launch"
$SplashConfigFile = Join-Path $ProjectRoot "flutter_native_splash.yaml"

# 验证项目根目录
if (-not (Test-Path $ProjectRoot)) {
    Write-Error "Project root directory not found: $ProjectRoot"
    exit 1
}

# 验证应用资源目录
if (-not (Test-Path $AssetsDir)) {
    Write-Error "App assets directory not found: $AssetsDir"
    Write-Host "Expected path: $AssetsDir" -ForegroundColor Yellow
    exit 1
}

Write-Host "[STEP 1] Searching for background image..." -ForegroundColor Yellow

# 查找背景图片（按优先级：jpg -> png -> webp）
$BackgroundImage = $null
$SupportedFormats = @("jpg", "jpeg", "png", "webp")

foreach ($format in $SupportedFormats) {
    $ImagePath = Join-Path $AssetsDir "background.$format"
    if (Test-Path $ImagePath) {
        $BackgroundImage = $ImagePath
        Write-Host "Found background image: $ImagePath" -ForegroundColor Green
        break
    }
}

if (-not $BackgroundImage) {
    Write-Error "No background image found in $AssetsDir"
    Write-Host "Supported formats: $($SupportedFormats -join ', ')" -ForegroundColor Yellow
    exit 1
}

# 检查是否需要转换格式
$ImageExtension = [System.IO.Path]::GetExtension($BackgroundImage).ToLower()
$NeedConversion = $ImageExtension -ne ".png"

if ($NeedConversion) {
    Write-Host "[STEP 2] Converting image to PNG format..." -ForegroundColor Yellow
    
    # 调用Python辅助脚本进行图片转换
    $ConvertedImage = Join-Path $AssetsDir "background_converted.png"
    
    try {
        $PythonArgs = @(
            $PythonHelper,
            "convert",
            "--input", $BackgroundImage,
            "--output", $ConvertedImage,
            "--format", "png"
        )
        
        & python @PythonArgs
        
        if ($LASTEXITCODE -eq 0 -and (Test-Path $ConvertedImage)) {
            $BackgroundImage = $ConvertedImage
            Write-Host "Image converted successfully: $ConvertedImage" -ForegroundColor Green
        } else {
            Write-Error "Image conversion failed"
            exit 1
        }
    } catch {
        Write-Error "Failed to run Python helper script: $_"
        exit 1
    }
} else {
    Write-Host "[STEP 2] Image is already in PNG format, skipping conversion" -ForegroundColor Green
}

Write-Host "[STEP 3] Copying image to common launch directory..." -ForegroundColor Yellow

# 确保common/launch目录存在
if (-not (Test-Path $CommonLaunchDir)) {
    New-Item -ItemType Directory -Path $CommonLaunchDir -Force | Out-Null
    Write-Host "Created directory: $CommonLaunchDir" -ForegroundColor Green
}

# 复制图片到common/launch目录
$SplashBgPath = Join-Path $CommonLaunchDir "splash_bg.png"
$SplashLogoPath = Join-Path $CommonLaunchDir "splash_logo.png"

try {
    Copy-Item -Path $BackgroundImage -Destination $SplashBgPath -Force
    Write-Host "Background image copied to: $SplashBgPath" -ForegroundColor Green
    
    # 如果有logo图片，也复制过去
    $LogoPath = Join-Path (Split-Path $AssetsDir) "icons\splash_logo.png"
    if (Test-Path $LogoPath) {
        Copy-Item -Path $LogoPath -Destination $SplashLogoPath -Force
        Write-Host "Logo image copied to: $SplashLogoPath" -ForegroundColor Green
    }
} catch {
    Write-Error "Failed to copy images: $_"
    exit 1
}

Write-Host "[STEP 4] Generating splash screen configuration..." -ForegroundColor Yellow

# 调用Python脚本生成配置
try {
    $ConfigArgs = @(
        $PythonHelper,
        "config",
        "--app-name", $AppName,
        "--background-image", $SplashBgPath,
        "--output", $SplashConfigFile
    )

    # 添加logo图片（如果存在且需要显示）
    if ((Test-Path $SplashLogoPath) -and $WithLogo) {
        $ConfigArgs += @("--logo-image", $SplashLogoPath)
        $ConfigArgs += @("--with-logo")
    }

    # 如果是全屏模式，添加fullscreen参数
    if ($FullscreenMode -and -not $WithLogo) {
        $ConfigArgs += @("--fullscreen")
    }

    & python @ConfigArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Splash configuration generated: $SplashConfigFile" -ForegroundColor Green
    } else {
        Write-Error "Configuration generation failed"
        exit 1
    }
} catch {
    Write-Error "Failed to generate configuration: $_"
    exit 1
}

Write-Host "[STEP 5] Applying splash screen..." -ForegroundColor Yellow

# 运行flutter_native_splash
try {
    Set-Location $ProjectRoot
    
    Write-Host "Running: dart run flutter_native_splash:create" -ForegroundColor Cyan
    & dart run flutter_native_splash:create
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Splash screen applied successfully!" -ForegroundColor Green
    } else {
        Write-Warning "Flutter native splash command completed with warnings"
    }
} catch {
    Write-Error "Failed to apply splash screen: $_"
    exit 1
}

Write-Host ""
Write-Host "=== Splash Screen Replacement Completed ===" -ForegroundColor Cyan
Write-Host "App: $AppName" -ForegroundColor Green
Write-Host "Background Image: $BackgroundImage" -ForegroundColor Green
Write-Host "Configuration: $SplashConfigFile" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run 'flutter clean' to clear build cache" -ForegroundColor White
Write-Host "2. Run 'flutter build apk' to test the new splash screen" -ForegroundColor White
Write-Host ""
