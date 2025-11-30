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

# -*- coding: utf-8 -*-
"""
iOS Asset Generator for Flutter Projects

This script generates iOS-specific image assets from source images in assets/.internal_common
and replaces target images in iOS platform directories with properly sized and compressed versions.

Features:
- iOS platform support only
- Intelligent size analysis based on folder names (e.g., 1x, 2x, 3x)
- Proportional scaling with smart cropping
- Image compression and optimization
- Skip placeholder images (1x1px)
- Batch processing with detailed logging

Usage:
    python ios_asset_generator.py

Author: Flutter Asset Generator
"""

import os
from pathlib import Path
from PIL import Image
import json
from typing import Dict, List, Tuple, Optional

from base_asset_generator import BaseAssetGenerator

class IOSAssetGenerator(BaseAssetGenerator):
    def __init__(self):
        super().__init__()
        
        # iOS platform directory
        self.platform_dir = self.flutter_dir / "ios"
        
        # Add iOS-specific DPI patterns
        self.dpi_patterns.update({
            # iOS patterns
            r'1x': 1.0,
            r'2x': 2.0,
            r'3x': 3.0,
            r'@1x': 1.0,
            r'@2x': 2.0,
            r'@3x': 3.0,
        })
        
        # Asset mapping: $sourcefile => [$targetImageFileList]
        self.ios_mapping = {
            "background": ["background.png"]
        }

    def find_dpi_from_path(self, target_path: Path) -> Optional[float]:
        """Find DPI multiplier from the directory path of a target image (iOS only)"""
        current_path = target_path.parent
        
        # Check current directory and parent directories for DPI information
        while current_path != self.platform_dir:
            dpi_multiplier = self.analyze_dpi_from_folder(current_path.name)
            if dpi_multiplier is not None:
                return dpi_multiplier
            current_path = current_path.parent
        
        return None

    def find_target_file_in_platform(self, target_filename: str) -> Optional[Path]:
        """Find target file in iOS platform directory by filename"""
        if not self.platform_dir.exists():
            return None
        
        # Recursively search for the target file
        for root, dirs, files in os.walk(self.platform_dir):
            root_path = Path(root)
            
            for file_path in root_path.iterdir():
                if file_path.is_file() and file_path.name == target_filename:
                    return file_path
        
        return None

    def find_and_analyze_ios_images(self) -> Dict[str, List[Tuple[Path, str]]]:
        """Find and intelligently analyze all images in iOS platform"""
        image_categories = {
            "small_icon": [],
            "large_icon": [],
            "very_large_icon": [],
            "landscape_background": [],
            "portrait_background": [],
            "banner_image": [],
            "placeholder": [],
            "unknown": []
        }
        
        if not self.platform_dir.exists():
            return image_categories
        
        # Recursively scan iOS directory
        for root, dirs, files in os.walk(self.platform_dir):
            root_path = Path(root)
            
            for file_path in root_path.iterdir():
                if file_path.is_file() and file_path.suffix.lower() in self.supported_formats:
                    # Analyze image type
                    img_type = self.analyze_image_type(file_path)
                    
                    # Add to appropriate category
                    if img_type in image_categories:
                        image_categories[img_type].append((file_path, img_type))
                    else:
                        image_categories["unknown"].append((file_path, img_type))
        
        return image_categories

    def generate_asset_mapping(self) -> Dict[str, Dict[str, List[Tuple[Path, List[Path]]]]]:
        """Generate mapping between source files and target image lists for iOS platform using hardcoded mapping"""
        mapping = {}
        source_images = self.find_source_images()
        
        self.log(f"Found {len(source_images)} source images")
        
        # Only process iOS platform
        platform = "ios"
        mapping[platform] = {}
        
        self.log(f"  Performing intelligent image analysis for iOS platform...")
        
        # Analyze all images in iOS directory
        ios_images = self.find_and_analyze_ios_images()
        
        # Log analysis results with size compatibility
        for category, images in ios_images.items():
            if images:
                self.log(f"    Found {len(images)} {category} images")
                for img_path, img_type in images:
                    # Analyze size compatibility
                    compatibility = self.analyze_size_compatibility(img_path, img_type)
                    
                    # Format the log message
                    if compatibility["recommended_size"]:
                        rec_width, rec_height = compatibility["recommended_size"]
                        self.log(f"      - {img_path.name}: {img_path.parent.name}")
                        self.log(f"        Current: {compatibility['current_size'][0]}x{compatibility['current_size'][1]}")
                        self.log(f"        Recommended: {rec_width}x{rec_height} (DPI: {compatibility['dpi_multiplier']}x)")
                        self.log(f"        Compatibility: {compatibility['compatibility_score']}/100 - {compatibility['compatibility_note']}")
                    else:
                        self.log(f"      - {img_path.name}: {img_path.parent.name}")
                        self.log(f"        Current: {compatibility['current_size'][0]}x{compatibility['current_size'][1]}")
                        self.log(f"        DPI: {compatibility['dpi_multiplier']}x")
                        self.log(f"        Note: {compatibility['compatibility_note']}")
                    
                    # Add file size info
                    file_size = img_path.stat().st_size
                    self.log(f"        File size: {file_size} bytes")
                    
                    # Only show first 3 detailed, then summarize
                    if images.index((img_path, img_type)) >= 2:
                        remaining = len(images) - 3
                        if remaining > 0:
                            self.log(f"        ... and {remaining} more {category} images")
                        break
        
        # Process mapped sources
        if self.ios_mapping:
            for source_path in source_images:
                source_name = source_path.stem
                
                if source_name in self.ios_mapping:
                    self.log(f"  Processing mapped source '{source_name}' for iOS")
                    
                    target_files = self.ios_mapping[source_name]
                    target_paths = []
                    
                    for target_file in target_files:
                        target_path = self.find_target_file_in_platform(target_file)
                        if target_path:
                            target_paths.append(target_path)
                            # Analyze the target image
                            img_type = self.analyze_image_type(target_path)
                            self.log(f"    Target '{target_file}' identified as: {img_type}")
                        else:
                            self.log(f"    Warning: Target file '{target_file}' not found in iOS")
                    
                    if target_paths:
                        dpi_key = "1x"
                        if dpi_key not in mapping[platform]:
                            mapping[platform][dpi_key] = []
                        
                        mapping[platform][dpi_key].append((source_path, target_paths))
                        self.log(f"    Mapped to {len(target_paths)} targets")
                else:
                    self.log(f"  No mapping for '{source_name}' in iOS")
        else:
            self.log(f"  No iOS mapping defined")
        
        return mapping

    def process_platform(self, mapping: Dict, dry_run: bool = False, compress: bool = True) -> int:
        """Process assets for iOS platform"""
        self.log("Processing iOS platform")
        
        if "ios" not in mapping:
            self.log("No mapping found for iOS platform", "WARNING")
            return 0
        
        processed_count = 0
        
        for dpi_key, source_target_pairs in mapping["ios"].items():
            self.log(f"  Processing {dpi_key}...")
            
            for source_path, target_list in source_target_pairs:
                try:
                    # Extract DPI multiplier from the key (e.g., "2x" -> 2.0)
                    if dpi_key == "default":
                        self.log(f"    Skipping default group for {source_path.name}")
                        continue
                        
                    dpi_multiplier = float(dpi_key.replace('x', ''))
                    if dpi_multiplier <= 0:
                        self.log(f"    Invalid DPI multiplier: {dpi_key}, skipping", "WARNING")
                        continue
                    
                    # Open source image
                    with Image.open(source_path) as source_img:
                        source_size = source_img.size
                        target_size = self.get_target_size(source_size, dpi_multiplier)
                        
                        self.log(f"    Processing {source_path.name} -> {len(target_list)} targets")
                        self.log(f"      Source: {source_size[0]}x{source_size[1]}")
                        self.log(f"      Target: {target_size[0]}x{target_size[1]} (DPI: {dpi_multiplier})")
                        
                        if dry_run:
                            self.log(f"      [DRY RUN] Would resize and replace {len(target_list)} targets")
                            processed_count += len(target_list)
                            continue
                        
                        # Process each target in the list
                        for target_path in target_list:
                            try:
                                # Resize and crop image
                                processed_img = self.resize_and_crop_image(source_img, target_size)
                                
                                # Compress and save
                                if compress:
                                    success = self.compress_image(processed_img, target_path)
                                else:
                                    success = self.compress_image(processed_img, target_path, quality=100)
                                
                                if success:
                                    self.log(f"        ✅ Successfully processed {target_path.name}")
                                    processed_count += 1
                                else:
                                    self.log(f"        ❌ Failed to process {target_path.name}", "ERROR")
                            
                            except Exception as e:
                                self.log(f"        ❌ Error processing {target_path.name}: {e}", "ERROR")
                
                except Exception as e:
                    self.log(f"      ❌ Error processing {source_path.name}: {e}", "ERROR")
        
        return processed_count

    def run(self, dry_run: bool = False, compress: bool = True):
        """Run the asset generation process for iOS platform"""
        self.log("Starting Flutter Asset Generator (iOS Only)")
        self.log(f"Flutter directory: {self.flutter_dir}")
        self.log(f"Source directory: {self.source_dir}")
        self.log(f"Platform: iOS")
        self.log(f"Dry run: {dry_run}")
        self.log(f"Compression: {compress}")
        
        # Generate asset mapping
        mapping = self.generate_asset_mapping()
        
        # Process iOS platform
        if "ios" in mapping:
            processed = self.process_platform(mapping, dry_run, compress)
            self.log(f"iOS platform: {processed} images processed")
        else:
            self.log("iOS platform: No assets found", "WARNING")
            processed = 0
        
        self.log(f"Asset generation complete. Total processed: {processed}")
        
        # Save mapping to JSON for reference
        mapping_file = self.flutter_dir / "scripts" / "flutter_icon_reduction" / "ios_asset_mapping.json"
        try:
            with open(mapping_file, 'w', encoding='utf-8') as f:
                # Convert Path objects to strings for JSON serialization
                json_mapping = {}
                for platform, dpi_data in mapping.items():
                    json_mapping[platform] = {}
                    for dpi_folder, pairs in dpi_data.items():
                        json_mapping[platform][dpi_folder] = [
                            (str(source), [str(target) for target in target_list]) for source, target_list in pairs
                        ]
                
                json.dump(json_mapping, f, indent=2, ensure_ascii=False)
                self.log(f"Asset mapping saved to: {mapping_file}")
        except Exception as e:
            self.log(f"Failed to save asset mapping: {e}", "WARNING")

def main():
    # Hardcoded configuration constants
    DRY_RUN = False                                    # Set to True for dry run
    COMPRESS = True                                     # Enable compression
    
    # Initialize generator
    generator = IOSAssetGenerator()
    
    # Run generation with hardcoded values
    generator.run(DRY_RUN, COMPRESS)

if __name__ == "__main__":
    main()

