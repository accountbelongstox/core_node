/** Lightweight syntax tint for pretty-printed JSON (no editor needed). */
import React from 'react';

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

const CLASSES = {
  key: 'text-cyan-700 dark:text-cyan-300',
  string: 'text-emerald-700 dark:text-emerald-400',
  number: 'text-amber-700 dark:text-amber-400',
  literal: 'text-violet-700 dark:text-violet-400',
};

export const JsonHighlight: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > cursor) nodes.push(text.slice(cursor, at));
    const tone = match[1] ? (match[2] ? CLASSES.key : CLASSES.string) : match[3] ? CLASSES.literal : CLASSES.number;
    nodes.push(<span key={at} className={tone}>{match[1] ? match[1] : match[0]}</span>);
    if (match[2]) nodes.push(match[2]);
    cursor = at + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <pre className={`overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-slate-700 dark:text-slate-300 ${className}`}>{nodes}</pre>;
};
