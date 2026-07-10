# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# WeChat Windows: fetch download URL from https://pc.weixin.qq.com/, download to temp, install.
# Invoked by Step16 when InstallType is "postscript". Success determined solely by exe presence (Find-ExecutableByKeyword).
# Desktop shortcut cleanup handled by Step16 after executable is found.

$PSScriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$script:WIN_COMMON_DIR = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "win_common"
. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")

$SCRIPT_INDEX = "WeChat"
$WECHAT_PAGE_URL = "https://pc.weixin.qq.com/"
$WECHAT_DOWNLOAD_PATTERN = "https://dldir1v6\.qq\.com/weixin/Universal/Windows/WeChatWin_[^`"'\s<>\)]+\.exe"

function Get-WeChatSearchPaths {
    $paths = @()
    $candidates = @(
        "C:\Program Files\Tencent\WeChat",
        "C:\Program Files (x86)\Tencent\WeChat"
    )
    if ($env:LOCALAPPDATA) { $candidates += Join-Path $env:LOCALAPPDATA "Tencent\WeChat" }
    if ($env:APPDATA) { $candidates += Join-Path $env:APPDATA "Tencent\WeChat" }
    if ($env:USERPROFILE) { $candidates += Join-Path $env:USERPROFILE "AppData\Roaming\Tencent\WeChat" }
    foreach ($p in $candidates) {
        if ($p -and (Test-Path $p -ErrorAction SilentlyContinue)) {
            $paths += $p
        }
    }
    return $paths
}

function Get-WeChatAdditionalKeywords {
    $kw = @("WeChat", "Weixin")
    if ($Global:CHINESE_WEIXIN) {
        $kw = @($Global:CHINESE_WEIXIN) + $kw
    }
    return ($kw | Where-Object { $_ -and -not [string]::IsNullOrWhiteSpace($_) })
}

function Test-WeChatInstalled {
    $keyword = "WeChat.exe"
    $additionalKeywords = Get-WeChatAdditionalKeywords
    $scanPaths = Get-WeChatSearchPaths
    $found = Find-ExecutableByKeyword -Keywords $keyword -AdditionalKeywords $additionalKeywords -AdditionalScanPaths $scanPaths -IncludeSystemPaths $true -Recursive $true
    if ($found -and (Test-Path $found -ErrorAction SilentlyContinue)) {
        return $found
    }
    return $null
}

function Get-WeChatDownloadUrl {
    try {
        $response = Invoke-WebRequest -Uri $WECHAT_PAGE_URL -UseBasicParsing -MaximumRedirection 5 -ErrorAction Stop
        $content = $response.Content
        $match = [regex]::Match($content, $WECHAT_DOWNLOAD_PATTERN)
        if ($match.Success) {
            return $match.Value
        }
    }
    catch {
        Write-Host "       [$SCRIPT_INDEX] Failed to fetch page: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
    return $null
}

function Install-WeChatFromWeb {
    $existingExe = Test-WeChatInstalled
    if ($existingExe) {
        Write-Host "       [$SCRIPT_INDEX] WeChat is already installed at: $existingExe (idempotent skip)" -ForegroundColor Green
        return $true
    }

    Write-Host "       [$SCRIPT_INDEX] Fetching WeChat download URL from $WECHAT_PAGE_URL ..." -ForegroundColor Cyan
    $downloadUrl = Get-WeChatDownloadUrl
    if (-not $downloadUrl) {
        Write-Host "       [$SCRIPT_INDEX] Could not find download URL on page. Check $WECHAT_PAGE_URL" -ForegroundColor Red
        return $false
    }

    $downloadDir = $Global:DOWNLOADS_DIR
    if (-not $downloadDir -or -not (Test-Path $downloadDir -ErrorAction SilentlyContinue)) {
        $downloadDir = $env:TEMP
    }
    if (-not $downloadDir -or -not (Test-Path $downloadDir -ErrorAction SilentlyContinue)) {
        $downloadDir = Join-Path $env:USERPROFILE "Downloads"
    }
    if (-not (Test-Path $downloadDir -ErrorAction SilentlyContinue)) {
        New-Item -ItemType Directory -Path $downloadDir -Force -ErrorAction SilentlyContinue | Out-Null
    }
    if (-not (Test-Path $downloadDir -ErrorAction SilentlyContinue)) {
        Write-Host "       [$SCRIPT_INDEX] Could not create download directory: $downloadDir" -ForegroundColor Red
        return $false
    }
    $fileName = [System.IO.Path]::GetFileName((New-Object System.Uri $downloadUrl).LocalPath)
    if (-not $fileName -or $fileName -notmatch "\.exe$") {
        $fileName = "WeChatWin_latest.exe"
    }
    $localPath = Join-Path $downloadDir $fileName

    $downloadOk = Get-FileWithSizeCheck -localPath $localPath -remoteUrl $downloadUrl -description "WeChat"
    if (-not $downloadOk) {
        Write-Host "       [$SCRIPT_INDEX] Download failed." -ForegroundColor Red
        return $false
    }
    if (-not (Test-Path $localPath)) {
        Write-Host "       [$SCRIPT_INDEX] Download file not found: $localPath" -ForegroundColor Red
        return $false
    }

    Write-Host "       [$SCRIPT_INDEX] Running installer: $localPath" -ForegroundColor Cyan
    try {
        $process = Start-Process -FilePath $localPath -ArgumentList "/S" -Wait -PassThru
    }
    catch {
        Write-Host "       [$SCRIPT_INDEX] Installer failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }

    Start-Sleep -Seconds 3
    $installedExe = Test-WeChatInstalled
    if ($installedExe) {
        Write-Host "       [$SCRIPT_INDEX] WeChat installed successfully: $installedExe" -ForegroundColor Green
        return $true
    }
    Write-Host "       [$SCRIPT_INDEX] Install finished but WeChat.exe was not found. You may need to complete setup manually." -ForegroundColor Yellow
    return $false
}

Write-Host "[$SCRIPT_INDEX] WeChat (Windows) - Install from official page" -ForegroundColor Cyan
$null = Install-WeChatFromWeb
