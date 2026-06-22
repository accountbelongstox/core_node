# 全项目路径要求一览表

全局扫描后的**所有路径相关常量/要求**。  
「要求放」指：约定/代码里规定**必须或建议**把某类数据放在的目录。  
**旧目录** = 当前代码里写死的路径；**新目录要求** = 设计文档（含 pycore voc_annotator DESIGN、迁移脚本）里约定的路径。

---

## 〇、新目录要求（设计文档与迁移脚本）

以下与 **YOLO_UNIFIED_DIRECTORY_DESIGN.md**、**docs/YOLO_OPEN_LABEL_DATA_FLOW_AND_ISSUES.md** 一致；与 pycore voc_annotator DESIGN、migrate_structure 的对应关系见下表。

| 来源 | 路径/规则 | 用途 |
|------|-----------|------|
| **YOLO_UNIFIED_DIRECTORY_DESIGN** | **唯一根** = **YOLO_DATA_ROOT**（环境变量或默认 `D:\programing\yolo_data`）。**项目树** = `{YOLO_DATA_ROOT}/{client_type}/{project_name}/`，其下直接子目录为段（segment_id），段内 record/、frames/、images/、labels/、data.yaml。 | 录制/项目/标注/训练统一根；与当前代码一致。 |
| **voc_annotator DESIGN §9 对齐** | **标准路径** = `YOLO_DATA_ROOT/{client_type}`。其下**直接子目录**均为项目，列入下拉。**项目路径可任意**：载入非标准目录时加入 **cache**（`coord_calibration.yolo_project_list`）。 | 与 ALL_PATH 〇「YOLO 录制项目」一致。 |
| **YOLO_UNIFIED / voc DESIGN §16 对齐** | **训练/段内布局**：`{YOLO_DATA_ROOT}/{client_type}/{project_name}/{segment_id}/` 下 **images/**、**labels/**、**data.yaml**。生成数据 = `_generated/`，训练用数据集 = `_datasets/`，模型 = `_models/`。 | 与 YOLO_UNIFIED_DIRECTORY_DESIGN 一致。 |
| **migrate_structure.py** | 根 = `{d3-check}/.cache/training_data`：**1_sources/projects**、**2_datasets/**、**3_models/**。 | 迁移脚本用，与 YOLO_DATA_ROOT 项目树独立。 |

小结：**要求放**的 YOLO 项目根 = **YOLO_DATA_ROOT**（非 d3-check 下的 data/yolo_record，已废弃 YOLO_RECORD_BASE_DIR）。项目可建在标准路径下或载入非标准路径进 cache。训练/生成数据均在 YOLO_DATA_ROOT 下或 .cache/training_data（迁移）。

---

## 〇、「项目」一词在代码里的两种含义（避免混用）

| 含义 | 变量/来源 | 实际指什么 | 用途 |
|------|-----------|------------|------|
| **应用项目根** | `share/project_path.py` 的 `_PROJECT_ROOT`、`get_project_root()`；`main.py` 的 `_project_dir`；`providor/constants/common.py` 的 `_ROOT_PATH` / `ROOT_DIR` | **pyapps/d3-check** 这个代码库的根目录 | 模板、脚本、导入路径等，都相对这个根。 |
| **YOLO 录制项目** | `_yolo_current_project_path`、`project_path`（yolo_record / coordinate_calibration_panel） | **一个文件夹**，例如 `{YOLO_DATA_ROOT}/battlenet/default` 或 `{YOLO_DATA_ROOT}/d3_game/我的项目名`，其下有段目录、`patch_images` 等 | 录制输出目录、当前选中的「项目」、导出/标注时的工作目录。**要求放**的位置 = 在 **YOLO_DATA_ROOT** 下（即 `{YOLO_DATA_ROOT}/{client_type}/{project_name}/`）。非标准路径可载入并进 cache（coord_calibration.yolo_project_list）。 |

因此：**「要求放的项目路径」** = 把 **YOLO 录制项目文件夹** 放在 **YOLO_DATA_ROOT** 下（再按 client_type、project_name 分子目录），与 YOLO_UNIFIED_DIRECTORY_DESIGN 一致。**不是** DATA_DIR（用户配置目录）或 d3-check 下的 data/yolo_record（旧表曾写，当前代码已用 YOLO_DATA_ROOT）。见 docs/YOLO_OPEN_LABEL_DATA_FLOW_AND_ISSUES.md。

---

## 一、项目内路径（相对于 d3-check 应用根，当前代码 = 旧）

| 变量/路径 | 定义位置 | 实际路径 | 用途 |
|-----------|----------|----------|------|
| **YOLO_DATA_ROOT** | `pycore.pyutils.voc_annotator.yolo_data_layout` 或 `d3utils/yolo_record.py` fallback | **`os.environ.get("YOLO_DATA_ROOT", r"D:\programing\yolo_data")`** | **YOLO 录制/项目/标注统一根**（与 YOLO_UNIFIED_DIRECTORY_DESIGN 一致）。项目树 = `{YOLO_DATA_ROOT}/{client_type}/{project_name}/`；其下按 client_type 分子目录（battlenet、d3_game、d4_game）。见 docs/YOLO_OPEN_LABEL_DATA_FLOW_AND_ISSUES.md §3.7。 |
| _D3_CHECK_ROOT | `d3utils/yolo_record.py:14` | `pyapps/d3-check` | 推导 GameAISDK、pycore 等路径。 |
| ROOT_DIR / _ROOT_PATH | `providor/constants/common.py:11,16` | `pyapps/d3-check` | 应用项目根，模板等相对路径基准。 |
| TEMPLATE_DIR | `providor/constants/common.py:19` | `{ROOT_DIR}/images` | 模板图片。 |
| CONFIG_PATH | `providor/providor_index.py:513` | `{providor}/template_config.json` | 模板配置 JSON。 |
| TAMPERMONKEY_SCRIPT_PATH | `providor/constants/common.py:18` | `{ROOT_DIR}/scripts/...tampermonkey.user.js` | 脚本路径。 |
| BN_FLOW_SNAPSHOTS_DIR | `providor/constants/common.py:35` | `{ROOT_DIR}/.cache/bn_flow_snapshots` | BN 流程快照缓存。 |
| DEFAULT_APP_ICON_PATH 等 | `providor/constants/common.py:261-263` | `{ROOT_DIR}/images/...` | 应用图标/logo。 |
| IMAGES_DIR | `scripts/scale_images_to_new_base.py:28` | `{d3-check}/images` | 某脚本用的图片目录。 |
| GAMEAISDK_ROOT | `d3utils/yolo_record.py:16` | `{pyapps}/GameAISDK` | GameAISDK 根。 |
| SDKTOOL_ROOT | 同上:17 | `{GAMEAISDK_ROOT}/tools/SDKTool` | SDKTool 根。 |
| GAMEAISDK_DOC | 同上:18 | `{GAMEAISDK_ROOT}/doc` | 文档目录。 |
| ACTION_SAMPLER_PATH | 同上:19 | `{SDKTOOL_ROOT}/src/modules/action_sampler` | 动作采样模块。 |
| _ROSBOT_KEY_DIALOG_JSON_PATH | `d3utils/rosbot_operation.py:21` | `{d3-check}/docs/rosbot_ui_elements_1.json` | RoS-BoT UI 元素 JSON。 |

---

## 二、用户目录 / 配置与缓存（与「要求放」的 data 无关）

| 变量/路径 | 定义位置 | 实际路径 | 用途 |
|-----------|----------|----------|------|
| DATA_DIR / CURRENT_USER_DATA_PATH | `providor/providor_index.py:515-518` | **`~/.core_node/.d3check`** | 用户数据根（配置、缓存）。**名字叫 DATA 但不是「要求放」的 data 目录**。 |
| CONFIG_USER_PATH | 同上:519 | `{CURRENT_USER_DATA_PATH}/d3check_config.json` | 用户配置 JSON。 |
| DEBUG_DIR | 同上:522 | `{CURRENT_USER_DATA_PATH}/.debug` | 调试输出。 |
| CACHE_DIR | 同上:523 | `{CURRENT_USER_DATA_PATH}/.cache` | 通用缓存。 |
| TMP_DIR | `providor/constants/common.py:17` | `~/.core_node/pytools/tmp` | 临时文件。 |
| SCALED_TEMPLATES_CACHE_DIR 等 | 同上:20-33 | `{TMP_DIR}/...` 各子目录 | 缩放模板、登录截图、匹配调试等。 |
| D4_SCREENSHOT_DIR / D4_ANNOTATED_DIR | `providor/constants/d4.py:17-18` | `{TMP_DIR}/d4_screenshots` 等 | D4 截图/标注。 |

---

## 三、文档 / 外部应用路径（可配置或相对 Documents）

| 变量/路径 | 定义位置 | 实际路径 | 用途 |
|-----------|----------|----------|------|
| DOCUMENTS_PATH | `providor/providor_index.py:531` | `~/Documents` | 动态路径基准。 |
| ROSBOT_PATH | 同上:918,938 | `{DOCUMENTS_PATH}/RoS-BoT`（或 config paths.rosbot_relative） | RoS-BoT 目录。 |
| ROSBOT_LOGS_PATH | 同上:919,939 | `{DOCUMENTS_PATH}/RoS-BoT/Logs` | RoS-BoT 日志。 |
| D3CHECK_TEMP_PATH | 同上:920,940 | `{DOCUMENTS_PATH}/.d3check` | 临时目录。 |
| ANNOTATED_SCREENSHOTS_PATH | 同上:921,941 | `{DOCUMENTS_PATH}/.d3check/annotated_screenshots` | 标注截图。 |
| LOGS_FILE_PATH / HISTORY_FILE_PATH | 同上:922-923,942-943 | `{DOCUMENTS_PATH}/RoS-BoT/Logs/...` | 日志/历史文件。 |
| BATTLE_NET_CONFIG_PATH | 同上:655 | `~/AppData/Roaming/Battle.net/Battle.net.config` | 战网配置。 |

---

## 四、固定盘符或环境变量（D 盘 / GameTools / 训练数据根）

| 变量/路径 | 定义位置 | 实际路径 | 用途 |
|-----------|----------|----------|------|
| ROSBOT_GAMETOOLS_BASE | `providor/constants/d3.py:104` | **`D:\applications\GameTools`** | RoS-BoT 更新/安装根目录。 |
| ROSBOT_TEMP_BASE_DIR | `d3utils/rosbot_update_manager.py:59` | `{ROSBOT_GAMETOOLS_BASE}/.tmp` | 更新临时目录。 |
| YOLO_DATA_ROOT | `providor/constants/common.py:40`（Path）或 pycore/yolo_record | 环境变量或默认 `D:\programing\yolo_data` | YOLO 统一根：项目树、生成数据、训练数据均在此下。见 YOLO_UNIFIED_DIRECTORY_DESIGN。 |
| YOLO_DATASET_BASE_DIR | `providor/constants/common.py:42` | **`{YOLO_DATA_ROOT}/_generated/d3_game`** | 截图生成 YOLO 数据集输出（yolo_dataset_* 等）的默认根。 |

---

## 五、脚本/界面中的硬编码或本地路径（易与上面冲突）

| 位置 | 路径/默认值 | 说明 |
|------|-------------|------|
| `scripts/watch_rosbot_history.py:40` | `HISTORY_PATH = r"C:\Users\accou\Documents\RoS-BoT\Logs\history.txt"` | 硬编码用户名人名，与 HISTORY_FILE_PATH（基于 DOCUMENTS_PATH）语义重复，换机器/用户会错。 |
| `scripts/slot_line_scan_columns.py:24` | `TARGET_DIR = r"C:\Users\accou\.core_node\pytools\tmp\debug_bag_line\..."` | 硬编码本地临时目录，仅示例/一次性用。 |
| `scripts/template_matcher_test.py:46-54` | `D3_SCREENSHOT_DIR`、`CACHE_DIR`、`OUTPUT_DIR` 等用 `USER_HOME / ".core_node" / ...` | 与 TMP_DIR、CONFIG 等约定部分重叠但独立定义。 |
| `ui/panels/rosbot_extension_panel.py:96-97` | 默认 `ros_directory`、`battlenet_path` 为 `D:\applications\GamesBot\...`、`D:\applications\Games\...` | 默认盘符与 ROSBOT_GAMETOOLS_BASE（GameTools）不一致（GamesBot vs GameTools）。 |

---

## 六、冲突与易混总结

| 类型 | 说明 |
|------|------|
| **「data」歧义** | **YOLO 项目要求放**在 **YOLO_DATA_ROOT**（如 `D:\programing\yolo_data`）下，**不是** DATA_DIR（`~/.core_node/.d3check`）。DATA_DIR 是用户配置/缓存目录，名字带 data 但和「YOLO 项目 data」无关。 |
| **「项目」歧义** | **应用项目根** = d3-check 代码库根（ROOT_DIR / get_project_root）。**YOLO 录制项目** = 一个放在 YOLO_DATA_ROOT 下的**文件夹**（`{client_type}/{project_name}/`）。说「项目路径」时通常指后者；「要求放的项目路径」= 放在 YOLO_DATA_ROOT 下的项目文件夹。 |
| **YOLO 根目录** | **YOLO_DATA_ROOT**（pycore 或 yolo_record fallback）= 环境变量或默认 `D:\programing\yolo_data`，为录制/项目/标注/训练统一根（YOLO_UNIFIED_DIRECTORY_DESIGN）。**YOLO_DATASET_BASE_DIR**（providor）= `YOLO_DATA_ROOT/_generated/d3_game` 等 → 截图生成的数据集输出。旧文档曾写 YOLO_RECORD_BASE_DIR = d3-check/data/yolo_record，当前代码已统一为 YOLO_DATA_ROOT，见 YOLO_OPEN_LABEL_DATA_FLOW_AND_ISSUES.md §3.7。 |
| **ROSBOT 两处路径** | **ROSBOT_PATH**（Documents 下）= 日志/配置等用户侧目录。**ROSBOT_GAMETOOLS_BASE** = D 盘 GameTools = 程序安装/更新目录。不是冲突，但易混。 |
| **脚本硬编码** | watch_rosbot_history 的 HISTORY_PATH、slot_line_scan_columns 的 TARGET_DIR、rosbot_extension_panel 的默认 GamesBot 路径：与 CONFIG/常量不一致，换环境会失效或歧义。 |
| **旧 vs 新目录** | **当前代码**：YOLO 录制/项目根 = **YOLO_DATA_ROOT**（pycore 或 yolo_record fallback），项目树 = `{YOLO_DATA_ROOT}/{client_type}/{project_name}/`。非标准路径可载入并进 CONFIG cache。训练/生成数据 = YOLO_DATA_ROOT 下 _generated、_datasets、_models 等（YOLO_UNIFIED_DIRECTORY_DESIGN）。.cache/training_data 的 1_sources/2_datasets/3_models 为迁移脚本用。 |

---

## 七、小结：哪些是「要求放」的、什么是「项目」

- **YOLO 项目「要求放」的目录**：**YOLO_DATA_ROOT**（如 `D:\programing\yolo_data` 或环境变量）。约定：**YOLO 录制项目文件夹**应放在 `{YOLO_DATA_ROOT}/{client_type}/{project_name}/` 下（YOLO_UNIFIED_DIRECTORY_DESIGN）；非标准路径可载入并进 CONFIG cache。不是 DATA_DIR（用户配置目录）。见 docs/YOLO_OPEN_LABEL_DATA_FLOW_AND_ISSUES.md。
- **「项目」**：在 UI/录制流程里指 **YOLO 录制项目** = 上述目录下的一个子文件夹；在 share/project_path、main.py、ROOT_DIR 里指 **d3-check 应用项目根**。
- 其他所有路径均为：用户数据、缓存、模板、RoS-BoT、YOLO 数据集输出、YOLO 训练根、脚本本地硬编码等，**非「要求放」的项目 data 路径**。
