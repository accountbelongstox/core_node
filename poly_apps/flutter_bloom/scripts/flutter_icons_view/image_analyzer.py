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
        
        # 扩展的目录到推荐尺寸映射 - 确保每个文件夹都有推荐
        self.directory_size_recommendations = {
            # Android 目录映射
            'android': {
                # Mipmap目录 - 应用图标
                'mipmap-ldpi': (36, 36),
                'mipmap-mdpi': (48, 48), 
                'mipmap-hdpi': (72, 72),
                'mipmap-xhdpi': (96, 96),
                'mipmap-xxhdpi': (144, 144),
                'mipmap-xxxhdpi': (192, 192),
                # Drawable目录 - 各种图标和背景
                'drawable': (96, 96),  # 默认图标尺寸
                'drawable-ldpi': (36, 36),
                'drawable-mdpi': (48, 48),
                'drawable-hdpi': (72, 72), 
                'drawable-xhdpi': (96, 96),
                'drawable-xxhdpi': (144, 144),
                'drawable-xxxhdpi': (192, 192),
                # Night模式目录
                'drawable-night': (96, 96),
                'drawable-night-ldpi': (36, 36),
                'drawable-night-mdpi': (48, 48),
                'drawable-night-hdpi': (72, 72),
                'drawable-night-xhdpi': (96, 96),
                'drawable-night-xxhdpi': (144, 144),
                'drawable-night-xxxhdpi': (192, 192),
                # 启动画面相关
                'drawable-port': (1080, 1920),  # 竖屏背景
                'drawable-land': (1920, 1080),  # 横屏背景
            },
            # iOS 目录映射
            'ios': {
                # App图标
                'Assets.xcassets/AppIcon.appiconset': (180, 180),  # 默认App图标
                'Assets.xcassets/LaunchImage.imageset': (1125, 2436),  # 启动图
                # 其他资源
                'Assets.xcassets': (96, 96),  # 默认图标
                'Images.xcassets': (96, 96),
                'Runner': (96, 96),
            },
            # Windows 目录映射  
            'windows': {
                'runner/resources': (256, 256),  # Windows应用图标
                'resources': (256, 256),
            },
            # Web 目录映射
            'web': {
                'icons': (512, 512),  # Web图标
                'favicon': (32, 32),   # 网站图标
                'splash': (1920, 1080), # Web启动画面
                'images': (96, 96),    # 通用图片
            },
            # 通用映射 - 兜底方案
            'fallback': {
                'icon': (96, 96),
                'logo': (96, 96), 
                'image': (96, 96),
                'background': (1920, 1080),
                'splash': (1920, 1080),
                'launch': (1920, 1080),
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
        
        # PRIMARY classification based on ASPECT RATIO and SIZE (most reliable)
        if width and height:
            aspect_ratio_classification = self.classify_by_aspect_ratio_and_size(width, height)
            if aspect_ratio_classification['confidence'] > 0:
                classification.update(aspect_ratio_classification)
        
        # Check for placeholder patterns
        placeholder_confidence = self.check_patterns(filename, self.classification_patterns['placeholder_patterns'])
        if placeholder_confidence > 0 and placeholder_confidence > classification['confidence']:
            classification['category'] = 'Placeholder'
            classification['confidence'] = placeholder_confidence
        
        # Directory-based classification (only as fallback if no other classification)
        if classification['category'] == 'Other':
            dir_classification = self.classify_by_directory(parent_dirs)
            if dir_classification['confidence'] > classification['confidence']:
                classification.update(dir_classification)
        
        # Final fallback for uncategorized images
        if classification['category'] == 'Other':
            classification['confidence'] = 0.1  # Low confidence for unknown images
        
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
    
    def classify_by_aspect_ratio_and_size(self, width: int, height: int) -> Dict[str, any]:
        """
        Classify image based PURELY on aspect ratio and size
        Categories: 小图标(Small Icon), 大图标(Large Icon), 背景图(Background), 占位图(Placeholder)
        """
        classification = {'confidence': 0.0}
        
        # Calculate aspect ratio and total pixels
        aspect_ratio = width / height if height > 0 else 1.0
        pixel_count = width * height
        max_dimension = max(width, height)
        
        # RULE 1: Very large images (>500K pixels) are always 背景图
        if pixel_count > 500000:
            classification.update({
                'category': 'Background',
                'subcategory': 'Background Image',
                'confidence': 0.95
            })
            return classification
        
        # RULE 2: Rectangular images with extreme aspect ratios are 背景图
        if aspect_ratio < 0.6 or aspect_ratio > 1.7:  # Not square-ish
            if pixel_count > 100000:  # And reasonably large
                classification.update({
                    'category': 'Background',
                    'subcategory': 'Background Image',
                    'confidence': 0.9
                })
                return classification
        
        # RULE 3: Square-ish images are icons - size determines small vs large
        if 0.6 <= aspect_ratio <= 1.7:  # Square-ish (includes slight rectangles)
            if max_dimension <= 128:
                # 小图标: 128px及以下
                classification.update({
                    'category': 'Small Icon',
                    'subcategory': f'{max_dimension}px Icon',
                    'confidence': 0.9
                })
            elif max_dimension <= 512:
                # 大图标: 129px到512px
                classification.update({
                    'category': 'Large Icon', 
                    'subcategory': f'{max_dimension}px Icon',
                    'confidence': 0.9
                })
            else:
                # 超过512px的方形图像视为背景
                classification.update({
                    'category': 'Background',
                    'subcategory': 'Large Square Background',
                    'confidence': 0.8
                })
            return classification
        
        # RULE 4: Medium size rectangular images default to 背景图
        if pixel_count > 50000:
            classification.update({
                'category': 'Background',
                'subcategory': 'Background Image',
                'confidence': 0.7
            })
        else:
            # Small rectangular images default to 小图标
            classification.update({
                'category': 'Small Icon',
                'subcategory': 'Small Rectangular Icon',
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
        
        # 首先尝试从扩展目录映射获取推荐
        directory_recommendation = self.get_directory_based_recommendation(image_path, width, height)
        if directory_recommendation:
            recommendations.update(directory_recommendation)
            # 计算合规性分数
            if recommendations['recommended_sizes']:
                recommended_size = recommendations['recommended_sizes'][0]
                if (width, height) == recommended_size:
                    recommendations['compliance_score'] = 1.0
                else:
                    # 基于尺寸差异计算分数
                    size_diff = abs(width - recommended_size[0]) + abs(height - recommended_size[1])
                    if size_diff == 0:
                        recommendations['compliance_score'] = 1.0
                    else:
                        max_diff = max(recommended_size[0], recommended_size[1])
                        recommendations['compliance_score'] = max(0.0, 1.0 - (size_diff / max_diff))
        
        # 如果还没有推荐，使用平台特定逻辑
        if not recommendations['recommended_sizes']:
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
        
        # 确保每个图片都有推荐 - 最后的兜底方案
        if not recommendations['recommended_sizes']:
            recommendations.update(self.get_fallback_recommendations(image_path, width, height))
        
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
    
    def get_directory_based_recommendation(self, image_path: Path, width: int = None, height: int = None) -> Dict[str, any]:
        """
        基于图片尺寸比例和文件夹智能判断推荐尺寸
        优先级：1.尺寸比例判断类型 2.文件夹判断DPI 3.输出推荐尺寸
        """
        recommendations = {
            'recommended_sizes': [],
            'size_category': None,
            'suggestions': []
        }
        
        if not width or not height:
            return None
            
        # 1. 根据尺寸比例判断图片类型
        image_type = self.classify_by_aspect_ratio_and_size(width, height)
        category = image_type.get('category', 'Unknown')
        
        # 跳过占位图
        if category == 'Placeholder':
            return None
            
        # 2. 检测平台和DPI级别
        path_str = str(image_path).lower().replace('\\', '/')
        platform = self.detect_platform(image_path).lower()
        
        # 3. 根据类型和文件夹给出具体推荐
        if category in ['Small Icon', 'Large Icon']:
            # 统一处理为图标
            recommended_size = self.get_icon_size_for_directory(image_path, platform)
            if recommended_size:
                recommendations['recommended_sizes'] = [recommended_size]
                recommendations['size_category'] = f'Icon ({recommended_size[0]}×{recommended_size[1]})'
                recommendations['suggestions'].append(f'Icon size based on {platform} DPI standards')
                return recommendations
                
        elif category == 'Background':
            # 背景图处理
            recommended_size = self.get_background_size_for_directory(image_path, platform, width, height)
            if recommended_size:
                recommendations['recommended_sizes'] = [recommended_size]
                recommendations['size_category'] = f'Background ({recommended_size[0]}×{recommended_size[1]})'
                recommendations['suggestions'].append(f'Background size based on device standards')
                return recommendations
        
        return None
    
    def get_icon_size_for_directory(self, image_path: Path, platform: str) -> Optional[Tuple[int, int]]:
        """根据目录路径确定图标的推荐尺寸"""
        path_str = str(image_path).lower().replace('\\', '/')
        
        if platform == 'android':
            # Android密度检测
            if 'xxxhdpi' in path_str:
                return (192, 192)
            elif 'xxhdpi' in path_str:
                return (144, 144)
            elif 'xhdpi' in path_str:
                return (96, 96)
            elif 'hdpi' in path_str:
                return (72, 72)
            elif 'mdpi' in path_str:
                return (48, 48)
            elif 'ldpi' in path_str:
                return (36, 36)
            else:
                # 默认drawable目录
                return (96, 96)
                
        elif platform == 'ios':
            # iOS缩放检测
            if '@3x' in path_str:
                return (180, 180)
            elif '@2x' in path_str:
                return (120, 120)
            else:
                return (60, 60)
                
        elif platform == 'windows':
            return (256, 256)
            
        elif platform == 'web':
            if 'favicon' in path_str:
                return (32, 32)
            else:
                return (512, 512)
        
        # 默认图标尺寸
        return (96, 96)
    
    def get_background_size_for_directory(self, image_path: Path, platform: str, width: int, height: int) -> Optional[Tuple[int, int]]:
        """根据目录路径确定背景图的推荐尺寸"""
        aspect_ratio = width / height if height > 0 else 1.0
        
        if platform == 'android':
            # Android背景图标准
            if 0.5 <= aspect_ratio <= 0.8:  # 竖屏
                if 'xxxhdpi' in str(image_path):
                    return (1440, 2560)
                elif 'xxhdpi' in str(image_path):
                    return (1080, 1920)
                else:
                    return (720, 1280)
            elif 1.2 <= aspect_ratio <= 2.0:  # 横屏
                if 'xxxhdpi' in str(image_path):
                    return (2560, 1440)
                elif 'xxhdpi' in str(image_path):
                    return (1920, 1080)
                else:
                    return (1280, 720)
            else:  # 方形
                return (1080, 1080)
                
        elif platform == 'ios':
            # iOS背景图标准
            if aspect_ratio < 1.0:  # 竖屏
                return (1125, 2436)  # iPhone X标准
            else:  # 横屏
                return (2436, 1125)
                
        elif platform == 'web':
            # Web背景图标准
            if aspect_ratio < 1.0:  # 竖屏
                return (1080, 1920)
            else:  # 横屏
                return (1920, 1080)
        
        # 默认背景尺寸
        if aspect_ratio < 1.0:
            return (1080, 1920)
        else:
            return (1920, 1080)
    
    def get_fallback_recommendations(self, image_path: Path, width: int, height: int) -> Dict[str, any]:
        """
        最终兜底推荐 - 确保每个图片都有推荐
        统一图标标准：大图标和小图标都按标准图标尺寸推荐
        """
        recommendations = {
            'recommended_sizes': [],
            'size_category': 'Default Icon',
            'compliance_score': 0.5,
            'suggestions': ['Universal icon size recommendation'],
            'issues': []
        }
        
        # 获取图片分类
        classification = self.classify_image(image_path, width, height)
        category = classification.get('category', 'Unknown')
        
        # 跳过占位图 - 占位图不提供推荐尺寸
        if category == 'Placeholder':
            recommendations['recommended_sizes'] = []
            recommendations['size_category'] = 'Placeholder (Skip)'
            recommendations['suggestions'] = ['Placeholder images are skipped from size recommendations']
            return recommendations
        
        # 统一图标推荐标准 - 大图标和小图标都按标准图标处理
        if category in ['Small Icon', 'Large Icon']:
            # 根据当前尺寸选择最接近的标准图标尺寸
            current_max_dimension = max(width, height)
            
            if current_max_dimension <= 48:
                recommendations['recommended_sizes'] = [(48, 48)]
                recommendations['size_category'] = 'Standard Small Icon'
            elif current_max_dimension <= 96:
                recommendations['recommended_sizes'] = [(96, 96)]
                recommendations['size_category'] = 'Standard Medium Icon'
            elif current_max_dimension <= 144:
                recommendations['recommended_sizes'] = [(144, 144)]
                recommendations['size_category'] = 'Standard Large Icon'
            else:
                recommendations['recommended_sizes'] = [(192, 192)]
                recommendations['size_category'] = 'Standard Extra Large Icon'
            
            recommendations['suggestions'] = [
                'Unified icon standard - all icons use square dimensions',
                'Size chosen based on current dimensions for optimal display'
            ]
        
        elif category == 'Background':
            # 背景图推荐
            aspect_ratio = width / height if height > 0 else 1.0
            
            if 0.5 <= aspect_ratio <= 0.8:  # 竖屏
                recommendations['recommended_sizes'] = [(1080, 1920)]
                recommendations['size_category'] = 'Portrait Background'
            elif 1.2 <= aspect_ratio <= 2.0:  # 横屏
                recommendations['recommended_sizes'] = [(1920, 1080)]
                recommendations['size_category'] = 'Landscape Background'
            else:  # 方形或其他比例
                recommendations['recommended_sizes'] = [(1080, 1080)]
                recommendations['size_category'] = 'Square Background'
            
            recommendations['suggestions'] = [
                'Background size based on common device resolutions',
                'High resolution for better quality across devices'
            ]
        
        else:
            # 未知类型默认为图标
            recommendations['recommended_sizes'] = [(96, 96)]
            recommendations['size_category'] = 'Default Icon'
            recommendations['suggestions'] = [
                'Default square icon size for unknown image types'
            ]
        
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
        
        # Calculate pixel count and current file size
        pixel_count = width * height
        current_size_kb = file_size_bytes / 1024
        
        # Hard limit: any file over 500KB is considered large
        if current_size_kb > 500:
            recommendations['should_compress'] = True
            recommendations['target_size_kb'] = 500
            recommendations['reasons'].append(f"File size {current_size_kb:.1f}KB exceeds 500KB limit")
            recommendations['compression_ratio'] = 500 / current_size_kb
        
        # Calculate bytes per pixel ratio for intelligent analysis
        bytes_per_pixel = file_size_bytes / pixel_count if pixel_count > 0 else 0
        
        # Get image classification for context-aware analysis
        classification = self.classify_image(image_path, width, height)
        
        # Smart compression logic based on new image categories
        category = classification['category']
        
        if category in ['Small Icon', 'Large Icon']:
            # For icons, check if bytes per pixel is reasonable
            # Small icons: up to 6 bytes/pixel (due to overhead)
            # Large icons: up to 4 bytes/pixel
            
            if category == 'Small Icon':
                expected_bpp = 6.0  # Allow more overhead for small icons
                min_size_threshold = 10  # KB
            else:  # Large Icon
                expected_bpp = 4.0  # Large icons should be more efficient
                min_size_threshold = 20  # KB
            
            if bytes_per_pixel > expected_bpp and current_size_kb > min_size_threshold:
                recommendations['should_compress'] = True
                target_bpp = min(expected_bpp, bytes_per_pixel * 0.7)
                recommendations['target_size_kb'] = (pixel_count * target_bpp) / 1024
                recommendations['reasons'].append(
                    f"{category} inefficient: {bytes_per_pixel:.1f} bytes/pixel (expected: {expected_bpp:.1f})"
                )
                
        elif category == 'Background':
            # For backgrounds, check format and efficiency
            file_ext = image_path.suffix.lower()
            
            if file_ext in ['.jpg', '.jpeg']:
                expected_bpp = 2.0
                if bytes_per_pixel > 3.0 and current_size_kb > 100:
                    recommendations['should_compress'] = True
                    recommendations['target_size_kb'] = (pixel_count * expected_bpp) / 1024
                    recommendations['reasons'].append(
                        f"JPEG background inefficient: {bytes_per_pixel:.1f} bytes/pixel"
                    )
            else:  # PNG backgrounds
                expected_bpp = 4.0
                if bytes_per_pixel > 6.0 and current_size_kb > 150:
                    recommendations['should_compress'] = True
                    recommendations['target_size_kb'] = (pixel_count * expected_bpp) / 1024
                    recommendations['reasons'].append(
                        f"PNG background inefficient: {bytes_per_pixel:.1f} bytes/pixel"
                    )
        
        elif category == 'Placeholder':
            # Placeholders usually don't need compression unless extremely large
            if current_size_kb > 200:
                recommendations['should_compress'] = True
                recommendations['target_size_kb'] = 200
                recommendations['reasons'].append(
                    f"Placeholder image too large: {current_size_kb:.1f}KB"
                )
        
        else:
            # For other/unknown image types, use conservative thresholds
            if bytes_per_pixel > 8.0 and current_size_kb > 100:
                recommendations['should_compress'] = True
                recommendations['target_size_kb'] = (pixel_count * 4.0) / 1024
                recommendations['reasons'].append(
                    f"Image very inefficient: {bytes_per_pixel:.1f} bytes/pixel"
                )
        
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