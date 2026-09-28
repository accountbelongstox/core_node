/**
 * 格式化工具 — 对应旧版 index.html 中的 num() 和 fmt_ms()
 */

/** 数字千分位格式化 — 对应旧版 num() */
export function formatNum(n) {
  return (n || 0).toLocaleString();
}

/** 毫秒格式化 — 对应旧版 fmt_ms() */
export function formatMs(ms) {
  if (!ms) return '0ms';
  return ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms';
}

/** 时间戳格式化为 HH:MM:SS */
export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-US', { hour12: false });
}

/** 转义 HTML 特殊字符 — 对应旧版 esc() */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
