#!/usr/bin/env python3
"""
Web Platform Specifications
Comprehensive web image size specifications for PWA and web applications
"""

from typing import Dict, List, Tuple, Optional

class WebSpecs:
    """Web platform image specifications for PWA and favicons"""

    def __init__(self):
        self.platform_name = "web"
        self.specs = self._init_web_specifications()

    def _init_web_specifications(self) -> Dict:
        """Initialize comprehensive web specifications"""
        return {
            # Favicons
            'favicon-16x16': {'size': (16, 16), 'format': 'ico', 'type': 'favicon'},
            'favicon-32x32': {'size': (32, 32), 'format': 'ico', 'type': 'favicon'},
            'favicon-48x48': {'size': (48, 48), 'format': 'ico', 'type': 'favicon'},
            'favicon-ico': {'size': (16, 16), 'format': 'ico', 'type': 'favicon', 'multi_size': True},

            # Apple Touch Icons
            'apple-touch-icon-57x57': {'size': (57, 57), 'format': 'png', 'type': 'apple_touch'},
            'apple-touch-icon-60x60': {'size': (60, 60), 'format': 'png', 'type': 'apple_touch'},
            'apple-touch-icon-72x72': {'size': (72, 72), 'format': 'png', 'type': 'apple_touch'},
            'apple-touch-icon-76x76': {'size': (76, 76), 'format': 'png', 'type': 'apple_touch'},
            'apple-touch-icon-114x114': {'size': (114, 114), 'format': 'png', 'type': 'apple_touch'},
            'apple-touch-icon-120x120': {'size': (120, 120), 'format': 'png', 'type': 'apple_touch'},
            'apple-touch-icon-144x144': {'size': (144, 144), 'format': 'png', 'type': 'apple_touch'},
            'apple-touch-icon-152x152': {'size': (152, 152), 'format': 'png', 'type': 'apple_touch'},
            'apple-touch-icon-180x180': {'size': (180, 180), 'format': 'png', 'type': 'apple_touch'},

            # PWA Manifest Icons
            'pwa-icon-72x72': {'size': (72, 72), 'format': 'png', 'type': 'pwa_manifest'},
            'pwa-icon-96x96': {'size': (96, 96), 'format': 'png', 'type': 'pwa_manifest'},
            'pwa-icon-128x128': {'size': (128, 128), 'format': 'png', 'type': 'pwa_manifest'},
            'pwa-icon-144x144': {'size': (144, 144), 'format': 'png', 'type': 'pwa_manifest'},
            'pwa-icon-152x152': {'size': (152, 152), 'format': 'png', 'type': 'pwa_manifest'},
            'pwa-icon-192x192': {'size': (192, 192), 'format': 'png', 'type': 'pwa_manifest'},
            'pwa-icon-384x384': {'size': (384, 384), 'format': 'png', 'type': 'pwa_manifest'},
            'pwa-icon-512x512': {'size': (512, 512), 'format': 'png', 'type': 'pwa_manifest'},

            # Android Chrome Icons
            'android-chrome-36x36': {'size': (36, 36), 'format': 'png', 'type': 'android_chrome', 'density': '0.75'},
            'android-chrome-48x48': {'size': (48, 48), 'format': 'png', 'type': 'android_chrome', 'density': '1.0'},
            'android-chrome-72x72': {'size': (72, 72), 'format': 'png', 'type': 'android_chrome', 'density': '1.5'},
            'android-chrome-96x96': {'size': (96, 96), 'format': 'png', 'type': 'android_chrome', 'density': '2.0'},
            'android-chrome-144x144': {'size': (144, 144), 'format': 'png', 'type': 'android_chrome', 'density': '3.0'},
            'android-chrome-192x192': {'size': (192, 192), 'format': 'png', 'type': 'android_chrome', 'density': '4.0'},

            # Microsoft Tiles
            'mstile-70x70': {'size': (70, 70), 'format': 'png', 'type': 'ms_tile', 'tile_type': 'square70x70'},
            'mstile-150x150': {'size': (150, 150), 'format': 'png', 'type': 'ms_tile', 'tile_type': 'square150x150'},
            'mstile-310x150': {'size': (310, 150), 'format': 'png', 'type': 'ms_tile', 'tile_type': 'wide310x150'},
            'mstile-310x310': {'size': (310, 310), 'format': 'png', 'type': 'ms_tile', 'tile_type': 'square310x310'},

            # Social Media Icons
            'og-image': {'size': (1200, 630), 'format': 'png', 'type': 'social', 'platform': 'open_graph'},
            'twitter-card': {'size': (1024, 512), 'format': 'png', 'type': 'social', 'platform': 'twitter'}
        }

    def get_favicon_recommendations(self) -> List[Dict]:
        """Get favicon size recommendations"""
        return [
            {'size': (16, 16), 'format': 'ico', 'path': 'web', 'type': 'favicon'},
            {'size': (32, 32), 'format': 'ico', 'path': 'web', 'type': 'favicon'},
            {'size': (48, 48), 'format': 'ico', 'path': 'web', 'type': 'favicon'},
            {'size': (192, 192), 'format': 'png', 'path': 'web/icons', 'type': 'favicon'}
        ]

    def get_pwa_recommendations(self) -> List[Dict]:
        """Get PWA manifest icon recommendations"""
        return [
            {'size': (72, 72), 'format': 'png', 'path': 'web/icons', 'type': 'pwa_manifest'},
            {'size': (96, 96), 'format': 'png', 'path': 'web/icons', 'type': 'pwa_manifest'},
            {'size': (128, 128), 'format': 'png', 'path': 'web/icons', 'type': 'pwa_manifest'},
            {'size': (144, 144), 'format': 'png', 'path': 'web/icons', 'type': 'pwa_manifest'},
            {'size': (152, 152), 'format': 'png', 'path': 'web/icons', 'type': 'pwa_manifest'},
            {'size': (192, 192), 'format': 'png', 'path': 'web/icons', 'type': 'pwa_manifest'},
            {'size': (384, 384), 'format': 'png', 'path': 'web/icons', 'type': 'pwa_manifest'},
            {'size': (512, 512), 'format': 'png', 'path': 'web/icons', 'type': 'pwa_manifest'}
        ]

    def get_apple_touch_recommendations(self) -> List[Dict]:
        """Get Apple Touch icon recommendations"""
        return [
            {'size': (57, 57), 'format': 'png', 'path': 'web/icons', 'type': 'apple_touch'},
            {'size': (60, 60), 'format': 'png', 'path': 'web/icons', 'type': 'apple_touch'},
            {'size': (72, 72), 'format': 'png', 'path': 'web/icons', 'type': 'apple_touch'},
            {'size': (76, 76), 'format': 'png', 'path': 'web/icons', 'type': 'apple_touch'},
            {'size': (114, 114), 'format': 'png', 'path': 'web/icons', 'type': 'apple_touch'},
            {'size': (120, 120), 'format': 'png', 'path': 'web/icons', 'type': 'apple_touch'},
            {'size': (144, 144), 'format': 'png', 'path': 'web/icons', 'type': 'apple_touch'},
            {'size': (152, 152), 'format': 'png', 'path': 'web/icons', 'type': 'apple_touch'},
            {'size': (180, 180), 'format': 'png', 'path': 'web/icons', 'type': 'apple_touch'}
        ]

    def get_all_recommendations(self) -> Dict[str, List[Dict]]:
        """Get all web recommendations organized by type"""
        return {
            'icons': self.get_favicon_recommendations(),
            'pwa': self.get_pwa_recommendations(),
            'apple_touch': self.get_apple_touch_recommendations(),
            'favicon': self.get_favicon_recommendations()
        }

    def match_path_to_spec(self, file_path: str) -> Optional[str]:
        """Match file path to web specification key"""
        path_lower = file_path.lower()
        filename = file_path.split('/')[-1].lower()

        # Favicon detection
        if 'favicon' in filename or path_lower.endswith('.ico'):
            if '16' in filename:
                return 'favicon-16x16'
            elif '32' in filename:
                return 'favicon-32x32'
            elif '48' in filename:
                return 'favicon-48x48'
            else:
                return 'favicon-ico'

        # Apple touch icon detection
        elif 'apple-touch' in filename or 'apple_touch' in filename:
            size_patterns = {
                '57': 'apple-touch-icon-57x57',
                '60': 'apple-touch-icon-60x60',
                '72': 'apple-touch-icon-72x72',
                '76': 'apple-touch-icon-76x76',
                '114': 'apple-touch-icon-114x114',
                '120': 'apple-touch-icon-120x120',
                '144': 'apple-touch-icon-144x144',
                '152': 'apple-touch-icon-152x152',
                '180': 'apple-touch-icon-180x180'
            }

            for size_str, spec_key in size_patterns.items():
                if size_str in filename:
                    return spec_key
            return 'apple-touch-icon-180x180'  # Default

        # PWA manifest icons
        elif 'manifest' in path_lower or 'pwa' in filename:
            size_patterns = {
                '72': 'pwa-icon-72x72',
                '96': 'pwa-icon-96x96',
                '128': 'pwa-icon-128x128',
                '144': 'pwa-icon-144x144',
                '152': 'pwa-icon-152x152',
                '192': 'pwa-icon-192x192',
                '384': 'pwa-icon-384x384',
                '512': 'pwa-icon-512x512'
            }

            for size_str, spec_key in size_patterns.items():
                if size_str in filename:
                    return spec_key
            return 'pwa-icon-192x192'  # Default

        # Microsoft tiles
        elif 'mstile' in filename or 'tile' in filename:
            if '70x70' in filename or '70' in filename:
                return 'mstile-70x70'
            elif '150x150' in filename or '150' in filename:
                return 'mstile-150x150'
            elif '310x150' in filename:
                return 'mstile-310x150'
            elif '310x310' in filename or '310' in filename:
                return 'mstile-310x310'

        return None

    def get_recommended_size_for_path(self, file_path: str, image_type: str) -> Optional[Tuple[int, int]]:
        """Get recommended size based on file path and image type"""
        spec_key = self.match_path_to_spec(file_path)
        if not spec_key or spec_key not in self.specs:
            # Fallback recommendations by image type
            if image_type == 'icon':
                return (192, 192)  # Standard web icon
            elif image_type in ['background', 'splash']:
                return (1200, 630)  # Open Graph standard
            return None

        spec_info = self.specs[spec_key]
        return spec_info.get('size')

    def get_platform_info(self) -> Dict:
        """Get platform information"""
        return {
            'name': 'Web',
            'platform_key': self.platform_name,
            'total_specs': len(self.specs),
            'supported_formats': ['ico', 'png'],
            'supported_variants': ['favicons', 'pwa_icons', 'apple_touch_icons', 'ms_tiles', 'social_media']
        }