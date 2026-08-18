#!/usr/bin/env python3
"""
Script Manager Module

Handles script generation, viewing, and restoration.
"""

import os
import platform
import stat
import subprocess
import time
from pathlib import Path
from typing import List, Dict, Any, Set
from datetime import datetime

from utils.common_utils import (
    ColorMessage, clear_screen, is_admin, get_winenvs_dir, get_linuxenvs_dir, ensure_directory_exists
)
from generators.command_content_generator_windows import WindowsCommandContentGenerator
from generators.command_content_generator_linux import LinuxCommandContentGenerator
from script_sections.ark_launcher_section import ArkLauncherSectionGenerator
from utils.secret_manager import LOCAL_SECRET_MANAGER


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _write_script_file(file_path: Path, content: str, make_executable: bool = False) -> None:
    """Write content to file using binary mode (matching safe_write_secret).

    Uses ``open(…, 'wb')`` + explicit UTF-8 encode to stay on the same
    Windows API code path as ``Path.write_bytes()``, avoiding text-mode
    ``CreateFileW`` hooks that can return ``ERROR_INVALID_PARAMETER``
    (errno 22) under aggressive security-software / filter-driver stacks.
    Includes a brief retry loop for transient locks (Defender scans, etc.).
    """
    raw = content.encode('utf-8')
    last_err = None
    for attempt in range(3):
        try:
            with open(file_path, 'wb') as fh:
                fh.write(raw)
            if make_executable:
                try:
                    os.chmod(file_path, 0o755)
                except Exception:
                    pass
            return
        except OSError as exc:
            last_err = exc
            if attempt < 2:
                time.sleep(0.3 * (attempt + 1))
    raise last_err  # type: ignore[misc]


class ScriptManager:
    """Manages script generation, viewing, and restoration"""

    def __init__(self, windows_generator: WindowsCommandContentGenerator, linux_generator: LinuxCommandContentGenerator):
        self.windows_generator = windows_generator
        self.linux_generator = linux_generator
        self.ark_generator = ArkLauncherSectionGenerator()

    def generate_scripts_for_config(
        self,
        config_name: str,
        config: Dict[str, Any],
        file_number: int,
        show_next_steps: bool = True,
        secret_manager_available: bool = False
    ) -> List[Path]:
        """Generate Windows/Linux scripts for a configuration"""
        command_prefix = config.get('CommandPrefix', '')

        if not command_prefix:
            if show_next_steps:
                ColorMessage.write("Configuration does not require script generation.", 'info')
                ColorMessage.write("Environment variables have been saved to encrypted storage.", 'success')
            return []

        file_name = f"{command_prefix}{file_number}"

        ColorMessage.write("Generating scripts...", 'info')
        print()

        script_paths = []
        success_count = 0

        is_ssh = (config_name == 'SSH Connection')
        mcp_support = config.get('MCPSupport', {})
        mcp_enabled = mcp_support.get('Enabled', False) and not is_ssh

        user_inputs = {}

        # Generate Windows script
        ps_command = config.get('WindowsCommand', command_prefix)
        if is_ssh:
            windows_content = self.windows_generator.generate_ssh_command_content(
                config_name, file_number, user_inputs, f"{file_name}.ps1"
            )
        else:
            mcp_section = ""
            if mcp_enabled:
                # Codex has its own npm upgrade prompt at the script start, so the
                # MCP-section upgrade prompt (codex_update.bat) is suppressed to
                # avoid a double upgrade prompt.
                codex_no_mcp_upgrade = (command_prefix or "").lower() == "codex"
                mcp_section = self.windows_generator.generate_mcp_section(
                    command_prefix, config['DisplayName'], command_prefix,
                    support_upgrade=not codex_no_mcp_upgrade,
                    include_launch_pause=not codex_no_mcp_upgrade
                )

            windows_content = self.windows_generator.generate_command_content(
                config_name, command_prefix, ps_command, file_number,
                config['Variables'], mcp_section, f"{file_name}.ps1"
            )

        winenvs_dir = get_winenvs_dir()
        ensure_directory_exists(str(winenvs_dir))
        win_script_path = winenvs_dir / f"{file_name}.ps1"

        try:
            _write_script_file(win_script_path, windows_content)
            ColorMessage.write(f"[OK] Windows script: {win_script_path}", 'success')
            script_paths.append(win_script_path)
            success_count += 1
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create Windows script: {e}", 'error')

        # Generate Linux script
        bash_command = config.get('LinuxCommand', command_prefix)
        if is_ssh:
            linux_content = self.linux_generator.generate_ssh_command_content(
                config_name, file_number, user_inputs, f"{file_name}.sh"
            )
        else:
            linux_mcp_section = ""
            if mcp_enabled:
                codex_no_mcp_upgrade = (command_prefix or "").lower() == "codex"
                linux_mcp_section = self.linux_generator.generate_mcp_section(
                    command_prefix, config['DisplayName'], command_prefix,
                    support_upgrade=not codex_no_mcp_upgrade,
                    include_launch_pause=not codex_no_mcp_upgrade
                )

            linux_content = self.linux_generator.generate_command_content(
                config_name, command_prefix, bash_command, file_number,
                config['Variables'], linux_mcp_section, f"{file_name}.sh"
            )

        linuxenvs_dir = get_linuxenvs_dir()
        ensure_directory_exists(str(linuxenvs_dir))
        linux_script_path = linuxenvs_dir / f"{file_name}.sh"

        try:
            _write_script_file(linux_script_path, linux_content, make_executable=True)

            if platform.system() != 'Windows':
                self._ensure_linux_symlink(linux_script_path)

            ColorMessage.write(f"[OK] Linux script: {linux_script_path}", 'success')
            script_paths.append(linux_script_path)
            success_count += 1
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create Linux script: {e}", 'error')

        if success_count == 0:
            ColorMessage.write("No scripts were generated.", 'error')
            return script_paths

        if show_next_steps:
            print()
            ColorMessage.write("Script generation completed successfully!", 'success')
            ColorMessage.write("", 'info')
            ColorMessage.write("Next steps:", 'info')

            if secret_manager_available:
                ColorMessage.write("1. Secrets are encrypted and saved automatically", 'success')
                ColorMessage.write("2. Scripts will load secrets from encrypted storage", 'info')
            else:
                ColorMessage.write("1. Use SecretManager to store environment variables securely", 'info')

            ColorMessage.write("3. Run the scripts:", 'info')
            for script_path in script_paths:
                ColorMessage.write(f"   {script_path}", 'info')

        return script_paths

    # =====================================================================
    # V4 Launcher Template Generation (claudevolc-style lean scripts)
    # =====================================================================

    def generate_v4_launcher_for_config(
        self, config_name: str, config: Dict[str, Any], file_number: int
    ) -> List[Path]:
        """Generate v4-style lean launcher scripts (team + ultracode) for a config"""
        command_prefix = config.get('CommandPrefix', '')
        if not command_prefix:
            return []

        file_name = f"{command_prefix}{file_number}"
        display_name = config.get('DisplayName', config_name)
        variables = config.get('Variables', [])
        script_paths = []

        # Ark CLI has its own v4 template (arkcli configures Claude model/MCP,
        # then launches claude under an isolated ark${index} user profile);
        # other v4 configs use the shared team+ultracode template.
        is_ark = (command_prefix or '').lower() == 'ark'
        if is_ark:
            sh_content = self.ark_generator.generate_sh(
                display_name, file_number, variables, command_prefix
            )
            ps1_content = self.ark_generator.generate_ps1(
                display_name, file_number, variables, command_prefix
            )
            
            # Generate piark scripts
            piark_sh_content = f'''#!/bin/bash
# Auto-generated by Special Software Environment Manager.
SCRIPT_SOURCE="${{BASH_SOURCE[0]}}"
if [ -L "$SCRIPT_SOURCE" ]; then
    SCRIPT_SOURCE="$(readlink -f "$SCRIPT_SOURCE" 2>/dev/null || echo "$SCRIPT_SOURCE")"
fi
SCRIPT_CURRENT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
PI_YOLO_PATH="$SCRIPT_CURRENT_DIR/piyolo.sh"
"$PI_YOLO_PATH" volc-coding {file_number} "$@"
'''
            piark_ps1_content = f'''# Auto-generated by Special Software Environment Manager.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$scriptPath = $PSScriptRoot
$piYoloPath = Join-Path $scriptPath 'piyolo.ps1'
& $piYoloPath volc-coding {file_number} @args
exit $LASTEXITCODE
'''
        else:
            sh_content = self._generate_v4_sh_template(
                display_name, file_number, variables, command_prefix
            )
            ps1_content = self._generate_v4_ps1_template(
                display_name, file_number, variables, command_prefix
            )

        linuxenvs_dir = get_linuxenvs_dir()
        ensure_directory_exists(str(linuxenvs_dir))
        sh_path = linuxenvs_dir / f"{file_name}.sh"
        try:
            _write_script_file(sh_path, sh_content, make_executable=True)
            if platform.system() != 'Windows':
                self._ensure_linux_symlink(sh_path)
            script_paths.append(sh_path)
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create v4 Linux script: {e}", 'error')

        winenvs_dir = get_winenvs_dir()
        ensure_directory_exists(str(winenvs_dir))
        ps1_path = winenvs_dir / f"{file_name}.ps1"
        try:
            _write_script_file(ps1_path, ps1_content)
            script_paths.append(ps1_path)
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create v4 Windows script: {e}", 'error')

        if is_ark:
            piark_sh_path = linuxenvs_dir / f"piark{file_number}.sh"
            try:
                _write_script_file(piark_sh_path, piark_sh_content, make_executable=True)
                if platform.system() != 'Windows':
                    self._ensure_linux_symlink(piark_sh_path)
                script_paths.append(piark_sh_path)
            except Exception as e:
                ColorMessage.write(f"[X] Failed to create piark Linux script: {e}", 'error')

            piark_ps1_path = winenvs_dir / f"piark{file_number}.ps1"
            try:
                _write_script_file(piark_ps1_path, piark_ps1_content)
                script_paths.append(piark_ps1_path)
            except Exception as e:
                ColorMessage.write(f"[X] Failed to create piark Windows script: {e}", 'error')

        return script_paths

    def regenerate_all_v4_launchers_for_config(
        self, config_name: str, config: Dict[str, Any]
    ) -> int:
        """Regenerate ALL v4 launcher scripts for a specific config type"""
        if not config.get('UseV4Launcher', False):
            return 0

        file_numbers = self._collect_launcher_file_numbers(config)
        if not file_numbers:
            return 0

        total = 0
        for number in file_numbers:
            paths = self.generate_v4_launcher_for_config(
                config_name, config, number
            )
            if paths:
                total += 1

        return total

    def regenerate_scripts_for_config(self, config_name: str, config: Dict[str, Any]) -> int:
        """Regenerate ALL scripts for ONE config (every file number). Used after
        saving env vars so the new values (e.g. CODEX_MODEL) refresh immediately
        in the launch scripts. Works for non-v4 configs (codex/droid/ssh)."""
        if config.get('UseV4Launcher', False):
            return self.regenerate_all_v4_launchers_for_config(config_name, config)

        file_numbers = self._collect_launcher_file_numbers(config)
        if not file_numbers:
            file_numbers = [1]
        total = 0
        for number in file_numbers:
            paths = self.generate_scripts_for_config(
                config_name, config, number, show_next_steps=False,
                secret_manager_available=True
            )
            if paths:
                total += 1
        return total

    def _generate_v4_sh_template(
        self, display_name: str, file_number: int,
        variables: List[Dict[str, Any]], command_prefix: str
    ) -> str:
        """Generate v4-style bash launcher script content"""
        load_lines = []
        export_lines = []
        summary_lines = []
        upgrade_section = self.linux_generator.generate_cli_upgrade_prompt_section(
            command_prefix
        )

        for var in variables:
            name = var['Name']
            dname = var.get('DisplayName', name)
            secret_key = f"{name}_{file_number}"
            load_lines.append(
                f'{name}=$(read_secret_file "$secret_dir/{secret_key}")'
            )
            export_lines.append(f'export {name}="${name}"')
            summary_lines.append(f'echo "{dname}: ${name}"')

        load_block = "\n".join(load_lines)
        export_block = "\n".join(export_lines)
        summary_block = "\n".join(summary_lines)

        return f'''#!/bin/bash
# =============================================================================
# {display_name} Launch Script #{file_number} - v4 [team + opt-in ultracode]
# =============================================================================
# Auto-generated by Special Software Environment Manager.
# Reads encrypted secrets from .secret_keys/.secret_ignore/*_{file_number}.
# Agent teams are always on; ultracode is opt-in (prompt at launch).
# If ANTHROPIC_MODEL is configured it is forced everywhere, else account default.
# =============================================================================

set -e

ultra_settings_json='{{"ultracode":true}}'
claude_args=()
ultra_choice=""
ultra_enabled=0
secret_dir=""
scriptSource=""
scriptCurrentPath=""
scriptsDirPath=""
projectRootPath=""

export DISABLE_AUTOUPDATER="1"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"

echo ""
echo "============================================================"
echo "{display_name} #{file_number} - v4 [team + opt-in ultracode]"
echo "============================================================"
echo ""

{upgrade_section}

scriptSource="${{BASH_SOURCE[0]}}"
if [ -L "$scriptSource" ]; then
    scriptSource="$(readlink -f "$scriptSource" 2>/dev/null || echo "$scriptSource")"
fi
scriptCurrentPath="$(cd "$(dirname "$scriptSource")" && pwd)"
scriptsDirPath="$(cd "$scriptCurrentPath/.." && pwd)"
projectRootPath="$(cd "$scriptsDirPath/.." && pwd)"

secret_dir="$projectRootPath/.secret_keys/.secret_ignore"

read_secret_file() {{
    local file_path="$1"
    local value=""
    if [ -f "$file_path" ]; then
        local first_bytes=$(head -c 3 "$file_path" 2>/dev/null | od -An -tx1 2>/dev/null | tr -d ' \\n' 2>/dev/null || echo "")
        if [ "$first_bytes" = "efbbbf" ]; then
            while IFS= read -r line || [ -n "$line" ]; do
                trimmed_line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
                if [ -n "$trimmed_line" ]; then
                    value="$trimmed_line"
                    break
                fi
            done < <(dd if="$file_path" bs=1 skip=3 2>/dev/null)
        else
            while IFS= read -r line || [ -n "$line" ]; do
                trimmed_line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
                if [ -n "$trimmed_line" ]; then
                    value="$trimmed_line"
                    break
                fi
            done < "$file_path"
        fi
    fi
    echo "$value"
}}

# Load secrets from _{file_number} files
{load_block}

# Export environment variables
{export_block}

# Configuration summary
{summary_block}
echo "Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (always on)"
if [ -n "${{ANTHROPIC_MODEL:-}}" ]; then
    echo "Model: $ANTHROPIC_MODEL (forced: main + subagents + background)"
else
    echo "Model: account default (no ANTHROPIC_MODEL configured)"
fi
echo "============================================================"
echo ""

# Force model everywhere if ANTHROPIC_MODEL is configured; else account default.
if [ -n "${{ANTHROPIC_MODEL:-}}" ]; then
    export CLAUDE_CODE_SUBAGENT_MODEL="$ANTHROPIC_MODEL"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="$ANTHROPIC_MODEL"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="$ANTHROPIC_MODEL"
    claude_args+=(--model "$ANTHROPIC_MODEL")
fi

# Ultracode: opt-in prompt (default No).
read -r -p "Enable ultracode? [y/N]: " ultra_choice || ultra_choice=""
if [ "$ultra_choice" = "y" ] || [ "$ultra_choice" = "Y" ]; then
    ultra_enabled=1
    claude_args+=(--settings "$ultra_settings_json")
fi

if [ "$EUID" -ne 0 ]; then
    claude_args+=(--permission-mode bypassPermissions --dangerously-skip-permissions)
fi

echo "============================================================"
echo "Press Enter to start {display_name} #{file_number} [team + opt-in ultracode]..."
echo "============================================================"
read -p "Press Enter to continue..."

echo ""
echo "Executing: claude ${{claude_args[*]}}"
echo ""

exec claude "${{claude_args[@]}}" "$@"
'''

    def _generate_v4_ps1_template(
        self, display_name: str, file_number: int,
        variables: List[Dict[str, Any]], command_prefix: str
    ) -> str:
        """Generate v4-style PowerShell launcher script content"""
        load_lines = []
        summary_lines = []
        upgrade_section = self.windows_generator.generate_cli_upgrade_prompt_section(
            command_prefix
        )

        for var in variables:
            name = var['Name']
            dname = var.get('DisplayName', name)
            secret_key = f"{name}_{file_number}"
            load_lines.append(
                f'$env:{name} = Read-SecretFile (Join-Path $secretDir "{secret_key}")'
            )
            summary_lines.append(
                f'Write-Host "{dname}: $($env:{name})" -ForegroundColor White'
            )

        load_block = "\n".join(load_lines)
        summary_block = "\n".join(summary_lines)

        return f'''# =============================================================================
# {display_name} Launch Script #{file_number} - v4 [team + opt-in ultracode]
# =============================================================================
# Auto-generated by Special Software Environment Manager.
# Reads encrypted secrets from .secret_keys/.secret_ignore/*_{file_number}.
# Agent teams are always on; ultracode is opt-in (prompt at launch).
# If ANTHROPIC_MODEL is configured it is forced everywhere, else account default.
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ultraSettingsJson = $null
$ultraSettingsFile = $null
$claudeArgs = $null
$teammateMode = $null
$enableUltra = $false
$ultraChoice = $null
$exitCode = 0
$scriptActualPath = $null
$item = $null
$scriptCurrentPath = $null
$scriptsDirPath = $null
$projectRootPath = $null
$secretDir = $null

$env:DISABLE_AUTOUPDATER = "1"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"

$teammateMode = 'in-process'

$ultraSettingsJson = '{{"ultracode":true}}'
$ultraSettingsFile = Join-Path $env:TEMP "{command_prefix}{file_number}_ultracode_settings.json"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "{display_name} #{file_number} - v4 [team + opt-in ultracode]" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

{upgrade_section}

$scriptActualPath = $PSCommandPath
$item = Get-Item -LiteralPath $PSCommandPath
if ($item -and $item -is [System.IO.FileInfo] -and $item.LinkType) {{
    $scriptActualPath = $item.Target
}}
$scriptCurrentPath = Split-Path $scriptActualPath -Parent
if (-not $scriptCurrentPath) {{
    $scriptCurrentPath = $PSScriptRoot
    if (-not $scriptCurrentPath) {{
        $scriptCurrentPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    }}
}}
$scriptsDirPath = Split-Path $scriptCurrentPath -Parent
$projectRootPath = Split-Path $scriptsDirPath -Parent

$secretDir = Join-Path $projectRootPath ".secret_keys\\.secret_ignore"

function Read-SecretFile {{
    param([string]$FilePath)
    $value = ""
    if (Test-Path $FilePath) {{
        try {{
            $bytes = [System.IO.File]::ReadAllBytes($FilePath)
            if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {{
                $bytes = $bytes[3..($bytes.Length - 1)]
            }}
            $content = [System.Text.Encoding]::UTF8.GetString($bytes)
            $lines = $content -split "`r?`n"
            foreach ($line in $lines) {{
                $trimmedLine = $line.Trim()
                if ($trimmedLine) {{
                    $value = $trimmedLine
                    break
                }}
            }}
        }}
        catch {{
            $value = ""
        }}
    }}
    return $value
}}

# Load secrets from _{file_number} files
{load_block}

# Configuration summary
{summary_block}
Write-Host "Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (always on)" -ForegroundColor White
if (-not [string]::IsNullOrWhiteSpace($env:ANTHROPIC_MODEL)) {{
    Write-Host "Model: $env:ANTHROPIC_MODEL (forced: main + subagents + background)" -ForegroundColor White
}} else {{
    Write-Host "Model: account default (no ANTHROPIC_MODEL configured)" -ForegroundColor White
}}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Build claude args: teammate mode + permission bypass always; model + ultracode conditional.
$claudeArgs = @("--teammate-mode", $teammateMode, "--permission-mode", "bypassPermissions", "--dangerously-skip-permissions")

# Force model everywhere if ANTHROPIC_MODEL is configured; else account default.
if (-not [string]::IsNullOrWhiteSpace($env:ANTHROPIC_MODEL)) {{
    $env:CLAUDE_CODE_SUBAGENT_MODEL = $env:ANTHROPIC_MODEL
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $env:ANTHROPIC_MODEL
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = $env:ANTHROPIC_MODEL
    $claudeArgs += @("--model", $env:ANTHROPIC_MODEL)
}}

# Ultracode: opt-in prompt (default No).
$ultraChoice = Read-Host "Enable ultracode? [y/N]"
if ($ultraChoice -eq 'y' -or $ultraChoice -eq 'Y') {{
    $enableUltra = $true
    [System.IO.File]::WriteAllText($ultraSettingsFile, $ultraSettingsJson)
    $claudeArgs += @("--settings", $ultraSettingsFile)
}}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Press Enter to start {display_name} #{file_number} [team + opt-in ultracode]..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
$null = Read-Host "Press Enter to continue"

Write-Host ""
Write-Host "Executing: claude $($claudeArgs -join ' ')" -ForegroundColor White
Write-Host ""

& claude @claudeArgs @args
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {{
    $exitCode = 0
}}

if ((-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {{
    Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
}}

exit $exitCode
'''

    def _ensure_linux_symlink(self, script_path: Path):
        """Ensure /usr/local/bin links to the given script"""
        if platform.system() == 'Windows':
            return

        link_dir = Path('/usr/local/bin')
        link_path = link_dir / script_path.stem

        try:
            if not link_dir.exists():
                parent = link_dir.parent
                if parent.exists() and os.access(parent, os.W_OK):
                    link_dir.mkdir(parents=True, exist_ok=True)
                else:
                    subprocess.run(['sudo', 'mkdir', '-p', str(link_dir)], check=True)

            if os.access(link_dir, os.W_OK):
                os.chmod(script_path, os.stat(script_path).st_mode | stat.S_IEXEC)
                subprocess.run(['ln', '-sf', str(script_path), str(link_path)], check=True)
            else:
                subprocess.run(['sudo', 'chmod', '+x', str(script_path)], check=True)
                subprocess.run(['sudo', 'ln', '-sf', str(script_path), str(link_path)], check=True)

            ColorMessage.write(f"[LINK] {link_path} -> {script_path}", 'success')
        except Exception as e:
            ColorMessage.write(f"[LINK] Failed to update symlink for {script_path.name}: {e}", 'warning')

    def _collect_secret_file_numbers(self, config: dict) -> List[int]:
        """Collect file numbers from secret storage for a config"""
        numbers: Set[int] = set()
        directories = [
            (LOCAL_SECRET_MANAGER.raw_dir, False),
            (LOCAL_SECRET_MANAGER.encrypted_dir, True)
        ]

        var_names = [var['Name'] for var in config.get('Variables', [])]

        for var_name in var_names:
            prefix = f"{var_name}_"
            prefix_upper = prefix.upper()

            for directory, is_encrypted in directories:
                if not directory or not directory.exists():
                    continue

                for entry in directory.iterdir():
                    if not entry.is_file():
                        continue

                    name = entry.name
                    if is_encrypted and name.lower().endswith('.js'):
                        name = name[:-3]

                    if name.upper().startswith(prefix_upper):
                        suffix = name[len(prefix):]
                        if suffix.isdigit():
                            numbers.add(int(suffix))

        return sorted(numbers)

    def _collect_script_file_numbers(self, command_prefix: str) -> List[int]:
        """Collect file numbers from existing winenvs/linuxenvs launcher scripts."""
        numbers: Set[int] = set()
        if not command_prefix:
            return []

        for directory, suffix in (
            (get_winenvs_dir(), '.ps1'),
            (get_linuxenvs_dir(), '.sh'),
        ):
            if not directory or not directory.exists():
                continue
            for entry in directory.iterdir():
                if not entry.is_file() or entry.suffix.lower() != suffix:
                    continue
                name = entry.stem
                if not name.startswith(command_prefix):
                    continue
                number_part = name[len(command_prefix):]
                if number_part.isdigit():
                    numbers.add(int(number_part))

        return sorted(numbers)

    def _collect_launcher_file_numbers(self, config: dict) -> List[int]:
        """Collect launcher numbers from secrets and/or existing scripts.

        Script-only launchers (Ark CLI) must not depend on dummy secret files
        for numbering — scan ark*.ps1 / ark*.sh instead.
        """
        numbers: Set[int] = set(self._collect_secret_file_numbers(config))
        command_prefix = config.get('CommandPrefix', '') or ''
        if config.get('ScriptOnlyLauncher', False) or command_prefix.lower() == 'ark':
            numbers.update(self._collect_script_file_numbers(command_prefix))
        return sorted(numbers)

    def restore_scripts_from_secrets(self, config_manager, secret_manager_available: bool = False):
        """Restore winenvs/linuxenvs scripts based on stored secrets"""
        clear_screen()
        ColorMessage.write("Restore Scripts from Secret Storage", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        if platform.system() == 'Windows' and not is_admin():
            ColorMessage.write("Administrator privileges are required to restore scripts (Windows system env vars).", 'error')
            input("Press Enter to continue...")
            return

        if not LOCAL_SECRET_MANAGER.secret_keys_dir.exists():
            ColorMessage.write("Secret storage directory not found.", 'error')
            input("Press Enter to continue...")
            return

        total_sets = 0
        for config_name, config in config_manager.get_all_configs().items():
            file_numbers = self._collect_launcher_file_numbers(config)
            if not file_numbers:
                continue

            ColorMessage.write(
                f"{config['DisplayName']}: found versions {', '.join(str(n) for n in file_numbers)}",
                'info'
            )

            for number in file_numbers:
                ColorMessage.write(f"  Restoring #{number}...", 'info')
                if config.get('UseV4Launcher', False):
                    script_paths = self.generate_v4_launcher_for_config(
                        config_name, config, number
                    )
                else:
                    script_paths = self.generate_scripts_for_config(
                        config_name, config, number, show_next_steps=False,
                        secret_manager_available=secret_manager_available
                    )
                if script_paths:
                    total_sets += 1

            print()

        if total_sets == 0:
            ColorMessage.write("No matching secrets/scripts were found to restore.", 'warning')
        else:
            ColorMessage.write(f"Restored {total_sets} script set(s) from secret storage.", 'success')
            self._generate_symlink_script()

            if platform.system() == 'Windows':
                ColorMessage.write("\nTo use Linux scripts, run this on Linux:", 'info')
                ColorMessage.write("  bash scripts/linuxenvs/create_symlinks.sh", 'info')
            else:
                ColorMessage.write("Linux commands were linked into /usr/local/bin.", 'info')

        print()
        input("Press Enter to continue...")

    def regenerate_all_scripts(self, config_manager, secret_manager_available: bool = False):
        """Regenerate ALL scripts from secret storage (no admin required, no symlinks)"""
        clear_screen()
        ColorMessage.write("Regenerate All Scripts", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        if not LOCAL_SECRET_MANAGER.secret_keys_dir.exists():
            ColorMessage.write("Secret storage directory not found.", 'error')
            input("Press Enter to continue...")
            return

        total_sets = 0
        skipped = 0
        for config_name, config in config_manager.get_all_configs().items():
            file_numbers = self._collect_launcher_file_numbers(config)
            if not file_numbers:
                continue

            display_name = config.get('DisplayName', config_name)
            ColorMessage.write(
                f"{display_name}: regenerating #{', '.join(str(n) for n in file_numbers)}",
                'info'
            )

            for number in file_numbers:
                if config.get('UseV4Launcher', False):
                    script_paths = self.generate_v4_launcher_for_config(
                        config_name, config, number
                    )
                else:
                    script_paths = self.generate_scripts_for_config(
                        config_name, config, number, show_next_steps=False,
                        secret_manager_available=secret_manager_available
                    )
                if script_paths:
                    total_sets += 1
                else:
                    skipped += 1

        print()
        if total_sets == 0:
            ColorMessage.write("No scripts were regenerated (no secrets/scripts found).", 'warning')
        else:
            ColorMessage.write(f"Regenerated {total_sets} script set(s).", 'success')
            if skipped:
                ColorMessage.write(f"Skipped {skipped} set(s) due to errors.", 'warning')

            # Generate symlink helper but don't require admin
            try:
                self._generate_symlink_script()
            except Exception:
                pass

            if platform.system() != 'Windows':
                ColorMessage.write("\nLinux symlinks updated where possible.", 'info')
            else:
                ColorMessage.write("\nTo update Linux symlinks, run on Linux:", 'info')
                ColorMessage.write("  bash scripts/linuxenvs/create_symlinks.sh", 'info')

        print()
        input("Press Enter to continue...")

    def _generate_symlink_script(self):
        """Generate a helper script to create symlinks on Linux"""
        linuxenvs_dir = get_linuxenvs_dir()
        script_path = linuxenvs_dir / "create_symlinks.sh"

        sh_scripts = sorted(linuxenvs_dir.glob("*.sh"))
        if not sh_scripts:
            return

        script_lines = [
            "#!/bin/bash",
            "# Auto-generated script to create symlinks for Linux environment scripts",
            "# This script should be run on Linux to create symlinks in /usr/local/bin",
            "",
            "set -e",
            "",
            "scriptSource=\"${BASH_SOURCE[0]}\"",
            "if [ -L \"$scriptSource\" ]; then",
            "    scriptSource=\"$(readlink -f \"$scriptSource\" 2>/dev/null || echo \"$scriptSource\")\"",
            "fi",
            "SCRIPT_DIR=\"$(cd \"$(dirname \"$scriptSource\")\" && pwd)\"",
            "",
            "echo \"Creating symlinks in /usr/local/bin...\"",
            "echo \"\"",
            "",
            "if [ -w /usr/local/bin ]; then",
            "    USE_SUDO=\"\"",
            "else",
            "    USE_SUDO=\"sudo\"",
            "fi",
            "",
        ]

        for script in sh_scripts:
            if script.name == "create_symlinks.sh":
                continue
            script_name = script.stem
            script_lines.append(f"# Link {script_name}")
            script_lines.append(f"$USE_SUDO chmod +x \"$SCRIPT_DIR/{script.name}\"")
            script_lines.append(f"$USE_SUDO ln -sf \"$SCRIPT_DIR/{script.name}\" /usr/local/bin/{script_name}")
            script_lines.append(f"echo \"[LINK] {script_name} -> $SCRIPT_DIR/{script.name}\"")
            script_lines.append("")

        script_lines.extend([
            "echo \"\"",
            "echo \"Symlinks created successfully!\"",
            "echo \"You can now run these commands from anywhere:\"",
            ""
        ])

        for script in sh_scripts:
            if script.name != "create_symlinks.sh":
                script_lines.append(f"echo \"  {script.stem}\"")

        try:
            _write_script_file(script_path, '\n'.join(script_lines) + '\n', make_executable=True)

            ColorMessage.write(f"\n[CREATED] Symlink helper: {script_path}", 'success')
        except Exception as e:
            ColorMessage.write(f"[WARNING] Failed to create symlink helper script: {e}", 'warning')

    def view_scripts(self, config_name: str, config: Dict[str, Any], file_number_manager):
        """View existing scripts for the specified configuration"""
        clear_screen()
        ColorMessage.write(f"View Scripts for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        command_prefix = config.get('CommandPrefix', config.get('Common', ''))
        scripts = file_number_manager.list_existing_scripts(command_prefix)

        if not scripts:
            ColorMessage.write("No scripts found for this configuration.", 'warning')
            ColorMessage.write(f"Command prefix: {command_prefix}", 'info')
            ColorMessage.write("(Only showing scripts that exist on BOTH Windows and Linux platforms)", 'info')
            print()
            ColorMessage.write("Use 'Add Global Command' to create a new script.", 'info')
        else:
            ColorMessage.write(f"Found {len(scripts)} script pair(s) for {config['DisplayName']}:", 'success')
            ColorMessage.write("(Scripts exist on BOTH Windows and Linux platforms)", 'info')
            print()

            for i, script in enumerate(scripts, 1):
                ColorMessage.write(f"{i}. Script #{script['file_number']}", 'info')
                print()

                ColorMessage.write(f"   Windows: {script['windows_name']}", 'info')
                ColorMessage.write(f"   Path: {script['windows_path']}", 'info')
                try:
                    stat_info = script['windows_path'].stat()
                    size = stat_info.st_size
                    mtime = stat_info.st_mtime
                    mod_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    ColorMessage.write(f"   Size: {size} bytes | Modified: {mod_time}", 'info')
                except Exception as e:
                    ColorMessage.write(f"   Error reading file info: {e}", 'warning')

                print()

                ColorMessage.write(f"   Linux: {script['linux_name']}", 'info')
                ColorMessage.write(f"   Path: {script['linux_path']}", 'info')
                try:
                    stat_info = script['linux_path'].stat()
                    size = stat_info.st_size
                    mtime = stat_info.st_mtime
                    mod_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    ColorMessage.write(f"   Size: {size} bytes | Modified: {mod_time}", 'info')
                except Exception as e:
                    ColorMessage.write(f"   Error reading file info: {e}", 'warning')

                print()

            ColorMessage.write("Operations:", 'info')
            ColorMessage.write("  - To edit: Open the script file in your text editor", 'info')
            ColorMessage.write("  - To run: Execute the script from your terminal/shell", 'info')

        print()
        ColorMessage.write("Current Environment Variables Status:", 'info')
        ColorMessage.write("-" * 60, 'info')
        print()

        for var in config.get('Variables', []):
            value = os.environ.get(var['Name'])
            display_name = var.get('DisplayName', var['Name'])

            ColorMessage.write(f"{display_name}: ", 'info', no_newline=True)
            if value:
                ColorMessage.write(value, 'success')
            else:
                ColorMessage.write("[Not set]", 'warning')

        print()
        input("Press Enter to continue...")


__all__ = ['ScriptManager']
