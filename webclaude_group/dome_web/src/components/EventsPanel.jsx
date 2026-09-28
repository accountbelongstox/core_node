/**
 * EventsPanel — 对应旧版 #eventsPanel
 *
 * 时间戳 + 颜色标签 + 事件文本
 * 标签颜色类名 1:1 对应旧版 CSS: .tag-delta, .tag-think, .tag-status, ...
 */

import { useEffect, useRef } from 'react';

/** 对应旧版 tag → CSS class 映射 */
const TAG_CLASSES = {
  delta:  'tag-delta',
  think:  'tag-think',
  status: 'tag-status',
  result: 'tag-result',
  usage:  'tag-usage',
  rl:     'tag-rl',
  error:  'tag-error',
  other:  'tag-other',
};

export default function EventsPanel({ events, active }) {
  const panelRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    if (active && panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [events, active]);

  return (
    <div className={`panel ${active ? 'active' : ''}`} ref={panelRef}>
      {events.length === 0 ? (
        <div className="empty">
          <div className="ico">&gt;_</div>
          <div>No events yet</div>
        </div>
      ) : (
        events.map((ev) => (
          <div key={ev.id} className="ev">
            {/* 对应旧版 .ev-time */}
            <span className="ev-time">
              {ev.time.toLocaleTimeString('en-US', { hour12: false })}
            </span>
            {/* 对应旧版 .ev-tag */}
            <span className={`ev-tag ${TAG_CLASSES[ev.tag] || 'tag-other'}`}>
              {ev.tag}
            </span>
            {/* 对应旧版事件文本 */}
            {ev.text}
          </div>
        ))
      )}
    </div>
  );
}
