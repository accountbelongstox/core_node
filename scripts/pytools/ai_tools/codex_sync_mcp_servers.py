#!/usr/bin/env python3
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

r"""
Codex MCP Servers Configuration Tool

This script configures MCP servers for Codex using the native command-line interface.
Uses 'codex mcp add' command instead of modifying JSON configuration files.

Uses the common MCP configuration provider (mcp_config_provider.py) for consistency.
"""

import argparse
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple

# Import from common provider
from mcp_config_provider import MCPConfig, get_mcp_configs, get_project_root

def stream_command(cmd: List[str], description: str, cwd: Optional[Path] = None) -> str:
    """Run command with live output and return combined output text."""
    print(f"[INFO] {description}")
    print(f"[CMD] {' '.join(cmd)}")
    if cwd:
        print(f"[CWD] {cwd}")
    combined_lines: List[str] = []
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=str(cwd) if cwd else None,
        bufsize=1
    )
    if process.stdout is not None:
        for line in process.stdout:
            text = line.rstrip("\n")
            combined_lines.append(text)
            print(text)
    process.wait()
    return "\n".join(combined_lines)


def set_codex_http_headers(name: str, headers: dict) -> None:
    """Write [mcp_servers.<name>.http_headers] into ~/.codex/config.toml.

    'codex mcp add --url' has no flag for custom HTTP headers, so context7's
    CONTEXT7_API_KEY header cannot be set via the CLI. Any existing header table
    for the server is replaced. Uses stdlib only (no toml writer dependency).
    """
    if not headers:
        return
    import os
    codex_home = os.environ.get("CODEX_HOME") or str(Path.home() / ".codex")
    codex_config = Path(codex_home) / "config.toml"
    if not codex_config.exists():
        print(f"[WARNING] codex config.toml not found at {codex_config}; cannot set headers for {name}")
        return
    section = f"[mcp_servers.{name}.http_headers]"
    lines = codex_config.read_text(encoding="utf-8-sig").splitlines()
    kept: List[str] = []
    skipping = False
    for line in lines:
        stripped = line.strip()
        if stripped == section:
            skipping = True
            continue
        if skipping:
            if stripped.startswith("["):
                skipping = False
            else:
                continue
        kept.append(line)
    kept.append("")
    kept.append(section)
    for key, value in headers.items():
        escaped = str(value).replace("\\", "\\\\").replace('"', '\\"')
        kept.append(f'{key} = "{escaped}"')
    codex_config.write_text("\n".join(kept) + "\n", encoding="utf-8")
    print(f"[OK] Wrote http_headers for {name} to codex config.toml")


def verify_with_list(server_name: str) -> Tuple[bool, str]:
    """Verify server exists by parsing 'codex mcp list' output content."""
    list_output = stream_command(["codex", "mcp", "list"], "Verifying with: codex mcp list")
    text = list_output.lower()
    is_ok = server_name.lower() in text
    reason = f"server-name-present={is_ok}"
    return is_ok, reason


def configure_codex_mcp() -> None:
    """Configure MCP servers for Codex using native commands."""
    print("=" * 80)
    print("[CODEX] Configuring MCP servers using 'codex mcp add' commands")
    print("=" * 80)
    print()

    # Check if codex command exists
    check_cmd = ["codex", "--version"]
    try:
        stream_command(check_cmd, "Checking Codex CLI availability")
    except Exception:
        print("[ERROR] Failed to execute 'codex --version'. Please install Codex CLI first.")
        return
    print()

    # Get MCP configurations from common provider
    configs = get_mcp_configs(target="codex")

    if not configs:
        print("[WARNING] No MCP servers to configure")
        return

    # Get project root for relative path execution
    project_root = get_project_root()

    # Build all commands first and display them
    commands_to_run = []

    print("=" * 80)
    print("[PREVIEW] Commands to be executed:")
    print("=" * 80)

    for idx, config in enumerate(configs, 1):
        if config.transport_type == "http":
            # HTTP transport: codex mcp add <name> --url <url>
            cmd = ["codex", "mcp", "add", config.name, "--url", config.url]

            commands_to_run.append((config, cmd, None))
        else:
            # STDIO transport: codex mcp add <name> [--env KEY=VALUE] -- <command> [args...]
            cmd = ["codex", "mcp", "add", config.name]

            # Add environment variables before --
            if config.env:
                for key, value in config.env.items():
                    cmd.extend(["--env", f"{key}={value}"])

            # Add -- separator
            cmd.append("--")

            # Add command and args after --
            # Only resolve relative paths for actual file paths (e.g., pymain.py)
            # Don't resolve system commands (npx, node, python, etc.)
            system_commands = {'npx', 'node', 'python', 'python3'}
            if config.command:
                command_name = Path(config.command).name.lower()
                # If command is a relative path but not a system command, resolve it
                if not Path(config.command).is_absolute() and command_name not in system_commands:
                    absolute_command = str(project_root / config.command)
                    cmd.append(absolute_command)
                else:
                    cmd.append(config.command)

            # Resolve args - if arg is a relative path, make it absolute
            for arg in config.args:
                if arg.endswith('.py') and not Path(arg).is_absolute():
                    absolute_arg = str(project_root / arg)
                    cmd.append(absolute_arg)
                else:
                    cmd.append(arg)

            commands_to_run.append((config, cmd, None))

        print(f"[{idx}] {config.name} ({config.transport_type})")
        print(f"    CMD: {' '.join(cmd)}")
        print()

    print("=" * 80)
    print()

    for idx, (config, cmd, cwd) in enumerate(commands_to_run, 1):
        print(f"[{idx}/{len(configs)}] Executing: {config.name}")
        # Remove any existing entry first so re-runs always apply latest config.
        stream_command(["codex", "mcp", "remove", config.name],
                       f"Removing existing {config.name} (if any)")
        description = f"Adding {config.name} MCP server ({config.transport_type})"
        stream_command(cmd, description, cwd=cwd)
        # codex CLI cannot set custom HTTP headers; inject them into config.toml.
        if config.transport_type == "http" and config.headers:
            set_codex_http_headers(config.name, config.headers)
        ok, reason = verify_with_list(config.name)
        if ok:
            print(f"[VERIFY] {config.name}: OK ({reason})")
        else:
            print(f"[VERIFY] {config.name}: NOT CONFIRMED ({reason})")
        print()

    print("=" * 80)
    print("[SUMMARY] Codex MCP Configuration Complete")
    print("=" * 80)


def main() -> None:
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Configure MCP servers for Codex AI"
    )
    parser.add_argument(
        "--target",
        type=str,
        default="codex",
        help="Target tool (always 'codex' for this script)"
    )
    parser.add_argument(
        "--working-dir",
        type=str,
        help="Working directory (for compatibility, not used)"
    )

    args = parser.parse_args()

    if args.target != "codex":
        print(f"[WARNING] This script only supports Codex. Use appropriate script for {args.target}")

    print()
    print("=" * 80)
    print("Codex MCP Configuration Tool")
    print("=" * 80)
    print()

    configure_codex_mcp()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        print("[INFO] Operation cancelled by user")
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
