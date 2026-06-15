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
    Droid MCP Servers Configuration (PowerShell version)
.DESCRIPTION
    Configures MCP servers for Droid (Factory AI) by updating mcp.json file.
    Uses _json_sync_helper.py (stdlib only) for JSON merge.
    PS5.1 compatible. All output is real-time.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:CONFIG_PROVIDER_PS1 = Join-Path $script:PS_CURRENT_DIR "mcp_config_provider.ps1"
$script:JSON_HELPER_PY = Join-Path $script:PS_CURRENT_DIR "_json_sync_helper.py"
$script:DROID_CONFIG_PATH = $null
$script:PYTHON_CMD = $null
#endregion

. $script:CONFIG_PROVIDER_PS1

$script:PYTHON_CMD = Get-MCPPythonExe
if (-not $script:PYTHON_CMD) {
    Write-Host "[ERROR] python not found. Required for JSON file operations."
    return
}

function Find-DroidSettingsPath {
    $homeDir = [System.Environment]::GetFolderPath("UserProfile")
    $possiblePaths = @(
        (Join-Path $homeDir ".factory\mcp.json"),
        (Join-Path $homeDir ".droid\mcp.json"),
        (Join-Path $homeDir ".config\droid\mcp.json")
    )
    foreach ($configPath in $possiblePaths) {
        $parentDir = Split-Path $configPath -Parent
        if (Test-Path -LiteralPath $parentDir) { return $configPath }
    }
    $defaultPath = $possiblePaths[0]
    New-Item -ItemType Directory -Path (Split-Path $defaultPath -Parent) -Force | Out-Null
    return $defaultPath
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
Write-Host "[DROID] Configuring MCP servers via mcp.json"
Write-Host "================================================================================"
Write-Host ""
Write-Host "[INFO] Using Python: $script:PYTHON_CMD"

$script:DROID_CONFIG_PATH = Find-DroidSettingsPath
Write-Host "[INFO] Droid MCP file: $script:DROID_CONFIG_PATH"
Write-Host ""

$configs = Get-AllMCPConfigs -Target "droid"
if ($configs.Count -eq 0) {
    Write-Host "[WARNING] No MCP servers to configure"
    return
}

$entries = ConvertTo-EntryList -Configs $configs
$tempFile = Join-Path $env:TEMP "mcp_droid_entries.json"
$entries | ConvertTo-Json -Depth 10 | Out-File -FilePath $tempFile -Encoding utf8

& $script:PYTHON_CMD -u $script:JSON_HELPER_PY $script:DROID_CONFIG_PATH $tempFile "droid"

Remove-Item -LiteralPath $tempFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "================================================================================"
Write-Host "[SUMMARY] Droid MCP Configuration Complete"
Write-Host "================================================================================"
#endregion
