# Task: 修复 CCR OpenAI/Gemini 用量与费用记录缺失

Status: done
Language: Simplified Chinese (zh-CN)
Owner:
Goal: 找出 CCR 走 OpenAI/Gemini 时用量/费用记录缺失的原因并修复。
Scope:
- 定位 CCR 在 OpenAI/Gemini 路由的用量采集与记录缺口
- 修复流式/非流式用量解析差异
- 补充必要的日志/注释
Out of scope:
- 改动非 CCR 的用量统计逻辑
- 引入新的计费模型或价格表
Constraints:
- 保持现有接口与响应格式兼容

Plan:
- [ ] 复核 CCR OpenAI/Gemini 路由的用量采集路径
- [ ] 修补用量解析缺口并确保记录触发
- [ ] 更新任务日志与状态

Progress Log:
- 2025-12-25: 创建任务，开始排查 CCR OpenAI/Gemini 用量记录缺失原因。
- 2025-12-25: 修补 CCR OpenAI/Gemini 流式用量解析，补齐 response/usageMetadata 兼容。
- 2025-12-25: 测试确认修复完成。

Acceptance:
- CCR 走 OpenAI/Gemini 的用量与费用可被正常记录
- 不影响原有非 CCR 请求链路
