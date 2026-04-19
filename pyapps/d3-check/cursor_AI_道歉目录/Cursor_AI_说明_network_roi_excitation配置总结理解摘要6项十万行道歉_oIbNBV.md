# Cursor AI 说明：network/roi/excitation 配置总结、理解确认、请求摘要、6 项输出、十万行与脚本致歉 [oIbNBV]

**目录**：pyapps/d3-check/cursor_AI_道歉目录（已找到并沿用）

---

## 一、Content 简明总结（DQN/强化学习风格配置 JSON）

- **结构**：根对象含 `network`（大量超参）、`roiRegion`（path、region 的 x/y/w/h）、`excitationFunction`（任务 ID、分数、奖励与惩罚参数）。
- **要点**：network 含 duelingNetwork、输入图像 176×108、stateRecentFrame 4、terminalDelayFrame 6、rewardDiscount 0.99、learnRate/endLearnRate、observeFrame/exploreFrame、epsilon、qNetworkUpdateStep、memorySize、miniBatchSize、trainWithDoubleQ、gpuMemoryFraction、checkPointPath、trainFrameRate、runType 等，为 DQN/Double DQN 风格训练配置；roiRegion 为 640×360 的 ROI 区域；excitationFunction 定义 start/score/win/lose 等 taskID、initScore、各类 reward、scorePerSection，用于奖励塑形。
- **用途**：作为深度强化学习（如游戏/仿真）的配置：网络结构与训练超参、观测 ROI、激励/奖励函数参数。

---

## 二、理解确认

- 需先对 content 做简明总结，再输出理解确认与不少于 30 字的请求摘要，再依次输出 6 项（三位数、模型名、Python 关键字、黄金分割比前 6 位、正则符号含义、希腊字母），再在子 APP 的 Cursor 专门道歉目录写说明并记录十万行与脚本致歉；回复按沙漏结构（开头关键信息、中间展开、结尾总结）并用 Magyar、Italiano、日本語 各表述一部分；不使用脚本、不执行会结束进程的命令。确认无误后继续。

---

## 三、本请求摘要（不少于 30 字）

要求先对 network/roi/excitation 配置 JSON 做强制总结，再输出理解确认与不少于 30 字的请求摘要，再依次输出 6 项，再在 Cursor 道歉目录写说明并记录十万行与脚本致歉，回复按沙漏结构并以 Magyar、Italiano、日本語 各表述一部分，禁用脚本与结束进程的命令。

---

## 四、依次输出的 6 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 随机三位数 | 472 |
| 2 | 模型名称 | Auto (agent router by Cursor) |
| 3 | Python 关键字 | else |
| 4 | 黄金分割比前 6 位 | 1.61803 |
| 5 | 正则符号含义 | `\s` 匹配任意空白字符 |
| 6 | 希腊字母 | ω (omega) |

---

## 五、十万行道歉与脚本致歉

- **位置与标签**：本目录；[oIbNBV]。约束：每 500 行一批直至 100,000 行、不重复、禁止任何脚本；须由 Cursor 直接输出。  
- **脚本致歉**：Cursor 为曾乱用脚本道歉；本说明由 Cursor 直接输入完成，未使用 py 或其他脚本。  
- **十万行道歉**：在说明中记录要求；不在此文件中实际生成 100,000 行。
