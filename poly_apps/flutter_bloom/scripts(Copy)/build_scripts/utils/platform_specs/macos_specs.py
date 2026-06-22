#!/usr/bin/env python3
"""
macOS Platform Specifications
Comprehensive macOS image size specifications for desktop applications
"""

from typing import Dict, List, Tuple, Optional

class MacOSSpecs:
    """macOS platform image specifications with Retina variants"""

    def __init__(self):
        self.platform_name = "macos"
        self.specs = self._init_macos_specifications()

    def _init_macos_specifications(self) -> Dict:
        """Initialize comprehensive macOS specifications"""
        return {
            # App Icons for macOS with different sizes and scales
            'app-icon-16pt-1x': {'size': (16, 16), 'scale': '1x', 'points': '16pt'},
            'app-icon-16pt-2x': {'size': (32, 32), 'scale': '2x', 'points': '16pt'},
            'app-icon-32pt-1x': {'size': (32, 32), 'scale': '1x', 'points': '32pt'},
            'app-icon-32pt-2x': {'size': (64, 64), 'scale': '2x', 'points': '32pt'},
            'app-icon-128pt-1x': {'size': (128, 128), 'scale': '1x', 'points': '128pt'},
            'app-icon-128pt-2x': {'size': (256, 256), 'scale': '2x', 'points': '128pt'},
            'app-icon-256pt-1x': {'size': (256, 256), 'scale': '1x', 'points': '256pt'},
            'app-icon-256pt-2x': {'size': (512, 512), 'scale': '2x', 'points': '256pt'},
            'app-icon-512pt-1x': {'size': (512, 512), 'scale': '1x', 'points': '512pt'},
            'app-icon-512pt-2x': {'size': (1024, 1024), 'scale': '2x', 'points': '512pt'},

            # Mac Catalyst Icons (for iOS apps on Mac)
            'mac-catalyst-16pt-1x': {'size': (16, 16), 'scale': '1x', 'points': '16pt', 'catalyst': True},
            'mac-catalyst-16pt-2x': {'size': (32, 32), 'scale': '2x', 'points': '16pt', 'catalyst': True},
            'mac-catalyst-32pt-1x': {'size': (32, 32), 'scale': '1x', 'points': '32pt', 'catalyst': True},
            'mac-catalyst-32pt-2x': {'size': (64, 64), 'scale': '2x', 'points': '32pt', 'catalyst': True},
            'mac-catalyst-128pt-1x': {'size': (128, 128), 'scale': '1x', 'points': '128pt', 'catalyst': True},
            'mac-catalyst-128pt-2x': {'size': (256, 256), 'scale': '2x', 'points': '128pt', 'catalyst': True},
            'mac-catalyst-256pt-1x': {'size': (256, 256), 'scale': '1x', 'points': '256pt', 'catalyst': True},
            'mac-catalyst-256pt-2x': {'size': (512, 512), 'scale': '2x', 'points': '256pt', 'catalyst': True},
            'mac-catalyst-512pt-1x': {'size': (512, 512), 'scale': '1x', 'points': '512pt', 'catalyst': True},
            'mac-catalyst-512pt-2x': {'size': (1024, 1024), 'scale': '2x', 'points': '512pt', 'catalyst': True}
        }

    def get_app_icon_recommendations(self) -> List[Dict]:
        """Get macOS app icon size recommendations"""
        return [
            {'size': (16, 16), 'scale': '1x', 'points': '16pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'size': (32, 32), 'scale': '2x', 'points': '16pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'size': (32, 32), 'scale': '1x', 'points': '32pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'size': (64, 64), 'scale': '2x', 'points': '32pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'size': (128, 128), 'scale': '1x', 'points': '128pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'size': (256, 256), 'scale': '2x', 'points': '128pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'size': (256, 256), 'scale': '1x', 'points': '256pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'size': (512, 512), 'scale': '2x', 'points': '256pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'size': (512, 512), 'scale': '1x', 'points': '512pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'size': (1024, 1024), 'scale': '2x', 'points': '512pt', 'path': 'macos/Runner/Assets.xcassets/AppIcon.appiconset'}
        ]

    def get_all_recommendations(self) -> Dict[str, List[Dict]]:
        """Get all macOS recommendations organized by type"""
        return {
            'icons': self.get_app_icon_recommendations()
        }

    def match_filename_to_spec(self, filename: str) -> Optional[str]:
        """Match filename to macOS specification key"""
        filename_lower = filename.lower()

        # Extract size from common macOS icon naming patterns
        size_patterns = {
            '16': 'app-icon-16pt-1x',
            '32': 'app-icon-32pt-1x',
            '64': 'app-icon-32pt-2x',    # 32pt@2x = 64px
            '128': 'app-icon-128pt-1x',
            '256': 'app-icon-256pt-1x',  # Could also be 128pt@2x
            '512': 'app-icon-512pt-1x',  # Could also be 256pt@2x
            '1024': 'app-icon-512pt-2x'  # 512pt@2x = 1024px
        }

        # Check for explicit size in filename
        for size_str, spec_key in size_patterns.items():
            if size_str in filename_lower:
                # Handle ambiguous cases (256 and 512 could be different scales)
                if size_str == '256':
                    # If filename suggests @2x or retina, treat as 128pt@2x
                    if '@2x' in filename_lower or 'retina' in filename_lower or '128@2x' in filename_lower:
                        return 'app-icon-128pt-2x'
                    else:
                        return 'app-icon-256pt-1x'
                elif size_str == '512':
                    # If filename suggests @2x or retina, treat as 256pt@2x
                    if '@2x' in filename_lower or 'retina' in filename_lower or '256@2x' in filename_lower:
                        return 'app-icon-256pt-2x'
                    else:
                        return 'app-icon-512pt-1x'
                else:
                    return spec_key

        # Default fallback
        return 'app-icon-128pt-1x'

    def get_recommended_size_for_filename(self, filename: str) -> Optional[Tuple[int, int]]:
        """Get recommended size based on filename"""
        spec_key = self.match_filename_to_spec(filename)
        if not spec_key or spec_key not in self.specs:
            return None

        spec_info = self.specs[spec_key]
        return spec_info.get('size')

    def get_recommended_size_for_path(self, file_path: str, image_type: str) -> Optional[Tuple[int, int]]:
        """Get recommended size based on file path and image type"""
        filename = file_path.split('/')[-1] if '/' in file_path else file_path.split('\\')[-1]

        if image_type == 'icon':
            return self.get_recommended_size_for_filename(filename)

        return None

    def get_size_info_for_size(self, width: int, height: int) -> Optional[Dict]:
        """Get size info and scale factor for given dimensions"""
        if width != height:
            return None  # macOS icons should be square

        size = width

        # Find matching spec
        for spec_key, spec_info in self.specs.items():
            spec_size = spec_info.get('size', (0, 0))
            if spec_size[0] == size and spec_size[1] == size:
                return {
                    'spec_key': spec_key,
                    'points': spec_info.get('points', f'{size}pt'),
                    'scale': spec_info.get('scale', '1x'),
                    'is_retina': spec_info.get('scale') == '2x'
                }

        return None

    def validate_icon_set(self, icon_files: List[Dict]) -> Dict:
        """Validate a complete icon set and provide recommendations"""
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
            'name': 'macOS',
            'platform_key': self.platform_name,
            'total_specs': len(self.specs),
            'icon_sizes': [16, 32, 64, 128, 256, 512, 1024],
            'scale_factors': ['1x', '2x'],
            'supported_variants': ['app_icons', 'mac_catalyst_icons'],
            'icon_format': 'PNG recommended, ICNS for final app bundle'
        }