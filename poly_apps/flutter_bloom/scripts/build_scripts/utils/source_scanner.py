#!/usr/bin/env python3
"""
Source Scanner - Comprehensive Flutter Project Resource Scanner
Scans images, icons, and package identifiers across multiple platforms
"""

import base64
import io
import mimetypes
import os
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional

from third_party import Image

class SourceScanner:
    """Comprehensive scanner for Flutter project resources"""

    def __init__(self):
        # Define platform directories to scan
        self.platform_dirs = ['android', 'ios', 'linux', 'macos', 'web', 'windows']

        # Image file extensions to scan
        self.image_extensions = {
            '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif',
            '.ico', '.svg', '.webm'
        }

        # System package identifiers map - packages that are NOT application packages
        self.system_packages = {
            # Android Build Tools & Gradle
            'com.android.tools': {'type': 'build_tool', 'name': 'Android Build Tools'},
            'com.android.tools.build': {'type': 'build_tool', 'name': 'Android Gradle Plugin'},
            'com.android.application': {'type': 'plugin', 'name': 'Android Application Plugin'},
            'org.gradle': {'type': 'build_tool', 'name': 'Gradle'},
            'org.gradle.toolchains': {'type': 'build_tool', 'name': 'Gradle Toolchains'},
            'org.gradle.toolchains.foojay': {'type': 'plugin', 'name': 'Foojay Toolchain Plugin'},

            # Kotlin
            'org.jetbrains.kotlin': {'type': 'language', 'name': 'Kotlin'},
            'org.jetbrains.kotlin.android': {'type': 'plugin', 'name': 'Kotlin Android Plugin'},
            'org.jetbrains.kotlin.jvm': {'type': 'plugin', 'name': 'Kotlin JVM Plugin'},

            # Google Services
            'com.google.gms': {'type': 'framework', 'name': 'Google Play Services'},
            'com.google.gms.google': {'type': 'plugin', 'name': 'Google Services Plugin'},
            'com.google.firebase': {'type': 'framework', 'name': 'Firebase'},
            'com.google.firebase.messaging': {'type': 'service', 'name': 'Firebase Messaging'},
            'com.google.android.play': {'type': 'framework', 'name': 'Google Play'},

            # Flutter
            'dev.flutter.flutter': {'type': 'framework', 'name': 'Flutter'},
            'io.flutter': {'type': 'framework', 'name': 'Flutter'},
            'io.flutter.flutter.app': {'type': 'framework', 'name': 'Flutter App Framework'},
            'io.flutter.embedding.android': {'type': 'framework', 'name': 'Flutter Android Embedding'},
            'settings.ext.flutterSdkPath': {'type': 'config', 'name': 'Flutter SDK Path Setting'},

            # Android System
            'android.permission': {'type': 'permission', 'name': 'Android Permission'},
            'android.hardware': {'type': 'hardware', 'name': 'Android Hardware'},
            'android.intent': {'type': 'system', 'name': 'Android Intent'},
            'android.intent.action': {'type': 'system', 'name': 'Android Action'},
            'android.intent.category': {'type': 'system', 'name': 'Android Category'},
            'android.buildFeatures': {'type': 'config', 'name': 'Android Build Features'},
            'schemas.android.com': {'type': 'schema', 'name': 'Android XML Schemas'},

            # Android Themes
            'Theme.Light.NoTitleBar': {'type': 'theme', 'name': 'Android Light Theme'},
            'Theme.Black.NoTitleBar': {'type': 'theme', 'name': 'Android Dark Theme'},

            # Common Domains
            'developer.android.com': {'type': 'documentation', 'name': 'Android Developer Docs'},
            'www.': {'type': 'url', 'name': 'Web URL'},
            'http.': {'type': 'url', 'name': 'HTTP URL'},
            'file.': {'type': 'url', 'name': 'File URL'},

            # Other Build Tools
            'androidx': {'type': 'library', 'name': 'AndroidX Library'},
            'com.squareup': {'type': 'library', 'name': 'Square Libraries'},
            'org.junit': {'type': 'testing', 'name': 'JUnit Testing'},
            'org.mockito': {'type': 'testing', 'name': 'Mockito Testing'},

            # iOS/macOS Frameworks
            'com.apple': {'type': 'framework', 'name': 'Apple Framework'},
            'Foundation': {'type': 'framework', 'name': 'Foundation Framework'},
            'UIKit': {'type': 'framework', 'name': 'UIKit Framework'},
            'AppKit': {'type': 'framework', 'name': 'AppKit Framework'},

            # Web Standards
            'org.w3': {'type': 'standard', 'name': 'W3C Standard'},
            'schemas.xmlsoap.org': {'type': 'schema', 'name': 'XML Schema'},
        }

        # Image type classifications
        self.icon_max_size = 200  # pixels
        self.background_min_size = 800  # pixels

        # Recommended sizes for different image types
        self.recommended_sizes = {
            'icon': [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
            'splash': [(1080, 1920), (1440, 2560), (2160, 3840)],
            'background': [(1920, 1080), (2560, 1440), (3840, 2160)],
            'logo': [(200, 200), (400, 400), (800, 800)]
        }

        # App name scanning patterns for different platforms
        self.app_name_patterns = {
            'android': {
                'manifest': {
                    'files': ['**/AndroidManifest.xml'],
                    'patterns': [
                        r'android:label\s*=\s*"([^"]+)"',  # Direct label
                        r'android:label\s*=\s*"@string/([^"]+)"'  # String reference
                    ]
                },
                'strings': {
                    'files': ['**/res/values*/strings.xml'],
                    'patterns': [
                        r'<string\s+name="app_name"[^>]*>([^<]+)</string>',
                        r'<string\s+name="application_name"[^>]*>([^<]+)</string>',
                        r'<string\s+name="([^"]*app[^"]*name[^"]*)"[^>]*>([^<]+)</string>'
                    ]
                },
                'gradle': {
                    'files': ['**/build.gradle', '**/build.gradle.kts'],
                    'patterns': [
                        r'applicationId\s*[=:]\s*["\']([^"\']+)["\']',
                        r'resValue\s*\(\s*["\']string["\']\s*,\s*["\']app_name["\']\s*,\s*["\']([^"\']+)["\']\s*\)'
                    ]
                }
            },
            'ios': {
                'plist': {
                    'files': ['**/Info.plist'],
                    'patterns': [
                        r'<key>CFBundleDisplayName</key>\s*<string>([^<]+)</string>',
                        r'<key>CFBundleName</key>\s*<string>([^<]+)</string>',
                        r'<key>CFBundleExecutable</key>\s*<string>([^<]+)</string>'
                    ]
                },
                'strings': {
                    'files': ['**/*.lproj/InfoPlist.strings', '**/InfoPlist.strings'],
                    'patterns': [
                        r'CFBundleDisplayName\s*=\s*"([^"]+)"',
                        r'CFBundleName\s*=\s*"([^"]+)"',
                        r'"CFBundleDisplayName"\s*=\s*"([^"]+)"',
                        r'"CFBundleName"\s*=\s*"([^"]+)"'
                    ]
                },
                'xcconfig': {
                    'files': ['**/*.xcconfig'],
                    'patterns': [
                        r'PRODUCT_NAME\s*=\s*([^\s;]+)',
                        r'APP_DISPLAY_NAME\s*=\s*([^\s;]+)'
                    ]
                }
            },
            'macos': {
                'plist': {
                    'files': ['**/Info.plist', '**/Runner/Info.plist'],
                    'patterns': [
                        r'<key>CFBundleDisplayName</key>\s*<string>([^<]+)</string>',
                        r'<key>CFBundleName</key>\s*<string>([^<]+)</string>',
                        r'<key>CFBundleExecutable</key>\s*<string>([^<]+)</string>'
                    ]
                },
                'xcconfig': {
                    'files': ['**/*.xcconfig', '**/Configs/*.xcconfig'],
                    'patterns': [
                        r'PRODUCT_NAME\s*=\s*([^\s;]+)',
                        r'APP_DISPLAY_NAME\s*=\s*([^\s;]+)'
                    ]
                }
            },
            'windows': {
                'cmake': {
                    'files': ['**/CMakeLists.txt'],
                    'patterns': [
                        r'set\s*\(\s*BINARY_NAME\s+"([^"]+)"\s*\)',
                        r'set\s*\(\s*PRODUCT_NAME\s+"([^"]+)"\s*\)',
                        r'project\s*\(\s*([^\s)]+)',
                        r'add_executable\s*\(\s*([^\s)]+)'
                    ]
                },
                'rc': {
                    'files': ['**/*.rc', '**/Runner.rc'],
                    'patterns': [
                        r'VALUE\s+"ProductName"\s*,\s*"([^"]+)"',
                        r'VALUE\s+"FileDescription"\s*,\s*"([^"]+)"',
                        r'VALUE\s+"InternalName"\s*,\s*"([^"]+)"'
                    ]
                }
            },
            'linux': {
                'cmake': {
                    'files': ['**/CMakeLists.txt'],
                    'patterns': [
                        r'set\s*\(\s*BINARY_NAME\s+"([^"]+)"\s*\)',
                        r'set\s*\(\s*APPLICATION_ID\s+"([^"]+)"\s*\)',
                        r'project\s*\(\s*([^\s)]+)'
                    ]
                },
                'desktop': {
                    'files': ['**/*.desktop'],
                    'patterns': [
                        r'Name\s*=\s*(.+)',
                        r'GenericName\s*=\s*(.+)',
                        r'Name\[([a-z_]+)\]\s*=\s*(.+)'  # Localized names
                    ]
                }
            },
            'web': {
                'html': {
                    'files': ['**/index.html', '**/web/index.html'],
                    'patterns': [
                        r'<title>([^<]+)</title>',
                        r'<meta\s+name="application-name"\s+content="([^"]+)"',
                        r'<meta\s+property="og:title"\s+content="([^"]+)"'
                    ]
                },
                'manifest': {
                    'files': ['**/manifest.json', '**/web/manifest.json'],
                    'patterns': [
                        r'"name"\s*:\s*"([^"]+)"',
                        r'"short_name"\s*:\s*"([^"]+)"'
                    ]
                }
            }
        }

    def find_project_root(self, start_path: Path) -> Path:
        """Find Flutter project root by going up two directories from script location"""
        # Go up from build_scripts to scripts, then to flutter_bloom root
        return start_path.parent.parent

    def classify_package_identifier(self, identifier: str) -> Dict:
        """
        Classify a package identifier as system or application package

        Args:
            identifier: Package identifier string (e.g., "com.android.tools.build")

        Returns:
            Dict with classification info: {
                'is_system': bool,
                'category': str,
                'display_name': str
            }
        """
        # Check exact match first
        if identifier in self.system_packages:
            pkg_info = self.system_packages[identifier]
            return {
                'is_system': True,
                'category': pkg_info['type'],
                'display_name': pkg_info['name']
            }

        # Check if identifier starts with any system package prefix
        for sys_pkg, info in self.system_packages.items():
            if identifier.startswith(sys_pkg):
                return {
                    'is_system': True,
                    'category': info['type'],
                    'display_name': f"{info['name']} ({identifier})"
                }

        # Not a system package - it's an application package
        return {
            'is_system': False,
            'category': 'application',
            'display_name': 'Application Package'
        }

    def scan_package_identifiers(self, project_root: Path) -> List[Dict]:
        """Scan for package identifiers in xxx.xxx.xxx format"""
        identifiers = []
        pattern = re.compile(r'\b([a-zA-Z][a-zA-Z0-9]*\.){2,}[a-zA-Z][a-zA-Z0-9]*\b')

        # Define file extensions to search in
        search_extensions = {'.dart', '.xml', '.plist', '.json', '.yaml', '.yml', '.gradle', '.kt', '.swift'}

        for platform_dir in self.platform_dirs:
            platform_path = project_root / platform_dir
            if not platform_path.exists():
                continue

            for file_path in platform_path.rglob('*'):
                if file_path.is_file() and file_path.suffix.lower() in search_extensions:
                    try:
                        content = file_path.read_text(encoding='utf-8', errors='ignore')
                        matches = pattern.findall(content)

                        # Clean up matches (remove the trailing dot from findall groups)
                        for match_groups in matches:
                            # Reconstruct the full identifier from groups
                            if isinstance(match_groups, tuple):
                                full_match = ''.join(match_groups)
                            else:
                                full_match = match_groups

                            # Find the actual match in content
                            full_matches = pattern.finditer(content)
                            for full_match_obj in full_matches:
                                identifier = full_match_obj.group(0)

                                # Skip common false positives
                                if any(skip in identifier.lower() for skip in ['www.', 'http.', 'file.']):
                                    continue

                                # Classify the package identifier
                                classification = self.classify_package_identifier(identifier)

                                identifiers.append({
                                    'identifier': identifier,
                                    'file_path': str(file_path).replace('/', '\\') if os.name == 'nt' else str(file_path),
                                    'platform': platform_dir,
                                    'relative_path': str(file_path.relative_to(project_root)),
                                    'is_system': classification['is_system'],
                                    'category': classification['category'],
                                    'display_name': classification['display_name']
                                })

                    except (UnicodeDecodeError, PermissionError):
                        continue

        # Remove duplicates
        seen = set()
        unique_identifiers = []
        for item in identifiers:
            key = (item['identifier'], item['file_path'])
            if key not in seen:
                seen.add(key)
                unique_identifiers.append(item)

        return unique_identifiers

    def get_image_info(self, image_path: Path) -> Dict:
        """Get comprehensive information about an image file"""
        info = {
            'path': str(image_path).replace('/', '\\') if os.name == 'nt' else str(image_path),
            'name': image_path.name,
            'size_bytes': 0,
            'size_text': '0 B',
            'width': 0,
            'height': 0,
            'format': 'Unknown',
            'type_classification': 'unknown',
            'recommended_size': None,
            'is_placeholder': False,
            'base64_preview': None,
            'error': None
        }

        try:
            # Get file size
            info['size_bytes'] = image_path.stat().st_size
            info['size_text'] = self.format_file_size(info['size_bytes'])

            if Image is None:
                # Fallback when PIL is not available
                info['format'] = image_path.suffix.upper().lstrip('.')
                info['error'] = "PIL not available - limited image processing"
                return info

            # Handle ICO files specially
            if image_path.suffix.lower() == '.ico':
                try:
                    # For ICO files, we need special handling
                    with Image.open(image_path) as img:
                        # ICO files can contain multiple sizes
                        info['width'] = img.width
                        info['height'] = img.height
                        info['format'] = 'ICO'

                        # Convert first frame to PNG for preview
                        png_buffer = io.BytesIO()
                        img.save(png_buffer, format='PNG')
                        png_buffer.seek(0)

                        # Create base64 preview
                        info['base64_preview'] = base64.b64encode(png_buffer.getvalue()).decode('utf-8')

                except Exception as ico_error:
                    info['error'] = f"ICO processing error: {str(ico_error)}"
                    # Fallback for ICO files
                    info['format'] = 'ICO'
                    info['width'] = 32  # Default ICO size
                    info['height'] = 32

            elif image_path.suffix.lower() == '.svg':
                # SVG files - read as text and estimate size
                try:
                    svg_content = image_path.read_text(encoding='utf-8')
                    # Try to extract width/height from SVG
                    width_match = re.search(r'width="(\d+)', svg_content)
                    height_match = re.search(r'height="(\d+)', svg_content)

                    if width_match and height_match:
                        info['width'] = int(width_match.group(1))
                        info['height'] = int(height_match.group(1))
                    else:
                        # Try viewBox
                        viewbox_match = re.search(r'viewBox="[^"]*?(\d+)\s+(\d+)"', svg_content)
                        if viewbox_match:
                            info['width'] = int(viewbox_match.group(1))
                            info['height'] = int(viewbox_match.group(2))
                        else:
                            info['width'] = 0
                            info['height'] = 0

                    info['format'] = 'SVG'
                    # SVG preview would require more complex handling

                except Exception as svg_error:
                    info['error'] = f"SVG processing error: {str(svg_error)}"

            else:
                # Standard image files
                with Image.open(image_path) as img:
                    info['width'] = img.width
                    info['height'] = img.height
                    info['format'] = img.format or 'Unknown'

                    # Create base64 preview (resize if too large)
                    preview_img = img.copy()
                    if preview_img.width > 200 or preview_img.height > 200:
                        # Use LANCZOS if available, otherwise NEAREST
                        if hasattr(Image, 'Resampling') and hasattr(Image.Resampling, 'LANCZOS'):
                            preview_img.thumbnail((200, 200), Image.Resampling.LANCZOS)
                        elif hasattr(Image, 'LANCZOS'):
                            preview_img.thumbnail((200, 200), Image.LANCZOS)
                        else:
                            preview_img.thumbnail((200, 200))

                    # Convert to RGB if necessary for JPEG compatibility
                    if preview_img.mode in ('RGBA', 'P'):
                        preview_img = preview_img.convert('RGB')

                    buffer = io.BytesIO()
                    preview_img.save(buffer, format='JPEG', quality=85)
                    buffer.seek(0)

                    info['base64_preview'] = base64.b64encode(buffer.getvalue()).decode('utf-8')

            # Classify image type
            info['type_classification'] = self.classify_image_type(info['width'], info['height'])
            info['is_placeholder'] = (info['width'] <= 1 and info['height'] <= 1)

            # Get recommended size
            info['recommended_size'] = self.get_recommended_size(info['type_classification'], info['width'], info['height'])

        except Exception as e:
            info['error'] = str(e)
            # Fallback information
            info['format'] = image_path.suffix.upper().lstrip('.') or 'Unknown'

        return info

    def classify_image_type(self, width: int, height: int) -> str:
        """Classify image type based on dimensions"""
        if width <= 1 or height <= 1:
            return 'placeholder'
        elif max(width, height) <= self.icon_max_size:
            return 'icon'
        elif min(width, height) >= self.background_min_size:
            return 'background'
        elif abs(width - height) <= min(width, height) * 0.2:  # Nearly square
            return 'logo'
        else:
            return 'image'

    def get_recommended_size(self, image_type: str, current_width: int, current_height: int) -> Optional[Dict]:
        """Get recommended size for image type"""
        if image_type not in self.recommended_sizes:
            return None

        current_size = (current_width, current_height)
        recommended_list = self.recommended_sizes[image_type]

        # Find closest recommended size
        closest_size = min(recommended_list,
                          key=lambda x: abs(x[0] - current_width) + abs(x[1] - current_height))

        return {
            'current': current_size,
            'recommended': closest_size,
            'matches': current_size in recommended_list
        }

    def format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f} MB"

    def build_tree_structure(self, files_list: List[Dict], base_path: Path) -> Dict:
        """Build tree structure from file list"""
        tree = {}

        for file_info in files_list:
            path_obj = Path(file_info['relative_path'])
            parts = path_obj.parts

            current_level = tree
            for i, part in enumerate(parts):
                if part not in current_level:
                    current_level[part] = {
                        'type': 'directory' if i < len(parts) - 1 else 'file',
                        'children': {} if i < len(parts) - 1 else None,
                        'file_info': None if i < len(parts) - 1 else file_info,
                        'path': '/'.join(parts[:i+1])
                    }

                if i < len(parts) - 1:
                    current_level = current_level[part]['children']

        return tree

    def scan_platform_images(self, project_root: Path) -> Dict[str, List[Dict]]:
        """Scan images across all platform directories"""
        platform_images = {}

        for platform in self.platform_dirs:
            platform_path = project_root / platform
            platform_images[platform] = []

            if not platform_path.exists():
                continue

            # Recursively find all image files
            for file_path in platform_path.rglob('*'):
                if file_path.is_file() and file_path.suffix.lower() in self.image_extensions:
                    image_info = self.get_image_info(file_path)
                    image_info['platform'] = platform
                    image_info['relative_path'] = str(file_path.relative_to(project_root))
                    # Convert to platform-appropriate path format
                    if os.name == 'nt':  # Windows
                        image_info['directory_path'] = str(file_path.parent).replace('/', '\\')
                    else:  # Unix/Linux/Mac
                        image_info['directory_path'] = str(file_path.parent)
                    platform_images[platform].append(image_info)

            # Sort by file path for consistent ordering
            platform_images[platform].sort(key=lambda x: x['relative_path'])

        return platform_images

    def scan_platform_files(self, project_root: Path) -> Dict[str, List[Dict]]:
        """Scan all files across platform directories"""
        platform_files = {}

        for platform in self.platform_dirs:
            platform_path = project_root / platform
            platform_files[platform] = []

            if not platform_path.exists():
                continue

            # Recursively find all files
            for file_path in platform_path.rglob('*'):
                if file_path.is_file():
                    try:
                        file_info = {
                            'path': str(file_path).replace('/', '\\') if os.name == 'nt' else str(file_path),
                            'name': file_path.name,
                            'size_bytes': file_path.stat().st_size,
                            'size_text': self.format_file_size(file_path.stat().st_size),
                            'extension': file_path.suffix.lower(),
                            'platform': platform,
                            'relative_path': str(file_path.relative_to(project_root)),
                            # Convert to platform-appropriate path format
                            'directory_path': str(file_path.parent).replace('/', '\\') if os.name == 'nt' else str(file_path.parent),
                            'is_image': file_path.suffix.lower() in self.image_extensions,
                            'file_type': self.classify_file_type(file_path)
                        }
                        platform_files[platform].append(file_info)
                    except (OSError, PermissionError):
                        continue

            # Sort by file path for consistent ordering
            platform_files[platform].sort(key=lambda x: x['relative_path'])

        return platform_files

    def classify_file_type(self, file_path: Path) -> str:
        """Classify file type based on extension"""
        ext = file_path.suffix.lower()

        if ext in self.image_extensions:
            return 'image'
        elif ext in {'.dart', '.java', '.kt', '.swift', '.cpp', '.c', '.h', '.hpp', '.js', '.ts', '.py'}:
            return 'code'
        elif ext in {'.xml', '.html', '.xhtml'}:
            return 'markup'
        elif ext in {'.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.plist'}:
            return 'config'
        elif ext in {'.md', '.txt', '.rst', '.doc', '.docx'}:
            return 'document'
        elif ext in {'.gradle', '.pro', '.cmake', '.make', '.mk'}:
            return 'build'
        elif ext in {'.so', '.a', '.lib', '.dll', '.dylib', '.framework'}:
            return 'binary'
        elif ext in {'.zip', '.tar', '.gz', '.rar', '.7z'}:
            return 'archive'
        else:
            return 'other'

    def scan_app_names(self, project_root: Path) -> Dict[str, List[Dict]]:
        """
        Scan for application names across all platforms with multi-language support

        Returns:
            Dict mapping platform name to list of found app names with metadata
        """
        app_names_by_platform = {}

        for platform in self.platform_dirs:
            platform_path = project_root / platform
            if not platform_path.exists():
                app_names_by_platform[platform] = []
                continue

            platform_app_names = []

            # Get patterns for this platform
            platform_patterns = self.app_name_patterns.get(platform, {})

            for source_type, config in platform_patterns.items():
                file_patterns = config.get('files', [])
                name_patterns = config.get('patterns', [])

                # Find all matching files
                for file_pattern in file_patterns:
                    for file_path in platform_path.glob(file_pattern):
                        if not file_path.is_file():
                            continue

                        try:
                            # Read file content
                            content = file_path.read_text(encoding='utf-8', errors='ignore')

                            # Try each pattern
                            for pattern in name_patterns:
                                matches = re.finditer(pattern, content, re.MULTILINE | re.IGNORECASE)

                                for match in matches:
                                    # Extract app name and language/locale info
                                    app_name = None
                                    locale = 'default'
                                    key_name = None

                                    # Handle different match group counts
                                    groups = match.groups()

                                    if len(groups) == 1:
                                        # Simple pattern with one capture group
                                        app_name = groups[0].strip()
                                    elif len(groups) == 2:
                                        # Could be (key, value) or (locale, value)
                                        if 'Name[' in pattern or 'lproj' in str(file_path):
                                            locale = groups[0]
                                            app_name = groups[1].strip()
                                        else:
                                            key_name = groups[0]
                                            app_name = groups[1].strip()
                                    elif len(groups) >= 3:
                                        # Complex pattern
                                        app_name = groups[-1].strip()

                                    # Skip empty or invalid names
                                    if not app_name or app_name.startswith('@') or len(app_name) < 2:
                                        continue

                                    # Detect locale from file path
                                    if 'values-' in str(file_path):
                                        # Android: res/values-zh/strings.xml
                                        locale_match = re.search(r'values-([a-z]{2}(?:-r[A-Z]{2})?)', str(file_path))
                                        if locale_match:
                                            locale = locale_match.group(1)
                                    elif '.lproj' in str(file_path):
                                        # iOS: zh-Hans.lproj/InfoPlist.strings
                                        locale_match = re.search(r'([a-z]{2}(?:-[A-Za-z]+)?)\.lproj', str(file_path))
                                        if locale_match:
                                            locale = locale_match.group(1)

                                    # Convert locale codes to readable names
                                    locale_name = self._get_locale_name(locale)

                                    platform_app_names.append({
                                        'app_name': app_name,
                                        'locale': locale,
                                        'locale_name': locale_name,
                                        'source_type': source_type,
                                        'source_file': str(file_path.relative_to(project_root)),
                                        'source_file_abs': str(file_path).replace('/', '\\') if os.name == 'nt' else str(file_path),
                                        'key_name': key_name,
                                        'pattern_used': pattern,
                                        'platform': platform
                                    })

                        except (UnicodeDecodeError, PermissionError) as e:
                            continue

            # Remove duplicates but keep different locales
            seen = set()
            unique_names = []
            for item in platform_app_names:
                key = (item['app_name'], item['locale'], item['source_file'])
                if key not in seen:
                    seen.add(key)
                    unique_names.append(item)

            # Sort by locale (default first, then alphabetically)
            unique_names.sort(key=lambda x: (x['locale'] != 'default', x['locale'], x['app_name']))

            app_names_by_platform[platform] = unique_names

        return app_names_by_platform

    def _get_locale_name(self, locale_code: str) -> str:
        """Convert locale code to readable name"""
        locale_map = {
            'default': 'Default',
            'en': 'English',
            'zh': 'Chinese (Simplified)',
            'zh-Hans': 'Chinese (Simplified)',
            'zh-Hant': 'Chinese (Traditional)',
            'zh-CN': 'Chinese (China)',
            'zh-TW': 'Chinese (Taiwan)',
            'zh-HK': 'Chinese (Hong Kong)',
            'ja': 'Japanese',
            'ko': 'Korean',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'th': 'Thai',
            'vi': 'Vietnamese',
            'id': 'Indonesian',
            'ms': 'Malay',
            'tr': 'Turkish',
            'pl': 'Polish',
            'nl': 'Dutch',
            'sv': 'Swedish',
            'da': 'Danish',
            'no': 'Norwegian',
            'fi': 'Finnish',
        }
        return locale_map.get(locale_code, locale_code.upper())

    def get_comprehensive_scan_results(self, project_root: Path) -> Dict:
        """Get comprehensive scan results including images, files and package identifiers"""
        print(f"[SOURCE-SCANNER] Starting comprehensive scan of: {project_root}")

        # Scan images
        platform_images = self.scan_platform_images(project_root)

        # Scan all files
        platform_files = self.scan_platform_files(project_root)

        # Build tree structures
        platform_images_tree = {}
        platform_files_tree = {}

        for platform in self.platform_dirs:
            if platform in platform_images and platform_images[platform]:
                platform_images_tree[platform] = self.build_tree_structure(platform_images[platform], project_root / platform)
            else:
                platform_images_tree[platform] = {}

            if platform in platform_files and platform_files[platform]:
                platform_files_tree[platform] = self.build_tree_structure(platform_files[platform], project_root / platform)
            else:
                platform_files_tree[platform] = {}

        # Count totals
        total_images = sum(len(images) for images in platform_images.values())
        total_files = sum(len(files) for files in platform_files.values())

        # Scan package identifiers
        package_identifiers = self.scan_package_identifiers(project_root)

        # Scan application names (multi-language)
        app_names = self.scan_app_names(project_root)
        total_app_names = sum(len(names) for names in app_names.values())

        # Calculate statistics
        stats = {
            'total_images': total_images,
            'total_files': total_files,
            'total_identifiers': len(package_identifiers),
            'total_app_names': total_app_names,
            'images_by_platform': {platform: len(images) for platform, images in platform_images.items()},
            'files_by_platform': {platform: len(files) for platform, files in platform_files.items()},
            'app_names_by_platform': {platform: len(names) for platform, names in app_names.items()},
            'images_by_type': {},
            'files_by_type': {},
            'total_images_size_bytes': 0,
            'total_files_size_bytes': 0
        }

        # Calculate image statistics
        for images in platform_images.values():
            for image in images:
                img_type = image['type_classification']
                stats['images_by_type'][img_type] = stats['images_by_type'].get(img_type, 0) + 1
                stats['total_images_size_bytes'] += image['size_bytes']

        # Calculate file statistics
        for files in platform_files.values():
            for file_info in files:
                file_type = file_info['file_type']
                stats['files_by_type'][file_type] = stats['files_by_type'].get(file_type, 0) + 1
                stats['total_files_size_bytes'] += file_info['size_bytes']

        stats['total_images_size_text'] = self.format_file_size(stats['total_images_size_bytes'])
        stats['total_files_size_text'] = self.format_file_size(stats['total_files_size_bytes'])
        stats['total_size_bytes'] = stats['total_images_size_bytes'] + stats['total_files_size_bytes']
        stats['total_size_text'] = self.format_file_size(stats['total_size_bytes'])

        print(f"[SOURCE-SCANNER] Scan completed: {total_images} images, {total_files} files, {len(package_identifiers)} identifiers, {total_app_names} app names")

        return {
            'project_root': str(project_root),
            'platform_images': platform_images,
            'platform_images_tree': platform_images_tree,
            'platform_files': platform_files,
            'platform_files_tree': platform_files_tree,
            'package_identifiers': package_identifiers,
            'app_names': app_names,
            'statistics': stats,
            'platforms': self.platform_dirs
        }