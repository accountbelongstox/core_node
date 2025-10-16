#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simplified Training Controller for D3-Check
Uses generic pycore ultralytics trainers
Only needs to pass source data directory
"""

import os
# 天天见！
import sys
from pathlib import Path
 
# Add paths
current_dir = os.path.dirname(os.path.abspath(__file__))
d3_check_dir = Path(current_dir).parent.parent

# Add core_node to path for pycore imports
core_node_dir = d3_check_dir.parent.parent
if str(core_node_dir) not in sys.path:
    sys.path.insert(0, str(core_node_dir))

from pycore.pyutils.ultralytics.classification_trainer import ClassificationTrainer
from pycore.pyutils.ultralytics.detection_trainer import DetectionTrainer


class D3CheckTrainingController:
    """
    Simplified training controller for D3-Check

    Usage:
        controller = D3CheckTrainingController()
        controller.train_classification("progress_bar")
        controller.train_detection("progress_bar")
    """

    def __init__(self):
        """Initialize controller"""
        self.d3_check_dir = d3_check_dir
        self.source_base_dir = self.d3_check_dir / ".cache" / "training_data" / "source" / "training_projects"

    def train_classification(self, project_name: str, **kwargs):
        """
        Train classification model for a project

        Args:
            project_name: Project name (e.g., 'progress_bar')
            **kwargs: Additional training arguments

        Returns:
            Training results
        """
        source_dir = self.source_base_dir / project_name

        if not source_dir.exists():
            print(f"ERROR: Source directory not found: {source_dir}")
            return None

        print(f"=" * 80)
        print(f"Training Classification Model: {project_name}")
        print(f"=" * 80)

        try:
            # Create trainer (output dirs auto-determined)
            trainer = ClassificationTrainer(source_dir=str(source_dir))

            # Prepare data
            trainer.prepare_data()

            # Train
            results = trainer.train(**kwargs)

            return results

        except ValueError as e:
            # Validation error (coordinates and source images both missing)
            print(str(e))
            print(f"\033[93mSKIPPING project '{project_name}'\033[0m")
            return None

        except Exception as e:
            print(f"\033[91mERROR: Training failed for '{project_name}': {e}\033[0m")
            import traceback
            traceback.print_exc()
            return None

    def train_detection(self, project_name: str, **kwargs):
        """
        Train detection model for a project

        Args:
            project_name: Project name (e.g., 'progress_bar')
            **kwargs: Additional training arguments

        Returns:
            Training results
        """
        source_dir = self.source_base_dir / project_name

        if not source_dir.exists():
            print(f"ERROR: Source directory not found: {source_dir}")
            return None

        print(f"=" * 80)
        print(f"Training Detection Model: {project_name}")
        print(f"=" * 80)

        try:
            # Create trainer (output dirs auto-determined)
            trainer = DetectionTrainer(source_dir=str(source_dir))

            # Prepare data
            trainer.prepare_data()

            # Train
            results = trainer.train(**kwargs)

            return results

        except ValueError as e:
            # Validation error (coordinates and source images both missing)
            print(str(e))
            print(f"\033[93mSKIPPING project '{project_name}'\033[0m")
            return None

        except Exception as e:
            print(f"\033[91mERROR: Training failed for '{project_name}': {e}\033[0m")
            import traceback
            traceback.print_exc()
            return None

    def list_projects(self):
        """List available projects"""
        if not self.source_base_dir.exists():
            print(f"Source directory not found: {self.source_base_dir}")
            return []

        projects = []
        for item in self.source_base_dir.iterdir():
            if item.is_dir() and (item / "metadata.json").exists():
                projects.append(item.name)

        return projects


# Quick functions
def train_classification_quick(project_name: str, **kwargs):
    """Quick classification training"""
    controller = D3CheckTrainingController()
    return controller.train_classification(project_name, **kwargs)


def train_detection_quick(project_name: str, **kwargs):
    """Quick detection training"""
    controller = D3CheckTrainingController()
    return controller.train_detection(project_name, **kwargs)
