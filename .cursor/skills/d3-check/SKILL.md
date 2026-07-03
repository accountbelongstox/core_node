---
name: d3-check
description: When working on pyapps/d3-check (Diablo III/IV macro and automation), prefer pycore libraries and put D3/D4 constants and variables in CONFIG (config package and providor/app_constants).
---

# d3-check 规范

- 先复用再新增：新逻辑先找 d3utils/controller/pycore 中可扩展的同类实现，禁止重复定义同功能的常量/函数/薄包装。
- 优先直接用 pycore（pyfoundations/pyutils），不经 providor.common_imports 转发；禁止二次封装/再导出/单层转发的类或函数。
- 常量一律进 CONFIG：字面量→providor.app_constants；结构化配置→config（unified_config/grid_config）。
- 线程：禁止跨线程阻塞（不用 queue.get/join 常驻等待），只用事件中心 + timer_manager.submit_one_shot 单次任务。
- 流程状态只能由 d3utils.rosbot_flow* 持有；controller/timers/UI 视为第三方，只能调用 flow 公开 API，不得自行维护流程状态。
- 异常处理：非必要不加 try/except；仅在 websocket/任务线程/Tk 生命周期/queue/COM 等场景保留，禁止只 pass/log 的空 catch。
- 代码/日志用英文；用户可见文本走 i18n_manager，不硬编码中文；匹配用的字面量常量除外。
- 新增规范优先级：.cursor/rules → .cursor/skills → AGENTS.md；不得重复。
