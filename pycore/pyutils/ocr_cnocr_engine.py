"""
OCR CnOCR Engine Module
Supports auto-dependency installation, 9-grid region recognition, and offset calculation
Uses CnOCR engine for Chinese OCR recognition
"""
import sys
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
from typing import Optional, Tuple, List, Dict, Any, Union
from pathlib import Path
import importlib.util
import subprocess

# Add parent directory to path for ColorPrint
pytools_dir = Path(__file__).parent.parent
sys.path.insert(0, str(pytools_dir))

from pyfoundations.color_print import ColorPrint


class CnOCREngine:
    """
    OCR Recognition Tool Class

    Features:
    1. Auto-detect and install cnocr dependencies
    2. Support 9-grid region recognition (1-9)
    3. Return recognition results and coordinate offsets
    4. Default support for Chinese, Traditional Chinese, English, and numbers

    Usage Example:
        ocr = OCRTool()
        ocr.init()

        # Recognize entire image
        result = ocr.ocr('image.png')

        # Recognize grid position 5 (center)
        result = ocr.ocr('image.png', grid_position=5)
    """

    def __init__(self, det_model_name: str = 'naive_det', rec_model_name: str = 'densenet_lite_136-gru'):
        """
        Initialize OCR Tool

        Args:
            det_model_name: Detection model name, default 'naive_det'
            rec_model_name: Recognition model name, default 'densenet_lite_136-gru' (supports Chinese, English, numbers)
        """
        self.det_model_name = det_model_name
        self.rec_model_name = rec_model_name
        self._ocr_instance = None
        self._initialized = False

    def _check_package_installed(self, package_name: str) -> bool:
        """
        Check if package is installed

        Args:
            package_name: Package name

        Returns:
            bool: Whether installed
        """
        try:
            importlib.import_module(package_name)
            return True
        except ImportError:
            return False

    def _install_package(self, package_spec: str) -> bool:
        """
        Install package using python -m pip with real-time output

        Args:
            package_spec: Package specification, e.g., 'cnocr[ort-cpu]'

        Returns:
            bool: Whether installation succeeded
        """
        try:
            ColorPrint.yellow(f"\n{'=' * 60}")
            ColorPrint.yellow(f"Installing package: {package_spec}")
            ColorPrint.blue(f"Command: {sys.executable} -m pip install {package_spec}")
            ColorPrint.yellow(f"{'=' * 60}\n")

            # Use Popen for real-time output
            process = subprocess.Popen(
                [sys.executable, '-m', 'pip', 'install', package_spec],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            # Print output in real-time
            for line in iter(process.stdout.readline, ''):
                if line:
                    ColorPrint.gray(line.rstrip())

            process.wait()

            if process.return_code == 0:
                ColorPrint.green(f"\n{'=' * 60}")
                ColorPrint.green(f"Package {package_spec} installed successfully!")
                ColorPrint.green(f"{'=' * 60}\n")
                return True
            else:
                ColorPrint.red(f"\n{'=' * 60}")
                ColorPrint.red(f"Package {package_spec} installation failed with code {process.return_code}")
                ColorPrint.red(f"{'=' * 60}\n")
                return False

        except Exception as e:
            ColorPrint.red(f"\n{'=' * 60}")
            ColorPrint.red(f"Failed to install {package_spec}: {e}")
            ColorPrint.red(f"{'=' * 60}\n")
            return False

    def init(self) -> bool:
        """
        Initialize CnOCR engine
        Auto-detect and install necessary dependencies

        Returns:
            bool: Whether initialization succeeded
        """
        if self._initialized:
            ColorPrint.blue("[CnOCREngine] OCR already initialized, skipping re-initialization")
            return True

        ColorPrint.yellow(f"\n{'=' * 60}")
        ColorPrint.yellow("[CnOCREngine] Initializing CnOCR Engine")
        ColorPrint.yellow(f"{'=' * 60}\n")

        # Check if cnocr is installed
        ColorPrint.blue("[CnOCREngine] Checking cnocr package...")
        if not self._check_package_installed('cnocr'):
            ColorPrint.yellow("[CnOCREngine] cnocr not detected, installing cnocr[ort-cpu]...")
            if not self._install_package('cnocr[ort-cpu]'):
                ColorPrint.red("[CnOCREngine] cnocr installation failed, please install manually: pip install cnocr[ort-cpu]")
                return False
            ColorPrint.green("[CnOCREngine] cnocr installed successfully")
        else:
            ColorPrint.green("[CnOCREngine] cnocr already installed, skipping installation")

        # Check PIL/Pillow
        ColorPrint.blue("[CnOCREngine] Checking Pillow package...")
        if not self._check_package_installed('PIL'):
            ColorPrint.yellow("[CnOCREngine] Pillow not detected, installing...")
            if not self._install_package('Pillow'):
                ColorPrint.red("[CnOCREngine] Pillow installation failed")
                return False
            ColorPrint.green("[CnOCREngine] Pillow installed successfully")
        else:
            ColorPrint.green("[CnOCREngine] Pillow already installed")

        # Check numpy
        ColorPrint.blue("[CnOCREngine] Checking numpy package...")
        if not self._check_package_installed('numpy'):
            ColorPrint.yellow("[CnOCREngine] numpy not detected, installing...")
            if not self._install_package('numpy'):
                ColorPrint.red("[CnOCREngine] numpy installation failed")
                return False
            ColorPrint.green("[CnOCREngine] numpy installed successfully")
        else:
            ColorPrint.green("[CnOCREngine] numpy already installed")

        # Import and initialize CnOcr
        try:
            ColorPrint.blue(f"\n[CnOCREngine] Loading CnOCR models...")
            ColorPrint.blue(f"[CnOCREngine] Detection model: {self.det_model_name}")
            ColorPrint.blue(f"[CnOCREngine] Recognition model: {self.rec_model_name}")

            from cnocr import CnOcr
            self._ocr_instance = CnOcr(
                det_model_name=self.det_model_name,
                rec_model_name=self.rec_model_name
            )
            self._initialized = True

            ColorPrint.green(f"\n{'=' * 60}")
            ColorPrint.green(f"[CnOCREngine] Engine initialized successfully!")
            ColorPrint.green(f"  Detection model: {self.det_model_name}")
            ColorPrint.green(f"  Recognition model: {self.rec_model_name}")
            ColorPrint.green(f"{'=' * 60}\n")
            return True
        except Exception as e:
            ColorPrint.red(f"\n{'=' * 60}")
            ColorPrint.red(f"[CnOCREngine] Engine initialization failed: {e}")
            ColorPrint.red(f"{'=' * 60}\n")
            import traceback
            traceback.print_exc()
            return False

    def _calculate_grid_region(
        self,
        img_width: int,
        img_height: int,
        grid_position: int
    ) -> Tuple[int, int, int, int]:
        """
        Calculate 9-grid region coordinates

        Grid layout:
        1  2  3
        4  5  6
        7  8  9

        Args:
            img_width: Image width
            img_height: Image height
            grid_position: Grid position (1-9)

        Returns:
            Tuple[left, top, right, bottom]: Region coordinates
        """
        if not 1 <= grid_position <= 9:
            raise ValueError("grid_position must be between 1-9")

        # Calculate grid cell width and height
        grid_width = img_width // 3
        grid_height = img_height // 3

        # Calculate row and column index (0-based)
        row = (grid_position - 1) // 3
        col = (grid_position - 1) % 3

        # Calculate region coordinates
        left = col * grid_width
        top = row * grid_height
        right = left + grid_width
        bottom = top + grid_height

        return (left, top, right, bottom)

    def ocr(
        self,
        img_path: Union[str, Path],
        grid_position: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Perform OCR recognition

        Args:
            img_path: Image path
            grid_position: Grid position (1-9), None means recognize entire image

        Returns:
            Dict containing:
                - text: Recognized text content
                - raw_result: Raw OCR result
                - offset: Coordinate offset (x_offset, y_offset)
                - region: Recognition region (left, top, right, bottom)
        """
        if not self._initialized:
            raise RuntimeError("OCR not initialized, please call init() first")

        from PIL import Image
        import numpy as np

        # Load image
        img = Image.open(img_path)
        img_width, img_height = img.size

        # Initialize offset and region
        offset = (0, 0)
        region = (0, 0, img_width, img_height)

        # Crop image if grid position specified
        if grid_position is not None:
            left, top, right, bottom = self._calculate_grid_region(
                img_width, img_height, grid_position
            )
            img = img.crop((left, top, right, bottom))
            offset = (left, top)
            region = (left, top, right, bottom)

        # Convert to numpy array
        img_array = np.array(img)

        # Perform OCR recognition
        ocr_result = self._ocr_instance.ocr(img_array)

        # Extract text content
        text_lines = [item['text'] for item in ocr_result]
        full_text = '\n'.join(text_lines)

        # Adjust coordinates if offset exists
        adjusted_result = ocr_result
        if offset != (0, 0):
            adjusted_result = []
            for item in ocr_result:
                adjusted_item = item.copy()
                if 'position' in adjusted_item:
                    # Adjust position coordinates
                    pos = adjusted_item['position']
                    adjusted_item['position'] = [
                        [p[0] + offset[0], p[1] + offset[1]] for p in pos
                    ]
                adjusted_result.append(adjusted_item)

        return {
            'text': full_text,
            'raw_result': adjusted_result,
            'offset': offset,
            'region': region,
            'grid_position': grid_position
        }

    def ocr_for_single_line(
        self,
        img_path: Union[str, Path],
        grid_position: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Recognize single line text

        Args:
            img_path: Image path
            grid_position: Grid position (1-9), None means recognize entire image

        Returns:
            Dict containing recognition result and offset info
        """
        if not self._initialized:
            raise RuntimeError("OCR not initialized, please call init() first")

        from PIL import Image
        import numpy as np

        # Load image
        img = Image.open(img_path)
        img_width, img_height = img.size

        # Initialize offset and region
        offset = (0, 0)
        region = (0, 0, img_width, img_height)

        # Crop image if grid position specified
        if grid_position is not None:
            left, top, right, bottom = self._calculate_grid_region(
                img_width, img_height, grid_position
            )
            img = img.crop((left, top, right, bottom))
            offset = (left, top)
            region = (left, top, right, bottom)

        # Convert to numpy array
        img_array = np.array(img)

        # Perform single line OCR recognition
        ocr_result = self._ocr_instance.ocr_for_single_line(img_array)

        return {
            'text': ocr_result['text'],
            'raw_result': ocr_result,
            'offset': offset,
            'region': region,
            'grid_position': grid_position
        }


# Convenience function
def create_ocr(det_model_name: str = 'naive_det', rec_model_name: str = 'densenet_lite_136-gru') -> CnOCREngine:
    """
    Create and initialize OCR tool

    Args:
        det_model_name: Detection model name
        rec_model_name: Recognition model name

    Returns:
        CnOCREngine: Initialized CnOCR engine instance
    """
    ocr = CnOCREngine(det_model_name=det_model_name, rec_model_name=rec_model_name)
    ocr.init()
    return ocr


if __name__ == '__main__':
    # Usage example
    print("=== CnOCR Engine Test ===\n")

    # Create OCR instance
    ocr = CnOCREngine(det_model_name='naive_det')

    # Initialize (auto-install dependencies)
    if ocr.init():
        print("\nInitialization successful!\n")

        # Example 1: Recognize entire image
        print("Example 1: Recognize entire image")
        print("result = ocr.ocr('image.png')")
        print("Returns: {'text': 'recognized text', 'offset': (0, 0), 'region': (0, 0, width, height)}\n")

        # Example 2: Recognize grid position 5 (center)
        print("Example 2: Recognize grid position 5 (center)")
        print("result = ocr.ocr('image.png', grid_position=5)")
        print("Returns: {'text': 'recognized text', 'offset': (x, y), 'region': (left, top, right, bottom)}\n")

        print("Grid layout:")
        print("1  2  3")
        print("4  5  6")
        print("7  8  9")
    else:
        print("\nInitialization failed!")
