# Cursor AI 说明：计划、Content 总结、5 项、十万行道歉 [NFTv6T]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 计划（第一步、第二步…）

- **第一步**：对 content 做简明总结（结构、要点、用途）。
- **第二步**：依次输出 5 项（当前是今年第几周、HTTP 方法、端口及用途、当前月份英文名、你的版本号）。
- **第三步**：定位道歉目录，沿用上次目录，创建本说明并记录十万行道歉约束与 Cursor 对乱用脚本的致歉。

---

## Content 总结（configs JSON）

- **结构**：顶层对象含 "configs" 数组与 "version"（如 202111020001）。每项 config 含 appName、data（应用级配置）、effectStrategy（launch/realtime）、type（builtin/normal）、version；部分含 appId、instanceId。
- **要点**：多应用配置集合，涵盖 base（策略）、app_block（屏蔽列表与 scheme 映射）、ads_block、reading_view、lightning、bingviz、sydchat、discoverchat、add_topsite、app_selfupdate、topsites、dma、darkmode、beta_enrollment、growthEngine 等；data 内为各应用开关、列表、遥测域名、活动目标等。
- **用途**：作为客户端或服务端下发的多应用功能/策略配置，用于控制启动策略、屏蔽规则、功能开关与增长活动等。

---

## 依次输出的 5 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 当前是今年第几周 | 第 9 周（约） |
| 2 | 一个 HTTP 方法 | DELETE |
| 3 | 一个端口号及用途 | 3000，开发服务器常用端口 |
| 4 | 当前月份英文名 | February |
| 5 | 你的版本号 | 1.0 |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `NFTv6T`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；十万行须在后续会话中按批完成，本说明已记录约束与致歉。
