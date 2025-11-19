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

# Global Variable Exchange System (Gvar)
# Similar to Flutter Bloom's Gvar system for cross-script variable sharing

$script:GvarDir = ""
$script:GvarFile = ""

function Initialize-GvarDirectory {
    $userProfile = $env:USERPROFILE
    $script:GvarDir = Join-Path $userProfile ".core_node\.nuxt_main\.gvar"
    $script:GvarFile = Join-Path $script:GvarDir "gvar.json"

    if (-not (Test-Path $script:GvarDir)) {
        New-Item -ItemType Directory -Path $script:GvarDir -Force | Out-Null
    }
}

function Get-Gvar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [Parameter(Mandatory = $false)]
        $DefaultValue = $null
    )

    Initialize-GvarDirectory

    if (Test-Path $script:GvarFile) {
        try {
            $gvarContent = Get-Content -Path $script:GvarFile -Raw -ErrorAction Stop
            $gvars = $gvarContent | ConvertFrom-Json

            if ($gvars.PSObject.Properties.Name -contains $Key) {
                return $gvars.$Key
            }
        }
        catch {
            Write-Host "[WARN] Failed to read Gvar: $_" -ForegroundColor Yellow
        }
    }

    return $DefaultValue
}

function Set-Gvar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [Parameter(Mandatory = $true)]
        $Value
    )

    Initialize-GvarDirectory

    $gvars = @{}

    if (Test-Path $script:GvarFile) {
        try {
            $gvarContent = Get-Content -Path $script:GvarFile -Raw -ErrorAction Stop
            $gvars = $gvarContent | ConvertFrom-Json -AsHashtable
        }
        catch {
            $gvars = @{}
        }
    }

    $gvars[$Key] = $Value
    $gvars["LastUpdated"] = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

    $gvars | ConvertTo-Json -Depth 10 | Set-Content -Path $script:GvarFile -Force
}

function Get-AllGvars {
    Initialize-GvarDirectory

    if (Test-Path $script:GvarFile) {
        try {
            $gvarContent = Get-Content -Path $script:GvarFile -Raw -ErrorAction Stop
            return $gvarContent | ConvertFrom-Json
        }
        catch {
            return @{}
        }
    }

    return @{}
}

function Clear-Gvar {
    param(
        [Parameter(Mandatory = $false)]
        [string]$Key
    )

    Initialize-GvarDirectory

    if ($Key) {
        $gvars = @{}

        if (Test-Path $script:GvarFile) {
            try {
                $gvarContent = Get-Content -Path $script:GvarFile -Raw -ErrorAction Stop
                $gvars = $gvarContent | ConvertFrom-Json -AsHashtable
            }
            catch {
                return
            }
        }

        if ($gvars.ContainsKey($Key)) {
            $gvars.Remove($Key)
            $gvars | ConvertTo-Json -Depth 10 | Set-Content -Path $script:GvarFile -Force
        }
    }
    else {
        if (Test-Path $script:GvarFile) {
            Remove-Item $script:GvarFile -Force
        }
    }
}

function Show-GvarInfo {
    $gvars = Get-AllGvars

    Write-Host ""
    Write-Host "=== Global Variables (Gvar) ===" -ForegroundColor Cyan
    Write-Host "Location: $script:GvarFile" -ForegroundColor Gray
    Write-Host ""

    if ($gvars.PSObject.Properties.Count -eq 0) {
        Write-Host "  No variables stored" -ForegroundColor Yellow
    }
    else {
        foreach ($prop in $gvars.PSObject.Properties) {
            Write-Host "  $($prop.Name) = $($prop.Value)" -ForegroundColor Green
        }
    }

    Write-Host ""
}
