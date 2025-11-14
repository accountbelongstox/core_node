#!/usr/bin/env python3
"""
Configuration Manager Module

Manages tool configurations for the Special Software Environment Manager.
"""

from typing import Dict, Any, Optional


class ConfigManager:
    """Manages tool configurations"""

    def __init__(self):
        self._configs = self._load_configs()

    def _load_configs(self) -> Dict[str, Dict[str, Any]]:
        """Load all tool configurations"""
        return {
            'Claude AI': {
                'Common': 'claude',
                'DisplayName': 'Claude AI',
                'CommandPrefix': 'claude',
                'WindowsCommand': 'claude',
                'LinuxCommand': 'claude',
                'Variables': [
                    {
                        'Name': 'ANTHROPIC_BASE_URL',
                        'Description': 'Anthropic API Base URL',
                        'Required': True
                    },
                    {
                        'Name': 'ANTHROPIC_AUTH_TOKEN',
                        'Description': 'Anthropic Authentication Token',
                        'Required': True
                    },
                    {
                        'Name': 'ANTHROPIC_API_KEY',
                        'Description': 'Anthropic API Key',
                        'Required': True
                    }
                ],
                'MCPSupport': {
                    'Enabled': True,
                    'SyncScript': 'claude_sync_mcp_servers.py',
                    'PreLaunchScript': 'claude_pre_launch.ps1',
                    'UpdateScript': 'claude_update.bat'
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'Codex CLI': {
                'Common': 'codex',
                'DisplayName': 'Codex CLI',
                'CommandPrefix': 'codex',
                'WindowsCommand': 'codex',
                'LinuxCommand': 'codex',
                'Variables': [
                    {
                        'Name': 'OPENAI_API_KEY',
                        'Description': 'OpenAI API Key',
                        'Required': True
                    },
                    {
                        'Name': 'OPENAI_BASE_URL',
                        'Description': 'OpenAI API Base URL',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': True,
                    'SyncScript': 'codex_sync_mcp_servers.py',
                    'PreLaunchScript': 'codex_pre_launch.ps1',
                    'UpdateScript': 'codex_update.bat'
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'SSH Connection': {
                'Common': 'ssh',
                'DisplayName': 'SSH Connection',
                'CommandPrefix': 'ssh',
                'WindowsCommand': '',
                'LinuxCommand': '',
                'Variables': [
                    {
                        'Name': 'SSH_CONNECTION',
                        'Description': 'SSH Connection String (e.g., user@host)',
                        'Required': True
                    },
                    {
                        'Name': 'SSH_PASSWORD',
                        'Description': 'SSH Password (optional, uses SSH key if not provided)',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': False
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            }
        }

    def get_all_configs(self) -> Dict[str, Dict[str, Any]]:
        """Get all tool configurations"""
        return self._configs

    def get_config(self, config_name: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a specific tool"""
        return self._configs.get(config_name)

    def get_config_by_common(self, common_name: str) -> Optional[Dict[str, Any]]:
        """Get configuration by common name"""
        for config_name, config in self._configs.items():
            if config.get('Common') == common_name:
                return config
        return None


__all__ = ['ConfigManager']

