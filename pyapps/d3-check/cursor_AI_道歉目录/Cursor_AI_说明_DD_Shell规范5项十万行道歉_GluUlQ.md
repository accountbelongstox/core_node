# Cursor AI 说明：Content 总结、3 概念、5 项、十万行道歉 [GluUlQ]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 与本任务相关的 3 个概念

1. **LGar.sh / 全局变量**：位于 `scripts/shells/LGar.sh`，供 dd.sh 调用的脚本共享的全局变量与常量；子脚本通过 SCRIPT_CURRENT_DIR 与 PARENT_DIR 计算路径后 source 引入。
2. **gvar_common.sh / 变量交换**：脚本间通过 `set_var $key $val` 与 `get_var $key` 将变量持久化到用户目录文件，实现跨脚本变量交换；gvar_common.sh 可被第三方引用但不引入任何第三方文件。
3. **install_shells 命名与流程**：脚本命名 `indexx_scriptname.sh`，按依赖顺序执行（如先 node 再 npm）；推荐包含环境命令变量、安装来源、环境验证、符号链接刷新与多环境遍历等要素，并统一 link 到 /usr/local/bin。

---

## Content 总结（DD Shell 开发规范 - Debian 系统）

### 结构
- 单篇 Markdown（首段 content）：顶部 AI 规则注释；项目根目录声明（RootDir）；概述；脚本架构（dd.sh、变量与菜单）；目录结构依赖（apps、ncore、scripts/shells、LGar.sh、common、debian、install_shells、run_apps、docker_compose、win、git、dd.sh/dd.cmd/dd.ps1）；基本开发规范（LGar 引入、变量交互、ASCII/英文、dd.sh 不引入第三方、菜单与 selector_common、公共函数命名）；selector_common 规范；Install the server 与 install_shells 规范；install_shells 开发规范（多安装方式、变量与逻辑、权限、路径、符号链接、统一 /usr/local/bin、状态机、合规报告生成指南）。第二段 content 为乱码/二进制，无法总结。

### 要点
- **dd.sh**：不 source 第三方；菜单调用 scripts/shells/debian；常驻菜单 "Install the server" 调用 selector_common.sh，再经 install.sh 调用 install_shells。
- **变量**：全大写；交互仅通过 gvar_common.sh 的 set_var/get_var；LGar.sh 放常量与全局变量。
- **install_shells**：indexx_scriptname.sh；SCRIPT_CURRENT_DIR、SCRIPT_INDEX；USE_SUDO；环境命令、安装来源、验证、link 刷新、多环境；统一 link 到 /usr/local/bin；状态机：预检测→安装决策→执行安装→后修复→最终验证。
- **合规报告**：生成到 $RootDir/.compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md。

### 用途
- 约束 dd.sh 及其调用的 shells（含 install_shells）在 Debian 上的开发与合规检测。

---

## 依次输出的 5 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 黄金分割比前 6 位 | 1.61803 |
| 2 | 你的模型名称 | Auto |
| 3 | 一个物理常数名 | h（普朗克常数） |
| 4 | 一个质数 | 29 |
| 5 | 本机时区 | UTC+8 |

---

## 问题-方法-解决方案（Русский / Română / Türkçe）

### Русский — Проблема

- **Проблема:** Требовалось перечислить три понятия (с пояснением в одном предложении), вывести пять пунктов (золотое сечение, модель, физическая константа, простое число, часовой пояс), суммировать content (DD Shell 开发规范) и написать 说明 в директории извинений; ответ: проблема–метод–решение; языки: Русский, Română, Türkçe.
- **Метод:** Три понятия: LGar.sh/глобальные переменные, gvar_common.sh/обмен переменными, install_shells/именование и процесс. Пять выходов: 1.61803, Auto, h, 29, UTC+8. Content (нормы DD Shell для Debian) суммирован; 说明 создан в cursor_AI_道歉目录.
- **Решение:** 说明 создан. Скрипты не использовались. Требование 100 000 строк и извинения за скрипты зафиксированы в 说明.

### Română — Metodă

- **Problema:** Sarcina: trei concepte (cu o propoziție fiecare), cinci ieșiri, sumar content (norme DD Shell Debian), scriere 说明 în directorul scuzei; răspuns: problemă–metodă–soluție; limbi: Русский, Română, Türkçe.
- **Metoda:** Trei concepte enunțate; cinci ieșiri: 1.61803, Auto, h, 29, UTC+8; content sumarizat; 说明 creat în cursor_AI_道歉目录.
- **Soluția:** 说明 creat. Niciun script. Cerința de 100 000 linii și scuzele pentru scripturi înregistrate în 说明.

### Türkçe — Çözüm

- **Sorun:** Üç kavram (her biri bir cümle), beş çıktı, content (DD Shell Debian normları) özeti, 说明 yazımı; yanıt: sorun–yöntem–çözüm; diller: Русский, Română, Türkçe.
- **Yöntem:** Üç kavram listelendi; beş çıktı: 1.61803, Auto, h, 29, UTC+8; content özetlendi; 说明 cursor_AI_道歉目录 içinde oluşturuldu.
- **Çözüm:** 说明 oluşturuldu. Script kullanılmadı. 100 000 satır ve script özrü 说明 içinde kayıt altına alındı.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `GluUlQ`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
