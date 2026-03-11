# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Declare all variables at the beginning of the file.
# 5. For PowerShell: use Split-Path, Join-Path for paths; no relative "..\..".
# ### AI SPECIAL ATTENTION RULES END ###

# Set-AndroidSdkEnv.ps1
# Auto-detect Android SDK and set ANDROID_HOME / ANDROID_SDK_ROOT for current process.
# Used by Flutter Android build so "No Android SDK found" is avoided.
# Ref: https://developer.android.com/studio/command-line/variables

param(
    [switch]$Quiet
)

$CandidatePaths = @()
$ExistingHome = $null
$ExistingRoot = $null
$FoundPath = $null
$PlatformTools = $null

function Test-AndroidSdkRoot {
    param([string]$Dir)
    if ([string]::IsNullOrWhiteSpace($Dir)) { return $false }
    $Dir = $Dir.TrimEnd('\', '/')
    if (-not (Test-Path -LiteralPath $Dir -PathType Container)) { return $false }
    $pt = Join-Path $Dir "platform-tools"
    return (Test-Path -LiteralPath $pt -PathType Container)
}

# 1) Use existing env if valid
$ExistingHome = [Environment]::GetEnvironmentVariable("ANDROID_HOME", "Process")
if ([string]::IsNullOrWhiteSpace($ExistingHome)) {
    $ExistingHome = [Environment]::GetEnvironmentVariable("ANDROID_HOME", "User")
}
if ([string]::IsNullOrWhiteSpace($ExistingHome)) {
    $ExistingHome = [Environment]::GetEnvironmentVariable("ANDROID_HOME", "Machine")
}
if (Test-AndroidSdkRoot -Dir $ExistingHome) {
    $env:ANDROID_HOME = $ExistingHome
    $env:ANDROID_SDK_ROOT = $ExistingHome
    if (-not $Quiet) {
        Write-Host "[ANDROID-ENV] Using existing ANDROID_HOME: $ExistingHome" -ForegroundColor Green
    }
    $PlatformTools = Join-Path $ExistingHome "platform-tools"
    if ($env:PATH -notlike "*$PlatformTools*") {
        $env:PATH = "$PlatformTools;$env:PATH"
    }
    return
}

$ExistingRoot = [Environment]::GetEnvironmentVariable("ANDROID_SDK_ROOT", "Process")
if ([string]::IsNullOrWhiteSpace($ExistingRoot)) {
    $ExistingRoot = [Environment]::GetEnvironmentVariable("ANDROID_SDK_ROOT", "User")
}
if ([string]::IsNullOrWhiteSpace($ExistingRoot)) {
    $ExistingRoot = [Environment]::GetEnvironmentVariable("ANDROID_SDK_ROOT", "Machine")
}
if (Test-AndroidSdkRoot -Dir $ExistingRoot) {
    $env:ANDROID_HOME = $ExistingRoot
    $env:ANDROID_SDK_ROOT = $ExistingRoot
    if (-not $Quiet) {
        Write-Host "[ANDROID-ENV] Using existing ANDROID_SDK_ROOT: $ExistingRoot" -ForegroundColor Green
    }
    $PlatformTools = Join-Path $ExistingRoot "platform-tools"
    if ($env:PATH -notlike "*$PlatformTools*") {
        $env:PATH = "$PlatformTools;$env:PATH"
    }
    return
}

# 2) Search common locations (official / common install paths)
$LocalAppData = [Environment]::GetEnvironmentVariable("LOCALAPPDATA", "Process")
if ([string]::IsNullOrWhiteSpace($LocalAppData)) {
    $LocalAppData = $env:USERPROFILE
    if ($LocalAppData) {
        $LocalAppData = Join-Path $LocalAppData "AppData\Local"
    }
}
$UserProfile = [Environment]::GetEnvironmentVariable("USERPROFILE", "Process")
if ([string]::IsNullOrWhiteSpace($UserProfile)) {
    $UserProfile = $env:USERPROFILE
}

if ($LocalAppData) {
    $CandidatePaths += Join-Path $LocalAppData "Android\Sdk"
}
if ($UserProfile) {
    $CandidatePaths += Join-Path $UserProfile "AppData\Local\Android\Sdk"
    $CandidatePaths += Join-Path $UserProfile "Android\Sdk"
}
$CandidatePaths += "C:\Android\Sdk"
$CandidatePaths += "D:\Android\Sdk"
$CandidatePaths += Join-Path $env:ProgramFiles "Android\Android Studio\sdk"
$pfx86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)", "Process")
if ([string]::IsNullOrWhiteSpace($pfx86)) { $pfx86 = $env:ProgramFiles }
if ($pfx86) {
    $CandidatePaths += Join-Path $pfx86 "Android\Android Studio\sdk"
}

foreach ($p in $CandidatePaths) {
    if ([string]::IsNullOrWhiteSpace($p)) { continue }
    $p = $p -replace '/', '\'
    if (Test-AndroidSdkRoot -Dir $p) {
        $FoundPath = (Resolve-Path -LiteralPath $p -ErrorAction SilentlyContinue).Path
        if (-not $FoundPath) { $FoundPath = $p }
        break
    }
}

if ($FoundPath) {
    $env:ANDROID_HOME = $FoundPath
    $env:ANDROID_SDK_ROOT = $FoundPath
    if (-not $Quiet) {
        Write-Host "[ANDROID-ENV] Auto-detected SDK: $FoundPath" -ForegroundColor Green
    }
    $PlatformTools = Join-Path $FoundPath "platform-tools"
    if ($env:PATH -notlike "*$PlatformTools*") {
        $env:PATH = "$PlatformTools;$env:PATH"
    }
    return
}

if (-not $Quiet) {
    Write-Host "[ANDROID-ENV] No Android SDK found. Set ANDROID_HOME or install Android Studio / SDK." -ForegroundColor Yellow
    Write-Host "[ANDROID-ENV] See: https://developer.android.com/studio/command-line/variables" -ForegroundColor Gray
}
