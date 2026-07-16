"""
Command Content Generator for Windows

Generates PowerShell scripts for Windows systems with full environment variable management.
This is the Windows-specific version of CommandContentGenerator.ps1
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


class WindowsCommandContentGenerator:
    """Generate Windows PowerShell command scripts"""

    def __init__(self):
        self.path_config = get_path_config()
        self.project_root = self.path_config.project_root
        self.scripts_dir = self.path_config.scripts_dir
        self.win_common_dir = self.path_config.win_common_dir
        self.secret_manager_path = self.path_config.secret_manager_ps1
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
        return self.path_config.get_pre_launch_script_path(tool_type, 'windows')

    def get_update_script_path(self, tool_type: str) -> Path:
        """Get update/upgrade script path for a specific tool"""
        return self.path_config.get_update_script_path(tool_type, 'windows')

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
        # Delegate to MCPSectionGenerator for consistency
        return self.mcp_generator.generate_windows_mcp_section(
            tool_type, tool_display_name, target_name, support_upgrade, support_npm_update
        )

    def generate_custom_user_directory_section(self) -> str:
        """Generate custom user directory configuration section"""
        return """
#region Initialize Path Variables
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
$shellsDirPath = Join-Path $scriptsDirPath "shells"
$winDirPath = Join-Path $shellsDirPath "win"
$winCommonDirPath = Join-Path $winDirPath "win_common"
$pytoolsDirPath = Join-Path $scriptsDirPath "pytools"
$aiToolsDirPath = Join-Path $pytoolsDirPath "ai_tools"
# Path resolution algorithm:
#   Script -> Scripts Dir -> Project Root -> Tool-specific directories
Write-Host "[DEBUG] Script Path: $scriptCurrentPath" -ForegroundColor DarkGray
Write-Host "[DEBUG] Scripts Dir: $scriptsDirPath" -ForegroundColor DarkGray
Write-Host "[DEBUG] Project Root: $projectRootPath" -ForegroundColor DarkGray
#endregion
# Path resolution algorithm:
#   Script -> Scripts Dir -> Project Root -> Tool-specific directories

# Ensure PATH is prepared via WindowsPathFunction script
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
. $windowsPathFunctionScript
Set-CoreNodePaths

#region Custom User Directory Configuration
# ============================================================================
# CUSTOM USER DIRECTORY SETTING
# ============================================================================
# Auto-scans D:\\.tmp\\Users\\ for existing MyBest1, MyBest2, etc.
# Usage: script.ps1 [number|MyBestX]
#   - If number is provided: uses D:\\.tmp\\Users\\MyBest[number]
#   - If full name is provided (e.g., MyBest1): uses D:\\.tmp\\Users\\MyBest1
#   - If no argument: auto-finds next available MyBest[X] or creates new one
# ============================================================================

$baseTempDir = "D:\\.tmp\\Users"
$userDirPrefix = "MyBest"

# Get directory name/number from command line argument (if provided)
$userDirName = $null
if ($args.Count -gt 0) {
    $argValue = $args[0]
    # Check if it's a number
    if ($argValue -match '^\\d+$') {
        $userDirName = "$userDirPrefix$argValue"
        Write-Host "[INFO] Using specified number: $argValue -> $userDirName" -ForegroundColor Cyan
    }
    # Check if it's a full name (MyBestX format)
    elseif ($argValue -match "^$userDirPrefix\\d+$") {
        $userDirName = $argValue
        Write-Host "[INFO] Using specified full name: $userDirName" -ForegroundColor Cyan
    }
}

# If no argument specified, auto-scan for existing MyBest directories
if ($null -eq $userDirName) {
    Write-Host "[INFO] Auto-scanning for existing MyBest directories..." -ForegroundColor Cyan
    
    # Create base directory if it doesn't exist
    if (-not (Test-Path $baseTempDir)) {
        Write-Host "[INFO] Creating base directory: $baseTempDir" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $baseTempDir -Force | Out-Null
    }
    
    # Find existing MyBest directories
    $existingNumbers = @()
    if (Test-Path $baseTempDir) {
        $existingDirs = Get-ChildItem -Path $baseTempDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "^$userDirPrefix(\\d+)$" }
        foreach ($dir in $existingDirs) {
            if ($dir.Name -match "^$userDirPrefix(\\d+)$") {
                $num = [int]$matches[1]
                $existingNumbers += $num
            }
        }
    }
    
    # Find next available number
    if ($existingNumbers.Count -gt 0) {
        $existingNumbers = $existingNumbers | Sort-Object
        $maxNumber = $existingNumbers[-1]
        $nextNumber = $maxNumber + 1
        $userDirName = "$userDirPrefix$nextNumber"
        Write-Host "[INFO] Found existing MyBest directories: $($existingNumbers -join ', ')" -ForegroundColor Gray
        Write-Host "[INFO] Using next available number: $nextNumber -> $userDirName" -ForegroundColor Cyan
    } else {
        $userDirName = "$userDirPrefix" + "1"
        Write-Host "[INFO] No existing MyBest directories found, starting with: $userDirName" -ForegroundColor Cyan
    }
}

# Build directory path
$CustomUserDirectory = Join-Path $baseTempDir $userDirName

# Create the directory if it doesn't exist
try {
    if (-not (Test-Path $baseTempDir)) {
        Write-Host "[INFO] Creating base directory: $baseTempDir" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $baseTempDir -Force | Out-Null
    }

    if (-not (Test-Path $CustomUserDirectory)) {
        Write-Host "[INFO] Creating custom user directory: $CustomUserDirectory" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $CustomUserDirectory -Force | Out-Null
    }

    # Verify directory was created successfully
    if (Test-Path $CustomUserDirectory) {
        $userProfilePath = $CustomUserDirectory
        Write-Host "[SUCCESS] Using MyBest directory: $userProfilePath" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Failed to create custom directory, falling back to system default" -ForegroundColor Yellow
        $userProfilePath = $env:USERPROFILE
        if (-not $userProfilePath) {
            $userProfilePath = [Environment]::GetFolderPath("UserProfile")
        }
        Write-Host "[INFO] Using system default user directory: $userProfilePath" -ForegroundColor Cyan
    }
} catch {
    Write-Host "[ERROR] Failed to create custom user directory: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[INFO] Falling back to system default..." -ForegroundColor Yellow
    $userProfilePath = $env:USERPROFILE
    if (-not $userProfilePath) {
        $userProfilePath = [Environment]::GetFolderPath("UserProfile")
    }
    Write-Host "[INFO] Using system default user directory: $userProfilePath" -ForegroundColor Cyan
}

$userHomePath = $userProfilePath
$usersDirectoryPath = Split-Path $userProfilePath -Parent

# Set environment variables for Node.js, React, Python, and other applications
# ============================================================================
# These environment variables will be available to all child processes
# including Node.js, React, Python, and other applications launched from this script
#
# Python usage examples:
#   import os
#   user_home = os.path.expanduser("~")  # Uses HOME or USERPROFILE
#   user_home = os.getenv("USERPROFILE") or os.getenv("HOME")
#   from pathlib import Path
#   user_home = Path.home()  # Uses HOME or USERPROFILE
# ============================================================================
$env:USERPROFILE = $userProfilePath
$env:HOME = $userProfilePath
$env:USER_HOME = $userProfilePath
$env:HOMEPATH = $userProfilePath
$env:USER_DIR = $userProfilePath

Write-Host "[INFO] Environment variables set for Node.js/React/Python applications:" -ForegroundColor Cyan
Write-Host "  USERPROFILE = $env:USERPROFILE" -ForegroundColor Gray
Write-Host "  HOME = $env:HOME" -ForegroundColor Gray
Write-Host "  USER_HOME = $env:USER_HOME" -ForegroundColor Gray
Write-Host "  HOMEPATH = $env:HOMEPATH" -ForegroundColor Gray
Write-Host "  USER_DIR = $env:USER_DIR" -ForegroundColor Gray
Write-Host ""
#endregion

# Test path resolution (can be removed in production)
Write-Host "[DEBUG] Path Resolution Test:" -ForegroundColor Magenta
Write-Host "  Script Path: $scriptCurrentPath" -ForegroundColor Gray
Write-Host "  Scripts Dir: $scriptsDirPath" -ForegroundColor Gray
Write-Host "  Shells Dir: $shellsDirPath" -ForegroundColor Gray
Write-Host "  Win Dir: $winDirPath" -ForegroundColor Gray
Write-Host "  Win Common Dir: $winCommonDirPath" -ForegroundColor Gray
Write-Host "  PyTools Dir: $pytoolsDirPath" -ForegroundColor Gray
Write-Host "  AI Tools Dir: $aiToolsDirPath" -ForegroundColor Gray
Write-Host "  User Profile: $userProfilePath" -ForegroundColor Gray
Write-Host "  User Home: $userHomePath" -ForegroundColor Gray
Write-Host "  Users Directory: $usersDirectoryPath" -ForegroundColor Gray
Write-Host ""
#endregion
"""

    @staticmethod
    def _has_model_var(variables: List[Dict[str, Any]]) -> bool:
        for var in variables:
            if var.get('Name') == 'ANTHROPIC_MODEL':
                return True
        return False

    @staticmethod
    def _has_codex_model_var(variables: List[Dict[str, Any]]) -> bool:
        for var in variables:
            if var.get('Name') == 'CODEX_MODEL':
                return True
        return False

    def generate_codex_upgrade_prompt_section(self) -> str:
        """Codex-only: npm upgrade prompt at the SCRIPT START (default y/N).

        Runs `npm install -g @openai/codex` when the user confirms - the latest
        Codex CLI is installed/upgraded before any env/config step."""
        return """
#region Upgrade Codex CLI (npm)
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Codex CLI - Upgrade Check" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
$codexUpgradeChoice = Read-Host "Upgrade Codex CLI via 'npm install -g @openai/codex'? (y/N)"
if ($codexUpgradeChoice -eq "y" -or $codexUpgradeChoice -eq "Y") {
    Write-Host "[INFO] Running: npm install -g @openai/codex" -ForegroundColor Cyan
    npm install -g "@openai/codex"
    Write-Host "[SUCCESS] Codex CLI upgrade complete" -ForegroundColor Green
} else {
    Write-Host "[INFO] Skipping Codex CLI upgrade" -ForegroundColor Cyan
}
Write-Host ""
#endregion

"""

    def generate_codex_personalized_config_section(self, has_codex_model: bool) -> str:
        """Codex-only: write ~/.codex/config.toml (model + latest features) and a
        personalized global AGENTS.md. Idempotent - never clobbers an existing
        user-edited config/AGENTS.md. Uses the REAL user profile (no custom dir)."""
        model_line = "$codexModel = $env:CODEX_MODEL"
        if not has_codex_model:
            model_line = '$codexModel = ""'
        return f"""
#region Codex Personalized Configuration (config.toml + AGENTS.md)
# Latest Codex CLI features: model + approval_policy + sandbox_mode + reasoning.
# Uses the REAL $env:USERPROFILE (no custom user dir) -> ~/.codex.
$codexHome = Join-Path $env:USERPROFILE ".codex"
if (-not (Test-Path $codexHome)) {{
    New-Item -ItemType Directory -Path $codexHome -Force | Out-Null
    Write-Host "[INFO] Created Codex home: $codexHome" -ForegroundColor Cyan
}}

# --- config.toml (model + approval + sandbox + reasoning) ---
$configTomlPath = Join-Path $codexHome "config.toml"
{model_line}
if ([string]::IsNullOrWhiteSpace($codexModel)) {{ $codexModel = "gpt-5-codex" }}
$configTomlContent = @"
# Codex CLI configuration (managed by core_node Special Software Env Manager)
model = "$codexModel"
model_reasoning_effort = "medium"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
"@
$writeCodexConfig = $true
if (Test-Path $configTomlPath) {{
    $existingCodexConfig = Get-Content $configTomlPath -Raw -ErrorAction SilentlyContinue
    if ($existingCodexConfig -and ($existingCodexConfig -match "^model\\s*=")) {{
        $writeCodexConfig = $false
    }}
}}
if ($writeCodexConfig) {{
    $configTomlContent | Out-File -FilePath $configTomlPath -Encoding UTF8 -Force
    Write-Host "[INFO] Wrote Codex config.toml (model=$codexModel): $configTomlPath" -ForegroundColor Cyan
}} else {{
    Write-Host "[INFO] Codex config.toml already exists (kept): $configTomlPath" -ForegroundColor Gray
}}

# --- Global AGENTS.md (personalized instructions) ---
$agentsMdPath = Join-Path $codexHome "AGENTS.md"
$agentsMdContent = @"
# Codex Global Instructions

- Write all code, comments, logs, and commit messages in English.
- Follow the project's AGENTS.md / CLAUDE.md conventions when present.
- Prefer reusing/upgrading existing components over reinventing.
- Keep changes minimal, idempotent, and aligned with surrounding code style.
- Never execute destructive actions without explicit approval.
- Declare variables at the top of each file; no relative paths in PowerShell.
"@
if (-not (Test-Path $agentsMdPath)) {{
    $agentsMdContent | Out-File -FilePath $agentsMdPath -Encoding UTF8 -Force
    Write-Host "[INFO] Wrote Codex global AGENTS.md: $agentsMdPath" -ForegroundColor Cyan
}} else {{
    Write-Host "[INFO] Codex AGENTS.md already exists (kept): $agentsMdPath" -ForegroundColor Gray
}}
Write-Host "[INFO] Codex model: $codexModel (config.toml)" -ForegroundColor White
#endregion

"""

    def generate_command_content(self, config_name: str, command_prefix: str,
                                ps_command: str, file_number: int,
                                variables: List[Dict[str, Any]],
                                mcp_section: str = "", file_name: str = "") -> str:
        """Generate complete PowerShell command content"""
        has_model = self._has_model_var(variables)

        # Add --dangerously-skip-permissions for claude commands
        # Add --yolo for codex commands
        if ps_command == "claude":
            base_cmd = "claude"
            ps_command = "claude --dangerously-skip-permissions"
        elif ps_command == "codex":
            base_cmd = "codex"
            ps_command = "codex --yolo"
        else:
            base_cmd = ps_command
        
        header = f"""# ### AI SPECIAL ATTENTION RULES START ###
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

<#
.SYNOPSIS
    {config_name} Global File #{file_number}

.DESCRIPTION
    This file is automatically generated by Special Software Environment Manager
    Contains environment variable setup, MCP synchronization and tool startup functionality

.NOTES
    - Tool Name: {config_name}
    - Command Prefix: {command_prefix}
    - PowerShell Command: {ps_command}
    - File Number: {file_number}
    - File Name: {file_name}
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Ensure DISABLE_AUTOUPDATER is set for Claude Code
$env:DISABLE_AUTOUPDATER = "1"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"
"""

        file_name_display = ""
        if file_name:
            file_name_display = f"""
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Running: {file_name}" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
"""

        # Generate environment variable loading section
        env_loading_section = self.env_loading_generator.generate_windows_env_loading_section(variables, file_number)

        # Generate model configuration section (Claude Code specific)
        model_section = ""
        if has_model:
            model_section = """
#region Model Configuration
# If ANTHROPIC_MODEL is configured, force it everywhere (main + subagents + tiers).
if (-not [string]::IsNullOrWhiteSpace($env:ANTHROPIC_MODEL)) {
    $env:CLAUDE_CODE_SUBAGENT_MODEL = $env:ANTHROPIC_MODEL
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $env:ANTHROPIC_MODEL
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = $env:ANTHROPIC_MODEL
    Write-Host "Model: $env:ANTHROPIC_MODEL (forced: main + subagents + background)" -ForegroundColor White
} else {
    Write-Host "Model: account default (no ANTHROPIC_MODEL configured)" -ForegroundColor White
}
#endregion

"""
            ps_command = f"{base_cmd} --model $env:ANTHROPIC_MODEL --dangerously-skip-permissions"

        # Build command display code
        build_command_code = """
#region Build Launch Command Display
$envVarsParts = @()

"""
        for var in variables:
            build_command_code += f"""if ($env:{var['Name']}) {{
    $envVarsParts += "`$env:{var['Name']}='$($env:{var['Name']})'"
}}

"""

        build_command_code += f"""$envVarsCommand = $envVarsParts -join '; '
if ($envVarsCommand) {{
    $fullCommandDisplay = "$envVarsCommand; {ps_command}"
}} else {{
    $fullCommandDisplay = "{ps_command}"
}}
#endregion

"""

        env_section = env_loading_section + model_section + build_command_code + "\n"

        mcp_section_content = ""
        if mcp_section:
            mcp_section_content = f"""
#region MCP Server Synchronization
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "MCP Server Synchronization" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

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
                backup_restore_section = self.backup_restore_generator.generate_windows_backup_restore_section(
                    tool_type, tool_display_name, tool_type
                )

                # Generate repair and npx fallback section  
                npx_fallback_section = f"""
# AI Tool Repair and npx Fallback
if (-not (Get-Command {tool_type} -ErrorAction SilentlyContinue)) {{
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "Tool Not Found - Repair Options Available" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "[WARNING] {tool_display_name} command not available" -ForegroundColor Yellow
    Write-Host ""
    
    # Code Relationship: Generated scripts -> dd.sh smart permissions (Linux only)
    # Windows scripts detect missing tools and suggest Linux dd.sh for comprehensive repair
    # dd.sh smart_permissions.sh provides full repair functionality on Linux systems
    Write-Host "[SOLUTION] For comprehensive tool repair:" -ForegroundColor Cyan
    Write-Host "  1. Switch to Linux/WSL environment" -ForegroundColor Gray
    Write-Host "  2. Run: sudo $projectRootPath/dd.sh" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[INFO] Linux dd.sh provides:" -ForegroundColor Cyan
    Write-Host "  - AI tools repair from user directories" -ForegroundColor Gray
    Write-Host "  - Package manager reinstallation" -ForegroundColor Gray
    Write-Host "  - Symlink fixing for /usr/local/bin" -ForegroundColor Gray
    Write-Host "  - Permission fixes for all components" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[INFO] On Windows: Using npx fallback (temporary solution)" -ForegroundColor Cyan
    Write-Host ""
}}

# Final check and npx fallback
if (-not (Get-Command {tool_type} -ErrorAction SilentlyContinue)) {{
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "Using npx Fallback (No Installation Required)" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "[INFO] Running {tool_display_name} via npx (temporary solution)" -ForegroundColor Cyan
    Write-Host "[INFO] For permanent fix: Use Linux environment + dd.sh" -ForegroundColor Cyan
    Write-Host ""

    # Generate npx fallback command
    $envVarsPartsNpx = @()
"""
                for var in variables:
                    npx_fallback_section += f"""    if ($env:{var['Name']}) {{
        $envVarsPartsNpx += "`$env:{var['Name']}='$($env:{var['Name']})'"
    }}
"""

                npx_fallback_section += f"""
    $envVarsCommandNpx = $envVarsPartsNpx -join '; '
    if ($envVarsCommandNpx) {{
        $fullCommandDisplay = "$envVarsCommandNpx; npx -y {npm_package}"
    }} else {{
        $fullCommandDisplay = "npx -y {npm_package}"
    }}

    Write-Host "[INFO] Using command: $fullCommandDisplay" -ForegroundColor Cyan
    Write-Host ""
}}

"""
                break

        launch_section = f"""
#region Launch Tool
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Press Enter to start {config_name}..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
$null = Read-Host "Press Enter to continue"

Write-Host ""
Write-Host "Executing: {ps_command}" -ForegroundColor White
Write-Host ""
Write-Host "PowerShell Command: powershell -NoProfile -ExecutionPolicy Bypass -Command `"$fullCommandDisplay`"" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Yellow
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
powershell -NoProfile -ExecutionPolicy Bypass -Command $fullCommandDisplay

Write-Host ""
pause
#endregion
"""

        # Generate custom user directory section (codex SKIPS it - no custom dir)
        is_codex = (command_prefix or "").lower() == "codex"
        if is_codex:
            custom_user_dir_section = ""
            codex_upgrade_section = self.generate_codex_upgrade_prompt_section()
            codex_config_section = self.generate_codex_personalized_config_section(
                self._has_codex_model_var(variables))
        else:
            custom_user_dir_section = self.generate_custom_user_directory_section()
            codex_upgrade_section = ""
            codex_config_section = ""

        # Codex: upgrade prompt at the SCRIPT START (before env/config); config
        # section after env loading. Custom user dir is skipped (real USERPROFILE).
        if is_codex:
            return f"""{header}{file_name_display}{codex_upgrade_section}{env_section}{codex_config_section}{mcp_section_content}{backup_restore_section}{npx_fallback_section}{launch_section}"""

        return f"""{header}{file_name_display}{custom_user_dir_section}{env_section}{mcp_section_content}{backup_restore_section}{npx_fallback_section}{launch_section}"""

    def generate_ssh_command_content(self, config_name: str, file_number: int,
                                    user_inputs: Dict[str, str], file_name: str = "") -> str:
        """Generate SSH connection PowerShell script"""
        return self.ssh_generator.generate_windows_ssh_command(config_name, file_number, file_name)
