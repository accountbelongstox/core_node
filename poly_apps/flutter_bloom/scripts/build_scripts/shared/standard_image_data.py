#!/usr/bin/env python3
"""
Image Resource Manager
General image resource management for Flutter build system
"""

from shared.image_patterns import ImagePatterns

# Build directory constants
BUILD_APPS_STATIC_RESOURCES_ROOT = "D:/programing/.build_dir/build_apps_static_resources"

class ImageResourceManager:
    """General image resource manager for Flutter build system"""

    # Search subdirectories constants
    ICON_SEARCH_SUBDIR = 'icons'
    BACKGROUND_SEARCH_SUBDIR = 'launch'

    # Static resource provider directories
    # Will contain extension directories, app built-in directories and common resource directories
    STATIC_RESOURCE_PROVIDER_DIRS = []

    @classmethod
    def get_search_subdirectory(cls, image_type: str) -> str:
        """Get search subdirectory for specific image type"""
        if image_type.lower() in ['logo', 'ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher']:
            return cls.ICON_SEARCH_SUBDIR
        elif image_type.lower() in ['background', 'splash']:
            return cls.BACKGROUND_SEARCH_SUBDIR
        else:
            return cls.ICON_SEARCH_SUBDIR  # Default to icons

    @classmethod
    def add_resource_provider_dir(cls, directory_path: str):
        """Add a resource provider directory"""
        if directory_path not in cls.STATIC_RESOURCE_PROVIDER_DIRS:
            cls.STATIC_RESOURCE_PROVIDER_DIRS.append(directory_path)

    @classmethod
    def get_resource_provider_dirs(cls) -> list:
        """Get list of resource provider directories"""
        return cls.STATIC_RESOURCE_PROVIDER_DIRS.copy()

    @classmethod
    def clear_resource_provider_dirs(cls):
        """Clear all resource provider directories"""
        cls.STATIC_RESOURCE_PROVIDER_DIRS.clear()


class FlutterStaticResourceProvider:
    """Flutter static resource provider directory manager"""

    def __init__(self):
        self.extension_dirs = []     # Extension directories
        self.app_builtin_dirs = []   # App built-in directories
        self.common_resource_dirs = [] # Common resource directories

    def add_extension_directory(self, directory_path: str, priority: int = 0):
        """Add extension directory"""
        self.extension_dirs.append({
            'path': directory_path,
            'type': 'EXTERNAL',
            'priority': priority,
            'description': 'External static resource directory'
        })
        # Also add to ImageResourceManager static list
        ImageResourceManager.add_resource_provider_dir(directory_path)

    def add_app_builtin_directory(self, directory_path: str, app_name: str, priority: int = 1):
        """Add app built-in directory"""
        self.app_builtin_dirs.append({
            'path': directory_path,
            'type': 'BUILTIN',
            'app_name': app_name,
            'priority': priority,
            'description': f'Built-in app directory for {app_name}'
        })
        # Also add to ImageResourceManager static list
        ImageResourceManager.add_resource_provider_dir(directory_path)

    def add_common_resource_directory(self, directory_path: str, priority: int = 2):
        """Add common resource directory"""
        self.common_resource_dirs.append({
            'path': directory_path,
            'type': 'COMMON',
            'priority': priority,
            'description': 'Common resource directory (app_main)'
        })
        # Also add to ImageResourceManager static list
        ImageResourceManager.add_resource_provider_dir(directory_path)

    def get_all_directories(self) -> list:
        """Get all directories sorted by priority"""
        all_dirs = []
        all_dirs.extend(self.extension_dirs)
        all_dirs.extend(self.app_builtin_dirs)
        all_dirs.extend(self.common_resource_dirs)

        # Sort by priority (lower number = higher priority)
        all_dirs.sort(key=lambda x: x['priority'])
        return all_dirs

    def get_directories_by_type(self, dir_type: str) -> list:
        """Get directories by type"""
        if dir_type.upper() == 'EXTERNAL':
            return self.extension_dirs.copy()
        elif dir_type.upper() == 'BUILTIN':
            return self.app_builtin_dirs.copy()
        elif dir_type.upper() == 'COMMON':
            return self.common_resource_dirs.copy()
        else:
            return []

    def clear_all(self):
        """Clear all directories"""
        self.extension_dirs.clear()
        self.app_builtin_dirs.clear()
        self.common_resource_dirs.clear()
        ImageResourceManager.clear_resource_provider_dirs()


# Global Flutter static resource provider instance
flutter_static_provider = FlutterStaticResourceProvider()

# Android image groups for organized search
ANDROID_ICON_GROUP = ['logo', 'ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher']
ANDROID_BACKGROUND_GROUP = ['background', 'splash']



# Android platform specific image data structure
ANDROID_IMAGE_DATA = {
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
        'smart_resize': True,  # Enable smart resizing by default
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
        'smart_resize': True,  # Enable smart resizing by default
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
        'smart_resize': True,  # Enable smart resizing by default
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
        'smart_resize': True,  # Enable smart resizing by default
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
        'smart_resize': True,  # Enable smart resizing by default
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
        'smart_resize': True,  # Enable smart resizing by default
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
        'smart_resize': True,  # Enable smart resizing by default
        'is_fallback': False,
        'fallback_from': '',
        'fallback_reason': '',
        'directory': '',
        'priority': 95
    }
}

# Android platform required images list
ANDROID_REQUIRED_IMAGES = list(ANDROID_IMAGE_DATA.keys())

# Legacy alias for backward compatibility
STANDARD_IMAGE_DATA = ANDROID_IMAGE_DATA
REQUIRED_IMAGES = ANDROID_REQUIRED_IMAGES

# ================================================================
# Modern Platform Image Management System
# ================================================================

class PlatformImageManager:
    """Modern platform image management with live scanning integration"""

    def __init__(self):
        self._platform_images = {
            'android': [],
            'ios': [],
            'macos': [],
            'windows': [],
            'web': []
        }
        self._supported_platforms = list(self._platform_images.keys())

    def add_scanned_image(self, platform: str, image_data: dict) -> bool:
        """
        Add image data from platform scanner

        Args:
            platform: Platform name
            image_data: Image data from scanner including:
                - name: filename
                - path: absolute file path
                - width, height: dimensions
                - size_bytes: file size
                - classification: from ImageClassifier
                - recommended_size: from PlatformSpecs (optional)
        """
        if platform not in self._platform_images:
            return False

        # Create standardized platform image entry
        platform_image = {
            'target_path': image_data.get('path', ''),
            'filename': image_data.get('name', ''),
            'image_type': image_data.get('classification', {}).get('primary_type', 'unknown'),
            'image_subtype': image_data.get('classification', {}).get('subtype', ''),
            'current_size': (image_data.get('width', 0), image_data.get('height', 0)),
            'recommended_size': image_data.get('recommended_size', (0, 0)),
            'file_size_bytes': image_data.get('size_bytes', 0),
            'format': image_data.get('format', ''),
            'classification_confidence': image_data.get('classification', {}).get('confidence', 0),
            'size_status': image_data.get('size_status', 'unknown'),  # PERFECT, ERROR, WARNING
            'size_difference': image_data.get('size_difference', {}),
            'recommendations': image_data.get('classification', {}).get('recommendations', []),
            'scan_timestamp': image_data.get('scan_timestamp', ''),
            'relative_path': image_data.get('relative_path', '')
        }

        self._platform_images[platform].append(platform_image)
        return True

    def get_platform_images(self, platform: str) -> list:
        """Get all images for a platform"""
        return self._platform_images.get(platform, []).copy()

    def get_images_by_type(self, platform: str, image_type: str) -> list:
        """Get images of specific type for platform"""
        platform_images = self._platform_images.get(platform, [])
        return [img for img in platform_images if img['image_type'] == image_type]

    def clear_platform(self, platform: str) -> bool:
        """Clear all images for a platform"""
        if platform in self._platform_images:
            self._platform_images[platform].clear()
            return True
        return False

    def get_platform_summary(self, platform: str) -> dict:
        """Get summary statistics for platform"""
        images = self._platform_images.get(platform, [])
        if not images:
            return {'total_images': 0, 'total_size': 0, 'types': {}}

        total_size = sum(img['file_size_bytes'] for img in images)
        types = {}
        for img in images:
            img_type = img['image_type']
            types[img_type] = types.get(img_type, 0) + 1

        return {
            'total_images': len(images),
            'total_size': total_size,
            'types': types,
            'perfect_sizes': len([img for img in images if img['size_status'] == 'PERFECT']),
            'error_sizes': len([img for img in images if img['size_status'] == 'ERROR']),
            'warning_sizes': len([img for img in images if img['size_status'] == 'WARNING'])
        }

    def get_all_platforms(self) -> list:
        """Get list of supported platforms"""
        return self._supported_platforms.copy()

    def update_image_recommendations(self, platform: str, filename: str, recommendations: list) -> bool:
        """Update recommendations for specific image"""
        images = self._platform_images.get(platform, [])
        for img in images:
            if img['filename'] == filename:
                img['recommendations'] = recommendations
                return True
        return False

    def get_size_mismatches(self, platform: str) -> list:
        """Get all images with size mismatches for platform"""
        images = self._platform_images.get(platform, [])
        return [img for img in images if img['size_status'] in ['ERROR', 'WARNING']]

# Global platform image manager instance
platform_image_manager = PlatformImageManager()

# Legacy compatibility functions (deprecated - use platform_image_manager instead)
def add_platform_target(platform, target_path, image_category, original_size, recommended_size):
    """Legacy function - deprecated. Use platform_image_manager.add_scanned_image() instead."""
    print(f"[DEPRECATED] add_platform_target() is deprecated. Use platform_image_manager.add_scanned_image() instead.")
    return True

def get_platform_targets(platform):
    """Legacy function - deprecated. Use platform_image_manager.get_platform_images() instead."""
    print(f"[DEPRECATED] get_platform_targets() is deprecated. Use platform_image_manager.get_platform_images() instead.")
    return platform_image_manager.get_platform_images(platform)

def clear_platform_targets(platform):
    """Legacy function - deprecated. Use platform_image_manager.clear_platform() instead."""
    print(f"[DEPRECATED] clear_platform_targets() is deprecated. Use platform_image_manager.clear_platform() instead.")
    return platform_image_manager.clear_platform(platform)

def get_all_platforms():
    """Legacy function - deprecated. Use platform_image_manager.get_all_platforms() instead."""
    print(f"[DEPRECATED] get_all_platforms() is deprecated. Use platform_image_manager.get_all_platforms() instead.")
    return platform_image_manager.get_all_platforms()

# Legacy PLATFORM_IMAGE_LISTS for backward compatibility
PLATFORM_IMAGE_LISTS = {
    'android': [],
    'ios': [],
    'macos': [],
    'windows': [],
    'web': []
}

def format_file_size(size_bytes):
    """Format file size in human readable format"""
    if size_bytes < 1024:
        return f"{size_bytes}B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f}KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f}MB"