# WeChat / Weixin Windows installer (Step21 postscript).
# Constant usage matches BaseTools_7Zip / Git_Install:
#   GlobalVars defines $Global:WEIXIN_INSTALL_DIR and $Global:WEIXIN_EXE_PATH
#   After `. GlobalVars.ps1`, call them as $WEIXIN_INSTALL_DIR / $WEIXIN_EXE_PATH
#   Silent NSIS install: Start-Process ... -ArgumentList "/S", "/D=$WEIXIN_INSTALL_DIR"
# Official silent switch is /S (https://silentinstallhq.com/wechat-silent-install-how-to-guide/);
# /D= is the same NSIS custom-dir form used by 7-Zip in this repo.

$PSScriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$script:WIN_COMMON_DIR = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "win_common"
. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")

$SCRIPT_INDEX = "WeChat"
$WECHAT_PAGE_URL = "https://pc.weixin.qq.com/"
$WECHAT_DOWNLOAD_PATTERN = "https://dldir1v6\.qq\.com/weixin/Universal/Windows/WeChatWin_[^`"'\s<>\)]+\.exe"
$downloadUrl = $null
$downloadDir = $null
$fileName = $null
$localPath = $null
$downloadOk = $false
$installedExe = $null
$foundElsewhere = $null
$scanPaths = $null
$additionalKeywords = $null

function Get-WeChatSearchPaths {
    $paths = @()
    $candidates = @()
    # Preferred constant dir first (same pattern as scanning $SEVENZIP_INSTALL_DIR)
    if ($WEIXIN_INSTALL_DIR) { $candidates += $WEIXIN_INSTALL_DIR }
    if ($APP_INSTALL_DIR) { $candidates += $APP_INSTALL_DIR }
    $candidates += @(
        "C:\Program Files\Tencent\WeChat",
        "C:\Program Files (x86)\Tencent\WeChat",
        "C:\Program Files\Tencent\Weixin",
        "C:\Program Files (x86)\Tencent\Weixin"
    )
    if ($env:LOCALAPPDATA) {
        $candidates += Join-Path $env:LOCALAPPDATA "Tencent\WeChat"
        $candidates += Join-Path $env:LOCALAPPDATA "Tencent\Weixin"
    }
    if ($env:APPDATA) {
        $candidates += Join-Path $env:APPDATA "Tencent\WeChat"
        $candidates += Join-Path $env:APPDATA "Tencent\Weixin"
    }
    foreach ($p in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace([string]$p) -and (Test-Path -LiteralPath $p -ErrorAction SilentlyContinue)) {
            $paths += $p
        }
    }
    return @($paths | Select-Object -Unique)
}

function Get-WeChatAdditionalKeywords {
    $kw = @("Weixin.exe", "WeChat.exe", "WeChat", "Weixin")
    if ($CHINESE_WEIXIN) {
        $kw = @($CHINESE_WEIXIN) + $kw
    }
    return @($kw | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -Unique)
}

function Test-WeChatInstalled {
    # Idempotent fast path: constant exe path (like Test-Path $SEVENZIP_EXE_PATH)
    if ($WEIXIN_EXE_PATH -and (Test-Path -LiteralPath $WEIXIN_EXE_PATH -PathType Leaf -ErrorAction SilentlyContinue)) {
        return $WEIXIN_EXE_PATH
    }
    $found = $null
    try {
        $found = Find-ExecutableByKeyword `
            -Keywords "Weixin.exe" `
            -AdditionalKeywords @(Get-WeChatAdditionalKeywords) `
            -AdditionalScanPaths @(Get-WeChatSearchPaths) `
            -IncludeSystemPaths $true `
            -Recursive $true
    } catch {
        Write-Host "       [$SCRIPT_INDEX] Detection error: $($_.Exception.Message)" -ForegroundColor Yellow
        return $null
    }
    if ($found -and (Test-Path -LiteralPath $found -ErrorAction SilentlyContinue)) {
        return $found
    }
    return $null
}

function Get-WeChatDownloadUrl {
    try {
        $response = Invoke-WebRequest -Uri $WECHAT_PAGE_URL -UseBasicParsing -MaximumRedirection 5 -ErrorAction Stop
        $match = [regex]::Match([string]$response.Content, $WECHAT_DOWNLOAD_PATTERN)
        if ($match.Success) { return $match.Value }
    } catch {
        Write-Host "       [$SCRIPT_INDEX] Failed to fetch page: $($_.Exception.Message)" -ForegroundColor Red
    }
    return $null
}

function Install-WeChatFromWeb {
    # --- Idempotent skip when constant path already has Weixin.exe ---
    if ($WEIXIN_EXE_PATH -and (Test-Path -LiteralPath $WEIXIN_EXE_PATH -PathType Leaf)) {
        Write-Host "       [$SCRIPT_INDEX] Already installed at `$WEIXIN_EXE_PATH: $WEIXIN_EXE_PATH (idempotent skip)" -ForegroundColor Green
        return $true
    }
    # WeChat 4.x ignores /D= and always installs to Program Files\Tencent\Weixin, so an
    # existing install anywhere counts: re-running the installer can never move it.
    $installedExe = Test-WeChatInstalled
    if ($installedExe) {
        Write-Host "       [$SCRIPT_INDEX] Already installed at: $installedExe (idempotent skip)" -ForegroundColor Green
        return $true
    }

    # --- Ensure constant install directory exists (same as Step20 for 7-Zip) ---
    Write-Host "       [$SCRIPT_INDEX] Target install dir `$WEIXIN_INSTALL_DIR: $WEIXIN_INSTALL_DIR" -ForegroundColor Cyan
    if (-not $WEIXIN_INSTALL_DIR) {
        Write-Host "       [$SCRIPT_INDEX] WEIXIN_INSTALL_DIR constant is not set (GlobalVars.ps1)." -ForegroundColor Red
        return $false
    }
    if (-not (Test-Path -LiteralPath $WEIXIN_INSTALL_DIR -PathType Container)) {
        New-Item -ItemType Directory -Path $WEIXIN_INSTALL_DIR -Force | Out-Null
        Write-Host "       [$SCRIPT_INDEX] Created `$WEIXIN_INSTALL_DIR" -ForegroundColor Green
    }

    Write-Host "       [$SCRIPT_INDEX] Fetching download URL from $WECHAT_PAGE_URL ..." -ForegroundColor Cyan
    $downloadUrl = Get-WeChatDownloadUrl
    if (-not $downloadUrl) {
        Write-Host "       [$SCRIPT_INDEX] Could not find download URL. Check $WECHAT_PAGE_URL" -ForegroundColor Red
        return $false
    }

    $downloadDir = $DOWNLOADS_DIR
    if (-not $downloadDir) {
        $downloadDir = Join-Path $env:USERPROFILE "Downloads"
    }
    if (-not (Test-Path -LiteralPath $downloadDir -ErrorAction SilentlyContinue)) {
        New-Item -ItemType Directory -Path $downloadDir -Force -ErrorAction SilentlyContinue | Out-Null
    }
    $fileName = [System.IO.Path]::GetFileName((New-Object System.Uri $downloadUrl).LocalPath)
    if (-not $fileName -or $fileName -notmatch "\.exe$") {
        $fileName = "WeChatWin_latest.exe"
    }
    $localPath = Join-Path $downloadDir $fileName

    $downloadOk = Get-FileWithSizeCheck -localPath $localPath -remoteUrl $downloadUrl -description "WeChat"
    if (-not $downloadOk -or -not (Test-Path -LiteralPath $localPath)) {
        Write-Host "       [$SCRIPT_INDEX] Download failed: $localPath" -ForegroundColor Red
        return $false
    }

    # Silent install into constant dir - same ArgumentList form as BaseTools_7Zip:
    #   Start-Process ... -ArgumentList "/S", "/D=$SEVENZIP_INSTALL_DIR"
    # NSIS: /D= must be last; path without trailing slash (<APP_INSTALL_DIR>\Weixin).
    Write-Host "       [$SCRIPT_INDEX] Installing to `$WEIXIN_INSTALL_DIR via /S /D=$WEIXIN_INSTALL_DIR ..." -ForegroundColor Cyan
    try {
        Start-Process -FilePath $localPath -ArgumentList "/S", "/D=$WEIXIN_INSTALL_DIR" -Wait
    } catch {
        Write-Host "       [$SCRIPT_INDEX] Installer failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }

    # The 4.x bootstrap exits before the real installer finishes; poll instead of a fixed sleep.
    $foundElsewhere = $null
    for ($waitAttempt = 0; $waitAttempt -lt 30; $waitAttempt++) {
        Start-Sleep -Seconds 3
        if ($WEIXIN_EXE_PATH -and (Test-Path -LiteralPath $WEIXIN_EXE_PATH -PathType Leaf)) {
            Write-Host "       [$SCRIPT_INDEX] Installed OK: $WEIXIN_EXE_PATH" -ForegroundColor Green
            return $true
        }
        $foundElsewhere = Test-WeChatInstalled
        if ($foundElsewhere) { break }
    }

    if ($foundElsewhere) {
        Write-Host "       [$SCRIPT_INDEX] Installed OK (installer ignored /D=): $foundElsewhere" -ForegroundColor Green
        return $true
    }

    Write-Host "       [$SCRIPT_INDEX] Install finished but no Weixin.exe found (`$WEIXIN_EXE_PATH: $WEIXIN_EXE_PATH)" -ForegroundColor Yellow
    return $false
}

Write-Host "[$SCRIPT_INDEX] WeChat/Weixin -> `$WEIXIN_INSTALL_DIR ($WEIXIN_INSTALL_DIR)" -ForegroundColor Cyan
# The result is this postscript's output: Step21_InstallApplications.ps1 reads a final $true/$false.
Install-WeChatFromWeb
