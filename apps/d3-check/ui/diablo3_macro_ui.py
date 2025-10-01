#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo 3 Skill Macro UI Library
Creates a UI similar to the Diablo 3 Skill Clicker application
"""

import tkinter as tk
from tkinter import ttk, messagebox
import threading
import time
import sys
import os
import datetime
from typing import Dict, List, Optional, Callable
from pathlib import Path

# Add ncore path for color_print
ncore_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "ncore")
sys.path.insert(0, ncore_path)
from pytools.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG, save_config, CONFIG_USER_PATH

# Import panels
from .panels.main_functions_panel import MainFunctionsPanel
from .panels.auxiliary_functions_panel import AuxiliaryFunctionsPanel
from .panels.log_panel import LogPanel
from .log_output_widget import LogOutputWidget

# Import screenshot controller
from screenshot_controller import main as screenshot_main


class Diablo3MacroUI:
    """Diablo 3 Skill Macro UI Class"""
    
    def __init__(self, initial_config='config1'):
        self.root = tk.Tk()
        self.root.title("暗黑3技能连点器 v1.4.230222 by Oldsand")
        self.root.geometry("1000x1000")
        self.root.configure(bg='#2b2b2b')
        
        # Current configuration
        self.current_config = initial_config
        
        # UI variables
        self.skill_vars = {}
        self.strategy_vars = {}
        self.interval_vars = {}
        self.delay_vars = {}
        self.random_delay_vars = {}
        
        # Callbacks
        self.on_macro_start: Optional[Callable] = None
        self.on_macro_stop: Optional[Callable] = None
        self.on_config_change: Optional[Callable] = None
        self.on_skill_config_switch: Optional[Callable] = None
        
        self._create_ui()
        self._setup_styles()
    
    def _get_current_skill_config(self):
        """Get current skill configuration from CONFIG"""
        return CONFIG.get('macro_configs', {}).get('skill_configs', {}).get(self.current_config, {})
    
    def _get_auxiliary_config(self):
        """Get auxiliary configuration from CONFIG"""
        return CONFIG.get('macro_configs', {}).get('auxiliary_config', {})
    
    def _create_ui(self):
        """Create the main UI"""
        # Title bar
        self._create_title_bar()
        
        # Main tabbed interface
        self._create_main_tabs()
        
        # Bottom bar
        self._create_bottom_bar()
    
    def _create_main_tabs(self):
        """Create main tabbed interface"""
        # Create notebook for main tabs
        self.main_notebook = ttk.Notebook(self.root)
        self.main_notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        # Load last selected tab from config
        self._load_last_tab()
        
        # Create tab frames
        self._create_table1_tab()  # Main functions
        self._create_table2_tab()  # Auxiliary functions
        self._create_table3_tab()  # Test and logs
        
        # Bind tab change event
        self.main_notebook.bind('<<NotebookTabChanged>>', self._on_tab_changed)
        
        # Set initial tab
        self.main_notebook.select(self.last_selected_tab)
    
    def _create_table1_tab(self):
        """Create TABLE1 - Main functions tab"""
        self.table1_frame = ttk.Frame(self.main_notebook)
        self.main_notebook.add(self.table1_frame, text="主要功能")
        
        # Create main functions panel
        self.main_functions_panel = MainFunctionsPanel(self.table1_frame, self.current_config)
        
        # Set callbacks
        self.main_functions_panel.set_config_change_callback(self.on_config_change)
        self.main_functions_panel.set_skill_config_switch_callback(self.on_skill_config_switch)
    
    def _create_table2_tab(self):
        """Create TABLE2 - Auxiliary functions tab"""
        self.table2_frame = ttk.Frame(self.main_notebook)
        self.main_notebook.add(self.table2_frame, text="辅助功能")
        
        # Create auxiliary functions panel
        self.auxiliary_functions_panel = AuxiliaryFunctionsPanel(self.table2_frame)
        
        # Set callbacks
        self.auxiliary_functions_panel.set_config_change_callback(self.on_config_change)
    
    def _create_table3_tab(self):
        """Create TABLE3 - Test and logs tab"""
        self.table3_frame = ttk.Frame(self.main_notebook)
        self.main_notebook.add(self.table3_frame, text="测试日志")
        
        # Create log panel
        self.log_panel = LogPanel(self.table3_frame)
        
        # Set callbacks
        self.log_panel.set_test_function_callback(self._on_test_function)
    
    def _on_test_function(self, test_number):
        """Handle test function callback"""
        try:
            ColorPrint.blue(f"[UI] Test function {test_number} called")
            # Add any additional test logic here
        except Exception as e:
            ColorPrint.red(f"[UI] Test function error: {e}")
    
    def on_config_change(self):
        """Handle configuration change"""
        try:
            ColorPrint.blue("[UI] Configuration changed")
            # Add configuration change logic here
        except Exception as e:
            ColorPrint.red(f"[UI] Configuration change error: {e}")
    
    def on_skill_config_switch(self, config_name):
        """Handle skill configuration switch"""
        try:
            self.current_config = config_name
            ColorPrint.blue(f"[UI] Switched to skill configuration: {config_name}")
            # Add skill config switch logic here
        except Exception as e:
            ColorPrint.red(f"[UI] Skill config switch error: {e}")
    
    def set_bag_correction_image(self, image_input, display_size=(200, 150)):
        """
        Set bag correction image with flexible input support
        
        Args:
            image_input: Can be either:
                - str: Path to image file
                - PIL.Image: Already loaded PIL Image object
                - numpy.ndarray: OpenCV image array
                - None: Clear the image
            display_size: Tuple of (width, height) for display size
        """
        try:
            if hasattr(self, 'auxiliary_functions_panel'):
                return self.auxiliary_functions_panel.set_bag_correction_image(image_input, display_size)
            else:
                ColorPrint.red("[UI] Auxiliary functions panel not available")
                return False
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to set bag correction image: {e}")
            return False
    
    def get_bag_correction_image(self):
        """Get current bag correction image"""
        try:
            if hasattr(self, 'auxiliary_functions_panel'):
                return self.auxiliary_functions_panel.get_bag_correction_image()
            else:
                ColorPrint.red("[UI] Auxiliary functions panel not available")
                return None
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to get bag correction image: {e}")
            return None
    
    def capture_bag_correction_image(self, screenshot_callback=None):
        """Capture bag correction image from game"""
        try:
            if hasattr(self, 'auxiliary_functions_panel'):
                return self.auxiliary_functions_panel.capture_bag_correction_image(screenshot_callback)
            else:
                ColorPrint.red("[UI] Auxiliary functions panel not available")
                return False
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to capture bag correction image: {e}")
            return False
    
    def generate_bag_correction_image(self):
        """Generate bag correction image using GameAssistantController"""
        try:
            if hasattr(self, 'auxiliary_functions_panel'):
                return self.auxiliary_functions_panel._generate_bag_correction_image()
            else:
                ColorPrint.red("[UI] Auxiliary functions panel not available")
                return False
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to generate bag correction image: {e}")
            return False
    
    def _load_last_tab(self):
        """Load last selected tab from configuration"""
        try:
            last_tab = CONFIG.get('ui_settings', {}).get('last_selected_tab', 0)
            self.last_selected_tab = last_tab
        except Exception as e:
            ColorPrint.yellow(f"[UI] Failed to load last tab: {e}")
            self.last_selected_tab = 0
    
    def _on_tab_changed(self, event=None):
        """Handle tab change event"""
        try:
            selected_tab = self.main_notebook.index(self.main_notebook.select())
            self.last_selected_tab = selected_tab
            
            # Save to configuration
            CONFIG['ui_settings'] = CONFIG.get('ui_settings', {})
            CONFIG['ui_settings']['last_selected_tab'] = selected_tab
            save_config()
            ColorPrint.blue(f"[UI] Tab changed to: {selected_tab}")
        except Exception as e:
            ColorPrint.red(f"[UI] Error handling tab change: {e}")
    
    def _create_title_bar(self):
        """Create title bar"""
        title_frame = ttk.Frame(self.root)
        title_frame.pack(fill=tk.X, padx=5, pady=5)
        
        # Back arrow (placeholder)
        back_btn = ttk.Button(title_frame, text="←", width=3)
        back_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        # Title
        title_label = ttk.Label(title_frame, text="暗黑3技能连点器 v1.4.230222 by Oldsand", 
                               font=('Arial', 12, 'bold'))
        title_label.pack(side=tk.LEFT)
    
    def _create_config_tabs(self):
        """Create configuration tabs"""
        self.tab_frame = ttk.Frame(self.root)
        self.tab_frame.pack(fill=tk.X, padx=5, pady=(0, 5))
        
        self.tab_buttons = {}
        for i in range(1, 5):
            btn = ttk.Button(self.tab_frame, text=f"配置{i}", 
                           command=lambda c=f'config{i}': self._switch_config(c))
            btn.pack(side=tk.LEFT, padx=(0, 5))
            self.tab_buttons[f'config{i}'] = btn
        
        # Highlight current config
        self._update_tab_highlight()
    
    def _create_left_panel(self, parent=None):
        """Create left panel with skill settings"""
        if parent is None:
            parent = self.main_frame
            
        left_frame = ttk.LabelFrame(parent, text="按键宏设置", padding=10)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))
        
        # Skill settings table
        self._create_skill_table(left_frame)
        
        # Additional settings
        self._create_additional_settings(left_frame)
    
    def _create_basic_info_panel(self, parent):
        """Create basic info panel for TABLE1"""
        info_frame = ttk.LabelFrame(parent, text="基本信息", padding=10)
        info_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(5, 0))
        
        # Add basic information display
        ttk.Label(info_frame, text="当前配置信息:").pack(anchor=tk.W, pady=5)
        
        # Configuration info
        self.config_info_text = tk.Text(info_frame, height=15, width=30, wrap=tk.WORD)
        self.config_info_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # Update config info
        self._update_config_info()
    
    def _update_config_info(self):
        """Update configuration info display"""
        try:
            if hasattr(self, 'config_info_text'):
                
                config_file = Path(CONFIG_USER_PATH)
                info_text = f"""当前配置信息:
配置文件: {CONFIG_USER_PATH}
文件存在: {'是' if config_file.exists() else '否'}
文件大小: {config_file.stat().st_size if config_file.exists() else 0} 字节
可用配置: config1, config2, config3, config4

当前技能配置: {self.current_config}
"""
                self.config_info_text.delete(1.0, tk.END)
                self.config_info_text.insert(1.0, info_text)
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to update config info: {e}")
    
    def _create_auxiliary_panel(self, parent):
        """Create auxiliary functions panel for TABLE2"""
        # Move all auxiliary functions from the old right panel here
        self._create_right_panel(parent)
    
    def _create_skill_table(self, parent):
        """Create skill settings table"""
        # Table headers
        header_frame = ttk.Frame(parent)
        header_frame.pack(fill=tk.X, pady=(0, 5))
        
        headers = ["快捷键", "策略", "执行间隔 (毫秒)", "延迟 (毫秒)", "延迟随机"]
        for i, header in enumerate(headers):
            label = ttk.Label(header_frame, text=header, font=('Arial', 9, 'bold'))
            label.grid(row=0, column=i, padx=5, pady=2, sticky='ew')
        
        # Configure column weights
        for i in range(len(headers)):
            header_frame.columnconfigure(i, weight=1)
        
        # Skill rows
        skills = [
            ('技能一', 'skill1'),
            ('技能二', 'skill2'),
            ('技能三', 'skill3'),
            ('技能四', 'skill4'),
            ('左键技能', 'left_click'),
            ('右键技能', 'right_click')
        ]
        
        self.skill_frames = {}
        for row, (skill_name, skill_key) in enumerate(skills, 1):
            self._create_skill_row(parent, skill_name, skill_key, row)
    
    def _create_skill_row(self, parent, skill_name, skill_key, row):
        """Create a single skill row"""
        frame = ttk.Frame(parent)
        frame.pack(fill=tk.X, pady=2)
        self.skill_frames[skill_key] = frame
        
        # Skill name
        name_label = ttk.Label(frame, text=skill_name, width=8)
        name_label.pack(side=tk.LEFT, padx=(0, 5))
        
        # Get current skill config
        current_skill_config = self._get_current_skill_config()
        
        # Hotkey input
        hotkey_var = tk.StringVar(value=current_skill_config['skills'][skill_key]['key'])
        hotkey_entry = ttk.Entry(frame, textvariable=hotkey_var, width=8)
        hotkey_entry.pack(side=tk.LEFT, padx=5)
        self.skill_vars[f'{skill_key}_hotkey'] = hotkey_var
        
        # Strategy dropdown
        strategy_var = tk.StringVar(value=current_skill_config['skills'][skill_key]['strategy'])
        strategy_combo = ttk.Combobox(frame, textvariable=strategy_var, width=12, state='readonly')
        strategy_combo['values'] = ['禁用', '按住不放', '连点', '保持Buff']
        strategy_combo.pack(side=tk.LEFT, padx=5)
        self.strategy_vars[skill_key] = strategy_var
        
        # Interval spinbox
        interval_var = tk.IntVar(value=current_skill_config['skills'][skill_key]['interval'])
        interval_spin = ttk.Spinbox(frame, from_=50, to=10000, textvariable=interval_var, width=8)
        interval_spin.pack(side=tk.LEFT, padx=5)
        self.interval_vars[skill_key] = interval_var
        
        # Delay spinbox
        delay_var = tk.IntVar(value=current_skill_config['skills'][skill_key]['delay'])
        delay_spin = ttk.Spinbox(frame, from_=0, to=1000, textvariable=delay_var, width=8)
        delay_spin.pack(side=tk.LEFT, padx=5)
        self.delay_vars[skill_key] = delay_var
        
        # Random delay checkbox
        random_var = tk.BooleanVar(value=current_skill_config['skills'][skill_key]['random'])
        random_check = ttk.Checkbutton(frame, variable=random_var)
        random_check.pack(side=tk.LEFT, padx=5)
        self.random_delay_vars[skill_key] = random_var
    
    def _create_additional_settings(self, parent):
        """Create additional settings section"""
        # Quick switch
        switch_frame = ttk.LabelFrame(parent, text="快速切换至本配置", padding=5)
        switch_frame.pack(fill=tk.X, pady=(10, 5))
        
        switch_combo = ttk.Combobox(switch_frame, values=['无', 'F1', 'F2', 'F3', 'F4'], width=8)
        switch_combo.pack(side=tk.LEFT, padx=5)
        switch_combo.set('无')
        
        auto_start_var = tk.BooleanVar()
        auto_start_check = ttk.Checkbutton(switch_frame, text="切换后自动启动宏", variable=auto_start_var)
        auto_start_check.pack(side=tk.LEFT, padx=10)
        
        # Macro start method
        macro_frame = ttk.LabelFrame(parent, text="宏启动方式", padding=5)
        macro_frame.pack(fill=tk.X, pady=5)
        
        method_combo = ttk.Combobox(macro_frame, values=['懒人模式', '手动模式'], width=12)
        method_combo.pack(side=tk.LEFT, padx=5)
        method_combo.set('懒人模式')
        
        single_thread_var = tk.BooleanVar()
        single_thread_check = ttk.Checkbutton(macro_frame, text="使用单线程按键队列 (毫秒):", variable=single_thread_var)
        single_thread_check.pack(side=tk.LEFT, padx=10)
        
        queue_delay_spin = ttk.Spinbox(macro_frame, from_=50, to=1000, width=8)
        queue_delay_spin.pack(side=tk.LEFT, padx=5)
        queue_delay_spin.set(200)
        
        # Quick pause
        pause_frame = ttk.LabelFrame(parent, text="快速暂停", padding=5)
        pause_frame.pack(fill=tk.X, pady=5)
        
        pause_var = tk.BooleanVar()
        pause_check = ttk.Checkbutton(pause_frame, text="双击", variable=pause_var)
        pause_check.pack(side=tk.LEFT, padx=5)
        
        pause_key_combo = ttk.Combobox(pause_frame, values=['鼠标左键', '鼠标右键', '中键'], width=10)
        pause_key_combo.pack(side=tk.LEFT, padx=5)
        pause_key_combo.set('鼠标左键')
        
        ttk.Label(pause_frame, text="则暂停按键宏").pack(side=tk.LEFT, padx=5)
        
        pause_delay_spin = ttk.Spinbox(pause_frame, from_=500, to=3000, width=8)
        pause_delay_spin.pack(side=tk.LEFT, padx=5)
        pause_delay_spin.set(1500)
        
        ttk.Label(pause_frame, text="毫秒").pack(side=tk.LEFT, padx=2)
        
        # Movement assist
        move_frame = ttk.LabelFrame(parent, text="走位辅助", padding=5)
        move_frame.pack(fill=tk.X, pady=5)
        
        move_combo = ttk.Combobox(move_frame, values=['强制走位 (连点)', '智能走位', '禁用'], width=15)
        move_combo.pack(side=tk.LEFT, padx=5)
        move_combo.set('强制走位 (连点)')
        
        ttk.Label(move_frame, text="执行间隔 (毫秒):").pack(side=tk.LEFT, padx=10)
        
        move_interval_spin = ttk.Spinbox(move_frame, from_=50, to=1000, width=8)
        move_interval_spin.pack(side=tk.LEFT, padx=5)
        move_interval_spin.set(100)
        
        # Potion assist
        potion_frame = ttk.LabelFrame(parent, text="药水辅助", padding=5)
        potion_frame.pack(fill=tk.X, pady=5)
        
        potion_combo = ttk.Combobox(potion_frame, values=['保持药水CD', '智能药水', '禁用'], width=12)
        potion_combo.pack(side=tk.LEFT, padx=5)
        potion_combo.set('保持药水CD')
        
        ttk.Label(potion_frame, text="执行间隔 (毫秒):").pack(side=tk.LEFT, padx=10)
        
        potion_interval_spin = ttk.Spinbox(potion_frame, from_=100, to=2000, width=8)
        potion_interval_spin.pack(side=tk.LEFT, padx=5)
        potion_interval_spin.set(500)
    
    def _create_right_panel(self, parent=None):
        """Create right panel with auxiliary functions"""
        if parent is None:
            parent = self.main_frame
            
        right_frame = ttk.LabelFrame(parent, text="辅助功能", padding=10)
        right_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(5, 0))
        
        # Combat macro hotkey
        combat_frame = ttk.Frame(right_frame)
        combat_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(combat_frame, text="战斗宏启动快捷键:").pack(anchor=tk.W)
        combat_combo = ttk.Combobox(combat_frame, values=['键盘按键', '鼠标按键'], width=12)
        combat_combo.pack(side=tk.LEFT, pady=2)
        combat_combo.set('键盘按键')
        
        auxiliary_config = self._get_auxiliary_config()
        self.combat_key_var = tk.StringVar(value=auxiliary_config['combat_hotkey'])
        combat_key_entry = ttk.Entry(combat_frame, textvariable=self.combat_key_var, width=8)
        combat_key_entry.pack(side=tk.LEFT, padx=5)
        
        # Assistant macro hotkey
        assistant_frame = ttk.Frame(right_frame)
        assistant_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(assistant_frame, text="助手宏启动快捷键:").pack(anchor=tk.W)
        assistant_combo = ttk.Combobox(assistant_frame, values=['键盘按键', '鼠标按键'], width=12)
        assistant_combo.pack(side=tk.LEFT, pady=2)
        assistant_combo.set('键盘按键')
        
        self.assistant_key_var = tk.StringVar(value=auxiliary_config['assistant_hotkey'])
        assistant_key_entry = ttk.Entry(assistant_frame, textvariable=self.assistant_key_var, width=8)
        assistant_key_entry.pack(side=tk.LEFT, padx=5)
        
        # Animation speed
        anim_frame = ttk.Frame(right_frame)
        anim_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(anim_frame, text="助手宏动画速度:").pack(anchor=tk.W)
        self.animation_speed_var = tk.StringVar(value=auxiliary_config['animation_speed'])
        anim_combo = ttk.Combobox(anim_frame, textvariable=self.animation_speed_var, values=['慢', '中等', '快'], width=12)
        anim_combo.pack(side=tk.LEFT, pady=2)
        
        # Game language
        lang_frame = ttk.Frame(right_frame)
        lang_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(lang_frame, text="游戏界面语言:").pack(anchor=tk.W)
        self.game_language_var = tk.StringVar(value=auxiliary_config.get('game_language', '繁体中文'))
        lang_combo = ttk.Combobox(lang_frame, textvariable=self.game_language_var, values=['繁体中文', '简体中文', '英文'], width=12)
        lang_combo.pack(side=tk.LEFT, pady=2)
        lang_combo.bind('<<ComboboxSelected>>', self._on_game_language_changed)
        
        # Blood shard gambling
        blood_frame = ttk.Frame(right_frame)
        blood_frame.pack(fill=tk.X, pady=5)
        
        self.blood_shard_var = tk.BooleanVar(value=auxiliary_config['blood_shard']['enabled'])
        blood_check = ttk.Checkbutton(blood_frame, text="血岩赌博助手", variable=self.blood_shard_var)
        blood_check.pack(anchor=tk.W)
        
        ttk.Label(blood_frame, text="发送右键次数").pack(anchor=tk.W, padx=(20, 0))
        self.blood_shard_count_var = tk.IntVar(value=auxiliary_config['blood_shard']['count'])
        blood_spin = ttk.Spinbox(blood_frame, from_=1, to=100, textvariable=self.blood_shard_count_var, width=8)
        blood_spin.pack(side=tk.LEFT, padx=(20, 5))
        
        # Quick pickup
        pickup_frame = ttk.Frame(right_frame)
        pickup_frame.pack(fill=tk.X, pady=5)
        
        self.quick_pickup_var = tk.BooleanVar(value=auxiliary_config['quick_pickup']['enabled'])
        pickup_check = ttk.Checkbutton(pickup_frame, text="快速拾取助手", variable=self.quick_pickup_var)
        pickup_check.pack(anchor=tk.W)
        
        ttk.Label(pickup_frame, text="发送左键次数").pack(anchor=tk.W, padx=(20, 0))
        self.quick_pickup_count_var = tk.IntVar(value=auxiliary_config['quick_pickup']['count'])
        pickup_spin = ttk.Spinbox(pickup_frame, from_=1, to=100, textvariable=self.quick_pickup_count_var, width=8)
        pickup_spin.pack(side=tk.LEFT, padx=(20, 5))
        
        # Blacksmith
        blacksmith_frame = ttk.Frame(right_frame)
        blacksmith_frame.pack(fill=tk.X, pady=5)
        
        blacksmith_var = tk.BooleanVar()
        blacksmith_check = ttk.Checkbutton(blacksmith_frame, text="铁匠分解助手", variable=blacksmith_var)
        blacksmith_check.pack(anchor=tk.W)
        
        blacksmith_combo = ttk.Combobox(blacksmith_frame, values=['快速分解', '智能分解'], width=12)
        blacksmith_combo.pack(side=tk.LEFT, padx=(20, 5))
        blacksmith_combo.set('快速分解')
        
        # Kanai's Cube assistants
        kanai_frames = [
            ('魔盒重铸助手', '重铸一次', '重铸十次'),
            ('魔盒升级助手', '升级一次', '升级十次'),
            ('魔盒转化助手', '转化一次', '转化十次')
        ]
        
        for title, *options in kanai_frames:
            frame = ttk.Frame(right_frame)
            frame.pack(fill=tk.X, pady=5)
            
            var = tk.BooleanVar()
            check = ttk.Checkbutton(frame, text=title, variable=var)
            check.pack(anchor=tk.W)
            
            if options:
                combo = ttk.Combobox(frame, values=options, width=12)
                combo.pack(side=tk.LEFT, padx=(20, 5))
                combo.set(options[0])
        
        # Drop equipment
        drop_frame = ttk.Frame(right_frame)
        drop_frame.pack(fill=tk.X, pady=5)
        
        drop_var = tk.BooleanVar()
        drop_check = ttk.Checkbutton(drop_frame, text="一键丢装助手", variable=drop_var)
        drop_check.pack(anchor=tk.W)
        
        # Bag offset configuration
        self._create_bag_offset_controls(right_frame)
    
    def _create_bag_offset_controls(self, parent_frame):
        """Create bag offset configuration controls"""
        # Bag offset frame
        bag_offset_frame = ttk.LabelFrame(parent_frame, text="背包范围截取偏移值", padding=5)
        bag_offset_frame.pack(fill=tk.X, pady=5)
        
        # Description
        desc_label = ttk.Label(bag_offset_frame, text="正数向内缩进，负数向外扩展 (像素)", 
                              font=('Arial', 8), foreground='gray')
        desc_label.pack(anchor=tk.W, pady=(0, 5))
        
        # Get current bag offset configuration
        bag_offset = CONFIG.get('system_settings', {}).get('bag_offset', {})
        bag_offset_config = {
            'left': bag_offset.get('left', 9),
            'right': bag_offset.get('right', 22),
            'top': bag_offset.get('top', 0),
            'bottom': bag_offset.get('bottom', 0)
        }
        
        # Create offset controls
        offset_controls = [
            ('left', '左偏移:', bag_offset_config['left']),
            ('right', '右偏移:', bag_offset_config['right']),
            ('top', '上偏移:', bag_offset_config['top']),
            ('bottom', '下偏移:', bag_offset_config['bottom'])
        ]
        
        self.bag_offset_vars = {}
        
        for offset_key, label_text, default_value in offset_controls:
            frame = ttk.Frame(bag_offset_frame)
            frame.pack(fill=tk.X, pady=2)
            
            ttk.Label(frame, text=label_text, width=8).pack(side=tk.LEFT)
            
            var = tk.IntVar(value=default_value)
            self.bag_offset_vars[offset_key] = var
            
            spinbox = ttk.Spinbox(frame, from_=-50, to=50, textvariable=var, width=8)
            spinbox.pack(side=tk.LEFT, padx=(5, 0))
            
            # Bind change event
            spinbox.bind('<FocusOut>', self._on_bag_offset_changed)
            spinbox.bind('<Return>', self._on_bag_offset_changed)
        
        # Apply button
        apply_btn = ttk.Button(bag_offset_frame, text="应用设置", 
                              command=self._apply_bag_offset_config)
        apply_btn.pack(anchor=tk.E, pady=(5, 0))
    
    def _on_bag_offset_changed(self, event=None):
        """Handle bag offset value changes"""
        # Auto-apply changes after a short delay
        if hasattr(self, '_bag_offset_timer'):
            self.root.after_cancel(self._bag_offset_timer)
        
        self._bag_offset_timer = self.root.after(1000, self._apply_bag_offset_config)
    
    def _apply_bag_offset_config(self):
        """Apply bag offset configuration"""
        try:
            offset_data = {
                'left': self.bag_offset_vars['left'].get(),
                'right': self.bag_offset_vars['right'].get(),
                'top': self.bag_offset_vars['top'].get(),
                'bottom': self.bag_offset_vars['bottom'].get()
            }
            
            # Update configuration directly to CONFIG
            for key, value in offset_data.items():
                if key in ['left', 'right', 'top', 'bottom']:
                    CONFIG['system_settings']['bag_offset'][key] = value
                    ColorPrint.blue(f"[UI] Set {key} = {value}")
            
            # Save configuration
            save_config()
            ColorPrint.green(f"[UI] Bag offset configuration updated: {offset_data}")
            
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to update bag offset configuration: {e}")
            messagebox.showerror("错误", f"更新背包偏移值配置失败: {e}")
    
    def _create_bottom_bar(self):
        """Create bottom bar with status and options"""
        bottom_frame = ttk.Frame(self.root)
        bottom_frame.pack(fill=tk.X, padx=5, pady=5)
        
        # Left side options
        left_options = ttk.Frame(bottom_frame)
        left_options.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # Sound feedback
        sound_var = tk.BooleanVar(value=True)
        sound_check = ttk.Checkbutton(left_options, text="快捷键切换配置成功时播放声音", variable=sound_var)
        sound_check.pack(side=tk.LEFT, padx=(0, 10))
        
        # Smart pause
        smart_var = tk.BooleanVar(value=True)
        smart_check = ttk.Checkbutton(left_options, text="智能暂停", variable=smart_var)
        smart_check.pack(side=tk.LEFT, padx=(0, 10))
        
        # Custom keys
        custom_frame = ttk.Frame(left_options)
        custom_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        stand_var = tk.BooleanVar()
        stand_check = ttk.Checkbutton(custom_frame, text="使用自定义强制站立按键:", variable=stand_var)
        stand_check.pack(side=tk.LEFT)
        stand_entry = ttk.Entry(custom_frame, width=8)
        stand_entry.pack(side=tk.LEFT, padx=5)
        stand_entry.insert(0, 'Shift')
        
        # Right side status
        status_frame = ttk.Frame(bottom_frame)
        status_frame.pack(side=tk.RIGHT)
        
        self.status_config_label = ttk.Label(status_frame, text="当前激活配置: 配置1")
        self.status_config_label.pack(side=tk.LEFT, padx=5)
        
        self.status_mode_label = ttk.Label(status_frame, text="按键发送模式: Event")
        self.status_mode_label.pack(side=tk.LEFT, padx=5)
        
        # GitHub link
        github_label = ttk.Label(status_frame, text="本项目开源在: https://github.com/WeijieH/D3keyHelper", 
                                foreground='blue', cursor='hand2')
        github_label.pack(side=tk.LEFT, padx=5)
        
        # Add macro control buttons
        self._create_macro_controls(bottom_frame)
    
    def _create_macro_controls(self, parent):
        """Create macro control buttons"""
        control_frame = ttk.Frame(parent)
        control_frame.pack(side=tk.LEFT, padx=(20, 0))
        
        # Start/Stop buttons
        self.start_btn = ttk.Button(control_frame, text="启动宏", command=self._on_start_macro)
        self.start_btn.pack(side=tk.LEFT, padx=5)
        
        self.stop_btn = ttk.Button(control_frame, text="停止宏", command=self._on_stop_macro, state='disabled')
        self.stop_btn.pack(side=tk.LEFT, padx=5)
        
        # Status indicator
        self.status_indicator = ttk.Label(control_frame, text="●", foreground='red')
        self.status_indicator.pack(side=tk.LEFT, padx=10)
        
        self.status_text = ttk.Label(control_frame, text="已停止")
        self.status_text.pack(side=tk.LEFT, padx=2)
    
    def _on_start_macro(self):
        """Handle start macro button click"""
        if self.on_macro_start:
            self.on_macro_start()
        self._update_macro_status(True)
    
    def _on_stop_macro(self):
        """Handle stop macro button click"""
        if self.on_macro_stop:
            self.on_macro_stop()
        self._update_macro_status(False)
    
    def _update_macro_status(self, running):
        """Update macro status display"""
        if running:
            self.start_btn.configure(state='disabled')
            self.stop_btn.configure(state='normal')
            self.status_indicator.configure(foreground='green')
            self.status_text.configure(text="运行中")
        else:
            self.start_btn.configure(state='normal')
            self.stop_btn.configure(state='disabled')
            self.status_indicator.configure(foreground='red')
            self.status_text.configure(text="已停止")
    
    def _setup_styles(self):
        """Setup custom styles"""
        style = ttk.Style()
        style.theme_use('clam')
        
        # Configure colors
        style.configure('TLabel', background='#2b2b2b', foreground='white')
        style.configure('TFrame', background='#2b2b2b')
        style.configure('TLabelFrame', background='#2b2b2b', foreground='white')
        style.configure('TLabelFrame.Label', background='#2b2b2b', foreground='white')
        style.configure('TButton', background='#404040', foreground='white')
        style.configure('TEntry', fieldbackground='#404040', foreground='white')
        style.configure('TCombobox', fieldbackground='#404040', foreground='white')
        style.configure('TCheckbutton', background='#2b2b2b', foreground='white')
    
    def _create_test_buttons_area(self, parent=None):
        """Create test buttons area at the bottom"""
        if parent is None:
            parent = self.root
            
        # Test buttons frame
        test_frame = ttk.LabelFrame(parent, text="测试功能区域 (Test Functions)", padding=5)
        test_frame.pack(fill=tk.X, padx=10, pady=5)
        
        # Create 10 test buttons in 2 rows
        test_buttons = []
        for i in range(10):
            row = i // 5
            col = i % 5
            
            btn = ttk.Button(test_frame, text=f"测试{i+1}", 
                           command=lambda x=i+1: self._test_button_clicked(x))
            btn.grid(row=row, column=col, padx=5, pady=2, sticky='ew')
            test_buttons.append(btn)
        
        # Configure grid weights
        for i in range(5):
            test_frame.columnconfigure(i, weight=1)
    
    def _test_button_clicked(self, button_num):
        """Handle test button clicks"""
        # Test callback registration
        ColorPrint.blue(f"[TEST] 测试按钮{button_num} 被点击")
        ColorPrint.green(f"[INFO] 当前时间: {datetime.datetime.now().strftime('%H:%M:%S')}")
        
        if button_num == 1:
            # Test button 1: Screenshot test
            ColorPrint.yellow("[TEST] 开始截屏测试...")
            self._test_screenshot()
        elif button_num == 2:
            # Test button 2: Skill config test
            ColorPrint.blue("[TEST] 技能配置测试")
            self._test_skill_config()
        elif button_num == 3:
            # Test button 3: Auxiliary function test
            ColorPrint.green("[TEST] 辅助功能测试")
            self._test_auxiliary_config()
        elif button_num == 4:
            # Test button 4: Namespace switch test
            ColorPrint.yellow("[TEST] 命名空间切换测试")
            self._test_namespace_switch()
        elif button_num == 5:
            # Test button 5: File save test
            ColorPrint.red("[TEST] 文件保存测试")
            self._test_file_save()
        elif button_num == 6:
            # Test button 6: Config load test
            ColorPrint.blue("[TEST] 配置加载测试")
            self._test_config_load()
        elif button_num == 7:
            # Test button 7: Macro execution test
            ColorPrint.green("[TEST] 宏执行测试")
            self._test_macro_execution()
        elif button_num == 8:
            # Test button 8: UI status test
            ColorPrint.yellow("[TEST] UI状态测试")
            self._test_ui_status()
        elif button_num == 9:
            # Test button 9: Error handling test
            ColorPrint.red("[TEST] 错误处理测试")
            self._test_error_handling()
        elif button_num == 10:
            # Test button 10: Performance test
            ColorPrint.blue("[TEST] 性能测试")
            self._test_performance()
        else:
            ColorPrint.gray(f"[TEST] 未知测试按钮: {button_num}")
        
        # Test callback functionality
        ColorPrint.green(f"[SUCCESS] 测试按钮{button_num} 执行完成")
    
    def _test_screenshot(self):
        """Test screenshot functionality"""
        try:
            # Add controller path
            controller_path = os.path.join(os.path.dirname(__file__), '..', 'controller')
            sys.path.insert(0, controller_path)
            
            # Run screenshot test
            screenshot_main()
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] 截屏测试失败: {e}")
    
    def _test_skill_config(self):
        """Test skill configuration"""
        try:
            if self.config_manager:
                config = self.config_manager.get_skill_config(self.current_config)
                ColorPrint.green(f"[SUCCESS] 当前技能配置: {self.current_config}")
                ColorPrint.blue(f"[INFO] 配置包含 {len(config)} 个主要部分")
                if 'skills' in config:
                    ColorPrint.yellow(f"[INFO] 技能数量: {len(config['skills'])}")
            else:
                ColorPrint.red("[ERROR] 配置管理器未初始化")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 技能配置测试失败: {e}")
    
    def _test_auxiliary_config(self):
        """Test auxiliary configuration"""
        try:
            if self.config_manager:
                config = self.config_manager.get_auxiliary_config()
                ColorPrint.green(f"[SUCCESS] 辅助功能配置加载成功")
                ColorPrint.blue(f"[INFO] 辅助功能数量: {len(config)}")
                ColorPrint.yellow(f"[INFO] 战斗快捷键: {config.get('combat_hotkey', 'N/A')}")
                ColorPrint.yellow(f"[INFO] 助手快捷键: {config.get('assistant_hotkey', 'N/A')}")
            else:
                ColorPrint.red("[ERROR] 配置管理器未初始化")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 辅助功能测试失败: {e}")
    
    def _test_namespace_switch(self):
        """Test namespace switching"""
        try:
            ColorPrint.blue(f"[INFO] 当前配置: {self.current_config}")
            # Switch to next config
            configs = ['config1', 'config2', 'config3', 'config4']
            current_index = configs.index(self.current_config)
            next_index = (current_index + 1) % len(configs)
            next_config = configs[next_index]
            
            self._switch_config(next_config)
            ColorPrint.green(f"[SUCCESS] 切换到配置: {next_config}")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 命名空间切换测试失败: {e}")
    
    def _test_file_save(self):
        """Test file save functionality"""
        try:
            if self.config_manager:
                # Save current configuration
                self._save_current_config()
                self._save_auxiliary_config()
                ColorPrint.green("[SUCCESS] 配置保存成功")
            else:
                ColorPrint.red("[ERROR] 配置管理器未初始化")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 文件保存测试失败: {e}")
    
    def _test_config_load(self):
        """Test configuration loading"""
        try:
            if self.config_manager:
                # Load current configuration
                self._load_config(self.current_config)
                ColorPrint.green("[SUCCESS] 配置加载成功")
                ColorPrint.blue(f"[INFO] 当前配置: {self.current_config}")
            else:
                ColorPrint.red("[ERROR] 配置管理器未初始化")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 配置加载测试失败: {e}")
    
    def _test_macro_execution(self):
        """Test macro execution"""
        try:
            ColorPrint.blue("[INFO] 模拟宏执行测试")
            ColorPrint.yellow("[INFO] 检查技能配置...")
            if self.config_manager:
                config = self.config_manager.get_current_config(self.current_config)
                skills = config.get('skills', {})
                ColorPrint.green(f"[SUCCESS] 找到 {len(skills)} 个技能配置")
                for skill_name, skill_config in skills.items():
                    if skill_config.get('strategy') != '禁用':
                        ColorPrint.blue(f"[INFO] 技能 {skill_name}: {skill_config.get('strategy')}")
            else:
                ColorPrint.red("[ERROR] 配置管理器未初始化")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 宏执行测试失败: {e}")
    
    def _test_ui_status(self):
        """Test UI status"""
        try:
            ColorPrint.blue("[INFO] UI状态检查")
            ColorPrint.green(f"[SUCCESS] 窗口标题: {self.root.title()}")
            ColorPrint.green(f"[SUCCESS] 窗口大小: {self.root.geometry()}")
            ColorPrint.green(f"[SUCCESS] 当前配置: {self.current_config}")
            ColorPrint.green(f"[SUCCESS] 日志组件: {'已加载' if hasattr(self, 'log_widget') else '未加载'}")
            ColorPrint.green(f"[SUCCESS] 配置管理器: {'已加载' if self.config_manager else '未加载'}")
        except Exception as e:
            ColorPrint.red(f"[ERROR] UI状态测试失败: {e}")
    
    def _test_error_handling(self):
        """Test error handling"""
        try:
            ColorPrint.yellow("[TEST] 测试错误处理机制")
            # Test invalid config access
            try:
                if self.config_manager:
                    invalid_config = self.config_manager.get_skill_config('invalid_config')
            except ValueError as e:
                ColorPrint.green(f"[SUCCESS] 错误处理正常: {e}")
            
            # Test callback error handling
            ColorPrint.blue("[TEST] 测试回调错误处理")
            ColorPrint.green("[SUCCESS] 错误处理测试完成")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 错误处理测试失败: {e}")
    
    def _test_performance(self):
        """Test performance"""
        
        try:
            ColorPrint.blue("[TEST] 性能测试开始")
            start_time = time.time()
            
            # Test configuration access speed
            if self.config_manager:
                for i in range(10):
                    config = self.config_manager.get_skill_config(self.current_config)
            
            end_time = time.time()
            duration = end_time - start_time
            ColorPrint.green(f"[SUCCESS] 配置访问性能: {duration:.4f}秒 (10次访问)")
            
            # Test UI responsiveness
            ColorPrint.blue("[TEST] UI响应性测试")
            ColorPrint.green("[SUCCESS] 性能测试完成")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 性能测试失败: {e}")
    
    def _on_game_language_changed(self, event=None):
        """Handle game language change"""
        try:
            if hasattr(self, 'game_language_var') and self.config_manager:
                new_language = self.game_language_var.get()
                config_data = {'game_language': new_language}
                self.config_manager.update_auxiliary_config(config_data)
                ColorPrint.green(f"[SUCCESS] 游戏界面语言已更改为: {new_language}")
        except Exception as e:
            ColorPrint.red(f"[ERROR] 游戏语言设置失败: {e}")
    
    def _create_log_output_area(self, parent=None):
        """Create log output area"""
        if parent is None:
            parent = self.root
            
        try:
            self.log_widget = LogOutputWidget(parent, self.config_manager)
            
            # Test callback registration
            ColorPrint.green("[SUCCESS] 日志输出组件已加载并注册回调")
            ColorPrint.blue("[INFO] 所有 ColorPrint 输出将显示在此日志框中")
            
        except ImportError:
            # Fallback if log widget is not available
            self.log_widget = None
            log_frame = ttk.LabelFrame(self.root, text="日志输出 (Log Output)", padding=5)
            log_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
            
            log_text = tk.Text(log_frame, height=20, bg='#1e1e1e', fg='#ffffff', 
                             font=('Consolas', 9), wrap=tk.WORD)
            log_text.pack(fill=tk.BOTH, expand=True)
            self.log_widget = log_text
    
    def _switch_config(self, config_name):
        """Switch to a different configuration"""
        # Switch to new config
        self.current_config = config_name
        self._update_tab_highlight()
        self._update_status_display()
        
        # Notify callbacks
        if self.on_config_change:
            self.on_config_change()
        if self.on_skill_config_switch:
            self.on_skill_config_switch(config_name)
    
    def _update_status_display(self):
        """Update status display"""
        config_num = self.current_config.replace('config', '')
        self.status_config_label.configure(text=f"当前激活配置: 配置{config_num}")
    
    # Removed unnecessary config wrapper functions - use CONFIG directly
    
    def _update_tab_highlight(self):
        """Update tab button highlighting"""
        for config_name, button in self.tab_buttons.items():
            if config_name == self.current_config:
                button.configure(style='Accent.TButton')
            else:
                button.configure(style='TButton')
    
    def set_macro_start_callback(self, callback: Callable):
        """Set callback for macro start"""
        self.on_macro_start = callback
    
    def set_macro_stop_callback(self, callback: Callable):
        """Set callback for macro stop"""
        self.on_macro_stop = callback
    
    def set_config_change_callback(self, callback: Callable):
        """Set callback for configuration change"""
        self.on_config_change = callback
    
    def set_skill_config_switch_callback(self, callback: Callable):
        """Set callback for skill configuration switch"""
        self.on_skill_config_switch = callback
    
    # Removed unnecessary config wrapper functions - use CONFIG directly
    
    def show_message(self, title: str, message: str, msg_type: str = 'info'):
        """Show message box"""
        if msg_type == 'error':
            messagebox.showerror(title, message)
        elif msg_type == 'warning':
            messagebox.showwarning(title, message)
        else:
            messagebox.showinfo(title, message)
    
    def run(self):
        """Run the UI"""
        self.root.mainloop()
    
    def destroy(self):
        """Destroy the UI"""
        self.root.destroy()


# Example usage and testing
if __name__ == "__main__":
    def on_macro_start():
        print("Macro started!")
    
    def on_macro_stop():
        print("Macro stopped!")
    
    def on_config_change():
        print("Configuration changed!")
    
    # Create and run UI
    ui = Diablo3MacroUI()
    ui.set_macro_start_callback(on_macro_start)
    ui.set_macro_stop_callback(on_macro_stop)
    ui.set_config_change_callback(on_config_change)
    
    ui.run()
