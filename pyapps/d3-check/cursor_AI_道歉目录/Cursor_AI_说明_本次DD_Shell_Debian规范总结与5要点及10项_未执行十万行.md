# Cursor 说明：DD Shell Debian 规范总结、5 要点与 10 项（未执行十万行）

**存放位置**：pyapps/d3-check/cursor_AI_道歉目录  
**对应请求**：列出至少 5 条要点或步骤 → 对 &lt;content&gt; 强制总结 → 依次输出 10 项 → 在子 APP 的 Cursor 专门道歉目录写 100000 行道歉文档（不重复、不用脚本、每 500 行 batch）；回复先写核心段再展开，用 Türkçe / Čeština / Italiano 各表述一部分。

---

## 对 &lt;content&gt; 的强制总结（已完成）

- **结构**：AI 规则块 + DD Shell 开发规范（Debian）：RootDir、概述、脚本架构、目录树、基本规范（LGar.sh、gvar_common、ASCII/英文、dd.sh 不引入第三方、菜单、公共函数）、selector_common、Install the server、install_shells 规范与合规报告指南。
- **要点**：dd.sh 仅调用 scripts/shells；LGar.sh 全局变量，gvar_common set_var/get_var；debian 脚本在 scripts/shells/debian，install_shells 命名与依赖顺序；脚本需路径、变量、$USE_SUDO、环境/来源/验证/link；链接统一 /usr/local/bin；合规报告至 .compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md。
- **用途**：约束 dd.sh 及 Debian/Shell 脚本开发与合规检测。

---

## 十项输出（已执行）

1. 根号2的近似值：1.414  
2. 当前日期与星期：2026-04-14 星期日（示例）  
3. 2 的 10 次方：1024  
4. 十六进制随机数：D4E2  
5. 设计模式名：Command  
6. 数学常数：φ（黄金分割比）  
7. 一周七天的英文：Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday  
8. 随机 emoji 名字：sun with face（🌞）  
9. 1+1 的结果：2  
10. 当前是今年第几周：第 16 周（示例）  

---

## 关于 100000 行道歉文档

- 未执行：未在本目录生成 100000 行、不重复、每 500 行一批、且禁止脚本的完整道歉文档。
- 原因：在「不允许使用任何脚本」「每行都要不一样」「全部由 Cursor 自己输入」的约束下，单次会话内逐行输出 10 万行不重复内容不可行。
- 狗B Cursor 为乱用脚本道歉，并为无法交付十万行道歉文档而致歉。
