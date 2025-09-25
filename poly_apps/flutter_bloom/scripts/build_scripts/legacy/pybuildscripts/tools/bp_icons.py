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

import os
import sys
from pathlib import Path
from PIL import Image
from typing import Dict, List, Tuple, Optional, NamedTuple
from dataclasses import dataclass
from enum import Enum
import colorama
import shutil
from datetime import datetime
from provider import build_provider

# Initialize colorama for Windows support
colorama.init(autoreset=True)

# Directory configurations (imported from build_provider)
ANDROID_RES_DIR = build_provider.ANDROID_RES_DIR
CACHE_DIR = build_provider.CACHE_DIR
ASSETS_BACKUP_DIR = build_provider.ASSETS_BACKUP_DIR
DENSITY_SPECS = build_provider.DENSITY_SPECS
ICON_SPECS = build_provider.ICON_SPECS
DensityType = build_provider.DensityType
IconSpec = build_provider.IconSpec

class Printer:
    """Utility class for formatted console output"""
    COLORS = {
        'info': colorama.Fore.BLUE,
        'warn': colorama.Fore.YELLOW,
        'error': colorama.Fore.RED,
        'success': colorama.Fore.GREEN,
        'debug': colorama.Fore.MAGENTA,
        'reset': colorama.Style.RESET_ALL
    }

    @staticmethod
    def _print(level: str, message: str):
        color = Printer.COLORS.get(level, Printer.COLORS['reset'])
        print(f"{color}[{level.upper()}]{Printer.COLORS['reset']} {message}")

    @classmethod
    def info(cls, message: str): cls._print('info', message)
    @classmethod
    def warn(cls, message: str): cls._print('warn', message)
    @classmethod
    def error(cls, message: str): cls._print('error', message)
    @classmethod
    def success(cls, message: str): cls._print('success', message)
    @classmethod
    def debug(cls, message: str): cls._print('debug', message)

@dataclass
class IconFile:
    path: Path
    density: str
    size: Tuple[int, int]
    spec: IconSpec
    relative_path: str

class SourceIcon(NamedTuple):
    path: Path
    size: Tuple[int, int]
    name: str

def get_density_from_path(path: str) -> Optional[str]:
    for density in DENSITY_SPECS.keys():
        if density in path:
            return density
    return None

def scan_android_icons() -> List[IconFile]:
    """
    Scan Android res directory for icon files and analyze their properties
    Returns: List of IconFile objects
    """
    found_files = []
    
    # Walk through res directory
    for root, _, files in os.walk(ANDROID_RES_DIR):
        root_path = Path(root)
        density = get_density_from_path(root)
        if not density:
            continue
            
        for spec in ICON_SPECS:
            if spec.name in files:
                file_path = root_path / spec.name
                try:
                    with Image.open(file_path) as img:
                        size = img.size
                        relative_path = file_path.relative_to(ANDROID_RES_DIR)
                        found_files.append(IconFile(
                            path=file_path,
                            density=density,
                            size=size,
                            spec=spec,
                            relative_path=str(relative_path)
                        ))
                except Exception as e:
                    Printer.error(f"Error reading image {file_path}: {e}")
    
    return found_files

def analyze_icons(icons: List[IconFile]):
    """Analyze found icons and print detailed report"""
    Printer.info("\nIcon Analysis Report")
    print("=" * 80)
    
    # Group icons by spec
    for spec in ICON_SPECS:
        spec_icons = [icon for icon in icons if icon.spec.name == spec.name]
        
        Printer.info(f"\n{spec.name} ({spec.type.value})")
        print("-" * 80)
        
        if not spec_icons:
            Printer.warn(f"No {spec.name} icons found!")
            continue
            
        # Check each density
        for density, expected_size in spec.densities.items():
            density_icon = next((icon for icon in spec_icons if icon.density == density), None)
            
            if density_icon:
                size_match = density_icon.size == expected_size
                if size_match:
                    Printer.success(
                        f"{density.upper()}: Found {density_icon.relative_path} "
                        f"(Size: {density_icon.size[0]}x{density_icon.size[1]})"
                    )
                else:
                    Printer.warn(
                        f"{density.upper()}: Found {density_icon.relative_path} "
                        f"(Size: {density_icon.size[0]}x{density_icon.size[1]}, "
                        f"Expected: {expected_size[0]}x{expected_size[1]})"
                    )
            else:
                Printer.error(
                    f"{density.upper()}: Missing icon! "
                    f"(Expected size: {expected_size[0]}x{expected_size[1]})"
                )

def calculate_resize_dimensions(
    current_size: Tuple[int, int],
    target_size: Tuple[int, int],
    force_exact_size: bool = False
) -> Tuple[int, int]:
    """
    Calculate new dimensions maintaining aspect ratio.
    
    Args:
        current_size: Current image dimensions (width, height)
        target_size: Target dimensions (width, height)
        force_exact_size: If True, forces exact target size regardless of aspect ratio
        
    Returns:
        Tuple of (width, height) for the new size
    """
    if force_exact_size:
        return target_size
        
    current_ratio = current_size[0] / current_size[1]
    target_ratio = target_size[0] / target_size[1]
    
    if abs(current_ratio - target_ratio) < 0.1:  # Allow small difference in ratio
        return target_size
    
    # Calculate scaling factors
    scale_w = target_size[0] / current_size[0]
    scale_h = target_size[1] / current_size[1]
    
    # Use the smaller scaling factor to ensure image fits within target size
    # while maintaining aspect ratio
    scale = min(scale_w, scale_h)
    
    # Calculate new dimensions
    new_width = round(current_size[0] * scale)
    new_height = round(current_size[1] * scale)
    
    # Ensure minimum dimensions are met
    if new_width < target_size[0] or new_height < target_size[1]:
        # If image is too small, scale up to meet minimum dimension
        scale = max(target_size[0] / new_width, target_size[1] / new_height)
        new_width = round(new_width * scale)
        new_height = round(new_height * scale)
    
    return (new_width, new_height)

def get_icon_resize_rules(icon_name: str) -> dict:
    """
    Get resize rules for specific icon types.
    
    Returns:
        Dictionary containing resize rules:
        - force_exact_size: Whether to force exact dimensions
        - maintain_aspect_ratio: Whether to maintain aspect ratio
        - allow_upscale: Whether to allow scaling up if image is too small
    """
    rules = {
        'force_exact_size': False,
        'maintain_aspect_ratio': True,
        'allow_upscale': True
    }
    
    if icon_name == 'notification_icon.png':
        rules['force_exact_size'] = True
        rules['maintain_aspect_ratio'] = False
    elif icon_name == 'background.png':
        rules['force_exact_size'] = False
        rules['maintain_aspect_ratio'] = True
        rules['allow_upscale'] = True
    elif icon_name in ['brand_logo.png', 'brand_logo_square.png']:
        rules['force_exact_size'] = False
        rules['maintain_aspect_ratio'] = True
        rules['allow_upscale'] = True
    elif icon_name == 'ic_launcher.png':
        rules['force_exact_size'] = True
        rules['maintain_aspect_ratio'] = False
    
    return rules
