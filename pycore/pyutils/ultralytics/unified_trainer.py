#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Trainer - Merge Multiple Projects into One Model
"""

import json
from pathlib import Path
from typing import List, Dict, Optional, Any

from pycore.pyutils.ultralytics.classification_trainer import ClassificationTrainer
from pycore.pyutils.ultralytics.detection_trainer import DetectionTrainer
from pycore.pyutils.ultralytics.device_manager import get_device_manager
from pycore.pyutils.ultralytics.gpu_image_processor import get_gpu_processor


def print_dataset_info(
    processed_dir: Path,
    namespace: str,
    project_name: str,
    source_projects: List[str] = None
):
    """
    Print comprehensive dataset information before training

    Args:
        processed_dir: Processed data directory
        namespace: Training namespace (classification or detection)
        project_name: Project name
        source_projects: List of source project names
    """
    print(f"\n{'='*80}")
    print(f"DATASET INFORMATION - {namespace.upper()}")
    print(f"{'='*80}")

    # Basic info
    print(f"Project Name:       {project_name}")
    print(f"Namespace:          {namespace}")
    print(f"Data Directory:     {processed_dir}")

    if source_projects:
        print(f"Source Projects:    {len(source_projects)}")
        for idx, proj in enumerate(source_projects, 1):
            print(f"  {idx}. {proj}")

    print(f"-" * 80)

    if namespace == "classification":
        # Classification dataset info
        yes_dir = processed_dir / "yes"
        no_dir = processed_dir / "no"

        if yes_dir.exists() and no_dir.exists():
            yes_files = list(yes_dir.glob("*.png"))
            no_files = list(no_dir.glob("*.png"))

            print(f"Classes:            2 (yes, no)")
            print(f"Total Samples:      {len(yes_files) + len(no_files)}")
            print(f"  - yes samples:    {len(yes_files)}")
            print(f"  - no samples:     {len(no_files)}")

            # Group yes samples by project
            project_counts = {}
            for f in yes_files:
                # Extract project name from filename (project_name_...)
                parts = f.stem.split('_', 1)
                if len(parts) >= 1:
                    proj = parts[0]
                    project_counts[proj] = project_counts.get(proj, 0) + 1

            if project_counts:
                print(f"\nPositive Samples by Project:")
                for proj, count in sorted(project_counts.items()):
                    print(f"  - {proj}: {count}")
        else:
            print(f"ERROR: Dataset directories not found")
            print(f"  Expected: {yes_dir}")
            print(f"  Expected: {no_dir}")

    elif namespace == "detection":
        # Detection dataset info
        data_yaml = processed_dir / "data.yaml"
        images_dir = processed_dir / "images"
        labels_dir = processed_dir / "labels"

        if data_yaml.exists():
            # Read data.yaml
            with open(data_yaml, 'r', encoding='utf-8') as f:
                data = {}
                for line in f:
                    if ':' in line:
                        key, value = line.strip().split(':', 1)
                        key = key.strip()
                        value = value.strip()
                        # Try to evaluate lists
                        if value.startswith('[') and value.endswith(']'):
                            import ast
                            try:
                                value = ast.literal_eval(value)
                            except:
                                pass
                        data[key] = value

            print(f"Classes:            {data.get('nc', 'unknown')}")
            if 'names' in data:
                print(f"Class Names:        {', '.join(data['names'])}")

            if images_dir.exists() and labels_dir.exists():
                image_files = list(images_dir.glob("*.png"))
                label_files = list(labels_dir.glob("*.txt"))

                print(f"Total Images:       {len(image_files)}")
                print(f"Total Labels:       {len(label_files)}")

                # Count total annotations
                total_annotations = 0
                class_counts = {}

                for label_file in label_files:
                    with open(label_file, 'r') as f:
                        lines = f.readlines()
                        total_annotations += len(lines)

                        for line in lines:
                            parts = line.strip().split()
                            if parts:
                                class_id = int(parts[0])
                                class_counts[class_id] = class_counts.get(class_id, 0) + 1

                print(f"Total Annotations:  {total_annotations}")

                if class_counts and 'names' in data:
                    print(f"\nAnnotations by Class:")
                    class_names = data['names']
                    for class_id in sorted(class_counts.keys()):
                        class_name = class_names[class_id] if class_id < len(class_names) else f"class_{class_id}"
                        count = class_counts[class_id]
                        print(f"  - {class_name}: {count}")
        else:
            print(f"ERROR: data.yaml not found: {data_yaml}")

    print(f"{'='*80}\n")


class UnifiedClassificationTrainer:
    """
    Train ONE classification model with ALL projects
    Each project generates yes/no samples, all merged into one dataset
    """

    def __init__(
        self,
        source_dirs: List[str],
        output_base_dir: Optional[str] = None,
        namespace: str = "classification",
        project_name: str = "unified_model"
    ):
        """
        Initialize unified classification trainer

        Args:
            source_dirs: List of source directories (one per class/project)
            output_base_dir: Base output directory
            namespace: Namespace for this training type
            project_name: Unified project name (default: "unified_model")
        """
        self.source_dirs = [Path(d) for d in source_dirs]
        self.namespace = namespace
        self.project_name = project_name

        # Use first source dir to infer base paths
        # Path: training_data/1_sources/projects/project_name
        first_source = self.source_dirs[0]
        if output_base_dir is None:
            # Navigate: projects -> 1_sources -> training_data -> 2_datasets
            training_data_dir = first_source.parent.parent.parent
            output_base_dir = training_data_dir / "2_datasets"

        self.output_base_dir = Path(output_base_dir)
        self.processed_dir = self.output_base_dir / namespace / self.project_name

        # Model output directory: training_data -> 3_models
        training_data_dir = first_source.parent.parent.parent
        self.model_output_dir = training_data_dir / "3_models" / namespace / self.project_name

    def prepare_data(
        self,
        augmentation_count: int = 30,
        negative_samples: int = 150,
        force: bool = False
    ) -> bool:
        """
        Prepare unified classification dataset from all projects

        Strategy:
        - Each project generates positive samples in its own subfolder
        - Negative samples are shared across all projects
        - Final structure:
            processed/classification/unified_model/
                yes/
                    cancel_button_region_0_full.png
                    confirm_button_region_0_full.png
                    rift_progress_bar_patch_0_original.png
                    ...
                no/
                    negative_0.png
                    negative_1.png
                    ...

        Args:
            augmentation_count: Number of augmented samples per region
            negative_samples: Number of negative samples per project
            force: Force regeneration even if data exists

        Returns:
            True if successful
        """
        # Check if data exists
        yes_dir = self.processed_dir / "yes"
        no_dir = self.processed_dir / "no"
        has_data = (yes_dir.exists() and no_dir.exists() and
                    len(list(yes_dir.glob("*.png"))) > 0 and
                    len(list(no_dir.glob("*.png"))) > 0)

        if has_data:
            # Check if any source project is auto_generated
            any_auto_generated = False
            for source_dir in self.source_dirs:
                metadata_file = source_dir / "metadata.json"
                if metadata_file.exists():
                    with open(metadata_file, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                    if metadata.get('auto_generated', False):
                        any_auto_generated = True
                        break

            if any_auto_generated:
                # Auto-generated: always delete and regenerate
                print(f"Auto-generated data detected, removing old data: {self.processed_dir}")
                import shutil
                shutil.rmtree(self.processed_dir, ignore_errors=True)
                print(f"Old data removed, will regenerate from source")
            elif not force:
                # Manual data: keep existing unless force=True
                print(f"Unified classification data already exists (auto_generated=False): {self.processed_dir}")
                print(f"Keeping existing data. Use force=True to regenerate.")
                return True
            else:
                # force=True: delete and regenerate
                print(f"Force regeneration requested, removing old data: {self.processed_dir}")
                import shutil
                shutil.rmtree(self.processed_dir, ignore_errors=True)

        # Create output directories
        yes_dir = self.processed_dir / "yes"
        no_dir = self.processed_dir / "no"
        yes_dir.mkdir(parents=True, exist_ok=True)
        no_dir.mkdir(parents=True, exist_ok=True)

        total_positive = 0
        total_negative = 0

        print(f"\n{'='*80}")
        print(f"UNIFIED CLASSIFICATION DATA PREPARATION")
        print(f"{'='*80}")
        print(f"Projects to merge: {len(self.source_dirs)}")
        print(f"Output directory: {self.processed_dir}")
        print(f"{'='*80}\n")

        # Process each project
        for idx, source_dir in enumerate(self.source_dirs):
            project_name = source_dir.name
            print(f"\n[{idx+1}/{len(self.source_dirs)}] Processing project: {project_name}")
            print(f"  Source: {source_dir}")

            try:
                # Create individual trainer
                trainer = ClassificationTrainer(
                    source_dir=str(source_dir),
                    output_base_dir=str(self.output_base_dir),
                    namespace=f"{self.namespace}_temp_{project_name}",
                    project_name=project_name
                )

                # Prepare data for this project
                success = trainer.prepare_data(
                    augmentation_count=augmentation_count,
                    negative_samples=negative_samples,
                    force=True
                )

                if not success:
                    print(f"  WARNING: Failed to prepare data for {project_name}")
                    continue

                # Copy positive samples to unified yes/ folder with project prefix
                temp_yes_dir = trainer.processed_dir / "yes"
                if temp_yes_dir.exists():
                    for img_file in temp_yes_dir.glob("*.png"):
                        # Add project prefix to filename
                        new_name = f"{project_name}_{img_file.name}"
                        src = img_file
                        dst = yes_dir / new_name
                        import shutil
                        shutil.copy2(src, dst)
                        total_positive += 1

                # Copy negative samples to unified no/ folder
                temp_no_dir = trainer.processed_dir / "no"
                if temp_no_dir.exists():
                    for img_file in temp_no_dir.glob("*.png"):
                        # Add project prefix to filename to avoid collision
                        new_name = f"{project_name}_{img_file.name}"
                        src = img_file
                        dst = no_dir / new_name
                        import shutil
                        shutil.copy2(src, dst)
                        total_negative += 1

                # Clean up temp directory
                import shutil
                shutil.rmtree(trainer.processed_dir.parent, ignore_errors=True)

                print(f"  OK: Project {project_name} completed")

            except Exception as e:
                print(f"  ERROR: Failed to process {project_name}: {e}")
                import traceback
                traceback.print_exc()
                continue

        print(f"\n{'='*80}")
        print(f"UNIFIED DATASET SUMMARY")
        print(f"{'='*80}")
        print(f"Total positive samples: {total_positive}")
        print(f"Total negative samples: {total_negative}")
        print(f"Output directory: {self.processed_dir}")
        print(f"{'='*80}\n")

        # Check if we got any data
        if total_positive == 0:
            print(f"{'='*80}")
            print(f"ERROR: No positive samples generated")
            print(f"All projects failed to generate data")
            print(f"{'='*80}\n")

            # Clean up empty directory
            import shutil
            if self.processed_dir.exists():
                shutil.rmtree(self.processed_dir, ignore_errors=True)

            return False

        # Save unified metadata
        metadata = {
            'type': 'unified_classification',
            'projects': [d.name for d in self.source_dirs],
            'total_positive_samples': total_positive,
            'total_negative_samples': total_negative,
            'augmentation_count': augmentation_count
        }

        metadata_file = self.processed_dir / "metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        # Open dataset directory in file explorer
        self._open_in_explorer(self.processed_dir)

        return True

    def train(
        self,
        epochs: int = 100,
        batch_size: int = 8,
        imgsz: int = 76,
        device: str = None,
        patience: int = 50,
        name: str = None,
        **kwargs
    ) -> Any:
        """
        Train unified classification model

        Args:
            epochs: Number of training epochs (default: 100)
            batch_size: Batch size
            imgsz: Image size
            device: Device to use ('cpu', 'cuda', etc.). If None, auto-detect best device.
            patience: Early stopping patience (epochs without improvement)
            name: Training run name (default: auto-generated with timestamp)
            **kwargs: Additional training arguments

        Returns:
            Training results
        """
        from ultralytics import YOLO
        from datetime import datetime
        import time

        # Auto-generate name with timestamp if not provided
        if name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            name = f"unified_model_{timestamp}"

        # Statistics: Count existing models before training
        self._print_existing_models_statistics(model_type="classification")

        # Print expected output directory
        expected_output_dir = self.model_output_dir.parent / name
        print(f"\n📂 Expected Output Directory:")
        print(f"   {expected_output_dir}")
        print(f"   Best weights will be saved to:")
        print(f"   {expected_output_dir / 'weights' / 'best.pt'}")

        # Auto-detect device if not specified
        if device is None:
            device_manager = get_device_manager(verbose=True)
            device = device_manager.get_device()
        else:
            # User specified device, skip detection
            print(f"\n📌 Using user-specified device: {device}")

        # Check if data exists
        if not self.processed_dir.exists():
            print("ERROR: Training data not found. Run prepare_data() first.")
            return None

        # Print dataset information (using common utility function)
        source_projects = [d.name for d in self.source_dirs]
        print_dataset_info(
            processed_dir=self.processed_dir,
            namespace=self.namespace,
            project_name=self.project_name,
            source_projects=source_projects
        )

        # Print Ultralytics official recommendations
        print("\n" + "=" * 80)
        print("📚 ULTRALYTICS YOLO OFFICIAL RECOMMENDATIONS (2024)")
        print("=" * 80)
        print("Training Epochs:")
        print("  • Recommended:     300+ epochs (start with 300)")
        print("  • If overfitting:  Reduce epochs or use early stopping")
        print("  • If not:          Train longer (600, 1200+ epochs)")
        print()
        print("Dataset Requirements:")
        print("  • Ideal:           >1500 images/class, >10,000 instances/class")
        print("  • Acceptable:      100-500 images/class (with transfer learning)")
        print("  • Minimum:         100 images/class for classification")
        print("  • Segmentation:    200-300 images/class recommended")
        print()
        print("Best Practices:")
        print("  • Batch size:      Use largest that hardware allows")
        print("  • Early stopping:  patience=50 recommended")
        print("  • Augmentation:    Enabled by default")
        print("  • Data split:      Train 80% / Val 10% / Test 10%")
        print("=" * 80)

        # Print training configuration
        print("\n" + "=" * 80)
        print("UNIFIED CLASSIFICATION TRAINING CONFIGURATION")
        print("=" * 80)
        print(f"Model Type:          YOLOv8n Classification (Unified)")
        print(f"Pre-trained Model:   yolov8n-cls.pt")
        print("-" * 80)
        print(f"Training Device:     {device.upper()}")
        print(f"Epochs:              {epochs} (Ultralytics recommends 300+)")
        print(f"Batch Size:          {batch_size}")
        print(f"Image Size:          {imgsz}x{imgsz}")
        print(f"Early Stopping:      patience={patience}")
        print("-" * 80)
        print(f"Output Directory:    {self.model_output_dir}")
        print("=" * 80 + "\n")

        # Create model output directory
        self.model_output_dir.mkdir(parents=True, exist_ok=True)

        # Load model
        model = YOLO("yolov8n-cls.pt")

        # Train with early stopping
        # Use Ultralytics official structure: project/name
        results = model.train(
            data=str(self.processed_dir),
            epochs=epochs,
            batch=batch_size,
            imgsz=imgsz,
            device=device,
            patience=patience,
            project=str(self.model_output_dir.parent),
            name=name,
            exist_ok=True,
            **kwargs
        )

        # Update model output directory to actual trained location
        actual_output_dir = self.model_output_dir.parent / name

        print(f"\nSUCCESS: Unified classification model trained and saved")
        print(f"  Model directory: {actual_output_dir}")
        print(f"  Best weights:    {actual_output_dir / 'weights' / 'best.pt'}")

        return results

    def _print_existing_models_statistics(self, model_type: str = "classification"):
        """
        Print statistics of existing trained models

        Args:
            model_type: Type of model ("classification" or "detection")
        """
        import time

        models_dir = self.model_output_dir.parent

        if not models_dir.exists():
            print(f"\n📊 Existing {model_type.capitalize()} Models: None")
            print(f"   This will be your first model!")
            return

        # Scan for existing models
        existing_models = []
        for model_dir in models_dir.iterdir():
            if not model_dir.is_dir():
                continue

            best_pt = model_dir / "weights" / "best.pt"
            if best_pt.exists():
                mtime = best_pt.stat().st_mtime
                mtime_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime))
                size_mb = best_pt.stat().st_size / (1024 * 1024)

                existing_models.append({
                    'name': model_dir.name,
                    'path': best_pt,
                    'mtime': mtime,
                    'mtime_str': mtime_str,
                    'size_mb': size_mb
                })

        if not existing_models:
            print(f"\n📊 Existing {model_type.capitalize()} Models: None")
            print(f"   This will be your first model!")
            return

        # Sort by creation time (newest first)
        existing_models.sort(key=lambda x: x['mtime'], reverse=True)

        print(f"\n{'='*80}")
        print(f"📊 Existing {model_type.capitalize()} Models Statistics")
        print(f"{'='*80}")
        print(f"Total models found: {len(existing_models)}")
        print(f"Models directory:   {models_dir}")
        print(f"-" * 80)

        # Print top 5 most recent models
        max_display = min(5, len(existing_models))
        print(f"\nMost recent {max_display} model(s):")

        for idx, model in enumerate(existing_models[:max_display], 1):
            print(f"\n  {idx}. {model['name']}")
            print(f"     Created:  {model['mtime_str']}")
            print(f"     Size:     {model['size_mb']:.2f} MB")
            print(f"     Path:     {model['path']}")

        if len(existing_models) > max_display:
            print(f"\n  ... and {len(existing_models) - max_display} more model(s)")

        print(f"\n{'='*80}\n")

    def _open_in_explorer(self, directory: Path):
        """Open directory in file explorer (cross-platform)"""
        import platform
        import subprocess

        try:
            system = platform.system()
            directory_str = str(directory.absolute())

            if system == "Windows":
                # Windows: use explorer
                subprocess.Popen(['explorer', directory_str])
                print(f"📂 Opened in Explorer: {directory_str}")
            elif system == "Darwin":
                # macOS: use open
                subprocess.Popen(['open', directory_str])
                print(f"📂 Opened in Finder: {directory_str}")
            elif system == "Linux":
                # Linux: try xdg-open (most common)
                subprocess.Popen(['xdg-open', directory_str])
                print(f"📂 Opened in File Manager: {directory_str}")
            else:
                print(f"📂 Dataset directory: {directory_str}")
                print(f"   (Auto-open not supported on {system})")
        except Exception as e:
            print(f"📂 Dataset directory: {directory_str}")
            print(f"   (Could not auto-open: {e})")


class UnifiedDetectionTrainer:
    """
    Train ONE detection model with ALL projects as different classes
    """

    def __init__(
        self,
        source_dirs: List[str],
        output_base_dir: Optional[str] = None,
        namespace: str = "detection",
        project_name: str = "unified_model"
    ):
        """
        Initialize unified detection trainer

        Args:
            source_dirs: List of source directories (one per class)
            output_base_dir: Base output directory
            namespace: Namespace for this training type
            project_name: Unified project name
        """
        self.source_dirs = [Path(d) for d in source_dirs]
        self.namespace = namespace
        self.project_name = project_name
        self.class_names = [d.name for d in self.source_dirs]

        # Use first source dir to infer base paths
        # Path: training_data/1_sources/projects/project_name
        first_source = self.source_dirs[0]
        if output_base_dir is None:
            # Navigate: projects -> 1_sources -> training_data -> 2_datasets
            training_data_dir = first_source.parent.parent.parent
            output_base_dir = training_data_dir / "2_datasets"

        self.output_base_dir = Path(output_base_dir)
        self.processed_dir = self.output_base_dir / namespace / self.project_name

        # Model output directory: training_data -> 3_models
        training_data_dir = first_source.parent.parent.parent
        self.model_output_dir = training_data_dir / "3_models" / namespace / self.project_name

    def prepare_data(
        self,
        num_images: int = 1000,
        force: bool = False
    ) -> bool:
        """
        Prepare unified detection dataset from all projects

        Each project becomes a class in the detection model
        Annotations use class_id to distinguish different objects

        Args:
            num_images: Number of training images per project
            force: Force regeneration even if data exists

        Returns:
            True if successful
        """
        # Check if data exists
        data_yaml = self.processed_dir / "data.yaml"
        has_data = data_yaml.exists()

        if has_data:
            # Check if any source project is auto_generated
            any_auto_generated = False
            for source_dir in self.source_dirs:
                metadata_file = source_dir / "metadata.json"
                if metadata_file.exists():
                    with open(metadata_file, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                    if metadata.get('auto_generated', False):
                        any_auto_generated = True
                        break

            if any_auto_generated:
                # Auto-generated: always delete and regenerate
                print(f"Auto-generated data detected, removing old data: {self.processed_dir}")
                import shutil
                shutil.rmtree(self.processed_dir, ignore_errors=True)
                print(f"Old data removed, will regenerate from source")
            elif not force:
                # Manual data: keep existing unless force=True
                print(f"Unified detection data already exists (auto_generated=False): {self.processed_dir}")
                print(f"Keeping existing data. Use force=True to regenerate.")
                return True
            else:
                # force=True: delete and regenerate
                print(f"Force regeneration requested, removing old data: {self.processed_dir}")
                import shutil
                shutil.rmtree(self.processed_dir, ignore_errors=True)

        # Create output directories
        images_dir = self.processed_dir / "images"
        labels_dir = self.processed_dir / "labels"
        images_dir.mkdir(parents=True, exist_ok=True)
        labels_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n{'='*80}")
        print(f"UNIFIED DETECTION DATA PREPARATION")
        print(f"{'='*80}")
        print(f"Projects to merge: {len(self.source_dirs)}")
        print(f"Class names: {', '.join(self.class_names)}")
        print(f"Output directory: {self.processed_dir}")
        print(f"{'='*80}\n")

        # Store all patches from all projects
        all_patches = []  # List of (class_id, patch_info)
        all_backgrounds = []

        # Process each project
        for class_id, source_dir in enumerate(self.source_dirs):
            project_name = source_dir.name
            print(f"\n[{class_id+1}/{len(self.source_dirs)}] Processing project: {project_name} (class_id={class_id})")

            try:
                # Load metadata
                metadata_file = source_dir / "metadata.json"
                if not metadata_file.exists():
                    print(f"  ERROR: metadata.json not found")
                    continue

                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)

                coordinates = metadata.get('coordinates', [])
                background_image_config = metadata.get('background_images', [])
                patch_image_config = metadata.get('patch_images', [])

                from pycore.pyutils.ultralytics.ultralytics_trainer import process_image_config
                import cv2

                # Mode 1: Coordinate mode - Extract patches from background images
                if coordinates and background_image_config:
                    print(f"  Mode: Coordinate mode")
                    background_images = process_image_config(
                        source_dir, background_image_config, "background images", subdirectory="background_images"
                    )

                    # Extract patches from coordinates
                    for img_path in background_images:
                        img = cv2.imread(str(img_path))
                        if img is None:
                            print(f"  WARNING: Failed to load image: {img_path}")
                            continue

                        all_backgrounds.append(img)

                        # Extract patches
                        for coord in coordinates:
                            x1, y1, x2, y2 = coord['x1'], coord['y1'], coord['x2'], coord['y2']
                            patch = img[y1:y2, x1:x2].copy()
                            if patch.size > 0:
                                all_patches.append({
                                    'class_id': class_id,
                                    'image': patch,
                                    'width': x2 - x1,
                                    'height': y2 - y1
                                })

                    print(f"  OK: Extracted {len([p for p in all_patches if p['class_id']==class_id])} patches from coordinates")

                # Mode 2: Direct patch mode - Use patch images directly
                elif patch_image_config:
                    print(f"  Mode: Direct patch mode")
                    patch_images = process_image_config(
                        source_dir, patch_image_config, "patch images", subdirectory="patch_images"
                    )

                    # Load patch images directly
                    for img_path in patch_images:
                        img = cv2.imread(str(img_path))
                        if img is None:
                            print(f"  WARNING: Failed to load patch: {img_path}")
                            continue

                        h, w = img.shape[:2]
                        all_patches.append({
                            'class_id': class_id,
                            'image': img,
                            'width': w,
                            'height': h
                        })

                    print(f"  OK: Loaded {len([p for p in all_patches if p['class_id']==class_id])} patches directly")

                else:
                    print(f"  SKIP: Project has neither coordinates nor patch_images")
                    continue

            except Exception as e:
                print(f"  ERROR: Failed to process {project_name}: {e}")
                import traceback
                traceback.print_exc()
                continue

        # Check if we have any valid data
        if not all_patches:
            print(f"\n{'='*80}")
            print(f"ERROR: No patches extracted from any project")
            print(f"All projects must have either coordinates or patch_images")
            print(f"{'='*80}\n")

            # Clean up empty directory
            import shutil
            if self.processed_dir.exists():
                shutil.rmtree(self.processed_dir, ignore_errors=True)

            return False

        # Load background images from shared/backgrounds/ directory if none were loaded
        if not all_backgrounds:
            print(f"\nNo background images from projects, loading from shared backgrounds...")
            # Navigate: projects -> 1_sources -> shared/backgrounds
            public_dir = self.source_dirs[0].parent.parent / "shared" / "backgrounds"

            if public_dir.exists():
                import cv2
                for img_path in public_dir.glob("*.png"):
                    img = cv2.imread(str(img_path))
                    if img is not None:
                        all_backgrounds.append(img)

                print(f"  Loaded {len(all_backgrounds)} background images from {public_dir}")

            if not all_backgrounds:
                print(f"\n{'='*80}")
                print(f"ERROR: No background images available")
                print(f"Searched in:")
                print(f"  - Projects with coordinates")
                print(f"  - {public_dir}")
                print(f"{'='*80}\n")

                # Clean up empty directory
                import shutil
                if self.processed_dir.exists():
                    shutil.rmtree(self.processed_dir, ignore_errors=True)

                return False

        # Calculate required images based on metadata.json specifications
        # Each project can specify "min_training_images" in metadata.json
        required_images_per_project = {}
        for source_dir in self.source_dirs:
            metadata_file = source_dir / "metadata.json"
            if metadata_file.exists():
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                    # Check for min_training_images setting
                    min_imgs = metadata.get('min_training_images', 0)
                    if min_imgs > 0:
                        required_images_per_project[source_dir.name] = min_imgs

        # Calculate actual num_images: max of default and sum of all project requirements
        if required_images_per_project:
            total_required = sum(required_images_per_project.values())
            # Use the maximum of: default num_images OR sum of all project requirements
            num_images = max(num_images, total_required)
            print(f"\n📋 Project-specific image requirements:")
            for proj_name, count in required_images_per_project.items():
                print(f"   {proj_name:20s}: {count} images minimum")
            print(f"   Total required:      {total_required} images")
            print(f"   Final target:        {num_images} images")

        # Generate unified training images
        print(f"\nGenerating {num_images} unified training images...")
        print(f"  - Total patches: {len(all_patches)}")
        print(f"  - Total backgrounds: {len(all_backgrounds)}")

        self._generate_unified_images(
            all_patches=all_patches,
            all_backgrounds=all_backgrounds,
            images_dir=images_dir,
            labels_dir=labels_dir,
            num_images=num_images,
            required_images_per_project=required_images_per_project
        )

        # Create data.yaml with multiple classes (only classes with patches)
        valid_class_names = []
        for class_id, class_name in enumerate(self.class_names):
            if any(p['class_id'] == class_id for p in all_patches):
                valid_class_names.append(class_name)

        self._create_data_yaml(valid_class_names)

        print(f"\n{'='*80}")
        print(f"SUCCESS: Unified detection dataset prepared")
        print(f"Total patches: {len(all_patches)}")
        print(f"Valid classes: {len(valid_class_names)} ({', '.join(valid_class_names)})")
        print(f"{'='*80}\n")

        # Open dataset directory in file explorer
        self._open_in_explorer(self.processed_dir)

        return True

    def _generate_unified_images(
        self,
        all_patches: List[Dict],
        all_backgrounds: List,
        images_dir: Path,
        labels_dir: Path,
        num_images: int,
        required_images_per_project: Dict = None
    ):
        """
        Generate training images with intelligent patch distribution

        Strategy:
        1. Calculate how many times each patch should appear: target_per_patch = num_images / total_patches
        2. Ensure minimum appearances for each patch AND per-project requirements
        3. Randomly combine multiple patches from different classes in one image
        4. Use augmentation (scale, position variation) for diversity

        Args:
            all_patches: List of patch dictionaries with 'class_id', 'image', etc.
            all_backgrounds: List of background images
            images_dir: Directory to save generated images
            labels_dir: Directory to save labels
            num_images: Total number of images to generate
            required_images_per_project: Dict mapping project_name -> minimum required images
        """
        import cv2
        import numpy as np

        # Initialize GPU image processor for acceleration
        gpu_processor = get_gpu_processor(verbose=False)  # Don't print during init
        gpu_info = gpu_processor.get_status_info()

        # Calculate target appearances per patch
        total_patches = len(all_patches)
        target_per_patch = max(num_images // total_patches, 1)

        # Calculate optimal patches per image
        # Strategy: Ensure sufficient object density for effective training
        # - Minimum: 3 objects per image (unless total patches < 3)
        # - Maximum: No upper limit! Use all available patches if configured
        # - For small patch counts (<=4): use all patches
        # - For larger patch counts: min=3, max=total_patches (no cap)
        if total_patches <= 4:
            min_patches_per_image = max(1, total_patches)
            max_patches_per_image = total_patches
        else:
            min_patches_per_image = 3
            # No upper limit - if metadata has many patches/coords, use them all
            max_patches_per_image = total_patches

        print(f"\n📊 Image Generation Strategy:")
        print(f"   Target images:        {num_images}")
        print(f"   Total unique patches: {total_patches}")
        print(f"   Target per patch:     {target_per_patch}x")
        print(f"   Available backgrounds: {len(all_backgrounds)}")
        print(f"   Patches per image:    {min_patches_per_image}-{max_patches_per_image}")

        # Print GPU acceleration status
        print(f"\n🚀 GPU Acceleration Status:")
        pytorch_cuda = gpu_info.get('pytorch_cuda_available', False)
        opencv_cuda = gpu_info['cuda_available']

        if pytorch_cuda or opencv_cuda:
            # Show device info
            if gpu_info['device_name']:
                print(f"   GPU Device:           {gpu_info['device_name']}")
                if gpu_info['device_memory_gb']:
                    print(f"   GPU Memory:           {gpu_info['device_memory_gb']:.2f} GB")

            # PyTorch CUDA status
            pytorch_status = "✅ Available" if pytorch_cuda else "❌ Not Available"
            print(f"   PyTorch CUDA:         {pytorch_status}")
            print(f"   - Model Training:     {'GPU' if pytorch_cuda else 'CPU (fallback)'}")

            # OpenCV CUDA status
            opencv_status = "✅ Available" if opencv_cuda else "❌ Not Available"
            print(f"   OpenCV CUDA:          {opencv_status}")
            print(f"   - Image Processing:   {'GPU-accelerated' if opencv_cuda else 'CPU (fallback)'}")
        else:
            print(f"   PyTorch CUDA:         ❌ Not Available")
            print(f"   OpenCV CUDA:          ❌ Not Available")
            print(f"   All operations:       CPU (fallback)")

        # Track patch usage to ensure balanced distribution
        patch_usage_count = [0] * len(all_patches)

        # Track project-level usage (class_id -> count of images containing that class)
        project_image_count = {class_id: 0 for class_id in range(len(self.class_names))}

        # Build mapping: project_name -> class_id
        project_name_to_class_id = {}
        for class_id, class_name in enumerate(self.class_names):
            project_name_to_class_id[class_name] = class_id

        # Build per-project requirements (class_id -> minimum required images)
        project_requirements = {}
        if required_images_per_project:
            for proj_name, required_count in required_images_per_project.items():
                if proj_name in project_name_to_class_id:
                    class_id = project_name_to_class_id[proj_name]
                    project_requirements[class_id] = required_count

        min_usage_target = target_per_patch // 2  # Minimum each patch should appear

        print(f"   Min usage per patch:  {min_usage_target}x")
        print(f"\n🎨 Generating images...")

        for img_idx in range(num_images):
            # Random background
            background = all_backgrounds[np.random.randint(0, len(all_backgrounds))].copy()
            h, w = background.shape[:2]

            annotations = []
            classes_in_this_image = set()

            # Determine number of patches for this image
            # Use min_patches as baseline, with some randomness
            num_patches_in_image = np.random.randint(min_patches_per_image, max_patches_per_image + 1)

            # Ensure we don't exceed available patches
            num_patches_in_image = min(num_patches_in_image, total_patches)

            # Select patches with priority system:
            # 1. Projects that haven't met their minimum requirement
            # 2. Patches that haven't reached minimum usage
            # 3. Random patches to fill remaining slots
            selected_patch_indices = []

            # Priority 1: Projects below their requirement (add 1-3 patches per under-quota project)
            if project_requirements:
                under_quota_projects = [
                    class_id for class_id, required in project_requirements.items()
                    if project_image_count[class_id] < required
                ]
                if under_quota_projects:
                    # Sort by how far below quota (most urgent first)
                    under_quota_projects.sort(key=lambda cid: project_requirements[cid] - project_image_count[cid], reverse=True)

                    # Add patches from under-quota projects
                    for priority_class in under_quota_projects:
                        if len(selected_patch_indices) >= num_patches_in_image:
                            break

                        # Find patches for this project
                        priority_patches = [i for i, p in enumerate(all_patches) if p['class_id'] == priority_class]
                        if priority_patches:
                            # Add 1-3 patches from this under-quota project
                            available = [i for i in priority_patches if i not in selected_patch_indices]
                            if available:
                                num_to_add = min(len(available), np.random.randint(1, 4),
                                               num_patches_in_image - len(selected_patch_indices))
                                selected_patch_indices.extend(np.random.choice(available, num_to_add, replace=False).tolist())

            # Priority 2: Under-used patches (patches below min_usage_target)
            if len(selected_patch_indices) < num_patches_in_image:
                under_used = [i for i, count in enumerate(patch_usage_count) if count < min_usage_target]
                if under_used:
                    # Remove already selected
                    available_under_used = [i for i in under_used if i not in selected_patch_indices]
                    if available_under_used:
                        needed = num_patches_in_image - len(selected_patch_indices)
                        add_count = min(needed, len(available_under_used))
                        selected_patch_indices.extend(np.random.choice(available_under_used, add_count, replace=False).tolist())

            # Priority 3: Fill remaining slots with random patches (for diversity)
            max_attempts = total_patches * 2  # Prevent infinite loop
            attempts = 0
            while len(selected_patch_indices) < num_patches_in_image and attempts < max_attempts:
                idx = np.random.randint(0, total_patches)
                if idx not in selected_patch_indices:
                    selected_patch_indices.append(idx)
                attempts += 1

            # Place each selected patch on the background
            for patch_idx in selected_patch_indices:
                patch_info = all_patches[patch_idx]
                patch = patch_info['image'].copy()
                class_id = patch_info['class_id']

                # Apply random scale (0.8x - 1.2x)
                scale_factor = np.random.uniform(0.8, 1.2)
                new_w = int(patch.shape[1] * scale_factor)
                new_h = int(patch.shape[0] * scale_factor)

                if new_w > 0 and new_h > 0 and new_w < w and new_h < h:
                    # Use GPU-accelerated resize if available
                    patch_resized = gpu_processor.resize(patch, (new_w, new_h))
                else:
                    patch_resized = patch
                    new_h, new_w = patch.shape[:2]

                ph, pw = patch_resized.shape[:2]

                # Skip if patch is too large
                if pw >= w or ph >= h:
                    continue

                # Random position with some margin
                margin_x = max(5, (w - pw) // 10)
                margin_y = max(5, (h - ph) // 10)

                x = np.random.randint(margin_x, max(margin_x + 1, w - pw - margin_x))
                y = np.random.randint(margin_y, max(margin_y + 1, h - ph - margin_y))

                # Paste patch with blending at edges (optional: can add alpha blending)
                background[y:y+ph, x:x+pw] = patch_resized

                # YOLO annotation (normalized) with class_id
                center_x = (x + pw / 2) / w
                center_y = (y + ph / 2) / h
                norm_width = pw / w
                norm_height = ph / h

                annotations.append(f"{class_id} {center_x:.6f} {center_y:.6f} {norm_width:.6f} {norm_height:.6f}")

                # Track usage
                patch_usage_count[patch_idx] += 1
                classes_in_this_image.add(class_id)

            # Update project-level image counts
            for class_id in classes_in_this_image:
                project_image_count[class_id] += 1

            # Resize image to 640x640 (YOLO standard size)
            # This ensures consistent training and reduces file size
            target_size = 640
            h_orig, w_orig = background.shape[:2]

            # Calculate scaling to fit in 640x640 while maintaining aspect ratio
            scale = min(target_size / w_orig, target_size / h_orig)
            new_w = int(w_orig * scale)
            new_h = int(h_orig * scale)

            # Resize background using GPU if available
            if new_w != w_orig or new_h != h_orig:
                background_resized = gpu_processor.resize(background, (new_w, new_h), interpolation=cv2.INTER_AREA)
            else:
                background_resized = background

            # Create 640x640 canvas with padding (letterbox)
            canvas = np.zeros((target_size, target_size, 3), dtype=np.uint8)
            # Calculate padding
            pad_x = (target_size - new_w) // 2
            pad_y = (target_size - new_h) // 2
            # Place resized image on canvas
            canvas[pad_y:pad_y+new_h, pad_x:pad_x+new_w] = background_resized

            # Adjust annotations for resized + padded image
            adjusted_annotations = []
            for ann in annotations:
                parts = ann.split()
                class_id = parts[0]
                center_x = float(parts[1])
                center_y = float(parts[2])
                box_w = float(parts[3])
                box_h = float(parts[4])

                # Convert from original image coordinates to resized coordinates
                # Original coordinates are normalized (0-1), convert to pixels
                abs_center_x = center_x * w_orig
                abs_center_y = center_y * h_orig
                abs_box_w = box_w * w_orig
                abs_box_h = box_h * h_orig

                # Apply scaling
                new_center_x = abs_center_x * scale + pad_x
                new_center_y = abs_center_y * scale + pad_y
                new_box_w = abs_box_w * scale
                new_box_h = abs_box_h * scale

                # Normalize to target canvas size
                norm_center_x = new_center_x / target_size
                norm_center_y = new_center_y / target_size
                norm_box_w = new_box_w / target_size
                norm_box_h = new_box_h / target_size

                adjusted_annotations.append(
                    f"{class_id} {norm_center_x:.6f} {norm_center_y:.6f} {norm_box_w:.6f} {norm_box_h:.6f}"
                )

            # Save image with optimized compression
            # PNG compression level 3 provides good balance (9 is TOO SLOW!)
            # Level 3: ~30% faster than level 9, only ~5-10% larger files
            cv2.imwrite(
                str(images_dir / f"train_{img_idx:04d}.png"),
                canvas,
                [cv2.IMWRITE_PNG_COMPRESSION, 3]
            )

            with open(labels_dir / f"train_{img_idx:04d}.txt", 'w') as f:
                f.write('\n'.join(adjusted_annotations))

            # Progress indicator
            if (img_idx + 1) % 100 == 0:
                print(f"   Generated {img_idx + 1}/{num_images} images...")

        # Print final usage statistics
        print(f"\n✅ Generation complete!")
        print(f"\n📈 Patch Usage Statistics:")
        for idx, count in enumerate(patch_usage_count):
            patch_info = all_patches[idx]
            class_id = patch_info['class_id']
            class_name = self.class_names[class_id]
            print(f"   {class_name:20s}: {count:4d}x (target: {target_per_patch}x)")

        # Print per-project image counts
        if project_requirements:
            print(f"\n📋 Project Requirements vs Actual:")
            for class_id, required in project_requirements.items():
                actual = project_image_count[class_id]
                class_name = self.class_names[class_id]
                status = "✅" if actual >= required else "⚠️"
                print(f"   {status} {class_name:20s}: {actual:4d} images (required: {required})")
        else:
            print(f"\n📋 Images per Project:")
            for class_id, count in sorted(project_image_count.items()):
                if count > 0:
                    class_name = self.class_names[class_id]
                    print(f"   {class_name:20s}: {count:4d} images")

    def _create_data_yaml(self, valid_class_names=None):
        """Create data.yaml for YOLO training with multiple classes"""
        if valid_class_names is None:
            valid_class_names = self.class_names

        data_yaml = {
            'path': str(self.processed_dir.absolute()),
            'train': 'images',
            'val': 'images',
            'nc': len(valid_class_names),
            'names': valid_class_names
        }

        yaml_file = self.processed_dir / "data.yaml"
        with open(yaml_file, 'w', encoding='utf-8') as f:
            for key, value in data_yaml.items():
                if isinstance(value, list):
                    f.write(f"{key}: {value}\n")
                else:
                    f.write(f"{key}: {value}\n")

    def _open_in_explorer(self, directory: Path):
        """Open directory in file explorer (cross-platform)"""
        import platform
        import subprocess

        try:
            system = platform.system()
            directory_str = str(directory.absolute())

            if system == "Windows":
                # Windows: use explorer
                subprocess.Popen(['explorer', directory_str])
                print(f"📂 Opened in Explorer: {directory_str}")
            elif system == "Darwin":
                # macOS: use open
                subprocess.Popen(['open', directory_str])
                print(f"📂 Opened in Finder: {directory_str}")
            elif system == "Linux":
                # Linux: try xdg-open (most common)
                subprocess.Popen(['xdg-open', directory_str])
                print(f"📂 Opened in File Manager: {directory_str}")
            else:
                print(f"📂 Dataset directory: {directory_str}")
                print(f"   (Auto-open not supported on {system})")
        except Exception as e:
            print(f"📂 Dataset directory: {directory_str}")
            print(f"   (Could not auto-open: {e})")

    def train(
        self,
        epochs: int = 100,
        batch_size: int = 16,
        imgsz: int = 640,
        device: str = None,
        patience: int = 50,
        name: str = None,
        **kwargs
    ) -> Any:
        """
        Train unified detection model

        Args:
            epochs: Number of training epochs (default: 100)
            batch_size: Batch size
            imgsz: Image size
            device: Device to use ('cpu', 'cuda', etc.). If None, auto-detect best device.
            patience: Early stopping patience (epochs without improvement)
            name: Training run name (default: auto-generated with timestamp)
            **kwargs: Additional training arguments

        Returns:
            Training results
        """
        from ultralytics import YOLO
        from datetime import datetime

        # Auto-generate name with timestamp if not provided
        if name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            name = f"unified_model_{timestamp}"

        # Statistics: Count existing models before training
        self._print_existing_models_statistics(model_type="detection")

        # Print expected output directory
        expected_output_dir = self.model_output_dir.parent / name
        print(f"\n📂 Expected Output Directory:")
        print(f"   {expected_output_dir}")
        print(f"   Best weights will be saved to:")
        print(f"   {expected_output_dir / 'weights' / 'best.pt'}")

        # Auto-detect device if not specified
        if device is None:
            device_manager = get_device_manager(verbose=True)
            device = device_manager.get_device()
        else:
            # User specified device, skip detection
            print(f"\n📌 Using user-specified device: {device}")

        # Check if data exists
        data_yaml = self.processed_dir / "data.yaml"
        if not data_yaml.exists():
            print("ERROR: Training data not found. Run prepare_data() first.")
            return None

        # Print dataset information (using common utility function)
        source_projects = [d.name for d in self.source_dirs]
        print_dataset_info(
            processed_dir=self.processed_dir,
            namespace=self.namespace,
            project_name=self.project_name,
            source_projects=source_projects
        )

        # Print Ultralytics official recommendations
        print("\n" + "=" * 80)
        print("📚 ULTRALYTICS YOLO OFFICIAL RECOMMENDATIONS (2024)")
        print("=" * 80)
        print("Training Epochs:")
        print("  • Recommended:     300+ epochs (start with 300)")
        print("  • If overfitting:  Reduce epochs or use early stopping")
        print("  • If not:          Train longer (600, 1200+ epochs)")
        print()
        print("Dataset Requirements:")
        print("  • Ideal:           >1500 images/class, >10,000 instances/class")
        print("  • Acceptable:      100-500 images/class (with transfer learning)")
        print("  • Minimum:         100 images/class for single-class detection")
        print()
        print("Best Practices:")
        print("  • Image size:      640x640 (standard for detection)")
        print("  • Batch size:      Use largest that hardware allows")
        print("  • Early stopping:  patience=50 recommended")
        print("  • Augmentation:    Enabled by default")
        print("=" * 80)

        # Print training configuration
        print("\n" + "=" * 80)
        print("UNIFIED DETECTION TRAINING CONFIGURATION")
        print("=" * 80)
        print(f"Model Type:          YOLOv8n Detection (Unified)")
        print(f"Pre-trained Model:   yolov8n.pt")
        print("-" * 80)
        print(f"Training Device:     {device.upper()}")
        print(f"Epochs:              {epochs} (Ultralytics recommends 300+)")
        print(f"Batch Size:          {batch_size}")
        print(f"Image Size:          {imgsz}x{imgsz}")
        print(f"Early Stopping:      patience={patience}")
        print("-" * 80)
        print(f"Output Directory:    {self.model_output_dir}")
        print("=" * 80 + "\n")

        # Create model output directory
        self.model_output_dir.mkdir(parents=True, exist_ok=True)

        # Load model
        model = YOLO("yolov8n.pt")

        # Train with early stopping
        # Use Ultralytics official structure: project/name
        results = model.train(
            data=str(data_yaml),
            epochs=epochs,
            batch=batch_size,
            imgsz=imgsz,
            device=device,
            patience=patience,
            project=str(self.model_output_dir.parent),
            name=name,
            exist_ok=True,
            **kwargs
        )

        # Update model output directory to actual trained location
        actual_output_dir = self.model_output_dir.parent / name

        print(f"\nSUCCESS: Unified detection model trained and saved")
        print(f"  Model directory: {actual_output_dir}")
        print(f"  Best weights:    {actual_output_dir / 'weights' / 'best.pt'}")

        return results

    def _print_existing_models_statistics(self, model_type: str = "detection"):
        """
        Print statistics of existing trained models

        Args:
            model_type: Type of model ("classification" or "detection")
        """
        import time

        models_dir = self.model_output_dir.parent

        if not models_dir.exists():
            print(f"\n📊 Existing {model_type.capitalize()} Models: None")
            print(f"   This will be your first model!")
            return

        # Scan for existing models
        existing_models = []
        for model_dir in models_dir.iterdir():
            if not model_dir.is_dir():
                continue

            best_pt = model_dir / "weights" / "best.pt"
            if best_pt.exists():
                mtime = best_pt.stat().st_mtime
                mtime_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime))
                size_mb = best_pt.stat().st_size / (1024 * 1024)

                existing_models.append({
                    'name': model_dir.name,
                    'path': best_pt,
                    'mtime': mtime,
                    'mtime_str': mtime_str,
                    'size_mb': size_mb
                })

        if not existing_models:
            print(f"\n📊 Existing {model_type.capitalize()} Models: None")
            print(f"   This will be your first model!")
            return

        # Sort by creation time (newest first)
        existing_models.sort(key=lambda x: x['mtime'], reverse=True)

        print(f"\n{'='*80}")
        print(f"📊 Existing {model_type.capitalize()} Models Statistics")
        print(f"{'='*80}")
        print(f"Total models found: {len(existing_models)}")
        print(f"Models directory:   {models_dir}")
        print(f"-" * 80)

        # Print top 5 most recent models
        max_display = min(5, len(existing_models))
        print(f"\nMost recent {max_display} model(s):")

        for idx, model in enumerate(existing_models[:max_display], 1):
            print(f"\n  {idx}. {model['name']}")
            print(f"     Created:  {model['mtime_str']}")
            print(f"     Size:     {model['size_mb']:.2f} MB")
            print(f"     Path:     {model['path']}")

        if len(existing_models) > max_display:
            print(f"\n  ... and {len(existing_models) - max_display} more model(s)")

        print(f"\n{'='*80}\n")
