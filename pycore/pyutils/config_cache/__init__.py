#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration Cache Module

Provides configuration caching for applications.
"""

"""
Configuration Cache Module (Util-Specific)

DEPRECATED: Global config moved to pycore.pyutils.common.global_config

This module only contains speech-specific config cache (JSON-based).
For global configuration, use: from pycore.pyutils.common import global_config
"""

from pycore.pyutils.config_cache.speech_config_cache import (
    SpeechConfigCache,
    speech_config_cache
)

# DEPRECATED: Use pycore.pyutils.common.global_config instead
# from pycore.pyutils.config_cache.global_config_cache_OLD_JSON import (
#     GlobalConfigCache,
#     global_config_cache
# )

__all__ = [
    'SpeechConfigCache',
    'speech_config_cache',
    # 'GlobalConfigCache',  # DEPRECATED
    # 'global_config_cache'  # DEPRECATED
]
