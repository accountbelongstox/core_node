import { useState, useCallback } from 'react';
import useClaudeSocket from './hooks/useClaudeSocket';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import InputBar from './components/InputBar';
import StreamPanel from './components/StreamPanel';
import EventsPanel from './components/EventsPanel';
import RawPanel from './components/RawPanel';

/**
 * App — 主组件
 *
 * 对应旧版 index.html 的整体结构:
 *   header → statsBar → input-bar → tabs → panels
 */
export default function App() {
  // 对应旧版 tabs 逻辑
  const [activeTab, setActiveTab] = useState('stream');

  // 连接配置
  const [gatewayUrl, setGatewayUrl] = useState(
    import.meta.env.VITE_GATEWAY_URL || 'ws://localhost:18200'
  );
  const [apiKey, setApiKey] = useState(
    import.meta.env.VITE_API_KEY || ''
  );

  const {
    state, connect, disconnect, sendPrompt, stop, newSession,
  } = useClaudeSocket();

  const handleConnect = useCallback(() => {
    if (state.wsStatus !== 'disconnected') {
      disconnect();
    } else {
      connect(gatewayUrl, apiKey);
    }
  }, [state.wsStatus, gatewayUrl, apiKey, connect, disconnect]);

  const isConnected = state.wsStatus !== 'disconnected';

  return (
    <div className="app">
      <Header
        wsStatus={state.wsStatus}
        sessionId={state.sessionId}
        modelName={state.modelName}
        modelVersion={state.modelVersion}
        permissionMode={state.permissionMode}
        fastMode={state.fastMode}
        userName={state.userName}
        gatewayUrl={gatewayUrl}
        apiKey={apiKey}
        onGatewayUrlChange={setGatewayUrl}
        onApiKeyChange={setApiKey}
        onConnect={handleConnect}
        isConnected={isConnected}
      />

      <StatsBar
        turn={state.turn}
        session={state.session}
        rateLimit={state.rateLimit}
        contextWindow={state.contextWindow}
      />

      <InputBar
        onSend={sendPrompt}
        onStop={stop}
        onNew={newSession}
        running={state.running}
        isConnected={isConnected}
        defaultUsername={state.defaultUsername}
        defaultProjectDir={state.defaultProjectDir}
      />

      {/* 对应旧版 .tabs */}
      <div className="tabs">
        {['stream', 'events', 'raw'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* 对应旧版 .panels */}
      <div className="panels">
        <StreamPanel
          items={state.streamItems}
          hasContent={state.hasContent}
          active={activeTab === 'stream'}
        />
        <EventsPanel
          events={state.events}
          active={activeTab === 'events'}
        />
        <RawPanel
          messages={state.rawMessages}
          active={activeTab === 'raw'}
        />
      </div>
    </div>
  );
}
