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
Image Processing Engine
Handles image resizing, cropping, and format conversion for platform-specific requirements
"""

import os
import tempfile
from typing import Optional, Tuple
from PIL import Image

class ImageProcessingEngine:
    """Handles image processing for asset replacement"""
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp(prefix='flutter_bloom_images_')
    
    def process_for_target(self, source_path: str, target_path: str, platform: str, asset_type: str) -> str:
        """Process source image to match target requirements"""
        
        # Get target image dimensions if it exists
        target_size = self.get_image_size(target_path) if os.path.exists(target_path) else None
        
        # Get recommended size for this platform/asset type
        recommended_size = self.get_recommended_size(platform, asset_type, target_path)
        
        # Determine final target size
        final_size = target_size or recommended_size
        
        if not final_size:
            print(f"[INFO] No size requirements for {asset_type} in {platform}, using original")
            return source_path
        
        # Process the image
        processed_path = self.resize_and_crop_image(source_path, final_size, target_path)
        
        return processed_path
    
    def get_image_size(self, image_path: str) -> Optional[Tuple[int, int]]:
        """Get image dimensions"""
        try:
            with Image.open(image_path) as img:
                return img.size
        except Exception as e:
            print(f"[WARNING] Could not get image size for {image_path}: {str(e)}")
            return None
    
    def get_recommended_size(self, platform: str, asset_type: str, target_path: str) -> Optional[Tuple[int, int]]:
        """Get recommended size based on platform and asset type"""
        
        # Extract density/size info from path
        path_lower = target_path.lower()
        
        if platform == 'android':
            if 'mdpi' in path_lower:
                return self.get_android_size(asset_type, 'mdpi')
            elif 'hdpi' in path_lower:
                return self.get_android_size(asset_type, 'hdpi')
            elif 'xhdpi' in path_lower:
                return self.get_android_size(asset_type, 'xhdpi')
            elif 'xxhdpi' in path_lower:
                return self.get_android_size(asset_type, 'xxhdpi')
            elif 'xxxhdpi' in path_lower:
                return self.get_android_size(asset_type, 'xxxhdpi')
        
        elif platform == 'web':
            if 'icon-192' in path_lower:
                return (192, 192)
            elif 'icon-512' in path_lower:
                return (512, 512)
            elif 'favicon' in path_lower:
                return (32, 32)
        
        elif platform == 'windows':
            if asset_type == 'icon':
                return (256, 256)
        
        return None
    
    def get_android_size(self, asset_type: str, density: str) -> Tuple[int, int]:
        """Get Android asset size for specific density"""
        
        size_map = {
            'icon': {
                'mdpi': (48, 48),
                'hdpi': (72, 72),
                'xhdpi': (96, 96),
                'xxhdpi': (144, 144),
                'xxxhdpi': (192, 192)
            },
            'notification_icon': {
                'mdpi': (24, 24),
                'hdpi': (36, 36),
                'xhdpi': (48, 48),
                'xxhdpi': (72, 72),
                'xxxhdpi': (96, 96)
            }
        }
        
        return size_map.get(asset_type, size_map['icon']).get(density, (96, 96))
    
    def resize_and_crop_image(self, source_path: str, target_size: Tuple[int, int], target_path: str) -> str:
        """Resize and crop image to target size"""
        
        target_width, target_height = target_size
        
        try:
            with Image.open(source_path) as img:
                # Convert to RGB if necessary (for JPEG compatibility)
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Keep RGBA for PNG files, convert to RGB for others
                    target_ext = os.path.splitext(target_path)[1].lower()
                    if target_ext in ['.jpg', '.jpeg']:
                        # Create white background for JPEG
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img = background
                    elif img.mode == 'P':
                        img = img.convert('RGBA')
                
                # Calculate scaling to fit target size while maintaining aspect ratio
                img_width, img_height = img.size
                scale_x = target_width / img_width
                scale_y = target_height / img_height
                
                # Use the larger scale to ensure the image covers the target area
                scale = max(scale_x, scale_y)
                
                # Resize image
                new_width = int(img_width * scale)
                new_height = int(img_height * scale)
                resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Crop to target size (center crop)
                left = (new_width - target_width) // 2
                top = (new_height - target_height) // 2
                right = left + target_width
                bottom = top + target_height
                
                cropped_img = resized_img.crop((left, top, right, bottom))
                
                # Save processed image
                processed_filename = f"processed_{os.path.basename(source_path)}"
                processed_path = os.path.join(self.temp_dir, processed_filename)
                
                # Determine format from target file extension
                target_ext = os.path.splitext(target_path)[1].lower()
                if target_ext == '.jpg' or target_ext == '.jpeg':
                    cropped_img.save(processed_path, 'JPEG', quality=95)
                elif target_ext == '.png':
                    cropped_img.save(processed_path, 'PNG')
                elif target_ext == '.webp':
                    cropped_img.save(processed_path, 'WEBP', quality=95)
                else:
                    # Default to PNG
                    processed_path = processed_path.replace(os.path.splitext(processed_path)[1], '.png')
                    cropped_img.save(processed_path, 'PNG')
                
                print(f"[SUCCESS] Processed image: {source_path} -> {target_size}")
                return processed_path
                
        except Exception as e:
            print(f"[ERROR] Failed to process image {source_path}: {str(e)}")
            return source_path
    
    def cleanup(self):
        """Clean up temporary files"""
        import shutil
        try:
            shutil.rmtree(self.temp_dir)
        except Exception as e:
            print(f"[WARNING] Could not clean up temp directory: {str(e)}")
    
    def __del__(self):
        """Cleanup on destruction"""
        self.cleanup()
