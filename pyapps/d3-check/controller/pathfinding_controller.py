#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pathfinding Controller
Handles NPC finding and pathfinding logic using OCR and grid-based search
"""

# Standard library imports
import sys
import os
import time
import traceback
from typing import Optional, Tuple, List, Dict, Any
from pathlib import Path

# Third-party imports
from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageDraw, get_third_package_PIL_ImageFont

Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()
ImageFont = get_third_package_PIL_ImageFont()

# Add paths

d3utils_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "d3utils")
sys.path.insert(0, d3utils_path)

controller_path = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, controller_path)

# Project imports
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.image_annotator import ImageAnnotator
from pycore.pyutils.image_crop import ImageCrop
from d3utils.cnocr_engine_registry import get_cnocr_engine_default
from d3utils.collectors.grid_screenshot_collector import GridScreenshotCollector, get_grid_screenshot_collector
from d3utils.state_aware_click_handler import get_state_aware_click_handler
from providor.constants.common import TMP_DIR
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from config.grid_config import get_grid_config

class PathfindingController:
    """
    Pathfinding controller for finding NPCs in game

    Features:
    1. Grid-based search (9 grids, each with 36 subgrids)
    2. OCR-based NPC detection
    3. Mouse movement simulation
    4. Result visualization and annotation
    """

    def __init__(self):
        """Initialize pathfinding controller"""
        self.grid_collector = get_grid_screenshot_collector()
        self.ocr_engine = get_cnocr_engine_default()
        self.ocr_initialized = self.ocr_engine is not None
        self.click_handler = get_state_aware_click_handler()

        # Ensure TMP_DIR exists
        TMP_DIR.mkdir(parents=True, exist_ok=True)

        ColorPrint.blue("[PathfindingController] Initialized")

    def _ensure_ocr_initialized(self) -> bool:
        """
        Ensure OCR is initialized (engine from registry, inited at app startup).
        """
        if self.ocr_engine is None:
            return False
        if self.ocr_initialized:
            return True
        if self.ocr_engine._initialized:
            self.ocr_initialized = True
            return True
        if self.ocr_engine.init():
            self.ocr_initialized = True
            return True
        return False

    def find_enchanter_npc(self, target_text: str = "附魔") -> Dict[str, Any]:  # Enchanter NPC; default CN "附魔", EN use "Enchanter"
        """
        Find enchanter NPC using grid-based OCR search with mouse movement

        New workflow:
        1. Divide game window into eighteen by eighteen grid (three hundred twenty-four cells)
        2. For each cell:
           - Move mouse to cell center (using curve movement)
           - Capture small region screenshot
           - Perform OCR recognition
        3. Compile results into annotated image

        Args:
            target_text: Text to search for (default "附魔" for CN; EN client use "Enchanter")

        Returns:
            Dict containing search results:
                - found: Whether NPC was found
                - cell_row: Row index where found (zero-based)
                - cell_col: Column index where found (zero-based)
                - coordinates: Screen coordinates (x, y)
                - annotated_image_path: Path to result image
        """
        grid_cfg = get_grid_config()
        grid_rows, grid_cols = grid_cfg['rows'], grid_cfg['cols']
        total_cells = grid_rows * grid_cols
        ColorPrint.blue(f"[PathfindingController] Starting grid-based search for: {target_text}")
        ColorPrint.blue(f"[PathfindingController] Grid size: {grid_rows} x {grid_cols} = {total_cells} cells")

        # Initialize OCR
        if not self._ensure_ocr_initialized():
            return {
                'found': False,
                'error': 'OCR initialization failed'
            }

        # Step one: Prepare for grid search
        ColorPrint.blue("[PathfindingController] Step one: Preparing grid search...")

        found = False
        found_cell_row = -1
        found_cell_col = -1
        found_coordinates = None
        search_results = []  # Store all search results for visualization

        # Step two: Iterate through grid cells
        ColorPrint.blue(f"[PathfindingController] Step two: Searching through {total_cells} cells...")
        ColorPrint.yellow(f"[PathfindingController] Note: Mouse will move to each cell before capture")

        try:
            for row in range(grid_rows):
                if found:
                    break

                ColorPrint.blue(f"[PathfindingController] === Searching row {row + 1}/{grid_rows} ===")

                for col in range(grid_cols):
                    if found:
                        break

                    # Progress indicator
                    cell_index = row * grid_cols + col
                    progress_pct = (cell_index / total_cells) * 100
                    ColorPrint.gray(f"[Progress] Cell {cell_index + 1}/{total_cells} ({progress_pct:.1f}%) - ({row},{col})")

                    # Step 2a: Get cell center position (uses config defaults)
                    cell_center = self.grid_collector.get_cell_center_position(
                        cell_row=row,
                        cell_col=col,
                        window_titles=DIABLO_III_WINDOW_TITLES,
                        use_cache=True
                    )

                    if not cell_center:
                        ColorPrint.yellow(f"[PathfindingController] Failed to get cell center for ({row},{col})")
                        search_results.append({
                            'cell_row': row,
                            'cell_col': col,
                            'center': None,
                            'found': False,
                            'text': '',
                            'error': 'Failed to get cell center'
                        })
                        continue

                    center_x, center_y = cell_center

                    # Step 2b: Move mouse to cell center using curve movement (auto duration: 300ms base, max 500ms)
                    ColorPrint.gray(f"[PathfindingController] Moving mouse to cell ({row},{col}) at ({center_x},{center_y})...")
                    if not self.click_handler.move_mouse_curve(
                        target_x=center_x,
                        target_y=center_y,
                        curve_type='bezier'
                    ):
                        ColorPrint.yellow(f"[PathfindingController] Failed to move mouse to cell ({row},{col})")
                        search_results.append({
                            'cell_row': row,
                            'cell_col': col,
                            'center': (center_x, center_y),
                            'found': False,
                            'text': '',
                            'error': 'Failed to move mouse'
                        })
                        continue

                    # Step 2c: Capture cell screenshot (uses config defaults)
                    ColorPrint.gray(f"[PathfindingController] Capturing cell ({row},{col})...")
                    cell_img = self.grid_collector.capture_grid_cell(
                        cell_row=row,
                        cell_col=col,
                        window_titles=DIABLO_III_WINDOW_TITLES,
                        use_cache=True
                    )

                    if not cell_img:
                        ColorPrint.yellow(f"[PathfindingController] Failed to capture cell ({row},{col})")
                        search_results.append({
                            'cell_row': row,
                            'cell_col': col,
                            'center': (center_x, center_y),
                            'found': False,
                            'text': '',
                            'error': 'Failed to capture'
                        })
                        continue

                    # Step 2d: Perform OCR on cell
                    try:
                        # Save cell temporarily for OCR
                        temp_cell_path = TMP_DIR / f"temp_cell_r{row}_c{col}.png"
                        cell_img.save(temp_cell_path)

                        # OCR recognition
                        ColorPrint.gray(f"[PathfindingController] Performing OCR on cell ({row},{col})...")
                        ocr_result = self.ocr_engine.ocr(str(temp_cell_path))
                        ocr_text = ocr_result.get('text', '')

                        if ocr_text:
                            ColorPrint.gray(f"[PathfindingController] OCR result: '{ocr_text[:30]}...'")

                        # Clean up temp file
                        temp_cell_path.unlink(missing_ok=True)

                        # Check if target text found
                        text_found = target_text in ocr_text
                        if text_found:
                            ColorPrint.green(f"[PathfindingController] *** TARGET FOUND in cell ({row},{col})! ***")

                        # Store result
                        search_results.append({
                            'cell_row': row,
                            'cell_col': col,
                            'center': (center_x, center_y),
                            'found': text_found,
                            'text': ocr_text
                        })

                        if text_found:
                            found = True
                            found_cell_row = row
                            found_cell_col = col
                            found_coordinates = (center_x, center_y)
                            ColorPrint.green(f"[PathfindingController] Found '{target_text}' at cell ({row},{col})")
                            ColorPrint.green(f"[PathfindingController] Screen coordinates: {found_coordinates}")
                            break

                    except Exception as e:
                        ColorPrint.yellow(f"[PathfindingController] OCR error at cell ({row},{col}): {e}")
                        search_results.append({
                            'cell_row': row,
                            'cell_col': col,
                            'center': (center_x, center_y),
                            'found': False,
                            'text': '',
                            'error': str(e)
                        })

        except Exception as e:
            ColorPrint.red(f"[PathfindingController] Search error: {e}")
            traceback.print_exc()
            return {
                'found': False,
                'error': f'Search error: {e}'
            }

        # Step three: Generate annotated result image
        ColorPrint.blue("[PathfindingController] Step three: Generating result visualization...")
        annotated_path = self._generate_grid_search_result(
            search_results,
            found,
            target_text
        )

        # Prepare result
        result = {
            'found': found,
            'target_text': target_text,
            'total_searched': len(search_results),
            'annotated_image_path': str(annotated_path)
        }

        if found:
            result.update({
                'cell_row': found_cell_row,
                'cell_col': found_cell_col,
                'coordinates': found_coordinates
            })
            ColorPrint.green(f"[PathfindingController] Search completed - NPC FOUND")
        else:
            ColorPrint.yellow(f"[PathfindingController] Search completed - NPC NOT FOUND")

        ColorPrint.green(f"[PathfindingController] Result saved: {annotated_path}")

        return result

    def _generate_grid_search_result(
        self,
        search_results: List[Dict],
        found: bool,
        target_text: str
    ) -> Path:
        """
        Generate search result file for grid-based search

        Args:
            search_results: List of search results
            found: Whether target was found
            target_text: Target text searched for

        Returns:
            Path to result file
        """
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        output_path = TMP_DIR / f"pathfinding_result_{timestamp}.txt"

        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(f"Grid-Based Pathfinding Search Result\n")
                f.write(f"{'=' * 70}\n")
                f.write(f"Target Text: {target_text}\n")
                f.write(f"Search Status: {'FOUND' if found else 'NOT FOUND'}\n")
                f.write(f"Total Cells Searched: {len(search_results)}\n")
                grid_cfg = get_grid_config()
                f.write(f"Grid Size: {grid_cfg['rows']} x {grid_cfg['cols']} = {grid_cfg['rows'] * grid_cfg['cols']} cells\n")
                f.write(f"Timestamp: {timestamp}\n")
                f.write(f"{'=' * 70}\n\n")

                if found:
                    f.write(f"Found Results:\n")
                    f.write(f"{'-' * 70}\n")
                    for result in search_results:
                        if result.get('found'):
                            f.write(f"Cell ({result['cell_row']}, {result['cell_col']}): FOUND\n")
                            f.write(f"  Position: {result.get('center')}\n")
                            f.write(f"  Text: {result.get('text', '')[:100]}...\n")
                            f.write(f"\n")

                f.write(f"\nDetailed Search Log:\n")
                f.write(f"{'-' * 70}\n")
                for idx, result in enumerate(search_results, 1):
                    status = "FOUND" if result.get('found') else "Not found"
                    if result.get('error'):
                        status = f"ERROR: {result['error']}"

                    f.write(f"{idx}. Cell ({result['cell_row']},{result['cell_col']}): {status}\n")

            ColorPrint.green(f"[PathfindingController] Search result saved: {output_path}")
            return output_path

        except Exception as e:
            ColorPrint.red(f"[PathfindingController] Error saving result: {e}")
            traceback.print_exc()
            # Return a fallback path
            fallback_path = TMP_DIR / f"pathfinding_error_{timestamp}.txt"
            fallback_path.write_text(f"Error generating result: {e}", encoding='utf-8')
            return fallback_path

if __name__ == '__main__':
    # Test pathfinding controller
    ColorPrint.blue("=== Pathfinding Controller Test ===")

    controller = PathfindingController()
    result = controller.find_enchanter_npc()

    ColorPrint.blue(f"\nResult: {result}")
