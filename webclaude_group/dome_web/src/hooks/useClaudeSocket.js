/**
 * useClaudeSocket — Claude Code WebSocket 连接管理 + 消息解析
 *
 * 解析逻辑 1:1 对应旧版 index.html 中的 handleMsg() 函数。
 * 所有 case 分支、字段名、统计累加逻辑完全一致。
 */

import { useReducer, useRef, useCallback, useEffect } from 'react';

// ─── 初始状态 ──────────────────────────────────────────────

let _blockId = 0;
function nextBlockId() { return ++_blockId; }

const initialState = {
  // 连接
  wsStatus: 'disconnected', // disconnected | connected | running
  clientId: '',
  userName: '',
  userLevel: '',
  hostsOnline: 0,

  // 会话
  running: false,
  requestId: '',
  sessionId: '',
  conversationId: '',

  // 多用户: 从 welcome 消息获取默认值
  defaultUsername: '',
  defaultProjectDir: '',

  // 模型信息 — 对应旧版 modelInfo
  modelName: '',
  modelVersion: '',
  permissionMode: '',
  fastMode: '',
  contextWindow: 0,
  maxOutput: 0,

  // 流式内容 — 对应旧版 streamPanel 的 DOM 操作
  // 每项: { id, type: 'prompt'|'thinking'|'text'|'result'|'error', text/data, done }
  streamItems: [],
  hasContent: false,

  // 单次 turn 统计 — 对应旧版 turn 对象
  turn: {
    input: 0, output: 0,
    cacheRead: 0, cacheCreate: 0,
    cost: 0, durationMs: 0, durationApiMs: 0,
    turns: 0, webSearch: 0,
  },

  // 累计 session 统计 — 对应旧版 session 对象
  session: {
    input: 0, output: 0,
    cacheRead: 0, cacheCreate: 0,
    cost: 0, durationMs: 0,
    turns: 0, requests: 0,
  },

  // 速率限制 — 对应旧版 rateLimit 对象
  rateLimit: { resetsAt: 0, status: '', type: '' },

  // 事件日志 — 对应旧版 eventsPanel
  events: [],

  // 原始消息 — 对应旧版 rawPre
  rawMessages: [],
};


// ─── Reducer — 对应旧版 handleMsg() 的 switch/case ──────────

function reducer(state, action) {
  const { type, payload: m } = action;

  switch (type) {

    // ── 对应旧版 case 'welcome' ──
    case 'welcome':
      return {
        ...state,
        wsStatus: 'connected',
        clientId: m.client_id || '',
        userName: m.user || '',
        userLevel: m.level || '',
        hostsOnline: m.hosts_online || 0,
        sessionId: m.session_id || state.sessionId,
        defaultUsername: m.default_username || '',
        defaultProjectDir: m.default_project_dir || '',
      };

    // ── 对应旧版 case 'status' ──
    case 'status': {
      const s = m.status;
      const updates = {};

      if (m.session_id) updates.sessionId = m.session_id;
      if (m.request_id) updates.requestId = m.request_id;
      if (m.conversation_id) updates.conversationId = m.conversation_id;

      if (s === 'running' || s === 'starting') {
        // 对应旧版: setRunning(true); 重置 turn 统计; session.requests++
        updates.running = true;
        updates.wsStatus = 'running';
        updates.turn = {
          input: 0, output: 0, cacheRead: 0, cacheCreate: 0,
          cost: 0, durationMs: 0, durationApiMs: 0, turns: 0, webSearch: 0,
        };
        updates.session = {
          ...state.session,
          requests: state.session.requests + 1,
        };
      }

      if (s === 'finished' || s === 'stopped') {
        // 对应旧版: setRunning(false); finishBlock()
        updates.running = false;
        updates.wsStatus = 'connected';
        updates.streamItems = _finishCurrentBlock(state.streamItems);
      }

      if (s === 'new_session') {
        // 对应旧版: newSession() — 清空一切
        updates.sessionId = '';
        updates.streamItems = [];
        updates.hasContent = false;
        updates.events = [];
        updates.rawMessages = [];
        updates.turn = { ...initialState.turn };
        updates.session = { ...initialState.session };
        updates.rateLimit = { ...initialState.rateLimit };
        updates.modelName = '';
      }

      return { ...state, ...updates };
    }

    // ── 对应旧版 case 'system' ──
    case 'system':
      return {
        ...state,
        sessionId: m.session_id || state.sessionId,
        modelName: m.model || state.modelName,
        modelVersion: m.version || state.modelVersion,
        permissionMode: m.permission_mode || state.permissionMode,
        fastMode: m.fast_mode || state.fastMode,
      };

    // ── 对应旧版 case 'block_start' ──
    case 'block_start': {
      // 对应旧版: finishBlock(); 创建 think-block 或 text-block
      const items = _finishCurrentBlock(state.streamItems);
      items.push({
        id: nextBlockId(),
        type: m.block_type === 'thinking' ? 'thinking' : 'text',
        text: '',
        done: false,
        index: m.index,
      });
      return { ...state, streamItems: items, hasContent: true };
    }

    // ── 对应旧版 case 'delta' ──
    case 'delta': {
      // 对应旧版: if (!m.text || m.delta_type === 'signature_delta') break;
      if (!m.text || m.delta_type === 'signature_delta') return state;

      const items = [...state.streamItems];
      const lastIdx = items.length - 1;

      if (lastIdx >= 0 && !items[lastIdx].done
          && (items[lastIdx].type === 'thinking' || items[lastIdx].type === 'text')) {
        // 对应旧版: currentBlock.appendChild(document.createTextNode(m.text))
        items[lastIdx] = {
          ...items[lastIdx],
          text: items[lastIdx].text + m.text,
        };
      } else {
        // 对应旧版: if (!currentBlock) 创建 text-block
        items.push({
          id: nextBlockId(),
          type: 'text',
          text: m.text,
          done: false,
          index: m.index,
        });
      }

      return { ...state, streamItems: items, hasContent: true };
    }

    // ── 对应旧版 case 'block_stop' ──
    case 'block_stop':
      return { ...state, streamItems: _finishCurrentBlock(state.streamItems) };

    // ── 对应旧版 case 'usage' ──
    case 'usage': {
      const turn = { ...state.turn };
      const session = { ...state.session };

      if (m.phase === 'start') {
        // 对应旧版: turn.input = m.input_tokens; etc.
        turn.input = m.input_tokens;
        turn.cacheRead = m.cache_read;
        turn.cacheCreate = m.cache_create;
      } else {
        // 对应旧版: turn.output = m.output_tokens
        turn.output = m.output_tokens;
      }

      // 对应旧版: session 累计
      session.input += m.input_tokens || 0;
      if (m.phase === 'end') {
        session.output += m.output_tokens || 0;
      }
      session.cacheRead += m.cache_read || 0;
      session.cacheCreate += m.cache_create || 0;

      return { ...state, turn, session };
    }

    // ── 对应旧版 case 'assistant' ──
    case 'assistant':
      // 对应旧版: addEvent('other', 'assistant complete') — 仅日志
      return state;

    // ── 对应旧版 case 'result' ──
    case 'result': {
      const items = _finishCurrentBlock(state.streamItems);
      const mu = m.model_usage || {};

      // 对应旧版: 更新 turn 统计
      const turn = {
        input:      mu.input_tokens  || state.turn.input,
        output:     mu.output_tokens || state.turn.output,
        cacheRead:  mu.cache_read    || state.turn.cacheRead,
        cacheCreate: mu.cache_create || state.turn.cacheCreate,
        cost:       mu.cost_usd      || m.cost_usd || 0,
        durationMs: m.duration_ms    || 0,
        durationApiMs: m.duration_api_ms || 0,
        turns:      m.num_turns      || 0,
        webSearch:  mu.web_search    || 0,
      };

      // 对应旧版: 累计 session
      const session = {
        ...state.session,
        cost: state.session.cost + turn.cost,
        durationMs: state.session.durationMs + turn.durationMs,
        turns: state.session.turns + turn.turns,
      };

      // 对应旧版: 显示结果条 (result-bar DOM)
      items.push({
        id: nextBlockId(),
        type: 'result',
        data: {
          durationMs: turn.durationMs,
          durationApiMs: turn.durationApiMs,
          cost: turn.cost,
          input: turn.input,
          output: turn.output,
          cacheRead: turn.cacheRead,
          cacheCreate: turn.cacheCreate,
          webSearch: turn.webSearch,
          turns: turn.turns,
          serviceTier: m.service_tier || '',
          speed: m.speed || '',
        },
        done: true,
      });

      return {
        ...state,
        streamItems: items,
        turn, session,
        sessionId: m.session_id || state.sessionId,
        contextWindow: mu.context_window || state.contextWindow,
        maxOutput: mu.max_output || state.maxOutput,
      };
    }

    // ── 对应旧版 case 'rate_limit' ──
    case 'rate_limit':
      return {
        ...state,
        rateLimit: {
          resetsAt: m.resets_at || 0,
          status: m.status || '',
          type: m.rate_limit_type || '',
        },
      };

    // ── 对应旧版 case 'error' ──
    case 'error': {
      const items = [...state.streamItems];
      items.push({
        id: nextBlockId(),
        type: 'error',
        text: m.message || 'Unknown error',
        done: true,
      });
      return { ...state, streamItems: items, hasContent: true };
    }

    // ── 对应旧版 case 'stderr' ──
    case 'stderr': {
      const items = [...state.streamItems];
      items.push({
        id: nextBlockId(),
        type: 'error',
        text: 'stderr: ' + (m.text || ''),
        done: true,
      });
      return { ...state, streamItems: items, hasContent: true };
    }

    // ── 对应旧版 case 'message_stop' — no-op ──
    case 'message_stop':
      return state;

    // ── 事件日志追加 ──
    case '_add_event': {
      const events = [...state.events, m];
      // 保留最近 500 条防止内存泄漏 (旧版无此限制, 这是改进)
      if (events.length > 500) events.splice(0, events.length - 500);
      return { ...state, events };
    }

    // ── 原始消息追加 ──
    case '_add_raw': {
      const rawMessages = [...state.rawMessages, m];
      if (rawMessages.length > 500) rawMessages.splice(0, rawMessages.length - 500);
      return { ...state, rawMessages };
    }

    // ── 发送 prompt 时添加分隔线 ──
    case '_add_prompt': {
      const items = [...state.streamItems];
      items.push({
        id: nextBlockId(),
        type: 'prompt',
        text: m.text,
        done: true,
      });
      return { ...state, streamItems: items, hasContent: true };
    }

    // ── 清空 (新会话) ──
    case '_reset':
      _blockId = 0;
      return { ...initialState };

    // ── 状态响应 ──
    case 'status_response':
      return { ...state, hostsOnline: m.hosts_online || state.hostsOnline };

    default:
      return state;
  }
}

/** 对应旧版 finishBlock() — 标记最后一个未完成的 block 为 done */
function _finishCurrentBlock(items) {
  if (items.length === 0) return items;
  const last = items[items.length - 1];
  if (!last.done && (last.type === 'thinking' || last.type === 'text')) {
    const copy = [...items];
    copy[copy.length - 1] = { ...last, done: true };
    return copy;
  }
  return items;
}

// ─── 事件类型 → 日志标签 (对应旧版 addEvent 的 type 参数) ──

const EVENT_TAGS = {
  status: 'status',
  system: 'other',
  block_start: 'other',
  delta: 'delta',
  block_stop: 'other',
  usage: 'usage',
  assistant: 'other',
  result: 'result',
  rate_limit: 'rl',
  error: 'error',
  stderr: 'error',
  welcome: 'status',
  message_stop: 'other',
  status_response: 'status',
  command_response: 'other',
};


// ─── Hook ───────────────────────────────────────────────────

export default function useClaudeSocket() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef(null);
  const reconnectDelayRef = useRef(2000);
  const reconnectTimerRef = useRef(null);
  const configRef = useRef({ url: '', key: '' });

  /** 添加事件日志 — 对应旧版 addEvent() */
  const addEvent = useCallback((tag, text) => {
    dispatch({
      type: '_add_event',
      payload: {
        id: Date.now() + Math.random(),
        time: new Date(),
        tag,
        text: String(text),
      },
    });
  }, []);

  /** 处理收到的消息 — 对应旧版 handleMsg() */
  const handleMessage = useCallback((data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }

    // 对应旧版: rawPre.textContent += JSON.stringify(m) + '\n'
    dispatch({ type: '_add_raw', payload: m });

    const type = m.type || '';

    // 分发到 reducer
    dispatch({ type, payload: m });

    // 对应旧版: addEvent() 调用
    const tag = EVENT_TAGS[type] || 'other';
    switch (type) {
      case 'welcome':
        addEvent('status', `connected as ${m.user || m.client_id}`);
        break;
      case 'status':
        addEvent('status', m.status + (m.prompt ? ': ' + m.prompt : ''));
        break;
      case 'system':
        addEvent('other', `model=${m.model} v${m.version}`);
        break;
      case 'usage':
        addEvent('usage', `${m.phase} in=${m.input_tokens} out=${m.output_tokens} cr=${m.cache_read} cw=${m.cache_create}`);
        break;
      case 'assistant':
        addEvent('other', 'assistant complete');
        break;
      case 'result':
        addEvent('result', `${m.duration_ms}ms $${(m.cost_usd || 0).toFixed(4)} in=${m.model_usage?.input_tokens || 0} out=${m.model_usage?.output_tokens || 0}`);
        break;
      case 'rate_limit':
        addEvent('rl', `${m.status} | ${m.rate_limit_type} | resets=${new Date((m.resets_at || 0) * 1000).toLocaleTimeString()} | overage=${m.overage_status}`);
        break;
      case 'error':
        addEvent('error', m.message);
        break;
      case 'stderr':
        addEvent('error', 'stderr: ' + m.text);
        break;
      default:
        if (type && type !== 'message_stop' && type !== 'delta' && type !== 'block_start' && type !== 'block_stop') {
          addEvent(tag, type);
        }
    }
  }, [addEvent]);

  /** 连接 WebSocket */
  const connect = useCallback((url, key) => {
    // 断开旧连接
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    configRef.current = { url, key };
    const wsUrl = `${url}/client?key=${encodeURIComponent(key)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelayRef.current = 2000;
        dispatch({ type: 'welcome', payload: { wsStatus: 'connected' } });
      };

      ws.onmessage = (e) => handleMessage(e.data);

      ws.onclose = () => {
        wsRef.current = null;
        dispatch({ type: '_reset' });
        addEvent('status', 'disconnected');
        // 对应旧版: setTimeout(connect, 2000) — 但改用指数退避
        if (configRef.current.url) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 60000);
            connect(configRef.current.url, configRef.current.key);
          }, reconnectDelayRef.current);
        }
      };

      ws.onerror = () => ws.close();
    } catch (err) {
      addEvent('error', `Connection failed: ${err.message}`);
    }
  }, [handleMessage, addEvent]);

  /** 断开连接 */
  const disconnect = useCallback(() => {
    configRef.current = { url: '', key: '' };
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    dispatch({ type: '_reset' });
  }, []);

  /** 发送消息 */
  const send = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  /** 发送 prompt — 对应旧版 send() */
  const sendPrompt = useCallback((prompt, opts = {}) => {
    if (!prompt.trim()) return;
    if (state.running) return;

    // 对应旧版: 添加 prompt 分隔线
    if (state.hasContent) {
      dispatch({ type: '_add_prompt', payload: { text: prompt } });
    }

    send({
      action: 'run',
      prompt,
      effort: opts.effort || '',
      model: opts.model || '',
      conversation_id: opts.conversationId || state.conversationId || '',
      username: opts.username || '',
      project_dir: opts.projectDir || '',
    });
  }, [send, state.running, state.hasContent, state.conversationId]);

  /** 停止 — 对应旧版 doStop() */
  const stop = useCallback(() => {
    send({ action: 'stop', request_id: state.requestId });
  }, [send, state.requestId]);

  /** 新会话 — 对应旧版 newSession() */
  const newSession = useCallback(() => {
    dispatch({ type: 'status', payload: { status: 'new_session' } });
    addEvent('status', 'new session');
  }, [addEvent]);

  // 清理
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return {
    state,
    connect,
    disconnect,
    sendPrompt,
    stop,
    newSession,
  };
}
