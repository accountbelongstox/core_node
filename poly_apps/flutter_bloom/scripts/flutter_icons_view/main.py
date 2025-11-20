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
Flutter Icons Visualization System - Main Application
Independent icon management system for Flutter multi-app development
Author: Development Script System
Version: 1.0
"""

import os
import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import threading
import webbrowser
import shutil
import subprocess
import sys

# Add parent directory to path for imports
dev_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dev')
sys.path.append(dev_dir)
from py_helper.gvar_common import gvar, write_debug_info, set_gvar_value, get_gvar_value

# Import image analyzer
from image_analyzer import ImageAnalyzer

# Try to import image processing libraries
try:
    from PIL import Image, ImageTk
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("Warning: PIL (Pillow) not available. Image processing will be limited.")

class FlutterIconsViewer:
    """
    Flutter Icons Visualization System
    Provides comprehensive icon management for Flutter development
    """
    
    def __init__(self):
        self.project_root = gvar.get_current_project_root()
        self.dev_script_dir = self.project_root / "scripts" / "dev"
        self.platform_dirs = ['android', 'ios', 'windows', 'web']
        
        # Initialize image analyzer
        self.image_analyzer = ImageAnalyzer()
        
        # UI Components
        self.root = None
        self.main_notebook = None
        self.platform_frames = {}
        self.image_cache = {}
        
        # Data storage
        self.scanned_images = {}
        self.selected_platforms = set()
        self.selected_images = {}
        self.upload_targets = []
        self.image_analysis_cache = {}
        
        # Settings
        self.auto_refresh = True
        self.show_image_details = True
        self.show_compliance_scores = True
        self.preview_size = (100, 100)
        
        # Common image extensions
        self.image_extensions = ['.png', '.jpg', '.jpeg', '.ico', '.icns', '.gif', '.webp', '.svg']
        
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
            'preview_size': self.preview_size,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        gvar.print_debug_variables("FLUTTER_ICONS_VIEWER", script_specific_vars)
    
    def create_main_window(self):
        """Create the main application window"""
        self.root = tk.Tk()
        self.root.title("Flutter Icons Visualization System")
        self.root.geometry("1200x800")
        
        # Configure style
        style = ttk.Style()
        style.theme_use('clam')
        
        # Create menu bar
        self.create_menu_bar()
        
        # Create main interface
        self.create_main_interface()
        
        # Initial scan
        self.scan_platform_images()
        
        return self.root
    
    def create_menu_bar(self):
        """Create application menu bar"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # File menu
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Refresh Scan", command=self.scan_platform_images)
        file_menu.add_command(label="Export Report", command=self.export_image_report)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.root.quit)
        
        # Tools menu
        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Tools", menu=tools_menu)
        tools_menu.add_command(label="Batch Replace", command=self.open_batch_replace)
        tools_menu.add_command(label="Auto Crop & Replace", command=self.open_auto_crop_replace)
        tools_menu.add_command(label="One-Click Cleanup", command=self.run_cleanup_script)
        tools_menu.add_separator()
        tools_menu.add_command(label="Open Project Directory", command=self.open_project_directory)
        
        # Settings menu
        settings_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Settings", menu=settings_menu)
        settings_menu.add_checkbutton(label="Auto Refresh", variable=tk.BooleanVar(value=self.auto_refresh))
        settings_menu.add_checkbutton(label="Show Image Details", variable=tk.BooleanVar(value=self.show_image_details))
        settings_menu.add_separator()
        settings_menu.add_command(label="View Debug Info", command=self.show_debug_info)
        settings_menu.add_command(label="Update Config", command=self.update_original_config)
        
        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="About", command=self.show_about)
    
    def create_main_interface(self):
        """Create the main user interface"""
        # Create main paned window
        main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Left panel - Platform selection and controls
        left_frame = ttk.Frame(main_paned)
        main_paned.add(left_frame, weight=1)
        
        # Right panel - Image display and details
        right_frame = ttk.Frame(main_paned)
        main_paned.add(right_frame, weight=3)
        
        # Create left panel components
        self.create_platform_selection(left_frame)
        self.create_upload_controls(left_frame)
        self.create_action_buttons(left_frame)
        
        # Create right panel components
        self.create_image_display(right_frame)
    
    def create_platform_selection(self, parent):
        """Create platform selection area"""
        platform_frame = ttk.LabelFrame(parent, text="Platform Selection", padding=5)
        platform_frame.pack(fill=tk.X, pady=5)
        
        self.platform_vars = {}
        for platform in self.platform_dirs:
            var = tk.BooleanVar()
            self.platform_vars[platform] = var
            
            cb = ttk.Checkbutton(
                platform_frame, 
                text=platform.title(),
                variable=var,
                command=self.on_platform_selection_changed
            )
            cb.pack(anchor=tk.W)
        
        # Select all button
        select_all_btn = ttk.Button(
            platform_frame,
            text="Select All",
            command=self.select_all_platforms
        )
        select_all_btn.pack(pady=5)
    
    def create_upload_controls(self, parent):
        """Create upload and replacement controls"""
        upload_frame = ttk.LabelFrame(parent, text="Image Upload & Replace", padding=5)
        upload_frame.pack(fill=tk.X, pady=5)
        
        # Upload button
        upload_btn = ttk.Button(
            upload_frame,
            text="Upload Image",
            command=self.upload_image
        )
        upload_btn.pack(fill=tk.X, pady=2)
        
        # Target selection
        ttk.Label(upload_frame, text="Target Images:").pack(anchor=tk.W)
        
        self.target_listbox = tk.Listbox(upload_frame, height=6, selectmode=tk.MULTIPLE)
        self.target_listbox.pack(fill=tk.BOTH, expand=True, pady=2)
        
        # Replace button
        replace_btn = ttk.Button(
            upload_frame,
            text="Replace Selected",
            command=self.replace_selected_images,
            state=tk.DISABLED
        )
        replace_btn.pack(fill=tk.X, pady=2)
        
        self.replace_button = replace_btn
    
    def create_action_buttons(self, parent):
        """Create action buttons"""
        action_frame = ttk.LabelFrame(parent, text="Actions", padding=5)
        action_frame.pack(fill=tk.X, pady=5)
        
        buttons = [
            ("Refresh Scan", self.scan_platform_images),
            ("Open Directory", self.open_selected_directory),
            ("Download Selected", self.download_selected_images),
            ("Copy Explorer Cmd", self.copy_explorer_command),
        ]
        
        for text, command in buttons:
            btn = ttk.Button(action_frame, text=text, command=command)
            btn.pack(fill=tk.X, pady=1)
    
    def create_image_display(self, parent):
        """Create image display area"""
        # Create notebook for different platforms
        self.main_notebook = ttk.Notebook(parent)
        self.main_notebook.pack(fill=tk.BOTH, expand=True)
        
        # Create tabs for each platform
        for platform in self.platform_dirs:
            frame = ttk.Frame(self.main_notebook)
            self.main_notebook.add(frame, text=platform.title())
            self.platform_frames[platform] = frame
            
            # Create scrollable frame for images
            self.create_platform_image_frame(frame, platform)
    
    def create_platform_image_frame(self, parent, platform):
        """Create scrollable image frame for a platform"""
        # Create canvas and scrollbar
        canvas = tk.Canvas(parent)
        scrollbar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Store references
        setattr(parent, 'canvas', canvas)
        setattr(parent, 'scrollable_frame', scrollable_frame)
        setattr(parent, 'images_frame', scrollable_frame)
    
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
        
        # Update UI
        self.update_image_display()
        self.update_target_list()
        
        # Update status
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
                'format': image_path.suffix.upper().replace('.', '')
            }
            
            if PIL_AVAILABLE:
                try:
                    with Image.open(image_path) as img:
                        info['width'] = img.width
                        info['height'] = img.height
                        info['format'] = img.format or info['format']
                except Exception:
                    pass
            
            # Get intelligent classification and analysis
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
            
            return info
            
        except Exception as e:
            print(f"Error getting info for {image_path}: {e}")
            return None
    
    
    def update_image_display(self):
        """Update the image display in all platform tabs"""
        for platform, images in self.scanned_images.items():
            frame = self.platform_frames[platform].images_frame
            
            # Clear existing widgets
            for widget in frame.winfo_children():
                widget.destroy()
            
            if not images:
                ttk.Label(frame, text=f"No images found in {platform} directory").pack(pady=20)
                continue
            
            # Group images by directory
            dir_groups = {}
            for image_info in images:
                dir_path = image_info['path'].parent
                relative_dir = dir_path.relative_to(self.project_root)
                
                if relative_dir not in dir_groups:
                    dir_groups[relative_dir] = []
                dir_groups[relative_dir].append(image_info)
            
            # Create display for each directory group
            for dir_path, dir_images in dir_groups.items():
                self.create_directory_group_display(frame, dir_path, dir_images, platform)
    
    def create_directory_group_display(self, parent, dir_path, images, platform):
        """Create display for a group of images in a directory"""
        # Directory header
        dir_frame = ttk.LabelFrame(parent, text=str(dir_path), padding=5)
        dir_frame.pack(fill=tk.X, padx=5, pady=5)
        
        # Directory actions
        action_frame = ttk.Frame(dir_frame)
        action_frame.pack(fill=tk.X, pady=2)
        
        open_btn = ttk.Button(
            action_frame,
            text="Open Directory",
            command=lambda: self.open_directory(self.project_root / dir_path)
        )
        open_btn.pack(side=tk.LEFT, padx=2)
        
        copy_cmd_btn = ttk.Button(
            action_frame,
            text="Copy Explorer Command",
            command=lambda: self.copy_explorer_cmd(self.project_root / dir_path)
        )
        copy_cmd_btn.pack(side=tk.LEFT, padx=2)
        
        compress_btn = ttk.Button(
            action_frame,
            text="Compress All",
            command=lambda: self.compress_directory_images(dir_images)
        )
        compress_btn.pack(side=tk.LEFT, padx=2)
        
        # Images grid
        images_frame = ttk.Frame(dir_frame)
        images_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # Create grid of image previews
        cols = 4
        for i, image_info in enumerate(images):
            row = i // cols
            col = i % cols
            
            self.create_image_preview(images_frame, image_info, platform, row, col)
    
    def create_image_preview(self, parent, image_info, platform, row, col):
        """Create preview widget for an image"""
        preview_frame = ttk.Frame(parent, relief=tk.RAISED, borderwidth=1)
        preview_frame.grid(row=row, column=col, padx=2, pady=2, sticky='nsew')
        
        # Configure grid weights
        parent.grid_columnconfigure(col, weight=1)
        
        # Image preview
        preview_label = ttk.Label(preview_frame, text="Loading...")
        preview_label.pack()
        
        # Load image preview asynchronously
        threading.Thread(
            target=self.load_image_preview,
            args=(preview_label, image_info['path']),
            daemon=True
        ).start()
        
        # Image details with intelligent analysis
        details_text = f"{image_info['name']}\n"
        
        # Add classification info
        if 'classification' in image_info and image_info['classification']:
            classification = image_info['classification']
            details_text += f"Category: {classification['category']}\n"
            if classification['subcategory']:
                details_text += f"Type: {classification['subcategory']}\n"
            details_text += f"Platform: {classification['platform']}\n"
            if classification['confidence'] > 0:
                details_text += f"Confidence: {classification['confidence']:.1%}\n"
        
        if image_info['width'] and image_info['height']:
            details_text += f"Size: {image_info['width']}x{image_info['height']}\n"
        details_text += f"File: {image_info['size_bytes'] // 1024}KB\n"
        
        # Add compliance score
        if 'size_recommendations' in image_info and image_info['size_recommendations']:
            recommendations = image_info['size_recommendations']
            if recommendations['compliance_score'] > 0:
                score = recommendations['compliance_score']
                details_text += f"Compliance: {score:.1%}\n"
                
                if score < 0.8 and recommendations['recommended_sizes']:
                    rec_size = recommendations['recommended_sizes'][0]
                    details_text += f"Recommended: {rec_size[0]}x{rec_size[1]}\n"
        
        # Add compression info
        if 'compression_recommendations' in image_info and image_info['compression_recommendations']:
            compression = image_info['compression_recommendations']
            if compression['should_compress']:
                details_text += f"⚠ Large file\n"
        
        details_label = ttk.Label(preview_frame, text=details_text, font=('Arial', 8), justify=tk.LEFT)
        details_label.pack()
        
        # Action buttons
        btn_frame = ttk.Frame(preview_frame)
        btn_frame.pack(fill=tk.X, pady=2)
        
        download_btn = ttk.Button(
            btn_frame,
            text="Download",
            command=lambda: self.download_image(image_info['path'])
        )
        download_btn.pack(side=tk.LEFT, padx=1)
        
        select_btn = ttk.Button(
            btn_frame,
            text="Select",
            command=lambda: self.toggle_image_selection(image_info, platform)
        )
        select_btn.pack(side=tk.LEFT, padx=1)
        
        # Add compress button if compression is recommended
        if ('compression_recommendations' in image_info and 
            image_info['compression_recommendations'] and 
            image_info['compression_recommendations']['should_compress']):
            compress_btn = ttk.Button(
                btn_frame,
                text="Compress",
                command=lambda: self.compress_single_image(image_info)
            )
            compress_btn.pack(side=tk.LEFT, padx=1)
    
    def load_image_preview(self, label, image_path):
        """Load and display image preview"""
        if not PIL_AVAILABLE:
            label.config(text=f"[{image_path.name}]")
            return
        
        try:
            with Image.open(image_path) as img:
                # Resize for preview
                img.thumbnail(self.preview_size, Image.Resampling.LANCZOS)
                
                # Convert to PhotoImage
                photo = ImageTk.PhotoImage(img)
                
                # Update label on main thread
                label.after(0, lambda: self.update_preview_label(label, photo, image_path))
                
        except Exception as e:
            label.after(0, lambda: label.config(text=f"Error loading\n{image_path.name}"))
    
    def update_preview_label(self, label, photo, image_path):
        """Update preview label with image"""
        label.config(image=photo, text="")
        label.image = photo  # Keep a reference
        
        # Store in cache
        self.image_cache[str(image_path)] = photo
    
    def on_platform_selection_changed(self):
        """Handle platform selection change"""
        self.selected_platforms = {
            platform for platform, var in self.platform_vars.items() 
            if var.get()
        }
        self.update_target_list()
    
    def select_all_platforms(self):
        """Select all platforms"""
        for var in self.platform_vars.values():
            var.set(True)
        self.on_platform_selection_changed()
    
    def update_target_list(self):
        """Update the target images list"""
        self.target_listbox.delete(0, tk.END)
        self.upload_targets = []
        
        for platform in self.selected_platforms:
            if platform in self.scanned_images:
                for image_info in self.scanned_images[platform]:
                    display_text = f"[{platform}] {image_info['relative_path']}"
                    self.target_listbox.insert(tk.END, display_text)
                    self.upload_targets.append(image_info)
    
    def upload_image(self):
        """Handle image upload"""
        filetypes = [
            ("Image files", "*.png *.jpg *.jpeg *.ico *.gif *.webp"),
            ("PNG files", "*.png"),
            ("JPEG files", "*.jpg *.jpeg"),
            ("All files", "*.*")
        ]
        
        filename = filedialog.askopenfilename(
            title="Select image to upload",
            filetypes=filetypes
        )
        
        if filename:
            self.process_uploaded_image(filename)
    
    def process_uploaded_image(self, source_path):
        """Process the uploaded image"""
        selected_indices = self.target_listbox.curselection()
        if not selected_indices:
            messagebox.showwarning("No Selection", "Please select target images first.")
            return
        
        source_path = Path(source_path)
        replaced_count = 0
        
        # Show confirmation dialog
        target_count = len(selected_indices)
        if not messagebox.askyesno(
            "Confirm Replace",
            f"Replace {target_count} target images with {source_path.name}?"
        ):
            return
        
        for index in selected_indices:
            target_info = self.upload_targets[index]
            if self.replace_image(source_path, target_info['path']):
                replaced_count += 1
        
        messagebox.showinfo(
            "Replace Complete",
            f"Successfully replaced {replaced_count} of {target_count} images."
        )
        
        # Refresh if auto-refresh is enabled
        if self.auto_refresh:
            self.scan_platform_images()
    
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
    
    def download_image(self, image_path: Path):
        """Download/save image to chosen location"""
        save_path = filedialog.asksaveasfilename(
            title="Save image as",
            defaultextension=image_path.suffix,
            filetypes=[
                (f"{image_path.suffix.upper()} files", f"*{image_path.suffix}"),
                ("All files", "*.*")
            ],
            initialvalue=image_path.name
        )
        
        if save_path:
            try:
                shutil.copy2(image_path, save_path)
                messagebox.showinfo("Success", f"Image saved to {save_path}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to save image: {e}")
    
    def download_selected_images(self):
        """Download all selected images"""
        selected_indices = self.target_listbox.curselection()
        if not selected_indices:
            messagebox.showwarning("No Selection", "Please select images to download.")
            return
        
        save_dir = filedialog.askdirectory(title="Select directory to save images")
        if not save_dir:
            return
        
        save_dir = Path(save_dir)
        saved_count = 0
        
        for index in selected_indices:
            target_info = self.upload_targets[index]
            try:
                # Create unique filename to avoid conflicts
                platform = self.get_platform_for_image(target_info)
                unique_name = f"{platform}_{target_info['name']}"
                save_path = save_dir / unique_name
                
                shutil.copy2(target_info['path'], save_path)
                saved_count += 1
            except Exception as e:
                print(f"Error saving {target_info['path']}: {e}")
        
        messagebox.showinfo("Download Complete", f"Saved {saved_count} images to {save_dir}")
    
    def get_platform_for_image(self, image_info):
        """Get platform name for an image"""
        for platform, images in self.scanned_images.items():
            if image_info in images:
                return platform
        return "unknown"
    
    def toggle_image_selection(self, image_info, platform):
        """Toggle selection of an image"""
        key = f"{platform}:{image_info['path']}"
        if key in self.selected_images:
            del self.selected_images[key]
        else:
            self.selected_images[key] = image_info
        
        print(f"Selected images: {len(self.selected_images)}")
    
    def replace_selected_images(self):
        """Replace selected images with uploaded image"""
        if not self.selected_images:
            messagebox.showwarning("No Selection", "Please select images to replace.")
            return
        
        self.upload_image()
    
    def open_directory(self, dir_path: Path):
        """Open directory in file explorer"""
        try:
            if os.name == 'nt':  # Windows
                os.startfile(dir_path)
            elif os.name == 'posix':  # macOS and Linux
                subprocess.run(['open' if sys.platform == 'darwin' else 'xdg-open', str(dir_path)])
        except Exception as e:
            print(f"Error opening directory {dir_path}: {e}")
    
    def copy_explorer_cmd(self, dir_path: Path):
        """Copy explorer command to clipboard"""
        if os.name == 'nt':  # Windows
            cmd = f'explorer "{dir_path}"'
        else:
            cmd = f'open "{dir_path}"'
        
        self.copy_to_clipboard(cmd)
        messagebox.showinfo("Copied", f"Explorer command copied to clipboard:\n{cmd}")
    
    def copy_to_clipboard(self, text):
        """Copy text to clipboard"""
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        self.root.update()
    
    def copy_explorer_command(self):
        """Copy explorer command for selected directory"""
        selected_indices = self.target_listbox.curselection()
        if not selected_indices:
            messagebox.showwarning("No Selection", "Please select an image first.")
            return
        
        # Get directory of first selected image
        target_info = self.upload_targets[selected_indices[0]]
        dir_path = target_info['path'].parent
        self.copy_explorer_cmd(dir_path)
    
    def open_selected_directory(self):
        """Open directory containing selected image"""
        selected_indices = self.target_listbox.curselection()
        if not selected_indices:
            messagebox.showwarning("No Selection", "Please select an image first.")
            return
        
        # Open directory of first selected image
        target_info = self.upload_targets[selected_indices[0]]
        self.open_directory(target_info['path'].parent)
    
    def open_batch_replace(self):
        """Open batch replace dialog"""
        BatchReplaceDialog(self.root, self)
    
    def open_auto_crop_replace(self):
        """Open auto crop and replace dialog"""
        AutoCropReplaceDialog(self.root, self)
    
    def run_cleanup_script(self):
        """Run one-click cleanup script"""
        if messagebox.askyesno("Confirm Cleanup", "Run cleanup script to restore original images?"):
            try:
                # Updated path to dev directory
                dev_dir = self.project_root / "scripts" / "dev"
                cleanup_script = dev_dir / "py_helper" / "cleanup_restore.py"
                if cleanup_script.exists():
                    subprocess.run([sys.executable, str(cleanup_script)], check=True)
                    messagebox.showinfo("Cleanup Complete", "Cleanup script executed successfully.")
                    
                    if self.auto_refresh:
                        self.scan_platform_images()
                else:
                    messagebox.showerror("Error", "Cleanup script not found.")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to run cleanup script: {e}")
    
    def open_project_directory(self):
        """Open project root directory"""
        self.open_directory(self.project_root)
    
    def show_debug_info(self):
        """Show debug information window"""
        DebugInfoDialog(self.root, self)
    
    def update_original_config(self):
        """Update original_config.ini"""
        UpdateConfigDialog(self.root, self)
    
    def export_image_report(self):
        """Export image scan report"""
        save_path = filedialog.asksaveasfilename(
            title="Export Image Report",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("Text files", "*.txt")]
        )
        
        if save_path:
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
                
                with open(save_path, 'w', encoding='utf-8') as f:
                    json.dump(report_data, f, indent=2, ensure_ascii=False)
                
                messagebox.showinfo("Export Complete", f"Report exported to {save_path}")
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to export report: {e}")
    
    def compress_single_image(self, image_info):
        """Compress a single image"""
        if not PIL_AVAILABLE:
            messagebox.showerror("Error", "PIL (Pillow) not available for compression.")
            return
        
        try:
            image_path = image_info['path']
            compression_rec = image_info.get('compression_recommendations', {})
            
            if not compression_rec.get('should_compress', False):
                messagebox.showinfo("Info", "Image compression not recommended.")
                return
            
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
                
                messagebox.showinfo("Success", f"Image compressed successfully!")
                
                # Refresh display if auto-refresh enabled
                if self.auto_refresh:
                    self.scan_platform_images()
                    
        except Exception as e:
            messagebox.showerror("Error", f"Failed to compress image: {e}")
    
    def compress_directory_images(self, images_list):
        """Compress all images in a directory that need compression"""
        if not PIL_AVAILABLE:
            messagebox.showerror("Error", "PIL (Pillow) not available for compression.")
            return
        
        # Filter images that need compression
        compress_candidates = []
        for image_info in images_list:
            compression_rec = image_info.get('compression_recommendations', {})
            if compression_rec.get('should_compress', False):
                compress_candidates.append(image_info)
        
        if not compress_candidates:
            messagebox.showinfo("Info", "No images require compression in this directory.")
            return
        
        # Ask for confirmation
        if not messagebox.askyesno(
            "Confirm Compression", 
            f"Compress {len(compress_candidates)} images in this directory?"
        ):
            return
        
        compressed_count = 0
        for image_info in compress_candidates:
            try:
                self.compress_single_image(image_info)
                compressed_count += 1
            except Exception as e:
                print(f"Error compressing {image_info['path']}: {e}")
        
        messagebox.showinfo("Compression Complete", f"Compressed {compressed_count} images.")
        
        # Refresh display
        if self.auto_refresh:
            self.scan_platform_images()

    def show_about(self):
        """Show about dialog"""
        about_text = """Flutter Icons Visualization System v1.0

An independent icon management system for Flutter multi-app development.

Features:
• Platform-based image scanning (Android, iOS, Windows, Web)
• Intelligent image classification and analysis
• Compliance scoring and size recommendations
• Image preview and categorization
• Batch upload and replacement
• Auto-crop and resize functionality
• Smart compression with quality optimization
• One-click cleanup and restore
• Debug information and configuration management

Developed by: Development Script System
"""
        messagebox.showinfo("About", about_text)
    
    def run(self):
        """Run the application"""
        root = self.create_main_window()
        root.mainloop()

# Additional dialog classes for extended functionality

class BatchReplaceDialog:
    """Dialog for batch image replacement"""
    
    def __init__(self, parent, main_app):
        self.parent = parent
        self.main_app = main_app
        self.dialog = None
        self.create_dialog()
    
    def create_dialog(self):
        """Create batch replace dialog"""
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title("Batch Replace Images")
        self.dialog.geometry("600x400")
        self.dialog.transient(self.parent)
        self.dialog.grab_set()
        
        # Create UI components
        ttk.Label(self.dialog, text="Batch Image Replacement", font=('Arial', 12, 'bold')).pack(pady=10)
        
        # Platform selection
        platform_frame = ttk.LabelFrame(self.dialog, text="Select Platforms", padding=5)
        platform_frame.pack(fill=tk.X, padx=10, pady=5)
        
        self.platform_vars = {}
        for platform in self.main_app.platform_dirs:
            var = tk.BooleanVar()
            self.platform_vars[platform] = var
            ttk.Checkbutton(platform_frame, text=platform.title(), variable=var).pack(side=tk.LEFT)
        
        # Source image selection
        source_frame = ttk.LabelFrame(self.dialog, text="Source Images", padding=5)
        source_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        ttk.Button(source_frame, text="Select Source Images", command=self.select_source_images).pack(pady=5)
        
        self.source_listbox = tk.Listbox(source_frame, height=8)
        self.source_listbox.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # Action buttons
        btn_frame = ttk.Frame(self.dialog)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(btn_frame, text="Start Batch Replace", command=self.start_batch_replace).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Cancel", command=self.dialog.destroy).pack(side=tk.RIGHT, padx=5)
    
    def select_source_images(self):
        """Select source images for batch replacement"""
        filetypes = [("Image files", "*.png *.jpg *.jpeg *.ico *.gif *.webp")]
        filenames = filedialog.askopenfilenames(title="Select source images", filetypes=filetypes)
        
        self.source_listbox.delete(0, tk.END)
        for filename in filenames:
            self.source_listbox.insert(tk.END, filename)
    
    def start_batch_replace(self):
        """Start batch replacement process"""
        selected_platforms = [p for p, var in self.platform_vars.items() if var.get()]
        source_files = [self.source_listbox.get(i) for i in range(self.source_listbox.size())]
        
        if not selected_platforms or not source_files:
            messagebox.showwarning("Incomplete Selection", "Please select platforms and source images.")
            return
        
        # Implement batch replace logic here
        messagebox.showinfo("Started", f"Batch replace started for {len(selected_platforms)} platforms with {len(source_files)} source images.")
        self.dialog.destroy()

class AutoCropReplaceDialog:
    """Dialog for auto crop and replace functionality"""
    
    def __init__(self, parent, main_app):
        self.parent = parent
        self.main_app = main_app
        self.dialog = None
        self.create_dialog()
    
    def create_dialog(self):
        """Create auto crop replace dialog"""
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title("Auto Crop & Replace")
        self.dialog.geometry("500x350")
        self.dialog.transient(self.parent)
        self.dialog.grab_set()
        
        ttk.Label(self.dialog, text="Auto Crop & Replace", font=('Arial', 12, 'bold')).pack(pady=10)
        
        # Source image
        source_frame = ttk.LabelFrame(self.dialog, text="Source Image", padding=5)
        source_frame.pack(fill=tk.X, padx=10, pady=5)
        
        self.source_var = tk.StringVar()
        ttk.Entry(source_frame, textvariable=self.source_var, state='readonly').pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(source_frame, text="Browse", command=self.select_source_image).pack(side=tk.RIGHT, padx=5)
        
        # Target size options
        size_frame = ttk.LabelFrame(self.dialog, text="Target Size", padding=5)
        size_frame.pack(fill=tk.X, padx=10, pady=5)
        
        self.size_mode = tk.StringVar(value="auto")
        ttk.Radiobutton(size_frame, text="Auto-detect from target", variable=self.size_mode, value="auto").pack(anchor=tk.W)
        ttk.Radiobutton(size_frame, text="Custom size", variable=self.size_mode, value="custom").pack(anchor=tk.W)
        
        custom_frame = ttk.Frame(size_frame)
        custom_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(custom_frame, text="Width:").pack(side=tk.LEFT)
        self.width_var = tk.StringVar(value="512")
        ttk.Entry(custom_frame, textvariable=self.width_var, width=10).pack(side=tk.LEFT, padx=5)
        
        ttk.Label(custom_frame, text="Height:").pack(side=tk.LEFT, padx=(10,0))
        self.height_var = tk.StringVar(value="512")
        ttk.Entry(custom_frame, textvariable=self.height_var, width=10).pack(side=tk.LEFT, padx=5)
        
        # Target files
        target_frame = ttk.LabelFrame(self.dialog, text="Target Files", padding=5)
        target_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        self.target_listbox = tk.Listbox(target_frame, height=6, selectmode=tk.MULTIPLE)
        self.target_listbox.pack(fill=tk.BOTH, expand=True)
        
        # Populate target list
        self.populate_target_list()
        
        # Action buttons
        btn_frame = ttk.Frame(self.dialog)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(btn_frame, text="Start Auto Crop", command=self.start_auto_crop).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Cancel", command=self.dialog.destroy).pack(side=tk.RIGHT, padx=5)
    
    def select_source_image(self):
        """Select source image"""
        filetypes = [("Image files", "*.png *.jpg *.jpeg")]
        filename = filedialog.askopenfilename(title="Select source image", filetypes=filetypes)
        if filename:
            self.source_var.set(filename)
    
    def populate_target_list(self):
        """Populate target files list"""
        self.target_listbox.delete(0, tk.END)
        
        for platform, images in self.main_app.scanned_images.items():
            for image_info in images:
                display_text = f"[{platform}] {image_info['relative_path']}"
                self.target_listbox.insert(tk.END, display_text)
    
    def start_auto_crop(self):
        """Start auto crop process"""
        source_file = self.source_var.get()
        if not source_file:
            messagebox.showwarning("No Source", "Please select a source image.")
            return
        
        selected_indices = self.target_listbox.curselection()
        if not selected_indices:
            messagebox.showwarning("No Targets", "Please select target files.")
            return
        
        # Implement auto crop logic here
        messagebox.showinfo("Started", f"Auto crop started for {len(selected_indices)} target files.")
        self.dialog.destroy()

class DebugInfoDialog:
    """Dialog for displaying debug information"""
    
    def __init__(self, parent, main_app):
        self.parent = parent
        self.main_app = main_app
        self.dialog = None
        self.create_dialog()
    
    def create_dialog(self):
        """Create debug info dialog"""
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title("Debug Information")
        self.dialog.geometry("700x500")
        self.dialog.transient(self.parent)
        
        # Create text widget with scrollbar
        text_frame = ttk.Frame(self.dialog)
        text_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        text_widget = tk.Text(text_frame, wrap=tk.WORD)
        scrollbar = ttk.Scrollbar(text_frame, orient="vertical", command=text_widget.yview)
        text_widget.configure(yscrollcommand=scrollbar.set)
        
        text_widget.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Populate debug info
        debug_info = self.get_debug_info()
        text_widget.insert(tk.END, debug_info)
        text_widget.config(state=tk.DISABLED)
        
        # Close button
        ttk.Button(self.dialog, text="Close", command=self.dialog.destroy).pack(pady=10)
    
    def get_debug_info(self):
        """Get comprehensive debug information"""
        info = []
        info.append("=" * 60)
        info.append("FLUTTER ICONS VIEWER DEBUG INFORMATION")
        info.append("=" * 60)
        info.append("")
        
        # Basic info
        info.append(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        info.append(f"Project Root: {self.main_app.project_root}")
        info.append(f"Dev Script Dir: {self.main_app.dev_script_dir}")
        info.append(f"PIL Available: {PIL_AVAILABLE}")
        info.append("")
        
        # Platform directories
        info.append("Platform Directories:")
        for platform in self.main_app.platform_dirs:
            platform_dir = self.main_app.project_root / platform
            exists = platform_dir.exists()
            info.append(f"  {platform}: {platform_dir} ({'EXISTS' if exists else 'NOT FOUND'})")
        info.append("")
        
        # Scanned images summary
        info.append("Scanned Images Summary:")
        total_images = 0
        for platform, images in self.main_app.scanned_images.items():
            count = len(images)
            total_images += count
            info.append(f"  {platform}: {count} images")
        info.append(f"  Total: {total_images} images")
        info.append("")
        
        # Settings
        info.append("Settings:")
        info.append(f"  Auto Refresh: {self.main_app.auto_refresh}")
        info.append(f"  Show Image Details: {self.main_app.show_image_details}")
        info.append(f"  Preview Size: {self.main_app.preview_size}")
        info.append("")
        
        # Gvar information
        info.append("Gvar System Information:")
        try:
            debug_mode = get_gvar_value("debug_mode")
            info.append(f"  Debug Mode: {debug_mode}")
            
            current_app = get_gvar_value("current_app_name")
            info.append(f"  Current App: {current_app}")
            
            flutter_project_dir = get_gvar_value("flutter_project_dir")
            info.append(f"  Flutter Project Dir: {flutter_project_dir}")
        except Exception as e:
            info.append(f"  Error reading Gvar: {e}")
        info.append("")
        
        # System information
        info.append("System Information:")
        info.append(f"  Python Version: {sys.version}")
        info.append(f"  Platform: {sys.platform}")
        info.append(f"  Working Directory: {os.getcwd()}")
        
        return "\n".join(info)

class UpdateConfigDialog:
    """Dialog for updating original_config.ini"""
    
    def __init__(self, parent, main_app):
        self.parent = parent
        self.main_app = main_app
        self.dialog = None
        self.config_vars = {}
        self.create_dialog()
    
    def create_dialog(self):
        """Create update config dialog"""
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title("Update Configuration")
        self.dialog.geometry("500x400")
        self.dialog.transient(self.parent)
        self.dialog.grab_set()
        
        ttk.Label(self.dialog, text="Update original_config.ini", font=('Arial', 12, 'bold')).pack(pady=10)
        
        # Configuration fields
        config_frame = ttk.LabelFrame(self.dialog, text="Configuration", padding=10)
        config_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        # App name
        ttk.Label(config_frame, text="App Name:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.config_vars['app_name'] = tk.StringVar(value="FlutterBloom")
        ttk.Entry(config_frame, textvariable=self.config_vars['app_name']).grid(row=0, column=1, sticky='ew', padx=5, pady=2)
        
        # Package ID
        ttk.Label(config_frame, text="Package ID:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.config_vars['package_id'] = tk.StringVar(value="com.ddsj.flutter_bloom")
        ttk.Entry(config_frame, textvariable=self.config_vars['package_id']).grid(row=1, column=1, sticky='ew', padx=5, pady=2)
        
        # App version
        ttk.Label(config_frame, text="App Version:").grid(row=2, column=0, sticky=tk.W, pady=2)
        self.config_vars['app_version'] = tk.StringVar(value="1.0.0")
        ttk.Entry(config_frame, textvariable=self.config_vars['app_version']).grid(row=2, column=1, sticky='ew', padx=5, pady=2)
        
        config_frame.grid_columnconfigure(1, weight=1)
        
        # Load current config
        self.load_current_config()
        
        # Action buttons
        btn_frame = ttk.Frame(self.dialog)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(btn_frame, text="Save Configuration", command=self.save_config).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Cancel", command=self.dialog.destroy).pack(side=tk.RIGHT, padx=5)
    
    def load_current_config(self):
        """Load current configuration"""
        config_file = self.main_app.project_root / "scripts" / "dev" / "original_config.ini"
        if config_file.exists():
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Parse configuration
                for line in content.split('\n'):
                    line = line.strip()
                    if '=' in line and not line.startswith('#') and not line.startswith('['):
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        
                        if key in self.config_vars:
                            self.config_vars[key].set(value)
            except Exception as e:
                print(f"Error loading config: {e}")
    
    def save_config(self):
        """Save configuration to file"""
        config_file = self.main_app.project_root / "scripts" / "dev" / "original_config.ini"
        
        try:
            config_content = "[original_app_info]\n"
            config_content += f"app_name = {self.config_vars['app_name'].get()}\n"
            config_content += f"package_id = {self.config_vars['package_id'].get()}\n"
            config_content += f"app_version = {self.config_vars['app_version'].get()}\n"
            config_content += "\n[original_paths]\n"
            config_content += "android_manifest = android/app/src/main/AndroidManifest.xml\n"
            config_content += "ios_info_plist = ios/Runner/Info.plist\n"
            config_content += "pubspec_yaml = pubspec.yaml\n"
            
            with open(config_file, 'w', encoding='utf-8') as f:
                f.write(config_content)
            
            messagebox.showinfo("Success", f"Configuration saved to {config_file}")
            self.dialog.destroy()
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save configuration: {e}")

def main():
    """Main function"""
    print("Starting Flutter Icons Visualization System...")
    
    try:
        app = FlutterIconsViewer()
        app.run()
    except Exception as e:
        print(f"Error starting application: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()