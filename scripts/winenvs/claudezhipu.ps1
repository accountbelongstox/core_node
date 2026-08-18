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

<#
.SYNOPSIS
    Claude AI (Zhipu AI / GLM) Launch Script - v4

.DESCRIPTION
    Launches Claude Code via Zhipu AI (GLM) Anthropic-compatible endpoint with
    the model forced to glm-5.2 everywhere, and experimental agent teams +
    ultracode force-enabled (like claudeteam).
    API key is read from .secret_keys/.secret_ignore/ZHIPUAI_API_KEY_1 (written
    by the Special Software Environment Variables Manager, dd.sh / dd.cmd).
    Zhipu /api/anthropic is the Anthropic-compatible endpoint for Claude Code
    (NOT /api/paas/v4 which is OpenAI-compatible).
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Variable declarations
$zhipuBaseUrl = ""
$zhipuApiKey = ""
$zhipuModel = "glm-5.2"
$ultraSettingsJson = $null
$ultraSettingsFile = $null
$claudeArgs = $null
$teammateMode = $null
$exitCode = 0
$scriptActualPath = $null
$item = $null
$scriptCurrentPath = $null
$scriptsDirPath = $null
$projectRootPath = $null
$secretDir = $null
$maskedKey = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$claudeLaunchCommonScript = $null
$claudeExecutable = $null
$forceModelChoice = $null
$forceModelEnabled = $false

# Ensure DISABLE_AUTOUPDATER is set for Claude Code
$env:DISABLE_AUTOUPDATER = "1"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"

# Force-enable experimental agent teams (like claudeteam).
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"

# Windows default: run experimental agent teams in-process (like claudeteam).
$teammateMode = 'in-process'

# Ultracode via temp settings FILE (Windows PowerShell 5.1 strips the double
# quotes when handing a JSON literal to a native exe, so `claude --settings
# {"ultracode":true}` arrives as `{ultracode:true}` -> invalid JSON. --settings
# also accepts a file path, which sidesteps all shell quoting).
$ultraSettingsJson = '{"ultracode":true}'
$ultraSettingsFile = Join-Path $env:TEMP "claudezhipu_ultracode_settings.json"
[System.IO.File]::WriteAllText($ultraSettingsFile, $ultraSettingsJson)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Claude AI (Zhipu AI / GLM) - v4 [glm-5.2 + team + ultracode]" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Initialize path variables
$scriptActualPath = $PSCommandPath
$item = Get-Item -LiteralPath $PSCommandPath
if ($item -and $item -is [System.IO.FileInfo] -and $item.LinkType) {
    $scriptActualPath = $item.Target
}
$scriptCurrentPath = Split-Path $scriptActualPath -Parent
if (-not $scriptCurrentPath) {
    $scriptCurrentPath = $PSScriptRoot
    if (-not $scriptCurrentPath) {
        $scriptCurrentPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
}
$scriptsDirPath = Split-Path $scriptCurrentPath -Parent
$projectRootPath = Split-Path $scriptsDirPath -Parent

# Ensure PATH is prepared via WindowsPathFunction (same as claudeteam.ps1).
$shellsWinPath = Join-Path $scriptsDirPath "shells"
$shellsWinPath = Join-Path $shellsWinPath "win"
$winCommonDirPath = Join-Path $shellsWinPath "win_common"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
$claudeLaunchCommonScript = Join-Path $winCommonDirPath "ClaudeLaunchCommon.ps1"
. $windowsPathFunctionScript
Set-CoreNodePaths
. $claudeLaunchCommonScript

# Load environment variables from secret files
$secretDir = Join-Path $projectRootPath ".secret_keys\.secret_ignore"

function Read-SecretFile {
    param([string]$FilePath)
    $value = ""
    if (Test-Path $FilePath) {
        try {
            $bytes = [System.IO.File]::ReadAllBytes($FilePath)
            if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
                $bytes = $bytes[3..($bytes.Length - 1)]
            }
            $content = [System.Text.Encoding]::UTF8.GetString($bytes)
            $lines = $content -split "`r?`n"
            foreach ($line in $lines) {
                $trimmedLine = $line.Trim()
                if ($trimmedLine) {
                    $value = $trimmedLine
                    break
                }
            }
        }
        catch {
            $value = ""
        }
    }
    return $value
}

# Load API key
$zhipuApiKey = Read-SecretFile (Join-Path $secretDir "ZHIPUAI_API_KEY_1")

# Load base URL with fallback to default
$zhipuBaseUrl = Read-SecretFile (Join-Path $secretDir "ZHIPUAI_BASE_URL_1")
if (-not $zhipuBaseUrl) {
    $zhipuBaseUrl = "https://open.bigmodel.cn/api/anthropic"
}

# Set the Claude Code environment variables (gateway always; model slots opt-in below).
$env:ANTHROPIC_BASE_URL = $zhipuBaseUrl
if ($zhipuApiKey) {
    $env:ANTHROPIC_AUTH_TOKEN = $zhipuApiKey
}

# Optional: force glm-5.2 everywhere. Opt-in prompt, default No (like claudeteam).
$forceModelChoice = Read-Host "Force model $zhipuModel everywhere (main + subagents + background)? [y/N]"
$forceModelEnabled = (($forceModelChoice -eq 'y') -or ($forceModelChoice -eq 'Y'))

if ($forceModelEnabled) {
    $env:ANTHROPIC_MODEL = $zhipuModel
    $env:CLAUDE_CODE_SUBAGENT_MODEL = $zhipuModel
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $zhipuModel
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = $zhipuModel
    Write-Host "[NOTE] $zhipuModel forced for main session, subagents and background (Haiku/Sonnet) slots." -ForegroundColor Yellow
}

# Configuration summary
Write-Host "API Endpoint: $env:ANTHROPIC_BASE_URL" -ForegroundColor White
if ($forceModelEnabled) {
    Write-Host "Model: $zhipuModel (forced: main + subagents + background)" -ForegroundColor White
} else {
    Write-Host "Model: off (default N) - using the account default model" -ForegroundColor White
}
Write-Host "Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (force-enabled)" -ForegroundColor White
Write-Host "Ultracode: --settings $ultraSettingsJson (via temp file $ultraSettingsFile)" -ForegroundColor White

if (-not $zhipuApiKey) {
    Write-Host ""
    Write-Host "[ERROR] Zhipu AI API Key not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set up your credentials using dd.sh:" -ForegroundColor Yellow
    Write-Host "  1. Run sudo $projectRootPath/dd.sh" -ForegroundColor Gray
    Write-Host "  2. Navigate to: Special Software Environment Variables" -ForegroundColor Gray
    Write-Host "  3. Select: Zhipu AI (GLM)" -ForegroundColor Gray
    Write-Host "  4. Set your ZHIPUAI_API_KEY" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Alternatively, create the secret file manually:" -ForegroundColor Yellow
    Write-Host "  $secretDir\ZHIPUAI_API_KEY_1" -ForegroundColor Gray
    Write-Host ""
    $null = Read-Host "Press Enter to exit"
    if ((-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {
        Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
    }
    exit 1
}
else {
    Write-Host "API Key: $zhipuApiKey (loaded)" -ForegroundColor White
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Build claude args: ultracode settings always on; teammate-mode in-process;
# skip-permissions (Windows default, like claudeteam); --model only when opted in.
if ($forceModelEnabled) {
    $claudeArgs = @("--model", $zhipuModel, "--settings", $ultraSettingsFile, "--teammate-mode", $teammateMode, "--permission-mode", "bypassPermissions", "--dangerously-skip-permissions")
} else {
    $claudeArgs = @("--settings", $ultraSettingsFile, "--teammate-mode", $teammateMode, "--permission-mode", "bypassPermissions", "--dangerously-skip-permissions")
}

# Launch tool
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Press Enter to start Claude AI (Zhipu AI / GLM) [glm-5.2 + team + ultracode]..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
$null = Read-Host "Press Enter to continue"

$claudeExecutable = Resolve-ClaudeCodeExecutable
if (-not $claudeExecutable) {
    Write-Host ""
    Write-Host "[ERROR] Claude Code executable not found." -ForegroundColor Red
    Write-Host "Install via: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
    Write-Host "Or ensure $env:USERPROFILE\.local\bin\claude.exe exists." -ForegroundColor Yellow
    Write-Host ""
    if ((-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {
        Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
    }
    exit 1
}

Write-Host ""
Write-Host "Executing: $claudeExecutable $($claudeArgs -join ' ')" -ForegroundColor White
Write-Host ""
Write-Host "Environment: ANTHROPIC_BASE_URL='$($env:ANTHROPIC_BASE_URL)'$(if ($forceModelEnabled) { ", ANTHROPIC_MODEL='$zhipuModel'" } else { '' })" -ForegroundColor White
Write-Host ""

& $claudeExecutable @claudeArgs @args
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {
    $exitCode = 0
}

# Remove the temp settings file (claude reads it only at startup).
if ((-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {
    Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
}

exit $exitCode
