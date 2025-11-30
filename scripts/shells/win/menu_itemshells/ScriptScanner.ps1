# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    Script Scanner and Executor Menu
.DESCRIPTION
    Scans core_node/scripts directory for all script files and provides an interactive menu
    to execute them. Supports .ps1, .cmd, .bat, .py, and .js files.
#>

param(
    [string]$RootDir = $null
)

# If root directory is not specified, auto-detect
if (-not $RootDir) {
    # Search upward from current script location to find core_node root directory
    $currentDir = $PSScriptRoot
    while ($currentDir -and (Split-Path $currentDir -Leaf) -ne "core_node") {
        $currentDir = Split-Path $currentDir -Parent
    }
    
    if ($currentDir) {
        $RootDir = $currentDir
    } else {
        Write-Host "Cannot find core_node root directory, please specify -RootDir parameter manually" -ForegroundColor Red
        exit 1
    }
}

$ScriptsDir = Join-Path $RootDir "scripts"

# Color definitions
$COLOR_SUCCESS = "Green"
$COLOR_WARNING = "Yellow"
$COLOR_ERROR = "Red"
$COLOR_INFO = "White"
$COLOR_HIGHLIGHT = "Cyan"

function Write-ColorMessage {
    param (
        [string]$Message,
        [string]$Type = "Info"
    )
    
    $color = switch ($Type) {
        "Success" { $COLOR_SUCCESS }
        "Warning" { $COLOR_WARNING }
        "Error" { $COLOR_ERROR }
        "Info" { $COLOR_INFO }
        default { $COLOR_INFO }
    }
    
    # If $color is null or empty, set default value
    if (-not $color) {
        $color = "White"
    }
    
    $prefix = switch ($Type) {
        "Success" { "[OK] " }
        "Warning" { "[!] " }
        "Error" { "[X] " }
        "Info" { "[*] " }
        default { "[*] " }
    }
    
    Write-Host -ForegroundColor $color "$prefix$Message"
}

function Get-ScriptFiles {
    param([string]$Directory)
    
    $scriptFiles = @()
    
    try {
        # Scan all supported script file types
        $files = Get-ChildItem -Path $Directory -Recurse -Include "*.ps1", "*.cmd", "*.bat", "*.py", "*.js" | 
                 Where-Object { $_.Name -notlike "*.sh" } |  # Exclude .sh files
                 Sort-Object Name
        
        foreach ($file in $files) {
            $scriptInfo = @{
                FullPath = $file.FullName
                Name = $file.Name
                Extension = $file.Extension
                RelativePath = $file.FullName.Substring($Directory.Length + 1)
                Type = switch ($file.Extension) {
                    ".ps1" { "PowerShell" }
                    ".cmd" { "Batch" }
                    ".bat" { "Batch" }
                    ".py" { "Python" }
                    ".js" { "Node.js" }
                    default { "Unknown" }
                }
            }
            $scriptFiles += $scriptInfo
        }
    }
    catch {
        Write-ColorMessage -Message "Error scanning directory: $_" -Type "Error"
    }
    
    return $scriptFiles
}

function Show-ScriptCategories {
    param([array]$Scripts)
    
    Clear-Host
    Write-ColorMessage -Message "Script Scanner - Display by Category" -Type "Info"
    Write-Host ""
    
    # Group by type
    $groupedScripts = $Scripts | Group-Object Type | Sort-Object Name
    
    foreach ($group in $groupedScripts) {
        Write-Host -ForegroundColor $COLOR_HIGHLIGHT "=== $($group.Name) ==="
        foreach ($script in $group.Group) {
            Write-Host "  $($script.Name)" -ForegroundColor $COLOR_INFO
        }
        Write-Host ""
    }
    
    Write-ColorMessage -Message "Enter script name or partial name to execute script" -Type "Info"
    Write-ColorMessage -Message "Supports fuzzy matching, press Enter to execute first matching script" -Type "Info"
    Write-Host ""
}

function Find-MatchingScripts {
    param(
        [array]$Scripts,
        [string]$SearchTerm
    )
    
    if ([string]::IsNullOrWhiteSpace($SearchTerm)) {
        return @()
    }
    
    return $Scripts | Where-Object { 
        $_.Name -like "*$SearchTerm*" -or 
        $_.RelativePath -like "*$SearchTerm*" 
    } | Sort-Object Name
}

function Execute-Script {
    param([object]$Script)
    
    Write-ColorMessage -Message "Executing script: $($Script.Name)" -Type "Info"
    Write-ColorMessage -Message "Path: $($Script.RelativePath)" -Type "Info"
    Write-ColorMessage -Message "Type: $($Script.Type)" -Type "Info"
    Write-Host ""
    
    try {
        $workingDir = Split-Path $Script.FullPath -Parent
        
        switch ($Script.Extension) {
            ".ps1" {
                Write-ColorMessage -Message "Using PowerShell to execute..." -Type "Info"
                Set-Location $workingDir
                & $Script.FullPath
            }
            ".cmd" {
                Write-ColorMessage -Message "Using CMD to execute..." -Type "Info"
                Set-Location $workingDir
                & cmd /c $Script.FullPath
            }
            ".bat" {
                Write-ColorMessage -Message "Using CMD to execute..." -Type "Info"
                Set-Location $workingDir
                & cmd /c $Script.FullPath
            }
            ".py" {
                Write-ColorMessage -Message "Using Python to execute..." -Type "Info"
                Set-Location $workingDir
                & python $Script.FullPath
            }
            ".js" {
                Write-ColorMessage -Message "Using Node.js to execute..." -Type "Info"
                Set-Location $workingDir
                & node $Script.FullPath
            }
            default {
                Write-ColorMessage -Message "Unsupported file type: $($Script.Extension)" -Type "Error"
                return
            }
        }
        
        Write-ColorMessage -Message "Script execution completed" -Type "Success"
    }
    catch {
        Write-ColorMessage -Message "Error executing script: $_" -Type "Error"
    }
    finally {
        # Restore original working directory
        Set-Location $PWD
    }
}

function Show-MainMenu {
    param([array]$Scripts)
    
    while ($true) {
        Show-ScriptCategories $Scripts
        
        $input = Read-Host "Enter search term (enter 'exit' to quit)"
        
        if ($input -eq "exit" -or $input -eq "quit") {
            Write-ColorMessage -Message "Exiting script scanner" -Type "Info"
            break
        }
        
        if ([string]::IsNullOrWhiteSpace($input)) {
            continue
        }
        
        $matchingScripts = Find-MatchingScripts $Scripts $input
        
        if ($matchingScripts.Count -eq 0) {
            Write-ColorMessage -Message "No matching scripts found" -Type "Warning"
            Read-Host "Press Enter to continue"
        }
        elseif ($matchingScripts.Count -eq 1) {
            # Only one match, execute directly
            Execute-Script $matchingScripts[0]
            Read-Host "Press Enter to continue"
        }
        else {
            # Multiple matches, show all matching items
            Write-Host ""
            Write-ColorMessage -Message "Found $($matchingScripts.Count) matching scripts:" -Type "Warning"
            for ($i = 0; $i -lt $matchingScripts.Count; $i++) {
                Write-Host "  $($i + 1). $($matchingScripts[$i].Name)" -ForegroundColor $COLOR_HIGHLIGHT
            }
            Write-Host ""
            Write-ColorMessage "Will execute first matching script: $($matchingScripts[0].Name)" -Type "Info"
            
            $confirm = Read-Host "Press Enter to execute, enter 'n' to cancel"
            if ($confirm -ne "n" -and $confirm -ne "N") {
                Execute-Script $matchingScripts[0]
            }
            Read-Host "Press Enter to continue"
        }
    }
}

# Main program
try {
    Write-ColorMessage "Starting script scanner..." -Type "Info"
    Write-ColorMessage "Root directory: $RootDir" -Type "Info"
    Write-ColorMessage "Scripts directory: $ScriptsDir" -Type "Info"
    Write-Host ""
    
    if (-not (Test-Path $ScriptsDir)) {
        Write-ColorMessage "Scripts directory does not exist: $ScriptsDir" -Type "Error"
        exit 1
    }
    
    Write-ColorMessage "Scanning script files..." -Type "Info"
    $allScripts = Get-ScriptFiles $ScriptsDir
    
    if ($allScripts.Count -eq 0) {
        Write-ColorMessage "No script files found" -Type "Warning"
        exit 0
    }
    
    Write-ColorMessage "Found $($allScripts.Count) script files" -Type "Success"
    Write-Host ""
    
    # Show main menu
    Show-MainMenu $allScripts
}
catch {
    Write-ColorMessage "Program execution error: $_" -Type "Error"
    exit 1
}
