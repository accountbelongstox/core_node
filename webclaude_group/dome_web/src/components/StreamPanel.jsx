/**
 * StreamPanel — 对应旧版 #streamPanel
 *
 * 渲染流式内容: thinking blocks, text blocks, prompt 分隔线, result bars, error blocks
 * 渲染逻辑 1:1 对应旧版 DOM 操作
 */

import { useEffect, useRef } from 'react';
import { formatNum, formatMs } from '../utils/format';

export default function StreamPanel({ items, hasContent, active }) {
  const panelRef = useRef(null);

  // 对应旧版: scrollTo bottom
  useEffect(() => {
    if (active && panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [items, active]);

  return (
    <div className={`panel ${active ? 'active' : ''}`} ref={panelRef}>
      {!hasContent ? (
        // 对应旧版 .empty 提示
        <div className="empty">
          <div className="ico">&gt;_</div>
          <div>Waiting for input...</div>
        </div>
      ) : (
        items.map((item) => {
          switch (item.type) {
            case 'thinking':
              return <ThinkBlock key={item.id} item={item} />;
            case 'text':
              return <TextBlock key={item.id} item={item} />;
            case 'prompt':
              return <PromptSep key={item.id} text={item.text} />;
            case 'result':
              return <ResultBar key={item.id} data={item.data} />;
            case 'error':
              return <ErrorBlock key={item.id} text={item.text} />;
            default:
              return null;
          }
        })
      )}
    </div>
  );
}

/** 对应旧版 think-block DOM */
function ThinkBlock({ item }) {
  return (
    <div className="think-block">
      <div className="think-label">Thinking</div>
      {item.text}
      {!item.done && <span className="cursor" />}
    </div>
  );
}

/** 对应旧版 text-block DOM */
function TextBlock({ item }) {
  return (
    <div className="text-block">
      {item.text}
      {!item.done && <span className="cursor" />}
    </div>
  );
}

/** 对应旧版 prompt-sep DOM */
function PromptSep({ text }) {
  return (
    <div className="prompt-sep">
      &gt; {text}
    </div>
  );
}

/** 对应旧版 error-block DOM */
function ErrorBlock({ text }) {
  return (
    <div className="error-block">{text}</div>
  );
}

/**
 * ResultBar — 对应旧版 result-bar DOM
 *
 * 使用与旧版 rb() helper 完全一致的字段名和格式
 */
function ResultBar({ data }) {
  // 对应旧版 rb(label, val) helper
  const rb = (label, val) => (
    <span className="rb-item">
      <span className="rb-label">{label} </span>
      <span className="rb-val">{val}</span>
    </span>
  );

  const rbToken = (label, val) => (
    <span className="rb-item">
      <span className="rb-label">{label} </span>
      <span className="rb-val token">{val}</span>
    </span>
  );

  return (
    <div className="result-bar">
      {rb('Time:', formatMs(data.durationMs))}
      {rb('API:', formatMs(data.durationApiMs))}
      {rb('Cost:', '$' + data.cost.toFixed(4))}
      {rbToken('In:', formatNum(data.input))}
      {rbToken('Out:', formatNum(data.output))}
      {rbToken('Cache R:', formatNum(data.cacheRead))}
      {rbToken('Cache W:', formatNum(data.cacheCreate))}
      {data.webSearch > 0 && rbToken('Web:', data.webSearch)}
      {rb('Turns:', data.turns)}
      {data.serviceTier && rb('Tier:', data.serviceTier)}
      {data.speed && rb('Speed:', data.speed)}
    </div>
  );
}
