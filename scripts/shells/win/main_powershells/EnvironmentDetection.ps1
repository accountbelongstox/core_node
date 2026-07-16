# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Environment Detection Module (Windows PowerShell)
# All code is in English only.

# Ensure cache directory (centralized via SharedCacheEnv.ps1 $Global:WWW_CACHE_DIR;
# literal fallback mirrors it for loaders that have not sourced SharedCacheEnv).
$script:cacheRoot = if ($Global:WWW_CACHE_DIR) { $Global:WWW_CACHE_DIR } else { 'D:\www\cache' }
if (-not (Test-Path $script:cacheRoot)) {
    New-Item -ItemType Directory -Path $script:cacheRoot -Force | Out-Null
}

# Cache constants
$script:SYSTEM_CHECK_CACHE_FILE = Join-Path $script:cacheRoot "system_check.json"
$script:SYSTEM_CHECK_CACHE_DURATION = 3 # hours
$script:SOFTWARE_CHECK_CACHE_FILE = Join-Path $script:cacheRoot "software_check.json"
$script:SOFTWARE_CHECK_CACHE_DURATION = 3 # hours

# Results holders
$script:SYSTEM_CHECK_RESULTS = $null
$script:SOFTWARE_STATUS_RESULTS = $null
$script:LAST_CHECK_TIME = $null

# Fallback color message if host script does not provide one
if (-not (Get-Command Write-ColorMessage -ErrorAction SilentlyContinue)) {
    function Write-ColorMessage {
        param (
            [string]$Message,
            [ValidateSet("Info", "Success", "Warning", "Error")]
            [string]$Type = "Info"
        )
        $color = switch ($Type) {
            "Success" { "Green" }
            "Warning" { "Yellow" }
            "Error"   { "Red" }
            default    { "White" }
        }
        Write-Host -ForegroundColor $color $Message
    }
}

function Detect-SystemVersion {
    if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
        $script:SYSTEM_VERSION = "Windows_ARM64"
        $script:SYSTEM_NAME = "Windows"
    }
    elseif ($env:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
        $script:SYSTEM_VERSION = "Windows_x64"
        $script:SYSTEM_NAME = "Windows"
    }
    else {
        $script:SYSTEM_VERSION = "Windows_x86"
        $script:SYSTEM_NAME = "Windows"
    }
    
    if ($env:WSL_DISTRO_NAME) {
        $script:SYSTEM_VERSION = "WSL_$($env:WSL_DISTRO_NAME)"
        $script:SYSTEM_NAME = "WSL"
    }
    
    if ($env:DOCKER_CONTAINER) {
        $script:SYSTEM_VERSION = "Docker_Windows"
        $script:SYSTEM_NAME = "Docker"
    }
}

function Get-SystemCheckCache {
    # Caching disabled: always compute fresh results
    return $null
}

function Save-SystemCheckCache {
    param (
        [PSCustomObject]$CheckResults,
        [PSCustomObject]$SoftwareStatus
    )
    # Caching disabled: no-op
}

function Test-SoftwareInstallation {
    param (
        [string]$Command,
        [string]$Arguments = "--version"
    )
    try {
        $null = & $Command $Arguments 2>$null
        return $true
    } catch {
        return $false
    }
}

function Test-WSLInstallation {
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -ErrorAction SilentlyContinue
        if ($feature.State -eq "Enabled") {
            $distros = & wsl.exe --list --quiet 2>$null
            if ($distros) {
                return ($distros -join ", ")
            }
            return "Enabled (no distro listed)"
        }
    } catch {}
    
    try {
        $wslOutput = & wsl --status 2>&1
        $output = $wslOutput -join "`n"
        if ($output -and $output -notmatch "not installed") {
            return "Detected via command"
        }
    } catch {}
    return $null
}

function Test-EnvironmentVariable {
    param (
        [string]$VariableName
    )
    $value = [Environment]::GetEnvironmentVariable($VariableName, "User")
    if ([string]::IsNullOrEmpty($value)) {
        $value = [Environment]::GetEnvironmentVariable($VariableName, "Machine")
    }
    return $value
}

function Test-SystemRequirements {
    $results = [PSCustomObject]@{
        WindowsVersion = @{ Status = $false; Message = "" }
        SSHConfig      = @{ Status = $false; Message = "" }
        GoogleAccess   = @{ Status = $false; Message = "Google check skipped" }
    }

    # === Check Windows version ===
    $osInfo = Get-WmiObject -Class Win32_OperatingSystem
    $version = [Version]$osInfo.Version
    $results.WindowsVersion.Status = $version.Major -ge 10
    $results.WindowsVersion.Message = "Windows $($osInfo.Caption) ($($version.Major).$($version.Minor))"

    # === Check SSH ===
    $sshDir = Join-Path $env:USERPROFILE ".ssh"

    $sshDirExists = Test-Path $sshDir -PathType Container

    $sshKeyPairExists = $false
    if ($sshDirExists) {
        $pubFiles = Get-ChildItem -Path $sshDir -Filter "*.pub" -File -ErrorAction SilentlyContinue

        foreach ($pub in $pubFiles) {
            $priv = Join-Path $sshDir ([System.IO.Path]::GetFileNameWithoutExtension($pub.Name))
            $privExists = Test-Path $priv

            if ($privExists) {
                $sshKeyPairExists = $true
                break
            }
        }
    }

    $results.SSHConfig.Status = $sshDirExists -and $sshKeyPairExists
    $results.SSHConfig.Message = if ($results.SSHConfig.Status) {
        "SSH configured"
    }
    else {
        "SSH not configured (Download .ssh files from: https://pan.baidu.com/s/1xxxxxxxxxxxxx, extract to: $env:USERPROFILE\.ssh)"
    }

    return $results
}


function Get-SoftwareStatus {
    $status = [PSCustomObject]@{
        Software = @{
            Git     = Test-SoftwareInstallation "git" "--version"
            Node    = Test-SoftwareInstallation "node" "--version"
            Npm     = Test-SoftwareInstallation "npm" "--version"
            Python  = Test-SoftwareInstallation "python" "--version"
            ADB     = Test-SoftwareInstallation "adb" "version"
            FFmpeg  = Test-SoftwareInstallation "ffmpeg" "-version"
            Chrome  = Test-SoftwareInstallation "chrome" "--version"
            VS      = Test-SoftwareInstallation "devenv" "/version"
            VSCode  = Test-SoftwareInstallation "code" "--version"
        }
        Environment = @{
            ANDROID_HOME             = Test-EnvironmentVariable "ANDROID_HOME"
            ANDROID_ROOT             = Test-EnvironmentVariable "ANDROID_ROOT"
            ANDROID_SDK_ROOT         = Test-EnvironmentVariable "ANDROID_SDK_ROOT"
            ANDROID_NDK_ROOT         = Test-EnvironmentVariable "ANDROID_NDK_ROOT"
            JAVA_HOME                = Test-EnvironmentVariable "JAVA_HOME"
            GOROOT                   = Test-EnvironmentVariable "GOROOT"
            GOPATH                   = Test-EnvironmentVariable "GOPATH"
            VSINSTALLDIR             = Test-EnvironmentVariable "VSINSTALLDIR"
            VSCODE_INSTALLATION_PATH = Test-EnvironmentVariable "VSCODE_INSTALLATION_PATH"
            NODE_HOME                = Test-EnvironmentVariable "NODE_HOME"
            PYTHON_HOME              = Test-EnvironmentVariable "PYTHON_HOME"
            RUBY_HOME                = Test-EnvironmentVariable "RUBY_HOME"
            RUST_HOME                = Test-EnvironmentVariable "RUST_HOME"
            PHP_HOME                 = Test-EnvironmentVariable "PHP_HOME"
        }
        WSL = @{ Installed = $false; Distros = @() }
    }

    $wslDistros = Test-WSLInstallation
    $status.WSL.Installed = -not [string]::IsNullOrEmpty($wslDistros)
    $status.WSL.Distros = $wslDistros

    return $status
}

function Initialize-SystemChecks {
    Write-ColorMessage -Message "Initializing system checks..." -Type "Info"
    $script:SYSTEM_CHECK_RESULTS = Test-SystemRequirements
    $script:SOFTWARE_STATUS_RESULTS = Get-SoftwareStatus
    $script:LAST_CHECK_TIME = Get-Date
    Write-ColorMessage -Message "System checks completed." -Type "Success"
}

function Show-SystemStatus {
    if (-not $script:SYSTEM_CHECK_RESULTS -or -not $script:SOFTWARE_STATUS_RESULTS) {
        Initialize-SystemChecks
    }

    $systemCheck = $script:SYSTEM_CHECK_RESULTS
    $softwareStatus = $script:SOFTWARE_STATUS_RESULTS

    $winStatus = if ($systemCheck.WindowsVersion.Status) { "Success" } else { "Warning" }
    Write-ColorMessage -Message $systemCheck.WindowsVersion.Message -Type $winStatus

    $wslStatus = if ($softwareStatus.WSL.Installed) { "Success" } else { "Warning" }
    $wslMessage = if ($softwareStatus.WSL.Installed) { "WSL installed: $($softwareStatus.WSL.Distros)" } else { "WSL not installed or no distros configured." }
    Write-ColorMessage -Message $wslMessage -Type $wslStatus

    $sshStatus = if ($systemCheck.SSHConfig.Status) { "Success" } else { "Warning" }
    $sshMessage = if ($systemCheck.SSHConfig.Status) { "SSH: $($systemCheck.SSHConfig.Message)" } else { "SSH: $($systemCheck.SSHConfig.Message)" }
    Write-ColorMessage -Message $sshMessage -Type $sshStatus

    $installedSoftware = @()
    $missingSoftware = @()
    $installedEnvVars = @()
    $missingEnvVars = @()

    # Iterate over Software entries (Hashtable)
    foreach ($entry in $softwareStatus.Software.GetEnumerator()) {
        if ($entry.Value) {
            $installedSoftware += $entry.Key
        } else {
            $missingSoftware += $entry.Key
        }
    }

    # Iterate over Environment entries (Hashtable) and show values
    foreach ($entry in $softwareStatus.Environment.GetEnumerator()) {
        if ($entry.Value) {
            $installedEnvVars += ("{0} ({1})" -f $entry.Key, $entry.Value)
        } else {
            $missingEnvVars += ("{0} " -f $entry.Key)
        }
    }

    if ($installedSoftware.Count -gt 0 -or $installedEnvVars.Count -gt 0) {
        $installedInfo = ($installedSoftware + $installedEnvVars) -join " | "
        Write-ColorMessage -Message "Deployed Environment: $installedInfo" -Type "Success"
    }
    if ($missingSoftware.Count -gt 0 -or $missingEnvVars.Count -gt 0) {
        $missingInfo = ($missingSoftware + $missingEnvVars) -join " | "
        Write-ColorMessage -Message "Required Installation: $missingInfo" -Type "Warning"
    }
}
