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
from typing import List, Optional

# Import from common provider
from mcp_config_provider import MCPConfig, get_mcp_configs, get_project_root


def run_command(cmd: List[str], description: str, cwd: Optional[Path] = None) -> bool:
    """Run a shell command and return success status"""
    print(f"[INFO] {description}")
    print(f"[CMD] {' '.join(cmd)}")
    if cwd:
        print(f"[CWD] {cwd}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(cwd) if cwd else None
        )

        if result.stdout:
            print(result.stdout)

        if result.returncode == 0:
            print(f"[SUCCESS] {description}")
            return True
        else:
            print(f"[ERROR] Command failed with exit code {result.returncode}")
            if result.stderr:
                print(f"[STDERR] {result.stderr}")
            return False

    except subprocess.TimeoutExpired:
        print(f"[ERROR] Command timed out after 30 seconds")
        return False
    except FileNotFoundError:
        print(f"[ERROR] Command not found: {cmd[0]}")
        return False
    except Exception as e:
        print(f"[ERROR] Failed to run command: {e}")
        return False


def configure_codex_mcp() -> int:
    """Configure MCP servers for Codex using native commands"""
    print("=" * 80)
    print("[CODEX] Configuring MCP servers using 'codex mcp add' commands")
    print("=" * 80)
    print()

    # Check if codex command exists
    check_cmd = ["codex", "--version"]
    result = subprocess.run(check_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("[ERROR] 'codex' command not found. Please install Codex Code first.")
        return 1

    print(f"[INFO] Codex version: {result.stdout.strip()}")
    print()

    # Get MCP configurations from common provider
    configs = get_mcp_configs(target="codex")

    if not configs:
        print("[WARNING] No MCP servers to configure")
        return 0

    # Get project root for relative path execution
    project_root = get_project_root()

    success_count = 0
    failed_count = 0

    for config in configs:
        print(f"[{success_count + failed_count + 1}/{len(configs)}] Adding MCP server: {config.name}")

        if config.transport_type == "http":
            # HTTP transport
            cmd = ["codex", "mcp", "add", config.name,
                   "--transport", "http",
                   "--url", config.url]

            # Add headers
            for key, value in config.headers.items():
                cmd.extend(["--header", f"{key}: {value}"])

            if run_command(cmd, f"Adding {config.name} MCP server (HTTP)"):
                success_count += 1
            else:
                failed_count += 1

        else:  # stdio transport
            # Build codex mcp add command with relative path
            cmd = ["codex", "mcp", "add", config.name, config.command] + config.args

            # Add environment variables if present
            if config.env:
                for key, value in config.env.items():
                    cmd.extend(["--env", f"{key}={value}"])

            # Run from PROJECT_ROOT so relative paths work
            if run_command(cmd, f"Adding {config.name} MCP server (stdio)", cwd=project_root):
                success_count += 1
            else:
                failed_count += 1

        print()

    print("=" * 80)
    print(f"[SUMMARY] Codex MCP Configuration Complete")
    print(f"  Success: {success_count}/{len(configs)}")
    print(f"  Failed:  {failed_count}/{len(configs)}")
    print("=" * 80)

    return 0 if failed_count == 0 else 1


def main():
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

    return configure_codex_mcp()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print()
        print("[INFO] Operation cancelled by user")
        sys.exit(130)
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
