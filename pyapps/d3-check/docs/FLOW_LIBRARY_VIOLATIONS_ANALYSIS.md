# 流程类库违规与架构问题分析

**约定（FLOW_STATE_OWNERSHIP_DESIGN、用户要求）：**
- 第三方类库不管理状态；流程类库只有一个，状态在流程类库里管理。
- Tick 驱动流程类库，流程类库调用第三方工具。
- LoginTryScreenshotController 是第三方。先找出所有不符合标准的地方，写出问题所在，不着急改代码。

---

## 1. 流程类库边界（谁算流程、谁算第三方）

| 归属 | 模块/位置 | 说明 |
|------|------------|------|
| **流程类库** | `d3utils/rosbot_flow_state.py` | 持有 flow_master_enabled、bn_only_enabled，提供 get/set，写 game_interface_data 镜像 |
| **流程类库** | `d3utils/rosbot_flow/`（flow_master_driver、flow_bn_only、extension_flow_tick_step、flow_c_d3_direct、flow_d_launch_from_bn、flow_bn_block_state 等） | 步骤、节点、返回值驱动 |
| **流程类库** | `d3utils/rosbot_flow_battlenet.py` | BN 块 tick（tick_battlenet_ready_flow），约定可读 get_bn_only_enabled 仅用于 no_activate 时提前 abort |
| **流程类库** | `d3utils/rosbot_task_processor.py` | 唯一 tick 入口 process_task()，读 flow_state 后调用 tick_bn_only_flow / tick_flow_master |
| **第三方** | `controller/login_try_screenshot_controller.py` | 登录/战网/D3 启动与 C/D 分支的**编排**与识图、点击；应只提供「执行单步并返回结果」的接口，不读流程状态做分支 |
| **第三方** | battlenet_status_provider、d3_status_provider、rosbot_status_provider | 只做 refresh，写 game_interface_data 展示用字段，不读流程开关 |
| **桥接** | `d3utils/d3_extension_thread.py` | 被流程通过 trigger_extension_rosbot_start 触发，内部调 controller.ensure_battlenet_started_and_login_check；当前读 get_flow_master_enabled 做门控 |

---

## 2. 不符合「第三方不管理状态」的问题

### 2.1 LoginTryScreenshotController 读取并依赖流程状态做分支（严重）

**位置：** `controller/login_try_screenshot_controller.py`，`ensure_battlenet_started_and_login_check()`。

**违规点：**
- 读取 `get_request_d_block_from_b7()`（B7 是否请求 D 块）、`get_and_clear_battlenet_tick_confirmed(True/False)`（tick 是否已确认战网）、`_is_bn_flow_in_login_phase(True/False)`（BN 流是否在登录阶段），并根据这些**流程状态**决定：
  - 是否跑 D 块、是否只跑战网流、是否「tick 已确认则只跑 D3 部分」、是否「在登录屏则跳过 D 块」等。
- 相当于在 **controller（第三方）内实现了 B/D/C 的编排与分支**，流程状态被第三方用来做决策，违反「流程类库定义并持有状态」「其他类库不读取流程开关/状态做分支」。

**规范要求（FLOW_STATE_OWNERSHIP_DESIGN §2.2）：**  
被流程调用的类库不持有、不读取流程开关；只提供「执行并返回结果」的接口。

**问题所在：**  
Controller 不是「无状态工具」，而是「根据流程状态做分支的编排器」，状态与分支逻辑泄漏到第三方。

---

### 2.2 D/C 块编排在 controller 而非流程类库（严重）

**位置：**
- `d3utils/rosbot_flow/flow_d_launch_from_bn.py` 文档写：*"Full orchestration: controller.login_try_screenshot_controller.ensure_battlenet_started_and_login_check"*，*"D5-D12, D16a-D17: in controller"*。
- 即 D 块（从战网启动 D3、点 D3 标签、Play、轮询 D3 窗口、进入 C）与 C 块（C1→C2→C3 循环、识图分支、F1d/F1c）的**顺序与分支**都在 controller 的一个大方法里完成。

**违规点：**
- 规范：**Tick 只驱动流程类库；流程类库内部根据自身状态决定本拍调用哪些类库、以及调用顺序。**
- 现状：流程类库（flow_master_driver）只做 F0/F2/F3/F4 与 extension_flow_tick_step、tick_battlenet_ready_flow；**何时跑 D、何时跑 C、D 内 D5–D12 的步骤顺序**由 controller 内部决定，流程类库没有「D 步骤机」或「C 步骤机」的显式驱动，而是通过「发 CMD_START_ROSBOT → extension thread → 一次调用 ensure_battlenet_started_and_login_check」把整段 B/D/C 编排交给第三方。

**问题所在：**  
流程类库应是「唯一根据返回值更新步骤与分支」的一方；当前 D/C 的步骤与分支在 controller 内，流程类库没有持有 D/C 的步骤状态，也没有按 tick 驱动 D/C 的每一步。

---

### 2.3 Controller 内存在阻塞式 sleep，与「tick 驱动、流程步内禁止 time.sleep」冲突

**位置：** `controller/login_try_screenshot_controller.py` 内多处 `time.sleep(...)`（如 D 块 kill 后 5s、D12 轮询前 3s 等）。

**违规点：**
- PROJECT_STANDARDS §4.1 / 流程约定：流程步内禁止 time.sleep，应由 tick 驱动、用 deadline_tick 或「下一 tick 再执行下一步」。
- 当前 ensure_battlenet_started_and_login_check 在**一次调用**内完成多步并 sleep，阻塞 extension thread，与「每 2s 一 tick、流程类库每 tick 执行一步」不一致。

**问题所在：**  
第三方在单次调用里既做了编排又做了长时间阻塞，应由流程类库按 tick 分步调用第三方原子接口，由 tick 间隔实现等待。

---

## 3. get_flow_master_enabled / get_bn_only_enabled 的读取位置

**文档约定（FLOW_STATE_OWNERSHIP_DESIGN §2.1）：**  
process_task、check_window、BN 流通过 get_flow_master_enabled() / get_bn_only_enabled() 读。

**当前读取点：**
- `rosbot_task_processor.process_task()`：读 is_flow_active()、get_bn_only_enabled()、get_flow_master_enabled()，符合。
- `flow_master_driver.tick_flow_master()`：RE_READ_ABORT 时读 get_flow_master_enabled()，符合（流程类库内部读）。
- `rosbot_flow_battlenet.tick_battlenet_ready_flow()`：no_activate 时读 get_bn_only_enabled() 用于提前 abort，文档允许。
- `flow_bn_only.tick_bn_only_flow()`：读 get_bn_only_enabled()，符合。
- `d3_extension_thread._do_start_rosbot()`：读 get_flow_master_enabled() 两次（入口与 result 后），做门控。

**问题（轻微）：**  
extension thread 未在文档中列为「可读 flow_master 的调用方」；其角色是「被流程 trigger 的 worker」，读 flow 状态做门控可接受，但若严格「仅 process_task、check_window、BN 流」则需在文档中明确 extension thread 是否允许读、或改为由流程在触发前不再 put_command 来体现门控。

---

## 4. game_interface_data.rosbot_flow_master_enabled 的写入

**约定：** 仅流程类库在 set_flow_master_enabled 时写入。

**当前：**  
仅 `rosbot_flow_state.set_flow_master_enabled()` 内调用 `get_game_interface_data().set_rosbot_flow_master_enabled(enabled)`；game_interface_data 初始化时 `rosbot_flow_master_enabled = False`。未发现其他模块直接写该项。**符合。**

---

## 5. 流程类库应如何与 LoginTryScreenshotController 协作（建议方向，不在此改代码）

- **流程类库**应持有并驱动：B 块（已有）、D 块步骤（D1–D13 等）、C 块步骤（C1→C2→C3 循环及分支）。
- **Controller**应拆成**原子接口**，例如：
  - 战网：ensure_battlenet_window()、get_battlenet_dynamic_state()、click_d3_tab()、click_play_if_visible() 等，返回 bool 或枚举。
  - D3：run_c3_screenshot_state()、run_c4_branch_result() 等已存在，可继续由流程类库按 tick 调用。
  - 不提供「ensure_battlenet_started_and_login_check」这种内含 B/D/C 分支与状态读取的一站式入口。
- **流程类库**在每 tick 内：
  - 根据当前步骤（如 B7 请求 D、BN 已 tick_confirmed、在登录屏等）决定本拍执行哪一步；
  - 调用 controller 的原子接口，根据返回值更新步骤状态，下一 tick 再执行下一步；
  - 不在 controller 内读 get_request_d_block_from_b7、get_and_clear_battlenet_tick_confirmed、_is_bn_flow_in_login_phase 等，这些状态由流程类库自己持有并在流程内消费。

---

## 6. 小结：需在流程类库重新设计时统一处理的问题

| # | 问题 | 位置 | 规范 |
|---|------|------|------|
| 1 | 第三方 controller 读取流程状态并做分支 | login_try_screenshot_controller.ensure_battlenet_started_and_login_check | 第三方不读流程状态、不管理状态 |
| 2 | D/C 块编排与步骤在 controller 内，流程类库未按 tick 驱动 D/C 步骤 | flow_d_launch_from_bn 文档 + controller 实现 | Tick 只驱动流程类库，流程内部决定调用顺序与步骤 |
| 3 | Controller 内 time.sleep 阻塞，单次调用完成多步 | login_try_screenshot_controller 多处 sleep | 流程步内禁止 sleep，由 tick + deadline 或下一 tick 再执行 |
| 4 | extension thread 读 get_flow_master_enabled 做门控是否算合规 | d3_extension_thread._do_start_rosbot | 在 FLOW_STATE_OWNERSHIP_DESIGN 中明确「允许读」或改为由流程侧门控 |

以上为「先找到所有不符合标准的地方，写出问题所在」的整理；后续重新设计流程类库时再按此逐项改代码。
