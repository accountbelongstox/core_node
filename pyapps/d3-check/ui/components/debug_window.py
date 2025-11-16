#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Debug Window Component
Displays debug images from D4 region detection
"""

import tkinter as tk
from tkinter import ttk
import sys
import os
from typing import Optional

from pycore.pyfoundations.third_party import PIL
from PIL import Image, ImageTk

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from ui.unified_styles import UnifiedStyles
from providor.common_imports import ColorPrint
from share.game_interface_data import get_d4_interface_data


class DebugWindow:
    """Debug window to display region detection images"""

    def __init__(self, parent=None):
        """
        Initialize debug window

        Args:
            parent: Parent window (optional)
        """
        self.parent = parent
        self.d4_data = get_d4_interface_data()

        # Create window
        self.window = tk.Toplevel(parent) if parent else tk.Tk()
        self.window.title("D4 Debug - Region Detection")
        self.window.geometry("680x1000+50+50")  # 680x1000px, positioned at left side
        self.window.resizable(False, False)
        self.window.configure(bg=UnifiedStyles.COLORS['bg_primary'])

        # Store PhotoImage references to prevent garbage collection
        self.photo_images = {}

        # Create UI
        self._create_ui()

        # Bind close event
        self.window.protocol("WM_DELETE_WINDOW", self._on_close)

        # Update images initially
        self.update_images()

        ColorPrint.blue("[DebugWindow] Debug window created")

    def _create_ui(self):
        """Create debug window UI"""
        # Main container with scrollbar
        main_container = tk.Frame(self.window, bg=UnifiedStyles.COLORS['bg_primary'])
        main_container.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Canvas for scrolling
        canvas = tk.Canvas(main_container, bg=UnifiedStyles.COLORS['bg_primary'],
                          highlightthickness=0)
        scrollbar = tk.Scrollbar(main_container, orient=tk.VERTICAL, command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=UnifiedStyles.COLORS['bg_primary'])

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        # Pack canvas and scrollbar
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Title
        title_label = tk.Label(scrollable_frame,
                              text="D4 Region Detection Debug",
                              bg=UnifiedStyles.COLORS['bg_primary'],
                              fg=UnifiedStyles.COLORS['text_primary'],
                              font=UnifiedStyles.FONTS['heading'])
        title_label.pack(pady=10)

        # Button frame
        button_frame = tk.Frame(scrollable_frame, bg=UnifiedStyles.COLORS['bg_primary'])
        button_frame.pack(pady=5)

        # Pause/Continue button (initially shows "Pause Updates")
        self.pause_btn = tk.Button(button_frame,
                                   text="Pause Updates",
                                   bg=UnifiedStyles.COLORS['btn_warning'],
                                   fg=UnifiedStyles.COLORS['text_primary'],
                                   font=UnifiedStyles.FONTS['button'],
                                   command=self._toggle_pause)
        self.pause_btn.pack(side=tk.LEFT, padx=5)

        # Close button
        close_btn = tk.Button(button_frame,
                             text="Close",
                             bg=UnifiedStyles.COLORS['btn_danger'],
                             fg=UnifiedStyles.COLORS['text_primary'],
                             font=UnifiedStyles.FONTS['button'],
                             command=self._on_close)
        close_btn.pack(side=tk.LEFT, padx=5)

        # Image display areas
        self.image_labels = {}

        # Define regions to display (matching image_annotator.regions_to_draw labels)
        regions = [
            ('Team Count', 'Team Count Region'),
            ('Team Vote', 'Team Vote Region'),
            ('Minimap', 'Minimap'),
            ('EXP Bar', 'Experience Bar'),
            ('Quest Text', 'Quest Area'),
            ('Bag', 'Bag Area'),
            ('Blacksmith Menu', 'Blacksmith Menu'),
            ('Whisper Obols', 'Whispering Obols'),
            ('Equipment Left', 'Equipment Left'),
            ('Equipment Right', 'Equipment Right'),
            ('Blacksmith Function', 'Blacksmith Function'),
            ('Map Name', 'Map Name'),
            ('Dungeon Progress', 'Dungeon Progress Bar'),
            ('Find Team', 'Find Team Button'),
            ('Form Team', 'Form Team Button'),
            ('Activity Selection', 'Activity Selection'),
            ('Min Tier Input', 'Min Tier Input'),
            ('Max Tier Input', 'Max Tier Input'),
            ('Confirm Team', 'Confirm Team Button'),
            ('Panel Close', 'Panel Close Button'),
            ('Min Tier Click', 'Min Tier Click Point'),
        ]

        # Create a container for two-column layout
        columns_container = tk.Frame(scrollable_frame, bg=UnifiedStyles.COLORS['bg_primary'])
        columns_container.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Configure grid for two columns
        columns_container.grid_columnconfigure(0, weight=1)
        columns_container.grid_columnconfigure(1, weight=1)

        # Split regions into two columns
        half = (len(regions) + 1) // 2  # Ceiling division

        # Column 1 (left)
        for idx, (region_key, region_title) in enumerate(regions[:half]):
            self._create_image_section(columns_container, region_key, region_title, row=idx, column=0)

        # Column 2 (right)
        for idx, (region_key, region_title) in enumerate(regions[half:]):
            self._create_image_section(columns_container, region_key, region_title, row=idx, column=1)

    def _create_image_section(self, parent, region_key, title, row=0, column=0):
        """
        Create an image display section

        Args:
            parent: Parent widget
            region_key: Key for the image in debug_images dict
            title: Display title for this section
            row: Grid row position
            column: Grid column position (0 or 1 for two-column layout)
        """
        # Section frame
        section_frame = tk.LabelFrame(parent,
                                     text=title,
                                     bg=UnifiedStyles.COLORS['bg_secondary'],
                                     fg=UnifiedStyles.COLORS['text_primary'],
                                     font=UnifiedStyles.FONTS['subheading'],
                                     relief=tk.RIDGE,
                                     bd=2)
        section_frame.grid(row=row, column=column, sticky="nsew", padx=5, pady=5)

        # Image label
        img_label = tk.Label(section_frame,
                            text="No Image",
                            bg=UnifiedStyles.COLORS['bg_secondary'],
                            fg=UnifiedStyles.COLORS['text_muted'],
                            font=UnifiedStyles.FONTS['small'])
        img_label.pack(padx=5, pady=5)

        # Store reference
        self.image_labels[region_key] = img_label

    def update_images(self):
        """Update all debug images from detected_regions"""
        try:
            # Check if window still exists
            if not hasattr(self, 'window') or not self.window.winfo_exists():
                ColorPrint.yellow("[DebugWindow] Window no longer exists, skipping update")
                return

            ColorPrint.blue("[DebugWindow] Starting update_images...")

            # Get region_images from detected_regions
            detected_regions = self.d4_data.detected_regions

            if detected_regions is None:
                ColorPrint.yellow("[DebugWindow] detected_regions is None")
                return

            if 'region_images' not in detected_regions:
                ColorPrint.yellow(f"[DebugWindow] 'region_images' not in detected_regions. Keys: {list(detected_regions.keys())}")
                return

            region_images = detected_regions['region_images']
            ColorPrint.blue(f"[DebugWindow] Found {len(region_images)} region images")
            ColorPrint.blue(f"[DebugWindow] Available regions: {list(region_images.keys())}")
            ColorPrint.blue(f"[DebugWindow] Expected regions: {list(self.image_labels.keys())}")

            updated_count = 0
            for region_key, img_label in self.image_labels.items():
                # Check if label still exists
                if not hasattr(img_label, 'winfo_exists') or not img_label.winfo_exists():
                    ColorPrint.yellow(f"[DebugWindow] Label for '{region_key}' no longer exists, skipping")
                    continue

                if region_key in region_images and region_images[region_key] is not None:
                    # Get image from detected_regions
                    pil_image = region_images[region_key]
                    
                    # Safety check: ensure image is valid
                    if pil_image is None or pil_image.width <= 0 or pil_image.height <= 0:
                        ColorPrint.yellow(f"[DebugWindow] Invalid image for '{region_key}': {pil_image.width if pil_image else 'None'}x{pil_image.height if pil_image else 'None'}")
                        if hasattr(img_label, 'winfo_exists') and img_label.winfo_exists():
                            img_label.configure(image="", text="Invalid Image")
                        continue

                    # Resize image to fit two-column layout (max 300px per column)
                    max_width = 300
                    if pil_image.width > max_width:
                        ratio = max_width / pil_image.width
                        new_height = int(pil_image.height * ratio)
                        # Safety check: ensure dimensions are valid
                        if new_height > 0 and max_width > 0:
                            pil_image = pil_image.resize((max_width, new_height), Image.Resampling.LANCZOS)
                        else:
                            ColorPrint.yellow(f"[DebugWindow] Invalid dimensions for '{region_key}': {max_width}x{new_height}, skipping resize")

                    # Convert to PhotoImage
                    photo_image = ImageTk.PhotoImage(pil_image)

                    # Store reference to prevent garbage collection
                    self.photo_images[region_key] = photo_image

                    # Update label
                    if hasattr(img_label, 'winfo_exists') and img_label.winfo_exists():
                        img_label.configure(image=photo_image, text="")
                        updated_count += 1
                        ColorPrint.green(f"[DebugWindow] ✓ Updated '{region_key}'")
                    else:
                        ColorPrint.yellow(f"[DebugWindow] Label for '{region_key}' no longer exists, skipping update")
                else:
                    # No image available
                    if hasattr(img_label, 'winfo_exists') and img_label.winfo_exists():
                        img_label.configure(image="", text="No Image Available")
                    ColorPrint.yellow(f"[DebugWindow] ✗ No image for '{region_key}'")

            ColorPrint.green(f"[DebugWindow] Updated {updated_count}/{len(self.image_labels)} images")

        except Exception as e:
            ColorPrint.red(f"[DebugWindow] Error updating images: {e}")
            import traceback
            traceback.print_exc()

    def _toggle_pause(self):
        """Toggle pause/continue state for image updates"""
        try:
            # Toggle pause state in shared data
            self.d4_data.debug_window_paused = not self.d4_data.debug_window_paused

            # Update button appearance based on state
            if self.d4_data.debug_window_paused:
                # Currently paused - button shows "Continue Updates"
                self.pause_btn.config(
                    text="Continue Updates",
                    bg=UnifiedStyles.COLORS['btn_success']
                )
                ColorPrint.yellow("[DebugWindow] Image updates PAUSED - viewing frozen snapshot")
            else:
                # Currently running - button shows "Pause Updates"
                self.pause_btn.config(
                    text="Pause Updates",
                    bg=UnifiedStyles.COLORS['btn_warning']
                )
                ColorPrint.green("[DebugWindow] Image updates RESUMED")

        except Exception as e:
            ColorPrint.red(f"[DebugWindow] Error toggling pause: {e}")
            import traceback
            traceback.print_exc()

    def _on_close(self):
        """Handle window close event"""
        # Update shared data to indicate window is closed
        self.d4_data.debug_window_open = False
        ColorPrint.yellow("[DebugWindow] Debug window closed")

        # Destroy window
        self.window.destroy()

    def show(self):
        """Show the debug window"""
        self.window.deiconify()

    def hide(self):
        """Hide the debug window"""
        self.window.withdraw()


# Singleton instance
_debug_window_instance = None


def get_debug_window(parent=None) -> Optional[DebugWindow]:
    """
    Get or create debug window singleton

    Args:
        parent: Parent window (optional)

    Returns:
        DebugWindow instance or None
    """
    global _debug_window_instance

    # Check if window exists and is valid
    if _debug_window_instance is not None:
        try:
            # Test if window still exists
            _debug_window_instance.window.winfo_exists()
            return _debug_window_instance
        except:
            # Window was destroyed, create new one
            _debug_window_instance = None

    # Create new window
    try:
        _debug_window_instance = DebugWindow(parent)
        return _debug_window_instance
    except Exception as e:
        ColorPrint.red(f"[DebugWindow] Error creating debug window: {e}")
        return None


def close_debug_window():
    """Close the debug window if it exists"""
    global _debug_window_instance

    if _debug_window_instance is not None:
        try:
            _debug_window_instance._on_close()
        except:
            pass
        _debug_window_instance = None
