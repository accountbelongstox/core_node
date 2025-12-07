# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    Cleanup Git Repository with BFG Repo-Cleaner

.DESCRIPTION
    Universal script for cleaning large files from Git history.
    BFG is 10-720x faster than git filter-branch.

.NOTES
    Downloads BFG jar to ~/.core_node/tools/ for reuse across projects
#>

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent $SCRIPTS_DIR

$USER_HOME = $env:USERPROFILE
$TOOLS_DIR = Join-Path $USER_HOME ".core_node\tools"
$BFG_JAR = Join-Path $TOOLS_DIR "bfg.jar"
$BFG_URL = "https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"

function Write-ColorMessage {
    param(
        [string]$Message,
        [ValidateSet("Info", "Success", "Warning", "Error")]
        [string]$Type = "Info"
    )

    $color = switch ($Type) {
        "Info"    { "Cyan" }
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error"   { "Red" }
    }

    Write-Host $Message -ForegroundColor $color
}

function Show-Menu {
    Clear-Host
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "BFG Repo-Cleaner - Git History Cleanup" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  1. Remove files larger than 100MB"
    Write-Host "  2. Remove files larger than 50MB"
    Write-Host "  3. Remove files larger than 10MB"
    Write-Host "  4. Remove specific file by name"
    Write-Host "  5. Remove specific files by pattern (*.hprof, *.log, etc.)"
    Write-Host "  6. Back to previous menu"
    Write-Host ""
    Write-ColorMessage -Message "WARNING: This will rewrite Git history!" -Type "Warning"
    Write-Host "================================================================" -ForegroundColor Cyan
}

function Ensure-BfgDownloaded {
    if (-not (Test-Path $BFG_JAR)) {
        Write-Host ""
        Write-ColorMessage -Message "Downloading BFG Repo-Cleaner to $TOOLS_DIR..." -Type "Info"

        if (-not (Test-Path $TOOLS_DIR)) {
            New-Item -ItemType Directory -Path $TOOLS_DIR -Force | Out-Null
        }

        try {
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $BFG_URL -OutFile $BFG_JAR -UseBasicParsing
            $ProgressPreference = 'Continue'
            Write-ColorMessage -Message "BFG downloaded successfully" -Type "Success"
            return $true
        }
        catch {
            Write-ColorMessage -Message "Failed to download BFG: $_" -Type "Error"
            return $false
        }
    }
    else {
        Write-ColorMessage -Message "BFG already exists at: $BFG_JAR" -Type "Success"
        return $true
    }
}

function Test-Prerequisites {
    if (-not (Test-Path ".git")) {
        Write-ColorMessage -Message "Error: Not a Git repository" -Type "Error"
        Write-Host "Please run this script from a Git repository root directory"
        return $false
    }

    try {
        $javaVersion = java -version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Java not found"
        }
    }
    catch {
        Write-ColorMessage -Message "Error: Java is not installed" -Type "Error"
        Write-Host "Please install Java Runtime Environment (JRE)"
        Write-Host "Download from: https://www.oracle.com/java/technologies/downloads/"
        return $false
    }

    return $true
}

function New-BackupBranch {
    $backupBranch = "backup-before-bfg-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host ""
    Write-ColorMessage -Message "Creating backup branch: $backupBranch" -Type "Info"

    try {
        git branch $backupBranch 2>$null
        Write-ColorMessage -Message "Backup branch created successfully" -Type "Success"
        Write-ColorMessage -Message "To restore: git reset --hard $backupBranch" -Type "Info"
        return $true
    }
    catch {
        Write-ColorMessage -Message "Failed to create backup branch" -Type "Error"
        return $false
    }
}

function Invoke-BfgCleanup {
    param(
        [string]$BfgArgs
    )

    Write-Host ""
    Write-ColorMessage -Message "Running BFG Repo-Cleaner..." -Type "Info"
    Write-Host "Command: java -jar `"$BFG_JAR`" $BfgArgs"
    Write-Host ""

    try {
        $expression = "java -jar `"$BFG_JAR`" $BfgArgs"
        Invoke-Expression $expression

        if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null) {
            Write-Host ""
            Write-ColorMessage -Message "Cleaning up Git repository..." -Type "Info"
            git reflog expire --expire=now --all
            git gc --prune=now --aggressive

            Write-Host ""
            Write-ColorMessage -Message "Repository size after cleanup:" -Type "Success"
            $gitSize = (Get-Item ".git" -Force | Get-ChildItem -Recurse -Force | Measure-Object -Property Length -Sum).Sum
            $gitSizeMB = [math]::Round($gitSize / 1MB, 2)
            Write-Host "$gitSizeMB MB (.git directory)"

            return $true
        }
        else {
            Write-ColorMessage -Message "BFG cleanup failed" -Type "Error"
            return $false
        }
    }
    catch {
        Write-ColorMessage -Message "BFG cleanup failed: $_" -Type "Error"
        return $false
    }
}

function Remove-LargeFiles {
    param(
        [string]$SizeLimit
    )

    Write-Host ""
    Write-ColorMessage -Message "This will remove all files larger than $SizeLimit from Git history" -Type "Warning"
    $confirm = Read-Host "Continue? (yes/no)"

    if ($confirm -ne "yes") {
        Write-Host "Operation cancelled"
        return
    }

    if (-not (New-BackupBranch)) {
        return
    }

    Write-Host ""
    Write-ColorMessage -Message "Deleting large files from current HEAD..." -Type "Info"
    git add .
    git commit -m "Remove large files from HEAD before BFG cleanup" 2>$null

    Invoke-BfgCleanup "--strip-blobs-bigger-than $SizeLimit"
}

function Remove-SpecificFile {
    Write-Host ""
    Write-Host "Enter the filename to remove (e.g., large-file.zip):" -ForegroundColor Cyan
    $filename = Read-Host "Filename"

    if ([string]::IsNullOrWhiteSpace($filename)) {
        Write-ColorMessage -Message "No filename provided" -Type "Error"
        return
    }

    Write-Host ""
    Write-ColorMessage -Message "This will remove all occurrences of '$filename' from Git history" -Type "Warning"
    $confirm = Read-Host "Continue? (yes/no)"

    if ($confirm -ne "yes") {
        Write-Host "Operation cancelled"
        return
    }

    if (-not (New-BackupBranch)) {
        return
    }

    Write-Host ""
    Write-ColorMessage -Message "Deleting '$filename' from current HEAD..." -Type "Info"
    Get-ChildItem -Path . -Filter $filename -Recurse -File | Remove-Item -Force
    git add .
    git commit -m "Remove $filename from HEAD before BFG cleanup" 2>$null

    Invoke-BfgCleanup "--delete-files '$filename'"
}

function Remove-FilePattern {
    Write-Host ""
    Write-Host "Enter the file pattern to remove (e.g., *.hprof, *.log):" -ForegroundColor Cyan
    $pattern = Read-Host "Pattern"

    if ([string]::IsNullOrWhiteSpace($pattern)) {
        Write-ColorMessage -Message "No pattern provided" -Type "Error"
        return
    }

    Write-Host ""
    Write-ColorMessage -Message "This will remove all files matching '$pattern' from Git history" -Type "Warning"
    $confirm = Read-Host "Continue? (yes/no)"

    if ($confirm -ne "yes") {
        Write-Host "Operation cancelled"
        return
    }

    if (-not (New-BackupBranch)) {
        return
    }

    Write-Host ""
    Write-ColorMessage -Message "Deleting files matching '$pattern' from current HEAD..." -Type "Info"
    Get-ChildItem -Path . -Filter $pattern -Recurse -File | Remove-Item -Force
    git add .
    git commit -m "Remove $pattern files from HEAD before BFG cleanup" 2>$null

    Invoke-BfgCleanup "--delete-files '$pattern'"
}

function Main {
    Set-Location $PROJECT_ROOT

    if (-not (Test-Prerequisites)) {
        Read-Host "Press Enter to exit"
        exit 1
    }

    if (-not (Ensure-BfgDownloaded)) {
        Read-Host "Press Enter to exit"
        exit 1
    }

    while ($true) {
        Show-Menu
        $choice = Read-Host "Select an option (1-6)"

        switch ($choice) {
            "1" {
                Remove-LargeFiles "100M"
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
            "2" {
                Remove-LargeFiles "50M"
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
            "3" {
                Remove-LargeFiles "10M"
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
            "4" {
                Remove-SpecificFile
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
            "5" {
                Remove-FilePattern
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
            "6" {
                Write-Host "Returning to previous menu..."
                exit 0
            }
            default {
                Write-ColorMessage -Message "Invalid option. Please try again." -Type "Error"
                Start-Sleep -Seconds 1
            }
        }
    }
}

Main
