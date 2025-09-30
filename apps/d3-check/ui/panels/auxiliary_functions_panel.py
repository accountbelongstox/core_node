#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auxiliary Functions Panel (TABLE2)
Contains auxiliary functions with image display areas
"""

import tkinter as tk
from tkinter import ttk, messagebox
import sys
import os
from typing import Optional, Callable
from PIL import Image, ImageTk

# Add ncore path for color_print
ncore_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "ncore")
sys.path.insert(0, ncore_path)
from pytools.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG, save_config


class AuxiliaryFunctionsPanel:
    """Auxiliary functions panel for TABLE2"""
    
    def __init__(self, parent):
        self.parent = parent
        
        # Callbacks
        self.on_config_change: Optional[Callable] = None
        
        # Image display areas
        self.image_labels = {}
        self.image_paths = {}
        
        self._create_panel()
    
    def _create_panel(self):
        """Create the auxiliary functions panel"""
        # Main content frame with better spacing
        content_frame = ttk.Frame(self.parent)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Left side - Bag offset and image display areas
        self._create_bag_offset_and_image_area(content_frame)
        
        # Right side - Auxiliary functions
        self._create_auxiliary_functions_area(content_frame)
    
    def _create_bag_offset_and_image_area(self, parent):
        """Create bag offset and image display areas"""
        combined_frame = ttk.LabelFrame(parent, text="背包校正与图像显示", padding=10)
        combined_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        # Bag offset controls at the top
        self._create_bag_offset_controls(combined_frame)
        
        # Separator
        separator = ttk.Separator(combined_frame, orient='horizontal')
        separator.pack(fill=tk.X, pady=10)
        
        # Image display areas below
        self._create_image_display_area(combined_frame)
    
    def _create_image_display_area(self, parent):
        """Create image display areas"""
        image_frame = ttk.LabelFrame(parent, text="图像显示区域", padding=5)
        image_frame.pack(fill=tk.BOTH, expand=True)
        
        # Create 5 image display areas
        for i in range(1, 6):
            self._create_single_image_area(image_frame, i)
    
    def _create_single_image_area(self, parent, index):
        """Create a single image display area"""
        # Special title for first image area (bag position correction)
        if index == 1:
            title = "背包位置校正图"
        else:
            title = f"图像区域 {index}"
            
        area_frame = ttk.LabelFrame(parent, text=title, padding=5)
        area_frame.pack(fill=tk.X, pady=2)
        
        # Image label with larger default size
        if index == 1:
            label_text = "背包校正图"
        else:
            label_text = f"图像 {index}"
            
        # Larger default size for better display - remove fixed width/height to allow dynamic sizing
        image_label = tk.Label(area_frame, text=label_text, 
                              relief='sunken', anchor='center',
                              bg='#2b2b2b', fg='white', cursor='hand2')
        image_label.pack(pady=5)
        
        # Bind click event to show image info
        image_label.bind('<Button-1>', lambda e, idx=index: self._show_image_info(idx))
        
        self.image_labels[f'image_{index}'] = image_label
        
        # Image info
        info_frame = ttk.Frame(area_frame)
        info_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(info_frame, text="路径:").pack(side=tk.LEFT)
        if index == 1:
            default_path = "bag_correction.png"
        else:
            default_path = f"placeholder_{index}.png"
        path_var = tk.StringVar(value=default_path)
        path_entry = ttk.Entry(info_frame, textvariable=path_var, width=15)
        path_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        self.image_paths[f'path_{index}'] = path_var
        
        # Size info
        size_frame = ttk.Frame(area_frame)
        size_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(size_frame, text="尺寸:").pack(side=tk.LEFT)
        size_var = tk.StringVar(value="200x150")
        size_entry = ttk.Entry(size_frame, textvariable=size_var, width=10)
        size_entry.pack(side=tk.LEFT, padx=5)
        self.image_paths[f'size_{index}'] = size_var
        
        # Load button - special handling for bag correction image (index 1)
        if index == 1:
            # For bag correction image, use generate method
            load_btn = ttk.Button(area_frame, text="生成校正图", 
                                 command=self._generate_bag_correction_image)
            load_btn.pack(pady=2)
        else:
            # For other images, use normal load method
            load_btn = ttk.Button(area_frame, text="加载图像", 
                                 command=lambda idx=index: self._load_image(idx))
            load_btn.pack(pady=2)
    
    def _load_image(self, index):
        """Load image for display"""
        try:
            path_var = self.image_paths[f'path_{index}']
            image_path = path_var.get()
            
            if os.path.exists(image_path):
                # Load and resize image with aspect ratio preservation
                image = Image.open(image_path)
                resized_image = self._resize_image_with_aspect_ratio(image, max_width=400, max_height=300)
                photo = ImageTk.PhotoImage(resized_image)
                
                # Update label
                label = self.image_labels[f'image_{index}']
                
                # Clear any existing image and text first
                label.configure(image="", text="")
                
                # Set the new image
                label.configure(image=photo)
                label.image = photo  # Keep a reference
                
                # Store original image for info display
                label.original_image = image
                
                # Force update to prevent flickering
                label.update_idletasks()
                
                # Update size info
                size_var = self.image_paths[f'size_{index}']
                size_var.set(f"{image.width}x{image.height}")
                
                ColorPrint.green(f"[UI] Loaded image {index}: {image_path}")
            else:
                messagebox.showerror("错误", f"图像文件不存在: {image_path}")
                
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to load image {index}: {e}")
            messagebox.showerror("错误", f"加载图像失败: {e}")
    
    def _resize_image_with_aspect_ratio(self, image, max_width=400, max_height=300):
        """
        Resize image while preserving aspect ratio
        
        Args:
            image: PIL Image object
            max_width: Maximum width for display
            max_height: Maximum height for display
            
        Returns:
            Resized PIL Image object
        """
        try:
            original_width, original_height = image.size
            
            # Calculate scaling factor
            width_ratio = max_width / original_width
            height_ratio = max_height / original_height
            
            # Use the smaller ratio to ensure image fits within bounds
            scale_ratio = min(width_ratio, height_ratio, 1.0)  # Don't scale up
            
            # Calculate new dimensions
            new_width = int(original_width * scale_ratio)
            new_height = int(original_height * scale_ratio)
            
            # Resize image
            resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            ColorPrint.blue(f"[UI] Resized image from {original_width}x{original_height} to {new_width}x{new_height}")
            return resized_image
            
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to resize image: {e}")
            return image
    
    def set_bag_correction_image(self, image_input, display_size=(200, 150)):
        """
        Set bag correction image with flexible input support
        
        Args:
            image_input: Can be either:
                - str: Path to image file
                - PIL.Image: Already loaded PIL Image object
                - numpy.ndarray: OpenCV image array
                - None: Clear the image
            display_size: Tuple of (width, height) for display size
        """
        try:
            # Handle different input types
            if image_input is None:
                # Clear the image
                self._clear_bag_correction_image()
                return True
                
            elif isinstance(image_input, str):
                # String path - load from file
                if not os.path.exists(image_input):
                    ColorPrint.red(f"[UI] Image file not found: {image_input}")
                    return False
                    
                image = Image.open(image_input)
                ColorPrint.blue(f"[UI] Loaded bag correction image from file: {image_input}")
                
            elif isinstance(image_input, Image.Image):
                # Already loaded PIL Image
                image = image_input.copy()
                ColorPrint.blue("[UI] Using provided PIL Image for bag correction")
                
            elif hasattr(image_input, 'shape'):  # numpy array (OpenCV)
                # Convert OpenCV image to PIL
                import numpy as np
                if len(image_input.shape) == 3:
                    # BGR to RGB conversion for OpenCV
                    image_input = image_input[:, :, ::-1]
                image = Image.fromarray(image_input)
                ColorPrint.blue("[UI] Converted OpenCV image to PIL for bag correction")
                
            else:
                ColorPrint.red(f"[UI] Unsupported image input type: {type(image_input)}")
                return False
            
            # Resize image for display with aspect ratio preservation
            if display_size:
                resized_image = self._resize_image_with_aspect_ratio(image, max_width=400, max_height=300)
            else:
                resized_image = self._resize_image_with_aspect_ratio(image, max_width=400, max_height=300)
            
            # Convert to PhotoImage
            photo = ImageTk.PhotoImage(resized_image)
            
            # Update the bag correction image label (index 1)
            label = self.image_labels['image_1']
            
            # Clear any existing image and text first
            label.configure(image="", text="")
            
            # Set the new image
            label.configure(image=photo)
            label.image = photo  # Keep a reference
            
            # Store original image for info display
            label.original_image = image
            
            # Force update to prevent flickering
            label.update_idletasks()
            
            # Update path and size info
            if isinstance(image_input, str):
                self.image_paths['path_1'].set(image_input)
            else:
                self.image_paths['path_1'].set("bag_correction_loaded")
            
            self.image_paths['size_1'].set(f"{image.width}x{image.height}")
            
            ColorPrint.green(f"[UI] Bag correction image set successfully ({image.width}x{image.height})")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to set bag correction image: {e}")
            return False
    
    def _clear_bag_correction_image(self):
        """Clear the bag correction image"""
        try:
            label = self.image_labels['image_1']
            label.configure(image="", text="背包校正图")
            label.image = None
            
            self.image_paths['path_1'].set("bag_correction.png")
            self.image_paths['size_1'].set("200x150")
            
            ColorPrint.blue("[UI] Bag correction image cleared")
            
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to clear bag correction image: {e}")
    
    def get_bag_correction_image(self):
        """
        Get current bag correction image
        
        Returns:
            PIL.Image or None: Current bag correction image
        """
        try:
            if hasattr(self.image_labels['image_1'], 'image') and self.image_labels['image_1'].image:
                # Extract PIL image from PhotoImage
                photo = self.image_labels['image_1'].image
                # Note: This is a simplified approach. In practice, you might need to store the original image separately
                return photo
            return None
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to get bag correction image: {e}")
            return None
    
    def capture_bag_correction_image(self, screenshot_callback=None):
        """
        Capture bag correction image from game
        
        Args:
            screenshot_callback: Function to capture screenshot, should return PIL.Image or None
        """
        try:
            if screenshot_callback:
                # Use provided callback to capture screenshot
                image = screenshot_callback()
                if image:
                    self.set_bag_correction_image(image)
                    ColorPrint.green("[UI] Bag correction image captured from game")
                    return True
                else:
                    ColorPrint.yellow("[UI] Screenshot callback returned no image")
                    return False
            else:
                # Try to use default screenshot method
                ColorPrint.blue("[UI] No screenshot callback provided, please provide one")
                return False
                
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to capture bag correction image: {e}")
            return False
    
    def _show_image_info(self, index):
        """Show image information in a popup window"""
        try:
            label = self.image_labels[f'image_{index}']
            
            # Check if image is loaded
            if not hasattr(label, 'original_image') or label.original_image is None:
                messagebox.showinfo("图像信息", f"图像区域 {index} 没有加载图像")
                return
            
            # Get image information
            original_image = label.original_image
            original_width, original_height = original_image.size
            
            # Get display image size
            if hasattr(label, 'image') and label.image:
                display_width = label.image.width()
                display_height = label.image.height()
            else:
                display_width = display_height = 0
            
            # Get file path
            path_var = self.image_paths[f'path_{index}']
            file_path = path_var.get()
            
            # Get file size if it's a file path
            file_size = "未知"
            if file_path and os.path.exists(file_path):
                try:
                    file_size_bytes = os.path.getsize(file_path)
                    if file_size_bytes < 1024:
                        file_size = f"{file_size_bytes} B"
                    elif file_size_bytes < 1024 * 1024:
                        file_size = f"{file_size_bytes / 1024:.1f} KB"
                    else:
                        file_size = f"{file_size_bytes / (1024 * 1024):.1f} MB"
                except:
                    file_size = "无法获取"
            
            # Create info window
            info_window = tk.Toplevel(self.parent)
            info_window.title(f"图像信息 - 区域 {index}")
            info_window.geometry("400x300")
            info_window.resizable(False, False)
            
            # Center the window
            info_window.transient(self.parent)
            info_window.grab_set()
            
            # Create info content
            info_frame = ttk.Frame(info_window, padding=20)
            info_frame.pack(fill=tk.BOTH, expand=True)
            
            # Title
            title_label = ttk.Label(info_frame, text=f"图像区域 {index} 详细信息", 
                                   font=('Arial', 14, 'bold'))
            title_label.pack(pady=(0, 15))
            
            # Create image display area in popup
            image_display_frame = ttk.LabelFrame(info_frame, text="图像预览", padding=10)
            image_display_frame.pack(fill=tk.X, pady=(0, 15))
            
            # Create image display in popup - use original size if reasonable, otherwise scale down
            original_width, original_height = original_image.size
            
            # Determine popup window size based on image size
            max_popup_width = 800
            max_popup_height = 600
            
            if original_width <= max_popup_width and original_height <= max_popup_height:
                # Use original size
                popup_image = original_image
                popup_width = original_width
                popup_height = original_height
            else:
                # Scale down to fit popup
                popup_image = self._resize_image_with_aspect_ratio(original_image, max_width=max_popup_width, max_height=max_popup_height)
                popup_width, popup_height = popup_image.size
            
            popup_photo = ImageTk.PhotoImage(popup_image)
            
            popup_image_label = tk.Label(image_display_frame, image=popup_photo, 
                                       relief='sunken', bd=2)
            popup_image_label.pack()
            popup_image_label.image = popup_photo  # Keep a reference
            
            # Adjust popup window size based on image size
            info_window.geometry(f"{max(400, popup_width + 40)}x{max(300, popup_height + 200)}")
            
            # Image information
            info_text = f"""原始尺寸: {original_width} x {original_height} 像素
显示尺寸: {display_width} x {display_height} 像素
文件路径: {file_path}
文件大小: {file_size}
图像模式: {original_image.mode}
缩放比例: {display_width/original_width:.2f} x {display_height/original_height:.2f}"""
            
            info_label = tk.Text(info_frame, height=6, width=45, wrap=tk.WORD, 
                                font=('Consolas', 10), bg='#f0f0f0')
            info_label.pack(pady=(0, 15))
            info_label.insert(tk.END, info_text)
            info_label.config(state=tk.DISABLED)
            
            # Close button
            close_btn = ttk.Button(info_frame, text="关闭", 
                                 command=info_window.destroy)
            close_btn.pack()
            
            ColorPrint.blue(f"[UI] Showing image info for area {index}")
            
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to show image info: {e}")
            messagebox.showerror("错误", f"显示图像信息失败: {e}")
    
    def _create_auxiliary_functions_area(self, parent):
        """Create auxiliary functions area"""
        functions_frame = ttk.LabelFrame(parent, text="辅助功能", padding=10)
        functions_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        # Create scrollable frame
        canvas = tk.Canvas(functions_frame)
        scrollbar = ttk.Scrollbar(functions_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # Combat macro hotkey
        self._create_combat_macro_section(scrollable_frame)
        
        # Assistant macro hotkey
        self._create_assistant_macro_section(scrollable_frame)
        
        # Animation speed
        self._create_animation_speed_section(scrollable_frame)
        
        # Game language
        self._create_game_language_section(scrollable_frame)
        
        # Blood shard gambling
        self._create_blood_shard_section(scrollable_frame)
        
        # Quick pickup
        self._create_quick_pickup_section(scrollable_frame)
        
        # Blacksmith
        self._create_blacksmith_section(scrollable_frame)
        
        # Kanai's Cube
        self._create_kanai_cube_section(scrollable_frame)
        
        # Drop equipment
        self._create_drop_equipment_section(scrollable_frame)
        
        # Custom settings
        self._create_custom_settings_section(scrollable_frame)
        
        # Pack canvas and scrollbar
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
    
    def _create_combat_macro_section(self, parent):
        """Create combat macro section"""
        combat_frame = ttk.LabelFrame(parent, text="战斗宏设置", padding=5)
        combat_frame.pack(fill=tk.X, pady=5)
        
        # Combat macro hotkey
        hotkey_frame = ttk.Frame(combat_frame)
        hotkey_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(hotkey_frame, text="战斗宏启动快捷键:").pack(side=tk.LEFT)
        self.combat_hotkey_var = tk.StringVar(value="F11")
        combat_combo = ttk.Combobox(hotkey_frame, textvariable=self.combat_hotkey_var, 
                                   values=['F9', 'F10', 'F11', 'F12'], width=10)
        combat_combo.pack(side=tk.LEFT, padx=5)
        
        # Combat macro type
        type_frame = ttk.Frame(combat_frame)
        type_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(type_frame, text="类型:").pack(side=tk.LEFT)
        self.combat_type_var = tk.StringVar(value="键盘按键")
        combat_type_combo = ttk.Combobox(type_frame, textvariable=self.combat_type_var,
                                        values=['键盘按键', '鼠标按键'], width=10)
        combat_type_combo.pack(side=tk.LEFT, padx=5)
    
    def _create_assistant_macro_section(self, parent):
        """Create assistant macro section"""
        assistant_frame = ttk.LabelFrame(parent, text="助手宏设置", padding=5)
        assistant_frame.pack(fill=tk.X, pady=5)
        
        # Assistant macro hotkey
        hotkey_frame = ttk.Frame(assistant_frame)
        hotkey_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(hotkey_frame, text="助手宏启动快捷键:").pack(side=tk.LEFT)
        self.assistant_hotkey_var = tk.StringVar(value="F12")
        assistant_combo = ttk.Combobox(hotkey_frame, textvariable=self.assistant_hotkey_var,
                                     values=['F9', 'F10', 'F11', 'F12'], width=10)
        assistant_combo.pack(side=tk.LEFT, padx=5)
        
        # Assistant macro type
        type_frame = ttk.Frame(assistant_frame)
        type_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(type_frame, text="类型:").pack(side=tk.LEFT)
        self.assistant_type_var = tk.StringVar(value="键盘按键")
        assistant_type_combo = ttk.Combobox(type_frame, textvariable=self.assistant_type_var,
                                          values=['键盘按键', '鼠标按键'], width=10)
        assistant_type_combo.pack(side=tk.LEFT, padx=5)
    
    def _create_animation_speed_section(self, parent):
        """Create animation speed section"""
        speed_frame = ttk.LabelFrame(parent, text="动画速度设置", padding=5)
        speed_frame.pack(fill=tk.X, pady=5)
        
        # Animation speed
        speed_control_frame = ttk.Frame(speed_frame)
        speed_control_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(speed_control_frame, text="动画速度:").pack(side=tk.LEFT)
        self.animation_speed_var = tk.StringVar(value="1.0")
        speed_spin = ttk.Spinbox(speed_control_frame, from_=0.1, to=5.0, increment=0.1,
                                textvariable=self.animation_speed_var, width=8)
        speed_spin.pack(side=tk.LEFT, padx=5)
        
        ttk.Label(speed_control_frame, text="倍速").pack(side=tk.LEFT, padx=(5, 0))
    
    def _create_game_language_section(self, parent):
        """Create game language section"""
        language_frame = ttk.LabelFrame(parent, text="游戏语言设置", padding=5)
        language_frame.pack(fill=tk.X, pady=5)
        
        # Game language
        lang_control_frame = ttk.Frame(language_frame)
        lang_control_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(lang_control_frame, text="游戏界面语言:").pack(side=tk.LEFT)
        self.game_language_var = tk.StringVar(value="中文")
        lang_combo = ttk.Combobox(lang_control_frame, textvariable=self.game_language_var,
                                 values=['中文', 'English', '日本語'], width=10)
        lang_combo.pack(side=tk.LEFT, padx=5)
        
        # Apply button
        apply_btn = ttk.Button(lang_control_frame, text="应用", 
                              command=self._apply_game_language)
        apply_btn.pack(side=tk.LEFT, padx=5)
    
    def _create_blood_shard_section(self, parent):
        """Create blood shard gambling section"""
        blood_frame = ttk.LabelFrame(parent, text="血岩赌博助手", padding=5)
        blood_frame.pack(fill=tk.X, pady=5)
        
        # Enable checkbox
        self.blood_shard_enabled = tk.BooleanVar()
        blood_check = ttk.Checkbutton(blood_frame, text="启用血岩赌博助手",
                                      variable=self.blood_shard_enabled)
        blood_check.pack(anchor=tk.W, pady=2)
        
        # Gambling type
        type_frame = ttk.Frame(blood_frame)
        type_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(type_frame, text="赌博类型:").pack(side=tk.LEFT)
        self.blood_shard_type_var = tk.StringVar(value="武器")
        blood_type_combo = ttk.Combobox(type_frame, textvariable=self.blood_shard_type_var,
                                       values=['武器', '护甲', '饰品'], width=10)
        blood_type_combo.pack(side=tk.LEFT, padx=5)
    
    def _create_quick_pickup_section(self, parent):
        """Create quick pickup section"""
        pickup_frame = ttk.LabelFrame(parent, text="快速拾取助手", padding=5)
        pickup_frame.pack(fill=tk.X, pady=5)
        
        # Enable checkbox
        self.quick_pickup_enabled = tk.BooleanVar()
        pickup_check = ttk.Checkbutton(pickup_frame, text="启用快速拾取助手",
                                      variable=self.quick_pickup_enabled)
        pickup_check.pack(anchor=tk.W, pady=2)
        
        # Pickup delay
        delay_frame = ttk.Frame(pickup_frame)
        delay_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(delay_frame, text="拾取延迟:").pack(side=tk.LEFT)
        self.pickup_delay_var = tk.StringVar(value="100")
        pickup_delay_spin = ttk.Spinbox(delay_frame, from_=50, to=1000,
                                       textvariable=self.pickup_delay_var, width=8)
        pickup_delay_spin.pack(side=tk.LEFT, padx=5)
        ttk.Label(delay_frame, text="ms").pack(side=tk.LEFT, padx=(5, 0))
    
    def _create_blacksmith_section(self, parent):
        """Create blacksmith section"""
        blacksmith_frame = ttk.LabelFrame(parent, text="铁匠分解助手", padding=5)
        blacksmith_frame.pack(fill=tk.X, pady=5)
        
        # Enable checkbox
        self.blacksmith_enabled = tk.BooleanVar()
        blacksmith_check = ttk.Checkbutton(blacksmith_frame, text="启用铁匠分解助手",
                                          variable=self.blacksmith_enabled)
        blacksmith_check.pack(anchor=tk.W, pady=2)
        
        # Decomposition type
        type_frame = ttk.Frame(blacksmith_frame)
        type_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(type_frame, text="分解类型:").pack(side=tk.LEFT)
        self.blacksmith_type_var = tk.StringVar(value="全部")
        blacksmith_type_combo = ttk.Combobox(type_frame, textvariable=self.blacksmith_type_var,
                                            values=['全部', '稀有', '传奇'], width=10)
        blacksmith_type_combo.pack(side=tk.LEFT, padx=5)
    
    def _create_kanai_cube_section(self, parent):
        """Create Kanai's Cube section"""
        cube_frame = ttk.LabelFrame(parent, text="魔盒助手功能", padding=5)
        cube_frame.pack(fill=tk.X, pady=5)
        
        # Reforge
        self.kanai_reforge_enabled = tk.BooleanVar()
        reforge_check = ttk.Checkbutton(cube_frame, text="启用重铸功能",
                                       variable=self.kanai_reforge_enabled)
        reforge_check.pack(anchor=tk.W, pady=2)
        
        # Upgrade
        self.kanai_upgrade_enabled = tk.BooleanVar()
        upgrade_check = ttk.Checkbutton(cube_frame, text="启用升级功能",
                                       variable=self.kanai_upgrade_enabled)
        upgrade_check.pack(anchor=tk.W, pady=2)
        
        # Convert
        self.kanai_convert_enabled = tk.BooleanVar()
        convert_check = ttk.Checkbutton(cube_frame, text="启用转换功能",
                                       variable=self.kanai_convert_enabled)
        convert_check.pack(anchor=tk.W, pady=2)
    
    def _create_drop_equipment_section(self, parent):
        """Create drop equipment section"""
        drop_frame = ttk.LabelFrame(parent, text="一键丢装助手", padding=5)
        drop_frame.pack(fill=tk.X, pady=5)
        
        # Enable checkbox
        self.drop_equipment_enabled = tk.BooleanVar()
        drop_check = ttk.Checkbutton(drop_frame, text="启用一键丢装助手",
                                    variable=self.drop_equipment_enabled)
        drop_check.pack(anchor=tk.W, pady=2)
        
        # Drop quality
        quality_frame = ttk.Frame(drop_frame)
        quality_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(quality_frame, text="丢弃品质:").pack(side=tk.LEFT)
        self.drop_quality_var = tk.StringVar(value="稀有及以下")
        drop_quality_combo = ttk.Combobox(quality_frame, textvariable=self.drop_quality_var,
                                         values=['稀有及以下', '传奇及以下', '全部'], width=12)
        drop_quality_combo.pack(side=tk.LEFT, padx=5)
    
    def _create_custom_settings_section(self, parent):
        """Create custom settings section"""
        custom_frame = ttk.LabelFrame(parent, text="自定义设置", padding=5)
        custom_frame.pack(fill=tk.X, pady=5)
        
        # Custom stand
        self.custom_stand_enabled = tk.BooleanVar()
        stand_check = ttk.Checkbutton(custom_frame, text="启用自定义站立",
                                     variable=self.custom_stand_enabled)
        stand_check.pack(anchor=tk.W, pady=2)
        
        # Custom move
        self.custom_move_enabled = tk.BooleanVar()
        move_check = ttk.Checkbutton(custom_frame, text="启用自定义移动",
                                    variable=self.custom_move_enabled)
        move_check.pack(anchor=tk.W, pady=2)
        
        # Custom potion
        self.custom_potion_enabled = tk.BooleanVar()
        potion_check = ttk.Checkbutton(custom_frame, text="启用自定义药水",
                                      variable=self.custom_potion_enabled)
        potion_check.pack(anchor=tk.W, pady=2)
    
    def _create_bag_offset_controls(self, parent):
        """Create bag offset configuration controls"""
        # Bag offset frame with better styling
        bag_offset_frame = ttk.LabelFrame(parent, text="背包范围截取偏移值", padding=10)
        bag_offset_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Description with better styling
        desc_label = ttk.Label(bag_offset_frame, text="正数向内缩进，负数向外扩展 (像素)", 
                              font=('Arial', 9), foreground='#666666')
        desc_label.pack(anchor=tk.W, pady=(0, 8))
        
        # Get current bag offset configuration
        bag_offset = CONFIG.get('system_settings', {}).get('bag_offset', {})
        bag_offset_config = {
            'left': bag_offset.get('left', 9),
            'right': bag_offset.get('right', 22),
            'top': bag_offset.get('top', 0),
            'bottom': bag_offset.get('bottom', 0)
        }
        
        # Create offset controls
        offset_controls = [
            ('left', '左偏移:', bag_offset_config['left']),
            ('right', '右偏移:', bag_offset_config['right']),
            ('top', '上偏移:', bag_offset_config['top']),
            ('bottom', '下偏移:', bag_offset_config['bottom'])
        ]
        
        self.bag_offset_vars = {}
        
        for offset_key, label_text, default_value in offset_controls:
            frame = ttk.Frame(bag_offset_frame)
            frame.pack(fill=tk.X, pady=3)
            
            ttk.Label(frame, text=label_text, width=8, font=('Arial', 9)).pack(side=tk.LEFT)
            
            var = tk.IntVar(value=default_value)
            self.bag_offset_vars[offset_key] = var
            
            spinbox = ttk.Spinbox(frame, from_=-50, to=50, textvariable=var, width=8)
            spinbox.pack(side=tk.LEFT, padx=(10, 0))
            
            # Bind change event
            spinbox.bind('<FocusOut>', self._on_bag_offset_changed)
            spinbox.bind('<Return>', self._on_bag_offset_changed)
        
        # Apply button with better styling
        apply_btn = ttk.Button(bag_offset_frame, text="应用设置", 
                              command=self._apply_bag_offset_config)
        apply_btn.pack(anchor=tk.E, pady=(8, 0))
    
    def _on_bag_offset_changed(self, event=None):
        """Handle bag offset value changes"""
        # Only update UI display, don't auto-apply to configuration
        # User must click "应用设置" button to apply changes
        ColorPrint.blue("[UI] Bag offset values changed, waiting for user to apply settings")
    
    def _apply_bag_offset_config(self):
        """Apply bag offset configuration and generate bag correction image"""
        try:
            offset_data = {
                'left': self.bag_offset_vars['left'].get(),
                'right': self.bag_offset_vars['right'].get(),
                'top': self.bag_offset_vars['top'].get(),
                'bottom': self.bag_offset_vars['bottom'].get()
            }
            
            # Update configuration directly to CONFIG
            for key, value in offset_data.items():
                if key in ['left', 'right', 'top', 'bottom']:
                    CONFIG['system_settings']['bag_offset'][key] = value
                    ColorPrint.blue(f"[UI] Set {key} = {value}")
            
            # Save configuration
            save_config()
            ColorPrint.green(f"[UI] Bag offset configuration updated: {offset_data}")
            
            # Generate bag correction image with new offset values
            self._generate_bag_correction_image()
            
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to update bag offset configuration: {e}")
            messagebox.showerror("错误", f"更新背包偏移值配置失败: {e}")
    
    def _generate_bag_correction_image(self):
        """Generate bag correction image using GameAssistantController"""
        try:
            # Import GameAssistantController
            import sys
            import os
            current_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            sys.path.insert(0, current_dir)
            
            from controller.game_assistant_controller import GameAssistantController
            
            # Create controller instance
            controller = GameAssistantController()
            
            # Set callback to update UI when image is generated
            def on_bag_correction_update(image_path):
                """Callback to update UI when bag correction image is generated"""
                try:
                    if os.path.exists(image_path):
                        # Load the generated image into the UI with proper scaling
                        self.set_bag_correction_image(image_path, display_size=(400, 300))
                        ColorPrint.green(f"[UI] Bag correction image updated: {image_path}")
                    else:
                        ColorPrint.red(f"[UI] Generated image file not found: {image_path}")
                except Exception as e:
                    ColorPrint.red(f"[UI] Failed to update bag correction image: {e}")
            
            # Set the callback
            controller.on_bag_correction_image_update = on_bag_correction_update
            
            # Generate bag correction image
            ColorPrint.blue("[UI] Generating bag correction image with current offset values...")
            image_path = controller.generate_bag_correction_image()
            
            if image_path:
                ColorPrint.green(f"[UI] Bag correction image generated successfully: {image_path}")
            else:
                ColorPrint.yellow("[UI] Failed to generate bag correction image")
                
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to generate bag correction image: {e}")
            messagebox.showerror("错误", f"生成背包校正图失败: {e}")
    
    def _apply_game_language(self):
        """Apply game language setting"""
        try:
            new_language = self.game_language_var.get()
            
            # Update configuration directly to CONFIG
            CONFIG['macro_configs']['auxiliary_config']['game_language'] = new_language
            save_config()
            ColorPrint.green(f"[SUCCESS] 游戏界面语言已更改为: {new_language}")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 游戏语言设置失败: {e}")
    
    def set_config_change_callback(self, callback):
        """Set configuration change callback"""
        self.on_config_change = callback
