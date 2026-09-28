#!/usr/bin/env python3
"""
Android Platform Specifications
Comprehensive Android image size specifications and density recommendations
"""

from typing import Dict, List, Tuple, Optional

class AndroidSpecs:
    """Android platform image specifications with density variants"""

    def __init__(self):
        self.platform_name = "android"
        self.specs = self._init_android_specifications()

    def _init_android_specifications(self) -> Dict:
        """Initialize comprehensive Android specifications"""
        return {
            # Mipmap icons (launcher icons)
            'mipmap-ldpi': {'density': 'ldpi', 'dpi': 120, 'scale': 0.75},
            'mipmap-mdpi': {'density': 'mdpi', 'dpi': 160, 'scale': 1.0},
            'mipmap-hdpi': {'density': 'hdpi', 'dpi': 240, 'scale': 1.5},
            'mipmap-xhdpi': {'density': 'xhdpi', 'dpi': 320, 'scale': 2.0},
            'mipmap-xxhdpi': {'density': 'xxhdpi', 'dpi': 480, 'scale': 3.0},
            'mipmap-xxxhdpi': {'density': 'xxxhdpi', 'dpi': 640, 'scale': 4.0},

            # Drawable backgrounds and splash screens
            'drawable-ldpi': {'density': 'ldpi', 'dpi': 120, 'scale': 0.75},
            'drawable-mdpi': {'density': 'mdpi', 'dpi': 160, 'scale': 1.0},
            'drawable-hdpi': {'density': 'hdpi', 'dpi': 240, 'scale': 1.5},
            'drawable-xhdpi': {'density': 'xhdpi', 'dpi': 320, 'scale': 2.0},
            'drawable-xxhdpi': {'density': 'xxhdpi', 'dpi': 480, 'scale': 3.0},
            'drawable-xxxhdpi': {'density': 'xxxhdpi', 'dpi': 640, 'scale': 4.0},

            # Night mode variants
            'drawable-night-hdpi': {'density': 'hdpi', 'dpi': 240, 'scale': 1.5, 'mode': 'night'},
            'drawable-night-xhdpi': {'density': 'xhdpi', 'dpi': 320, 'scale': 2.0, 'mode': 'night'},
            'drawable-night-xxhdpi': {'density': 'xxhdpi', 'dpi': 480, 'scale': 3.0, 'mode': 'night'},

            # API level variants
            'drawable-v21': {'density': 'xhdpi', 'dpi': 320, 'scale': 2.0, 'api': 21},
            'drawable-v23': {'density': 'xhdpi', 'dpi': 320, 'scale': 2.0, 'api': 23},
            'drawable-v26': {'density': 'xhdpi', 'dpi': 320, 'scale': 2.0, 'api': 26},
            'drawable-night-v21': {'density': 'xhdpi', 'dpi': 320, 'scale': 2.0, 'api': 21, 'mode': 'night'},

            # Orientation variants
            'drawable-port': {'density': 'xhdpi', 'dpi': 320, 'scale': 2.0, 'orientation': 'portrait'},
            'drawable-land': {'density': 'xhdpi', 'dpi': 320, 'scale': 2.0, 'orientation': 'landscape'},
            'drawable-port-hdpi': {'density': 'hdpi', 'dpi': 240, 'scale': 1.5, 'orientation': 'portrait'},
            'drawable-land-hdpi': {'density': 'hdpi', 'dpi': 240, 'scale': 1.5, 'orientation': 'landscape'},

            # Adaptive icons (API 26+)
            'mipmap-anydpi-v26': {'density': 'anydpi', 'dpi': 'vector', 'scale': 'adaptive', 'api': 26}
        }

    def get_icon_recommendations(self) -> List[Dict]:
        """Get launcher icon size recommendations"""
        return [
            {'density': 'mdpi', 'size': (48, 48), 'path': 'res/mipmap-mdpi', 'dpi': 160},
            {'density': 'hdpi', 'size': (72, 72), 'path': 'res/mipmap-hdpi', 'dpi': 240},
            {'density': 'xhdpi', 'size': (96, 96), 'path': 'res/mipmap-xhdpi', 'dpi': 320},
            {'density': 'xxhdpi', 'size': (144, 144), 'path': 'res/mipmap-xxhdpi', 'dpi': 480},
            {'density': 'xxxhdpi', 'size': (192, 192), 'path': 'res/mipmap-xxxhdpi', 'dpi': 640}
        ]

    def get_background_recommendations(self) -> List[Dict]:
        """Get background/splash screen size recommendations"""
        return [
            {'density': 'mdpi', 'size': (320, 480), 'path': 'res/drawable-mdpi', 'dpi': 160},
            {'density': 'hdpi', 'size': (480, 800), 'path': 'res/drawable-hdpi', 'dpi': 240},
            {'density': 'xhdpi', 'size': (720, 1280), 'path': 'res/drawable-xhdpi', 'dpi': 320},
            {'density': 'xxhdpi', 'size': (1080, 1920), 'path': 'res/drawable-xxhdpi', 'dpi': 480},
            {'density': 'xxxhdpi', 'size': (1440, 2560), 'path': 'res/drawable-xxxhdpi', 'dpi': 640}
        ]

    def get_notification_recommendations(self) -> List[Dict]:
        """Get notification icon size recommendations"""
        return [
            {'density': 'mdpi', 'size': (24, 24), 'path': 'res/drawable-mdpi', 'dpi': 160},
            {'density': 'hdpi', 'size': (36, 36), 'path': 'res/drawable-hdpi', 'dpi': 240},
            {'density': 'xhdpi', 'size': (48, 48), 'path': 'res/drawable-xhdpi', 'dpi': 320},
            {'density': 'xxhdpi', 'size': (72, 72), 'path': 'res/drawable-xxhdpi', 'dpi': 480},
            {'density': 'xxxhdpi', 'size': (96, 96), 'path': 'res/drawable-xxxhdpi', 'dpi': 640}
        ]

    def get_all_recommendations(self) -> Dict[str, List[Dict]]:
        """Get all Android recommendations organized by type"""
        return {
            'icons': self.get_icon_recommendations(),
            'backgrounds': self.get_background_recommendations(),
            'splash': self.get_background_recommendations(),  # Same as background
            'notifications': self.get_notification_recommendations()
        }

    def match_directory_to_spec(self, directory_path: str) -> Optional[str]:
        """Match directory path to Android specification key"""
        dir_lower = directory_path.lower()

        # Direct matches first
        for spec_key in self.specs.keys():
            if spec_key in dir_lower:
                return spec_key

        # Keyword-based matching with priority
        density_keywords = ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi', 'ldpi']
        for density in density_keywords:
            if density in dir_lower:
                if 'mipmap' in dir_lower:
                    return f'mipmap-{density}'
                elif 'night' in dir_lower and 'v21' in dir_lower:
                    return f'drawable-night-v21'
                elif 'night' in dir_lower:
                    return f'drawable-night-{density}'
                elif 'v21' in dir_lower or 'v23' in dir_lower or 'v26' in dir_lower:
                    api_level = 'v21' if 'v21' in dir_lower else 'v23' if 'v23' in dir_lower else 'v26'
                    return f'drawable-{api_level}'
                elif 'port' in dir_lower:
                    return f'drawable-port-{density}' if f'drawable-port-{density}' in self.specs else 'drawable-port'
                elif 'land' in dir_lower:
                    return f'drawable-land-{density}' if f'drawable-land-{density}' in self.specs else 'drawable-land'
                else:
                    return f'drawable-{density}'

        # Fallback defaults
        if 'mipmap' in dir_lower:
            if 'anydpi' in dir_lower and 'v26' in dir_lower:
                return 'mipmap-anydpi-v26'
            return 'mipmap-mdpi'
        elif 'drawable' in dir_lower:
            if 'night' in dir_lower:
                return 'drawable-night-xhdpi'
            elif 'port' in dir_lower:
                return 'drawable-port'
            elif 'land' in dir_lower:
                return 'drawable-land'
            else:
                return 'drawable-xhdpi'

        return None

    def get_recommended_size_for_path(self, file_path: str, image_type: str) -> Optional[Tuple[int, int]]:
        """Get recommended size based on file path and image type"""
        spec_key = self.match_directory_to_spec(file_path)
        if not spec_key or spec_key not in self.specs:
            return None

        spec_info = self.specs[spec_key]
        density = spec_info.get('density', 'mdpi')

        # Get base sizes and scale by density
        if image_type == 'icon':
            base_sizes = {
                'ldpi': (36, 36), 'mdpi': (48, 48), 'hdpi': (72, 72),
                'xhdpi': (96, 96), 'xxhdpi': (144, 144), 'xxxhdpi': (192, 192)
            }
        elif image_type in ['background', 'splash']:
            base_sizes = {
                'mdpi': (320, 480), 'hdpi': (480, 800), 'xhdpi': (720, 1280),
                'xxhdpi': (1080, 1920), 'xxxhdpi': (1440, 2560)
            }
        elif image_type == 'notification':
            base_sizes = {
                'mdpi': (24, 24), 'hdpi': (36, 36), 'xhdpi': (48, 48),
                'xxhdpi': (72, 72), 'xxxhdpi': (96, 96)
            }
        else:
            return None

        return base_sizes.get(density)

    def get_platform_info(self) -> Dict:
        """Get platform information"""
        return {
            'name': 'Android',
            'platform_key': self.platform_name,
            'total_specs': len(self.specs),
            'density_levels': ['ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'],
            'supported_variants': ['night_mode', 'api_levels', 'orientation', 'adaptive_icons']
        }