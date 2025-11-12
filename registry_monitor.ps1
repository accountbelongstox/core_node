# =============================================================================
# Registry Monitor Script
# Continuously traverses and monitors registry keys
# =============================================================================

param(
    [string]$RegistryPath = "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\FlightSettings",
    [int]$IntervalSeconds = 5,
    [switch]$Recursive = $false,
    [switch]$ShowValues = $true
)

# Convert registry path format
function Convert-RegistryPath {
    param([string]$Path)
    
    if ($Path -match "^HKEY_LOCAL_MACHINE") {
        return $Path -replace "HKEY_LOCAL_MACHINE", "HKLM:"
    }
    elseif ($Path -match "^HKEY_CURRENT_USER") {
        return $Path -replace "HKEY_CURRENT_USER", "HKCU:"
    }
    elseif ($Path -match "^HKEY_CLASSES_ROOT") {
        return $Path -replace "HKEY_CLASSES_ROOT", "HKCR:"
    }
    elseif ($Path -match "^HKEY_USERS") {
        return $Path -replace "HKEY_USERS", "HKU:"
    }
    elseif ($Path -match "^HKEY_CURRENT_CONFIG") {
        return $Path -replace "HKEY_CURRENT_CONFIG", "HKCC:"
    }
    else {
        return $Path
    }
}

# Traverse registry keys
function Traverse-Registry {
    param(
        [string]$Path,
        [bool]$Recurse = $false,
        [bool]$ShowValues = $true,
        [int]$Depth = 0
    )
    
    $indent = "  " * $Depth
    
    try {
        if (Test-Path $Path) {
            Write-Host "$indent[$Path]" -ForegroundColor Cyan
            
            if ($ShowValues) {
                $properties = Get-ItemProperty -Path $Path -ErrorAction SilentlyContinue
                if ($properties) {
                    $propertyNames = $properties.PSObject.Properties | Where-Object { $_.Name -notmatch "^PS" }
                    foreach ($prop in $propertyNames) {
                        $value = $properties.$($prop.Name)
                        $valueStr = if ($value -is [array]) { 
                            "[$($value -join ', ')]" 
                        } else { 
                            $value 
                        }
                        Write-Host "$indent  $($prop.Name) = $valueStr" -ForegroundColor Green
                    }
                }
            }
            
            if ($Recurse) {
                $subKeys = Get-ChildItem -Path $Path -ErrorAction SilentlyContinue
                foreach ($subKey in $subKeys) {
                    Traverse-Registry -Path $subKey.PSPath -Recurse $true -ShowValues $ShowValues -Depth ($Depth + 1)
                }
            }
            else {
                $subKeys = Get-ChildItem -Path $Path -ErrorAction SilentlyContinue
                foreach ($subKey in $subKeys) {
                    Write-Host "$indent  -> $($subKey.PSChildName)" -ForegroundColor Yellow
                }
            }
        }
        else {
            Write-Host "$indent[ERROR] Path not found: $Path" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "$indent[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main monitoring loop
function Start-RegistryMonitor {
    param(
        [string]$Path,
        [int]$Interval,
        [bool]$Recurse,
        [bool]$ShowValues
    )
    
    $convertedPath = Convert-RegistryPath -Path $Path
    
    Write-Host "==============================================================================" -ForegroundColor White
    Write-Host "Registry Monitor Started" -ForegroundColor White
    Write-Host "==============================================================================" -ForegroundColor White
    Write-Host "Monitoring Path: $Path" -ForegroundColor Yellow
    Write-Host "Converted Path: $convertedPath" -ForegroundColor Yellow
    Write-Host "Interval: $Interval seconds" -ForegroundColor Yellow
    Write-Host "Recursive: $Recurse" -ForegroundColor Yellow
    Write-Host "Show Values: $ShowValues" -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host "==============================================================================" -ForegroundColor White
    Write-Host ""
    
    $iteration = 0
    
    while ($true) {
        $iteration++
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        
        Write-Host "==============================================================================" -ForegroundColor Magenta
        Write-Host "[$timestamp] Iteration #$iteration" -ForegroundColor Magenta
        Write-Host "==============================================================================" -ForegroundColor Magenta
        
        Traverse-Registry -Path $convertedPath -Recurse $Recurse -ShowValues $ShowValues
        
        Write-Host ""
        Write-Host "Waiting $Interval seconds until next iteration..." -ForegroundColor Gray
        Write-Host ""
        
        Start-Sleep -Seconds $Interval
    }
}

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Warning "Not running as administrator. Some registry keys may not be accessible."
    Write-Host "Press any key to continue or Ctrl+C to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Start monitoring
try {
    Start-RegistryMonitor -Path $RegistryPath -Interval $IntervalSeconds -Recurse $Recursive -ShowValues $ShowValues
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack Trace: $($_.ScriptStackTrace)" -ForegroundColor Red
    exit 1
}

