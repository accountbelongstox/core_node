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

from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageTk, get_third_package_PIL_ImageDraw

Image = get_third_package_PIL_Image()
ImageTk = get_third_package_PIL_ImageTk()
ImageDraw = get_third_package_PIL_ImageDraw()

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from ui.unified_styles import UnifiedStyles
from ui.utils.app_root import get_app_root
from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import get_d4_interface_data, get_game_interface_data
from d3utils.i18n_manager import i18n_manager


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

        # Create window (reuse app root to avoid extra blank "Tk" window)
        root = parent or get_app_root()
        self.window = tk.Toplevel(root) if root else tk.Tk()
        self.window.title(i18n_manager.get_ui_text("d4_panel.debug_window.title"))
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
                              text=i18n_manager.get_ui_text("d4_panel.debug_window.heading"),
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

        # D3 Bag Recognition section (from bag_info_collector result)
        self._create_d3_bag_section(scrollable_frame)

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

    def _create_d3_bag_section(self, parent):
        """Create D3 bag recognition section: text info + bag crop image."""
        try:
            title = i18n_manager.get_ui_text("d4_panel.exp_farming.debug_window.d3_bag_title", "D3 Bag Recognition")
        except Exception:
            title = "D3 Bag Recognition"
        section = tk.LabelFrame(
            parent,
            text=title,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['subheading'],
            relief=tk.RIDGE,
            bd=2,
        )
        section.pack(fill=tk.X, padx=5, pady=5)

        self.d3_bag_info_label = tk.Label(
            section,
            text="",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small'],
            justify=tk.LEFT,
            anchor="w",
        )
        self.d3_bag_info_label.pack(anchor="w", padx=5, pady=2, fill=tk.X)

        self.d3_bag_image_label = tk.Label(
            section,
            text="No Image",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_muted'],
            font=UnifiedStyles.FONTS['small'],
        )
        self.d3_bag_image_label.pack(padx=5, pady=5)
        self.d3_bag_photo = None

    def _draw_d3_bag_grid_on_pil(self, pil_img, coords, layout):
        """Draw grid and quality labels on cropped bag PIL image (same logic as _draw_bag_layout_grid)."""
        if pil_img is None or coords is None:
            return pil_img
        try:
            img = pil_img.copy()
            draw = ImageDraw.Draw(img)
            w, h = img.size
            rows, cols = coords.rows, coords.cols
            slot_w = w / cols
            slot_h = h / rows
            # Quality color (RGB): same as image_annotator_helper
            quality_colors = {
                'empty': (100, 100, 100),
                'legendary_set': (0, 200, 0),
                'legendary': (255, 165, 0),
                'rare': (255, 255, 0),
                'magic': (0, 128, 255),
                'unknown': (128, 128, 128),
            }
            grid_color = (160, 160, 160)
            # Grid lines
            for col in range(cols + 1):
                x = int(col * slot_w)
                draw.line([(x, 0), (x, h)], fill=grid_color, width=1)
            for row in range(rows + 1):
                y = int(row * slot_h)
                draw.line([(0, y), (w, y)], fill=grid_color, width=1)
            # Slot quality labels
            if layout and getattr(layout, "layout", None) and getattr(layout, "items", None):
                layout_grid = layout.layout
                items = layout.items
                for row in range(rows):
                    for col in range(cols):
                        if layout_grid[row][col] == 'item_2slot_bottom':
                            continue
                        cx = int((col + 0.5) * slot_w)
                        cy = int((row + 0.5) * slot_h)
                        info = items.get((row, col))
                        if not info:
                            continue
                        quality = info.get('quality', 'unknown')
                        color = quality_colors.get(quality, (128, 128, 128))
                        letter = quality[0].upper() if quality else '?'
                        # Draw small filled rect as marker
                        r = max(2, min(int(slot_w * 0.15), int(slot_h * 0.15)))
                        draw.rectangle(
                            [cx - r, cy - r, cx + r, cy + r],
                            outline=color,
                            fill=color,
                            width=2
                        )
                        # Text (default font, small)
                        tw, th = 8, 10
                        draw.text((cx - tw // 2, cy - th // 2), letter, fill=(255, 255, 255))
            return img
        except Exception as e:
            ColorPrint.yellow(f"[DebugWindow] _draw_d3_bag_grid_on_pil: {e}")
            return pil_img

    def _update_d3_bag_section(self):
        """Refresh D3 bag section from get_game_interface_data() (bag_coordinates, bag_layout)."""
        try:
            if not hasattr(self, 'd3_bag_info_label') or not self.d3_bag_info_label.winfo_exists():
                return
            no_data = i18n_manager.get_ui_text("d4_panel.exp_farming.debug_window.d3_bag_no_data", "No D3 bag data (run bag detection first)")
            d3_data = get_game_interface_data()
            coords = getattr(d3_data, "bag_coordinates", None)
            layout = getattr(d3_data, "bag_layout", None)
            game_img = getattr(d3_data, "game_window_image", None)

            if coords is None and layout is None:
                self.d3_bag_info_label.configure(text=no_data)
                if hasattr(self, 'd3_bag_image_label') and self.d3_bag_image_label.winfo_exists():
                    self.d3_bag_image_label.configure(image="", text="No Image")
                self.d3_bag_photo = None
                return

            lines = []
            lines.append(f"Grid: {coords.rows}x{coords.cols} ({coords.total_slots} slots)")
            lines.append(f"TopLeft: {coords.top_left}  BottomRight: {coords.bottom_right}")
            lines.append(f"Size: {coords.width}x{coords.height}")

            if layout and getattr(layout, "items", None):
                items = layout.items
                occupied = sum(1 for v in items.values() if isinstance(v, dict) and v.get("type") != "empty")
                lines.append(f"Occupied: {occupied} / {coords.total_slots}")
                # Quality counts (same as bag_layout_detector: legendary_set/legendary/rare/magic)
                quality_count = {
                    'legendary_set': 0,
                    'legendary': 0,
                    'rare': 0,
                    'magic': 0,
                    'unknown': 0,
                    'empty': 0,
                }
                for v in items.values():
                    if not isinstance(v, dict):
                        continue
                    q = v.get('quality', 'unknown')
                    quality_count[q] = quality_count.get(q, 0) + 1
                lines.append("")
                lines.append("Quality:")
                lines.append(f"  Legendary set: {quality_count.get('legendary_set', 0)}  Legendary: {quality_count.get('legendary', 0)}  Rare: {quality_count.get('rare', 0)}  Magic: {quality_count.get('magic', 0)}  Unknown: {quality_count.get('unknown', 0)}  Empty: {quality_count.get('empty', 0)}")
                lines.append("")
                for (r, c), info in sorted(items.items()):
                    if not isinstance(info, dict):
                        continue
                    t = info.get("type", "?")
                    q = info.get("quality", "?")
                    if t == "empty":
                        continue
                    lines.append(f"  ({r},{c}) {t}  quality={q}")
            else:
                lines.append("Layout: no item detail")

            self.d3_bag_info_label.configure(text="\n".join(lines))

            if game_img is not None and coords is not None:
                try:
                    left, top = coords.top_left[0], coords.top_left[1]
                    right, bottom = coords.bottom_right[0], coords.bottom_right[1]
                    left = max(0, min(left, game_img.width))
                    top = max(0, min(top, game_img.height))
                    right = max(left, min(right, game_img.width))
                    bottom = max(top, min(bottom, game_img.height))
                    cropped = game_img.crop((left, top, right, bottom))
                    cropped = self._draw_d3_bag_grid_on_pil(cropped, coords, layout)
                    max_w = 320
                    if cropped.width > max_w:
                        ratio = max_w / cropped.width
                        h = int(cropped.height * ratio)
                        cropped = cropped.resize((max_w, h), Image.Resampling.LANCZOS)
                    self.d3_bag_photo = ImageTk.PhotoImage(cropped)
                    self.d3_bag_image_label.configure(image=self.d3_bag_photo, text="")
                except Exception as e:
                    self.d3_bag_image_label.configure(image="", text=str(e))
                    self.d3_bag_photo = None
            else:
                self.d3_bag_image_label.configure(image="", text="No game window image")
                self.d3_bag_photo = None
        except Exception as e:
            if hasattr(self, 'd3_bag_info_label') and self.d3_bag_info_label.winfo_exists():
                self.d3_bag_info_label.configure(text=str(e))
            self.d3_bag_photo = None

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

            self._update_d3_bag_section()
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
