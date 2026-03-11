# flow_master_enabled 流程精细核对

单源真相在 `d3utils/rosbot_flow_state`；仅通过 `get_flow_master_enabled()` / `set_flow_master_enabled(bool)` 读写。本文档列出所有读/写点与分支影响，便于逐项核对。

---

## 1. 定义与单源真相

| 项 | 位置 | 说明 |
|----|------|------|
| 变量 | `rosbot_flow_state._flow_master_enabled` | 模块级 bool，默认 False |
| 读 | `get_flow_master_enabled() -> bool` | 唯一读入口 |
| 写 | `set_flow_master_enabled(enabled: bool)` | 唯一写入口；若值变化则同步 `game_interface_data.set_rosbot_flow_master_enabled(enabled)` |

**约定**：任何地方不得直接改 `game_interface_data.rosbot_flow_master_enabled`；仅由 `rosbot_flow_state.set_flow_master_enabled` 在 set 时写入，用于 UI/回调。

---

## 2. 写点（set_flow_master_enabled）— 仅面板/回调

| # | 位置 | 触发场景 | 传入值 | 后续动作 |
|---|------|----------|--------|----------|
| 1 | `rosbot_extension_panel._start_rosbot()` | 用户点击「启动 ROSBOT」 | True | set_task_status(rosbot_task, ENABLED)；rosbot_running=True；可能发起登录检查 |
| 2 | `rosbot_extension_panel._on_login_check_done(..., error=...)` | 登录检查失败/异常 | False | reset_battlenet_flow_state；set_task_status(DISABLED)；rosbot_running=False；_request_status_refresh |
| 3 | `rosbot_extension_panel._on_login_check_done(..., success=True)` 内 try 的 except | 登录成功但后续异常 | False | 同上 |
| 4 | `rosbot_extension_panel._on_rosbot_stop_done()` | 扩展线程「停止 ROSBOT」完成回调 | False | reset_battlenet_flow_state；rosbot_running=False；_request_status_refresh |
| 5 | `rosbot_extension_panel._stop_rosbot()` | 用户点击「停止 ROSBOT」 | False | 同时 set_bn_only_enabled(False)；reset_battlenet_flow_state；rosbot_running=False；若有 extension 则 trigger_extension_rosbot_stop，否则 set_task_status(DISABLED) 并 stop_rosbot_task |

**核对**：除上述 5 处外，不应再有任何对 `set_flow_master_enabled` 的调用；process_task、check_window、BN 流等**不写** flow_master。

---

## 3. 读点（get_flow_master_enabled）— 用途与分支

### 3.1 面板（rosbot_extension_panel）

| # | 位置 | 用途 | 分支/效果 |
|---|------|------|-----------|
| 1 | `_ensure_battlenet_only()` 关闭「确保战网」时 | 决定是否禁用 rosbot_task | 若 `not get_flow_master_enabled()` 则 set_task_status(rosbot_task, DISABLED)；否则保持 ENABLED（继续跑 flow_master 分支） |
| 2 | 首次展示/同步控制按钮 | 同步 rosbot_running | `self.rosbot_running = get_flow_master_enabled()`，再 _update_control_button |
| 3 | `_on_login_check_done(success=True)` | 登录成功后的清理分支 | 若 `not get_flow_master_enabled()`（用户已关）则 reset、DISABLED、rosbot_running=False 并 return；否则 ENABLED、start_rosbot_task 等 |
| 4 | `_on_rosbot_stop_done()` 后或其它需判断「是否仍在营动」 | 当前实现中 _on_rosbot_stop_done 未再读；_stop_rosbot 用 rosbot_running 判断 | 无额外读；若将来有「仅当 flow_master 时做 X」可在此处读 |

### 3.2 流程驱动（rosbot_task_processor.process_task）

| # | 时机 | 变量 | 用途 | 分支/效果 |
|---|------|------|------|-----------|
| 1 | 入口（2s 步前） | `flow_master = get_flow_master_enabled()` | 与 bn_only 一起决定是否执行本拍；日志 | `is_flow_active()` 已含 flow_master，此处主要用于日志与下面 refresh 条件 |
| 2 | refresh 阶段 | 同上 `flow_master` | 是否调用 refresh_d3_status、refresh_rosbot_status | 仅当 `flow_master and get_bn_flow_ever_confirmed()` 时调用两者 |
| 3 | refresh + notify 之后 | `flow_master2 = get_flow_master_enabled()` | 二次读，与 bn_only2 决定本拍是否继续及走哪条分支 | 若 `not flow_master2 and not bn_only2` 则 **return**（本 tick 不再执行后续）；若 bn_only2 则只跑 BN 流并 return；否则进入 flow_master 分支（F0/b1/c1/b2、extension、F3/F4） |
| 4 | flow_master 分支末尾 | `flow_master2` | 是否执行 F3/F4（日志超时→关 D3→B2） | 仅当 `flow_master2 and g.rosbot_extended_status in ("running","paused")` 时 run_f3_log_timeout；若返回 "f4" 则 run_f4、enter_battlenet_at_b2 |

**核对**：  
- 入口与 refresh 用**入口读到的** flow_master；  
- 二次读之后的所有分支（是否 return、走 bn_only 还是 flow_master、是否跑 F3/F4）**必须**用 flow_master2，不可再用入口的 flow_master。

### 3.3 其他

| # | 位置 | 用途 |
|---|------|------|
| 1 | `timers/window_monitor_timer.check_window()` | 不直接读 flow_master；通过 `is_flow_active()` 判断（内部为 flow_master or bn_only）。若 True 则 return，不执行 refresh；若 False 则执行 BN + D3 refresh、notify。 |

**核对**：check_window 仅依赖 `is_flow_active()`，不单独读 flow_master，符合「流程类库统一出口」的约定。

---

## 4. 与 is_flow_active() 的关系

- `is_flow_active() = get_flow_master_enabled() or get_bn_only_enabled()`。
- 使用处：  
  - process_task 入口 `if not is_flow_active(): return`；  
  - check_window 开头 `if is_flow_active(): return`；  
  - 面板根据 is_flow_active() 派生 rosbot_task 的 ENABLED（至少一处为「flow_master or bn_only → ENABLED」）。
- **核对**：所有「是否跑 2s 流 / 是否跑 check_window」的判断都应以 is_flow_active() 或等价逻辑为准，避免单独用 flow_master 漏掉 bn_only 或反之。

---

## 5. 数据流小结

```
[写] 仅面板/回调
  _start_rosbot          → set_flow_master_enabled(True)
  _on_login_check_done  → set_flow_master_enabled(False)  // error 或 success 后异常
  _on_rosbot_stop_done  → set_flow_master_enabled(False)
  _stop_rosbot           → set_flow_master_enabled(False)

[同步] set_flow_master_enabled 内
  → game_interface_data.set_rosbot_flow_master_enabled(enabled)  // UI/回调用

[读] 面板
  get_flow_master_enabled() → 关「确保战网」时是否 DISABLED 任务、首次同步按钮、登录成功回调是否继续启用任务

[读] process_task
  入口   flow_master  → 日志 + refresh 条件（flow_master and ever_confirmed → refresh_d3/rosbot）
  二次   flow_master2 → 是否 return、走 bn_only 还是 flow_master 分支、是否跑 F3/F4

[读] check_window
  is_flow_active()（内含 flow_master）→ 为 True 则 return，不刷新
```

---

## 6. 核对清单

- [ ] 除 rosbot_flow_state 外，无任何模块直接写 `game_interface_data.rosbot_flow_master_enabled`。
- [ ] 所有对 flow_master 的「写」仅通过 `set_flow_master_enabled`，且仅来自面板/登录回调/停止回调。
- [ ] process_task 中：refresh 条件用入口 `flow_master`；二次读后的 return、bn_only/flow_master 分支、F3/F4 条件**一律用 flow_master2**。
- [ ] check_window 仅用 `is_flow_active()`，不单独读 flow_master。
- [ ] 面板在「关闭确保战网」「登录检查成功」两处用 `get_flow_master_enabled()` 决定任务开关与是否继续启动，逻辑与文档一致。

以上为 `flow_master_enabled` 的精细流程与核对项；若新增读/写点，应同步更新本文档。
