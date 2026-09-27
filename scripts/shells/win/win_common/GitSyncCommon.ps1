<#
.SYNOPSIS
    Shared "syncgit" behavior (D20): ensure origin is the GitHub SSH remote
    (never Gitee), commit any pending local changes with a generated
    message, then pull and push the target branch.

.DESCRIPTION
    One implementation, reused by:
      - scripts/winenvs/syncgit.ps1      (the "syncgit" quick command)
      - scripts/shells/win/dd.ps1        ("syncgit" argument, dd.cmd syncgit)
      - scripts/git/gitput_unified.ps1   (origin-URL read/write only, its own
                                           remote-rotation flow is unchanged)

    Linux counterpart: scripts/shells/linux/common/git_sync_common.sh.

    Self-contained on purpose: does not dot-source CommonFunc.ps1 /
    GlobalVars.ps1, so dot-sourcing this file has no side effects (no
    StrictMode leak into the caller's scope, no global-var-store touch) and
    it works before any other core_node script has loaded.

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

# =============================================================================
# Path resolution
# =============================================================================

function Get-GitSyncRepoRoot {
    <#
    .SYNOPSIS
        Resolves the repo root from this script's own location (never a
        hardcoded path): this file lives at
        <repo>\scripts\shells\win\win_common\GitSyncCommon.ps1, so walking up
        four levels reaches <repo>. Falls back to `git rev-parse
        --show-toplevel` from this file's own directory if that walk does
        not land on a directory that has dd.cmd.
    #>
    param()

    $winCommonDir = $script:GitSyncCommonScriptDir
    $winDir = Split-Path -Path $winCommonDir -Parent
    $shellsDir = Split-Path -Path $winDir -Parent
    $scriptsDir = Split-Path -Path $shellsDir -Parent
    $repoRootCandidate = Split-Path -Path $scriptsDir -Parent

    $ddCmdCandidate = Join-Path -Path $repoRootCandidate -ChildPath "dd.cmd"
    if (Test-Path -LiteralPath $ddCmdCandidate) {
        return $repoRootCandidate
    }

    $previousLocation = Get-Location
    try {
        Set-Location -Path $winCommonDir
        $topLevel = (git rev-parse --show-toplevel 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($topLevel)) {
            $topLevelPath = (Resolve-Path -Path $topLevel.Trim()).Path
            $ddCmdFromTop = Join-Path -Path $topLevelPath -ChildPath "dd.cmd"
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

function Get-GitSyncGitHubSshUrl {
    <#
    .SYNOPSIS
        Reads the "github=" SSH URL from scripts/git/git_remotes.conf -- the
        single gitunified remote definition, also read by
        gitput_unified_modules/config.py's load_remote_configs() and by
        gitput_unified.ps1. Returns $null when the file or the key is
        missing. No regex: a plain key/value split on the first "=".
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot
    )

    $confPath = Get-GitSyncRemotesConfPath -RepoRoot $RepoRoot
    if (-not (Test-Path -LiteralPath $confPath)) {
        return $null
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
        if ($confKey -eq $script:GitSyncGitHubConfKey) {
            return $confValue
        }
    }

    return $null
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

    $currentUrl = (git remote get-url $RemoteName 2>$null)
    if ($LASTEXITCODE -ne 0) {
        $currentUrl = $null
    }

    if ([string]::IsNullOrEmpty($currentUrl)) {
        Write-Host "[syncgit] Executing: git remote add $RemoteName $TargetUrl"
        git remote add $RemoteName $TargetUrl
    } else {
        Write-Host "[syncgit] Executing: git remote set-url $RemoteName $TargetUrl"
        git remote set-url $RemoteName $TargetUrl
    }
}

function Set-GitSyncRemoteIfDifferent {
    <#
    .SYNOPSIS
        Idempotent, finest-grain remote set: reads the current URL with
        `git remote get-url`, and calls Set-GitSyncRemoteUrl only when it
        differs. DryRun makes NO git.exe call at all and only prints the
        command that would run.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RemoteName,
        [Parameter(Mandatory = $true)] [string]$TargetUrl,
        [Parameter(Mandatory = $false)] [bool]$DryRun = $false
    )

    if ($DryRun) {
        Write-Host "[syncgit] Would ensure: git remote set-url $RemoteName $TargetUrl (git remote add $RemoteName $TargetUrl if $RemoteName does not exist yet; skipped entirely when already correct)"
        return
    }

    $currentUrl = (git remote get-url $RemoteName 2>$null)
    if ($LASTEXITCODE -ne 0) {
        $currentUrl = $null
    }

    if ($currentUrl -eq $TargetUrl) {
        Write-Host "[syncgit] $RemoteName already set to: $TargetUrl (no change needed)"
        return
    }

    Set-GitSyncRemoteUrl -RemoteName $RemoteName -TargetUrl $TargetUrl
}

function Invoke-GitSyncEnsureGitHubSshOrigin {
    <#
    .SYNOPSIS
        Ensures $RemoteName (default "origin") is the GitHub SSH URL from
        git_remotes.conf, never Gitee. Reused by syncgit (this file) and by
        gitput_unified.ps1's push flow, so there is one behavior for the
        "origin" step in both entry points.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $false)] [bool]$DryRun = $false
    )

    $githubUrl = Get-GitSyncGitHubSshUrl -RepoRoot $RepoRoot
    if ([string]::IsNullOrWhiteSpace($githubUrl)) {
        $confPath = Get-GitSyncRemotesConfPath -RepoRoot $RepoRoot
        Write-Host "[syncgit] ERROR: no '$($script:GitSyncGitHubConfKey)=' SSH entry in $confPath"
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
        Write-Host "[syncgit] WARNING: failed to read version from $packageJsonPath : $($_.Exception.Message)"
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

function Get-GitSyncCommitMessage {
    <#
    .SYNOPSIS
        "<systemname><version>up<timestamp>", e.g. win1.0.0up20260927-171530.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot
    )

    $systemName = Get-GitSyncSystemName
    $version = Get-GitSyncProjectVersion -RepoRoot $RepoRoot
    $timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
    return ("{0}{1}up{2}" -f $systemName, $version, $timestamp)
}

# =============================================================================
# Full syncgit run
# =============================================================================

function Invoke-GitSyncRun {
    <#
    .SYNOPSIS
        Full syncgit behavior: cd repo root, ensure GitHub SSH origin, add,
        commit (skipped when nothing changed), pull, push. On a pull
        conflict or failure: stop, print the conflicted paths and the next
        manual step, never push, never auto-resolve, never force. DryRun
        prints every command it would run and makes ZERO calls to git.exe.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $false)] [bool]$DryRun = $false
    )

    if ([string]::IsNullOrWhiteSpace($RepoRoot) -or -not (Test-Path -LiteralPath $RepoRoot)) {
        Write-Host "[syncgit] ERROR: repo root not found: $RepoRoot"
        return $false
    }

    $previousLocation = Get-Location
    try {
        Set-Location -Path $RepoRoot
        Write-Host "[syncgit] Repo root: $RepoRoot"

        $originOk = Invoke-GitSyncEnsureGitHubSshOrigin -RepoRoot $RepoRoot -DryRun $DryRun
        if (-not $originOk) {
            return $false
        }

        $commitMessage = Get-GitSyncCommitMessage -RepoRoot $RepoRoot
        Write-Host "[syncgit] Commit message: $commitMessage"

        if ($DryRun) {
            Write-Host "[syncgit] Would run: git add ."
            Write-Host "[syncgit] Would run: git commit -m `"$commitMessage`"  (skipped automatically when there is nothing to commit)"
            Write-Host "[syncgit] Would run: git pull origin $script:GitSyncTargetBranch"
            Write-Host "[syncgit] Would run: git push origin $script:GitSyncTargetBranch"
            Write-Host "[syncgit] Dry run complete; no git command was executed."
            return $true
        }

        Write-Host "[syncgit] Executing: git add ."
        git add .

        $stagedOutput = (git diff --cached --name-only | Out-String)
        if ([string]::IsNullOrWhiteSpace($stagedOutput)) {
            Write-Host "[syncgit] Nothing staged; skipping commit."
        } else {
            Write-Host "[syncgit] Executing: git commit -m `"$commitMessage`""
            git commit -m $commitMessage
        }

        Write-Host "[syncgit] Executing: git pull origin $script:GitSyncTargetBranch"
        $pullOutput = (git pull origin $script:GitSyncTargetBranch 2>&1 | Out-String)
        $pullExitCode = $LASTEXITCODE
        Write-Host $pullOutput

        if ($pullExitCode -ne 0 -or $pullOutput.Contains("CONFLICT") -or $pullOutput.Contains("Automatic merge failed")) {
            Write-Host "[syncgit] ERROR: pull failed or produced conflicts. Push skipped."
            Write-Host "[syncgit] Conflicted paths:"
            git diff --name-only --diff-filter=U
            Write-Host "[syncgit] Next step: resolve the conflicts manually (edit the files, 'git add <file>', 'git commit'), then run 'syncgit' again."
            return $false
        }

        Write-Host "[syncgit] Executing: git push origin $script:GitSyncTargetBranch"
        git push origin $script:GitSyncTargetBranch
        return $true
    } finally {
        Set-Location -Path $previousLocation
    }
}
