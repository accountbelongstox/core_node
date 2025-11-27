#!/usr/bin/env python3
"""
Platform Specifications Manager
Unified manager for all platform-specific image specifications
"""

from typing import Dict, List, Tuple, Optional
import sys
import os

# Add the platform_specs directory to the path
platform_specs_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, platform_specs_dir)

from android_specs import AndroidSpecs
from ios_specs import IOSSpecs
from macos_specs import MacOSSpecs
from web_specs import WebSpecs
from windows_specs import WindowsSpecs

class PlatformSpecsManager:
    """Unified manager for all platform specifications"""

    def __init__(self):
        # Initialize all platform specification classes
        self.android = AndroidSpecs()
        self.ios = IOSSpecs()
        self.macos = MacOSSpecs()
        self.web = WebSpecs()
        self.windows = WindowsSpecs()

        # Platform mapping
        self.platform_map = {
            'android': self.android,
            'ios': self.ios,
            'macos': self.macos,
            'web': self.web,
            'windows': self.windows
        }

    def get_platform_specs(self, platform: str) -> Optional[object]:
        """Get the platform specification class for a given platform"""
        return self.platform_map.get(platform.lower())

    def get_all_recommendations(self, platform: str) -> Dict[str, List[Dict]]:
        """Get all recommendations for a platform"""
        platform_spec = self.get_platform_specs(platform)
        if platform_spec and hasattr(platform_spec, 'get_all_recommendations'):
            return platform_spec.get_all_recommendations()
        return {}

    def get_recommended_size_for_path(self, platform: str, file_path: str, image_type: str) -> Optional[Tuple[int, int]]:
        """Get recommended size based on platform, file path and image type"""
        platform_spec = self.get_platform_specs(platform)
        if platform_spec and hasattr(platform_spec, 'get_recommended_size_for_path'):
            return platform_spec.get_recommended_size_for_path(file_path, image_type)
        return None


    def get_platform_info(self, platform: str) -> Dict:
        """Get platform information"""
        platform_spec = self.get_platform_specs(platform)
        if platform_spec and hasattr(platform_spec, 'get_platform_info'):
            return platform_spec.get_platform_info()
        return {}

    def get_all_platforms(self) -> List[str]:
        """Get list of all supported platforms"""
        return list(self.platform_map.keys())

    def validate_icon_set(self, platform: str, icon_files: List[Dict]) -> Dict:
        """Validate a complete icon set for a platform"""
        platform_spec = self.get_platform_specs(platform)
        if platform_spec and hasattr(platform_spec, 'validate_icon_set'):
            return platform_spec.validate_icon_set(icon_files)

        # Default validation
        return {
            'found_sizes': [],
            'missing_recommendations': [],
            'is_complete': False,
            'completeness_score': 0
        }

    def match_path_to_spec(self, platform: str, file_path: str) -> Optional[str]:
        """Match file path to platform specification key"""
        platform_spec = self.get_platform_specs(platform)
        if platform_spec:
            # Try different method names that might exist
            for method_name in ['match_path_to_spec', 'match_filename_to_spec', 'match_directory_to_spec']:
                if hasattr(platform_spec, method_name):
                    method = getattr(platform_spec, method_name)
                    result = method(file_path)
                    if result:
                        return result
        return None

    def get_size_info_for_size(self, platform: str, width: int, height: int) -> Optional[Dict]:
        """Get size info and scale factor for given dimensions"""
        platform_spec = self.get_platform_specs(platform)
        if platform_spec and hasattr(platform_spec, 'get_size_info_for_size'):
            return platform_spec.get_size_info_for_size(width, height)
        return None

    def get_comprehensive_platform_summary(self) -> Dict:
        """Get a comprehensive summary of all platforms"""
        summary = {
            'total_platforms': len(self.platform_map),
            'platforms': {}
        }

        for platform_name, platform_spec in self.platform_map.items():
            platform_info = self.get_platform_info(platform_name)
            recommendations = self.get_all_recommendations(platform_name)

            summary['platforms'][platform_name] = {
                'info': platform_info,
                'recommendation_categories': list(recommendations.keys()),
                'total_recommendations': sum(len(recs) for recs in recommendations.values()) if recommendations else 0
            }

        return summary