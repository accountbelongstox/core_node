#!/usr/bin/env python3
"""
Standard Image Data Structure
Direct hardcoded dictionary structure for the 7 required images
"""

from shared.image_patterns import ImagePatterns

# Complete hardcoded data structure for all 7 required images
STANDARD_IMAGE_DATA = {
    'logo': {
        'image_type': 'LOGO',
        'final_filename': 'logo.png',
        'original_path': '',
        'processed_path': '',
        'original_size': 0,
        'processed_size': 0,
        'status': 'missing',
        'source': '',
        'pattern': ImagePatterns.NAME_PATTERNS['logo'],
        'format': '',
        'compression_mode': 'compressed',
        'is_fallback': False,
        'fallback_from': '',
        'fallback_reason': '',
        'directory': '',
        'priority': 95
    },
    'background': {
        'image_type': 'BACKGROUND',
        'final_filename': 'background.png',
        'original_path': '',
        'processed_path': '',
        'original_size': 0,
        'processed_size': 0,
        'status': 'missing',
        'source': '',
        'pattern': ImagePatterns.NAME_PATTERNS['background'],
        'format': '',
        'compression_mode': 'compressed',
        'is_fallback': False,
        'fallback_from': '',
        'fallback_reason': '',
        'directory': '',
        'priority': 95
    },
    'splash': {
        'image_type': 'SPLASH',
        'final_filename': 'splash.png',
        'original_path': '',
        'processed_path': '',
        'original_size': 0,
        'processed_size': 0,
        'status': 'missing',
        'source': '',
        'pattern': ImagePatterns.NAME_PATTERNS['splash'],
        'format': '',
        'compression_mode': 'compressed',
        'is_fallback': False,
        'fallback_from': '',
        'fallback_reason': '',
        'directory': '',
        'priority': 95
    },
    'ic_icon': {
        'image_type': 'IC_ICON',
        'final_filename': 'ic_icon.png',
        'original_path': '',
        'processed_path': '',
        'original_size': 0,
        'processed_size': 0,
        'status': 'missing',
        'source': '',
        'pattern': ImagePatterns.NAME_PATTERNS['ic_icon'],
        'format': '',
        'compression_mode': 'compressed',
        'is_fallback': False,
        'fallback_from': '',
        'fallback_reason': '',
        'directory': '',
        'priority': 95
    },
    'notification_icon': {
        'image_type': 'NOTIFICATION_ICON',
        'final_filename': 'notification_icon.png',
        'original_path': '',
        'processed_path': '',
        'original_size': 0,
        'processed_size': 0,
        'status': 'missing',
        'source': '',
        'pattern': ImagePatterns.NAME_PATTERNS['notification_icon'],
        'format': '',
        'compression_mode': 'compressed',
        'is_fallback': False,
        'fallback_from': '',
        'fallback_reason': '',
        'directory': '',
        'priority': 95
    },
    'transa_launcher': {
        'image_type': 'TRANSA_LAUNCHER',
        'final_filename': 'transa_launcher.png',
        'original_path': '',
        'processed_path': '',
        'original_size': 0,
        'processed_size': 0,
        'status': 'missing',
        'source': '',
        'pattern': ImagePatterns.NAME_PATTERNS['transa_launcher'],
        'format': '',
        'compression_mode': 'compressed',
        'is_fallback': False,
        'fallback_from': '',
        'fallback_reason': '',
        'directory': '',
        'priority': 95
    },
    'ic_launcher': {
        'image_type': 'IC_LAUNCHER',
        'final_filename': 'ic_launcher.png',
        'original_path': '',
        'processed_path': '',
        'original_size': 0,
        'processed_size': 0,
        'status': 'missing',
        'source': '',
        'pattern': ImagePatterns.NAME_PATTERNS['ic_launcher'],
        'format': '',
        'compression_mode': 'compressed',
        'is_fallback': False,
        'fallback_from': '',
        'fallback_reason': '',
        'directory': '',
        'priority': 95
    }
}

# Standard 7 required images list
REQUIRED_IMAGES = list(STANDARD_IMAGE_DATA.keys())

# ================================================================
# Platform Image Lists Data Structure
# ================================================================

"""
Target Image Array Structure Specification:

Each platform's image list can only contain the following standardized target image data structure:
{
    'target_path': str,        # Target path - full path of image in platform project
    'image_category': str,     # Image category - must be one of:
                              #   'small_icon'    - Small icon
                              #   'large_icon'    - Large icon
                              #   'portrait'      - Portrait image
                              #   'landscape'     - Landscape image
                              #   'placeholder'   - Placeholder image
    'original_size': tuple,    # Original size - (width, height) current image dimensions
    'recommended_size': tuple  # Recommended size - (width, height) platform standard dimensions
}

Usage Rules:
1. Only use add_platform_target() method to add images
2. Direct modification of list contents is not allowed
3. All sizes must be in (width, height) tuple format
4. image_category must be one of the 5 predefined types
5. target_path must be a valid file path string
"""

# Platform image lists initialization
PLATFORM_IMAGE_LISTS = {
    'android': [],
    'ios': [],
    'macos': [],
    'windows': [],
    'web': []
}

# Valid image category constants
VALID_IMAGE_CATEGORIES = [
    'small_icon',    # Small icon
    'large_icon',    # Large icon
    'portrait',      # Portrait image
    'landscape',     # Landscape image
    'placeholder'    # Placeholder image
]

def add_platform_target(platform, target_path, image_category, original_size, recommended_size):
    """
    Add platform target image to corresponding platform list

    Args:
        platform (str): Platform name - 'android', 'ios', 'macos', 'windows', 'web'
        target_path (str): Target path - full path of image in platform project
        image_category (str): Image category - must be one of VALID_IMAGE_CATEGORIES
        original_size (tuple): Original size - (width, height)
        recommended_size (tuple): Recommended size - (width, height)

    Returns:
        bool: Returns True on success, False on failure

    Raises:
        ValueError: Raised when parameters do not meet specifications
    """
    # Validate platform name
    if platform not in PLATFORM_IMAGE_LISTS:
        raise ValueError(f"Invalid platform '{platform}'. Must be one of: {list(PLATFORM_IMAGE_LISTS.keys())}")

    # Validate image category
    if image_category not in VALID_IMAGE_CATEGORIES:
        raise ValueError(f"Invalid image_category '{image_category}'. Must be one of: {VALID_IMAGE_CATEGORIES}")

    # Validate path
    if not isinstance(target_path, str) or not target_path.strip():
        raise ValueError("target_path must be a non-empty string")

    # Validate size format
    if not isinstance(original_size, tuple) or len(original_size) != 2:
        raise ValueError("original_size must be a tuple of (width, height)")

    if not isinstance(recommended_size, tuple) or len(recommended_size) != 2:
        raise ValueError("recommended_size must be a tuple of (width, height)")

    # Validate size values
    if not all(isinstance(x, int) and x > 0 for x in original_size):
        raise ValueError("original_size must contain positive integers")

    if not all(isinstance(x, int) and x > 0 for x in recommended_size):
        raise ValueError("recommended_size must contain positive integers")

    # Create standardized target image data structure
    target_image_data = {
        'target_path': target_path.strip(),
        'image_category': image_category,
        'original_size': original_size,
        'recommended_size': recommended_size
    }

    # Add to corresponding platform list
    PLATFORM_IMAGE_LISTS[platform].append(target_image_data)

    return True

def get_platform_targets(platform):
    """
    Get target image list for specified platform

    Args:
        platform (str): Platform name

    Returns:
        list: Copy of platform target image list (prevents accidental modification)
    """
    if platform not in PLATFORM_IMAGE_LISTS:
        raise ValueError(f"Invalid platform '{platform}'. Must be one of: {list(PLATFORM_IMAGE_LISTS.keys())}")

    return PLATFORM_IMAGE_LISTS[platform].copy()

def clear_platform_targets(platform):
    """
    Clear target image list for specified platform

    Args:
        platform (str): Platform name
    """
    if platform not in PLATFORM_IMAGE_LISTS:
        raise ValueError(f"Invalid platform '{platform}'. Must be one of: {list(PLATFORM_IMAGE_LISTS.keys())}")

    PLATFORM_IMAGE_LISTS[platform].clear()

def get_all_platforms():
    """
    Get list of all supported platforms

    Returns:
        list: List of supported platform names
    """
    return list(PLATFORM_IMAGE_LISTS.keys())

def format_file_size(size_bytes):
    """Format file size in human readable format"""
    if size_bytes < 1024:
        return f"{size_bytes}B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f}KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f}MB"