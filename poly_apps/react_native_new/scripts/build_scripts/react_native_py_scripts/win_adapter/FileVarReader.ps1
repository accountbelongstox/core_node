# FileVarReader.ps1
# PowerShell module to read file variables written by Python scripts
# Corresponds to Python's FileVarSystem

# Import KEY Center
. "$PSScriptRoot\KeyCenter.ps1"

$script:GlobalVarDir = $null
$script:GlobalVarNamespace = "RN_BUILD"

function Initialize-FileVarSystem {
    param(
        [Parameter(Mandatory = $false)]
        [string]$Namespace = "RN_BUILD"
    )

    # Use the global variable directory from core_node
    # Python's GlobalVarManager uses flat structure with namespace prefix
    $userDir = Join-Path $env:USERPROFILE ".core_node"
    $script:GlobalVarDir = Join-Path $userDir ".global_vars"
    $script:GlobalVarNamespace = $Namespace

    # Ensure directory exists
    if (-not (Test-Path $script:GlobalVarDir)) {
        New-Item -ItemType Directory -Path $script:GlobalVarDir -Force | Out-Null
    }

    return $script:GlobalVarDir
}

function Get-FileVar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [Parameter(Mandatory = $false)]
        [string]$Default = $null
    )

    if (-not $script:GlobalVarDir) {
        Initialize-FileVarSystem
    }

    # Python's GlobalVarManager uses {namespace}_{key} format
    $fileName = "$($script:GlobalVarNamespace)_$Key"
    $varFile = Join-Path $script:GlobalVarDir $fileName

    if (Test-Path $varFile) {
        try {
            $content = Get-Content $varFile -Raw -Encoding UTF8
            return $content.Trim()
        } catch {
            return $Default
        }
    }

    return $Default
}

function Get-GlobalFileVar {
    <#
    .SYNOPSIS
    Get global file variable (no namespace prefix)

    .DESCRIPTION
    Read global keys written by Python's GlobalVarManager(namespace=None)
    These keys have NO namespace prefix

    .PARAMETER Key
    Global key name (e.g., "FACTORY_BUILD_PATH")

    .PARAMETER Default
    Default value if key doesn't exist
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [Parameter(Mandatory = $false)]
        [string]$Default = $null
    )

    if (-not $script:GlobalVarDir) {
        Initialize-FileVarSystem
    }

    # Global keys have NO namespace prefix
    $varFile = Join-Path $script:GlobalVarDir $Key

    if (Test-Path $varFile) {
        try {
            $content = Get-Content $varFile -Raw -Encoding UTF8
            return $content.Trim()
        } catch {
            return $Default
        }
    }

    return $Default
}

function Get-FileVarJson {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [Parameter(Mandatory = $false)]
        [hashtable]$Default = $null
    )

    if (-not $script:GlobalVarDir) {
        Initialize-FileVarSystem
    }

    # Python's GlobalVarManager uses {namespace}_{key} format
    $fileName = "$($script:GlobalVarNamespace)_$Key"
    $varFile = Join-Path $script:GlobalVarDir $fileName

    if (Test-Path $varFile) {
        try {
            $content = Get-Content $varFile -Raw -Encoding UTF8
            $jsonObj = $content | ConvertFrom-Json

            # Convert PSCustomObject to Hashtable recursively
            $result = Convert-PSObjectToHashtable $jsonObj
            return $result
        } catch {
            return $Default
        }
    }

    return $Default
}

function Convert-PSObjectToHashtable {
    param([Parameter(Mandatory=$true)]$InputObject)

    if ($null -eq $InputObject) {
        return $null
    }

    if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
        $collection = @()
        foreach ($item in $InputObject) {
            $collection += Convert-PSObjectToHashtable $item
        }
        return $collection
    }
    elseif ($InputObject -is [PSCustomObject]) {
        $hash = @{}
        foreach ($property in $InputObject.PSObject.Properties) {
            $hash[$property.Name] = Convert-PSObjectToHashtable $property.Value
        }
        return $hash
    }
    else {
        return $InputObject
    }
}

function Set-FileVar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    if (-not $script:GlobalVarDir) {
        Initialize-FileVarSystem
    }

    $varFile = Join-Path $script:GlobalVarDir $Key

    $Value | Set-Content $varFile -Encoding UTF8 -NoNewline

    return $varFile
}

function Clear-FileVar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key
    )

    if (-not $script:GlobalVarDir) {
        Initialize-FileVarSystem
    }

    $varFile = Join-Path $script:GlobalVarDir $Key

    if (Test-Path $varFile) {
        Remove-Item $varFile -Force
    }
}

function Get-MenuSelection {
    return Get-FileVarJson -Key $script:KEY_MENU_SELECTION -Default $null
}

function Get-BuildState {
    return Get-FileVarJson -Key $script:KEY_BUILD_STATE -Default @{}
}

function Get-AppConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppName
    )

    $key = Get-AppConfigKey -AppName $AppName
    return Get-FileVarJson -Key $key -Default @{}
}

function Get-CommandStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandType
    )

    $key = Get-CommandKey -CommandType $CommandType
    return Get-FileVarJson -Key $key -Default $null
}

function Set-CommandResult {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandType,
        [Parameter(Mandatory = $true)]
        [hashtable]$Result
    )

    $key = Get-ResultKey -ResultType $CommandType
    $jsonContent = $Result | ConvertTo-Json -Depth 10 -Compress
    Set-FileVar -Key $key -Value $jsonContent
}

function Get-ErrorMessage {
    return Get-FileVar -Key $script:KEY_ERROR -Default $null
}

function Clear-ErrorMessage {
    Clear-FileVar -Key $script:KEY_ERROR
}
