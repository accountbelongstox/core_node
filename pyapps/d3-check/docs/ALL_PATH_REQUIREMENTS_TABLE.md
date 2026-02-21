# 全项目路径要求一览表

全局扫描后的**所有路径相关常量/要求**。  
「要求放」指：约定/代码里规定**必须或建议**把某类数据放在的目录。  
**旧目录** = 当前代码里写死的路径；**新目录要求** = 设计文档（含 pycore voc_annotator DESIGN、迁移脚本）里约定的路径。

---

## 〇、新目录要求（设计文档与迁移脚本）

以下来自 **pycore/pyutils/voc_annotator/DESIGN.md** 与 **scripts/migrate_structure.py**，是相对「旧」代码的**新**约定。

| 来源 | 路径/规则 | 用途 |
|------|-----------|------|
| **voc_annotator DESIGN §9** | **标准路径** = `YOLO_RECORD_BASE_DIR/{client_type}`（如 `.../yolo_record/d4_game`）。其下**直接子目录**均为项目，列入下拉。 | 录制项目「要求放」的标准位置（与当前代码一致）。 |
| **voc_annotator DESIGN §9** | **项目路径可任意**：默认用标准路径；**新建** = 选任意目录作项目根；**载入项目** = 选非标准目录，加入 **cache**（持久化在 `coord_calibration.yolo_project_list`）。 | 非标准路径不要求放在 data/yolo_record，但会进缓存供下拉使用。 |
| **voc_annotator DESIGN §16** | **训练数据根**：`YOLO_DATA_ROOT`（如 `D:\programing\yolo_data`）。布局 **`{YOLO_DATA_ROOT}/{project_name}/{segment_id}/`**，其下 **images/**、**labels/**、**data.yaml**。 | 训练用目录（pycore yolo_data_layout 已实现）。 |
| **migrate_structure.py** | **新训练数据结构**（3 层）：根 = `{d3-check}/.cache/training_data`。**1_sources/projects**（每项目下 patch_images）、**1_sources/shared/backgrounds**、**2_datasets/classification**、**2_datasets/detection**、**3_models/classification**、**3_models/detection**。 | 训练数据迁移后的「新」目录；旧 = `.cache/training_data/source/training_projects`。 |
| **migrate_structure.py** | **旧训练数据**：`{d3-check}/.cache/training_data/source/training_projects/<project>/`（PNG 直接放项目下）。迁移后 → **1_sources/projects/<project>/patch_images/**。 | 迁移脚本的源/目标，与 YOLO 录制路径无关。 |

小结：**新目录要求**里「要求放」的仍是 **YOLO_RECORD_BASE_DIR**（标准路径）；项目可建在任意目录（载入/新建进 cache）。**训练数据**有两套：① YOLO_DATA_ROOT（voc 标注/训练 layout）；② .cache/training_data 的 1_sources/2_datasets/3_models（迁移脚本的新结构）。

---

## 〇、「项目」一词在代码里的两种含义（避免混用）

| 含义 | 变量/来源 | 实际指什么 | 用途 |
|------|-----------|------------|------|
| **应用项目根** | `share/project_path.py` 的 `_PROJECT_ROOT`、`get_project_root()`；`main.py` 的 `_project_dir`；`providor/constants/common.py` 的 `_ROOT_PATH` / `ROOT_DIR` | **pyapps/d3-check** 这个代码库的根目录 | 模板、脚本、导入路径等，都相对这个根。 |
| **YOLO 录制项目** | `_yolo_current_project_path`、`project_path`（yolo_record / coordinate_calibration_panel） | **一个文件夹**，例如 `{d3-check}/data/yolo_record/d3_game/我的项目名`，其下有 `output/`、`patch_images` 等 | 录制输出目录、当前选中的「项目」、导出/标注时的工作目录。**要求放**的位置 = 在 `YOLO_RECORD_BASE_DIR` 下（即 `data/yolo_record/{client_type}/` 下）。 |

因此：**「要求放的项目路径」** = 把 **YOLO 录制项目文件夹** 放在 **`{d3-check}/data/yolo_record`** 下（再按 client_type 分子目录），**不是**「把东西放在 DATA_DIR」或「随便一个 data 目录」。

---

## 一、项目内路径（相对于 d3-check 应用根，当前代码 = 旧）

| 变量/路径 | 定义位置 | 实际路径 | 用途 |
|-----------|----------|----------|------|
| **YOLO_RECORD_BASE_DIR** | `d3utils/yolo_record.py:32` | **`{d3-check}/data/yolo_record`** | **唯一「要求放」目录**（与 voc_annotator DESIGN §9 标准路径一致）：录制/项目数据的标准根；其下按 client_type 分子目录（d3_game、d4_game、battlenet），每个子目录为一个 YOLO 录制项目。 |
| _D3_CHECK_ROOT | `d3utils/yolo_record.py:14` | `pyapps/d3-check` | 推导 YOLO_RECORD_BASE_DIR、GameAISDK 等。 |
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
| YOLO_DATASET_BASE_DIR | `providor/constants/common.py:39` | **`D:\applications\GameTools\Yolo`** | 截图生成 YOLO 数据集输出根（yolo_dataset_YYYYMMDD_HHMMSS）。 |
| YOLO_DATA_ROOT | `pycore/pyutils/voc_annotator/yolo_data_layout.py:19` | `os.environ.get("YOLO_DATA_ROOT", r"D:\programing\yolo_data")` | 训练用目录根（data.yaml、images/、labels/，按 project_name/segment_id 布局）。 |

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
| **「data」歧义** | **要求放**的目录是 **`{d3-check}/data/yolo_record`**（即 YOLO_RECORD_BASE_DIR），**不是** DATA_DIR（`~/.core_node/.d3check`）。DATA_DIR 是用户配置/缓存目录，名字带 data 但和「项目 data」无关。 |
| **「项目」歧义** | **应用项目根** = d3-check 代码库根（ROOT_DIR / get_project_root）。**YOLO 录制项目** = 一个放在 data/yolo_record 下的**文件夹**。说「项目路径」时通常指后者；「要求放的项目路径」= 放在 data/yolo_record 下的项目文件夹。 |
| **YOLO 三个根目录** | ① **YOLO_RECORD_BASE_DIR** = `{d3-check}/data/yolo_record` → 录制/当前项目**要求放**在这里。② **YOLO_DATASET_BASE_DIR** = `D:\applications\GameTools\Yolo` → 截图生成的数据集输出（yolo_dataset_*）。③ **YOLO_DATA_ROOT**（pycore）= `D:\programing\yolo_data`（或环境变量）→ 训练用 data.yaml/images/labels 根。三者用途不同、路径不同，不可混用。 |
| **ROSBOT 两处路径** | **ROSBOT_PATH**（Documents 下）= 日志/配置等用户侧目录。**ROSBOT_GAMETOOLS_BASE** = D 盘 GameTools = 程序安装/更新目录。不是冲突，但易混。 |
| **脚本硬编码** | watch_rosbot_history 的 HISTORY_PATH、slot_line_scan_columns 的 TARGET_DIR、rosbot_extension_panel 的默认 GamesBot 路径：与 CONFIG/常量不一致，换环境会失效或歧义。 |
| **旧 vs 新目录** | **旧** = 代码里唯一「要求放」= `YOLO_RECORD_BASE_DIR`（data/yolo_record）。**新**（DESIGN + 迁移）：标准路径同旧；项目可建在任意目录（载入/新建进 cache）；训练数据 = YOLO_DATA_ROOT（project/segment/images,labels,data.yaml）与 .cache/training_data 的 1_sources/2_datasets/3_models。不冲突，新设计在「标准路径」上与旧一致，并扩展了「非标准项目路径」与训练/迁移目录。 |

---

## 七、小结：哪些是「要求放」的、什么是「项目」

- **唯一「要求放」的目录**：**`{d3-check}/data/yolo_record`**（YOLO_RECORD_BASE_DIR）。约定：**YOLO 录制项目文件夹**应放在此目录下（再按 client_type 分子目录），不是用户目录下的 data，也不是 DATA_DIR。
- **「项目」**：在 UI/录制流程里指 **YOLO 录制项目** = 上述目录下的一个子文件夹；在 share/project_path、main.py、ROOT_DIR 里指 **d3-check 应用项目根**。
- 其他所有路径均为：用户数据、缓存、模板、RoS-BoT、YOLO 数据集输出、YOLO 训练根、脚本本地硬编码等，**非「要求放」的项目 data 路径**。
