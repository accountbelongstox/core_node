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
Image Processor for Flutter Bloom Build System
Handles image resizing, cropping, and optimization
"""

import os
from typing import Tuple, Optional

class ImageProcessor:
    """Handles image processing operations"""
    
    # Platform-specific recommended sizes map
    RECOMMENDED_SIZES = {
        # Android
        "android/app/src/main/res/mipmap-hdpi": (72, 72),
        "android/app/src/main/res/mipmap-mdpi": (48, 48),
        "android/app/src/main/res/mipmap-xhdpi": (96, 96),
        "android/app/src/main/res/mipmap-xxhdpi": (144, 144),
        "android/app/src/main/res/mipmap-xxxhdpi": (192, 192),
        "android/app/src/main/res/drawable": (24, 24),
        "android/app/src/main/res/drawable-hdpi": (36, 36),
        "android/app/src/main/res/drawable-mdpi": (24, 24),
        "android/app/src/main/res/drawable-xhdpi": (48, 48),
        "android/app/src/main/res/drawable-xxhdpi": (72, 72),
        "android/app/src/main/res/drawable-xxxhdpi": (96, 96),
        
        # iOS
        "ios/Runner/Assets.xcassets/AppIcon.appiconset": (1024, 1024),
        
        # Web
        "web/icons": (192, 192),
        "web/favicon.png": (32, 32),
        
        # Windows
        "windows/runner/resources": (256, 256),
        
        # macOS
        "macos/Runner/Assets.xcassets/AppIcon.appiconset": (1024, 1024)
    }
    
    def __init__(self):
        pass
    
    def get_image_size(self, image_path: str) -> Tuple[int, int]:
        """Get image dimensions"""
        try:
            from PIL import Image
            with Image.open(image_path) as img:
                return img.size
        except Exception as e:
            print(f"[WARNING] Failed to get image size for {image_path}: {e}")
            return (0, 0)
    
    def is_placeholder_image(self, image_path: str) -> bool:
        """Check if image is a 1x1 placeholder"""
        try:
            size = self.get_image_size(image_path)
            return size[0] <= 1 and size[1] <= 1
        except:
            return False
    
    def get_recommended_size(self, image_path: str) -> Optional[Tuple[int, int]]:
        """Get recommended size based on image path"""
        # Normalize path separators
        normalized_path = image_path.replace('\\', '/')
        
        # Find matching pattern
        for pattern, size in self.RECOMMENDED_SIZES.items():
            if pattern in normalized_path:
                return size
        
        return None
    
    def resize_image_smart(self, source_path: str, target_size: Tuple[int, int], output_path: str) -> bool:
        """Smart resize image maintaining aspect ratio with cropping if needed"""
        try:
            from PIL import Image, ImageOps
            
            with Image.open(source_path) as img:
                # Convert to RGBA if needed
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                
                target_width, target_height = target_size
                
                # Calculate aspect ratios
                img_ratio = img.width / img.height
                target_ratio = target_width / target_height
                
                if img_ratio > target_ratio:
                    # Image is wider, crop width
                    new_height = img.height
                    new_width = int(new_height * target_ratio)
                    left = (img.width - new_width) // 2
                    img = img.crop((left, 0, left + new_width, new_height))
                elif img_ratio < target_ratio:
                    # Image is taller, crop height
                    new_width = img.width
                    new_height = int(new_width / target_ratio)
                    top = (img.height - new_height) // 2
                    img = img.crop((0, top, new_width, top + new_height))
                
                # Resize to exact target size
                img = img.resize(target_size, Image.Resampling.LANCZOS)
                
                # Ensure output directory exists
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                # Save with appropriate format
                if output_path.lower().endswith('.png'):
                    img.save(output_path, 'PNG', optimize=True)
                elif output_path.lower().endswith(('.jpg', '.jpeg')):
                    # Convert to RGB for JPEG
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    rgb_img.save(output_path, 'JPEG', optimize=True, quality=90)
                else:
                    img.save(output_path, optimize=True)
                
                return True
                
        except Exception as e:
            print(f"[ERROR] Failed to resize image {source_path}: {e}")
            return False
    
    def resize_image_stretch(self, source_path: str, target_size: Tuple[int, int], output_path: str) -> bool:
        """Resize image by stretching (may distort aspect ratio)"""
        try:
            from PIL import Image
            
            with Image.open(source_path) as img:
                # Convert to RGBA if needed
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                
                # Resize to exact target size (may distort)
                img = img.resize(target_size, Image.Resampling.LANCZOS)
                
                # Ensure output directory exists
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                # Save with appropriate format
                if output_path.lower().endswith('.png'):
                    img.save(output_path, 'PNG', optimize=True)
                elif output_path.lower().endswith(('.jpg', '.jpeg')):
                    # Convert to RGB for JPEG
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    rgb_img.save(output_path, 'JPEG', optimize=True, quality=90)
                else:
                    img.save(output_path, optimize=True)
                
                return True
                
        except Exception as e:
            print(f"[ERROR] Failed to stretch resize image {source_path}: {e}")
            return False
    
    def process_image_replacement(self, source_path: str, target_path: str, prefer_smart_resize: bool = True) -> bool:
        """Process image replacement with appropriate resizing strategy"""
        if not os.path.exists(source_path):
            print(f"[ERROR] Source image not found: {source_path}")
            return False
        
        if not os.path.exists(target_path):
            print(f"[ERROR] Target image not found: {target_path}")
            return False
        
        # Skip placeholder images
        if self.is_placeholder_image(target_path):
            print(f"[SKIP] Skipping 1x1 placeholder: {target_path}")
            return False
        
        # Get target size
        target_size = self.get_image_size(target_path)
        if target_size == (0, 0):
            print(f"[ERROR] Could not determine target size: {target_path}")
            return False
        
        # Check for recommended size
        recommended_size = self.get_recommended_size(target_path)
        if recommended_size:
            target_size = recommended_size
            print(f"[INFO] Using recommended size {target_size} for {target_path}")
        
        # Choose resizing strategy
        if prefer_smart_resize:
            return self.resize_image_smart(source_path, target_size, target_path)
        else:
            return self.resize_image_stretch(source_path, target_size, target_path)
    
    def optimize_image(self, image_path: str) -> bool:
        """Optimize image file size"""
        try:
            from PIL import Image
            
            with Image.open(image_path) as img:
                # Optimize and save
                if image_path.lower().endswith('.png'):
                    img.save(image_path, 'PNG', optimize=True)
                elif image_path.lower().endswith(('.jpg', '.jpeg')):
                    img.save(image_path, 'JPEG', optimize=True, quality=85)
                
                return True
                
        except Exception as e:
            print(f"[ERROR] Failed to optimize image {image_path}: {e}")
            return False
