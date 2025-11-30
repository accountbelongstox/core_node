#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screenshot Manager

High-level screenshot management with image merging capabilities.
Integrates PyBrowser screenshot functionality with ImageUtils.
"""

import os
from typing import List, Dict, Any, Optional
from pathlib import Path

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.utils.image_utils import ImageUtils
from pycore.pyutils.pybrowser.utils.file_utils import FileUtils


class ScreenshotManager:
    """
    Screenshot Manager

    Provides high-level screenshot functionality with image merging.
    """

    def __init__(self, output_dir: str = None):
        """
        Initialize screenshot manager

        Args:
            output_dir: Default output directory for screenshots (optional)
        """
        self.output_dir = output_dir or str(Path.cwd() / 'screenshots')
        self.screenshot_count = 0

        ColorPrint.green(f'[ScreenshotManager] Initialized with output_dir: {self.output_dir}')

    def ensure_output_dir(self):
        """
        Ensure output directory exists

        Delegates to FileUtils for consistency.
        """
        FileUtils.ensure_directory(self.output_dir, log=True)

    def get_next_filename(self, prefix: str = 'screenshot', extension: str = 'png') -> str:
        """
        Generate next screenshot filename

        Delegates to FileUtils for sequential filename generation.

        Args:
            prefix: Filename prefix
            extension: File extension (default: png)

        Returns:
            Full file path

        Note:
            This method maintains backward compatibility by incrementing screenshot_count,
            but now uses FileUtils for actual filename generation.
        """
        self.screenshot_count += 1
        # Use FileUtils for consistent filename generation
        return FileUtils.get_next_filename(
            self.output_dir,
            prefix=prefix,
            extension=extension,
            start=1,
            padding=4
        )

    def take_screenshot(self, page, output_path: str = None, options: Dict[str, Any] = None) -> bytes:
        """
        Take screenshot of current page

        Args:
            page: IPage object (from PyBrowser)
            output_path: Save path (optional, auto-generated if not provided)
            options: Screenshot options (passed to page.screenshot())

        Returns:
            Screenshot bytes, or None if failed

        Note:
            This method directly calls page.screenshot() from PyBrowser.
            The page object must be from StandardPage or EnhancedPage.
        """
        options = options or {}

        if not page:
            ColorPrint.red('[ScreenshotManager] Page is required')
            return None

        # Auto-generate path if not provided
        if not output_path:
            self.ensure_output_dir()
            output_path = self.get_next_filename()

        # Set path in options
        options['path'] = output_path

        ColorPrint.blue(f'[ScreenshotManager] Taking screenshot: {output_path}')

        # Call page.screenshot() from PyBrowser
        # This may return bytes or None
        screenshot_bytes = page.screenshot(options)

        if screenshot_bytes:
            ColorPrint.green(f'[ScreenshotManager] Screenshot saved: {output_path}')
            return screenshot_bytes
        else:
            ColorPrint.red(f'[ScreenshotManager] Failed to take screenshot')
            return None

    def take_screenshot_and_merge(
        self,
        page,
        reference_image_source: str,
        output_path: str = None,
        merge_mode: str = 'horizontal',
        spacing: int = 10
    ) -> Dict[str, Any]:
        """
        Take screenshot and merge with reference image

        Args:
            page: IPage object
            reference_image_source: Reference image source (URL or local path)
            output_path: Output path for merged image (auto-generated if not provided)
            merge_mode: Merge mode ('horizontal', 'vertical', 'grid')
            spacing: Spacing between images in pixels (default: 10)

        Returns:
            Result dictionary:
            {
                'success': bool,
                'screenshot_path': str,      # Temporary screenshot path
                'merged_path': str,          # Final merged image path
                'screenshot_bytes': bytes,   # Screenshot bytes
                'error': str                 # Error message if failed
            }

        Example:
            manager = ScreenshotManager()
            result = manager.take_screenshot_and_merge(
                page=my_page,
                reference_image_source='/path/to/reference.png',
                merge_mode='horizontal'
            )
            if result['success']:
                print(f"Merged image: {result['merged_path']}")
        """
        ColorPrint.blue('[ScreenshotManager] Starting screenshot and merge process')

        # Step 1: Take screenshot
        temp_screenshot_path = None
        if not output_path:
            self.ensure_output_dir()
            temp_screenshot_path = self.get_next_filename(prefix='temp_screenshot')
        else:
            temp_screenshot_path = output_path.replace('.png', '_screenshot.png')

        screenshot_bytes = self.take_screenshot(page, temp_screenshot_path)

        if not screenshot_bytes:
            return {
                'success': False,
                'screenshot_path': None,
                'merged_path': None,
                'screenshot_bytes': None,
                'error': 'Failed to take screenshot'
            }

        ColorPrint.green(f'[ScreenshotManager] Screenshot taken: {temp_screenshot_path}')

        # Step 2: Load screenshot image
        ColorPrint.blue('[ScreenshotManager] Loading screenshot image')
        screenshot_img = ImageUtils.load_image(temp_screenshot_path)

        if not screenshot_img:
            return {
                'success': False,
                'screenshot_path': temp_screenshot_path,
                'merged_path': None,
                'screenshot_bytes': screenshot_bytes,
                'error': 'Failed to load screenshot image'
            }

        # Step 3: Load reference image
        ColorPrint.blue(f'[ScreenshotManager] Loading reference image: {reference_image_source}')
        reference_img = ImageUtils.load_image(reference_image_source)

        if not reference_img:
            return {
                'success': False,
                'screenshot_path': temp_screenshot_path,
                'merged_path': None,
                'screenshot_bytes': screenshot_bytes,
                'error': f'Failed to load reference image: {reference_image_source}'
            }

        # Step 4: Merge images
        ColorPrint.blue(f'[ScreenshotManager] Merging images (mode={merge_mode}, spacing={spacing})')

        merged_img = None
        if merge_mode == 'horizontal':
            merged_img = ImageUtils.merge_images_horizontal([reference_img, screenshot_img], spacing=spacing)
        elif merge_mode == 'vertical':
            merged_img = ImageUtils.merge_images_vertical([reference_img, screenshot_img], spacing=spacing)
        elif merge_mode == 'grid':
            merged_img = ImageUtils.merge_images_grid([reference_img, screenshot_img], cols=2, spacing=spacing)
        else:
            ColorPrint.red(f'[ScreenshotManager] Unknown merge mode: {merge_mode}')
            return {
                'success': False,
                'screenshot_path': temp_screenshot_path,
                'merged_path': None,
                'screenshot_bytes': screenshot_bytes,
                'error': f'Unknown merge mode: {merge_mode}'
            }

        if not merged_img:
            return {
                'success': False,
                'screenshot_path': temp_screenshot_path,
                'merged_path': None,
                'screenshot_bytes': screenshot_bytes,
                'error': 'Failed to merge images'
            }

        # Step 5: Save merged image
        if not output_path:
            merged_path = self.get_next_filename(prefix='merged')
        else:
            merged_path = output_path

        ColorPrint.blue(f'[ScreenshotManager] Saving merged image: {merged_path}')
        success = ImageUtils.save_image(merged_img, merged_path, format='PNG')

        if not success:
            return {
                'success': False,
                'screenshot_path': temp_screenshot_path,
                'merged_path': None,
                'screenshot_bytes': screenshot_bytes,
                'error': 'Failed to save merged image'
            }

        ColorPrint.green(f'[ScreenshotManager] Successfully created merged image: {merged_path}')

        return {
            'success': True,
            'screenshot_path': temp_screenshot_path,
            'merged_path': merged_path,
            'screenshot_bytes': screenshot_bytes,
            'error': None
        }

    def batch_screenshot_pages(
        self,
        pages: List,
        output_dir: str = None,
        prefix: str = 'page'
    ) -> List[Dict[str, Any]]:
        """
        Batch screenshot multiple pages

        Args:
            pages: List of IPage objects
            output_dir: Output directory (uses self.output_dir if not provided)
            prefix: Filename prefix (default: 'page')

        Returns:
            List of result dictionaries:
            [
                {'success': True, 'path': '/path/to/screenshot.png', 'bytes': b'...', 'index': 0},
                {'success': False, 'path': None, 'bytes': None, 'index': 1, 'error': '...'},
                ...
            ]
        """
        if not pages:
            ColorPrint.red('[ScreenshotManager] No pages provided')
            return []

        save_dir = output_dir or self.output_dir
        self.ensure_output_dir()

        ColorPrint.blue(f'[ScreenshotManager] Batch screenshot {len(pages)} pages to {save_dir}')

        results = []
        for i, page in enumerate(pages):
            if not page:
                ColorPrint.yellow(f'[ScreenshotManager] Page {i} is None, skipping')
                results.append({
                    'success': False,
                    'path': None,
                    'bytes': None,
                    'index': i,
                    'error': 'Page is None'
                })
                continue

            output_path = os.path.join(save_dir, f'{prefix}_{i+1:04d}.png')

            screenshot_bytes = self.take_screenshot(page, output_path)

            if screenshot_bytes:
                results.append({
                    'success': True,
                    'path': output_path,
                    'bytes': screenshot_bytes,
                    'index': i,
                    'error': None
                })
            else:
                results.append({
                    'success': False,
                    'path': None,
                    'bytes': None,
                    'index': i,
                    'error': 'Failed to take screenshot'
                })

        successful_count = sum(1 for r in results if r['success'])
        ColorPrint.green(f'[ScreenshotManager] Batch screenshot completed: {successful_count}/{len(pages)} successful')

        return results

    def get_stats(self) -> Dict[str, Any]:
        """
        Get screenshot manager statistics

        Returns:
            Statistics dictionary
        """
        return {
            'output_dir': self.output_dir,
            'screenshot_count': self.screenshot_count
        }

    def cleanup(self):
        """
        Cleanup resources

        Note: ScreenshotManager doesn't own any resources that need cleanup.
        This method is provided for consistency with other manager classes.
        """
        ColorPrint.blue('[ScreenshotManager] Cleanup complete (no resources to release)')


__all__ = ['ScreenshotManager']
