# PySide6 Native UI config module - summary document [LONvCp]

to use HuTiGong `<content>` (PySide6 config module Python WenJian ) JianMing summary . 

## structure 
- TouBu : #!/usr/bin/env python3, # -*- coding: utf-8 -*-, module docstring. 
- DaoRu : dataclasses (dataclass, field) , typing (Optional, Tuple, List, Dict, Any, Callable) , enum (Enum) . 
- WindowState MeiJu : NORMAL, MAXIMIZED, MINIMIZED, HIDDEN. 
- WebViewEngine MeiJu : PYSIDE6, AUTO. 
- PySide6UIConfig (@dataclass) : Ying use (app_name, app_id, icon_path, logo_path etc. ) , ChuangKou (window_size, min_window_size, show_on_start, resizable, frameless, window_position) , BiaoTiLan (enable_title_bar, title_bar_height, AnNiu etc. ) , XiTongTuoPan , WebView (engine, url, loading_page, dev_tools etc. ) , QtWebEngine (chromium flags, GPU sandbox, WebCodecs, YuanChengTiaoShi etc. ) , XianCheng (tick_timer) , i18n, HuiDiao (on_ready, on_closing, on_webview_ready etc. ) , THREAD_BUS MingMingKongJian and trigger_shutdown_on_close, debug/log_level, cache. 
- StartupWindowConfig (@dataclass) : YiQi use , JianDanQiDongChuangKou config . 
- ActionType Lei : CLOSE, MINIMIZE, MAXIMIZE, RESTORE, RESTART, MENU, HIDE, SHOW. 

## key points 
- Zhu config Lei for PySide6UIConfig, HanGaiChuangKou , BiaoTiLan , TuoPan , WebView, WebEngine, Ding when Qi , i18n, ShengMingZhouQi and WebView HuiDiao , THREAD_BUS ShiJianJiCheng . 
- StartupWindowConfig BaoLiuXiangHouJianRong , JianYiGai use TkinterStartupThread / launcher_with_startup. 

## purpose 
for PySide6 YuanSheng UI KuangJiaTiGongJi in config , GongZhuChuangKou , WebView, TuoPan , THREAD_BUS etc. ZuJianChuShiHua and line for KongZhi use . 
