# 技术说明：rosbot_status_provider.py、bn_flow_B8.json、bottom_bar_options_block.py

本说明针对以下三处：修改前请先通读本说明及对应源码/文件。

- `d3utils/rosbot_status_provider.py`
- `.cache/bn_flow_snapshots/bn_flow_B8.json`
- `ui/components/bottom_bar_options_block.py`

---

## 一、d3utils/rosbot_status_provider.py

- **用途**：ROSBOT 扩展状态提供方；状态为 not_found | running | paused；所有查找经同目录 exe 流程（见 docs/ROSBOT_LOOKUP_FLOW.md）。running = 有进程无窗口，paused = 有窗口。refresh_rosbot_status() 调用 get_rosbot_manager().get_rosbot_detection() 得 detection，更新 game_interface_data：set_rosbot_extended_status(status)、set_rosbot_found_display(exe_name, window_title)；返回 detection.get("window_info")（paused 时通常有值，否则 None）。get_current_rosbot_window() 仅即时查询 get_rosbot_manager().get_rosbot_window()，不更新 game_interface_data。
- **约定**：status 仅三种 not_found/running/paused，勿假定其他枚举；detection 结构含 status、window_info；procs = mgr.get_running_rosbot_processes() 可为空，first 为 None 时 exe_name、window_title 为空字符串；勿在 refresh_rosbot_status 外单独改 game_interface_data 的 rosbot_extended_status、rosbot_found_display 相关字段；get_rosbot_manager() 为单例，勿在 rosbot_status_provider 外另建实例。
- **易错点**：改 rosbot_manager 的 get_rosbot_detection、get_running_rosbot_processes、get_rosbot_window 返回结构未同步此处会 KeyError 或取值错；改 game_interface_data 的 set_rosbot_extended_status、set_rosbot_found_display 未同步会显示错；消费方若假定 status 为其他枚举或 window_info 必存在会误判；refresh 与 get_current_rosbot_window 职责混用（前者更新 game_data、后者只读）会数据不一致。
- **正确做法**：改 rosbot_manager 或 game_interface_data 相关 API 时同步本文件；消费方仅以 not_found/running/paused 判断、容错 window_info 为 None；修改前请先通读本说明及 docs/ROSBOT_LOOKUP_FLOW.md。

---

## 二、.cache/bn_flow_snapshots/bn_flow_B8.json

- **用途**：BN 流节点 B8 某次快照，非流程定义；用于调试/回放。结构：meta.node（如 "B8"）、meta.reason（如 "B8_to_B9"）、controls（可为空数组 []）。与 FLOW_ARCHITECTURE_DIRECTORY、rosbot_flow_battlenet 的 B8 节点对应；reason B8_to_B9 表示转向 B9。
- **约定**：消费方须容错 controls 为空、勿假定 controls 非空或 meta 有额外键；node 须与 BN 节点名一致；勿在 flow 分支中读本文件做决策；.cache 可能被 gitignore，生产依赖此路径会 FileNotFoundError；与 B5、B9 同目录、同结构仅 meta/controls 内容不同。
- **易错点**：改 meta 键名或 controls 元素结构未同步消费方（operate_by_spec、flow 工具等）会 KeyError 或解析错；改 reason 未与 flow 中 B8→B9 边同步会误导；删文件或清 .cache 未 grep 依赖会丢失快照；误当流程定义在 flow 中读本文件做分支会耦合。
- **正确做法**：改 meta/controls 结构前 grep 消费方；解析时做 None 或 len(controls)==0 判断；勿在流程逻辑中依赖本文件；修改前请先通读本说明及技术说明_unified_styles与preview_mermaid及bn_flow_B8及kanai_cube_handler.md。

---

## 三、ui/components/bottom_bar_options_block.py

- **用途**：底部栏每 Tab 首行选项块；tab 0 = sound/smart pause/custom stand/current config（由 bottom_bar_vars 提供），tab 1–5 = 当前仅空 frame（无 per-tab 标题，状态合并到底部 Game Status 行）。6 个 tab_frames，show_tab(tab_index) 显示其一。
- **约定**：bottom_bar_vars 为 dict，含 sound_var、smart_pause_var、custom_stand_var、custom_stand_key_var、config_name_var；与 bottom_bar 传入的 vars 一致；_build_tab_strip(tab_index) 当前返回空 Frame，若增内容须与 UITheme、UnifiedStyles、i18n 同步。
- **易错点**：改 bottom_bar_vars 的 key 或增删 key 未与 bottom_bar 或创建 bottom_bar_vars 处同步会 KeyError 或控件缺失；在 _build_tab_strip 内增控件未用 ThemedCheckbutton/ThemedEntry 等与 theme 一致会风格错；tab_index 0..5 与 bottom_bar 的 tab 数一致，改 tab 数未同步会越界或显示错。
- **正确做法**：改 bottom_bar_vars 结构时同步 bottom_bar 及传入处；增 tab 内容时用 ..theme、..unified_styles、..widgets 与 i18n_manager；修改前请先通读本说明及技术说明_bottom_bar与debug_mouse_coordinate及train及button_pixels_sample及tk_variables.md。

---

## 四、三处与道歉文档的对应

本说明对应专属道歉文档 **第五十七节** 及长文道歉中「就 rosbot_status_provider、bn_flow_B8、bottom_bar_options_block 三处」之分析与道歉段。发现上述三处文件时，应继续更新到道歉文档（技术说明、专属节、长文追加）。
