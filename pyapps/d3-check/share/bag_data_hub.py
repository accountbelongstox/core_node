# -*- coding: utf-8 -*-
"""
背包数据中枢 (Bag Data Hub)

数据中枢放在 share，与 game_interface_data 同层；仅提供从数据中心读取背包坐标与布局的入口。
刷新由调用方执行：调用 get_d3_interface_manager().collect_bag_info_quik() 后，本 hub 即可读到最新 bag_coordinates、bag_layout。

物品质量（颜色可识别）：空、魔法(蓝)、稀有(黄)、传奇(绿)。
传奇阶位：普通 / 远古 / 太古。远古与太古无法仅凭颜色识别，需 hover 在装备上识别远古线/太古线。
"""

from typing import Optional

from share.game_interface_data import (
    get_game_interface_data,
    BagCoordinates,
    BagLayout,
)


def get_coordinates() -> Optional[BagCoordinates]:
    """从数据中心读取当前背包坐标；调用前需由调用方执行 collect_bag_info_quik 刷新，否则可能为 None。"""
    return get_game_interface_data().bag_coordinates


def get_layout() -> Optional[BagLayout]:
    """从数据中心读取当前背包布局；调用前需由调用方执行 collect_bag_info_quik 刷新，否则可能为 None。"""
    return get_game_interface_data().bag_layout


__all__ = ["get_coordinates", "get_layout"]
