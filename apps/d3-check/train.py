#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 Check Training Script
Handles YOLO model training for UI detection
"""

import os
import sys
from pathlib import Path

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = current_dir

sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint, UltralyticsTrainer, TrainingConfig

def train_d3_ui_detector(
    config_path: str = "config/training/d3_ui_training.yaml",
    device: str = "cpu",
    epochs: int = None,
    batch: int = None,
    resume: bool = False
):
    """
    Train D3 UI detector model

    Args:
        config_path: Path to training config file
        device: Device to use ('cpu', 'cuda', '0', '0,1,2,3')
        epochs: Override epochs from config
        batch: Override batch size from config
        resume: Resume from last checkpoint
    """
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("🎮 D3 UI Detector Training")
    ColorPrint.blue("=" * 80)

    config_path = Path(project_root) / config_path

    if not config_path.exists():
        ColorPrint.red(f"❌ Config file not found: {config_path}")
        ColorPrint.yellow("📝 Creating default config...")
        config_path.parent.mkdir(parents=True, exist_ok=True)
        ColorPrint.green(f"✅ Config created: {config_path}")

    # Load trainer
    try:
        trainer = UltralyticsTrainer(config_path)

        # Override parameters if provided
        if device:
            trainer.config.device = device
        if epochs is not None:
            trainer.config.epochs = epochs
        if batch is not None:
            trainer.config.batch = batch
        if resume:
            trainer.config.resume = resume

        # Update data path to absolute
        dataset_path = Path(project_root) / "config" / "datasets" / "d3_ui"
        data_yaml = dataset_path / "data.yaml"

        if not data_yaml.exists():
            ColorPrint.red(f"❌ Dataset config not found: {data_yaml}")
            ColorPrint.yellow("📝 Please prepare your dataset first")
            ColorPrint.yellow(f"   Dataset should be at: {dataset_path}")
            return None

        trainer.config.data = str(data_yaml)

        # Set project path relative to d3-check
        trainer.config.project = str(Path(project_root) / "training" / "runs")

        # Train
        results = trainer.train(verbose=True)

        # Print results
        ColorPrint.green("\n" + "=" * 80)
        ColorPrint.green("✅ Training completed!")
        ColorPrint.green("=" * 80)

        # Print model location
        best_model = Path(trainer.config.project) / trainer.config.name / "weights" / "best.pt"
        if best_model.exists():
            ColorPrint.green(f"\n📦 Best model saved to:")
            ColorPrint.green(f"   {best_model}")

            # Copy to models directory for easy access
            models_dir = Path(project_root) / "config" / "models"
            models_dir.mkdir(parents=True, exist_ok=True)
            import shutil
            shutil.copy(best_model, models_dir / "d3_ui_detector.pt")
            ColorPrint.green(f"\n📋 Model copied to:")
            ColorPrint.green(f"   {models_dir / 'd3_ui_detector.pt'}")

        return results

    except Exception as e:
        ColorPrint.red(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def validate_d3_ui_detector(
    model_path: str = "config/models/d3_ui_detector.pt",
    data_path: str = "config/datasets/d3_ui/data.yaml",
    split: str = "val"
):
    """
    Validate trained model

    Args:
        model_path: Path to trained model
        data_path: Path to dataset config
        split: Dataset split ('val', 'test')
    """
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("🔍 Validating D3 UI Detector")
    ColorPrint.blue("=" * 80)

    model_path = Path(project_root) / model_path
    data_path = Path(project_root) / data_path

    if not model_path.exists():
        ColorPrint.red(f"❌ Model not found: {model_path}")
        return None

    if not data_path.exists():
        ColorPrint.red(f"❌ Dataset config not found: {data_path}")
        return None

    try:
        # Create trainer with dummy config (just to load model)
        config = TrainingConfig(
            data=str(data_path),
            model=str(model_path)
        )
        trainer = UltralyticsTrainer(config)
        trainer.load_checkpoint(model_path)

        # Validate
        results = trainer.validate(data=str(data_path), split=split)

        ColorPrint.green("\n✅ Validation completed")
        return results

    except Exception as e:
        ColorPrint.red(f"\n❌ Validation failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def export_d3_ui_detector(
    model_path: str = "config/models/d3_ui_detector.pt",
    format: str = "onnx"
):
    """
    Export trained model

    Args:
        model_path: Path to trained model
        format: Export format ('onnx', 'torchscript', 'tflite', etc.)
    """
    ColorPrint.blue(f"\n📤 Exporting model to {format.upper()}...")

    model_path = Path(project_root) / model_path

    if not model_path.exists():
        ColorPrint.red(f"❌ Model not found: {model_path}")
        return None

    try:
        config = TrainingConfig(
            data="dummy.yaml",  # Not used for export
            model=str(model_path)
        )
        trainer = UltralyticsTrainer(config)
        trainer.load_checkpoint(model_path)

        export_path = trainer.export(format=format)

        ColorPrint.green(f"\n✅ Model exported: {export_path}")
        return export_path

    except Exception as e:
        ColorPrint.red(f"\n❌ Export failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Main entry point for training script"""
    import argparse

    parser = argparse.ArgumentParser(
        description="D3 UI Detector Training",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python train.py --action train                       # Train model
  python train.py --action train --device cuda         # Train on GPU
  python train.py --action train --epochs 200          # Train with 200 epochs
  python train.py --action validate                    # Validate model
  python train.py --action export --format onnx        # Export to ONNX
        """
    )

    parser.add_argument("--action", type=str, default="train", choices=["train", "validate", "export"],
                        help="Action to perform")
    parser.add_argument("--config", type=str, default="config/training/d3_ui_training.yaml",
                        help="Path to training config")
    parser.add_argument("--model", type=str, default="config/models/d3_ui_detector.pt",
                        help="Path to model (for validate/export)")
    parser.add_argument("--device", type=str, default="cpu",
                        help="Device to use (cpu, cuda, 0, 0,1,2,3)")
    parser.add_argument("--epochs", type=int, default=None,
                        help="Number of epochs (override config)")
    parser.add_argument("--batch", type=int, default=None,
                        help="Batch size (override config)")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from last checkpoint")
    parser.add_argument("--format", type=str, default="onnx",
                        help="Export format (for export action)")

    args = parser.parse_args()

    if args.action == "train":
        result = train_d3_ui_detector(
            config_path=args.config,
            device=args.device,
            epochs=args.epochs,
            batch=args.batch,
            resume=args.resume
        )
        return 0 if result else 1
    elif args.action == "validate":
        result = validate_d3_ui_detector(model_path=args.model)
        return 0 if result else 1
    elif args.action == "export":
        result = export_d3_ui_detector(model_path=args.model, format=args.format)
        return 0 if result else 1

if __name__ == "__main__":
    sys.exit(main())

