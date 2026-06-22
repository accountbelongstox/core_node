# -*- coding: utf-8 -*-
"""
D4 OCR configuration (shared). Used by d4utils and controller.d4func; no controller dependency in share.
"""

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class OCRModelConfig:
    """OCR model configuration for CnOCR."""
    det_model_name: str
    rec_model_name: str
    description: str
    use_case: str


class OCRConfig:
    """
    OCR Configuration Manager for D4 recognition tasks.
    Based on CnOCR: general / number- / doc- prefix models.
    """

    MODELS = {
        'general': OCRModelConfig(
            det_model_name='naive_det',
            rec_model_name='densenet_lite_136-gru',
            description='General purpose model for mixed content',
            use_case='Map names, quest text, general UI text'
        ),
        'number': OCRModelConfig(
            det_model_name='naive_det',
            rec_model_name='number-densenet_lite_136-fc',
            description='Number-only model (0-9, cand_alphabet)',
            use_case='Health values, damage numbers, item quantities'
        ),
        'document': OCRModelConfig(
            det_model_name='naive_det',
            rec_model_name='doc-densenet_lite_136-gru',
            description='Document/book scanning model (CnOCR)',
            use_case='Long text passages, descriptions, lore text'
        ),
        'general_en': OCRModelConfig(
            det_model_name='en_PP-OCRv3_det',
            rec_model_name='en_PP-OCRv3',
            description='English detection + recognition (PP-OCR)',
            use_case='English text with position'
        ),
        'general_cht': OCRModelConfig(
            det_model_name='ch_PP-OCRv3_det',
            rec_model_name='chinese_cht_PP-OCRv3',
            description='Traditional Chinese recognition (PP-OCR)',
            use_case='Traditional Chinese text with position'
        ),
    }

    TASK_CONFIGS = {
        'map_name': 'general',
        'browser_login': 'general',
        'quest_text': 'general',
        'item_name': 'general',
        'damage_number': 'number',
        'health_value': 'number',
        'tier_input': 'number',
        'document': 'document',
        'english': 'general_en',
        'traditional': 'general_cht',
    }

    @classmethod
    def get_config(cls, task_name: str) -> Optional[OCRModelConfig]:
        model_key = cls.TASK_CONFIGS.get(task_name)
        if model_key is None:
            return None
        return cls.MODELS.get(model_key)

    @classmethod
    def get_model(cls, model_key: str) -> Optional[OCRModelConfig]:
        return cls.MODELS.get(model_key)

    @classmethod
    def list_models(cls) -> Dict[str, OCRModelConfig]:
        return cls.MODELS.copy()

    @classmethod
    def list_tasks(cls) -> Dict[str, str]:
        return cls.TASK_CONFIGS.copy()

    @classmethod
    def get_default_config(cls) -> OCRModelConfig:
        return cls.MODELS['general']


def get_ocr_config_for_task(task_name: str) -> Optional[OCRModelConfig]:
    """Get OCR configuration for a task (e.g. 'map_name', 'quest_text')."""
    return OCRConfig.get_config(task_name)


def get_ocr_config_by_model(model_key: str) -> Optional[OCRModelConfig]:
    """Get OCR configuration by model key ('general', 'number', 'document')."""
    return OCRConfig.get_model(model_key)
