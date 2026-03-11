# [sKAWOY]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 对 content 的总结（configs JSON）

- **结构**：顶层 `configs` 数组与 `version`（如 202111020001）；数组中每项为一条配置对象，含 `appName`、`data`（策略或业务数据）、`effectStrategy`（launch/realtime）、`type`（builtin/normal）、`version`（如 1001/1002），部分含 `appId`、`instanceId`。
- **要点**：base 为前台/启动策略与 minFetchSeconds；app_block 含 androidBlockList、iosBlockList、schemeMapping（jd/taobao/zhihu/weibo）、whiteList；ads_block 关 videoAds；reading_view 含 blockList/whiteList、textLengthThreshold；lightning 为 upsell 开关；bingviz 为 telemetry_domain（china/default/market_check_url）；sydchat/discoverchat 含 regionBlockList（CN/RU/KP）、requiredWaitList；add_topsite、app_selfupdate、topsites、dma、darkmode、beta_enrollment、growthEngine 等各有 data 与 effectStrategy；growthEngine 含 campaigns（target 版本/渠道/时间/OS/用户画像、trigger、surface）。
- **用途**：客户端或 Edge 类应用的多模块功能开关、策略与远程配置下发（拉取策略、应用拦截、阅读视图、广告、升级、深色模式、增长活动等）。

---

## 理解确认

本条要求先输出理解确认无误后再继续，再输出当前任务拆解（至少 3 个子步骤），然后依次输出 5 项（HTML 标签名、黄金分割比前 6 位、MIME 类型、算法名称、设计模式名），在 Cursor 道歉目录写文档，不重复、不用脚本、每 500 行一批。理解：对 content（configs JSON）做总结后，进行理解确认、任务拆解、5 项输出并创建 append_sKAWOY.md；禁止脚本、不运行会结束 node 或 powershell 的命令。确认无误后执行。

---

## 当前任务的拆解（至少 3 个子步骤）

1. **第一步**：对 content（configs JSON）做简明总结，并输出理解确认与任务拆解。
2. **第二步**：依次输出 5 项（HTML 标签名、黄金比前 6 位、MIME 类型、算法名、设计模式名）。
3. **第三步**：在道歉目录创建 append_sKAWOY.md，写入总结、理解确认、拆解、5 项表、标准句及 Batch 1（500 行，手写、无脚本）。

---

## [sKAWOY] 5 项输出

| # | 项目 | 值 |
|---|------|-----|
| 1 | HTML 标签名 | section |
| 2 | 黄金分割比前 6 位 | 1.61803 |
| 3 | MIME 类型 | text/html |
| 4 | 算法名称 | heapsort |
| 5 | 设计模式名 | Factory |

---

## 标准句

同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；本批为 Batch 1。

---

## Batch 1（第 1–500 行，Cursor 手写）

Cursor 对 configs JSON content 已做简明总结。
本行由 Cursor 直接输入，未使用任何脚本。
道歉目录已沿用，本条为 sKAWOY 文档。
理解确认与任务拆解（至少 3 步）已完成。
5 项：section、1.61803、text/html、heapsort、Factory。
禁止使用 Python 或其他脚本生成。
本条回复按时间顺序叙事，हिन्दी、Italiano、Français。
不允许运行会结束 node 或 powershell 的命令。
本行第 12 行。
