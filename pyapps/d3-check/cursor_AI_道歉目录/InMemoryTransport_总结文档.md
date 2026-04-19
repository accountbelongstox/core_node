# InMemoryTransport — 总结文档

对用户提供的 `<content>`（InMemoryTransport 类）的简明总结。

## 结构
- ES class InMemoryTransport：constructor 初始化 _messageQueue；静态 createLinkedPair() 返回一对互相 _otherTransport 的实例；start() 清空队列并依次 onmessage；close() 清空 _otherTransport 并 await other?.close()、onclose；send(message, options) 若对端有 onmessage 则直接调用否则入队，支持 options.authInfo。末尾 sourceMappingURL。

## 要点
- **用途**：同一进程内 Client/Server 通信，无需真实网络。
- **createLinkedPair**：返回 [clientTransport, serverTransport]，分别传给 Client 与 Server。
- **消息流**：send 时对端有 onmessage 则同步调用，否则 push 到 _messageQueue；start 时按序处理队列中的消息。
- **close**：置空 _otherTransport，对端 close 后触发 onclose，便于成对关闭。

## 用途
在测试或单进程架构中提供内存传输，用于验证认证、消息协议等，无需起网络服务。
