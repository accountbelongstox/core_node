#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YOLO Detection Model Training Script
Trains YOLOv8 detection models for object detection in large images
Namespace: detection (large image + coordinates)
"""

import os
import sys
import json
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
import argparse

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from providor.common_imports import ColorPrint


class DetectionTrainer:
    """
    Trains YOLOv8 detection models
    """

    def __init__(self, models_dir: Optional[Path] = None):
        """
        Initialize detection trainer

        Args:
            models_dir: Directory to save trained models (defaults to d4_modules_detection)
        """
        self.project_root = Path(current_dir)
        self.models_dir = models_dir or (self.project_root / "d4_modules_detection")
        self.models_dir.mkdir(parents=True, exist_ok=True)

        self.training_data_dir = self.project_root / ".cache" / "training_data" / "detection"

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🎯 YOLO Detection Model Trainer")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"Models directory: {self.models_dir}")
        ColorPrint.green(f"Training data directory: {self.training_data_dir}")

        # Detect device
        self._detect_device()

    def _detect_device(self):
        """Detect available GPU/CPU"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🔧 Environment Detection")
        ColorPrint.blue(f"{'='*80}")

        try:
            import torch
            ColorPrint.green(f"✓ PyTorch: {torch.__version__}")

            if torch.cuda.is_available():
                self.device = "cuda"
                ColorPrint.green(f"\n🎮 GPU Detection:")
                for i in range(torch.cuda.device_count()):
                    gpu_name = torch.cuda.get_device_name(i)
                    gpu_memory = torch.cuda.get_device_properties(i).total_memory / 1024**3
                    ColorPrint.green(f"   GPU {i}: {gpu_name}")
                    ColorPrint.green(f"         Memory: {gpu_memory:.1f} GB")
                ColorPrint.green(f"✓ CUDA detected - will use GPU acceleration")
            else:
                self.device = "cpu"
                ColorPrint.yellow(f"⚠️  No CUDA GPU detected - will use CPU")
                ColorPrint.yellow(f"   Training will be slower on CPU")

        except ImportError:
            self.device = "cpu"
            ColorPrint.yellow(f"⚠️  PyTorch not found - will use CPU")

    def scan_detection_projects(self) -> list:
        """
        Scan for detection training projects

        Returns:
            List of project information dictionaries
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🔍 Scanning for Detection Training Projects")
        ColorPrint.blue(f"{'='*80}")

        projects = []

        if not self.training_data_dir.exists():
            ColorPrint.yellow(f"\n⚠️  Training data directory not found: {self.training_data_dir}")
            ColorPrint.yellow(f"   Please generate detection training data first:")
            ColorPrint.yellow(f"   python scripts/prepare_detection_training.py ...")
            return projects

        # Scan for projects
        for project_dir in self.training_data_dir.iterdir():
            if not project_dir.is_dir():
                continue

            # Check for required structure
            yaml_file = project_dir / "data.yaml"
            metadata_file = project_dir / "metadata.json"
            images_train = project_dir / "images" / "train"
            images_val = project_dir / "images" / "val"

            if not all([yaml_file.exists(), images_train.exists(), images_val.exists()]):
                ColorPrint.yellow(f"⚠️  Skipping {project_dir.name}: incomplete structure")
                continue

            # Load metadata
            try:
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)

                project_info = {
                    'name': project_dir.name,
                    'path': project_dir,
                    'yaml_file': yaml_file,
                    'metadata': metadata,
                    'namespace': metadata.get('namespace', project_dir.name)
                }

                projects.append(project_info)

                stats = metadata.get('statistics', {})
                ColorPrint.green(f"\n✓ Found project: {project_dir.name}")
                ColorPrint.green(f"   Namespace: {metadata.get('namespace')}")
                ColorPrint.green(f"   Train images: {stats.get('train_images', 0)}")
                ColorPrint.green(f"   Val images: {stats.get('val_images', 0)}")
                ColorPrint.green(f"   Total objects: {stats.get('total_objects', 0)}")
                ColorPrint.green(f"   Yes objects: {stats.get('yes_objects', 0)}")
                ColorPrint.green(f"   No objects: {stats.get('no_objects', 0)}")

            except Exception as e:
                ColorPrint.yellow(f"⚠️  Failed to load metadata for {project_dir.name}: {e}")
                continue

        return projects

    def train_project(
        self,
        project: Dict[str, Any],
        epochs: int = 100,
        batch_size: int = 16,
        img_size: int = 640
    ) -> bool:
        """
        Train a detection model for a project

        Args:
            project: Project information dictionary
            epochs: Number of training epochs
            batch_size: Batch size
            img_size: Image size for training

        Returns:
            True if successful
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue(f"🚀 Training Project: {project['name']}")
        ColorPrint.blue(f"{'='*80}")

        try:
            from ultralytics import YOLO

            # Load model
            model = YOLO("yolov8n.pt")  # Detection model
            ColorPrint.green(f"✓ Loaded base model: yolov8n.pt")

            # Training parameters
            ColorPrint.blue(f"\n📋 Training Configuration:")
            ColorPrint.green(f"  Data: {project['yaml_file']}")
            ColorPrint.green(f"  Epochs: {epochs}")
            ColorPrint.green(f"  Batch size: {batch_size}")
            ColorPrint.green(f"  Image size: {img_size}")
            ColorPrint.green(f"  Device: {self.device}")

            # Train
            ColorPrint.blue(f"\n🏋️  Starting training...")
            results = model.train(
                data=str(project['yaml_file']),
                epochs=epochs,
                batch=batch_size,
                imgsz=img_size,
                device=self.device,
                project=str(self.training_data_dir / "runs" / project['name']),
                name="train",
                exist_ok=True,
                patience=20,
                save=True,
                plots=True,
                verbose=True
            )

            # Save model
            model_name = f"{project['namespace']}_detector.pt"
            model_path = self.models_dir / model_name
            model.save(str(model_path))

            ColorPrint.green(f"\n✅ Training completed!")
            ColorPrint.green(f"📦 Model saved: {model_path}")

            # Save metadata
            metadata = {
                'model_name': f"{project['namespace']}_detector",
                'model_file': model_name,
                'namespace': project['namespace'],
                'category': project['namespace'],
                'type': 'object_detection',
                'model_type': 'yolov8n.pt',
                'classes': ['no', 'yes'],
                'num_classes': 2,
                'training_data': project['metadata'],
                'training_info': {
                    'epochs': epochs,
                    'batch_size': batch_size,
                    'img_size': img_size,
                    'device': self.device,
                    'base_model': 'yolov8n.pt'
                },
                'trained_at': datetime.now().isoformat()
            }

            metadata_path = self.models_dir / f"{project['namespace']}_detector.json"
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)

            ColorPrint.green(f"📄 Metadata saved: {metadata_path}")

            return True

        except ImportError:
            ColorPrint.red(f"\n❌ Ultralytics not installed")
            ColorPrint.yellow(f"   Install with: pip install ultralytics")
            return False
        except Exception as e:
            ColorPrint.red(f"\n❌ Training failed: {e}")
            import traceback
            traceback.print_exc()
            return False

    def create_model_registry(self, projects: list):
        """
        Create or update model registry

        Args:
            projects: List of trained projects
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("📋 Creating Model Registry")
        ColorPrint.blue(f"{'='*80}")

        registry = {
            'registry_version': '1.0',
            'namespace': 'detection',
            'model_type': 'object_detection',
            'created_at': datetime.now().isoformat(),
            'models': []
        }

        # Load metadata for each model
        for project in projects:
            metadata_path = self.models_dir / f"{project['namespace']}_detector.json"
            if metadata_path.exists():
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    model_metadata = json.load(f)
                    registry['models'].append(model_metadata)

        # Save registry
        registry_path = self.models_dir / "model_registry.json"
        with open(registry_path, 'w', encoding='utf-8') as f:
            json.dump(registry, f, indent=2, ensure_ascii=False)

        ColorPrint.green(f"\n✅ Model registry created:")
        ColorPrint.green(f"   {registry_path}")
        ColorPrint.green(f"   Total models: {len(registry['models'])}")

    def train_all(
        self,
        epochs: int = 100,
        batch_size: int = 16,
        img_size: int = 640
    ) -> bool:
        """
        Train all detection projects

        Args:
            epochs: Number of training epochs
            batch_size: Batch size
            img_size: Image size

        Returns:
            True if successful
        """
        # Scan projects
        projects = self.scan_detection_projects()

        if not projects:
            ColorPrint.red(f"\n❌ No detection training projects found")
            ColorPrint.yellow(f"   Please generate detection training data first:")
            ColorPrint.yellow(f"   python scripts/prepare_detection_training.py ...")
            return False

        # Display summary
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("📊 Training Summary")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"🎮 Device: {self.device.upper()}")
        ColorPrint.green(f"\n📦 Projects to train: {len(projects)}")

        for i, project in enumerate(projects, 1):
            stats = project['metadata'].get('statistics', {})
            ColorPrint.green(f"   {i}. {project['name']}")
            ColorPrint.green(f"      Images: {stats.get('train_images', 0)} train, {stats.get('val_images', 0)} val")
            ColorPrint.green(f"      Objects: {stats.get('total_objects', 0)} total")

        ColorPrint.blue(f"\n⚡ Ready to start training {len(projects)} project(s)")

        # Train each project
        trained_projects = []
        for project in projects:
            success = self.train_project(
                project,
                epochs=epochs,
                batch_size=batch_size,
                img_size=img_size
            )

            if success:
                trained_projects.append(project)

        # Create registry
        if trained_projects:
            self.create_model_registry(trained_projects)

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🎉 Training Complete")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"✅ Successfully trained {len(trained_projects)}/{len(projects)} project(s)")

        return len(trained_projects) > 0


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Train YOLO detection models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Train all detection projects
  python train_detection.py

  # Custom parameters
  python train_detection.py --epochs 150 --batch 32 --img-size 1280
        """
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=100,
        help="Number of training epochs (default: 100)"
    )

    parser.add_argument(
        "--batch",
        type=int,
        default=16,
        help="Batch size (default: 16)"
    )

    parser.add_argument(
        "--img-size",
        type=int,
        default=640,
        help="Image size for training (default: 640)"
    )

    parser.add_argument(
        "--models-dir",
        type=str,
        default=None,
        help="Directory to save trained models (default: d4_modules_detection)"
    )

    args = parser.parse_args()

    # Create trainer
    models_dir = Path(args.models_dir) if args.models_dir else None
    trainer = DetectionTrainer(models_dir=models_dir)

    # Train all projects
    success = trainer.train_all(
        epochs=args.epochs,
        batch_size=args.batch,
        img_size=args.img_size
    )

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
