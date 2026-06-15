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
    Claude MCP Servers Configuration (PowerShell version)
.DESCRIPTION
    Configures user-scope MCP servers for Claude Code by writing the "mcpServers"
    section of ~/.claude.json via _json_sync_helper.py (stdlib only, preserves all
    other keys in the file). This replaces the flag-based 'claude mcp add' CLI:
    on Windows, passing -H / -e / -- through the claude shim mangled the args so
    http (headers) and stdio (env + command) servers silently failed to persist,
    while only the bare http server (chrome) survived. Writing the JSON directly
    is the documented user-scope store and avoids all shell-quoting fragility.
    All output is real-time.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:CONFIG_PROVIDER_PS1 = Join-Path $script:PS_CURRENT_DIR "mcp_config_provider.ps1"
$script:JSON_HELPER_PY = Join-Path $script:PS_CURRENT_DIR "_json_sync_helper.py"
$script:CLAUDE_CONFIG_PATH = $null
$script:PYTHON_CMD = $null
#endregion

. $script:CONFIG_PROVIDER_PS1

$script:PYTHON_CMD = Get-MCPPythonExe
if (-not $script:PYTHON_CMD) {
    Write-Host "[ERROR] python not found. Required for JSON file operations."
    return
}

function Find-ClaudeConfigPath {
    $homeDir = [System.Environment]::GetFolderPath("UserProfile")
    return (Join-Path $homeDir ".claude.json")
}

function ConvertTo-EntryList {
    param([array]$Configs)
    $entries = @()
    foreach ($config in $Configs) {
        $entry = @{ name = $config.Name; transport = $config.TransportType }
        if ($config.TransportType -eq "http") {
            $entry["url"] = $config.Url
            if ($config.Headers.Count -gt 0) { $entry["headers"] = $config.Headers }
        } else {
            $entry["command"] = $config.Command
            $entry["args"] = @($config.CmdArgs)
            if ($config.Env.Count -gt 0) { $entry["env"] = $config.Env }
        }
        $entries += $entry
    }
    return $entries
}

#region Main Logic
Write-Host "================================================================================"
Write-Host "[CLAUDE] Configuring MCP servers via ~/.claude.json (user scope)"
Write-Host "================================================================================"
Write-Host ""
Write-Host "[INFO] Using Python: $script:PYTHON_CMD"

# Keep CLAUDE_CODE_GIT_BASH_PATH set so any later 'claude' invocation works on Windows.
Set-ClaudeGitBashEnv

$script:CLAUDE_CONFIG_PATH = Find-ClaudeConfigPath
Write-Host "[INFO] Claude config file: $script:CLAUDE_CONFIG_PATH"
Write-Host ""

$configs = Get-AllMCPConfigs -Target "claude"
if ($configs.Count -eq 0) {
    Write-Host "[WARNING] No MCP servers to configure"
    return
}

$entries = ConvertTo-EntryList -Configs $configs
$tempFile = Join-Path $env:TEMP "mcp_claude_entries.json"
$entries | ConvertTo-Json -Depth 10 | Out-File -FilePath $tempFile -Encoding utf8

& $script:PYTHON_CMD -u $script:JSON_HELPER_PY $script:CLAUDE_CONFIG_PATH $tempFile "claude"

Remove-Item -LiteralPath $tempFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "[VERIFY] claude mcp list (best-effort; requires claude CLI on PATH)"
claude mcp list
Write-Host ""
Write-Host "================================================================================"
Write-Host "[SUMMARY] Claude MCP Configuration Complete (user scope: $script:CLAUDE_CONFIG_PATH)"
Write-Host "================================================================================"
#endregion
