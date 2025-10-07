"""
Multi-scale Image Matching Tool
Supports 5 different matching methods with multi-scale image processing
"""

import cv2
import numpy as np
from pathlib import Path
from datetime import datetime
import json
from typing import List, Tuple, Dict, Optional


class MultiScaleImageMatcher:
    """Multi-scale image matcher with adaptive scaling"""

    # Reference resolution (base scale = 1.0)
    REFERENCE_WIDTH = 1826
    REFERENCE_HEIGHT = 1301

    def __init__(self, base_image_path: str, template_paths: List[str], output_dir: str):
        """
        Initialize matcher

        Args:
            base_image_path: Base image path
            template_paths: Template image paths list
            output_dir: Output directory
        """
        self.base_image_path = base_image_path
        self.template_paths = template_paths
        self.output_dir = Path(output_dir)

        # Create timestamp directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.work_dir = self.output_dir / f"match_results_{timestamp}"
        self.work_dir.mkdir(parents=True, exist_ok=True)

        # Load base image
        self.base_image = cv2.imread(base_image_path)
        if self.base_image is None:
            raise ValueError(f"Failed to load image: {base_image_path}")

        # Calculate base scale factor relative to reference resolution
        original_height, original_width = self.base_image.shape[:2]
        self.base_scale_x = original_width / self.REFERENCE_WIDTH
        self.base_scale_y = original_height / self.REFERENCE_HEIGHT

        print(f"[OK] Loaded base image: {base_image_path}")
        print(f"[INFO] Original size: {original_width}x{original_height}")
        print(f"[INFO] Reference size: {self.REFERENCE_WIDTH}x{self.REFERENCE_HEIGHT}")
        print(f"[INFO] Base scale factor: X={self.base_scale_x:.3f}, Y={self.base_scale_y:.3f}")

        # Load all templates (original size, will be scaled per operation)
        self.templates = []
        for template_path in template_paths:
            # Load with alpha channel if PNG
            if template_path.lower().endswith('.png'):
                template = cv2.imread(template_path, cv2.IMREAD_UNCHANGED)  # Keep alpha channel
            else:
                template = cv2.imread(template_path)

            if template is not None:
                self.templates.append({
                    'image': template,
                    'path': template_path,
                    'name': Path(template_path).name,
                    'has_alpha': template.shape[2] == 4 if len(template.shape) == 3 else False
                })
                alpha_status = "with alpha" if template.shape[2] == 4 else "no alpha"
                print(f"  - {Path(template_path).name}: {template.shape} ({alpha_status})")

        print(f"[OK] Loaded templates: {len(self.templates)}")
        print(f"[OK] Work directory: {self.work_dir}")

    def method1_template_matching_ccoeff(self, img: np.ndarray, template: np.ndarray) -> Optional[Dict]:
        """Method 1: OpenCV Template Matching - Normalized Correlation Coefficient"""
        # Check if template has alpha channel
        mask = None
        if template.shape[2] == 4:  # BGRA
            mask = template[:, :, 3]  # Extract alpha channel as mask
            template = template[:, :, :3]  # Use only BGR channels

        result = cv2.matchTemplate(img, template, cv2.TM_CCOEFF_NORMED, mask=mask)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        if max_val > 0.7:  # threshold
            return {
                'method': 'TM_CCOEFF_NORMED',
                'location': max_loc,
                'confidence': float(max_val),
                'size': template.shape[:2][::-1]
            }
        return None

    def method2_template_matching_ccorr(self, img: np.ndarray, template: np.ndarray) -> Optional[Dict]:
        """Method 2: OpenCV Template Matching - Normalized Correlation"""
        # Check if template has alpha channel
        mask = None
        if template.shape[2] == 4:  # BGRA
            mask = template[:, :, 3]
            template = template[:, :, :3]

        result = cv2.matchTemplate(img, template, cv2.TM_CCORR_NORMED, mask=mask)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        if max_val > 0.7:
            return {
                'method': 'TM_CCORR_NORMED',
                'location': max_loc,
                'confidence': float(max_val),
                'size': template.shape[:2][::-1]
            }
        return None

    def method3_template_matching_sqdiff(self, img: np.ndarray, template: np.ndarray) -> Optional[Dict]:
        """Method 3: OpenCV Template Matching - Normalized Square Difference"""
        # Check if template has alpha channel
        mask = None
        if template.shape[2] == 4:  # BGRA
            mask = template[:, :, 3]
            template = template[:, :, :3]

        result = cv2.matchTemplate(img, template, cv2.TM_SQDIFF_NORMED, mask=mask)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        if min_val < 0.3:  # Note: lower is better for square difference
            return {
                'method': 'TM_SQDIFF_NORMED',
                'location': min_loc,
                'confidence': float(1 - min_val),
                'size': template.shape[:2][::-1]
            }
        return None

    def method4_sift_matching(self, img: np.ndarray, template: np.ndarray) -> Optional[Dict]:
        """Method 4: SIFT Feature Matching"""
        try:
            # Handle alpha channel
            if template.shape[2] == 4:
                # Create mask from alpha channel
                alpha_mask = template[:, :, 3]
                template = template[:, :, :3]
            else:
                alpha_mask = None

            # Convert to grayscale
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

            # Apply mask to template if exists
            if alpha_mask is not None:
                template_gray = cv2.bitwise_and(template_gray, template_gray, mask=alpha_mask)

            # Create SIFT detector
            sift = cv2.SIFT_create()

            # Detect keypoints and descriptors
            kp1, des1 = sift.detectAndCompute(template_gray, mask=alpha_mask)
            kp2, des2 = sift.detectAndCompute(img_gray, None)

            if des1 is None or des2 is None:
                return None

            # Use FLANN matcher
            FLANN_INDEX_KDTREE = 1
            index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
            search_params = dict(checks=50)
            flann = cv2.FlannBasedMatcher(index_params, search_params)

            matches = flann.knnMatch(des1, des2, k=2)

            # Apply ratio test
            good_matches = []
            for m_n in matches:
                if len(m_n) == 2:
                    m, n = m_n
                    if m.distance < 0.7 * n.distance:
                        good_matches.append(m)

            if len(good_matches) > 10:
                # Get coordinates of matched points
                src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

                # Calculate homography matrix
                M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

                if M is not None:
                    # Get four corners of template
                    h, w = template.shape[:2]
                    pts = np.float32([[0, 0], [0, h-1], [w-1, h-1], [w-1, 0]]).reshape(-1, 1, 2)
                    dst = cv2.perspectiveTransform(pts, M)

                    # Calculate center point
                    center = np.mean(dst, axis=0)[0]

                    return {
                        'method': 'SIFT',
                        'location': tuple(map(int, center - np.array([w/2, h/2]))),
                        'confidence': float(len(good_matches) / max(len(kp1), 1)),
                        'size': (w, h),
                        'good_matches': len(good_matches)
                    }
        except Exception as e:
            print(f"  SIFT matching error: {e}")
        return None

    def method5_orb_matching(self, img: np.ndarray, template: np.ndarray) -> Optional[Dict]:
        """Method 5: ORB Feature Matching"""
        try:
            # Handle alpha channel
            if template.shape[2] == 4:
                alpha_mask = template[:, :, 3]
                template = template[:, :, :3]
            else:
                alpha_mask = None

            # Convert to grayscale
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

            # Apply mask to template if exists
            if alpha_mask is not None:
                template_gray = cv2.bitwise_and(template_gray, template_gray, mask=alpha_mask)

            # Create ORB detector
            orb = cv2.ORB_create(nfeatures=2000)

            # Detect keypoints and descriptors
            kp1, des1 = orb.detectAndCompute(template_gray, mask=alpha_mask)
            kp2, des2 = orb.detectAndCompute(img_gray, None)

            if des1 is None or des2 is None:
                return None

            # Use BFMatcher
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
            matches = bf.knnMatch(des1, des2, k=2)

            # Apply ratio test
            good_matches = []
            for m_n in matches:
                if len(m_n) == 2:
                    m, n = m_n
                    if m.distance < 0.75 * n.distance:
                        good_matches.append(m)

            if len(good_matches) > 10:
                # Get coordinates of matched points
                src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

                # Calculate homography matrix
                M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

                if M is not None:
                    h, w = template.shape[:2]
                    pts = np.float32([[0, 0], [0, h-1], [w-1, h-1], [w-1, 0]]).reshape(-1, 1, 2)
                    dst = cv2.perspectiveTransform(pts, M)

                    center = np.mean(dst, axis=0)[0]

                    return {
                        'method': 'ORB',
                        'location': tuple(map(int, center - np.array([w/2, h/2]))),
                        'confidence': float(len(good_matches) / max(len(kp1), 1)),
                        'size': (w, h),
                        'good_matches': len(good_matches)
                    }
        except Exception as e:
            print(f"  ORB matching error: {e}")
        return None

    def method6_akaze_matching(self, img: np.ndarray, template: np.ndarray) -> Optional[Dict]:
        """Method 6: AKAZE Feature Matching - Optimized for stretched/scaled images"""
        try:
            # Handle alpha channel
            if template.shape[2] == 4:
                alpha_mask = template[:, :, 3]
                template = template[:, :, :3]
            else:
                alpha_mask = None

            # Convert to grayscale
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

            # Apply mask to template if exists
            if alpha_mask is not None:
                template_gray = cv2.bitwise_and(template_gray, template_gray, mask=alpha_mask)

            # Create AKAZE detector (better for non-uniform scaling)
            akaze = cv2.AKAZE_create()

            # Detect keypoints and descriptors
            kp1, des1 = akaze.detectAndCompute(template_gray, mask=alpha_mask)
            kp2, des2 = akaze.detectAndCompute(img_gray, None)

            if des1 is None or des2 is None:
                return None

            # Use BFMatcher with Hamming distance for AKAZE
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
            matches = bf.knnMatch(des1, des2, k=2)

            # Apply ratio test
            good_matches = []
            for m_n in matches:
                if len(m_n) == 2:
                    m, n = m_n
                    if m.distance < 0.7 * n.distance:
                        good_matches.append(m)

            if len(good_matches) > 8:  # Lower threshold for AKAZE
                # Get coordinates of matched points
                src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

                # Calculate homography matrix
                M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

                if M is not None:
                    h, w = template.shape[:2]
                    pts = np.float32([[0, 0], [0, h-1], [w-1, h-1], [w-1, 0]]).reshape(-1, 1, 2)
                    dst = cv2.perspectiveTransform(pts, M)

                    center = np.mean(dst, axis=0)[0]

                    return {
                        'method': 'AKAZE',
                        'location': tuple(map(int, center - np.array([w/2, h/2]))),
                        'confidence': float(len(good_matches) / max(len(kp1), 1)),
                        'size': (w, h),
                        'good_matches': len(good_matches)
                    }
        except Exception as e:
            print(f"  AKAZE matching error: {e}")
        return None

    def draw_method_results_all_templates(self, img: np.ndarray, method_name: str,
                                           template_matches: List[Dict], scale_info: str) -> np.ndarray:
        """Draw single method results for ALL templates on one image"""
        result_img = img.copy()

        # Define color for different templates
        template_colors = [
            (0, 255, 0),    # Green
            (255, 0, 0),    # Blue
            (0, 0, 255),    # Red
            (255, 255, 0),  # Cyan
            (255, 0, 255),  # Magenta
            (0, 165, 255),  # Orange
        ]

        found_count = 0

        # Draw all template matches for this method
        for idx, template_match in enumerate(template_matches):
            template_name = template_match['template']
            match = template_match['match']

            color = template_colors[idx % len(template_colors)]

            if match:  # Found
                loc = match['location']
                w, h = match['size']
                confidence = match['confidence']

                # Draw rectangle
                cv2.rectangle(result_img, loc, (loc[0] + w, loc[1] + h), color, 3)

                # Draw center point
                center_x = loc[0] + w // 2
                center_y = loc[1] + h // 2
                cv2.circle(result_img, (center_x, center_y), 5, (0, 0, 255), -1)

                # Draw template name and confidence
                text = f"{template_name[:20]}: {confidence:.3f}"
                text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]

                # Add text background
                cv2.rectangle(result_img,
                             (loc[0], loc[1] - text_size[1] - 10),
                             (loc[0] + text_size[0] + 6, loc[1] - 2),
                             color, -1)

                # Draw text
                cv2.putText(result_img, text, (loc[0] + 3, loc[1] - 6),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

                found_count += 1

        # Draw header background
        cv2.rectangle(result_img, (0, 0), (result_img.shape[1], 80), (0, 0, 0), -1)

        # Draw method info
        cv2.putText(result_img, f"Method: {method_name}", (10, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

        # Draw scale info
        cv2.putText(result_img, f"Scale: {scale_info}", (10, 50),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # Draw match count
        match_text = f"Matches: {found_count}/{len(template_matches)}"
        match_color = (0, 255, 0) if found_count > 0 else (0, 0, 255)
        cv2.putText(result_img, match_text, (10, 72),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, match_color, 2)

        return result_img

    def process_scale(self, scale_x: float, scale_y: float, scale_index: int, scale_name: str):
        """Process single scale (supports non-uniform scaling)"""
        print(f"\n{'='*70}")
        print(f"Processing scale: {scale_name} (#{scale_index})")
        print(f"{'='*70}")

        # Calculate combined scale: base_scale * test_scale
        combined_scale_x = self.base_scale_x * scale_x
        combined_scale_y = self.base_scale_y * scale_y

        print(f"[SCALE] Base scale: X={self.base_scale_x:.3f}, Y={self.base_scale_y:.3f}")
        print(f"[SCALE] Test scale: X={scale_x:.3f}, Y={scale_y:.3f}")
        print(f"[SCALE] Combined scale: X={combined_scale_x:.3f}, Y={combined_scale_y:.3f}")

        # Scale image to reference resolution first, then apply test scale
        # This ensures consistent scaling between image and templates
        reference_width = int(self.REFERENCE_WIDTH * scale_x)
        reference_height = int(self.REFERENCE_HEIGHT * scale_y)

        scaled_img = cv2.resize(self.base_image, (reference_width, reference_height),
                               interpolation=cv2.INTER_CUBIC if scale_x > 1 or scale_y > 1 else cv2.INTER_AREA)

        # Save scaled temporary image
        scale_filename = scale_name.replace(' ', '_').replace('%', 'pct').replace('x', 'x')
        temp_img_path = self.work_dir / f"tmp_{scale_index:02d}_{scale_filename}.jpg"
        cv2.imwrite(str(temp_img_path), scaled_img)
        print(f"[TEMP] Saved: {temp_img_path.name}, Size: {scaled_img.shape[:2]}")

        # Define all matching methods
        methods = [
            ('TM_CCOEFF_NORMED', self.method1_template_matching_ccoeff),
            ('TM_CCORR_NORMED', self.method2_template_matching_ccorr),
            ('TM_SQDIFF_NORMED', self.method3_template_matching_sqdiff),
            ('SIFT', self.method4_sift_matching),
            ('ORB', self.method5_orb_matching),
            ('AKAZE', self.method6_akaze_matching),
        ]

        # Track results by method
        method_results = []

        # Process each method
        for method_name, method_func in methods:
            print(f"\n[METHOD] {method_name}")

            # Apply this method to ALL templates
            template_matches = []

            for template_info in self.templates:
                original_template = template_info['image']
                template_name = template_info['name']

                # Scale template using COMBINED scale factor
                template_height, template_width = original_template.shape[:2]
                scaled_template_width = int(template_width * combined_scale_x)
                scaled_template_height = int(template_height * combined_scale_y)

                # Ensure minimum size
                if scaled_template_width < 3 or scaled_template_height < 3:
                    print(f"  [TEMPLATE] {template_name}... SKIPPED (too small after scaling)")
                    template_matches.append({
                        'template': template_name,
                        'match': None
                    })
                    continue

                scaled_template = cv2.resize(original_template,
                                            (scaled_template_width, scaled_template_height),
                                            interpolation=cv2.INTER_CUBIC if combined_scale_x > 1 else cv2.INTER_AREA)

                print(f"  [TEMPLATE] {template_name} (scaled {template_width}x{template_height} -> {scaled_template_width}x{scaled_template_height})... ", end='')

                try:
                    match_result = method_func(scaled_img, scaled_template)

                    if match_result:
                        print(f"FOUND (conf: {match_result['confidence']:.3f}, pos: {match_result['location']})")
                    else:
                        print(f"NOT FOUND")

                    template_matches.append({
                        'template': template_name,
                        'match': match_result
                    })

                except Exception as e:
                    print(f"ERROR - {e}")
                    template_matches.append({
                        'template': template_name,
                        'match': None
                    })

            # Draw ALL templates for this method on ONE image
            result_img = self.draw_method_results_all_templates(
                scaled_img, method_name, template_matches, scale_name
            )

            # Save result image for this method (contains all templates)
            result_filename = f"result_{scale_index:02d}_{scale_filename}_{method_name}.jpg"
            result_path = self.work_dir / result_filename
            cv2.imwrite(str(result_path), result_img)

            found_count = sum(1 for tm in template_matches if tm['match'] is not None)
            print(f"  [SAVED] {result_filename} ({found_count}/{len(template_matches)} found)")

            method_results.append({
                'method': method_name,
                'template_matches': template_matches,
                'result_image': str(result_path),
                'found_count': found_count
            })

        # Summary
        total_found = sum(r['found_count'] for r in method_results)
        total_attempted = len(methods) * len(self.templates)
        print(f"\n[SUMMARY] Scale {scale_name}: {total_found}/{total_attempted} matches found")

        return {
            'scale_name': scale_name,
            'scale_x': scale_x,
            'scale_y': scale_y,
            'combined_scale_x': combined_scale_x,
            'combined_scale_y': combined_scale_y,
            'scale_index': scale_index,
            'temp_image': str(temp_img_path),
            'method_results': method_results,
            'found_count': total_found,
            'total_count': total_attempted
        }

    def run(self):
        """Run complete matching workflow"""
        print("\n" + "="*70)
        print("  Multi-scale Image Matching Tool")
        print("  6 Methods x N Templates x 11 Scales")
        print("="*70)

        # Define scale configurations: (scale_x, scale_y, name)
        # Uniform scaling + Non-uniform scaling (vertical and horizontal stretch)
        scale_configs = [
            # Uniform scaling
            (0.5, 0.5, "50%"),
            (0.75, 0.75, "75%"),
            (1.0, 1.0, "100%"),
            (1.5, 1.5, "150%"),
            (2.0, 2.0, "200%"),
            # Non-uniform scaling - Horizontal stretch
            (2.0, 0.5, "200% Horizontal x 50% Vertical"),
            (2.0, 1.0, "200% Horizontal x 100% Vertical"),
            (0.5, 1.0, "50% Horizontal x 100% Vertical"),
            # Non-uniform scaling - Vertical stretch
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
            total_found += result['found_count']
            total_attempted += result['total_count']

        # Save summary report
        report_path = self.work_dir / "match_report.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({
                'base_image': self.base_image_path,
                'templates': [t['path'] for t in self.templates],
                'total_scales': len(scale_configs),
                'total_methods': 6,
                'total_templates': len(self.templates),
                'total_attempted': total_attempted,
                'total_found': total_found,
                'success_rate': f"{100.0 * total_found / total_attempted:.2f}%",
                'scales': all_scale_results,
                'timestamp': datetime.now().isoformat()
            }, f, indent=2, ensure_ascii=False)

        print("\n" + "="*70)
        print(f"[COMPLETE] All matching finished!")
        print(f"[OUTPUT] Work directory: {self.work_dir}")
        print(f"[STATS] {total_found}/{total_attempted} matches found ({100.0*total_found/total_attempted:.1f}%)")
        print(f"[IMAGES] Generated {total_attempted} result images")
        print(f"[REPORT] {report_path.name}")
        print("="*70)

        return all_scale_results


def main():
    """Main function"""
    # Configure paths
    base_image = r"C:\Users\MPC\.core_node\pytools\tmp\debug_ui_optimized_20251007_151345_673.png"

    template_dir = r"D:\programing\core_node\apps\d3-check\images"
    template_files = [
        "blacksmith_indicator_1.png",
        "blacksmith_indicator_2.png",
    ]

    template_paths = [str(Path(template_dir) / f) for f in template_files]

    output_dir = r"C:\Users\MPC\.core_node\pytools\tmp"

    # Create matcher and run
    matcher = MultiScaleImageMatcher(base_image, template_paths, output_dir)
    matcher.run()


if __name__ == "__main__":
    main()
