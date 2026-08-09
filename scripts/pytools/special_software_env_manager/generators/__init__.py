"""
Generators Module

Contains command content generators for Windows and Linux.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

from config.path_config import get_path_config
from script_sections.backup_restore_section import BackupRestoreSectionGenerator
from script_sections.env_loading_section import EnvLoadingSectionGenerator
from script_sections.mcp_section import MCPSectionGenerator
from script_sections.ssh_command_generator import SSHCommandGenerator
from script_sections.user_directory_section import UserDirectorySectionGenerator


@dataclass(frozen=True)
class CliUpgradeConfig:
    """Shared metadata for a version-aware CLI upgrade prompt."""

    command: str
    package: str
    prompt: str


CLI_UPGRADE_CONFIGS = {
    'claude': CliUpgradeConfig(
        command='claude',
        package='@anthropic-ai/claude-code',
        prompt="Upgrade Claude Code via 'claude update'? [N/y]: ",
    ),
    'codex': CliUpgradeConfig(
        command='codex',
        package='@openai/codex',
        prompt="Upgrade Codex CLI via 'pnpm add --global @openai/codex@latest'? [N/y]: ",
    ),
    'kimi': CliUpgradeConfig(
        command='kimi',
        package='@moonshot-ai/kimi-code',
        prompt='Upgrade Kimi Code CLI with the official native installer? [N/y]: ',
    ),
}


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

    def generate_cli_upgrade_prompt_section(self, command_prefix: str) -> str:
        """Generate a version-aware upgrade section for a supported CLI."""
        normalized_prefix = (command_prefix or '').lower()
        tool_config = CLI_UPGRADE_CONFIGS.get(normalized_prefix)
        if tool_config is None:
            return ''
        return self._render_cli_upgrade_prompt_section(normalized_prefix, tool_config)

    @abstractmethod
    def _render_cli_upgrade_prompt_section(
        self,
        command_prefix: str,
        tool_config: CliUpgradeConfig,
    ) -> str:
        """Render a platform-specific version-aware upgrade section."""
        raise NotImplementedError

__all__ = [
    'CliUpgradeConfig',
    'CommandContentGeneratorBase',
    'WindowsCommandContentGenerator',
    'LinuxCommandContentGenerator',
]
