# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#!/usr/bin/env python3
"""
Platform Specifications Map
Contains image size specifications and recommendations for different platforms
"""

from typing import Dict, List, Tuple, Optional

class PlatformSpecsMap:
    """Platform-specific image specifications and recommendations"""

    def __init__(self):
        # Initialize all specifications
        self.android_specs = self._init_android_specs()
        self.ios_specs = self._init_ios_specs()
        self.web_specs = self._init_web_specs()
        self.windows_specs = self._init_windows_specs()
        self.macos_specs = self._init_macos_specs()

    def _init_android_specs(self) -> Dict:
        """Android platform specifications"""
        return {
            'icons': {
                'ic_launcher': [
                    {'density': 'mdpi', 'size': (48, 48), 'path': 'res/mipmap-mdpi'},
                    {'density': 'hdpi', 'size': (72, 72), 'path': 'res/mipmap-hdpi'},
                    {'density': 'xhdpi', 'size': (96, 96), 'path': 'res/mipmap-xhdpi'},
                    {'density': 'xxhdpi', 'size': (144, 144), 'path': 'res/mipmap-xxhdpi'},
                    {'density': 'xxxhdpi', 'size': (192, 192), 'path': 'res/mipmap-xxxhdpi'}
                ],
                'notification': [
                    {'density': 'mdpi', 'size': (24, 24), 'path': 'res/drawable-mdpi'},
                    {'density': 'hdpi', 'size': (36, 36), 'path': 'res/drawable-hdpi'},
                    {'density': 'xhdpi', 'size': (48, 48), 'path': 'res/drawable-xhdpi'},
                    {'density': 'xxhdpi', 'size': (72, 72), 'path': 'res/drawable-xxhdpi'},
                    {'density': 'xxxhdpi', 'size': (96, 96), 'path': 'res/drawable-xxxhdpi'}
                ]
            },
            'backgrounds': {
                'launch_background': [
                    {'density': 'mdpi', 'size': (320, 480), 'path': 'res/drawable-mdpi'},
                    {'density': 'hdpi', 'size': (480, 800), 'path': 'res/drawable-hdpi'},
                    {'density': 'xhdpi', 'size': (720, 1280), 'path': 'res/drawable-xhdpi'},
                    {'density': 'xxhdpi', 'size': (1080, 1920), 'path': 'res/drawable-xxhdpi'},
                    {'density': 'xxxhdpi', 'size': (1440, 2560), 'path': 'res/drawable-xxxhdpi'}
                ]
            },
            'splash': {
                'splash_screen': [
                    {'density': 'mdpi', 'size': (320, 480), 'path': 'res/drawable-mdpi'},
                    {'density': 'hdpi', 'size': (480, 800), 'path': 'res/drawable-hdpi'},
                    {'density': 'xhdpi', 'size': (720, 1280), 'path': 'res/drawable-xhdpi'},
                    {'density': 'xxhdpi', 'size': (1080, 1920), 'path': 'res/drawable-xxhdpi'},
                    {'density': 'xxxhdpi', 'size': (1440, 2560), 'path': 'res/drawable-xxxhdpi'}
                ]
            }
        }

    def _init_ios_specs(self) -> Dict:
        """iOS platform specifications"""
        return {
            'icons': {
                'app_icon': [
                    {'device': 'iPhone', 'size': (60, 60), 'scale': '2x', 'path': 'Runner/Assets.xcassets/AppIcon.appiconset'},
                    {'device': 'iPhone', 'size': (60, 60), 'scale': '3x', 'path': 'Runner/Assets.xcassets/AppIcon.appiconset'},
                    {'device': 'iPad', 'size': (76, 76), 'scale': '1x', 'path': 'Runner/Assets.xcassets/AppIcon.appiconset'},
                    {'device': 'iPad', 'size': (76, 76), 'scale': '2x', 'path': 'Runner/Assets.xcassets/AppIcon.appiconset'},
                    {'device': 'App Store', 'size': (1024, 1024), 'scale': '1x', 'path': 'Runner/Assets.xcassets/AppIcon.appiconset'}
                ]
            },
            'launch': {
                'launch_image': [
                    {'device': 'iPhone SE', 'size': (640, 1136), 'path': 'Runner/Assets.xcassets/LaunchImage.launchimage'},
                    {'device': 'iPhone 8', 'size': (750, 1334), 'path': 'Runner/Assets.xcassets/LaunchImage.launchimage'},
                    {'device': 'iPhone 8 Plus', 'size': (1242, 2208), 'path': 'Runner/Assets.xcassets/LaunchImage.launchimage'},
                    {'device': 'iPhone X', 'size': (1125, 2436), 'path': 'Runner/Assets.xcassets/LaunchImage.launchimage'},
                    {'device': 'iPad', 'size': (1536, 2048), 'path': 'Runner/Assets.xcassets/LaunchImage.launchimage'}
                ]
            }
        }

    def _init_web_specs(self) -> Dict:
        """Web platform specifications"""
        return {
            'icons': {
                'favicon': [
                    {'size': (16, 16), 'format': 'ico', 'path': 'web'},
                    {'size': (32, 32), 'format': 'ico', 'path': 'web'},
                    {'size': (192, 192), 'format': 'png', 'path': 'web/icons'},
                    {'size': (512, 512), 'format': 'png', 'path': 'web/icons'}
                ]
            },
            'manifest': {
                'pwa_icons': [
                    {'size': (72, 72), 'format': 'png', 'path': 'web/icons'},
                    {'size': (96, 96), 'format': 'png', 'path': 'web/icons'},
                    {'size': (128, 128), 'format': 'png', 'path': 'web/icons'},
                    {'size': (144, 144), 'format': 'png', 'path': 'web/icons'},
                    {'size': (152, 152), 'format': 'png', 'path': 'web/icons'},
                    {'size': (192, 192), 'format': 'png', 'path': 'web/icons'},
                    {'size': (384, 384), 'format': 'png', 'path': 'web/icons'},
                    {'size': (512, 512), 'format': 'png', 'path': 'web/icons'}
                ]
            }
        }

    def _init_windows_specs(self) -> Dict:
        """Windows platform specifications"""
        return {
            'icons': {
                'app_icon': [
                    {'size': (16, 16), 'format': 'ico', 'path': 'windows/runner/resources'},
                    {'size': (32, 32), 'format': 'ico', 'path': 'windows/runner/resources'},
                    {'size': (48, 48), 'format': 'ico', 'path': 'windows/runner/resources'},
                    {'size': (256, 256), 'format': 'ico', 'path': 'windows/runner/resources'}
                ]
            }
        }

    def _init_macos_specs(self) -> Dict:
        """macOS platform specifications"""
        return {
            'icons': {
                'app_icon': [
                    {'size': (16, 16), 'scale': '1x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
                    {'size': (32, 32), 'scale': '2x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},  # 16x16@2x = 32x32
                    {'size': (32, 32), 'scale': '1x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
                    {'size': (64, 64), 'scale': '2x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},  # 32x32@2x = 64x64
                    {'size': (128, 128), 'scale': '1x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
                    {'size': (256, 256), 'scale': '2x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'}, # 128x128@2x = 256x256
                    {'size': (256, 256), 'scale': '1x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
                    {'size': (512, 512), 'scale': '2x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'}, # 256x256@2x = 512x512
                    {'size': (512, 512), 'scale': '1x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
                    {'size': (1024, 1024), 'scale': '2x', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'} # 512x512@2x = 1024x1024
                ]
            }
        }

    def get_platform_specs(self, platform: str) -> Dict:
        """Get specifications for a platform"""
        platform_maps = {
            'android': self.android_specs,
            'ios': self.ios_specs,
            'web': self.web_specs,
            'windows': self.windows_specs,
            'macos': self.macos_specs
        }
        return platform_maps.get(platform.lower(), {})

    def get_recommendations_for_path(self, platform: str, file_path: str, image_type: str) -> List[Dict]:
        """Get size recommendations based on platform, path and image type"""
        specs = self.get_platform_specs(platform)
        if not specs:
            return []

        # Try to find matching specifications based on path and type
        for category in specs.values():
            for spec_type, spec_list in category.items():
                if self._path_matches_spec(file_path, spec_list, image_type):
                    return spec_list

        return []

    def _path_matches_spec(self, file_path: str, spec_list: List[Dict], image_type: str) -> bool:
        """Check if path matches specification type"""
        file_path_lower = file_path.lower()

        # Check for common patterns
        if image_type == 'icon':
            return any('icon' in file_path_lower or 'mipmap' in file_path_lower or
                      'launcher' in file_path_lower for spec in spec_list)
        elif image_type == 'background':
            return any('drawable' in file_path_lower or 'background' in file_path_lower
                      for spec in spec_list)
        elif image_type == 'splash':
            return any('drawable' in file_path_lower or 'splash' in file_path_lower or
                      'launch' in file_path_lower for spec in spec_list)

        return False

    def get_best_size_recommendation(self, platform: str, image_type: str, current_size: Tuple[int, int]) -> Optional[Dict]:
        """Get the best size recommendation for current image"""
        specs = self.get_platform_specs(platform)
        if not specs:
            return None

        # Map image types to spec categories
        type_mapping = {
            'icon': 'icons',
            'background': 'backgrounds',
            'splash': 'splash'
        }

        category_name = type_mapping.get(image_type)
        if not category_name or category_name not in specs:
            return None

        # Get all recommendations from the category
        all_recommendations = []
        for spec_list in specs[category_name].values():
            all_recommendations.extend(spec_list)

        if not all_recommendations:
            return None

        # Find the recommendation closest to current size
        best_match = None
        min_diff = float('inf')

        for rec in all_recommendations:
            rec_size = rec.get('size', (0, 0))
            size_diff = abs(rec_size[0] - current_size[0]) + abs(rec_size[1] - current_size[1])

            if size_diff < min_diff:
                min_diff = size_diff
                best_match = rec

        return best_match