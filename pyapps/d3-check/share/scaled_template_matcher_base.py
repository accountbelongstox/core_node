#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scaled Template Matcher Base
Common logic only; no game constants or game-specific methods. D3 and D4 subclasses each
define their own constants and implement match_template_auto_scale using _match_single_with_scale.
Subclass provides: standard_width, standard_height, get_scale_factors(), get_template_config(template_name).
"""

from typing import Optional, Union, Dict, List, Tuple, Callable
from pathlib import Path

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.third_party import get_third_package_PIL_Image
from pycore.pyutils.image_matcher import ImageMatcher
from share.template_match_debug import notify_match

cv2 = get_third_package_cv2()
numpy = get_third_package_numpy()
np = numpy
Image = get_third_package_PIL_Image()

__all__ = ["ScaledTemplateMatcherBase", "cv2", "np", "Image", "numpy", "load_template_and_scale_by_resolution"]


def _ensure_provider_imports():
    """Return ColorPrint and ImageMatcher (imports at module top to avoid late-binding issues)."""
    return ColorPrint, ImageMatcher


def load_template_and_scale_by_resolution(
    template_path: Union[str, Path],
    window_width: int,
    window_height: int,
    standard_width: int,
    standard_height: int,
    log_prefix: str = "",
) -> Optional[np.ndarray]:
    """Load and scale template by window vs standard resolution; shared by Battle.net etc. Returns BGR/BGRA array or None."""
    path = Path(template_path)
    if not path.exists():
        return None
    img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    scale_x = window_width / standard_width
    scale_y = window_height / standard_height
    if abs(scale_x - 1.0) < 0.001 and abs(scale_y - 1.0) < 0.001:
        return img
    h, w = img.shape[:2]
    new_w = max(1, int(w * scale_x))
    new_h = max(1, int(h * scale_y))
    interp = cv2.INTER_AREA if (scale_x < 1.0 or scale_y < 1.0) else cv2.INTER_CUBIC
    return cv2.resize(img, (new_w, new_h), interpolation=interp)


class ScaledTemplateMatcherBase:
    """
    Base class for D3/D4 scaled template matchers. No game constants here; subclasses own their standard resolution.
    Subclass must set: standard_width, standard_height, get_scale_factors, get_template_config, log_prefix.
    Subclasses implement match_template_auto_scale using _match_single_with_scale and their own constants.
    """

    def __init__(
        self,
        standard_width: int,
        standard_height: int,
        get_scale_factors: Callable[[], Tuple[float, float]],
        get_template_config: Callable[[str], Optional[Dict]],
        log_prefix: str = "[ScaledMatcher]",
    ):
        self.standard_width = standard_width
        self.standard_height = standard_height
        self.get_scale_factors = get_scale_factors
        self.get_template_config = get_template_config
        self.log_prefix = log_prefix
        self._matchers: Dict = {}
        self._original_template_cache: Dict = {}
        self._template_cache: Dict = {}

    def _get_matcher(self, match_method: str):
        ColorPrint, ImageMatcher = _ensure_provider_imports()
        method_type = match_method.upper()
        cache_key = method_type
        feature_methods = ["SIFT", "ORB", "AKAZE"]
        template_method_map = {
            "TM_CCOEFF": cv2.TM_CCOEFF,
            "TM_CCOEFF_NORMED": cv2.TM_CCOEFF_NORMED,
            "TM_CCORR": cv2.TM_CCORR,
            "TM_CCORR_NORMED": cv2.TM_CCORR_NORMED,
            "TM_SQDIFF": cv2.TM_SQDIFF,
            "TM_SQDIFF_NORMED": cv2.TM_SQDIFF_NORMED
        }
        if method_type in feature_methods:
            if cache_key not in self._matchers:
                ColorPrint.blue(f"{self.log_prefix} Creating {method_type} feature matcher")
                self._matchers[cache_key] = ImageMatcher(
                    ratio_thresh=0.80,
                    min_inliers=4,
                    nfeatures=10000,
                    standard_width=self.standard_width,
                    standard_height=self.standard_height
                )
        else:
            if cache_key not in self._matchers:
                ColorPrint.blue(f"{self.log_prefix} Creating {method_type} template matcher")
                self._matchers[cache_key] = ImageMatcher(
                    ratio_thresh=0.80,
                    min_inliers=4,
                    nfeatures=10000,
                    standard_width=self.standard_width,
                    standard_height=self.standard_height
                )
        return self._matchers[cache_key]

    def _load_target_image(self, target_image: Union[str, Path, Image.Image, np.ndarray]) -> Optional[np.ndarray]:
        ColorPrint, _ = _ensure_provider_imports()
        try:
            if isinstance(target_image, np.ndarray):
                return target_image
            if isinstance(target_image, Image.Image):
                rgb_array = np.array(target_image)
                if len(rgb_array.shape) == 3 and rgb_array.shape[2] == 3:
                    return cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
                if len(rgb_array.shape) == 3 and rgb_array.shape[2] == 4:
                    return cv2.cvtColor(rgb_array, cv2.COLOR_RGBA2BGRA)
                return rgb_array
            img = cv2.imread(str(target_image), cv2.IMREAD_UNCHANGED)
            if img is None:
                ColorPrint.red(f"{self.log_prefix} Failed to load image from path: {target_image}")
            return img
        except Exception as e:
            ColorPrint.red(f"{self.log_prefix} Error loading target image: {e}")
            return None

    def _load_original_template(self, template_name: str) -> Optional[np.ndarray]:
        ColorPrint, _ = _ensure_provider_imports()
        if template_name in self._original_template_cache:
            ColorPrint.gray(f"{self.log_prefix} Using cached original template: {template_name}")
            return self._original_template_cache[template_name]
        cfg = self.get_template_config(template_name)
        if not cfg:
            ColorPrint.yellow(f"{self.log_prefix} Template not found: {template_name}")
            return None
        original_path = cfg.get("path")
        if not original_path or not Path(original_path).exists():
            ColorPrint.yellow(f"{self.log_prefix} Template file not found: {original_path}")
            return None
        try:
            ColorPrint.blue(f"{self.log_prefix} Loading original template from disk: {template_name}")
            template_img = cv2.imread(str(original_path), cv2.IMREAD_UNCHANGED)
            if template_img is None:
                ColorPrint.red(f"{self.log_prefix} Failed to load template: {original_path}")
                return None
            self._original_template_cache[template_name] = template_img
            ColorPrint.green(f"{self.log_prefix} Cached original template: {template_name}")
            return template_img
        except Exception as e:
            ColorPrint.red(f"{self.log_prefix} Error loading template {template_name}: {e}")
            return None

    def _get_scaled_template_image(
        self,
        template_name: str,
        scale_x: float,
        scale_y: float,
        force_refresh: bool = False
    ) -> Optional[np.ndarray]:
        ColorPrint, _ = _ensure_provider_imports()
        cache_key = (template_name, round(scale_x, 4), round(scale_y, 4))
        if not force_refresh and cache_key in self._template_cache:
            ColorPrint.gray(f"{self.log_prefix} Using cached scaled template: {template_name}")
            return self._template_cache[cache_key]
        template_img = self._load_original_template(template_name)
        if template_img is None:
            return None
        try:
            original_height, original_width = template_img.shape[:2]
            if abs(scale_x - 1.0) < 0.001 and abs(scale_y - 1.0) < 0.001:
                self._template_cache[cache_key] = template_img
                return template_img
            new_width = max(1, int(original_width * scale_x))
            new_height = max(1, int(original_height * scale_y))
            interp = cv2.INTER_AREA if (scale_x < 1.0 or scale_y < 1.0) else cv2.INTER_CUBIC
            scaled = cv2.resize(template_img, (new_width, new_height), interpolation=interp)
            self._template_cache[cache_key] = scaled
            return scaled
        except Exception as e:
            ColorPrint.red(f"{self.log_prefix} Error scaling template {template_name}: {e}")
            return None

    def match_template(
        self,
        target_image: Union[str, Path, Image.Image, np.ndarray],
        template_name: str,
        output_dir: Optional[Path] = None,
        force_refresh_scale: bool = False
    ) -> Dict:
        ColorPrint, _ = _ensure_provider_imports()
        ColorPrint.blue(f"\n{self.log_prefix} Matching template: {template_name}")
        scale_x, scale_y = self.get_scale_factors()
        scaled_template_img = self._get_scaled_template_image(
            template_name=template_name,
            scale_x=scale_x,
            scale_y=scale_y,
            force_refresh=force_refresh_scale
        )
        if scaled_template_img is None:
            return {"total_matches": 0, "matches": [], "error": "Failed to scale template"}
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            return {"total_matches": 0, "matches": [], "error": "Failed to load target image"}
        cfg = self.get_template_config(template_name)
        if not cfg:
            return {"total_matches": 0, "matches": [], "error": f"Template config not found: {template_name}"}
        threshold = cfg.get("threshold", 0.8)
        use_alpha = cfg.get("use_alpha", False)
        match_method = cfg.get("match_method", "ORB")
        matcher = self._get_matcher(match_method)
        match_result = matcher.match_single_template(
            target_image=target_img_array,
            template_image=scaled_template_img,
            template_name=template_name,
            custom_threshold=threshold,
            use_alpha=use_alpha,
            detection_method=match_method
        )
        result = {"total_matches": 1, "matches": [match_result]} if (match_result and match_result.get("success")) else {"total_matches": 0, "matches": []}
        try:
            notify_match(
                template_name=template_name,
                result=result,
                target_img_array=target_img_array,
                template_img_array=scaled_template_img,
                match_method=cfg.get("match_method", "ORB"),
                expected_threshold=threshold,
                first_match=result.get("matches", [None])[0] if result.get("matches") else None,
            )
        except Exception:
            pass
        return result

    def _match_single_with_scale(
        self,
        target_img_array: np.ndarray,
        template_name: str,
        scale_x: float,
        scale_y: float,
    ) -> Dict:
        """
        Internal: match one template at given scale. Caller supplies pre-loaded target array and scale.
        Subclasses use this to implement game-specific match_template_auto_scale with their own constants.
        """
        ColorPrint, _ = _ensure_provider_imports()
        scaled_template_img = self._get_scaled_template_image(
            template_name=template_name, scale_x=scale_x, scale_y=scale_y, force_refresh=False
        )
        if scaled_template_img is None:
            return {"total_matches": 0, "matches": [], "error": "Failed to scale template"}
        cfg = self.get_template_config(template_name)
        if not cfg:
            return {"total_matches": 0, "matches": [], "error": f"Template config not found: {template_name}"}
        threshold = cfg.get("threshold", 0.8)
        use_alpha = cfg.get("use_alpha", False)
        match_method = cfg.get("match_method", "ORB")
        matcher = self._get_matcher(match_method)
        match_result = matcher.match_single_template(
            target_image=target_img_array,
            template_image=scaled_template_img,
            template_name=template_name,
            custom_threshold=threshold,
            use_alpha=use_alpha,
            detection_method=match_method
        )
        if match_result and match_result.get("success"):
            return {"total_matches": 1, "matches": [match_result]}
        return {"total_matches": 0, "matches": []}

    def match_multiple_templates(
        self,
        target_image: Union[str, Path, Image.Image, np.ndarray],
        template_names: List[str],
        output_dir: Optional[Path] = None,
        force_refresh_scale: bool = False
    ) -> Dict:
        ColorPrint, _ = _ensure_provider_imports()
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            return {"total_matches": 0, "matches": [], "error": "Failed to load target image"}
        scale_x, scale_y = self.get_scale_factors()
        all_matches = []
        for template_name in template_names:
            scaled_template_img = self._get_scaled_template_image(
                template_name=template_name,
                scale_x=scale_x,
                scale_y=scale_y,
                force_refresh=force_refresh_scale
            )
            if scaled_template_img is None:
                continue
            cfg = self.get_template_config(template_name)
            if not cfg:
                continue
            threshold = cfg.get("threshold", 0.8)
            use_alpha = cfg.get("use_alpha", False)
            match_method = cfg.get("match_method", "ORB")
            matcher = self._get_matcher(match_method)
            match_result = matcher.match_single_template(
                target_image=target_img_array,
                template_image=scaled_template_img,
                template_name=template_name,
                custom_threshold=threshold,
                use_alpha=use_alpha
            )
            if match_result and match_result.get("success"):
                all_matches.append(match_result)
        return {"total_matches": len(all_matches), "matches": all_matches}

    def match_template_in_image(
        self,
        target_image: Union[str, Path, Image.Image, np.ndarray],
        template_name: str,
        output_dir: Optional[Path] = None
    ) -> Dict:
        """Match a template in a given image (no scaling). Target image = region image."""
        ColorPrint, _ = _ensure_provider_imports()
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            return {"total_matches": 0, "matches": [], "error": "Failed to load target image"}
        template_img = self._load_original_template(template_name)
        if template_img is None:
            return {"total_matches": 0, "matches": [], "error": "Failed to load template"}
        cfg = self.get_template_config(template_name)
        if not cfg:
            return {"total_matches": 0, "matches": [], "error": f"Template config not found: {template_name}"}
        threshold = cfg.get("threshold", 0.8)
        use_alpha = cfg.get("use_alpha", False)
        match_method = cfg.get("match_method", "ORB")
        matcher = self._get_matcher(match_method)
        match_result = matcher.match_single_template(
            target_image=target_img_array,
            template_image=template_img,
            template_name=template_name,
            custom_threshold=threshold,
            use_alpha=use_alpha
        )
        if match_result and match_result.get("success"):
            return {"total_matches": 1, "matches": [match_result]}
        return {"total_matches": 0, "matches": []}

    # Alias: D3 etc. can keep the old name "match in given image"
    match_template_in_region = match_template_in_image

    def clear_cache(self):
        ColorPrint, _ = _ensure_provider_imports()
        self._original_template_cache.clear()
        self._template_cache.clear()
        ColorPrint.blue(f"{self.log_prefix} All template caches cleared")
