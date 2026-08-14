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

$winShellsDir = Split-Path $PSScriptRoot -Parent
$shellsDir = Split-Path $winShellsDir -Parent
$winCommonDir = Join-Path $winShellsDir 'win_common'
$shellsCommonDir = Join-Path $shellsDir 'common'
$globalVarsPath = Join-Path $winCommonDir 'GlobalVars.ps1'
$windowsPathFunctionPath = Join-Path $winCommonDir 'WindowsPathFunction.ps1'
$harnessSettingsScriptPath = Join-Path $shellsCommonDir 'pi_harness_settings.js'
$stepNumber = 41
$scriptIndex = "[Step $stepNumber]"
$piPackage = '@earendil-works/pi-coding-agent'
$kimiCodeHome = if ($env:KIMI_CODE_HOME) { $env:KIMI_CODE_HOME } else { Join-Path $env:USERPROFILE '.kimi-code' }
$kimiSkillsPath = Join-Path $kimiCodeHome 'skills'
$ompInstallDir = $null
$ompExePath = $null
$ompReleaseApi = 'https://api.github.com/repos/can1357/oh-my-pi/releases/latest'
$ompAssetName = 'omp-windows-x64.exe'
$bunInstallerUrl = 'https://bun.com/install.ps1'
$bunInstallerPath = Join-Path $env:TEMP 'bun-install.ps1'
$nodeExePath = $null
$pnpmExePath = $null
$bunInstallDir = $null
$bunBinDir = $null
$bunExePath = $null
$piCommand = $null
$ompCommand = $null
$resolvedCommand = $null
$commandInfo = $null
$candidatePath = $null
$piCandidates = @()
$release = $null
$releaseTag = $null
$downloadUrl = $null
$previousBunInstall = $null
$previousBunInstallExists = $false

. $globalVarsPath
. $windowsPathFunctionPath -SkipInit

$ompInstallDir = Join-Path $Global:LANG_COMPILER_DIR 'omp'
$ompExePath = Join-Path $ompInstallDir 'omp.exe'
$nodeExePath = $Global:NODE_EXE_PATH
$pnpmExePath = $Global:PNPM_EXE_PATH
$bunInstallDir = $Global:BUN_INSTALL_DIR
$bunBinDir = $Global:BUN_BIN_DIR
$bunExePath = $Global:BUN_EXE_PATH
$piCandidates = @(
    (Join-Path $Global:PNPM_GLOBAL_BIN_DIR 'pi.cmd'),
    (Join-Path $Global:NODE_DIR 'pi.cmd'),
    (Join-Path $Global:NODE_DIR 'pi.exe')
)

function Find-InstalledCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string[]]$CandidatePaths = @()
    )

    $script:resolvedCommand = $null
    $script:commandInfo = Get-Command $Name -ErrorAction SilentlyContinue
    if ($script:commandInfo) {
        $script:resolvedCommand = $script:commandInfo.Source
    }
    foreach ($script:candidatePath in $CandidatePaths) {
        if (-not $script:resolvedCommand -and $script:candidatePath -and (Test-Path -LiteralPath $script:candidatePath -PathType Leaf)) {
            $script:resolvedCommand = (Resolve-Path -LiteralPath $script:candidatePath).Path
        }
    }
}

function Install-BunPrerequisite {
    Find-InstalledCommand -Name 'bun' -CandidatePaths @($bunExePath)
    if ($resolvedCommand) {
        if (Test-Path -LiteralPath $bunBinDir -PathType Container) {
            Add-Path -newPath $bunBinDir
        }
        Write-Host "$scriptIndex Bun is already installed: $resolvedCommand" -ForegroundColor Green
    } else {
        Write-Host "$scriptIndex Installing Bun for the OMP JavaScript worker..." -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $bunInstallDir -Force | Out-Null
        Invoke-WebRequest -Uri $bunInstallerUrl -OutFile $bunInstallerPath -UseBasicParsing
        $script:previousBunInstall = $env:BUN_INSTALL
        $script:previousBunInstallExists = Test-Path -LiteralPath 'Env:BUN_INSTALL'
        try {
            $env:BUN_INSTALL = $bunInstallDir
            & $bunInstallerPath -NoPathUpdate -NoCompletions
        } finally {
            if ($script:previousBunInstallExists) {
                $env:BUN_INSTALL = $script:previousBunInstall
            } else {
                Remove-Item -LiteralPath 'Env:BUN_INSTALL' -ErrorAction SilentlyContinue
            }
        }
        Find-InstalledCommand -Name 'bun' -CandidatePaths @($bunExePath)
        if ($resolvedCommand) {
            Add-Path -newPath $bunBinDir
            Write-Host "$scriptIndex Bun installed: $resolvedCommand" -ForegroundColor Green
        } else {
            Write-Host "$scriptIndex Bun binary is still missing; installation will retry next run." -ForegroundColor Yellow
        }
    }
}

function Install-PiHarness {
    Find-InstalledCommand -Name 'pi' -CandidatePaths $piCandidates
    $script:piCommand = $resolvedCommand
    if ($piCommand) {
        Add-Path -newPath $Global:PNPM_GLOBAL_BIN_DIR
        Write-Host "$scriptIndex Pi is already installed: $piCommand" -ForegroundColor Green
    } elseif (-not (Test-Path -LiteralPath $pnpmExePath -PathType Leaf)) {
        Write-Host "$scriptIndex pnpm is unavailable. Run Step4_InstallNodeJS first." -ForegroundColor Yellow
    } else {
        Write-Host "$scriptIndex Installing Pi with pnpm from the official package..." -ForegroundColor Cyan
        & $pnpmExePath add --global --ignore-scripts $piPackage
        Find-InstalledCommand -Name 'pi' -CandidatePaths $piCandidates
        $script:piCommand = $resolvedCommand
        if ($piCommand) {
            Add-Path -newPath $Global:PNPM_GLOBAL_BIN_DIR
            Write-Host "$scriptIndex Pi installed: $piCommand" -ForegroundColor Green
        } else {
            Write-Host "$scriptIndex Pi binary is still missing; installation will retry next run." -ForegroundColor Yellow
        }
    }
}

function Install-OmpHarness {
    Find-InstalledCommand -Name 'omp' -CandidatePaths @($ompExePath)
    $script:ompCommand = $resolvedCommand
    if ($ompCommand) {
        Add-Path -newPath $ompInstallDir
        Write-Host "$scriptIndex OMP is already installed: $ompCommand" -ForegroundColor Green
    } else {
        Write-Host "$scriptIndex Installing OMP from the official GitHub release..." -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $ompInstallDir -Force | Out-Null
        $script:release = Invoke-RestMethod -Uri $ompReleaseApi -UseBasicParsing
        $script:releaseTag = $release.tag_name
        if ($releaseTag) {
            $script:downloadUrl = [string]::Format(
                'https://github.com/can1357/oh-my-pi/releases/download/{0}/{1}',
                $releaseTag,
                $ompAssetName
            )
            Invoke-WebRequest -Uri $downloadUrl -OutFile $ompExePath -UseBasicParsing
        }
        Find-InstalledCommand -Name 'omp' -CandidatePaths @($ompExePath)
        $script:ompCommand = $resolvedCommand
        if ($ompCommand) {
            Add-Path -newPath $ompInstallDir
            Write-Host "$scriptIndex OMP installed: $ompCommand" -ForegroundColor Green
        } else {
            Write-Host "$scriptIndex OMP binary is still missing; installation will retry next run." -ForegroundColor Yellow
        }
    }
}

function Merge-OmpSettings {
    if ($ompCommand -and (Test-Path -LiteralPath $nodeExePath -PathType Leaf) -and (Test-Path -LiteralPath $kimiSkillsPath -PathType Container)) {
        & $nodeExePath $harnessSettingsScriptPath omp $ompCommand $kimiSkillsPath
        Write-Host "$scriptIndex OMP Kimi skill compatibility settings merged." -ForegroundColor Green
    }
}

Write-Host "$scriptIndex Installing Pi and OMP coding harnesses..." -ForegroundColor Cyan
try {
    Install-BunPrerequisite
} catch {
    Write-Host "$scriptIndex Bun installation reported an error and will retry next run: $($_.Exception.Message)" -ForegroundColor Yellow
}
try {
    Install-PiHarness
} catch {
    Write-Host "$scriptIndex Pi installation reported an error and will retry next run: $($_.Exception.Message)" -ForegroundColor Yellow
}
try {
    Install-OmpHarness
} catch {
    Write-Host "$scriptIndex OMP installation reported an error and will retry next run: $($_.Exception.Message)" -ForegroundColor Yellow
}
try {
    Merge-OmpSettings
} catch {
    Write-Host "$scriptIndex OMP settings reported an error and will retry next run: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host "$scriptIndex OMP automatically discovers Claude, Codex, and AGENTS.md providers." -ForegroundColor Green
Write-Host "$scriptIndex Pi harness installation step completed." -ForegroundColor Green
