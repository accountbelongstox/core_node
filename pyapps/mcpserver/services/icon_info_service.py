#!/usr/bin/env python3
"""
Icon Information Service for MCP Server

Provides comprehensive icon analysis including:
- Image metadata (size, dimensions, format)
- OCR text recognition (position, confidence)
- Color analysis
- Image similarity detection
"""

from typing import Dict, Any, List, Optional

# Import icon analyzer and image tools from pycore
from pycore.pyutils.icon_analyzer import IconAnalyzer, create_icon_analyzer
from pycore.pyutils.image_tools import ImageTools


class IconInfoService:
    """
    Icon Information Service for MCP Server

    Provides RPC-accessible methods for:
    - Analyzing icon/image metadata
    - OCR text extraction from icons
    - Color analysis
    - Batch analysis
    - Similarity detection
    """

    def __init__(self):
        """Initialize icon info service"""
        self.analyzer = create_icon_analyzer(ocr_engine=None)
        self.image_tools = ImageTools()
        self._ocr_engine = None

    def set_ocr_engine(self, ocr_engine: Any):
        """
        Set OCR engine for text recognition

        Args:
            ocr_engine: OCR engine instance (FreeOCREngine, etc.)
        """
        self._ocr_engine = ocr_engine
        self.analyzer = create_icon_analyzer(ocr_engine=ocr_engine)

    async def analyze_icon(self, params: dict) -> dict:
        """
        Analyze a single icon/image

        Args:
            params: {
                'image_path': str,  # Path to icon/image
                'include_ocr': bool,  # Optional, default False
                'include_colors': bool,  # Optional, default True
                'include_hash': bool,  # Optional, default True
                'ocr_language': str  # Optional, default 'eng'
            }

        Returns:
            dict: {
                'success': bool,
                'file_info': {
                    'path': str,
                    'name': str,
                    'extension': str,
                    'size_bytes': int,
                    'size_kb': float,
                    'size_mb': float
                },
                'image_info': {
                    'width': int,
                    'height': int,
                    'dimensions': str,
                    'aspect_ratio': float,
                    'format': str,
                    'mode': str,
                    'has_transparency': bool,
                    'total_pixels': int
                },
                'ocr_results': {...},  # if include_ocr=True
                'color_info': {...},   # if include_colors=True
                'hash': {...}          # if include_hash=True
            }
        """
        try:
            image_path = params.get('image_path')
            if not image_path:
                return {
                    'success': False,
                    'error': 'image_path is required'
                }

            # Get options
            include_ocr = params.get('include_ocr', False)
            include_colors = params.get('include_colors', True)
            include_hash = params.get('include_hash', True)
            ocr_language = params.get('ocr_language', 'eng')

            # Analyze icon
            result = self.analyzer.analyze_icon(
                image_path=image_path,
                include_ocr=include_ocr,
                include_colors=include_colors,
                include_hash=include_hash,
                ocr_language=ocr_language
            )

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Icon analysis failed: {str(e)}'
            }

    async def get_icon_metadata(self, params: dict) -> dict:
        """
        Get basic icon metadata (without OCR)

        Args:
            params: {
                'image_path': str  # Path to icon/image
            }

        Returns:
            dict: File and image info only
        """
        try:
            image_path = params.get('image_path')
            if not image_path:
                return {
                    'success': False,
                    'error': 'image_path is required'
                }

            result = self.analyzer.analyze_icon(
                image_path=image_path,
                include_ocr=False,
                include_colors=False,
                include_hash=False
            )

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Metadata extraction failed: {str(e)}'
            }

    async def extract_icon_text(self, params: dict) -> dict:
        """
        Extract text from icon using OCR

        Args:
            params: {
                'image_path': str,  # Path to icon/image
                'language': str  # Optional, OCR language (eng, chs, etc.)
            }

        Returns:
            dict: {
                'success': bool,
                'text': str,
                'confidence': float,
                'words': list[dict],
                'lines': list[dict],
                'image_path': str
            }
        """
        try:
            image_path = params.get('image_path')
            if not image_path:
                return {
                    'success': False,
                    'error': 'image_path is required'
                }

            language = params.get('language', 'eng')

            # Analyze with OCR only
            result = self.analyzer.analyze_icon(
                image_path=image_path,
                include_ocr=True,
                include_colors=False,
                include_hash=False,
                ocr_language=language
            )

            if not result['success']:
                return result

            # Extract OCR results
            ocr_results = result.get('ocr_results', {})

            return {
                'success': True,
                'image_path': image_path,
                **ocr_results
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'OCR extraction failed: {str(e)}'
            }

    async def analyze_icon_colors(self, params: dict) -> dict:
        """
        Analyze icon color information

        Args:
            params: {
                'image_path': str  # Path to icon/image
            }

        Returns:
            dict: {
                'success': bool,
                'dominant_color': tuple,
                'average_color': tuple,
                'color_palette': list[tuple],
                'brightness': float,
                'is_grayscale': bool
            }
        """
        try:
            image_path = params.get('image_path')
            if not image_path:
                return {
                    'success': False,
                    'error': 'image_path is required'
                }

            # Analyze with colors only
            result = self.analyzer.analyze_icon(
                image_path=image_path,
                include_ocr=False,
                include_colors=True,
                include_hash=False
            )

            if not result['success']:
                return result

            return {
                'success': True,
                'image_path': image_path,
                **result.get('color_info', {})
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Color analysis failed: {str(e)}'
            }

    async def batch_analyze_icons(self, params: dict) -> dict:
        """
        Analyze multiple icons in batch

        Args:
            params: {
                'image_paths': list[str],  # List of icon paths
                'include_ocr': bool,  # Optional, default False
                'include_colors': bool,  # Optional, default True
                'include_hash': bool  # Optional, default True
            }

        Returns:
            dict: {
                'success': bool,
                'total': int,
                'analyzed': int,
                'failed': int,
                'results': list[dict],
                'errors': list[dict]
            }
        """
        try:
            image_paths = params.get('image_paths', [])
            if not image_paths:
                return {
                    'success': False,
                    'error': 'image_paths list is required'
                }

            include_ocr = params.get('include_ocr', False)
            include_colors = params.get('include_colors', True)
            include_hash = params.get('include_hash', True)

            # Batch analyze
            result = self.analyzer.batch_analyze(
                image_paths=image_paths,
                include_ocr=include_ocr,
                include_colors=include_colors,
                include_hash=include_hash
            )

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Batch analysis failed: {str(e)}'
            }

    async def find_similar_icons(self, params: dict) -> dict:
        """
        Find similar icons using perceptual hashing

        Args:
            params: {
                'target_image': str,  # Target icon path
                'candidate_images': list[str],  # List of candidate paths
                'threshold': float  # Optional, similarity threshold (0-1), default 0.9
            }

        Returns:
            dict: {
                'success': bool,
                'target_image': str,
                'total_candidates': int,
                'similar_count': int,
                'similar_icons': list[dict]
            }
        """
        try:
            target_image = params.get('target_image')
            candidate_images = params.get('candidate_images', [])

            if not target_image:
                return {
                    'success': False,
                    'error': 'target_image is required'
                }

            if not candidate_images:
                return {
                    'success': False,
                    'error': 'candidate_images list is required'
                }

            threshold = params.get('threshold', 0.9)

            # Find similar
            similar = self.analyzer.find_similar_icons(
                target_image=target_image,
                candidate_images=candidate_images,
                threshold=threshold
            )

            return {
                'success': True,
                'target_image': target_image,
                'total_candidates': len(candidate_images),
                'similar_count': len(similar),
                'threshold': threshold,
                'similar_icons': similar
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Similarity search failed: {str(e)}'
            }

    async def scan_directory_for_icons(self, params: dict) -> dict:
        """
        Scan directory for icon files and analyze them

        Args:
            params: {
                'directory': str,  # Directory to scan
                'recursive': bool,  # Optional, default True
                'extensions': list[str],  # Optional, icon extensions
                'include_ocr': bool,  # Optional, default False
                'include_colors': bool  # Optional, default True
            }

        Returns:
            dict: {
                'success': bool,
                'directory': str,
                'total_icons': int,
                'icons': list[dict]
            }
        """
        try:
            directory = params.get('directory')
            if not directory:
                return {
                    'success': False,
                    'error': 'directory is required'
                }

            dir_path = Path(directory)
            if not dir_path.exists():
                return {
                    'success': False,
                    'error': f'Directory not found: {directory}'
                }

            recursive = params.get('recursive', True)
            extensions = params.get('extensions', ['.png', '.jpg', '.jpeg', '.ico', '.svg'])
            include_ocr = params.get('include_ocr', False)
            include_colors = params.get('include_colors', True)

            # Scan directory
            icon_files = []
            if recursive:
                for ext in extensions:
                    icon_files.extend(dir_path.rglob(f'*{ext}'))
            else:
                for ext in extensions:
                    icon_files.extend(dir_path.glob(f'*{ext}'))

            icon_files = [str(f) for f in icon_files]

            # Batch analyze
            result = self.analyzer.batch_analyze(
                image_paths=icon_files,
                include_ocr=include_ocr,
                include_colors=include_colors,
                include_hash=True
            )

            result['directory'] = directory

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Directory scan failed: {str(e)}'
            }

    async def get_icon_hash(self, params: dict) -> dict:
        """
        Get perceptual hash for icon deduplication

        Args:
            params: {
                'image_path': str  # Path to icon
            }

        Returns:
            dict: {
                'success': bool,
                'image_path': str,
                'perceptual_hash': str,
                'md5_hash': str
            }
        """
        try:
            image_path = params.get('image_path')
            if not image_path:
                return {
                    'success': False,
                    'error': 'image_path is required'
                }

            result = self.analyzer.analyze_icon(
                image_path=image_path,
                include_ocr=False,
                include_colors=False,
                include_hash=True
            )

            if not result['success']:
                return result

            return {
                'success': True,
                'image_path': image_path,
                **result.get('hash', {})
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Hash calculation failed: {str(e)}'
            }

    # ==================== Image Slicing/Cropping Methods ====================

    async def slice_image_equal(self, params: dict) -> dict:
        """
        Slice image into equal parts

        Args:
            params: {
                'image_path': str,  # Input image path
                'count': int,  # Number of equal parts
                'direction': str,  # 'horizontal' or 'vertical', default 'vertical'
                'output_dir': str,  # Optional, output directory
                'name_pattern': str  # Optional, naming pattern with {index}
            }

        Returns:
            dict: {
                'success': bool,
                'output_files': list[str],
                'part_count': int,
                'direction': str,
                'part_size': str
            }
        """
        try:
            image_path = params.get('image_path')
            count = params.get('count')

            if not image_path:
                return {'success': False, 'error': 'image_path is required'}
            if not count:
                return {'success': False, 'error': 'count is required'}

            direction = params.get('direction', 'vertical')
            output_dir = params.get('output_dir')
            name_pattern = params.get('name_pattern', 'part_{index}')

            result = self.image_tools.split_image_equal(
                image_path=image_path,
                count=count,
                direction=direction,
                output_dir=output_dir,
                name_pattern=name_pattern
            )

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Equal slice failed: {str(e)}'
            }

    async def slice_image_custom(self, params: dict) -> dict:
        """
        Slice image at custom positions

        Args:
            params: {
                'image_path': str,  # Input image path
                'split_points': list[int],  # Split positions in pixels
                'direction': str,  # 'horizontal' or 'vertical', default 'vertical'
                'output_dir': str,  # Optional, output directory
                'name_pattern': str  # Optional, naming pattern
            }

        Returns:
            dict: {
                'success': bool,
                'output_files': list[str],
                'part_count': int,
                'split_points': list[int],
                'direction': str
            }
        """
        try:
            image_path = params.get('image_path')
            split_points = params.get('split_points')

            if not image_path:
                return {'success': False, 'error': 'image_path is required'}
            if not split_points:
                return {'success': False, 'error': 'split_points is required'}

            direction = params.get('direction', 'vertical')
            output_dir = params.get('output_dir')
            name_pattern = params.get('name_pattern', 'part_{index}')

            result = self.image_tools.split_image_custom(
                image_path=image_path,
                split_points=split_points,
                direction=direction,
                output_dir=output_dir,
                name_pattern=name_pattern
            )

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Custom slice failed: {str(e)}'
            }

    async def slice_image_grid(self, params: dict) -> dict:
        """
        Slice image into grid (rows x cols)

        Args:
            params: {
                'image_path': str,  # Input image path
                'rows': int,  # Number of rows
                'cols': int,  # Number of columns
                'output_dir': str,  # Optional, output directory
                'name_pattern': str  # Optional, naming pattern with {row} and {col}
            }

        Returns:
            dict: {
                'success': bool,
                'output_files': list[str],
                'grid_size': str,
                'tile_size': str,
                'total_tiles': int
            }
        """
        try:
            image_path = params.get('image_path')
            rows = params.get('rows')
            cols = params.get('cols')

            if not image_path:
                return {'success': False, 'error': 'image_path is required'}
            if not rows:
                return {'success': False, 'error': 'rows is required'}
            if not cols:
                return {'success': False, 'error': 'cols is required'}

            output_dir = params.get('output_dir')
            name_pattern = params.get('name_pattern', 'tile_{row}_{col}')

            result = self.image_tools.split_image_grid(
                image_path=image_path,
                rows=rows,
                cols=cols,
                output_dir=output_dir,
                name_pattern=name_pattern
            )

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Grid slice failed: {str(e)}'
            }

    async def slice_sprite_sheet(self, params: dict) -> dict:
        """
        Slice sprite sheet into individual sprites

        Args:
            params: {
                'image_path': str,  # Input sprite sheet path
                'sprite_width': int,  # Width of each sprite
                'sprite_height': int,  # Height of each sprite
                'output_dir': str,  # Optional, output directory
                'name_pattern': str,  # Optional, naming pattern
                'direction': str  # Optional, 'horizontal' or 'vertical'
            }

        Returns:
            dict: {
                'success': bool,
                'output_files': list[str],
                'sprite_size': str,
                'sprite_count': int,
                'direction': str
            }
        """
        try:
            image_path = params.get('image_path')
            sprite_width = params.get('sprite_width')
            sprite_height = params.get('sprite_height')

            if not image_path:
                return {'success': False, 'error': 'image_path is required'}
            if not sprite_width:
                return {'success': False, 'error': 'sprite_width is required'}
            if not sprite_height:
                return {'success': False, 'error': 'sprite_height is required'}

            output_dir = params.get('output_dir')
            name_pattern = params.get('name_pattern', 'sprite_{index}')
            direction = params.get('direction', 'horizontal')

            result = self.image_tools.split_sprite_sheet(
                image_path=image_path,
                sprite_width=sprite_width,
                sprite_height=sprite_height,
                output_dir=output_dir,
                name_pattern=name_pattern,
                direction=direction
            )

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Sprite slice failed: {str(e)}'
            }

    async def crop_image(self, params: dict) -> dict:
        """
        Crop image to specified rectangle

        Args:
            params: {
                'image_path': str,  # Input image path
                'x': int,  # Left coordinate
                'y': int,  # Top coordinate
                'width': int,  # Crop width
                'height': int,  # Crop height
                'output_path': str  # Optional, output path
            }

        Returns:
            dict: {
                'success': bool,
                'output_path': str,
                'original_size': str,
                'crop_area': str,
                'cropped_size': str
            }
        """
        try:
            image_path = params.get('image_path')
            x = params.get('x')
            y = params.get('y')
            width = params.get('width')
            height = params.get('height')

            if not image_path:
                return {'success': False, 'error': 'image_path is required'}
            if x is None or y is None:
                return {'success': False, 'error': 'x and y coordinates are required'}
            if not width or not height:
                return {'success': False, 'error': 'width and height are required'}

            output_path = params.get('output_path')

            result = self.image_tools.crop_image(
                image_path=image_path,
                x=x,
                y=y,
                width=width,
                height=height,
                output_path=output_path
            )

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Crop failed: {str(e)}'
            }

    async def create_image_grid(self, params: dict) -> dict:
        """
        Create image grid/collage from multiple images

        Args:
            params: {
                'image_paths': list[str],  # List of image paths
                'cols': int,  # Number of columns
                'output_path': str,  # Output path
                'spacing': int,  # Optional, space between images
                'background_color': str,  # Optional, background color
                'cell_width': int,  # Optional, fixed cell width
                'cell_height': int,  # Optional, fixed cell height
                'resize_mode': str  # Optional, 'fit', 'fill', or 'stretch'
            }

        Returns:
            dict: {
                'success': bool,
                'output_path': str,
                'grid_size': str,
                'cell_size': str,
                'image_count': int
            }
        """
        try:
            image_paths = params.get('image_paths')
            cols = params.get('cols')
            output_path = params.get('output_path')

            if not image_paths:
                return {'success': False, 'error': 'image_paths is required'}
            if not cols:
                return {'success': False, 'error': 'cols is required'}
            if not output_path:
                return {'success': False, 'error': 'output_path is required'}

            spacing = params.get('spacing', 0)
            background_color = params.get('background_color', 'white')
            cell_width = params.get('cell_width')
            cell_height = params.get('cell_height')
            resize_mode = params.get('resize_mode', 'fit')

            result = self.image_tools.create_image_grid(
                image_paths=image_paths,
                cols=cols,
                output_path=output_path,
                spacing=spacing,
                background_color=background_color,
                cell_width=cell_width,
                cell_height=cell_height,
                resize_mode=resize_mode
            )

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Grid creation failed: {str(e)}'
            }
