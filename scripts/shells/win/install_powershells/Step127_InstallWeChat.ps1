# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# WeChat Windows: fetch download URL from https://pc.weixin.qq.com/, download to temp, install. Verify same as ApplicationsList (Find-ExecutableByKeyword). If already installed, prompt Reinstall? y/N.

$PSScriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$script:WIN_COMMON_DIR = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"
. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. (Join-Path $script:WIN_COMMON_DIR "DesktopIconManager.ps1")

$SCRIPT_INDEX = "127"
$WECHAT_PAGE_URL = "https://pc.weixin.qq.com/"
$WECHAT_DOWNLOAD_PATTERN = "https://dldir1v6\.qq\.com/weixin/Universal/Windows/WeChatWin_[^`"'\s<>\)]+\.exe"

function Test-WeChatInstalled {
    $keyword = "WeChat.exe"
    $additionalKeywords = @("WeChat", "Weixin")
    if ($Global:CHINESE_WEIXIN) {
        $additionalKeywords = @($Global:CHINESE_WEIXIN) + $additionalKeywords
    }
    $found = Find-ExecutableByKeyword -Keywords $keyword -AdditionalKeywords $additionalKeywords -IncludeSystemPaths $true -Recursive $true
    if ($found -and (Test-Path $found)) {
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
    }
    return $null
}

function Install-WeChatFromWeb {
    $existingExe = Test-WeChatInstalled
    if ($existingExe) {
        Write-Host "       [$SCRIPT_INDEX] WeChat is already installed at: $existingExe" -ForegroundColor Yellow
        $prompt = Read-Host "       [$SCRIPT_INDEX] Reinstall? (y/N)"
        $trimmed = if ($prompt) { $prompt.Trim() } else { "" }
        if ($trimmed -ne "y" -and $trimmed -ne "Y") {
            Write-Host "       [$SCRIPT_INDEX] Skipped by user." -ForegroundColor Gray
            return $true
        }
    }

    Write-Host "       [$SCRIPT_INDEX] Fetching WeChat download URL from $WECHAT_PAGE_URL ..." -ForegroundColor Cyan
    $downloadUrl = Get-WeChatDownloadUrl
    if (-not $downloadUrl) {
        Write-Host "       [$SCRIPT_INDEX] Could not find download URL on page. Check $WECHAT_PAGE_URL" -ForegroundColor Red
        return $false
    }

    $downloadDir = $Global:DOWNLOADS_DIR
    if (-not (Test-Path $downloadDir)) {
        $downloadDir = $env:TEMP
    }
    if (-not (Test-Path $downloadDir)) {
        $downloadDir = Join-Path $env:USERPROFILE "Downloads"
    }
    if (-not (Test-Path $downloadDir)) {
        New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
    }
    $fileName = [System.IO.Path]::GetFileName((New-Object System.Uri $downloadUrl).LocalPath)
    if (-not $fileName -or $fileName -notmatch "\.exe$") {
        $fileName = "WeChatWin_latest.exe"
    }
    $localPath = Join-Path $downloadDir $fileName

    Write-Host "       [$SCRIPT_INDEX] Save to: $localPath" -ForegroundColor Cyan
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
        if ($process.ExitCode -ne 0 -and $process.ExitCode -ne $null) {
            Write-Host "       [$SCRIPT_INDEX] Installer exited with code: $($process.ExitCode) (silent may not be supported)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "       [$SCRIPT_INDEX] Installer failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }

    Start-Sleep -Seconds 3
    $installedExe = Test-WeChatInstalled
    if ($installedExe) {
        Write-Host "       [$SCRIPT_INDEX] WeChat installed successfully: $installedExe" -ForegroundColor Green
        $wechatScanKeywords = @("WeChat", "Weixin")
        if ($Global:CHINESE_WEIXIN) {
            $wechatScanKeywords = @($Global:CHINESE_WEIXIN) + $wechatScanKeywords
        }
        $desktopCategory = if ($Global:DESKTOP_CATEGORY_SOCIAL_MEDIA) { $Global:DESKTOP_CATEGORY_SOCIAL_MEDIA } else { "SocialMedia" }
        Write-Host "       [$SCRIPT_INDEX] Desktop icon cleanup/organize for WeChat..." -ForegroundColor Cyan
        $cleanupResult = Invoke-DesktopCleanupForPackage -PackageName "WeChat" -ExecutablePath $installedExe -ScanKeywords $wechatScanKeywords -CategoryName $desktopCategory -CreateShortcut $true
        if ($cleanupResult -and $cleanupResult.Errors -and $cleanupResult.Errors.Count -gt 0) {
            Write-Host "       [$SCRIPT_INDEX] Desktop cleanup had warnings: $($cleanupResult.Errors -join '; ')" -ForegroundColor Yellow
        }
        return $true
    }
    Write-Host "       [$SCRIPT_INDEX] Install finished but WeChat.exe was not found. You may need to complete setup manually." -ForegroundColor Yellow
    return $false
}

Write-Host "[$SCRIPT_INDEX] WeChat (Windows) - Install from official page" -ForegroundColor Cyan
$null = Install-WeChatFromWeb
