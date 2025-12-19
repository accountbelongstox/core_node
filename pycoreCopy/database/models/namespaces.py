#!/usr/bin/env python3
"""
Namespace definitions for database table organization
All namespaces MUST be defined here

Namespace Format: {type}_{name}
- common: Common tables shared across all apps/utils
- app_{name}: Application-specific tables
- util_{name}: Utility-specific tables
"""


class TableNamespaces:
    """
    Centralized namespace definitions

    All namespaces MUST be defined here
    """

    # ===== Common Namespace =====
    COMMON = "common"

    # ===== Example App Namespaces =====
    APP_EXAMPLE = "app_example"

    # ===== Util Namespaces =====
    UTIL_CACHE = "util_cache"
    UTIL_SPEECH = "util_speech"
    UTIL_CLIPBOARD = "util_clipboard"

    # ===== Voice App Namespace =====
    APP_VOICE = "app_voice"

    # ===== OKX Price Monitor App Namespace =====
    APP_OKX = "app_okx"

    # Add more namespaces as needed...
    # APP_YOUR_APP = "app_your_app"
    # UTIL_YOUR_UTIL = "util_your_util"

    @classmethod
    def get_all_namespaces(cls):
        """
        Get all defined namespaces

        Returns:
            List of namespace strings
        """
        return [
            value for name, value in cls.__dict__.items()
            if not name.startswith('_') and isinstance(value, str)
        ]

    @classmethod
    def validate_namespace(cls, namespace: str) -> bool:
        """
        Validate if namespace exists

        Args:
            namespace: Namespace string

        Returns:
            True if namespace is valid, False otherwise
        """
        return namespace in cls.get_all_namespaces()

    @classmethod
    def get_namespace_type(cls, namespace: str) -> str:
        """
        Get namespace type (common, app, util)

        Args:
            namespace: Namespace string

        Returns:
            Namespace type: "common", "app", "util", or "unknown"
        """
        if namespace == cls.COMMON:
            return "common"
        elif namespace.startswith("app_"):
            return "app"
        elif namespace.startswith("util_"):
            return "util"
        else:
            return "unknown"
