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
    Codex MCP Servers Configuration (PowerShell version)
.DESCRIPTION
    Configures MCP servers for Codex using 'codex mcp add' CLI commands.
    HTTP uses --url flag. All commands execute directly with real-time output.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:CONFIG_PROVIDER_PS1 = Join-Path $script:PS_CURRENT_DIR "mcp_config_provider.ps1"
#endregion

#region Load Config Provider
. $script:CONFIG_PROVIDER_PS1
#endregion

#region Main Logic
Write-Host "================================================================================"
Write-Host "[CODEX] Configuring MCP servers using 'codex mcp add' commands"
Write-Host "================================================================================"
Write-Host ""

Write-Host "[INFO] Checking Codex CLI availability..."
codex --version
Write-Host ""

$configs = Get-AllMCPConfigs -Target "codex"
if ($configs.Count -eq 0) {
    Write-Host "[WARNING] No MCP servers to configure"
    return
}

Write-Host "================================================================================"
Write-Host ""

$idx = 0
foreach ($config in $configs) {
    $idx++
    $name = $config.Name
    $transport = $config.TransportType
    Write-Host "[$idx/$($configs.Count)] Executing: $name ($transport)"

    if ($transport -eq "http") {
        $fullArgs = @("mcp", "add", $name, "--url", $config.Url)
        Write-Host "[CMD] codex $($fullArgs -join ' ')"
        & codex $fullArgs
    }
    else {
        $fullArgs = @("mcp", "add", $name)
        foreach ($eKey in $config.Env.Keys) {
            $eVal = $config.Env[$eKey]
            $fullArgs += "--env"
            $fullArgs += "${eKey}=${eVal}"
        }
        $fullArgs += "--"
        $fullArgs += $config.Command
        foreach ($a in $config.CmdArgs) {
            $fullArgs += $a
        }
        Write-Host "[CMD] codex $($fullArgs -join ' ')"
        & codex $fullArgs
    }
    Write-Host ""

    Write-Host "[VERIFY] codex mcp list"
    codex mcp list
    Write-Host ""
}

Write-Host "================================================================================"
Write-Host "[SUMMARY] Codex MCP Configuration Complete"
Write-Host "================================================================================"
#endregion
