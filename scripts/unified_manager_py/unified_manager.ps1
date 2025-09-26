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

# Unified Manager - Python Integration Version
# This PowerShell script serves as a bridge to the Python-based unified manager
# It calls the Python script and executes the returned script path

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PYTHON_MAIN = Join-Path $SCRIPT_DIR "main.py"
$IS_WINDOWS = $env:OS -eq "Windows_NT"
$USER_HOME = [Environment]::GetFolderPath("UserProfile")
if ([string]::IsNullOrWhiteSpace($USER_HOME)) {
    $USER_HOME = $env:HOME
}
if ([string]::IsNullOrWhiteSpace($USER_HOME)) {
    $USER_HOME = [Environment]::GetFolderPath("HomeDirectory")
}
$DATA_DIR = Join-Path (Join-Path $USER_HOME ".core_node") "unified_manager"
$CACHE_DIR = Join-Path $DATA_DIR "cache"
$RESULT_FILE = Join-Path $DATA_DIR "action_result.json"

if (-not (Test-Path -LiteralPath $DATA_DIR)) {
    New-Item -ItemType Directory -Path $DATA_DIR -Force | Out-Null
}
if (-not (Test-Path -LiteralPath $CACHE_DIR)) {
    New-Item -ItemType Directory -Path $CACHE_DIR -Force | Out-Null
}

# Function to write colored messages
function Write-ColorMessage {
    param(
        [Parameter(Mandatory=$true)] [string]$Message,
        [Parameter(Mandatory=$true)] [ValidateSet("Info", "Success", "Warning", "Error")] [string]$Type
    )

    $color = switch ($Type) {
        "Info"    { "Cyan" }
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error"   { "Red" }
    }

    $prefix = switch ($Type) {
        "Info"    { "[INFO] " }
        "Success" { "[OK] " }
        "Warning" { "[WARN] " }
        "Error"   { "[ERROR] " }
    }

    Write-Host -ForegroundColor $color "$prefix$Message"
}

# Function to check if Python is available
function Test-PythonAvailable {
    try {
        $null = & python --version 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Get-ActionResultData {
    if (-not (Test-Path -LiteralPath $RESULT_FILE)) {
        Write-ColorMessage -Message "Result file not found: $RESULT_FILE" -Type "Warning"
        return $null
    }

    try {
        $jsonText = Get-Content -LiteralPath $RESULT_FILE -Raw -Encoding UTF8
        if ([string]::IsNullOrWhiteSpace($jsonText)) {
            Write-ColorMessage -Message "Result file is empty." -Type "Warning"
            return $null
        }
        return $jsonText | ConvertFrom-Json
    } catch {
        Write-ColorMessage -Message "Failed to parse result file: $_" -Type "Warning"
        return $null
    }
}

function Invoke-ExplorerScript {
    param([Parameter(Mandatory=$true)] [string]$ScriptPath)

    if (-not $IS_WINDOWS) {
        Write-ColorMessage -Message "Explorer invocation is only supported on Windows." -Type "Warning"
        return
    }

    try {
        $resolvedPath = (Resolve-Path -LiteralPath $ScriptPath).Path
    } catch {
        Write-ColorMessage -Message "Cannot resolve script path: $ScriptPath" -Type "Error"
        return
    }

    Write-ColorMessage -Message "Launching script via explorer: $resolvedPath" -Type "Info"

    try {
        Start-Process -FilePath "explorer.exe" -ArgumentList $resolvedPath | Out-Null
    } catch {
        Write-ColorMessage -Message ("Failed to launch explorer for " + $resolvedPath + ": " + $_.Exception.Message) -Type "Error"
    }
}

# Function to execute the Python unified manager
function Invoke-PythonUnifiedManager {
    if (-not (Test-Path -LiteralPath $PYTHON_MAIN)) {
        Write-ColorMessage -Message "Python main script not found: $PYTHON_MAIN" -Type "Error"
        return $null
    }

    if (-not (Test-PythonAvailable)) {
        Write-ColorMessage -Message "Python is required to run the unified manager" -Type "Error"
        Write-ColorMessage -Message "Please ensure Python is installed and available in your PATH" -Type "Info"
        return $null
    }

    # Clear any previous result before starting
    if (Test-Path -LiteralPath $RESULT_FILE) {
        Remove-Item -LiteralPath $RESULT_FILE -Force -ErrorAction SilentlyContinue
    }

    try {
        # Run Python interactively with unbuffered output for real-time streaming
        $exitCode = 0
        $previousPythonUnbuffered = $env:PYTHONUNBUFFERED
        $env:PYTHONUNBUFFERED = "1"

        try {
            & python -u $PYTHON_MAIN
            $exitCode = $LASTEXITCODE
        } finally {
            if ($null -eq $previousPythonUnbuffered) {
                Remove-Item Env:PYTHONUNBUFFERED -ErrorAction SilentlyContinue
            } else {
                $env:PYTHONUNBUFFERED = $previousPythonUnbuffered
            }
        }

        if ($exitCode -ne 0) {
            Write-ColorMessage -Message "Python script execution failed with exit code: $exitCode" -Type "Error"
            return $null
        }

        # After Python execution completes, check for any result
        $actionResult = Get-ActionResultData
        if ($null -eq $actionResult) {
            return $null
        }

        if (-not [string]::IsNullOrWhiteSpace($actionResult.script_path)) {
            Write-ColorMessage -Message "Executing selected action: $($actionResult.script_path)" -Type "Info"
        }

        return $actionResult
    } catch {
        Write-ColorMessage -Message "Error executing Python script: $_" -Type "Error"
        return $null
    }
}

# Function to execute the returned script
function Invoke-ReturnedScript {
    param([string]$ScriptPath)

    if ([string]::IsNullOrEmpty($ScriptPath)) {
        Write-ColorMessage -Message "No script to execute" -Type "Info"
        return
    }

    if (-not (Test-Path $ScriptPath)) {
        Write-ColorMessage -Message "Script not found: $ScriptPath" -Type "Error"
        return
    }

    $scriptExtension = [System.IO.Path]::GetExtension($ScriptPath).ToLower()

    Write-ColorMessage -Message "Executing script: $ScriptPath" -Type "Info"

    try {
        switch ($scriptExtension) {
            ".bat" {
                if ($IS_WINDOWS) {
                    & cmd.exe /c "$ScriptPath"
                } else {
                    Write-ColorMessage -Message "Cannot execute .bat files on non-Windows systems" -Type "Warning"
                }
            }
            ".cmd" {
                if ($IS_WINDOWS) {
                    & cmd.exe /c "$ScriptPath"
                } else {
                    Write-ColorMessage -Message "Cannot execute .cmd files on non-Windows systems" -Type "Warning"
                }
            }
            ".ps1" {
                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ScriptPath"
            }
            ".sh" {
                if ($IS_WINDOWS) {
                    # Try to use bash if available (WSL or Git Bash)
                    try {
                        & bash "$ScriptPath"
                    } catch {
                        Write-ColorMessage -Message "Bash not available. Cannot execute .sh files on Windows without bash" -Type "Warning"
                    }
                } else {
                    & bash "$ScriptPath"
                }
            }
            default {
                # Try to execute with explorer/open
                if ($IS_WINDOWS) {
                    & explorer "$ScriptPath"
                } else {
                    Write-ColorMessage -Message "Unknown script type: $scriptExtension" -Type "Warning"
                    Write-ColorMessage -Message "Attempting to execute with bash..." -Type "Info"
                    & bash "$ScriptPath"
                }
            }
        }
    } catch {
        Write-ColorMessage -Message "Error executing script: $_" -Type "Error"
        Write-ColorMessage -Message "You may need to run the script manually: $ScriptPath" -Type "Info"
    }
}

# Main execution
function Start-UnifiedManagerPython {

    try {
        while ($true) {
            # Call Python unified manager
            $resultScriptPath = Invoke-PythonUnifiedManager

            # If no result returned, exit
            if ($null -eq $resultScriptPath) {
                break
            }

            # Execute the returned script
            if ($resultScriptPath -is [PSCustomObject] -and $resultScriptPath.script_path) {
                Invoke-ReturnedScript -ScriptPath $resultScriptPath.script_path
            } elseif ($resultScriptPath -is [string]) {
                Invoke-ReturnedScript -ScriptPath $resultScriptPath
            } else {
                Write-ColorMessage -Message "Invalid result format from Python script" -Type "Error"
                break
            }

            # Ask if user wants to continue
            Write-Host ""
            $continue = Read-Host "Continue with Unified Manager? (Y/n)"
            if ($continue -match "^[nN]") {
                break
            }
        }
    } catch {
        Write-ColorMessage -Message "Unexpected error in main loop: $_" -Type "Error"
    }

    Write-ColorMessage -Message "Unified Manager session ended" -Type "Info"
}

# Start the unified manager
Start-UnifiedManagerPython

