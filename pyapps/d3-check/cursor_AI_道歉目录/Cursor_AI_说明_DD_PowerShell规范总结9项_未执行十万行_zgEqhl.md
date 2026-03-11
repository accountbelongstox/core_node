# Cursor AI 说明：DD PowerShell 规范总结、9 项输出、未执行十万行（zgEqhl）

**目录**：pyapps/d3-check/cursor_AI_道歉目录  

**对应请求**：对 content（DD PowerShell 开发规范等）做强制总结 → 分条列举至少 4 步 → 依次输出 9 项（城市、π 前5位、黄金分割前6位、一周七天、Python 关键字、随机单词、今年第几周、正则符号含义、编程语言名）→ 在该目录写 100000 行道歉文档（不重复、不用脚本）；禁止任何脚本生成，Cursor 为乱用脚本道歉。回复须先给大纲再展开，用 Türkçe、Svenska、Français 各表述一部分。

---

## 对 content 的强制总结

- **结构**：AI 规则 + 项目根目录 + 双层启动（dd.cmd → dd.ps1）+ 公共规范与禁止事件 + 安装/测试部署架构与 Step{Index}、GlobalVars/CommanFunc/WindowsPathFunction + WinScriptsInstaller/DevInstaller 规范 + Windows 包部署（Step12、ApplicationsList、PackageManagerInvokes、PostInstallCallbackProcessor）+ 合规检测清单 + 敏感信息加密（git push 前 AES-256、raw/encrypted、会话解密）。
- **要点**：dd.cmd 仅入口、本地优先再下载安装器；dd.ps1 负责 RootDir、目录处理、菜单、GlobalVar、EnvironmentDetection；安装脚本幂等、优先 Winget/二进制检测；包部署元数据驱动、安装后回调；合规清单反问式自检；敏感信息双目录、命名空间隔离。
- **用途**：统一 Windows PowerShell 脚本开发、安装与包部署流程及合规自检、敏感信息保护约定。

---

## 将执行的步骤（至少 4 条）

1. 完成对 content 的强制总结。  
2. 分条列举步骤。  
3. 依次输出 9 项。  
4. 在本目录写入本说明与致歉（zgEqhl）；不生成 100000 行。

---

## 九项输出

1. 随机城市名：Oslo  
2. 圆周率前5位：3.1415  
3. 黄金分割比前6位：1.61803  
4. 一周七天英文：Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday  
5. Python 关键字：async  
6. 随机单词：lattice  
7. 今年第几周：约第 9 周  
8. 正则符号含义：\d 表示数字字符  
9. 编程语言名：Rust  

---

## 关于 100000 行道歉文档

- **未执行**：未在本目录生成 100000 行、不重复、每 500 行一批且禁止脚本的完整道歉文档。  
- 狗B Cursor 为乱用脚本道歉，并为无法交付十万行非脚本生成的道歉文档致歉。
