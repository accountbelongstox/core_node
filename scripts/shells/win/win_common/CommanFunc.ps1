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

# ===== VARIABLE DECLARATIONS - ALL VARIABLES AT FILE START =====

param(
    [string]$ServicePrefix = "DD"
)

# Global variables for service management
$Global:SERVICE_OPERATION_COUNT = 0
$Global:MAX_SERVICE_OPERATIONS = 10
$Global:SERVICE_PREFIX = $ServicePrefix

# Color constants for message output
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"

# Global variables directory (from GlobalVars.ps1)
$Global:GLOBAL_VAR_DIR = Join-Path $env:USERPROFILE ".core_node\.global_vars"

# Windows Service Management Library
# Provides functions for managing Windows services with safety checks
# Supports configurable service prefix for different applications

# ===== COMMON UTILITY FUNCTIONS =====

function Get-GlobalVar {
    param (
        [string]$Key
    )
    $filePath = Join-Path $Global:GLOBAL_VAR_DIR $Key
    if (Test-Path $filePath) {
        $content = Get-Content -Path $filePath -Encoding UTF8 -TotalCount 1
        return $content -replace "`0", ""
    }
    return $null
}

function Set-GlobalVar {
    param (
        [string]$Key,
        [string]$Value
    )
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    $cleanValue = $Value -replace "`0", ""
    [System.IO.File]::WriteAllText((Join-Path $Global:GLOBAL_VAR_DIR $Key), $cleanValue, $utf8NoBom)
}

function Get-RegionDownloadBaseURL {
    $selectedRegion = Get-GlobalVar -Key "SELECTED_REGION"
    if ($selectedRegion -eq "Global") {
        return "https://raw.githubusercontent.com/accountbelongstox/core_node/main"
    } else {
        return "https://gitee.com/accountbelongstox/core_node/raw/main"
    }
}

function Write-ColorMessage {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [ValidateSet("Success", "Warning", "Error", "Info")]
        [string]$Type = "Info"
    )

    if ($Type -eq "Success") {
        $color = $script:COLOR_SUCCESS
    } elseif ($Type -eq "Warning") {
        $color = $script:COLOR_WARNING
    } elseif ($Type -eq "Error") {
        $color = $script:COLOR_ERROR
    } elseif ($Type -eq "Info") {
        $color = $script:COLOR_INFO
    } else {
        $color = $script:COLOR_INFO
    }

    if (-not $color) {
        $color = "White"
    }

    if ($Type -eq "Success") {
        $prefix = "[OK] "
    } elseif ($Type -eq "Warning") {
        $prefix = "[!] "
    } elseif ($Type -eq "Error") {
        $prefix = "[ERROR] "
    } else {
        $prefix = "[INFO] "
    }

    Write-Host "$prefix$Message" -ForegroundColor $color
}

function Get-VariableFromFile {
    param(
        [string]$key,
        [string]$defaultValue = ""
    )

    $globalVarDir = Join-Path $env:USERPROFILE ".core_node\.global_vars"
    if (-not (Test-Path $globalVarDir)) {
        New-Item -ItemType Directory -Path $globalVarDir -Force | Out-Null
    }

    $filePath = Join-Path $globalVarDir $key
    if (Test-Path $filePath) {
        $value = Get-Content $filePath -Raw
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }
    }

    return $defaultValue
}

function Write-ServiceLog {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host "[WindowsServiceManager] $Message" -ForegroundColor $Color
}

function Test-AdministratorPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Check-AdminPrivileges {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-ColorMessage -Message "This script requires administrator privileges. Please run as administrator." -Type "Error"
        exit 1
    }
}

function Test-ServiceOperationLimit {
    if ($Global:SERVICE_OPERATION_COUNT -ge $Global:MAX_SERVICE_OPERATIONS) {
        Write-ServiceLog "Maximum service operations ($Global:MAX_SERVICE_OPERATIONS) reached. System restart recommended to avoid service management issues." -Color "Red"
        Write-ServiceLog "Please restart your system before performing more service operations." -Color "Yellow"
        return $false
    }
    return $true
}

function Increment-ServiceOperationCount {
    $Global:SERVICE_OPERATION_COUNT++
    Write-ServiceLog "Service operations count: $Global:SERVICE_OPERATION_COUNT/$Global:MAX_SERVICE_OPERATIONS" -Color "Cyan"
}

function New-WindowsService {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName,
        
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        
        [string]$DisplayName = "",
        [string]$Description = "",
        [string]$StartType = "Manual"
    )
    
    $fullServiceName = "$Global:SERVICE_PREFIX-$ServiceName"
    $serviceDisplayName = if ($DisplayName) { $DisplayName } else { "MCP Service: $ServiceName" }
    $serviceDescription = if ($Description) { $Description } else { "MCP Service for $ServiceName" }
    
    if (-not (Test-ServiceOperationLimit)) {
        return $false
    }
    
    if (-not (Test-AdministratorPrivileges)) {
        Write-ServiceLog "Administrator privileges required to create Windows service" -Color "Red"
        return $false
    }
    
    try {
        $existingService = Get-Service -Name $fullServiceName -ErrorAction SilentlyContinue
        if ($existingService) {
            Write-ServiceLog "Service $fullServiceName already exists, removing first..." -Color "Yellow"
            Remove-WindowsService -ServiceName $ServiceName
        }
        
        $result = New-Service -Name $fullServiceName -BinaryPathName $ExecutablePath -DisplayName $serviceDisplayName -Description $serviceDescription -StartupType $StartType -ErrorAction Stop
        
        if ($result) {
            Write-ServiceLog "Windows service created successfully: $fullServiceName" -Color "Green"
            Increment-ServiceOperationCount
            return $true
        }
        
    } catch {
        Write-ServiceLog "Failed to create Windows service $fullServiceName`: $($_.Exception.Message)" -Color "Red"
        Increment-ServiceOperationCount
        return $false
    }
    
    return $false
}

function Remove-WindowsService {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )
    
    $fullServiceName = "$Global:SERVICE_PREFIX-$ServiceName"
    
    if (-not (Test-ServiceOperationLimit)) {
        return $false
    }
    
    if (-not (Test-AdministratorPrivileges)) {
        Write-ServiceLog "Administrator privileges required to remove Windows service" -Color "Red"
        return $false
    }
    
    try {
        $service = Get-Service -Name $fullServiceName -ErrorAction SilentlyContinue
        if ($service) {
            if ($service.Status -eq "Running") {
                Write-ServiceLog "Stopping service $fullServiceName..." -Color "Yellow"
                Stop-Service -Name $fullServiceName -Force -ErrorAction Stop
                Start-Sleep -Seconds 2
            }
            
            Write-ServiceLog "Removing service $fullServiceName..." -Color "Yellow"
            & sc.exe delete $fullServiceName
            
            if ($LASTEXITCODE -eq 0) {
                Write-ServiceLog "Windows service removed successfully: $fullServiceName" -Color "Green"
                Increment-ServiceOperationCount
                return $true
            } else {
                Write-ServiceLog "Failed to remove Windows service: $fullServiceName" -Color "Red"
            }
        } else {
            Write-ServiceLog "Service $fullServiceName does not exist" -Color "Yellow"
            return $true
        }
        
    } catch {
        Write-ServiceLog "Error removing Windows service $fullServiceName`: $($_.Exception.Message)" -Color "Red"
        Increment-ServiceOperationCount
        return $false
    }
    
    return $false
}

function Start-WindowsService {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )
    
    $fullServiceName = "$Global:SERVICE_PREFIX-$ServiceName"
    
    if (-not (Test-ServiceOperationLimit)) {
        return $false
    }
    
    try {
        $service = Get-Service -Name $fullServiceName -ErrorAction SilentlyContinue
        if ($service) {
            if ($service.Status -ne "Running") {
                Write-ServiceLog "Starting service $fullServiceName..." -Color "Cyan"
                Start-Service -Name $fullServiceName -ErrorAction Stop
                Write-ServiceLog "Windows service started: $fullServiceName" -Color "Green"
                Increment-ServiceOperationCount
                return $true
            } else {
                Write-ServiceLog "Service $fullServiceName is already running" -Color "Yellow"
                return $true
            }
        } else {
            Write-ServiceLog "Service $fullServiceName does not exist" -Color "Red"
            return $false
        }
        
    } catch {
        Write-ServiceLog "Failed to start Windows service $fullServiceName`: $($_.Exception.Message)" -Color "Red"
        Increment-ServiceOperationCount
        return $false
    }
}

function Stop-WindowsService {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )
    
    $fullServiceName = "$Global:SERVICE_PREFIX-$ServiceName"
    
    if (-not (Test-ServiceOperationLimit)) {
        return $false
    }
    
    try {
        $service = Get-Service -Name $fullServiceName -ErrorAction SilentlyContinue
        if ($service) {
            if ($service.Status -eq "Running") {
                Write-ServiceLog "Stopping service $fullServiceName..." -Color "Cyan"
                Stop-Service -Name $fullServiceName -Force -ErrorAction Stop
                Write-ServiceLog "Windows service stopped: $fullServiceName" -Color "Green"
                Increment-ServiceOperationCount
                return $true
            } else {
                Write-ServiceLog "Service $fullServiceName is not running" -Color "Yellow"
                return $true
            }
        } else {
            Write-ServiceLog "Service $fullServiceName does not exist" -Color "Red"
            return $false
        }
        
    } catch {
        Write-ServiceLog "Failed to stop Windows service $fullServiceName`: $($_.Exception.Message)" -Color "Red"
        Increment-ServiceOperationCount
        return $false
    }
}

function Test-WindowsService {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )
    
    $fullServiceName = "$Global:SERVICE_PREFIX-$ServiceName"
    
    try {
        $service = Get-Service -Name $fullServiceName -ErrorAction SilentlyContinue
        if ($service) {
            return @{
                Exists = $true
                Status = $service.Status
                StartType = $service.StartType
                DisplayName = $service.DisplayName
            }
        } else {
            return @{
                Exists = $false
                Status = "Not Found"
                StartType = "N/A"
                DisplayName = "N/A"
            }
        }
        
    } catch {
        Write-ServiceLog "Error checking Windows service $fullServiceName`: $($_.Exception.Message)" -Color "Red"
        return @{
            Exists = $false
            Status = "Error"
            StartType = "N/A" 
            DisplayName = "N/A"
        }
    }
}

function Install-ServiceAsWindowsService {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName,
        
        [Parameter(Mandatory = $true)]
        [string]$ServicePath,
        
        [string]$Description = "",
        [bool]$AutoStart = $false
    )
    
    if (-not (Test-Path $ServicePath)) {
        Write-ServiceLog "Service executable not found: $ServicePath" -Color "Red"
        return $false
    }
    
    $startType = if ($AutoStart) { "Automatic" } else { "Manual" }
    $serviceDescription = if ($Description) { $Description } else { "MCP Service: $ServiceName" }
    
    Write-ServiceLog "Installing $ServiceName as Windows service..." -Color "Cyan"
    Write-ServiceLog "Executable: $ServicePath" -Color "White"
    Write-ServiceLog "Start Type: $startType" -Color "White"
    
    $result = New-WindowsService -ServiceName $ServiceName -ExecutablePath $ServicePath -Description $serviceDescription -StartType $startType
    
    if ($result -and $AutoStart) {
        Write-ServiceLog "Starting service automatically..." -Color "Cyan"
        Start-WindowsService -ServiceName $ServiceName
    }
    
    return $result
}

function Uninstall-ServiceFromWindows {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )
    
    Write-ServiceLog "Uninstalling Windows service: $ServiceName" -Color "Cyan"
    
    $result = Remove-WindowsService -ServiceName $ServiceName
    
    if ($result) {
        Write-ServiceLog "Service $ServiceName uninstalled successfully" -Color "Green"
    } else {
        Write-ServiceLog "Failed to uninstall service $ServiceName" -Color "Red"
    }
    
    return $result
}

function Show-ServiceStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )
    
    $serviceInfo = Test-WindowsService -ServiceName $ServiceName
    $fullServiceName = "$Global:SERVICE_PREFIX-$ServiceName"
    
    Write-ServiceLog "Service Status Report:" -Color "Cyan"
    Write-ServiceLog "  Service Name: $fullServiceName" -Color "White"
    Write-ServiceLog "  Display Name: $($serviceInfo.DisplayName)" -Color "White"
    Write-ServiceLog "  Exists: $($serviceInfo.Exists)" -Color "White"
    Write-ServiceLog "  Status: $($serviceInfo.Status)" -Color "White"
    Write-ServiceLog "  Start Type: $($serviceInfo.StartType)" -Color "White"
    Write-ServiceLog "  Operations Count: $Global:SERVICE_OPERATION_COUNT/$Global:MAX_SERVICE_OPERATIONS" -Color "White"
    
    if ($Global:SERVICE_OPERATION_COUNT -ge ($Global:MAX_SERVICE_OPERATIONS - 2)) {
        Write-ServiceLog "  WARNING: Approaching operation limit, restart system soon" -Color "Yellow"
    }
    
    return $serviceInfo
}

function Invoke-SmartLoadScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SubPath,
        
        [Parameter(Mandatory = $false)]
        [bool]$ForceDownload = $false
    )
    
    # Get the current script directory to determine the base path
    # The CommanFunc.ps1 is in scripts/shells/win/win_common/
    # So we need to go up 3 levels to get to the project root
    $currentScriptDir = Split-Path -Parent $MyInvocation.PSCommandPath
    $basePath = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $currentScriptDir))
    
    
    # If basePath is empty or null, try alternative method
    if ([string]::IsNullOrEmpty($basePath)) {
        # Try to find the project root by looking for common markers
        $currentDir = $currentScriptDir
        while ($currentDir -and $currentDir -ne (Split-Path -Parent $currentDir)) {
            if ((Test-Path (Join-Path $currentDir "package.json")) -or 
                (Test-Path (Join-Path $currentDir "main.js")) -or
                (Test-Path (Join-Path $currentDir "scripts"))) {
                $basePath = $currentDir
                break
            }
            $currentDir = Split-Path -Parent $currentDir
        }
    }
    
    # Construct local file path
    $localPath = Join-Path $basePath $SubPath
    
    # Check if local file exists and is not forced to download
    if ((Test-Path $localPath) -and -not $ForceDownload) {
        Write-Host "Using local script: $localPath" -ForegroundColor Green
        return $localPath
    }
    
    # If local file doesn't exist or force download is requested, try to download
    try {
        # Get region setting to determine download source
        $globalVarDir = Join-Path $env:USERPROFILE ".core_node\.global_vars"
        $regionFile = Join-Path $globalVarDir "SELECTED_REGION"
        $selectedRegion = "China"  # Default to China
        
        if (Test-Path $regionFile) {
            $selectedRegion = Get-Content $regionFile -TotalCount 1 -ErrorAction SilentlyContinue
            if (-not $selectedRegion) {
                $selectedRegion = "China"
            }
        }
        
        # Determine download base URL based on region
        $baseUrl = if ($selectedRegion -eq "Global") {
            "https://raw.githubusercontent.com/accountbelongstox/core_node/main"
        } else {
            "https://gitee.com/accountbelongstox/core_node/raw/main"
        }
        
        $downloadUrl = "$baseUrl/$SubPath"
        $downloadDir = Split-Path $localPath -Parent
        
        # Ensure download directory exists
        if (-not (Test-Path $downloadDir)) {
            New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
        }
        
        Write-Host "Downloading script from: $downloadUrl" -ForegroundColor Cyan
        Write-Host "Saving to: $localPath" -ForegroundColor Cyan
        
        # Download the file
        Invoke-WebRequest -Uri $downloadUrl -OutFile $localPath -UseBasicParsing -ErrorAction Stop
        
        if (Test-Path $localPath) {
            Write-Host "Successfully downloaded script: $localPath" -ForegroundColor Green
            return $localPath
        } else {
            Write-Host "Failed to download script" -ForegroundColor Red
            return $null
        }
        
    } catch {
        Write-Host "Failed to download script: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Falling back to local path: $localPath" -ForegroundColor Yellow
        
        # Return local path even if it doesn't exist, let the calling script handle the error
        return $localPath
    }
}

