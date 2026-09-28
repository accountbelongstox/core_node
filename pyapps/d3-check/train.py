#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Training Entry Point
Interactive menu or CLI for training classification or detection models
"""

import os
import sys
import argparse
from pathlib import Path

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from controller.training import D3CheckTrainingController


def train_classification(**kwargs):
    """Train unified classification model (ALL projects in ONE model)"""
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("Training Unified Classification Model")
    ColorPrint.blue("=" * 80)

    try:
        controller = D3CheckTrainingController()
        results = controller.train_unified_classification(**kwargs)

        if results:
            ColorPrint.green("\nSUCCESS: Unified classification model trained")
            return 0
        else:
            ColorPrint.red("\nFAILED: Classification training failed")
            return 1

    except Exception as e:
        ColorPrint.red(f"\nERROR: Classification training failed: {e}")
        return 1


def train_detection(**kwargs):
    """Train unified detection model (ALL projects as different classes in ONE model)"""
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("Training Unified Detection Model")
    ColorPrint.blue("=" * 80)

    try:
        controller = D3CheckTrainingController()
        results = controller.train_unified_detection(**kwargs)

        if results:
            ColorPrint.green("\nSUCCESS: Unified detection model trained")
            return 0
        else:
            ColorPrint.red("\nFAILED: Detection training failed")
            return 1

    except Exception as e:
        ColorPrint.red(f"\nERROR: Detection training failed: {e}")
        return 1


def train_both(**kwargs):
    """Train both unified classification and detection models"""
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("Training All Unified Models")
    ColorPrint.blue("=" * 80)

    # Train classification
    ColorPrint.blue("\nStep 1/2: Training Unified Classification Model")
    ColorPrint.blue("=" * 80)

    result1 = train_classification(**kwargs)

    if result1 != 0:
        ColorPrint.red("\nERROR: Classification training failed, stopping")
        return 1

    ColorPrint.green("\nOK: Unified classification model completed")

    # Train detection
    ColorPrint.blue("\nStep 2/2: Training Unified Detection Model")
    ColorPrint.blue("=" * 80)

    result2 = train_detection(**kwargs)

    if result2 != 0:
        ColorPrint.yellow("\nWARNING: Detection training failed, but classification succeeded")
        return 1

    ColorPrint.green("\nSUCCESS: All unified models trained")
    return 0


def show_menu():
    """Display training menu"""
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("D3-Check Training System")
    ColorPrint.blue("=" * 80)

    ColorPrint.green("\nSelect training mode:")
    ColorPrint.green("\n1. Train Classification Model (small images)")
    ColorPrint.green("   - Train on cropped patches (yes/no binary classification)")
    ColorPrint.green("   - Works with both coordinate mode and direct patch mode")
    ColorPrint.green("   - Good for fixed-size UI elements")

    ColorPrint.green("\n2. Train Detection Model (large images)")
    ColorPrint.green("   - Multi-class object detection")
    ColorPrint.green("   - Requires projects with coordinates (skips direct patch mode)")
    ColorPrint.green("   - Good for multi-scale, real-time detection")

    ColorPrint.green("\n3. Train Both Models")

    ColorPrint.green("\n0. Exit")

    ColorPrint.blue("\n" + "=" * 80)


def interactive_mode():
    """Interactive menu mode"""
    controller = D3CheckTrainingController()
    projects = controller.list_projects()

    if not projects:
        ColorPrint.red("ERROR: No projects found in source directory")
        ColorPrint.yellow(f"Expected: {controller.source_base_dir}")
        return 1

    ColorPrint.green(f"\nAvailable projects: {', '.join(projects)}")
    ColorPrint.green(f"Will train ONE unified model with ALL {len(projects)} projects")

    while True:
        show_menu()

        try:
            choice = input("\nEnter option (0-3): ").strip()
        except (KeyboardInterrupt, EOFError):
            ColorPrint.yellow("\nSee you every day!")
            return 0

        if choice == '0':
            ColorPrint.yellow("\nSee you every day!")
            return 0

        elif choice == '1':
            result = train_classification()
            if result == 0:
                ColorPrint.green("\nOK: Unified classification model trained")
            else:
                ColorPrint.red("\nFAILED: Classification training failed")
            input("\nPress Enter to continue...")

        elif choice == '2':
            result = train_detection()
            if result == 0:
                ColorPrint.green("\nOK: Unified detection model trained")
            else:
                ColorPrint.red("\nFAILED: Detection training failed")
            input("\nPress Enter to continue...")

        elif choice == '3':
            result = train_both()
            if result == 0:
                ColorPrint.green("\nOK: All unified models trained")
            else:
                ColorPrint.yellow("\nWARNING: Some models failed")
            input("\nPress Enter to continue...")
            ColorPrint.green(f"\n{'='*80}")
            ColorPrint.green(f"[SUCCESS] Training completed: {project['name']}")
            ColorPrint.green(f"{'='*80}")
            ColorPrint.green(f"[MODEL] Model saved: {best_model_dst.relative_to(self.controller.project_root)}")
            ColorPrint.green(f"[METADATA] Metadata saved: {metadata_file.relative_to(self.controller.project_root)}")
            return True
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
    parser = argparse.ArgumentParser(description="D3-Check Training System")
    parser.add_argument(
        '--mode',
        choices=['classification', 'detection', 'both'],
        help='Training mode (bypasses menu)'
    )
    parser.add_argument(
        '--epochs',
        type=int,
        default=100,
        help='Number of training epochs (default: 100)'
    )
    parser.add_argument(
        '--batch',
        type=int,
        help='Batch size (default: 8 for classification, 16 for detection)'
    )
    parser.add_argument(
        '--device',
        default='cpu',
        help='Device to use (default: cpu)'
    )

    args = parser.parse_args()

    # Build training kwargs
    train_kwargs = {
        'epochs': args.epochs,
        'device': args.device,
    }
    if args.batch:
        train_kwargs['batch_size'] = args.batch

    # CLI mode - bypass menu
    if args.mode:
        if args.mode == 'classification':
            return train_classification(**train_kwargs)
        elif args.mode == 'detection':
            return train_detection(**train_kwargs)
        elif args.mode == 'both':
            return train_both(**train_kwargs)

    # Interactive mode
    return interactive_mode()


if __name__ == "__main__":
    sys.exit(main())
