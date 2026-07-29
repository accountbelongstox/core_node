#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Model Validation Script
Validates both classification and detection models automatically
"""

import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
import argparse

from pycore.pyfoundations.third_party.api import get_third_package_cv2, get_third_package_numpy, get_third_package_yaml

cv2 = get_third_package_cv2()
numpy = get_third_package_numpy()
np = numpy
yaml = get_third_package_yaml()

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from d3utils.collectors.ui_region_collector_ultralytics import get_yolo_model


class UnifiedValidator:
    """
    Unified validator for both classification and detection models
    """

    def __init__(self):
        """Initialize unified validator"""
        self.project_root = Path(current_dir)

        # Model directories
        self.cache_dir = self.project_root / ".cache" / "training_data"
        self.classification_dir = self.cache_dir / "3_models" / "classification"
        self.detection_dir = self.cache_dir / "3_models" / "detection"

        # Output directory
        self.output_dir = Path(os.path.expanduser("~")) / ".core_node" / "pytools" / "tmp" / "validation"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Models
        self.classification_models = {}
        self.detection_models = {}

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🔍 Unified Model Validator")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"Classification models: {self.classification_dir}")
        ColorPrint.green(f"Detection models:      {self.detection_dir}")
        ColorPrint.green(f"Output directory:      {self.output_dir}")

    def scan_classification_models(self) -> bool:
        """
        Scan for classification models (all subdirectories with weights/best.pt)

        Returns:
            True if models found
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("📦 Scanning Classification Models")
        ColorPrint.blue(f"{'='*80}")

        if not self.classification_dir.exists():
            ColorPrint.yellow(f"\n⚠️  Classification directory not found: {self.classification_dir}")
            ColorPrint.yellow("   Skipping classification validation")
            return False

        # Scan all subdirectories for models
        model_count = 0
        for model_dir in self.classification_dir.iterdir():
            if not model_dir.is_dir():
                continue

            best_pt = model_dir / "weights" / "best.pt"
            if best_pt.exists():
                model = get_yolo_model(str(best_pt))
                if model is None:
                    ColorPrint.yellow(f"\n⚠️  Failed to load {best_pt}")
                    continue
                mtime = best_pt.stat().st_mtime
                mtime_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime))
                self.classification_models[model_dir.name] = {
                    'model': model,
                    'path': best_pt,
                    'type': 'classification',
                    'window_size': 76,
                    'mtime': mtime,
                    'mtime_str': mtime_str
                }
                ColorPrint.green(f"\n✓ Loaded: {model_dir.name} (Classification)")
                ColorPrint.green(f"   Model: {best_pt}")
                ColorPrint.green(f"   Created: {mtime_str}")
                ColorPrint.green(f"   Window size: 76x76")
                model_count += 1

        if not self.classification_models:
            ColorPrint.yellow("\n⚠️  No classification models found")
            ColorPrint.yellow("   Train with: python train.py --mode classification")
            return False

        ColorPrint.green(f"\n✅ Found {model_count} classification model(s)")
        return True

    def scan_detection_models(self) -> bool:
        """
        Scan for detection models (all subdirectories with weights/best.pt)

        Returns:
            True if models found
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("📦 Scanning Detection Models")
        ColorPrint.blue(f"{'='*80}")

        if not self.detection_dir.exists():
            ColorPrint.yellow(f"\n⚠️  Detection directory not found: {self.detection_dir}")
            ColorPrint.yellow("   Skipping detection validation")
            return False

        # Scan all subdirectories for models
        model_count = 0
        for model_dir in self.detection_dir.iterdir():
            if not model_dir.is_dir():
                continue

            best_pt = model_dir / "weights" / "best.pt"
            if best_pt.exists():
                # Try to read data.yaml for class names
                # Path: .cache/training_data/2_datasets/detection/unified_model/data.yaml
                processed_dir = self.cache_dir / "2_datasets" / "detection" / "unified_model"
                data_yaml = processed_dir / "data.yaml"

                classes = []
                if data_yaml.exists():
                    try:
                        with open(data_yaml, 'r', encoding='utf-8') as f:
                            data = yaml.safe_load(f)
                            if 'names' in data:
                                classes = data['names']
                    except Exception as e:
                        ColorPrint.yellow(f"   Warning: Failed to parse {data_yaml}: {e}")

                model = get_yolo_model(str(best_pt))
                if model is None:
                    ColorPrint.yellow(f"\n⚠️  Failed to load {best_pt}")
                    continue
                mtime = best_pt.stat().st_mtime
                mtime_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime))
                self.detection_models[model_dir.name] = {
                    'model': model,
                    'path': best_pt,
                    'type': 'detection',
                    'classes': classes if classes else ['unknown'],
                    'mtime': mtime,
                    'mtime_str': mtime_str
                }
                ColorPrint.green(f"\n✓ Loaded: {model_dir.name} (Detection)")
                ColorPrint.green(f"   Model: {best_pt}")
                ColorPrint.green(f"   Created: {mtime_str}")
                ColorPrint.green(f"   Classes: {', '.join(classes) if classes else 'unknown'}")
                model_count += 1

        if not self.detection_models:
            ColorPrint.yellow("\n⚠️  No detection models found")
            ColorPrint.yellow("   Train with: python train.py --mode detection")
            return False

        ColorPrint.green(f"\n✅ Found {model_count} detection model(s)")
        return True

    def detect_with_classification(
        self,
        image: np.ndarray,
        model_name: str,
        confidence_threshold: float = 0.5,
        stride: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Detect objects using classification model with sliding window

        Args:
            image: Input image
            model_name: Model name
            confidence_threshold: Confidence threshold
            stride: Sliding window stride

        Returns:
            List of detections
        """
        model_data = self.classification_models[model_name]
        model = model_data['model']
        window_size = model_data['window_size']

        img_h, img_w = image.shape[:2]

        # Default stride is half of window size
        if stride is None:
            stride = window_size // 2

        ColorPrint.blue(f"\n🔍 Classification: {model_name}")
        ColorPrint.green(f"   Window size: {window_size}x{window_size}")
        ColorPrint.green(f"   Stride: {stride}")

        detections = []
        total_windows = 0
        positive_windows = 0

        # Sliding window
        for y in range(0, img_h - window_size + 1, stride):
            for x in range(0, img_w - window_size + 1, stride):
                window = image[y:y+window_size, x:x+window_size]

                # Predict
                results = model(window, verbose=False)
                total_windows += 1

                # Check if "yes" class
                for result in results:
                    if hasattr(result, 'probs'):
                        probs = result.probs
                        class_id = int(probs.top1)
                        confidence = float(probs.top1conf)

                        # class_id=1 means "yes"
                        if class_id == 1 and confidence >= confidence_threshold:
                            positive_windows += 1
                            detections.append({
                                'bbox': {
                                    'x': x,
                                    'y': y,
                                    'w': window_size,
                                    'h': window_size
                                },
                                'confidence': confidence,
                                'class': 'yes',
                                'model': model_name,
                                'model_type': 'classification'
                            })

        ColorPrint.green(f"   Windows: {total_windows}, Detections: {positive_windows}")
        return detections

    def detect_with_detection(
        self,
        image: np.ndarray,
        model_name: str,
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.45
    ) -> tuple:
        """
        Detect objects using detection model with 640x640 optimization

        Args:
            image: Input image (original size)
            model_name: Model name
            confidence_threshold: Confidence threshold
            iou_threshold: IOU threshold for NMS

        Returns:
            (detections, resized_image, scale_factor): Detections in original coordinates,
            640x640 resized image, and scale factor used
        """
        model_data = self.detection_models[model_name]
        model = model_data['model']
        classes = model_data['classes']

        ColorPrint.blue(f"\n🔍 Detection: {model_name}")
        ColorPrint.green(f"   Classes: {', '.join(classes)}")

        # Get original image size
        orig_h, orig_w = image.shape[:2]
        ColorPrint.green(f"   Original size: {orig_w}x{orig_h}")

        # Resize to 640x640 for detection (YOLO standard)
        target_size = 640
        scale = min(target_size / orig_w, target_size / orig_h)
        new_w = int(orig_w * scale)
        new_h = int(orig_h * scale)

        # Resize image
        resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        # Create 640x640 canvas with padding (letterbox)
        canvas = np.zeros((target_size, target_size, 3), dtype=np.uint8)
        pad_x = (target_size - new_w) // 2
        pad_y = (target_size - new_h) // 2
        canvas[pad_y:pad_y+new_h, pad_x:pad_x+new_w] = resized

        ColorPrint.green(f"   Detection size: 640x640 (scale: {scale:.3f})")

        # Run detection on 640x640 image
        results = model(
            canvas,
            conf=confidence_threshold,
            iou=iou_threshold,
            verbose=False
        )

        detections = []

        # Parse results and convert coordinates back to original image size
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Coordinates in 640x640 canvas
                x1_canvas, y1_canvas, x2_canvas, y2_canvas = box.xyxy[0].cpu().numpy()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])

                # Convert back to original image coordinates
                # 1. Remove padding
                x1_resized = x1_canvas - pad_x
                y1_resized = y1_canvas - pad_y
                x2_resized = x2_canvas - pad_x
                y2_resized = y2_canvas - pad_y

                # 2. Scale back to original size
                x1_orig = x1_resized / scale
                y1_orig = y1_resized / scale
                x2_orig = x2_resized / scale
                y2_orig = y2_resized / scale

                # Clip to image bounds
                x1_orig = max(0, min(x1_orig, orig_w))
                y1_orig = max(0, min(y1_orig, orig_h))
                x2_orig = max(0, min(x2_orig, orig_w))
                y2_orig = max(0, min(y2_orig, orig_h))

                class_name = classes[class_id] if class_id < len(classes) else f"class_{class_id}"

                detections.append({
                    'bbox': {
                        'x': int(x1_orig),
                        'y': int(y1_orig),
                        'w': int(x2_orig - x1_orig),
                        'h': int(y2_orig - y1_orig)
                    },
                    'confidence': confidence,
                    'class': class_name,
                    'class_id': class_id,
                    'model': model_name,
                    'model_type': 'detection'
                })

        ColorPrint.green(f"   Detections: {len(detections)}")
        return detections, canvas, scale

    def draw_detections(
        self,
        image: np.ndarray,
        detections: List[Dict[str, Any]],
        image_name: str,
        model_names: List[str] = None,
        detection_time: float = 0.0,
        confidence_threshold: float = 0.25,
        canvas_640: np.ndarray = None,
        scale_factor: float = 1.0
    ) -> Path:
        """
        Draw all detections on image with metadata overlay
        Saves two versions: 640x640 preview and full-size original

        Args:
            image: Input image (original size)
            detections: All detections (in original coordinates)
            image_name: Image name for output
            model_names: List of model names used
            detection_time: Total detection time in seconds
            confidence_threshold: Confidence threshold used
            canvas_640: Optional 640x640 canvas for preview output
            scale_factor: Scale factor used for 640x640 resize

        Returns:
            Path to full-size output image
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🎨 Drawing Results")
        ColorPrint.blue(f"{'='*80}")

        output = image.copy()
        img_h, img_w = output.shape[:2]

        # Color palette
        colors = {
            'classification': (0, 255, 0),     # Green
            'detection': (0, 0, 255),          # Red (BGR)
        }

        # Draw information panel at top
        panel_height = 120
        panel = np.zeros((panel_height, img_w, 3), dtype=np.uint8)
        panel[:] = (40, 40, 40)  # Dark gray background

        # Add border
        cv2.rectangle(panel, (0, 0), (img_w-1, panel_height-1), (100, 100, 100), 2)

        # Add information text
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        font_thickness = 1
        text_color = (255, 255, 255)  # White
        highlight_color = (0, 255, 255)  # Yellow

        y_offset = 25

        # Title
        cv2.putText(panel, "VALIDATION RESULTS", (10, y_offset), font, 0.7, highlight_color, 2)
        y_offset += 25

        # Model names
        if model_names:
            model_text = f"Models: {', '.join(model_names)}"
            cv2.putText(panel, model_text, (10, y_offset), font, font_scale, text_color, font_thickness)
            y_offset += 20

        # Detection time
        time_text = f"Detection Time: {detection_time:.3f}s"
        cv2.putText(panel, time_text, (10, y_offset), font, font_scale, text_color, font_thickness)
        y_offset += 20

        # Confidence threshold
        conf_text = f"Confidence Threshold: {confidence_threshold:.2f}"
        cv2.putText(panel, conf_text, (10, y_offset), font, font_scale, text_color, font_thickness)
        y_offset += 20

        # Total detections
        det_text = f"Total Detections: {len(detections)}"
        cv2.putText(panel, det_text, (10, y_offset), font, font_scale, highlight_color, font_thickness)

        # Combine panel with image
        output = np.vstack([panel, output])

        # Group by model type
        cls_detections = [d for d in detections if d['model_type'] == 'classification']
        det_detections = [d for d in detections if d['model_type'] == 'detection']

        # Draw classification detections (offset by panel height)
        if cls_detections:
            color = colors['classification']
            ColorPrint.green(f"\n📍 Drawing {len(cls_detections)} classification detections")

            for detection in cls_detections:
                bbox = detection['bbox']
                x, y, w, h = bbox['x'], bbox['y'], bbox['w'], bbox['h']
                confidence = detection['confidence']

                # Offset y coordinate by panel height
                y_offset = y + panel_height

                cv2.rectangle(output, (x, y_offset), (x+w, y_offset+h), color, 2)

                label = f"CLS: {confidence:.2f}"
                cv2.putText(
                    output,
                    label,
                    (x, y_offset - 5),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    color,
                    2
                )

        # Draw detection detections (offset by panel height)
        if det_detections:
            color = colors['detection']
            ColorPrint.green(f"\n📍 Drawing {len(det_detections)} detection detections")

            for detection in det_detections:
                bbox = detection['bbox']
                x, y, w, h = bbox['x'], bbox['y'], bbox['w'], bbox['h']
                confidence = detection['confidence']
                class_name = detection['class']

                # Offset y coordinate by panel height
                y_offset = y + panel_height

                cv2.rectangle(output, (x, y_offset), (x+w, y_offset+h), color, 2)

                label = f"DET: {class_name} {confidence:.2f}"
                cv2.putText(
                    output,
                    label,
                    (x, y_offset - 5),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    color,
                    2
                )

        # Save full-size output (original size with annotations)
        output_filename = f"validation_{Path(image_name).stem}_full.png"
        output_path = self.output_dir / output_filename
        cv2.imwrite(str(output_path), output)

        ColorPrint.green(f"\n✅ Saved full-size annotated image:")
        ColorPrint.green(f"   {output_path}")

        # Save 640x640 preview if available (detection model was used)
        if canvas_640 is not None:
            # Create 640x640 output with information panel
            canvas_h, canvas_w = canvas_640.shape[:2]
            panel_640 = np.zeros((panel_height, canvas_w, 3), dtype=np.uint8)
            panel_640[:] = (40, 40, 40)

            # Add border
            cv2.rectangle(panel_640, (0, 0), (canvas_w-1, panel_height-1), (100, 100, 100), 2)

            # Add same information text (scaled for 640x640)
            y_offset = 25
            cv2.putText(panel_640, "VALIDATION RESULTS (640x640 Preview)", (10, y_offset), font, 0.6, highlight_color, 2)
            y_offset += 25

            if model_names:
                model_text = f"Models: {', '.join(model_names)}"
                cv2.putText(panel_640, model_text, (10, y_offset), font, font_scale, text_color, font_thickness)
                y_offset += 20

            time_text = f"Detection Time: {detection_time:.3f}s"
            cv2.putText(panel_640, time_text, (10, y_offset), font, font_scale, text_color, font_thickness)
            y_offset += 20

            conf_text = f"Confidence Threshold: {confidence_threshold:.2f}"
            cv2.putText(panel_640, conf_text, (10, y_offset), font, font_scale, text_color, font_thickness)
            y_offset += 20

            det_text = f"Total Detections: {len(detections)}"
            cv2.putText(panel_640, det_text, (10, y_offset), font, font_scale, highlight_color, font_thickness)

            # Combine panel with 640x640 canvas
            output_640 = np.vstack([panel_640, canvas_640])

            # Draw detection boxes on 640x640 (scaled coordinates)
            for detection in det_detections:
                bbox = detection['bbox']
                # Convert original coordinates to 640x640 coordinates
                x_orig, y_orig, w_orig, h_orig = bbox['x'], bbox['y'], bbox['w'], bbox['h']

                x_640 = int(x_orig * scale_factor)
                y_640 = int(y_orig * scale_factor)
                w_640 = int(w_orig * scale_factor)
                h_640 = int(h_orig * scale_factor)

                # Offset by panel height
                y_640_offset = y_640 + panel_height

                cv2.rectangle(output_640, (x_640, y_640_offset), (x_640+w_640, y_640_offset+h_640), colors['detection'], 2)

                label = f"DET: {detection['class']} {detection['confidence']:.2f}"
                cv2.putText(
                    output_640,
                    label,
                    (x_640, y_640_offset - 5),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.4,
                    colors['detection'],
                    1
                )

            # Save 640x640 version
            output_640_filename = f"validation_{Path(image_name).stem}_640.png"
            output_640_path = self.output_dir / output_640_filename
            cv2.imwrite(str(output_640_path), output_640)

            ColorPrint.green(f"\n✅ Saved 640x640 preview:")
            ColorPrint.green(f"   {output_640_path}")

        return output_path

    def select_models_interactive(self) -> tuple:
        """
        Interactive model selection menu

        Returns:
            (selected_cls_models, selected_det_models) - Lists of selected model names
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("📋 Model Selection Menu")
        ColorPrint.blue(f"{'='*80}")

        selected_cls = []
        selected_det = []

        # Classification models
        if self.classification_models:
            ColorPrint.blue(f"\n📦 Classification Models ({len(self.classification_models)} found):")
            # Sort by creation time (newest first)
            sorted_cls = sorted(
                self.classification_models.items(),
                key=lambda x: x[1]['mtime'],
                reverse=True
            )

            for idx, (name, info) in enumerate(sorted_cls, 1):
                ColorPrint.green(f"  {idx}. {name}")
                ColorPrint.green(f"     Created: {info['mtime_str']}")
                ColorPrint.green(f"     Path: {info['path']}")

            ColorPrint.yellow(f"\nSelect classification models (comma-separated, e.g., 1,2,3)")
            ColorPrint.yellow(f"Press Enter to use latest (recommended), 'a' for all, or 'n' to skip:")

            try:
                choice = input("Selection [Enter=1]: ").strip()
                if choice.lower() == 'n':
                    ColorPrint.yellow("Skipping classification models")
                elif choice == '':
                    # Default: select first (newest) model
                    selected_cls = [sorted_cls[0][0]]
                    ColorPrint.green(f"Selected latest model: {sorted_cls[0][0]}")
                elif choice.lower() == 'a':
                    # Select all
                    selected_cls = [name for name, _ in sorted_cls]
                    ColorPrint.green(f"Selected all {len(selected_cls)} classification models")
                else:
                    indices = [int(x.strip()) for x in choice.split(',')]
                    for idx in indices:
                        if 1 <= idx <= len(sorted_cls):
                            selected_cls.append(sorted_cls[idx-1][0])
                    ColorPrint.green(f"Selected {len(selected_cls)} classification model(s)")
            except (ValueError, IndexError) as e:
                ColorPrint.red(f"Invalid selection: {e}")
                return ([], [])

        # Detection models
        if self.detection_models:
            ColorPrint.blue(f"\n📦 Detection Models ({len(self.detection_models)} found):")
            # Sort by creation time (newest first)
            sorted_det = sorted(
                self.detection_models.items(),
                key=lambda x: x[1]['mtime'],
                reverse=True
            )

            for idx, (name, info) in enumerate(sorted_det, 1):
                ColorPrint.green(f"  {idx}. {name}")
                ColorPrint.green(f"     Created: {info['mtime_str']}")
                ColorPrint.green(f"     Classes: {', '.join(info['classes'])}")
                ColorPrint.green(f"     Path: {info['path']}")

            ColorPrint.yellow(f"\nSelect detection models (comma-separated, e.g., 1,2,3)")
            ColorPrint.yellow(f"Press Enter to use latest (recommended), 'a' for all, or 'n' to skip:")

            try:
                choice = input("Selection [Enter=1]: ").strip()
                if choice.lower() == 'n':
                    ColorPrint.yellow("Skipping detection models")
                elif choice == '':
                    # Default: select first (newest) model
                    selected_det = [sorted_det[0][0]]
                    ColorPrint.green(f"Selected latest model: {sorted_det[0][0]}")
                elif choice.lower() == 'a':
                    # Select all
                    selected_det = [name for name, _ in sorted_det]
                    ColorPrint.green(f"Selected all {len(selected_det)} detection models")
                else:
                    indices = [int(x.strip()) for x in choice.split(',')]
                    for idx in indices:
                        if 1 <= idx <= len(sorted_det):
                            selected_det.append(sorted_det[idx-1][0])
                    ColorPrint.green(f"Selected {len(selected_det)} detection model(s)")
            except (ValueError, IndexError) as e:
                ColorPrint.red(f"Invalid selection: {e}")
                return ([], [])

        return (selected_cls, selected_det)

    def validate(
        self,
        image_path: str,
        confidence_threshold: float = 0.25,
        stride: Optional[int] = None,
        iou_threshold: float = 0.45,
        interactive: bool = False
    ) -> bool:
        """
        Run unified validation workflow

        Args:
            image_path: Path to input image
            confidence_threshold: Confidence threshold (default: 0.25 for detection, 0.5 for classification)
            stride: Sliding window stride (for classification)
            iou_threshold: IOU threshold (for detection)

        Returns:
            True if successful
        """
        image_path = Path(image_path)

        if not image_path.exists():
            ColorPrint.red(f"\n❌ Image not found: {image_path}")
            return False

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue(f"📸 Processing Image: {image_path.name}")
        ColorPrint.blue(f"{'='*80}")

        # Load image
        image = cv2.imread(str(image_path))
        if image is None:
            ColorPrint.red(f"\n❌ Failed to load image: {image_path}")
            return False

        img_h, img_w = image.shape[:2]
        ColorPrint.green(f"Image size: {img_w}x{img_h}")

        # Scan models
        has_classification = self.scan_classification_models()
        has_detection = self.scan_detection_models()

        if not has_classification and not has_detection:
            ColorPrint.red("\n❌ No models found!")
            ColorPrint.yellow("\nTrain models with:")
            ColorPrint.yellow("  python train.py --mode classification")
            ColorPrint.yellow("  python train.py --mode detection")
            return False

        # Model selection
        selected_cls_models = []
        selected_det_models = []

        # Auto-enable interactive mode if multiple models found
        total_models = len(self.classification_models) + len(self.detection_models)

        if not interactive and total_models > 1:
            # Multiple models found - enable interactive selection
            ColorPrint.yellow(f"\n⚠️  Found {total_models} models")
            ColorPrint.yellow("   Enabling interactive mode for model selection...")
            interactive = True

        if interactive:
            # Interactive mode: user selects models
            selected_cls_models, selected_det_models = self.select_models_interactive()
            if not selected_cls_models and not selected_det_models:
                ColorPrint.yellow("\n⚠️  No models selected")
                return False
        else:
            # Non-interactive mode: use all models (single model case)
            selected_cls_models = list(self.classification_models.keys())
            selected_det_models = list(self.detection_models.keys())

            # Print which models will be used
            if selected_cls_models or selected_det_models:
                ColorPrint.blue(f"\n{'='*80}")
                ColorPrint.blue("🎯 Using Models")
                ColorPrint.blue(f"{'='*80}")

                if selected_cls_models:
                    ColorPrint.green(f"\n📦 Classification Model:")
                    for model_name in selected_cls_models:
                        info = self.classification_models[model_name]
                        ColorPrint.green(f"   • {model_name}")
                        ColorPrint.green(f"     Created: {info['mtime_str']}")

                if selected_det_models:
                    ColorPrint.green(f"\n📦 Detection Model:")
                    for model_name in selected_det_models:
                        info = self.detection_models[model_name]
                        ColorPrint.green(f"   • {model_name}")
                        ColorPrint.green(f"     Created: {info['mtime_str']}")
                        ColorPrint.green(f"     Classes: {', '.join(info['classes'])}")

                ColorPrint.yellow(f"\nPress Enter to continue...")
                input()

        # Run detections with timing
        all_detections = []

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("⏱️  Starting Detection")
        ColorPrint.blue(f"{'='*80}")

        # Start timing (exclude image loading and saving)
        start_time = time.time()

        # Classification
        if selected_cls_models:
            for model_name in selected_cls_models:
                if model_name in self.classification_models:
                    detections = self.detect_with_classification(
                        image,
                        model_name,
                        confidence_threshold=confidence_threshold,
                        stride=stride
                    )
                    all_detections.extend(detections)

        # Detection
        canvas_640 = None
        scale_factor = 1.0
        if selected_det_models:
            for model_name in selected_det_models:
                if model_name in self.detection_models:
                    detections, canvas, scale = self.detect_with_detection(
                        image,
                        model_name,
                        confidence_threshold=confidence_threshold,
                        iou_threshold=iou_threshold
                    )
                    all_detections.extend(detections)
                    # Store 640x640 canvas from last detection (for preview output)
                    canvas_640 = canvas
                    scale_factor = scale

        # End timing
        detection_time = time.time() - start_time

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("⏱️  Detection Complete")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"Total detection time: {detection_time:.3f} seconds")
        ColorPrint.green(f"Average per model: {detection_time / (len(selected_cls_models) + len(selected_det_models)):.3f} seconds")

        if not all_detections:
            ColorPrint.yellow("\n⚠️  No objects detected")
            ColorPrint.yellow(f"   Try lowering confidence threshold (current: {confidence_threshold})")
            return False

        # Draw results with metadata
        all_model_names = selected_cls_models + selected_det_models
        output_path = self.draw_detections(
            image,
            all_detections,
            image_path.name,
            model_names=all_model_names,
            detection_time=detection_time,
            confidence_threshold=confidence_threshold,
            canvas_640=canvas_640,
            scale_factor=scale_factor
        )

        # Print summary
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("📊 Validation Summary")
        ColorPrint.blue(f"{'='*80}")

        cls_count = len([d for d in all_detections if d['model_type'] == 'classification'])
        det_count = len([d for d in all_detections if d['model_type'] == 'detection'])

        ColorPrint.green(f"\n✅ Total detections: {len(all_detections)}")
        if cls_count > 0:
            ColorPrint.green(f"   Classification: {cls_count}")
        if det_count > 0:
            ColorPrint.green(f"   Detection: {det_count}")

        ColorPrint.green(f"\n📁 Output saved to:")
        ColorPrint.green(f"   {output_path}")

        return True


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Unified model validation (auto-detects classification and detection models)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Validate with both models (if available)
  python validate.py screenshot.png

  # Multiple images
  python validate.py image1.png image2.png image3.png

  # Adjust parameters
  python validate.py screenshot.png --conf 0.3 --stride 32 --iou 0.5
        """
    )

    parser.add_argument(
        "images",
        type=str,
        nargs='+',
        help="Path(s) to input image(s)"
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
        "--stride",
        type=int,
        default=None,
        help="Sliding window stride for classification (default: half of window size)"
    )

    parser.add_argument(
        "--iou",
        type=float,
        default=0.45,
        help="IOU threshold for detection NMS (default: 0.45)"
    )

    parser.add_argument(
        "--interactive",
        "-i",
        action="store_true",
        help="Enable interactive model selection menu"
    )

    args = parser.parse_args()

    # Create validator
    validator = UnifiedValidator()

    # Process each image
    success_count = 0
    for image_path in args.images:
        success = validator.validate(
            image_path=image_path,
            confidence_threshold=args.confidence,
            stride=args.stride,
            iou_threshold=args.iou,
            interactive=args.interactive
        )

        if success:
            success_count += 1

    # Print overall summary
    ColorPrint.blue(f"\n{'='*80}")
    ColorPrint.blue("🎉 Validation Complete")
    ColorPrint.blue(f"{'='*80}")
    ColorPrint.green(f"✅ Successfully processed {success_count}/{len(args.images)} image(s)")

    return 0 if success_count > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
