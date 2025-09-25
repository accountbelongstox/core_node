# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

"""
Platform Asset Scanner
Scans all platform directories for existing assets and creates replacement maps
"""

import os
import glob
from typing import Dict, List, Any

class PlatformAssetScanner:
    """Scans platform directories for assets that need replacement"""
    
    def __init__(self, working_directory: str):
        self.working_directory = working_directory
        self.platform_dirs = {
            'android': os.path.join(working_directory, 'android'),
            'web': os.path.join(working_directory, 'web'),
            'windows': os.path.join(working_directory, 'windows'),
            'macos': os.path.join(working_directory, 'macos'),
            'ios': os.path.join(working_directory, 'ios')
        }
    
    def scan_all_platforms(self) -> Dict[str, Any]:
        """Scan all platform directories for assets"""
        platform_assets = {}
        
        for platform, platform_dir in self.platform_dirs.items():
            if os.path.exists(platform_dir):
                print(f"[INFO] Scanning {platform} platform assets")
                platform_assets[platform] = self.scan_platform_assets(platform, platform_dir)
            else:
                print(f"[WARNING] Platform directory not found: {platform}")
                platform_assets[platform] = {}
        
        return platform_assets
    
    def scan_platform_assets(self, platform: str, platform_dir: str) -> Dict[str, List[str]]:
        """Scan specific platform directory for assets"""
        assets = {
            'icons': [],
            'images': [],
            'splash_screens': [],
            'backgrounds': []
        }
        
        # Define search patterns for each platform
        search_patterns = self.get_search_patterns(platform)
        
        for asset_type, patterns in search_patterns.items():
            for pattern in patterns:
                search_path = os.path.join(platform_dir, pattern)
                found_files = glob.glob(search_path, recursive=True)
                
                # Filter out 1px placeholder images
                filtered_files = []
                for file_path in found_files:
                    if self.is_valid_asset_file(file_path):
                        relative_path = os.path.relpath(file_path, self.working_directory)
                        filtered_files.append(relative_path)
                
                assets[asset_type].extend(filtered_files)
        
        return assets
    
    def get_search_patterns(self, platform: str) -> Dict[str, List[str]]:
        """Get search patterns for each platform"""
        patterns = {
            'android': {
                'icons': [
                    '**/mipmap-*/ic_launcher.png',
                    '**/mipmap-*/ic_launcher.webp',
                    '**/drawable-*/ic_launcher.png',
                    '**/drawable-*/ic_notification.png'
                ],
                'images': [
                    '**/drawable-*/*.png',
                    '**/drawable-*/*.jpg',
                    '**/drawable-*/*.webp'
                ],
                'splash_screens': [
                    '**/drawable-*/launch_background.xml',
                    '**/drawable-*/splash.png'
                ],
                'backgrounds': [
                    '**/drawable-*/background.png',
                    '**/drawable-*/bg_*.png'
                ]
            },
            'web': {
                'icons': [
                    'icons/Icon-*.png',
                    'favicon.png',
                    'manifest.json'
                ],
                'images': [
                    'icons/*.png',
                    'assets/images/*.png',
                    'assets/images/*.jpg'
                ],
                'splash_screens': [
                    'splash/img/light-*.png',
                    'splash/img/dark-*.png'
                ],
                'backgrounds': []
            },
            'windows': {
                'icons': [
                    'runner/resources/app_icon.ico'
                ],
                'images': [],
                'splash_screens': [],
                'backgrounds': []
            },
            'macos': {
                'icons': [
                    'Runner/Assets.xcassets/AppIcon.appiconset/*.png'
                ],
                'images': [],
                'splash_screens': [],
                'backgrounds': []
            },
            'ios': {
                'icons': [
                    'Runner/Assets.xcassets/AppIcon.appiconset/*.png'
                ],
                'images': [],
                'splash_screens': [
                    'Runner/Assets.xcassets/LaunchImage.imageset/*.png'
                ],
                'backgrounds': []
            }
        }
        
        return patterns.get(platform, {})
    
    def is_valid_asset_file(self, file_path: str) -> bool:
        """Check if asset file is valid (not a 1px placeholder)"""
        if not os.path.isfile(file_path):
            return False
        
        # Check file size - skip very small files (likely placeholders)
        file_size = os.path.getsize(file_path)
        if file_size < 100:  # Less than 100 bytes is likely a placeholder
            return False
        
        # Check if it's an image file
        valid_extensions = ['.png', '.jpg', '.jpeg', '.webp', '.ico']
        file_ext = os.path.splitext(file_path)[1].lower()
        
        return file_ext in valid_extensions
    
    def get_recommended_sizes(self, platform: str, asset_type: str) -> Dict[str, tuple]:
        """Get recommended sizes for different asset types per platform"""
        size_maps = {
            'android': {
                'icons': {
                    'mdpi': (48, 48),
                    'hdpi': (72, 72),
                    'xhdpi': (96, 96),
                    'xxhdpi': (144, 144),
                    'xxxhdpi': (192, 192)
                },
                'notification_icons': {
                    'mdpi': (24, 24),
                    'hdpi': (36, 36),
                    'xhdpi': (48, 48),
                    'xxhdpi': (72, 72),
                    'xxxhdpi': (96, 96)
                }
            },
            'web': {
                'icons': {
                    'Icon-192': (192, 192),
                    'Icon-512': (512, 512),
                    'Icon-maskable-192': (192, 192),
                    'Icon-maskable-512': (512, 512)
                }
            },
            'windows': {
                'icons': {
                    'app_icon': (256, 256)
                }
            }
        }
        
        return size_maps.get(platform, {}).get(asset_type, {})
