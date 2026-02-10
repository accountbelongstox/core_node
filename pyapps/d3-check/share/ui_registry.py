# -*- coding: utf-8 -*-
"""
UI 总常量库 / UI Registry
主界面启动后一次性创建所有主 UI，并在此注册；除退出销毁或弹出式 UI 外，其余常驻。
调用方通过本模块的公共接口（get_ui / get_root / get_panel）访问，不再对 UI 逐一判断。
"""

from typing import Any, Optional, Dict

# 主 UI 实例与面板表（由 register_ui 写入，启动后常驻直至退出）
_ui: Optional[Any] = None
_panels: Dict[str, Any] = {}
# 弹出式 UI（按需创建，用 register_popup / get_popup / unregister_popup）
_popups: Dict[str, Any] = {}


def register_ui(ui_instance: Any) -> None:
    """
    将主 UI 及其所有面板注册到总常量库。
    在 UI 创建完成时调用一次，语言切换重建面板后再次调用以更新引用。
    """
    global _ui, _panels
    _ui = ui_instance
    from providor.constants.ui import (
        PANEL_KEY_MAIN,
        PANEL_KEY_AUXILIARY,
        PANEL_KEY_ROSBOT,
        PANEL_KEY_D4,
        PANEL_KEY_CALIBRATION,
        PANEL_KEY_LOG,
    )
    _panels = {
        PANEL_KEY_MAIN: ui_instance.main_functions_panel,
        PANEL_KEY_AUXILIARY: ui_instance.auxiliary_functions_panel,
        PANEL_KEY_ROSBOT: ui_instance.rosbot_extension_panel,
        PANEL_KEY_D4: ui_instance.d4_panel,
        PANEL_KEY_CALIBRATION: ui_instance.coordinate_calibration_panel,
        PANEL_KEY_LOG: ui_instance.log_panel,
    }


def get_ui() -> Optional[Any]:
    """返回主 UI 实例（Diablo3MacroUI）。退出后为 None。"""
    return _ui


def get_root() -> Optional[Any]:
    """返回主窗口 root（Tk）。用于弹窗 parent、after 等。退出或未启动为 None。"""
    if _ui is None:
        return None
    return _ui.root


def get_panel(key: str) -> Optional[Any]:
    """按 key 返回面板。key 使用 providor.constants.ui 中的 PANEL_KEY_*。"""
    return _panels.get(key)


def register_popup(key: str, instance: Any) -> None:
    """注册弹出式 UI。key 使用 providor.constants.ui 中的 POPUP_KEY_*。"""
    global _popups
    _popups[key] = instance


def get_popup(key: str) -> Optional[Any]:
    """按 key 返回弹出式 UI；不存在或已关闭时返回 None。"""
    return _popups.get(key)


def unregister_popup(key: str) -> None:
    """从总库移除弹出式 UI（关闭时调用）。"""
    global _popups
    _popups.pop(key, None)
