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
                    },
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
            },
            'Factory AI Droid': {
                'Common': 'droid',
                'DisplayName': 'Factory AI Droid',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'DROID_API_URL',
                        'DisplayName': 'Droid API URL',
                        'Description': 'Factory AI Droid API URL',
                        'InputType': 'Url',
                        'Required': True
                    },
                    {
                        'Name': 'DROID_API_KEY',
                        'DisplayName': 'Droid API Key',
                        'Description': 'Factory AI Droid API Key',
                        'InputType': 'Token',
                        'Required': True
                    }
                ],
                'MCPSupport': {
                    'Enabled': False
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'Azure Speech': {
                'Common': 'azure_speech',
                'DisplayName': 'Azure Speech',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'AZURE_SPEECH_KEYA',
                        'DisplayName': 'Azure Speech Key A',
                        'Description': 'Azure Speech Service API Key A',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'AZURE_SPEECH_KEYB',
                        'DisplayName': 'Azure Speech Key B',
                        'Description': 'Azure Speech Service API Key B',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'AZURE_SPEECH_REGION',
                        'DisplayName': 'Azure Speech Region',
                        'Description': 'Azure Speech Service Region (e.g., eastus)',
                        'InputType': 'Text',
                        'Required': True
                    },
                    {
                        'Name': 'AZURE_SPEECH_ENDPOINT',
                        'DisplayName': 'Azure Speech Endpoint',
                        'Description': 'Azure Speech Service Endpoint URL',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': False
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'OpenRouter': {
                'Common': 'openrouter',
                'DisplayName': 'OpenRouter',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'OPENROUTER_API_KEY',
                        'DisplayName': 'OpenRouter API Key',
                        'Description': 'OpenRouter API Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'OPENROUTER_BASE_URL',
                        'DisplayName': 'OpenRouter Base URL',
                        'Description': 'OpenRouter API Base URL (default: https://openrouter.ai/api/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': False
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'Alibaba Cloud': {
                'Common': 'alibaba_cloud',
                'DisplayName': 'Alibaba Cloud',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'ALIBABA_ACCESS_KEY_ID',
                        'DisplayName': 'Alibaba Access Key ID',
                        'Description': 'Alibaba Cloud Access Key ID',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'ALIBABA_ACCESS_KEY_SECRET',
                        'DisplayName': 'Alibaba Access Key Secret',
                        'Description': 'Alibaba Cloud Access Key Secret',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'ALIBABA_REGION',
                        'DisplayName': 'Alibaba Region',
                        'Description': 'Alibaba Cloud Region (e.g., cn-hangzhou)',
                        'InputType': 'Text',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': False
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'Tencent Cloud': {
                'Common': 'tencent_cloud',
                'DisplayName': 'Tencent Cloud',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'TENCENT_SECRET_ID',
                        'DisplayName': 'Tencent Secret ID',
                        'Description': 'Tencent Cloud Secret ID',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'TENCENT_SECRET_KEY',
                        'DisplayName': 'Tencent Secret Key',
                        'Description': 'Tencent Cloud Secret Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'TENCENT_REGION',
                        'DisplayName': 'Tencent Region',
                        'Description': 'Tencent Cloud Region (e.g., ap-beijing)',
                        'InputType': 'Text',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': False
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'Project Domains': {
                'Common': 'project_domains',
                'DisplayName': 'Project Domains',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'PROJECT_DOMAIN',
                        'DisplayName': 'Project Domain',
                        'Description': 'Main project domain (e.g., example.com)',
                        'InputType': 'Text',
                        'Required': True
                    },
                    {
                        'Name': 'PROJECT_SUBDOMAINS',
                        'DisplayName': 'Project Subdomains',
                        'Description': 'Comma-separated list of subdomains (e.g., api.example.com,www.example.com)',
                        'InputType': 'Text',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': False
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'Laravel Domains': {
                'Common': 'laravel_domains',
                'DisplayName': 'Laravel Domains',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'LARAVEL_APP_URL',
                        'DisplayName': 'Laravel App URL',
                        'Description': 'Laravel application URL (e.g., https://laravel.example.com)',
                        'InputType': 'Url',
                        'Required': True
                    },
                    {
                        'Name': 'LARAVEL_API_URL',
                        'DisplayName': 'Laravel API URL',
                        'Description': 'Laravel API URL (e.g., https://api.laravel.example.com)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': False
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'Nuxt Domains': {
                'Common': 'nuxt_domains',
                'DisplayName': 'Nuxt Domains',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'NUXT_APP_URL',
                        'DisplayName': 'Nuxt App URL',
                        'Description': 'Nuxt application URL (e.g., https://nuxt.example.com)',
                        'InputType': 'Url',
                        'Required': True
                    },
                    {
                        'Name': 'NUXT_API_URL',
                        'DisplayName': 'Nuxt API URL',
                        'Description': 'Nuxt API URL (e.g., https://api.nuxt.example.com)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': False
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'Context7': {
                'Common': 'context7',
                'DisplayName': 'Context7',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'CONTEXT7_API_KEY',
                        'DisplayName': 'Context7 API Key',
                        'Description': 'Context7 API Key (format: ctx7sk-...)',
                        'InputType': 'Token',
                        'Required': True
                    }
                ],
                'MCPSupport': {
                    'Enabled': True
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

