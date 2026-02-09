#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Directory Structure Migration Script
Migrates from old structure to new 3-layer architecture
"""

import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime

# Add project root to path (when run from scripts/, root is parent)
_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_current_dir) if os.path.basename(_current_dir) == "scripts" else _current_dir
sys.path.insert(0, _project_root)

from pycore.pyfoundations.color_print import ColorPrint


class StructureMigration:
    """Migrate training data structure to new 3-layer architecture"""

    def __init__(self, dry_run=True):
        """
        Initialize migration

        Args:
            dry_run: If True, only print actions without executing
        """
        self.dry_run = dry_run
        self.project_root = Path(_project_root)
        self.old_training_data = self.project_root / ".cache" / "training_data"
        self.backup_dir = self.project_root / ".cache" / f"training_data_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # New structure paths
        self.new_training_data = self.old_training_data
        self.sources_dir = self.new_training_data / "1_sources"
        self.datasets_dir = self.new_training_data / "2_datasets"
        self.models_dir = self.new_training_data / "3_models"

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Directory Structure Migration")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will modify files)'}")
        ColorPrint.green(f"Old structure: {self.old_training_data}")
        ColorPrint.green(f"Backup location: {self.backup_dir}")

    def backup_old_structure(self):
        """Create backup of old structure"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Step 1: Backup Old Structure")
        ColorPrint.blue(f"{'='*80}")

        if self.dry_run:
            ColorPrint.yellow("[DRY RUN] Would create backup at:")
            ColorPrint.yellow(f"  {self.backup_dir}")
            return True

        try:
            if self.backup_dir.exists():
                ColorPrint.yellow(f"Backup already exists: {self.backup_dir}")
                return True

            ColorPrint.green("Creating backup...")
            shutil.copytree(self.old_training_data, self.backup_dir)
            ColorPrint.green(f"✓ Backup created: {self.backup_dir}")
            return True
        except Exception as e:
            ColorPrint.red(f"✗ Backup failed: {e}")
            return False

    def create_new_directories(self):
        """Create new directory structure"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Step 2: Create New Directory Structure")
        ColorPrint.blue(f"{'='*80}")

        new_dirs = [
            self.sources_dir / "projects",
            self.sources_dir / "shared" / "backgrounds",
            self.datasets_dir / "classification",
            self.datasets_dir / "detection",
            self.models_dir / "classification",
            self.models_dir / "detection",
        ]

        for new_dir in new_dirs:
            if self.dry_run:
                ColorPrint.yellow(f"[DRY RUN] Would create: {new_dir}")
            else:
                new_dir.mkdir(parents=True, exist_ok=True)
                ColorPrint.green(f"✓ Created: {new_dir}")

        return True

    def migrate_source_projects(self):
        """Migrate source/training_projects to 1_sources/projects"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Step 3: Migrate Source Projects")
        ColorPrint.blue(f"{'='*80}")

        old_projects_dir = self.old_training_data / "source" / "training_projects"

        if not old_projects_dir.exists():
            ColorPrint.yellow(f"Source projects directory not found: {old_projects_dir}")
            return True

        projects = ["cancel_button", "confirm_button", "rift_progress_bar", "team_hp_bar"]

        for project in projects:
            old_project_dir = old_projects_dir / project
            if not old_project_dir.exists():
                ColorPrint.yellow(f"Project not found: {project}")
                continue

            new_project_dir = self.sources_dir / "projects" / project

            if self.dry_run:
                ColorPrint.yellow(f"[DRY RUN] Would migrate project: {project}")
                ColorPrint.yellow(f"  From: {old_project_dir}")
                ColorPrint.yellow(f"  To:   {new_project_dir}")

                # Show what would be reorganized
                ColorPrint.yellow(f"  Would create: {new_project_dir / 'patch_images'}")
                for file in old_project_dir.glob("*.png"):
                    ColorPrint.yellow(f"    Move: {file.name} -> patch_images/{file.name}")
            else:
                # Create patch_images subdirectory
                patch_dir = new_project_dir / "patch_images"
                patch_dir.mkdir(parents=True, exist_ok=True)

                # Move PNG files to patch_images
                for file in old_project_dir.glob("*.png"):
                    shutil.move(str(file), str(patch_dir / file.name))
                    ColorPrint.green(f"  ✓ Moved: {file.name} -> patch_images/")

                # Remove old metadata.json (will be replaced by training_config.json)
                old_metadata = old_project_dir / "metadata.json"
                if old_metadata.exists():
                    old_metadata.unlink()
                    ColorPrint.green(f"  ✓ Removed: metadata.json (migrated to training_config.json)")

                # Remove empty old directory
                if old_project_dir.exists() and not any(old_project_dir.iterdir()):
                    old_project_dir.rmdir()

                ColorPrint.green(f"✓ Migrated: {project}")

        # Remove old training_projects directory if empty
        if not self.dry_run and old_projects_dir.exists():
            try:
                old_projects_dir.rmdir()
                ColorPrint.green(f"✓ Removed empty directory: training_projects")
            except OSError:
                ColorPrint.yellow(f"Directory not empty, keeping: training_projects")

        return True

    def migrate_shared_backgrounds(self):
        """Migrate source/public to 1_sources/shared/backgrounds"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Step 4: Migrate Shared Backgrounds")
        ColorPrint.blue(f"{'='*80}")

        old_public_dir = self.old_training_data / "source" / "public"

        if not old_public_dir.exists():
            ColorPrint.yellow(f"Public directory not found: {old_public_dir}")
            return True

        new_backgrounds_dir = self.sources_dir / "shared" / "backgrounds"

        if self.dry_run:
            ColorPrint.yellow(f"[DRY RUN] Would migrate backgrounds:")
            ColorPrint.yellow(f"  From: {old_public_dir}")
            ColorPrint.yellow(f"  To:   {new_backgrounds_dir}")
            for bg_file in old_public_dir.glob("*.png"):
                ColorPrint.yellow(f"    Move: {bg_file.name}")
        else:
            count = 0
            for bg_file in old_public_dir.glob("*.png"):
                shutil.move(str(bg_file), str(new_backgrounds_dir / bg_file.name))
                count += 1

            ColorPrint.green(f"✓ Migrated {count} background images")

            # Remove old public directory if empty
            if old_public_dir.exists() and not any(old_public_dir.iterdir()):
                old_public_dir.rmdir()
                ColorPrint.green(f"✓ Removed empty directory: public")

        return True

    def migrate_datasets(self):
        """Migrate processed datasets to 2_datasets"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Step 5: Migrate Processed Datasets")
        ColorPrint.blue(f"{'='*80}")

        old_processed_dir = self.old_training_data / "source" / "processed"

        if not old_processed_dir.exists():
            ColorPrint.yellow(f"Processed directory not found: {old_processed_dir}")
            return True

        # Migrate detection dataset
        old_detection = old_processed_dir / "detection" / "d3check_unified"
        if old_detection.exists():
            new_detection = self.datasets_dir / "detection" / "unified_model"

            if self.dry_run:
                ColorPrint.yellow(f"[DRY RUN] Would migrate detection dataset:")
                ColorPrint.yellow(f"  From: {old_detection}")
                ColorPrint.yellow(f"  To:   {new_detection}")
            else:
                if new_detection.exists():
                    shutil.rmtree(new_detection)
                shutil.move(str(old_detection), str(new_detection))
                ColorPrint.green(f"✓ Migrated detection dataset: unified_model")

        # Migrate classification dataset (if exists)
        old_classification = old_processed_dir / "classification" / "d3check_unified"
        if old_classification.exists():
            new_classification = self.datasets_dir / "classification" / "unified_model"

            if self.dry_run:
                ColorPrint.yellow(f"[DRY RUN] Would migrate classification dataset:")
                ColorPrint.yellow(f"  From: {old_classification}")
                ColorPrint.yellow(f"  To:   {new_classification}")
            else:
                if new_classification.exists():
                    shutil.rmtree(new_classification)
                shutil.move(str(old_classification), str(new_classification))
                ColorPrint.green(f"✓ Migrated classification dataset: unified_model")

        return True

    def migrate_models(self):
        """Migrate trained models to 3_models"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Step 6: Migrate Trained Models")
        ColorPrint.blue(f"{'='*80}")

        old_models_dir = self.old_training_data / "d4_modules"

        if not old_models_dir.exists():
            ColorPrint.yellow(f"Models directory not found: {old_models_dir}")
            return True

        # Migrate detection model
        old_detection_model = old_models_dir / "detection" / "d3check_unified"
        if old_detection_model.exists():
            new_detection_model = self.models_dir / "detection" / "unified_model"

            if self.dry_run:
                ColorPrint.yellow(f"[DRY RUN] Would migrate detection model:")
                ColorPrint.yellow(f"  From: {old_detection_model}")
                ColorPrint.yellow(f"  To:   {new_detection_model}")
            else:
                if new_detection_model.exists():
                    shutil.rmtree(new_detection_model)
                shutil.move(str(old_detection_model), str(new_detection_model))
                ColorPrint.green(f"✓ Migrated detection model: unified_model")

        # Migrate classification model (if exists)
        old_classification_model = old_models_dir / "classification" / "d3check_unified"
        if old_classification_model.exists():
            new_classification_model = self.models_dir / "classification" / "unified_model"

            if self.dry_run:
                ColorPrint.yellow(f"[DRY RUN] Would migrate classification model:")
                ColorPrint.yellow(f"  From: {old_classification_model}")
                ColorPrint.yellow(f"  To:   {new_classification_model}")
            else:
                if new_classification_model.exists():
                    shutil.rmtree(new_classification_model)
                shutil.move(str(old_classification_model), str(new_classification_model))
                ColorPrint.green(f"✓ Migrated classification model: unified_model")

        return True

    def cleanup_old_structure(self):
        """Clean up old empty directories"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Step 7: Cleanup Old Structure")
        ColorPrint.blue(f"{'='*80}")

        old_dirs = [
            self.old_training_data / "source" / "processed",
            self.old_training_data / "source",
            self.old_training_data / "d4_modules",
        ]

        for old_dir in old_dirs:
            if not old_dir.exists():
                continue

            if self.dry_run:
                ColorPrint.yellow(f"[DRY RUN] Would check and remove if empty: {old_dir}")
            else:
                try:
                    # Remove directory only if empty
                    if old_dir.exists() and not any(old_dir.rglob("*")):
                        shutil.rmtree(old_dir)
                        ColorPrint.green(f"✓ Removed empty directory: {old_dir.name}")
                    else:
                        ColorPrint.yellow(f"Directory not empty, keeping: {old_dir.name}")
                except Exception as e:
                    ColorPrint.yellow(f"Could not remove {old_dir.name}: {e}")

        return True

    def create_training_config(self):
        """Create training_config.json"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Step 8: Create training_config.json")
        ColorPrint.blue(f"{'='*80}")

        config = {
            "version": "2.0",
            "last_updated": datetime.now().strftime("%Y-%m-%d"),

            "global_settings": {
                "shared_backgrounds_dir": "1_sources/shared/backgrounds",
                "default_augmentation_count": 30,
                "default_positive_samples": 62,
                "default_negative_samples": 150
            },

            "augmentation_presets": {
                "button_detection": {
                    "allow_rotation": False,
                    "allow_stretch": True,
                    "stretch_x_range": [0.95, 1.05],
                    "stretch_y_range": [0.95, 1.05],
                    "allow_scale": True,
                    "scale_range": [0.95, 1.05]
                },
                "button_classification": {
                    "allow_rotation": False,
                    "allow_stretch": False,
                    "allow_scale": True,
                    "scale_range": [0.9, 1.1],
                    "color_jitter": True
                },
                "progressbar_detection": {
                    "allow_rotation": False,
                    "allow_stretch": True,
                    "stretch_x_range": [0.95, 1.05],
                    "stretch_y_range": [0.95, 1.05],
                    "allow_scale": True,
                    "scale_range": [0.95, 1.05]
                }
            },

            "projects": [
                {
                    "id": "cancel_button",
                    "display_name": "Cancel Button",
                    "description": "Cancel button detection and classification",
                    "enabled": True,
                    "auto_generated": True,

                    "data_sources": {
                        "patch_images": {
                            "type": "directory",
                            "path": "1_sources/projects/cancel_button/patch_images"
                        },
                        "background_images": {
                            "type": "shared",
                            "use_shared": True
                        }
                    },

                    "training": {
                        "augmentation": {
                            "detection": "@button_detection",
                            "classification": "@button_classification"
                        },
                        "samples": {
                            "positive": 62,
                            "negative": 150,
                            "augmentation_count": 30
                        }
                    }
                },
                {
                    "id": "confirm_button",
                    "display_name": "Confirm Button",
                    "description": "Confirm button detection and classification",
                    "enabled": True,
                    "auto_generated": True,

                    "data_sources": {
                        "patch_images": {
                            "type": "directory",
                            "path": "1_sources/projects/confirm_button/patch_images"
                        },
                        "background_images": {
                            "type": "shared",
                            "use_shared": True
                        }
                    },

                    "training": {
                        "augmentation": {
                            "detection": "@button_detection",
                            "classification": "@button_classification"
                        },
                        "samples": {
                            "positive": 62,
                            "negative": 150,
                            "augmentation_count": 30
                        }
                    }
                },
                {
                    "id": "rift_progress_bar",
                    "display_name": "Rift Progress Bar",
                    "description": "Rift progress bar detection and classification",
                    "enabled": True,
                    "auto_generated": True,

                    "data_sources": {
                        "patch_images": {
                            "type": "directory",
                            "path": "1_sources/projects/rift_progress_bar/patch_images"
                        },
                        "background_images": {
                            "type": "shared",
                            "use_shared": True
                        }
                    },

                    "enhancements": [
                        {
                            "type": "random_time",
                            "position": "center",
                            "font_size": 12,
                            "color": [255, 255, 255],
                            "shadow_color": [24, 52, 86],
                            "shadow_offset": [1, 1]
                        }
                    ],

                    "training": {
                        "augmentation": {
                            "detection": "@progressbar_detection",
                            "classification": "@button_classification"
                        },
                        "samples": {
                            "positive": 62,
                            "negative": 150,
                            "augmentation_count": 30
                        },
                        "shorten_ratios": [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
                    }
                },
                {
                    "id": "team_hp_bar",
                    "display_name": "Team HP Bar",
                    "description": "Team HP bar detection and classification",
                    "enabled": True,
                    "auto_generated": True,

                    "data_sources": {
                        "patch_images": {
                            "type": "directory",
                            "path": "1_sources/projects/team_hp_bar/patch_images"
                        },
                        "background_images": {
                            "type": "shared",
                            "use_shared": True
                        }
                    },

                    "training": {
                        "augmentation": {
                            "detection": "@button_detection",
                            "classification": "@button_classification"
                        },
                        "samples": {
                            "positive": 62,
                            "negative": 150,
                            "augmentation_count": 30
                        }
                    }
                }
            ],

            "unified_models": {
                "classification": {
                    "name": "unified_model",
                    "included_projects": ["cancel_button", "confirm_button", "rift_progress_bar", "team_hp_bar"],
                    "model_type": "yolov8n-cls",
                    "training_params": {
                        "epochs": 100,
                        "batch": 8,
                        "imgsz": 76
                    }
                },
                "detection": {
                    "name": "unified_model",
                    "included_projects": ["cancel_button", "confirm_button", "rift_progress_bar", "team_hp_bar"],
                    "model_type": "yolov8n",
                    "training_params": {
                        "epochs": 100,
                        "batch": 16,
                        "imgsz": 640
                    }
                }
            }
        }

        config_path = self.new_training_data / "training_config.json"

        if self.dry_run:
            ColorPrint.yellow(f"[DRY RUN] Would create: {config_path}")
            ColorPrint.yellow(f"  Projects: {len(config['projects'])}")
            ColorPrint.yellow(f"  Presets: {len(config['augmentation_presets'])}")
        else:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            ColorPrint.green(f"✓ Created: training_config.json")

        return True

    def print_summary(self):
        """Print migration summary"""
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("Migration Summary")
        ColorPrint.blue(f"{'='*80}")

        ColorPrint.green("\n✅ New Structure:")
        ColorPrint.green("  1_sources/")
        ColorPrint.green("    ├── projects/           # 4 projects with patch_images/")
        ColorPrint.green("    └── shared/backgrounds/ # 6 background images")
        ColorPrint.green("  2_datasets/")
        ColorPrint.green("    └── detection/unified_model/")
        ColorPrint.green("  3_models/")
        ColorPrint.green("    └── detection/unified_model/")
        ColorPrint.green("  training_config.json      # Global configuration")

        if self.dry_run:
            ColorPrint.yellow("\n⚠️  This was a DRY RUN - no changes were made")
            ColorPrint.yellow("   Run with --execute to perform actual migration")
        else:
            ColorPrint.green("\n✅ Migration completed successfully!")
            ColorPrint.green(f"   Backup saved to: {self.backup_dir}")

    def run(self):
        """Run complete migration"""
        steps = [
            self.backup_old_structure,
            self.create_new_directories,
            self.migrate_source_projects,
            self.migrate_shared_backgrounds,
            self.migrate_datasets,
            self.migrate_models,
            self.cleanup_old_structure,
            self.create_training_config,
        ]

        for step in steps:
            if not step():
                ColorPrint.red(f"\n❌ Migration failed at step: {step.__name__}")
                return False

        self.print_summary()
        return True


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Migrate training data structure to new 3-layer architecture",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (preview changes)
  python scripts/migrate_structure.py

  # Execute migration
  python scripts/migrate_structure.py --execute
        """
    )

    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute migration (default is dry run)"
    )

    args = parser.parse_args()

    # Create migrator
    migrator = StructureMigration(dry_run=not args.execute)

    # Run migration
    success = migrator.run()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
