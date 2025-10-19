#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR Configuration for D4 Recognition Tasks
Provides centralized OCR model configuration for different scenarios
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class OCRModelConfig:
    """OCR model configuration"""
    det_model_name: str
    rec_model_name: str
    description: str
    use_case: str


class OCRConfig:
    """
    OCR Configuration Manager

    Provides optimized OCR configurations for different recognition scenarios.
    Based on CnOCR model recommendations:
    - General models: No prefix, e.g., 'densenet_lite_136-gru'
    - Number models: 'number-' prefix, e.g., 'number-densenet_lite_136-gru'
    - Document models: 'doc-' prefix, e.g., 'doc-densenet_lite_136-gru'
    """

    # Available model configurations
    MODELS = {
        # General purpose - Best for mixed content (Chinese, English, numbers)
        'general': OCRModelConfig(
            det_model_name='naive_det',
            rec_model_name='densenet_lite_136-gru',
            description='General purpose model for mixed content',
            use_case='Map names, quest text, general UI text'
        ),

        # Number only - Best for pure numeric content
        'number': OCRModelConfig(
            det_model_name='naive_det',
            rec_model_name='number-densenet_lite_136-gru',
            description='Number-only model (0-9)',
            use_case='Health values, damage numbers, item quantities'
        ),

        # Document - Best for scanned documents and books
        'document': OCRModelConfig(
            det_model_name='naive_det',
            rec_model_name='doc-densenet_lite_136-gru',
            description='Document/book scanning model (CnOCR)',
            use_case='Long text passages, descriptions, lore text'
        ),
    }

    # Default configuration for each recognition task
    TASK_CONFIGS = {
        'map_name': 'general',          # Map names: mixed Chinese/English
        'quest_text': 'general',        # Quest text: mixed content
        'item_name': 'general',         # Item names: mixed content
        'damage_number': 'number',      # Damage numbers: pure numbers
        'health_value': 'number',       # Health values: pure numbers
        'tier_input': 'number',         # Tier input: pure numbers
        'document': 'document',         # Long text: document model
    }

    @classmethod
    def get_config(cls, task_name: str) -> Optional[OCRModelConfig]:
        """
        Get OCR configuration for a specific task

        Args:
            task_name: Task name (e.g., 'map_name', 'damage_number')

        Returns:
            OCRModelConfig or None if task not found
        """
        model_key = cls.TASK_CONFIGS.get(task_name)
        if model_key is None:
            return None
        return cls.MODELS.get(model_key)

    @classmethod
    def get_model(cls, model_key: str) -> Optional[OCRModelConfig]:
        """
        Get OCR configuration by model key

        Args:
            model_key: Model key (e.g., 'general', 'number', 'document')

        Returns:
            OCRModelConfig or None if model not found
        """
        return cls.MODELS.get(model_key)

    @classmethod
    def list_models(cls) -> Dict[str, OCRModelConfig]:
        """
        List all available OCR model configurations

        Returns:
            Dictionary of model configurations
        """
        return cls.MODELS.copy()

    @classmethod
    def list_tasks(cls) -> Dict[str, str]:
        """
        List all task configurations and their assigned models

        Returns:
            Dictionary of task -> model mappings
        """
        return cls.TASK_CONFIGS.copy()

    @classmethod
    def get_default_config(cls) -> OCRModelConfig:
        """
        Get default OCR configuration (general model)

        Returns:
            Default OCRModelConfig
        """
        return cls.MODELS['general']


# Convenience functions
def get_ocr_config_for_task(task_name: str) -> Optional[OCRModelConfig]:
    """
    Get OCR configuration for a specific task

    Args:
        task_name: Task name (e.g., 'map_name', 'damage_number')

    Returns:
        OCRModelConfig or None if task not found
    """
    return OCRConfig.get_config(task_name)


def get_ocr_config_by_model(model_key: str) -> Optional[OCRModelConfig]:
    """
    Get OCR configuration by model key

    Args:
        model_key: Model key (e.g., 'general', 'number', 'document')

    Returns:
        OCRModelConfig or None if model not found
    """
    return OCRConfig.get_model(model_key)


if __name__ == '__main__':
    # Print all available configurations
    print("=== Available OCR Models ===\n")
    for model_key, config in OCRConfig.list_models().items():
        print(f"[{model_key}]")
        print(f"  Det Model: {config.det_model_name}")
        print(f"  Rec Model: {config.rec_model_name}")
        print(f"  Description: {config.description}")
        print(f"  Use Case: {config.use_case}")
        print()

    print("=== Task Configurations ===\n")
    for task_name, model_key in OCRConfig.list_tasks().items():
        config = OCRConfig.get_config(task_name)
        print(f"[{task_name}] -> {model_key}")
        if config:
            print(f"  Model: {config.rec_model_name}")
            print(f"  Use Case: {config.use_case}")
        print()
