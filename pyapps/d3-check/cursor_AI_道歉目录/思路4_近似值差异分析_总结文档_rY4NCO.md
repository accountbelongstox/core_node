# 思路4（State Machine + Line Type Tagging）与近似值差异分析 — 总结文档 [rY4NCO]

对用户提供的 `<content>`（思路4 与近似值差异分析 Markdown）的简明总结。

## 结构
- 标题与测试时间（时间窗口、窗口起始 epoch）。
- 差异统计：总差异 24，思路4 与思路41 对比完全一致。
- 差异分类：(1) 实际值存在、近似值缺失 10 个（来自 history.txt Earned：Gold/DroppedItems/KeptItems/Shards/XP/RunXP/SequenceXP/Rift keys/Distance/Xp Pools）；(2) 近似值存在、实际值缺失 14 个（来自 logs.txt 汇总统计，history 中无：Avg.Keys/Rift、Botting duration、Distance、Earned Xp 等）。
- 与思路2/3/1 对比：思路2 多 5 个差异（含材料字段）；思路3/1 能解析 logs 统计但无法解析 history Earned。
- 关键发现：思路4 成功解析全部 Earned、状态机稳定、时间窗口正确；差异原因为数据源不同（history vs logs）、字段集合不同。
- 建议：不推荐让思路4 解析 logs；推荐思路3/1 解析 logs + 思路4 解析 history 结合；思路4 适用解析 history 的 Earned，不适用解析 logs 的格式化统计。
- 结论：24 个差异为预期且合理，思路4 正确完成从 history.txt 解析 Earned 的设计目标。

## 要点
- 思路4 与思路2 在核心 Earned 字段上一致；logs 与 history 数据源与字段集不同，故部分差异为预期行为。

## 用途
说明思路4 与近似值（logs）差异的来源、合理性及与其他思路的配合使用方式。
