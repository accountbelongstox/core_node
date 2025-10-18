#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Automatic Training System
Scans all training projects and trains them automatically
No parameters required - fully automated
"""

import os
import sys
import shutil
import random
from pathlib import Path
from typing import List, Dict, Any

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from controller.training import ClassificationTrainingController
from providor.common_imports import (
    ColorPrint,
    TrainingConfig,
    ClassificationTrainer
)


class AutomaticTrainingSystem:
    """
    Automatic training system that scans and trains all projects
    """

    def __init__(self):
        """Initialize automatic training system"""
        self.controller = ClassificationTrainingController()
        self.projects = []
        self.device = "cpu"
        self.gpu_info = {}

    def scan_projects(self) -> List[Dict[str, Any]]:
        """
        Scan for training projects in source directory

        Returns:
            List of project information dictionaries
        """
        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("🔍 Scanning for Training Projects")
        ColorPrint.blue("=" * 80)

        source_dir = self.controller.training_data_dir / "source"

        if not source_dir.exists():
            ColorPrint.yellow("\n⚠️  No source directory found")
            ColorPrint.yellow(f"   Creating: {source_dir}")
            source_dir.mkdir(parents=True, exist_ok=True)
            return []

        projects = []

        # Scan for project directories
        for project_dir in sorted(source_dir.iterdir()):
            if not project_dir.is_dir():
                continue

            # Check for training data
            yes_dir = project_dir / "yes"
            no_dir = project_dir / "no"

            if not yes_dir.exists() or not no_dir.exists():
                ColorPrint.yellow(f"\n⚠️  Skipping {project_dir.name}: Missing yes/no directories")
                continue

            # Count samples
            yes_files = list(yes_dir.glob("*.png")) + list(yes_dir.glob("*.jpg"))
            no_files = list(no_dir.glob("*.png")) + list(no_dir.glob("*.jpg"))

            if not yes_files or not no_files:
                ColorPrint.yellow(f"\n⚠️  Skipping {project_dir.name}: Empty yes/no directories")
                continue

            # Get sample dimensions
            import cv2
            sample_img = cv2.imread(str(yes_files[0]))
            if sample_img is None:
                ColorPrint.yellow(f"\n⚠️  Skipping {project_dir.name}: Cannot read sample image")
                continue

            img_h, img_w = sample_img.shape[:2]

            project_info = {
                'name': project_dir.name,
                'path': project_dir,
                'yes_count': len(yes_files),
                'no_count': len(no_files),
                'total_count': len(yes_files) + len(no_files),
                'img_size': (img_w, img_h)
            }

            projects.append(project_info)

            ColorPrint.green(f"\n✓ Found project: {project_dir.name}")
            ColorPrint.green(f"   Positive samples: {len(yes_files)}")
            ColorPrint.green(f"   Negative samples: {len(no_files)}")
            ColorPrint.green(f"   Total samples: {len(yes_files) + len(no_files)}")
            ColorPrint.green(f"   Image size: {img_w}x{img_h}")

        if not projects:
            ColorPrint.yellow("\n⚠️  No training projects found")
            ColorPrint.yellow(f"   Add training data to: {source_dir}")
            ColorPrint.yellow("   Expected structure:")
            ColorPrint.yellow("     source/")
            ColorPrint.yellow("       project_name/")
            ColorPrint.yellow("         yes/  (positive samples)")
            ColorPrint.yellow("         no/   (negative samples)")

        return projects

    def check_environment(self) -> bool:
        """
        Check training environment and detect GPU

        Returns:
            True if environment is ready
        """
        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("🔧 Environment Detection")
        ColorPrint.blue("=" * 80)

        # Check dependencies
        env_ok = self.controller.check_environment()

        if not env_ok:
            return False

        # Detect GPU
        try:
            import torch

            ColorPrint.blue(f"\n🎮 GPU Detection:")
            self.gpu_info['torch_version'] = torch.__version__
            self.gpu_info['cuda_available'] = torch.cuda.is_available()

            if torch.cuda.is_available():
                self.device = "cuda"
                self.gpu_info['gpu_count'] = torch.cuda.device_count()
                self.gpu_info['gpu_names'] = []

                for i in range(torch.cuda.device_count()):
                    gpu_name = torch.cuda.get_device_name(i)
                    self.gpu_info['gpu_names'].append(gpu_name)
                    ColorPrint.green(f"   GPU {i}: {gpu_name}")

                    # Get GPU memory
                    props = torch.cuda.get_device_properties(i)
                    total_mem = props.total_memory / (1024**3)  # GB
                    ColorPrint.green(f"         Memory: {total_mem:.1f} GB")

                ColorPrint.green(f"\n✓ CUDA detected - will use GPU acceleration")
                self.device = "cuda"
            else:
                ColorPrint.yellow(f"\n⚠️  No CUDA detected - will use CPU")
                ColorPrint.yellow("   Training will be slower without GPU")
                ColorPrint.yellow("   Consider installing PyTorch with CUDA:")
                ColorPrint.yellow("   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118")
                self.device = "cpu"

        except ImportError:
            ColorPrint.yellow(f"\n⚠️  PyTorch not found - using CPU")
            self.device = "cpu"

        return True

    def prepare_project(self, project: Dict[str, Any]) -> bool:
        """
        Prepare a project for training (create train/val split)

        Args:
            project: Project information dictionary

        Returns:
            True if successful
        """
        ColorPrint.blue(f"\n" + "=" * 80)
        ColorPrint.blue(f"📦 Preparing Project: {project['name']}")
        ColorPrint.blue("=" * 80)

        # Create processed directory
        processed_dir = self.controller.training_data_dir / "processed" / project['name']
        processed_dir.mkdir(parents=True, exist_ok=True)

        # Create train/val directories
        train_yes = processed_dir / "train" / "yes"
        train_no = processed_dir / "train" / "no"
        val_yes = processed_dir / "val" / "yes"
        val_no = processed_dir / "val" / "no"

        for d in [train_yes, train_no, val_yes, val_no]:
            d.mkdir(parents=True, exist_ok=True)

        # Get source files
        source_dir = project['path']
        yes_files = list((source_dir / "yes").glob("*.png")) + list((source_dir / "yes").glob("*.jpg"))
        no_files = list((source_dir / "no").glob("*.png")) + list((source_dir / "no").glob("*.jpg"))

        # Shuffle
        random.shuffle(yes_files)
        random.shuffle(no_files)

        # Split (80/20)
        yes_split = int(len(yes_files) * 0.8)
        no_split = int(len(no_files) * 0.8)

        ColorPrint.green(f"\n✓ Creating train/validation split (80/20):")

        # Copy files
        for img in yes_files[:yes_split]:
            shutil.copy(img, train_yes / img.name)
        for img in yes_files[yes_split:]:
            shutil.copy(img, val_yes / img.name)

        for img in no_files[:no_split]:
            shutil.copy(img, train_no / img.name)
        for img in no_files[no_split:]:
            shutil.copy(img, val_no / img.name)

        ColorPrint.green(f"   Train: {yes_split} yes, {no_split} no")
        ColorPrint.green(f"   Val:   {len(yes_files) - yes_split} yes, {len(no_files) - no_split} no")

        # Create data.yaml
        import yaml

        data_yaml = {
            'path': str(processed_dir.absolute()),
            'train': 'train',
            'val': 'val',
            'names': {
                0: 'no',
                1: 'yes'
            }
        }

        data_yaml_path = processed_dir / "data.yaml"
        with open(data_yaml_path, 'w', encoding='utf-8') as f:
            yaml.dump(data_yaml, f, default_flow_style=False, sort_keys=False)

        ColorPrint.green(f"\n✓ Created: {data_yaml_path.name}")

        return True

    def train_project(self, project: Dict[str, Any]) -> bool:
        """
        Train a project

        Args:
            project: Project information dictionary

        Returns:
            True if successful
        """
        ColorPrint.blue(f"\n" + "=" * 80)
        ColorPrint.blue(f"🚀 Training Project: {project['name']}")
        ColorPrint.blue("=" * 80)

        processed_dir = self.controller.training_data_dir / "processed" / project['name']
        data_yaml_path = processed_dir / "data.yaml"

        if not data_yaml_path.exists():
            ColorPrint.red(f"❌ Data config not found: {data_yaml_path}")
            return False

        # Determine batch size based on device and image size
        img_w, img_h = project['img_size']
        img_size = max(img_w, img_h)

        if self.device == "cuda":
            # GPU batch size
            if img_size <= 64:
                batch_size = 32
            elif img_size <= 128:
                batch_size = 16
            else:
                batch_size = 8
        else:
            # CPU batch size
            if img_size <= 64:
                batch_size = 16
            elif img_size <= 128:
                batch_size = 8
            else:
                batch_size = 4

        # Training configuration
        # For YOLOv8 classification, data should be the directory path, not YAML
        training_config = TrainingConfig(
            data=str(processed_dir),  # Use directory path, not YAML file
            model="yolov8n-cls.pt",
            epochs=100,
            batch=batch_size,
            device=self.device,
            imgsz=img_size,
            project=str(self.controller.training_data_dir / "runs" / project['name']),
            name="train",
            exist_ok=True,
            patience=20,
            lr0=0.001,
            lrf=0.01,
            cache=True if self.device == "cuda" else False,
            workers=4 if self.device == "cuda" else 2
        )

        ColorPrint.green(f"\n📊 Training Configuration:")
        ColorPrint.green(f"   Project: {project['name']}")
        ColorPrint.green(f"   Model: yolov8n-cls.pt")
        ColorPrint.green(f"   Epochs: 100")
        ColorPrint.green(f"   Batch size: {batch_size}")
        ColorPrint.green(f"   Device: {self.device}")
        ColorPrint.green(f"   Image size: {img_size}")
        ColorPrint.green(f"   Samples: {project['total_count']}")

        # Create trainer
        trainer = ClassificationTrainer(training_config=training_config)

        # Train
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🏋️  Starting Training...")
        ColorPrint.blue(f"{'='*80}\n")

        try:
            results = trainer.train(verbose=True)

            # Save best model to d4_modules
            best_model_src = Path(training_config.project) / training_config.name / "weights" / "best.pt"
            if best_model_src.exists():
                # Save to d4_modules directory
                d4_modules_dir = self.controller.project_root / "d4_modules"
                d4_modules_dir.mkdir(parents=True, exist_ok=True)

                best_model_dst = d4_modules_dir / f"{project['name']}_detector.pt"
                shutil.copy(best_model_src, best_model_dst)

                # Create metadata JSON for this model
                import json
                import datetime
                metadata = {
                    "model_name": f"{project['name']}_detector",
                    "model_file": f"{project['name']}_detector.pt",
                    "category": project['name'],
                    "type": "binary_classification",
                    "classes": ["no", "yes"],
                    "img_size": {
                        "width": project['img_size'][0],
                        "height": project['img_size'][1]
                    },
                    "samples": {
                        "positive": project['yes_count'],
                        "negative": project['no_count'],
                        "total": project['total_count']
                    },
                    "training_info": {
                        "epochs": training_config.epochs,
                        "batch_size": training_config.batch,
                        "device": str(training_config.device),
                        "base_model": training_config.model
                    },
                    "trained_at": datetime.datetime.now().isoformat()
                }

                # Save individual model metadata
                metadata_file = d4_modules_dir / f"{project['name']}_detector.json"
                with open(metadata_file, 'w', encoding='utf-8') as f:
                    json.dump(metadata, f, indent=2, ensure_ascii=False)

                ColorPrint.green(f"\n{'='*80}")
                ColorPrint.green(f"[SUCCESS] Training completed: {project['name']}")
                ColorPrint.green(f"{'='*80}")
                ColorPrint.green(f"[MODEL] Model saved: {best_model_dst.relative_to(self.controller.project_root)}")
                ColorPrint.green(f"[METADATA] Metadata saved: {metadata_file.relative_to(self.controller.project_root)}")

                return True

        except Exception as e:
            ColorPrint.red(f"\n[ERROR] Training failed: {e}")
            import traceback
            traceback.print_exc()
            return False

        return False

    def run(self):
        """Run complete automatic training workflow"""
        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("[TRAINING] Automatic Training System")
        ColorPrint.blue("=" * 80)
        ColorPrint.green(f"Training data location: {self.controller.training_data_dir}")

        # 1. Check environment
        if not self.check_environment():
            ColorPrint.red("\n[ERROR] Environment check failed!")
            return 1

        # 2. Scan for projects
        self.projects = self.scan_projects()

        if not self.projects:
            ColorPrint.red("\n[ERROR] No training projects found!")
            return 1

        # 3. Print summary
        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("[SUMMARY] Training Summary")
        ColorPrint.blue("=" * 80)
        ColorPrint.green(f"\n[DEVICE] Device: {self.device.upper()}")
        if self.device == "cuda" and self.gpu_info.get('gpu_names'):
            for i, name in enumerate(self.gpu_info['gpu_names']):
                ColorPrint.green(f"   GPU {i}: {name}")

        ColorPrint.green(f"\n[PROJECTS] Projects to train: {len(self.projects)}")
        for i, proj in enumerate(self.projects, 1):
            ColorPrint.green(f"\n   {i}. {proj['name']}")
            ColorPrint.green(f"      Samples: {proj['yes_count']} yes, {proj['no_count']} no")
            ColorPrint.green(f"      Total: {proj['total_count']} samples")
            ColorPrint.green(f"      Image size: {proj['img_size'][0]}x{proj['img_size'][1]}")

        # Ask for confirmation
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.yellow(f"⚡ Ready to start training {len(self.projects)} project(s)")
        ColorPrint.yellow("   This may take a while depending on your hardware")
        ColorPrint.blue(f"{'='*80}")

        # Train each project
        success_count = 0
        for i, project in enumerate(self.projects, 1):
            ColorPrint.blue(f"\n\n{'='*80}")
            ColorPrint.blue(f"📦 Project {i}/{len(self.projects)}: {project['name']}")
            ColorPrint.blue(f"{'='*80}")

            # Prepare
            if not self.prepare_project(project):
                ColorPrint.red(f"❌ Failed to prepare project: {project['name']}")
                continue

            # Train
            if self.train_project(project):
                success_count += 1

        # Final summary
        ColorPrint.blue(f"\n\n{'='*80}")
        ColorPrint.blue("🎉 Training Complete!")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"\n📊 Results:")
        ColorPrint.green(f"   Total projects: {len(self.projects)}")
        ColorPrint.green(f"   Successful: {success_count}")
        ColorPrint.green(f"   Failed: {len(self.projects) - success_count}")

        if success_count > 0:
            ColorPrint.green(f"\n📦 Trained models saved to:")
            d4_modules_dir = self.controller.project_root / "d4_modules"
            ColorPrint.green(f"   {d4_modules_dir}")

            # Create model registry
            import json
            import datetime
            registry = {
                "registry_version": "1.0",
                "created_at": datetime.datetime.now().isoformat(),
                "models": []
            }

            for project in self.projects:
                model_file = d4_modules_dir / f"{project['name']}_detector.pt"
                metadata_file = d4_modules_dir / f"{project['name']}_detector.json"

                if model_file.exists():
                    ColorPrint.green(f"   ✓ {model_file.name}")

                    # Read individual metadata
                    if metadata_file.exists():
                        with open(metadata_file, 'r', encoding='utf-8') as f:
                            model_metadata = json.load(f)
                            registry["models"].append(model_metadata)

            # Save model registry
            registry_file = d4_modules_dir / "model_registry.json"
            with open(registry_file, 'w', encoding='utf-8') as f:
                json.dump(registry, f, indent=2, ensure_ascii=False)

            ColorPrint.green(f"\n📋 Model registry created:")
            ColorPrint.green(f"   {registry_file.relative_to(self.controller.project_root)}")
            ColorPrint.green(f"   Total models: {len(registry['models'])}")

        return 0 if success_count == len(self.projects) else 1


def main():
    """Main entry point"""
    system = AutomaticTrainingSystem()
    return system.run()


if __name__ == "__main__":
    sys.exit(main())
