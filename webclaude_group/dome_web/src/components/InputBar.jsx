/**
 * InputBar — 对应旧版 .input-bar 部分
 *
 * 输入框 + effort 选择器 + 用户名/项目目录 + Run/Stop/New 按钮
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export default function InputBar({
  onSend, onStop, onNew, running, isConnected,
  defaultUsername, defaultProjectDir,
}) {
  const [prompt, setPrompt] = useState('');
  const [effort, setEffort] = useState('');
  const [model, setModel] = useState('');
  const [username, setUsername] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const textareaRef = useRef(null);

  // 从 welcome 消息获取默认值 (仅首次)
  useEffect(() => {
    if (defaultUsername && !username) setUsername(defaultUsername);
  }, [defaultUsername]);
  useEffect(() => {
    if (defaultProjectDir && !projectDir) setProjectDir(defaultProjectDir);
  }, [defaultProjectDir]);

  // 对应旧版 Ctrl+Enter 发送逻辑
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!running && prompt.trim() && isConnected) {
        onSend(prompt, { effort, model, username, projectDir });
        setPrompt('');
      }
    }
  }, [prompt, effort, model, username, projectDir, running, isConnected, onSend]);

  const handleSend = useCallback(() => {
    if (!running && prompt.trim() && isConnected) {
      onSend(prompt, { effort, model, username, projectDir });
      setPrompt('');
    }
  }, [prompt, effort, model, username, projectDir, running, isConnected, onSend]);

  return (
    <div className="input-bar">
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter prompt... (Ctrl+Enter to send)"
        disabled={!isConnected}
        rows={2}
      />

      {/* 用户名 + 项目目录 */}
      <div className="input-bar-opts">
        <input
          className="input-small"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          disabled={!isConnected}
          title="Host system username"
        />
        <input
          className="input-small input-wide"
          type="text"
          value={projectDir}
          onChange={(e) => setProjectDir(e.target.value)}
          placeholder="Project dir"
          disabled={!isConnected}
          title="Project working directory on host"
        />

        {/* Model selector */}
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!isConnected}
          title="Model"
        >
          <option value="">Model (default)</option>
          <option value="claude-opus-4-6">Opus 4.6</option>
          <option value="claude-sonnet-4-6">Sonnet 4.6</option>
          <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
        </select>

        {/* Effort selector */}
        <select
          value={effort}
          onChange={(e) => setEffort(e.target.value)}
          disabled={!isConnected}
        >
          <option value="">Effort (default)</option>
          <option value="min">Min</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="max">Max (Think)</option>
        </select>
      </div>

      {/* 对应旧版 Run / Stop / New 按钮 */}
      {running ? (
        <button className="btn btn-stop" onClick={onStop}>Stop</button>
      ) : (
        <button
          className="btn btn-run"
          onClick={handleSend}
          disabled={!isConnected || !prompt.trim()}
        >
          Run
        </button>
      )}

      <button
        className="btn btn-new"
        onClick={onNew}
        disabled={!isConnected || running}
      >
        New
      </button>
    </div>
  );
}
