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
Claude MCP Servers Configuration Tool

This script configures MCP servers for Claude using the native command-line interface.
Uses 'claude mcp add' command instead of modifying JSON configuration files.

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


def verify_with_list_and_get(server_name: str) -> Tuple[bool, str]:
    """Verify server exists by parsing list/get output content."""
    list_output = stream_command(["claude", "mcp", "list"], "Verifying with: claude mcp list")
    get_output = stream_command(["claude", "mcp", "get", server_name], f"Verifying with: claude mcp get {server_name}")
    text = (list_output + "\n" + get_output).lower()
    is_ok = server_name.lower() in text
    reason = f"server-name-present={is_ok}"
    return is_ok, reason


def configure_claude_mcp() -> None:
    """Configure MCP servers for Claude using native commands."""
    print("=" * 80)
    print("[CLAUDE] Configuring MCP servers using 'claude mcp add' commands")
    print("=" * 80)
    print()

    # Check if claude command exists
    check_cmd = ["claude", "--version"]
    try:
        stream_command(check_cmd, "Checking Claude CLI availability")
    except Exception:
        print("[ERROR] Failed to execute 'claude --version'. Please install Claude Code first.")
        return
    print()

    # Get MCP configurations from common provider
    configs = get_mcp_configs(target="claude")

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
            # Order: flags, name, url, then variadic -H (AFTER positional args)
            cmd = ["claude", "mcp", "add", "-t", "http", "-s", "user", config.name, config.url]
            for key, value in config.headers.items():
                cmd.extend(["-H", f"{key}: {value}"])
            commands_to_run.append((config, cmd, None))
        else:
            # Correct format: claude mcp add --transport stdio <name> [--env KEY=VALUE] -- <command> [args...]
            cmd = ["claude", "mcp", "add", "-t", "stdio", "-s", "user"]

            # Name first, then variadic -e before --
            cmd.append(config.name)

            if config.env:
                for key, value in config.env.items():
                    cmd.extend(["-e", f"{key}={value}"])

            # Add -- separator
            cmd.append("--")

            # Add command and args after --
            # For relative paths, resolve to absolute path based on project_root
            if config.command and not Path(config.command).is_absolute():
                # Resolve relative command path to absolute
                absolute_command = str(project_root / config.command)
                cmd.append(absolute_command)
            else:
                cmd.append(config.command)

            # Resolve args - if arg is a relative path, make it absolute
            for arg in config.args:
                if arg.endswith('.py') and not Path(arg).is_absolute():
                    # This is likely a Python file, resolve to absolute path
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
        # Remove any existing entry first: 'claude mcp add' refuses to overwrite
        # an existing server, so a stale/incorrect entry (e.g. a corrupted API
        # key) would persist across re-runs. Non-fatal if it does not exist.
        stream_command(["claude", "mcp", "remove", config.name, "-s", "user"],
                       f"Removing existing {config.name} (if any)")
        description = f"Adding {config.name} MCP server ({config.transport_type})"
        stream_command(cmd, description, cwd=cwd)
        ok, reason = verify_with_list_and_get(config.name)
        if ok:
            print(f"[VERIFY] {config.name}: OK ({reason})")
        else:
            print(f"[VERIFY] {config.name}: NOT CONFIRMED ({reason})")
        print()

    print("=" * 80)
    print("[SUMMARY] Claude MCP Configuration Complete")
    print("=" * 80)


def main() -> None:
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Configure MCP servers for Claude AI"
    )
    parser.add_argument(
        "--target",
        type=str,
        default="claude",
        help="Target tool (always 'claude' for this script)"
    )
    parser.add_argument(
        "--working-dir",
        type=str,
        help="Working directory (for compatibility, not used)"
    )

    args = parser.parse_args()

    if args.target != "claude":
        print(f"[WARNING] This script only supports Claude. Use appropriate script for {args.target}")

    print()
    print("=" * 80)
    print("Claude MCP Configuration Tool")
    print("=" * 80)
    print()

    configure_claude_mcp()


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
