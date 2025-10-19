# Directory Tree: d3-check

**Path:** `D:\programing\core_node\apps\d3-check`

```
d3-check/
├── athtest/
│   ├── button.png
│   ├── button_detector.py
│   ├── button_pixels_sample.json
│   ├── left_pixels_sample.json
│   ├── pixels_20251020_010215.json
│   ├── progress_analysis.png
│   ├── progress_analyzer.py
│   ├── result.png
│   ├── skip.png
│   ├── skip_pixels_sample.json
│   ├── square_sampler.py
│   ├── square_sampling_result.png
│   └── test.png
├── config/
│   ├── datasets/
│   │   └── d3_ui/
│   │       └── data.yaml
│   ├── training/
│   │   └── d3_ui_training.yaml
│   ├── __init__.py
│   ├── grid_config.py
│   ├── training_config.json
│   └── unified_config.py
├── controller/
│   ├── ctl_func/
│   │   ├── __init__.py
│   │   ├── blacksmith_handler.py
│   │   └── kanai_cube_handler.py
│   ├── d4func/
│   │   ├── events/
│   │   │   ├── __init__.py
│   │   │   ├── event_manager.py
│   │   │   ├── exp_farming_events.py
│   │   │   ├── game_state_events.py
│   │   │   ├── screen_events.py
│   │   │   └── team_health_events.py
│   │   ├── __init__.py
│   │   ├── exp_farming.py
│   │   ├── image_annotator.py
│   │   ├── map_name_recognizer.py
│   │   ├── map_name_utils.py
│   │   ├── map_switch_detector.py
│   │   ├── ocr_config.py
│   │   ├── region_detector.py
│   │   ├── screenshot_handler.py
│   │   └── ui_status_updater.py
│   ├── training/
│   │   ├── __init__.py
│   │   └── simple_training_controller.py
│   ├── d3_macro_controller.py
│   ├── d3_macro_controller_optimized.py
│   ├── d4_controller.py
│   ├── game_assistant_controller.py
│   ├── game_interface_controller.py
│   └── pathfinding_controller.py
├── d3utils/
│   ├── collectors/
│   │   ├── collect_tools/
│   │   │   └── bag_layout_detector.py
│   │   ├── __init__.py
│   │   ├── bag_info_collector.py
│   │   ├── grid_screenshot_collector.py
│   │   ├── ui_region_collector_anchor.py
│   │   ├── ui_region_collector_optimized.py
│   │   └── ui_region_collector_ultralytics.py
│   ├── d3u_common/
│   │   ├── __init__.py
│   │   ├── hotkey_registry.py
│   │   └── image_annotator_helper.py
│   ├── d3utils_tree.md
│   ├── game_window_detector.py
│   ├── global_hotkey_manager.py
│   ├── i18n_manager.py
│   ├── interface_manager.py
│   ├── log_analyzer.py
│   ├── log_monitor.py
│   ├── rosbot_task_processor.py
│   ├── scaled_template_matcher.py
│   ├── screenshot_provider.py
│   ├── shutdown_manager.py
│   ├── state_aware_click_handler.py
│   ├── system_initializer.py
│   └── task_thread_manager.py
├── d4_modules/
│   ├── README.md
│   ├── model_registry.json
│   ├── progress_bar_detector.json
│   └── progress_bar_detector.pt
├── d4_modules_detection/
├── d4utils/
│   ├── __init__.py
│   ├── black_screen_detector.py
│   ├── d4_operation_base.py
│   ├── d4_scaled_template_matcher.py
│   ├── red_portal_detector.py
│   ├── small_map_detector.py
│   ├── team_formation_checker.py
│   ├── team_health_detector.py
│   ├── test_red_portal.py
│   └── window_region_detector.py
├── images/
│   ├── d4/
│   │   └── small_map.jpg
│   ├── bag_border.png
│   ├── bag_buttom.png
│   ├── bag_left.png
│   ├── bag_opened_indicator.png
│   ├── bag_right.png
│   ├── blacksmith_indicator_1.png
│   ├── blacksmith_indicator_2.png
│   ├── blacksmith_salvage_button.png
│   ├── blacksmith_sidebar_tab_1.png
│   ├── blacksmith_sidebar_tab_2.png
│   ├── game_anchor_bottom_left_1.png
│   ├── game_anchor_bottom_left_2.png
│   ├── game_anchor_bottom_left_3.png
│   ├── game_anchor_bottom_right.png
│   ├── item_ancient_set.png
│   ├── item_legendary.png
│   ├── item_primal_ancient.png
│   ├── item_rare_blue.png
│   ├── item_rare_yellow.png
│   ├── kanai_cube_left_panel_indicator.png
│   ├── kanai_next_page_icon.png
│   ├── kanai_right_page_indicator.png
│   ├── kanai_right_panel_opened_indicator.png
│   ├── kanai_right_panel_toggle_icon.png
│   ├── quality_yellow_colors.jpg
│   ├── reforge_interface_indicator.png
│   ├── slot_empty.png
│   ├── slot_interference_colors.png
│   └── weox_20251005072400.png
├── providor/
│   ├── i18n/
│   │   ├── README.md
│   │   ├── i18n_auxiliary_panel_en.json
│   │   ├── i18n_auxiliary_panel_zh.json
│   │   ├── i18n_base.json
│   │   ├── i18n_common_en.json
│   │   ├── i18n_common_zh.json
│   │   ├── i18n_d4_panel_en.json
│   │   ├── i18n_d4_panel_zh.json
│   │   ├── i18n_errors_en.json
│   │   ├── i18n_errors_zh.json
│   │   ├── i18n_log_panel_en.json
│   │   ├── i18n_log_panel_zh.json
│   │   ├── i18n_main_window_en.json
│   │   ├── i18n_main_window_zh.json
│   │   ├── i18n_rosbot_panel_en.json
│   │   ├── i18n_rosbot_panel_zh.json
│   │   ├── i18n_skill_config_en.json
│   │   └── i18n_skill_config_zh.json
│   ├── _obsolete_game_state.py
│   ├── _obsolete_window_mapping_provider.py
│   ├── common_imports.py
│   ├── i18n_config.json
│   ├── i18n_config.json.backup
│   ├── providor_index.py
│   └── template_config.json
├── pycore/
│   └── pyutils/
├── scripts/
│   ├── output/
│   │   ├── 微信截图_20251016030310_bars_detected.png
│   │   └── 微信截图_20251016030310_bars_mask.png
│   ├── _obsolete_multi_scale_image_matcher.py
│   ├── color_region_detector.py
│   ├── d3planner_tooltip_test.py
│   ├── interactive_menu.py
│   ├── prepare_detection_training.py
│   ├── prepare_progressbar_training.py
│   ├── progress_bar_detector.py
│   ├── progress_bar_detector_v2.py
│   ├── reorganize_training_data.py
│   ├── show_color_palette.py
│   ├── template_matchertest.py
│   ├── test_color_detector.py
│   ├── test_image.png
│   └── testmenu.py
├── share/
│   ├── __init__.py
│   ├── coordinate_helper.py
│   └── game_interface_data.py
├── state/
│   ├── _obsolete_comprehensive_state_manager.py
│   └── _obsolete_game_state_manager.py
├── timers/
│   ├── README.md
│   ├── __init__.py
│   ├── timer_manager.py
│   └── window_monitor_timer.py
├── ui/
│   ├── components/
│   │   ├── __init__.py
│   │   ├── bottom_bar.py
│   │   ├── debug_window.py
│   │   ├── macro_controls.py
│   │   ├── menu_bar.py
│   │   ├── status_bar.py
│   │   ├── system_tray.py
│   │   └── title_bar.py
│   ├── panels/
│   │   ├── auxiliary_functions_panel.py
│   │   ├── d4_panel.py
│   │   ├── log_panel.py
│   │   ├── main_functions_panel.py
│   │   └── rosbot_extension_panel.py
│   ├── theme/
│   │   ├── __init__.py
│   │   └── theme.py
│   ├── utils/
│   │   └── config_binding.py
│   ├── widgets/
│   │   ├── __init__.py
│   │   ├── basic.py
│   │   ├── combobox.py
│   │   └── hotkey_input.py
│   ├── diablo3_macro_ui.py
│   └── unified_styles.py
├── utils/
│   ├── _obsolete_analyzer_log.py
│   ├── _obsolete_app_launcher.py
│   ├── _obsolete_automation_controller.py
│   ├── _obsolete_battlenet_manager.py
│   ├── _obsolete_bot_scanner.py
│   ├── _obsolete_click_handler.py
│   ├── _obsolete_color_print.py
│   ├── _obsolete_comprehensive_state_manager.py
│   ├── _obsolete_coordinate_monitor.py
│   ├── _obsolete_d3_inventory_analyzer.py
│   ├── _obsolete_d3keyhelper.ahk
│   ├── _obsolete_daily_schedule.py
│   ├── _obsolete_dependency_checker.py
│   ├── _obsolete_diablo_button_clicker.py
│   ├── _obsolete_ftool.py
│   ├── _obsolete_game_process_detector.py
│   ├── _obsolete_game_state_manager.py
│   ├── _obsolete_integrated_automation_controller.py
│   ├── _obsolete_integrated_diablo_clicker.py
│   ├── _obsolete_integrated_window_analyzer.py
│   ├── _obsolete_log_monitor.py
│   ├── _obsolete_parse_history.py
│   ├── _obsolete_play_button_clicker.py
│   ├── _obsolete_process_manager.py
│   ├── _obsolete_program_manager.py
│   ├── _obsolete_random_utils.py
│   ├── _obsolete_rosbot_manager.py
│   ├── _obsolete_time_tool.py
│   ├── _obsolete_tray_clicker.py
│   ├── _obsolete_ui_analyzer.py
│   ├── _obsolete_ui_automation_controller.py
│   ├── _obsolete_window_activator.py
│   ├── _obsolete_window_analyzer.py
│   └── _obsolete_window_ops.py
├── CONSTANTS_UNIFICATION_COMPLETE.md
├── README_MOUSE_COORDINATE_TOOL.md
├── REFACTORING_FINAL_REPORT.md
├── REFACTORING_RESOLUTION_CONSTANTS.md
├── REFACTORING_SUMMARY.md
├── WINDOW_CONSTANTS_ANALYSIS.md
├── d3-check_tree.md
├── debug_mouse.bat
├── debug_mouse_coordinate.py
├── debug_window_offset.py
├── main.py
├── migrate_structure.py
├── task.txt
├── test_image_enhancement.py
├── train.py
├── validate.py
├── yolov8n-cls.pt
└── yolov8n.pt
```

---
*Generated by Directory Tree Generator*