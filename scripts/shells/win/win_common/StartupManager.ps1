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

# StartupManager.ps1 - Common startup management functions
# Version: 1.0.0

$SCRIPT_ROOT = $PSScriptRoot
$WIN_COMMON_DIR = $SCRIPT_ROOT
$GLOBAL_VARS_PATH = Join-Path $WIN_COMMON_DIR "GlobalVars.ps1"

# Load global variables from the trusted project path.
. $GLOBAL_VARS_PATH

# Define startup directories
$SYSTEM_STARTUP_DIR = "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"
$USER_STARTUP_DIR = Join-Path ([Environment]::GetFolderPath("Startup")) ""

function Write-StartupMessage {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    
    $color = switch ($Type) {
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error" { "Red" }
        default { "White" }
    }
    
    Write-Host "[STARTUP] $Message" -ForegroundColor $color
}

function Remove-ExistingStartupLinks {
    param(
        [string]$TargetPath,
        [string]$StartupDirectory = $SYSTEM_STARTUP_DIR
    )
    
    if (-not (Test-Path $StartupDirectory)) {
        Write-StartupMessage "Startup directory does not exist: $StartupDirectory" "Warning"
        return
    }
    
    $removedCount = 0
    $lnkFiles = Get-ChildItem -Path $StartupDirectory -Filter "*.lnk" -ErrorAction SilentlyContinue
    
    foreach ($lnkFile in $lnkFiles) {
        try {
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($lnkFile.FullName)
            
            # Compare target paths (normalize paths for comparison)
            $existingTarget = [System.IO.Path]::GetFullPath($shortcut.TargetPath)
            $newTarget = [System.IO.Path]::GetFullPath($TargetPath)
            
            if ($existingTarget -eq $newTarget) {
                Remove-Item $lnkFile.FullName -Force
                Write-StartupMessage "Removed existing startup link: $($lnkFile.Name)" "Success"
                $removedCount++
            }
        }
        catch {
            Write-StartupMessage "Error checking shortcut $($lnkFile.Name): $($_.Exception.Message)" "Warning"
        }
        finally {
            if ($shell) {
                [System.Runtime.Interopservices.Marshal]::ReleaseComObject($shell) | Out-Null
            }
        }
    }
    
    if ($removedCount -eq 0) {
        Write-StartupMessage "No existing startup links found for: $TargetPath"
    }
}

function Add-StartupLink {
    param(
        [Parameter(Mandatory=$true)]
        [string]$TargetPath,
        [string]$LinkName,
        [string]$Arguments = "",
        [string]$WorkingDirectory = "",
        [string]$Description = "",
        [string]$StartupDirectory = $SYSTEM_STARTUP_DIR
    )
    
    # Validate target path (allow system executables like powershell.exe)
    $isSystemExecutable = ($TargetPath -eq "powershell.exe" -or $TargetPath -eq "cmd.exe" -or $TargetPath -eq "node.exe")
    if (-not $isSystemExecutable -and -not (Test-Path $TargetPath)) {
        Write-StartupMessage "Target path does not exist: $TargetPath" "Error"
        return $false
    }
    
    # Generate link name if not provided
    if (-not $LinkName) {
        $LinkName = [System.IO.Path]::GetFileNameWithoutExtension($TargetPath)
    }
    
    # Ensure .lnk extension
    if (-not $LinkName.EndsWith(".lnk")) {
        $LinkName = "$LinkName.lnk"
    }
    
    # Create startup directory if it doesn't exist
    if (-not (Test-Path $StartupDirectory)) {
        try {
            New-Item -Path $StartupDirectory -ItemType Directory -Force | Out-Null
            Write-StartupMessage "Created startup directory: $StartupDirectory" "Success"
        }
        catch {
            Write-StartupMessage "Failed to create startup directory: $($_.Exception.Message)" "Error"
            return $false
        }
    }
    
    # Remove existing links with same target path
    Remove-ExistingStartupLinks -TargetPath $TargetPath -StartupDirectory $StartupDirectory
    
    # Create new shortcut
    $linkPath = Join-Path $StartupDirectory $LinkName
    
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($linkPath)
        $shortcut.TargetPath = $TargetPath
        
        if ($Arguments) {
            $shortcut.Arguments = $Arguments
        }
        
        if ($WorkingDirectory) {
            $shortcut.WorkingDirectory = $WorkingDirectory
        } else {
            $shortcut.WorkingDirectory = Split-Path $TargetPath -Parent
        }
        
        if ($Description) {
            $shortcut.Description = $Description
        }
        
        $shortcut.Save()
        Write-StartupMessage "Added startup link: $linkPath" "Success"
        return $true
    }
    catch {
        Write-StartupMessage "Failed to create startup link: $($_.Exception.Message)" "Error"
        return $false
    }
    finally {
        if ($shell) {
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($shell) | Out-Null
        }
    }
}

function Remove-StartupLink {
    param(
        [string]$TargetPath,
        [string]$LinkName,
        [string]$StartupDirectory = $SYSTEM_STARTUP_DIR
    )
    
    if ($TargetPath) {
        # Remove by target path
        Remove-ExistingStartupLinks -TargetPath $TargetPath -StartupDirectory $StartupDirectory
    }
    elseif ($LinkName) {
        # Remove by link name
        if (-not $LinkName.EndsWith(".lnk")) {
            $LinkName = "$LinkName.lnk"
        }
        
        $linkPath = Join-Path $StartupDirectory $LinkName
        if (Test-Path $linkPath) {
            try {
                Remove-Item $linkPath -Force
                Write-StartupMessage "Removed startup link: $linkPath" "Success"
                return $true
            }
            catch {
                Write-StartupMessage "Failed to remove startup link: $($_.Exception.Message)" "Error"
                return $false
            }
        }
        else {
            Write-StartupMessage "Startup link not found: $linkPath" "Warning"
        }
    }
    else {
        Write-StartupMessage "Either TargetPath or LinkName must be specified" "Error"
        return $false
    }
}

function Get-StartupLinks {
    param(
        [string]$StartupDirectory = $SYSTEM_STARTUP_DIR
    )
    
    if (-not (Test-Path $StartupDirectory)) {
        Write-StartupMessage "Startup directory does not exist: $StartupDirectory" "Warning"
        return @()
    }
    
    $links = @()
    $lnkFiles = Get-ChildItem -Path $StartupDirectory -Filter "*.lnk" -ErrorAction SilentlyContinue
    
    foreach ($lnkFile in $lnkFiles) {
        try {
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($lnkFile.FullName)
            
            $linkInfo = [PSCustomObject]@{
                Name = $lnkFile.Name
                FullPath = $lnkFile.FullName
                TargetPath = $shortcut.TargetPath
                Arguments = $shortcut.Arguments
                WorkingDirectory = $shortcut.WorkingDirectory
                Description = $shortcut.Description
                LastModified = $lnkFile.LastWriteTime
            }
            
            $links += $linkInfo
        }
        catch {
            Write-StartupMessage "Error reading shortcut $($lnkFile.Name): $($_.Exception.Message)" "Warning"
        }
        finally {
            if ($shell) {
                [System.Runtime.Interopservices.Marshal]::ReleaseComObject($shell) | Out-Null
            }
        }
    }
    
    return $links
}

function Clear-InvalidStartupLinks {
    param(
        [string]$StartupDirectory = $SYSTEM_STARTUP_DIR
    )
    
    Write-StartupMessage "Scanning for invalid startup links in: $StartupDirectory"
    
    $links = Get-StartupLinks -StartupDirectory $StartupDirectory
    $removedCount = 0
    
    foreach ($link in $links) {
        if (-not (Test-Path $link.TargetPath)) {
            try {
                Remove-Item $link.FullPath -Force
                Write-StartupMessage "Removed invalid startup link: $($link.Name) (target not found: $($link.TargetPath))" "Success"
                $removedCount++
            }
            catch {
                Write-StartupMessage "Failed to remove invalid link $($link.Name): $($_.Exception.Message)" "Error"
            }
        }
    }
    
    Write-StartupMessage "Cleanup completed. Removed $removedCount invalid startup links." "Success"
    return $removedCount
}

# Functions are available when script is dot-sourced
# Add-StartupLink, Remove-StartupLink, Get-StartupLinks, Clear-InvalidStartupLinks, Remove-ExistingStartupLinks
