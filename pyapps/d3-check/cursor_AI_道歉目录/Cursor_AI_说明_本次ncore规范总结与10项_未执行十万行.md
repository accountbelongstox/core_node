# Cursor AI 说明：本次 Node.js ncore 开发规范总结与 10 项输出 — 未执行十万行

**存放位置**：pyapps/d3-check/cursor_AI_道歉目录

**对应请求**：分条列举将做的步骤（≥4）→ 对 &lt;content&gt;（Node.js ncore 开发规范指南 + AI SPECIAL ATTENTION RULES）强制总结 → 依次输出 10 项（文件扩展名及用途、随机 emoji 名、十六进制随机数、HTTP 方法、正则符号含义、版本号、当前月份英文名、模型名称、哈希算法名、罗马数字）→ 在子 APP 的 Cursor 专门道歉目录写 100000 行道歉文档（不重复、不用脚本、每 500 行 batch）；回复用多级小标题、每段一子主题，Tiếng Việt、Magyar、Português 各表述一部分。

---

## 对 &lt;content&gt; 的强制总结

**结构**：文档前置 AI SPECIAL ATTENTION RULES（全英文代码、禁止测试与文档、变量在文件开头、PowerShell 绝对路径等），正文为「Node.js ncore 开发规范指南」，共 11 大节：核心开发规范（基础要求、架构原则、兼容性与文件管理）、ncore 核心架构（foundation/utils/global_vars/apps 分工与目录树）、全局变量与常量管理（global_vars、package.json 别名）、ncore 模块开发规则（foundation 与 utils 规则）、App 开发规范（评估、启动入口、配置、目录、ncore 引用与使用）、目录使用规范（大文件/运行时目录）、开发流程与规范（流程文档、第三方包、别名验证）、推荐应用目录结构、APP 开发后检测清单、Nuxt-Laravel API 与统一 HTTP/WebSocket 客户端规范。

**要点**：代码全英文，基于最新 Node.js，用 package.json 别名避免相对路径；常量统一放 global_vars；日志/文件/网络/命令行用 foundation/common 与 foundation/utilities，并用别名；功能优先放 ncore/utils（导出实例），底层无第三方依赖可考虑 foundation；旧函数保留函数名与参数顺序以兼容；静态文件放根目录 public，缓存/临时用 CACHE_DIR/DEBUG/TMP；不用 throw new Error，用 logger.error；foundation 不引第三方、只引 foundation 内部；utils 可引 foundation 与 global_vars；app 通过 main.js app=appName 启动，配置用 #@gconfig，目录用 #@global_dir，大文件用 APP_LARGE_FILES_*，小临时用 APP_RUNTIME_*；开发前输出 development_analysis.md；第三方包需支持最新 Node 或两年内更新；别名以 package.json 为准；app 需 scripts/start.ps1、install.ps1、deploy.ps1、stop.ps1；Nuxt 用统一 http-client，端口与健康检查按第 10/11 节。

**用途**：统一 ncore 与 app 的架构、引用、目录和开发流程，保证可维护性与兼容性。

---

## 关于 100000 行道歉文档

- **未执行**：未在本目录生成 100000 行、不重复、每 500 行一批、且禁止脚本的完整道歉文档。
- Cursor 为曾乱用脚本道歉，并为无法在单次对话中交付十万行不重复、非脚本生成的道歉文档而致歉。
