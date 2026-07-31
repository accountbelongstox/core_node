/**
 * Shared helpers, labels and small components for the pycore-manager Vocabulary
 * page tabs. Self-contained - no laravel-manager shell contexts (the page uses
 * pycoreApi + local React state, matching PcWordAudioPage's style).
 */
import React from 'react';
import { CheckCircle2, MinusCircle, Loader2, AlertCircle } from 'lucide-react';
import { humanBytes as formatHumanBytes } from '../../utils/pcFormat';
import { PycoreManagerStorageKeys as StorageKeys } from '../../persistence/PycoreManagerStorageKeys';

/** The sub-tabs (mirrors the laravel-manager #/vocabulary page). */
export const VOCAB_TABS = [
  { key: 'translate', label: 'Translate' },           // 翻译
  { key: 'words', label: 'Words' },                   // 单词
  { key: 'libraries', label: 'Libraries' },           // 词库
  { key: 'statistics', label: 'Statistics' },         // 统计
  { key: 'tts-queue', label: 'TTS Queue' },           // TTS 队列
  { key: 'learning', label: 'Learning Tasks' },       // 学习任务
] as const;
export type VocabTabKey = (typeof VOCAB_TABS)[number]['key'];
export const VOCAB_TAB_KEY = StorageKeys.PYCORE_VOCAB_TAB;

/** Shared UI labels (en literals; zh kept as comments per page convention). */
export const VL = {
  offline: 'pycore is offline - vocabulary data unavailable.',  // pycore 离线 - 词汇数据不可用。
  laravelDown: 'Laravel backend unreachable - counts may be zero.',  // Laravel 后端不可达 - 计数可能为零。
  refresh: 'Refresh',                                           // 刷新
  loading: 'Loading…',                                         // 加载中…
  empty: 'No data.',                                           // 暂无数据。
  error: 'Failed to load.',                                    // 加载失败。
  retry: 'Retry',                                              // 重试
  search: 'Search',                                            // 搜索
  language: 'Language',                                        // 语言
  page: 'Page',                                                // 页码
  perPage: 'Per page',                                         // 每页
  total: 'Total',                                              // 共计
  prev: 'Prev',                                                // 上一页
  next: 'Next',                                                // 下一页
  of: 'of',                                                    // /
  actions: 'Actions',                                          // 操作
  delete: 'Delete',                                            // 删除
  edit: 'Edit',                                                // 编辑
  save: 'Save',                                                // 保存
  cancel: 'Cancel',                                            // 取消
  close: 'Close',                                              // 关闭
  confirmDelete: 'Delete this item? This cannot be undone.',   // 确认删除？此操作不可撤销。
  yes: 'Yes',                                                  // 是
  no: 'No',                                                    // 否
};

export const OK_BADGE = 'bg-emerald-500/15 text-emerald-500';
export const OFF_BADGE = 'bg-slate-500/15 text-slate-400';
export const WARN_BADGE = 'bg-amber-500/15 text-amber-500';

/** Boolean presence badge (has translation / has audio / is valid). */
export function PresenceBadge({ ok, yesLabel, noLabel }: { ok: boolean; yesLabel: string; noLabel: string }) {
  const Icon = ok ? CheckCircle2 : MinusCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ok ? OK_BADGE : OFF_BADGE}`}>
      <Icon className="w-3 h-3" /> {ok ? yesLabel : noLabel}
    </span>
  );
}

/** Offline / error banner shown at the top of a tab when pycore is unreachable. */
export function VocabBanner({ kind, message }: { kind: 'offline' | 'error' | 'warn'; message: string }) {
  const Icon = kind === 'offline' ? AlertCircle : kind === 'error' ? AlertCircle : Loader2;
  const cls = kind === 'warn'
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${cls}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Compact byte size (B / KB / MB). */
export function humanBytes(n: number | undefined | null): string {
  return formatHumanBytes(n ?? 0, '0 B');
}

/** Integer formatting with thousands separators. */
export function humanInt(n: number | undefined | null): string {
  const v = Number(n || 0);
  return v.toLocaleString('en-US');
}

/**
 * Unwrap the laravel `{ success, data: <payload> }` envelope. The pycore proxy
 * returns laravel's raw JSON verbatim; laravel-manager's BaseAPI extracts
 * `data.data || data` (BaseAPI.ts:339), so we mirror that here. For a bare
 * array response or a flat `{ success, items }` response (no `data` key), this
 * returns the body unchanged. Always returns the payload object/array.
 */
export function vp<T = Record<string, unknown>>(r: unknown): T {
  if (r && typeof r === 'object' && !Array.isArray(r) && (r as any).data !== undefined && (r as any).data !== null) {
    return (r as any).data as T;
  }
  return r as T;
}

/** Coerce a value to an array (handles bare-array payloads + object wrappers). */
export function toArray<T = Record<string, unknown>>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return (o.items || o.data || o.words || o.libraries || o.languages || o.breakdown || []) as T[];
  }
  return [];
}

/** Spinner row. */
export function VocabLoading({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>{label || VL.loading}</span>
    </div>
  );
}
