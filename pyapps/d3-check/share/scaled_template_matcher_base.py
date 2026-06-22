#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scaled Template Matcher Base
Common logic only; no game constants or game-specific methods. D3 and D4 subclasses each
define their own constants and implement match_template_auto_scale using _match_single_with_scale.
Subclass provides: standard_width, standard_height, get_scale_factors(), get_template_config(template_name).
"""

from typing import Optional, Union, Dict, List, Tuple, Callable, Any
from pathlib import Path

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.third_party import get_third_package_PIL_Image

cv2 = get_third_package_cv2()
numpy = get_third_package_numpy()
np = numpy
Image = get_third_package_PIL_Image()

# bag_opened_indicator: within this width ratio from left = blacksmith, right = bag only (not blacksmith)
LEFT_REGION_RATIO = 0.3

__all__ = [
    "ScaledTemplateMatcherBase",
    "cv2", "np", "Image", "numpy",
    "load_template_and_scale_by_resolution",
    "format_match_schematic",
    "is_match_center_in_left_region",
    "LEFT_REGION_RATIO",
]


def _ensure_provider_imports():
    """Return ColorPrint (imports at module top to avoid late-binding issues)."""
    return ColorPrint


def _center_to_xy(c) -> Optional[Tuple[float, float]]:
    """Normalize center to (x, y) floats; supports tuple, list, numpy array. Type-checked at code level."""
    if c is None:
        return None
    if isinstance(c, np.ndarray):
        if c.size < 2:
            return None
        return (float(c.flat[0]), float(c.flat[1]))
    if isinstance(c, (tuple, list)) and len(c) >= 2:
        return (float(c[0]), float(c[1]))
    return None


def format_match_schematic(
    target_w: int,
    target_h: int,
    center_or_centers: Union[Tuple[float, float], List[Tuple[float, float]], "np.ndarray"],
    template_name: str = "",
    grid_cols: int = 40,
    grid_rows: int = 14,
    region_in_parent: Optional[Tuple[int, int, int, int, int, int]] = None,
) -> str:
    """
    Produce a text schematic: box(es) and '*' at match position(s).
    center_or_centers: single (x,y) or list of (x,y); may be numpy array(s).

    - Single image: one box = target (target_w x target_h), '*' = match in target.
    - Region (image-in-image): when region_in_parent is set, outer box = full game, inner box = crop used for match.
      region_in_parent = (parent_w, parent_h, region_left, region_top, region_width, region_height).
      target_w/target_h = crop size; center is in crop coords. Match in full image = (region_left+cx, region_top+cy).
    """
    if target_w <= 0 or target_h <= 0:
        return f"[MatchSchematic] {template_name} target {target_w}x{target_h} (invalid)"

    centers = center_or_centers if isinstance(center_or_centers, list) else [center_or_centers]
    points_in_target: List[Tuple[float, float]] = []
    for c in centers:
        xy = _center_to_xy(c)
        if xy is None:
            continue
        points_in_target.append(xy)

    if region_in_parent is not None:
        # Image-in-image: outer = parent (full game), inner = region (crop), '*' at match in parent coords
        parent_w, parent_h, rleft, rtop, rw, rh = region_in_parent
        if parent_w <= 0 or parent_h <= 0:
            return f"[MatchSchematic] {template_name} region_in_parent invalid (parent {parent_w}x{parent_h})"
        # Map to grid (outer = parent)
        def to_gx(x: float, w: int) -> int:
            return max(0, min(grid_cols - 1, int(round(x / parent_w * grid_cols))))
        def to_gy(y: float, h: int) -> int:
            return max(0, min(grid_rows - 1, int(round(y / parent_h * grid_rows))))
        inner_left = to_gx(float(rleft), parent_w)
        inner_top = to_gy(float(rtop), parent_h)
        inner_right = to_gx(float(rleft + rw), parent_w)
        inner_bottom = to_gy(float(rtop + rh), parent_h)
        inner_right = min(inner_right, grid_cols - 2)
        inner_bottom = min(inner_bottom, grid_rows - 2)
        inner_left = max(inner_left, 1)
        inner_top = max(inner_top, 1)
        point_cells = [(to_gx(rleft + cx, parent_w), to_gy(rtop + cy, parent_h)) for (cx, cy) in points_in_target]
        lines = [
            f"[MatchSchematic] {template_name}  parent {parent_w}x{parent_h}  region=({rleft},{rtop},{rw}x{rh})  center(s) in crop {points_in_target}",
            "+" + "-" * grid_cols + "+",
        ]
        for ry in range(grid_rows):
            row = []
            for col in range(grid_cols):
                is_outer = ry == 0 or ry == grid_rows - 1 or col == 0 or col == grid_cols - 1
                if is_outer:
                    row.append("+" if (ry in (0, grid_rows - 1) and col in (0, grid_cols - 1)) else ("-" if ry in (0, grid_rows - 1) else "|"))
                else:
                    in_inner = inner_left <= col <= inner_right and inner_top <= ry <= inner_bottom
                    if in_inner:
                        if (col == inner_left and ry == inner_top) or (col == inner_right and ry == inner_top) or (col == inner_left and ry == inner_bottom) or (col == inner_right and ry == inner_bottom):
                            row.append("+")
                        elif ry == inner_top or ry == inner_bottom:
                            row.append("-")
                        elif col == inner_left or col == inner_right:
                            row.append("|")
                        elif (col, ry) in point_cells:
                            row.append("*")
                        else:
                            row.append(".")
                    else:
                        row.append(" ")
            lines.append("".join(row))
        lines.append("+" + "-" * grid_cols + "+")
        return "\n".join(lines)

    # Single image
    points: List[Tuple[int, int]] = []
    for (cx, cy) in points_in_target:
        gx = max(0, min(grid_cols - 1, int(round(cx / target_w * grid_cols))))
        gy = max(0, min(grid_rows - 1, int(round(cy / target_h * grid_rows))))
        points.append((gx, gy))
    lines = [
        f"[MatchSchematic] {template_name}  target {target_w}x{target_h}" + (f"  center(s) {points}" if points else ""),
        "+" + "-" * grid_cols + "+",
    ]
    for ry in range(grid_rows):
        row = [" "] * grid_cols
        for (px, py) in points:
            if py == ry:
                row[px] = "*"
        lines.append("|" + "".join(row) + "|")
    lines.append("+" + "-" * grid_cols + "+")
    return "\n".join(lines)


def is_match_center_in_left_region(
    match: Dict,
    image_width: int,
    ratio: float = LEFT_REGION_RATIO,
) -> bool:
    """
    Return True iff the match center's x is in the left `ratio` of the image (e.g. left 30%).
    bag_opened_indicator: left 30% = blacksmith, right = bag only (not blacksmith).
    """
    if image_width <= 0:
        return False
    center = match.get("center")
    if center is None:
        return False
    if isinstance(center, np.ndarray) and center.size >= 2:
        cx = float(center.flat[0])
    elif isinstance(center, (tuple, list)) and len(center) >= 2:
        cx = float(center[0])
    else:
        return False
    return cx < image_width * ratio


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
        get_matcher: Callable[[str], Any],
        log_prefix: str = "[ScaledMatcher]",
        on_after_match: Optional[Callable[..., None]] = None,
    ):
        self.standard_width = standard_width
        self.standard_height = standard_height
        self.get_scale_factors = get_scale_factors
        self.get_template_config = get_template_config
        self.get_matcher = get_matcher
        self.log_prefix = log_prefix
        self.on_after_match = on_after_match
        self._original_template_cache: Dict = {}
        self._template_cache: Dict = {}

    def _get_matcher(self, match_method: str) -> Any:
        return self.get_matcher(match_method.upper())

    def _load_target_image(self, target_image: Union[str, Path, Image.Image, np.ndarray]) -> Optional[np.ndarray]:
        ColorPrint = _ensure_provider_imports()
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
        ColorPrint = _ensure_provider_imports()
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
        force_refresh: bool = False,
        silent: bool = False
    ) -> Optional[np.ndarray]:
        ColorPrint = _ensure_provider_imports()
        cache_key = (template_name, round(scale_x, 4), round(scale_y, 4))
        if not force_refresh and cache_key in self._template_cache:
            if not silent:
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
        ColorPrint = _ensure_provider_imports()
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
        if self.on_after_match is not None:
            try:
                self.on_after_match(
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
        # Text schematic: box = target image, '*' = match position (for debug log)
        if result.get("total_matches", 0) > 0 and result.get("matches"):
            first = result["matches"][0]
            center = first.get("center")
            if center is not None:
                h, w = target_img_array.shape[:2]
                xy = _center_to_xy(center)
                if xy is not None:
                    schematic = format_match_schematic(w, h, xy, template_name)
                    ColorPrint.gray(schematic)
        return result

    def _match_single_with_scale(
        self,
        target_img_array: np.ndarray,
        template_name: str,
        scale_x: float,
        scale_y: float,
        silent: bool = False,
    ) -> Dict:
        """
        Internal: match one template at given scale. Caller supplies pre-loaded target array and scale.
        Subclasses use this to implement game-specific match_template_auto_scale with their own constants.
        silent=True: suppress per-template and DEBUG logs (for one-shot multi-state, one summary line only).
        """
        ColorPrint = _ensure_provider_imports()
        scaled_template_img = self._get_scaled_template_image(
            template_name=template_name, scale_x=scale_x, scale_y=scale_y, force_refresh=False, silent=silent
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
            detection_method=match_method,
            silent=silent,
        )
        if match_result and match_result.get("success"):
            if not silent:
                center = match_result.get("center")
                if center is not None:
                    h, w = target_img_array.shape[:2]
                    xy = _center_to_xy(center)
                    if xy is not None:
                        schematic = format_match_schematic(w, h, xy, template_name)
                        ColorPrint.gray(schematic)
            return {"total_matches": 1, "matches": [match_result]}
        return {"total_matches": 0, "matches": []}

    def match_multiple_templates(
        self,
        target_image: Union[str, Path, Image.Image, np.ndarray],
        template_names: List[str],
        output_dir: Optional[Path] = None,
        force_refresh_scale: bool = False
    ) -> Dict:
        ColorPrint = _ensure_provider_imports()
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
        ColorPrint = _ensure_provider_imports()
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
        ColorPrint = _ensure_provider_imports()
        self._original_template_cache.clear()
        self._template_cache.clear()
        ColorPrint.blue(f"{self.log_prefix} All template caches cleared")
