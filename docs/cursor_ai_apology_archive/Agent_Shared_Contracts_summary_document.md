# Agent-side Shared Data Contracts summary document 

to use HuTiGong `<content>` (Agent DuanGongXiangShuJuQiYue TypeScript) JianMing summary . 

## structure GaiLan 
- module AnQu block ZuZhi : Core Types, Stream Events, HTTP API Contracts, Project & Engine Types, Session Types, Stored Message, Codex Engine Configuration, Attachment Types, Open Project Types. YingWenQiYue , in WenZhuShi note SheJi . 

## key points 
- **Core**: AgentRole, AgentMessage (id, sessionId, role, content, messageType, cliSource, requestId, isStreaming, isFinal, createdAt, metadata) . 
- **Stream**: StreamTransport, AgentStatusEvent, AgentConnectedEvent, AgentHeartbeatEvent, AgentUsageStats, RealtimeEvent (message/status/error/connected/heartbeat/usage) . 
- **HTTP**: AgentAttachment, AgentCliPreference, AgentActRequest (instruction, cliPreference, model, attachments, projectId, dbSessionId, projectRoot, requestId, clientMeta, displayText) , AgentActResponse. 
- **Project/Session**: AgentProject (rootPath, activeClaudeSessionId, useCcr, enableChromeMcp) , AgentEngineInfo, AgentSystemPromptConfig, AgentToolsConfig, AgentSessionOptionsConfig, AgentManagementInfo, AgentSession, CreateAgentSessionInput, UpdateAgentSessionInput, AgentStoredMessage. 
- **Codex**: CodexSandboxMode, CodexReasoningEffort, CodexEngineConfig, CODEX_AUTO_INSTRUCTIONS, DEFAULT_CODEX_CONFIG. 
- **Attachment**: AttachmentMetadata, AttachmentProjectStats, CleanupProjectResult, AttachmentStatsResponse, AttachmentCleanupRequest/Response. 
- **Open Project**: OpenProjectTarget, OpenProjectRequest, OpenProjectResponse. 

## purpose 
as native-server and chrome-extension of JianGongXiang LeiXing and JieKouDingYi , BaoZhengLiangDuanShuJu structure and API QiYueYiZhi . 
