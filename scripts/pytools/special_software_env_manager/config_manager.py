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
        self.configs['Codex CLI'] = self.get_codex_config()
        self.configs['Factory AI Droid'] = self.get_droid_config()
        self.configs['SSH Connection'] = self.get_ssh_config()
        # Cloud Services
        self.configs['Azure Speech'] = self.get_azure_speech_config()
        self.configs['OpenRouter'] = self.get_openrouter_config()
        self.configs['Alibaba Cloud'] = self.get_alibaba_cloud_config()
        self.configs['Tencent Cloud'] = self.get_tencent_cloud_config()
        # Project Constants
        self.configs['Project Domains'] = self.get_project_domains_config()
        self.configs['Laravel Domains'] = self.get_laravel_domains_config()
        self.configs['Nuxt Domains'] = self.get_nuxt_domains_config()

    @staticmethod
    def get_claude_config() -> Dict[str, Any]:
        """Get Claude AI configuration"""
        return {
            'Title': 'Claude AI Environment Variables',
            'Description': 'Set up Claude AI environment variables for API access',
            'Common': 'claude',
            'CommandPrefix': 'claude',
            'DisplayName': 'Claude AI',
            'WindowsCommand': 'claude',
            'LinuxCommand': 'claude',
            'SmartRecognition': {
                'Enabled': True,
                'AllowedTypes': ['token', 'url']
            },
            'MCPSupport': {
                'Enabled': True,
                'PreLaunchScript': {
                    'Windows': 'D:\\programing\\core_node\\scripts\\pytools\\ai_tools\\claude_pre_launch.ps1',
                    'Linux': '/d/programing/core_node/scripts/pytools/ai_tools/claude_pre_launch.sh'
                },
                'UpgradeScript': {
                    'Windows': 'D:\\programing\\core_node\\scripts\\pytools\\ai_tools\\claude_update.bat',
                    'Linux': '/d/programing/core_node/scripts/pytools/ai_tools/claude_update.sh'
                },
                'MCPSyncScript': 'D:\\programing\\core_node\\scripts\\pytools\\ai_tools\\claude_sync_mcp_servers.py'
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
    def get_codex_config() -> Dict[str, Any]:
        """Get Codex CLI configuration"""
        return {
            'Title': 'Codex CLI Environment Variables',
            'Description': 'Set up Codex CLI environment variables for API access',
            'Common': 'codex',
            'CommandPrefix': 'codex',
            'DisplayName': 'Codex CLI',
            'WindowsCommand': 'codex',
            'LinuxCommand': 'codex',
            'SmartRecognition': {
                'Enabled': True,
                'AllowedTypes': ['token', 'url']
            },
            'MCPSupport': {
                'Enabled': True,
                'PreLaunchScript': {
                    'Windows': 'D:\\programing\\core_node\\scripts\\pytools\\ai_tools\\codex_pre_launch.ps1',
                    'Linux': '/d/programing/core_node/scripts/pytools/ai_tools/codex_pre_launch.sh'
                },
                'UpgradeScript': {
                    'Windows': 'D:\\programing\\core_node\\scripts\\pytools\\ai_tools\\codex_update.bat',
                    'Linux': '/d/programing/core_node/scripts/pytools/ai_tools/codex_update.sh'
                },
                'MCPSyncScript': 'D:\\programing\\core_node\\scripts\\pytools\\ai_tools\\codex_sync_mcp_servers.py'
            },
            'Variables': [
                {
                    'Name': 'OPENAI_API_KEY',
                    'DisplayName': 'OPENAI_API_KEY',
                    'Description': 'OpenAI API key for Codex',
                    'IsSecret': True,
                    'InputType': 'Token'
                },
                {
                    'Name': 'OPENAI_BASE_URL',
                    'DisplayName': 'OPENAI_BASE_URL',
                    'Description': 'OpenAI API base URL',
                    'IsSecret': False,
                    'InputType': 'Url'
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
            'WindowsCommand': 'droid',
            'LinuxCommand': 'droid',
            'SmartRecognition': {
                'Enabled': True,
                'AllowedTypes': ['token', 'url']
            },
            'MCPSupport': {
                'Enabled': True,
                'PreLaunchScript': {
                    'Windows': 'D:\\programing\\core_node\\scripts\\pytools\\ai_tools\\droid_pre_launch.ps1',
                    'Linux': '/d/programing/core_node/scripts/pytools/ai_tools/droid_pre_launch.sh'
                },
                'UpgradeScript': {
                    'Windows': 'D:\\programing\\core_node\\scripts\\pytools\\ai_tools\\droid_update.bat',
                    'Linux': '/d/programing/core_node/scripts/pytools/ai_tools/droid_update.sh'
                },
                'MCPSyncScript': 'D:\\programing\\core_node\\scripts\\pytools\\ai_tools\\claude_sync_mcp_servers.py'
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
            'WindowsCommand': 'ssh',
            'LinuxCommand': 'ssh',
            'SmartRecognition': {
                'Enabled': False,
                'AllowedTypes': []
            },
            'MCPSupport': {
                'Enabled': False
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

    @staticmethod
    def get_azure_speech_config() -> Dict[str, Any]:
        """Get Azure Speech Services configuration"""
        return {
            'Title': 'Azure Speech Services Configuration',
            'Description': 'Set up Azure Speech API keys',
            'Common': 'azure_speech',
            'CommandPrefix': '',  # No script generation
            'DisplayName': 'Azure Speech',
            'WindowsCommand': '',
            'LinuxCommand': '',
            'SmartRecognition': {
                'Enabled': False,
                'AllowedTypes': []
            },
            'MCPSupport': {
                'Enabled': False
            },
            'Variables': [
                {
                    'Name': 'AZURE_SPEECH_KEY_A',
                    'DisplayName': 'AZURE_SPEECH_KEY_A',
                    'Description': 'Azure Speech API Key A',
                    'IsSecret': True,
                    'InputType': 'Token'
                },
                {
                    'Name': 'AZURE_SPEECH_KEY_B',
                    'DisplayName': 'AZURE_SPEECH_KEY_B',
                    'Description': 'Azure Speech API Key B',
                    'IsSecret': True,
                    'InputType': 'Token'
                }
            ]
        }

    @staticmethod
    def get_openrouter_config() -> Dict[str, Any]:
        """Get OpenRouter configuration"""
        return {
            'Title': 'OpenRouter Configuration',
            'Description': 'Set up OpenRouter LLM API credentials',
            'Common': 'openrouter',
            'CommandPrefix': '',  # No script generation
            'DisplayName': 'OpenRouter',
            'WindowsCommand': '',
            'LinuxCommand': '',
            'SmartRecognition': {
                'Enabled': False,
                'AllowedTypes': []
            },
            'MCPSupport': {
                'Enabled': False
            },
            'Variables': [
                {
                    'Name': 'OPENROUTER_LLM_NAME',
                    'DisplayName': 'OPENROUTER_LLM_NAME',
                    'Description': 'OpenRouter LLM model name',
                    'IsSecret': False,
                    'InputType': 'Text'
                },
                {
                    'Name': 'OPENROUTER_API_KEY',
                    'DisplayName': 'OPENROUTER_API_KEY',
                    'Description': 'OpenRouter API Key',
                    'IsSecret': True,
                    'InputType': 'Token'
                }
            ]
        }

    @staticmethod
    def get_alibaba_cloud_config() -> Dict[str, Any]:
        """Get Alibaba Cloud configuration"""
        return {
            'Title': 'Alibaba Cloud Configuration',
            'Description': 'Set up Alibaba Cloud API credentials',
            'Common': 'alibaba_cloud',
            'CommandPrefix': '',  # No script generation
            'DisplayName': 'Alibaba Cloud',
            'WindowsCommand': '',
            'LinuxCommand': '',
            'SmartRecognition': {
                'Enabled': False,
                'AllowedTypes': []
            },
            'MCPSupport': {
                'Enabled': False
            },
            'Variables': [
                {
                    'Name': 'ALIBABA_CLOUD_KEY_A',
                    'DisplayName': 'ALIBABA_CLOUD_KEY_A',
                    'Description': 'Alibaba Cloud API Key A',
                    'IsSecret': True,
                    'InputType': 'Token'
                },
                {
                    'Name': 'ALIBABA_CLOUD_KEY_B',
                    'DisplayName': 'ALIBABA_CLOUD_KEY_B',
                    'Description': 'Alibaba Cloud API Key B',
                    'IsSecret': True,
                    'InputType': 'Token'
                },
                {
                    'Name': 'ALIBABA_CLOUD_KEY_C',
                    'DisplayName': 'ALIBABA_CLOUD_KEY_C',
                    'Description': 'Alibaba Cloud API Key C',
                    'IsSecret': True,
                    'InputType': 'Token'
                }
            ]
        }

    @staticmethod
    def get_tencent_cloud_config() -> Dict[str, Any]:
        """Get Tencent Cloud configuration"""
        return {
            'Title': 'Tencent Cloud Configuration',
            'Description': 'Set up Tencent Cloud DNS credentials',
            'Common': 'tencent_cloud',
            'CommandPrefix': '',  # No script generation
            'DisplayName': 'Tencent Cloud',
            'WindowsCommand': '',
            'LinuxCommand': '',
            'SmartRecognition': {
                'Enabled': False,
                'AllowedTypes': []
            },
            'MCPSupport': {
                'Enabled': False
            },
            'Variables': [
                {
                    'Name': 'DNS_DNSPOD_ID',
                    'DisplayName': 'DNS_DNSPOD_ID',
                    'Description': 'DNSPod API ID',
                    'IsSecret': False,
                    'InputType': 'Text'
                },
                {
                    'Name': 'DNS_DNSPOD_EMAIL',
                    'DisplayName': 'DNS_DNSPOD_EMAIL',
                    'Description': 'DNSPod account email',
                    'IsSecret': False,
                    'InputType': 'Email'
                }
            ]
        }

    @staticmethod
    def get_project_domains_config() -> Dict[str, Any]:
        """Get Project Domains configuration"""
        return {
            'Title': 'Project Domains Configuration',
            'Description': 'Set up project domain names',
            'Common': 'project_domains',
            'CommandPrefix': '',  # No script generation
            'DisplayName': 'Project Domains',
            'WindowsCommand': '',
            'LinuxCommand': '',
            'SmartRecognition': {
                'Enabled': False,
                'AllowedTypes': []
            },
            'MCPSupport': {
                'Enabled': False
            },
            'Variables': [
                {
                    'Name': 'PROJECT_MAIN_DOMAIN',
                    'DisplayName': 'PROJECT_MAIN_DOMAIN',
                    'Description': 'Main project domain name',
                    'IsSecret': False,
                    'InputType': 'Text'
                }
            ]
        }

    @staticmethod
    def get_laravel_domains_config() -> Dict[str, Any]:
        """Get Laravel Domains configuration"""
        return {
            'Title': 'Laravel Application Domains Configuration',
            'Description': 'Set up Laravel application domains and SSL certificates',
            'Common': 'laravel_domains',
            'CommandPrefix': '',  # No script generation
            'DisplayName': 'Laravel Domains',
            'WindowsCommand': '',
            'LinuxCommand': '',
            'SmartRecognition': {
                'Enabled': False,
                'AllowedTypes': []
            },
            'MCPSupport': {
                'Enabled': False
            },
            'Variables': [
                {
                    'Name': 'LARAVEL_APP_NAME',
                    'DisplayName': 'LARAVEL_APP_NAME',
                    'Description': 'Laravel application name',
                    'IsSecret': False,
                    'InputType': 'Text'
                },
                {
                    'Name': 'LARAVEL_APP_DOMAIN',
                    'DisplayName': 'LARAVEL_APP_DOMAIN',
                    'Description': 'Laravel application domain',
                    'IsSecret': False,
                    'InputType': 'Text'
                },
                {
                    'Name': 'LARAVEL_SSL_CERT_INFO',
                    'DisplayName': 'LARAVEL_SSL_CERT_INFO',
                    'Description': 'SSL certificate information for Laravel app',
                    'IsSecret': True,
                    'InputType': 'Text'
                }
            ]
        }

    @staticmethod
    def get_nuxt_domains_config() -> Dict[str, Any]:
        """Get Nuxt Domains configuration"""
        return {
            'Title': 'Nuxt Application Domains Configuration',
            'Description': 'Set up Nuxt application domains and SSL certificates',
            'Common': 'nuxt_domains',
            'CommandPrefix': '',  # No script generation
            'DisplayName': 'Nuxt Domains',
            'WindowsCommand': '',
            'LinuxCommand': '',
            'SmartRecognition': {
                'Enabled': False,
                'AllowedTypes': []
            },
            'MCPSupport': {
                'Enabled': False
            },
            'Variables': [
                {
                    'Name': 'NUXT_APP_NAME',
                    'DisplayName': 'NUXT_APP_NAME',
                    'Description': 'Nuxt application name',
                    'IsSecret': False,
                    'InputType': 'Text'
                },
                {
                    'Name': 'NUXT_APP_DOMAIN',
                    'DisplayName': 'NUXT_APP_DOMAIN',
                    'Description': 'Nuxt application domain',
                    'IsSecret': False,
                    'InputType': 'Text'
                },
                {
                    'Name': 'NUXT_SSL_CERT_INFO',
                    'DisplayName': 'NUXT_SSL_CERT_INFO',
                    'Description': 'SSL certificate information for Nuxt app',
                    'IsSecret': True,
                    'InputType': 'Text'
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
