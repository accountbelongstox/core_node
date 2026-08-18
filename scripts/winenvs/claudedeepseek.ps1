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
    Claude AI (DeepSeek) Launch Script - v4

.DESCRIPTION
    Launches Claude Code via the DeepSeek Anthropic-compatible endpoint with the
    model forced to deepseek-v4-pro everywhere, experimental agent teams
    force-enabled, and ultracode opt-in (default Yes).
    API key is read from .secret_keys/.secret_ignore/DEEPSEEK_API_KEY_1 (written
    by the Special Software Environment Variables Manager, dd.sh / dd.cmd).

    DeepSeek serves BOTH API formats:
      * OpenAI:     https://api.deepseek.com            (/chat/completions)
      * Anthropic:  https://api.deepseek.com/anthropic  (/v1/messages)  <-- used here
    Claude Code requires the Anthropic endpoint, so DEEPSEEK_BASE_URL defaults
    to https://api.deepseek.com/anthropic (NOT the OpenAI base URL).

    deepseek-v4-pro is the flagship model (claude-opus* maps to it). The legacy
    deepseek-chat / deepseek-reasoner names are deprecated on 2026/07/24.
    Source: https://api-docs.deepseek.com/guides/anthropic_api
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Variable declarations
$deepseekBaseUrl = ""
$deepseekApiKey = ""
$deepseekModel = "deepseek-v4-pro"
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
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$claudeLaunchCommonScript = $null
$claudeExecutable = $null
$ultraChoice = $null
$enableUltra = $false

# Ensure DISABLE_AUTOUPDATER is set for Claude Code
$env:DISABLE_AUTOUPDATER = "1"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"

# Force-enable experimental agent teams (like claudeteam).
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"

# Windows default: run experimental agent teams in-process (like claudeteam).
$teammateMode = 'in-process'

# Ultracode via temp settings FILE when opted in (Windows PowerShell 5.1 strips
# double quotes when handing a JSON literal to a native exe).
$ultraSettingsJson = '{"ultracode":true}'
$ultraSettingsFile = Join-Path $env:TEMP "claudedeepseek_ultracode_settings.json"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Claude AI (DeepSeek) - v4 [deepseek-v4-pro + team + opt-in ultracode]" -ForegroundColor Yellow
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
$deepseekApiKey = Read-SecretFile (Join-Path $secretDir "DEEPSEEK_API_KEY_1")

# Load base URL with fallback to the Anthropic-compatible endpoint.
# NOTE: Claude Code needs the /anthropic endpoint (/v1/messages), NOT the OpenAI
# base URL https://api.deepseek.com (/chat/completions).
$deepseekBaseUrl = Read-SecretFile (Join-Path $secretDir "DEEPSEEK_BASE_URL_1")
if (-not $deepseekBaseUrl) {
    $deepseekBaseUrl = "https://api.deepseek.com/anthropic"
}

# Set the Claude Code environment variables (gateway + deepseek-v4-pro forced everywhere).
$env:ANTHROPIC_BASE_URL = $deepseekBaseUrl
if ($deepseekApiKey) {
    $env:ANTHROPIC_AUTH_TOKEN = $deepseekApiKey
}
$env:ANTHROPIC_MODEL = $deepseekModel
# Force deepseek-v4-pro into every slot so agent-teams / subagents / background
# tasks also run through the DeepSeek Anthropic gateway. DeepSeek otherwise maps
# claude-opus* -> deepseek-v4-pro and claude-haiku*/claude-sonnet* -> deepseek-v4-flash.
$env:CLAUDE_CODE_SUBAGENT_MODEL = $deepseekModel
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $deepseekModel
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = $deepseekModel

# Configuration summary
Write-Host "API Endpoint: $env:ANTHROPIC_BASE_URL" -ForegroundColor White
Write-Host "Model: $deepseekModel (forced: main + subagents + background)" -ForegroundColor White
Write-Host "Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (force-enabled)" -ForegroundColor White

if (-not $deepseekApiKey) {
    Write-Host ""
    Write-Host "[ERROR] DeepSeek API Key not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set up your credentials using dd.cmd:" -ForegroundColor Yellow
    Write-Host "  1. Run $projectRootPath\dd.cmd" -ForegroundColor Gray
    Write-Host "  2. Navigate to: Special Software Environment Variables" -ForegroundColor Gray
    Write-Host "  3. Select: DeepSeek" -ForegroundColor Gray
    Write-Host "  4. Set your DEEPSEEK_API_KEY" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Alternatively, create the secret file manually:" -ForegroundColor Yellow
    Write-Host "  $secretDir\DEEPSEEK_API_KEY_1" -ForegroundColor Gray
    Write-Host ""
    $null = Read-Host "Press Enter to exit"
    if ($enableUltra -and (-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {
        Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
    }
    exit 1
}
else {
    Write-Host "API Key: $deepseekApiKey (loaded)" -ForegroundColor White
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Build claude args: deepseek-v4-pro always on; teammate-mode in-process;
# skip-permissions (Windows default, like claudeteam); ultracode opt-in.
$claudeArgs = @("--model", $deepseekModel, "--teammate-mode", $teammateMode, "--permission-mode", "bypassPermissions", "--dangerously-skip-permissions")

# Ultracode: opt-in prompt (default Yes).
$ultraChoice = Read-Host "Enable ultracode? [Y/n]"
if ($ultraChoice -ne 'n' -and $ultraChoice -ne 'N') {
    $enableUltra = $true
    [System.IO.File]::WriteAllText($ultraSettingsFile, $ultraSettingsJson)
    $claudeArgs += @("--settings", $ultraSettingsFile)
}

if ($enableUltra) {
    Write-Host "Ultracode: enabled (--settings via $ultraSettingsFile)" -ForegroundColor White
} else {
    Write-Host "Ultracode: off (opted out)" -ForegroundColor White
}

# Launch tool (info already shown above; start Claude directly).
$claudeExecutable = Resolve-ClaudeCodeExecutable
if (-not $claudeExecutable) {
    Write-Host ""
    Write-Host "[ERROR] Claude Code executable not found." -ForegroundColor Red
    Write-Host "Install via: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
    Write-Host "Or ensure $env:USERPROFILE\.local\bin\claude.exe exists." -ForegroundColor Yellow
    Write-Host ""
    if ($enableUltra -and (-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {
        Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
    }
    exit 1
}

Write-Host ""
Write-Host "Executing: $claudeExecutable $($claudeArgs -join ' ')" -ForegroundColor White
Write-Host ""
Write-Host "Environment: ANTHROPIC_BASE_URL='$($env:ANTHROPIC_BASE_URL)', ANTHROPIC_MODEL='$deepseekModel'" -ForegroundColor White
Write-Host ""

& $claudeExecutable @claudeArgs @args
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {
    $exitCode = 0
}

# Remove the temp settings file (claude reads it only at startup).
if ($enableUltra -and (-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {
    Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
}

exit $exitCode
