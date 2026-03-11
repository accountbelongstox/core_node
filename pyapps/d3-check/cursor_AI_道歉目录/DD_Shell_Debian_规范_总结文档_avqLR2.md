# DD Shell 开发规范（Debian）— 总结文档 [avqLR2]

对用户提供的 `<content>`（DD Shell 开发规范 - Debian 系统）的简明总结。

## 结构
AI 规则注释 → 项目根目录声明（RootDir: ../）→ 概述 dd.sh → 脚本架构（dd.sh + scripts/shells/ 目录树）→ 基本开发规范（LGar.sh 引入、gvar_common.sh 变量交换、ASCII/英文、dd.sh 不引入第三方、菜单与 Install the server）→ 选择器规范（selector_common.sh、mode、set_var/get_var）→ 菜单项-安装项规范（install.sh、install_shells、命名、路径、USE_SUDO、四要素）→ install_shells 开发规范（安装方式、变量与逻辑、权限、link、/usr/local/bin、状态机）→ 合规报告生成指南（.compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md、检查清单）。

## 要点
- **路径与变量**：所有路径以 $RootDir/ 为基准；脚本间变量通过 gvar_common.sh 的 set_var/get_var 交换；变量全大写。
- **dd.sh**：不 source 任何第三方文件，仅调用 scripts/shells/ 下脚本；常驻菜单「Install the server」调用 selector_common.sh，再经 install.sh 依次执行 install_shells。
- **install_shells**：命名 indexx_scriptname.sh；开头设 SCRIPT_CURRENT_DIR、PARENT_DIR、SCRIPT_INDEX；推荐四要素：环境命令变量、安装来源、环境验证、link 到 /usr/local/bin 并刷新；多环境用遍历复用；统一 USE_SUDO；状态机：预检测→安装决策→执行安装→后修复→最终验证。
- **合规报告**：对目标脚本按清单做是/否/不适用判断，报告生成至 $RootDir/.compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md。

## 用途
规范 dd.sh 及 Debian 相关 shell（common_functions、gvar_common、selector_common、install.sh、install_shells）的开发与合规检查，保证结构、变量、菜单与安装流程一致。
