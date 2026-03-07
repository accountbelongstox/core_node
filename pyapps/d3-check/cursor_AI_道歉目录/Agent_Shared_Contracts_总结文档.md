# Agent-side Shared Data Contracts 总结文档

对用户提供的 `<content>`（Agent 端共享数据契约 TypeScript）的简明总结。

## 结构概览
- 模块按区块组织：Core Types、Stream Events、HTTP API Contracts、Project & Engine Types、Session Types、Stored Message、Codex Engine Configuration、Attachment Types、Open Project Types。英文契约，中文注释说明设计。

## 要点
- **Core**：AgentRole、AgentMessage（id、sessionId、role、content、messageType、cliSource、requestId、isStreaming、isFinal、createdAt、metadata）。
- **Stream**：StreamTransport、AgentStatusEvent、AgentConnectedEvent、AgentHeartbeatEvent、AgentUsageStats、RealtimeEvent（message/status/error/connected/heartbeat/usage）。
- **HTTP**：AgentAttachment、AgentCliPreference、AgentActRequest（instruction、cliPreference、model、attachments、projectId、dbSessionId、projectRoot、requestId、clientMeta、displayText）、AgentActResponse。
- **Project/Session**：AgentProject（rootPath、activeClaudeSessionId、useCcr、enableChromeMcp）、AgentEngineInfo、AgentSystemPromptConfig、AgentToolsConfig、AgentSessionOptionsConfig、AgentManagementInfo、AgentSession、CreateAgentSessionInput、UpdateAgentSessionInput、AgentStoredMessage。
- **Codex**：CodexSandboxMode、CodexReasoningEffort、CodexEngineConfig、CODEX_AUTO_INSTRUCTIONS、DEFAULT_CODEX_CONFIG。
- **Attachment**：AttachmentMetadata、AttachmentProjectStats、CleanupProjectResult、AttachmentStatsResponse、AttachmentCleanupRequest/Response。
- **Open Project**：OpenProjectTarget、OpenProjectRequest、OpenProjectResponse。

## 用途
作为 native-server 与 chrome-extension 之间共享的类型与接口定义，保证两端数据结构与 API 契约一致。
