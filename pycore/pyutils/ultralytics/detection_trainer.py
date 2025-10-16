#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Detection Trainer - Generic Detection Training
Automatically handles data preparation and training for detection tasks
"""

import os
import json
from pathlib import Path
from typing import Optional, Dict, Any, List

from .dataset_generator_yolo import DetectionDatasetGenerator
from .ultralytics_trainer import process_source_images

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


class DetectionTrainer:
    """
    Generic detection trainer

    Usage:
        trainer = DetectionTrainer(
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
        namespace: str = "detection",
        project_name: Optional[str] = None
    ):
        """
        Initialize detection trainer

        Args:
            source_dir: Source data directory containing metadata.json and images
            output_base_dir: Base output directory (default: source_dir/../processed)
            namespace: Namespace for this training type (default: "detection")
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

        # Process source_image: auto-expand to array and add public/* if exists
        self.source_images = self._process_source_images()

        # Coordinates
        self.coordinates = self.source_metadata.get('coordinates', [])

        # Validate: must have either coordinates or source images
        if not self.coordinates and not self.source_images:
            # Check if there are patch images in source/ subdirectory
            source_imgs_dir = self.source_dir / 'source'
            has_patches = False
            if source_imgs_dir.exists():
                has_patches = any(source_imgs_dir.glob('*.png')) or \
                             any(source_imgs_dir.glob('*.jpg')) or \
                             any(source_imgs_dir.glob('*.jpeg'))

            if not has_patches:
                raise ValueError(
                    f"\033[91mERROR: Project '{self.project_name}' must have either:\n"
                    f"  1. Non-empty 'coordinates' in metadata.json, OR\n"
                    f"  2. Patch images in source/ subdirectory\n"
                    f"  Current state: coordinates={len(self.coordinates)}, "
                    f"source_images={len(self.source_images)}, "
                    f"patches_in_source/={has_patches}\033[0m"
                )

        self.model = None

    def _process_source_images(self) -> List[Path]:
        """Use shared utility to process source images"""
        source_image_config = self.source_metadata.get('source_image', [])
        return process_source_images(self.source_dir, source_image_config)

    def prepare_data(
        self,
        num_images: int = 50,
        aug_config: Optional[Dict] = None,
        force: bool = False
    ) -> bool:
        """
        Prepare detection training data

        Args:
            num_images: Number of training images to generate
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
                print(f"Detection data already exists (auto_generated=False): {self.processed_dir}")
                print(f"Keeping existing data. Use force=True to regenerate.")
                return True
            else:
                # force=True: delete and regenerate
                print(f"Force regeneration requested, removing old data: {self.processed_dir}")
                import shutil
                shutil.rmtree(self.processed_dir, ignore_errors=True)

        print(f"Preparing detection data for: {self.project_name}")
        print(f"  Source: {self.source_dir}")
        print(f"  Output: {self.processed_dir}")

        # Read augmentation config from metadata, or use default
        if aug_config is None:
            metadata_aug = self.source_metadata.get('augmentation', {}).get('detection', {})
            if metadata_aug:
                print(f"Using augmentation config from metadata.json")
                aug_config = metadata_aug
                # Add paste_per_image if not specified
                if 'paste_per_image' not in aug_config:
                    aug_config['paste_per_image'] = [3, 8]
            else:
                print(f"Using default augmentation config")
                aug_config = {
                    'allow_rotation': True,
                    'rotation_range': [-15, 15],
                    'allow_stretch': True,
                    'stretch_x_range': [0.8, 1.2],
                    'stretch_y_range': [0.9, 1.1],
                    'allow_scale': True,
                    'scale_range': [0.6, 1.4],
                    'paste_per_image': [3, 8]
                }

        # Generate dataset
        generator = DetectionDatasetGenerator(
            source_image_paths=self.source_images,
            coordinates=self.coordinates,
            output_dir=self.processed_dir,
            aug_config=aug_config
        )

        success = generator.generate(num_images=num_images)

        if success:
            print(f"SUCCESS: Detection data prepared")
        else:
            print(f"FAILED: Detection data preparation failed")

        return success

    def train(
        self,
        epochs: int = 100,
        batch_size: int = 16,
        imgsz: int = 640,
        device: str = "cpu",
        **kwargs
    ) -> Any:
        """
        Train detection model

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

        # Get data.yaml path
        data_yaml = self.processed_dir / "data.yaml"
        if not data_yaml.exists():
            print(f"ERROR: data.yaml not found: {data_yaml}")
            return None

        # Count training samples
        train_images_dir = self.processed_dir / "images" / "train"
        val_images_dir = self.processed_dir / "images" / "val"
        train_count = len(list(train_images_dir.glob("*.png"))) if train_images_dir.exists() else 0
        val_count = len(list(val_images_dir.glob("*.png"))) if val_images_dir.exists() else 0
        total_samples = train_count + val_count

        # Read data.yaml for class info
        import yaml
        with open(data_yaml, 'r', encoding='utf-8') as f:
            data_config = yaml.safe_load(f)

        class_names = data_config.get('names', [])
        num_classes = len(class_names)

        # Print training information
        print("\n" + "=" * 80)
        print("DETECTION TRAINING CONFIGURATION")
        print("=" * 80)
        print(f"Project Name:        {self.project_name}")
        print(f"Model Type:          YOLOv8n Detection")
        print(f"Namespace:           {self.namespace}")
        print(f"Pre-trained Model:   yolov8n.pt")
        print("-" * 80)
        print(f"Data Directory:      {self.processed_dir}")
        print(f"Data Config:         {data_yaml}")
        print(f"Number of Classes:   {num_classes}")
        print(f"Class Names:         {', '.join(class_names)}")
        print(f"  - train samples:   {train_count}")
        print(f"  - val samples:     {val_count}")
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
        self.model = YOLO("yolov8n.pt")

        # Train
        results = self.model.train(
            data=str(data_yaml),
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
        return (
            (self.processed_dir / "images").exists() and
            (self.processed_dir / "labels").exists() and
            (self.processed_dir / "data.yaml").exists()
        )


def train_detection(
    source_dir: str,
    output_base_dir: Optional[str] = None,
    prepare_data: bool = True,
    train_model: bool = True,
    **kwargs
) -> Any:
    """
    Convenience function for quick detection training

    Args:
        source_dir: Source data directory
        output_base_dir: Output base directory (optional)
        prepare_data: Whether to prepare data
        train_model: Whether to train model
        **kwargs: Additional arguments for training

    Returns:
        Training results
    """
    trainer = DetectionTrainer(source_dir, output_base_dir)

    if prepare_data:
        trainer.prepare_data()

    if train_model:
        return trainer.train(**kwargs)

    return None
