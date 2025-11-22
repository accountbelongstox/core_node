#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Module Registry - Hardcoded list of supported modules

IMPORTANT: All supported modules must be hardcoded here.
This approach provides:
1. Prevents frequent initialization from dynamic imports
2. Clearly defines which modules the system supports
3. Preloads at startup to avoid runtime performance hits
4. Centralizes module configuration and metadata management
"""

from typing import Dict, Any, Optional

SUPPORTED_MODULES: Dict[str, Dict[str, Any]] = {
    "translator": {
        "module_path": "pycore.pyutils.translator",
        "class_name": "GoogleTranslator",
        "singleton": True,
        "preload": True,
        "description": "Google Translator - Text translation service",
        "methods": {
            "translate_single": {
                "sync": False,
                "description": "Translate single text",
                "timeout": 30.0,
                "params": {
                    "text": {"type": "str", "required": True, "description": "Text to translate"},
                    "src": {"type": "str", "required": False, "default": "auto", "description": "Source language code"},
                    "dest": {"type": "str", "required": False, "default": "en", "description": "Target language code"},
                    "use_cache": {"type": "bool", "required": False, "default": True, "description": "Whether to use cache"}
                },
                "returns": {
                    "type": "TranslationResult",
                    "description": "Translation result object"
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
                "description": "Batch translate multiple texts",
                "timeout": 60.0,
                "params": {
                    "texts": {"type": "List[str]", "required": True, "description": "List of texts to translate"},
                    "src": {"type": "str", "required": False, "default": "auto", "description": "Source language code"},
                    "dest": {"type": "str", "required": False, "default": "en", "description": "Target language code"},
                    "use_cache": {"type": "bool", "required": False, "default": True, "description": "Whether to use cache"}
                },
                "returns": {
                    "type": "List[TranslationResult]",
                    "description": "List of translation results"
                },
                "example": {
                    "params": {
                        "texts": ["Hello", "World"],
                        "src": "en",
                        "dest": "ko"
                    },
                    "result": [
                        {
                            "original_text": "Hello",
                            "translated_text": "안녕하세요",
                            "src_lang": "en",
                            "dest_lang": "ko",
                            "from_cache": False
                        },
                        {
                            "original_text": "World",
                            "translated_text": "세계",
                            "src_lang": "en",
                            "dest_lang": "ko",
                            "from_cache": False
                        }
                    ]
                }
            },
            "detect_language": {
                "sync": False,
                "description": "Detect language of text",
                "timeout": 10.0,
                "params": {
                    "text": {"type": "str", "required": True, "description": "Text to detect language"}
                },
                "returns": {
                    "type": "Dict[str, Any]",
                    "description": "Language detection result"
                },
                "example": {
                    "params": {
                        "text": "Hello world"
                    },
                    "result": {
                        "lang": "en",
                        "confidence": 0.99
                    }
                }
            }
        }
    }
}


def get_module_config(module_name: str) -> Optional[Dict[str, Any]]:
    """
    Get module configuration by name
    
    Args:
        module_name: Name of the module
    
    Returns:
        Module configuration dict or None if not found
    """
    return SUPPORTED_MODULES.get(module_name)


def get_all_modules() -> Dict[str, Dict[str, Any]]:
    """
    Get all supported modules
    
    Returns:
        Dictionary of all module configurations
    """
    return SUPPORTED_MODULES


def list_module_names() -> list[str]:
    """
    List all supported module names
    
    Returns:
        List of module names
    """
    return list(SUPPORTED_MODULES.keys())


def list_module_methods(module_name: str) -> list[str]:
    """
    List all methods for a given module
    
    Args:
        module_name: Name of the module
    
    Returns:
        List of method names or empty list if module not found
    """
    config = SUPPORTED_MODULES.get(module_name)
    if config and "methods" in config:
        return list(config["methods"].keys())
    return []


__all__ = [
    "SUPPORTED_MODULES",
    "get_module_config",
    "get_all_modules",
    "list_module_names",
    "list_module_methods"
]
