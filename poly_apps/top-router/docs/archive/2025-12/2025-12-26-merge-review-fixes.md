# 任务: 合并结果问题修复（1.1.246）

状态: done
语言: 简体中文（zh-CN）
负责人:
目标: 修复合并检查中发现的 CCR 调度、Gemini contents 处理和公开统计性能问题。
范围:
- 修复 unifiedGeminiScheduler CCR 池参数传递
- 修复 /v1/chat/completions 对 Gemini contents/messages 的兼容
- 替换 public-stats 中的 KEYS 调用
不在范围:
- 其他合并后行为调整
- 新增功能或 UI 改动
约束:
- 以 1.1.246 为基线
- 按问题逐项处理，优先最小改动

计划:
- [ ] 修复 CCR includeCcr 选项传递
- [ ] 修复 Gemini contents/messages 兼容处理
- [ ] 替换 public-stats 中的 KEYS 调用
- [ ] 更新文档索引与归档

进展记录:
- 2025-12-26: 创建任务并开始处理
- 2025-12-26: 修复 CCR includeCcr、Gemini contents 兼容与 public-stats 扫描

验收:
- CCR_POOL_MODE include/fallback 能正确引入 CCR 账户
- /v1/chat/completions 在 contents 输入时不丢失内容
- public-stats 不再使用 KEYS
