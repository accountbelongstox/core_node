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

#region Codex Config Helpers
# Per the official Codex docs, `codex mcp add` only supports stdio servers; remote
# HTTP/streamable-HTTP servers have NO CLI command and must be written directly to
# ~/.codex/config.toml as [mcp_servers.<Name>] with `url` (+ optional `http_headers`).
# The functions below own the config.toml editing for HTTP servers.
$script:CODEX_CONFIG_PATH = Join-Path $env:USERPROFILE ".codex\config.toml"

function Initialize-CodexConfig {
    $parentDir = Split-Path $script:CODEX_CONFIG_PATH -Parent
    if (-not (Test-Path -LiteralPath $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $script:CODEX_CONFIG_PATH)) {
        Set-Content -LiteralPath $script:CODEX_CONFIG_PATH -Value @() -Encoding UTF8
    }
}

function Remove-CodexServerSection {
    # Strip an existing [mcp_servers.<Name>] table and ALL of its subtables
    # ([mcp_servers.<Name>.http_headers], etc.) so re-runs are idempotent.
    param(
        [Parameter(Mandatory=$true)] [string]$Name
    )
    if (-not (Test-Path -LiteralPath $script:CODEX_CONFIG_PATH)) { return }
    $lines = @(Get-Content -LiteralPath $script:CODEX_CONFIG_PATH -Encoding UTF8)
    $kept = New-Object System.Collections.Generic.List[string]
    $base = "[mcp_servers.$Name]"
    $subPrefix = "[mcp_servers.$Name."
    $skipping = $false
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed -eq $base -or $trimmed.StartsWith($subPrefix)) {
            $skipping = $true
            continue
        }
        if ($skipping) {
            if ($trimmed.StartsWith("[")) {
                $skipping = $false   # a different table starts; keep it (fall through)
            } else {
                continue              # still inside our table body; drop the line
            }
        }
        $kept.Add($line)
    }
    Set-Content -LiteralPath $script:CODEX_CONFIG_PATH -Value $kept -Encoding UTF8
}

function Set-CodexHttpServer {
    # Write a remote HTTP server as [mcp_servers.<Name>] url = "..." plus an
    # [mcp_servers.<Name>.http_headers] table for any custom headers.
    param(
        [Parameter(Mandatory=$true)] [string]$Name,
        [Parameter(Mandatory=$true)] [string]$Url,
        [Parameter()] [hashtable]$Headers = @{}
    )
    Initialize-CodexConfig
    Remove-CodexServerSection -Name $Name
    $urlEsc = ($Url -replace '\\', '\\') -replace '"', '\"'
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($line in @(Get-Content -LiteralPath $script:CODEX_CONFIG_PATH -Encoding UTF8)) {
        $out.Add($line)
    }
    $out.Add("")
    $out.Add("[mcp_servers.$Name]")
    $out.Add("url = `"$urlEsc`"")
    if ($Headers -and $Headers.Count -gt 0) {
        $out.Add("")
        $out.Add("[mcp_servers.$Name.http_headers]")
        foreach ($hKey in $Headers.Keys) {
            $hVal = ($Headers[$hKey] -replace '\\', '\\') -replace '"', '\"'
            $out.Add("$hKey = `"$hVal`"")
        }
    }
    Set-Content -LiteralPath $script:CODEX_CONFIG_PATH -Value $out -Encoding UTF8
    Write-Host "[OK] Wrote [mcp_servers.$Name] (url + http_headers) to codex config.toml"
}

function Format-TomlString {
    # Escape a value for a TOML basic (double-quoted) string: backslashes first,
    # then double-quotes. Critical for Windows paths (D:\...\python.exe).
    param([string]$Value)
    return ($Value -replace '\\', '\\') -replace '"', '\"'
}

function Set-CodexStdioServer {
    # Write a local stdio server as [mcp_servers.<Name>] command/args (+ an
    # [mcp_servers.<Name>.env] table). `codex mcp add` is stdio-capable but
    # requires a TTY; the installer pipes stdout ("stdout is not a terminal"),
    # so we write config.toml directly — same approach as the HTTP path, and
    # idempotent because Remove-CodexServerSection clears any prior table first.
    param(
        [Parameter(Mandatory=$true)] [string]$Name,
        [Parameter(Mandatory=$true)] [string]$Command,
        [array]$CmdArgs,
        [hashtable]$Env
    )
    Remove-CodexServerSection -Name $Name
    $out = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $script:CODEX_CONFIG_PATH) {
        foreach ($line in @(Get-Content -LiteralPath $script:CODEX_CONFIG_PATH -Encoding UTF8)) {
            $out.Add($line)
        }
    }
    $out.Add("")
    $out.Add("[mcp_servers.$Name]")
    $out.Add("command = `"$(Format-TomlString $Command)`"")
    if ($CmdArgs -and $CmdArgs.Count -gt 0) {
        $argsToml = ($CmdArgs | ForEach-Object { "`"$(Format-TomlString ([string]$_))`"" }) -join ", "
        $out.Add("args = [$argsToml]")
    }
    if ($Env -and $Env.Count -gt 0) {
        $out.Add("")
        $out.Add("[mcp_servers.$Name.env]")
        foreach ($eKey in $Env.Keys) {
            $out.Add("$eKey = `"$(Format-TomlString ([string]$Env[$eKey]))`"")
        }
    }
    Set-Content -LiteralPath $script:CODEX_CONFIG_PATH -Value $out -Encoding UTF8
    Write-Host "[OK] Wrote [mcp_servers.$Name] (stdio command/args/env) to codex config.toml"
}
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
        # codex mcp add is stdio-only; HTTP servers are written straight to
        # config.toml. Set-CodexHttpServer clears any prior table first, so this
        # is idempotent without needing the CLI 'remove'.
        Write-Host "[CONFIG] Writing HTTP server '$name' directly to config.toml (no --url CLI flag exists)"
        Set-CodexHttpServer -Name $name -Url $config.Url -Headers $config.Headers
    }
    else {
        # stdio servers: write config.toml directly. `codex mcp add` works but
        # needs a TTY, and the installer pipes stdout (the call failed with
        # "stdout is not a terminal"), so the CLI path silently dropped this
        # server. Writing the table directly is TTY-free and idempotent.
        Write-Host "[CONFIG] Writing stdio server '$name' directly to config.toml (codex mcp add needs a TTY)"
        Set-CodexStdioServer -Name $name -Command $config.Command -CmdArgs $config.CmdArgs -Env $config.Env
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
