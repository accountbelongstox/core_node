# 技术说明：_obsolete_tray_clicker、登陆后的战网元素-控件说明、bn_flow_B5

**目的**：说明此三处文件/数据的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `utils/_obsolete_tray_clicker.py`
- `docs/登陆后的战网元素-控件说明.md`
- `.cache/bn_flow_snapshots/bn_flow_B5.json`

---

## 一、utils/_obsolete_tray_clicker.py

### 1.1 职责与约定

- **用途**：**已废弃模块**（_obsolete_ 前缀）。TrayIconClicker 用 **pywinauto Desktop(backend="uia")**、**win32api/win32con** 枚举系统托盘相关窗口（class_name 含 tray/notify/shell）、按 keyword 匹配 title/class_name、双击第一个匹配图标。**使用 print() 而非 ColorPrint**。_normalize_keyword 去掉 .exe、路径取 basename。click_tray_icon(keyword) 会记录并恢复鼠标位置。**不应被新代码或当前流程引用**；当前托盘为 ui/components/system_tray.py（pystray），无「按 keyword 点击托盘图标」的对外能力。
- **约定**：不在此文件扩展；不将本模块作为托盘点击的推荐实现；若需托盘交互应以 system_tray 或 event center 为准；删除前确认无引用。与 system_tray 的 pystray 设计不同，本文件为旧方案。

### 1.2 易被误解或改错的原因

1. **误当可用工具使用**：未注意 _obsolete_ 前缀而在此模块上开发或 import，会引入 pywinauto、win32api 与当前 system_tray（pystray）设计冲突。
2. **与 system_tray 混淆**：system_tray 在托盘线程内创建 Icon、菜单与 trigger_*；本文件为遍历桌面窗口找 tray 相关 class 并双点；若在「点击托盘图标」需求上引用本文件会误用废弃实现。
3. **print() 与 ColorPrint**：本文件用 print 打日志，与项目 pycore ColorPrint 规范不一致；若在此改 ColorPrint 仍不改变废弃定位。
4. **keyword 匹配与 tray 窗口枚举**：依赖 class_name 含 tray/notify/shell，不同系统或语言可能无或变；若当稳定 API 用会 fragile。

### 1.3 正确做法

- 视本文件为只读历史参考；不新增依赖、不在新代码中 import；托盘交互以 system_tray 与 event center 为准；删除前全局搜索确认无引用。

---

## 二、docs/登陆后的战网元素-控件说明.md

### 2.1 职责与约定

- **用途**：**登陆后战网界面控件说明**。数据来源：调试按钮导出并复制到 `docs/登陆后的战网元素.json`（UI Automation，Chromium 战网）。**已用控件（BattlenetOperation）**：D3 游戏 Tab 小按钮 automation_id `game-nav-btn-D3CN`、TabItemControl "Diablo III"；开始游戏按钮区域 `play-btn-main`/`play-btn`、GroupControl，内层 ButtonControl "Playing Now: Diablo III" 时 is_enabled=false 表示游戏中。**判断逻辑**：name 含 "Playing Now"/"Play"/"开始游戏"，若 is_enabled 为 False 或 name 含 "Playing Now" 则视为游戏中。**待实现**：同意登陆、点击确认登陆、是否处在登陆界面、是否已经登陆。BattlenetAsiaOps 的 _load_asia_features_from_docs_json 可能从 docs/登陆后的战网元素.json 抽 D3 tab/Play 的 automation_id 与 name（BATTLENET_REGION_DESIGN_REVIEW §3.2）。
- **约定**：JSON 与本文档同步；已用控件表与 BattlenetOperation/BattlenetRegionJudge 的查找逻辑一致；若改 automation_id 或 name 须同步 app_constants 或 JSON 及本文档。待实现项若实现须在文档中更新「已用控件」或判断逻辑。

### 2.2 易被误解或改错的原因

1. **改 JSON 未同步本 md 或改 md 未同步 JSON**：数据来源写明导出到 登陆后的战网元素.json；若只改其一会文档与数据不一致。
2. **已用控件与代码中 constants 不一致**：game-nav-btn-D3CN、play-btn-main/play-btn 等若在 app_constants 或 Judge 中写死，改本文档未同步代码会找错控件。
3. **判断逻辑「Playing Now / is_enabled=false」与 Judge 或 Operation 实现不符**：若代码中改为其他条件未同步本文档会文档失效。
4. **待实现项与已实现混淆**：同意登陆、是否处在登陆界面等为待实现；若在别处已实现须在本文档更新，否则后续维护者误以为未做。

### 2.3 正确做法

- 修改战网控件或判断逻辑时同步本文档与 登陆后的战网元素.json、app_constants、BattlenetOperation/Judge；已用控件表与代码一致；待实现实现后更新文档。

---

## 三、.cache/bn_flow_snapshots/bn_flow_B5.json

### 3.1 职责与约定

- **用途**：**BN 流程 B5 节点快照**。结构：**meta**（node="B5", reason="B5_exit"）+ **controls** 数组（name、automation_id、type、rect、level）。与 bn_flow_B9、B4、BN_LoginAsia 等结构一致，供调试或 flow 消费。**meta.node 须与 BN 节点名一致**（如 B5 对应 BN 流 B5 节点）；reason 为 B5_exit 表示退出相关。
- **约定**：消费方可能依赖 meta.node、meta.reason、controls 的 name/automation_id/type/rect/level；若改 meta 或 controls 结构须确认所有读取方；清理 .cache 或删快照前须确认无依赖。与 FLOW_ARCHITECTURE_DIRECTORY、rosbot_flow_battlenet 的 BN 节点命名一致。

### 3.2 易被误解或改错的原因

1. **误当配置或流程定义修改**：本文件为某次 B5 节点下的 UI 快照，非流程逻辑定义；改 JSON 不影响流程行为，流程逻辑在 flow 代码中。
2. **meta.node 与 BN 节点名不一致**：若 flow 或调试工具按 meta.node 对应节点，改 node 未同步 flow 会对照错位。
3. **controls 结构变更**：若分析工具升级改 controls 项（如增删字段、改 rect 结构），消费方未同步会 KeyError 或解析错。
4. **.cache 目录清理**：若误删 bn_flow_snapshots 或本文件会丢失 B5 快照，调试或回放可能依赖；删除前确认无引用。

### 3.3 正确做法

- 视本文件为 B5 节点快照；消费时确认 meta.node 与 BN 节点一致；修改 controls 结构时同步所有读取方；清理 .cache 前确认无依赖。

---

## 四、与道歉文档的关系

若此前因未先通读上述三处约定（_obsolete_tray_clicker 勿用、与 system_tray 区分；登陆后的战网元素-控件说明 与 JSON 及 BattlenetOperation 同步；bn_flow_B5 为快照、meta.node 与 BN 一致）而在此三处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加对本文的引用。
