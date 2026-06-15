"""
OCR CnOCR Engine Module (pycore generic).
Uses pycore third_party: get_third_package_cnocr, get_third_package_PIL_Image, get_third_package_numpy.
Supports context (GPU/CPU) with CPU fallback, rec_model fallbacks (e.g. free doc model first), cand_alphabet for number-only.
"""
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

pytools_dir = Path(__file__).parent.parent
sys.path.insert(0, str(pytools_dir))

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import get_cnocr_pip_package
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.pybasecommon.compute_caps import is_onnx_cuda_usable
from pycore.pyfoundations.third_party import REC_MORE_CONFIGS_CNOCR
from pycore.pyfoundations.third_party import (
    get_third_package_cnocr,
    get_third_package_PIL_Image,
    get_third_package_numpy,
)

try:
    import torch
except ImportError:
    torch = None

Image = get_third_package_PIL_Image()
np = get_third_package_numpy()


def _cuda_diagnostic() -> Tuple[Tuple[str, ...], str]:
    """
    Diagnose why CUDA is or is not loading. Returns (context_order, reason).
    Ref: PyTorch torch.cuda.is_available(); CPU-only build has torch.version.cuda None/empty.
    """
    if torch is None:
        return ("cpu",), "Could not import torch (install e.g. pip install torch)."
    try:
        cuda_compiled = getattr(torch.version, "cuda", None)
        if cuda_compiled is None or (isinstance(cuda_compiled, str) and cuda_compiled.strip() == ""):
            return ("cpu",), (
                "PyTorch is CPU-only (not compiled with CUDA). "
                "To use GPU: install CUDA build from https://pytorch.org/get-started/locally "
                "(e.g. pip install torch --index-url https://download.pytorch.org/whl/cu126)."
            )
        if not torch.cuda.is_available():
            return ("cpu",), (
                "PyTorch is CUDA-built but torch.cuda.is_available() is False "
                "(NVIDIA driver/CUDA runtime issue or no GPU). Check driver and nvidia-smi."
            )
        return ("gpu", "cpu"), "CUDA available; will try GPU first."
    except Exception as e:
        return ("cpu",), f"Could not check torch CUDA: {e}."


class CnOCREngine:
    """
    OCR engine over CnOCR. Lazy-loaded via pycore third_party.
    When prewarmed_instance is provided (from get_cnocr_prewarmed), uses it directly and skips init (per OCR_INIT doc).
    - context: try GPU then CPU (fallback when no GPU / CUDA not available).
    - rec_model_fallbacks: if primary rec model fails (e.g. paid model missing), try these (e.g. doc-densenet_lite_136-gru).
    - cand_alphabet: optional, e.g. '0123456789' for number-only (use with number-densenet_lite_136-fc).
    """

    def __init__(
        self,
        det_model_name: str = "naive_det",
        rec_model_name: str = "doc-densenet_lite_136-gru",
        rec_model_fallbacks: Optional[List[str]] = None,
        cand_alphabet: Optional[str] = None,
        prewarmed_instance: Optional[Any] = None,
    ):
        self.det_model_name = det_model_name
        self.rec_model_name = rec_model_name
        self.rec_model_fallbacks = rec_model_fallbacks or []
        self.cand_alphabet = cand_alphabet
        self._ocr_instance = None
        self._initialized = False
        self._effective_context: Optional[str] = None
        self._effective_rec_model: Optional[str] = None
        if prewarmed_instance is not None:
            self._ocr_instance = prewarmed_instance
            self._initialized = True
            self._effective_context = "gpu" if is_onnx_cuda_usable() else "cpu"
            self._effective_rec_model = rec_model_name

    def init(self) -> bool:
        """
        Initialize CnOCR engine. No-op when prewarmed_instance was provided. Otherwise tries (context, rec_model)
        in order: gpu then cpu, primary rec_model then rec_model_fallbacks. First success wins.
        """
        if self._initialized:
            ColorPrint.blue("[CnOCREngine] OCR already initialized (prewarmed or previous init), skipping")
            return True

        cnocr_module = get_third_package_cnocr()
        if cnocr_module is None:
            ColorPrint.red("[CnOCREngine] cnocr not available (install: pip install %s)" % get_cnocr_pip_package())
            return False

        ColorPrint.yellow(f"\n{'=' * 60}")
        ColorPrint.yellow("[CnOCREngine] Initializing CnOCR Engine")
        ColorPrint.yellow(f"{'=' * 60}\n")
        ColorPrint.blue("[CnOCREngine] Loading CnOCR models...")
        ColorPrint.blue(f"[CnOCREngine] Detection model: {self.det_model_name}")
        ColorPrint.blue(f"[CnOCREngine] Recognition model: {self.rec_model_name}")

        CnOcr = cnocr_module.CnOcr
        rec_models = [self.rec_model_name] + self.rec_model_fallbacks
        last_error = None
        context_order = ('gpu', 'cpu') if CUDADetector.is_cuda_available() else ('cpu',)
        _, cuda_reason = _cuda_diagnostic()
        ColorPrint.blue(f"[CnOCREngine] CUDA diagnostic: {cuda_reason}")

        for context in context_order:
            for rec in rec_models:
                kwargs = {
                    "det_model_name": self.det_model_name,
                    "rec_model_name": rec,
                    "context": context,
                    "rec_more_configs": REC_MORE_CONFIGS_CNOCR,
                }
                if self.cand_alphabet is not None:
                    kwargs["cand_alphabet"] = self.cand_alphabet
                try:
                    self._ocr_instance = CnOcr(**kwargs)
                    self._initialized = True
                    self._effective_context = context
                    self._effective_rec_model = rec
                    ColorPrint.green(f"\n{'=' * 60}")
                    ColorPrint.green("[CnOCREngine] Engine initialized successfully!")
                    ColorPrint.green(f"  Detection model: {self.det_model_name}")
                    ColorPrint.green(f"  Recognition model: {self._effective_rec_model}")
                    ColorPrint.green(f"  Context: {self._effective_context}")
                    if self._effective_context == "gpu":
                        ColorPrint.green("  CUDA loaded: yes")
                    else:
                        ColorPrint.green(f"  CUDA loaded: no. Reason: {cuda_reason}")
                    ColorPrint.green(f"{'=' * 60}\n")
                    return True
                except Exception as e:
                    last_error = e
                    ColorPrint.gray(f"[CnOCREngine] Init failed (context={context}, rec={rec}): {e}")
                    continue

        ColorPrint.red(f"\n{'=' * 60}")
        ColorPrint.red(f"[CnOCREngine] Engine initialization failed: {last_error}")
        ColorPrint.red(f"{'=' * 60}\n")
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
        img_path: Optional[Union[str, Path]] = None,
        image: Optional[Union[Any, "Image.Image"]] = None,
        grid_position: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Perform OCR recognition. Pass either img_path (file path) or image (PIL Image / ndarray); in-memory image avoids disk I/O.

        Args:
            img_path: Image file path (use when image is None)
            image: In-memory image as PIL Image or numpy ndarray (use when img_path is None)
            grid_position: Grid position (1-9), None means recognize entire image

        Returns:
            Dict containing:
                - text: Recognized text content
                - raw_result: Raw OCR result (each item has 'text' and 'position' when det model is used;
                  per cnocr doc, position is None when det_model_name=='naive_det')
                - offset: Coordinate offset (x_offset, y_offset)
                - region: Recognition region (left, top, right, bottom)
        """
        if not self._initialized:
            raise RuntimeError("OCR not initialized, please call init() first")
        if image is None and img_path is None:
            raise ValueError("Provide either img_path or image")
        if image is not None and img_path is not None:
            raise ValueError("Provide only one of img_path or image")

        # Load image: from path or use in-memory image (PIL or ndarray)
        if image is not None:
            if hasattr(image, "mode"):
                img = image
            else:
                img = Image.fromarray(np.asarray(image))
        else:
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

        # Convert to numpy array and run OCR with already-initialized engine
        img_array = np.array(img)
        ocr_result = self._ocr_instance.ocr(img_array)

        # Normalize items: ensure 'position' is list of [x,y] (cnocr may return ndarray)
        def _normalize_item(it: Dict) -> Dict:
            out = dict(it)
            pos = out.get("position")
            if pos is not None and hasattr(pos, "tolist"):
                out["position"] = pos.tolist()
            elif pos is not None and isinstance(pos, (list, tuple)) and len(pos) >= 4:
                out["position"] = [[float(p[0]), float(p[1])] for p in pos[:4]]
            return out

        ocr_result = [_normalize_item(it) for it in (ocr_result or [])]

        # Extract text content
        text_lines = [item.get("text", "") for item in ocr_result]
        full_text = "\n".join(text_lines)

        # Adjust coordinates if offset exists
        adjusted_result = ocr_result
        if offset != (0, 0):
            adjusted_result = []
            for item in ocr_result:
                adjusted_item = item.copy()
                if "position" in adjusted_item:
                    pos = adjusted_item["position"]
                    adjusted_item["position"] = [
                        [p[0] + offset[0], p[1] + offset[1]] for p in pos
                    ]
                adjusted_result.append(adjusted_item)

        return {
            "text": full_text,
            "raw_result": adjusted_result,
            "offset": offset,
            "region": region,
            "grid_position": grid_position,
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
def create_ocr(
    det_model_name: str = "naive_det",
    rec_model_name: str = "doc-densenet_lite_136-gru",
    rec_model_fallbacks: Optional[List[str]] = None,
    cand_alphabet: Optional[str] = None,
) -> CnOCREngine:
    """
    Create and initialize OCR tool.

    Args:
        det_model_name: Detection model name
        rec_model_name: Recognition model name (prefer free: doc-densenet_lite_136-gru)
        rec_model_fallbacks: Fallback rec models if primary fails
        cand_alphabet: Optional e.g. '0123456789' for number-only

    Returns:
        CnOCREngine: Initialized CnOCR engine instance
    """
    ocr = CnOCREngine(
        det_model_name=det_model_name,
        rec_model_name=rec_model_name,
        rec_model_fallbacks=rec_model_fallbacks,
        cand_alphabet=cand_alphabet,
    )
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
