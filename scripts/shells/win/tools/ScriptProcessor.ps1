# File Scanner Tool for Core Node Management
# This script contains file scanning and processing functions

# =============================================================================
# FILE IMPORTS
# =============================================================================

# Import GlobalVars.ps1 to get global variables
$globalVarsPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\GlobalVars.ps1"
. $globalVarsPath

# Import CommonFunc.ps1 to get common functions
$commonFuncPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\CommonFunc.ps1"
. $commonFuncPath

# =============================================================================
# SCRIPT-SPECIFIC VARIABLES
# =============================================================================
$script:target_dirs = @("apps", "ncore", "scripts")

# =============================================================================
# FILE SCANNING FUNCTIONS
# =============================================================================

function Get-SkipDirectories {
    # Define directories to skip when processing PowerShell scripts
    return @("node_modules", ".git", ".vscode", "bin", "obj", "packages", "dist", "build", ".nuget", ".next", "__pycache__", ".pytest_cache", "coverage", ".nyc_output", "tmp", "temp")
}

function Test-ShouldSkipFile {
    param(
        [string]$FilePath
    )
    
    $skipDirs = Get-SkipDirectories
    foreach ($skipDir in $skipDirs) {
        if ($FilePath -like "*\$skipDir\*") {
            return $true
        }
    }
    return $false
}

function Process-PsFiles {
    param (
        [string]$dir
    )

    try{
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
    }
    catch{
        Write-ColorMessage -Message "Error setting execution policy: $_" -Type "Warning"
    }

    Get-ChildItem -Path $dir -Recurse -Filter "*.ps1" | Where-Object {
        return -not (Test-ShouldSkipFile -FilePath $_.FullName)
    } | ForEach-Object {
        $file = $_.FullName
        try{
            Unblock-File -Path $file
        }
        catch{
            Write-ColorMessage -Message "Error unblocking file: $_" -Type "Warning"
        }
    }
}

function Ensure-LineEndings {
    $fullPath = ""
    $files = $null
    $file = $null
    $content = ""
    $newContent = ""

    foreach ($dir in $script:target_dirs) {
        $fullPath = Join-Path $Global:CORE_NODE_DIR $dir
        if (-not (Test-Path $fullPath)) {
            Write-ColorMessage -Message "Directory '$fullPath' not found. Skipping." -Type "Warning"
            continue
        }

        $files = Get-ChildItem -Path $fullPath -Recurse -Include "*.ps1", "*.sh" -ErrorAction SilentlyContinue | Where-Object {
            return -not (Test-ShouldSkipFile -FilePath $_.FullName)
        }

        foreach ($file in $files) {
            try {
                $content = Get-Content $file.FullName -Raw -ErrorAction Stop
                if ($null -eq $content) {
                    continue
                }
                # Only rewrite when there is an actual CRLF to convert. Skipping the write for
                # already-LF files avoids opening the file for truncation, which is what fails
                # with ERROR_USER_MAPPED_FILE when the file is currently memory-mapped.
                if (-not $content.Contains("`r`n")) {
                    continue
                }
                $newContent = $content -replace "`r`n", "`n"
                Set-Content -Path $file.FullName -Value $newContent -NoNewline -ErrorAction Stop
            }
            catch {
                # A file mapped into memory (a script currently executing in this dd run, or one
                # held by an editor / antivirus / search indexer) returns ERROR_USER_MAPPED_FILE
                # on write. This is transient and harmless for normalization, so warn for this one
                # file and continue with the rest instead of aborting the whole directory.
                Write-ColorMessage -Message "Skipped line-ending fix for '$($file.FullName)': $($_.Exception.Message)" -Type "Warning"
            }
        }
    }
}

function Process-Directories {
    foreach ($dir in $script:target_dirs) {
        $fullPath = Join-Path $Global:CORE_NODE_DIR $dir
        if (Test-Path $fullPath -PathType Container) {
            Process-PsFiles $fullPath
        }
        else {
            Write-ColorMessage -Message "Directory '$fullPath' not found. Skipping." -Type "Warning"
        }
    }
    Write-ColorMessage -Message "All .ps1 files processed!" -Type "Success"
}

function Make-PsExecutable {
    Get-ChildItem -Path $Global:CORE_NODE_DIR -Filter "*.ps1" | ForEach-Object {
        Unblock-File -Path $_.FullName
    }
    if (Test-Path $Global:CORE_NODE_SCRIPTS_DIR -PathType Container) {
        Get-ChildItem -Path $Global:CORE_NODE_SCRIPTS_DIR -Recurse -Filter "*.ps1" | Where-Object {
            return -not (Test-ShouldSkipFile -FilePath $_.FullName)
        } | ForEach-Object {
            Unblock-File -Path $_.FullName
        }
    }
    else {
        Write-ColorMessage -Message "Directory $($Global:CORE_NODE_SCRIPTS_DIR) does not exist." -Type "Warning"
    }
}

# =============================================================================
# FUNCTIONS AVAILABLE FOR USE BY OTHER SCRIPTS
# =============================================================================
# The following functions are available when this script is dot-sourced:
# - Get-SkipDirectories
# - Test-ShouldSkipFile
# - Process-PsFiles
# - Ensure-LineEndings
# - Process-Directories
# - Make-PsExecutable
