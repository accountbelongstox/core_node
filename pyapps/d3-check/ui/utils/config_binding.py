#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CONFIG Binding Utility
Generic UI control to CONFIG data binding. Supports checkbox, combobox, entry, etc. with automatic sync.
"""

import tkinter as tk
from tkinter import ttk
from typing import Any, Callable, Optional, Union, Dict, List
from providor.providor_index import CONFIG, get_config_value_safe, set_config_value_async
from pycore.pyfoundations.color_print import ColorPrint
from share.values.config_change_hub import get_config_change_hub
from d3utils.i18n_manager import i18n_manager
from .tk_variables import var_str, var_bool


def _parse_float_safe(value_str: str, default: float) -> float:
    """Parse float from string without raising. Returns default when invalid."""
    s = str(value_str).strip()
    if not s or s in ("-", ".", "-."):
        return default
    if s.count(".") > 1:
        return default
    minus = 1 if s.startswith("-") else 0
    rest = s[minus:].replace(".", "", 1)
    if not rest.isdigit():
        return default
    return float(s)


class ConfigBinding:
    """CONFIG binding utility class."""

    # Registry to track all bindings: {key_path: [var1, var2, ...]}
    _bindings: Dict[str, List[tk.Variable]] = {}

    # Flag to prevent recursive updates
    _updating: bool = False

    @staticmethod
    def _register_binding(key_path: str, var: tk.Variable):
        """Register a variable binding for a config key. Use log_registration_summary() once after UI build to log all."""
        if key_path not in ConfigBinding._bindings:
            ConfigBinding._bindings[key_path] = []
        ConfigBinding._bindings[key_path].append(var)

    @staticmethod
    def log_registration_summary():
        """Log one line with total bindings count. Call after all panels created."""
        n = len(ConfigBinding._bindings)
        if n == 0:
            return
        ColorPrint.debug(f"[ConfigBinding] Registered {n} bindings")

    @staticmethod
    def _update_bindings(key_path: str, new_value: Any):
        """Update all registered bindings for a config key. BooleanVar gets bool; others get str."""
        if ConfigBinding._updating:
            return

        ConfigBinding._updating = True
        try:
            if key_path not in ConfigBinding._bindings:
                return
            for var in ConfigBinding._bindings[key_path]:
                current_value = var.get()
                if isinstance(var, tk.BooleanVar):
                    b = new_value if isinstance(new_value, bool) else (str(new_value).strip().lower() in ("1", "true", "yes"))
                    if bool(current_value) != b:
                        var.set(b)
                else:
                    if str(current_value) != str(new_value):
                        var.set(str(new_value))
        finally:
            ConfigBinding._updating = False

    @staticmethod
    def get_config_value(key_path: str, default_value: Any = None) -> Any:
        """
        Get value from CONFIG by key path (thread-safe for main and D3 extension thread).
        """
        return get_config_value_safe(key_path, default_value)

    @staticmethod
    def set_config_value(key_path: str, value: Any) -> bool:
        """
        Set value in CONFIG by key path. Uses async update so UI never blocks on config worker or file I/O.
        Only notifies config_change_hub when this is a direct write (not re-entry from _update_bindings trace).
        """
        if ConfigBinding._updating:
            set_config_value_async(key_path, value)
            ConfigBinding._update_bindings(key_path, value)
            return True
        set_config_value_async(key_path, value)
        ColorPrint.green(f"[ConfigBinding] Updated config '{key_path}' = {value}")
        ConfigBinding._update_bindings(key_path, value)
        if key_path == "ui_settings.current_language":
            i18n_manager.set_language(value)
            ColorPrint.blue(f"[ConfigBinding] Triggered language change to: {value}")
        get_config_change_hub().notify_config_changed(key_path)
        return True
    
    @staticmethod
    def create_input_binding(parent: tk.Widget, key_path: str, default_value: str = "", 
                           width: int = 20, **kwargs) -> tk.Entry:
        """
        Create Entry bound to CONFIG.

        Args:
            parent: Parent widget
            key_path: CONFIG key path
            default_value: Default value
            width: Entry width
            **kwargs: Other Entry args

        Returns:
            Bound Entry widget
        """
        current_value = ConfigBinding.get_config_value(key_path, default_value)
        var = var_str(parent, str(current_value))
        ConfigBinding._register_binding(key_path, var)
        entry = tk.Entry(parent, textvariable=var, width=width, **kwargs)
        def on_change(*args):
            ConfigBinding.set_config_value(key_path, var.get())

        var.trace_add('write', on_change)

        return entry

    @staticmethod
    def create_input_binding_with_initial(parent: tk.Widget, key_path: str, initial_value: str,
                                         default_value: str = "", width: int = 20, **kwargs) -> tk.Entry:
        """Create Entry bound to CONFIG using pre-fetched initial_value (no main-thread config read). Use when building UI from a config snapshot fetched in a worker thread."""
        var = var_str(parent, str(initial_value))
        ConfigBinding._register_binding(key_path, var)
        entry = tk.Entry(parent, textvariable=var, width=width, **kwargs)
        def on_change(*args):
            ConfigBinding.set_config_value(key_path, var.get())
        var.trace_add('write', on_change)
        return entry

    @staticmethod
    def create_checkbox_binding(parent: tk.Widget, key_path: str, text: str = "", 
                              default_value: bool = False, **kwargs) -> tk.Checkbutton:
        """
        Create Checkbutton bound to CONFIG.

        Args:
            parent: Parent widget
            key_path: CONFIG key path
            text: Checkbutton label
            default_value: Default value
            **kwargs: Other Checkbutton args

        Returns:
            Bound Checkbutton widget
        """
        current_value = ConfigBinding.get_config_value(key_path, default_value)
        var = var_bool(parent, bool(current_value))
        ConfigBinding._register_binding(key_path, var)
        checkbox = tk.Checkbutton(parent, text=text, variable=var, **kwargs)
        def on_change(*args):
            ConfigBinding.set_config_value(key_path, var.get())

        var.trace_add('write', on_change)

        return checkbox

    @staticmethod
    def create_checkbox_binding_with_initial(parent: tk.Widget, key_path: str, initial_value: bool,
                                            text: str = "", default_value: bool = False, **kwargs) -> tk.Checkbutton:
        """Create Checkbutton bound to CONFIG using pre-fetched initial_value (no main-thread config read)."""
        var = var_bool(parent, bool(initial_value))
        ConfigBinding._register_binding(key_path, var)
        checkbox = tk.Checkbutton(parent, text=text, variable=var, **kwargs)
        def on_change(*args):
            ConfigBinding.set_config_value(key_path, var.get())
        var.trace_add('write', on_change)
        return checkbox

    @staticmethod
    def create_combobox_binding(parent: tk.Widget, key_path: str, values: List[str], 
                              default_value: str = "", width: int = 15, **kwargs) -> ttk.Combobox:
        """
        Create Combobox bound to CONFIG.

        Args:
            parent: Parent widget
            key_path: CONFIG key path
            values: Option list
            default_value: Default value
            width: Combobox width
            **kwargs: Other Combobox args

        Returns:
            Bound Combobox widget
        """
        current_value = ConfigBinding.get_config_value(key_path, default_value)
        var = var_str(parent, str(current_value))
        ConfigBinding._register_binding(key_path, var)
        combobox = ttk.Combobox(parent, textvariable=var, values=values,
                               width=width, state='readonly', **kwargs)
        def on_change(*args):
            ConfigBinding.set_config_value(key_path, var.get())

        var.trace_add('write', on_change)

        return combobox
    
    @staticmethod
    def create_spinbox_binding(parent: tk.Widget, key_path: str, from_: Union[int, float] = 0, 
                             to: Union[int, float] = 100, increment: Union[int, float] = 1,
                             default_value: Union[int, float] = 0, width: int = 10, 
                             **kwargs) -> tk.Spinbox:
        """
        Create Spinbox bound to CONFIG.

        Args:
            parent: Parent widget
            key_path: CONFIG key path
            from_: Min value
            to: Max value
            increment: Step
            default_value: Default value
            width: Spinbox width
            **kwargs: Other Spinbox args

        Returns:
            Bound Spinbox widget
        """
        current_value = ConfigBinding.get_config_value(key_path, default_value)
        var = var_str(parent, str(current_value))
        ConfigBinding._register_binding(key_path, var)
        spinbox = tk.Spinbox(parent, textvariable=var, from_=from_, to=to,
                           increment=increment, width=width, **kwargs)
        def on_change(*args):
            value_str = var.get()
            if isinstance(increment, int):
                ConfigBinding.set_config_value(key_path, int(value_str) if value_str.isdigit() else default_value)
            else:
                ConfigBinding.set_config_value(key_path, _parse_float_safe(value_str, default_value))

        var.trace_add('write', on_change)

        return spinbox

    @staticmethod
    def create_spinbox_binding_with_initial(parent: tk.Widget, key_path: str, initial_value: Union[int, float, str],
                                           from_: Union[int, float] = 0, to: Union[int, float] = 100,
                                           increment: Union[int, float] = 1, default_value: Union[int, float] = 0,
                                           width: int = 10, **kwargs) -> tk.Spinbox:
        """Create Spinbox bound to CONFIG using pre-fetched initial_value (no main-thread config read)."""
        var = var_str(parent, str(initial_value))
        ConfigBinding._register_binding(key_path, var)
        spinbox = tk.Spinbox(parent, textvariable=var, from_=from_, to=to,
                             increment=increment, width=width, **kwargs)
        def on_change(*args):
            value_str = var.get()
            if isinstance(increment, int):
                ConfigBinding.set_config_value(key_path, int(value_str) if value_str.isdigit() else default_value)
            else:
                ConfigBinding.set_config_value(key_path, _parse_float_safe(value_str, default_value))
        var.trace_add('write', on_change)
        return spinbox

    @staticmethod
    def bind_existing_widget(widget: tk.Widget, key_path: str, 
                           value_getter: Callable = None, 
                           value_setter: Callable = None,
                           event: str = None) -> None:
        """
        Bind existing widget to CONFIG.

        Args:
            widget: Widget to bind
            key_path: CONFIG key path
            value_getter: Function to get widget value
            value_setter: Function to set widget value
            event: Event name to listen
        """
        if value_getter is None:
            if hasattr(widget, 'get'):
                value_getter = widget.get
            else:
                raise ValueError("Widget must have 'get' method or provide value_getter")
        
        if value_setter is None:
            if hasattr(widget, 'set'):
                value_setter = widget.set
            elif hasattr(widget, 'configure'):
                value_setter = lambda v: widget.configure(text=v)
            else:
                raise ValueError("Widget must have 'set' method or provide value_setter")
        
        initial_value = ConfigBinding.get_config_value(key_path)
        if initial_value is not None:
            value_setter(initial_value)
        def on_change(*args):
            value = value_getter()
            ConfigBinding.set_config_value(key_path, value)
        
        # Bind event by widget type
        if event:
            widget.bind(event, on_change)
        elif isinstance(widget, (tk.Entry, tk.Text)):
            widget.bind('<KeyRelease>', on_change)
        elif isinstance(widget, (ttk.Combobox,)):
            widget.bind('<<ComboboxSelected>>', on_change)
        elif isinstance(widget, (tk.Checkbutton,)):
            widget.configure(command=on_change)
