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

<#
.SYNOPSIS
    DeepSeek-VL Model Manager Library

.DESCRIPTION
    Provides functions to manage DeepSeek-VL local translation model
    - Check if DeepSeek is installed
    - Get DeepSeek installation path
    - Validate DeepSeek installation
    - Get DeepSeek configuration

.NOTES
    Author: Core Node Team
    Version: 1.0.0
#>

# Import GlobalVars and common functions
$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"
$globalVarsPath = Join-Path $winCommonDir "GlobalVars.ps1"
$commonFuncPath = Join-Path $winCommonDir "CommonFunc.ps1"

if (Test-Path $globalVarsPath) {
    . $globalVarsPath
}
if (Test-Path $commonFuncPath) {
    . $commonFuncPath
}

# DeepSeek installation constants
$script:DEEPSEEK_MODEL_NAME = "DeepSeek-VL"
$script:DEEPSEEK_REPO_URL = "https://github.com/deepseek-ai/DeepSeek-VL.git"
$script:DEEPSEEK_DEFAULT_MODEL = "deepseek-ai/deepseek-vl-1.3b-chat"

# Platform detection
$script:IS_WINDOWS = $env:OS -eq "Windows_NT"
$script:IS_WSL = $false
$script:IS_LINUX = $false

if (-not $script:IS_WINDOWS) {
    $unameOutput = uname -a 2>$null
    if ($unameOutput -like "*Microsoft*" -or $unameOutput -like "*WSL*") {
        $script:IS_WSL = $true
    } else {
        $script:IS_LINUX = $true
    }
}

<#
.SYNOPSIS
    Get base programming directory based on platform

.DESCRIPTION
    Returns the base directory for programming projects
    - Windows: D:\programing
    - WSL: /mnt/d/programing
    - Linux: Auto-detect from /mnt/dev_*/programing or ~/programing

.OUTPUTS
    String - Base directory path
#>
function Get-DeepSeekBaseDirectory {
    $baseDir = $null

    if ($script:IS_WINDOWS) {
        $baseDir = "D:\programing"
    }
    elseif ($script:IS_WSL) {
        $baseDir = "/mnt/d/programing"
    }
    elseif ($script:IS_LINUX) {
        $mountDirs = Get-ChildItem -Path "/mnt" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "dev_*" }

        foreach ($dir in $mountDirs) {
            $programingPath = Join-Path $dir.FullName "programing"
            if (Test-Path $programingPath) {
                $baseDir = $programingPath
                break
            }
        }

        if (-not $baseDir) {
            $homeProgaming = Join-Path $env:HOME "programing"
            if (Test-Path $homeProgaming) {
                $baseDir = $homeProgaming
            }
        }
    }

    if (-not $baseDir) {
        $baseDir = if ($script:IS_WINDOWS) { "D:\programing" } else { "/mnt/d/programing" }
    }

    return $baseDir
}

<#
.SYNOPSIS
    Get DeepSeek installation directory

.DESCRIPTION
    Returns the expected installation directory for DeepSeek-VL model

.OUTPUTS
    String - DeepSeek installation directory path
#>
function Get-DeepSeekInstallDirectory {
    $baseDir = Get-DeepSeekBaseDirectory
    $installDir = Join-Path $baseDir $script:DEEPSEEK_MODEL_NAME
    return $installDir
}

<#
.SYNOPSIS
    Test if DeepSeek is installed

.DESCRIPTION
    Checks if DeepSeek-VL model is installed and valid

.OUTPUTS
    Boolean - True if DeepSeek is installed and valid
#>
function Test-DeepSeekInstalled {
    $installDir = Get-DeepSeekInstallDirectory

    if (-not (Test-Path $installDir)) {
        return $false
    }

    $gitDir = Join-Path $installDir ".git"
    if (-not (Test-Path $gitDir)) {
        return $false
    }

    $requirementsFile = Join-Path $installDir "requirements.txt"
    if (-not (Test-Path $requirementsFile)) {
        return $false
    }

    $files = Get-ChildItem -Path $installDir -File -Recurse -ErrorAction SilentlyContinue
    if ($files.Count -lt 10) {
        return $false
    }

    return $true
}

<#
.SYNOPSIS
    Get DeepSeek installation status

.DESCRIPTION
    Returns detailed information about DeepSeek installation status

.OUTPUTS
    Hashtable - Installation status information
#>
function Get-DeepSeekStatus {
    $installDir = Get-DeepSeekInstallDirectory
    $isInstalled = Test-DeepSeekInstalled

    $status = @{
        IsInstalled = $isInstalled
        InstallDirectory = $installDir
        BaseDirectory = Get-DeepSeekBaseDirectory
        Platform = if ($script:IS_WINDOWS) { "Windows" } elseif ($script:IS_WSL) { "WSL" } else { "Linux" }
        ModelName = $script:DEEPSEEK_MODEL_NAME
        ModelPath = $script:DEEPSEEK_DEFAULT_MODEL
        RepoUrl = $script:DEEPSEEK_REPO_URL
    }

    if ($isInstalled) {
        $gitDir = Join-Path $installDir ".git"
        $requirementsFile = Join-Path $installDir "requirements.txt"
        $files = Get-ChildItem -Path $installDir -File -Recurse -ErrorAction SilentlyContinue

        $status.HasGit = Test-Path $gitDir
        $status.HasRequirements = Test-Path $requirementsFile
        $status.FileCount = $files.Count
        $status.IsValid = $true
    }
    else {
        $status.HasGit = $false
        $status.HasRequirements = $false
        $status.FileCount = 0
        $status.IsValid = $false
    }

    return $status
}

<#
.SYNOPSIS
    Get DeepSeek configuration for Node.js

.DESCRIPTION
    Returns configuration object suitable for use in Node.js applications

.OUTPUTS
    Hashtable - Configuration object
#>
function Get-DeepSeekConfig {
    $status = Get-DeepSeekStatus

    $config = @{
        enabled = $status.IsInstalled
        modelPath = $script:DEEPSEEK_DEFAULT_MODEL
        modelDir = $status.InstallDirectory
        pythonCommand = if ($script:IS_WINDOWS) { "python" } else { "python3" }
        timeout = 30000
        platform = $status.Platform
    }

    return $config
}

<#
.SYNOPSIS
    Get Python command for current platform

.DESCRIPTION
    Returns the appropriate Python command for the current platform

.OUTPUTS
    String - Python command
#>
function Get-PythonCommand {
    # Priority 1: Use absolute path from GlobalVars (Python 3.12 standalone)
    if ($Global:PYTHON_EXE_PATH -and (Test-Path $Global:PYTHON_EXE_PATH)) {
        return $Global:PYTHON_EXE_PATH
    }

    # Priority 2: Try python command in PATH
    $pythonCmd = if ($script:IS_WINDOWS) { "python" } else { "python3" }

    try {
        $pythonVersion = & $pythonCmd --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $pythonCmd
        }
    }
    catch {
        Write-Host "Python not found with command: $pythonCmd" -ForegroundColor Yellow
    }

    # Priority 3: Try py launcher on Windows
    if ($script:IS_WINDOWS) {
        try {
            $pythonVersion = & "py" --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                return "py"
            }
        }
        catch {
            Write-Host "Python not found with command: py" -ForegroundColor Yellow
        }
    }

    return $null
}

<#
.SYNOPSIS
    Display DeepSeek installation information

.DESCRIPTION
    Prints detailed information about DeepSeek installation status
#>
function Show-DeepSeekInfo {
    $status = Get-DeepSeekStatus

    Write-Host "`n=== DeepSeek-VL Installation Status ===" -ForegroundColor Cyan
    Write-Host "Platform: $($status.Platform)" -ForegroundColor White
    Write-Host "Base Directory: $($status.BaseDirectory)" -ForegroundColor White
    Write-Host "Install Directory: $($status.InstallDirectory)" -ForegroundColor White
    Write-Host "Model Name: $($status.ModelName)" -ForegroundColor White
    Write-Host "Model Path: $($status.ModelPath)" -ForegroundColor White

    if ($status.IsInstalled) {
        Write-Host "`nInstallation Status: INSTALLED" -ForegroundColor Green
        Write-Host "Is Valid: $($status.IsValid)" -ForegroundColor Green
        Write-Host "Has Git: $($status.HasGit)" -ForegroundColor Green
        Write-Host "Has Requirements: $($status.HasRequirements)" -ForegroundColor Green
        Write-Host "File Count: $($status.FileCount)" -ForegroundColor Green
    }
    else {
        Write-Host "`nInstallation Status: NOT INSTALLED" -ForegroundColor Red
        Write-Host "To install, run:" -ForegroundColor Yellow
        Write-Host "  .\Step95_InstallDeepSeek.ps1" -ForegroundColor Yellow
    }

    Write-Host "======================================`n" -ForegroundColor Cyan
}
