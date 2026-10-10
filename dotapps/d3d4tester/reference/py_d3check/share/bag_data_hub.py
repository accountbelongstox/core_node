# -*- coding: utf-8 -*-
"""
Bag Data Hub

Hub lives in share alongside game_interface_data; provides read-only access to bag coordinates and layout.
Caller must refresh: after get_d3_interface_manager().collect_bag_info_quik() this hub returns latest bag_coordinates, bag_layout.

Item quality (color): empty, magic, rare, legendary. Legendary tier: normal / ancient / primal (ancient/primal need hover to detect).
"""

from typing import Optional

from share.game_interface_data import (
    get_game_interface_data,
    BagCoordinates,
    BagLayout,
)


def get_coordinates() -> Optional[BagCoordinates]:
    """Read current bag coordinates from data center; caller must call collect_bag_info_quik first or returns None."""
    return get_game_interface_data().bag_coordinates


def get_layout() -> Optional[BagLayout]:
    """Read current bag layout from data center; caller must call collect_bag_info_quik first or returns None."""
    return get_game_interface_data().bag_layout


__all__ = ["get_coordinates", "get_layout"]
