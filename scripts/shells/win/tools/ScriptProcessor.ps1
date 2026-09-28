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
    # Directory names pruned at ANY depth while scanning. They hold third-party
    # or generated/build artifacts that never contain our own .ps1/.sh scripts;
    # recursing them (e.g. node_modules\.pnpm\...) wastes time and trips
    # MAX_PATH errors on deep paths. Matched by leaf name, so a match anywhere
    # in the tree (not only at the root) is pruned.
    return @(
        # version control / editor / IDE
        ".git", ".svn", ".hg", ".vscode", ".idea", ".vs",
        # JavaScript / Node / bundlers (vite, next, nuxt, ...)
        "node_modules", ".pnpm", ".yarn", ".npm", "bower_components",
        ".next", ".nuxt", ".svelte-kit", ".angular", ".vite", ".turbo",
        ".parcel-cache", ".cache", ".output", ".nyc_output",
        # Dart / Flutter
        ".dart_tool", ".pub-cache", ".flutter-plugins",
        # Python
        "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
        ".venv", "venv", ".tox", "site-packages",
        # .NET / Java / native build outputs
        "bin", "obj", "packages", ".nuget", "target", ".gradle",
        # PHP / Go / Rust / mobile
        "vendor", "Pods", "DerivedData",
        # generic build / dist / coverage / temp
        "dist", "build", "out", "coverage", "tmp", "temp"
    )
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

function Get-FilteredScriptFiles {
    # Recursively collect files with the given extensions while PRUNING skip
    # directories at ANY depth. Unlike "Get-ChildItem -Recurse | Where-Object",
    # which descends into node_modules first and crashes on MAX_PATH paths
    # (e.g. node_modules\.pnpm\...), this never enters a skipped directory.
    param(
        [string]$RootPath,
        [string[]]$Extensions
    )

    $results = New-Object System.Collections.Generic.List[System.IO.FileInfo]
    $skipDirs = Get-SkipDirectories
    $pending = New-Object System.Collections.Generic.Stack[string]
    $current = ""
    $childFiles = $null
    $childDirs = $null
    $ext = ""
    $name = ""

    if ([string]::IsNullOrWhiteSpace($RootPath) -or -not (Test-Path -LiteralPath $RootPath -PathType Container)) {
        return $results
    }

    $pending.Push((Resolve-Path -LiteralPath $RootPath).Path)

    while ($pending.Count -gt 0) {
        $current = $pending.Pop()

        try {
            $childFiles = [System.IO.Directory]::EnumerateFiles($current)
            foreach ($f in $childFiles) {
                $ext = [System.IO.Path]::GetExtension($f).ToLowerInvariant()
                if ($Extensions -contains $ext) {
                    $results.Add((New-Object System.IO.FileInfo -ArgumentList $f))
                }
            }
        }
        catch {
            # Unreadable or over-long path: skip this directory's files.
        }

        try {
            $childDirs = [System.IO.Directory]::EnumerateDirectories($current)
            foreach ($d in $childDirs) {
                $name = [System.IO.Path]::GetFileName($d)
                if ($skipDirs -contains $name) {
                    continue
                }
                $pending.Push($d)
            }
        }
        catch {
            # Unreadable directory: skip descent.
        }
    }

    return $results
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

    Get-FilteredScriptFiles -RootPath $dir -Extensions @(".ps1") | ForEach-Object {
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

        $files = Get-FilteredScriptFiles -RootPath $fullPath -Extensions @(".ps1", ".sh")

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
        Get-FilteredScriptFiles -RootPath $Global:CORE_NODE_SCRIPTS_DIR -Extensions @(".ps1") | ForEach-Object {
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
# - Get-FilteredScriptFiles
# - Process-PsFiles
# - Ensure-LineEndings
# - Process-Directories
# - Make-PsExecutable
