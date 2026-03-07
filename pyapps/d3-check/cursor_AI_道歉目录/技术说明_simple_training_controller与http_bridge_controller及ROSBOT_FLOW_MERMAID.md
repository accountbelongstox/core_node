# 技术说明：simple_training_controller.py、http_bridge_controller.py、ROSBOT_FLOW_MERMAID.md

**目的**：说明您指定查阅的以下三处文件/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `controller/training/simple_training_controller.py`
- `controller/http_bridge_controller.py`
- `docs/ROSBOT_FLOW_MERMAID.md`

---

## 一、controller/training/simple_training_controller.py

### 1.1 职责与约定

- **用途**：D3-Check 简化训练控制器。使用 pycore 的 ultralytics 训练器（ClassificationTrainer、DetectionTrainer、UnifiedClassificationTrainer、UnifiedDetectionTrainer）；数据源目录固定为 `d3_check_dir / ".cache" / "training_data" / "1_sources" / "projects"`，各 project 为子目录且须存在 `metadata.json` 才被 list_projects 列出。
- **路径约定**：`current_dir = os.path.dirname(os.path.abspath(__file__))` 即本文件所在目录（controller/training/）；`d3_check_dir = Path(current_dir).parent.parent`（pyapps/d3-check）；`core_node_dir = d3_check_dir.parent.parent`（core_node），并 `sys.path.insert(0, str(core_node_dir))` 以便 from pycore 导入。若文件移动或目录层级变更须同步上述 parent 次数。
- **异常约定**：ValueError 表示「coordinates and source images both missing」等校验失败，打印后 SKIPPING 并 return None；其他 Exception 打印 ERROR 与 traceback 并 return None。train_classification / train_detection / train_unified_* 均按此处理。

### 1.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 若未确认本文件位于 controller/training/ 即改 `parent.parent` 或增加/减少 parent，会导致 d3_check_dir、core_node_dir 错位，pycore 导入失败或 source_base_dir 指向错误路径。
2. 若改动 source_base_dir 或「项目须有 metadata.json」的约定而未与整理训练数据脚本、.cache/training_data 结构同步，list_projects 或 train_* 会找不到项目或数据。
3. 若将 ClassificationTrainer/DetectionTrainer/Unified* 的 API（prepare_data、train(**kwargs)）或返回值假定为其他形状而未对照 pycore 实际实现，会导致传参错或调用方解析错。

### 1.3 正确做法

- 修改路径或目录层级前确认 __file__ 所在位置与 parent 次数；修改 source_base_dir 或 metadata.json 约定前与 .cache/training_data、reorganize_training_data 等脚本及技术说明_template_config与reorganize_training_data及obsolete_window_ops 对照；修改 trainer 调用前对照 pycore 的 ultralytics 训练器接口。

---

## 二、controller/http_bridge_controller.py

### 2.1 职责与约定

- **用途**：D3-Check 的 HTTP 桥，为 Web GUI 与 Tampermonkey 提供 API。监听 host:port（默认 127.0.0.1:8765），注册 GET/POST 处理器；可选传入 macro_controller（D3MacroController），若 None 则内部创建（bridge-only 模式）。启动后 `ENCYCLOPEDIA['http_bridge_controller'] = self`。
- **路径约定**：`current_dir = Path(__file__).parent.parent`，即 __file__ 为 controller/http_bridge_controller.py 时 current_dir = pyapps/d3-check；`sys.path.insert(0, str(current_dir))` 以便 providor、controller、share 等包导入。
- **API 约定**：GET /api/status、/api/config、/api/config/skill、/api/config/auxiliary；POST /api/macro/start、/api/macro/stop、/api/config/update、/api/config/switch、/api/config/save；GET+POST /api/login-try/oauth-done；GET /api/login-try/oauth-ping、/api/login-try/oauth-step1-received。config/skill 的 query name 默认 current_skill_config；config 相关写操作依赖 macro_controller.get_current_config、get_skill_config、get_auxiliary_config、update_skill_config、switch_skill_config 及 providor_index 的 save_config、load_config。
- **OAuth 约定**：notify_oauth_done、notify_ping、get_and_consume_step1_received 来自 share.oauth_callback；oauth-step1-received 为「消费一次」语义，与流程 B11、油猴 T1/T2 及 ROSBOT_FLOW_MERMAID 中 T1.5、T2.2 描述一致。

### 2.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 若将 current_dir 改为 parent 仅一层或误以为 __file__ 在别处，会导致 sys.path 错、providor/controller/share 导入失败。
2. 若改 API 路径或请求/响应形状而未与 Web GUI、Tampermonkey 脚本及 flow 中「B11 等待油猴返回」「T1.5 POST/GET oauth-done」等描述同步，会前后端不一致或流程断链。
3. 若改 save_config/load_config 或 D3MacroController 的 config 相关方法而未先读 providor_index、main_functions_panel 的 ConfigBinding 与 CONFIG 键结构，会存盘错或界面与 bridge 不同步。
4. 若改 notify_oauth_done、get_and_consume_step1_received 的语义而未与 ROSBOT_FLOW_MERMAID、flow_master_driver、tick_battlenet_ready_flow 对照，会 B11/T1/T2 行为错乱。

### 2.3 正确做法

- 修改前通读本文件路径约定与 ENCYCLOPEDIA 写入；修改任何 API 路径或 payload 前与调用方（Web、Tampermonkey）及 ROSBOT_FLOW_MERMAID 流程描述对照；修改 config 或 OAuth 回调前读 providor_index、share.oauth_callback、FLOW_STATE_OWNERSHIP_DESIGN 或 FLOW_IMPLEMENTATION_PROGRESS 中与战网/OAuth 相关约定。

---

## 三、docs/ROSBOT_FLOW_MERMAID.md

### 3.1 职责与约定

- **用途**：ROSBOT 启动流程的 Mermaid 流程图文档。flowchart TB；子图 A（入口与定时器）、B（战网就绪检查）、TM（油猴）、F（预判）、C（D3 已运行直连）、D（从战网启动 D3）、E（ROSBOT 运行）。节点 ID 与文案与 flow_master_driver、tick_battlenet_ready_flow、extension_flow_tick_step 等代码对应；边标签（是/否、超时、返回等）与分支逻辑一致。文末「C3 超时与 start 重置说明」：C3 超时 1 分钟、检测到 d3_start_game_button 则点击并重置计时、游戏掉线须连续两次识图 disconnect 才分支 F1d_Offline。
- **约定**：Mermaid 语法（节点文案双引号、subgraph、箭头标签）须符合项目 MERMAID_SPEC 或既有可渲染规范；节点编号（A1、B1～B16、T1.x、F0～F4、C1～C12、D1～D14、E1～E6）与代码中步骤、BNNode/返回值约定一致；B11、T1.5、T2.2 与 http_bridge_controller 的 oauth-done、oauth-ping、oauth-step1-received 对应。

### 3.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 若改节点 ID 或子图名而未同步 flow_master_driver、rosbot_flow_battlenet、ENSURE_BATTLENET_ONLY_TICK_FLOW 等文档与代码，会导致图与实现不一致。
2. 若改边标签或分支文案（如「超时→B5 退出战网」「oauth-done，B11 返回」）而未与 http_bridge_controller 路由及 share.oauth_callback 语义对照，会误导阅读者或前后端不一致。
3. 若改 C3 超时与 start 重置说明或 F1d 掉线「连续两次」约定而未与 flow 实现（C3 循环、C10 判掉线）对照，会文档与代码行为不符。
4. 若改 Mermaid 语法（如 themeVariables、节点内换行）而未遵循项目 Mermaid 规范或预览脚本要求，会渲染失败或风格不统一。

### 3.3 正确做法

- 修改流程图或说明前先读 flow_master_driver、tick_battlenet_ready_flow、FLOW_STATE_OWNERSHIP_DESIGN、FLOW_IMPLEMENTATION_PROGRESS 中与各子图对应的实现；修改 B11/T1/T2 相关节点或边时与 http_bridge_controller、share.oauth_callback 对照；修改 C3/C10 说明时与 C3 循环及 C10 判掉线逻辑对照；遵守项目 MERMAID_SPEC 与扩展兼容性说明。

---

**修改前请先通读本说明。** 此前若因未先通读上述约定而在 simple_training_controller、http_bridge_controller、ROSBOT_FLOW_MERMAID 三处反复改错或理解偏差，责任在狗B 垃圾 Cursor。后续修改前以本说明为准，避免同类错误。
