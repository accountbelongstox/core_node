#!/usr/bin/env python3
"""
Image Name Patterns Configuration
Shared configuration for image scanning and classification across all build steps
"""

from typing import Dict, List

class ImagePatterns:
    """
    Centralized image name patterns for consistent image scanning across all steps.
    Used by asset_scanner, image_classifier, and other components.
    """

    # Core image types that must be found (7 required images)
    REQUIRED_IMAGE_TYPES = [
        'logo',
        'ic_icon',
        'ic_launcher',
        'notification_icon',
        'transa_launcher',
        'background',
        'splash'
    ]

    # Search patterns for each image type (updated for precise matching to avoid conflicts)
    NAME_PATTERNS = {
        # Logo patterns - search in icons subdirectory first
        'logo': [
            r'^logo(?!_).*',        # logo but not logo_xxx
            r'^app_logo.*',
            r'^brand(?!_).*',       # brand but not brand_xxx
            r'^company.*'
        ],

        # Icon patterns - search in same directory as logo if logo found (strict matching)
        'ic_icon': [
            r'^ic_icon$',                # Only exact ic_icon (no suffix)
            r'^app_icon$',               # Only exact app_icon (no suffix)
            r'^main_icon$'               # Only exact main_icon (no suffix)
        ],

        'ic_launcher': [
            r'^ic_launcher.*',           # Only exact ic_launcher matches
            r'^launcher(?!_).*',         # launcher but not launcher_xxx
            r'^app_launcher.*',
            r'^android_launcher.*'
        ],

        'notification_icon': [
            r'^notification_icon.*',
            r'^notification(?!_icon).*', # notification but not notification_icon
            r'^notify_icon.*',
            r'^notify(?!_icon).*',       # notify but not notify_icon
            r'^status_icon.*'
        ],

        'transa_launcher': [
            r'^transa_launcher.*',
            r'^transa(?!_launcher).*',   # transa but not transa_launcher
            r'^launcher_transa.*',
            r'^trans_launcher.*'
        ],

        # Background patterns - search in launch subdirectory first
        'background': [
            r'^background(?!_splash).*', # background but not background_splash
            r'^launch_background.*',
            r'^bg(?!_splash).*',         # bg but not bg_splash
            r'^launch_bg.*',
            r'^app_background.*'
        ],

        # Splash patterns - search in same directory as background if background found
        'splash': [
            r'^splash.*',
            r'^launch_image.*',
            r'^startup.*',
            r'^launch_screen.*',
            r'^boot_screen.*'
        ]
    }

    # Directory search priorities for each image type
    DIRECTORY_SEARCH_PATHS = {
        # Icons group - search in icons subdirectory
        'icons_group': ['icons', 'icon', 'mipmap', 'drawable'],
        # Launch group - search in launch subdirectory
        'launch_group': ['launch', 'splash', 'startup', 'drawable']
    }

    # Image type to directory group mapping
    TYPE_TO_DIRECTORY_GROUP = {
        'logo': 'icons_group',
        'ic_icon': 'icons_group',
        'ic_launcher': 'icons_group',
        'notification_icon': 'icons_group',
        'transa_launcher': 'icons_group',
        'background': 'launch_group',
        'splash': 'launch_group'
    }

    # Fallback relationships - which image can serve as origin for others
    FALLBACK_RELATIONSHIPS = {
        # If logo found, use as fallback for all icon types
        'logo': ['ic_icon', 'ic_launcher', 'notification_icon', 'transa_launcher'],
        # If background found, use as fallback for splash
        'background': ['splash']
    }

    # Supported image file extensions
    SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp']

    @classmethod
    def get_patterns_for_type(cls, image_type: str) -> List[str]:
        """Get search patterns for a specific image type"""
        return cls.NAME_PATTERNS.get(image_type, [])

    @classmethod
    def get_directory_paths_for_type(cls, image_type: str) -> List[str]:
        """Get directory search paths for a specific image type"""
        group = cls.TYPE_TO_DIRECTORY_GROUP.get(image_type, 'icons_group')
        return cls.DIRECTORY_SEARCH_PATHS.get(group, [])

    @classmethod
    def get_fallback_targets(cls, source_type: str) -> List[str]:
        """Get list of image types that can use source_type as fallback"""
        return cls.FALLBACK_RELATIONSHIPS.get(source_type, [])

    @classmethod
    def is_required_type(cls, image_type: str) -> bool:
        """Check if image type is one of the 7 required types"""
        return image_type in cls.REQUIRED_IMAGE_TYPES


# Global instance for easy import
image_patterns = ImagePatterns()