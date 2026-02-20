# d3-check 项目规范

**唯一规范文档**：目录、D3/D4/共用区、命名、导入、线程、复用均以此为准。

---

## 一、目录与文档架构

### 1.1 项目根目录结构

```
pyapps/d3-check/
├── main.py                    # 入口：GUI / bridge / tray / train
├── train.py, validate.py      # 训练/校验入口
├── config/                    # 共用配置
├── providor/                  # 常量(app_constants)、配置入口、i18n
├── share/                     # §1.3：values/（数据）+ common/（公区功能）
│   ├── values/                # 数据区
│   └── common/                # 公区功能区
├── runtime/                   # 生命周期、线程注册、事件；对外唯一入口
├── timers/                    # 定时器、一次性任务(do_*)
├── controller/                # 控制器：D3 主控、D4、ctl_func、d4func
├── d3utils/                   # D3/ROSBOT/战网 逻辑 + 共用基础设施
├── d4utils/                   # D4 专用逻辑
├── d4_modules/                # D4 模型等资源
├── ui/                        # 主窗、面板、组件、主题
├── scripts/                  # 脚本与工具
├── images/                    # 图片资源
├── docs/                      # 所有文档
├── utils/, state/             # 废弃代码 _obsolete_*
└── .prompts/                  # 提示与任务
```

### 1.2 文档架构

| 类型 | 文档 |
|------|------|
| 规范 | `PROJECT_STANDARDS.md`（本档） |
| 代码层次 | `CODE_TREE.md` |
| 流程 | `FLOW_ARCHITECTURE_DIRECTORY.md`, `ROSBOT_FLOW*.md` |
| 线程与事件 | `THREAD_BUS_AND_REGISTRY.md` |

新增规范一律写入本档；旧文档以本档为准。

### 1.3 share/ 分区设计（数据区与公区功能区）

**设计原则**：share 必须区分**数据区**与**公区功能区**，不得整体当作“功能区”堆业务逻辑。

**禁止的目录名**（易被 gitignore）：`data`、`store`、`cache`、`tmp`、`temp`、`log`、`logs`、`build`、`dist`、`out`、`output`、`target`、`node_modules`、`env`、`venv`、`.venv`、`coverage`、`lib`、`var`、`uploads`、`downloads`、以及以 `.` 开头的目录。数据区用 **`share/values/`**，公区用 **`share/common/`**。

| 子区 | 路径 | 职责 | 允许 | 禁止 |
|------|------|------|------|------|
| **数据区** | `share/values/` | 仅共享数据与数据访问 API | 数据类、get_*/set_*、配置/凭据读写、事件/队列式同步 | **run_***、**do_\***、业务流程、复杂算法、定时任务 |
| **公区功能区** | `share/common/` | 两游戏共用工具、基类 | 纯函数、基类、不依赖 D3-only/D4-only 的共用逻辑 | 依赖 d3utils/d4utils 业务、**run_*/do_\***、游戏专用常量 |

- **数据区**：谁需要读/写共享状态、路径、凭据等，从 `share.values` 导入；可依赖 providor、pycore，**不**依赖 d3utils/d4utils 业务。
- **公区功能区**：谁需要坐标换算、模板缩放基类、战网窗口查找等，从 `share.common` 导入；可依赖 share.values、providor、pycore，**不**依赖 d3utils/d4utils 流程/战网/ROSBOT。
- **当前归属（迁移前可暂留 share 根）**：values → game_interface_data, project_path, oauth_callback, asia_credentials, template_match_debug；common → scaled_template_matcher_base, coordinate_helper, battlenet_ui_common, battlenet_window_finder。

---

## 二、代码层次

| 层 | 路径 | 职责 |
|----|------|------|
| 1 入口 | `main.py` | 仅从 **runtime** 取生命周期 |
| 2 运行时 | `runtime/`, d3utils 内 system_initializer, shutdown_manager, event_center, event_signals, task_thread_manager, thread_registry | **调用方只 import runtime** |
| 3 控制器 | controller/*.py, ctl_func/, d4func/ | 用 runtime 做生命周期与线程 |
| 4 业务逻辑 | d3utils/, d4utils/ | 不持有生命周期入口 |
| 5 共享 | share/values/, share/common/ | 见 §1.3；无 run_*/do_* |
| 6 定时 | timers/ | 定时任务、一次性 do_*、窗口监控 |
| 7 UI | ui/ | 主窗、面板、组件、主题 |
| 8 配置与常量 | config/, providor/ | 统一配置、网格、app_constants、i18n |

**导入**：生命周期/线程/事件只从 **runtime**；一次性工作用 `timers.timer_manager.submit_one_shot` + `timers.one_shot_tasks.do_*`。

---

## 三、D3 / D4 / 共用区

### 3.1 三区定义

| 区 | 可依赖 | 不可依赖 |
|----|--------|----------|
| **D3** | 共用区、d3utils 内 D3 模块 | d4utils、D4 专用常量 |
| **D4** | 共用区、d4utils、d3utils 共用件 | D3 流程/战网/ROSBOT 专用 |
| **共用区** | share, pycore, providor 无 D3/D4 前缀 | d3-only / d4-only 业务 |

### 3.2 目录归属

| 包/目录 | 归属 |
|---------|------|
| d3utils/ | D3 + 共用基础设施（含 d4_extension_thread） |
| d4utils/ | D4 |
| share/values/, share/common/ | 见 §1.3 |
| controller/d3_macro_controller.py, ctl_func/ | D3 |
| controller/d4_controller.py, d4func/ | D4 |
| ui/panels/rosbot_extension_panel.py | D3 |
| ui/panels/d4_panel.py | D4 |
| providor/app_constants | 当前单文件；可选按 §3.3 拆分 |
| config/, timers/, runtime/ | 共用 |

### 3.3 常量命名（providor）

**当前**：单文件 `app_constants.py`，D3_* / D4_* / 无前缀。**可选**拆分：

| 文件 | 区 | 前缀 |
|------|----|------|
| app_constants_common.py | 公共 | 无 D3/D4 |
| app_constants_d3.py | D3 | D3_* |
| app_constants_d4.py | D4 | D4_* |

业务统一 `from providor.app_constants import ...`。新增：仅 D3 用 → D3_*；仅 D4 用 → D4_*；两游戏共用 → 无前缀。

### 3.4 模块文件命名

| 区 | 规则 | 示例 |
|----|------|------|
| D3 | d3_ / rosbot_ / battlenet_ | d3_manager.py, rosbot_flow_*.py, battlenet_*.py |
| D4 | d4_ | d4utils/ 下 d4_*.py；d4_controller, d4_panel |
| 共用 | 无 d3/d4 前缀 | scaled_template_matcher_base.py, game_interface_data.py, event_center.py |

### 3.5 导入规则（D3/D4/共用）

- **D3**：可 import 共用区、d3utils 内 D3 模块；**不** import d4utils 或 D4 专用常量（除非明确桥接）。
- **D4**：可 import 共用区、d4utils、d3utils 共用件；**不** import D3 流程/战网/ROSBOT 专用。
- **共用区**：仅 import 底层共用(share, pycore, 无 D3/D4 前缀常量)；**不** import d3_* / d4_* 业务。
- **新增文件**：D3 专用 → d3utils 或 ctl_func，d3_* / rosbot_* / battlenet_*；D4 专用 → d4utils 或 d4func，d4_*；共用 → share 或 d3utils 内 common，无前缀。

---

## 四、流程布局（rosbot_flow）

- **d3utils/rosbot_flow/** = 流程库：tick 驱动 + 状态。
- **rosbot_flow_*.py** = F 块/BN 步骤实现；**rosbot_flow_state.py** = 全局流程开关。
- **rosbot_flow_battlenet.py** = BN 块执行器；对外 `reset_flow_master_bn_block()`。

细节见 `FLOW_ARCHITECTURE_DIRECTORY.md`。

### 4.1 流程仅 tick 驱动，禁止独立定时器

**约定**：所有流程结构（BN 块、F 块、Extension C 块、A 块等）**不得使用独立定时器**（如 `timers.register_task`、单独线程循环 sleep），**仅由 tick 驱动**。

- **驱动**：2s 的 process_task() → tick_bn_only_flow() / tick_flow_master() → 各 flow 步骤。流程内无 register_task 或专用 timer 线程。
- **超时**：BN 块用 **deadline 时间戳**（每 tick 比较）；Extension C 块用 **deadline_tick**（tick 计数）。见 extension_flow_tick_step.py。
- **流程步内禁止 time.sleep**：步骤在 tick 线程内执行，不得阻塞 tick。若扩展线程内某步为 UI 稳定做短 sleep，须在代码/注释中明确“非 tick 线程、仅此步例外”。

---

## 五、命名规范

### 5.1 函数前缀 run_ / do_ / step_

| 前缀 | 用途 | 示例 |
|------|------|------|
| **run_** | 流程块步骤（被 flow driver 调用） | run_c1_entry, run_f4_close_d3_send_f7 |
| **do_** | 一次性/定时任务（submit_one_shot、手动触发） | do_window_monitor_initial_check, do_path_scan, do_login_check |
| **step_** | 子步骤（在 run_/do_ 内） | step_c10_send_m, step_a3_tick_has_direction |

### 5.2 重置与状态

- **reset_*** 仅用于“回到初始/入口”（如 reset_flow_master_bn_block）。状态转移用其他动词。命名中明确“重置的是哪条流”。

### 5.3 层级命名（Provider / Manager / Controller / Handler）

| 角色 | 含义 | 示例 |
|------|------|------|
| Provider | 状态/检测、刷新共享状态 | battlenet_status_provider, d3_status_provider |
| Manager | 进程/配置/生命周期 | rosbot_manager, shutdown_manager |
| Controller | UI/业务控制器 | controller/*_controller.py |
| Handler | 功能级（黑smith、卡奈、事件回调） | ctl_func 下各 handler |

纯检测/状态刷新用或扩展 Provider，不新增 Manager。

### 5.4 窗口与状态刷新

- 完整状态刷新：**run_full_status_refresh()**。
- flow 未激活时刷新+回调：**refresh_window_status_if_inactive()**（window_monitor_timer）；check_window 废弃。
- 一次性初始/手动刷新：**do_window_monitor_initial_check()**。

### 5.5 其他命名与文件

- 对外：**reapply_sigint_sigbreak_ignore_for_gui()**；内部：**_reapply_sigint_sigbreak_ignore()**。
- Python 文件：**snake_case**。废弃：前缀 **_obsolete_**（utils/, state/）。脚本：scripts/；包名 **providor**；**ctl_func** = D3 Handler，**d4func** = D4，**d3u_common** = d3utils 内共用小工具。

---

## 六、导入规范与代码保证

### 6.1 导入

- **import 放在文件顶部**。除可选第三方包（如 `try: import pythoncom except ImportError: pythoncom = None` 在模块顶层）外，不在函数内写 import。
- 禁止在业务逻辑中为“方便”在函数内写 import；新依赖一律顶部引入。
- **出现循环引用时**：通过调整架构解决（拆模块、依赖注入、提取公共层等），不通过延迟导入规避。

### 6.2 代码层面保证与异常

- **禁止 getter 式/运行时再判断式调用**：不得用 `hasattr`/`callable`/`getattr(..., None)` 等方式在运行时判断再调用（如先判断是否有 `Exists` 再调用）。依赖的 API（如 uiautomation Control 的 `Exists()`、`GetChildren()`）在代码层面约定类型并直接调用，由调用方保证传入类型正确。
- **可用性在代码层保证**：所用第三方/内部 API 的可用性通过架构与类型约定保证，不依赖运行时检测兜底。
- **非必要的 catch 不使用**：仅在对进程/线程/COM/OS/网络等无法用前置条件完全避免异常的场景保留 try/except；其余用前置条件与直接调用。
- **例外**：标准库/平台差异（如 `hasattr(signal, 'SIGBREAK')`）、非本模块控制的 polymorphic 数据（如外部模型输出、历史解析块的可选字段）可保留 hasattr/getattr，其余一律按上述直接调用。

---

## 七、线程与事件

- **禁止线程互相阻塞**：运行时不得跨线程 block；通信仅通过 **event center**（THREAD_BUS）；需当前状态时从共享状态读取。关机时主线程可 join(timeout)。
- **线程创建**：仅由 registry/initializer 在启动时创建；运行中不动态创建业务线程；一次性工作通过 **timer_manager.submit_one_shot** 提交。
- **实现**：线程类为原生子类（run() 实现循环），不采用仅委托的包装类。

详见 `THREAD_BUS_AND_REGISTRY.md`。

---

## 八、复用与常量、配置

- **先复用再新增**：新功能先查现有逻辑（同模块、d3utils、timers、controller、pycore），优先扩展或参数化。
- **不重复定义**：字面常量进 **providor.app_constants**，结构化配置进 **config**；不在 controller/d3utils/d4utils/ui 等处新增字面常量。
- **直接依赖**：直接使用 pycore、d3utils；不用 providor.common_imports；one-shot 用 timers.timer_manager.submit_one_shot 与 **timers.one_shot_tasks.do_***。

---

## 九、废弃与脚本

- **_obsolete_*** 放在 **utils/** 或 **state/**；新废弃统一前缀 **_obsolete_**。脚本 snake_case，置于 **scripts/**（调试可 scripts/debug/）。

---

## 十、速查表

| 需求 | 位置/约定 |
|------|------------|
| 字面常量 | providor.app_constants（D3_* / D4_* / 无前缀） |
| 技能/宏/模板配置 | config（unified_config, grid_config） |
| 共享数据 | share/values；仅数据与数据访问 |
| 公区功能 | share/common；无 run_/do_ |
| 一次性任务 | timers.one_shot_tasks（do_*） |
| 完整状态刷新 | run_full_status_refresh()；未激活时 refresh_window_status_if_inactive() |
| 生命周期/线程/事件 | runtime |
| D3 专用 | d3utils(d3_*, rosbot_*, battlenet_*), ctl_func, rosbot_extension_panel；常量 D3_* |
| D4 专用 | d4utils(d4_*), d4func, d4_controller, d4_panel；常量 D4_* |
| 流程步 | run_*；一次性 do_*；子步骤 step_* |
| 重置 Flow-master BN 块 | reset_flow_master_bn_block() |
| **流程禁止定时器** | 仅 tick 驱动；超时用 deadline/deadline_tick；流程步内禁止 time.sleep（§4.1） |
| 代码语言 / 多语言 | §11：代码英文；用户可见文案 i18n；匹配/配置用常量除外 |

### D4 规范化核对清单

- d4utils/：模块 **d4_*.py**；类名 **D4** + PascalCase；公开 getter **get_d4_***；日志标签与类名一致。
- 包引用：仅 from d4utils.d4_* 或 controller.d4func；D4 不 import d3utils 流程/战网/ROSBOT；常量 D4_* 从 app_constants 或 share.game_interface_data。
- 共用数据：get_d4_interface_data()、D4_STANDARD_COORDS 等在 share（迁移后 share.values）；公区功能 share.common。

---

## 十一、代码语言与多语言

- **代码**：注释、文档字符串、日志文案、变量/函数命名等**一律使用英文**。
- **其他（用户可见文案）**：界面文案、提示、按钮标签等**使用多语言**：通过 **providor i18n**（如 `i18n_manager.get_ui_text(...)`）获取，不在业务代码中写死中文或其它语言字符串。
- **常量除外**：用于匹配、配置键、窗口标题关键字等**字面常量**（如 `providor.constants.common`、`providor.constants.d3` 中的元组/列表值）**保持现状**，不因“代码英文”而改动；新增匹配用常量仍可按需使用多语言字面量。
- 与 §八 一致：字面常量进 providor；用户可见文案进 i18n JSON，代码侧仅引用 i18n key 或英文 fallback。
