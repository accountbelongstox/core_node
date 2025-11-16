#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screenshot Provider
Unified screenshot provider for the entire application

Features:
- Single source of truth for screenshots
- Memory-based storage (no disk I/O until save)
- Automatic game window detection using anchor points
- Provides full screen, game window region, and offset values
- Shared across all controllers
"""

import os
import sys
import tkinter as tk
from typing import Optional, Tuple, Dict
from pathlib import Path
from datetime import datetime

from pycore.pyfoundations.third_party import PIL, numpy, cv2
from PIL import Image
import numpy as np

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint, WindowScreenshot
from d3utils.game_window_detector import GameWindowDetector

# Import path constants from providor
project_root_for_import = os.path.dirname(current_dir)
sys.path.insert(0, project_root_for_import)
from providor.providor_index import TMP_DIR, TEMPLATE_DIR
from share import get_game_interface_data, update_global_scale, get_screen_resolution
DEBUG = False


class ScreenshotData:
    """
    Container for screenshot data

    Stores all screenshot-related information in memory
    """

    def __init__(
        self,
        fullscreen_image: Image.Image,
        game_window_image: Optional[Image.Image],
        game_window_rect: Optional[Tuple[int, int, int, int]],
        window_offset: Tuple[int, int],
        fullscreen_size: Tuple[int, int],
        game_window_size: Optional[Tuple[int, int]],
        timestamp: str
    ):
        """
        Initialize screenshot data

        Args:
            fullscreen_image: Full screen PIL Image (in memory)
            game_window_image: Cropped game window PIL Image (in memory) or None
            game_window_rect: Game window rect (left, top, right, bottom) or None
            window_offset: Window offset (offset_x, offset_y)
            fullscreen_size: Full screen size (width, height)
            game_window_size: Game window size (width, height) or None
            timestamp: Timestamp string
        """
        self.fullscreen_image = fullscreen_image
        self.game_window_image = game_window_image
        self.game_window_rect = game_window_rect
        self.window_offset = window_offset
        self.fullscreen_size = fullscreen_size
        self.game_window_size = game_window_size
        self.timestamp = timestamp

        # Saved file paths (set when saved)
        self.fullscreen_path = None
        self.game_window_path = None

    def save(self, output_dir: Optional[Path] = None, prefix: str = "screenshot") -> Dict[str, Path]:
        """
        Save screenshots to disk

        Args:
            output_dir: Output directory (default: global TMP_DIR)
            prefix: Filename prefix

        Returns:
            Dictionary with saved paths:
            {
                "fullscreen_path": Path,
                "game_window_path": Path or None
            }
        """
        if output_dir is None:
            output_dir = TMP_DIR

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save full screen
        fullscreen_filename = f"{prefix}_fullscreen_{self.timestamp}.png"
        self.fullscreen_path = output_dir / fullscreen_filename
        self.fullscreen_image.save(self.fullscreen_path)
        ColorPrint.green(f"[Save] Full screen saved: {self.fullscreen_path}")

        # Save game window if available
        if self.game_window_image is not None:
            game_window_filename = f"{prefix}_game_{self.timestamp}.png"
            self.game_window_path = output_dir / game_window_filename
            self.game_window_image.save(self.game_window_path)
            ColorPrint.green(f"[Save] Game window saved: {self.game_window_path}")

        return {
            "fullscreen_path": self.fullscreen_path,
            "game_window_path": self.game_window_path
        }

    def get_fullscreen_array(self) -> np.ndarray:
        """
        Get full screen image as numpy array (BGR format for OpenCV)

        Returns:
            Numpy array in BGR format
        """
        rgb_array = np.array(self.fullscreen_image)
        bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
        return bgr_array

    def get_game_window_array(self) -> Optional[np.ndarray]:
        """
        Get game window image as numpy array (BGR format for OpenCV)

        Returns:
            Numpy array in BGR format or None if not available
        """
        if self.game_window_image is None:
            return None

        rgb_array = np.array(self.game_window_image)
        bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
        return bgr_array

class ScreenshotProvider:
    """
    Unified screenshot provider

    Single source of truth for screenshots across the entire application.
    Each call to capture() provides a new screenshot with:
    - Full screen image (in memory)
    - Game window region (if detected)
    - Window offset values
    - All images stored in memory until explicitly saved
    """

    def __init__(self):
        """Initialize screenshot provider"""
        self.screenshot_manager = WindowScreenshot(match_mode="ends")
        self.window_detector = GameWindowDetector()

        # Current screenshot data (shared across application)
        self.current_screenshot = None

        ColorPrint.green("[ScreenshotProvider] Initialized")

    def share(self) -> Optional[ScreenshotData]:
        """
        Share current screenshot or capture new one if not exists

        Returns shared screenshot data without re-capturing if already exists.
        Use this method when you want to reuse existing screenshot.

        Returns:
            ScreenshotData object or None if capture failed
        """
        if self.current_screenshot is not None:
            ColorPrint.blue("[Provider] Sharing existing screenshot")
            return self.current_screenshot

        ColorPrint.blue("[Provider] No existing screenshot, capturing new...")
        return self.gen()

    def gen(
        self,
        use_optimized_capture: bool = True,
        window_titles: Optional[list] = None
    ) -> Optional[ScreenshotData]:
        """
        Generate a new screenshot (force re-capture)

        This method always captures a new screenshot and replaces current_screenshot.
        Use this method when you need fresh screenshot data.

        Args:
            use_optimized_capture: If True, use screenshot_first_window_by_titles (fast with cache, default: True)
            window_titles: Window titles to search for (required if use_optimized_capture=True)

        Returns:
            ScreenshotData object or None if capture failed
        """
        ColorPrint.blue("\n[Provider] Generating new screenshot...")

        try:
            # Step 1: Capture screenshot using selected method
            if use_optimized_capture:
                if window_titles is None or len(window_titles) == 0:
                    ColorPrint.red("[Provider] window_titles required when use_optimized_capture=True")
                    return None

                ColorPrint.blue(f"[Provider] Using optimized capture for: {window_titles}")
                result = self.screenshot_manager.screenshot_first_window_by_titles(
                    titles=window_titles,
                    filename_prefix="temp_game_window", 
                    use_cache=True
                )
            else:
                # Original method: capture full screen
                ColorPrint.blue("[Provider] Capturing full screen...")
                result = self.screenshot_manager.capture_window_fast(
                    titles=None,  # No title - full screen
                    filename_prefix="temp_fullscreen",
                    scale_to_720p=False,
                    use_cache=False
                )

            if result is None:
                ColorPrint.red("[Provider] Failed to capture screenshot")
                return None

            fullscreen_path = result["screenshot_path"]
            captured_size = result["window_size"]  # This is the captured window size

            # Get actual screen resolution
            screen_width, screen_height = get_screen_resolution()
            screen_resolution = (screen_width, screen_height)

            ColorPrint.green(f"[Provider] Screenshot captured: {captured_size[0]}x{captured_size[1]}")
            ColorPrint.green(f"[Provider] Screen resolution: {screen_resolution[0]}x{screen_resolution[1]}")

            # Load image to memory
            fullscreen_image = Image.open(str(fullscreen_path))

            # Save debug copy if DEBUG mode is enabled
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            if DEBUG:
                debug_path = TMP_DIR / f"debug_fullscreen_{timestamp}.png"
                fullscreen_image.save(debug_path)
                ColorPrint.gray(f"[DEBUG] Saved fullscreen: {debug_path}")

            # Step 2: Handle different capture modes

            if use_optimized_capture:
                # Optimized mode: Only game window is captured, no fullscreen available
                # fullscreen_image is set to NULL for compatibility
                ColorPrint.green(f"[Provider] Optimized mode: using captured game window directly")

                game_window_image = fullscreen_image  # The captured image is game window
                game_window_size = captured_size  # Use actual captured window size, not screen resolution
                game_window_rect = (0, 0, captured_size[0], captured_size[1])
                fullscreen_size = screen_resolution  # Use screen resolution for fullscreen_size

                # Get window offset from cache
                from pyfoundations.encyclopedia import ENCYCLOPEDIA
                window_offset = (0, 0)
                for title in window_titles:
                    cache_key = f"window_cache_{title.lower()}"
                    cached_info = ENCYCLOPEDIA.get(cache_key)
                    if cached_info:
                        window_offset = (cached_info.get('left', 0), cached_info.get('top', 0))
                        ColorPrint.blue(f"[Provider] Got window offset from cache: {window_offset}")
                        break

                # Clean up temporary file
                try:
                    fullscreen_path.unlink()
                    ColorPrint.gray(f"[Provider] Cleaned up temp file: {fullscreen_path}")
                except:
                    pass

                # Update global resolution scale
                update_global_scale(game_window_size[0], game_window_size[1])

                # Create screenshot data
                # NOTE: fullscreen_image is set to NULL in optimized mode (only game window captured)
                screenshot_data = ScreenshotData(
                    fullscreen_image=None,  # NULL in optimized mode - no fullscreen captured
                    game_window_image=game_window_image,  # The actual captured game window
                    game_window_rect=game_window_rect,
                    window_offset=window_offset,
                    fullscreen_size=fullscreen_size,  # Screen resolution
                    game_window_size=game_window_size,  # Actual captured window size
                    timestamp=timestamp
                )

            else:
                # Normal mode: fullscreen_image is actual fullscreen, need to detect and crop game window
                ColorPrint.blue("[Provider] Normal mode: detecting game window from fullscreen...")
                fullscreen_size = screen_resolution  # Use screen resolution for fullscreen_size
                detection_result = self.window_detector.detect_game_window(str(fullscreen_path))

                # Clean up temporary full screen file
                try:
                    fullscreen_path.unlink()
                    ColorPrint.gray(f"[Provider] Cleaned up temp file: {fullscreen_path}")
                except:
                    pass

                # Step 3: Process detection result
                if detection_result is None:
                    ColorPrint.yellow("[Provider] Game window NOT detected - no anchor points found")
                    ColorPrint.yellow("[Provider] Game window image will be NULL")

                    # Create screenshot data without game window
                    screenshot_data = ScreenshotData(
                        fullscreen_image=fullscreen_image,
                        game_window_image=None,
                        game_window_rect=None,
                        window_offset=(0, 0),
                        fullscreen_size=fullscreen_size,
                        game_window_size=None,
                        timestamp=timestamp
                    )

                    self.current_screenshot = screenshot_data

                    # Update shared game interface data
                    shared_data = get_game_interface_data()
                    shared_data.fullscreen_image = fullscreen_image
                    shared_data.game_window_image = None
                    shared_data.window_offset = (0, 0)
                    shared_data.fullscreen_size = fullscreen_size
                    shared_data.game_window_size = (0, 0)
                    shared_data.timestamp = timestamp

                    ColorPrint.blue("[Provider] Screenshot data created (game window: NULL)")
                    ColorPrint.yellow("[Provider] Updated shared data with fullscreen only")

                    return screenshot_data

                # Game window detected
                game_window_rect = detection_result["window_rect"]
                left, top, right, bottom = game_window_rect

                ColorPrint.green(f"[Provider] Game window detected: {game_window_rect}")

                # Step 4: Crop game window from full screen
                game_window_image = fullscreen_image.crop((left, top, right, bottom))
                game_window_size = (right - left, bottom - top)

                ColorPrint.green(f"[Provider] Game window cropped: {game_window_size[0]}x{game_window_size[1]}")

                # Save debug copy if DEBUG mode is enabled
                if DEBUG:
                    debug_gw_path = TMP_DIR / f"debug_game_window_{timestamp}.png"
                    game_window_image.save(debug_gw_path)
                    ColorPrint.gray(f"[DEBUG] Saved game window: {debug_gw_path}")

                # Update global resolution scale immediately after successful capture
                update_global_scale(game_window_size[0], game_window_size[1])

                # Step 5: Create screenshot data
                screenshot_data = ScreenshotData(
                    fullscreen_image=fullscreen_image,
                    game_window_image=game_window_image,
                    game_window_rect=game_window_rect,
                    window_offset=(left, top),
                    fullscreen_size=fullscreen_size,
                    game_window_size=game_window_size,
                    timestamp=timestamp
                )

            # Store as current screenshot (shared across application)
            self.current_screenshot = screenshot_data

            # Update shared game interface data
            shared_data = get_game_interface_data()
            shared_data.fullscreen_image = screenshot_data.fullscreen_image  # NULL in optimized mode
            shared_data.game_window_image = screenshot_data.game_window_image
            shared_data.window_offset = screenshot_data.window_offset
            shared_data.fullscreen_size = screenshot_data.fullscreen_size
            shared_data.game_window_size = screenshot_data.game_window_size or screenshot_data.fullscreen_size
            shared_data.timestamp = timestamp

            # Log NULL fullscreen warning if in optimized mode
            if screenshot_data.fullscreen_image is None:
                ColorPrint.gray("[Provider] Fullscreen image is NULL (optimized mode - compatibility ensured)")

            # Add to screenshot history if DEBUG mode
            if DEBUG and fullscreen_path:
                shared_data.add_screenshot_history(str(fullscreen_path))

            ColorPrint.green("[Provider] Screenshot data created and stored in memory")
            ColorPrint.blue(f"[Provider] Window offset: {screenshot_data.window_offset}")
            ColorPrint.blue(f"[Provider] Full screen size: {screenshot_data.fullscreen_size[0]}x{screenshot_data.fullscreen_size[1]}")
            ColorPrint.blue(f"[Provider] Game window size: {screenshot_data.game_window_size[0] if screenshot_data.game_window_size else 0}x{screenshot_data.game_window_size[1] if screenshot_data.game_window_size else 0}")
            ColorPrint.green("[Provider] Updated shared game interface data")

            return screenshot_data

        except Exception as e:
            ColorPrint.red(f"[Provider] Error capturing screenshot: {e}")
            import traceback
            traceback.print_exc()
            return None

    def clear_screenshot(self):
        """Clear current screenshot from memory"""
        if self.current_screenshot is not None:
            # Close PIL images to free memory
            if self.current_screenshot.fullscreen_image:
                self.current_screenshot.fullscreen_image.close()
            if self.current_screenshot.game_window_image:
                self.current_screenshot.game_window_image.close()

            self.current_screenshot = None
            ColorPrint.blue("[Provider] Screenshot cleared from memory")

    def save_current_screenshot(self, output_dir: Optional[Path] = None, prefix: str = "d3") -> Optional[Dict[str, Path]]:
        """
        Save current screenshot to disk

        Args:
            output_dir: Output directory (default: pytools tmp)
            prefix: Filename prefix

        Returns:
            Dictionary with saved paths or None if no screenshot
        """
        if self.current_screenshot is None:
            ColorPrint.yellow("[Provider] No screenshot to save")
            return None

        return self.current_screenshot.save(output_dir, prefix)

    def gen_grid_region(
        self,
        window_titles: Optional[list] = None,
        grid_type: str = '9grid',
        grid_index: Optional[int] = None,
        row_range: Optional[Tuple[int, int]] = None,
        col_range: Optional[Tuple[int, int]] = None,
        use_cache: bool = True
    ) -> Optional[Image.Image]:
        """
        Capture a specific grid region of game window

        Args:
            window_titles: Window titles to search for (None for full screen)
            grid_type: '9grid' (3x3) or '18x18grid' (18x18)
            grid_index: Grid index for 9grid mode (0-8)
            row_range: Row range for 18x18grid mode (start, end) inclusive
            col_range: Column range for 18x18grid mode (start, end) inclusive
            use_cache: Use cached window list

        Returns:
            PIL Image of the grid region or None if failed
        """
        ColorPrint.blue(f"[Provider] Capturing grid region: {grid_type}")

        try:
            return self.screenshot_manager.capture_window_grid_region(
                titles=window_titles,
                grid_type=grid_type,
                grid_index=grid_index,
                row_range=row_range,
                col_range=col_range,
                use_cache=use_cache
            )
        except Exception as e:
            ColorPrint.red(f"[Provider] Error capturing grid region: {e}")
            import traceback
            traceback.print_exc()
            return None

    def gen_grid_cell(
        self,
        cell_row: int,
        cell_col: int,
        window_titles: Optional[list] = None,
        grid_rows: int = 18,
        grid_cols: int = 18,
        use_cache: bool = True
    ) -> Optional[Image.Image]:
        """
        Capture a single cell from multi-row multi-column grid

        Args:
            cell_row: Row index (zero-based)
            cell_col: Column index (zero-based)
            window_titles: Window titles to search for (None for full screen)
            grid_rows: Total number of rows (default: eighteen)
            grid_cols: Total number of columns (default: eighteen)
            use_cache: Use cached window list

        Returns:
            PIL Image of the cell or None if failed
        """
        try:
            # For now, only support eighteen by eighteen grid
            if grid_rows == 18 and grid_cols == 18:
                return self.screenshot_manager.capture_window_grid_cell(
                    cell_row=cell_row,
                    cell_col=cell_col,
                    titles=window_titles,
                    use_cache=use_cache
                )
            else:
                ColorPrint.red(f"[Provider] Unsupported grid size: {grid_rows}x{grid_cols}")
                return None
        except Exception as e:
            ColorPrint.red(f"[Provider] Error capturing grid cell ({cell_row},{cell_col}): {e}")
            import traceback
            traceback.print_exc()
            return None

# Global screenshot provider instance (singleton)
_screenshot_provider = None

def get_screenshot_provider() -> ScreenshotProvider:
    """
    Get global screenshot provider instance (singleton)

    Returns:
        Global ScreenshotProvider instance
    """
    global _screenshot_provider

    if _screenshot_provider is None:
        _screenshot_provider = ScreenshotProvider()
        ColorPrint.green("[Global] Screenshot provider initialized")

    return _screenshot_provider

# Example usage
if __name__ == "__main__":
    # Get provider instance
    provider = get_screenshot_provider()

    # Capture screenshot
    screenshot = provider.capture()

    if screenshot:
        print(f"\nScreenshot captured:")
        print(f"  Full screen size: {screenshot.fullscreen_size}")

        if screenshot.game_window_image:
            print(f"  Game window size: {screenshot.game_window_size}")
            print(f"  Window offset: {screenshot.window_offset}")
        else:
            print(f"  Game window: NULL (not detected)")

        # Save to disk
        saved_paths = provider.save_current_screenshot()
        if saved_paths:
            print(f"\nSaved:")
            print(f"  Full screen: {saved_paths['fullscreen_path']}")
            if saved_paths['game_window_path']:
                print(f"  Game window: {saved_paths['game_window_path']}")
    else:
        print("Failed to capture screenshot")
