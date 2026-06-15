"""
OCR engine using Windows native OCR (WinRT Windows.Media.Ocr).
Same interface as CnOCREngine: init(), ocr(), ocr_for_single_line().
Uses pycore third_party: get_third_package_windows_ocr, get_third_package_PIL_Image, get_third_package_numpy.
Windows only; returns same dict shape as CnOCREngine (text, raw_result, offset, region, grid_position).
Ref: https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr
"""
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import (
    get_third_package_PIL_Image,
    get_third_package_numpy,
    get_third_package_windows_ocr,
)

Image = get_third_package_PIL_Image()
np = get_third_package_numpy()


def _run_coro_blocking(coro: Any) -> Any:
    """
    Run a coroutine to completion from ANY context.

    The screenshot pipeline runs inside `asyncio.run(...)`, so a plain
    `asyncio.run()` here raises "cannot be called from a running event loop".
    When a loop is already running in this thread, run the coroutine on a fresh
    loop in a worker thread instead; otherwise run it directly.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        return ex.submit(lambda: asyncio.run(coro)).result()


def _pil_to_software_bitmap(img: "Image.Image", winrt_ns: Any) -> Any:
    """Convert PIL Image to WinRT SoftwareBitmap (Gray8)."""
    img_gray = img.convert("L")
    w, h = img_gray.size
    data = img_gray.tobytes()
    from winrt.windows.storage.streams import DataWriter
    dw = DataWriter()
    dw.write_bytes(data)
    buf = dw.detach_buffer()
    SoftwareBitmap = winrt_ns.SoftwareBitmap
    BitmapPixelFormat = winrt_ns.BitmapPixelFormat
    return SoftwareBitmap.create_copy_from_buffer(
        buf,
        BitmapPixelFormat.GRAY8,
        w,
        h,
    )


def _ocr_result_to_raw_result(ocr_result: Any) -> List[Dict[str, Any]]:
    """
    Convert WinRT OcrResult to a list of {text, position}, ONE ENTRY PER LINE.

    Emitting per-WORD made every word its own OCR line → its own TTS segment /
    queue item (the "garbage" explosion). We join each line's words into one
    line of text with a bounding box spanning its words, matching CnOCR's
    line-level granularity.
    """
    raw: List[Dict[str, Any]] = []
    for line in ocr_result.lines:
        # Prefer the line's own text; fall back to joining its words.
        line_text = getattr(line, "text", None) or getattr(line, "Text", None)
        words = list(getattr(line, "words", []) or [])
        if not line_text:
            line_text = " ".join(
                (getattr(w, "text", None) or getattr(w, "Text", "") or "") for w in words
            ).strip()
        if not line_text:
            continue

        # Bounding box = union of the line's word rects (best-effort).
        xs0, ys0, xs1, ys1 = [], [], [], []
        for w in words:
            rect = getattr(w, "bounding_rect", None) or getattr(w, "BoundingRect", None)
            if rect is None:
                continue
            x, y, ww, hh = float(rect.x), float(rect.y), float(rect.width), float(rect.height)
            xs0.append(x); ys0.append(y); xs1.append(x + ww); ys1.append(y + hh)
        if xs0:
            x0, y0, x1, y1 = min(xs0), min(ys0), max(xs1), max(ys1)
            position = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
        else:
            position = [[0, 0], [0, 0], [0, 0], [0, 0]]
        raw.append({"text": line_text, "position": position})
    return raw


class WindowsOCREngine:
    """
    OCR engine using Windows.Media.Ocr (WinRT). Same API as CnOCREngine.
    init() creates OcrEngine via TryCreateFromUserProfileLanguages or TryCreateFromLanguage.
    ocr() / ocr_for_single_line() return same dict shape as CnOCREngine.
    """

    def __init__(self):
        self._engine: Any = None
        self._winrt_ns: Any = None
        self._initialized = False

    def init(self) -> bool:
        """Create OcrEngine from user profile languages or fallback to en-US. Windows only."""
        if self._initialized:
            ColorPrint.blue("[WindowsOCREngine] OCR already initialized, skipping")
            return True

        winrt_ns = get_third_package_windows_ocr()
        if winrt_ns is None:
            ColorPrint.red(
                "[WindowsOCREngine] Windows OCR (WinRT) not available. "
                "Install: pip install winrt-Windows.Media.Ocr winrt-Windows.Graphics.Imaging "
                "winrt-Windows.Storage.Streams winrt-Windows.Globalization"
            )
            return False

        self._winrt_ns = winrt_ns
        OcrEngine = winrt_ns.OcrEngine
        Language = winrt_ns.Language

        engine = None
        try:
            engine = OcrEngine.try_create_from_user_profile_languages()
        except Exception:
            pass
        if engine is None:
            for lang_tag in ("en-US", "zh-Hans-CN", "zh-CN"):
                try:
                    lang = Language(lang_tag)
                    if OcrEngine.is_language_supported(lang):
                        engine = OcrEngine.try_create_from_language(lang)
                        if engine is not None:
                            break
                except Exception:
                    continue
        if engine is None:
            ColorPrint.red("[WindowsOCREngine] No OCR language available on this device.")
            return False

        self._engine = engine
        self._initialized = True
        ColorPrint.green("[WindowsOCREngine] Initialized (Windows.Media.Ocr)")
        return True

    def _calculate_grid_region(
        self,
        img_width: int,
        img_height: int,
        grid_position: int,
    ) -> Tuple[int, int, int, int]:
        """Same 9-grid layout as CnOCREngine."""
        if not 1 <= grid_position <= 9:
            raise ValueError("grid_position must be between 1-9")
        grid_width = img_width // 3
        grid_height = img_height // 3
        row = (grid_position - 1) // 3
        col = (grid_position - 1) % 3
        left = col * grid_width
        top = row * grid_height
        right = left + grid_width
        bottom = top + grid_height
        return (left, top, right, bottom)

    async def _recognize_async(self, bitmap: Any) -> Any:
        """Run RecognizeAsync and return OcrResult."""
        return await self._engine.recognize_async(bitmap)

    def _recognize_sync(self, img: "Image.Image") -> List[Dict[str, Any]]:
        """Convert PIL to SoftwareBitmap, run OCR, return raw_result list."""
        bitmap = _pil_to_software_bitmap(img, self._winrt_ns)
        # Loop-safe: works whether or not an event loop is already running in
        # this thread (the screenshot pipeline runs inside asyncio.run).
        ocr_result = _run_coro_blocking(self._recognize_async(bitmap))
        return _ocr_result_to_raw_result(ocr_result)

    def ocr(
        self,
        img_path: Optional[Union[str, Path]] = None,
        image: Optional[Union[Any, "Image.Image"]] = None,
        grid_position: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Same contract as CnOCREngine.ocr(): returns text, raw_result, offset, region, grid_position.
        """
        if not self._initialized:
            raise RuntimeError("OCR not initialized, please call init() first")
        if image is None and img_path is None:
            raise ValueError("Provide either img_path or image")
        if image is not None and img_path is not None:
            raise ValueError("Provide only one of img_path or image")

        if image is not None:
            img = image if hasattr(image, "mode") else Image.fromarray(np.asarray(image))
        else:
            img = Image.open(img_path)
        img_width, img_height = img.size

        offset = (0, 0)
        region = (0, 0, img_width, img_height)

        if grid_position is not None:
            left, top, right, bottom = self._calculate_grid_region(
                img_width, img_height, grid_position
            )
            img = img.crop((left, top, right, bottom))
            offset = (left, top)
            region = (left, top, right, bottom)

        raw_result = self._recognize_sync(img)

        if offset != (0, 0):
            adjusted = []
            for item in raw_result:
                adj = item.copy()
                if "position" in adj:
                    adj["position"] = [
                        [p[0] + offset[0], p[1] + offset[1]] for p in adj["position"]
                    ]
                adjusted.append(adj)
            raw_result = adjusted

        text_lines = [item.get("text", "") for item in raw_result]
        full_text = "\n".join(text_lines)

        return {
            "text": full_text,
            "raw_result": raw_result,
            "offset": offset,
            "region": region,
            "grid_position": grid_position,
        }

    def ocr_for_single_line(
        self,
        img_path: Union[str, Path],
        grid_position: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Same contract as CnOCREngine.ocr_for_single_line()."""
        return self.ocr(img_path=img_path, grid_position=grid_position)


def create_windows_ocr() -> Optional[WindowsOCREngine]:
    """Create and initialize Windows OCR engine. Returns None if not Windows or init fails."""
    engine = WindowsOCREngine()
    if engine.init():
        return engine
    return None
