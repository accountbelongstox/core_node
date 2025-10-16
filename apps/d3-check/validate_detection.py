#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Detection Model Validation Script
Validates trained YOLO detection models on images
Direct image input without --image flag
"""

import os
import sys
import json
import cv2
from pathlib import Path
from typing import Optional, Dict, List, Any
import argparse

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from providor.common_imports import ColorPrint


class DetectionValidator:
    """
    Validates trained YOLO detection models
    """

    def __init__(self, models_dir: Optional[Path] = None):
        """
        Initialize detection validator

        Args:
            models_dir: Directory containing trained models (defaults to d4_modules_detection)
        """
        self.project_root = Path(current_dir)
        self.models_dir = models_dir or (self.project_root / "d4_modules_detection")
        self.registry = None
        self.models = {}

        # Output directory
        self.output_dir = Path(os.path.expanduser("~")) / ".core_node" / "pytools" / "tmp" / "detection_validation"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🔍 Detection Model Validator")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"Models directory: {self.models_dir}")
        ColorPrint.green(f"Output directory: {self.output_dir}")

    def load_registry(self) -> bool:
        """
        Load model registry

        Returns:
            True if successful
        """
        registry_file = self.models_dir / "model_registry.json"

        if not registry_file.exists():
            ColorPrint.red(f"\n❌ Model registry not found!")
            ColorPrint.red(f"   Expected location: {registry_file}")
            ColorPrint.yellow("\n   Please train detection models first:")
            ColorPrint.yellow("   1. Prepare detection training data:")
            ColorPrint.yellow("      python scripts/prepare_detection_training.py \\")
            ColorPrint.yellow("        --small-images .cache/training_data/source/<category> \\")
            ColorPrint.yellow("        --backgrounds <images> \\")
            ColorPrint.yellow("        --output .cache/training_data/detection/<category> \\")
            ColorPrint.yellow("        --namespace <namespace>")
            ColorPrint.yellow("   2. Run training:")
            ColorPrint.yellow("      python train_detection.py")
            ColorPrint.yellow("\n   Or check if d4_modules_detection directory exists and contains models.")
            return False

        try:
            with open(registry_file, 'r', encoding='utf-8') as f:
                self.registry = json.load(f)

            ColorPrint.green(f"\n✓ Loaded model registry")
            ColorPrint.green(f"   Version: {self.registry.get('registry_version', 'unknown')}")
            ColorPrint.green(f"   Namespace: {self.registry.get('namespace', 'unknown')}")
            ColorPrint.green(f"   Models: {len(self.registry.get('models', []))}")

            return True

        except Exception as e:
            ColorPrint.red(f"\n❌ Failed to load registry: {e}")
            return False

    def load_models(self) -> bool:
        """
        Load all models from registry

        Returns:
            True if successful
        """
        if not self.registry:
            ColorPrint.red("\n❌ No registry loaded")
            return False

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("📦 Loading Models")
        ColorPrint.blue(f"{'='*80}")

        try:
            from ultralytics import YOLO

            for model_info in self.registry['models']:
                model_name = model_info['model_name']
                model_file = self.models_dir / model_info['model_file']

                if not model_file.exists():
                    ColorPrint.yellow(f"\n⚠️  Model not found: {model_file}")
                    continue

                # Load model
                model = YOLO(str(model_file))

                self.models[model_name] = {
                    'model': model,
                    'info': model_info
                }

                ColorPrint.green(f"\n✓ Loaded: {model_name}")
                ColorPrint.green(f"   Category: {model_info['category']}")
                ColorPrint.green(f"   Type: {model_info['type']}")
                ColorPrint.green(f"   Classes: {model_info['num_classes']}")

            ColorPrint.green(f"\n✅ Loaded {len(self.models)} model(s)")
            return len(self.models) > 0

        except ImportError:
            ColorPrint.red("\n❌ Ultralytics not installed")
            ColorPrint.yellow("   Install with: pip install ultralytics")
            return False
        except Exception as e:
            ColorPrint.red(f"\n❌ Failed to load models: {e}")
            import traceback
            traceback.print_exc()
            return False

    def detect_objects(
        self,
        image_path: Path,
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.45
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Detect objects in image using all loaded models

        Args:
            image_path: Path to input image
            confidence_threshold: Confidence threshold for detections
            iou_threshold: IOU threshold for NMS

        Returns:
            Dictionary mapping model names to detection results
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🔍 Detecting Objects")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"Image: {image_path.name}")

        # Load image
        image = cv2.imread(str(image_path))
        if image is None:
            ColorPrint.red(f"\n❌ Failed to load image: {image_path}")
            return {}

        img_h, img_w = image.shape[:2]
        ColorPrint.green(f"Image size: {img_w}x{img_h}")

        all_detections = {}

        # Process each model
        for model_name, model_data in self.models.items():
            model = model_data['model']
            info = model_data['info']

            ColorPrint.blue(f"\n🔍 Processing: {model_name}")

            # Run detection
            results = model(
                image,
                conf=confidence_threshold,
                iou=iou_threshold,
                verbose=False
            )

            detections = []

            # Parse results
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    # Get box coordinates
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0])
                    class_id = int(box.cls[0])

                    # Get class name
                    class_name = info['classes'][class_id]

                    # Only include "yes" detections (class_id = 1)
                    if class_id == 1:
                        detections.append({
                            'bbox': {
                                'x1': int(x1),
                                'y1': int(y1),
                                'x2': int(x2),
                                'y2': int(y2),
                                'w': int(x2 - x1),
                                'h': int(y2 - y1)
                            },
                            'confidence': confidence,
                            'class': class_name,
                            'class_id': class_id
                        })

            ColorPrint.green(f"   Detections: {len(detections)}")
            all_detections[model_name] = detections

        return all_detections

    def draw_detections(
        self,
        image_path: Path,
        detections: Dict[str, List[Dict[str, Any]]],
        output_filename: Optional[str] = None
    ) -> Path:
        """
        Draw detection results on image

        Args:
            image_path: Path to input image
            detections: Detection results from detect_objects()
            output_filename: Output filename (auto-generated if None)

        Returns:
            Path to output image
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🎨 Drawing Detections")
        ColorPrint.blue(f"{'='*80}")

        # Load image
        image = cv2.imread(str(image_path))
        if image is None:
            ColorPrint.red(f"\n❌ Failed to load image: {image_path}")
            return None

        # Color palette for different models
        colors = [
            (0, 255, 0),      # Green
            (255, 0, 0),      # Blue
            (0, 0, 255),      # Red
            (255, 255, 0),    # Cyan
            (255, 0, 255),    # Magenta
            (0, 255, 255),    # Yellow
            (128, 0, 128),    # Purple
            (255, 165, 0),    # Orange
        ]

        # Draw detections for each model
        color_idx = 0
        for model_name, model_detections in detections.items():
            color = colors[color_idx % len(colors)]
            color_idx += 1

            ColorPrint.green(f"\n📍 Drawing {len(model_detections)} detections for {model_name}")

            for detection in model_detections:
                bbox = detection['bbox']
                confidence = detection['confidence']
                class_name = detection['class']

                x1, y1, x2, y2 = bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']

                # Draw rectangle
                cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)

                # Draw label
                label = f"{model_name.split('_')[0]}: {class_name} {confidence:.2f}"
                label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)

                # Background for text
                cv2.rectangle(
                    image,
                    (x1, y1 - label_size[1] - 10),
                    (x1 + label_size[0], y1),
                    color,
                    -1
                )

                # Text
                cv2.putText(
                    image,
                    label,
                    (x1, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2
                )

        # Create legend
        legend_y = 30
        for model_name in detections.keys():
            color = colors[(list(detections.keys()).index(model_name)) % len(colors)]
            count = len(detections[model_name])

            legend_text = f"{model_name}: {count} detections"

            cv2.rectangle(image, (10, legend_y - 20), (30, legend_y), color, -1)
            cv2.putText(
                image,
                legend_text,
                (35, legend_y - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )
            cv2.putText(
                image,
                legend_text,
                (35, legend_y - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                1
            )
            legend_y += 30

        # Save output
        if output_filename is None:
            timestamp = Path(image_path).stem
            output_filename = f"detection_{timestamp}.png"

        output_path = self.output_dir / output_filename
        cv2.imwrite(str(output_path), image)

        ColorPrint.green(f"\n✅ Saved annotated image:")
        ColorPrint.green(f"   {output_path}")

        return output_path

    def validate(
        self,
        image_path: str,
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.45,
        output_filename: Optional[str] = None
    ) -> bool:
        """
        Run complete validation workflow

        Args:
            image_path: Path to input image
            confidence_threshold: Confidence threshold for detections
            iou_threshold: IOU threshold for NMS
            output_filename: Output filename

        Returns:
            True if successful
        """
        image_path = Path(image_path)

        if not image_path.exists():
            ColorPrint.red(f"\n❌ Image not found: {image_path}")
            return False

        # Load registry
        if not self.load_registry():
            return False

        # Load models
        if not self.load_models():
            return False

        # Detect objects
        detections = self.detect_objects(
            image_path,
            confidence_threshold=confidence_threshold,
            iou_threshold=iou_threshold
        )

        if not detections or sum(len(dets) for dets in detections.values()) == 0:
            ColorPrint.yellow("\n⚠️  No objects detected")
            ColorPrint.yellow(f"   Try lowering confidence threshold (current: {confidence_threshold})")
            return False

        # Draw results
        output_path = self.draw_detections(
            image_path,
            detections,
            output_filename=output_filename
        )

        # Print summary
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("📊 Validation Summary")
        ColorPrint.blue(f"{'='*80}")

        total_detections = sum(len(dets) for dets in detections.values())
        ColorPrint.green(f"\n✅ Total detections: {total_detections}")

        for model_name, model_detections in detections.items():
            ColorPrint.green(f"   {model_name}: {len(model_detections)}")

        ColorPrint.green(f"\n📁 Output saved to:")
        ColorPrint.green(f"   {output_path}")

        return True


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Validate detection models on images (direct image input)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Direct image validation
  python validate_detection.py screenshot.png

  # Adjust detection parameters
  python validate_detection.py screenshot.png --conf 0.3 --iou 0.5

  # Specify output filename
  python validate_detection.py screenshot.png --output result.png

  # Multiple images
  python validate_detection.py image1.png image2.png image3.png
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
        help="Confidence threshold for detections (default: 0.25)"
    )

    parser.add_argument(
        "--iou",
        type=float,
        default=0.45,
        help="IOU threshold for NMS (default: 0.45)"
    )

    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output filename (auto-generated if not specified)"
    )

    parser.add_argument(
        "--models-dir",
        type=str,
        default=None,
        help="Directory containing trained models (default: d4_modules_detection)"
    )

    args = parser.parse_args()

    # Create validator
    models_dir = Path(args.models_dir) if args.models_dir else None
    validator = DetectionValidator(models_dir=models_dir)

    # Process each image
    success_count = 0
    for image_path in args.images:
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue(f"Processing: {image_path}")
        ColorPrint.blue(f"{'='*80}")

        success = validator.validate(
            image_path=image_path,
            confidence_threshold=args.confidence,
            iou_threshold=args.iou,
            output_filename=args.output
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
