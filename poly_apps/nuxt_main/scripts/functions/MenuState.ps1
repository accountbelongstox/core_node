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

# Menu State Management

$script:StateDir = ""
$script:StateFile = ""

function Initialize-StateDirectory {
    $userProfile = $env:USERPROFILE
    $script:StateDir = Join-Path $userProfile ".core_node\.nuxt_main"
    $script:StateFile = Join-Path $script:StateDir "menu_state.json"

    if (-not (Test-Path $script:StateDir)) {
        New-Item -ItemType Directory -Path $script:StateDir -Force | Out-Null
    }
}

function Get-MenuState {
    Initialize-StateDirectory
    $validModes = @("debug", "build")

    if (Test-Path $script:StateFile) {
        try {
            $stateContent = Get-Content -Path $script:StateFile -Raw -ErrorAction Stop
            $state = $stateContent | ConvertFrom-Json
            $modeValue = $state.Mode
            if ($validModes -notcontains $modeValue) {
                $modeValue = "debug"
            }
            return @{
                SelectedIndex = [int]$state.SelectedIndex
                Mode = $modeValue
            }
        }
        catch {
            return @{
                SelectedIndex = 0
                Mode = "debug"
            }
        }
    }

    return @{
        SelectedIndex = 0
        Mode = "debug"
    }
}

function Save-MenuState {
    param(
        [Parameter(Mandatory = $true)]
        [int]$SelectedIndex,
        [Parameter(Mandatory = $true)]
        [string]$Mode
    )

    Initialize-StateDirectory

    $validModes = @("debug", "build")
    $modeValue = if ($validModes -contains $Mode) { $Mode } else { "debug" }

    $state = @{
        SelectedIndex = $SelectedIndex
        Mode = $modeValue
        LastUpdated = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }

    $state | ConvertTo-Json | Set-Content -Path $script:StateFile -Force
}
