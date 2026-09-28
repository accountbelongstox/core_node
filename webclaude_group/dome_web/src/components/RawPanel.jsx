/**
 * RawPanel — 对应旧版 #rawPre
 *
 * 显示原始 JSON 消息，每条一行
 * 对应旧版: rawPre.textContent += JSON.stringify(m) + '\n'
 */

import { useEffect, useRef } from 'react';

export default function RawPanel({ messages, active }) {
  const panelRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    if (active && panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [messages, active]);

  return (
    <div className={`panel ${active ? 'active' : ''}`} ref={panelRef}>
      {messages.length === 0 ? (
        <div className="empty">
          <div className="ico">{'{}'}</div>
          <div>No messages yet</div>
        </div>
      ) : (
        <pre className="raw-pre">
          {messages.map((m, i) => JSON.stringify(m) + '\n').join('')}
        </pre>
      )}
    </div>
  );
}
