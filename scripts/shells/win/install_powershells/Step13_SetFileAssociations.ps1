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

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Script metadata
$SCRIPT_INDEX = "[Step13]"
$SCRIPT_VERSION = "3.0"

# Import required modules
$GlobalVarsPath = Join-Path $PSScriptRoot "..\win_common\GlobalVars.ps1"
if (Test-Path $GlobalVarsPath) {
    . $GlobalVarsPath
} else {
    Write-Host "$SCRIPT_INDEX ERROR: GlobalVars.ps1 not found at: $GlobalVarsPath" -ForegroundColor Red
    exit 1
}

# Declare variables
$PowerShellRegistryPath = "HKEY_CLASSES_ROOT\Microsoft.PowerShellScript.1\Shell\Open\Command"
$PowerShellExecutable = "${env:SystemRoot}\System32\WindowsPowerShell\v1.0\powershell.exe"
$PowerShellCommandTemplate = '"{0}" -noLogo -ExecutionPolicy Bypass -File "%1" %*'

function Write-ColorMessage {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    
    $color = switch ($Type) {
        "Success" { "Green" }
        "Error" { "Red" }
        "Warning" { "Yellow" }
        "Info" { "Cyan" }
        default { "White" }
    }
    
    Write-Host "$SCRIPT_INDEX $Message" -ForegroundColor $color
}

function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-PowerShellExecutable {
    Write-ColorMessage -Message "Checking PowerShell executable..." -Type "Info"
    
    if (Test-Path $PowerShellExecutable) {
        Write-ColorMessage -Message "PowerShell executable found: $PowerShellExecutable" -Type "Success"
        return $true
    } else {
        Write-ColorMessage -Message "PowerShell executable not found: $PowerShellExecutable" -Type "Error"
        return $false
    }
}

function Get-CurrentPowerShellCommand {
    Write-ColorMessage -Message "Getting current PowerShell command from registry..." -Type "Info"
    
    try {
        $currentCommand = [Microsoft.Win32.Registry]::GetValue($PowerShellRegistryPath, "", "")
        if ($currentCommand) {
            Write-ColorMessage -Message "Current command: $currentCommand" -Type "Info"
            return $currentCommand
        } else {
            Write-ColorMessage -Message "No current command found in registry" -Type "Warning"
            return $null
        }
    } catch {
        Write-ColorMessage -Message "Failed to read registry: $_" -Type "Error"
        return $null
    }
}

function Set-PowerShellCommand {
    Write-ColorMessage -Message "Setting PowerShell command in registry..." -Type "Info"
    
    try {
        $newCommand = $PowerShellCommandTemplate -f $PowerShellExecutable
        Write-ColorMessage -Message "New command: $newCommand" -Type "Info"
        
        [Microsoft.Win32.Registry]::SetValue($PowerShellRegistryPath, "", $newCommand)
        Write-ColorMessage -Message "PowerShell command set successfully" -Type "Success"
        return $true
    } catch {
        Write-ColorMessage -Message "Failed to set PowerShell command: $_" -Type "Error"
        return $false
    }
}

function Test-PowerShellCommand {
    Write-ColorMessage -Message "Testing PowerShell command configuration..." -Type "Info"
    
    try {
        $currentCommand = [Microsoft.Win32.Registry]::GetValue($PowerShellRegistryPath, "", "")
        $expectedCommand = $PowerShellCommandTemplate -f $PowerShellExecutable
        
        if ($currentCommand -eq $expectedCommand) {
            Write-ColorMessage -Message "PowerShell command is correctly configured" -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "PowerShell command is not correctly configured" -Type "Warning"
            Write-ColorMessage -Message "Expected: $expectedCommand" -Type "Info"
            Write-ColorMessage -Message "Current: $currentCommand" -Type "Info"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "Failed to test PowerShell command: $_" -Type "Error"
        return $false
    }
}

function Set-PowerShellExecutionPolicy {
    Write-ColorMessage -Message "Setting PowerShell execution policy..." -Type "Info"
    
    try {
        # Check current execution policy
        $currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
        Write-ColorMessage -Message "Current execution policy: $currentPolicy" -Type "Info"
        
        if ($currentPolicy -eq "Restricted") {
            Write-ColorMessage -Message "Setting execution policy to RemoteSigned for CurrentUser..." -Type "Info"
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
            Write-ColorMessage -Message "PowerShell execution policy set successfully" -Type "Success"
        } else {
            Write-ColorMessage -Message "Execution policy is already permissive: $currentPolicy" -Type "Success"
        }
        
        # Also try to set for LocalMachine if we have admin rights
        try {
            $machinePolicy = Get-ExecutionPolicy -Scope LocalMachine
            if ($machinePolicy -eq "Restricted") {
                Write-ColorMessage -Message "Attempting to set execution policy for LocalMachine..." -Type "Info"
                Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
                Write-ColorMessage -Message "LocalMachine execution policy set successfully" -Type "Success"
            }
        } catch {
            Write-ColorMessage -Message "Could not set LocalMachine execution policy (may need admin rights): $_" -Type "Warning"
        }
        
    } catch {
        Write-ColorMessage -Message "WARNING: Could not set PowerShell execution policy: $_" -Type "Warning"
        Write-ColorMessage -Message "Scripts may not execute properly due to execution policy restrictions" -Type "Warning"
    }
}

function Show-ConfigurationSummary {
    param(
        [bool]$Success,
        [string]$CurrentCommand = "",
        [string]$ExpectedCommand = ""
    )
    
    Write-ColorMessage -Message "PowerShell Configuration Summary:" -Type "Info"
    Write-ColorMessage -Message "=================================" -Type "Info"
    Write-ColorMessage -Message "Status: $(if ($Success) { 'SUCCESS' } else { 'FAILED' })" -Type $(if ($Success) { 'Success' } else { 'Error' })
    Write-ColorMessage -Message "PowerShell Executable: $PowerShellExecutable" -Type "Info"
    Write-ColorMessage -Message "Registry Path: $PowerShellRegistryPath" -Type "Info"
    Write-ColorMessage -Message "Expected Command: $ExpectedCommand" -Type "Info"
    Write-ColorMessage -Message "Current Command: $CurrentCommand" -Type "Info"
}

# Main execution
Write-ColorMessage -Message "Configuring PowerShell Script Execution" -Type "Info"
Write-ColorMessage -Message "Script Version: $SCRIPT_VERSION" -Type "Info"
Write-ColorMessage -Message "Detected Windows version: $winVer" -Type "Info"
Write-ColorMessage -Message "Windows 10: $Global:isWin10, Windows 11: $Global:isWin11" -Type "Info"

# Check admin privileges
$isAdmin = Test-AdminPrivileges
if (-not $isAdmin) {
    Write-ColorMessage -Message "WARNING: This script requires administrator privileges for registry modifications" -Type "Warning"
    Write-ColorMessage -Message "Some operations may fail without admin rights" -Type "Warning"
}

# Check PowerShell executable
if (-not (Test-PowerShellExecutable)) {
    Write-ColorMessage -Message "PowerShell executable not found. Cannot proceed." -Type "Error"
    exit 1
}

# Set execution policy
Set-PowerShellExecutionPolicy

# Get current command
$currentCommand = Get-CurrentPowerShellCommand
$expectedCommand = $PowerShellCommandTemplate -f $PowerShellExecutable

# Check if configuration is already correct
if ($currentCommand -eq $expectedCommand) {
    Write-ColorMessage -Message "PowerShell command is already correctly configured" -Type "Success"
    $success = $true
} else {
    # Set the new command
    $success = Set-PowerShellCommand
    
    if ($success) {
        # Test the configuration
        $testResult = Test-PowerShellCommand
        if (-not $testResult) {
            Write-ColorMessage -Message "Configuration test failed" -Type "Warning"
            $success = $false
        }
    }
}

# Get final command for summary
$finalCommand = Get-CurrentPowerShellCommand

# Show summary
Show-ConfigurationSummary -Success $success -CurrentCommand $finalCommand -ExpectedCommand $expectedCommand

if ($success) {
    Write-ColorMessage -Message "PowerShell script execution configuration completed successfully" -Type "Success"
    Write-ColorMessage -Message ".ps1 files will now execute with: -noLogo -ExecutionPolicy Bypass" -Type "Info"
} else {
    Write-ColorMessage -Message "PowerShell script execution configuration completed with errors" -Type "Warning"
    Write-ColorMessage -Message "Try running as administrator if issues persist" -Type "Info"
}

Write-ColorMessage -Message "Script execution completed" -Type "Info"