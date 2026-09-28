/**
 * StatsBar — 对应旧版 .stats-bar 部分
 *
 * 显示 Turn / Session 统计和速率限制倒计时
 */

import { useState, useEffect } from 'react';
import { formatNum, formatMs } from '../utils/format';

export default function StatsBar({ turn, session, rateLimit, contextWindow }) {
  return (
    <div className="stats-bar">
      {/* ── Turn 统计 — 对应旧版 Turn 组 ── */}
      <span className="stat-title">Turn</span>
      <div className="stat-group">
        <span><span className="label">In:</span> <span className="val">{formatNum(turn.input)}</span></span>
        <span><span className="label">Out:</span> <span className="val">{formatNum(turn.output)}</span></span>
        <span><span className="label">Cache R:</span> <span className="val">{formatNum(turn.cacheRead)}</span></span>
        <span><span className="label">Cache W:</span> <span className="val">{formatNum(turn.cacheCreate)}</span></span>
        <span><span className="label">Cost:</span> <span className="val cost">${turn.cost.toFixed(4)}</span></span>
        <span><span className="label">Time:</span> <span className="val">{formatMs(turn.durationMs)}</span></span>
        <span><span className="label">API:</span> <span className="val">{formatMs(turn.durationApiMs)}</span></span>
        <span><span className="label">Turns:</span> <span className="val">{turn.turns}</span></span>
        {turn.webSearch > 0 && (
          <span><span className="label">Web:</span> <span className="val">{turn.webSearch}</span></span>
        )}
      </div>

      <div className="stat-divider" />

      {/* ── Session 统计 — 对应旧版 Session 组 ── */}
      <span className="stat-title">Session</span>
      <div className="stat-group">
        <span><span className="label">In:</span> <span className="val">{formatNum(session.input)}</span></span>
        <span><span className="label">Out:</span> <span className="val">{formatNum(session.output)}</span></span>
        <span><span className="label">Cost:</span> <span className="val cost">${session.cost.toFixed(4)}</span></span>
        <span><span className="label">Reqs:</span> <span className="val">{session.requests}</span></span>
        <span><span className="label">Turns:</span> <span className="val">{session.turns}</span></span>
        <span><span className="label">Time:</span> <span className="val">{formatMs(session.durationMs)}</span></span>
      </div>

      {/* 对应旧版 context window % */}
      {contextWindow > 0 && (
        <>
          <div className="stat-divider" />
          <div className="stat-group">
            <span>
              <span className="label">Ctx:</span>{' '}
              <span className={`val ${contextWindow > 80 ? 'hot' : contextWindow > 50 ? 'warn' : ''}`}>
                {contextWindow}%
              </span>
            </span>
          </div>
        </>
      )}

      {/* ── 速率限制 — 对应旧版 rate-limit-box ── */}
      <RateLimitBox rateLimit={rateLimit} />
    </div>
  );
}

/** 速率限制倒计时 — 对应旧版 updateRL() 的 setInterval 逻辑 */
function RateLimitBox({ rateLimit }) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!rateLimit.resetsAt) {
      setCountdown('');
      return;
    }

    const update = () => {
      const diff = rateLimit.resetsAt * 1000 - Date.now();
      if (diff <= 0) {
        setCountdown('now');
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdown(`${m}:${String(s).padStart(2, '0')}`);
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [rateLimit.resetsAt]);

  if (!rateLimit.resetsAt) return null;

  const isWarn = rateLimit.status === 'warning' || rateLimit.status === 'limited';

  return (
    <div className="rate-limit-box">
      <span className="rl-label">Rate Limit:</span>
      <span className="rl-time">{countdown}</span>
      <span className={`rl-status ${isWarn ? 'rl-warn' : 'rl-ok'}`}>
        {rateLimit.status || 'ok'}
      </span>
    </div>
  );
}
