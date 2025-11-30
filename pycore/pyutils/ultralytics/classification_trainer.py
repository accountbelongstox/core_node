#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Classification Trainer - Generic Classification Training
Automatically handles data preparation and training for classification tasks
"""

import os
import json
from pathlib import Path
from typing import Optional, Dict, Any, List

from .dataset_generator_yolo import ClassificationDatasetGenerator
from .ultralytics_trainer import process_image_config

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


class ClassificationTrainer:
    """
    Generic classification trainer

    Usage:
        trainer = ClassificationTrainer(
            source_dir="path/to/source/data",
            output_base_dir="path/to/output"  # optional
        )
        trainer.prepare_data()
        trainer.train()
    """

    def __init__(
        self,
        source_dir: str,
        output_base_dir: Optional[str] = None,
        namespace: str = "classification",
        project_name: Optional[str] = None
    ):
        """
        Initialize classification trainer

        Args:
            source_dir: Source data directory containing metadata.json and images
            output_base_dir: Base output directory (default: source_dir/../processed)
            namespace: Namespace for this training type (default: "classification")
            project_name: Project name (default: inferred from source_dir)
        """
        self.source_dir = Path(source_dir)
        self.namespace = namespace
        self.project_name = project_name or self.source_dir.name

        # Auto-determine output directory
        if output_base_dir is None:
            output_base_dir = self.source_dir.parent.parent / "processed"

        self.output_base_dir = Path(output_base_dir)
        self.processed_dir = self.output_base_dir / namespace / self.project_name

        # Model output directory
        self.model_output_dir = self.source_dir.parent.parent.parent / "d4_modules" / namespace / self.project_name

        # Load source metadata
        self.metadata_file = self.source_dir / "metadata.json"
        if not self.metadata_file.exists():
            raise FileNotFoundError(f"Metadata not found: {self.metadata_file}")

        with open(self.metadata_file, 'r', encoding='utf-8') as f:
            self.source_metadata = json.load(f)

        # Coordinates
        self.coordinates = self.source_metadata.get('coordinates', [])

        # Get configurations
        background_image_config = self.source_metadata.get('background_images', [])
        patch_image_config = self.source_metadata.get('patch_images', [])

        # Validate: must have at least one of coordinates or patch_images
        if not self.coordinates and not patch_image_config:
            print(f"\033[91mERROR: Project '{self.project_name}' must have at least one of:\033[0m")
            print(f"\033[91m  1. Non-empty 'coordinates' in metadata.json, OR\033[0m")
            print(f"\033[91m  2. Non-empty 'patch_images' in metadata.json\033[0m")
            print(f"\033[91m  Current: coordinates={len(self.coordinates)}, patch_images={bool(patch_image_config)}\033[0m")
            print(f"\033[93mSKIPPING project '{self.project_name}'\033[0m")
            raise ValueError(f"Project '{self.project_name}' has neither coordinates nor patch_images")

        # Process background_images (large images) if coordinates exist
        self.background_images = []
        if self.coordinates:
            if background_image_config:
                try:
                    self.background_images = process_image_config(
                        self.source_dir, background_image_config, "background images", subdirectory="background_images"
                    )
                except FileNotFoundError:
                    print(f"\033[93mWARNING: coordinates exist but no valid background_images found\033[0m")

        # Process patch_images (target images)
        self.patch_images = []
        if patch_image_config:
            try:
                self.patch_images = process_image_config(
                    self.source_dir, patch_image_config, "patch images", subdirectory="patch_images"
                )
            except FileNotFoundError:
                print(f"\033[93mWARNING: patch_images config exists but no valid images found\033[0m")

        self.model = None

    def prepare_data(
        self,
        augmentation_count: int = 30,
        negative_samples: int = 150,
        aug_config: Optional[Dict] = None,
        force: bool = False
    ) -> bool:
        """
        Prepare classification training data

        Args:
            augmentation_count: Number of augmented samples per region
            negative_samples: Number of negative samples
            aug_config: Augmentation configuration (optional)
            force: Force regeneration even if data exists

        Returns:
            True if successful
        """
        # Check if auto_generated flag is set in metadata
        auto_generated = self.source_metadata.get('auto_generated', False)

        # Check if data exists
        data_exists = self._check_data_exists()

        if data_exists:
            if auto_generated:
                # Auto-generated: always delete and regenerate
                print(f"Auto-generated data detected, removing old data: {self.processed_dir}")
                import shutil
                shutil.rmtree(self.processed_dir, ignore_errors=True)
                print(f"Old data removed, will regenerate from source")
            elif not force:
                # Manual data: keep existing unless force=True
                print(f"Classification data already exists (auto_generated=False): {self.processed_dir}")
                print(f"Keeping existing data. Use force=True to regenerate.")
                return True
            else:
                # force=True: delete and regenerate
                print(f"Force regeneration requested, removing old data: {self.processed_dir}")
                import shutil
                shutil.rmtree(self.processed_dir, ignore_errors=True)

        print(f"Preparing classification data for: {self.project_name}")
        print(f"  Source: {self.source_dir}")
        print(f"  Output: {self.processed_dir}")

        # Read augmentation config from metadata, or use default
        if aug_config is None:
            metadata_aug = self.source_metadata.get('augmentation', {}).get('classification', {})
            if metadata_aug:
                print(f"Using augmentation config from metadata.json")
                aug_config = metadata_aug
            else:
                print(f"Using default augmentation config")
                aug_config = {
                    'allow_rotation': False,
                    'allow_stretch': False,
                    'allow_scale': True,
                    'scale_range': [0.3, 1.0],
                    'color_jitter': True,
                    'vertical_offset': 2
                }

        # Get enhancements from metadata if present
        enhancements = self.source_metadata.get('enhancements', [])

        # Generate dataset
        # Support mixed mode: both coordinates (with background_images) AND patch_images
        generator = ClassificationDatasetGenerator(
            background_image_paths=self.background_images if self.coordinates else [],
            patch_image_paths=self.patch_images,
            coordinates=self.coordinates,
            output_dir=self.processed_dir,
            aug_config=aug_config,
            enhancements=enhancements
        )

        success = generator.generate(
            augmentation_count=augmentation_count,
            negative_samples=negative_samples
        )

        if success:
            print(f"SUCCESS: Classification data prepared")
        else:
            print(f"FAILED: Classification data preparation failed")

        return success

    def train(
        self,
        epochs: int = 100,
        batch_size: int = 8,
        imgsz: int = 76,
        device: str = "cpu",
        **kwargs
    ) -> Any:
        """
        Train classification model

        Args:
            epochs: Number of training epochs
            batch_size: Batch size
            imgsz: Image size
            device: Device to use ('cpu', 'cuda', etc.)
            **kwargs: Additional training arguments

        Returns:
            Training results
        """
        if not ULTRALYTICS_AVAILABLE:
            raise ImportError("Ultralytics not installed. Install with: pip install ultralytics")

        # Check if data exists
        if not self._check_data_exists():
            print("ERROR: Training data not found. Run prepare_data() first.")
            return None

        # Count training samples
        yes_dir = self.processed_dir / "yes"
        no_dir = self.processed_dir / "no"
        yes_count = len(list(yes_dir.glob("*.png"))) if yes_dir.exists() else 0
        no_count = len(list(no_dir.glob("*.png"))) if no_dir.exists() else 0
        total_samples = yes_count + no_count

        # Print training information
        print("\n" + "=" * 80)
        print("CLASSIFICATION TRAINING CONFIGURATION")
        print("=" * 80)
        print(f"Project Name:        {self.project_name}")
        print(f"Model Type:          YOLOv8n Classification")
        print(f"Namespace:           {self.namespace}")
        print(f"Pre-trained Model:   yolov8n-cls.pt")
        print("-" * 80)
        print(f"Data Directory:      {self.processed_dir}")
        print(f"Classes:             yes, no")
        print(f"  - yes samples:     {yes_count}")
        print(f"  - no samples:      {no_count}")
        print(f"Total Samples:       {total_samples}")
        print("-" * 80)
        print(f"Training Device:     {device.upper()}")
        print(f"Epochs:              {epochs}")
        print(f"Batch Size:          {batch_size}")
        print(f"Image Size:          {imgsz}x{imgsz}")
        print("-" * 80)
        print(f"Output Directory:    {self.model_output_dir}")
        print("=" * 80 + "\n")

        # Create model output directory
        self.model_output_dir.mkdir(parents=True, exist_ok=True)

        # Load model
        self.model = YOLO("yolov8n-cls.pt")

        # Train
        results = self.model.train(
            data=str(self.processed_dir),
            epochs=epochs,
            batch=batch_size,
            imgsz=imgsz,
            device=device,
            project=str(self.model_output_dir.parent),
            name=self.project_name,
            exist_ok=True,
            **kwargs
        )

        print(f"\nSUCCESS: Model trained and saved to {self.model_output_dir}")

        return results

    def _check_data_exists(self) -> bool:
        """Check if processed data exists"""
        return (self.processed_dir / "yes").exists() and (self.processed_dir / "no").exists()


def train_classification(
    source_dir: str,
    output_base_dir: Optional[str] = None,
    prepare_data: bool = True,
    train_model: bool = True,
    **kwargs
) -> Any:
    """
    Convenience function for quick classification training

    Args:
        source_dir: Source data directory
        output_base_dir: Output base directory (optional)
        prepare_data: Whether to prepare data
        train_model: Whether to train model
        **kwargs: Additional arguments for training

    Returns:
        Training results
    """
    trainer = ClassificationTrainer(source_dir, output_base_dir)

    if prepare_data:
        trainer.prepare_data()

    if train_model:
        return trainer.train(**kwargs)

    return None
