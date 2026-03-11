# -*- coding: utf-8 -*-
"""
Main Functions Panel (Qt) - D3主要功能
Config: macro_configs.current_skill_config, macro_configs.skill_configs, macro_configs.auxiliary_config.
"""

from typing import Optional, Callable, Dict, Any

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QComboBox, QSpinBox, QLineEdit, QCheckBox,
    QScrollArea, QFrame,
)
from PySide6.QtGui import QKeyEvent

from providor.providor_index import CONFIG, queue_config_save, get_config_value_safe
from providor.i18n_manager import i18n_manager
from share.values.config_change_hub import get_config_change_hub
from share.values.skill_config_hotkeys import PER_CONFIG_HOTKEY_SPEC, get_per_config_hotkey_keys
from d3utils.d3u_common.hotkey_registry import (
    HOTKEY_CONFIG_PATH_AUXILIARY,
    CONFIG_KEY_MACRO_START_HOTKEY,
    CONFIG_KEY_ASSISTANT_HOTKEY,
    normalize_hotkey_canonical,
)

from ..theme.theme import UITheme
from ..unified_styles import UnifiedStyles
from ..utils.config_qt import config_get, config_set
from ..widgets_qt import HotkeyInputQt

SKILL_TABLE_KEYS = ("skill1", "skill2", "skill3", "skill4", "left_click", "right_click", "potion")


def _parse_int(val, default: int) -> int:
    if isinstance(val, int):
        return val
    s = str(val).strip()
    if not s or not s.lstrip("-").isdigit():
        return default
    return int(s)


class MainFunctionsPanelQt(QWidget):
    """D3主要功能 - config combo, skill table, hotkeys, options. CONFIG binding same as Tk."""

    def __init__(self, parent, initial_config=None, bottom_bar=None):
        super().__init__(parent)
        self.parent = parent
        self.bottom_bar = bottom_bar
        self.current_config = initial_config or "config1"
        self._skill_config_switch_callback: Optional[Callable[[str], None]] = None
        self.skill_vars: Dict[str, Any] = {}
        self.config_combo: Optional[QComboBox] = None
        self.skills_config_frame: Optional[QFrame] = None
        self._func1_skill_frame: Optional[QWidget] = None

        self.strategy_en_to_zh = {
            "continuous": i18n_manager.get_ui_text("skill_config.strategies.continuous"),
            "single": i18n_manager.get_ui_text("skill_config.strategies.single"),
            "hold": i18n_manager.get_ui_text("skill_config.strategies.hold"),
            "ignore": i18n_manager.get_ui_text("skill_config.strategies.ignore"),
        }
        self.strategy_zh_to_en = {v: k for k, v in self.strategy_en_to_zh.items()}

        bg = UITheme.get_color("bg_primary")
        self.setStyleSheet(f"background-color: {bg};")
        tab_pad = UnifiedStyles.TAB_PAD
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(tab_pad, tab_pad, tab_pad, tab_pad)

        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(0, 0, 0, 0)

        # Top: config selection row
        config_row = QHBoxLayout()
        skill_configs = config_get("macro_configs.skill_configs", {}) or {}
        config_values = list(skill_configs.keys()) if isinstance(skill_configs, dict) and skill_configs else ["config1", "config2", "config3", "config4"]
        self.config_combo = QComboBox()
        self.config_combo.addItems(config_values)
        self.current_config = config_get("macro_configs.current_skill_config", "config1")
        idx = self.config_combo.findText(self.current_config)
        if idx >= 0:
            self.config_combo.setCurrentIndex(idx)
        self.config_combo.currentTextChanged.connect(self._on_config_changed)
        config_row.addWidget(self.config_combo)
        config_row.addStretch(1)
        content_layout.addLayout(config_row)

        # Center: left (skill table) + right (aux placeholder)
        center = QHBoxLayout()
        left_w = QWidget()
        left_layout = QVBoxLayout(left_w)
        left_layout.setContentsMargins(0, 0, UnifiedStyles.SPACING["md"], 0)
        self._func1_skill_frame = left_w
        self._create_skill_tabs(left_w)
        center.addWidget(left_w, 1)
        right_w = QFrame()
        right_w.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']};")
        right_layout = QVBoxLayout(right_w)
        right_layout.addWidget(QLabel(i18n_manager.get_ui_text("auxiliary_panel.auxiliary_functions") or "辅助功能"))
        center.addWidget(right_w, 1)
        content_layout.addLayout(center, 1)

        # Bottom bar: hotkeys + options
        bar_frame = QFrame()
        bar_frame.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_secondary']};")
        bar_layout = QGridLayout(bar_frame)
        row = 0
        # Macro start hotkey
        bar_layout.addWidget(QLabel(i18n_manager.get_ui_text("main_functions_panel.macro_start_hotkey_label") + ":"), row, 0)
        start_hotkey = HotkeyInputQt(initial_value=normalize_hotkey_canonical(
            (CONFIG.get("macro_configs", {}).get("auxiliary_config", {}).get("macro_start_hotkey") or "")
        ))
        start_hotkey.hotkey_changed.connect(self._on_macro_start_hotkey_change)
        bar_layout.addWidget(start_hotkey, row, 1)
        row += 1
        # Assistant hotkey
        bar_layout.addWidget(QLabel(i18n_manager.get_ui_text("main_functions_panel.macro_pause_hotkey_label") + ":"), row, 0)
        aux_hotkey = HotkeyInputQt(initial_value=normalize_hotkey_canonical(
            (CONFIG.get("macro_configs", {}).get("auxiliary_config", {}).get("assistant_hotkey") or "")
        ))
        aux_hotkey.hotkey_changed.connect(self._on_assistant_hotkey_change)
        bar_layout.addWidget(aux_hotkey, row, 1)
        row += 1
        # Quick switch
        _sc = config_get("macro_configs.skill_configs", {}) or {}
        _cur = _sc.get(self.current_config, {}) if isinstance(_sc, dict) else {}
        bar_layout.addWidget(QLabel(i18n_manager.get_ui_text("additional_settings.quick_switch") + ":"), row, 0)
        quick_switch_inp = HotkeyInputQt(initial_value=_cur.get("quick_switch", "F1"))
        quick_switch_inp.hotkey_changed.connect(lambda h: self._on_skill_changed("quick_switch", h))
        bar_layout.addWidget(quick_switch_inp, row, 1)
        self.skill_vars["quick_switch"] = quick_switch_inp
        row += 1
        # Options row: sound, smart_pause, custom_stand
        sound_cb = QCheckBox(i18n_manager.get_ui_text("options.play_sound_on_switch"))
        sound_cb.setChecked(True)
        sound_cb.stateChanged.connect(lambda s: self._on_sound_changed(s == Qt.CheckState.Checked.value))
        bar_layout.addWidget(sound_cb, row, 0, 1, 2)
        self._sound_cb = sound_cb
        smart_cb = QCheckBox(i18n_manager.get_ui_text("options.smart_pause"))
        smart_cb.setChecked(True)
        smart_cb.stateChanged.connect(lambda s: self._on_smart_pause_changed(s == Qt.CheckState.Checked.value))
        bar_layout.addWidget(smart_cb, row, 2, 1, 2)
        self._smart_pause_cb = smart_cb
        custom_cb = QCheckBox(i18n_manager.get_ui_text("options.use_custom_stand_key") + ":")
        custom_cb.setChecked(False)
        self._custom_stand_cb = custom_cb
        self._custom_stand_edit = QLineEdit("Shift")
        self._custom_stand_edit.setMaximumWidth(80)
        custom_row = QHBoxLayout()
        custom_row.addWidget(custom_cb)
        custom_row.addWidget(self._custom_stand_edit)
        bar_layout.addLayout(custom_row, row, 4)
        row += 1

        content_layout.addWidget(bar_frame)
        main_layout.addWidget(content)

        if bottom_bar:
            bottom_bar.update_config_status(self.current_config)
            self._sync_bottom_bar_options()

    def _sync_bottom_bar_options(self):
        if self.bottom_bar is not None:
            self.bottom_bar.set_option_state(
                sound=self._sound_cb.isChecked(),
                smart_pause=self._smart_pause_cb.isChecked(),
                custom_stand=self._custom_stand_cb.isChecked(),
                custom_stand_key=self._custom_stand_edit.text().strip() or "Shift",
            )

    def _on_sound_changed(self, checked: bool):
        self._sync_bottom_bar_options()

    def _on_smart_pause_changed(self, checked: bool):
        config_set("macro_configs.auxiliary_config.smart_pause", checked)
        self._sync_bottom_bar_options()

    def _on_skill_param_changed(self, skill_key: str, param_name: str, value):
        if "macro_configs" not in CONFIG:
            CONFIG["macro_configs"] = {}
        if "skill_configs" not in CONFIG["macro_configs"]:
            CONFIG["macro_configs"]["skill_configs"] = {}
        if self.current_config not in CONFIG["macro_configs"]["skill_configs"]:
            CONFIG["macro_configs"]["skill_configs"][self.current_config] = {"skills": {}}
        if "skills" not in CONFIG["macro_configs"]["skill_configs"][self.current_config]:
            CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"] = {}
        if skill_key not in CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"]:
            CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key] = {}
        if param_name in ("interval", "delay", "random_delay"):
            value = _parse_int(value, 0)
        CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key][param_name] = value
        queue_config_save()
        get_config_change_hub().notify_config_changed("macro_configs.skill_configs")

    def _on_strategy_changed(self, skill_key: str, strategy_zh: str):
        strategy_en = self.strategy_zh_to_en.get(strategy_zh, "continuous")
        self._on_skill_param_changed(skill_key, "strategy", strategy_en)

    def _on_skill_changed(self, skill_key: str, value: str):
        if "macro_configs" not in CONFIG:
            CONFIG["macro_configs"] = {}
        if "skill_configs" not in CONFIG["macro_configs"]:
            CONFIG["macro_configs"]["skill_configs"] = {}
        if self.current_config not in CONFIG["macro_configs"]["skill_configs"]:
            CONFIG["macro_configs"]["skill_configs"][self.current_config] = {"skills": {}}
        if skill_key in get_per_config_hotkey_keys():
            CONFIG["macro_configs"]["skill_configs"][self.current_config][skill_key] = value
        else:
            if "skills" not in CONFIG["macro_configs"]["skill_configs"][self.current_config]:
                CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"] = {}
            if skill_key not in CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"]:
                CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key] = {}
            CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key]["key"] = value
        queue_config_save()
        get_config_change_hub().notify_config_changed("macro_configs.skill_configs")

    def _on_macro_start_hotkey_change(self, hotkey: str):
        c = CONFIG.get("macro_configs", {})
        if "auxiliary_config" not in c:
            c["auxiliary_config"] = {}
        c["auxiliary_config"][CONFIG_KEY_MACRO_START_HOTKEY] = hotkey
        queue_config_save()
        get_config_change_hub().notify_config_changed(HOTKEY_CONFIG_PATH_AUXILIARY)

    def _on_assistant_hotkey_change(self, hotkey: str):
        c = CONFIG.get("macro_configs", {})
        if "auxiliary_config" not in c:
            c["auxiliary_config"] = {}
        c["auxiliary_config"][CONFIG_KEY_ASSISTANT_HOTKEY] = hotkey
        queue_config_save()
        get_config_change_hub().notify_config_changed(HOTKEY_CONFIG_PATH_AUXILIARY)

    def _create_skill_tabs(self, parent: QWidget):
        skills_frame = QFrame()
        skills_frame.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']};")
        grid = QGridLayout(skills_frame)
        headers = [
            i18n_manager.get_ui_text("skill_config.skill"),
            i18n_manager.get_ui_text("skill_config.key"),
            i18n_manager.get_ui_text("skill_config.strategy"),
            i18n_manager.get_ui_text("skill_config.interval"),
            i18n_manager.get_ui_text("skill_config.delay"),
            i18n_manager.get_ui_text("skill_config.random_delay"),
        ]
        for col, h in enumerate(headers):
            lbl = QLabel(h)
            lbl.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_secondary']}; color: {UnifiedStyles.COLORS['text_primary']}; font-size: 9px;")
            grid.addWidget(lbl, 0, col)
        skill_configs = config_get("macro_configs.skill_configs", {}) or {}
        current_config = skill_configs.get(self.current_config, {}) if isinstance(skill_configs, dict) else {}
        skills_config = current_config.get("skills", {}) or {}
        _mouse_default = {"key": "", "strategy": "ignore", "interval": 100, "delay": 0, "random_delay": 0}
        _potion_default = {"key": "Q", "strategy": "ignore", "interval": 100, "delay": 0, "random_delay": 0}
        for i, skill_key in enumerate(SKILL_TABLE_KEYS, start=1):
            if skill_key in ("left_click", "right_click"):
                default = _mouse_default
            elif skill_key == "potion":
                default = _potion_default
            else:
                default = {}
            skill_data = skills_config.get(skill_key) or default
            self._create_skill_row(grid, skill_key, skill_data, i)
        self.skills_config_frame = skills_frame
        parent_layout = parent.layout() or QVBoxLayout(parent)
        parent_layout.addWidget(skills_frame, 1)

    def _create_skill_row(self, grid: QGridLayout, skill_key: str, skill_data: dict, row: int):
        name = i18n_manager.get_ui_text(f"skill_table.skills.{skill_key}")
        if name == f"skill_table.skills.{skill_key}":
            name = skill_key.replace("_", " ").title()
        name_lbl = QLabel(name)
        name_lbl.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']}; font-size: 9px;")
        grid.addWidget(name_lbl, row, 0)
        if skill_key in ("left_click", "right_click"):
            key_text = i18n_manager.get_ui_text(f"skill_table.key_{skill_key}")
            key_lbl = QLabel(key_text)
            key_lbl.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_secondary']}; font-size: 9px;")
            grid.addWidget(key_lbl, row, 1)
        else:
            key_default = "Q" if skill_key == "potion" else ""
            key_val = skill_data.get("key") or key_default
            key_inp = HotkeyInputQt(initial_value=key_val)
            key_inp.hotkey_changed.connect(lambda h, k=skill_key: self._on_skill_param_changed(k, "key", h))
            grid.addWidget(key_inp, row, 1)
            self.skill_vars[f"{skill_key}_key"] = key_inp
        strategy_en = skill_data.get("strategy", "continuous")
        strategy_zh = self.strategy_en_to_zh.get(strategy_en, strategy_en)
        strategy_combo = QComboBox()
        strategy_combo.addItems(list(self.strategy_en_to_zh.values()))
        strategy_combo.setCurrentText(strategy_zh)
        strategy_combo.currentTextChanged.connect(lambda t, k=skill_key: self._on_strategy_changed(k, t))
        grid.addWidget(strategy_combo, row, 2)
        self.skill_vars[f"{skill_key}_strategy"] = strategy_combo
        for col, (param, default) in enumerate([("interval", 100), ("delay", 0), ("random_delay", 0)], start=3):
            spin = QSpinBox()
            spin.setRange(0, 10000)
            spin.setSingleStep(10)
            spin.setValue(skill_data.get(param, default))
            spin.setStyleSheet(f"font-size: 9px; min-width: 60px;")
            spin.valueChanged.connect(lambda v, k=skill_key, p=param: self._on_skill_param_changed(k, p, v))
            grid.addWidget(spin, row, col)
            self.skill_vars[f"{skill_key}_{param}"] = spin

    def _on_config_changed(self, new_config: str):
        if not new_config:
            return
        if new_config != self.current_config:
            self.current_config = new_config
            config_set("macro_configs.current_skill_config", new_config, notify=True)
            if self.bottom_bar:
                self.bottom_bar.update_config_status(new_config)
            if self.skills_config_frame and self.skill_vars:
                self._update_skill_tabs_content()
            if self._skill_config_switch_callback:
                self._skill_config_switch_callback(new_config)

    def _update_skill_tabs_content(self):
        _sc = config_get("macro_configs.skill_configs", {}) or {}
        cfg = _sc.get(self.current_config, {}) if isinstance(_sc, dict) else {}
        skills_data = cfg.get("skills", {})
        for skill_key in SKILL_TABLE_KEYS:
            data = skills_data.get(skill_key, {})
            key_w = self.skill_vars.get(f"{skill_key}_key")
            if key_w is not None and skill_key not in ("left_click", "right_click"):
                key_w.set_hotkey(data.get("key", "Q" if skill_key == "potion" else ""))
            strategy_w = self.skill_vars.get(f"{skill_key}_strategy")
            if strategy_w is not None and isinstance(strategy_w, QComboBox):
                strategy_w.setCurrentText(self.strategy_en_to_zh.get(data.get("strategy", "continuous"), "continuous"))
            for param, default in (("interval", 100), ("delay", 0), ("random_delay", 0)):
                w = self.skill_vars.get(f"{skill_key}_{param}")
                if w is not None and isinstance(w, QSpinBox):
                    w.blockSignals(True)
                    w.setValue(data.get(param, default))
                    w.blockSignals(False)
        for hotkey_key, default in PER_CONFIG_HOTKEY_SPEC:
            w = self.skill_vars.get(hotkey_key)
            if w is not None:
                w.set_hotkey(cfg.get(hotkey_key, default))

    def set_skill_config_switch_callback(self, callback: Callable[[str], None]) -> None:
        self._skill_config_switch_callback = callback
