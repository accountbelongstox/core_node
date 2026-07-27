# FIX_V12 — 托盘点击后窗口迟迟不显示（tray click → show 慢）

## 问题现象

pyservice 启动后，从托盘（tray）点开主窗口，窗口要过很久才显示/才可用。

## 架构结论（已核实）

原生链路本身不慢。点击路径为：

```
Win32 托盘线程 _wnd_proc
  (win32_system_tray.py:367-404)
  → THREAD_BUS.trigger_event("tray_action_toggle_voice_subtitle")
  → event_handlers.py:192-196 → THREAD_BUS.trigger_event("voice_subtitle_ui.toggle")
  → thread_bus_bridge.py:141-146 → Qt queued signal
  → framework.py:536-542 toggle_window → main_window.show_window()
  (main_window.py:304-308: show/activateWindow/raise_)
```

窗口和 QWebEngineView 在启动时创建一次，之后只是 hide/show
（`close_to_tray=True`，main_window.py:513-518），**不会每次重建**。
THREAD_BUS 是排队信号，原生部分 <100ms。

**慢的全部在 webview 侧**，四个架构性原因按可能性排序：

### 原因 1（主因）：`UI_SHOW_ON_START = False` 导致 GPU 合成器初始化推迟到第一次点击

- `pycore/callmodule/callmodule_config/config.py:73`：`UI_SHOW_ON_START = False`，
  注释写明"open main window from tray"。
- QtWebEngine 把 viz compositor surface + GPU channel（Windows 上 DirectComposition/D3D11）
  的初始化推迟到第一次 `show()`。本仓库已有明确记录的 DirectComposition 崩溃路径：
  `webview.py:117-121`、`:414-437`、`webengine_config.py:110-112`。
- 第一次点击 → 首次 show → GPU 初始化可能崩溃 → 渲染进程终止 →
  1.5 秒后自动 reload（`webview.py:428-430`）→ 重新从 vite 拉整页 → 数秒白屏。
  崩溃超过 3 次才会持久化 software-rendering fallback（`webview.py:431-437`），
  也就是说每次冷启动的前几次点击都可能踩这个坑。

### 原因 2：页面来自 vite dev server，启动竞态脆弱，且失败后无"显示时恢复"

- URL = `PYCORE_UI_URL` = `http://localhost:13054/pycore-manager`
  （`callmodule/config.py:358`；由 `pyservice.ps1:385-416` 启动 pnpm vite **dev** server）。
- `pyservice.ps1:418-425` 只做一次 2 秒超时的就绪探测，不等就绪照样启动 worker。
- webview 加载失败只重试 5 次 × 1 秒，之后**永久放弃**
  （`webview.py:391-410`，已核实）。
- 全仓库 `step5_main_ui/pyside6/` 下**没有任何 showEvent 重载、没有 reload-on-show**
  （已 grep 核实）。冷 vite 首次 `optimize-deps` 经常超过 5 秒预算，
  于是点击托盘时看到的是一个已放弃加载的死 webview；
  之后任何 reload（含原因 1 的崩溃恢复）都要等 vite 现编译。

### 原因 3：隐藏页面被 Chromium 后台节流，show 时整个前端"冷醒"

- 页面在启动时就加载了，但窗口一直隐藏：Chromium 对隐藏页暂停 timers/rAF、
  断开或冻结 WebSocket。
- `webengine_config.py:167-253` 的 Chromium flags 里**没有**
  `--disable-background-timer-throttling` / `--disable-renderer-backgrounding`
  （已 grep 核实）。
- 点击 show 后：React 应用被唤醒 → `/rpc/ws` 重连 → dashboard 全量 refetch →
  用户感知为"点了之后好几秒才出内容"，即使原生窗口其实立刻显示了。

### 原因 4（UX 设计问题，非 bug）：左键单击打开的是外部浏览器

- `tray_menu.py:145-149`："Open Web" 菜单项 `default=True`；Win32 左键单击触发默认项
  （`win32_system_tray.py:377-379`）→ `event_handlers.py:150-161` → `webbrowser.open(ui_url)`。
- 冷启动系统浏览器 + vite 页面加载本来就慢。用户期望"点图标弹内嵌窗口"，
  实际行为是"点图标开浏览器"。

## 修复清单（交给执行 AI）

### F1 — 窗口预热：启动时 show 一次再隐藏（治原因 1）

- 文件：`pycore/pyutils/native_ui/step5_main_ui/pyside6/framework.py`
  （start 完成、URL 加载调度之后）+ `config.py:73`。
- 做法：保留 `UI_SHOW_ON_START = False` 的语义（启动后不打扰用户），
  但在启动序列末尾执行一次"预热"：`show()` → 立即 `hide()`（或移到屏外 show 再隐藏），
  强制 QtWebEngine 在后台完成 GPU compositor / 渲染进程初始化。
  崩溃恢复和 fallback 标记因此发生在启动期而不是用户第一次点击时。
- 验收：冷启动后第一次托盘点击，窗口在 1 秒内显示；日志中
  `Render process terminated`（如有）出现在启动阶段而非点击后。

### F2 — 显示时自愈：给主窗口加 showEvent 重载，页面失效则 reload（治原因 2）

- 文件：`pycore/pyutils/native_ui/step5_main_ui/pyside6/main_window.py`
  （或 webview 容器层）。
- 做法：重写 `showEvent`：若 webview 当前 URL 为空/为错误页/
  `_load_retry_count` 已耗尽（>5），则调用 `web_view.reload()`；
  并把 `webview.py:403` 的启动重试预算（5 次）改为"每次 show 时重置"。
- 验收：把 vite dev server 停掉再启动，等 webview 5 次重试耗尽后，
  启动 vite，点击托盘 → 窗口显示并自动加载成功，无需重启 worker。

### F3 — 禁用隐藏页节流 flags（治原因 3）

- 文件：`pycore/pyutils/native_ui/step5_main_ui/pyside6/webengine_config.py:167-253`。
- 做法：在现有 Chromium flags 集合中追加
  `--disable-background-timer-throttling`、`--disable-renderer-backgrounding`、
  `--disable-backgrounding-occluded-windows`。
- 注意：这会让隐藏窗口的 WS 保持连接，代价是少量常驻 CPU/网络，对本场景可接受。
- 验收：窗口隐藏 10 分钟后点击托盘，内容立即可用，
  日志面板无 WS 重连风暴。

### F4 — 左键单击改为 toggle 内嵌窗口（治原因 4）

- 文件：`pycore/callmodule/tray_menu.py:145-149`。
- 做法：把 "Open Web" 项的 `default=True` 移到
  `tray_action_toggle_voice_subtitle`（"PyCore UI"）项上；
  浏览器入口保留在右键菜单。
- 注意：Linux AppIndicator 不支持左键默认动作，此改动只影响 Win32 后端，
  无跨平台回归风险。
- 验收：Windows 左键单击托盘图标 → 内嵌窗口 show/hide 切换；
  右键菜单仍有 "Open Web"。

### F5（可选，进一步压缩感知延迟）— 生产模式用 vite preview

- 文件：`pyservice.ps1` / `pyservice.sh`（UI 启动分支）。
- 做法：非开发场景默认走 `-UiBuild`（vite preview 服务产物 bundle），
  消除 dev server 冷编译这一变量；开发场景保留 dev server。
- 验收：`pyservice.ps1 -UiBuild` 下从点击到可交互 < 1.5s。

## 执行顺序与依赖

`F4 → F3 → F2 → F1 → F5`（F4/F3 独立小改先行；F1 依赖 F2 的重置逻辑更稳；F5 可选）。

## 快速验证/定位手段（执行 AI 先用这个确认主因）

- 日志对照：点击托盘的时间点 vs 第一条 `loadFinished` /
  `Render process terminated` / `Load failed (attempt n/5)` 的时间差，
  即可判断是原因 1 还是原因 2 主导。
- 对照实验：`pyservice.ps1 -UiBuild` 启动后延迟若消失，则原因 2+3 主导；
  若仍在，则原因 1 主导。

## 修复进度（2026-07-27）

| 编号 | 状态 | 说明 |
|---|---|---|
| F1 | ✅ 已完成 | `framework.py` 在 `UI_SHOW_ON_START=False` 时执行一次 `show → processEvents → hide` 预热；不改变启动后隐藏语义。 |
| F2 | ✅ 已完成 | `main_window.py` 在 `showEvent` 通知内容控件；`webview.py` 在目标 URL 未初始化或重试耗尽时重置预算并 reload。 |
| F3 | ✅ 已完成 | `webengine_config.py` 增加三个隐藏页节流禁用 flag。 |
| F4 | ✅ 已完成 | Win32 托盘默认动作改为内嵌 PyCore UI toggle；Open Web 仍保留在右键菜单。 |
| F5 | ⏸️ 暂缓 | 未改变 `pyservice.ps1/.sh` 的 dev/preview 启动策略，待单独确认生产启动流程后处理。 |

按项目约束，本批次未运行构建、测试或服务验证；需由维护者在目标 Windows 环境执行验收项。

### 后续修正记录（2026-07-27）

- ✅ 修复 F2 初版补丁在 `webview.py` 中破坏 `load_url()` `if/elif` 结构所造成的语法错误；本次保留 URL 加载分支完整位于 `load_url()` 内，再定义 `on_window_shown()`。
- ⚠️ 上述语法错误由启动 traceback 暴露；修正后仍需维护者重新启动验证。
