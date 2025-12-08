#!/usr/bin/env python3
"""
iOS Platform Specifications
Comprehensive iOS image size specifications for iPhone and iPad
"""

from typing import Dict, List, Tuple, Optional

class IOSSpecs:
    """iOS platform image specifications with device variants"""

    def __init__(self):
        self.platform_name = "ios"
        self.specs = self._init_ios_specifications()

    def _init_ios_specifications(self) -> Dict:
        """Initialize comprehensive iOS specifications"""
        return {
            # iPhone App Icons
            'app-icon-iphone-60pt-2x': {'device': 'iPhone', 'size': (120, 120), 'scale': '2x', 'points': '60pt'},
            'app-icon-iphone-60pt-3x': {'device': 'iPhone', 'size': (180, 180), 'scale': '3x', 'points': '60pt'},

            # iPad App Icons
            'app-icon-ipad-76pt-1x': {'device': 'iPad', 'size': (76, 76), 'scale': '1x', 'points': '76pt'},
            'app-icon-ipad-76pt-2x': {'device': 'iPad', 'size': (152, 152), 'scale': '2x', 'points': '76pt'},
            'app-icon-ipad-83.5pt-2x': {'device': 'iPad Pro', 'size': (167, 167), 'scale': '2x', 'points': '83.5pt'},

            # App Store Icon
            'app-icon-appstore-1024pt-1x': {'device': 'App Store', 'size': (1024, 1024), 'scale': '1x', 'points': '1024pt'},

            # Notification Icons
            'notification-icon-20pt-2x': {'device': 'iPhone', 'size': (40, 40), 'scale': '2x', 'points': '20pt', 'type': 'notification'},
            'notification-icon-20pt-3x': {'device': 'iPhone', 'size': (60, 60), 'scale': '3x', 'points': '20pt', 'type': 'notification'},

            # Settings Icons
            'settings-icon-29pt-2x': {'device': 'iPhone', 'size': (58, 58), 'scale': '2x', 'points': '29pt', 'type': 'settings'},
            'settings-icon-29pt-3x': {'device': 'iPhone', 'size': (87, 87), 'scale': '3x', 'points': '29pt', 'type': 'settings'},

            # Spotlight Icons
            'spotlight-icon-40pt-2x': {'device': 'iPhone', 'size': (80, 80), 'scale': '2x', 'points': '40pt', 'type': 'spotlight'},
            'spotlight-icon-40pt-3x': {'device': 'iPhone', 'size': (120, 120), 'scale': '3x', 'points': '40pt', 'type': 'spotlight'},

            # Launch Screen Images
            'launch-image-iphone-se': {'device': 'iPhone SE', 'size': (640, 1136), 'orientation': 'portrait'},
            'launch-image-iphone-8': {'device': 'iPhone 8', 'size': (750, 1334), 'orientation': 'portrait'},
            'launch-image-iphone-8plus': {'device': 'iPhone 8 Plus', 'size': (1242, 2208), 'orientation': 'portrait'},
            'launch-image-iphone-x': {'device': 'iPhone X', 'size': (1125, 2436), 'orientation': 'portrait'},
            'launch-image-iphone-xr': {'device': 'iPhone XR', 'size': (828, 1792), 'orientation': 'portrait'},
            'launch-image-iphone-xs': {'device': 'iPhone XS', 'size': (1125, 2436), 'orientation': 'portrait'},
            'launch-image-iphone-xs-max': {'device': 'iPhone XS Max', 'size': (1242, 2688), 'orientation': 'portrait'},

            # iPad Launch Images
            'launch-image-ipad': {'device': 'iPad', 'size': (1536, 2048), 'orientation': 'portrait'},
            'launch-image-ipad-landscape': {'device': 'iPad', 'size': (2048, 1536), 'orientation': 'landscape'},
            'launch-image-ipad-pro-12.9': {'device': 'iPad Pro 12.9"', 'size': (2048, 2732), 'orientation': 'portrait'}
        }

    def get_app_icon_recommendations(self) -> List[Dict]:
        """Get app icon size recommendations"""
        return [
            {'device': 'iPhone', 'size': (120, 120), 'scale': '2x', 'points': '60pt', 'path': 'ios/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'device': 'iPhone', 'size': (180, 180), 'scale': '3x', 'points': '60pt', 'path': 'ios/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'device': 'iPad', 'size': (76, 76), 'scale': '1x', 'points': '76pt', 'path': 'ios/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'device': 'iPad', 'size': (152, 152), 'scale': '2x', 'points': '76pt', 'path': 'ios/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'device': 'iPad Pro', 'size': (167, 167), 'scale': '2x', 'points': '83.5pt', 'path': 'ios/Runner/Assets.xcassets/AppIcon.appiconset'},
            {'device': 'App Store', 'size': (1024, 1024), 'scale': '1x', 'points': '1024pt', 'path': 'ios/Runner/Assets.xcassets/AppIcon.appiconset'}
        ]

    def get_launch_image_recommendations(self) -> List[Dict]:
        """Get launch image size recommendations"""
        return [
            {'device': 'iPhone SE', 'size': (640, 1136), 'orientation': 'portrait', 'path': 'ios/Runner/Assets.xcassets/LaunchImage.launchimage'},
            {'device': 'iPhone 8', 'size': (750, 1334), 'orientation': 'portrait', 'path': 'ios/Runner/Assets.xcassets/LaunchImage.launchimage'},
            {'device': 'iPhone 8 Plus', 'size': (1242, 2208), 'orientation': 'portrait', 'path': 'ios/Runner/Assets.xcassets/LaunchImage.launchimage'},
            {'device': 'iPhone X', 'size': (1125, 2436), 'orientation': 'portrait', 'path': 'ios/Runner/Assets.xcassets/LaunchImage.launchimage'},
            {'device': 'iPhone XR', 'size': (828, 1792), 'orientation': 'portrait', 'path': 'ios/Runner/Assets.xcassets/LaunchImage.launchimage'},
            {'device': 'iPad', 'size': (1536, 2048), 'orientation': 'portrait', 'path': 'ios/Runner/Assets.xcassets/LaunchImage.launchimage'},
            {'device': 'iPad Pro 12.9"', 'size': (2048, 2732), 'orientation': 'portrait', 'path': 'ios/Runner/Assets.xcassets/LaunchImage.launchimage'}
        ]

    def get_all_recommendations(self) -> Dict[str, List[Dict]]:
        """Get all iOS recommendations organized by type"""
        return {
            'icons': self.get_app_icon_recommendations(),
            'launch': self.get_launch_image_recommendations(),
            'splash': self.get_launch_image_recommendations(),  # Same as launch images
            'backgrounds': self.get_launch_image_recommendations()  # Same as launch images
        }

    def match_path_to_spec(self, file_path: str) -> Optional[str]:
        """Match file path to iOS specification key"""
        path_lower = file_path.lower()

        # AppIcon.appiconset detection
        if 'appicon.appiconset' in path_lower:
            # Try to infer from filename or use common patterns
            filename = file_path.split('/')[-1].lower()

            # Common iOS app icon naming patterns
            if '180' in filename or '60@3x' in filename:
                return 'app-icon-iphone-60pt-3x'
            elif '120' in filename or '60@2x' in filename:
                return 'app-icon-iphone-60pt-2x'
            elif '152' in filename or '76@2x' in filename:
                return 'app-icon-ipad-76pt-2x'
            elif '167' in filename or '83.5@2x' in filename:
                return 'app-icon-ipad-83.5pt-2x'
            elif '1024' in filename:
                return 'app-icon-appstore-1024pt-1x'
            elif '76' in filename:
                return 'app-icon-ipad-76pt-1x'
            else:
                # Default for unknown app icons
                return 'app-icon-iphone-60pt-2x'

        # LaunchImage.launchimage detection
        elif 'launchimage.launchimage' in path_lower:
            # Try to infer device from filename or dimensions
            filename = file_path.split('/')[-1].lower()

            if 'ipad' in filename:
                return 'launch-image-ipad'
            elif 'iphonex' in filename or 'iphone-x' in filename:
                return 'launch-image-iphone-x'
            elif 'iphone8plus' in filename or 'iphone-8-plus' in filename:
                return 'launch-image-iphone-8plus'
            elif 'iphone8' in filename or 'iphone-8' in filename:
                return 'launch-image-iphone-8'
            else:
                # Default launch image
                return 'launch-image-iphone-8'

        return None

    def get_recommended_size_for_path(self, file_path: str, image_type: str) -> Optional[Tuple[int, int]]:
        """Get recommended size based on file path and image type"""
        spec_key = self.match_path_to_spec(file_path)
        if not spec_key or spec_key not in self.specs:
            # Fallback recommendations by image type
            if image_type == 'icon':
                return (120, 120)  # iPhone 60pt@2x
            elif image_type in ['background', 'splash', 'launch']:
                return (750, 1334)  # iPhone 8 portrait
            return None

        spec_info = self.specs[spec_key]
        return spec_info.get('size')

    def get_platform_info(self) -> Dict:
        """Get platform information"""
        return {
            'name': 'iOS',
            'platform_key': self.platform_name,
            'total_specs': len(self.specs),
            'supported_devices': ['iPhone', 'iPad', 'iPad Pro', 'App Store'],
            'scale_factors': ['1x', '2x', '3x'],
            'supported_variants': ['app_icons', 'launch_images', 'notification_icons', 'settings_icons']
        }