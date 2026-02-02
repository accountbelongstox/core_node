#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scaled Template Matcher (D3) - 向后兼容入口
实际实现为 D3 专用类库 d3_scaled_template_matcher。本模块仅做 re-export，保持旧导入路径可用。
"""

from d3utils.d3_scaled_template_matcher import (
    D3ScaledTemplateMatcher as ScaledTemplateMatcher,
    get_d3_scaled_template_matcher as get_scaled_template_matcher,
    D3_STANDARD_WIDTH,
    D3_STANDARD_HEIGHT,
)

__all__ = [
    "ScaledTemplateMatcher",
    "get_scaled_template_matcher",
    "D3_STANDARD_WIDTH",
    "D3_STANDARD_HEIGHT",
]
