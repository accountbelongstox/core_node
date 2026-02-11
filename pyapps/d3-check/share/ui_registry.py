# -*- coding: utf-8 -*-
"""
UI 总常量库 / UI Registry
主界面启动后一次性创建所有主 UI，并在此注册；除退出销毁或弹出式 UI 外，其余常驻。
调用方通过本模块的公共接口（get_ui / get_root / get_panel）访问，不再对 UI 逐一判断。
"""

from typing import Any, Optional, Dict

# 主 UI 实例（由 register_ui 写入）；面板表由主 UI 自身维护，通过 get_panel(key) 委托（DESIGN_ISSUES_MAJOR §3）
_ui: Optional[Any] = None
# 弹出式 UI（按需创建，用 register_popup / get_popup / unregister_popup）
_popups: Dict[str, Any] = {}


def register_ui(ui_instance: Any) -> None:
    """
    将主 UI 注册到总常量库。面板由主 UI 的 get_panel(key) 提供，此处仅持有一份主 UI 引用。
    在 UI 创建完成时调用一次，语言切换重建面板后再次调用以更新引用。
    """
    global _ui
    _ui = ui_instance


def get_ui() -> Optional[Any]:
    """返回主 UI 实例（Diablo3MacroUI）。退出后为 None。"""
    return _ui


def get_root() -> Optional[Any]:
    """返回主窗口 root（Tk）。用于弹窗 parent、after 等。退出或未启动为 None。"""
    if _ui is None:
        return None
    return _ui.root


def get_panel(key: str) -> Optional[Any]:
    """
    按 key 返回面板，委托主 UI 的 get_panel(key)。key 使用 providor.constants.ui 中的 PANEL_KEY_*。
    
    注意：对于 PANEL_KEY_ROSBOT，返回的 panel 对象在首次切换到该 tab 或 ensure_content 完成前，
    可能尚未完成内部控件创建（_content_created=False）。依赖 panel 内部控件的调用方应检查
    panel._content_created 或确保 ensure_content 已完成。
    """
    return _ui.get_panel(key) if _ui else None


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
