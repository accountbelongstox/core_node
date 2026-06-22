#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auxiliary options block: bag offset (2 cols) + automation checkboxes (2 cols).
Layout: two columns only.
Rule: when a row has a dropdown (has_menu), do NOT add any separate label; the dropdown
option texts (e.g. Keep Ancient+, Keep Primal) are the only place for that meaning. Row = checkbox + dropdown only (no third label).
Config: ui_analysis.bag_offset.*, macro_configs.auxiliary_config.*.
"""

import tkinter as tk
from typing import Any, List, Optional, Tuple

from providor.providor_index import CONFIG, queue_config_save
from providor.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding
from ui.unified_styles import UnifiedStyles
from ui.widgets import ThemedCombobox
from ui.utils.tk_variables import var_str
from ui.utils.offset_input import OffsetInputHelper

_PAD = 2
_COMBO_W = 14
_OFFSET_MIN = -500
_OFFSET_MAX = 500
_BAG_OFFSET_KEYS = ("ui_analysis.bag_offset.top", "ui_analysis.bag_offset.left", "ui_analysis.bag_offset.bottom", "ui_analysis.bag_offset.right")
_OFFSET_HELPER = OffsetInputHelper(min_val=_OFFSET_MIN, max_val=_OFFSET_MAX)


def create_auxiliary_options_block(parent: tk.Widget) -> tk.Frame:
    """Create bag offset + automation in a 2-column narrow frame."""
    block = tk.Frame(parent, bg=UnifiedStyles.COLORS["bg_secondary"])
    block.pack(fill=tk.BOTH, expand=True)
    block.grid_columnconfigure(0, weight=1)
    block.grid_columnconfigure(1, weight=1)

    _create_bag_offset_row(block)
    _create_automation_section(block)
    return block


def _create_bag_offset_row(block: tk.Frame) -> None:
    """Row 0: offset label + one Entry (t,l,b,r). Uses OffsetInputHelper: focus loss -> comma display, non-numeric merged as comma."""
    bag = CONFIG.get("ui_analysis", {}).get("bag_offset", {})
    pad = _PAD
    font_s = UnifiedStyles.FONTS["small"]
    t0 = bag.get("top", 0)
    l0 = bag.get("left", 0)
    b0 = bag.get("bottom", 0)
    r0 = bag.get("right", 0)

    cell = tk.Frame(block, bg=UnifiedStyles.COLORS["bg_secondary"])
    cell.grid(row=0, column=0, columnspan=1, sticky="nsw", padx=pad, pady=pad)
    cell.grid_columnconfigure(1, weight=1)

    lbl = tk.Label(
        cell,
        text=i18n_manager.get_ui_text("ui.auxiliary_panel.bag_offset_label"),
        bg=UnifiedStyles.COLORS["bg_secondary"],
        fg=UnifiedStyles.COLORS["text_primary"],
        font=font_s,
    )
    lbl.grid(row=0, column=0, sticky="w", padx=(0, pad), pady=0)

    entry_var = var_str(cell, _OFFSET_HELPER.format_display(f"{t0},{l0},{b0},{r0}"))
    entry = tk.Entry(
        cell,
        textvariable=entry_var,
        width=14,
        bg=UnifiedStyles.COLORS["input_bg"],
        fg=UnifiedStyles.COLORS["input_text"],
        font=UnifiedStyles.FONTS["input"],
        relief=tk.SUNKEN,
        bd=1,
    )
    entry.grid(row=0, column=1, sticky="ew", padx=(0, pad), pady=0)

    def _on_focus_lost():
        raw = entry_var.get()
        display = _OFFSET_HELPER.format_display(raw)
        entry_var.set(display)
        t, l, b, r = _OFFSET_HELPER.parse(raw)
        ConfigBinding.set_config_value(_BAG_OFFSET_KEYS[0], t)
        ConfigBinding.set_config_value(_BAG_OFFSET_KEYS[1], l)
        ConfigBinding.set_config_value(_BAG_OFFSET_KEYS[2], b)
        ConfigBinding.set_config_value(_BAG_OFFSET_KEYS[3], r)
        queue_config_save()

    entry.bind("<FocusOut>", lambda e: _on_focus_lost())
    entry.bind("<Return>", lambda e: _on_focus_lost())


def _create_automation_section(block: tk.Frame) -> None:
    """Two columns: each cell = checkbox + optional dropdown only.
    When has_menu: no separate label; dropdown values are the only place for option meaning (e.g. Keep Primal/Keep Ancient+)."""
    pad = _PAD
    auto_functions: List[Tuple[str, str, bool, bool, Any, Optional[str]]] = [
        (
            "auxiliary_panel.blood_shard_enabled",
            "macro_configs.auxiliary_config.blood_shard.enabled",
            False, True,
            {
                "menu_config_key": "macro_configs.auxiliary_config.blood_shard.type",
                "menu_items": [
                    ("auxiliary_panel.blood_shard_type_weapon", "weapon"),
                    ("auxiliary_panel.blood_shard_type_armor", "armor"),
                    ("auxiliary_panel.blood_shard_type_jewelry", "jewelry"),
                    ("auxiliary_panel.blood_shard_type_helmet", "helmet"),
                    ("auxiliary_panel.blood_shard_type_gloves", "gloves"),
                    ("auxiliary_panel.blood_shard_type_boots", "boots"),
                ],
                "menu_default": "weapon",
            },
            "auxiliary_panel.debug_blood_shard",
        ),
        ("auxiliary_panel.quick_pickup_enabled", "macro_configs.auxiliary_config.quick_pickup.enabled", False, False, None, None),
        ("auxiliary_panel.blacksmith_enabled", "macro_configs.auxiliary_config.blacksmith.enabled", False, False, None, None),
        (
            "auxiliary_panel.kanai_reforge_enabled",
            "macro_configs.auxiliary_config.kanai_reforge.enabled", False, True,
            {
                "menu_config_key": "macro_configs.auxiliary_config.kanai_reforge.mode",
                "menu_items": [
                    ("auxiliary_panel.kanai_reforge_until_ancient", "until_ancient"),
                    ("auxiliary_panel.kanai_reforge_double_crit", "double_crit"),
                    ("auxiliary_panel.kanai_reforge_double_crit_ancient", "double_crit_ancient"),
                ],
                "menu_default": "until_ancient",
            },
            None,
        ),
        ("auxiliary_panel.kanai_upgrade_enabled", "macro_configs.auxiliary_config.kanai_upgrade.enabled", False, False, None, None),
        (
            "auxiliary_panel.kanai_convert_enabled",
            "macro_configs.auxiliary_config.kanai_convert.enabled", False, True,
            {
                "menu_config_key": "macro_configs.auxiliary_config.kanai_convert.material",
                "menu_items": [
                    ("auxiliary_panel.kanai_convert_forgotten_soul", "forgotten_soul"),
                    ("auxiliary_panel.kanai_convert_veiled_crystal", "veiled_crystal"),
                    ("auxiliary_panel.kanai_convert_arcane_dust", "arcane_dust"),
                ],
                "menu_default": "forgotten_soul",
            },
            None,
        ),
        # Auto salvage: checkbox = feature name only; keep policy (Keep Ancient+/Keep Primal) only in dropdown, no separate label
        (
            "auxiliary_panel.auto_salvage_enabled",
            "macro_configs.auxiliary_config.auto_salvage.enabled", False, True,
            {
                "menu_config_key": "macro_configs.auxiliary_config.auto_salvage.keep",
                "menu_items": [
                    ("auxiliary_panel.auto_salvage_keep_ancient_plus", "keep_ancient_plus"),
                    ("auxiliary_panel.auto_salvage_keep_primal", "keep_primal"),
                ],
                "menu_default": "keep_ancient_plus",
            },
            None,
        ),
        ("auxiliary_panel.drop_equipment_enabled", "macro_configs.auxiliary_config.drop_equipment.enabled", False, False, None, None),
        ("auxiliary_panel.sound_feedback", "macro_configs.auxiliary_config.sound_feedback", True, False, None, None),
        ("auxiliary_panel.smart_pause", "macro_configs.auxiliary_config.smart_pause", True, False, None, None),
    ]

    for idx, (i18n_key, config_key, default, has_menu, menu_config, _) in enumerate(auto_functions):
        row = 1 + idx // 2
        col = idx % 2
        cell = tk.Frame(block, bg=UnifiedStyles.COLORS["bg_secondary"])
        cell.grid(row=row, column=col, sticky="nsw", padx=pad, pady=1)
        cell.grid_columnconfigure(1, weight=1)

        feature_label = i18n_manager.get_ui_text(i18n_key)
        # Rows with dropdown: checkbox has no text (checkbox itself = on/off); label only in dropdown options
        checkbox_text = "" if (has_menu and menu_config) else feature_label
        check = ConfigBinding.create_checkbox_binding(
            cell, config_key, text=checkbox_text, default_value=default,
            bg=UnifiedStyles.COLORS["bg_secondary"], fg=UnifiedStyles.COLORS["text_primary"],
            selectcolor=UnifiedStyles.COLORS["bg_tertiary"],
            activebackground=UnifiedStyles.COLORS["bg_secondary"], activeforeground=UnifiedStyles.COLORS["text_primary"],
            wraplength=100,
        )
        check.grid(row=0, column=0, sticky="w", padx=(0, pad), pady=0)

        opts = tk.Frame(cell, bg=UnifiedStyles.COLORS["bg_secondary"])
        opts.grid(row=0, column=1, sticky="w", padx=0, pady=0)
        if has_menu and menu_config:
            menu_items = menu_config["menu_items"]
            # Label in dropdown: each option = "feature option" (e.g. "Blood shard weapon", "Auto salvage Keep Primal")
            display_texts = [feature_label + " " + i18n_manager.get_ui_text(item[0]) for item in menu_items]
            reverse_mapping = {item[1]: item[0] for item in menu_items}
            config_parts = menu_config["menu_config_key"].split(".")
            current_value = CONFIG
            for part in config_parts:
                if not isinstance(current_value, dict):
                    current_value = menu_config["menu_default"]
                    break
                current_value = current_value.get(part, menu_config["menu_default"])
            default_value = menu_config.get("menu_default")
            if isinstance(current_value, str) and current_value in reverse_mapping:
                current_display = feature_label + " " + i18n_manager.get_ui_text(reverse_mapping[current_value])
            else:
                opt_text = (i18n_manager.get_ui_text(reverse_mapping[default_value]) if default_value and default_value in reverse_mapping else (i18n_manager.get_ui_text(menu_items[0][0]) if menu_items else ""))
                current_display = feature_label + " " + opt_text
            count_config_key = menu_config.get("count_config_key")
            if count_config_key:
                parts = count_config_key.split(".")
                cur = CONFIG
                for p in parts:
                    cur = cur.get(p, 15) if isinstance(cur, dict) else 15
                count_val = int(cur) if isinstance(cur, (int, float)) else 15
                count_var = tk.IntVar(value=max(1, min(999, count_val)))
                sp = tk.Spinbox(opts, from_=1, to=999, width=3, textvariable=count_var,
                                bg=UnifiedStyles.COLORS["input_bg"], fg=UnifiedStyles.COLORS["input_text"], font=UnifiedStyles.FONTS["input"])
                sp.pack(side=tk.LEFT, padx=(0, 2))

                def _on_count(key=count_config_key):
                    s = str(count_var.get()).strip()
                    v = max(1, min(999, int(s) if s.isdigit() else 15))
                    pts = key.split(".")
                    obj = CONFIG
                    for part in pts[:-1]:
                        if part not in obj or not isinstance(obj.get(part), dict):
                            obj[part] = {}
                        obj = obj[part]
                    obj[pts[-1]] = v
                    queue_config_save()
                count_var.trace_add("write", lambda *a: _on_count())
                sp.bind("<FocusOut>", lambda e: _on_count())

            menu_var = var_str(block, current_display)
            combo = ThemedCombobox.create(opts, textvariable=menu_var, values=display_texts, state="readonly", width=_COMBO_W)
            combo.pack(side=tk.LEFT)

            def _on_select(event, key=menu_config["menu_config_key"], items=menu_items, mv=menu_var, fl=feature_label):
                display_text = mv.get()
                internal_value = None
                for ik, value in items:
                    if fl + " " + i18n_manager.get_ui_text(ik) == display_text:
                        internal_value = value
                        break
                if internal_value is None:
                    internal_value = items[0][1]
                pts = key.split(".")
                config_obj = CONFIG
                for part in pts[:-1]:
                    if not isinstance(config_obj, dict):
                        o = CONFIG
                        for p in pts[:-1]:
                            if not isinstance(o.get(p), dict):
                                o[p] = {}
                            o = o[p]
                        o[pts[-1]] = internal_value
                        queue_config_save()
                        return
                    if part not in config_obj:
                        config_obj[part] = {}
                    config_obj = config_obj[part]
                if isinstance(config_obj, dict):
                    config_obj[pts[-1]] = internal_value
                queue_config_save()
            combo.bind("<<ComboboxSelected>>", _on_select)
