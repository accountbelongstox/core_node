#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
d3-check 侧 CnOCR 薄封装：委托 pycore 的 cnocr_engine_registry（third_party 加载与引擎初始化），
仅在此处做 任务名 -> 模型键 映射（使用 share.d4_ocr_config）。禁止在各处自行 new CnOCREngine()。
"""

from typing import Optional

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

# 引擎实现与 third_party 加载均在 pycore，d3-check 只做任务映射
from pycore.pyutils.cnocr_engine_registry import (
    ensure_cnocr_loaded_and_engines_initialized as _pycore_ensure,
    get_cnocr_engine_default as _pycore_default,
    get_cnocr_engine_by_model_key as _pycore_by_model_key,
)
from share.d4_ocr_config import OCRConfig


def ensure_cnocr_loaded_and_engines_initialized() -> bool:
    """APP 启动时调用：委托 pycore 一次性加载/安装 cnocr 并预初始化所有引擎。"""
    return _pycore_ensure()


def get_cnocr_engine_default() -> Optional["CnOCREngine"]:
    """默认引擎（与 general 同配置）。"""
    return _pycore_default()


def get_cnocr_engine_general() -> Optional["CnOCREngine"]:
    """General 模型。"""
    return _pycore_by_model_key("general")


def get_cnocr_engine_number() -> Optional["CnOCREngine"]:
    """Number 模型。"""
    return _pycore_by_model_key("number")


def get_cnocr_engine_document() -> Optional["CnOCREngine"]:
    """Document 模型。"""
    return _pycore_by_model_key("document")


def get_cnocr_engine_for_task(task_name: str) -> Optional["CnOCREngine"]:
    """根据任务名（map_name / quest_text / health_value 等）返回对应引擎，映射见 share.d4_ocr_config。"""
    model_key = OCRConfig.TASK_CONFIGS.get(task_name, "general")
    return _pycore_by_model_key(model_key)
