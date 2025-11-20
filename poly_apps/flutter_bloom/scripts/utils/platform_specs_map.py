#!/usr/bin/env python3
"""
Platform Specs Map
Provides recommended dimensions and specifications for different Flutter platforms
"""

from typing import Dict, List, Optional, Tuple
import re


class PlatformSpecsMap:
    """
    Maps platform-specific directories and files to their recommended dimensions
    """

    def __init__(self):
        # Android platform specifications - Enhanced with complete density support
        self.android_specs = {
            # Launcher icons (mipmap) - App launcher icons
            'mipmap-ldpi': {'icon': (36, 36), 'launcher': (36, 36)},
            'mipmap-mdpi': {'icon': (48, 48), 'launcher': (48, 48)},
            'mipmap-hdpi': {'icon': (72, 72), 'launcher': (72, 72)},
            'mipmap-xhdpi': {'icon': (96, 96), 'launcher': (96, 96)},
            'mipmap-xxhdpi': {'icon': (144, 144), 'launcher': (144, 144)},
            'mipmap-xxxhdpi': {'icon': (192, 192), 'launcher': (192, 192)},

            # Drawable resources - General drawable assets
            'drawable-ldpi': {'icon': (18, 18), 'background': (240, 320), 'splash': (240, 320)},
            'drawable-mdpi': {'icon': (24, 24), 'background': (320, 480), 'splash': (320, 480)},
            'drawable-hdpi': {'icon': (36, 36), 'background': (480, 800), 'splash': (480, 800)},
            'drawable-xhdpi': {'icon': (48, 48), 'background': (720, 1280), 'splash': (720, 1280)},
            'drawable-xxhdpi': {'icon': (72, 72), 'background': (1080, 1920), 'splash': (1080, 1920)},
            'drawable-xxxhdpi': {'icon': (96, 96), 'background': (1440, 2560), 'splash': (1440, 2560)},

            # Night mode variants
            'drawable-night-ldpi': {'icon': (18, 18), 'background': (240, 320), 'splash': (240, 320)},
            'drawable-night-mdpi': {'icon': (24, 24), 'background': (320, 480), 'splash': (320, 480)},
            'drawable-night-hdpi': {'icon': (36, 36), 'background': (480, 800), 'splash': (480, 800)},
            'drawable-night-xhdpi': {'icon': (48, 48), 'background': (720, 1280), 'splash': (720, 1280)},
            'drawable-night-xxhdpi': {'icon': (72, 72), 'background': (1080, 1920), 'splash': (1080, 1920)},
            'drawable-night-xxxhdpi': {'icon': (96, 96), 'background': (1440, 2560), 'splash': (1440, 2560)},

            # API level specific variants
            'drawable-v21': {'icon': (48, 48), 'background': (720, 1280), 'splash': (720, 1280)},
            'drawable-night-v21': {'icon': (48, 48), 'background': (720, 1280), 'splash': (720, 1280)},
            'drawable-v23': {'icon': (48, 48), 'background': (720, 1280), 'splash': (720, 1280)},
            'drawable-night-v23': {'icon': (48, 48), 'background': (720, 1280), 'splash': (720, 1280)},

            # Port/Land orientation specific
            'drawable-port': {'background': (720, 1280), 'splash': (720, 1280)},
            'drawable-land': {'background': (1280, 720), 'splash': (1280, 720)},
            'drawable-port-hdpi': {'background': (480, 800), 'splash': (480, 800)},
            'drawable-land-hdpi': {'background': (800, 480), 'splash': (800, 480)},
            'drawable-port-xhdpi': {'background': (720, 1280), 'splash': (720, 1280)},
            'drawable-land-xhdpi': {'background': (1280, 720), 'splash': (1280, 720)},
            'drawable-port-xxhdpi': {'background': (1080, 1920), 'splash': (1080, 1920)},
            'drawable-land-xxhdpi': {'background': (1920, 1080), 'splash': (1920, 1080)},

            # Special Android 12+ adaptive icons (also in mipmap)
            'mipmap-anydpi-v26': {'adaptive_icon': (108, 108), 'icon_background': (108, 108), 'icon_foreground': (108, 108)},

            # Values directories (for notification icons, etc.)
            'drawable-anydpi-v21': {'notification': (24, 24), 'vector': 'vector'},
            'drawable-anydpi-v24': {'notification': (24, 24), 'vector': 'vector'},
        }

        # iOS platform specifications
        self.ios_specs = {
            # App Icons
            'AppIcon.appiconset': {
                'icon-20': (20, 20),
                'icon-20@2x': (40, 40),
                'icon-20@3x': (60, 60),
                'icon-29': (29, 29),
                'icon-29@2x': (58, 58),
                'icon-29@3x': (87, 87),
                'icon-40': (40, 40),
                'icon-40@2x': (80, 80),
                'icon-40@3x': (120, 120),
                'icon-60@2x': (120, 120),
                'icon-60@3x': (180, 180),
                'icon-1024': (1024, 1024)
            },
            # Launch Images
            'LaunchImage.imageset': {
                'launch-image': (375, 667),
                'launch-image@2x': (750, 1334),
                'launch-image@3x': (1125, 2001)
            }
        }

        # Web platform specifications
        self.web_specs = {
            'icons': {
                'Icon-192': (192, 192),
                'Icon-512': (512, 512),
                'Icon-maskable-192': (192, 192),
                'Icon-maskable-512': (512, 512)
            },
            'root': {
                'favicon': (16, 16),
                'manifest': (192, 192)
            }
        }

        # Windows platform specifications
        self.windows_specs = {
            'resources': {
                'app_icon': (256, 256),  # ICO files can contain multiple sizes
            }
        }

        # macOS platform specifications
        self.macos_specs = {
            'AppIcon.appiconset': {
                'app_icon_16': (16, 16),
                'app_icon_32': (32, 32),
                'app_icon_64': (64, 64),
                'app_icon_128': (128, 128),
                'app_icon_256': (256, 256),
                'app_icon_512': (512, 512),
                'app_icon_1024': (1024, 1024)
            }
        }

    def get_recommended_size(self, platform: str, file_path: str, filename: str) -> Optional[Tuple[int, int]]:
        """
        Get recommended size for a specific file based on platform and path

        Args:
            platform: Platform name (android, ios, web, windows, macos)
            file_path: Full path to the file
            filename: Name of the file

        Returns:
            Tuple of (width, height) if recommendation found, None otherwise
        """
        platform_lower = platform.lower()

        if platform_lower == 'android':
            return self._get_android_recommendation(file_path, filename)
        elif platform_lower == 'ios':
            return self._get_ios_recommendation(file_path, filename)
        elif platform_lower == 'web':
            return self._get_web_recommendation(file_path, filename)
        elif platform_lower == 'windows':
            return self._get_windows_recommendation(file_path, filename)
        elif platform_lower == 'macos':
            return self._get_macos_recommendation(file_path, filename)

        return None

    def _get_android_recommendation(self, file_path: str, filename: str) -> Optional[Tuple[int, int]]:
        """Get Android platform recommendations using flexible keyword-based directory matching"""
        # Extract directory name from path
        path_parts = file_path.replace('\\', '/').split('/')

        # Find relevant drawable/mipmap directory
        drawable_dir = None
        for part in reversed(path_parts):
            if part.startswith(('drawable', 'mipmap')):
                drawable_dir = part.lower()
                break

        if not drawable_dir:
            return None

        # Determine asset type from filename
        filename_lower = filename.lower()
        asset_type = self._determine_android_asset_type(filename_lower)

        # Use keyword-based matching instead of exact matching
        matched_spec_key = self._find_android_spec_by_keywords(drawable_dir)

        if matched_spec_key and matched_spec_key in self.android_specs:
            specs = self.android_specs[matched_spec_key]

            # Try to get the specific asset type first
            if asset_type in specs:
                return specs[asset_type]

            # Fallback to other available types in the same density category
            for fallback_type in ['icon', 'launcher', 'background', 'splash', 'notification', 'adaptive_icon']:
                if fallback_type in specs:
                    return specs[fallback_type]

        return None

    def _find_android_spec_by_keywords(self, drawable_dir: str) -> Optional[str]:
        """Find Android spec using keyword-based matching"""
        drawable_dir_lower = drawable_dir.lower()

        # Extract key characteristics from directory name
        is_mipmap = 'mipmap' in drawable_dir_lower
        is_night = 'night' in drawable_dir_lower
        is_port = 'port' in drawable_dir_lower
        is_land = 'land' in drawable_dir_lower

        # Extract density level using keyword matching
        density = None
        if 'xxxhdpi' in drawable_dir_lower:
            density = 'xxxhdpi'
        elif 'xxhdpi' in drawable_dir_lower:
            density = 'xxhdpi'
        elif 'xhdpi' in drawable_dir_lower:
            density = 'xhdpi'
        elif 'hdpi' in drawable_dir_lower:
            density = 'hdpi'
        elif 'mdpi' in drawable_dir_lower:
            density = 'mdpi'
        elif 'ldpi' in drawable_dir_lower:
            density = 'ldpi'

        # Extract API level
        api_level = None
        if 'v21' in drawable_dir_lower:
            api_level = 'v21'
        elif 'v23' in drawable_dir_lower:
            api_level = 'v23'
        elif 'v26' in drawable_dir_lower:
            api_level = 'v26'

        # Build the best matching spec key
        if is_mipmap:
            if api_level and density:
                candidate = f'mipmap-{density}-{api_level}'
                if candidate in self.android_specs:
                    return candidate
            if api_level == 'v26':
                return 'mipmap-anydpi-v26'
            if density:
                candidate = f'mipmap-{density}'
                if candidate in self.android_specs:
                    return candidate
            # Default mipmap fallback
            return 'mipmap-xhdpi'

        else:  # drawable
            # Handle orientation-specific drawables
            if is_port and density:
                candidate = f'drawable-port-{density}'
                if candidate in self.android_specs:
                    return candidate
            elif is_land and density:
                candidate = f'drawable-land-{density}'
                if candidate in self.android_specs:
                    return candidate
            elif is_port:
                return 'drawable-port'
            elif is_land:
                return 'drawable-land'

            # Handle night mode and API level combinations
            if is_night and api_level and density:
                candidate = f'drawable-night-{api_level}'
                if candidate in self.android_specs:
                    return candidate

            if is_night and density:
                candidate = f'drawable-night-{density}'
                if candidate in self.android_specs:
                    return candidate

            if api_level and density:
                candidate = f'drawable-{api_level}'
                if candidate in self.android_specs:
                    return candidate

            if is_night:
                return 'drawable-night-xhdpi'  # Default night mode

            if density:
                candidate = f'drawable-{density}'
                if candidate in self.android_specs:
                    return candidate

            # Final fallback
            return 'drawable-xhdpi'

        return None

    def _determine_android_asset_type(self, filename_lower: str) -> str:
        """Determine Android asset type from filename"""
        # Check for specific asset type indicators
        if any(keyword in filename_lower for keyword in ['launcher', 'ic_launcher']):
            return 'launcher'
        elif any(keyword in filename_lower for keyword in ['background', 'bg']):
            return 'background'
        elif any(keyword in filename_lower for keyword in ['splash', 'launch']):
            return 'splash'
        elif any(keyword in filename_lower for keyword in ['notification', 'notif']):
            return 'notification'
        elif any(keyword in filename_lower for keyword in ['adaptive']):
            return 'adaptive_icon'
        elif any(keyword in filename_lower for keyword in ['icon', 'ic_']):
            return 'icon'
        else:
            # Default type based on common patterns
            return 'icon'


    def _get_ios_recommendation(self, file_path: str, filename: str) -> Optional[Tuple[int, int]]:
        """Get iOS platform recommendations"""
        if 'AppIcon.appiconset' in file_path:
            # Extract icon name pattern
            filename_base = filename.replace('.png', '').replace('.jpg', '').replace('.jpeg', '')
            return self.ios_specs['AppIcon.appiconset'].get(filename_base)
        elif 'LaunchImage.imageset' in file_path:
            filename_base = filename.replace('.png', '').replace('.jpg', '').replace('.jpeg', '')
            return self.ios_specs['LaunchImage.imageset'].get(filename_base)

        return None

    def _get_web_recommendation(self, file_path: str, filename: str) -> Optional[Tuple[int, int]]:
        """Get Web platform recommendations"""
        filename_base = filename.replace('.png', '').replace('.jpg', '').replace('.jpeg', '').replace('.ico', '')

        if 'icons' in file_path:
            return self.web_specs['icons'].get(filename_base)
        else:
            return self.web_specs['root'].get(filename_base)

    def _get_windows_recommendation(self, file_path: str, filename: str) -> Optional[Tuple[int, int]]:
        """Get Windows platform recommendations"""
        filename_base = filename.replace('.ico', '').replace('.png', '')
        return self.windows_specs['resources'].get(filename_base)

    def _get_macos_recommendation(self, file_path: str, filename: str) -> Optional[Tuple[int, int]]:
        """Get macOS platform recommendations"""
        if 'AppIcon.appiconset' in file_path:
            filename_base = filename.replace('.png', '').replace('.jpg', '').replace('.jpeg', '')
            return self.macos_specs['AppIcon.appiconset'].get(filename_base)

        return None

    def get_platform_info(self, platform: str) -> Dict:
        """
        Get complete platform specification information

        Args:
            platform: Platform name

        Returns:
            Dictionary containing platform specifications
        """
        platform_lower = platform.lower()

        specs_map = {
            'android': self.android_specs,
            'ios': self.ios_specs,
            'web': self.web_specs,
            'windows': self.windows_specs,
            'macos': self.macos_specs
        }

        return specs_map.get(platform_lower, {})

    def calculate_size_difference(self, actual_size: Tuple[int, int], recommended_size: Tuple[int, int]) -> Dict:
        """
        Calculate the difference between actual and recommended sizes

        Args:
            actual_size: Tuple of (width, height) for actual size
            recommended_size: Tuple of (width, height) for recommended size

        Returns:
            Dictionary containing difference analysis
        """
        if not actual_size or not recommended_size:
            return {'status': 'unknown', 'message': 'Size information incomplete'}

        actual_w, actual_h = actual_size
        rec_w, rec_h = recommended_size

        width_diff = actual_w - rec_w
        height_diff = actual_h - rec_h

        # Calculate percentage differences
        width_pct = (width_diff / rec_w * 100) if rec_w > 0 else 0
        height_pct = (height_diff / rec_h * 100) if rec_h > 0 else 0

        # Determine status
        if width_diff == 0 and height_diff == 0:
            status = 'perfect'
            message = 'Perfect match'
        elif abs(width_pct) <= 5 and abs(height_pct) <= 5:
            status = 'good'
            message = 'Within acceptable range'
        elif abs(width_pct) <= 20 or abs(height_pct) <= 20:
            status = 'warning'
            message = 'Size difference detected'
        else:
            status = 'error'
            message = 'Significant size difference'

        return {
            'status': status,
            'message': message,
            'width_diff': width_diff,
            'height_diff': height_diff,
            'width_diff_pct': round(width_pct, 1),
            'height_diff_pct': round(height_pct, 1),
            'actual_size': actual_size,
            'recommended_size': recommended_size
        }