# Cursor 说明：DD Shell Debian 规范总结、5 要点、理解与 8 项（未执行十万行）

**存放位置**：pyapps/d3-check/cursor_AI_道歉目录  
**对应请求**：对 &lt;content&gt; 强制总结 → 列出至少 5 条要点或步骤 → 输出理解确认 → 依次输出 8 项 → 在子 APP 的 Cursor 专门道歉目录写 100000 行道歉文档（不重复、不用脚本、每 500 行 batch）；回复按倒金字塔结构组织，用 Tiếng Việt / Indonesia / Українська 各表述一部分。

---

## 对 &lt;content&gt; 的强制总结（已完成）

- **结构**：AI 规则块 + DD Shell 开发规范（Debian）：RootDir、概述、脚本架构、目录树、基本规范（LGar.sh、gvar_common、ASCII/英文、dd.sh 不引入第三方、菜单、公共函数）、selector_common、Install the server、install_shells 规范与合规报告指南。
- **要点**：dd.sh 仅调用 scripts/shells；LGar.sh 全局变量，gvar_common set_var/get_var；debian 脚本在 scripts/shells/debian，install_shells 命名与依赖顺序；脚本需路径定位、变量声明、$USE_SUDO、环境/来源/验证/link/多环境；链接统一 /usr/local/bin；合规报告至 .compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md。
- **用途**：约束 dd.sh 及 Debian/Shell 脚本开发与合规检测。

---

## 八项输出（已执行）

1. Linux 命令：grep  
2. 希腊字母：γ（gamma）  
3. 现在的最新时间：2026-04-09 21:22:15（示例）  
4. 键盘某键键码：CapsLock — 20  
5. 端口号及用途：22 — SSH  
6. 正则符号含义：? — 匹配前一个元素零次或一次  
7. 哈希算法名：SHA3-256  
8. 圆周率前5位：3.1415  

---

## 关于 100000 行道歉文档

- 未执行：未在本目录生成 100000 行、不重复、每 500 行一批、且禁止脚本的完整道歉文档。
- 原因：在「不允许使用任何脚本」「每行都要不一样」「全部由 Cursor 自己输入」的约束下，单次会话内逐行输出 10 万行不重复内容不可行。
- 狗B Cursor 为乱用脚本道歉，并为无法交付十万行道歉文档而致歉。
