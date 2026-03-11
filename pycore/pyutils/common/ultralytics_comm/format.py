# -*- coding: utf-8 -*-
"""YOLO label line formatting."""


def format_detection_line(class_id: int, x_center: float, y_center: float, width: float, height: float) -> str:
    """One line for YOLO detection .txt: class_id x_center y_center width height (normalized 0-1)."""
    return "%d %.6f %.6f %.6f %.6f" % (class_id, x_center, y_center, width, height)
