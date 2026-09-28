#!/usr/bin/env python3
"""
Flutter Bloom - Project Constants (Paths and Images)
Shared constants for paths and image patterns used across different build components and scripts.
This file provides centralized path definitions and image pattern constants for consistency.
"""

from pathlib import Path
from typing import List, Optional


class ProjectConstants:
    """
    Centralized path and image constants for Flutter Bloom build system.
    Provides directory structures, file patterns, and image configurations.
    """

    # Directory structure constants
    ASSETS_DIR = "assets"
    COMMON_DIR = "common"
    APPS_DIR = "apps"
    LAUNCH_DIR = "launch"
    ICONS_DIR = "icons"
    UTILS_DIR = "utils"

    # File names
    SPLASH_CONFIG_FILE = "flutter_native_splash.yaml"
    SPLASH_BACKUP_SUFFIX = ".yaml.backup"

    # Splash-related patterns (extracted from splash_manager.py)
    SPLASH_BACKGROUND_PATTERNS = ["background*", "*splash*", "*launch*"]
    # flutter_native_splash supported formats: png, apng, jpg, jpeg, jpe, jfif, tga, tpic, gif, ico, bmp, dib
    SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".jpe", ".jfif", ".gif", ".bmp", ".ico"]

    # Dark theme identifiers
    DARK_THEME_KEYWORDS = ["dark", "night", "black"]

    # Background image identifiers
    BACKGROUND_KEYWORDS = ["background", "launch", "splash"]

    # Logo/image identifiers
    LOGO_KEYWORDS = ["logo", "icon", "image"]

    # Branding identifiers
    BRANDING_KEYWORDS = ["branding", "brand", "watermark"]

    # Image classification helpers
    @classmethod
    def is_dark_theme_image(cls, filename: str) -> bool:
        """Check if filename indicates dark theme image"""
        filename_lower = filename.lower()
        return any(keyword in filename_lower for keyword in cls.DARK_THEME_KEYWORDS)

    @classmethod
    def is_background_image(cls, filename: str) -> bool:
        """Check if filename indicates background image"""
        filename_lower = filename.lower()
        return any(keyword in filename_lower for keyword in cls.BACKGROUND_KEYWORDS)

    @classmethod
    def is_logo_image(cls, filename: str) -> bool:
        """Check if filename indicates logo/image"""
        filename_lower = filename.lower()
        return any(keyword in filename_lower for keyword in cls.LOGO_KEYWORDS)

    @classmethod
    def is_branding_image(cls, filename: str) -> bool:
        """Check if filename indicates branding image"""
        filename_lower = filename.lower()
        return any(keyword in filename_lower for keyword in cls.BRANDING_KEYWORDS)

    @classmethod
    def is_splash_file(cls, filename: str) -> bool:
        """Check if filename matches splash patterns"""
        filename_lower = filename.lower()
        return any(pattern.replace("*", "") in filename_lower for pattern in cls.SPLASH_BACKGROUND_PATTERNS)

    @classmethod
    def is_supported_image_extension(cls, filename: str) -> bool:
        """Check if file has supported image extension"""
        return Path(filename).suffix.lower() in cls.SUPPORTED_IMAGE_EXTENSIONS

    # Background image classification
    @classmethod
    def classify_background_file(cls, filename: str) -> Optional[str]:
        """
        Classify background image type based on filename.

        Returns:
            - "background_dark" for dark theme background images
            - "background" for regular background images
            - None if not a background image
        """
        if not cls.is_background_image(filename):
            return None

        if cls.is_dark_theme_image(filename):
            return "background_dark"
        else:
            return "background"

    @classmethod
    def classify_logo_file(cls, filename: str) -> Optional[str]:
        """
        Classify logo/image type based on filename.

        Returns:
            - "image_dark" for dark theme logo images
            - "image" for regular logo images
            - None if not a logo image
        """
        if not cls.is_logo_image(filename):
            return None

        if cls.is_dark_theme_image(filename):
            return "image_dark"
        else:
            return "image"

    @classmethod
    def classify_branding_file(cls, filename: str) -> Optional[str]:
        """
        Classify branding image type based on filename.

        Returns:
            - "branding_dark" for dark theme branding images
            - "branding" for regular branding images
            - None if not a branding image
        """
        if not cls.is_branding_image(filename):
            return None

        if cls.is_dark_theme_image(filename):
            return "branding_dark"
        else:
            return "branding"

    @classmethod
    def classify_splash_image(cls, filename: str) -> Optional[str]:
        """
        Classify any splash-related image with priority order.

        Priority: background > logo > branding

        Returns:
            Image type string or None
        """
        # Check background first (highest priority for splash screens)
        bg_type = cls.classify_background_file(filename)
        if bg_type:
            return bg_type

        # Check logo/image
        logo_type = cls.classify_logo_file(filename)
        if logo_type:
            return logo_type

        # Check branding
        branding_type = cls.classify_branding_file(filename)
        if branding_type:
            return branding_type

        return None

    # Configuration keys for YAML
    YAML_BACKGROUND_IMAGE_KEY = "background_image"
    YAML_BACKGROUND_IMAGE_DARK_KEY = "background_image_dark"


# Global instance for easy import
project_constants = ProjectConstants()