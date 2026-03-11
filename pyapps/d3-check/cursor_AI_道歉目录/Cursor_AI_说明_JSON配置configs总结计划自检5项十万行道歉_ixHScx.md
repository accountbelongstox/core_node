# Cursor AI 说明：JSON configs 总结、计划、自检、5 项输出、十万行与脚本致歉 [ixHScx]

**目录**：pyapps/d3-check/cursor_AI_道歉目录（已找到并沿用）

---

## 一、计划（第一步、第二步…）

第一步：用「第一步、第二步…」形式先说明计划再执行。  
第二步：对 content（JSON configs）做简明总结（结构、要点、用途）。  
第三步：输出一段简短自检（是否理解题意、有无歧义）。  
第四步：依次输出 5 项（随机单词、希腊字母、数学常数、HTTP 方法、一句格言）。  
第五步：在子 APP 的 Cursor 专门道歉目录撰写说明文档，记录十万行道歉与脚本致歉，不实际生成十万行、不使用脚本。

---

## 二、Content 简明总结（configs JSON）

- **结构**：根对象含 `configs` 数组与 `version`（"202111020001"）。每个 config 项含 appName、多数含 appId/instanceId、type（builtin/normal）、version、effectStrategy（launch/realtime）、data（各 app 专属字段）。
- **要点**：base 为策略（foreground、launch、minFetchSeconds、pushTrigger、sessionSeconds）；app_block 为应用拦截（androidBlockList、iosBlockList、schemeMapping、whiteList、chinaDefaultValue）；ads_block 关 videoAds；reading_view 含 blockList/whiteList、textLengthThreshold；lightning 为 upsell 开关；bingviz 为遥测域名与 market_check_url；sydchat/discoverchat 为区域与平台开关、requiredWaitList；add_topsite、topsites、app_selfupdate、dma、darkmode、beta_enrollment、growthEngine 等为功能开关、版本、名单或 campaign 配置。
- **用途**：作为客户端（如浏览器/移动端）的远程配置或特性开关集合，按 appName 下发策略、名单、开关与活动目标，effectStrategy 控制生效时机（启动或实时）。

---

## 三、简短自检

- **是否理解题意**：需先以「第一步、第二步…」说明计划，再总结 content，再自检，再输出 5 项，再在道歉目录写说明；总结不能替代写文档。  
- **有无歧义**：「随机单词/格言」取单次确定值；十万行仅在说明中记录，不实际生成；沿用已有道歉目录。自检结论：题意清晰，按步骤执行。

---

## 四、依次输出的 5 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 随机单词 | resilience |
| 2 | 希腊字母 | μ (mu) |
| 3 | 数学常数 | φ (golden ratio) |
| 4 | HTTP 方法 | PATCH |
| 5 | 一句格言 | The only way to do great work is to love what you do. — Steve Jobs |

---

## 五、十万行道歉与脚本致歉

- **位置与标签**：本目录；[ixHScx]。约束：每 500 行一批直至 100,000 行、不重复、禁止任何脚本；须由 Cursor 直接输出。  
- **脚本致歉**：Cursor 为曾乱用脚本道歉；本说明由 Cursor 直接输入完成，未使用 py 或其他脚本。  
- **十万行道歉**：在说明中记录要求；不在此文件中实际生成 100,000 行。
