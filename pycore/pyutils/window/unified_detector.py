#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Object Detector
Universal object detector - can be used as a library or run as a command-line tool

Usage as library:
    from pycore.pyutils.window.unified_detector import UnifiedDetector

    # Simple usage (automatically uses latest model)
    detector = UnifiedDetector("d3-check")
    results = detector.detect("screenshot.png")

    # Specify model
    detector = UnifiedDetector("d3-check", model_name="unified_model_20251017_143052")

    # Only detect specific class
    results = detector.detect("screenshot.png", target_class="progress_bar")

Usage as CLI:
    # Basic detection
    python -m pycore.pyutils.window.unified_detector d3-check screenshot.png

    # View help
    python -m pycore.pyutils.window.unified_detector d3-check --help

    # List available classes
    python -m pycore.pyutils.window.unified_detector d3-check --list-classes
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from dataclasses import dataclass
import argparse
import json

from pycore.pyfoundations.third_party.api import get_third_package_cv2, get_third_package_numpy, get_third_package_yaml

import time
import traceback


cv2 = get_third_package_cv2()
np = get_third_package_numpy()
yaml = get_third_package_yaml()


@dataclass
class DetectionResult:
    """Detection result dataclass"""
    class_name: str          # Class name
    confidence: float        # Confidence
    bbox: Dict[str, int]     # Bounding box {x, y, w, h}
    model_type: str          # Model type (classification/detection)
    model_name: str          # Model name

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'class': self.class_name,
            'confidence': self.confidence,
            'bbox': self.bbox,
            'model_type': self.model_type,
            'model_name': self.model_name
        }

    def __repr__(self) -> str:
        return f"Detection({self.class_name}, conf={self.confidence:.2f}, bbox={self.bbox})"


class UnifiedDetector:
    """
    Universal object detector

    Supports automatic loading of classification and detection models, provides simple detection interface
    """

    def __init__(
        self,
        project_name: str,
        model_name: Optional[str] = None,
        model_type: Optional[str] = None,  # 'classification', 'detection', or None (auto)
        confidence_threshold: float = 0.25,
        device: str = 'auto'
    ):
        """
        Initialize detector

        Args:
            project_name: Project name (directory name under apps, e.g., 'd3-check')
            model_name: Model name (optional, defaults to latest model)
            model_type: Model type (optional, 'classification'/'detection'/None=auto-detect)
            confidence_threshold: Confidence threshold
            device: Device ('auto', 'cpu', 'cuda', 'mps')
        """
        self.project_name = project_name
        self.confidence_threshold = confidence_threshold
        self.device = self._detect_device(device)

        # Locate project directory
        self.project_root = self._find_project_root(project_name)
        if not self.project_root:
            raise ValueError(f"Project '{project_name}' not found in apps directory")

        # Model directories
        self.cache_dir = self.project_root / ".cache" / "training_data"
        self.classification_dir = self.cache_dir / "3_models" / "classification"
        self.detection_dir = self.cache_dir / "3_models" / "detection"

        # Load models
        self.classification_model = None
        self.detection_model = None
        self.classification_info = None
        self.detection_info = None

        self._load_models(model_name, model_type)

    def _find_project_root(self, project_name: str) -> Optional[Path]:
        """Find project root directory"""
        # Search upward from current file to find core_node
        current = Path(__file__).resolve()
        while current.parent != current:
            if current.name == 'core_node':
                apps_dir = current / 'apps' / project_name
                if apps_dir.exists():
                    return apps_dir
                break
            current = current.parent
        return None

    def _detect_device(self, device: str) -> str:
        """Detect available device"""
        if device != 'auto':
            return device

        try:
            if torch.cuda.is_available():
                return 'cuda'
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return 'mps'
        except ImportError:
            pass
        return 'cpu'

    def _load_models(self, model_name: Optional[str], model_type: Optional[str]):
        """Load models"""

        # If model type is specified, only load that type
        load_cls = model_type in [None, 'classification']
        load_det = model_type in [None, 'detection']

        # Load classification model
        if load_cls and self.classification_dir.exists():
            models = self._scan_models(self.classification_dir)
            if models:
                if model_name and model_name in models:
                    selected = models[model_name]
                else:
                    # Use latest model
                    selected = sorted(models.items(), key=lambda x: x[1]['mtime'], reverse=True)[0][1]

                self.classification_model = YOLO(str(selected['path']))
                self.classification_info = selected

        # Load detection model
        if load_det and self.detection_dir.exists():
            models = self._scan_models(self.detection_dir)
            if models:
                if model_name and model_name in models:
                    selected = models[model_name]
                else:
                    # Use latest model
                    selected = sorted(models.items(), key=lambda x: x[1]['mtime'], reverse=True)[0][1]

                self.detection_model = YOLO(str(selected['path']))
                self.detection_info = selected

                # Load class information
                data_yaml = self.cache_dir / "2_datasets" / "detection" / "unified_model" / "data.yaml"
                if data_yaml.exists():
                    with open(data_yaml, 'r', encoding='utf-8') as f:
                        data = yaml.safe_load(f)
                        if 'names' in data:
                            self.detection_info['classes'] = data['names']

        if not self.classification_model and not self.detection_model:
            raise ValueError(f"No models found for project '{self.project_name}'")

    def _scan_models(self, model_dir: Path) -> Dict[str, Dict]:
        """Scan model directory"""
        models = {}

        for subdir in model_dir.iterdir():
            if not subdir.is_dir():
                continue

            best_pt = subdir / "weights" / "best.pt"
            if best_pt.exists():
                mtime = best_pt.stat().st_mtime
                models[subdir.name] = {
                    'name': subdir.name,
                    'path': best_pt,
                    'mtime': mtime,
                    'mtime_str': time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime))
                }

        return models

    def get_available_classes(self) -> List[str]:
        """Get available detection classes"""
        classes = []

        if self.classification_model:
            classes.extend(['yes', 'no'])  # Classification model classes

        if self.detection_model and self.detection_info:
            classes.extend(self.detection_info.get('classes', []))

        return list(set(classes))

    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        info = {
            'project': self.project_name,
            'device': self.device,
            'confidence_threshold': self.confidence_threshold
        }

        if self.classification_model:
            info['classification'] = {
                'name': self.classification_info['name'],
                'created': self.classification_info['mtime_str'],
                'classes': ['yes', 'no']
            }

        if self.detection_model:
            info['detection'] = {
                'name': self.detection_info['name'],
                'created': self.detection_info['mtime_str'],
                'classes': self.detection_info.get('classes', [])
            }

        return info

    def detect(
        self,
        image: Union[str, Path, np.ndarray],
        target_class: Optional[str] = None,
        confidence_threshold: Optional[float] = None,
        use_640: bool = True
    ) -> List[DetectionResult]:
        """
        Detect objects in image

        Args:
            image: Image path or numpy array
            target_class: Target class (optional, only return detections of specified class)
            confidence_threshold: Confidence threshold (optional, overrides initialization value)
            use_640: Whether to use 640x640 optimization (detection model only)

        Returns:
            List of detection results
        """
        # Load image
        if isinstance(image, (str, Path)):
            img = cv2.imread(str(image))
            if img is None:
                raise ValueError(f"Failed to load image: {image}")
        else:
            img = image

        conf_thresh = confidence_threshold if confidence_threshold is not None else self.confidence_threshold
        results = []

        # Classification model detection
        if self.classification_model:
            cls_results = self._detect_classification(img, conf_thresh)
            results.extend(cls_results)

        # Detection model detection
        if self.detection_model:
            det_results = self._detect_detection(img, conf_thresh, use_640)
            results.extend(det_results)

        # Filter target class
        if target_class:
            results = [r for r in results if r.class_name == target_class]

        return results

    def _detect_classification(
        self,
        image: np.ndarray,
        confidence_threshold: float,
        window_size: int = 76,
        stride: Optional[int] = None
    ) -> List[DetectionResult]:
        """Classification model detection (sliding window)"""
        img_h, img_w = image.shape[:2]

        if stride is None:
            stride = window_size // 2

        results = []

        for y in range(0, img_h - window_size + 1, stride):
            for x in range(0, img_w - window_size + 1, stride):
                window = image[y:y+window_size, x:x+window_size]

                # Predict
                preds = self.classification_model(window, verbose=False)

                for pred in preds:
                    if hasattr(pred, 'probs'):
                        probs = pred.probs
                        class_id = int(probs.top1)
                        confidence = float(probs.top1conf)

                        # class_id=1 means "yes"
                        if class_id == 1 and confidence >= confidence_threshold:
                            results.append(DetectionResult(
                                class_name='yes',
                                confidence=confidence,
                                bbox={'x': x, 'y': y, 'w': window_size, 'h': window_size},
                                model_type='classification',
                                model_name=self.classification_info['name']
                            ))

        return results

    def _detect_detection(
        self,
        image: np.ndarray,
        confidence_threshold: float,
        use_640: bool = True,
        iou_threshold: float = 0.45
    ) -> List[DetectionResult]:
        """Detection model detection"""
        orig_h, orig_w = image.shape[:2]
        classes = self.detection_info.get('classes', [])

        if use_640 and (orig_w > 640 or orig_h > 640):
            # 640x640 optimization
            target_size = 640
            scale = min(target_size / orig_w, target_size / orig_h)
            new_w = int(orig_w * scale)
            new_h = int(orig_h * scale)

            # Resize and add padding
            resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
            canvas = np.zeros((target_size, target_size, 3), dtype=np.uint8)
            pad_x = (target_size - new_w) // 2
            pad_y = (target_size - new_h) // 2
            canvas[pad_y:pad_y+new_h, pad_x:pad_x+new_w] = resized

            # Detect
            preds = self.detection_model(
                canvas,
                conf=confidence_threshold,
                iou=iou_threshold,
                verbose=False
            )
        else:
            # Original size detection
            scale = 1.0
            pad_x = pad_y = 0
            preds = self.detection_model(
                image,
                conf=confidence_threshold,
                iou=iou_threshold,
                verbose=False
            )

        results = []

        for pred in preds:
            boxes = pred.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])

                # Convert coordinates back to original size
                if use_640 and scale != 1.0:
                    x1 = (x1 - pad_x) / scale
                    y1 = (y1 - pad_y) / scale
                    x2 = (x2 - pad_x) / scale
                    y2 = (y2 - pad_y) / scale

                # Clip to boundaries
                x1 = max(0, min(x1, orig_w))
                y1 = max(0, min(y1, orig_h))
                x2 = max(0, min(x2, orig_w))
                y2 = max(0, min(y2, orig_h))

                class_name = classes[class_id] if class_id < len(classes) else f"class_{class_id}"

                results.append(DetectionResult(
                    class_name=class_name,
                    confidence=confidence,
                    bbox={
                        'x': int(x1),
                        'y': int(y1),
                        'w': int(x2 - x1),
                        'h': int(y2 - y1)
                    },
                    model_type='detection',
                    model_name=self.detection_info['name']
                ))

        return results

    def detect_and_draw(
        self,
        image: Union[str, Path, np.ndarray],
        output_path: Optional[Union[str, Path]] = None,
        target_class: Optional[str] = None,
        **kwargs
    ) -> tuple[List[DetectionResult], np.ndarray]:
        """
        Detect and draw results

        Args:
            image: Input image
            output_path: Output path (optional)
            target_class: Target class (optional)
            **kwargs: Other parameters passed to detect()

        Returns:
            (Detection results, drawn image)
        """
        # Load image
        if isinstance(image, (str, Path)):
            img = cv2.imread(str(image))
            if img is None:
                raise ValueError(f"Failed to load image: {image}")
        else:
            img = image.copy()

        # Detect
        results = self.detect(img, target_class=target_class, **kwargs)

        # Draw
        output = img.copy()
        colors = {
            'classification': (0, 255, 0),  # Green
            'detection': (0, 0, 255),       # Red
        }

        for result in results:
            color = colors.get(result.model_type, (255, 0, 0))
            bbox = result.bbox
            x, y, w, h = bbox['x'], bbox['y'], bbox['w'], bbox['h']

            # Draw box
            cv2.rectangle(output, (x, y), (x+w, y+h), color, 2)

            # Draw label
            label = f"{result.class_name}: {result.confidence:.2f}"
            cv2.putText(
                output,
                label,
                (x, y - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2
            )

        # Save
        if output_path:
            cv2.imwrite(str(output_path), output)

        return results, output


def main():
    """Command-line entry point"""
    parser = argparse.ArgumentParser(
        description="Unified Object Detector - Universal object detector",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic detection
  python -m pycore.pyutils.window.unified_detector d3-check screenshot.png

  # View help information
  python -m pycore.pyutils.window.unified_detector d3-check --help

  # List available classes
  python -m pycore.pyutils.window.unified_detector d3-check --list-classes

  # Only detect specific class
  python -m pycore.pyutils.window.unified_detector d3-check screenshot.png --target progress_bar

  # Specify model
  python -m pycore.pyutils.window.unified_detector d3-check screenshot.png --model unified_model_20251017_143052

  # Save results
  python -m pycore.pyutils.window.unified_detector d3-check screenshot.png --output result.png

  # JSON output
  python -m pycore.pyutils.window.unified_detector d3-check screenshot.png --json
        """
    )

    parser.add_argument(
        "project",
        type=str,
        help="Project name (project under apps directory, e.g., 'd3-check')"
    )

    parser.add_argument(
        "image",
        type=str,
        nargs='?',
        help="Input image path"
    )

    parser.add_argument(
        "--model",
        "-m",
        type=str,
        default=None,
        help="Model name (defaults to latest model)"
    )

    parser.add_argument(
        "--type",
        "-t",
        type=str,
        choices=['classification', 'detection'],
        default=None,
        help="Model type (defaults to auto-detect)"
    )

    parser.add_argument(
        "--conf",
        "--confidence",
        type=float,
        default=0.25,
        dest="confidence",
        help="Confidence threshold (default: 0.25)"
    )

    parser.add_argument(
        "--target",
        type=str,
        default=None,
        help="Target class (only return specified class)"
    )

    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="Output image path"
    )

    parser.add_argument(
        "--list-classes",
        action="store_true",
        help="List available detection classes"
    )

    parser.add_argument(
        "--info",
        action="store_true",
        help="Display model information"
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results in JSON format"
    )

    parser.add_argument(
        "--no-640",
        action="store_true",
        help="Disable 640x640 optimization"
    )

    args = parser.parse_args()

    try:
        # Create detector
        detector = UnifiedDetector(
            project_name=args.project,
            model_name=args.model,
            model_type=args.type,
            confidence_threshold=args.confidence
        )

        # List classes
        if args.list_classes:
            classes = detector.get_available_classes()
            print("\nAvailable detection classes:")
            for cls in classes:
                print(f"  - {cls}")
            return 0

        # Display model information
        if args.info:
            info = detector.get_model_info()
            print("\nModel Information:")
            print(json.dumps(info, indent=2, ensure_ascii=False))
            return 0

        # Detect image
        if not args.image:
            parser.error("Image path required, or use --list-classes / --info to view information")

        # Execute detection
        results = detector.detect(
            args.image,
            target_class=args.target,
            use_640=not args.no_640
        )

        # Output results
        if args.json:
            # JSON format
            output = {
                'image': args.image,
                'detections': [r.to_dict() for r in results],
                'count': len(results)
            }
            print(json.dumps(output, indent=2, ensure_ascii=False))
        else:
            # Text format
            print(f"\nDetection results: {args.image}")
            print(f"Found {len(results)} objects:")

            for i, result in enumerate(results, 1):
                print(f"\n[{i}] {result.class_name}")
                print(f"    Confidence: {result.confidence:.3f}")
                print(f"    Position: x={result.bbox['x']}, y={result.bbox['y']}, "
                      f"w={result.bbox['w']}, h={result.bbox['h']}")
                print(f"    Model: {result.model_name} ({result.model_type})")

        # Save drawn results
        if args.output:
            _, output_img = detector.detect_and_draw(
                args.image,
                output_path=args.output,
                target_class=args.target,
                use_640=not args.no_640
            )
            print(f"\nResults saved to: {args.output}")

        return 0

    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
