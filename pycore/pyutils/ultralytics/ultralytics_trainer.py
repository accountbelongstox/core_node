#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ultralytics Trainer - Generic Training Library
Provides a unified interface for training YOLO models with Ultralytics
"""

import os
import sys
import glob
from pathlib import Path
from typing import Optional, Dict, List, Union, Any, Callable
from dataclasses import dataclass, field
import yaml
import json


def process_image_config(source_dir: Path, image_config, config_name: str = "images", subdirectory: Optional[str] = None) -> List[Path]:
    """
    Process image configuration from metadata (shared utility for all trainers):

    Supports:
    - source_image: Large images / background images (for coordinate mode or detection)
    - patch_images: Small target images (for direct patch mode)

    Directory structure:
        source/
        ├── training_projects/
        │   └── project_name/
        │       ├── image1.png           # Images directly in project directory
        │       ├── image2.png
        │       ├── source_image/        # Auto-scanned for source_image config
        │       │   └── large.png
        │       ├── patch_images/        # Auto-scanned for patch_images config
        │       │   └── target.png
        │       └── metadata.json
        └── public/                      # Shared background images

    Processing logic:
    1. Convert string to array if needed
    2. Look for images in project_name/ directory
    3. Auto-scan subdirectory (e.g., ./source_image/*.png or ./patch_images/*.png)
    4. Auto-add ../../public/*.png if public directory exists
    5. Expand glob patterns
    6. Deduplicate paths
    7. Warn (don't error) if individual files don't exist

    Args:
        source_dir: Project directory (e.g., source/training_projects/rift_progress_bar)
        image_config: Image configuration value from metadata.json (string or list)
        config_name: Configuration name for logging (default: "images")
        subdirectory: Optional subdirectory name to auto-scan (e.g., "source_image", "patch_images")

    Returns:
        List of valid image paths (deduplicated)
    """
    # Convert string to array
    if isinstance(image_config, str):
        image_config = [image_config]
    elif not isinstance(image_config, list):
        image_config = [image_config]

    # Store original config for better warning messages
    original_config = image_config.copy()

    # Auto-scan subdirectory if specified and exists
    if subdirectory:
        subdir_path = source_dir / subdirectory
        if subdir_path.exists() and subdir_path.is_dir():
            print(f"Found {subdirectory}/ subdirectory, auto-adding images: {subdir_path.resolve()}")
            image_config.append(f'./{subdirectory}/*.png')
            image_config.append(f'./{subdirectory}/*.jpg')
            image_config.append(f'./{subdirectory}/*.jpeg')

    # Auto-add public directory images if it exists (at ../../public)
    public_dir = source_dir.parent.parent / 'public'
    if public_dir.exists() and public_dir.is_dir():
        print(f"Found public directory, auto-adding background images: {public_dir.resolve()}")
        image_config.append('../../public/*.png')

    # Expand globs and validate files
    images = []
    seen_paths = set()  # For deduplication
    files_not_found = []  # Track files that weren't found directly

    for pattern in image_config:
        # Skip empty patterns
        if not pattern:
            continue

        # Handle glob patterns
        if '*' in str(pattern) or '?' in str(pattern):
            # Resolve pattern relative to source_dir
            pattern_path = source_dir / pattern
            matched_files = glob.glob(str(pattern_path))
            if not matched_files:
                print(f"WARNING: No files matched pattern: {pattern}")
                continue
            for matched_file in matched_files:
                file_path = Path(matched_file).resolve()  # Resolve to absolute for dedup
                if file_path.exists() and file_path not in seen_paths:
                    images.append(file_path)
                    seen_paths.add(file_path)
        else:
            # Direct file path - look in project directory directly
            file_path = (source_dir / pattern).resolve()
            if file_path.exists() and file_path not in seen_paths:
                images.append(file_path)
                seen_paths.add(file_path)
            else:
                # Only track if this was from original config (not auto-added patterns)
                if pattern in original_config and file_path not in seen_paths:
                    files_not_found.append((pattern, file_path))

    # Only show warnings for files that were explicitly specified but truly not found
    # (i.e., not found even after auto-scanning subdirectories)
    if files_not_found:
        for pattern, file_path in files_not_found:
            # Check if file exists in subdirectory (via auto-scan)
            file_found_in_subdir = False
            if subdirectory:
                subdir_file = source_dir / subdirectory / pattern
                if subdir_file.resolve() in seen_paths:
                    file_found_in_subdir = True

            # Only warn if file was not found anywhere
            if not file_found_in_subdir:
                print(f"WARNING: Image not found: {pattern}")
                print(f"         Checked: {file_path}")

    if not images:
        raise FileNotFoundError(f"No valid {config_name} found in metadata")

    print(f"Loaded {len(images)} {config_name} (deduplicated)")
    for img in images:
        print(f"  - {img.name}")

    return images

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


@dataclass
class TrainingConfig:
    """
    Training configuration dataclass

    Core parameters:
        data: Path to data.yaml file
        model: Model architecture (e.g., 'yolov8n.pt', 'yolov8s.pt')
        epochs: Number of training epochs
        imgsz: Image size for training
        batch: Batch size

    Optional parameters:
        device: Device to use ('cpu', 'cuda', '0', '0,1,2,3')
        project: Project directory
        name: Experiment name
        exist_ok: Overwrite existing experiment
        pretrained: Use pretrained weights
        optimizer: Optimizer ('SGD', 'Adam', 'AdamW', 'RMSProp')
        lr0: Initial learning rate
        lrf: Final learning rate factor
        momentum: Momentum
        weight_decay: Weight decay
        warmup_epochs: Warmup epochs
        patience: Early stopping patience
        save: Save checkpoints
        save_period: Save checkpoint every x epochs
        cache: Cache images ('ram', 'disk', False)
        workers: Number of dataloader workers
        cos_lr: Use cosine learning rate scheduler
        amp: Automatic Mixed Precision
        fraction: Dataset fraction to use
        profile: Profile ONNX and TensorRT speeds
        freeze: Freeze layers (list or int)
        multi_scale: Use multi-scale training
        single_cls: Train as single-class dataset
        rect: Rectangular training
        resume: Resume training from checkpoint
        close_mosaic: Disable mosaic augmentation for final epochs

    Advanced augmentation:
        hsv_h: HSV-Hue augmentation
        hsv_s: HSV-Saturation augmentation
        hsv_v: HSV-Value augmentation
        degrees: Rotation augmentation
        translate: Translation augmentation
        scale: Scale augmentation
        shear: Shear augmentation
        perspective: Perspective augmentation
        flipud: Vertical flip probability
        fliplr: Horizontal flip probability
        mosaic: Mosaic augmentation probability
        mixup: Mixup augmentation probability
        copy_paste: Copy-paste augmentation probability
    """
    # Core parameters
    data: str
    model: str = "yolov8n.pt"
    epochs: int = 100
    imgsz: int = 640
    batch: int = 16

    # Device and project
    device: str = "cpu"
    project: Optional[str] = None
    name: str = "train"
    exist_ok: bool = True
    pretrained: bool = True

    # Optimizer settings
    optimizer: str = "auto"
    lr0: float = 0.01
    lrf: float = 0.01
    momentum: float = 0.937
    weight_decay: float = 0.0005
    warmup_epochs: int = 3

    # Training settings
    patience: int = 50
    save: bool = True
    save_period: int = -1
    cache: Union[bool, str] = False
    workers: int = 8
    cos_lr: bool = False
    amp: bool = True
    fraction: float = 1.0
    profile: bool = False
    freeze: Optional[Union[int, List[int]]] = None

    # Advanced training
    multi_scale: bool = False
    single_cls: bool = False
    rect: bool = False
    resume: bool = False
    close_mosaic: int = 10

    # Augmentation parameters
    hsv_h: float = 0.015
    hsv_s: float = 0.7
    hsv_v: float = 0.4
    degrees: float = 0.0
    translate: float = 0.1
    scale: float = 0.5
    shear: float = 0.0
    perspective: float = 0.0
    flipud: float = 0.0
    fliplr: float = 0.5
    mosaic: float = 1.0
    mixup: float = 0.0
    copy_paste: float = 0.0

    # Additional parameters
    extra_args: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary for Ultralytics"""
        config = {
            "data": self.data,
            "epochs": self.epochs,
            "imgsz": self.imgsz,
            "batch": self.batch,
            "device": self.device,
            "project": self.project,
            "name": self.name,
            "exist_ok": self.exist_ok,
            "pretrained": self.pretrained,
            "optimizer": self.optimizer,
            "lr0": self.lr0,
            "lrf": self.lrf,
            "momentum": self.momentum,
            "weight_decay": self.weight_decay,
            "warmup_epochs": self.warmup_epochs,
            "patience": self.patience,
            "save": self.save,
            "save_period": self.save_period,
            "cache": self.cache,
            "workers": self.workers,
            "cos_lr": self.cos_lr,
            "amp": self.amp,
            "fraction": self.fraction,
            "profile": self.profile,
            "freeze": self.freeze,
            "multi_scale": self.multi_scale,
            "single_cls": self.single_cls,
            "rect": self.rect,
            "resume": self.resume,
            "close_mosaic": self.close_mosaic,
            "hsv_h": self.hsv_h,
            "hsv_s": self.hsv_s,
            "hsv_v": self.hsv_v,
            "degrees": self.degrees,
            "translate": self.translate,
            "scale": self.scale,
            "shear": self.shear,
            "perspective": self.perspective,
            "flipud": self.flipud,
            "fliplr": self.fliplr,
            "mosaic": self.mosaic,
            "mixup": self.mixup,
            "copy_paste": self.copy_paste,
        }

        # Remove None values
        config = {k: v for k, v in config.items() if v is not None}

        # Add extra args
        config.update(self.extra_args)

        return config


class UltralyticsTrainer:
    """
    Generic Ultralytics YOLO Trainer

    Features:
    - Unified training interface
    - Configuration management
    - Automatic model selection
    - Training callbacks
    - Export support
    - Validation and testing
    - Resume training
    """

    def __init__(self, config: Optional[Union[TrainingConfig, Dict, str]] = None):
        """
        Initialize trainer

        Args:
            config: TrainingConfig object, dict, or path to config file (yaml/json)
        """
        if not ULTRALYTICS_AVAILABLE:
            raise ImportError("Ultralytics is not installed. Install with: pip install ultralytics")

        self.config = self._load_config(config)
        self.model = None
        self.results = None

    def _load_config(self, config: Optional[Union[TrainingConfig, Dict, str]]) -> TrainingConfig:
        """Load configuration from various sources"""
        if config is None:
            raise ValueError("Configuration is required")

        if isinstance(config, TrainingConfig):
            return config

        if isinstance(config, dict):
            return TrainingConfig(**config)

        if isinstance(config, (str, Path)):
            config_path = Path(config)
            if not config_path.exists():
                raise FileNotFoundError(f"Config file not found: {config_path}")

            with open(config_path, 'r') as f:
                if config_path.suffix in ['.yaml', '.yml']:
                    config_dict = yaml.safe_load(f)
                elif config_path.suffix == '.json':
                    config_dict = json.load(f)
                else:
                    raise ValueError(f"Unsupported config format: {config_path.suffix}")

            return TrainingConfig(**config_dict)

        raise TypeError(f"Unsupported config type: {type(config)}")

    def train(
        self,
        callbacks: Optional[Dict[str, Callable]] = None,
        verbose: bool = True
    ) -> Any:
        """
        Train the model

        Args:
            callbacks: Dictionary of callback functions
            verbose: Print training progress

        Returns:
            Training results
        """
        print("\n" + "=" * 80)
        print("🚀 Starting Ultralytics YOLO Training")
        print("=" * 80)

        # Load model
        print(f"\n📦 Loading model: {self.config.model}")
        self.model = YOLO(self.config.model)

        # Get training arguments
        train_args = self.config.to_dict()

        # Print configuration
        if verbose:
            self._print_config(train_args)

        # Add callbacks if provided
        if callbacks:
            for event, callback in callbacks.items():
                self.model.add_callback(event, callback)

        # Start training
        print(f"\n🏋️  Training for {self.config.epochs} epochs...")
        print("-" * 80)

        try:
            self.results = self.model.train(**train_args)
            print("\n" + "=" * 80)
            print("✅ Training completed successfully!")
            print("=" * 80)
            return self.results
        except Exception as e:
            print("\n" + "=" * 80)
            print(f"❌ Training failed: {e}")
            print("=" * 80)
            raise

    def validate(
        self,
        data: Optional[str] = None,
        split: str = "val",
        **kwargs
    ) -> Any:
        """
        Validate the model

        Args:
            data: Path to data.yaml (if None, uses training config)
            split: Dataset split to validate on ('val', 'test')
            **kwargs: Additional validation arguments

        Returns:
            Validation results
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Train first or load a checkpoint.")

        print("\n" + "=" * 80)
        print("🔍 Validating model...")
        print("=" * 80)

        val_args = {
            "data": data or self.config.data,
            "split": split,
            **kwargs
        }

        results = self.model.val(**val_args)

        print("\n✅ Validation completed")
        return results

    def export(
        self,
        format: str = "onnx",
        **kwargs
    ) -> str:
        """
        Export the model

        Args:
            format: Export format ('onnx', 'torchscript', 'tflite', 'coreml', etc.)
            **kwargs: Additional export arguments

        Returns:
            Path to exported model
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Train first or load a checkpoint.")

        print(f"\n📤 Exporting model to {format.upper()}...")

        export_path = self.model.export(format=format, **kwargs)

        print(f"✅ Model exported: {export_path}")
        return export_path

    def predict(
        self,
        source: Union[str, Path],
        **kwargs
    ) -> Any:
        """
        Run prediction on images/videos

        Args:
            source: Path to image, video, or directory
            **kwargs: Additional prediction arguments

        Returns:
            Prediction results
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Train first or load a checkpoint.")

        return self.model.predict(source=source, **kwargs)

    def load_checkpoint(self, checkpoint_path: Union[str, Path]) -> None:
        """Load model from checkpoint"""
        print(f"\n📥 Loading checkpoint: {checkpoint_path}")
        self.model = YOLO(checkpoint_path)
        print("✅ Checkpoint loaded")

    def _print_config(self, config: Dict) -> None:
        """Print training configuration"""
        print("\n📋 Training Configuration:")
        print("-" * 80)

        # Group parameters
        groups = {
            "Core": ["data", "model", "epochs", "imgsz", "batch", "device"],
            "Optimizer": ["optimizer", "lr0", "lrf", "momentum", "weight_decay"],
            "Training": ["patience", "save", "cache", "workers", "amp"],
            "Augmentation": ["hsv_h", "hsv_s", "degrees", "translate", "scale", "flipud", "fliplr", "mosaic"]
        }

        for group_name, keys in groups.items():
            print(f"\n{group_name}:")
            for key in keys:
                if key in config:
                    print(f"  {key:20s}: {config[key]}")

        print("-" * 80)

    @staticmethod
    def create_dataset_yaml(
        dataset_path: Union[str, Path],
        classes: List[str],
        train_path: str = "images/train",
        val_path: str = "images/val",
        test_path: Optional[str] = None,
        output_path: Optional[Union[str, Path]] = None
    ) -> Path:
        """
        Create data.yaml file for training

        Args:
            dataset_path: Root path to dataset
            classes: List of class names
            train_path: Relative path to training images
            val_path: Relative path to validation images
            test_path: Relative path to test images (optional)
            output_path: Where to save data.yaml (default: dataset_path/data.yaml)

        Returns:
            Path to created data.yaml file
        """
        dataset_path = Path(dataset_path)
        output_path = Path(output_path) if output_path else dataset_path / "data.yaml"

        data = {
            "path": str(dataset_path.absolute()),
            "train": train_path,
            "val": val_path,
            "names": {i: name for i, name in enumerate(classes)}
        }

        if test_path:
            data["test"] = test_path

        with open(output_path, 'w') as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)

        print(f"✅ Created dataset config: {output_path}")
        return output_path


# Convenience functions
def train_from_config(config_path: Union[str, Path], **kwargs) -> Any:
    """Quick training from config file"""
    trainer = UltralyticsTrainer(config_path)
    return trainer.train(**kwargs)


def train_from_dict(config_dict: Dict, **kwargs) -> Any:
    """Quick training from config dictionary"""
    trainer = UltralyticsTrainer(config_dict)
    return trainer.train(**kwargs)


# Example usage
if __name__ == "__main__":
    # Example configuration
    config = TrainingConfig(
        data="path/to/data.yaml",
        model="yolov8n.pt",
        epochs=50,
        imgsz=640,
        batch=16,
        device="cpu"
    )

    trainer = UltralyticsTrainer(config)
    results = trainer.train()
