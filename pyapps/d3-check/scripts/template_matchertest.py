"""
Template Matching Test Script
Supports D3 and D4 template matching with interactive menu selection
"""

import cv2
import numpy as np
import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from providor.providor_index import D3_D3_TEMPLATE_CONFIGS, D4_D3_TEMPLATE_CONFIGS, BATTLENET_D3_TEMPLATE_CONFIGS

# Import interactive menu library
from scripts.interactive_menu import InteractiveMenu

# Import image annotator helper for professional result visualization
from d3utils.d3u_common.image_annotator_helper import (
    create_annotator,
    draw_match_results,
    draw_info_texts,
    get_annotation_color,
    get_auto_color
)


class TemplateMatchingTester:
    """Template matching tester with menu system and caching"""

    # Get user home directory automatically
    USER_HOME = Path.home()

    # Screenshot directories
    D3_SCREENSHOT_DIR = USER_HOME / ".core_node" / "pytools" / "tmp" / "d3_screenshots"
    D4_SCREENSHOT_DIR = USER_HOME / ".core_node" / "pytools" / "tmp" / "d4_screenshots"

    # Cache directory for menu selections
    CACHE_DIR = USER_HOME / ".core_node" / ".scripts"
    CACHE_FILE = CACHE_DIR / "template_test_cache.json"

    # Output directory
    OUTPUT_DIR = USER_HOME / ".core_node" / "pytools" / "tmp" / "multi_scale_result"

    # Reference resolutions (D3 was 1826x1301, now 1300x800)
    D3_REFERENCE_WIDTH = 1300   # was 1826
    D3_REFERENCE_HEIGHT = 800   # was 1301
    D4_REFERENCE_WIDTH = 1763
    D4_REFERENCE_HEIGHT = 1126

    def __init__(self):
        """Initialize tester"""
        # Create necessary directories
        self.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        # Initialize interactive menu with cache file
        self.menu = InteractiveMenu(cache_file=self.CACHE_FILE)

        # Current selections
        self.game_type = None  # 'd3' or 'd4'
        self.selected_templates = []  # List of template names
        self.screenshot_files = []  # List of screenshot paths

    def show_game_type_menu(self) -> str:
        """Show game type selection menu"""
        game_types = [
            ("d3", "Diablo III"),
            ("d4", "Diablo IV")
        ]

        # Build menu items
        menu_items = [game_name for game_id, game_name in game_types]

        # Show interactive menu
        selected_index = self.menu.show_single_select_menu(
            title="Template Matching Test - Game Type Selection",
            items=menu_items,
            cache_key="game_type_index",
            default_index=0
        )

        self.game_type = game_types[selected_index][0]
        print(f"\n[SELECTED] Game Type: {game_types[selected_index][1]}\n")

        return self.game_type

    def show_template_menu(self) -> List[str]:
        """Show template selection menu"""
        # Get template configs based on game type
        if self.game_type == "d3":
            configs = D3_TEMPLATE_CONFIGS
        else:
            configs = D4_D3_TEMPLATE_CONFIGS

        # Build template list with categories
        template_items = []
        for name, config in configs.items():
            category = config.get("category", "unknown")
            template_items.append((name, category, config))

        # Build menu items (add "ALL" as first option)
        menu_items = ["[ALL] - Test all templates"]
        for name, category, config in template_items:
            threshold = config.get("threshold", 0.8)
            method = config.get("match_method", "ORB")
            menu_items.append(f"[{category:20s}] {name:40s} (threshold={threshold:.2f}, method={method})")

        # Show interactive menu
        selected_indices = self.menu.show_multi_select_menu(
            title=f"Template Selection - {self.game_type.upper()}",
            items=menu_items,
            cache_key="template_indices",
            default_indices=[0]  # Default to "ALL"
        )

        # Get selected templates
        if 0 in selected_indices:
            # All templates
            self.selected_templates = [name for name, _, _ in template_items]
            print(f"\n[SELECTED] All templates ({len(self.selected_templates)} items)\n")
        else:
            # Adjust indices (subtract 1 because menu has "ALL" at index 0)
            self.selected_templates = [template_items[idx - 1][0] for idx in selected_indices if idx > 0]
            print(f"\n[SELECTED] Templates:")
            for name in self.selected_templates:
                print(f"  - {name}")
            print()

        return self.selected_templates

    def scan_screenshots(self) -> List[Path]:
        """Scan screenshot directory"""
        if self.game_type == "d3":
            screenshot_dir = self.D3_SCREENSHOT_DIR
        else:
            screenshot_dir = self.D4_SCREENSHOT_DIR

        if not screenshot_dir.exists():
            print(f"[ERROR] Screenshot directory not found: {screenshot_dir}")
            return []

        # Find all image files
        image_extensions = ['.png', '.jpg', '.jpeg', '.bmp']
        screenshot_files = []

        for ext in image_extensions:
            screenshot_files.extend(screenshot_dir.glob(f"*{ext}"))

        screenshot_files.sort()

        print(f"\n[SCAN] Found {len(screenshot_files)} screenshots in: {screenshot_dir}")
        for idx, file in enumerate(screenshot_files, 1):
            print(f"  {idx}. {file.name}")

        self.screenshot_files = screenshot_files
        return screenshot_files

    def template_matching_ccoeff(self, img: np.ndarray, template: np.ndarray,
                                  threshold: float, use_alpha: bool) -> Optional[Dict]:
        """Template Matching - TM_CCOEFF_NORMED"""
        mask = None
        if use_alpha and len(template.shape) == 3 and template.shape[2] == 4:
            mask = template[:, :, 3]
            template = template[:, :, :3]

        result = cv2.matchTemplate(img, template, cv2.TM_CCOEFF_NORMED, mask=mask)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        if max_val >= threshold:
            return {
                'method': 'TM_CCOEFF_NORMED',
                'location': max_loc,
                'confidence': float(max_val),
                'size': (template.shape[1], template.shape[0])
            }
        return None

    def template_matching_ccorr(self, img: np.ndarray, template: np.ndarray,
                                 threshold: float, use_alpha: bool) -> Optional[Dict]:
        """Template Matching - TM_CCORR_NORMED"""
        mask = None
        if use_alpha and len(template.shape) == 3 and template.shape[2] == 4:
            mask = template[:, :, 3]
            template = template[:, :, :3]

        result = cv2.matchTemplate(img, template, cv2.TM_CCORR_NORMED, mask=mask)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        if max_val >= threshold:
            return {
                'method': 'TM_CCORR_NORMED',
                'location': max_loc,
                'confidence': float(max_val),
                'size': (template.shape[1], template.shape[0])
            }
        return None

    def template_matching_sqdiff(self, img: np.ndarray, template: np.ndarray,
                                  threshold: float, use_alpha: bool) -> Optional[Dict]:
        """Template Matching - TM_SQDIFF_NORMED"""
        mask = None
        if use_alpha and len(template.shape) == 3 and template.shape[2] == 4:
            mask = template[:, :, 3]
            template = template[:, :, :3]

        result = cv2.matchTemplate(img, template, cv2.TM_SQDIFF_NORMED, mask=mask)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        # For SQDIFF, lower is better (inverted threshold)
        if min_val <= (1.0 - threshold):
            return {
                'method': 'TM_SQDIFF_NORMED',
                'location': min_loc,
                'confidence': float(1.0 - min_val),
                'size': (template.shape[1], template.shape[0])
            }
        return None

    def sift_matching(self, img: np.ndarray, template: np.ndarray,
                     threshold: float, use_alpha: bool) -> Optional[Dict]:
        """SIFT Feature Matching"""
        try:
            mask = None
            if use_alpha and len(template.shape) == 3 and template.shape[2] == 4:
                mask = template[:, :, 3]
                template = template[:, :, :3]

            # Convert to grayscale
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

            if mask is not None:
                template_gray = cv2.bitwise_and(template_gray, template_gray, mask=mask)

            # Create SIFT
            sift = cv2.SIFT_create()
            kp1, des1 = sift.detectAndCompute(template_gray, mask=mask)
            kp2, des2 = sift.detectAndCompute(img_gray, None)

            if des1 is None or des2 is None or len(kp1) < 4:
                return None

            # FLANN matcher
            FLANN_INDEX_KDTREE = 1
            index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
            search_params = dict(checks=50)
            flann = cv2.FlannBasedMatcher(index_params, search_params)

            matches = flann.knnMatch(des1, des2, k=2)

            # Ratio test
            good_matches = []
            for m_n in matches:
                if len(m_n) == 2:
                    m, n = m_n
                    if m.distance < threshold * n.distance:
                        good_matches.append(m)

            if len(good_matches) > 10:
                src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

                M, _ = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

                if M is not None:
                    h, w = template.shape[:2]
                    pts = np.float32([[0, 0], [0, h-1], [w-1, h-1], [w-1, 0]]).reshape(-1, 1, 2)
                    dst = cv2.perspectiveTransform(pts, M)
                    center = np.mean(dst, axis=0)[0]

                    confidence = len(good_matches) / max(len(kp1), 1)

                    return {
                        'method': 'SIFT',
                        'location': tuple(map(int, center - np.array([w/2, h/2]))),
                        'confidence': float(confidence),
                        'size': (w, h),
                        'good_matches': len(good_matches)
                    }
        except Exception as e:
            print(f"    SIFT error: {e}")
        return None

    def orb_matching(self, img: np.ndarray, template: np.ndarray,
                    threshold: float, use_alpha: bool) -> Optional[Dict]:
        """ORB Feature Matching"""
        try:
            mask = None
            if use_alpha and len(template.shape) == 3 and template.shape[2] == 4:
                mask = template[:, :, 3]
                template = template[:, :, :3]

            # Convert to grayscale
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

            if mask is not None:
                template_gray = cv2.bitwise_and(template_gray, template_gray, mask=mask)

            # Create ORB
            orb = cv2.ORB_create(nfeatures=2000)
            kp1, des1 = orb.detectAndCompute(template_gray, mask=mask)
            kp2, des2 = orb.detectAndCompute(img_gray, None)

            if des1 is None or des2 is None or len(kp1) < 4:
                return None

            # BF Matcher
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
            matches = bf.knnMatch(des1, des2, k=2)

            # Ratio test
            good_matches = []
            for m_n in matches:
                if len(m_n) == 2:
                    m, n = m_n
                    if m.distance < threshold * n.distance:
                        good_matches.append(m)

            if len(good_matches) > 10:
                src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

                M, _ = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

                if M is not None:
                    h, w = template.shape[:2]
                    pts = np.float32([[0, 0], [0, h-1], [w-1, h-1], [w-1, 0]]).reshape(-1, 1, 2)
                    dst = cv2.perspectiveTransform(pts, M)
                    center = np.mean(dst, axis=0)[0]

                    confidence = len(good_matches) / max(len(kp1), 1)

                    return {
                        'method': 'ORB',
                        'location': tuple(map(int, center - np.array([w/2, h/2]))),
                        'confidence': float(confidence),
                        'size': (w, h),
                        'good_matches': len(good_matches)
                    }
        except Exception as e:
            print(f"    ORB error: {e}")
        return None

    def akaze_matching(self, img: np.ndarray, template: np.ndarray,
                      threshold: float, use_alpha: bool) -> Optional[Dict]:
        """AKAZE Feature Matching"""
        try:
            mask = None
            if use_alpha and len(template.shape) == 3 and template.shape[2] == 4:
                mask = template[:, :, 3]
                template = template[:, :, :3]

            # Convert to grayscale
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

            if mask is not None:
                template_gray = cv2.bitwise_and(template_gray, template_gray, mask=mask)

            # Create AKAZE
            akaze = cv2.AKAZE_create()
            kp1, des1 = akaze.detectAndCompute(template_gray, mask=mask)
            kp2, des2 = akaze.detectAndCompute(img_gray, None)

            if des1 is None or des2 is None or len(kp1) < 4:
                return None

            # BF Matcher with Hamming distance
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
            matches = bf.knnMatch(des1, des2, k=2)

            # Ratio test
            good_matches = []
            for m_n in matches:
                if len(m_n) == 2:
                    m, n = m_n
                    if m.distance < threshold * n.distance:
                        good_matches.append(m)

            if len(good_matches) > 8:  # Lower threshold for AKAZE
                src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

                M, _ = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

                if M is not None:
                    h, w = template.shape[:2]
                    pts = np.float32([[0, 0], [0, h-1], [w-1, h-1], [w-1, 0]]).reshape(-1, 1, 2)
                    dst = cv2.perspectiveTransform(pts, M)
                    center = np.mean(dst, axis=0)[0]

                    confidence = len(good_matches) / max(len(kp1), 1)

                    return {
                        'method': 'AKAZE',
                        'location': tuple(map(int, center - np.array([w/2, h/2]))),
                        'confidence': float(confidence),
                        'size': (w, h),
                        'good_matches': len(good_matches)
                    }
        except Exception as e:
            print(f"    AKAZE error: {e}")
        return None

    def _convert_to_standard_match_result(self, opencv_match: Dict) -> Dict:
        """
        Convert OpenCV match result to standard format for image_annotator_helper

        Args:
            opencv_match: Dict with keys: location, size, confidence, method

        Returns:
            Standard match result dict with keys: center, polygon, match_score
        """
        if not opencv_match:
            return {}

        loc = opencv_match['location']
        w, h = opencv_match['size']

        # Calculate center point
        center = (loc[0] + w // 2, loc[1] + h // 2)

        # Build polygon (rectangle corners)
        polygon = np.array([
            [loc[0], loc[1]],           # Top-left
            [loc[0] + w, loc[1]],       # Top-right
            [loc[0] + w, loc[1] + h],   # Bottom-right
            [loc[0], loc[1] + h]        # Bottom-left
        ])

        return {
            "center": center,
            "polygon": polygon,
            "match_score": opencv_match['confidence']
        }

    def test_single_screenshot(self, screenshot_path: Path,
                               template_configs: Dict) -> Dict:
        """Test single screenshot with all selected templates"""
        print(f"\n{'='*70}")
        print(f"Testing: {screenshot_path.name}")
        print(f"{'='*70}")

        # Load screenshot
        screenshot = cv2.imread(str(screenshot_path))
        if screenshot is None:
            print(f"[ERROR] Failed to load screenshot: {screenshot_path}")
            return {}

        img_height, img_width = screenshot.shape[:2]
        print(f"[INFO] Screenshot size: {img_width}x{img_height}")

        # Calculate scale factor
        if self.game_type == "d3":
            scale_x = img_width / self.D3_REFERENCE_WIDTH
            scale_y = img_height / self.D3_REFERENCE_HEIGHT
        else:
            scale_x = img_width / self.D4_REFERENCE_WIDTH
            scale_y = img_height / self.D4_REFERENCE_HEIGHT

        print(f"[INFO] Scale factor: X={scale_x:.3f}, Y={scale_y:.3f}")

        results = {
            'screenshot': str(screenshot_path),
            'size': (img_width, img_height),
            'scale': (scale_x, scale_y),
            'template_results': []
        }

        # Create result image
        result_img = screenshot.copy()

        # Test each template
        for template_name in self.selected_templates:
            config = template_configs.get(template_name)
            if not config:
                print(f"[WARNING] Template config not found: {template_name}")
                continue

            print(f"\n[TEMPLATE] {template_name}")

            # Load template
            template_path = config['path']
            use_alpha = config.get('use_alpha', False)

            if use_alpha:
                template = cv2.imread(template_path, cv2.IMREAD_UNCHANGED)
            else:
                template = cv2.imread(template_path)

            if template is None:
                print(f"  [ERROR] Failed to load template: {template_path}")
                continue

            # Scale template
            template_height, template_width = template.shape[:2]
            scaled_width = int(template_width * scale_x)
            scaled_height = int(template_height * scale_y)

            if scaled_width < 3 or scaled_height < 3:
                print(f"  [SKIP] Template too small after scaling")
                continue

            scaled_template = cv2.resize(template, (scaled_width, scaled_height),
                                        interpolation=cv2.INTER_CUBIC if scale_x > 1 else cv2.INTER_AREA)

            # Get matching parameters
            threshold = config.get('threshold', 0.8)
            match_method = config.get('match_method', 'ORB')

            # Test with ALL methods and record results
            all_methods_results = {}

            # Define all matching methods to test
            methods_to_test = [
                ('TM_CCOEFF_NORMED', self.template_matching_ccoeff),
                ('TM_CCORR_NORMED', self.template_matching_ccorr),
                ('TM_SQDIFF_NORMED', self.template_matching_sqdiff),
                ('SIFT', self.sift_matching),
                ('ORB', self.orb_matching),
                ('AKAZE', self.akaze_matching),
            ]

            print(f"  Testing with all 6 methods:")
            for method_name, method_func in methods_to_test:
                try:
                    match_result = method_func(screenshot, scaled_template, threshold, use_alpha)
                    all_methods_results[method_name] = match_result

                    if match_result:
                        print(f"    [{method_name:20s}] FOUND (conf: {match_result['confidence']:.3f})")
                    else:
                        print(f"    [{method_name:20s}] NOT FOUND")
                except Exception as e:
                    print(f"    [{method_name:20s}] ERROR: {e}")
                    all_methods_results[method_name] = None

            # Get the result from the configured method
            match_result = all_methods_results.get(match_method)

            # Record result
            template_result = {
                'template': template_name,
                'primary_method': match_method,
                'threshold': threshold,
                'primary_match': match_result,
                'all_methods': all_methods_results
            }

            results['template_results'].append(template_result)

            if match_result:
                print(f"  [PRIMARY {match_method}] FOUND - Confidence: {match_result['confidence']:.3f}, Position: {match_result['location']}")
            else:
                print(f"  [PRIMARY {match_method}] NOT FOUND")

        # =================================================================
        # Generate result images for EACH method
        # =================================================================

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # All matching methods
        all_method_names = [
            'TM_CCOEFF_NORMED',
            'TM_CCORR_NORMED',
            'TM_SQDIFF_NORMED',
            'SIFT',
            'ORB',
            'AKAZE'
        ]

        result_images = []

        # Generate one result image for EACH method
        for method_name in all_method_names:
            print(f"\n[DRAWING] Generating result image for method: {method_name}")

            # Create annotator from screenshot (fresh for each method)
            annotator = create_annotator(screenshot)

            # Prepare match results for this specific method
            match_results_for_drawing = []
            for template_result in results['template_results']:
                all_methods = template_result.get('all_methods', {})
                method_match = all_methods.get(method_name)
                template_name = template_result['template']
                template_path = template_configs[template_name]['path']

                # Convert to standard format
                standard_match = self._convert_to_standard_match_result(method_match) if method_match else {}

                match_results_for_drawing.append({
                    'match_result': standard_match,
                    'name': template_name,
                    'template_path': template_path
                    # Color will be auto-assigned
                })

            # Count matches for this method
            matched_count = sum(1 for mr in match_results_for_drawing if mr['match_result'])
            total_count = len(match_results_for_drawing)

            # Build summary text for this method
            summary_text = f"Method: {method_name} | Game: {self.game_type.upper()} | Size: {img_width}x{img_height} | Scale: X={scale_x:.3f} Y={scale_y:.3f} | Found: {matched_count}/{total_count}"
            summary_color = "green" if matched_count > 0 else "red"

            # Draw all match results for this method
            result_filename = f"{self.game_type}_{screenshot_path.stem}_{method_name}_{timestamp}.jpg"
            result_path = self.OUTPUT_DIR / result_filename

            draw_match_results(
                annotator=annotator,
                match_results=match_results_for_drawing,
                save_path=result_path,
                summary_text=summary_text,
                summary_color=summary_color,
                show_not_found=True,
                not_found_start_y=70,  # Below summary
                auto_color=True
            )

            result_images.append({
                'method': method_name,
                'path': str(result_path),
                'found_count': matched_count,
                'total_count': total_count
            })

            print(f"  [SAVED] {result_filename} ({matched_count}/{total_count} found)")

        results['result_images'] = result_images
        print(f"\n[COMPLETE] Generated {len(result_images)} result images for screenshot: {screenshot_path.name}")

        return results

    def run(self):
        """Run complete testing workflow"""
        print("\n" + "="*70)
        print("  Template Matching Test Script")
        print("  D3 & D4 Template Testing Tool")
        print("="*70)

        # Step 1: Select game type
        self.show_game_type_menu()

        # Step 2: Select templates
        self.show_template_menu()

        # Step 3: Scan screenshots
        screenshot_files = self.scan_screenshots()

        if not screenshot_files:
            print("\n[ERROR] No screenshots found!")
            return

        # Step 4: Get template configs
        if self.game_type == "d3":
            template_configs = D3_TEMPLATE_CONFIGS
        else:
            template_configs = D4_D3_TEMPLATE_CONFIGS

        # Step 5: Test each screenshot
        all_results = []

        for screenshot_file in screenshot_files:
            result = self.test_single_screenshot(screenshot_file, template_configs)
            all_results.append(result)

        # Step 6: Calculate statistics
        total_tests = 0
        total_found = 0
        method_stats = {
            'TM_CCOEFF_NORMED': {'found': 0, 'total': 0},
            'TM_CCORR_NORMED': {'found': 0, 'total': 0},
            'TM_SQDIFF_NORMED': {'found': 0, 'total': 0},
            'SIFT': {'found': 0, 'total': 0},
            'ORB': {'found': 0, 'total': 0},
            'AKAZE': {'found': 0, 'total': 0},
        }

        for result in all_results:
            for template_result in result.get('template_results', []):
                # Count primary method results
                if template_result.get('primary_match'):
                    total_found += 1
                total_tests += 1

                # Count all methods results
                for method_name, match_result in template_result.get('all_methods', {}).items():
                    method_stats[method_name]['total'] += 1
                    if match_result:
                        method_stats[method_name]['found'] += 1

        # Step 7: Save summary report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_filename = f"test_report_{self.game_type}_{timestamp}.json"
        report_path = self.OUTPUT_DIR / report_filename

        summary = {
            'game_type': self.game_type,
            'templates_tested': self.selected_templates,
            'screenshots_tested': len(screenshot_files),
            'timestamp': datetime.now().isoformat(),
            'statistics': {
                'total_tests': total_tests,
                'total_found': total_found,
                'success_rate': f"{100.0 * total_found / total_tests:.2f}%" if total_tests > 0 else "0%",
                'method_statistics': method_stats
            },
            'results': all_results
        }

        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)

        # Step 8: Print summary
        print("\n" + "="*70)
        print(f"[COMPLETE] Testing finished!")
        print(f"[OUTPUT] Result directory: {self.OUTPUT_DIR}")
        print(f"[REPORT] {report_filename}")
        print(f"[STATS] Tested {len(screenshot_files)} screenshots with {len(self.selected_templates)} templates")
        print(f"[IMAGES] Generated {len(screenshot_files) * 6} result images (6 methods per screenshot)")
        print(f"[SUCCESS] {total_found}/{total_tests} primary method matches found ({100.0*total_found/total_tests:.1f}%)")
        print("\n[METHOD STATISTICS] (All 6 methods tested for each template)")
        for method_name, stats in method_stats.items():
            found = stats['found']
            total = stats['total']
            rate = 100.0 * found / total if total > 0 else 0
            print(f"  {method_name:20s}: {found:3d}/{total:3d} ({rate:5.1f}%)")
        print("="*70)


def main():
    """Main function"""
    try:
        tester = TemplateMatchingTester()
        tester.run()
    except KeyboardInterrupt:
        print("\n\n[CANCELLED] Test cancelled by user")
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
