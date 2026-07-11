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
    [ValidateSet("gitee", "github", "local", "")]
    [string]$TargetRemote = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Pull,
    
    [Parameter(Mandatory=$false)]
    [switch]$Backup
)

# Declare all variables at the beginning
$ErrorActionPreference = "Stop"
$script:EncryptionCheckCompleted = $false
$script:FileValidationCompleted = $false
$originalWorkingDir = Get-Location
$originalRemoteUrl = ""
$scriptPath = $PSScriptRoot
$coreNodeDir = Split-Path (Split-Path $scriptPath -Parent) -Parent
$projectName = "core_node"  # Hardcoded project name
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$preCommitScript = Join-Path $scriptPath "pre_commit_encrypt.ps1"
$BACKUP_ENABLED = if ($Backup) { "true" } else { "false" }
$currentBranch = ""
$script:CommitMessage = $null
$script:ForcePushChoice = $null
$script:PullCompleted = $false
$CommitMessageTimeoutSeconds = 3  # Auto-continue with the default commit message after this many idle seconds
$winCommonDir = Join-Path $coreNodeDir "scripts\shells\win\win_common"
$skipEncryptCacheDir = "C:\_node_core"
$skipEncryptCacheFile = Join-Path $skipEncryptCacheDir "git_skip_encrypt_cache.db"
$githubHostRefreshScript = Join-Path $scriptPath "github_host_refresh.ps1"
if (Test-Path $githubHostRefreshScript) {
    . $githubHostRefreshScript
}
$giteeHostRefreshScript = Join-Path $scriptPath "gitee_host_refresh.ps1"
if (Test-Path $giteeHostRefreshScript) {
    . $giteeHostRefreshScript
}

# Initialize skip encrypt cache
function Initialize-SkipEncryptCache {
    if (!(Test-Path $skipEncryptCacheDir)) {
        New-Item -Path $skipEncryptCacheDir -ItemType Directory -Force | Out-Null
    }
    if (!(Test-Path $skipEncryptCacheFile)) {
        New-Item -Path $skipEncryptCacheFile -ItemType File -Force | Out-Null
    }
}

# Check if file is in skip cache
function Test-FileInSkipCache {
    param([string]$FilePath)

    if (!(Test-Path $skipEncryptCacheFile)) {
        return $false
    }

    $fileInfo = Get-Item $FilePath
    $fileMtime = $fileInfo.LastWriteTime.ToFileTime()

    $cacheContent = Get-Content $skipEncryptCacheFile -ErrorAction SilentlyContinue
    foreach ($line in $cacheContent) {
        $parts = $line -split '\|'
        if ($parts.Length -eq 2 -and $parts[0] -eq $FilePath -and $parts[1] -eq $fileMtime) {
            return $true
        }
    }

    return $false
}

# Add file to skip cache
function Add-FileToSkipCache {
    param([string]$FilePath)

    Initialize-SkipEncryptCache

    if (Test-FileInSkipCache $FilePath) {
        return
    }

    $fileInfo = Get-Item $FilePath
    $fileMtime = $fileInfo.LastWriteTime.ToFileTime()

    "$FilePath|$fileMtime" | Add-Content -Path $skipEncryptCacheFile
}

# Clean up outdated entries from skip cache
function Clear-SkipEncryptCache {
    if (!(Test-Path $skipEncryptCacheFile)) {
        return
    }

    $tempFile = "$skipEncryptCacheFile.tmp"
    New-Item -Path $tempFile -ItemType File -Force | Out-Null

    $cacheContent = Get-Content $skipEncryptCacheFile -ErrorAction SilentlyContinue
    foreach ($line in $cacheContent) {
        $parts = $line -split '\|'
        if ($parts.Length -eq 2) {
            $cachedPath = $parts[0]
            $cachedMtime = $parts[1]

            if (Test-Path $cachedPath) {
                $fileInfo = Get-Item $cachedPath
                $currentMtime = $fileInfo.LastWriteTime.ToFileTime()

                if ($currentMtime -eq $cachedMtime) {
                    "$cachedPath|$cachedMtime" | Add-Content -Path $tempFile
                }
            }
        }
    }

    Move-Item -Path $tempFile -Destination $skipEncryptCacheFile -Force
}

# File validation function for win_common directory
function Test-WinCommonFiles {
    Write-Host "=== Validating win_common directory files ===" -ForegroundColor Yellow
    
    # Hardcoded list of files in win_common directory
    $requiredFiles = @(
        "ApplicationsList.ps1",
        "CommonFunc.ps1",
        "DesktopIconManager.ps1",
        "GlobalVars.ps1",
        "IconExtractor.ps1",
        "PackageManagerInvokes.ps1",
        "PostInstallCallbackProcessor.ps1",
        "SimpleIconExtractor.ps1",
        "StartupManager.ps1",
        "WindowsPathFunction.ps1",
        "WindowsServiceManager.ps1",
        "CommonFunc.7z.gz.js",
        "applicationsXml\ApplicationsList.xml"
    )
    
    $missingFiles = @()
    $existingFiles = @()
    
    foreach ($file in $requiredFiles) {
        $filePath = Join-Path $winCommonDir $file
        if (Test-Path $filePath) {
            $existingFiles += $file
            Write-Host "[OK] Found: $file" -ForegroundColor Green
        } else {
            $missingFiles += $file
            Write-Host "[MISSING] Missing: $file" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "Validation Summary:" -ForegroundColor Cyan
    Write-Host "  Existing files: $($existingFiles.Count)" -ForegroundColor Green
    Write-Host "  Missing files: $($missingFiles.Count)" -ForegroundColor Red
    
    if ($missingFiles.Count -gt 0) {
        Write-Host ""
        Write-Host "WARNING: The following files are missing from win_common directory:" -ForegroundColor Red
        foreach ($missingFile in $missingFiles) {
            Write-Host "  - $missingFile" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "Continuing with commit process despite missing files..." -ForegroundColor Yellow
    }
    
    Write-Host ""
    return $missingFiles.Count -eq 0
}

# Global variable management function
function Get-GlobalVar {
    param (
        [string]$Key
    )
    $globalVarDir = Join-Path $env:USERPROFILE ".core_node\.global_vars"
    $filePath = Join-Path $globalVarDir $Key
    if (Test-Path $filePath) {
        $content = Get-Content -Path $filePath -Encoding UTF8 -TotalCount 1
        return $content -replace "`0", ""
    }
    return $null
}

# Function to detect platform and distribution
function Get-PlatformInfo {
    $platform = "windows"
    $distro = ""

    try {
        # Get Windows version
        $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
        if ($osInfo) {
            $caption = $osInfo.Caption
            if ($caption -match "Windows 11") {
                $distro = "11"
            } elseif ($caption -match "Windows 10") {
                $distro = "10"
            } elseif ($caption -match "Windows Server 2022") {
                $distro = "server2022"
            } elseif ($caption -match "Windows Server 2019") {
                $distro = "server2019"
            } elseif ($caption -match "Windows Server") {
                $distro = "server"
            } else {
                $distro = "10"
            }
        } else {
            $distro = "10"
        }
    } catch {
        $distro = "10"
    }

    return "$platform-$distro"
}

# Function to get commit message (session-scoped only)
function Get-CommitMessage {
    # If we already have a commit message in this session, use it
    if ($script:CommitMessage) {
        return $script:CommitMessage
    }

    # Default message: tool + OS + timestamp + pre-pull local-only (commit before pull).
    $platformInfo = Get-PlatformInfo
    $defaultMessage = "[gitput_unified] $platformInfo @ $timestamp | pre-pull local-only"

    # Ask user for input. Auto-continue with the default message after
    # $CommitMessageTimeoutSeconds of no typing (idle), so an unattended push
    # does not block on this prompt. Any keystroke resets the idle timer so
    # active typing is never cut off; Enter submits.
    Write-ColorText "Enter commit message ($CommitMessageTimeoutSeconds`s timeout -> default: $defaultMessage): " -ForegroundColor Yellow -NoNewline

    $userInput = ""
    $inputBuilder = New-Object System.Text.StringBuilder
    $timedOut = $false
    $canReadKeys = $true
    try { $null = [Console]::KeyAvailable } catch { $canReadKeys = $false }

    if ($canReadKeys) {
        $idleStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        while ($true) {
            if ([Console]::KeyAvailable) {
                $keyInfo = [Console]::ReadKey($true)
                if ($keyInfo.Key -eq [ConsoleKey]::Enter) {
                    break
                } elseif ($keyInfo.Key -eq [ConsoleKey]::Backspace) {
                    if ($inputBuilder.Length -gt 0) {
                        $inputBuilder.Length = $inputBuilder.Length - 1
                        Write-Host -NoNewline "`b `b"
                    }
                } elseif (-not [char]::IsControl($keyInfo.KeyChar)) {
                    $null = $inputBuilder.Append($keyInfo.KeyChar)
                    Write-Host -NoNewline $keyInfo.KeyChar
                }
                $idleStopwatch.Restart()
            } elseif ($idleStopwatch.Elapsed.TotalSeconds -ge $CommitMessageTimeoutSeconds) {
                $timedOut = $true
                break
            } else {
                Start-Sleep -Milliseconds 50
            }
        }
        Write-Host ""
        $userInput = $inputBuilder.ToString()
    } else {
        # Non-interactive console (no key API): fall back to a blocking read.
        $userInput = Read-Host
    }

    if ($timedOut -and [string]::IsNullOrWhiteSpace($userInput)) {
        $script:CommitMessage = $defaultMessage
        Write-ColorText "No input for $CommitMessageTimeoutSeconds`s; using default commit message: $defaultMessage" -ForegroundColor Cyan
        return $script:CommitMessage
    }

    if ([string]::IsNullOrWhiteSpace($userInput)) {
        $script:CommitMessage = $defaultMessage
        Write-ColorText "Using default commit message: $defaultMessage" -ForegroundColor Cyan
    } else {
        $script:CommitMessage = $userInput
        Write-ColorText "Using custom commit message: $userInput" -ForegroundColor Green
    }

    return $script:CommitMessage
}

# Function to get current git branch
function Get-CurrentBranch {
    try {
        $branch = git branch --show-current 2>$null
        if (-not $branch) {
            $branch = git rev-parse --abbrev-ref HEAD 2>$null
        }
        if (-not $branch) {
            return "HEAD"
        }
        return $branch
    } catch {
        return "HEAD"
    }
}

# Function to ensure we're on the target branch without forcing
function Ensure-TargetBranch {
    param([string]$TargetBranch = "main")
    
    $script:currentBranch = Get-CurrentBranch
    
    if ($currentBranch -eq $TargetBranch) {
        Write-ColorText "Already on branch '$currentBranch'" -ForegroundColor Green
        return $true
    }
    
    Write-ColorText "Current branch: $currentBranch" -ForegroundColor Yellow
    Write-ColorText "Target branch: $TargetBranch" -ForegroundColor Yellow
    
    # Check if target branch exists
    $branchExists = git show-ref --verify --quiet "refs/heads/$TargetBranch"
    if ($LASTEXITCODE -ne 0) {
        Write-ColorText "Branch '$TargetBranch' does not exist locally. Creating from current branch..." -ForegroundColor Cyan
        git checkout -b $TargetBranch
        if ($LASTEXITCODE -eq 0) {
            Write-ColorText "Created and switched to branch '$TargetBranch'" -ForegroundColor Green
            return $true
        } else {
            Write-ColorText "Failed to create branch '$TargetBranch'" -ForegroundColor Red
            return $false
        }
    }
    
    # Check working directory status
    $status = git status --porcelain 2>$null
    if ($status) {
        Write-ColorText "Working directory has uncommitted changes. Please commit or stash first." -ForegroundColor Red
        Write-ColorText "Or use 'git stash' to temporarily save changes." -ForegroundColor Yellow
        return $false
    }
    
    # Switch to target branch
    Write-ColorText "Switching from '$currentBranch' to '$TargetBranch'..." -ForegroundColor Cyan
    git checkout $TargetBranch
    if ($LASTEXITCODE -eq 0) {
        Write-ColorText "Successfully switched to branch '$TargetBranch'" -ForegroundColor Green
        return $true
    } else {
        Write-ColorText "Failed to switch to branch '$TargetBranch'" -ForegroundColor Red
        return $false
    }
}

# Function to create working directory backup
function Create-WorkingBackup {
    if ($BACKUP_ENABLED -ne "true") {
        return $true
    }
    
    Write-ColorText "Creating working directory backup..." -ForegroundColor Cyan
    
    $backupDir = Join-Path $coreNodeDir ".git_backups"
    $backupTimestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $backupPath = Join-Path $backupDir "backup_$backupTimestamp"
    
    try {
        if (-not (Test-Path $backupDir)) {
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        }
        
        # Use robocopy for efficient copying, excluding .git directories
        robocopy $coreNodeDir $backupPath /E /XD .git .git_backups /NFL /NDL /NJH /NJS | Out-Null
        
        if ($LASTEXITCODE -le 1) {  # robocopy exit codes 0-1 are success
            Write-ColorText "Backup created: $backupPath" -ForegroundColor Green
            
            # Clean up old backups (keep last 5)
            $allBackups = Get-ChildItem $backupDir -Directory | Sort-Object CreationTime -Descending
            if ($allBackups.Count -gt 5) {
                $oldBackups = $allBackups | Select-Object -Skip 5
                foreach ($oldBackup in $oldBackups) {
                    Remove-Item $oldBackup.FullName -Recurse -Force
                    Write-ColorText "Removed old backup: $($oldBackup.Name)" -ForegroundColor DarkGray
                }
            }
            
            return $true
        } else {
            Write-ColorText "Backup creation failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-ColorText "Backup creation failed: $_" -ForegroundColor Red
        return $false
    }
}

# Function to determine default remote (GitHub first; used for execution order and restore)
function Get-DefaultRemote {
    param([string]$ProjectName)
    
    return "git@github.com:accountbelongstox/$ProjectName.git"
}

# Load remote configurations from git_remotes.conf
function Load-RemoteConfigs {
    $configFile = Join-Path $PSScriptRoot "git_remotes.conf"
    $remoteConfigs = @{}
    
    if (-not (Test-Path $configFile)) {
        Write-Error "Configuration file not found: $configFile"
        exit 1
    }
    
    Get-Content $configFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#')) {
            if ($line -match '^([^=]+)=(.+)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                $remoteConfigs[$key] = $value
            }
        }
    }
    
    return $remoteConfigs
}

# Remote configurations
$remoteConfigs = Load-RemoteConfigs

# Default remote (primary) - this will be restored after each operation
$DEFAULT_REMOTE = Get-DefaultRemote -ProjectName $projectName

# Determine execution order - DEFAULT_REMOTE should be executed first
function Get-ExecutionOrder {
    param([array]$Targets)
    
    $orderedTargets = @()
    $defaultRemoteKey = ""
    
    # Find which key corresponds to DEFAULT_REMOTE
    foreach ($key in $remoteConfigs.Keys) {
        if ($remoteConfigs[$key] -eq $DEFAULT_REMOTE) {
            $defaultRemoteKey = $key
            break
        }
    }
    
    # Add default remote first if it's in the target list
    if ($defaultRemoteKey -and ($Targets -contains $defaultRemoteKey)) {
        $orderedTargets += $defaultRemoteKey
    }
    
    # Add remaining targets
    foreach ($target in $Targets) {
        if ($target -ne $defaultRemoteKey) {
            $orderedTargets += $target
        }
    }
    
    return $orderedTargets
}

# Function to display colored text
function Write-ColorText {
    param(
        [string]$Text,
        [ConsoleColor]$ForegroundColor = [ConsoleColor]::White
    )
    Write-Host $Text -ForegroundColor $ForegroundColor
}

# Function to get current remote URL
function Get-CurrentRemote {
    try {
        return (git remote get-url origin 2>$null)
    } catch {
        return ""
    }
}

# Function to set remote URL
function Set-RemoteUrl {
    param([string]$RemoteUrl)
    
    try {
        Write-ColorText "Executing: git remote set-url origin $RemoteUrl" -ForegroundColor DarkGray
        git remote set-url origin $RemoteUrl
        Write-ColorText "Remote set to: $RemoteUrl" -ForegroundColor Green
    } catch {
        Write-ColorText "Failed to set remote: $_" -ForegroundColor Red
        throw
    }
}

# Function to restore original remote
function Restore-OriginalRemote {
    try {
        if ($originalRemoteUrl -and $originalRemoteUrl -ne $DEFAULT_REMOTE) {
            Write-ColorText "Restoring original remote: $originalRemoteUrl" -ForegroundColor Yellow
            Set-RemoteUrl $originalRemoteUrl
        } elseif ((Get-CurrentRemote) -ne $DEFAULT_REMOTE) {
            Write-ColorText "Restoring default remote: $DEFAULT_REMOTE" -ForegroundColor Yellow
            Set-RemoteUrl $DEFAULT_REMOTE
        }
    } catch {
        Write-ColorText "Warning: Failed to restore remote: $_" -ForegroundColor Red
    }
}

# Function to perform safe git pull operations
function Invoke-SafeGitPull {
    param([string]$TargetUrl)
    
    Write-ColorText "Starting SAFE GIT PULL operations for: $TargetUrl" -ForegroundColor Cyan
    Write-ColorText "Project: $projectName" -ForegroundColor Green
    Write-ColorText "Timestamp: $timestamp" -ForegroundColor Green
    
    # Change to project directory
    Set-Location $coreNodeDir
    Write-ColorText "Changed to: $coreNodeDir" -ForegroundColor DarkCyan
    
    # Store original remote for restoration
    $script:originalRemoteUrl = Get-CurrentRemote
    Write-ColorText "Original remote: $originalRemoteUrl" -ForegroundColor DarkGray
    
    try {
        # Set target remote
        Set-RemoteUrl $TargetUrl
        
        # Show remote configuration
        Write-ColorText "--------------------------------" -ForegroundColor Green
        Write-ColorText "Executing: git remote -v" -ForegroundColor DarkGray
        git remote -v
        Write-ColorText "--------------------------------" -ForegroundColor Green

        # Step 1: Ensure local changes are committed
        Write-ColorText "Step 1: Checking for uncommitted changes..." -ForegroundColor Cyan
        Write-ColorText "Executing: git status --porcelain" -ForegroundColor DarkGray
        $changes = git status --porcelain
        
        if ($changes) {
            Write-ColorText "Found uncommitted changes. Saving local work..." -ForegroundColor Yellow
            Write-ColorText "Executing: git add ." -ForegroundColor DarkGray
            git add .
            $commitMessage = Get-CommitMessage
            Write-ColorText "Executing: git commit -m `"$commitMessage`"" -ForegroundColor DarkGray
            git commit -m $commitMessage
        } else {
            Write-ColorText "No uncommitted changes found." -ForegroundColor Green
        }

        # Step 2: Check if main branch exists on remote
        Write-ColorText "Step 2: Checking if main branch exists on remote..." -ForegroundColor Cyan
        Write-ColorText "Executing: git branch -r | Select-String -Pattern 'origin/$currentBranch'" -ForegroundColor DarkGray
        $branchExists = git branch -r | Select-String -Pattern "origin/$currentBranch"
        
        if (-not $branchExists) {
            Write-ColorText "Branch '$currentBranch' does not exist. Creating '$currentBranch' branch..." -ForegroundColor Red
            Write-ColorText "Executing: git checkout -b $currentBranch" -ForegroundColor DarkGray
            git checkout -b $currentBranch
            Write-ColorText "Executing: git push --set-upstream origin $currentBranch" -ForegroundColor DarkGray
            git push --set-upstream origin $currentBranch
            Write-ColorText "Executing: git branch --set-upstream-to=origin/$currentBranch $currentBranch" -ForegroundColor DarkGray
            git branch --set-upstream-to=origin/$currentBranch $currentBranch
            return $true
        }

        # Step 3: Safe pull with merge
        Write-ColorText "Step 3: Performing safe pull..." -ForegroundColor Cyan
        Write-ColorText "Executing: git pull origin main --no-edit" -ForegroundColor DarkGray
        $pullResult = git pull origin main --no-edit 2>&1
        $pullExitCode = $LASTEXITCODE
        
        Write-ColorText "Pull command output:" -ForegroundColor DarkGray
        Write-ColorText "$pullResult" -ForegroundColor White
        
        if ($pullExitCode -eq 0) {
            Write-ColorText "SUCCESS: Safe pull completed successfully!" -ForegroundColor Green
        } else {
            Write-ColorText "WARNING: Pull failed with merge conflicts!" -ForegroundColor Red
            Write-ColorText "MERGE CONFLICT RESOLUTION OPTIONS:" -ForegroundColor Yellow
            Write-ColorText "" -ForegroundColor White
            Write-ColorText "Option 1 - Keep REMOTE version (discard local changes):" -ForegroundColor Cyan
            Write-ColorText "git checkout --theirs ." -ForegroundColor White
            Write-ColorText "git add ." -ForegroundColor White  
            Write-ColorText "git commit -m `"Resolved conflicts by keeping remote version`"" -ForegroundColor White
            Write-ColorText "" -ForegroundColor White
            Write-ColorText "Option 2 - Keep LOCAL version (discard remote changes):" -ForegroundColor Cyan
            Write-ColorText "git checkout --ours ." -ForegroundColor White
            Write-ColorText "git add ." -ForegroundColor White
            Write-ColorText "git commit -m `"Resolved conflicts by keeping local version`"" -ForegroundColor White
            Write-ColorText "" -ForegroundColor White
            Write-ColorText "Option 3 - Manual resolution:" -ForegroundColor Cyan
            Write-ColorText "Edit conflicted files manually, then:" -ForegroundColor White
            Write-ColorText "git add ." -ForegroundColor White
            Write-ColorText "git commit -m `"Manually resolved merge conflicts`"" -ForegroundColor White
            Write-ColorText "" -ForegroundColor White
            Write-ColorText "Option 4 - Abort and try later:" -ForegroundColor Cyan
            Write-ColorText "git merge --abort" -ForegroundColor White
            Write-ColorText "git reset --hard HEAD~1  # Remove auto-commit" -ForegroundColor White
            
            # Offer automated conflict resolution
            if (Handle-ConflictResolution) {
                Write-ColorText "Conflict resolution completed successfully!" -ForegroundColor Green
                return $true
            } else {
                Write-ColorText "Conflict resolution failed or was aborted" -ForegroundColor Yellow
                return $false
            }
        }
        
        Write-ColorText "----------------------------------------------------------------" -ForegroundColor DarkBlue
        return $true
        
    } catch {
        Write-ColorText "Git pull operation failed: $_" -ForegroundColor Red
        return $false
    } finally {
        # Always restore original/default remote
        Restore-OriginalRemote
    }
}

# Function to handle automated conflict resolution
function Handle-ConflictResolution {
    Write-ColorText "" -ForegroundColor White
    Write-ColorText "AUTOMATED CONFLICT RESOLUTION OPTIONS:" -ForegroundColor Magenta
    Write-ColorText "" -ForegroundColor White
    Write-Host "Would you like to automatically resolve conflicts? [Y/n]: " -ForegroundColor Cyan -NoNewline
    
    $userChoice = Read-Host
    if ([string]::IsNullOrEmpty($userChoice)) { $userChoice = "Y" }
    
    if ($userChoice -match "^[Yy]$") {
        Write-ColorText "" -ForegroundColor White
        Write-ColorText "Select resolution strategy:" -ForegroundColor Yellow
        Write-ColorText "1) Keep REMOTE version (recommended for pulling latest changes)" -ForegroundColor Cyan
        Write-ColorText "2) Keep LOCAL version (preserve your changes)" -ForegroundColor Cyan
        Write-ColorText "3) Abort operation" -ForegroundColor Cyan
        Write-Host "Enter choice [1-3]: " -ForegroundColor Yellow -NoNewline
        
        $resolutionChoice = Read-Host
        
        switch ($resolutionChoice) {
            1 {
                Write-ColorText "Applying REMOTE version..." -ForegroundColor Green
                git checkout --theirs .
                git add .
                $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                git commit -m "Resolved conflicts by keeping remote version - $timestamp"
                if ($LASTEXITCODE -eq 0) {
                    Write-ColorText "SUCCESS: Conflicts resolved automatically!" -ForegroundColor Green
                    Write-ColorText "Continuing with git operations..." -ForegroundColor Cyan
                    return $true
                } else {
                    Write-ColorText "ERROR: Failed to resolve conflicts automatically" -ForegroundColor Red
                    return $false
                }
            }
            2 {
                Write-ColorText "Applying LOCAL version..." -ForegroundColor Green
                git checkout --ours .
                git add .
                $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                git commit -m "Resolved conflicts by keeping local version - $timestamp"
                if ($LASTEXITCODE -eq 0) {
                    Write-ColorText "SUCCESS: Conflicts resolved automatically!" -ForegroundColor Green
                    Write-ColorText "Continuing with git operations..." -ForegroundColor Cyan
                    return $true
                } else {
                    Write-ColorText "ERROR: Failed to resolve conflicts automatically" -ForegroundColor Red
                    return $false
                }
            }
            3 {
                Write-ColorText "Aborting merge operation..." -ForegroundColor Yellow
                git merge --abort
                Write-ColorText "Merge aborted. Repository restored to previous state." -ForegroundColor Yellow
                return $false
            }
            default {
                Write-ColorText "Invalid choice. Please resolve conflicts manually." -ForegroundColor Red
                return $false
            }
        }
    } else {
        Write-ColorText "Manual resolution required. Please resolve conflicts using the options above." -ForegroundColor Yellow
        return $false
    }
}

# Helper: format a KiB value as human-readable size
function Get-HumanKb {
    param([long]$Kb = 0)
    if ($Kb -ge 1048576) { return ("{0:N2} GB" -f ($Kb / 1048576)) }
    if ($Kb -ge 1024) { return ("{0:N2} MB" -f ($Kb / 1024)) }
    return "$Kb KB"
}

function Get-LocalRepoSizeKb {
    $loose = 0
    $pack = 0
    $countOutput = git count-objects -v 2>$null
    foreach ($line in $countOutput) {
        if ($line -match '^size:\s+(\d+)') { $loose = [long]$Matches[1] }
        elseif ($line -match '^size-pack:\s+(\d+)') { $pack = [long]$Matches[1] }
    }
    return $loose + $pack
}

function Get-RemoteRepoSizeFromUrl {
    param([string]$TargetUrl)

    $remoteHost = ""
    $ownerRepo = ""
    if ($TargetUrl -match '^git@([^:]+):(.+)$') {
        $remoteHost = $Matches[1]
        $ownerRepo = $Matches[2]
    } elseif ($TargetUrl -match '^https?://([^/]+)/(.+)$') {
        $remoteHost = $Matches[1]
        $ownerRepo = $Matches[2]
    }
    if ($ownerRepo.EndsWith(".git")) { $ownerRepo = $ownerRepo.Substring(0, $ownerRepo.Length - 4) }

    $remoteKb = $null
    $api = $null
    if ($ownerRepo -and $remoteHost -eq "github.com") { $api = "https://api.github.com/repos/$ownerRepo" }
    elseif ($ownerRepo -and $remoteHost -eq "gitee.com") { $api = "https://gitee.com/api/v5/repos/$ownerRepo" }
    if ($api) {
        try {
            $resp = Invoke-RestMethod -Uri $api -TimeoutSec 8 -Headers @{ "User-Agent" = "gitput-unified" }
            if ($null -ne $resp.size) { $remoteKb = [long]$resp.size }
        } catch {
            $remoteKb = $null
        }
    }

    return @{
        Host = $remoteHost
        SizeKb = $remoteKb
    }
}

function Show-RepoSizeOverview {
    param(
        [string[]]$Targets,
        [hashtable]$Configs
    )

    $localKb = Get-LocalRepoSizeKb

    Write-ColorText "" -ForegroundColor White
    Write-ColorText "============================================================" -ForegroundColor Cyan
    Write-ColorText "  REPOSITORY SIZE OVERVIEW" -ForegroundColor Cyan
    Write-ColorText "============================================================" -ForegroundColor Cyan
    Write-ColorText "  Local (git): $(Get-HumanKb $localKb)" -ForegroundColor White
    Write-ColorText "" -ForegroundColor White

    foreach ($target in $Targets) {
        if (-not $Configs.ContainsKey($target)) { continue }
        $targetUrl = $Configs[$target]
        $remoteInfo = Get-RemoteRepoSizeFromUrl -TargetUrl $targetUrl
        $remoteHost = $remoteInfo.Host
        if (-not $remoteHost) { $remoteHost = $target }

        if ($null -ne $remoteInfo.SizeKb) {
            Write-ColorText "  Remote [$target] ($remoteHost): $(Get-HumanKb $remoteInfo.SizeKb)" -ForegroundColor White
            $diff = $localKb - $remoteInfo.SizeKb
            if ($diff -ge 0) {
                Write-ColorText "    Local is larger by $(Get-HumanKb $diff)" -ForegroundColor DarkGray
            } else {
                Write-ColorText "    Remote is larger by $(Get-HumanKb (-$diff))" -ForegroundColor DarkGray
            }
        } else {
            Write-ColorText "  Remote [$target] ($remoteHost): unavailable (private repo, no network, or unsupported host)" -ForegroundColor Yellow
        }
    }

    Write-ColorText "" -ForegroundColor White
    Write-ColorText "============================================================" -ForegroundColor Cyan
    Write-ColorText "" -ForegroundColor White
}

# Function to perform git operations
function Invoke-GitOperations {
    param([string]$TargetUrl)
    
    Write-ColorText "----------------------------------------------------------------" -ForegroundColor DarkYellow
    Write-ColorText "Starting git operations for: $TargetUrl" -ForegroundColor Cyan
    Write-ColorText "Project: $projectName" -ForegroundColor Green
    Write-ColorText "Timestamp: $timestamp" -ForegroundColor Green
    Write-ColorText "--------------------------------" -ForegroundColor Green
    
    # Change to project directory
    Set-Location $coreNodeDir
    Write-ColorText "Changed to: $coreNodeDir" -ForegroundColor DarkCyan
    
    # Store original remote for restoration
    $script:originalRemoteUrl = Get-CurrentRemote
    Write-ColorText "Original remote: $originalRemoteUrl" -ForegroundColor DarkGray
    
    try {
        # Set target remote
        Set-RemoteUrl $TargetUrl
        
        # Show remote configuration
        Write-ColorText "--------------------------------" -ForegroundColor Green
        Write-ColorText "Executing: git remote -v" -ForegroundColor DarkGray
        git remote -v
        Write-ColorText "--------------------------------" -ForegroundColor Green
        Write-ColorText "----------------------------------------------------------------" -ForegroundColor DarkYellow

        # Run pre-commit encryption check (only once per session)
        if (-not $script:EncryptionCheckCompleted) {
            Write-ColorText "Checking for unencrypted sensitive files..." -ForegroundColor Cyan

            # Initialize and cleanup skip cache
            Initialize-SkipEncryptCache
            Clear-SkipEncryptCache

            # Check for correct secret keys structure
            $coreNodeDir = Split-Path (Split-Path $scriptPath -Parent) -Parent
            $secretKeysDir = Join-Path $coreNodeDir ".secret_keys"
            $secretKeysRawDir = Join-Path $secretKeysDir ".secret_ignore"
            $secretKeysEncryptedDir = Join-Path $secretKeysDir "already_encrypted"

            Write-ColorText "Scanning directory: $secretKeysRawDir" -ForegroundColor Cyan

            if (Test-Path $secretKeysRawDir) {
                $unencryptedFiles = @()
                $rawFiles = Get-ChildItem -Path $secretKeysRawDir -File

                foreach ($rawFile in $rawFiles) {
                    # Skip files that are in the skip cache
                    if (Test-FileInSkipCache $rawFile.FullName) {
                        continue
                    }

                    $encryptedFile = Join-Path $secretKeysEncryptedDir "$($rawFile.Name).js"

                    # Check if corresponding encrypted .js file exists and is newer than raw file
                    if (-not (Test-Path $encryptedFile)) {
                        # No encrypted .js file exists, need to encrypt
                        $unencryptedFiles += $rawFile
                    } elseif ($rawFile.LastWriteTime -gt (Get-Item $encryptedFile).LastWriteTime) {
                        # Raw file is newer than encrypted .js file, need to re-encrypt
                        $unencryptedFiles += $rawFile
                    }
                    # If encrypted .js file exists and is newer than raw file, skip encryption
                }

                if ($unencryptedFiles.Count -gt 0) {
                    Write-ColorText "WARNING: Unencrypted sensitive files detected!" -ForegroundColor Yellow
                    Write-ColorText "[SECRET] Found $($unencryptedFiles.Count) unencrypted sensitive files:" -ForegroundColor Red
                    foreach ($file in $unencryptedFiles) {
                        Write-ColorText "  - $($file.FullName)" -ForegroundColor Yellow
                    }
                    Write-Host ""

                    # Ask for encryption confirmation with skip option
                    Write-ColorText "Do you want to encrypt these files before pushing? (Y/n/skip): " -ForegroundColor Yellow
                    Write-ColorText "  Y     - Encrypt all files" -ForegroundColor Cyan
                    Write-ColorText "  n     - Skip encryption this time (push unencrypted)" -ForegroundColor Cyan
                    Write-ColorText "  skip  - Skip all and never ask again for these files (unless modified)" -ForegroundColor Cyan
                    $encryptConfirm = Read-Host

                    if ($encryptConfirm -eq '' -or $encryptConfirm -match '^[Yy]$') {
                        Write-ColorText "Starting automatic encryption using disguise.js..." -ForegroundColor Cyan
                    } elseif ($encryptConfirm -match '^[Nn]$') {
                        Write-ColorText "Skipping encryption. Continuing with git push." -ForegroundColor Yellow
                        Write-ColorText "WARNING: Sensitive files will be pushed unencrypted!" -ForegroundColor Red
                        $skipEncryption = $true
                    } elseif ($encryptConfirm -match '^[Ss][Kk][Ii][Pp]$') {
                        Write-ColorText "Adding files to skip cache..." -ForegroundColor Yellow
                        foreach ($file in $unencryptedFiles) {
                            $fileMtimeReadable = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                            Add-FileToSkipCache $file.FullName
                            Write-ColorText "  - Cached: $($file.Name) (Last modified: $fileMtimeReadable)" -ForegroundColor DarkGray
                        }
                        Write-ColorText "Files added to cache. They will not be checked again unless modified." -ForegroundColor Green
                        Write-ColorText "Note: If any file is modified, it will be prompted again." -ForegroundColor Cyan
                        Write-ColorText "Cache location: $skipEncryptCacheFile" -ForegroundColor DarkGray
                        Write-ColorText "WARNING: Sensitive files will be pushed unencrypted!" -ForegroundColor Red
                        $skipEncryption = $true
                    } else {
                        Write-ColorText "Invalid input. Defaulting to Yes." -ForegroundColor Yellow
                        Write-ColorText "Starting automatic encryption using disguise.js..." -ForegroundColor Cyan
                    }

                    if (-not $skipEncryption) {

                # Find disguise.js in scripts directory
                Write-ColorText "Searching for disguise.js in scripts directory..." -ForegroundColor Cyan
                $scriptsDir = Join-Path $coreNodeDir "scripts"
                $disguiseJsPath = $null

                if (Test-Path $scriptsDir) {
                    $disguiseJs = Get-ChildItem -Path $scriptsDir -Filter "disguise.js" -Recurse -File | Select-Object -First 1
                    if ($disguiseJs) {
                        $disguiseJsPath = $disguiseJs.FullName
                    }
                }

                if ($disguiseJsPath) {
                    Write-ColorText "Found disguise.js at: $disguiseJsPath" -ForegroundColor Green

                    # Get password once for all files
                    Write-ColorText "Enter encryption password for all sensitive files:" -ForegroundColor Yellow
                    $globalPassword = $null

                    do {
                        Write-Host "Enter encryption password: " -NoNewline -ForegroundColor Yellow
                        $password1 = Read-Host -AsSecureString
                        $plaintextPassword1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password1))

                        if ([string]::IsNullOrWhiteSpace($plaintextPassword1)) {
                            Write-ColorText "ERROR: Password cannot be empty. Please try again." -ForegroundColor Red
                            continue
                        }

                        Write-Host "Confirm encryption password: " -NoNewline -ForegroundColor Yellow
                        $password2 = Read-Host -AsSecureString
                        $plaintextPassword2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password2))

                        if ($plaintextPassword1 -eq $plaintextPassword2) {
                            $globalPassword = $plaintextPassword1
                            break
                        } else {
                            Write-ColorText "ERROR: Passwords do not match. Please try again." -ForegroundColor Red
                            # Clear passwords from memory
                            $plaintextPassword1 = $null
                            $plaintextPassword2 = $null
                        }
                    } while ($true)

                    # Clear confirmation password from memory
                    $plaintextPassword1 = $null
                    $plaintextPassword2 = $null

                    # Encrypt each file using the same password
                    $encryptionFailed = $false
                    foreach ($file in $unencryptedFiles) {
                        Write-ColorText "Encrypting: $($file.Name)" -ForegroundColor Cyan

                        # Print encryption parameters
                        $maskedPassword = "*" * $globalPassword.Length
                        Write-ColorText "Encryption parameters:" -ForegroundColor Gray
                        Write-ColorText "  - Tool: $disguiseJsPath" -ForegroundColor Gray
                        Write-ColorText "  - Input: $($file.FullName)" -ForegroundColor Gray
                        Write-ColorText "  - Password: $maskedPassword" -ForegroundColor Gray
                        Write-ColorText "  - Output Dir: $secretKeysEncryptedDir" -ForegroundColor Gray
                        Write-ColorText "  - Command: node disguise.js `"$($file.FullName)`" `"$maskedPassword`" `"$secretKeysEncryptedDir`"" -ForegroundColor Gray

                        # Run disguise.js encryption
                        Write-ColorText "Running encryption..." -ForegroundColor Cyan
                        $result = & node "$disguiseJsPath" "$($file.FullName)" "$globalPassword" "$secretKeysEncryptedDir" 2>&1

                        if ($LASTEXITCODE -eq 0) {
                            Write-ColorText "SUCCESS: Encrypted $($file.Name)" -ForegroundColor Green
                        } else {
                            Write-ColorText "WARNING: Failed to encrypt $($file.Name)" -ForegroundColor Yellow
                            Write-ColorText "Error: $result" -ForegroundColor Yellow
                            $encryptionFailed = $true
                            # Continue with next file instead of breaking
                        }
                    }

                    # Clear global password from memory
                    $globalPassword = $null

                    if ($encryptionFailed) {
                        Write-ColorText "WARNING: Some files failed to encrypt, but continuing with git push." -ForegroundColor Yellow
                        Write-ColorText "Please manually encrypt failed files later." -ForegroundColor Yellow
                    } else {
                        Write-ColorText "SUCCESS: All files encrypted successfully." -ForegroundColor Green
                    }
                } else {
                    Write-ColorText "WARNING: disguise.js not found in scripts directory." -ForegroundColor Yellow
                    Write-ColorText "Continuing with git push. Please encrypt sensitive files manually." -ForegroundColor Yellow
                }
                    } # End of else block for "Skip encryption? N"
            } else {
                Write-ColorText "SUCCESS: No unencrypted sensitive files found." -ForegroundColor Green
            }
        } else {
            Write-ColorText "INFO: No secret keys directory found." -ForegroundColor Cyan
        }

        # Mark encryption check as completed for this session
        $script:EncryptionCheckCompleted = $true
    } else {
        Write-ColorText "INFO: Encryption check already completed in this session." -ForegroundColor Gray
    }
    
    # Check if main branch exists on remote
    Write-ColorText "Executing: git branch -r | Select-String -Pattern 'origin/$currentBranch'" -ForegroundColor DarkGray
    $branchExists = git branch -r | Select-String -Pattern "origin/$currentBranch"
    if (-not $branchExists) {
        Write-ColorText "Branch '$currentBranch' does not exist. Creating '$currentBranch' branch..." -ForegroundColor Red
        Write-ColorText "Executing: git checkout -b $currentBranch" -ForegroundColor DarkGray
        git checkout -b $currentBranch
        Write-ColorText "Executing: git push --set-upstream origin $currentBranch" -ForegroundColor DarkGray
        git push --set-upstream origin $currentBranch
        Write-ColorText "Executing: git branch --set-upstream-to=origin/$currentBranch $currentBranch" -ForegroundColor DarkGray
        git branch --set-upstream-to=origin/$currentBranch $currentBranch
        if ($script:ForcePushChoice -match '^[Yy]$') {
            Write-ColorText "FORCE PUSH MODE - skipping pull on new branch" -ForegroundColor Red
        } elseif (-not $script:PullCompleted) {
            Write-ColorText "Executing: git pull origin main" -ForegroundColor DarkGray
            git pull origin main
            $script:PullCompleted = $true
        } else {
            Write-ColorText "Skipping pull - already synchronized in this session" -ForegroundColor Yellow
        }
    } else {
        # Stage all changes FIRST (before pull)
        Write-ColorText "Staging all changes..." -ForegroundColor Cyan
        Write-ColorText "Executing: git add ." -ForegroundColor DarkGray
        git add .
        
        # Validate win_common files before commit (only once per session)
        if (-not $script:FileValidationCompleted) {
            Test-WinCommonFiles
            $script:FileValidationCompleted = $true
        } else {
            Write-Host "INFO: File validation already completed in this session." -ForegroundColor Gray
        }

        # Get the commit message from the user (auto-defaults after an idle timeout).
        $commitMessage = Get-CommitMessage

        # Stage anything that changed while the prompt was open, then create the
        # single commit for this push. One push cycle produces exactly one commit
        # (no separate "[AUTO] Pre-commit" commit).
        Write-ColorText "Staging any new changes..." -ForegroundColor Cyan
        Write-ColorText "Executing: git add ." -ForegroundColor DarkGray
        git add .

        # Only commit when something is actually staged; a clean tree is not an error.
        git diff --cached --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "Committing changes with message: $commitMessage" -ForegroundColor Cyan
            Write-ColorText "Executing: git commit -m `"$commitMessage`"" -ForegroundColor DarkGray
            git commit -m $commitMessage
        } else {
            Write-ColorText "Nothing new to commit; working tree already clean." -ForegroundColor DarkGray
        }

        # Ensure local is fully committed before any pull/push (force or normal)
        $statusOutput = git status --porcelain
        if ($statusOutput) {
            Write-ColorText "ERROR: Working tree not clean after commit; aborting to protect local work." -ForegroundColor Red
            git status --short
            return $false
        }
        Write-ColorText "Local commit verified: working tree is clean." -ForegroundColor Green

        # Use force push choice from main execution (already asked before starting operations)
        if ($null -eq $script:ForcePushChoice) {
            # Fallback: if somehow not set, default to normal push
            $script:ForcePushChoice = "N"
            Write-ColorText "Using default: Normal push mode" -ForegroundColor DarkGray
        } else {
            Write-ColorText "Using force push choice: $($script:ForcePushChoice)" -ForegroundColor DarkGray
        }

        if ($script:ForcePushChoice -match '^[Yy]$') {
            # Force push mode - skip pull completely
            Write-ColorText "=== FORCE PUSH MODE ===" -ForegroundColor Red
            Write-ColorText "Skipping pull (will overwrite remote changes)" -ForegroundColor Red
            Write-ColorText "WARNING: Force pushing all changes..." -ForegroundColor Red
            Write-ColorText "Executing: git push --force --set-upstream origin $currentBranch" -ForegroundColor DarkGray
            git push --force --set-upstream origin $currentBranch
        } else {
            # Normal push mode - pull only once per session (first remote)
            Write-ColorText "=== NORMAL PUSH MODE ===" -ForegroundColor Green
            if (-not $script:PullCompleted) {
                Write-ColorText "Pulling and merging remote changes after commit..." -ForegroundColor Cyan
                Write-ColorText "Executing: git pull origin $currentBranch --no-edit" -ForegroundColor DarkGray
                git pull origin $currentBranch --no-edit
                $script:PullCompleted = $true
            } else {
                Write-ColorText "Skipping pull - already synchronized in this session" -ForegroundColor Yellow
            }

            Write-ColorText "Pushing changes to remote..." -ForegroundColor Cyan
            Write-ColorText "Executing: git push --set-upstream origin $currentBranch" -ForegroundColor DarkGray
            git push --set-upstream origin $currentBranch
        }

        Write-ColorText "----------------------------------------------------------------" -ForegroundColor DarkBlue
    }
    
    return $true
        
    } catch {
        Write-ColorText "Git operation failed: $_" -ForegroundColor Red
        return $false
    } finally {
        # Always restore original/default remote
        Restore-OriginalRemote
    }
}

# Main execution with error handling
try {
    if ($Pull) {
        Write-ColorText "=== Unified Git PULL Script ===" -ForegroundColor Magenta
    } else {
        Write-ColorText "=== Unified Git PUSH Script ===" -ForegroundColor Magenta
    }
    Write-ColorText "Default remote: $DEFAULT_REMOTE" -ForegroundColor DarkCyan
    
    # Change to project directory first
    Set-Location $coreNodeDir
    Write-ColorText "Changed to: $coreNodeDir" -ForegroundColor DarkCyan
    
    # Create working directory backup if enabled
    if (-not (Create-WorkingBackup)) {
        Write-ColorText "Warning: Backup creation failed, but continuing..." -ForegroundColor Yellow
    }
    
    # Ensure we're on the correct branch (smart branch management)
    if (-not (Ensure-TargetBranch -TargetBranch "main")) {
        Write-ColorText "Branch management failed. Please resolve manually." -ForegroundColor Red
        throw "Branch management failed"
    }
    
    # Determine target remote
    if (-not $TargetRemote) {
        Write-ColorText "No target specified, using all remotes" -ForegroundColor Yellow
        # local temporarily disabled (not reachable or not in use); restore with: @("github", "gitee", "local")
        $targets = @("github", "gitee")
    } else {
        $targets = @($TargetRemote)
    }
    
    # Reorder targets to execute DEFAULT_REMOTE first
    $targets = Get-ExecutionOrder -Targets $targets
    
    # Preview targets before pushing
    Write-ColorText "" -ForegroundColor White
    Write-ColorText "============================================================" -ForegroundColor Cyan
    if ($Pull) {
        Write-ColorText "  PULL TARGETS PREVIEW" -ForegroundColor Cyan
    } else {
        Write-ColorText "  PUSH TARGETS PREVIEW" -ForegroundColor Cyan
    }
    Write-ColorText "============================================================" -ForegroundColor Cyan
    Write-ColorText "Total targets: $($targets.Count)" -ForegroundColor Green
    
    # Warning if only one target
    if ($targets.Count -eq 1) {
        Write-ColorText "" -ForegroundColor White
        Write-ColorText "⚠️  WARNING: Only pushing to ONE remote repository!" -ForegroundColor Red
        Write-ColorText "    To push to all remotes, select 'all' in the menu" -ForegroundColor Yellow
    }
    
    Write-ColorText "" -ForegroundColor White
    
    $targetIndex = 1
    foreach ($target in $targets) {
        if ($remoteConfigs.ContainsKey($target)) {
            $targetUrl = $remoteConfigs[$target]
            Write-ColorText "  [$targetIndex] $target" -ForegroundColor Yellow
            Write-ColorText "      URL: $targetUrl" -ForegroundColor DarkGray
        }
        $targetIndex++
    }
    Write-ColorText "" -ForegroundColor White
    Write-ColorText "============================================================" -ForegroundColor Cyan
    Write-ColorText "" -ForegroundColor White
    
    # Ask once for force push decision (applies to all targets) - before starting operations
    if (-not $Pull) {
        Write-ColorText "Do you want to force push? [y/N]: " -ForegroundColor Yellow -NoNewline
        $script:ForcePushChoice = Read-Host
        if ($script:ForcePushChoice -match '^[Yy]$') {
            Write-ColorText "✓ Force push enabled for ALL targets" -ForegroundColor Red
        } else {
            Write-ColorText "✓ Normal push mode (with pull) for ALL targets" -ForegroundColor Green
        }
        Write-ColorText "" -ForegroundColor White

        Write-ColorText "Refresh GitHub HOST (GitHub520)? [y/N]: " -ForegroundColor Yellow -NoNewline
        $refreshHostChoice = Read-Host
        if ($refreshHostChoice -match '^[Yy]$') {
            if (Get-Command Invoke-GitHubHostRefresh -ErrorAction SilentlyContinue) {
                $refreshScriptBlock = { param($t, $c) Write-ColorText $t -ForegroundColor $c }
                Invoke-GitHubHostRefresh -WriteColorText $refreshScriptBlock
            }
        }
        Write-ColorText "" -ForegroundColor White

        Write-ColorText "Refresh Gitee HOST? [y/N]: " -ForegroundColor Yellow -NoNewline
        $refreshGiteeChoice = Read-Host
        if ($refreshGiteeChoice -match '^[Yy]$') {
            if (Get-Command Invoke-GiteeHostRefresh -ErrorAction SilentlyContinue) {
                $refreshScriptBlock = { param($t, $c) Write-ColorText $t -ForegroundColor $c }
                Invoke-GiteeHostRefresh -WriteColorText $refreshScriptBlock
            }
        }
        Write-ColorText "" -ForegroundColor White

        Show-RepoSizeOverview -Targets $targets -Configs $remoteConfigs
    }

    $allSuccess = $true
    
    foreach ($target in $targets) {
        if ($remoteConfigs.ContainsKey($target)) {
            $targetUrl = $remoteConfigs[$target]
            
            if ($Pull) {
                Write-ColorText "`n=== Pulling from $target ($targetUrl) ===" -ForegroundColor Magenta
                $success = Invoke-SafeGitPull $targetUrl
                if (-not $success) {
                    $allSuccess = $false
                    Write-ColorText "Failed to pull from $target" -ForegroundColor Red
                } else {
                    Write-ColorText "Successfully pulled from $target" -ForegroundColor Green
                }
                # For pull operations, only process the first (default) remote
                break
            } else {
                Write-ColorText "`n=== Pushing to $target ($targetUrl) ===" -ForegroundColor Magenta
                $success = Invoke-GitOperations $targetUrl
                if (-not $success) {
                    $allSuccess = $false
                    Write-ColorText "Failed to push to $target" -ForegroundColor Red
                } else {
                    Write-ColorText "Successfully pushed to $target" -ForegroundColor Green
                }
            }
        } else {
            Write-ColorText "Unknown remote target: $target" -ForegroundColor Red
            $allSuccess = $false
        }
    }
    
    Write-ColorText "`n=== Summary ===" -ForegroundColor Magenta
    if ($Pull) {
        if ($allSuccess) {
            Write-ColorText "Git pull operation completed successfully!" -ForegroundColor Green
        } else {
            Write-ColorText "Git pull operation failed!" -ForegroundColor Red
        }
    } else {
        if ($allSuccess) {
            Write-ColorText "All git push operations completed successfully!" -ForegroundColor Green
        } else {
            Write-ColorText "Some git push operations failed!" -ForegroundColor Red
        }
    }
    
} catch {
    Write-ColorText "Script execution failed: $_" -ForegroundColor Red
    
} finally {
    # Final restoration attempt
    try {
        Set-Location $coreNodeDir
        Restore-OriginalRemote
    } catch {
        Write-ColorText "Final restoration failed: $_" -ForegroundColor Red
    }
    
    # Restore original working directory
    Set-Location $originalWorkingDir
    Write-ColorText "Restored working directory: $originalWorkingDir" -ForegroundColor DarkCyan
}
