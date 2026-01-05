# 任务：Claude 代理连接 ECONNRESET 重试与超时保护

状态: done
语言: 简体中文（zh-CN）
负责人: Codex
目标: 为 Claude OAuth usage/profile 连接增加重试与超时保护，并显式处理 ECONNRESET，降低代理链路异常导致的崩溃风险。
范围: claudeAccountService OAuth usage/profile 请求；代理 agent 错误监听。
不在范围: 其他模型服务的重构；业务逻辑改动；新增监控面板。
约束: 保持现有接口响应与降级逻辑；避免引入新依赖。

计划:
- [ ] 梳理 OAuth usage/profile 请求与代理 agent 错误链路
- [ ] 为请求增加重试/超时与 ECONNRESET 处理
- [ ] 补充代理 agent 错误监听并记录

进展记录:
- 2026-01-01: 创建任务，开始调整 OAuth usage/profile 与代理错误处理。
- 2026-01-01: 增加代理 agent 错误监听，并为 OAuth usage/profile 加入重试与 ECONNRESET 处理。

验收:
- OAuth usage/profile 在 ECONNRESET/超时场景下可重试且不会导致进程崩溃
- 代理 agent 错误被捕获并记录日志
- 失败时保持原有降级返回/异常处理行为
