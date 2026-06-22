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
Flutter Icons Visualization System - Web Application
Independent web-based icon management system for Flutter multi-app development
Author: Development Script System
Version: 1.0
"""

import os
import json
import sys
import webbrowser
import threading
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
from werkzeug.utils import secure_filename

# Add parent directory to path for imports
dev_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dev')
sys.path.append(dev_dir)
from py_helper.gvar_common import gvar, write_debug_info, set_gvar_value, get_gvar_value

# Import image analyzer
from image_analyzer import ImageAnalyzer

# Try to import image processing libraries
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("Warning: PIL (Pillow) not available. Image processing will be limited.")

class FlutterIconsWebApp:
    """
    Flutter Icons Visualization Web System
    Provides comprehensive icon management for Flutter development via web interface
    """
    
    def __init__(self):
        self.project_root = gvar.get_current_project_root()
        self.dev_script_dir = self.project_root / "scripts" / "dev"
        self.platform_dirs = ['android', 'ios', 'windows', 'web']
        
        # Initialize image analyzer
        self.image_analyzer = ImageAnalyzer()
        
        # Data storage
        self.scanned_images = {}
        self.image_analysis_cache = {}
        
        # Settings
        self.auto_refresh = True
        self.show_image_details = True
        self.show_compliance_scores = True
        
        # Common image extensions
        self.image_extensions = ['.png', '.jpg', '.jpeg', '.ico', '.icns', '.gif', '.webp', '.svg']
        
        # Flask app
        self.app = Flask(__name__, 
                        template_folder='web_templates',
                        static_folder='web_static')
        self.setup_routes()
        
        # Initialize debug printing
        self.print_startup_debug()
    
    def print_startup_debug(self):
        """Print comprehensive debug information at startup"""
        script_specific_vars = {
            'project_root': str(self.project_root),
            'dev_script_dir': str(self.dev_script_dir),
            'platform_dirs': self.platform_dirs,
            'PIL_AVAILABLE': PIL_AVAILABLE,
            'image_extensions': self.image_extensions,
            'auto_refresh': self.auto_refresh,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'web_port': 40017
        }
        gvar.print_debug_variables("FLUTTER_ICONS_WEB_VIEWER", script_specific_vars)
    
    def setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/')
        def index():
            """Main page"""
            return render_template('index.html', 
                                 platform_dirs=self.platform_dirs,
                                 PIL_AVAILABLE=PIL_AVAILABLE)
        
        @self.app.route('/test')
        def test_page():
            """Test page for debugging"""
            from flask import send_file
            return send_file('test_compress_fix.html')
        
        @self.app.route('/api/scan')
        def api_scan():
            """API endpoint to scan platform images"""
            self.scan_platform_images()
            return jsonify({
                'status': 'success',
                'data': self.prepare_images_data(),
                'timestamp': datetime.now().isoformat()
            })
        
        @self.app.route('/api/images')
        def api_images():
            """API endpoint to get scanned images"""
            return jsonify({
                'status': 'success',
                'data': self.prepare_images_data(),
                'settings': {
                    'auto_refresh': self.auto_refresh,
                    'show_image_details': self.show_image_details,
                    'show_compliance_scores': self.show_compliance_scores
                }
            })
        
        @self.app.route('/api/platform/<platform>')
        def api_platform_images(platform):
            """API endpoint to get images for specific platform"""
            if platform not in self.platform_dirs:
                return jsonify({'status': 'error', 'message': 'Invalid platform'}), 400
            
            platform_data = self.scanned_images.get(platform, [])
            return jsonify({
                'status': 'success',
                'platform': platform,
                'data': self.prepare_platform_data(platform_data)
            })
        
        @self.app.route('/api/image/<path:image_path>')
        def api_get_image(image_path):
            """Serve image files"""
            try:
                full_path = self.project_root / image_path
                if full_path.exists() and full_path.is_file():
                    return send_file(str(full_path))
                else:
                    return jsonify({'status': 'error', 'message': 'Image not found'}), 404
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500
        
        @self.app.route('/api/download/<path:image_path>')
        def api_download_image(image_path):
            """Download image file"""
            try:
                full_path = self.project_root / image_path
                if full_path.exists() and full_path.is_file():
                    return send_file(str(full_path), as_attachment=True, 
                                   download_name=full_path.name)
                else:
                    return jsonify({'status': 'error', 'message': 'Image not found'}), 404
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500
        
        @self.app.route('/api/upload', methods=['POST'])
        def api_upload_image():
            """Upload and replace image"""
            try:
                if 'file' not in request.files:
                    return jsonify({'status': 'error', 'message': 'No file provided'}), 400
                
                file = request.files['file']
                target_paths = request.form.getlist('targets')
                
                if file.filename == '':
                    return jsonify({'status': 'error', 'message': 'No file selected'}), 400
                
                if not target_paths:
                    return jsonify({'status': 'error', 'message': 'No target paths provided'}), 400
                
                # Save uploaded file temporarily
                filename = secure_filename(file.filename)
                temp_path = self.project_root / '.tmp' / 'uploads' / filename
                temp_path.parent.mkdir(parents=True, exist_ok=True)
                file.save(str(temp_path))
                
                # Replace target images
                replaced_count = 0
                for target_path in target_paths:
                    full_target_path = self.project_root / target_path
                    if self.replace_image(temp_path, full_target_path):
                        replaced_count += 1
                
                # Clean up temp file
                temp_path.unlink(missing_ok=True)
                
                return jsonify({
                    'status': 'success',
                    'message': f'Successfully replaced {replaced_count} of {len(target_paths)} images',
                    'replaced_count': replaced_count,
                    'total_count': len(target_paths)
                })
                
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500
        
        @self.app.route('/api/compress', methods=['POST'])
        def api_compress_image():
            """Compress single image"""
            try:
                print(f"Compress API called - Content-Type: {request.content_type}")
                data = request.get_json()
                print(f"Request data: {data}")
                
                if not data:
                    print("No JSON data received")
                    return jsonify({'status': 'error', 'message': 'No JSON data provided'}), 400
                
                image_path = data.get('image_path')
                print(f"Image path from request: {image_path}")
                
                if not image_path:
                    print("No image path in request")
                    return jsonify({'status': 'error', 'message': 'No image path provided'}), 400
                
                full_path = self.project_root / image_path
                print(f"Full path: {full_path}")
                
                if not full_path.exists():
                    print(f"Image not found at: {full_path}")
                    return jsonify({'status': 'error', 'message': f'Image not found: {image_path}'}), 404
                
                print(f"Attempting to compress: {full_path}")
                success = self.compress_single_image(full_path)
                
                if success:
                    print("Compression successful")
                    return jsonify({'status': 'success', 'message': 'Image compressed successfully'})
                else:
                    print("Compression failed")
                    return jsonify({'status': 'error', 'message': 'Compression failed'}), 500
                    
            except Exception as e:
                print(f"Exception in compress API: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500
        
        @self.app.route('/api/fix-size', methods=['POST'])
        def api_fix_image_size():
            """Fix image to recommended size"""
            try:
                data = request.get_json()
                image_path = data.get('image_path')
                
                if not image_path:
                    return jsonify({'status': 'error', 'message': 'No image path provided'}), 400
                
                full_path = self.project_root / image_path
                if not full_path.exists():
                    return jsonify({'status': 'error', 'message': 'Image not found'}), 404
                
                # Get current image info
                image_info = self.get_image_info(full_path)
                if not image_info:
                    return jsonify({'status': 'error', 'message': 'Cannot analyze image'}), 500
                
                size_recommendations = image_info.get('size_recommendations', {})
                if not size_recommendations or not size_recommendations.get('recommended_sizes'):
                    return jsonify({'status': 'error', 'message': 'No size recommendations available'}), 400
                
                # Get the best recommended size
                recommended_size = size_recommendations['recommended_sizes'][0]
                target_width, target_height = recommended_size
                
                # Create repair plan
                repair_plan = {
                    'original_size': f"{image_info.get('width', 'Unknown')}x{image_info.get('height', 'Unknown')}",
                    'recommended_size': f"{target_width}x{target_height}",
                    'current_file_size': f"{image_info['size_bytes'] // 1024}KB",
                    'compliance_score': f"{size_recommendations.get('compliance_score', 0) * 100:.1f}%",
                    'repair_actions': [
                        f"Resize image from {image_info.get('width', '?')}x{image_info.get('height', '?')} to {target_width}x{target_height}",
                        "Maintain aspect ratio and crop to fit exact dimensions",
                        "Optimize image quality and compression",
                        "Create backup of original image"
                    ]
                }
                
                # Apply the fix
                success = self.fix_image_size(full_path, (target_width, target_height))
                
                if success:
                    return jsonify({
                        'status': 'success',
                        'message': 'Image size fixed successfully',
                        'repair_plan': repair_plan
                    })
                else:
                    return jsonify({'status': 'error', 'message': 'Size fix failed'}), 500
                    
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500
        
        @self.app.route('/api/cleanup', methods=['POST'])
        def api_cleanup():
            """Run cleanup script"""
            try:
                cleanup_script = self.dev_script_dir / "py_helper" / "cleanup_restore.py"
                if cleanup_script.exists():
                    result = subprocess.run([sys.executable, str(cleanup_script)], 
                                          capture_output=True, text=True, check=True)
                    return jsonify({'status': 'success', 'message': 'Cleanup completed successfully'})
                else:
                    return jsonify({'status': 'error', 'message': 'Cleanup script not found'}), 404
                    
            except subprocess.CalledProcessError as e:
                return jsonify({'status': 'error', 'message': f'Cleanup failed: {e.stderr}'}), 500
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500
        
        @self.app.route('/api/debug')
        def api_debug_info():
            """Get debug information"""
            return jsonify({
                'status': 'success',
                'data': self.get_debug_info()
            })
        
        @self.app.route('/api/settings', methods=['GET', 'POST'])
        def api_settings():
            """Get or update settings"""
            if request.method == 'GET':
                return jsonify({
                    'status': 'success',
                    'settings': {
                        'auto_refresh': self.auto_refresh,
                        'show_image_details': self.show_image_details,
                        'show_compliance_scores': self.show_compliance_scores
                    }
                })
            else:
                data = request.get_json()
                if 'auto_refresh' in data:
                    self.auto_refresh = data['auto_refresh']
                if 'show_image_details' in data:
                    self.show_image_details = data['show_image_details']
                if 'show_compliance_scores' in data:
                    self.show_compliance_scores = data['show_compliance_scores']
                
                return jsonify({'status': 'success', 'message': 'Settings updated'})
        
        @self.app.route('/api/fix-all-sizes', methods=['POST'])
        def api_fix_all_sizes():
            """Fix all images to recommended sizes in a directory"""
            try:
                data = request.get_json()
                platform = data.get('platform')
                directory = data.get('directory')
                
                if not platform or directory is None:
                    return jsonify({'status': 'error', 'message': 'Platform and directory required'}), 400
                
                # Get images in the directory
                platform_images = self.scanned_images.get(platform, [])
                directory_images = []
                
                for image in platform_images:
                    img_dir = str(image['relative_path']).replace('\\', '/').split('/')[:-1]
                    img_dir_path = '/'.join(img_dir)
                    if img_dir_path == directory:
                        directory_images.append(image)
                
                fixed_count = 0
                skipped_count = 0
                errors = []
                
                for image in directory_images:
                    # Skip placeholder images
                    classification = image.get('classification', {})
                    if classification and classification.get('category') == 'Placeholder':
                        skipped_count += 1
                        continue
                    
                    # Check if image needs fixing
                    size_recommendations = image.get('size_recommendations', {})
                    if not size_recommendations or not size_recommendations.get('recommended_sizes'):
                        skipped_count += 1
                        continue
                    
                    # Check if image is valid
                    if not image.get('is_valid_image', True):
                        skipped_count += 1
                        continue
                    
                    # Fix the image
                    try:
                        full_path = self.project_root / image['relative_path']
                        recommended_size = size_recommendations['recommended_sizes'][0]
                        target_width, target_height = recommended_size
                        
                        success = self.fix_image_size(full_path, (target_width, target_height))
                        if success:
                            fixed_count += 1
                        else:
                            errors.append(f"Failed to fix {image['name']}")
                    except Exception as e:
                        errors.append(f"Error fixing {image['name']}: {str(e)}")
                
                return jsonify({
                    'status': 'success',
                    'message': f'Fixed {fixed_count} images, skipped {skipped_count}',
                    'fixed_count': fixed_count,
                    'skipped_count': skipped_count,
                    'errors': errors[:5]  # Limit error list
                })
                
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500
        
        @self.app.route('/api/export')
        def api_export_report():
            """Export image scan report"""
            try:
                report_data = {
                    'scan_time': datetime.now().isoformat(),
                    'project_root': str(self.project_root),
                    'platforms': {}
                }
                
                for platform, images in self.scanned_images.items():
                    platform_data = {
                        'image_count': len(images),
                        'images': []
                    }
                    
                    for img in images:
                        img_data = img.copy()
                        img_data['path'] = str(img_data['path'])
                        img_data['relative_path'] = str(img_data['relative_path'])
                        img_data['modified'] = img_data['modified'].isoformat()
                        platform_data['images'].append(img_data)
                    
                    report_data['platforms'][platform] = platform_data
                
                # Save report to temp file
                report_file = self.project_root / '.tmp' / 'reports' / f'icon_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
                report_file.parent.mkdir(parents=True, exist_ok=True)
                
                with open(report_file, 'w', encoding='utf-8') as f:
                    json.dump(report_data, f, indent=2, ensure_ascii=False)
                
                return send_file(str(report_file), as_attachment=True)
                
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500
    
    def scan_platform_images(self):
        """Scan all platform directories for images"""
        print("Scanning platform directories for images...")
        self.scanned_images = {}
        
        for platform in self.platform_dirs:
            platform_dir = self.project_root / platform
            if not platform_dir.exists():
                continue
            
            print(f"Scanning {platform} directory: {platform_dir}")
            platform_images = []
            
            # Recursively find all images
            for ext in self.image_extensions:
                for image_path in platform_dir.rglob(f"*{ext}"):
                    if image_path.is_file():
                        image_info = self.get_image_info(image_path)
                        if image_info:
                            platform_images.append(image_info)
            
            self.scanned_images[platform] = platform_images
            print(f"Found {len(platform_images)} images in {platform}")
        
        total_images = sum(len(images) for images in self.scanned_images.values())
        print(f"Scan complete. Total images found: {total_images}")
    
    def get_image_info(self, image_path: Path) -> Optional[Dict]:
        """Get detailed information about an image with intelligent analysis"""
        try:
            stat = image_path.stat()
            info = {
                'path': image_path,
                'name': image_path.name,
                'relative_path': image_path.relative_to(self.project_root),
                'size_bytes': stat.st_size,
                'modified': datetime.fromtimestamp(stat.st_mtime),
                'width': None,
                'height': None,
                'format': image_path.suffix.upper().replace('.', ''),
                'is_valid_image': True
            }
            
            # Check if file is empty or too small
            if stat.st_size < 100:  # Less than 100 bytes is likely not a valid image
                info['is_valid_image'] = False
                info['error_reason'] = 'File too small or empty'
                return info
            
            if PIL_AVAILABLE:
                try:
                    with Image.open(image_path) as img:
                        info['width'] = img.width
                        info['height'] = img.height
                        info['format'] = img.format or info['format']
                        
                        # Additional validation
                        if img.width <= 1 or img.height <= 1:
                            info['is_valid_image'] = False
                            info['error_reason'] = 'Invalid image dimensions'
                        
                except Exception as e:
                    info['is_valid_image'] = False
                    info['error_reason'] = f'Cannot open image: {str(e)}'
            
            # Get intelligent classification and analysis only for valid images
            if info['is_valid_image']:
                cache_key = str(image_path)
                if cache_key not in self.image_analysis_cache:
                    classification = self.image_analyzer.classify_image(image_path, info['width'], info['height'])
                    
                    size_recommendations = None
                    compression_recommendations = None
                    
                    if info['width'] and info['height']:
                        size_recommendations = self.image_analyzer.get_size_recommendations(
                            image_path, info['width'], info['height']
                        )
                        compression_recommendations = self.image_analyzer.get_compression_recommendations(
                            image_path, info['size_bytes'], info['width'], info['height']
                        )
                    
                    self.image_analysis_cache[cache_key] = {
                        'classification': classification,
                        'size_recommendations': size_recommendations,
                        'compression_recommendations': compression_recommendations
                    }
                
                # Add analysis results to info
                analysis = self.image_analysis_cache[cache_key]
                info.update({
                    'classification': analysis['classification'],
                    'size_recommendations': analysis['size_recommendations'],
                    'compression_recommendations': analysis['compression_recommendations']
                })
            else:
                # For invalid images, set empty analysis
                info.update({
                    'classification': None,
                    'size_recommendations': None,
                    'compression_recommendations': None
                })
            
            return info
            
        except Exception as e:
            print(f"Error getting info for {image_path}: {e}")
            return None
    
    def prepare_images_data(self):
        """Prepare images data for JSON serialization"""
        result = {}
        for platform, images in self.scanned_images.items():
            result[platform] = self.prepare_platform_data(images)
        return result
    
    def prepare_platform_data(self, images_list):
        """Prepare platform data for JSON serialization with improved grouping"""
        # Group images by exact directory path
        grouped_data = {}
        
        for img in images_list:
            img_data = img.copy()
            # Convert Path objects to strings
            img_data['path'] = str(img_data['path'])
            img_data['relative_path'] = str(img_data['relative_path'])
            img_data['modified'] = img_data['modified'].isoformat()
            
            # Get directory path relative to platform
            rel_path_str = str(img['relative_path']).replace('\\', '/')
            path_parts = rel_path_str.split('/')
            directory = '/'.join(path_parts[:-1]) if len(path_parts) > 1 else ''
            
            # Get absolute directory path
            abs_path_parts = str(img['path']).replace('\\', '/').split('/')
            abs_directory = '/'.join(abs_path_parts[:-1])  # Remove filename
            
            # Check if this is an Android drawable resource to add drawable_type
            if len(path_parts) >= 2 and 'res' in path_parts and any(part.startswith('drawable') for part in path_parts):
                drawable_dir = next((part for part in path_parts if part.startswith('drawable')), 'drawable')
                img_data['drawable_type'] = drawable_dir
            
            if directory not in grouped_data:
                grouped_data[directory] = {
                    'type': 'directory_group',
                    'name': directory or 'Root',
                    'path': directory,
                    'abs_path': abs_directory,
                    'images': []
                }
            
            grouped_data[directory]['images'].append(img_data)
        
        # Convert grouped data to list format
        result = []
        for group_key, group_data in grouped_data.items():
            # Sort images in directory group
            group_data['images'].sort(key=lambda x: x['name'].lower())
            result.append(group_data)
        
        # Sort result groups by name
        result.sort(key=lambda x: x['name'].lower())
        
        return result
    
    def replace_image(self, source_path: Path, target_path: Path) -> bool:
        """Replace target image with source image"""
        try:
            # Create backup
            backup_path = self.create_backup(target_path)
            print(f"Created backup: {backup_path}")
            
            if PIL_AVAILABLE and target_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                # Get target dimensions
                target_info = self.get_image_info(target_path)
                if target_info and target_info['width'] and target_info['height']:
                    # Resize and crop to match target
                    self.resize_and_replace_image(
                        source_path, target_path,
                        (target_info['width'], target_info['height'])
                    )
                    return True
            
            # Simple copy if no PIL or special handling needed
            shutil.copy2(source_path, target_path)
            print(f"Replaced: {target_path}")
            return True
            
        except Exception as e:
            print(f"Error replacing image {target_path}: {e}")
            return False
    
    def resize_and_replace_image(self, source_path: Path, target_path: Path, target_size: Tuple[int, int]):
        """Resize source image to target size and replace"""
        with Image.open(source_path) as img:
            # Convert to RGB if necessary for JPEG
            if target_path.suffix.lower() in ['.jpg', '.jpeg'] and img.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Calculate scaling to fit target size
            target_width, target_height = target_size
            scale_factor = max(target_width / img.width, target_height / img.height)
            
            # Resize image
            new_width = int(img.width * scale_factor)
            new_height = int(img.height * scale_factor)
            img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Crop to exact target size
            if new_width != target_width or new_height != target_height:
                left = (new_width - target_width) // 2
                top = (new_height - target_height) // 2
                right = left + target_width
                bottom = top + target_height
                img_resized = img_resized.crop((left, top, right, bottom))
            
            # Save the processed image
            img_resized.save(target_path, optimize=True)
    
    def create_backup(self, file_path: Path) -> Path:
        """Create backup of file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = self.project_root / ".tmp" / "icon_backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        relative_path = file_path.relative_to(self.project_root)
        backup_name = f"{relative_path.as_posix().replace('/', '_')}_{timestamp}.bak"
        backup_path = backup_dir / backup_name
        
        shutil.copy2(file_path, backup_path)
        return backup_path
    
    def compress_single_image(self, image_path: Path) -> bool:
        """Compress a single image"""
        if not PIL_AVAILABLE:
            return False
        
        try:
            # Get compression recommendations
            image_info = self.get_image_info(image_path)
            if not image_info:
                return False
            
            compression_rec = image_info.get('compression_recommendations', {})
            if not compression_rec.get('should_compress', False):
                return False
            
            # Create backup
            backup_path = self.create_backup(image_path)
            print(f"Created backup: {backup_path}")
            
            # Compress image
            with Image.open(image_path) as img:
                # Convert to RGB if saving as JPEG
                if compression_rec.get('format_recommendation') == 'JPEG':
                    if img.mode in ('RGBA', 'LA'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img = background
                    save_path = image_path.with_suffix('.jpg')
                else:
                    save_path = image_path
                
                # Save with compression
                save_kwargs = {'optimize': True}
                if compression_rec.get('quality_recommendation'):
                    save_kwargs['quality'] = compression_rec['quality_recommendation']
                
                img.save(save_path, **save_kwargs)
                
                # Replace original if format changed
                if save_path != image_path:
                    image_path.unlink()  # Remove original
                
                return True
                    
        except Exception as e:
            print(f"Failed to compress image: {e}")
            return False
    
    def fix_image_size(self, image_path: Path, target_size: Tuple[int, int]) -> bool:
        """Fix image to recommended size"""
        if not PIL_AVAILABLE:
            return False
        
        try:
            # Create backup
            backup_path = self.create_backup(image_path)
            print(f"Created backup: {backup_path}")
            
            # Resize image to target size
            with Image.open(image_path) as img:
                # Convert to RGB if necessary for JPEG
                if image_path.suffix.lower() in ['.jpg', '.jpeg'] and img.mode in ('RGBA', 'LA'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                
                # Calculate scaling to fit target size
                target_width, target_height = target_size
                scale_factor = max(target_width / img.width, target_height / img.height)
                
                # Resize image
                new_width = int(img.width * scale_factor)
                new_height = int(img.height * scale_factor)
                img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Crop to exact target size
                if new_width != target_width or new_height != target_height:
                    left = (new_width - target_width) // 2
                    top = (new_height - target_height) // 2
                    right = left + target_width
                    bottom = top + target_height
                    img_resized = img_resized.crop((left, top, right, bottom))
                
                # Save the processed image
                img_resized.save(image_path, optimize=True)
                print(f"Fixed image size: {image_path} -> {target_width}x{target_height}")
                return True
                    
        except Exception as e:
            print(f"Failed to fix image size: {e}")
            return False
    
    def get_debug_info(self):
        """Get comprehensive debug information"""
        debug_info = {
            'timestamp': datetime.now().isoformat(),
            'project_root': str(self.project_root),
            'dev_script_dir': str(self.dev_script_dir),
            'PIL_AVAILABLE': PIL_AVAILABLE,
            'platform_directories': {},
            'scanned_images_summary': {},
            'settings': {
                'auto_refresh': self.auto_refresh,
                'show_image_details': self.show_image_details,
                'show_compliance_scores': self.show_compliance_scores
            },
            'system_info': {
                'python_version': sys.version,
                'platform': sys.platform,
                'working_directory': os.getcwd()
            }
        }
        
        # Platform directories
        for platform in self.platform_dirs:
            platform_dir = self.project_root / platform
            debug_info['platform_directories'][platform] = {
                'path': str(platform_dir),
                'exists': platform_dir.exists()
            }
        
        # Scanned images summary
        total_images = 0
        for platform, images in self.scanned_images.items():
            count = len(images)
            total_images += count
            debug_info['scanned_images_summary'][platform] = count
        debug_info['scanned_images_summary']['total'] = total_images
        
        # Gvar information
        try:
            debug_info['gvar_info'] = {
                'debug_mode': get_gvar_value("debug_mode"),
                'current_app': get_gvar_value("current_app_name"),
                'flutter_project_dir': get_gvar_value("flutter_project_dir")
            }
        except Exception as e:
            debug_info['gvar_info'] = {'error': str(e)}
        
        return debug_info
    
    def run(self, port=40017, debug=False, open_browser=True):
        """Run the web application"""
        print(f"Starting Flutter Icons Web Visualization System...")
        print(f"Server will start on http://localhost:{port}")
        
        # Open browser after a short delay
        if open_browser:
            def open_browser_delayed():
                import time
                time.sleep(1.5)  # Wait for server to start
                webbrowser.open(f'http://localhost:{port}')
            
            threading.Thread(target=open_browser_delayed, daemon=True).start()
        
        # Initial scan
        self.scan_platform_images()
        
        # Start Flask app
        self.app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=False)

def main():
    """Main function"""
    print("Starting Flutter Icons Web Visualization System...")
    
    try:
        app = FlutterIconsWebApp()
        app.run(port=40017, debug=False, open_browser=True)
    except Exception as e:
        print(f"Error starting web application: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()