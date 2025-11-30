#!/usr/bin/env python3
"""
Windows Platform Specifications
Comprehensive Windows image size specifications for desktop applications
"""

from typing import Dict, List, Tuple, Optional

class WindowsSpecs:
    """Windows platform image specifications with icon variants"""

    def __init__(self):
        self.platform_name = "windows"
        self.specs = self._init_windows_specifications()

    def _init_windows_specifications(self) -> Dict:
        """Initialize comprehensive Windows specifications"""
        return {
            # Windows ICO format icons
            'app-icon-16x16': {'size': (16, 16), 'format': 'ico', 'type': 'app_icon'},
            'app-icon-24x24': {'size': (24, 24), 'format': 'ico', 'type': 'app_icon'},
            'app-icon-32x32': {'size': (32, 32), 'format': 'ico', 'type': 'app_icon'},
            'app-icon-48x48': {'size': (48, 48), 'format': 'ico', 'type': 'app_icon'},
            'app-icon-64x64': {'size': (64, 64), 'format': 'ico', 'type': 'app_icon'},
            'app-icon-96x96': {'size': (96, 96), 'format': 'ico', 'type': 'app_icon'},
            'app-icon-128x128': {'size': (128, 128), 'format': 'ico', 'type': 'app_icon'},
            'app-icon-256x256': {'size': (256, 256), 'format': 'ico', 'type': 'app_icon'},

            # Windows PNG icons (for newer applications)
            'app-icon-png-16x16': {'size': (16, 16), 'format': 'png', 'type': 'app_icon'},
            'app-icon-png-32x32': {'size': (32, 32), 'format': 'png', 'type': 'app_icon'},
            'app-icon-png-48x48': {'size': (48, 48), 'format': 'png', 'type': 'app_icon'},
            'app-icon-png-256x256': {'size': (256, 256), 'format': 'png', 'type': 'app_icon'},

            # Windows Installer icons
            'installer-icon-16x16': {'size': (16, 16), 'format': 'ico', 'type': 'installer'},
            'installer-icon-32x32': {'size': (32, 32), 'format': 'ico', 'type': 'installer'},
            'installer-icon-48x48': {'size': (48, 48), 'format': 'ico', 'type': 'installer'},

            # Windows Taskbar icons
            'taskbar-icon-16x16': {'size': (16, 16), 'format': 'ico', 'type': 'taskbar'},
            'taskbar-icon-24x24': {'size': (24, 24), 'format': 'ico', 'type': 'taskbar'},
            'taskbar-icon-32x32': {'size': (32, 32), 'format': 'ico', 'type': 'taskbar'},

            # Windows Context Menu icons
            'context-icon-16x16': {'size': (16, 16), 'format': 'ico', 'type': 'context_menu'},
            'context-icon-24x24': {'size': (24, 24), 'format': 'ico', 'type': 'context_menu'},
            'context-icon-32x32': {'size': (32, 32), 'format': 'ico', 'type': 'context_menu'},

            # Windows Store app icons (UWP)
            'uwp-square44x44': {'size': (44, 44), 'format': 'png', 'type': 'uwp', 'tile_type': 'square44x44'},
            'uwp-square71x71': {'size': (71, 71), 'format': 'png', 'type': 'uwp', 'tile_type': 'square71x71'},
            'uwp-square150x150': {'size': (150, 150), 'format': 'png', 'type': 'uwp', 'tile_type': 'square150x150'},
            'uwp-square310x310': {'size': (310, 310), 'format': 'png', 'type': 'uwp', 'tile_type': 'square310x310'},
            'uwp-wide310x150': {'size': (310, 150), 'format': 'png', 'type': 'uwp', 'tile_type': 'wide310x150'},

            # High DPI variants
            'app-icon-16x16-hdpi': {'size': (32, 32), 'format': 'ico', 'type': 'app_icon', 'dpi': 'high', 'base_size': '16x16'},
            'app-icon-32x32-hdpi': {'size': (64, 64), 'format': 'ico', 'type': 'app_icon', 'dpi': 'high', 'base_size': '32x32'},
            'app-icon-48x48-hdpi': {'size': (96, 96), 'format': 'ico', 'type': 'app_icon', 'dpi': 'high', 'base_size': '48x48'},

            # Windows notification icons
            'notification-icon-16x16': {'size': (16, 16), 'format': 'ico', 'type': 'notification'},
            'notification-icon-32x32': {'size': (32, 32), 'format': 'ico', 'type': 'notification'}
        }

    def get_app_icon_recommendations(self) -> List[Dict]:
        """Get Windows application icon recommendations"""
        return [
            {'size': (16, 16), 'format': 'ico', 'path': 'windows/runner/resources', 'type': 'app_icon'},
            {'size': (32, 32), 'format': 'ico', 'path': 'windows/runner/resources', 'type': 'app_icon'},
            {'size': (48, 48), 'format': 'ico', 'path': 'windows/runner/resources', 'type': 'app_icon'},
            {'size': (256, 256), 'format': 'ico', 'path': 'windows/runner/resources', 'type': 'app_icon'}
        ]

    def get_uwp_recommendations(self) -> List[Dict]:
        """Get UWP/Windows Store app recommendations"""
        return [
            {'size': (44, 44), 'format': 'png', 'path': 'windows/runner/resources', 'type': 'uwp', 'tile_type': 'square44x44'},
            {'size': (71, 71), 'format': 'png', 'path': 'windows/runner/resources', 'type': 'uwp', 'tile_type': 'square71x71'},
            {'size': (150, 150), 'format': 'png', 'path': 'windows/runner/resources', 'type': 'uwp', 'tile_type': 'square150x150'},
            {'size': (310, 310), 'format': 'png', 'path': 'windows/runner/resources', 'type': 'uwp', 'tile_type': 'square310x310'},
            {'size': (310, 150), 'format': 'png', 'path': 'windows/runner/resources', 'type': 'uwp', 'tile_type': 'wide310x150'}
        ]

    def get_installer_recommendations(self) -> List[Dict]:
        """Get Windows installer icon recommendations"""
        return [
            {'size': (16, 16), 'format': 'ico', 'path': 'windows/installer/resources', 'type': 'installer'},
            {'size': (32, 32), 'format': 'ico', 'path': 'windows/installer/resources', 'type': 'installer'},
            {'size': (48, 48), 'format': 'ico', 'path': 'windows/installer/resources', 'type': 'installer'}
        ]

    def get_all_recommendations(self) -> Dict[str, List[Dict]]:
        """Get all Windows recommendations organized by type"""
        return {
            'icons': self.get_app_icon_recommendations(),
            'uwp': self.get_uwp_recommendations(),
            'installer': self.get_installer_recommendations(),
            'app_icons': self.get_app_icon_recommendations()
        }

    def match_path_to_spec(self, file_path: str) -> Optional[str]:
        """Match file path to Windows specification key"""
        path_lower = file_path.lower()
        filename = file_path.split('/')[-1].lower()

        # Check if it's in Windows-specific paths
        if 'windows' not in path_lower and not filename.endswith('.ico'):
            return None

        # App icon detection
        if 'app' in filename or 'icon' in filename or filename.endswith('.ico'):
            # Size detection
            size_patterns = {
                '16': 'app-icon-16x16',
                '24': 'app-icon-24x24',
                '32': 'app-icon-32x32',
                '48': 'app-icon-48x48',
                '64': 'app-icon-64x64',
                '96': 'app-icon-96x96',
                '128': 'app-icon-128x128',
                '256': 'app-icon-256x256'
            }

            for size_str, spec_key in size_patterns.items():
                if size_str in filename:
                    # Check if it's PNG format
                    if filename.endswith('.png'):
                        png_variants = {
                            '16': 'app-icon-png-16x16',
                            '32': 'app-icon-png-32x32',
                            '48': 'app-icon-png-48x48',
                            '256': 'app-icon-png-256x256'
                        }
                        return png_variants.get(size_str, spec_key)
                    return spec_key

            # Default app icon
            return 'app-icon-32x32'

        # UWP tile detection
        elif 'uwp' in filename or 'tile' in filename or 'square' in filename or 'wide' in filename:
            if 'square44' in filename or '44x44' in filename:
                return 'uwp-square44x44'
            elif 'square71' in filename or '71x71' in filename:
                return 'uwp-square71x71'
            elif 'square150' in filename or '150x150' in filename:
                return 'uwp-square150x150'
            elif 'square310' in filename or '310x310' in filename:
                return 'uwp-square310x310'
            elif 'wide310' in filename or '310x150' in filename:
                return 'uwp-wide310x150'

        # Installer icon detection
        elif 'installer' in filename or 'setup' in filename:
            if '16' in filename:
                return 'installer-icon-16x16'
            elif '32' in filename:
                return 'installer-icon-32x32'
            elif '48' in filename:
                return 'installer-icon-48x48'
            else:
                return 'installer-icon-32x32'

        # Notification icon detection
        elif 'notification' in filename or 'notify' in filename:
            if '16' in filename:
                return 'notification-icon-16x16'
            elif '32' in filename:
                return 'notification-icon-32x32'
            else:
                return 'notification-icon-16x16'

        return None

    def get_recommended_size_for_path(self, file_path: str, image_type: str) -> Optional[Tuple[int, int]]:
        """Get recommended size based on file path and image type"""
        spec_key = self.match_path_to_spec(file_path)
        if not spec_key or spec_key not in self.specs:
            # Fallback recommendations by image type
            if image_type == 'icon':
                return (32, 32)  # Standard Windows icon
            elif image_type == 'installer':
                return (48, 48)  # Installer icon
            elif image_type == 'uwp':
                return (150, 150)  # UWP tile
            return None

        spec_info = self.specs[spec_key]
        return spec_info.get('size')

    def validate_icon_set(self, icon_files: List[Dict]) -> Dict:
        """Validate a complete Windows icon set"""
        found_sizes = set()
        missing_sizes = []
        recommendations = self.get_app_icon_recommendations()

        for icon_file in icon_files:
            width = icon_file.get('width', 0)
            height = icon_file.get('height', 0)
            if width == height and width > 0:
                found_sizes.add(width)

        for rec in recommendations:
            rec_size = rec['size'][0]
            if rec_size not in found_sizes:
                missing_sizes.append(rec)

        return {
            'found_sizes': sorted(list(found_sizes)),
            'missing_recommendations': missing_sizes,
            'is_complete': len(missing_sizes) == 0,
            'completeness_score': (len(recommendations) - len(missing_sizes)) / len(recommendations) * 100
        }

    def get_platform_info(self) -> Dict:
        """Get platform information"""
        return {
            'name': 'Windows',
            'platform_key': self.platform_name,
            'total_specs': len(self.specs),
            'supported_formats': ['ico', 'png'],
            'supported_variants': ['app_icons', 'uwp_tiles', 'installer_icons', 'high_dpi', 'context_menu'],
            'icon_sizes': [16, 24, 32, 48, 64, 96, 128, 256],
            'uwp_tile_sizes': [(44, 44), (71, 71), (150, 150), (310, 310), (310, 150)]
        }