# 技术说明：CODE_TREE.md、status_row_config.py、_obsolete_automation_controller.py、scale_images_to_new_base.py、battlenet_capture.py

本说明针对以下五处：修改前请先通读本说明及对应源码/文件。

- `docs/CODE_TREE.md`
- `ui/components/status_row_config.py`
- `utils/_obsolete_automation_controller.py`
- `scripts/scale_images_to_new_base.py`
- `d3utils/battlenet_capture.py`

---

## 一、docs/CODE_TREE.md

- **用途**：d3-check 代码树分层说明；Layer 1 Entry（main.py）、Layer 2 Runtime（lifecycle、threads、events）、Layer 3 Controllers、Layer 4 d3utils、Layer 5 share（values/data、common/共用函数）、Layer 6 timers、Layer 7 UI、Layer 8 config and providor；Import rules：main 与 controllers 需 lifecycle 从 runtime 导入；与 PROJECT_STANDARDS.md §一§二整合。
- **约定**：层次与模块角色已整合至 PROJECT_STANDARDS §一§二，本档为分层细节展开；share = share/values/（数据与 get_*/set_* only）+ share/common/（共用工具与基类）；no run_/do_ in share；One-shot 用 timers.one_shot_tasks.do_*。
- **易错点**：Layer 3 中 controller 路径或角色描述与实现不一致会误导；目录或文件移动、新增模块后未同步本档会导致按树推断导入或层级时出错；Import rules 若代码中 controller 直接 import d3utils 做生命周期相关逻辑未改文档会约定失效；与 PROJECT_STANDARDS 冲突或不同步会两张皮。
- **正确做法**：增删移动 controller/d3utils 等时同步本档与 PROJECT_STANDARDS；修改前请先通读本说明及 docs/PROJECT_STANDARDS.md。

---

## 二、ui/components/status_row_config.py

- **用途**：底栏状态行配置；两行 STATUS_ROW_1（battlenet、ros、d3、map）、STATUS_ROW_2（stage、oauth、window_size）；每项 (label_i18n_key, var_key, default_fg)；default_fg 为 None 时 BottomBar 按 state 设 value label fg。
- **约定**：var_key 与 bottom_bar 传入的 status_vars 键必须一一对应；label_i18n_key 须与 i18n 中 rosbot.*、ui.status_bar.* 等键存在；STATUS_ROW_1/2 顺序与底栏渲染顺序一致；game_status 已从 Row 2 移除（redundant with D3 status）。
- **易错点**：增删或改名 var_key 后 bottom_bar 或 diablo3_macro_ui 未传对应 status_vars 会导致该列不显示或 KeyError；改 label_i18n_key 未与 i18n 同步会显示 key 或文案错；调换顺序会打乱底栏布局；三元组结构改为二元或四元会 bottom_bar_status_block 解析错。
- **正确做法**：增删状态项时同步 status_row_config 与 bottom_bar 的 status_vars 来源、i18n 键；修改前请先通读本说明及技术说明_coordinate_picker_visual_improvements与log_monitor_api及status_row_config及bottom_bar_options_block及bn_flow_B9.md、bottom_bar_status_block。

---

## 三、utils/_obsolete_automation_controller.py

- **用途**：文件名带 _obsolete_，表示**已废弃**。原 AutomationController：execute_operations(window_title, operation_ids, ui_elements, json_path)、win32gui/win32api 点击与按键；from utils.color_print（项目现用 pycore.pyfoundations.color_print）；_load_ui_elements_from_json 读 data.get('elements', [])。
- **约定**：主流程不引用；勿在此文件加功能或修 import 作为主方案；删前必 grep；若 utils.color_print 不存在会 ImportError，应为历史遗留。
- **易错点**：引用或扩展本文件会依赖废弃逻辑；在此改 execute_operations 或 UI 元素格式主流程不会调用；与当前战网/登录自动化（battlenet_operation、battlenet_region_judge 等）架构不同，混用会两套逻辑。
- **正确做法**：主流程不引用 _obsolete_automation_controller；自动化用 battlenet_operation、screenshot_provider、battlenet_ui_inspector 等；删前 grep；修改前请先通读本说明及项目自动化架构。

---

## 四、scripts/scale_images_to_new_base.py

- **用途**：将 pyapps/d3-check/images 下图片从旧基准 1826×1301 缩放到新基准 1300×800（1080P）；_SCRIPT_DIR.parent = pyapps/d3-check，IMAGES_DIR = _D3_CHECK_ROOT / "images"；OLD_BASE_*、NEW_BASE_*、SCALE_X/Y；支持 --dry-run；PNG 用 RGBA、其它用 RGB。
- **约定**：从 repo root 或 pyapps/d3-check 运行、Python path 含 pyapps/d3-check；非 dry_run 时 resized.save(path) 直接覆盖原图无备份；rglob 会处理子目录。
- **易错点**：_D3_CHECK_ROOT 假定本文件在 scripts/ 下，若移动脚本会 IMAGES_DIR 错；OLD_BASE_*、NEW_BASE_* 为魔数，项目改用其它标准分辨率需改常量；images 下有不应缩放的资源需排除时当前无排除列表；扩展名非 png 而带 alpha 会丢通道。
- **正确做法**：改基准尺寸时同步常量或参数化；移动脚本时同步 _D3_CHECK_ROOT；修改前请先通读本说明。

---

## 五、d3utils/battlenet_capture.py

- **用途**：capture_battlenet_and_save_to_category(category="login_try")；get_battlenet_manager().prime_window_cache_for_capture()、get_screenshot_provider().gen()、get_screenshot_category_manager().get_dir(category)、LOGIN_TRY_SCREENSHOT_PREFIX；保存到 category 目录并 clean_older_than。
- **约定**：依赖 providor.constants.common.LOGIN_TRY_SCREENSHOT_PREFIX、config.screenshot_categories.get_screenshot_category_manager、d3utils.screenshot_provider、d3utils.battlenet_manager；category 默认 "login_try"；prefix 依 category 选 LOGIN_TRY_SCREENSHOT_PREFIX 或 "battlenet"。
- **易错点**：改 get_battlenet_manager、get_screenshot_provider、get_screenshot_category_manager 接口未同步会调用失败；改 category 或 get_dir 返回未同步会路径错；LOGIN_TRY_SCREENSHOT_PREFIX 改名未同步会文件名错；prime_window_cache_for_capture 失败时返回 (None, None)，调用方须容错。
- **正确做法**：改 battlenet_manager、screenshot_provider、screenshot_categories 相关 API 时同步本文件；修改前请先通读本说明及 config.screenshot_categories、providor.constants.common。

---

## 六、五处与道歉文档的对应

本说明对应专属道歉文档 **第六十一节** 及长文道歉中「就 CODE_TREE、status_row_config、_obsolete_automation_controller、scale_images_to_new_base、battlenet_capture 五处」之分析与道歉段。发现上述五处文件时，应继续更新到道歉文档（技术说明、专属节、长文追加）。
