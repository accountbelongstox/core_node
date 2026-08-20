# VarManager.ps1
# File-backed variable management for PowerShell.

function Get-VarsDir {
    $userProfile = [Environment]::GetFolderPath("UserProfile")
    $varsDir = Join-Path $userProfile ".core_node\.build_global_vars"

    if (-not (Test-Path $varsDir)) {
        try {
            New-Item -ItemType Directory -Path $varsDir -Force | Out-Null
        }
        catch {
            Write-Error "Failed to create vars directory: $varsDir"
            Write-Error $_.Exception.Message
            throw
        }
    }

    return $varsDir
}

function Set-Var {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$true)]
        [AllowEmptyString()]
        [string]$Value
    )

    if ([string]::IsNullOrEmpty($Key)) {
        throw "Variable key cannot be empty"
    }

    $varsDir = Get-VarsDir
    $varFile = Join-Path $varsDir $Key

    try {
        [System.IO.File]::WriteAllText($varFile, $Value, [System.Text.Encoding]::UTF8)
    }
    catch {
        Write-Error "Failed to write variable '$Key': $_"
        throw
    }
}

function Get-Var {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$false)]
        [string]$Default = $null
    )

    if ([string]::IsNullOrEmpty($Key)) {
        throw "Variable key cannot be empty"
    }

    $varsDir = Get-VarsDir
    $varFile = Join-Path $varsDir $Key

    if (-not (Test-Path $varFile)) {
        return $Default
    }

    try {
        return [System.IO.File]::ReadAllText($varFile, [System.Text.Encoding]::UTF8)
    }
    catch {
        Write-Warning "Failed to read variable '$Key': $_"
        return $Default
    }
}

function Remove-Var {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key
    )

    if ([string]::IsNullOrEmpty($Key)) {
        throw "Variable key cannot be empty"
    }

    $varsDir = Get-VarsDir
    $varFile = Join-Path $varsDir $Key

    if (Test-Path $varFile) {
        try {
            Remove-Item -Path $varFile -Force
        }
        catch {
            Write-Warning "Failed to delete variable '$Key': $_"
        }
    }
}

function Clear-AllVars {
    $varsDir = Get-VarsDir

    if (Test-Path $varsDir) {
        Get-ChildItem -Path $varsDir -File | ForEach-Object {
            try {
                Remove-Item -Path $_.FullName -Force
            }
            catch {
                Write-Warning "Failed to delete $($_.Name): $_"
            }
        }
    }
}

function Get-AllVars {
    $varsDir = Get-VarsDir
    $result = @{}

    if (Test-Path $varsDir) {
        Get-ChildItem -Path $varsDir -File | ForEach-Object {
            try {
                $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
                $result[$_.Name] = $content
            }
            catch {
                Write-Warning "Failed to read $($_.Name): $_"
            }
        }
    }

    return $result
}

function Test-Var {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key
    )

    if ([string]::IsNullOrEmpty($Key)) {
        return $false
    }

    $varsDir = Get-VarsDir
    $varFile = Join-Path $varsDir $Key

    return Test-Path $varFile
}
