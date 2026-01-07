# Task: 扩展CCR到所有模型服务

Status: done
Language: Simplified Chinese (zh-CN)
Owner: 待定
Goal: 将CCR能力覆盖到所有模型服务
Scope:
- 盘点当前已支持CCR的模型服务与缺口
- 明确需要扩展的模型服务清单与接口差异
- 设计并实现通用或适配层以支持CCR
- 回归验证关键调用链与监控
Out of scope:
- 重构非CCR相关的模型服务
- 新增与CCR无关的功能
Constraints:
- 保持现有接口兼容
- 不影响现有生产流量稳定性

Plan:
- [ ] 梳理当前CCR支持范围与缺口
- [ ] 列出全部模型服务并标注适配方式
- [ ] 设计扩展方案并评审
- [ ] 实现扩展与必要的适配
- [ ] 回归测试与文档更新

Progress Log:
- 2025-12-24: 创建任务条目。
- 2025-12-24: 开始处理 CCR 扩展问题。
- 2025-12-24: 已在 OpenAI/Gemini 调度与路由中接入 CCR 选择与转发处理。
- 2025-12-24: 补充 CCR 账户 supportedModels 配置位置文档。
- 2025-12-24: CCR 扩展任务完成，准备归档。

Acceptance:
- CCR在所有模型服务可用且通过回归验证
- 相关文档更新完成
