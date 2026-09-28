"""
Generators Module

Contains command content generators for Windows and Linux.
"""

from abc import ABC
from pathlib import Path
from typing import Any, Dict, List

from config.path_config import get_path_config
from script_sections.backup_restore_section import BackupRestoreSectionGenerator
from script_sections.env_loading_section import EnvLoadingSectionGenerator
from script_sections.mcp_section import MCPSectionGenerator
from script_sections.ssh_command_generator import SSHCommandGenerator
from script_sections.user_directory_section import UserDirectorySectionGenerator


# Tools provisioned by the shared launcher helpers (install if missing + upgrade
# prompt). The tool table itself lives in the helpers, so packages and upgrade
# commands are defined once per platform, never duplicated in generated scripts.
CLI_PROVISION_TOOLS = ('claude', 'codex', 'kimi')

LINUX_CLI_PROVISION_SECTION = '''
#region AI CLI Provisioning (install if missing + idempotent upgrade prompt)
aiCliProvisionSource="${BASH_SOURCE[0]}"
aiCliProvisionScriptsDir=""
aiCliProvisionCommonPath=""
if [ -L "$aiCliProvisionSource" ]; then
    aiCliProvisionSource="$(readlink -f "$aiCliProvisionSource" 2>/dev/null || echo "$aiCliProvisionSource")"
fi
aiCliProvisionScriptsDir="$(cd "$(dirname "$aiCliProvisionSource")/.." && pwd)"
aiCliProvisionCommonPath="$aiCliProvisionScriptsDir/shells/linux/common/ai_cli_provision_common.sh"
. "$aiCliProvisionCommonPath"
ai_cli_provision "__TOOL__"
#endregion

'''

WINDOWS_CLI_PROVISION_SECTION = '''
#region AI CLI Provisioning (install if missing + idempotent upgrade prompt)
$aiCliProvisionActualPath = $PSCommandPath
$aiCliProvisionItem = Get-Item -LiteralPath $PSCommandPath
$aiCliProvisionScriptsDir = $null
$aiCliProvisionCommonPath = $null
if ($aiCliProvisionItem -and $aiCliProvisionItem.LinkType) {
    $aiCliProvisionActualPath = $aiCliProvisionItem.Target
}
$aiCliProvisionScriptsDir = Split-Path (Split-Path $aiCliProvisionActualPath -Parent) -Parent
$aiCliProvisionCommonPath = Join-Path $aiCliProvisionScriptsDir "shells\\win\\win_common\\AiCliProvisionCommon.ps1"
. $aiCliProvisionCommonPath
Invoke-AiCliProvision -Tool "__TOOL__"
#endregion

'''


class CommandContentGeneratorBase(ABC):
    """Share platform-neutral command generator behavior."""

    def __init__(self, platform: str):
        self.platform = platform
        self.path_config = get_path_config()
        self.project_root = self.path_config.project_root
        self.scripts_dir = self.path_config.scripts_dir
        self.mcp_generator = MCPSectionGenerator(self.path_config)
        self.user_dir_generator = UserDirectorySectionGenerator()
        self.env_loading_generator = EnvLoadingSectionGenerator()
        self.ssh_generator = SSHCommandGenerator()
        self.backup_restore_generator = BackupRestoreSectionGenerator(self.path_config)

    def get_mcp_sync_script_path(self, tool_type: str) -> Path:
        """Get the MCP sync script path for a tool."""
        return self.path_config.get_mcp_sync_script_path(tool_type)

    def get_pre_launch_script_path(self, tool_type: str) -> Path:
        """Get the platform pre-launch script path for a tool."""
        return self.path_config.get_pre_launch_script_path(tool_type, self.platform)

    def get_update_script_path(self, tool_type: str) -> Path:
        """Get the platform update script path for a tool."""
        return self.path_config.get_update_script_path(tool_type, self.platform)

    def generate_mcp_section(
        self,
        tool_type: str,
        tool_display_name: str,
        target_name: str,
        support_upgrade: bool = True,
        support_npm_update: bool = False,
        include_launch_pause: bool = True,
    ) -> str:
        """Generate the platform MCP synchronization section."""
        generator_name = f'generate_{self.platform}_mcp_section'
        generator = getattr(self.mcp_generator, generator_name)
        return generator(
            tool_type,
            tool_display_name,
            target_name,
            support_upgrade,
            support_npm_update,
            include_launch_pause,
        )

    @staticmethod
    def _has_variable(variables: List[Dict[str, Any]], variable_name: str) -> bool:
        return any(variable.get('Name') == variable_name for variable in variables)

    def _has_model_var(self, variables: List[Dict[str, Any]]) -> bool:
        return self._has_variable(variables, 'ANTHROPIC_MODEL')

    def _has_codex_model_var(self, variables: List[Dict[str, Any]]) -> bool:
        return self._has_variable(variables, 'CODEX_MODEL')

    def _has_kimi_var(self, variables: List[Dict[str, Any]]) -> bool:
        return self._has_variable(variables, 'KIMI_API_KEY')

    def generate_cli_provision_section(self, command_prefix: str) -> str:
        """Generate the shared provisioning section for a supported CLI.

        The emitted section only locates and sources the platform helper
        (ai_cli_provision_common.sh / AiCliProvisionCommon.ps1), which installs
        the CLI when missing and prompts for an upgrade when a newer version is
        published (default N, auto-skip after 5 seconds).
        """
        normalized_prefix = (command_prefix or '').lower()
        if normalized_prefix not in CLI_PROVISION_TOOLS:
            return ''
        template = (
            WINDOWS_CLI_PROVISION_SECTION if self.platform == 'windows'
            else LINUX_CLI_PROVISION_SECTION
        )
        return template.replace('__TOOL__', normalized_prefix)


__all__ = [
    'CLI_PROVISION_TOOLS',
    'CommandContentGeneratorBase',
    'WindowsCommandContentGenerator',
    'LinuxCommandContentGenerator',
]
