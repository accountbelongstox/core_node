#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Region Collector - Ultralytics Version
Uses YOLO object detection for AI-based window detection.
Singleton per model path via get_yolo_model(path); do not instantiate YOLO elsewhere.
"""

import os
import sys
from typing import Dict, Optional, List, Any
from pathlib import Path
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_numpy, get_third_package_ultralytics
np = get_third_package_numpy()
from share.project_path import ensure_d3_check_in_sys_path, get_project_root
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.d3u_common.image_annotator_helper import create_annotator, get_tmp_dir, generate_timestamp
from d3utils.screenshot_provider import get_screenshot_provider
from share.game_interface_data import get_game_interface_data, UIRegion
from providor.providor_index import (
    D3_STANDARD_RESOLUTION_WIDTH,
    D3_STANDARD_RESOLUTION_HEIGHT
)
import tempfile

_ultralytics = get_third_package_ultralytics()
ULTRALYTICS_AVAILABLE = _ultralytics is not None
YOLO = _ultralytics.YOLO if _ultralytics is not None else None
if not ULTRALYTICS_AVAILABLE:
    ColorPrint.yellow("[UIRegionCollectorUltralytics] Ultralytics not installed")

# Singleton per model_path; use get_yolo_model only
_yolo_model_cache: Dict[str, Any] = {}


def get_yolo_model(model_path: str):
    """Return cached YOLO model for path (singleton per path)."""
    if not ULTRALYTICS_AVAILABLE or YOLO is None:
        return None
    if model_path not in _yolo_model_cache:
        try:
            _yolo_model_cache[model_path] = YOLO(model_path)
        except Exception as e:
            ColorPrint.red(f"[YOLO] Failed to load model {model_path}: {e}")
            return None
    return _yolo_model_cache[model_path]


class UIRegionCollectorUltralytics:
    """
    UI Region Collector - Ultralytics Version

    Uses YOLO object detection for AI-based window detection.
    Best for: Complex scenarios, multiple windows, or when traditional methods fail.

    Workflow:
    1. Load YOLO model (trained on D3 UI regions)
    2. Capture fullscreen screenshot
    3. Run YOLO detection on screenshot
    4. Extract UI region from detected bounding box
    5. Update shared data

    Training Data Requirements:
    - Dataset: Screenshots with annotated UI regions
    - Classes: "d3_ui_region", "d3_anchor_bottom_right", "d3_bag"
    - Format: YOLO format (txt files with normalized coordinates)
    - Model: YOLOv8n (nano) or YOLOv8s (small) recommended
    """

    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize ultralytics-based UI region collector

        Args:
            model_path: Path to YOLO model (.pt file). If None, uses default path.
        """
        self._screenshot_provider = get_screenshot_provider()
        self._model = None
        self._model_path = model_path

        if not ULTRALYTICS_AVAILABLE:
            ColorPrint.red("[UIRegionCollectorUltralytics] Ultralytics not available!")
            ColorPrint.yellow("[UIRegionCollectorUltralytics] Install with: pip install ultralytics")
            return

        # Set default model path if not provided
        if self._model_path is None:
            # Default path: config/models/d3_ui_detector.pt
            config_dir = get_project_root() / "config" / "models"
            self._model_path = config_dir / "d3_ui_detector.pt"

        # Load model if exists (use central getter, singleton per path)
        if Path(self._model_path).exists():
            self._model = get_yolo_model(str(self._model_path))
            if self._model is not None:
                ColorPrint.green(f"[UIRegionCollectorUltralytics] Loaded model: {self._model_path}")
        else:
            ColorPrint.yellow(f"[UIRegionCollectorUltralytics] Model not found: {self._model_path}")
            ColorPrint.yellow("[UIRegionCollectorUltralytics] Use train() method to train a new model")

        ColorPrint.green("[UIRegionCollectorUltralytics] Initialized")

    def collect(
        self,
        force_new_capture: bool = True,
        save_screenshot: bool = False,
        confidence_threshold: float = 0.5
    ) -> Optional[UIRegion]:
        """
        Collect UI region using YOLO detection

        Args:
            force_new_capture: Force capture new screenshot (default: True)
            save_screenshot: Save screenshot to disk (default: False)
            confidence_threshold: Minimum confidence for detection (default: 0.5)

        Returns:
            UIRegion or None if failed
        """
        if not ULTRALYTICS_AVAILABLE:
            ColorPrint.red("[UIRegionCollectorUltralytics] Ultralytics not available")
            return None

        if self._model is None:
            ColorPrint.red("[UIRegionCollectorUltralytics] Model not loaded")
            ColorPrint.yellow("[UIRegionCollectorUltralytics] Please train or provide a model first")
            return None

        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[UIRegionCollectorUltralytics] Collecting UI region using YOLO")
        ColorPrint.blue("=" * 60)

        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]

            # Step 1: Capture screenshot
            if force_new_capture:
                ColorPrint.blue("[Step 1/3] Generating fullscreen screenshot...")
                screenshot_data = self._screenshot_provider.gen(
                    use_optimized_capture=False
                )
            else:
                ColorPrint.blue("[Step 1/3] Using shared screenshot...")
                screenshot_data = self._screenshot_provider.share()

            if screenshot_data is None or screenshot_data.fullscreen_image is None:
                ColorPrint.red("[ERROR] Failed to get screenshot")
                self._update_shared_data_error("Failed to get screenshot", timestamp)
                return None

            ColorPrint.green(f"[Step 1/3] Screenshot ready: {screenshot_data.fullscreen_size[0]}x{screenshot_data.fullscreen_size[1]}")

            # Step 2: Run YOLO detection
            ColorPrint.blue("[Step 2/3] Running YOLO detection...")

            # Convert PIL image to numpy array for YOLO
            img_array = np.array(screenshot_data.fullscreen_image)

            # Run detection
            results = self._model(img_array, conf=confidence_threshold, verbose=False)

            # Process results
            detections = self._process_yolo_results(results, confidence_threshold)

            if not detections:
                ColorPrint.red("[ERROR] No UI region detected by YOLO")
                self._update_shared_data_error("No UI region detected", timestamp)
                return None

            # Get best detection (highest confidence)
            best_detection = max(detections, key=lambda d: d["confidence"])
            ColorPrint.green(f"[Step 2/3] Detected UI region with confidence: {best_detection['confidence']:.2f}")

            # Step 3: Create UI region
            ColorPrint.blue("[Step 3/3] Creating UI region data...")

            ui_region = UIRegion(
                x=best_detection["x"],
                y=best_detection["y"],
                width=best_detection["width"],
                height=best_detection["height"],
                ui_offset_x=best_detection["x"],
                ui_offset_y=best_detection["y"],
                is_fullscreen=self._is_fullscreen(best_detection, screenshot_data.fullscreen_size),
                source="yolo_detection"
            )

            # Update shared data
            shared_data = get_game_interface_data()
            shared_data.ui_region = ui_region
            shared_data.timestamp = timestamp
            shared_data.error = None

            ColorPrint.green(f"[SUCCESS] UI region detected:")
            ColorPrint.green(f"  Position: ({ui_region.x}, {ui_region.y})")
            ColorPrint.green(f"  Size: {ui_region.width}x{ui_region.height}")
            ColorPrint.green(f"  Confidence: {best_detection['confidence']:.2f}")
            ColorPrint.green(f"  Fullscreen: {ui_region.is_fullscreen}")
            ColorPrint.green(f"  Source: {ui_region.source}")

            # Log resolution info
            actual_width = screenshot_data.fullscreen_size[0]
            actual_height = screenshot_data.fullscreen_size[1]
            ColorPrint.blue(f"[Resolution] Actual: {actual_width}x{actual_height}, Standard: {D3_STANDARD_RESOLUTION_WIDTH}x{D3_STANDARD_RESOLUTION_HEIGHT}")

            # Crop and save game_window_image to provider
            try:
                game_window_image = screenshot_data.fullscreen_image.crop((
                    ui_region.x,
                    ui_region.y,
                    ui_region.x + ui_region.width,
                    ui_region.y + ui_region.height
                ))
                screenshot_data.game_window_image = game_window_image
                ColorPrint.green(f"[UIRegion] Created game_window_image: {ui_region.width}x{ui_region.height}")
            except Exception as e:
                ColorPrint.red(f"[UIRegion] Error cropping game window: {e}")

            # Save annotated screenshot if requested
            if save_screenshot:
                self._save_annotated_screenshot(
                    screenshot_data=screenshot_data,
                    ui_region=ui_region,
                    detections=detections,
                    best_detection=best_detection
                )

            return ui_region

        except Exception as e:
            ColorPrint.red(f"[ERROR] Collection failed: {e}")
            self._update_shared_data_error(str(e), timestamp)
            return None

    def _process_yolo_results(self, results, confidence_threshold: float) -> List[Dict]:
        """
        Process YOLO detection results

        Args:
            results: YOLO results object
            confidence_threshold: Minimum confidence threshold

        Returns:
            List of detection dictionaries
        """
        detections = []

        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                # Get confidence
                conf = float(box.conf[0])
                if conf < confidence_threshold:
                    continue

                # Get class
                cls = int(box.cls[0])
                class_name = result.names[cls]

                # We're looking for "d3_ui_region" class
                if class_name != "d3_ui_region":
                    continue

                # Get bounding box (xyxy format)
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

                detections.append({
                    "x": int(x1),
                    "y": int(y1),
                    "width": int(x2 - x1),
                    "height": int(y2 - y1),
                    "confidence": conf,
                    "class": class_name
                })

        return detections

    def _is_fullscreen(self, detection: Dict, screen_size: tuple) -> bool:
        """
        Check if detection represents fullscreen window

        Args:
            detection: Detection dictionary
            screen_size: Screen size (width, height)

        Returns:
            True if fullscreen
        """
        screen_width, screen_height = screen_size

        # Consider fullscreen if detection covers > 90% of screen
        detection_area = detection["width"] * detection["height"]
        screen_area = screen_width * screen_height

        coverage = detection_area / screen_area
        return coverage > 0.9

    def _save_annotated_screenshot(
        self,
        screenshot_data,
        ui_region: UIRegion,
        detections: List[Dict],
        best_detection: Dict
    ) -> None:
        """
        Save annotated screenshot with YOLO detection visualization

        Args:
            screenshot_data: Screenshot data from provider
            ui_region: Detected UI region
            detections: All detections
            best_detection: Best detection used
        """
        try:
            ColorPrint.blue("[Save] Creating annotated screenshot with YOLO detections...")

            # Save temp screenshot
            temp_screenshot_path = Path(tempfile.gettempdir()) / f"temp_fullscreen_{screenshot_data.timestamp}.png"
            screenshot_data.fullscreen_image.save(temp_screenshot_path)

            # Create annotator
            annotator = create_annotator(temp_screenshot_path)

            # Draw all detections (lower confidence in gray)
            for detection in detections:
                if detection != best_detection:
                    annotator.draw_rectangle(
                        top_left=(detection["x"], detection["y"]),
                        bottom_right=(detection["x"] + detection["width"], detection["y"] + detection["height"]),
                        color=(128, 128, 128),
                        thickness=2
                    )
                    # Draw confidence score
                    annotator.draw_text(
                        text=f"{detection['confidence']:.2f}",
                        position=(detection["x"] + 5, detection["y"] + 20),
                        font_scale=0.5,
                        color=(128, 128, 128),
                        thickness=1
                    )

            # Draw best detection (selected UI region) in green
            annotator.draw_rectangle(
                top_left=(ui_region.x, ui_region.y),
                bottom_right=(ui_region.x + ui_region.width, ui_region.y + ui_region.height),
                color=(0, 255, 0),
                thickness=3
            )

            # Draw label for best detection
            label_text = f"UI Region (YOLO): {ui_region.width}x{ui_region.height} [{best_detection['confidence']:.2f}]"
            annotator.draw_text(
                text=label_text,
                position=(ui_region.x + 10, ui_region.y + 30),
                font_scale=0.8,
                color=(0, 255, 0),
                thickness=2
            )

            # Draw info text
            info_lines = [
                f"Source: {ui_region.source}",
                f"Model: YOLO Detection",
                f"Confidence: {best_detection['confidence']:.3f}",
                f"Detections: {len(detections)} total",
                f"Position: ({ui_region.x}, {ui_region.y})",
                f"Size: {ui_region.width}x{ui_region.height}",
                f"Fullscreen: {ui_region.is_fullscreen}",
                f"Timestamp: {screenshot_data.timestamp}"
            ]

            y_offset = 30
            for i, line in enumerate(info_lines):
                annotator.draw_text(
                    text=line,
                    position=(10, y_offset + i * 25),
                    font_scale=0.6,
                    color=(255, 255, 255),
                    thickness=2,
                    bg_color=(0, 0, 0)
                )

            # Save annotated image
            tmp_dir = get_tmp_dir()
            annotated_path = tmp_dir / f"yolo_detection_{screenshot_data.timestamp}.png"
            annotator.save(annotated_path)
            ColorPrint.green(f"[Save] Annotated screenshot saved: {annotated_path}")

            # Clean up temp file
            try:
                if temp_screenshot_path.exists():
                    temp_screenshot_path.unlink()
            except OSError:
                pass

        except Exception as e:
            ColorPrint.red(f"[Save] Error saving annotated screenshot: {e}")

    def _update_shared_data_error(self, error_msg: str, timestamp: str) -> None:
        """Update shared data with error"""
        shared_data = get_game_interface_data()
        shared_data.error = error_msg
        shared_data.timestamp = timestamp

    def train(
        self,
        data_yaml_path: str,
        epochs: int = 50,
        imgsz: int = 640,
        batch: int = 16,
        device: str = "cpu"
    ) -> None:
        """
        Train YOLO model on D3 UI detection dataset

        Args:
            data_yaml_path: Path to data.yaml file
            epochs: Number of training epochs (default: 50)
            imgsz: Image size for training (default: 640)
            batch: Batch size (default: 16)
            device: Device to use (default: "cpu", use "cuda" for GPU)

        Example data.yaml structure:
        ```yaml
        path: /path/to/dataset
        train: images/train
        val: images/val

        names:
          0: d3_ui_region
          1: d3_anchor_bottom_right
          2: d3_bag
        ```
        """
        if not ULTRALYTICS_AVAILABLE:
            ColorPrint.red("[Train] Ultralytics not available")
            return

        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[Train] Training YOLO model for D3 UI detection")
        ColorPrint.blue("=" * 60)

        try:
            # Initialize model (YOLOv8n - nano version, use central cache)
            model = get_yolo_model("yolov8n.pt")

            # Train model
            ColorPrint.blue(f"[Train] Starting training...")
            ColorPrint.blue(f"  Epochs: {epochs}")
            ColorPrint.blue(f"  Image size: {imgsz}")
            ColorPrint.blue(f"  Batch: {batch}")
            ColorPrint.blue(f"  Device: {device}")

            results = model.train(
                data=data_yaml_path,
                epochs=epochs,
                imgsz=imgsz,
                batch=batch,
                device=device,
                project="config/models",
                name="d3_ui_detector",
                exist_ok=True
            )

            ColorPrint.green("[Train] Training complete!")
            ColorPrint.green(f"[Train] Model saved to: config/models/d3_ui_detector/weights/best.pt")

            # Load trained model (use central getter)
            best_model_path = Path("config/models/d3_ui_detector/weights/best.pt")
            if best_model_path.exists():
                self._model = get_yolo_model(str(best_model_path))
                self._model_path = best_model_path
                if self._model is not None:
                    ColorPrint.green(f"[Train] Loaded trained model")

        except Exception as e:
            ColorPrint.red(f"[Train] Training failed: {e}")

    def validate(self, data_yaml_path: str) -> None:
        """
        Validate model on validation dataset

        Args:
            data_yaml_path: Path to data.yaml file
        """
        if not ULTRALYTICS_AVAILABLE or self._model is None:
            ColorPrint.red("[Validate] Model not available")
            return

        ColorPrint.blue("[Validate] Validating model...")

        try:
            results = self._model.val(data=data_yaml_path)
            ColorPrint.green("[Validate] Validation complete!")
            ColorPrint.green(f"[Validate] mAP50: {results.box.map50:.3f}")
            ColorPrint.green(f"[Validate] mAP50-95: {results.box.map:.3f}")
        except Exception as e:
            ColorPrint.red(f"[Validate] Validation failed: {e}")

# Example usage
if __name__ == "__main__":
    collector = UIRegionCollectorUltralytics()

    # Train model (if dataset available)
    # collector.train(data_yaml_path="config/datasets/d3_ui/data.yaml", epochs=50)

    # Collect UI region
    ui_region = collector.collect(force_new_capture=True, save_screenshot=True)

    if ui_region:
        print(f"\nUI Region collected:")
        print(f"  Position: ({ui_region.x}, {ui_region.y})")
        print(f"  Size: {ui_region.width}x{ui_region.height}")
        print(f"  Source: {ui_region.source}")
    else:
        print("\nFailed to collect UI region")
