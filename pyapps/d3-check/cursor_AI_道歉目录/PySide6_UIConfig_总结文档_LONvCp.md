# PySide6 Native UI 配置模块 — 总结文档 [LONvCp]

对用户提供的 `<content>`（PySide6 配置模块 Python 文件）的简明总结。

## 结构
- 头部：#!/usr/bin/env python3、# -*- coding: utf-8 -*-、模块 docstring。
- 导入：dataclasses（dataclass, field）、typing（Optional, Tuple, List, Dict, Any, Callable）、enum（Enum）。
- WindowState 枚举：NORMAL, MAXIMIZED, MINIMIZED, HIDDEN。
- WebViewEngine 枚举：PYSIDE6, AUTO。
- PySide6UIConfig（@dataclass）：应用（app_name, app_id, icon_path, logo_path 等）、窗口（window_size, min_window_size, show_on_start, resizable, frameless, window_position）、标题栏（enable_title_bar, title_bar_height, 按钮等）、系统托盘、WebView（engine, url, loading_page, dev_tools 等）、QtWebEngine（chromium flags, GPU sandbox, WebCodecs, 远程调试等）、线程（tick_timer）、i18n、回调（on_ready, on_closing, on_webview_ready 等）、THREAD_BUS 命名空间与 trigger_shutdown_on_close、debug/log_level、cache。
- StartupWindowConfig（@dataclass）：已弃用，简单启动窗口配置。
- ActionType 类：CLOSE, MINIMIZE, MAXIMIZE, RESTORE, RESTART, MENU, HIDE, SHOW。

## 要点
- 主配置类为 PySide6UIConfig，涵盖窗口、标题栏、托盘、WebView、WebEngine、定时器、i18n、生命周期与 WebView 回调、THREAD_BUS 事件集成。
- StartupWindowConfig 保留向后兼容，建议改用 TkinterStartupThread / launcher_with_startup。

## 用途
为 PySide6 原生 UI 框架提供集中配置，供主窗口、WebView、托盘、THREAD_BUS 等组件初始化与行为控制使用。
