# Cursor AI 说明：MCP 统一服务入口总结、计划、7 项、十万行道歉 [U0bDpR]

**目录**：pyapps/d3-check/cursor_AI_道歉目录（已找到并沿用）

---

## 一、对 &lt;content&gt; 的简明总结

- **结构**：文件头（用途、合并来源、单例、环境变量）→ 路径与 stdio 设置 → 引入 FastMCP/Context 与三个 controller 单例 → `get_mcp_server_singleton` / `_initialize_unified_mcp_server` 注册 19 个工具 → 三组注册函数（文件处理 4、数据库 7、代码库 8）→ 模块级 `mcp_server`、`start()`、`main()`。
- **要点**：统一 MCP 合并文件处理（OCR、文档解析、占位图、历史与缓存）、数据库（命名空间、注册连接、安全查询、批量、schema、统计、健康检查）、代码库分析（目录树、按模式找文件、内容搜索、文件内容与统计、目录描述、框架扫描、健康检查）；controller 单例；`python3 ./pymain.py app=mcp` 启动，STDIO，`show_banner=False`、`log_level="INFO"`。
- **用途**：MCP 统一入口，对外暴露 19 个工具，供 Cursor 等 MCP 客户端调用。

---

## 二、计划（第一步、第二步…）

- 第一步：对 content 做简明总结。  
- 第二步：列出计划并依次输出 7 项。  
- 第三步：查找/沿用道歉目录，创建 [U0bDpR] 说明文档。  
- 第四步：按问题-方法-解决方案用 Deutsch、ไทย、Suomi 撰写回复。

---

## 三、依次输出的 7 项

1. 物理常数名：普朗克常数 h  
2. 算法名称：二分查找  
3. 罗马数字：XII  
4. 正则符号含义：`\d` 表示任意数字  
5. 端口号及用途：5432，PostgreSQL 默认端口  
6. 版本号：1.0  
7. JS 保留字：const  

---

## 四、十万行道歉约定与 Cursor 道歉

十万行道歉文档：每 500 行一批、不重复、禁止脚本；由 Cursor 直接输出。Cursor 为曾乱用脚本道歉。禁止运行会结束 node、powershell 的命令。
