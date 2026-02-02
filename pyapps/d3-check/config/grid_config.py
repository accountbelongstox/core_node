#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Grid Configuration
Shared grid configuration for pathfinding and screenshot capture

This configuration is used across all grid-based operations in the application.
Note: pyutils public library does not use this config to maintain its generality.
"""

from providor.app_constants import (
    GRID_ROWS,
    GRID_COLS,
    TOTAL_GRID_CELLS,
    GRID_TYPE_NINE,
    GRID_TYPE_CUSTOM,
    GRID_DESCRIPTION,
)


def get_grid_config():
    """
    Get current grid configuration

    Returns:
        dict: Grid configuration containing rows, cols, and total cells
    """
    return {
        'rows': GRID_ROWS,
        'cols': GRID_COLS,
        'total_cells': TOTAL_GRID_CELLS,
        'description': GRID_DESCRIPTION
    }


def update_grid_config(rows: int, cols: int):
    """
    Update grid configuration dynamically

    Args:
        rows: Number of rows
        cols: Number of columns

    Note:
        This function modifies global variables.
        Use with caution in multi-threaded environments.
    """
    global GRID_ROWS, GRID_COLS, TOTAL_GRID_CELLS, GRID_DESCRIPTION

    GRID_ROWS = rows
    GRID_COLS = cols
    TOTAL_GRID_CELLS = rows * cols
    GRID_DESCRIPTION = f"{GRID_ROWS} rows x {GRID_COLS} columns = {TOTAL_GRID_CELLS} cells"

    return get_grid_config()


if __name__ == '__main__':
    from providor.common_imports import ColorPrint

    # Display current configuration
    ColorPrint.blue("=== Grid Configuration ===")
    config = get_grid_config()
    ColorPrint.blue(f"Rows: {config['rows']}")
    ColorPrint.blue(f"Columns: {config['cols']}")
    ColorPrint.blue(f"Total Cells: {config['total_cells']}")
    ColorPrint.blue(f"Description: {config['description']}")

    # Test dynamic update
    ColorPrint.blue("\n=== Testing Dynamic Update ===")
    new_config = update_grid_config(24, 24)
    ColorPrint.green(f"New Configuration: {new_config['description']}")
