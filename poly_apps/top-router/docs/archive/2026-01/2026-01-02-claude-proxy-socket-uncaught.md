# Task: Claude 代理 TLS socket 未捕获异常排查与修复

Status: done
Language: Simplified Chinese (zh-CN)
Owner: Codex
Goal: 处理 Claude 代理连接在 TLS 握手阶段的 socket 错误，避免 uncaughtException 导致进程退出。
Scope: claudeRelayService 非流式/流式请求的 socket 错误处理；必要的日志补充。
Out of scope: 代理服务可用性保障；业务逻辑调整；新增监控告警。
Constraints: 保持现有请求/响应行为；避免引入新依赖；不扩大重试范围。

Plan:
- [ ] 定位触发 uncaughtException 的请求路径与错误来源
- [ ] 增加 socket 错误监听与安全处理
- [ ] 记录变更与结论

Progress Log:
- 2026-01-02: 创建任务，开始分析 TLS socket 未捕获异常。
- 2026-01-02: 为 Claude 请求添加 socket 错误监听并触发请求错误处理。

Acceptance:
- 代理 TLS 握手失败时不再触发 uncaughtException
- 相关请求仍按既有错误处理流程返回
