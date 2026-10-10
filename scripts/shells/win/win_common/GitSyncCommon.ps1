<#
.SYNOPSIS
    Shared "gitsync" behavior (D20): ensure origin is the GitHub SSH remote
    (never Gitee), commit any pending local changes with a generated
    message, then pull and push the target branch.

.DESCRIPTION
    One implementation, reused by:
      - scripts/winenvs/gitsync.ps1      (the "gitsync" quick command)
      - scripts/shells/win/dd.ps1        ("gitsync" argument, dd.cmd gitsync)
      - scripts/git/gitput_unified.ps1   (origin-URL read/write only, its own
                                           remote-rotation flow is unchanged)

    Linux counterpart: scripts/shells/linux/common/git_sync_common.sh.

    Does not dot-source CommonFunc.ps1 / GlobalVars.ps1 (no StrictMode leak
    into the caller's scope, no global-var-store touch). The repo root comes
    from the central constant $Global:CORE_NODE_PROJECT_ROOT
    (SharedCacheEnv.ps1, loaded on demand), so it works before any other
    core_node script has loaded.

    DryRun contract: every git WRITE here (remote add/set-url, add, commit,
    pull, push) is skipped when DryRun is set, and DryRun makes ZERO calls to
    git.exe at all -- only local file reads (git_remotes.conf, package.json)
    -- so it can be verified against a stub git.exe call-logger expecting
    zero recorded invocations.
#>

# =============================================================================
# Module-scope constants (declared at file top)
# =============================================================================
$script:GitSyncCommonScriptDir = $PSScriptRoot
$script:GitSyncTargetBranch = "main"
$script:GitSyncRemoteName = "origin"
$script:GitSyncScriptsSubdirName = "scripts"
$script:GitSyncGitSubdirName = "git"
$script:GitSyncRemotesConfFileName = "git_remotes.conf"
$script:GitSyncPackageJsonFileName = "package.json"
$script:GitSyncGitHubConfKey = "github"
$script:GitSyncSystemName = "win"
$script:GitSyncFallbackVersion = "0.0.0"
$script:GitSyncDdCmdFileName = "dd.cmd"
$script:GitSyncSharedCacheEnvPath = Join-Path -Path $script:GitSyncCommonScriptDir -ChildPath "SharedCacheEnv.ps1"
$script:GitSyncProjectRootVarName = "CORE_NODE_PROJECT_ROOT"
$script:GitSyncGitDirName = ".git"
$script:GitSyncGitDirFilePrefix = "gitdir:"
$script:GitSyncLockFiles = @("index.lock", "HEAD.lock", "ORIG_HEAD.lock", (Join-Path -Path (Join-Path -Path "refs" -ChildPath "heads") -ChildPath ("{0}.lock" -f $script:GitSyncTargetBranch)))
$script:GitSyncBlockingStates = @("rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD")
$script:GitSyncMergeHeadName = "MERGE_HEAD"
$script:GitSyncLockStaleSeconds = 60
$script:GitSyncLockPollSeconds = 2
$script:GitSyncVmMarker = "VM"
$script:GitSyncVmModelMarkers = @("Virtual", "VMware", "KVM", "QEMU", "VirtualBox", "Xen", "Parallels", "bhyve")
$script:GitSyncTimestampFormat = "yyyy-MM-dd-HH-mm-ss"
$script:GitSyncDescriptionSeparator = "-"
$script:GitSyncDescriptionPromptSeconds = 3
$script:GitSyncDescriptionPollMilliseconds = 100
$script:GitSyncChangeListMax = 30
# Opt-in Laravel code-sync notice after a successful push (config/service_contract.json code_sync):
# the signed CLI starts the server job (gitsync --skip-notice-laravel, safe migrations, worker
# restart) and polls its status. The skip flag always wins; it is what the server job passes.
$script:GitSyncNoticeFlag = "--notice-laravel"
$script:GitSyncSkipNoticeFlag = "--skip-notice-laravel"
$script:GitSyncSignedCliPath = Join-Path -Path (Join-Path -Path (Join-Path -Path "ncore" -ChildPath "foundation") -ChildPath "common") -ChildPath "laravel_signed_cli.js"
# Copy-ready AI prompt on a merge conflict; its text lives in config/service_contract.json
# code_sync.conflict_* (shared with git_sync_common.sh and pycore's gitsync watch service).
$script:GitSyncServiceContractPath = Join-Path -Path $script:GitSyncCommonScriptDir -ChildPath "ServiceContract.ps1"
$script:GitSyncPromptSeparator = "-" * 72

if (-not (Get-Command -Name "Get-ServiceContractValue" -ErrorAction SilentlyContinue)) {
    . $script:GitSyncServiceContractPath
}

# =============================================================================
# Path resolution
# =============================================================================

function Get-GitSyncRepoRoot {
    <#
    .SYNOPSIS
        Resolves the dd project root from the central constants library:
        $Global:CORE_NODE_PROJECT_ROOT (SharedCacheEnv.ps1, dot-sourced on
        demand; mirrors Linux CORE_NODE_PROJECT_ROOT). Falls back to this
        script's own location (four levels up) and then `git rev-parse
        --show-toplevel` when that constant has no dd.cmd.
    #>
    param()

    $projectRootVar = Get-Variable -Name $script:GitSyncProjectRootVarName -Scope Global -ErrorAction SilentlyContinue
    if ($null -eq $projectRootVar -or [string]::IsNullOrWhiteSpace([string]$projectRootVar.Value)) {
        . $script:GitSyncSharedCacheEnvPath
        $projectRootVar = Get-Variable -Name $script:GitSyncProjectRootVarName -Scope Global -ErrorAction SilentlyContinue
    }
    if ($null -ne $projectRootVar -and -not [string]::IsNullOrWhiteSpace([string]$projectRootVar.Value)) {
        $projectRootDdCmd = Join-Path -Path ([string]$projectRootVar.Value) -ChildPath $script:GitSyncDdCmdFileName
        if (Test-Path -LiteralPath $projectRootDdCmd) {
            return [string]$projectRootVar.Value
        }
    }

    $winCommonDir = $script:GitSyncCommonScriptDir
    $winDir = Split-Path -Path $winCommonDir -Parent
    $shellsDir = Split-Path -Path $winDir -Parent
    $scriptsDir = Split-Path -Path $shellsDir -Parent
    $repoRootCandidate = Split-Path -Path $scriptsDir -Parent

    $ddCmdCandidate = Join-Path -Path $repoRootCandidate -ChildPath $script:GitSyncDdCmdFileName
    if (Test-Path -LiteralPath $ddCmdCandidate) {
        return $repoRootCandidate
    }

    $previousLocation = Get-Location
    try {
        Set-Location -Path $winCommonDir
        $topLevel = (git rev-parse --show-toplevel 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($topLevel)) {
            $topLevelPath = (Resolve-Path -Path $topLevel.Trim()).Path
            $ddCmdFromTop = Join-Path -Path $topLevelPath -ChildPath $script:GitSyncDdCmdFileName
            if (Test-Path -LiteralPath $ddCmdFromTop) {
                return $topLevelPath
            }
        }
    } finally {
        Set-Location -Path $previousLocation
    }

    return $repoRootCandidate
}

function Get-GitSyncRemotesConfPath {
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot
    )
    $scriptsPath = Join-Path -Path $RepoRoot -ChildPath $script:GitSyncScriptsSubdirName
    $gitPath = Join-Path -Path $scriptsPath -ChildPath $script:GitSyncGitSubdirName
    return (Join-Path -Path $gitPath -ChildPath $script:GitSyncRemotesConfFileName)
}

function Get-GitSyncPackageJsonPath {
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot
    )
    return (Join-Path -Path $RepoRoot -ChildPath $script:GitSyncPackageJsonFileName)
}

# =============================================================================
# GitHub SSH origin (read-only lookup + the one write primitive; no regex)
# =============================================================================

function Get-GitSyncRemoteConfigs {
    <#
    .SYNOPSIS
        Reads scripts/git/git_remotes.conf into a key/value table. No regex:
        each non-comment, non-blank line is split on the first "=". This is
        the one reader for that file on the PowerShell side -- both
        Get-GitSyncGitHubSshUrl below and gitput_unified.ps1's
        Load-RemoteConfigs go through this instead of parsing the file a
        second time (review round 1, B2). Returns an empty table when the
        file is missing.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot
    )

    $confPath = Get-GitSyncRemotesConfPath -RepoRoot $RepoRoot
    $remoteConfigs = @{}
    if (-not (Test-Path -LiteralPath $confPath)) {
        return $remoteConfigs
    }

    $confLines = Get-Content -LiteralPath $confPath -Encoding UTF8
    foreach ($confLine in $confLines) {
        $trimmedLine = $confLine.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmedLine) -or $trimmedLine.StartsWith("#")) {
            continue
        }
        $equalsIndex = $trimmedLine.IndexOf("=")
        if ($equalsIndex -lt 0) {
            continue
        }
        $confKey = $trimmedLine.Substring(0, $equalsIndex).Trim()
        $confValue = $trimmedLine.Substring($equalsIndex + 1).Trim()
        $remoteConfigs[$confKey] = $confValue
    }

    return $remoteConfigs
}

function Get-GitSyncGitHubSshUrl {
    <#
    .SYNOPSIS
        Reads the "github=" SSH URL from scripts/git/git_remotes.conf -- the
        single gitunified remote definition, also read by
        gitput_unified_modules/config.py's load_remote_configs() and by
        gitput_unified.ps1's Load-RemoteConfigs (which delegates to
        Get-GitSyncRemoteConfigs above). Returns $null when the file or the
        key is missing.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot
    )

    $remoteConfigs = Get-GitSyncRemoteConfigs -RepoRoot $RepoRoot
    if ($remoteConfigs.ContainsKey($script:GitSyncGitHubConfKey)) {
        return $remoteConfigs[$script:GitSyncGitHubConfKey]
    }

    return $null
}

function Get-GitSyncCurrentRemoteUrl {
    <#
    .SYNOPSIS
        Safe wrapper around `git remote get-url <name>`: returns $null when
        the remote does not exist or the read otherwise fails, and never
        throws. Needed because PowerShell 5.1, under
        $ErrorActionPreference = 'Stop' (set by gitput_unified.ps1, which
        dot-sources this file), turns a native command's stderr line into a
        terminating error even though that stream is redirected to $null
        (review round 1, B1). Every `git remote get-url` read in this file
        goes through this one helper instead of a bare `2>$null` each
        (review round 1, N2 -- also folds in gitput_unified.ps1's own read).
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RemoteName
    )

    $remoteUrl = $null

    try {
        $remoteUrl = (git remote get-url $RemoteName 2>$null)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($remoteUrl)) {
            return $null
        }
        return $remoteUrl
    } catch {
        return $null
    }
}

function Set-GitSyncRemoteUrl {
    <#
    .SYNOPSIS
        Unconditionally points $RemoteName at $TargetUrl: `git remote add`
        when the remote does not exist yet, else `git remote set-url`. This
        is the ONE function -- reused by gitput_unified.ps1's own
        remote-rotation (github/gitee/local push targets, and restoring the
        original remote) and by Set-GitSyncRemoteIfDifferent below -- that
        performs the actual git write. Never used in DryRun mode.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RemoteName,
        [Parameter(Mandatory = $true)] [string]$TargetUrl
    )

    $currentUrl = Get-GitSyncCurrentRemoteUrl -RemoteName $RemoteName

    if ([string]::IsNullOrEmpty($currentUrl)) {
        Write-Host "[gitsync] Executing: git remote add $RemoteName $TargetUrl"
        git remote add $RemoteName $TargetUrl
    } else {
        Write-Host "[gitsync] Executing: git remote set-url $RemoteName $TargetUrl"
        git remote set-url $RemoteName $TargetUrl
    }
}

function Set-GitSyncRemoteIfDifferent {
    <#
    .SYNOPSIS
        Idempotent, finest-grain remote set: reads the current URL with
        Get-GitSyncCurrentRemoteUrl, and calls Set-GitSyncRemoteUrl only
        when it differs. DryRun makes NO git.exe call at all and only
        prints the command that would run.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RemoteName,
        [Parameter(Mandatory = $true)] [string]$TargetUrl,
        [Parameter(Mandatory = $false)] [bool]$DryRun = $false
    )

    if ($DryRun) {
        Write-Host "[gitsync] Would ensure: git remote set-url $RemoteName $TargetUrl (git remote add $RemoteName $TargetUrl if $RemoteName does not exist yet; skipped entirely when already correct)"
        return
    }

    $currentUrl = Get-GitSyncCurrentRemoteUrl -RemoteName $RemoteName

    if ($currentUrl -eq $TargetUrl) {
        Write-Host "[gitsync] $RemoteName already set to: $TargetUrl (no change needed)"
        return
    }

    Set-GitSyncRemoteUrl -RemoteName $RemoteName -TargetUrl $TargetUrl
}

function Invoke-GitSyncEnsureGitHubSshOrigin {
    <#
    .SYNOPSIS
        Ensures $RemoteName (default "origin") is the GitHub SSH URL from
        git_remotes.conf, never Gitee. Reused by gitsync (this file) and
        called directly from gitput_unified.ps1's main(), before any push
        target is processed, matching Linux's gitput_unified.sh main()
        calling git_sync_ensure_github_ssh_origin (review round 1, B1 --
        previously only defined here, never actually called from gitput),
        so there is one behavior for the "origin" step in both entry
        points.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $false)] [bool]$DryRun = $false
    )

    $githubUrl = Get-GitSyncGitHubSshUrl -RepoRoot $RepoRoot
    if ([string]::IsNullOrWhiteSpace($githubUrl)) {
        $confPath = Get-GitSyncRemotesConfPath -RepoRoot $RepoRoot
        Write-Host "[gitsync] ERROR: no '$($script:GitSyncGitHubConfKey)=' SSH entry in $confPath"
        return $false
    }

    Set-GitSyncRemoteIfDifferent -RemoteName $script:GitSyncRemoteName -TargetUrl $githubUrl -DryRun $DryRun
    return $true
}

# =============================================================================
# Commit message
# =============================================================================

function Get-GitSyncProjectVersion {
    <#
    .SYNOPSIS
        The project's single version definition: root package.json
        "version", read as JSON (no regex). No dedicated dd/core_node
        version constant exists in dd.sh, dd.ps1 or the gitunified modules
        (checked for D20; only the runtime $SYSTEM_VERSION platform-detection
        variable exists there, not a project version) -- never add a second
        one here.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot
    )

    $packageJsonPath = Get-GitSyncPackageJsonPath -RepoRoot $RepoRoot
    if (-not (Test-Path -LiteralPath $packageJsonPath)) {
        return $script:GitSyncFallbackVersion
    }

    try {
        $packageJsonContent = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8
        $packageJsonObject = $packageJsonContent | ConvertFrom-Json
        if (($packageJsonObject.PSObject.Properties.Name -contains "version") -and -not [string]::IsNullOrWhiteSpace($packageJsonObject.version)) {
            return [string]$packageJsonObject.version
        }
    } catch {
        Write-Host "[gitsync] WARNING: failed to read version from $packageJsonPath : $($_.Exception.Message)"
    }

    return $script:GitSyncFallbackVersion
}

function Get-GitSyncSystemName {
    <#
    .SYNOPSIS
        "win" on Windows. (The Linux counterpart derives "<distro id><major>"
        from /etc/os-release; Windows has exactly one system name.)
    #>
    param()
    return $script:GitSyncSystemName
}

function Test-GitSyncIsVm {
    <#
    .SYNOPSIS
        True when Win32_ComputerSystem reports a virtual machine model or
        manufacturer.
    #>
    param()

    try {
        $computerSystem = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop
    } catch {
        return $false
    }
    $systemIdentity = "{0} {1}" -f $computerSystem.Manufacturer, $computerSystem.Model
    foreach ($vmModelMarker in $script:GitSyncVmModelMarkers) {
        if ($systemIdentity.IndexOf($vmModelMarker, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            return $true
        }
    }
    return $false
}

function ConvertTo-GitSyncDescription {
    <#
    .SYNOPSIS
        Joins the words of $Description with "-" so the commit message has
        no spaces.
    #>
    param(
        [Parameter(Mandatory = $false)] [string]$Description = ""
    )

    if ([string]::IsNullOrWhiteSpace($Description)) {
        return ""
    }
    $descriptionWords = $Description.Split([char[]]@(' ', "`t", "`r", "`n", [char]0x3000), [System.StringSplitOptions]::RemoveEmptyEntries)
    return ($descriptionWords -join $script:GitSyncDescriptionSeparator)
}

function Show-GitSyncStagedChanges {
    <#
    .SYNOPSIS
        Prints the staged changes (status + path, at most
        GitSyncChangeListMax lines) so the user sees what will be committed
        before describing it.
    #>
    $stagedChanges = @(git diff --cached --name-status 2>$null | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    Write-Host "[gitsync] Staged changes: $($stagedChanges.Count) file(s)"
    foreach ($stagedChange in ($stagedChanges | Select-Object -First $script:GitSyncChangeListMax)) {
        Write-Host "[gitsync]   $stagedChange"
    }
    if ($stagedChanges.Count -gt $script:GitSyncChangeListMax) {
        Write-Host "[gitsync]   ... and $($stagedChanges.Count - $script:GitSyncChangeListMax) more"
    }
}

function Read-GitSyncDescription {
    <#
    .SYNOPSIS
        Description from $Description, else from the console: pressing any
        key within GitSyncDescriptionPromptSeconds starts it, Enter finishes
        it. NoPrompt (set by -m/--message) never prompts, so AI agents and
        scripts commit non-interactively.
    #>
    param(
        [Parameter(Mandatory = $false)] [string]$Description = "",
        [Parameter(Mandatory = $false)] [bool]$NoPrompt = $false
    )

    Show-GitSyncStagedChanges
    if ([string]::IsNullOrWhiteSpace($Description) -and -not $NoPrompt -and -not [Console]::IsInputRedirected) {
        Write-Host "[gitsync] Type a commit description within $($script:GitSyncDescriptionPromptSeconds)s (Enter to finish), or wait to skip:"
        $promptDeadline = (Get-Date).AddSeconds($script:GitSyncDescriptionPromptSeconds)
        while ((Get-Date) -lt $promptDeadline) {
            if ([Console]::KeyAvailable) {
                $Description = Read-Host
                break
            }
            Start-Sleep -Milliseconds $script:GitSyncDescriptionPollMilliseconds
        }
    }
    return (ConvertTo-GitSyncDescription -Description $Description)
}

function Get-GitSyncCommitMessage {
    <#
    .SYNOPSIS
        "<systemname><version>[VM]<yyyy-MM-dd-HH-mm-ss>[-description]", no
        spaces, e.g. win1.0.0VM2026-10-01-17-51-18-fix-login.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $false)] [string]$Description = ""
    )

    $systemName = Get-GitSyncSystemName
    $version = Get-GitSyncProjectVersion -RepoRoot $RepoRoot
    $vmMarker = ""
    if (Test-GitSyncIsVm) {
        $vmMarker = $script:GitSyncVmMarker
    }
    $timestamp = (Get-Date).ToString($script:GitSyncTimestampFormat)
    $commitMessage = "{0}{1}{2}{3}" -f $systemName, $version, $vmMarker, $timestamp
    if (-not [string]::IsNullOrEmpty($Description)) {
        $commitMessage = "{0}{1}{2}" -f $commitMessage, $script:GitSyncDescriptionSeparator, $Description
    }
    return $commitMessage
}

# =============================================================================
# Idempotent recovery (stale locks, interrupted merge)
# =============================================================================

function Get-GitSyncGitDir {
    <#
    .SYNOPSIS
        The repository's git directory without calling git.exe: .git itself,
        or the target of a "gitdir:" .git file (worktree/submodule).
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot
    )

    $gitDirPath = Join-Path -Path $RepoRoot -ChildPath $script:GitSyncGitDirName
    if (Test-Path -LiteralPath $gitDirPath -PathType Leaf) {
        $gitDirLine = (Get-Content -LiteralPath $gitDirPath -TotalCount 1).Trim()
        if ($gitDirLine.StartsWith($script:GitSyncGitDirFilePrefix)) {
            $gitDirTarget = $gitDirLine.Substring($script:GitSyncGitDirFilePrefix.Length).Trim()
            if (-not [System.IO.Path]::IsPathRooted($gitDirTarget)) {
                $gitDirTarget = Join-Path -Path $RepoRoot -ChildPath $gitDirTarget
            }
            return (Resolve-Path -LiteralPath $gitDirTarget).Path
        }
    }
    return $gitDirPath
}

function Clear-GitSyncStaleLocks {
    <#
    .SYNOPSIS
        Waits for each git lock file to be released; one still present after
        GitSyncLockStaleSeconds without changes is a leftover of a crashed
        git process and is removed. DryRun only reports.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $false)] [bool]$DryRun = $false
    )

    $gitDir = Get-GitSyncGitDir -RepoRoot $RepoRoot
    foreach ($lockName in $script:GitSyncLockFiles) {
        $lockPath = Join-Path -Path $gitDir -ChildPath $lockName
        while (Test-Path -LiteralPath $lockPath) {
            $lockAge = [int]((Get-Date) - (Get-Item -LiteralPath $lockPath).LastWriteTime).TotalSeconds
            if ($lockAge -ge $script:GitSyncLockStaleSeconds) {
                if ($DryRun) {
                    Write-Host "[gitsync] Would remove stale lock ($($lockAge)s old): $lockPath"
                    break
                }
                Write-Host "[gitsync] Removing stale lock ($($lockAge)s old): $lockPath"
                try {
                    Remove-Item -LiteralPath $lockPath -Force -ErrorAction Stop
                } catch {
                    Write-Host "[gitsync] ERROR: cannot remove $lockPath : $($_.Exception.Message)"
                    return $false
                }
                break
            }
            Write-Host "[gitsync] Waiting for active git lock: $lockPath ($($lockAge)s old)"
            Start-Sleep -Seconds $script:GitSyncLockPollSeconds
        }
    }
    return $true
}

function Write-GitSyncAiPrompt {
    <#
    .SYNOPSIS
        Prints a delimited prompt the user can paste to an AI agent; references
        the conflict doc of the pycore gitsync watch service when it exists.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $false)] [string]$ConflictedPaths = ""
    )

    $conflictDoc = [string](Get-ServiceContractValue -ContractPath "code_sync.conflict_doc")
    $context = ""
    $cleanup = ""
    $conflictedList = @($ConflictedPaths -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

    if (Test-Path -LiteralPath (Join-Path -Path $RepoRoot -ChildPath $conflictDoc)) {
        $context = ([string](Get-ServiceContractValue -ContractPath "code_sync.conflict_ai_prompt_doc")).Replace("{doc}", $conflictDoc)
        $cleanup = ([string](Get-ServiceContractValue -ContractPath "code_sync.conflict_ai_prompt_cleanup")).Replace("{doc}", $conflictDoc).Replace("{readme}", [string](Get-ServiceContractValue -ContractPath "code_sync.conflict_readme")).Replace("{marker}", [string](Get-ServiceContractValue -ContractPath "code_sync.conflict_readme_marker"))
    }
    $prompt = ([string](Get-ServiceContractValue -ContractPath "code_sync.conflict_ai_prompt")).Replace("{repo}", $RepoRoot).Replace("{context}", $context).Replace("{cleanup}", $cleanup)

    Write-Host "[gitsync] Copy this prompt for your AI:"
    Write-Host $script:GitSyncPromptSeparator
    Write-Host $prompt
    if ($conflictedList.Count -gt 0) {
        Write-Host ([string](Get-ServiceContractValue -ContractPath "code_sync.conflict_ai_prompt_files"))
        foreach ($conflictedPath in $conflictedList) {
            Write-Host "- $($conflictedPath.Trim())"
        }
    }
    Write-Host $script:GitSyncPromptSeparator
}

# =============================================================================
# Local-only files (code_sync.local_only_paths, also in .gitignore)
# =============================================================================
# .gitignore does not apply to a file that is already tracked, so every `git add .`
# re-committed these per-machine files and they conflicted between machines. They
# leave the index (the working copy stays) and survive every pull byte for byte.

function Get-GitSyncLocalOnlyPaths {
    return @(Get-ServiceContractValue -ContractPath "code_sync.local_only_paths" | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
}

function Remove-GitSyncLocalOnlyFromIndex {
    <#
    .SYNOPSIS
        Untracks every local-only path still in the index (also resolves a
        conflict on it as deleted); the file on disk is kept.
    #>
    $localOnlyPath = ''
    foreach ($localOnlyPath in (Get-GitSyncLocalOnlyPaths)) {
        if ([string]::IsNullOrWhiteSpace((git ls-files -- $localOnlyPath | Out-String))) { continue }
        Write-Host "[gitsync] Untracking local-only file (kept on disk): $localOnlyPath"
        git rm --cached --quiet -- $localOnlyPath
    }
}

function Backup-GitSyncLocalOnlyFiles {
    param([Parameter(Mandatory = $true)] [string]$RepoRoot)
    $backup = @{}
    $localOnlyPath = ''
    $localOnlyFile = ''
    foreach ($localOnlyPath in (Get-GitSyncLocalOnlyPaths)) {
        $localOnlyFile = Join-Path -Path $RepoRoot -ChildPath $localOnlyPath
        if (Test-Path -LiteralPath $localOnlyFile -PathType Leaf) {
            $backup[$localOnlyFile] = [System.IO.File]::ReadAllBytes($localOnlyFile)
        }
    }
    return $backup
}

function Restore-GitSyncLocalOnlyFiles {
    <#
    .SYNOPSIS
        Puts this machine's local-only files back after a pull (a merge may
        overwrite or delete an ignored file) and untracks them again.
    #>
    param([Parameter(Mandatory = $true)] [hashtable]$Backup)
    $localOnlyFile = ''
    foreach ($localOnlyFile in $Backup.Keys) {
        [System.IO.File]::WriteAllBytes($localOnlyFile, $Backup[$localOnlyFile])
    }
    Remove-GitSyncLocalOnlyFromIndex
}

function Resume-GitSyncPendingState {
    <#
    .SYNOPSIS
        Resumes an interrupted sync: stops on an unfinished rebase/cherry-pick
        or unresolved merge conflicts, and concludes a merge whose conflicts
        are all resolved so the following pull/push can proceed. DryRun makes
        no git.exe call.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $false)] [bool]$DryRun = $false
    )

    $gitDir = Get-GitSyncGitDir -RepoRoot $RepoRoot
    foreach ($stateName in $script:GitSyncBlockingStates) {
        if (Test-Path -LiteralPath (Join-Path -Path $gitDir -ChildPath $stateName)) {
            Write-Host "[gitsync] ERROR: an unfinished git operation is in progress ($stateName)."
            Write-Host "[gitsync] Next step: finish it ('git rebase --continue' / 'git cherry-pick --continue') or abort it, then run 'gitsync' again."
            return $false
        }
    }

    $mergeHeadPath = Join-Path -Path $gitDir -ChildPath $script:GitSyncMergeHeadName
    if ($DryRun) {
        if (Test-Path -LiteralPath $mergeHeadPath) {
            Write-Host "[gitsync] Would run: git add . ; git commit --no-edit  (conclude pending merge; stops instead if conflicts remain)"
        }
        return $true
    }

    Remove-GitSyncLocalOnlyFromIndex
    $unmergedOutput = (git diff --name-only --diff-filter=U 2>$null | Out-String)
    if (-not [string]::IsNullOrWhiteSpace($unmergedOutput)) {
        Write-Host "[gitsync] ERROR: unresolved conflicts. Push skipped."
        Write-Host "[gitsync] Conflicted paths:"
        Write-Host $unmergedOutput
        Write-Host "[gitsync] Next step: resolve the conflicts, 'git add <file>', then run 'gitsync' again."
        Write-GitSyncAiPrompt -RepoRoot $RepoRoot -ConflictedPaths $unmergedOutput
        return $false
    }

    if (Test-Path -LiteralPath $mergeHeadPath) {
        Write-Host "[gitsync] Concluding pending merge: git add . ; git commit --no-edit"
        git add .
        if ($LASTEXITCODE -ne 0) { return $false }
        git commit --no-edit
        if ($LASTEXITCODE -ne 0) { return $false }
    }
    return $true
}

# =============================================================================
# Full gitsync run
# =============================================================================

function Invoke-GitSyncRun {
    <#
    .SYNOPSIS
        Full gitsync behavior (idempotent, safe to re-run after any
        interruption): cd repo root, ensure GitHub SSH origin, clear stale
        locks, resume a pending merge, add,
        commit (skipped when nothing changed), pull, push. On a pull
        conflict or failure: stop, print the conflicted paths and the next
        manual step, never push, never auto-resolve, never force. DryRun
        prints every command it would run and makes ZERO calls to git.exe.
        NoPrompt skips the description prompt (see Read-GitSyncDescription).
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $false)] [bool]$DryRun = $false,
        [Parameter(Mandatory = $false)] [string]$Description = "",
        [Parameter(Mandatory = $false)] [bool]$NoPrompt = $false
    )

    if ([string]::IsNullOrWhiteSpace($RepoRoot) -or -not (Test-Path -LiteralPath $RepoRoot)) {
        Write-Host "[gitsync] ERROR: repo root not found: $RepoRoot"
        return $false
    }

    $previousLocation = Get-Location
    try {
        Set-Location -Path $RepoRoot
        Write-Host "[gitsync] Repo root: $RepoRoot"

        $originOk = Invoke-GitSyncEnsureGitHubSshOrigin -RepoRoot $RepoRoot -DryRun $DryRun
        if (-not $originOk) {
            return $false
        }

        if (-not (Clear-GitSyncStaleLocks -RepoRoot $RepoRoot -DryRun $DryRun)) {
            return $false
        }
        if (-not (Resume-GitSyncPendingState -RepoRoot $RepoRoot -DryRun $DryRun)) {
            return $false
        }

        if ($DryRun) {
            $commitMessage = Get-GitSyncCommitMessage -RepoRoot $RepoRoot -Description (ConvertTo-GitSyncDescription -Description $Description)
            Write-Host "[gitsync] Commit message: $commitMessage"
            Write-Host "[gitsync] Would run: git add ."
            Write-Host "[gitsync] Would run: git commit -m `"$commitMessage`"  (skipped automatically when there is nothing to commit)"
            Write-Host "[gitsync] Would run: git pull --no-rebase origin $script:GitSyncTargetBranch"
            Write-Host "[gitsync] Would run: git push origin $script:GitSyncTargetBranch"
            Write-Host "[gitsync] Dry run complete; no git command was executed."
            return $true
        }

        Remove-GitSyncLocalOnlyFromIndex
        Write-Host "[gitsync] Executing: git add ."
        git add .
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[gitsync] ERROR: git add failed."
            return $false
        }

        $stagedOutput = (git diff --cached --name-only | Out-String)
        if ([string]::IsNullOrWhiteSpace($stagedOutput)) {
            Write-Host "[gitsync] Nothing staged; skipping commit."
        } else {
            $commitMessage = Get-GitSyncCommitMessage -RepoRoot $RepoRoot -Description (Read-GitSyncDescription -Description $Description -NoPrompt $NoPrompt)
            Write-Host "[gitsync] Executing: git commit -m `"$commitMessage`""
            git commit -m $commitMessage
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[gitsync] ERROR: git commit failed."
                return $false
            }
        }

        $localOnlyBackup = Backup-GitSyncLocalOnlyFiles -RepoRoot $RepoRoot
        Write-Host "[gitsync] Executing: git pull --no-rebase origin $script:GitSyncTargetBranch"
        git pull --no-rebase origin $script:GitSyncTargetBranch
        Restore-GitSyncLocalOnlyFiles -Backup $localOnlyBackup

        $unmergedOutput = (git diff --name-only --diff-filter=U | Out-String)
        $mergeHeadPath = Join-Path -Path (Get-GitSyncGitDir -RepoRoot $RepoRoot) -ChildPath $script:GitSyncMergeHeadName
        # A merge whose only conflicts were local-only paths is complete once they are untracked.
        if ([string]::IsNullOrWhiteSpace($unmergedOutput) -and (Test-Path -LiteralPath $mergeHeadPath)) {
            Write-Host "[gitsync] Concluding merge (only local-only paths conflicted): git commit --no-edit"
            git commit --no-edit
        }
        if (-not [string]::IsNullOrWhiteSpace($unmergedOutput) -or (Test-Path -LiteralPath $mergeHeadPath)) {
            Write-Host "[gitsync] ERROR: pull produced conflicts. Push skipped."
            Write-Host "[gitsync] Conflicted paths:"
            Write-Host $unmergedOutput
            Write-Host "[gitsync] Next step: resolve the conflicts manually (edit the files, 'git add <file>'), then run 'gitsync' again."
            Write-GitSyncAiPrompt -RepoRoot $RepoRoot -ConflictedPaths $unmergedOutput
            return $false
        }

        Write-Host "[gitsync] Executing: git push origin $script:GitSyncTargetBranch"
        git push origin $script:GitSyncTargetBranch

        $unpushedCount = (git rev-list --count "$script:GitSyncRemoteName/$script:GitSyncTargetBranch..HEAD" | Out-String).Trim()
        if ($unpushedCount -ne "0") {
            Write-Host "[gitsync] ERROR: $unpushedCount local commit(s) not on $script:GitSyncRemoteName/$script:GitSyncTargetBranch; see the git output above, then run 'gitsync' again."
            return $false
        }
        return $true
    } finally {
        Set-Location -Path $previousLocation
    }
}

function Invoke-GitSyncNoticeLaravel {
    <#
    .SYNOPSIS
        Asks the Laravel server to pull, migrate and restart its workers, and waits for the job
        (bounded). Never fails the local gitsync: a failed notice only warns.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $false)] [bool]$DryRun = $false
    )

    $noticeCli = Join-Path -Path $RepoRoot -ChildPath $script:GitSyncSignedCliPath
    if ($DryRun) {
        Write-Host "[gitsync] Would run: node $noticeCli code-sync"
        return
    }
    $noticeNode = Get-Command node -ErrorAction SilentlyContinue
    if (-not $noticeNode) {
        Write-Host "[gitsync] WARNING: node not found; Laravel was not notified (run: node $noticeCli code-sync)"
        return
    }
    Write-Host "[gitsync] Notifying Laravel: node $noticeCli code-sync"
    & $noticeNode.Source $noticeCli code-sync
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[gitsync] WARNING: Laravel code sync did not complete; check: node $noticeCli request GET /api/system/code-sync/status"
    }
}

function Invoke-GitSyncCli {
    <#
    .SYNOPSIS
        CLI entry for `dd.cmd gitsync` / `dd.ps1 gitsync`:
          gitsync [--dry-run] [--notice-laravel] [--skip-notice-laravel] [-m|--message <description>] [description...]
          --dry-run       print every git command, run none
          --notice-laravel       after a successful push, make the Laravel server pull,
                                 migrate and restart its workers (opt-in; waits for the job)
          --skip-notice-laravel  never notify (wins over --notice-laravel; used by the server job)
          -m, --message   commit description, no 3s prompt (non-interactive;
                          the form AI agents use to commit, e.g.
                          `dd.cmd gitsync -m "fix login"`)
          description...  bare words are the description too (also skips
                          the prompt)
        Without a description the staged changes are listed, then a
        GitSyncDescriptionPromptSeconds prompt waits for an optional one.
    #>
    param(
        [Parameter(Mandatory = $false)] [string[]]$Arguments = @()
    )

    $cliDryRun = $false
    $cliNotice = $false
    $cliSkipNotice = $false
    $cliResult = $false
    $cliNoPrompt = $false
    $cliDescriptionWords = @()
    $cliIndex = 0

    while ($cliIndex -lt $Arguments.Count) {
        $cliArg = [string]$Arguments[$cliIndex]
        $cliIndex++
        if ($cliArg -eq "--dry-run") {
            $cliDryRun = $true
        } elseif ($cliArg -eq $script:GitSyncNoticeFlag) {
            $cliNotice = $true
        } elseif ($cliArg -eq $script:GitSyncSkipNoticeFlag) {
            $cliSkipNotice = $true
        } elseif ($cliArg -in @("-m", "--message")) {
            $cliNoPrompt = $true
            if ($cliIndex -lt $Arguments.Count) {
                $cliDescriptionWords += [string]$Arguments[$cliIndex]
                $cliIndex++
            }
        } elseif ($cliArg.StartsWith("--message=")) {
            $cliNoPrompt = $true
            $cliDescriptionWords += $cliArg.Substring("--message=".Length)
        } elseif ($cliArg.StartsWith("-")) {
            Write-Host "[gitsync] Unknown option ignored: $cliArg"
        } else {
            $cliDescriptionWords += $cliArg
        }
    }

    $cliRepoRoot = Get-GitSyncRepoRoot
    $cliResult = Invoke-GitSyncRun -RepoRoot $cliRepoRoot -DryRun $cliDryRun -Description ($cliDescriptionWords -join " ") -NoPrompt $cliNoPrompt
    if ($cliResult -and $cliNotice -and -not $cliSkipNotice) {
        Invoke-GitSyncNoticeLaravel -RepoRoot $cliRepoRoot -DryRun $cliDryRun
    }
    return $cliResult
}
