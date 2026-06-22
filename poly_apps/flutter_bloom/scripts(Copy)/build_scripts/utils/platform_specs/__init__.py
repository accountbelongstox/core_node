"""
Platform Specifications Package
Modular platform-specific image specifications for Flutter multi-app build system
"""

from .platform_specs_manager import PlatformSpecsManager
from .android_specs import AndroidSpecs
from .ios_specs import IOSSpecs
from .macos_specs import MacOSSpecs
from .web_specs import WebSpecs
from .windows_specs import WindowsSpecs

__all__ = [
    'PlatformSpecsManager',
    'AndroidSpecs',
    'IOSSpecs',
    'MacOSSpecs',
    'WebSpecs',
    'WindowsSpecs'
]