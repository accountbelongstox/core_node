"""
Command Content Generator for Linux

Generates bash scripts for Linux systems.
This is the Linux-specific version of CommandContentGenerator.ps1
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from config.path_config import get_path_config
from script_sections.mcp_section import MCPSectionGenerator
from script_sections.user_directory_section import UserDirectorySectionGenerator
from script_sections.env_loading_section import EnvLoadingSectionGenerator
from script_sections.ssh_command_generator import SSHCommandGenerator
from script_sections.backup_restore_section import BackupRestoreSectionGenerator


class LinuxCommandContentGenerator:
    """Generate Linux bash command scripts"""

    def __init__(self):
        self.path_config = get_path_config()
        self.project_root = self.path_config.project_root
        self.scripts_dir = self.path_config.scripts_dir
        self.mcp_generator = MCPSectionGenerator(self.path_config)
        self.user_dir_generator = UserDirectorySectionGenerator()
        self.env_loading_generator = EnvLoadingSectionGenerator()
        self.ssh_generator = SSHCommandGenerator()
        self.backup_restore_generator = BackupRestoreSectionGenerator(self.path_config)

    def get_mcp_sync_script_path(self, tool_type: str) -> Path:
        """Get MCP sync script path for a specific tool"""
        return self.path_config.get_mcp_sync_script_path(tool_type)

    def get_pre_launch_script_path(self, tool_type: str) -> Path:
        """Get pre-launch script path for a specific tool"""
        return self.path_config.get_pre_launch_script_path(tool_type, 'linux')

    def get_update_script_path(self, tool_type: str) -> Path:
        """Get update/upgrade script path for a specific tool"""
        return self.path_config.get_update_script_path(tool_type, 'linux')

    def generate_mcp_section(self, tool_type: str, tool_display_name: str,
                           target_name: str, support_upgrade: bool = True, support_npm_update: bool = False) -> str:
        """Generate MCP synchronization section for any AI tool

        Args:
            tool_type: Type of AI tool (e.g., 'claude', 'codex')
            tool_display_name: Display name for the tool (e.g., 'Claude Code')
            target_name: Target name for MCP sync (e.g., 'claude')
            support_upgrade: Whether to include upgrade option
            support_npm_update: Whether to include npm/npx update option
        """
        return self.mcp_generator.generate_linux_mcp_section(
            tool_type, tool_display_name, target_name, support_upgrade, support_npm_update
        )

    @staticmethod
    def _has_model_var(variables: List[Dict[str, Any]]) -> bool:
        for var in variables:
            if var.get('Name') == 'ANTHROPIC_MODEL':
                return True
        return False

    def generate_command_content(self, config_name: str, command_prefix: str,
                                bash_command: str, file_number: int,
                                variables: List[Dict[str, Any]],
                                mcp_section: str = "", file_name: str = "") -> str:
        """Generate complete bash command content"""
        has_model = self._has_model_var(variables)

        # Add --dangerously-skip-permissions for claude commands
        # Skip this flag if running as root (root doesn't need permission skipping)
        # Add --yolo for codex commands
        root_check_section = ""
        if bash_command == "claude":
            root_check_section = """
# Check if running as root - skip --dangerously-skip-permissions flag for root
if [ "$EUID" -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "WARNING: Running as root user"
    echo "============================================================"
    echo "Root user already has all permissions."
    echo "--dangerously-skip-permissions flag is NOT added."
    echo "============================================================"
    echo ""
    claude_command="claude"
else
    claude_command="claude --dangerously-skip-permissions"
fi
"""
            if has_model:
                root_check_section += """
# Add --model if ANTHROPIC_MODEL is configured
if [ -n "${ANTHROPIC_MODEL:-}" ]; then
    claude_command="$claude_command --model $ANTHROPIC_MODEL"
fi
"""
            bash_command = "$claude_command"
        elif bash_command == "codex":
            bash_command = "codex --yolo"
        
        header = f"""#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# =============================================================================
# {config_name} Global File #{file_number}
# =============================================================================
#
# Synopsis:
#     {config_name} Launch Script
#
# Description:
#     This file is automatically generated by Special Software Environment Manager
#     Contains tool startup functionality for Linux systems
#
# Notes:
#     - Tool Name: {config_name}
#     - Command Prefix: {command_prefix}
#     - Command: {bash_command}
#     - File Number: {file_number}
#     - File Name: {file_name}
#     - Generation Time: DO NOT GENERATE THIS FIELD (prevents git merge conflicts on every sync)
#
# Environment Variables:
#     Environment variables are managed by linux_path_function.sh
#     This script focuses on command execution only
# =============================================================================

set -e

# Ensure DISABLE_AUTOUPDATER is set for Claude Code
export DISABLE_AUTOUPDATER="1"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"
{root_check_section}"""

        file_name_display = ""
        if file_name:
            file_name_display = f"""
echo ""
echo "============================================================"
echo "Running: {file_name}"
echo "============================================================"
echo ""
"""

        # Generate user directory section
        user_directory_section = self.user_dir_generator.generate_linux_user_directory_section()

        # Path resolution section (for backward compatibility, now included in user_directory_section)
        path_resolution = ""

        # Generate environment variable loading section
        env_loading_section = self.env_loading_generator.generate_linux_env_loading_section(variables, file_number)

        # Generate model configuration section (Claude Code specific)
        model_section = ""
        if has_model:
            model_section = """
#region Model Configuration
# If ANTHROPIC_MODEL is configured, force it everywhere (main + subagents + tiers).
if [ -n "${ANTHROPIC_MODEL:-}" ]; then
    export CLAUDE_CODE_SUBAGENT_MODEL="$ANTHROPIC_MODEL"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="$ANTHROPIC_MODEL"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="$ANTHROPIC_MODEL"
    echo "Model: $ANTHROPIC_MODEL (forced: main + subagents + background)"
else
    echo "Model: account default (no ANTHROPIC_MODEL configured)"
fi
#endregion

"""

        # Build command display code
        build_command_code = """
#region Build Launch Command Display
env_vars_parts=()

"""
        for var in variables:
            var_name = var['Name']
            build_command_code += f"""if [ -n "${{{var_name}:-}}" ]; then
    env_vars_parts+=("{var_name}='${{{var_name}}}'")
fi

"""

        build_command_code += f"""if [ ${{#env_vars_parts[@]}} -gt 0 ]; then
    env_vars_command=$(IFS=' ' ; echo "${{env_vars_parts[*]}}")
    full_command_display="$env_vars_command {bash_command}"
else
    full_command_display="{bash_command}"
fi
#endregion

"""

        env_section = env_loading_section + model_section + build_command_code + "\n"

        mcp_section_content = ""
        if mcp_section:
            mcp_section_content = f"""
#region MCP Server Synchronization
echo ""
echo "============================================================"
echo "MCP Server Synchronization"
echo "============================================================"
echo ""

{mcp_section}
#endregion

"""

        # Detect tool type and generate backup/restore section
        backup_restore_section = ""
        npx_fallback_section = ""
        tool_type_map = {
            'claude': ('claude', 'Claude AI', '@anthropic-ai/claude-code'),
            'codex': ('codex', 'Codex AI', '@openai/codex'),
            'droid': ('droid', 'Factory AI Droid', '@factory/droid')
        }

        tool_key = command_prefix.lower() if command_prefix else config_name.lower()
        for key, (tool_type, tool_display_name, npm_package) in tool_type_map.items():
            if key in tool_key:
                # Generate backup/restore section
                backup_restore_section = self.backup_restore_generator.generate_linux_backup_restore_section(
                    tool_type, tool_display_name, tool_type
                )

                # Generate repair and npx fallback section
                npx_fallback_section = f"""
# AI Tool Repair and npx Fallback
if ! command -v {tool_type} &> /dev/null; then
    echo ""
    echo "============================================================"
    echo "Tool Not Found - Repair Options Available"
    echo "============================================================"
    echo "[WARNING] {tool_display_name} command not available"
    echo ""
    
    # Code Relationship: Generated scripts -> dd.sh smart permissions -> AI tools repair
    # This generated script detects missing tools and suggests dd.sh for comprehensive repair
    # dd.sh contains smart_permissions.sh which includes AI tools repair functionality
    echo "[SOLUTION] For comprehensive tool repair, run:"
    echo "  sudo $projectRootPath/dd.sh"
    echo ""
    echo "[INFO] dd.sh will attempt to:"
    echo "  1. Find {tool_display_name} in user home directories"
    echo "  2. Fix /usr/local/bin symlinks"
    echo "  3. Repair with package managers (npm/yarn)"
    echo "  4. Set proper permissions for all tools"
    echo ""

    # Try simple repair if repair function is available from dd.sh sourcing
    if declare -f repair_ai_tool > /dev/null; then
        echo "[INFO] Attempting quick repair for {tool_type}..."
        if repair_ai_tool "{tool_type}"; then
            echo "[SUCCESS] {tool_display_name} repaired successfully!"
        else
            echo "[WARNING] Quick repair failed"
        fi
    fi
fi

# Final check and npx fallback
if ! command -v {tool_type} &> /dev/null; then
    echo ""
    echo "============================================================"
    echo "Using npx Fallback (No Installation Required)"
    echo "============================================================"
    echo "[INFO] Running {tool_display_name} via npx (temporary solution)"
    echo "[INFO] For permanent fix, run: sudo $projectRootPath/dd.sh"
    echo ""

    # Generate npx fallback command
    env_vars_parts_npx=()
"""
                for var in variables:
                    var_name = var['Name']
                    npx_fallback_section += f"""    if [ -n "${{{var_name}:-}}" ]; then
        env_vars_parts_npx+=("{var_name}='${{{var_name}}}'")
    fi
"""

                npx_fallback_section += f"""
    if [ ${{#env_vars_parts_npx[@]}} -gt 0 ]; then
        env_vars_command_npx=$(IFS=' ' ; echo "${{env_vars_parts_npx[*]}}")
        full_command_display="$env_vars_command_npx npx -y {npm_package}"
    else
        full_command_display="npx -y {npm_package}"
    fi

    echo "[INFO] Using command: $full_command_display"
    echo ""
fi

"""
                break

        launch_section = f"""
#region Launch Tool
echo ""
echo "============================================================"
echo "Press Enter to start {config_name}..."
echo "============================================================"
read -p "Press Enter to continue"

echo ""
echo "Executing: {bash_command}"
echo ""
echo "Command: $full_command_display"
echo ""
echo "Press Enter to continue..."
read
eval "$full_command_display"

echo ""
echo "Press Enter to exit..."
read
#endregion
"""

        return f"""{header}{file_name_display}{user_directory_section}{path_resolution}{env_section}{mcp_section_content}{backup_restore_section}{npx_fallback_section}{launch_section}"""

    def generate_ssh_command_content(self, config_name: str, file_number: int,
                                    user_inputs: Dict[str, str], file_name: str = "") -> str:
        """Generate SSH connection bash script"""
        return self.ssh_generator.generate_linux_ssh_command(config_name, file_number, file_name)


__all__ = ['LinuxCommandContentGenerator']

