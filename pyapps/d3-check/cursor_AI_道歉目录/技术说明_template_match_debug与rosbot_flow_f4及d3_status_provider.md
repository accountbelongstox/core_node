# 技术说明：template_match_debug、rosbot_flow_f4_close_d3_send_f7、d3_status_provider

**目的**：说明这三处代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `share/template_match_debug.py`
- `d3utils/rosbot_flow_f4_close_d3_send_f7.py`
- `d3utils/d3_status_provider.py`

---

## 一、share/template_match_debug.py

### 1.1 职责与约定

- **用途**：模板匹配调试队列——供「其他图像查找」类调试 UI 使用；**仅内存**，不落盘。Matcher 在每次匹配后通过 `notify_match()` 写入一条记录（标题、日志行、可选标注图）；UI 侧通过 `pop_all()` 或 `get_entries()` 取数据展示；关闭调试 UI 时调用 `clear()` 清空队列与缓存。
- **生效条件**：仅当 `_ui_active` 为 True 时 `notify_match()` 才会绘制并 push；由调试 UI 通过 `set_debug_ui_active(True/False)` 控制。若未先 set 为 True，matcher 调用 notify_match 不会产生任何入队。
- **调用方**：ScaledTemplateMatcherBase 在每次匹配后调用 `notify_match(template_name, result, target_img_array, template_img_array, match_method, expected_threshold, first_match)`。result 须含 `total_matches`、`matches`、`error`；first_match 可选含 `num_matches`、`match_threshold` 用于标注 Score。
- **绘制**：_build_annotated_match_image 用 ImageAnnotator 在 target BGR 上画 Mode、Threshold、Score、Result、Template 名及模板缩略图；返回 PIL Image。putText 仅 ASCII，不支持 Unicode。

### 1.2 易被误解或改错的原因

1. **未激活就期望有数据**：若调试 UI 未在打开时调用 `set_debug_ui_active(True)`，matcher 侧即使用 notify_match 也不会 push；关闭时若不调用 `set_debug_ui_active(False)` 和 `clear()`，下次打开可能读到旧 entries 或队列残留。
2. **result 结构变化**：若 matcher 返回的 result 不再含 `total_matches`、`matches`、`error`，或 first_match 无 `num_matches`/`match_threshold`，_build_annotated_match_image 的 Score/Result 行会错或报错。
3. **图像格式**：target_img_array、template_img_array 约定为 BGR numpy；若传入 RGB 或 PIL，cvtColor 或 shape 会错；notify_match 的文档或调用方需遵守。
4. **队列与 _entries 双写**：push() 同时 put 到 _debug_queue 和 append 到 _entries；pop_all() 只从 queue 取，get_entries() 返回 _entries 副本。若某处只 pop 不清理 _entries 或只清 _entries 不清 queue，会不一致；clear() 应同时清空两者。
5. **多线程**：queue.Queue 为线程安全，但 _entries 的 list 在 push 时无锁；若多线程同时 push 与 clear，_entries 可能竞态；通常 matcher 与 UI 在同一线程或 UI 仅读，需约定调用线程。

### 1.3 正确做法

- 调试 UI 打开时 set_debug_ui_active(True)，关闭时 set_debug_ui_active(False) 并 clear()。
- 修改 matcher 的 result 或 first_match 结构时，同步更新 _build_annotated_match_image 的 key（total_matches、matches、error、num_matches、match_threshold）。
- 传入 notify_match 的图像保持 BGR numpy；不在 template_match_debug 内做磁盘 I/O。

---

## 二、d3utils/rosbot_flow_f4_close_d3_send_f7.py

### 2.1 职责与约定

- **用途**：实现 ROSBOT_FLOW_MERMAID 中 F4——F4a 关闭 D3 进程，F4b 向系统发送 F7 以关闭 ROSBOT，随后**由调用方**进入 B2_HasWin（如 flow_master_driver 中 run_f4_close_d3_send_f7() 后即 enter_battlenet_at_b2）。
- **顺序**：先 `get_d3_manager().kill_if_running()`，再 `send_f7_to_system()`，再 `get_rosbot_manager().kill_if_running()`。顺序不可颠倒：若先杀 ROSBOT 再发 F7 可能无效；若先 F7 再杀 D3 可能 ROSBOT 未正确收 F7。
- **无返回值**：run_f4_close_d3_send_f7() 无返回值；调用方不根据返回值分支，执行完即进入 B2。

### 2.2 易被误解或改错的原因

1. **调换顺序**：若改为先 send_f7 再 kill D3，或先 kill rosbot 再 kill D3，会与文档 F4a→F4b 及「先关 D3 再 F7 再关 ROSBOT」的约定不符，可能导致 ROSBOT 未退出或 F7 无效。
2. **省略某一步**：若为「省事」只杀 D3 不发 F7 或不杀 rosbot 进程，下游 B2 可能仍认为 ROSBOT 在跑，状态不同步。
3. **在本模块内写 B2 逻辑**：F4 仅负责「关 D3 + F7 + 杀 ROSBOT」；进入 B2（enter_battlenet_at_b2）在 flow_master_driver 中调用本函数之后执行。若在本模块内写 enter_battlenet 会引入循环依赖或职责混乱。
4. **send_f7_to_system 失败**：当前实现 F7 发送失败仅打 yellow log，仍继续 kill rosbot；若希望「F7 失败则不杀 rosbot」需改逻辑并文档化，当前为「尽量发 F7，再杀进程」。
5. **重复调用**：若 flow 逻辑错误导致 run_f4 被多次调用，会多次 kill（通常无害）；但若调用方依赖「只调一次」的假设做状态清理，需在调用方保证。

### 2.3 正确做法

- 保持「kill D3 → send_f7_to_system → kill rosbot」顺序；不在本模块内调用 enter_battlenet 或 B 块逻辑。
- 修改 F7 失败时的行为（如不杀 rosbot）时，在模块注释与 ROSBOT_FLOW 文档中说明。

---

## 三、d3utils/d3_status_provider.py

### 3.1 职责与约定

- **用途**：D3 窗口检测与动态状态刷新；通过 `refresh_d3_status(skip_dynamic=False)` 找 D3 窗口、可选做一次截屏+模板匹配（capture_and_detect_all_d3_states）得到 disconnected 等，并更新 game_interface_data（set_d3_status、set_d3_dynamic_status、geometry）。
- **skip_dynamic**：True 时仅找窗 + 写 geometry，不截屏、不跑 SIFT（用于启动/手动刷新等轻量刷新）；False 时执行 _detect_d3_dynamic（一次 capture，state_dict 中的 disconnected 用于 set_d3_dynamic_status）。流程中需要「是否掉线」时应用 skip_dynamic=False。
- **_detect_d3_dynamic 返回值**：三元组 (on_login_screen, disconnected, in_game)；当前实现仅根据 state_dict["disconnected"] 填 (False, disconnected, False)，on_login_screen 与 in_game 未在此处赋值。若上游依赖这两项，需在 capture_and_detect_all_d3_states 或 state_dict 中提供并在此处传回。
- **refresh_window_state**：由 status_provider_common 提供；本模块传入 set_running_fn、set_dynamic_fn、detect_dynamic_fn、apply_geometry_fn；detect 仅在 skip_dynamic=False 时执行。

### 3.2 易被误解或改错的原因

1. **skip_dynamic 用错**：若在需要「掉线」判断的流程里传 skip_dynamic=True，会永远得到 (False, False, False)，disconnected 永远不更新；若在仅需「有没有 D3 窗口」的刷新里传 skip_dynamic=False，会多做一次截屏/SIFT，延迟与开销增大。
2. **state_dict 结构**：_detect_d3_dynamic 依赖 capture_and_detect_all_d3_states 返回的 state_dict 含 "disconnected"；若 d3_start_game_and_teleport_waiter 中 state_dict 的 key 改名或改为嵌套，此处会取不到或报错。
3. **on_login_screen / in_game 未实现**：当前只填 disconnected；若文档或调用方假定 on_login_screen、in_game 已在此 provider 中更新，会误用。若需支持，应在 _detect_d3_dynamic 中从 state_dict 或 capture 结果解析并返回。
4. **prime_window_cache_for_capture**：仅在 skip_dynamic=False 时调用；若 find_windows 依赖缓存而 skip_dynamic=True 时未 prime，可能找窗不准；当前设计是 skip_dynamic 时不做 capture 故不 prime，find_windows 用 d3_manager 自己的缓存逻辑，需与 d3_manager 约定一致。
5. **apply_geometry 的 game_data 属性**：_apply_d3_geometry 会写 fullscreen_size、window_offset、_window_hwnd、_window_title；若 game_interface_data 结构变化或其它模块依赖这些字段的命名，需同步。

### 3.3 正确做法

- 流程中需要「D3 是否掉线」时调用 refresh_d3_status(skip_dynamic=False)；仅做「有没窗口 + 几何」时用 skip_dynamic=True。
- 修改 capture_and_detect_all_d3_states 的 state_dict 结构时，同步改 _detect_d3_dynamic 的取值；若增加 on_login_screen/in_game 的检测，在此处一并返回并写入 set_d3_dynamic_status。
- 与 status_provider_common、d3_manager 的「找窗 / 缓存 / 几何」约定保持一致，避免重复 prime 或漏 prime。

---

## 四、与道歉文档的关系

若此前因上述任一点（如 template_match_debug 未激活即用、result 结构改坏、F4 顺序或步骤改错、d3_status_provider 的 skip_dynamic 或 state_dict 用错）导致反复改错或理解偏差，可视为实现与约定不一致所致。本说明已写入 `cursor_AI_道歉目录`，并在 `Cursor_专属道歉文档.md` 中增加对本文的引用，便于后续修改前先查此处约定。
