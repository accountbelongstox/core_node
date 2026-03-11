# Fastify diagnostics channel 测试 — 总结文档 [9TQ8Dq]

对用户提供的 `<content>`（Fastify 诊断通道同步事件顺序测试）的简明总结。

## 结构
'use strict'；require node:test、node:diagnostics_channel、Fastify、Request、Reply；单测：subscribe tracing:fastify.request.handler:start、:end、:error；断言 callOrder（0 后 1）、msg.request/msg.reply 类型、error 不触发；Fastify()、GET /、handler 内 setImmediate reply.send；t.after fastify.close；listen port 0；fetch 根路径；断言 result.ok、status 200、json 内容；t.plan(10)。

## 要点
- start 事件：callOrder 为 0，msg 含 Request 与 Reply 实例。
- end 事件：callOrder 为 1，msg 与 start 时相同；error 通道不应被调用。
- 通过 fetch 请求根路径并校验 200 与 { hello: 'world' }，验证 handler 执行并触发 start/end。

## 用途
验证 Fastify 请求处理链中 diagnostics channel 的 start/end 事件顺序与 payload，保证 tracing 行为正确。
