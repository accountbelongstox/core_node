#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CONFIG Binding Utility
通用的UI控件与CONFIG数据绑定工具
支持复选框、下拉框、输入框等控件的自动联动
"""

import tkinter as tk
from tkinter import ttk
from typing import Any, Callable, Optional, Union, Dict, List
from providor.providor_index import CONFIG, save_config
from providor.common_imports import ColorPrint
from d3utils.i18n_manager import i18n_manager


class ConfigBinding:
    """CONFIG数据绑定工具类"""

    # Registry to track all bindings: {key_path: [var1, var2, ...]}
    _bindings: Dict[str, List[tk.Variable]] = {}

    # Flag to prevent recursive updates
    _updating: bool = False

    @staticmethod
    def _register_binding(key_path: str, var: tk.Variable):
        """Register a variable binding for a config key"""
        if key_path not in ConfigBinding._bindings:
            ConfigBinding._bindings[key_path] = []
        ConfigBinding._bindings[key_path].append(var)
        ColorPrint.debug(f"[ConfigBinding] Registered binding for '{key_path}'")

    @staticmethod
    def _update_bindings(key_path: str, new_value: Any):
        """Update all registered bindings for a config key"""
        if ConfigBinding._updating:
            return

        ConfigBinding._updating = True
        try:
            if key_path in ConfigBinding._bindings:
                for var in ConfigBinding._bindings[key_path]:
                    current_value = var.get()
                    if str(current_value) != str(new_value):
                        var.set(str(new_value))
                        ColorPrint.debug(f"[ConfigBinding] Updated UI binding for '{key_path}' to '{new_value}'")
        finally:
            ConfigBinding._updating = False

    @staticmethod
    def get_config_value(key_path: str, default_value: Any = None) -> Any:
        """
        根据键路径获取CONFIG中的值
        
        Args:
            key_path: 键路径，如 "ui_analysis.bag_offset.left"
            default_value: 默认值
            
        Returns:
            配置值
        """
        try:
            keys = key_path.split('.')
            value = CONFIG
            
            for key in keys:
                if isinstance(value, dict) and key in value:
                    value = value[key]
                else:
                    return default_value
                    
            return value
        except Exception as e:
            ColorPrint.red(f"[ConfigBinding] Error getting config value for '{key_path}': {e}")
            return default_value
    
    @staticmethod
    def set_config_value(key_path: str, value: Any) -> bool:
        """
        根据键路径设置CONFIG中的值
        
        Args:
            key_path: 键路径，如 "ui_analysis.bag_offset.left"
            value: 要设置的值
            
        Returns:
            是否设置成功
        """
        try:
            keys = key_path.split('.')
            config_ref = CONFIG
            
            # 确保路径存在
            for key in keys[:-1]:
                if key not in config_ref:
                    config_ref[key] = {}
                config_ref = config_ref[key]
            
            # 设置最终值
            config_ref[keys[-1]] = value

            # 保存配置
            save_config()

            ColorPrint.green(f"[ConfigBinding] Updated config '{key_path}' = {value}")

            # Update all UI bindings for this key
            ConfigBinding._update_bindings(key_path, value)

            # 特殊处理：语言切换
            if key_path == "ui_settings.current_language":
                i18n_manager.set_language(value)
                ColorPrint.blue(f"[ConfigBinding] Triggered language change to: {value}")

            return True
            
        except Exception as e:
            ColorPrint.red(f"[ConfigBinding] Error setting config value for '{key_path}': {e}")
            return False
    
    @staticmethod
    def create_input_binding(parent: tk.Widget, key_path: str, default_value: str = "", 
                           width: int = 20, **kwargs) -> tk.Entry:
        """
        创建与CONFIG绑定的输入框
        
        Args:
            parent: 父控件
            key_path: CONFIG键路径
            default_value: 默认值
            width: 输入框宽度
            **kwargs: 其他Entry参数
            
        Returns:
            绑定的Entry控件
        """
        # 获取当前配置值
        current_value = ConfigBinding.get_config_value(key_path, default_value)

        # 创建变量
        var = tk.StringVar(value=str(current_value))

        # Register binding for two-way sync
        ConfigBinding._register_binding(key_path, var)

        # 创建输入框
        entry = tk.Entry(parent, textvariable=var, width=width, **kwargs)

        # 绑定变化事件 (UI -> CONFIG)
        def on_change(*args):
            ConfigBinding.set_config_value(key_path, var.get())

        var.trace_add('write', on_change)

        return entry
    
    @staticmethod
    def create_checkbox_binding(parent: tk.Widget, key_path: str, text: str = "", 
                              default_value: bool = False, **kwargs) -> tk.Checkbutton:
        """
        创建与CONFIG绑定的复选框
        
        Args:
            parent: 父控件
            key_path: CONFIG键路径
            text: 复选框文本
            default_value: 默认值
            **kwargs: 其他Checkbutton参数
            
        Returns:
            绑定的Checkbutton控件
        """
        # 获取当前配置值
        current_value = ConfigBinding.get_config_value(key_path, default_value)

        # 创建变量
        var = tk.BooleanVar(value=bool(current_value))

        # Register binding for two-way sync
        ConfigBinding._register_binding(key_path, var)

        # 创建复选框
        checkbox = tk.Checkbutton(parent, text=text, variable=var, **kwargs)

        # 绑定变化事件 (UI -> CONFIG)
        def on_change(*args):
            ConfigBinding.set_config_value(key_path, var.get())

        var.trace_add('write', on_change)

        return checkbox
    
    @staticmethod
    def create_combobox_binding(parent: tk.Widget, key_path: str, values: List[str], 
                              default_value: str = "", width: int = 15, **kwargs) -> ttk.Combobox:
        """
        创建与CONFIG绑定的下拉框
        
        Args:
            parent: 父控件
            key_path: CONFIG键路径
            values: 下拉选项列表
            default_value: 默认值
            width: 下拉框宽度
            **kwargs: 其他Combobox参数
            
        Returns:
            绑定的Combobox控件
        """
        # 获取当前配置值
        current_value = ConfigBinding.get_config_value(key_path, default_value)

        # 创建变量
        var = tk.StringVar(value=str(current_value))

        # Register binding for two-way sync
        ConfigBinding._register_binding(key_path, var)

        # 创建下拉框
        combobox = ttk.Combobox(parent, textvariable=var, values=values,
                               width=width, state='readonly', **kwargs)

        # 绑定变化事件 (UI -> CONFIG)
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
        创建与CONFIG绑定的数字选择框
        
        Args:
            parent: 父控件
            key_path: CONFIG键路径
            from_: 最小值
            to: 最大值
            increment: 步长
            default_value: 默认值
            width: 控件宽度
            **kwargs: 其他Spinbox参数
            
        Returns:
            绑定的Spinbox控件
        """
        # 获取当前配置值
        current_value = ConfigBinding.get_config_value(key_path, default_value)

        # 创建变量
        var = tk.StringVar(value=str(current_value))

        # Register binding for two-way sync
        ConfigBinding._register_binding(key_path, var)

        # 创建数字选择框
        spinbox = tk.Spinbox(parent, textvariable=var, from_=from_, to=to,
                           increment=increment, width=width, **kwargs)

        # 绑定变化事件 (UI -> CONFIG)
        def on_change(*args):
            value_str = var.get()
            if isinstance(increment, int):
                ConfigBinding.set_config_value(key_path, int(value_str) if value_str.isdigit() else default_value)
            else:
                try:
                    ConfigBinding.set_config_value(key_path, float(value_str))
                except ValueError:
                    ConfigBinding.set_config_value(key_path, default_value)

        var.trace_add('write', on_change)

        return spinbox
    
    @staticmethod
    def bind_existing_widget(widget: tk.Widget, key_path: str, 
                           value_getter: Callable = None, 
                           value_setter: Callable = None,
                           event: str = None) -> None:
        """
        为现有控件绑定CONFIG联动
        
        Args:
            widget: 要绑定的控件
            key_path: CONFIG键路径
            value_getter: 获取控件值的函数
            value_setter: 设置控件值的函数
            event: 监听的事件名称
        """
        # 默认的获取和设置函数
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
        
        # 设置初始值
        initial_value = ConfigBinding.get_config_value(key_path)
        if initial_value is not None:
            try:
                value_setter(initial_value)
            except Exception as e:
                ColorPrint.red(f"[ConfigBinding] Error setting initial value: {e}")
        
        # 绑定变化事件
        def on_change(*args):
            try:
                value = value_getter()
                ConfigBinding.set_config_value(key_path, value)
            except Exception as e:
                ColorPrint.red(f"[ConfigBinding] Error in change handler: {e}")
        
        # 根据控件类型绑定事件
        if event:
            widget.bind(event, on_change)
        elif isinstance(widget, (tk.Entry, tk.Text)):
            widget.bind('<KeyRelease>', on_change)
        elif isinstance(widget, (ttk.Combobox,)):
            widget.bind('<<ComboboxSelected>>', on_change)
        elif isinstance(widget, (tk.Checkbutton,)):
            widget.configure(command=on_change)
