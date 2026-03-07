# 技术说明：battlenet_ui_inspector.py、asia_credentials.py、_obsolete_game_state_manager.py、i18n_auxiliary_panel_en.json

本说明针对以下四处：修改前请先通读本说明及对应源码/文件。

- `d3utils/battlenet_ui_inspector.py`
- `share/asia_credentials.py`
- `utils/_obsolete_game_state_manager.py`
- `providor/i18n/i18n_auxiliary_panel_en.json`

---

## 一、d3utils/battlenet_ui_inspector.py

- **用途**：战网 UI 控件分类，区分「主窗口标题栏关闭按钮」与「悬浮弹窗关闭按钮」；供 try_close_popup 等使用。is_main_window_close_button(automation_id) 为 True 时不得点击（会关掉整个客户端）；is_popup_close_button_by_automation_id、is_popup_close_button_by_name 用于识别弹窗关闭；filter_popup_close_controls 从控件列表筛出仅弹窗关闭按钮（排除主窗口关闭）。
- **约定**：依赖 providor.constants.common 的 BATTLE_NET_POPUP_CLOSE_AUTOMATION_IDS、BATTLE_NET_POPUP_CLOSE_NAME_KEYWORDS、BATTLE_NET_MAIN_WINDOW_FRAME_AUTOMATION_ID_SUBSTRINGS。主窗口关闭判定：aid 须同时含 MAIN_WINDOW_FRAME 中某项且含 "winCloseButton"；弹窗关闭先按 automation_id 匹配、再按 name（Close/关闭）匹配，且排除主窗口关闭。
- **易错点**：若 common 中常量仅含父级 container 不含 winCloseButton，则 is_main_window_close_button 可能永远不成立，try_close_popup 可能误点主窗口关闭；filter_popup_close_controls 中 aid 为空时 is_main_window_close_button(aid) 为 False，可能把主窗口关闭按钮当弹窗加入；改 common 常量未同步本文件会逻辑错；战网 UI 改版 automation_id 变化须同步常量。
- **正确做法**：改 common 中 BATTLE_NET_* 常量时同步本文件；主窗口关闭判定与战网实际 automation_id 树一致；边界情况（空 aid、空 name）明确约定；修改前请先通读本说明及 providor/constants/common.py。

---

## 二、share/asia_credentials.py

- **用途**：战网亚服/国服账号密码；按 region（REGION_ASIA/REGION_CN）读写配置；密码加密存储、解密读取（pycore.pyutils.security）；CONFIG 键 battlenet_asia_credentials、battlenet_cn_credentials；弹窗 _show_credentials_dialog（region 下拉、账号、密码、OK/Cancel）；schedule_battlenet_credentials_dialog 在主线程调度弹窗；_asia_credentials_dialog_pending 为 True 时 tick 等应跳过直至弹窗关闭。
- **约定**：get_credentials(region) 返回 (email, password) 或 None；save_credentials(region, email, password) 加密 password 后写入配置；get_app_root() 取 Tk 根、root.after(0, ...) 在主线程显示弹窗；REGION_LABELS 为 (("亚服", REGION_ASIA), ("国服", REGION_CN))；BN flow 需要账号时调用 schedule_asia_credentials_dialog 或 schedule_battlenet_credentials_dialog(default_region)。
- **易错点**：改 CONFIG 键名未与 get_config_value_safe、set_config_value_safe 及 template_config 默认结构同步会读不到或写错；改 region 枚举或 REGION_LABELS 未与弹窗下拉及 _config_key_for_region 同步会键错；在非主线程直接调用 _show_credentials_dialog 会 Tk 错；is_asia_credentials_dialog_pending 未在弹窗打开/关闭时正确设会导致 tick 不跳过；decrypt 失败时 get_credentials 返回 None、弹窗会再提示输入。
- **正确做法**：改配置键或 region 时同步 asia_credentials、template_config、BN flow 中 perform_asia_email_step/perform_asia_password_step 调用方；仅通过 schedule_* 在主线程显示弹窗；修改前请先通读本说明及 providor.providor_index get/set_config_value_safe。

---

## 三、utils/_obsolete_game_state_manager.py

- **用途**：文件名带 _obsolete_，表示**已废弃**。原为 Diablo III 与 RoS-BoT 统一状态管理：GameStateManager、ProcessState、check_diablo_status、check_rosbot_status、should_start_diablo、should_start_rosbot、get_system_status。依赖 CONFIG（monitoring、ros_settings）、GameProcessDetector、**utils.rosbot_manager.RoSBotManager**。
- **约定**：utils 下无 rosbot_manager.py（仅有 _obsolete_rosbot_manager），import RoSBotManager 会 ImportError 或为废弃链。主流程状态与启动决策由 **rosbot_status_provider**、**flow（process_task、flow_state）**、**d3utils/rosbot_manager** 负责，不由此文件决定。不得在主流程或面板中调用 GameStateManager 作为状态或启动依据。
- **易错点**：当作主流程状态或启动决策入口会绕过 flow 与 rosbot_status_provider；在此文件内新增方法或修 CONFIG 期望主程序生效则主流程不会调用；与 rosbot_status_provider 混淆（当前 ROSBOT 状态由 refresh_rosbot_status 写 game_interface_data）；删文件前未 grep 会导致残留引用 ImportError。
- **正确做法**：主流程不引用 _obsolete_game_state_manager；ROSBOT 状态用 rosbot_status_provider + game_interface_data；启动决策用 flow_state 与 process_task；删前必 grep；修改前请先通读本说明及技术说明_bn_flow_B5与obsolete_game_state及rosbot_status_provider及ctl_func与d4_controller.md。

---

## 四、providor/i18n/i18n_auxiliary_panel_en.json

- **用途**：辅助功能面板英文文案；结构 ui.auxiliary_functions.*、ui.auxiliary_panel.*、ui.bag_offset.*；与 i18n_auxiliary_panel_zh.json 成对；代码用 get_ui_text("ui.auxiliary_panel.xxx") 等。
- **约定**：键与 zh 及代码中 get_ui_text 的路径一致；新增或重命名 key 须 en 与 zh 同步，否则英文界面会显示 key 或空白；术语（Kanai、Blood Shard、Forgotten Soul 等）与产品及 D3 用语一致。
- **易错点**：在 zh 中新增或重命名键而 en 未同步会英文显示 key；结构 ui.auxiliary_functions 与 ui.auxiliary_panel 两层需与 zh 及 get_ui_text 查找路径一致；策略/选项值若用中文展示而内部用英文 key 需与 main_functions_panel、ConfigBinding 映射一致。
- **正确做法**：增删 key 时 en 与 zh 同步；键路径与 get_ui_text("ui.auxiliary_panel.xxx") 一致；修改前请先通读本说明及技术说明_debug_window_offset与extension_flow_tick_step及i18n_auxiliary_panel_en.md。

---

## 五、四处与道歉文档的对应

本说明对应专属道歉文档 **第五十九节** 及长文道歉中「就 battlenet_ui_inspector、asia_credentials、_obsolete_game_state_manager、i18n_auxiliary_panel_en 四处」之分析与道歉段。发现上述四处文件时，应继续更新到道歉文档（技术说明、专属节、长文追加）。
