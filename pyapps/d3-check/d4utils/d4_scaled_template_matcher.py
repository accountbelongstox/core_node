#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Scaled Template Matcher
D4-specific scaled template matching. All D4 constants (D4_STANDARD_WIDTH/HEIGHT) and config live here or from providor.
Uses shared base ScaledTemplateMatcherBase for common logic; implements match_template_auto_scale and match_template_in_region.
"""

import sys
from pathlib import Path
from typing import Optional, Union, Dict, List
from datetime import datetime

from pycore.pyfoundations.third_party import (
    get_third_package_cv2,
    get_third_package_numpy,
    get_third_package_PIL_Image,
)

cv2 = get_third_package_cv2()
numpy = get_third_package_numpy()
np = numpy
Image = get_third_package_PIL_Image()

current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
sys.path.insert(0, str(project_root))

from pycore.pyfoundations.color_print import ColorPrint
from providor.app_constants import D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT, DEBUG, TMP_DIR
from providor.providor_index import D4_TEMPLATE_CONFIGS
from share.game_interface_data import get_global_scale
from share.game_interface_data import get_d4_interface_data
from share.scaled_template_matcher_base import ScaledTemplateMatcherBase


# D4 built-in constants (this module owns D4 standard resolution for scaling)
D4_STANDARD_WIDTH = D4_STANDARD_RESOLUTION_WIDTH
D4_STANDARD_HEIGHT = D4_STANDARD_RESOLUTION_HEIGHT


def _d4_get_template_config(template_name: str) -> Optional[Dict]:
    return D4_TEMPLATE_CONFIGS.get(template_name)


class D4ScaledTemplateMatcher(ScaledTemplateMatcherBase):
    """
    D4 scaled template matcher. All D4 constants (D4_STANDARD_WIDTH/HEIGHT) and template config live here.
    Uses base for common logic; implements match_template_auto_scale and match_template_in_region(region_name).
    """

    def __init__(self):
        super().__init__(
            standard_width=D4_STANDARD_WIDTH,
            standard_height=D4_STANDARD_HEIGHT,
            get_scale_factors=get_global_scale,
            get_template_config=_d4_get_template_config,
            log_prefix="[D4ScaledMatcher]",
        )
        self.d4_data = get_d4_interface_data()
        ColorPrint.green("[D4ScaledTemplateMatcher] Initialized")

    def match_template_auto_scale(
        self,
        target_image: Union[str, Path, object],
        template_name: str,
    ) -> Dict:
        """
        Match one template with scale derived from target image size using D4 standard resolution.
        scale = (target_w / D4_STANDARD_WIDTH, target_h / D4_STANDARD_HEIGHT).
        """
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            return {"total_matches": 0, "matches": [], "error": "Failed to load target image"}
        h, w = target_img_array.shape[:2]
        scale_x = w / D4_STANDARD_WIDTH
        scale_y = h / D4_STANDARD_HEIGHT
        ColorPrint.gray(
            f"{self.log_prefix} Auto scale from image {w}x{h} (D4 std {D4_STANDARD_WIDTH}x{D4_STANDARD_HEIGHT}): "
            f"({scale_x:.4f}, {scale_y:.4f})"
        )
        return self._match_single_with_scale(target_img_array, template_name, scale_x, scale_y)

    def match_template_in_region(
        self,
        template_name: str,
        region_name: str,
        use_shared_region: bool = True,
        output_dir: Optional[Path] = None,
        force_refresh_scale: bool = False,
    ) -> Dict:
        """
        Match template inside a named region (e.g. minimap, team_count).
        If use_shared_region True uses region image from shared D4 data; else crops from full image.
        """
        ColorPrint.blue(f"\n[D4ScaledMatcher] Matching template '{template_name}' in region '{region_name}'")
        try:
            if use_shared_region:
                region_image = self._get_shared_region_image(region_name)
                region_source = "shared_data"
            else:
                region_image = self._extract_region_from_full_image(region_name)
                region_source = "full_image"

            if region_image is None:
                return {
                    "total_matches": 0,
                    "matches": [],
                    "error": f"Failed to get region image for '{region_name}'",
                    "region_used": region_name,
                    "region_source": region_source,
                }

            scale_x, scale_y = self.get_scale_factors()
            scaled_template_img = self._get_scaled_template_image(
                template_name=template_name,
                scale_x=scale_x,
                scale_y=scale_y,
                force_refresh=force_refresh_scale,
            )
            if scaled_template_img is None:
                return {
                    "total_matches": 0,
                    "matches": [],
                    "error": f"Failed to get scaled template: {template_name}",
                    "region_used": region_name,
                    "region_source": region_source,
                }

            template_config = self.get_template_config(template_name)
            if not template_config:
                return {
                    "total_matches": 0,
                    "matches": [],
                    "error": f"D4 template config not found: {template_name}",
                    "region_used": region_name,
                    "region_source": region_source,
                }

            threshold = template_config["threshold"]
            use_alpha = template_config.get("use_alpha", False)
            match_method = template_config.get("match_method", "ORB")
            matcher = self._get_matcher(match_method)

            if isinstance(region_image, Image.Image):
                region_array = np.array(region_image)
            else:
                region_array = region_image

            ColorPrint.gray(
                f"[D4ScaledMatcher] Calling {match_method} matcher in region (threshold: {threshold}, alpha: {use_alpha})"
            )
            match_result = matcher.match_single_template(
                target_image=region_array,
                template_image=scaled_template_img,
                template_name=template_name,
                custom_threshold=threshold,
                use_alpha=use_alpha,
                detection_method=match_method,
            )

            if DEBUG and match_result:
                self._save_region_debug_image(
                    region_array, scaled_template_img, match_result, template_name, region_name, output_dir
                )

            if match_result and match_result.get("success"):
                ColorPrint.green(f"[D4ScaledMatcher] Region match found: {template_name} in {region_name}")
                return {
                    "total_matches": 1,
                    "matches": [match_result],
                    "error": None,
                    "region_used": region_name,
                    "region_source": region_source,
                }
            ColorPrint.yellow(f"[D4ScaledMatcher] No match found: {template_name} in {region_name}")
            return {
                "total_matches": 0,
                "matches": [],
                "error": None,
                "region_used": region_name,
                "region_source": region_source,
            }
        except Exception as e:
            error_msg = f"Error matching template in region: {e}"
            ColorPrint.red(f"[D4ScaledMatcher] {error_msg}")
            return {
                "total_matches": 0,
                "matches": [],
                "error": error_msg,
                "region_used": region_name,
                "region_source": "error",
            }

    def _get_shared_region_image(self, region_name: str) -> Optional[np.ndarray]:
        """从共享 D4 数据取指定区域图像。"""
        try:
            region_mapping = {
                "minimap": "minimap_region_image",
                "team_count": "team_count_region_image",
                "team_vote": "team_vote_region_image",
                "bag": "bag_region_image",
                "blacksmith": "blacksmith_region_image",
                "equipment_left": "equipment_left_region_image",
                "equipment_right": "equipment_right_region_image",
                "exp_bar": "exp_bar_region_image",
                "map_name": "map_name_region_image",
                "quest_text": "quest_text_region_image",
            }
            attribute_name = region_mapping.get(region_name)
            if not attribute_name:
                ColorPrint.yellow(f"[D4ScaledMatcher] Unknown region name: {region_name}")
                return None
            region_image = getattr(self.d4_data, attribute_name, None)
            if region_image is None:
                ColorPrint.yellow(f"[D4ScaledMatcher] No {region_name} region image in shared data")
                return None
            if isinstance(region_image, Image.Image):
                return np.array(region_image)
            return region_image
        except Exception as e:
            ColorPrint.red(f"[D4ScaledMatcher] Error getting shared region image: {e}")
            return None

    def _extract_region_from_full_image(self, region_name: str) -> Optional[np.ndarray]:
        """从全屏游戏窗口图中裁剪指定区域。"""
        try:
            screenshot_data = self.d4_data.screenshot_data
            if not screenshot_data or not screenshot_data.game_window_image:
                ColorPrint.yellow("[D4ScaledMatcher] No screenshot data available")
                return None
            game_window_image = screenshot_data.game_window_image
            game_window_size = screenshot_data.game_window_size
            is_windowed = self.d4_data.is_windowed_mode()

            from share.game_interface_data import (
                D4_STANDARD_COORDS,
                calculate_unified_scaled_coordinate,
            )

            region_coords = {
                "minimap": (D4_STANDARD_COORDS.minimap_region_start, D4_STANDARD_COORDS.minimap_region_end),
                "team_count": (D4_STANDARD_COORDS.team_count_region_start, D4_STANDARD_COORDS.team_count_region_end),
                "team_vote": (D4_STANDARD_COORDS.team_vote_region_start, D4_STANDARD_COORDS.team_vote_region_end),
                "bag": (D4_STANDARD_COORDS.bag_top_left, D4_STANDARD_COORDS.bag_bottom_right),
                "blacksmith": (D4_STANDARD_COORDS.blacksmith_menu_start, D4_STANDARD_COORDS.blacksmith_menu_end),
                "equipment_left": (
                    D4_STANDARD_COORDS.equipment_left_region_start,
                    D4_STANDARD_COORDS.equipment_left_region_end,
                ),
                "equipment_right": (
                    D4_STANDARD_COORDS.equipment_right_region_start,
                    D4_STANDARD_COORDS.equipment_right_region_end,
                ),
                "exp_bar": (D4_STANDARD_COORDS.exp_bar_region_start, D4_STANDARD_COORDS.exp_bar_region_end),
                "map_name": (D4_STANDARD_COORDS.map_name_region_start, D4_STANDARD_COORDS.map_name_region_end),
                "quest_text": (
                    D4_STANDARD_COORDS.quest_text_region_start,
                    D4_STANDARD_COORDS.quest_text_region_end,
                ),
            }
            if region_name not in region_coords:
                ColorPrint.yellow(f"[D4ScaledMatcher] Unknown region name: {region_name}")
                return None
            start_coord, end_coord = region_coords[region_name]
            std_res = (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT)
            scaled_start = calculate_unified_scaled_coordinate(
                start_coord, game_window_size, std_res, is_windowed
            )
            scaled_end = calculate_unified_scaled_coordinate(
                end_coord, game_window_size, std_res, is_windowed
            )
            from pycore.pyutils.image_crop import ImageCrop
            region_crop = ImageCrop.crop_region(
                game_window_image, scaled_start, scaled_end, output_format="numpy"
            )
            return region_crop
        except Exception as e:
            ColorPrint.red(f"[D4ScaledMatcher] Error extracting region from full image: {e}")
            return None

    def _save_region_debug_image(
        self,
        region_image: np.ndarray,
        template_image: np.ndarray,
        match_result: Dict,
        template_name: str,
        region_name: str,
        output_dir: Optional[Path] = None,
    ) -> None:
        """保存区域匹配调试图（DEBUG 开启时）。"""
        try:
            if not DEBUG:
                return
            debug_dir = output_dir if output_dir else TMP_DIR / "d4_annotated"
            debug_dir.mkdir(parents=True, exist_ok=True)
            debug_image = region_image.copy()
            if match_result and match_result.get("success"):
                if "polygon" in match_result:
                    polygon = match_result["polygon"]
                    cv2.polylines(debug_image, [polygon.astype(np.int32)], True, (0, 255, 0), 2)
                cv2.putText(debug_image, f"Template: {template_name}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                cv2.putText(debug_image, f"Region: {region_name}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                cv2.putText(debug_image, "MATCH FOUND", (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                cv2.putText(
                    debug_image,
                    f"Confidence: {match_result.get('match_score', 0):.3f}",
                    (10, 120),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2,
                )
            else:
                cv2.putText(debug_image, f"Template: {template_name}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                cv2.putText(debug_image, f"Region: {region_name}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                cv2.putText(debug_image, "NO MATCH", (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            debug_path = debug_dir / f"region_match_{region_name}_{template_name}_{ts}.png"
            cv2.imwrite(str(debug_path), debug_image)
            ColorPrint.green(f"[D4ScaledMatcher] Region debug image saved: {debug_path}")
        except Exception as e:
            ColorPrint.red(f"[D4ScaledMatcher] Error saving region debug image: {e}")


_d4_scaled_template_matcher: Optional[D4ScaledTemplateMatcher] = None


def get_d4_scaled_template_matcher() -> D4ScaledTemplateMatcher:
    """D4 专用 scale matcher 单例。"""
    global _d4_scaled_template_matcher
    if _d4_scaled_template_matcher is None:
        _d4_scaled_template_matcher = D4ScaledTemplateMatcher()
    return _d4_scaled_template_matcher
