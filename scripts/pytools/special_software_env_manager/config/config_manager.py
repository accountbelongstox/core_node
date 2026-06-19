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
                    'Enabled': True,
                    'SyncScript': 'droid_sync_mcp_servers.py',
                    'PreLaunchScript': 'droid_pre_launch.ps1',
                    'UpdateScript': 'droid_update.bat'
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
                        'Name': 'AZURE_SPEECH_KEY',
                        'DisplayName': 'Azure Speech Key',
                        'Description': 'Azure Speech subscription key (Key A or Key B; either works)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'AZURE_SPEECH_KEYB',
                        'DisplayName': 'Azure Speech Key (backup)',
                        'Description': 'Optional second Azure Speech key for rotation (Key B)',
                        'InputType': 'Token',
                        'Required': False
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
            },
            'Local Test Credentials': {
                'Common': 'local_test',
                'DisplayName': 'Local Test Credentials',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'LOCAL_TEST_PASSWORD',
                        'DisplayName': 'Local Test Password',
                        'Description': 'Password for local testing environment',
                        'InputType': 'Password',
                        'Required': True
                    },
                    {
                        'Name': 'LOCAL_TEST_API_KEY',
                        'DisplayName': 'Local Test API Key',
                        'Description': 'API Key for local testing',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'LOCAL_TEST_SECRET_KEY',
                        'DisplayName': 'Local Test Secret Key',
                        'Description': 'Secret Key for local testing',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'LOCAL_TEST_ENCRYPTION_KEY',
                        'DisplayName': 'Local Test Encryption Key',
                        'Description': 'Encryption Key for local testing (32 bytes hex)',
                        'InputType': 'Token',
                        'Required': False
                    },
                    {
                        'Name': 'LOCAL_TEST_JWT_SECRET',
                        'DisplayName': 'Local Test JWT Secret',
                        'Description': 'JWT Secret for local testing authentication',
                        'InputType': 'Token',
                        'Required': False
                    },
                    {
                        'Name': 'LOCAL_TEST_DB_PASSWORD',
                        'DisplayName': 'Local Test Database Password',
                        'Description': 'Database password for local testing',
                        'InputType': 'Password',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': True
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'DeepSeek': {
                'Common': 'deepseek',
                'DisplayName': 'DeepSeek',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'DEEPSEEK_API_KEY',
                        'DisplayName': 'DeepSeek API Key',
                        'Description': 'DeepSeek API Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'DEEPSEEK_BASE_URL',
                        'DisplayName': 'DeepSeek Base URL',
                        'Description': 'DeepSeek API Base URL (default: https://api.deepseek.com)',
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
            'Google AI Studio': {
                'Common': 'google_aistudio',
                'DisplayName': 'Google AI Studio',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'GOOGLE_API_KEY',
                        'DisplayName': 'Google API Key',
                        'Description': 'Google AI Studio API Key (Gemini)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'GOOGLE_PROJECT_NAME',
                        'DisplayName': 'Google Project Name',
                        'Description': 'Google Cloud Project Name (e.g., projects/556092724464)',
                        'InputType': 'Text',
                        'Required': False
                    },
                    {
                        'Name': 'GOOGLE_PROJECT_NUMBER',
                        'DisplayName': 'Google Project Number',
                        'Description': 'Google Cloud Project Number (e.g., 556092724464)',
                        'InputType': 'Text',
                        'Required': False
                    },
                    {
                        'Name': 'GOOGLE_BASE_URL',
                        'DisplayName': 'Google AI Studio Base URL',
                        'Description': 'Google AI Studio API Base URL',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {
                    'Enabled': True,
                    'SyncScript': 'gemini_sync_mcp_servers.py',
                    'PreLaunchScript': 'gemini_pre_launch.ps1',
                    'UpdateScript': 'gemini_update.bat'
                },
                'SmartRecognition': {
                    'Enabled': False
                }
            },
            'DuGouGole': {
                'Common': 'dugougole',
                'DisplayName': 'DuGouGole',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'DUGOUGOLE_API_KEY',
                        'DisplayName': 'DuGouGole API Key',
                        'Description': 'DuGouGole API Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'DUGOUGOLE_BASE_URL',
                        'DisplayName': 'DuGouGole Base URL',
                        'Description': 'DuGouGole API Base URL',
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
            'Poxie': {
                'Common': 'poxie',
                'DisplayName': 'Poxie',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'POXIE_API_KEY',
                        'DisplayName': 'Poxie API Key',
                        'Description': 'Poxie API Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'POXIE_BASE_URL',
                        'DisplayName': 'Poxie Base URL',
                        'Description': 'Poxie API Base URL',
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

            # ---- AI providers with free tiers (CN) -------------------------
            'SiliconFlow': {
                'Common': 'siliconflow',
                'DisplayName': 'SiliconFlow',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'SILICONFLOW_API_KEY',
                        'DisplayName': 'SiliconFlow API Key',
                        'Description': 'SiliconFlow API Key (free models available)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'SILICONFLOW_BASE_URL',
                        'DisplayName': 'SiliconFlow Base URL',
                        'Description': 'SiliconFlow API Base URL (default: https://api.siliconflow.cn/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Volcano Ark': {
                'Common': 'volcano_ark',
                'DisplayName': 'Volcano Ark (Doubao)',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'ARK_API_KEY',
                        'DisplayName': 'Ark API Key',
                        'Description': 'Volcano Engine Ark API Key (Doubao models)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'ARK_BASE_URL',
                        'DisplayName': 'Ark Base URL',
                        'Description': 'Ark API Base URL (default: https://ark.cn-beijing.volces.com/api/v3)',
                        'InputType': 'Url',
                        'Required': False
                    },
                    {
                        'Name': 'VOLC_ACCESSKEY',
                        'DisplayName': 'Volc Access Key',
                        'Description': 'Volcano Engine cloud Access Key (non-Ark cloud APIs)',
                        'InputType': 'Token',
                        'Required': False
                    },
                    {
                        'Name': 'VOLC_SECRETKEY',
                        'DisplayName': 'Volc Secret Key',
                        'Description': 'Volcano Engine cloud Secret Key (non-Ark cloud APIs)',
                        'InputType': 'Token',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Alibaba DashScope': {
                'Common': 'dashscope',
                'DisplayName': 'Alibaba DashScope (Qwen)',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'DASHSCOPE_API_KEY',
                        'DisplayName': 'DashScope API Key',
                        'Description': 'Alibaba DashScope/Bailian API Key (Qwen models)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'DASHSCOPE_BASE_URL',
                        'DisplayName': 'DashScope Base URL',
                        'Description': 'DashScope OpenAI-compatible Base URL (default: https://dashscope.aliyuncs.com/compatible-mode/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Tencent Hunyuan': {
                'Common': 'hunyuan',
                'DisplayName': 'Tencent Hunyuan',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'HUNYUAN_API_KEY',
                        'DisplayName': 'Hunyuan API Key',
                        'Description': 'Tencent Hunyuan API Key (hunyuan-lite is free)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'HUNYUAN_BASE_URL',
                        'DisplayName': 'Hunyuan Base URL',
                        'Description': 'Hunyuan OpenAI-compatible Base URL (default: https://api.hunyuan.cloud.tencent.com/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Zhipu AI': {
                'Common': 'zhipuai',
                'DisplayName': 'Zhipu AI (GLM)',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'ZHIPUAI_API_KEY',
                        'DisplayName': 'Zhipu API Key',
                        'Description': 'Zhipu AI API Key (glm-4-flash is free)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'ZHIPUAI_BASE_URL',
                        'DisplayName': 'Zhipu Base URL',
                        'Description': 'Zhipu API Base URL (default: https://open.bigmodel.cn/api/paas/v4)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Moonshot Kimi': {
                'Common': 'moonshot',
                'DisplayName': 'Moonshot Kimi',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'MOONSHOT_API_KEY',
                        'DisplayName': 'Moonshot API Key',
                        'Description': 'Moonshot Kimi API Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'MOONSHOT_BASE_URL',
                        'DisplayName': 'Moonshot Base URL',
                        'Description': 'Moonshot API Base URL (default: https://api.moonshot.cn/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Baidu Qianfan': {
                'Common': 'qianfan',
                'DisplayName': 'Baidu Qianfan (ERNIE)',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'QIANFAN_API_KEY',
                        'DisplayName': 'Qianfan API Key',
                        'Description': 'Baidu Qianfan v2 API Key (ERNIE models; speed/lite tiers free)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'QIANFAN_BASE_URL',
                        'DisplayName': 'Qianfan Base URL',
                        'Description': 'Qianfan OpenAI-compatible Base URL (default: https://qianfan.baidubce.com/v2)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'iFlytek Spark': {
                'Common': 'spark',
                'DisplayName': 'iFlytek Spark',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'SPARK_API_PASSWORD',
                        'DisplayName': 'Spark HTTP APIPassword',
                        'Description': 'iFlytek Spark HTTP APIPassword (Spark Lite is free)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'SPARK_APP_ID',
                        'DisplayName': 'Spark App ID',
                        'Description': 'iFlytek APPID (WebSocket API)',
                        'InputType': 'Text',
                        'Required': False
                    },
                    {
                        'Name': 'SPARK_API_KEY',
                        'DisplayName': 'Spark API Key',
                        'Description': 'iFlytek APIKey (WebSocket API)',
                        'InputType': 'Token',
                        'Required': False
                    },
                    {
                        'Name': 'SPARK_API_SECRET',
                        'DisplayName': 'Spark API Secret',
                        'Description': 'iFlytek APISecret (WebSocket API)',
                        'InputType': 'Token',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'MiniMax': {
                'Common': 'minimax',
                'DisplayName': 'MiniMax',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'MINIMAX_API_KEY',
                        'DisplayName': 'MiniMax API Key',
                        'Description': 'MiniMax API Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'MINIMAX_GROUP_ID',
                        'DisplayName': 'MiniMax Group ID',
                        'Description': 'MiniMax Group ID (required by some endpoints)',
                        'InputType': 'Text',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'StepFun': {
                'Common': 'stepfun',
                'DisplayName': 'StepFun',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'STEPFUN_API_KEY',
                        'DisplayName': 'StepFun API Key',
                        'Description': 'StepFun API Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'STEPFUN_BASE_URL',
                        'DisplayName': 'StepFun Base URL',
                        'Description': 'StepFun API Base URL (default: https://api.stepfun.com/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            '01.AI Yi': {
                'Common': 'yi',
                'DisplayName': '01.AI Yi',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'YI_API_KEY',
                        'DisplayName': 'Yi API Key',
                        'Description': '01.AI Yi API Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'YI_BASE_URL',
                        'DisplayName': 'Yi Base URL',
                        'Description': 'Yi API Base URL (default: https://api.lingyiwanwu.com/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },

            # ---- AI providers with free tiers (global) ---------------------
            'Groq': {
                'Common': 'groq',
                'DisplayName': 'Groq',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'GROQ_API_KEY',
                        'DisplayName': 'Groq API Key',
                        'Description': 'Groq API Key (generous free tier, Llama/Mixtral)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'GROQ_BASE_URL',
                        'DisplayName': 'Groq Base URL',
                        'Description': 'Groq API Base URL (default: https://api.groq.com/openai/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Mistral': {
                'Common': 'mistral',
                'DisplayName': 'Mistral AI',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'MISTRAL_API_KEY',
                        'DisplayName': 'Mistral API Key',
                        'Description': 'Mistral La Plateforme API Key (free experiment tier)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'MISTRAL_BASE_URL',
                        'DisplayName': 'Mistral Base URL',
                        'Description': 'Mistral API Base URL (default: https://api.mistral.ai/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Cohere': {
                'Common': 'cohere',
                'DisplayName': 'Cohere',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'COHERE_API_KEY',
                        'DisplayName': 'Cohere API Key',
                        'Description': 'Cohere API Key (free trial keys, Command models)',
                        'InputType': 'Token',
                        'Required': True
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Together AI': {
                'Common': 'together',
                'DisplayName': 'Together AI',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'TOGETHER_API_KEY',
                        'DisplayName': 'Together API Key',
                        'Description': 'Together AI API Key — $5 minimum prepaid, no free trial (docs.together.ai/credits)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'TOGETHER_KEY_ID',
                        'DisplayName': 'Together Key ID',
                        'Description': 'Together AI Key ID',
                        'InputType': 'Text',
                        'Required': False
                    },
                    {
                        'Name': 'TOGETHER_BASE_URL',
                        'DisplayName': 'Together Base URL',
                        'Description': 'Together API Base URL (default: https://api.together.xyz/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Cerebras': {
                'Common': 'cerebras',
                'DisplayName': 'Cerebras',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'CEREBRAS_API_KEY',
                        'DisplayName': 'Cerebras API Key',
                        'Description': 'Cerebras Inference API Key (free tier, very fast Llama)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'CEREBRAS_BASE_URL',
                        'DisplayName': 'Cerebras Base URL',
                        'Description': 'Cerebras API Base URL (default: https://api.cerebras.ai/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'xAI Grok': {
                'Common': 'xai',
                'DisplayName': 'xAI Grok',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'XAI_API_KEY',
                        'DisplayName': 'xAI API Key',
                        'Description': 'xAI Grok API Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'XAI_BASE_URL',
                        'DisplayName': 'xAI Base URL',
                        'Description': 'xAI API Base URL (default: https://api.x.ai/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'NVIDIA NIM': {
                'Common': 'nvidia_nim',
                'DisplayName': 'NVIDIA NIM',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'NVIDIA_API_KEY',
                        'DisplayName': 'NVIDIA API Key',
                        'Description': 'NVIDIA NIM API Key (free credits on build.nvidia.com)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'NVIDIA_BASE_URL',
                        'DisplayName': 'NVIDIA Base URL',
                        'Description': 'NVIDIA NIM Base URL (default: https://integrate.api.nvidia.com/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Hugging Face': {
                'Common': 'huggingface',
                'DisplayName': 'Hugging Face',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'HF_TOKEN',
                        'DisplayName': 'Hugging Face Token',
                        'Description': 'Hugging Face access token (free Inference Providers quota)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'HF_BASE_URL',
                        'DisplayName': 'HF Router Base URL',
                        'Description': 'HF Inference Providers Base URL (default: https://router.huggingface.co/v1)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'GitHub Models': {
                'Common': 'github_models',
                'DisplayName': 'GitHub Models',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'GITHUB_MODELS_TOKEN',
                        'DisplayName': 'GitHub Models Token',
                        'Description': 'GitHub PAT for GitHub Models (free tier; kept separate from GITHUB_TOKEN to avoid clobbering git auth)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'GITHUB_MODELS_BASE_URL',
                        'DisplayName': 'GitHub Models Base URL',
                        'Description': 'GitHub Models Base URL (default: https://models.github.ai/inference)',
                        'InputType': 'Url',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Cloudflare Workers AI': {
                'Common': 'cloudflare_ai',
                'DisplayName': 'Cloudflare Workers AI',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'CLOUDFLARE_API_TOKEN',
                        'DisplayName': 'Cloudflare API Token',
                        'Description': 'Cloudflare API Token with Workers AI permission (free daily allocation)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'CLOUDFLARE_ACCOUNT_ID',
                        'DisplayName': 'Cloudflare Account ID',
                        'Description': 'Cloudflare Account ID (required by Workers AI endpoints)',
                        'InputType': 'Text',
                        'Required': True
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'Cloudflare R2': {
                'Common': 'cloudflare_r2',
                'DisplayName': 'Cloudflare R2',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'CLOUDFLARE_R2_API_TOKEN',
                        'DisplayName': 'Cloudflare R2 API Token',
                        'Description': 'Cloudflare R2 API Token (format: cfat_...)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'CLOUDFLARE_R2_ACCESS_KEY_ID',
                        'DisplayName': 'Cloudflare R2 Access Key ID',
                        'Description': 'R2 S3-compatible Access Key ID',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
                        'DisplayName': 'Cloudflare R2 Secret Access Key',
                        'Description': 'R2 S3-compatible Secret Access Key',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'CLOUDFLARE_R2_S3_ENDPOINT',
                        'DisplayName': 'Cloudflare R2 S3 Endpoint',
                        'Description': 'R2 S3 API endpoint (e.g., https://<account_id>.r2.cloudflarestorage.com)',
                        'InputType': 'Url',
                        'Required': True
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'TMDB (The Movie Database)': {
                'Common': 'tmdb',
                'DisplayName': 'TMDB (The Movie Database)',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'TMDB_API_KEY',
                        'DisplayName': 'TMDB API Key (v3)',
                        'Description': 'TMDB v3 API Key (themoviedb.org, free; used for movie/TV poster lookup)',
                        'InputType': 'Token',
                        'Required': True
                    },
                    {
                        'Name': 'TMDB_API_READ_ACCESS_TOKEN',
                        'DisplayName': 'TMDB API Read Access Token (v4)',
                        'Description': 'TMDB v4 Bearer token (optional; preferred over the v3 key when present)',
                        'InputType': 'Token',
                        'Required': False
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
            },
            'OMDB (omdbapi.com)': {
                'Common': 'omdb',
                'DisplayName': 'OMDB (omdbapi.com)',
                'StorageType': 'encrypted_constant',
                'Variables': [
                    {
                        'Name': 'OMDB_API_KEY',
                        'DisplayName': 'OMDB API Key',
                        'Description': 'OMDB API Key (omdbapi.com, free tier; fallback movie/TV poster lookup)',
                        'InputType': 'Token',
                        'Required': True
                    }
                ],
                'MCPSupport': {'Enabled': False},
                'SmartRecognition': {'Enabled': False}
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

