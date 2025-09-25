#!/usr/bin/env python3
"""
Asset Scanner Utility Class
Handles asset directory scanning and specific image discovery for Flutter build system
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import fnmatch

class AssetScanner:
    """Utility class for scanning assets and finding specific image types"""

    def __init__(self):
        self.supported_image_formats = ['.png', '.jpg', '.webp']
        self.resource_directories = []  # Global resource directories array

    def collect_resource_directories(self, temp_build_root: Path, app_name: str) -> List[Path]:
        """
        Collect all resource directories in priority order:
        1. External static resources
        2. Built-in app directory
        3. Common directory (app_main)
        """
        resource_dirs = []

        print("COLLECTING RESOURCE DIRECTORIES:")
        print("=" * 60)

        # 1. External static resource directory (highest priority)
        external_resource_dir = Path(f"D:/programing/.build_dir/build_apps_static_resources/{app_name}")
        if external_resource_dir.exists() and external_resource_dir.is_dir():
            resource_dirs.append(external_resource_dir)
            print(f"[1] External static resource directory: {external_resource_dir}")
        else:
            print(f"[1] External static resource directory not found: {external_resource_dir}")

        # 2. Built-in app directory (medium priority)
        builtin_app_dir = temp_build_root / "assets" / "apps" / app_name
        if builtin_app_dir.exists() and builtin_app_dir.is_dir():
            resource_dirs.append(builtin_app_dir)
            print(f"[2] Built-in app directory: {builtin_app_dir}")
        else:
            print(f"[2] Built-in app directory not found: {builtin_app_dir}")

        # 3. Common directory (app_main) (lowest priority)
        common_dir = temp_build_root / "assets" / "apps" / "app_main"
        if common_dir.exists() and common_dir.is_dir():
            resource_dirs.append(common_dir)
            print(f"[3] Common directory (app_main): {common_dir}")
        else:
            print(f"[3] Common directory (app_main) not found: {common_dir}")

        # Store as global array
        self.resource_directories = resource_dirs

        print()
        print("RESOURCE DIRECTORIES SUMMARY:")
        print("-" * 40)

        # Check all potential directories and show their status
        potential_dirs = [
            (Path(f"D:/programing/.build_dir/build_apps_static_resources/{app_name}"), "EXTERNAL"),
            (temp_build_root / "assets" / "apps" / app_name, "BUILTIN"),
            (temp_build_root / "assets" / "apps" / "app_main", "COMMON")
        ]

        for i, (directory, dir_type) in enumerate(potential_dirs, 1):
            exists_status = "EXISTS" if directory.exists() and directory.is_dir() else "MISSING"
            print(f"  {i}. [{dir_type}] {directory} - {exists_status}")

            # Show subdirectory status for existing directories
            if directory.exists() and directory.is_dir():
                icons_dir = directory / "icons"
                launch_dir = directory / "launch"
                icons_status = "YES" if icons_dir.exists() else "NO"
                launch_status = "YES" if launch_dir.exists() else "NO"
                print(f"      +-- icons/ {icons_status}  launch/ {launch_status}")

        print()
        print("=" * 80)
        print("RESOURCE DIRECTORIES STATUS")
        print("=" * 80)

        # Check all potential directories and show status
        external_dir = Path(f"D:/programing/.build_dir/build_apps_static_resources/{app_name}")
        builtin_dir = temp_build_root / "assets" / "apps" / app_name
        main_dir = temp_build_root / "assets" / "apps" / "app_main"

        external_exists = external_dir.exists() and external_dir.is_dir()
        builtin_exists = builtin_dir.exists() and builtin_dir.is_dir()
        main_exists = main_dir.exists() and main_dir.is_dir()

        print(f"External Resource Directory  [{'EXISTS' if external_exists else 'MISSING'}]")
        print(f"App Built-in Directory       [{'EXISTS' if builtin_exists else 'MISSING'}]")
        print(f"Main App Directory           [{'EXISTS' if main_exists else 'MISSING'}]")

        print()
        if not external_exists:
            print("Press Y to create external resource directory, or ENTER/any key to continue")
        else:
            print("Press ENTER or any key to continue")

        try:
            user_input = input().strip().lower()

            if user_input == 'y' and not external_exists:
                print(f"[CREATE] Creating external resource directory: {external_dir}")
                try:
                    external_dir.mkdir(parents=True, exist_ok=True)
                    # Create subdirectories
                    icons_dir = external_dir / "icons"
                    launch_dir = external_dir / "launch"
                    icons_dir.mkdir(exist_ok=True)
                    launch_dir.mkdir(exist_ok=True)
                    print(f"[SUCCESS] External resource directory created successfully")
                    print(f"  - Created: {external_dir}")
                    print(f"  - Created: {icons_dir}")
                    print(f"  - Created: {launch_dir}")
                    print()
                    print("[SUGGESTION] You can now add images to these directories:")
                    print(f"  - Logo images: Add logo*.png/jpg/webp to {icons_dir}")
                    print(f"  - IC icons: Add ic_*.png/jpg/webp to {icons_dir}")
                    print(f"  - Background images: Add background*.png/jpg/webp to {launch_dir}")
                    print(f"  - Splash images: Add splash*.png/jpg/webp to {launch_dir}")

                    # Re-collect directories after creation
                    resource_dirs = []
                    if external_dir.exists() and external_dir.is_dir():
                        resource_dirs.append(external_dir)
                    if builtin_dir.exists() and builtin_dir.is_dir():
                        resource_dirs.append(builtin_dir)
                    if main_dir.exists() and main_dir.is_dir():
                        resource_dirs.append(main_dir)

                    # Update self.resource_directories
                    self.resource_directories = resource_dirs

                except Exception as e:
                    print(f"[ERROR] Failed to create external resource directory: {e}")

                print()

        except (KeyboardInterrupt, EOFError):
            print("\n[CANCELLED] Resource collection cancelled by user")
            return []

        print("[INFO] Continuing with image scanning...")

        print()
        return resource_dirs

    def _get_directory_type(self, directory: Path, temp_build_root: Path, app_name: str) -> str:
        """Get directory type label"""
        dir_str = str(directory)
        if "build_apps_static_resources" in dir_str:
            return "EXTERNAL"
        elif dir_str.endswith("app_main"):
            return "COMMON"
        else:
            return "BUILTIN"

    def search_logo_images(self, resource_dirs: List[Path]) -> List[Dict]:
        """Search for logo images in icons subdirectory - only files starting with 'logo'"""
        logo_results = []

        print("[SEARCH] Looking for LOGO images (starting with 'logo') in icons/ subdirectories...")

        for resource_dir in resource_dirs:
            dir_type = self._get_directory_type(resource_dir, Path.cwd(), "")
            icons_dir = resource_dir / "icons"

            if not icons_dir.exists():
                print(f"  [{dir_type}] MISSING: {icons_dir}")
                continue

            print(f"  [{dir_type}] FOUND: {icons_dir}")

            # Find logo files - only files starting with 'logo'
            logo_files = []
            for file_path in icons_dir.rglob("logo*"):
                if file_path.is_file() and file_path.suffix.lower() in self.supported_image_formats:
                    logo_files.append({
                        'path': file_path,
                        'name': file_path.name,
                        'format': file_path.suffix.lower(),
                        'size_bytes': file_path.stat().st_size,
                        'source': dir_type
                    })

            if logo_files:
                # Sort by format preference
                logo_files = self._sort_by_format_preference(logo_files)
                logo_results.extend(logo_files)
                print(f"    Found {len(logo_files)} logo images:")
                for logo in logo_files:
                    print(f"      - {logo['name']} ({logo['format']}, {self._format_file_size(logo['size_bytes'])}) -> {logo['path']}")
            else:
                print(f"    No logo images found in this directory")

        print(f"  TOTAL LOGO IMAGES FOUND: {len(logo_results)}")

        # Print detailed search summary
        if logo_results:
            print("[SEARCH-RESULT] Logo images array (sorted by format preference):")
            for i, logo in enumerate(logo_results, 1):
                print(f"  {i}. {logo['name']} ({logo['format']}, {self._format_file_size(logo['size_bytes'])}) from [{logo['source']}]")

        return logo_results

    def search_launch_images(self, resource_dirs: List[Path]) -> Dict[str, List[Dict]]:
        """Search for background and splash images in launch subdirectory"""
        launch_results = {
            'background': [],
            'splash': []
        }

        print("[SEARCH] Looking for BACKGROUND and SPLASH images (starting with 'background'/'splash') in launch/ subdirectories...")

        for resource_dir in resource_dirs:
            dir_type = self._get_directory_type(resource_dir, Path.cwd(), "")
            launch_dir = resource_dir / "launch"

            if not launch_dir.exists():
                print(f"  [{dir_type}] MISSING: {launch_dir}")
                continue

            print(f"  [{dir_type}] FOUND: {launch_dir}")

            # Search for background images - only files starting with 'background'
            background_files = []
            for file_path in launch_dir.rglob("background*"):
                if file_path.is_file() and file_path.suffix.lower() in self.supported_image_formats:
                    background_files.append({
                        'path': file_path,
                        'name': file_path.name,
                        'format': file_path.suffix.lower(),
                        'size_bytes': file_path.stat().st_size,
                        'source': dir_type
                    })

            # Search for splash images - only files starting with 'splash'
            splash_files = []
            for file_path in launch_dir.rglob("splash*"):
                if file_path.is_file() and file_path.suffix.lower() in self.supported_image_formats:
                    splash_files.append({
                        'path': file_path,
                        'name': file_path.name,
                        'format': file_path.suffix.lower(),
                        'size_bytes': file_path.stat().st_size,
                        'source': dir_type
                    })

            # Process results
            if background_files:
                background_files = self._sort_by_format_preference(background_files)
                launch_results['background'].extend(background_files)
                print(f"    Found {len(background_files)} background images:")
                for bg in background_files:
                    print(f"      - {bg['name']} ({bg['format']}, {self._format_file_size(bg['size_bytes'])}) -> {bg['path']}")

            if splash_files:
                splash_files = self._sort_by_format_preference(splash_files)
                launch_results['splash'].extend(splash_files)
                print(f"    Found {len(splash_files)} splash images:")
                for splash in splash_files:
                    print(f"      - {splash['name']} ({splash['format']}, {self._format_file_size(splash['size_bytes'])}) -> {splash['path']}")

            if not background_files and not splash_files:
                print(f"    No background or splash images found in this directory")

        print(f"  TOTAL BACKGROUND IMAGES FOUND: {len(launch_results['background'])}")
        print(f"  TOTAL SPLASH IMAGES FOUND: {len(launch_results['splash'])}")

        # Print detailed search summary
        if launch_results['background']:
            print("[SEARCH-RESULT] Background images array (sorted by format preference):")
            for i, bg in enumerate(launch_results['background'], 1):
                print(f"  {i}. {bg['name']} ({bg['format']}, {self._format_file_size(bg['size_bytes'])}) from [{bg['source']}]")

        if launch_results['splash']:
            print("[SEARCH-RESULT] Splash images array (sorted by format preference):")
            for i, splash in enumerate(launch_results['splash'], 1):
                print(f"  {i}. {splash['name']} ({splash['format']}, {self._format_file_size(splash['size_bytes'])}) from [{splash['source']}]")

        return launch_results

    def search_ic_icons(self, resource_dirs: List[Path]) -> List[Dict]:
        """Search for ic_ prefixed icon files"""
        ic_results = []

        print("[SEARCH] Looking for IC_ prefixed icons in icons/ subdirectories...")

        for resource_dir in resource_dirs:
            dir_type = self._get_directory_type(resource_dir, Path.cwd(), "")
            icons_dir = resource_dir / "icons"

            if not icons_dir.exists():
                print(f"  [{dir_type}] MISSING: {icons_dir}")
                continue

            print(f"  [{dir_type}] FOUND: {icons_dir}")

            # Find ic_ prefixed files
            ic_files = []
            for file_path in icons_dir.rglob("ic_*"):
                if file_path.is_file() and file_path.suffix.lower() in self.supported_image_formats:
                    ic_files.append({
                        'path': file_path,
                        'name': file_path.name,
                        'format': file_path.suffix.lower(),
                        'size_bytes': file_path.stat().st_size,
                        'source': dir_type
                    })

            if ic_files:
                ic_files = self._sort_by_format_preference(ic_files)
                ic_results.extend(ic_files)
                print(f"    Found {len(ic_files)} ic_ icons:")
                for ic in ic_files:
                    print(f"      - {ic['name']} ({ic['format']}, {self._format_file_size(ic['size_bytes'])}) -> {ic['path']}")
            else:
                print(f"    No ic_ icons found in this directory")

        print(f"  TOTAL IC_ ICONS FOUND: {len(ic_results)}")

        # Print detailed search summary
        if ic_results:
            print("[SEARCH-RESULT] IC_ icons array (sorted by format preference):")
            for i, ic in enumerate(ic_results, 1):
                print(f"  {i}. {ic['name']} ({ic['format']}, {self._format_file_size(ic['size_bytes'])}) from [{ic['source']}]")

        return ic_results

    def _sort_by_format_preference(self, files: List[Dict]) -> List[Dict]:
        """Sort files by format preference: PNG, JPG, WEBP"""
        format_priority = {'.png': 1, '.jpg': 2, '.webp': 3}
        return sorted(files, key=lambda x: (format_priority.get(x['format'], 999), x['name']))

    def create_image_menu_options(self, images: List[Dict], image_type: str) -> List[Dict]:
        """Create menu options from image list"""
        menu_options = []

        for i, image in enumerate(images):
            source_label = f"[{image['source']}]"
            display_text = f"{source_label} {image['name']} ({image['format']}, {self._format_file_size(image['size_bytes'])})"

            menu_options.append({
                'display': display_text,
                'value': image
            })

        return menu_options

    def show_image_selection_menu(self, menu_helper, images: List[Dict], image_type: str) -> Optional[Dict]:
        """Show selection menu for images using MenuHelper"""
        if not images:
            print(f"[MENU] No {image_type} images found to select from")
            return None

        # Use MenuHelper's image selection menu with compression toggle
        return menu_helper.show_image_selection_menu(
            title=f"{image_type} Image Selection",
            images=images,
            image_type=image_type
        )

    def apply_fallback_rules(self, selected_images: Dict, all_results: Dict) -> Dict:
        """Apply fallback rules for missing images"""
        print()
        print("APPLYING FALLBACK RULES:")
        print("-" * 40)

        # If no splash found, use background
        if not selected_images.get('splash') and selected_images.get('background'):
            selected_images['splash'] = selected_images['background']
            print("• Using background image as splash (splash not found)")

        # If no ic_ icons found, use logo
        if not selected_images.get('ic_icon') and selected_images.get('logo'):
            selected_images['ic_icon'] = selected_images['logo']
            print("• Using logo as ic_ icon (ic_ icons not found)")

        # Additional fallback: If no background found, look for other images in launch directories
        if not selected_images.get('background'):
            print("• No background images found with 'background' prefix")
            print("  Consider adding background.png, background.jpg or background.webp to launch/ directories")

        # Additional fallback: If no splash found and no background either
        if not selected_images.get('splash') and not selected_images.get('background'):
            print("• No splash or background images found with proper prefixes")
            print("  Consider adding splash.png or background.png to launch/ directories")

        # Show suggestions for missing directories
        missing_types = []
        if not selected_images.get('background'):
            missing_types.append("background")
        if not selected_images.get('splash'):
            missing_types.append("splash")
        if not selected_images.get('ic_icon') and not selected_images.get('logo'):
            missing_types.append("ic_icon")

        if missing_types:
            print()
            print("MISSING IMAGE TYPES DETECTED:")
            print("-" * 40)
            for missing_type in missing_types:
                if missing_type in ['background', 'splash']:
                    print(f"• {missing_type.upper()}: Add {missing_type}*.png/jpg/webp files to launch/ subdirectories")
                elif missing_type == 'ic_icon':
                    print(f"• IC_ICON: Add ic_*.png/jpg/webp files to icons/ subdirectories")

        return selected_images

    def print_final_selection_summary(self, selected_images: Dict):
        """Print final confirmed image paths and information"""
        print()
        print("=" * 80)
        print("FINAL IMAGE SELECTION SUMMARY")
        print("=" * 80)

        image_types = ['logo', 'background', 'splash', 'ic_icon']

        for image_type in image_types:
            image = selected_images.get(image_type)
            if image:
                print(f"{image_type.upper()}:")
                print(f"  Name: {image['name']}")
                print(f"  Path: {image['path']}")
                print(f"  Format: {image['format']}")
                print(f"  Size: {self._format_file_size(image['size_bytes'])}")
                print(f"  Source: {image['source']}")

                # Show compression mode if available
                if 'compression_mode' in image:
                    mode_text = "Compressed Mode (will be compressed)" if image['compression_mode'] == 'compressed' else "Original Mode (keep original)"
                    print(f"  Compression: {mode_text}")

                print()
            else:
                print(f"{image_type.upper()}: Not found")
                print()

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes < 1024:
            return f"{size_bytes}B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f}KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f}MB"