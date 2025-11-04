"""
Configuration Manager Module

Manages configurations for different AI tools and software.
Replaces the configuration system from the original PowerShell modules.
"""

from typing import Dict, List, Any


class ConfigManager:
    """Manages environment configurations for different tools"""

    def __init__(self):
        self.configs = {}
        self._initialize_configs()

    def _initialize_configs(self):
        """Initialize all tool configurations"""
        self.configs['Claude AI'] = self.get_claude_config()
        self.configs['OpenAI'] = self.get_openai_config()
        self.configs['Factory AI Droid'] = self.get_droid_config()
        self.configs['SSH Connection'] = self.get_ssh_config()

    @staticmethod
    def get_claude_config() -> Dict[str, Any]:
        """Get Claude AI configuration"""
        return {
            'Title': 'Claude AI Environment Variables',
            'Description': 'Set up Claude AI environment variables for API access',
            'Common': 'claude',
            'CommandPrefix': 'claude',
            'DisplayName': 'Claude AI',
            'SmartRecognition': {
                'Enabled': True,
                'AllowedTypes': ['token', 'url']
            },
            'Variables': [
                {
                    'Name': 'ANTHROPIC_BASE_URL',
                    'DisplayName': 'ANTHROPIC_BASE_URL',
                    'Description': 'Claude AI API base URL',
                    'IsSecret': False,
                    'InputType': 'Url'
                },
                {
                    'Name': 'ANTHROPIC_AUTH_TOKEN',
                    'DisplayName': 'ANTHROPIC_AUTH_TOKEN',
                    'Description': 'Claude AI authentication token',
                    'IsSecret': True,
                    'InputType': 'Token'
                },
                {
                    'Name': 'ANTHROPIC_API_KEY',
                    'DisplayName': 'ANTHROPIC_API_KEY',
                    'Description': 'Claude AI API key (alternative to ANTHROPIC_AUTH_TOKEN)',
                    'IsSecret': True,
                    'InputType': 'Token'
                }
            ]
        }

    @staticmethod
    def get_openai_config() -> Dict[str, Any]:
        """Get OpenAI configuration"""
        return {
            'Title': 'OpenAI Environment Variables',
            'Description': 'Set up OpenAI environment variables for API access',
            'Common': 'openai',
            'CommandPrefix': 'openai',
            'DisplayName': 'OpenAI',
            'SmartRecognition': {
                'Enabled': True,
                'AllowedTypes': ['token', 'url']
            },
            'Variables': [
                {
                    'Name': 'OPENAI_API_BASE',
                    'DisplayName': 'OPENAI_API_BASE',
                    'Description': 'OpenAI API base URL',
                    'IsSecret': False,
                    'InputType': 'Url'
                },
                {
                    'Name': 'OPENAI_API_KEY',
                    'DisplayName': 'OPENAI_API_KEY',
                    'Description': 'OpenAI API key',
                    'IsSecret': True,
                    'InputType': 'Token'
                }
            ]
        }

    @staticmethod
    def get_droid_config() -> Dict[str, Any]:
        """Get Factory AI Droid configuration"""
        return {
            'Title': 'Factory AI Droid Environment Variables',
            'Description': 'Set up Factory AI Droid environment variables',
            'Common': 'droid',
            'CommandPrefix': 'droid',
            'DisplayName': 'Factory AI Droid',
            'SmartRecognition': {
                'Enabled': True,
                'AllowedTypes': ['token', 'url']
            },
            'Variables': [
                {
                    'Name': 'DROID_API_URL',
                    'DisplayName': 'DROID_API_URL',
                    'Description': 'Factory AI Droid API URL',
                    'IsSecret': False,
                    'InputType': 'Url'
                },
                {
                    'Name': 'DROID_API_KEY',
                    'DisplayName': 'DROID_API_KEY',
                    'Description': 'Factory AI Droid API key',
                    'IsSecret': True,
                    'InputType': 'Token'
                }
            ]
        }

    @staticmethod
    def get_ssh_config() -> Dict[str, Any]:
        """Get SSH Connection configuration"""
        return {
            'Title': 'SSH Connection Configuration',
            'Description': 'Set up SSH connection parameters',
            'Common': 'ssh',
            'CommandPrefix': 'ssh',
            'DisplayName': 'SSH Connection',
            'SmartRecognition': {
                'Enabled': False,
                'AllowedTypes': []
            },
            'Variables': [
                {
                    'Name': 'SSH_CONNECTION',
                    'DisplayName': 'SSH_CONNECTION',
                    'Description': 'SSH connection string (e.g., user@host)',
                    'IsSecret': False,
                    'InputType': 'Text'
                },
                {
                    'Name': 'SSH_PASSWORD',
                    'DisplayName': 'SSH_PASSWORD',
                    'Description': 'SSH password (optional, for password authentication)',
                    'IsSecret': True,
                    'InputType': 'Password'
                }
            ]
        }

    def get_config(self, config_name: str) -> Dict[str, Any]:
        """Get configuration by name"""
        return self.configs.get(config_name)

    def get_all_configs(self) -> Dict[str, Dict[str, Any]]:
        """Get all configurations"""
        return self.configs

    def get_config_display_name(self, config_name: str) -> str:
        """Get display name for a configuration"""
        config = self.get_config(config_name)
        return config['DisplayName'] if config else config_name

    def get_command_prefix(self, config_name: str) -> str:
        """Get command prefix for a configuration"""
        config = self.get_config(config_name)
        if config:
            return config.get('CommandPrefix', config.get('Common', ''))
        return ''
