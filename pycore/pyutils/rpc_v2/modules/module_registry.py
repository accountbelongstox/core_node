#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模块注册表 - 硬编码支持的模块列表

⚠️ 重要: 所有支持的模块必须在此硬编码
这样可以:
1. 防止动态导入导致的频繁初始化
2. 明确系统支持哪些模块
3. 在启动时预加载,避免运行时性能损耗
4. 统一管理模块配置和元数据
"""

from typing import Dict, Any, Optional

SUPPORTED_MODULES: Dict[str, Dict[str, Any]] = {
    "translator": {
        "module_path": "pycore.pyutils.translator",
        "class_name": "GoogleTranslator",
        "singleton": True,
        "preload": True,
        "description": "Google Translator - 文本翻译服务",
        "methods": {
            "translate_single": {
                "sync": False,
                "description": "翻译单个文本",
                "timeout": 30.0,
                "params": {
                    "text": {"type": "str", "required": True, "description": "要翻译的文本"},
                    "src": {"type": "str", "required": False, "default": "auto", "description": "源语言代码"},
                    "dest": {"type": "str", "required": False, "default": "en", "description": "目标语言代码"},
                    "use_cache": {"type": "bool", "required": False, "default": True, "description": "是否使用缓存"}
                },
                "returns": {
                    "type": "TranslationResult",
                    "description": "翻译结果对象"
                },
                "example": {
                    "params": {
                        "text": "Hello world",
                        "src": "en",
                        "dest": "ko"
                    },
                    "result": {
                        "original_text": "Hello world",
                        "translated_text": "안녕하세요 세계",
                        "src_lang": "en",
                        "dest_lang": "ko",
                        "from_cache": False
                    }
                }
            },
            "translate_batch": {
                "sync": False,
                "description": "批量翻译多个文本",
                "timeout": 60.0,
                "params": {
                    "texts": {"type": "list[str]", "required": True, "description": "要翻译的文本列表"},
                    "src": {"type": "str", "required": False, "default": "auto", "description": "源语言代码"},
                    "dest": {"type": "str", "required": False, "default": "en", "description": "目标语言代码"},
                    "use_cache": {"type": "bool", "required": False, "default": True, "description": "是否使用缓存"}
                },
                "returns": {
                    "type": "list[TranslationResult]",
                    "description": "翻译结果列表"
                },
                "example": {
                    "params": {
                        "texts": ["Hello", "World"],
                        "src": "en",
                        "dest": "ko"
                    },
                    "result": [
                        {"original_text": "Hello", "translated_text": "안녕하세요"},
                        {"original_text": "World", "translated_text": "세계"}
                    ]
                }
            },
            "detect_language": {
                "sync": False,
                "description": "检测文本语言",
                "timeout": 10.0,
                "params": {
                    "text": {"type": "str", "required": True, "description": "要检测的文本"}
                },
                "returns": {
                    "type": "dict",
                    "description": "语言检测结果"
                },
                "example": {
                    "params": {"text": "Hello world"},
                    "result": {
                        "language": "en",
                        "confidence": 0.99,
                        "text": "Hello world"
                    }
                }
            }
        }
    }
}


def get_module_info(module_name: str) -> Optional[Dict[str, Any]]:
    """
    获取模块信息
    
    Args:
        module_name: 模块名称
        
    Returns:
        模块信息字典,如果模块不存在返回None
    """
    return SUPPORTED_MODULES.get(module_name)


def get_all_modules() -> Dict[str, Dict[str, Any]]:
    """获取所有支持的模块"""
    return SUPPORTED_MODULES


def list_module_names() -> list[str]:
    """获取所有模块名称列表"""
    return list(SUPPORTED_MODULES.keys())


def get_method_info(module_name: str, method_name: str) -> Optional[Dict[str, Any]]:
    """
    获取模块方法信息
    
    Args:
        module_name: 模块名称
        method_name: 方法名称
        
    Returns:
        方法信息字典,如果不存在返回None
    """
    module_info = get_module_info(module_name)
    if not module_info:
        return None
    
    return module_info.get("methods", {}).get(method_name)


__all__ = [
    'SUPPORTED_MODULES',
    'get_module_info',
    'get_all_modules',
    'list_module_names',
    'get_method_info',
]
