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
        $pythonVersion = & python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "Python detected: $pythonVersion" -Type "Info"
            return $true
        } else {
            Write-ColorMessage -Message "Python not found in PATH" -Type "Error"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "Error checking Python: $_" -Type "Error"
        return $false
    }
}

# Function to execute the Python unified manager
function Invoke-PythonUnifiedManager {
    if (-not (Test-Path $PYTHON_MAIN)) {
        Write-ColorMessage -Message "Python main script not found: $PYTHON_MAIN" -Type "Error"
        return $null
    }

    if (-not (Test-PythonAvailable)) {
        Write-ColorMessage -Message "Python is required to run the unified manager" -Type "Error"
        Write-ColorMessage -Message "Please ensure Python is installed and available in your PATH" -Type "Info"
        return $null
    }

    Write-ColorMessage -Message "Launching Python Unified Manager..." -Type "Info"

    try {
        # Execute Python script and capture output
        $pythonOutput = & python "$PYTHON_MAIN" 2>&1

        if ($LASTEXITCODE -ne 0) {
            Write-ColorMessage -Message "Python script execution failed with exit code: $LASTEXITCODE" -Type "Error"
            Write-Host "Python output:"
            $pythonOutput | ForEach-Object { Write-Host "  $_" }
            return $null
        }

        # Parse the output to find the result path
        $resultPath = $null
        foreach ($line in $pythonOutput) {
            if ($line -match "^RESULT_PATH:(.+)$") {
                $resultPath = $matches[1].Trim()
                break
            }
        }

        # Display other output (excluding the result path line)
        foreach ($line in $pythonOutput) {
            if (-not ($line -match "^RESULT_PATH:")) {
                Write-Host $line
            }
        }

        return $resultPath
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
    Write-ColorMessage -Message "Unified Manager (Python Integration Version)" -Type "Info"
    Write-Host ""

    try {
        while ($true) {
            # Call Python unified manager
            $resultScriptPath = Invoke-PythonUnifiedManager

            # If no script returned, exit
            if ([string]::IsNullOrEmpty($resultScriptPath)) {
                break
            }

            # Execute the returned script
            Invoke-ReturnedScript -ScriptPath $resultScriptPath

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