# `main.py` 启动与 HTTP 桥接（供 dotapps 对照）

本文只描述 **`python pyapps/d3-check/main.py`** 的入口、两种运行模式与**实例复用**约束。与游戏功能开关（如「先民蓝门复用」`firstborn_blue_gate_reuse`）无关；后者见 [FIRSTBORN_BLUE_GATE_REUSE_FOR_DOT.md](FIRSTBORN_BLUE_GATE_REUSE_FOR_DOT.md)。两份文档互不替代。

总规范见 [PROJECT_STANDARDS.md](PROJECT_STANDARDS.md)；dot 功能清单见 [DOT_D3CHECK_SUBLIBRARIES.md](DOT_D3CHECK_SUBLIBRARIES.md)。

---

## 1. 命令行

| 命令 | 行为 |
|------|------|
| `python main.py` | **默认**：Tk 主界面 + 本机 HTTP 桥接 `127.0.0.1:8765` |
| `python main.py --http-bridge-only [--host H] [--port P]` | **仅 HTTP**：无 Tk；DOT 客户端可连 `H:P` 做录屏/YOLO 等 |
| `import main`（作库） | **不**自动执行 `main()`；自行使用 `HTTPBridgeController` 等 |

---

## 2. 进程前置（与 UI 无关）

- `sys.path`：插入 **d3-check 根**与 **仓库根**（`core_node`），保证 `pycore`、包导入正确。
- `SIGINT` / `SIGBREAK`：在导入可能劫持 Ctrl+C 的库之前可先忽略（见 `main.py`）。
- **`import lifecycle`**：向 `shutdown_manager` 注册线程关闭序列；注释约定：**仅** `main`（与事件总线）可直接依赖 `lifecycle`。

---

## 3. 默认模式：GUI + 桥接（`_run_gui_and_bridge`）

顺序建议与 Python **保持一致**。

1. **（Windows）** 可选：隐藏控制台（`GetConsoleWindow` + `ShowWindow(SW_HIDE)`）。
2. **`get_system_initializer().initialize_system(gui_mode=True)`** — 单例，全进程一次。
3. **`i18n_manager.load_language_from_config()`**。
4. **`controller = D3MacroController()`** — 本进程**一份**主控制器。
5. **`HTTPBridgeController(host="127.0.0.1", port=8765, macro_controller=controller)`** — **传入同一** `controller`，保证 HTTP 与 UI 共用宏状态与配置视图。
6. **`bridge_controller.start()`**。
7. **`controller.run()`** — 创建 Tk UI、注册监控/扩展线程/事件、`mainloop`；退出后 **`execute_shutdown()`**。

异常路径：若已创建 `bridge_controller`，应 **`stop()`**。

---

## 4. 仅桥接：`--http-bridge-only`（`_run_bridge_only`）

1. **`initialize_system(gui_mode=False)`** — 信号/热键行为与 GUI 模式不同（见 `d3utils/system_initializer.py`）。
2. **`D3MacroController()`**。
3. **`HTTPBridgeController(host, port, macro_controller=controller)`** — 仍共用**一份** `macro_controller`。
4. **`bridge_controller.start()`**。
5. 主线程 **`while True: sleep`**，直至 `KeyboardInterrupt`。
6. **`finally: bridge_controller.stop()`**。

**无** `Diablo3MacroUI`、`controller.run()`，故无 Tk/托盘；HTTP API 仍操作同一套控制器逻辑。

---

## 5. 复用约束（dot 实现时勿拆成两份）

| 项 | 说明 |
|----|------|
| `SystemInitializer` | 单例，`initialize_system` 每种进程生命周期一次 |
| `HTTPBridgeServer` | `get_http_bridge_server(host, port)` **按 (host,port) 缓存**，避免同端口重复监听 |
| `D3MacroController` | `main` 里**一个**实例；**必须**注入 `HTTPBridgeController`，勿各 new 一份 |
| `ENCYCLOPEDIA['http_bridge_controller']` | Python 侧登记桥接；dot 可用等价服务定位器 |

---

## 6. 代码锚点

| 文件 | 内容 |
|------|------|
| `pyapps/d3-check/main.py` | `_parse_args`、`_run_gui_and_bridge`、`_run_bridge_only`、`main()` |
| `d3utils/system_initializer.py` | `initialize_system(gui_mode)` |
| `controller/http_bridge_controller.py` | `get_http_bridge_server`、`HTTPBridgeController` |
| `controller/d3_macro_controller.py` | `run()` |

---

*CLI 默认 host/port 若变更，请同步本文与调用方（含 DOT）。*
