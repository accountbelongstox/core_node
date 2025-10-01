#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Panel (TABLE3)
Contains test functions and log output
"""

import tkinter as tk
from tkinter import ttk
import sys
import os
import time
from typing import Optional, Callable

# Add ncore path for color_print
ncore_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "ncore")
sys.path.insert(0, ncore_path)
from pytools.pyfoundations.color_print import ColorPrint


class LogPanel:
    """Log panel for TABLE3"""
    
    def __init__(self, parent):
        self.parent = parent
        
        # Callbacks
        self.on_test_function: Optional[Callable] = None
        
        self._create_panel()
    
    def _create_panel(self):
        """Create the test and log panel"""
        # Main content frame
        content_frame = ttk.Frame(self.parent)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Test functions area
        self._create_test_buttons_area(content_frame)
        
        # Log output area
        self._create_log_output_area(content_frame)
    
    def _create_test_buttons_area(self, parent):
        """Create test buttons area"""
        # Test buttons frame
        test_frame = ttk.LabelFrame(parent, text="测试功能区域 (Test Functions)", padding=5)
        test_frame.pack(fill=tk.X, pady=5)
        
        # Create 10 test buttons in 2 rows
        test_buttons = []
        for i in range(10):
            row = i // 5
            col = i % 5
            
            btn = ttk.Button(test_frame, text=f"测试 {i+1}", 
                           command=lambda idx=i+1: self._on_test_button_click(idx))
            btn.grid(row=row, column=col, padx=5, pady=5, sticky='ew')
            test_buttons.append(btn)
        
        # Configure grid weights
        for i in range(5):
            test_frame.columnconfigure(i, weight=1)
        
        # Test status frame
        status_frame = ttk.Frame(test_frame)
        status_frame.grid(row=2, column=0, columnspan=5, sticky='ew', pady=(10, 0))
        
        ttk.Label(status_frame, text="测试状态:").pack(side=tk.LEFT)
        self.test_status_var = tk.StringVar(value="就绪")
        status_label = ttk.Label(status_frame, textvariable=self.test_status_var, 
                                foreground='green')
        status_label.pack(side=tk.LEFT, padx=5)
        
        # Test progress
        progress_frame = ttk.Frame(test_frame)
        progress_frame.grid(row=3, column=0, columnspan=5, sticky='ew', pady=5)
        
        ttk.Label(progress_frame, text="进度:").pack(side=tk.LEFT)
        self.test_progress_var = tk.DoubleVar()
        progress_bar = ttk.Progressbar(progress_frame, variable=self.test_progress_var, 
                                     maximum=100, length=200)
        progress_bar.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        
        # Test controls
        controls_frame = ttk.Frame(test_frame)
        controls_frame.grid(row=4, column=0, columnspan=5, sticky='ew', pady=5)
        
        start_all_btn = ttk.Button(controls_frame, text="开始所有测试", 
                                  command=self._start_all_tests)
        start_all_btn.pack(side=tk.LEFT, padx=5)
        
        stop_all_btn = ttk.Button(controls_frame, text="停止所有测试", 
                                 command=self._stop_all_tests)
        stop_all_btn.pack(side=tk.LEFT, padx=5)
        
        clear_btn = ttk.Button(controls_frame, text="清除日志", 
                              command=self._clear_log)
        clear_btn.pack(side=tk.LEFT, padx=5)
    
    def _create_log_output_area(self, parent):
        """Create log output area"""
        try:
            from .log_output_widget import LogOutputWidget
            self.log_widget = LogOutputWidget(parent, self.config_manager)
            
            # Test callback registration
            ColorPrint.green("[SUCCESS] 日志输出组件已加载并注册回调")
            ColorPrint.blue("[INFO] 所有 ColorPrint 输出将显示在此日志框中")
            
        except ImportError:
            # Fallback to simple text widget if log_output_widget is not available
            ColorPrint.yellow("[WARN] LogOutputWidget not available, using fallback")
            self._create_fallback_log_widget(parent)
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to create log output area: {e}")
            self._create_fallback_log_widget(parent)
    
    def _create_fallback_log_widget(self, parent):
        """Create fallback log widget"""
        log_frame = ttk.LabelFrame(parent, text="日志输出", padding=5)
        log_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # Log text widget
        self.log_text = tk.Text(log_frame, height=15, wrap=tk.WORD, 
                               font=('Consolas', 9), bg='#1e1e1e', fg='#ffffff')
        self.log_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # Scrollbar
        scrollbar = ttk.Scrollbar(log_frame, orient="vertical", command=self.log_text.yview)
        scrollbar.pack(side="right", fill="y")
        self.log_text.configure(yscrollcommand=scrollbar.set)
        
        # Log controls
        controls_frame = ttk.Frame(log_frame)
        controls_frame.pack(fill=tk.X, pady=5)
        
        clear_btn = ttk.Button(controls_frame, text="清除", command=self._clear_log)
        clear_btn.pack(side=tk.LEFT, padx=5)
        
        save_btn = ttk.Button(controls_frame, text="保存日志", command=self._save_log)
        save_btn.pack(side=tk.LEFT, padx=5)
        
        auto_scroll_var = tk.BooleanVar(value=True)
        auto_scroll_check = ttk.Checkbutton(controls_frame, text="自动滚动", 
                                          variable=auto_scroll_var)
        auto_scroll_check.pack(side=tk.LEFT, padx=5)
        self.auto_scroll_var = auto_scroll_var
    
    def _on_test_button_click(self, test_number):
        """Handle test button click"""
        try:
            self.test_status_var.set(f"运行测试 {test_number}")
            ColorPrint.blue(f"[TEST] 开始执行测试 {test_number}")
            
            # Simulate test execution
            self._simulate_test_execution(test_number)
            
            # Call callback if set
            if self.on_test_function:
                self.on_test_function(test_number)
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] 测试 {test_number} 执行失败: {e}")
            self.test_status_var.set(f"测试 {test_number} 失败")
    
    def _simulate_test_execution(self, test_number):
        """Simulate test execution"""
        
        # Update progress
        for i in range(0, 101, 10):
            self.test_progress_var.set(i)
            self.parent.update()
            time.sleep(0.1)
        
        # Reset progress
        self.test_progress_var.set(0)
        self.test_status_var.set("就绪")
        
        ColorPrint.green(f"[SUCCESS] 测试 {test_number} 执行完成")
    
    def _start_all_tests(self):
        """Start all tests"""
        try:
            self.test_status_var.set("运行所有测试")
            ColorPrint.blue("[TEST] 开始执行所有测试")
            
            # Simulate running all tests
            for i in range(1, 11):
                self._simulate_test_execution(i)
                time.sleep(0.5)
            
            self.test_status_var.set("所有测试完成")
            ColorPrint.green("[SUCCESS] 所有测试执行完成")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] 批量测试执行失败: {e}")
            self.test_status_var.set("测试失败")
    
    def _stop_all_tests(self):
        """Stop all tests"""
        try:
            self.test_status_var.set("已停止")
            self.test_progress_var.set(0)
            ColorPrint.yellow("[TEST] 所有测试已停止")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] 停止测试失败: {e}")
    
    def _clear_log(self):
        """Clear log output"""
        try:
            if hasattr(self, 'log_widget') and self.log_widget:
                # Use log widget's clear method if available
                if hasattr(self.log_widget, 'clear'):
                    self.log_widget.clear()
                else:
                    # Fallback to text widget
                    if hasattr(self.log_widget, 'text_widget'):
                        self.log_widget.text_widget.delete(1.0, tk.END)
            elif hasattr(self, 'log_text'):
                self.log_text.delete(1.0, tk.END)
            
            ColorPrint.blue("[LOG] 日志已清除")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] 清除日志失败: {e}")
    
    def _save_log(self):
        """Save log to file"""
        try:
            from tkinter import filedialog
            import datetime
            
            # Generate default filename
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            default_filename = f"d3check_log_{timestamp}.txt"
            
            # Ask user for save location
            filename = filedialog.asksaveasfilename(
                title="保存日志文件",
                defaultextension=".txt",
                filetypes=[("文本文件", "*.txt"), ("所有文件", "*.*")],
                initialvalue=default_filename
            )
            
            if filename:
                # Get log content
                if hasattr(self, 'log_widget') and self.log_widget:
                    if hasattr(self.log_widget, 'get_content'):
                        content = self.log_widget.get_content()
                    elif hasattr(self.log_widget, 'text_widget'):
                        content = self.log_widget.text_widget.get(1.0, tk.END)
                    else:
                        content = "日志内容不可用"
                elif hasattr(self, 'log_text'):
                    content = self.log_text.get(1.0, tk.END)
                else:
                    content = "日志内容不可用"
                
                # Save to file
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                ColorPrint.green(f"[SUCCESS] 日志已保存到: {filename}")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] 保存日志失败: {e}")
    
    def add_log_message(self, message, level="INFO"):
        """Add message to log"""
        try:
            if hasattr(self, 'log_widget') and self.log_widget:
                if hasattr(self.log_widget, 'add_message'):
                    self.log_widget.add_message(message, level)
                elif hasattr(self.log_widget, 'text_widget'):
                    self.log_widget.text_widget.insert(tk.END, f"[{level}] {message}\n")
            elif hasattr(self, 'log_text'):
                self.log_text.insert(tk.END, f"[{level}] {message}\n")
                if self.auto_scroll_var.get():
                    self.log_text.see(tk.END)
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] 添加日志消息失败: {e}")
    
    def set_test_function_callback(self, callback):
        """Set test function callback"""
        self.on_test_function = callback
