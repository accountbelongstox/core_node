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

# Windows Service Management Library
# Provides functions for managing Windows services with safety checks
# Supports configurable service prefix for different applications

param(
    [string]$ServicePrefix = "DD"
)

# Global variables
$Global:SERVICE_OPERATION_COUNT = 0
$Global:MAX_SERVICE_OPERATIONS = 10
$Global:SERVICE_PREFIX = $ServicePrefix

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

