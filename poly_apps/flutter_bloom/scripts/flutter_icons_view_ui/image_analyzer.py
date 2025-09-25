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
Image Analyzer Module for Flutter Icons Visualization System
Provides intelligent image classification and size recommendation
Author: Development Script System
Version: 1.0
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import math

class ImageAnalyzer:
    """
    Intelligent image analyzer for Flutter icon management
    Provides classification and size recommendation functionality
    """
    
    def __init__(self):
        # Android density mappings
        self.android_densities = {
            'ldpi': 0.75,    # 120dpi
            'mdpi': 1.0,     # 160dpi (baseline)
            'hdpi': 1.5,     # 240dpi
            'xhdpi': 2.0,    # 320dpi
            'xxhdpi': 3.0,   # 480dpi
            'xxxhdpi': 4.0   # 640dpi
        }
        
        # iOS scale factors
        self.ios_scales = {
            '1x': 1.0,
            '2x': 2.0,
            '3x': 3.0
        }
        
        # Standard icon sizes (width x height)
        self.standard_icon_sizes = {
            # Android launcher icons (mdpi baseline)
            'android_launcher': {
                'ldpi': (36, 36),
                'mdpi': (48, 48),
                'hdpi': (72, 72),
                'xhdpi': (96, 96),
                'xxhdpi': (144, 144),
                'xxxhdpi': (192, 192)
            },
            # Android notification icons
            'android_notification': {
                'ldpi': (18, 18),
                'mdpi': (24, 24),
                'hdpi': (36, 36),
                'xhdpi': (48, 48),
                'xxhdpi': (72, 72),
                'xxxhdpi': (96, 96)
            },
            # iOS app icons
            'ios_app': {
                '29pt': [(29, 29), (58, 58), (87, 87)],    # Settings
                '40pt': [(40, 40), (80, 80), (120, 120)],  # Spotlight
                '60pt': [(60, 60), (120, 120), (180, 180)], # App
                '76pt': [(76, 76), (152, 152), (228, 228)], # iPad
                '83.5pt': [(167, 167)],  # iPad Pro
                '1024pt': [(1024, 1024)]  # App Store
            },
            # Windows icons
            'windows_app': {
                'small': (16, 16),
                'medium': (32, 32),
                'large': (48, 48),
                'extra_large': (256, 256)
            },
            # Web icons
            'web_favicon': {
                'standard': (16, 16),
                'large': (32, 32),
                'apple_touch': (180, 180),
                'android_chrome': [(192, 192), (512, 512)]
            }
        }
        
        # Splash screen sizes
        self.splash_screen_sizes = {
            # Android splash screens (common resolutions)
            'android_splash': [
                (320, 480),   # HVGA
                (480, 800),   # WVGA
                (720, 1280),  # HD
                (1080, 1920), # Full HD
                (1440, 2560), # QHD
                (2160, 3840)  # 4K
            ],
            # iOS splash screens
            'ios_splash': [
                (320, 568),   # iPhone 5/5s/SE
                (375, 667),   # iPhone 6/7/8
                (414, 736),   # iPhone 6+/7+/8+
                (375, 812),   # iPhone X/XS
                (414, 896),   # iPhone XR/XS Max
                (768, 1024),  # iPad
                (834, 1112),  # iPad Pro 10.5"
                (1024, 1366), # iPad Pro 12.9"
            ]
        }
        
        # Image classification patterns
        self.classification_patterns = {
            'icon_patterns': [
                r'ic_launcher',
                r'app_icon',
                r'icon',
                r'logo',
                r'notification.*icon'
            ],
            'splash_patterns': [
                r'splash',
                r'launch.*image',
                r'background',
                r'loading'
            ],
            'placeholder_patterns': [
                r'placeholder',
                r'default',
                r'fallback',
                r'empty'
            ]
        }
    
    def classify_image(self, image_path: Path, width: Optional[int] = None, height: Optional[int] = None) -> Dict[str, any]:
        """
        Classify image based on path, name, and dimensions
        
        Args:
            image_path: Path to the image file
            width: Image width in pixels
            height: Image height in pixels
            
        Returns:
            Dictionary with classification results
        """
        
        filename = image_path.name.lower()
        parent_dirs = [p.name.lower() for p in image_path.parents]
        
        classification = {
            'category': 'Other',
            'subcategory': None,
            'confidence': 0.0,
            'platform': self.detect_platform(image_path),
            'size_category': None,
            'is_vector': filename.endswith('.svg')
        }
        
        # Check for icon patterns
        icon_confidence = self.check_patterns(filename, self.classification_patterns['icon_patterns'])
        if icon_confidence > 0:
            classification['category'] = 'Icon'
            classification['confidence'] = max(classification['confidence'], icon_confidence)
            
            # Determine icon subcategory
            if width and height:
                classification['subcategory'] = self.classify_icon_size(width, height, classification['platform'])
        
        # Check for splash screen patterns
        splash_confidence = self.check_patterns(filename, self.classification_patterns['splash_patterns'])
        if splash_confidence > 0 and splash_confidence > classification['confidence']:
            classification['category'] = 'Background/Splash'
            classification['confidence'] = splash_confidence
            
            if width and height:
                classification['subcategory'] = self.classify_splash_size(width, height)
        
        # Check for placeholder patterns
        placeholder_confidence = self.check_patterns(filename, self.classification_patterns['placeholder_patterns'])
        if placeholder_confidence > 0 and placeholder_confidence > classification['confidence']:
            classification['category'] = 'Placeholder'
            classification['confidence'] = placeholder_confidence
        
        # Directory-based classification
        dir_classification = self.classify_by_directory(parent_dirs)
        if dir_classification['confidence'] > classification['confidence']:
            classification.update(dir_classification)
        
        # Size-based classification
        if width and height and classification['category'] == 'Other':
            size_classification = self.classify_by_size(width, height)
            if size_classification['confidence'] > classification['confidence']:
                classification.update(size_classification)
        
        return classification
    
    def check_patterns(self, text: str, patterns: List[str]) -> float:
        """Check text against pattern list and return confidence score"""
        max_confidence = 0.0
        
        for pattern in patterns:
            if re.search(pattern, text):
                # Higher confidence for exact matches
                if pattern == text:
                    max_confidence = max(max_confidence, 1.0)
                else:
                    max_confidence = max(max_confidence, 0.8)
        
        return max_confidence
    
    def detect_platform(self, image_path: Path) -> str:
        """Detect platform based on directory structure"""
        path_str = str(image_path).lower()
        
        if 'android' in path_str or 'mipmap' in path_str or 'drawable' in path_str:
            return 'Android'
        elif 'ios' in path_str or 'assets.xcassets' in path_str or 'appicon' in path_str:
            return 'iOS'
        elif 'windows' in path_str or '.ico' in path_str:
            return 'Windows'
        elif 'web' in path_str or 'favicon' in path_str:
            return 'Web'
        
        return 'Unknown'
    
    def classify_by_directory(self, parent_dirs: List[str]) -> Dict[str, any]:
        """Classify image based on parent directory names"""
        classification = {'confidence': 0.0}
        
        for dir_name in parent_dirs:
            if any(keyword in dir_name for keyword in ['mipmap', 'drawable']):
                classification.update({
                    'category': 'Icon',
                    'subcategory': 'Android Resource',
                    'confidence': 0.9,
                    'platform': 'Android'
                })
                break
            elif 'assets.xcassets' in dir_name or 'appicon' in dir_name:
                classification.update({
                    'category': 'Icon',
                    'subcategory': 'iOS Resource',
                    'confidence': 0.9,
                    'platform': 'iOS'
                })
                break
            elif any(keyword in dir_name for keyword in ['splash', 'launch']):
                classification.update({
                    'category': 'Background/Splash',
                    'confidence': 0.8
                })
                break
        
        return classification
    
    def classify_icon_size(self, width: int, height: int, platform: str) -> str:
        """Classify icon based on size"""
        size = (width, height)
        
        # Small icons (typically < 64px)
        if max(width, height) <= 64:
            return 'Small Icon'
        # Large icons (typically > 128px)
        elif min(width, height) >= 128:
            return 'Large Icon'
        # Medium icons
        else:
            return 'Medium Icon'
    
    def classify_splash_size(self, width: int, height: int) -> str:
        """Classify splash screen based on size"""
        aspect_ratio = width / height if height > 0 else 1.0
        
        # Typical phone aspect ratios
        if 0.5 <= aspect_ratio <= 0.8:
            return 'Portrait Splash'
        elif 1.2 <= aspect_ratio <= 2.0:
            return 'Landscape Splash'
        elif 0.9 <= aspect_ratio <= 1.1:
            return 'Square Background'
        else:
            return 'Custom Splash'
    
    def classify_by_size(self, width: int, height: int) -> Dict[str, any]:
        """Classify image based purely on dimensions"""
        classification = {'confidence': 0.0}
        
        # Very small images are likely icons
        if max(width, height) <= 32:
            classification.update({
                'category': 'Icon',
                'subcategory': 'Small Icon',
                'confidence': 0.6
            })
        # Square images of typical icon sizes
        elif width == height and 48 <= width <= 512:
            classification.update({
                'category': 'Icon',
                'subcategory': f'{width}x{height} Icon',
                'confidence': 0.7
            })
        # Large rectangular images are likely splash screens
        elif (width >= 320 and height >= 480) or (width >= 480 and height >= 320):
            classification.update({
                'category': 'Background/Splash',
                'subcategory': 'Large Background',
                'confidence': 0.6
            })
        
        return classification
    
    def get_size_recommendations(self, image_path: Path, width: int, height: int) -> Dict[str, any]:
        """
        Get size recommendations and compliance score for an image
        
        Args:
            image_path: Path to the image file
            width: Current image width
            height: Current image height
            
        Returns:
            Dictionary with recommendations and compliance score
        """
        
        platform = self.detect_platform(image_path)
        filename = image_path.name.lower()
        parent_dirs = [p.name.lower() for p in image_path.parents]
        
        recommendations = {
            'current_size': (width, height),
            'platform': platform,
            'compliance_score': 0.0,
            'recommended_sizes': [],
            'size_category': None,
            'density_bucket': None,
            'issues': [],
            'suggestions': []
        }
        
        # Android-specific recommendations
        if platform == 'Android':
            recommendations.update(self.get_android_recommendations(image_path, width, height))
        
        # iOS-specific recommendations
        elif platform == 'iOS':
            recommendations.update(self.get_ios_recommendations(image_path, width, height))
        
        # Windows-specific recommendations
        elif platform == 'Windows':
            recommendations.update(self.get_windows_recommendations(image_path, width, height))
        
        # Web-specific recommendations
        elif platform == 'Web':
            recommendations.update(self.get_web_recommendations(image_path, width, height))
        
        # General recommendations for unknown platforms
        else:
            recommendations.update(self.get_general_recommendations(image_path, width, height))
        
        return recommendations
    
    def get_android_recommendations(self, image_path: Path, width: int, height: int) -> Dict[str, any]:
        """Get Android-specific size recommendations"""
        recommendations = {
            'recommended_sizes': [],
            'compliance_score': 0.0,
            'issues': [],
            'suggestions': []
        }
        
        path_str = str(image_path).lower()
        
        # Detect density bucket from path
        density = None
        for density_name in self.android_densities.keys():
            if density_name in path_str:
                density = density_name
                break
        
        recommendations['density_bucket'] = density
        
        # Launcher icon recommendations
        if any(keyword in path_str for keyword in ['launcher', 'ic_launcher']):
            recommendations['size_category'] = 'Launcher Icon'
            expected_sizes = self.standard_icon_sizes['android_launcher']
            
            if density and density in expected_sizes:
                expected_size = expected_sizes[density]
                recommendations['recommended_sizes'] = [expected_size]
                
                # Calculate compliance score
                if (width, height) == expected_size:
                    recommendations['compliance_score'] = 1.0
                else:
                    # Partial score based on how close the size is
                    size_diff = abs(width - expected_size[0]) + abs(height - expected_size[1])
                    recommendations['compliance_score'] = max(0.0, 1.0 - (size_diff / sum(expected_size)))
                    
                    recommendations['issues'].append(
                        f"Size mismatch: expected {expected_size}, got ({width}, {height})"
                    )
                    recommendations['suggestions'].append(
                        f"Resize to {expected_size[0]}x{expected_size[1]} for {density} density"
                    )
            else:
                # Recommend all density sizes
                recommendations['recommended_sizes'] = list(expected_sizes.values())
                recommendations['suggestions'].append("Create icons for all density buckets")
        
        # Notification icon recommendations
        elif any(keyword in path_str for keyword in ['notification', 'notify']):
            recommendations['size_category'] = 'Notification Icon'
            expected_sizes = self.standard_icon_sizes['android_notification']
            
            if density and density in expected_sizes:
                expected_size = expected_sizes[density]
                recommendations['recommended_sizes'] = [expected_size]
                
                if (width, height) != expected_size:
                    recommendations['issues'].append(
                        f"Notification icon size mismatch: expected {expected_size}"
                    )
        
        return recommendations
    
    def get_ios_recommendations(self, image_path: Path, width: int, height: int) -> Dict[str, any]:
        """Get iOS-specific size recommendations"""
        recommendations = {
            'recommended_sizes': [],
            'compliance_score': 0.0,
            'issues': [],
            'suggestions': []
        }
        
        path_str = str(image_path).lower()
        filename = image_path.name.lower()
        
        # App icon recommendations
        if 'appicon' in path_str or 'app_icon' in filename:
            recommendations['size_category'] = 'App Icon'
            
            # Check for specific iOS icon sizes
            all_ios_sizes = []
            for size_category, sizes in self.standard_icon_sizes['ios_app'].items():
                all_ios_sizes.extend(sizes)
            
            recommendations['recommended_sizes'] = all_ios_sizes
            
            if (width, height) in all_ios_sizes:
                recommendations['compliance_score'] = 1.0
            else:
                # Find closest match
                closest_size = min(all_ios_sizes, key=lambda s: abs(s[0] - width) + abs(s[1] - height))
                size_diff = abs(width - closest_size[0]) + abs(height - closest_size[1])
                recommendations['compliance_score'] = max(0.0, 1.0 - (size_diff / sum(closest_size)))
                
                recommendations['issues'].append(
                    f"Non-standard iOS icon size: ({width}, {height})"
                )
                recommendations['suggestions'].append(
                    f"Consider using standard iOS sizes like {closest_size}"
                )
        
        # Launch image recommendations
        elif any(keyword in path_str for keyword in ['launch', 'splash']):
            recommendations['size_category'] = 'Launch Image'
            recommendations['recommended_sizes'] = self.splash_screen_sizes['ios_splash']
            
            # Check if current size matches any standard iOS screen size
            if (width, height) in self.splash_screen_sizes['ios_splash']:
                recommendations['compliance_score'] = 1.0
            else:
                recommendations['compliance_score'] = 0.5
                recommendations['suggestions'].append("Consider using standard iOS device resolutions")
        
        return recommendations
    
    def get_windows_recommendations(self, image_path: Path, width: int, height: int) -> Dict[str, any]:
        """Get Windows-specific size recommendations"""
        recommendations = {
            'recommended_sizes': [],
            'compliance_score': 0.0,
            'issues': [],
            'suggestions': []
        }
        
        path_str = str(image_path).lower()
        
        if 'icon' in path_str or image_path.suffix.lower() == '.ico':
            recommendations['size_category'] = 'Windows Icon'
            windows_sizes = list(self.standard_icon_sizes['windows_app'].values())
            recommendations['recommended_sizes'] = windows_sizes
            
            if (width, height) in windows_sizes:
                recommendations['compliance_score'] = 1.0
            else:
                recommendations['compliance_score'] = 0.5
                recommendations['suggestions'].append("Use standard Windows icon sizes: 16x16, 32x32, 48x48, 256x256")
        
        return recommendations
    
    def get_web_recommendations(self, image_path: Path, width: int, height: int) -> Dict[str, any]:
        """Get Web-specific size recommendations"""
        recommendations = {
            'recommended_sizes': [],
            'compliance_score': 0.0,
            'issues': [],
            'suggestions': []
        }
        
        filename = image_path.name.lower()
        
        if 'favicon' in filename:
            recommendations['size_category'] = 'Favicon'
            favicon_sizes = [self.standard_icon_sizes['web_favicon']['standard'],
                           self.standard_icon_sizes['web_favicon']['large']]
            recommendations['recommended_sizes'] = favicon_sizes
            
            if (width, height) in favicon_sizes:
                recommendations['compliance_score'] = 1.0
            else:
                recommendations['suggestions'].append("Use 16x16 or 32x32 for favicons")
        
        elif 'apple-touch-icon' in filename:
            recommendations['size_category'] = 'Apple Touch Icon'
            touch_icon_size = self.standard_icon_sizes['web_favicon']['apple_touch']
            recommendations['recommended_sizes'] = [touch_icon_size]
            
            if (width, height) == touch_icon_size:
                recommendations['compliance_score'] = 1.0
            else:
                recommendations['suggestions'].append("Use 180x180 for Apple touch icons")
        
        return recommendations
    
    def get_general_recommendations(self, image_path: Path, width: int, height: int) -> Dict[str, any]:
        """Get general size recommendations for unknown platforms"""
        recommendations = {
            'recommended_sizes': [],
            'compliance_score': 0.5,  # Neutral score for unknown platforms
            'issues': [],
            'suggestions': []
        }
        
        filename = image_path.name.lower()
        
        # General icon size suggestions
        if any(keyword in filename for keyword in ['icon', 'logo']):
            recommendations['size_category'] = 'Generic Icon'
            recommendations['recommended_sizes'] = [(48, 48), (96, 96), (144, 144), (192, 192)]
            recommendations['suggestions'].append("Consider creating multiple sizes for different use cases")
        
        # General background/splash suggestions
        elif any(keyword in filename for keyword in ['background', 'splash', 'launch']):
            recommendations['size_category'] = 'Background Image'
            recommendations['recommended_sizes'] = [(1080, 1920), (1440, 2560)]
            recommendations['suggestions'].append("Use high resolution for better quality on various devices")
        
        return recommendations
    
    def get_compression_recommendations(self, image_path: Path, file_size_bytes: int, width: int, height: int) -> Dict[str, any]:
        """
        Get compression recommendations based on image characteristics
        
        Args:
            image_path: Path to the image file
            file_size_bytes: Current file size in bytes
            width: Image width
            height: Image height
            
        Returns:
            Dictionary with compression recommendations
        """
        
        recommendations = {
            'current_size_kb': file_size_bytes / 1024,
            'should_compress': False,
            'target_size_kb': None,
            'compression_ratio': None,
            'format_recommendation': None,
            'quality_recommendation': None,
            'reasons': []
        }
        
        # Calculate pixel count
        pixel_count = width * height
        
        # Estimate reasonable file size based on image type and size
        classification = self.classify_image(image_path, width, height)
        
        if classification['category'] == 'Icon':
            # Icons should be relatively small
            target_size_kb = min(50, pixel_count / 1000)  # Rough estimate
            
            if file_size_bytes / 1024 > target_size_kb * 2:
                recommendations['should_compress'] = True
                recommendations['target_size_kb'] = target_size_kb
                recommendations['reasons'].append(f"Icon file size too large for {width}x{height}")
                
        elif classification['category'] == 'Background/Splash':
            # Splash screens can be larger but should still be optimized
            target_size_kb = min(500, pixel_count / 500)  # More generous for backgrounds
            
            if file_size_bytes / 1024 > target_size_kb * 1.5:
                recommendations['should_compress'] = True
                recommendations['target_size_kb'] = target_size_kb
                recommendations['reasons'].append("Background image could be optimized")
        
        # Format recommendations
        file_ext = image_path.suffix.lower()
        
        if classification['category'] == 'Icon' and file_ext in ['.jpg', '.jpeg']:
            recommendations['format_recommendation'] = 'PNG'
            recommendations['reasons'].append("Icons should use PNG format for transparency support")
        
        elif classification['category'] == 'Background/Splash' and file_ext == '.png':
            # Check if transparency is needed
            recommendations['format_recommendation'] = 'JPEG'
            recommendations['reasons'].append("Backgrounds without transparency can use JPEG for smaller size")
        
        # Quality recommendations
        if recommendations['should_compress']:
            if classification['category'] == 'Icon':
                recommendations['quality_recommendation'] = 90  # High quality for icons
            else:
                recommendations['quality_recommendation'] = 85  # Good balance for backgrounds
        
        return recommendations

def main():
    """Test the image analyzer functionality"""
    analyzer = ImageAnalyzer()
    
    # Test classification
    test_paths = [
        Path("/android/app/src/main/res/mipmap-hdpi/ic_launcher.png"),
        Path("/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-60@2x.png"),
        Path("/web/icons/favicon.png"),
        Path("/android/app/src/main/res/drawable-xhdpi/splash.png")
    ]
    
    for path in test_paths:
        print(f"\nAnalyzing: {path}")
        classification = analyzer.classify_image(path, 96, 96)
        print(f"Classification: {classification}")
        
        recommendations = analyzer.get_size_recommendations(path, 96, 96)
        print(f"Recommendations: {recommendations}")

if __name__ == "__main__":
    main()