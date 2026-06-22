#!/usr/bin/env python3
"""
Shared Data Exchange Library
Provides common data structures and exchange mechanisms for build steps
"""

from .data_exchange.unified_variable_system import (
    unified_vars,
    ImageTypeDefinition,
    ProcessedImageInfo,
    PlatformTargetInfo
)

__all__ = [
    'unified_vars',
    'ImageTypeDefinition',
    'ProcessedImageInfo',
    'PlatformTargetInfo'
]
