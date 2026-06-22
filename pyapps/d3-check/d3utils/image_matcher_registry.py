# -*- coding: utf-8 -*-
"""
ImageMatcher: obtain only from this module; do not instantiate elsewhere.
Provides: get_image_matcher() default singleton; get_image_matcher_for_resolution(sw, sh); get_image_matcher_for_method(method_type, sw, sh).
"""
from typing import Dict, Tuple, Optional

from pycore.pyutils.image_matcher import ImageMatcher

_default_matcher: Optional[ImageMatcher] = None
_by_resolution: Dict[Tuple[int, int], ImageMatcher] = {}
_by_method: Dict[Tuple[str, int, int], ImageMatcher] = {}


def get_image_matcher() -> ImageMatcher:
    """Default singleton (no args), for UI and general use."""
    global _default_matcher
    if _default_matcher is None:
        _default_matcher = ImageMatcher()
    return _default_matcher


def get_image_matcher_for_resolution(standard_width: int, standard_height: int) -> ImageMatcher:
    """Cached by standard resolution, for Battle.net etc. by window size."""
    key = (standard_width, standard_height)
    if key not in _by_resolution:
        _by_resolution[key] = ImageMatcher(standard_width=standard_width, standard_height=standard_height)
    return _by_resolution[key]


def get_image_matcher_for_method(
    method_type: str,
    standard_width: int,
    standard_height: int,
    ratio_thresh: float = 0.80,
    min_inliers: int = 4,
    nfeatures: int = 10000,
) -> ImageMatcher:
    """Cached by (method_type, standard_width, standard_height), for ScaledTemplateMatcherBase."""
    key = (method_type, standard_width, standard_height)
    if key not in _by_method:
        _by_method[key] = ImageMatcher(
            ratio_thresh=ratio_thresh,
            min_inliers=min_inliers,
            nfeatures=nfeatures,
            standard_width=standard_width,
            standard_height=standard_height,
        )
    return _by_method[key]
