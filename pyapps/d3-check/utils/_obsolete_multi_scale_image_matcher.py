"""
Obsolete. Use: d3utils.d3_scaled_template_matcher (D3) or share.scaled_template_matcher_base
+ d3utils.image_matcher_registry. All matching delegates to the unified matcher; third-party from pycore.
"""

from pathlib import Path
from datetime import datetime
import json
from typing import List, Tuple, Dict, Optional

from pycore.pyfoundations.third_party.api import get_third_package_cv2, get_third_package_numpy
from d3utils.image_matcher_registry import get_image_matcher_for_method

cv2 = get_third_package_cv2()
np = get_third_package_numpy()


def _unified_result_to_legacy(unified: Optional[Dict], method_name: str, template_h: int, template_w: int) -> Optional[Dict]:
    """Convert unified matcher result to legacy format: location, confidence, size, method."""
    if not unified or not unified.get("success"):
        return None
    center = unified.get("center")
    if center is None:
        return None
    if isinstance(center, np.ndarray) and center.size >= 2:
        cx, cy = float(center.flat[0]), float(center.flat[1])
    elif isinstance(center, (tuple, list)) and len(center) >= 2:
        cx, cy = float(center[0]), float(center[1])
    else:
        return None
    top_left_x = int(cx - template_w / 2)
    top_left_y = int(cy - template_h / 2)
    return {
        "method": method_name,
        "location": (top_left_x, top_left_y),
        "confidence": float(unified.get("match_score", 0.0)),
        "size": (template_w, template_h),
    }


class MultiScaleImageMatcher:
    """Obsolete. Delegates to unified matcher (image_matcher_registry)."""

    REFERENCE_WIDTH = 1300
    REFERENCE_HEIGHT = 800

    _METHODS = [
        "TM_CCOEFF_NORMED",
        "TM_CCORR_NORMED",
        "TM_SQDIFF_NORMED",
        "SIFT",
        "ORB",
        "AKAZE",
    ]

    def __init__(self, base_image_path: str, template_paths: List[str], output_dir: str):
        self.base_image_path = base_image_path
        self.template_paths = template_paths
        self.output_dir = Path(output_dir)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.work_dir = self.output_dir / f"match_results_{timestamp}"
        self.work_dir.mkdir(parents=True, exist_ok=True)

        self.base_image = cv2.imread(base_image_path)
        if self.base_image is None:
            raise ValueError(f"Failed to load image: {base_image_path}")
        original_height, original_width = self.base_image.shape[:2]
        self.base_scale_x = original_width / self.REFERENCE_WIDTH
        self.base_scale_y = original_height / self.REFERENCE_HEIGHT
        print(f"[OK] Loaded base image: {base_image_path}")
        print(f"[INFO] Original size: {original_width}x{original_height}")
        print(f"[INFO] Reference size: {self.REFERENCE_WIDTH}x{self.REFERENCE_HEIGHT}")
        print(f"[INFO] Base scale factor: X={self.base_scale_x:.3f}, Y={self.base_scale_y:.3f}")

        self.templates = []
        for template_path in template_paths:
            if str(template_path).lower().endswith(".png"):
                template = cv2.imread(str(template_path), cv2.IMREAD_UNCHANGED)
            else:
                template = cv2.imread(str(template_path))
            if template is not None:
                has_alpha = len(template.shape) == 3 and template.shape[2] == 4
                self.templates.append({
                    "image": template,
                    "path": template_path,
                    "name": Path(template_path).name,
                    "has_alpha": has_alpha,
                })
                print(f"  - {Path(template_path).name}: {template.shape} (with alpha" if has_alpha else "no alpha)")
        print(f"[OK] Loaded templates: {len(self.templates)}")
        print(f"[OK] Work directory: {self.work_dir}")

    def _match_with_unified(
        self,
        method_name: str,
        img: np.ndarray,
        template: np.ndarray,
        template_name: str,
        has_alpha: bool,
        threshold: float = 0.7,
    ) -> Optional[Dict]:
        """Delegate to unified matcher; return legacy-format dict or None."""
        matcher = get_image_matcher_for_method(
            method_name,
            self.REFERENCE_WIDTH,
            self.REFERENCE_HEIGHT,
        )
        th, tw = template.shape[:2]
        result = matcher.match_single_template(
            target_image=img,
            template_image=template,
            template_name=template_name,
            custom_threshold=threshold,
            use_alpha=has_alpha,
            detection_method=method_name,
        )
        return _unified_result_to_legacy(result, method_name, th, tw)

    def draw_method_results_all_templates(
        self,
        img: np.ndarray,
        method_name: str,
        template_matches: List[Dict],
        scale_info: str,
    ) -> np.ndarray:
        result_img = img.copy()
        template_colors = [
            (0, 255, 0), (255, 0, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255), (0, 165, 255),
        ]
        found_count = 0
        for idx, template_match in enumerate(template_matches):
            template_name = template_match["template"]
            match = template_match["match"]
            color = template_colors[idx % len(template_colors)]
            if match:
                loc = match["location"]
                w, h = match["size"]
                confidence = match["confidence"]
                cv2.rectangle(result_img, loc, (loc[0] + w, loc[1] + h), color, 3)
                center_x = loc[0] + w // 2
                center_y = loc[1] + h // 2
                cv2.circle(result_img, (center_x, center_y), 5, (0, 0, 255), -1)
                text = f"{template_name[:20]}: {confidence:.3f}"
                text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                cv2.rectangle(
                    result_img,
                    (loc[0], loc[1] - text_size[1] - 10),
                    (loc[0] + text_size[0] + 6, loc[1] - 2),
                    color, -1,
                )
                cv2.putText(result_img, text, (loc[0] + 3, loc[1] - 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                found_count += 1
        cv2.rectangle(result_img, (0, 0), (result_img.shape[1], 80), (0, 0, 0), -1)
        cv2.putText(result_img, f"Method: {method_name}", (10, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        cv2.putText(result_img, f"Scale: {scale_info}", (10, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        match_text = f"Matches: {found_count}/{len(template_matches)}"
        match_color = (0, 255, 0) if found_count > 0 else (0, 0, 255)
        cv2.putText(result_img, match_text, (10, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.6, match_color, 2)
        return result_img

    def process_scale(self, scale_x: float, scale_y: float, scale_index: int, scale_name: str):
        combined_scale_x = self.base_scale_x * scale_x
        combined_scale_y = self.base_scale_y * scale_y
        print(f"\n{'='*70}\nProcessing scale: {scale_name} (#{scale_index})\n{'='*70}")
        print(f"[SCALE] Base scale: X={self.base_scale_x:.3f}, Y={self.base_scale_y:.3f}")
        print(f"[SCALE] Test scale: X={scale_x:.3f}, Y={scale_y:.3f}")
        print(f"[SCALE] Combined scale: X={combined_scale_x:.3f}, Y={combined_scale_y:.3f}")

        reference_width = int(self.REFERENCE_WIDTH * scale_x)
        reference_height = int(self.REFERENCE_HEIGHT * scale_y)
        scaled_img = cv2.resize(
            self.base_image, (reference_width, reference_height),
            interpolation=cv2.INTER_CUBIC if (scale_x > 1 or scale_y > 1) else cv2.INTER_AREA,
        )
        scale_filename = scale_name.replace(" ", "_").replace("%", "pct").replace("x", "x")
        temp_img_path = self.work_dir / f"tmp_{scale_index:02d}_{scale_filename}.jpg"
        cv2.imwrite(str(temp_img_path), scaled_img)
        print(f"[TEMP] Saved: {temp_img_path.name}, Size: {scaled_img.shape[:2]}")

        method_results = []
        for method_name in self._METHODS:
            print(f"\n[METHOD] {method_name}")
            template_matches = []
            for template_info in self.templates:
                original_template = template_info["image"]
                template_name = template_info["name"]
                has_alpha = template_info["has_alpha"]
                th, tw = original_template.shape[:2]
                scaled_w = max(3, int(tw * combined_scale_x))
                scaled_h = max(3, int(th * combined_scale_y))
                scaled_template = cv2.resize(
                    original_template, (scaled_w, scaled_h),
                    interpolation=cv2.INTER_CUBIC if combined_scale_x > 1 else cv2.INTER_AREA,
                )
                print(f"  [TEMPLATE] {template_name} (scaled {tw}x{th} -> {scaled_w}x{scaled_h})... ", end="")
                try:
                    match_result = self._match_with_unified(
                        method_name, scaled_img, scaled_template, template_name, has_alpha, threshold=0.7
                    )
                    if match_result:
                        print(f"FOUND (conf: {match_result['confidence']:.3f}, pos: {match_result['location']})")
                    else:
                        print("NOT FOUND")
                    template_matches.append({"template": template_name, "match": match_result})
                except Exception as e:
                    print(f"ERROR - {e}")
                    template_matches.append({"template": template_name, "match": None})

            result_img = self.draw_method_results_all_templates(
                scaled_img, method_name, template_matches, scale_name
            )
            result_filename = f"result_{scale_index:02d}_{scale_filename}_{method_name}.jpg"
            result_path = self.work_dir / result_filename
            cv2.imwrite(str(result_path), result_img)
            found_count = sum(1 for tm in template_matches if tm["match"] is not None)
            print(f"  [SAVED] {result_filename} ({found_count}/{len(template_matches)} found)")
            method_results.append({
                "method": method_name,
                "template_matches": template_matches,
                "result_image": str(result_path),
                "found_count": found_count,
            })

        total_found = sum(r["found_count"] for r in method_results)
        total_attempted = len(self._METHODS) * len(self.templates)
        print(f"\n[SUMMARY] Scale {scale_name}: {total_found}/{total_attempted} matches found")
        return {
            "scale_name": scale_name,
            "scale_x": scale_x,
            "scale_y": scale_y,
            "combined_scale_x": combined_scale_x,
            "combined_scale_y": combined_scale_y,
            "scale_index": scale_index,
            "temp_image": str(temp_img_path),
            "method_results": method_results,
            "found_count": total_found,
            "total_count": total_attempted,
        }

    def run(self):
        print("\n" + "=" * 70)
        print("  Multi-scale Image Matching Tool (obsolete; uses unified matcher)")
        print("  6 Methods x N Templates x 11 Scales")
        print("=" * 70)
        scale_configs = [
            (0.5, 0.5, "50%"),
            (0.75, 0.75, "75%"),
            (1.0, 1.0, "100%"),
            (1.5, 1.5, "150%"),
            (2.0, 2.0, "200%"),
            (2.0, 0.5, "200% Horizontal x 50% Vertical"),
            (2.0, 1.0, "200% Horizontal x 100% Vertical"),
            (0.5, 1.0, "50% Horizontal x 100% Vertical"),
            (0.5, 2.0, "50% Horizontal x 200% Vertical"),
            (1.0, 2.0, "100% Horizontal x 200% Vertical"),
            (1.0, 0.5, "100% Horizontal x 50% Vertical"),
        ]
        all_scale_results = []
        total_found = 0
        total_attempted = 0
        for idx, (scale_x, scale_y, scale_name) in enumerate(scale_configs, 1):
            result = self.process_scale(scale_x, scale_y, idx, scale_name)
            all_scale_results.append(result)
            total_found += result["found_count"]
            total_attempted += result["total_count"]
        report_path = self.work_dir / "match_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump({
                "base_image": self.base_image_path,
                "templates": [t["path"] for t in self.templates],
                "total_scales": len(scale_configs),
                "total_methods": 6,
                "total_templates": len(self.templates),
                "total_attempted": total_attempted,
                "total_found": total_found,
                "success_rate": f"{100.0 * total_found / total_attempted:.2f}%" if total_attempted else "0%",
                "scales": all_scale_results,
                "timestamp": datetime.now().isoformat(),
            }, f, indent=2, ensure_ascii=False)
        print("\n" + "=" * 70)
        print("[COMPLETE] All matching finished!")
        print(f"[OUTPUT] Work directory: {self.work_dir}")
        print(f"[STATS] {total_found}/{total_attempted} matches found ({100.0*total_found/total_attempted:.1f}%)" if total_attempted else "[STATS] 0 matches")
        print(f"[IMAGES] Generated {total_attempted} result images")
        print(f"[REPORT] {report_path.name}")
        print("=" * 70)
        return all_scale_results


def main():
    base_image = r"D:\programing\Users\MPC\.core_node\pytools\tmp\debug_ui_optimized_20251007_151345_673.png"
    template_dir = r"D:\programing\core_node\apps\d3-check\images"
    template_files = ["blacksmith_indicator_1.png", "blacksmith_indicator_2.png"]
    template_paths = [str(Path(template_dir) / f) for f in template_files]
    output_dir = r"D:\programing\Users\MPC\.core_node\pytools\tmp"
    matcher = MultiScaleImageMatcher(base_image, template_paths, output_dir)
    matcher.run()


if __name__ == "__main__":
    main()
