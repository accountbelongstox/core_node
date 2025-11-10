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

param(
    [Parameter(Mandatory=$false)]
    [int]$MaxCommits = 50
)

# Declare all variables at the beginning
$ErrorActionPreference = "Stop"
$scriptPath = $PSScriptRoot
$coreNodeDir = Split-Path (Split-Path $scriptPath -Parent) -Parent
$originalLocation = Get-Location
$commitHistory = @()
$currentIndex = 0
$originalBranch = ""
$commitCreated = $false
$detachedHead = $false

# Function to display colored text
function Write-ColorText {
    param(
        [string]$Text,
        [ConsoleColor]$ForegroundColor = [ConsoleColor]::White,
        [switch]$NoNewline
    )
    if ($NoNewline) {
        Write-Host $Text -ForegroundColor $ForegroundColor -NoNewline
    } else {
        Write-Host $Text -ForegroundColor $ForegroundColor
    }
}

# Function to get current branch
function Get-CurrentBranch {
    try {
        $branch = git branch --show-current 2>$null
        if (-not $branch) {
            $branch = git rev-parse --abbrev-ref HEAD 2>$null
        }
        if (-not $branch -or $branch -eq "HEAD") {
            return $null
        }
        return $branch
    } catch {
        return $null
    }
}

# Function to commit current changes
function Save-LocalChanges {
    Write-ColorText "`n=== Saving Local Changes ===" -ForegroundColor Cyan

    # Check for uncommitted changes
    $status = git status --porcelain 2>$null
    if ($status) {
        Write-ColorText "Found uncommitted changes. Committing to local repository..." -ForegroundColor Yellow

        # Stage all changes
        Write-ColorText "Staging all changes..." -ForegroundColor Cyan
        git add .

        # Get commit message
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "Enter commit message (press Enter to use timestamp): " -ForegroundColor Yellow -NoNewline
        $commitMessage = Read-Host

        if ([string]::IsNullOrWhiteSpace($commitMessage)) {
            $commitMessage = $timestamp
            Write-ColorText "Using timestamp as commit message: $timestamp" -ForegroundColor Cyan
        } else {
            Write-ColorText "Using custom commit message: $commitMessage" -ForegroundColor Green
        }

        # Commit changes
        git commit -m $commitMessage

        if ($LASTEXITCODE -eq 0) {
            Write-ColorText "Local changes committed successfully!" -ForegroundColor Green
            $script:commitCreated = $true
        } else {
            Write-ColorText "Warning: Failed to commit changes" -ForegroundColor Red
            Write-Host "Continue anyway? (Y/N): " -ForegroundColor Yellow -NoNewline
            $response = Read-Host
            if ($response -ne "Y" -and $response -ne "y") {
                throw "Operation cancelled by user"
            }
        }
    } else {
        Write-ColorText "No uncommitted changes found." -ForegroundColor Green
    }
}

# Function to load commit history
function Load-CommitHistory {
    Write-ColorText "`n=== Loading Commit History ===" -ForegroundColor Cyan

    # Get commit history with format: hash|short_hash|date|author|subject
    $gitLog = git log --oneline --format="%H|%h|%ci|%an|%s" -n $MaxCommits 2>$null

    if (-not $gitLog) {
        throw "Failed to load commit history"
    }

    $script:commitHistory = @()
    foreach ($line in $gitLog) {
        $parts = $line -split '\|', 5
        if ($parts.Count -ge 5) {
            $script:commitHistory += @{
                FullHash = $parts[0]
                ShortHash = $parts[1]
                Date = $parts[2]
                Author = $parts[3]
                Subject = $parts[4]
            }
        }
    }

    Write-ColorText "Loaded $($script:commitHistory.Count) commits" -ForegroundColor Green
}

# Function to display current commit info
function Show-CurrentCommit {
    $commit = $script:commitHistory[$script:currentIndex]
    $totalCommits = $script:commitHistory.Count

    Clear-Host
    Write-ColorText "===============================================" -ForegroundColor Cyan
    Write-ColorText "        GIT TIME TRAVEL" -ForegroundColor Magenta
    Write-ColorText "===============================================" -ForegroundColor Cyan
    Write-ColorText ""

    # Show position
    Write-ColorText "Position: " -ForegroundColor Yellow -NoNewline
    Write-ColorText "$($script:currentIndex + 1) / $totalCommits" -ForegroundColor White

    if ($script:currentIndex -eq 0) {
        Write-ColorText "Status: " -ForegroundColor Yellow -NoNewline
        Write-ColorText "LATEST COMMIT" -ForegroundColor Green
    } else {
        Write-ColorText "Status: " -ForegroundColor Yellow -NoNewline
        Write-ColorText "HISTORICAL COMMIT ($($script:currentIndex) commits back)" -ForegroundColor Yellow
    }

    Write-ColorText ""
    Write-ColorText "-----------------------------------------------" -ForegroundColor DarkGray
    Write-ColorText "Commit: " -ForegroundColor Yellow -NoNewline
    Write-ColorText $commit.ShortHash -ForegroundColor Cyan
    Write-ColorText "Date: " -ForegroundColor Yellow -NoNewline
    Write-ColorText $commit.Date -ForegroundColor White
    Write-ColorText "Author: " -ForegroundColor Yellow -NoNewline
    Write-ColorText $commit.Author -ForegroundColor White
    Write-ColorText "Message: " -ForegroundColor Yellow -NoNewline
    Write-ColorText $commit.Subject -ForegroundColor White
    Write-ColorText "-----------------------------------------------" -ForegroundColor DarkGray
    Write-ColorText ""

    # Show controls
    Write-ColorText "Controls:" -ForegroundColor Cyan
    Write-ColorText "  [Left Arrow]  Previous commit (older)" -ForegroundColor White
    Write-ColorText "  [Right Arrow] Next commit (newer)" -ForegroundColor White
    Write-ColorText "  [Home]        Jump to latest commit" -ForegroundColor White
    Write-ColorText "  [End]         Jump to oldest commit" -ForegroundColor White
    Write-ColorText "  [D]           Show diff with previous commit" -ForegroundColor White
    Write-ColorText "  [L]           Show commit log details" -ForegroundColor White
    Write-ColorText "  [Q]           Quit and restore branch" -ForegroundColor White
    Write-ColorText ""
    Write-ColorText "===============================================" -ForegroundColor Cyan
}

# Function to checkout specific commit
function Switch-ToCommit {
    param([int]$Index)

    $commit = $script:commitHistory[$Index]
    Write-ColorText "`nSwitching to commit $($commit.ShortHash)..." -ForegroundColor Cyan

    git checkout $commit.FullHash --quiet 2>$null

    if ($LASTEXITCODE -eq 0) {
        $script:detachedHead = $true
        Write-ColorText "Switched successfully!" -ForegroundColor Green
        Start-Sleep -Milliseconds 500
    } else {
        Write-ColorText "Failed to switch commit" -ForegroundColor Red
        Start-Sleep -Milliseconds 1000
    }
}

# Function to show diff
function Show-CommitDiff {
    $commit = $script:commitHistory[$script:currentIndex]

    Clear-Host
    Write-ColorText "=== Diff for commit $($commit.ShortHash) ===" -ForegroundColor Cyan
    Write-ColorText ""

    git show --stat $commit.FullHash

    Write-ColorText ""
    Write-Host "Press any key to continue..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Function to show commit log details
function Show-CommitLog {
    $commit = $script:commitHistory[$script:currentIndex]

    Clear-Host
    Write-ColorText "=== Details for commit $($commit.ShortHash) ===" -ForegroundColor Cyan
    Write-ColorText ""

    git show --no-patch --format=fuller $commit.FullHash

    Write-ColorText ""
    Write-Host "Press any key to continue..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Function to handle keyboard input
function Start-InteractiveNavigation {
    Show-CurrentCommit

    while ($true) {
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        $needsUpdate = $false

        switch ($key.VirtualKeyCode) {
            37 {  # Left Arrow - Go to previous (older) commit
                if ($script:currentIndex -lt ($script:commitHistory.Count - 1)) {
                    $script:currentIndex++
                    Switch-ToCommit $script:currentIndex
                    $needsUpdate = $true
                } else {
                    Write-ColorText "`nAlready at oldest commit!" -ForegroundColor Yellow
                    Start-Sleep -Milliseconds 500
                    $needsUpdate = $true
                }
            }
            39 {  # Right Arrow - Go to next (newer) commit
                if ($script:currentIndex -gt 0) {
                    $script:currentIndex--
                    Switch-ToCommit $script:currentIndex
                    $needsUpdate = $true
                } else {
                    Write-ColorText "`nAlready at latest commit!" -ForegroundColor Yellow
                    Start-Sleep -Milliseconds 500
                    $needsUpdate = $true
                }
            }
            36 {  # Home - Jump to latest commit
                if ($script:currentIndex -ne 0) {
                    $script:currentIndex = 0
                    Switch-ToCommit $script:currentIndex
                    $needsUpdate = $true
                }
            }
            35 {  # End - Jump to oldest commit
                $lastIndex = $script:commitHistory.Count - 1
                if ($script:currentIndex -ne $lastIndex) {
                    $script:currentIndex = $lastIndex
                    Switch-ToCommit $script:currentIndex
                    $needsUpdate = $true
                }
            }
            68 {  # D - Show diff
                Show-CommitDiff
                $needsUpdate = $true
            }
            76 {  # L - Show log
                Show-CommitLog
                $needsUpdate = $true
            }
            81 {  # Q - Quit
                Write-ColorText "`nExiting Git Time Travel..." -ForegroundColor Cyan
                return
            }
        }

        if ($needsUpdate) {
            Show-CurrentCommit
        }
    }
}

# Function to cleanup and restore original state
function Restore-OriginalState {
    Write-ColorText "`n=== Restoring Original State ===" -ForegroundColor Cyan

    if ($script:detachedHead -and $script:originalBranch) {
        Write-ColorText "Returning to branch: $script:originalBranch" -ForegroundColor Yellow
        git checkout $script:originalBranch --quiet 2>$null

        if ($LASTEXITCODE -eq 0) {
            Write-ColorText "Branch restored successfully!" -ForegroundColor Green
        } else {
            Write-ColorText "Warning: Failed to restore branch" -ForegroundColor Red
        }
    }

    if ($script:commitCreated) {
        Write-ColorText "Local changes were committed before time travel." -ForegroundColor Green
        Write-ColorText "Commit is preserved in git history." -ForegroundColor Green
    }
}

# Main execution
try {
    Write-ColorText "===============================================" -ForegroundColor Magenta
    Write-ColorText "   Git Time Travel - Interactive Navigation" -ForegroundColor Magenta
    Write-ColorText "===============================================" -ForegroundColor Magenta
    Write-ColorText ""
    Write-ColorText "Working Directory: $coreNodeDir" -ForegroundColor Cyan
    Write-ColorText ""

    # Change to core_node directory
    Set-Location $coreNodeDir
    Write-ColorText "Changed to: $coreNodeDir" -ForegroundColor Green

    # Check if in a git repository
    git rev-parse --git-dir 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Not a git repository"
    }

    # Store original branch
    $script:originalBranch = Get-CurrentBranch
    if ($script:originalBranch) {
        Write-ColorText "Current branch: $script:originalBranch" -ForegroundColor Green
    } else {
        Write-ColorText "Warning: Already in detached HEAD state" -ForegroundColor Yellow
        Write-Host "Continue? (Y/N): " -ForegroundColor Yellow -NoNewline
        $response = Read-Host
        if ($response -ne "Y" -and $response -ne "y") {
            throw "Operation cancelled by user"
        }
    }

    # IMPORTANT: Commit local changes first
    Save-LocalChanges

    # Load commit history (after commit, so new commit is included)
    Load-CommitHistory

    # Start interactive navigation
    Start-InteractiveNavigation

} catch {
    Write-ColorText "`nError: $_" -ForegroundColor Red
} finally {
    # Always restore original state
    Restore-OriginalState

    # Restore original location
    Set-Location $originalLocation
    Write-ColorText "`nRestored to: $originalLocation" -ForegroundColor DarkCyan
    Write-ColorText ""
}
