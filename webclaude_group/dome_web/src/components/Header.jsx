/**
 * Header — 对应旧版 <header> 部分
 *
 * 显示标题、连接状态 badge、会话/模型信息、连接表单
 */

export default function Header({
  wsStatus, sessionId, modelName, modelVersion,
  permissionMode, fastMode, userName,
  gatewayUrl, apiKey, onGatewayUrlChange, onApiKeyChange,
  onConnect, isConnected,
}) {
  // 对应旧版 badge 逻辑
  const statusClass =
    wsStatus === 'running' ? 'busy' :
    wsStatus === 'connected' ? 'ok' : 'off';
  const statusText =
    wsStatus === 'running' ? 'Running' :
    wsStatus === 'connected' ? 'Connected' : 'Disconnected';

  return (
    <header>
      <h1>Claude Code Monitor</h1>

      {/* 对应旧版 #statusBadge */}
      <span className={`badge ${statusClass}`}>{statusText}</span>

      {/* 对应旧版 #sessionBadge */}
      {sessionId && (
        <span className="badge" title={sessionId}>
          Session: {sessionId.slice(0, 8)}
        </span>
      )}

      {/* 对应旧版 #modelBadge */}
      {modelName && (
        <span className="badge">
          {modelName}{modelVersion ? ` v${modelVersion}` : ''}
        </span>
      )}

      {permissionMode && (
        <span className="badge">{permissionMode}</span>
      )}

      {fastMode && (
        <span className="badge">fast</span>
      )}

      {userName && (
        <span className="badge">{userName}</span>
      )}

      <div className="spacer" />

      {/* 对应旧版连接表单 */}
      <div className="connect-bar">
        <input
          type="text"
          value={gatewayUrl}
          onChange={(e) => onGatewayUrlChange(e.target.value)}
          placeholder="ws://host:port"
          disabled={isConnected}
        />
        <input
          className="key-input"
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="API Key"
          disabled={isConnected}
        />
        <button
          className={`btn-connect ${isConnected ? 'connected' : ''}`}
          onClick={onConnect}
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
    </header>
  );
}
