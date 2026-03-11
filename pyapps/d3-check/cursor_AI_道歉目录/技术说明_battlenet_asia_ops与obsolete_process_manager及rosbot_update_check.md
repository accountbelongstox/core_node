# 技术说明：battlenet_asia_ops、_obsolete_process_manager、rosbot_update_check

**目的**：说明此三处文件的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `d3utils/battlenet_asia_ops.py`
- `utils/_obsolete_process_manager.py`
- `d3utils/rosbot_update_check.py`

---

## 一、d3utils/battlenet_asia_ops.py

### 1.1 职责与约定

- **用途**：亚服战网登录差异化操作：邮箱步、密码步、同屏账号+密码（combined）。依赖 **BattlenetOperation**（_op）提供 _enumerate_controls、set_control_value、focus_control、click_control、get_clickable_buttons；**判定逻辑委托 BattlenetRegionJudge**，通过 build_judge_from_controls(controls) 构建 Judge。常量来自 **providor.constants.common**：ASIA_LOGIN_ACCOUNT_AUTOMATION_IDS、ASIA_LOGIN_PASSWORD_*、ASIA_LOGIN_SUBMIT_*、ASIA_LOGIN_CONTINUE_*、ASIA_LOGIN_DEBUG_INPUT 等。填框优先 UIA ValuePattern.SetValue，失败则 pycore field_input（键盘）。_find_account_control、_find_password_control、_find_submit_button、_find_continue_button、_find_log_in_button 等按 automation_id 或 name 查找；perform_asia_email_step、perform_asia_password_step、perform_asia_combined_login、perform_asia_login_fill_and_submit 为对外入口。
- **约定**：不可在 AsiaOps 内重复实现「是否在邮箱步/密码步」等判定，须经 _judge(controls) 调用 Judge；常量与 providor.constants.common 及 docs/登陆后的战网元素 一致；_op 由外部注入 BattlenetOperation，AsiaOps 不创建 Operation；若改 Judge 接口或常量须同步本模块与调用方。

### 1.2 易错点

- 在 AsiaOps 内自实现 is_on_asia_email_step 等逻辑会破坏「Judge 为单一真相源」（BATTLENET_REGION_DESIGN_REVIEW）；改 ASIA_LOGIN_* 常量未同步 providor.constants.common 会找错控件；改 _op 的接口约定会破坏 fill/click。

### 1.3 正确做法

- 判定一律经 self._judge(controls)；常量以 providor.constants.common 为准；修改前通读 BATTLENET_REGION_DESIGN_REVIEW 与登陆后的战网元素-控件说明。

---

## 二、utils/_obsolete_process_manager.py

### 2.1 职责与约定

- **用途**：**已废弃模块**（_obsolete_ 前缀）。ProcessManager：start_program_with_explorer（用 explorer 启动、带参数时写 bat）、kill_process_by_name（taskkill）、kill_process_by_pid、is_process_running、get_processes_by_name、get_processes_by_window_title（win32gui）、cleanup_temp_files。**使用 utils.color_print 的 ColorPrint**（非 pycore.pyfoundations.color_print），与项目规范不一致；当前进程启动/重启逻辑以设计文档为准（如 subprocess taskkill + explorer 在别处实现），不引用本文件。
- **约定**：不引用、不在此扩展；删除前 grep ProcessManager、_obsolete_process_manager、start_program_with_explorer 等确认无引用；与设计文档中的「无 Python 线程、taskkill + explorer」一致处应以设计文档与现有实现为准。

### 2.2 易错点

- 误当可用进程管理使用会引入 utils.color_print 错误依赖与旧设计；若在此补 pycore ColorPrint 仍不改变废弃定位；与设计文档规定的启动/重启方式可能冲突。

### 2.3 正确做法

- 视作只读历史参考；进程启停以设计文档与当前实现为准；删除前确认无引用。

---

## 三、d3utils/rosbot_update_check.py

### 3.1 职责与约定

- **用途**：ROSBOT 更新检查。**仅当战网区域已探测（亚服/国服）时执行**；get_battlenet_region() 来自 **get_game_interface_data().get_battlenet_region()**。Downloads 目录来自 CONFIG paths.downloads_dir 或 ~/Downloads；zip 筛选：>20M、匹配区服（ROSBOT_ZIP_KEYWORDS_ASIA/CN 来自 **providor.constants.d3**）；创建 GameTools\\{Asia|CN}_版本号，解压后递归找 RoS-BoT.exe，将 exe 所在目录重命名并移动到 GameTools\\{区服}_版本号\\RosBot\\，复制旧 RoS-BoT.ini，**set_config_value_safe("ros_settings.ros_directory", final_dir)** 并清 **rosbot_manager 单例缓存**（_rosbot_manager = None）。run_rosbot_update_check 返回 (zip_path, is_newer, version_str, region)；ask_yes_no_on_main_thread 在主线程弹框。常量 ROSBOT_GAMETOOLS_BASE、ROSBOT_ZIP_MIN_SIZE_MB、ROSBOT_EXE_PATTERNS、ROSBOT_ZIP_KEYWORDS_* 来自 providor.constants.d3。
- **约定**：区服来源仅为 get_game_interface_data().get_battlenet_region()，不可在此模块内自判区服；CONFIG 键 ros_settings.ros_directory 与 paths.downloads_dir 须与配置层一致；更新后须清 rosbot_manager 缓存否则 get_ros_directory 仍返回旧路径；是否更新需弹窗确认由调用方或 UI 负责（本模块提供 ask_yes_no_on_main_thread）。

### 3.2 易错点

- 在模块内自判区服会破坏 BattlenetRegionJudge 单一真相源；改 CONFIG 键或常量未同步 providor.constants.d3 会路径错或筛不到 zip；更新后未清 _rosbot_manager 会读到旧目录；get_battlenet_region() 为 None 时本模块正确跳过更新检查，若强制执行会误用区服。

### 3.3 正确做法

- 区服只读 get_game_interface_data().get_battlenet_region()；常量与 CONFIG 键以 providor 与配置层为准；更新成功后 set_config_value_safe 并清 rosbot_manager 单例；修改前通读 ROSBOT_UPDATE_FLOW 或相关设计。

---

## 四、与道歉文档的关系

若此前因未先通读上述三处约定（AsiaOps 委托 Judge、常量与 common 同步；_obsolete_process_manager 勿用、utils.color_print 与设计文档；rosbot_update_check 区服来源与缓存清理）而在此三处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加第三十八节引用。
