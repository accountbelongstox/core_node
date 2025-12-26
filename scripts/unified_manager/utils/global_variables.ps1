# Unified Global Variable Manager - PowerShell Implementation
# Centralized variable storage system for Windows
# Stores variables in: C:\Users\用户名\.core_node\.build_global_vars
# Format: filename=key, file_content=value

# Variable declarations - all at top
$Script:GlobalVarsDir = $null
$Script:VariableKeys = @{}
$Script:StatusValues = @{}

# Initialize variable keys (centralized definitions)
$Script:VariableKeys = @{
    # System Information Keys
    PLATFORM = "PLATFORM"
    IS_WINDOWS = "IS_WINDOWS"
    IS_LINUX = "IS_LINUX"
    ROOT_DIR = "ROOT_DIR"
    CACHE_DIR = "CACHE_DIR"
    TEMP_DIR = "TEMP_DIR"

    # Application Data Keys
    APP_COUNT = "APP_COUNT"
    APPS_DATA = "APPS_DATA"

    # Platform Features
    ENABLE_SYSTEMD = "ENABLE_SYSTEMD"
    ENABLE_NGINX = "ENABLE_NGINX"
    ENABLE_FIREWALL = "ENABLE_FIREWALL"
    ENABLE_DOMAIN_PROXY = "ENABLE_DOMAIN_PROXY"

    # Status and Communication
    STATUS = "STATUS"
    LAUNCH_COMMAND = "LAUNCH_COMMAND"

    # User Interface State
    CURRENT_INDEX = "CURRENT_INDEX"
    MAX_APP_NAME_WIDTH = "MAX_APP_NAME_WIDTH"
}

# Status Values
$Script:StatusValues = @{
    SCAN_COMPLETE = "scan_complete"
    COMMAND_READY = "command_ready"
    SELECTION_UPDATED = "selection_updated"
    ERROR_INVALID_INDEX = "error_invalid_index"
    ERROR_INVALID_SCRIPT = "error_invalid_script"
}

function Initialize-GlobalVariables {
    <#
    .SYNOPSIS
    Initialize the global variables directory
    #>

    # Get global variables directory
    $UserHome = $env:USERPROFILE
    $Script:GlobalVarsDir = Join-Path $UserHome ".core_node\.build_global_vars"

    # Ensure directory exists
    if (-not (Test-Path $Script:GlobalVarsDir)) {
        try {
            New-Item -Path $Script:GlobalVarsDir -ItemType Directory -Force | Out-Null
        }
        catch {
            throw "Cannot create variables directory $Script:GlobalVarsDir`: $($_.Exception.Message)"
        }
    }
}

function Write-GlobalVar {
    <#
    .SYNOPSIS
    Write a variable to global storage
    .PARAMETER Key
    Variable key (filename)
    .PARAMETER Value
    Variable value (file content)
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$true)]
        $Value
    )

    if ([string]::IsNullOrEmpty($Key)) {
        throw "Variable key cannot be empty"
    }

    if ($null -eq $Script:GlobalVarsDir) {
        Initialize-GlobalVariables
    }

    $VarFile = Join-Path $Script:GlobalVarsDir $Key

    # Convert value to string
    if ($Value -is [hashtable] -or $Value -is [array] -or $Value -is [PSCustomObject]) {
        $Content = $Value | ConvertTo-Json -Compress
    }
    elseif ($Value -is [bool]) {
        $Content = $Value.ToString().ToLower()
    }
    else {
        $Content = $Value.ToString()
    }

    try {
        $Content | Out-File -FilePath $VarFile -Encoding utf8 -NoNewline
    }
    catch {
        throw "Cannot write variable $Key`: $($_.Exception.Message)"
    }
}

function Read-GlobalVar {
    <#
    .SYNOPSIS
    Read a variable from global storage
    .PARAMETER Key
    Variable key (filename)
    .PARAMETER Default
    Default value if variable doesn't exist
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$false)]
        $Default = ""
    )

    if ([string]::IsNullOrEmpty($Key)) {
        return $Default.ToString()
    }

    if ($null -eq $Script:GlobalVarsDir) {
        Initialize-GlobalVariables
    }

    $VarFile = Join-Path $Script:GlobalVarsDir $Key

    if (Test-Path $VarFile) {
        try {
            $Content = Get-Content $VarFile -Raw -Encoding utf8 -ErrorAction Stop
            if ($Content) {
                return $Content.Trim()
            }
        }
        catch {
            # Return default on error
        }
    }

    return $Default.ToString()
}

function Read-GlobalVarAsJson {
    <#
    .SYNOPSIS
    Read a JSON variable from global storage
    .PARAMETER Key
    Variable key
    .PARAMETER Default
    Default hashtable if variable doesn't exist
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$false)]
        [hashtable]$Default = @{}
    )

    $Content = Read-GlobalVar -Key $Key -Default ""
    if ($Content) {
        try {
            return $Content | ConvertFrom-Json -AsHashtable
        }
        catch {
            # Return default on JSON parse error
        }
    }
    return $Default
}

function Read-GlobalVarAsBool {
    <#
    .SYNOPSIS
    Read a boolean variable from global storage
    .PARAMETER Key
    Variable key
    .PARAMETER Default
    Default boolean value
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$false)]
        [bool]$Default = $false
    )

    $Value = Read-GlobalVar -Key $Key -Default $Default.ToString().ToLower()
    return $Value.ToLower() -in @('true', '1', 'yes', 'on')
}

function Read-GlobalVarAsInt {
    <#
    .SYNOPSIS
    Read an integer variable from global storage
    .PARAMETER Key
    Variable key
    .PARAMETER Default
    Default integer value
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$false)]
        [int]$Default = 0
    )

    $Value = Read-GlobalVar -Key $Key -Default $Default.ToString()
    try {
        return [int]$Value
    }
    catch {
        return $Default
    }
}

function Remove-GlobalVar {
    <#
    .SYNOPSIS
    Delete a variable from global storage
    .PARAMETER Key
    Variable key to delete
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key
    )

    if ([string]::IsNullOrEmpty($Key)) {
        return $false
    }

    if ($null -eq $Script:GlobalVarsDir) {
        Initialize-GlobalVariables
    }

    $VarFile = Join-Path $Script:GlobalVarsDir $Key
    if (Test-Path $VarFile) {
        try {
            Remove-Item $VarFile -Force
            return $true
        }
        catch {
            return $false
        }
    }
    return $false
}

function Clear-AllGlobalVars {
    <#
    .SYNOPSIS
    Clear all variables from global storage
    #>

    if ($null -eq $Script:GlobalVarsDir) {
        Initialize-GlobalVariables
    }

    $DeletedCount = 0
    try {
        $Files = Get-ChildItem $Script:GlobalVarsDir -File
        foreach ($File in $Files) {
            try {
                Remove-Item $File.FullName -Force
                $DeletedCount++
            }
            catch {
                # Continue with next file
            }
        }
    }
    catch {
        # Return count of deleted files
    }
    return $DeletedCount
}

function Get-GlobalVarsList {
    <#
    .SYNOPSIS
    List all variable keys in global storage
    #>

    if ($null -eq $Script:GlobalVarsDir) {
        Initialize-GlobalVariables
    }

    try {
        $Files = Get-ChildItem $Script:GlobalVarsDir -File
        return $Files.Name
    }
    catch {
        return @()
    }
}

function Get-GlobalVarsDirectory {
    <#
    .SYNOPSIS
    Get the variables directory path
    #>

    if ($null -eq $Script:GlobalVarsDir) {
        Initialize-GlobalVariables
    }

    return $Script:GlobalVarsDir
}

function Test-GlobalVar {
    <#
    .SYNOPSIS
    Check if a variable exists in global storage
    .PARAMETER Key
    Variable key to check
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key
    )

    if ([string]::IsNullOrEmpty($Key)) {
        return $false
    }

    if ($null -eq $Script:GlobalVarsDir) {
        Initialize-GlobalVariables
    }

    $VarFile = Join-Path $Script:GlobalVarsDir $Key
    return Test-Path $VarFile
}

# Convenience functions using standard variable keys
function Write-GlobalStatus {
    <#
    .SYNOPSIS
    Write status using standard key
    #>
    param([string]$Status)
    Write-GlobalVar -Key $Script:VariableKeys.STATUS -Value $Status
}

function Read-GlobalStatus {
    <#
    .SYNOPSIS
    Read status using standard key
    #>
    return Read-GlobalVar -Key $Script:VariableKeys.STATUS -Default ""
}

function Write-GlobalAppCount {
    <#
    .SYNOPSIS
    Write app count using standard key
    #>
    param([int]$Count)
    Write-GlobalVar -Key $Script:VariableKeys.APP_COUNT -Value $Count
}

function Read-GlobalAppCount {
    <#
    .SYNOPSIS
    Read app count using standard key
    #>
    return Read-GlobalVarAsInt -Key $Script:VariableKeys.APP_COUNT -Default 0
}

function Write-GlobalPlatformInfo {
    <#
    .SYNOPSIS
    Write platform information using standard keys
    #>
    param(
        [string]$Platform,
        [bool]$IsWindows,
        [bool]$IsLinux
    )
    Write-GlobalVar -Key $Script:VariableKeys.PLATFORM -Value $Platform
    Write-GlobalVar -Key $Script:VariableKeys.IS_WINDOWS -Value $IsWindows
    Write-GlobalVar -Key $Script:VariableKeys.IS_LINUX -Value $IsLinux
}

function Get-AppVariableKey {
    <#
    .SYNOPSIS
    Generate app-specific variable keys
    #>
    param(
        [int]$Index,
        [ValidateSet("NAME", "PATH", "TYPE", "FRAMEWORK", "PORT", "COMMAND", "DEBUG")]
        [string]$Property
    )
    return "APP_${Index}_${Property}"
}

function Write-GlobalAppData {
    <#
    .SYNOPSIS
    Write application data using standard keys
    #>
    param(
        [int]$Index,
        [string]$Name,
        [string]$Path,
        [string]$Type,
        [string]$Framework,
        [int]$Port,
        [string]$Command,
        [bool]$Debug
    )

    Write-GlobalVar -Key (Get-AppVariableKey -Index $Index -Property "NAME") -Value $Name
    Write-GlobalVar -Key (Get-AppVariableKey -Index $Index -Property "PATH") -Value $Path
    Write-GlobalVar -Key (Get-AppVariableKey -Index $Index -Property "TYPE") -Value $Type
    Write-GlobalVar -Key (Get-AppVariableKey -Index $Index -Property "FRAMEWORK") -Value $Framework
    Write-GlobalVar -Key (Get-AppVariableKey -Index $Index -Property "PORT") -Value $Port
    Write-GlobalVar -Key (Get-AppVariableKey -Index $Index -Property "COMMAND") -Value $Command
    Write-GlobalVar -Key (Get-AppVariableKey -Index $Index -Property "DEBUG") -Value $Debug
}

# Initialize on module load
Initialize-GlobalVariables